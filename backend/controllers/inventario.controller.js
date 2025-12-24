import { executeQuery } from '../config/database.js';

export async function getResumenStockInventario(_req, res) {
  try {
    const sql = `
      SELECT 
        ti.id_tipo_inventario,
        ti.nombre AS tipo_inventario,
        COUNT(DISTINCT p.id_producto) AS total_productos,
        COALESCE(SUM(p.stock_actual), 0) AS stock_total,
        COALESCE(
          SUM(
            p.stock_actual * COALESCE(
              (
                SELECT SUM(op.costo_materiales) / SUM(op.cantidad_producida)
                FROM ordenes_produccion op
                WHERE op.id_producto_terminado = p.id_producto 
                AND op.estado = 'Finalizada' 
                AND op.cantidad_producida > 0 
                AND op.costo_materiales > 0
              ),
              (
                SELECT SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio) / MAX(rp.rendimiento_unidades)
                FROM recetas_productos rp
                INNER JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
                INNER JOIN productos insumo ON rd.id_insumo = insumo.id_producto
                WHERE rp.id_producto_terminado = p.id_producto 
                AND rp.es_principal = 1 
                AND rp.es_activa = 1
                GROUP BY rp.id_producto_terminado
              ),
              p.costo_unitario_promedio,
              0
            )
          ), 
          0
        ) AS valor_costo,
        
        COALESCE(
          SUM(
            CASE 
              WHEN ti.nombre IN ('Productos Terminados', 'Productos de Reventa') 
                   AND p.precio_venta > 0 
              THEN p.stock_actual * p.precio_venta
              ELSE 0
            END
          ),
          0
        ) AS valor_venta
        
      FROM tipos_inventario ti
      LEFT JOIN productos p ON ti.id_tipo_inventario = p.id_tipo_inventario 
        AND p.estado = 'Activo'
        AND p.stock_actual > 0
      WHERE ti.estado = 'Activo'
      GROUP BY ti.id_tipo_inventario, ti.nombre
      ORDER BY ti.nombre ASC
    `;
    
    const result = await executeQuery(sql);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    // Formateamos los números para asegurar que sean float
    const data = result.data.map(row => ({
      ...row,
      stock_total: parseFloat(row.stock_total) || 0,
      valor_costo: parseFloat(row.valor_costo) || 0,
      valor_venta: parseFloat(row.valor_venta) || 0
    }));
    
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}