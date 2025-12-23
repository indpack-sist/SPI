import { executeQuery } from '../config/database.js';

export async function getResumenStockInventario(req, res) {
  try {
    const sql = `
      SELECT 
        ti.id_tipo_inventario,
        ti.nombre AS tipo_inventario,
        COUNT(DISTINCT p.id_producto) AS total_productos,
        COALESCE(SUM(p.stock_actual), 0) AS stock_total,
        COALESCE(SUM(p.stock_actual * p.costo_unitario_promedio), 0) AS valor_total
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
    
    const data = result.data.map(row => ({
      ...row,
      stock_total: parseFloat(row.stock_total) || 0,
      valor_total: parseFloat(row.valor_total) || 0
    }));
    
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}