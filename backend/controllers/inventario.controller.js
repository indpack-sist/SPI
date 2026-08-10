import { executeQuery } from '../config/database.js';
import { generarPDFKardex } from '../utils/pdf-generator.js';
import { generarKardexXLSX as construirKardexXLSX } from '../utils/excelGenerators/kardexXLSX.js';

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
                SELECT SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio) / NULLIF(MAX(rp.rendimiento_unidades), 0)
                FROM recetas_productos rp
                INNER JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
                INNER JOIN productos insumo ON rd.id_insumo = insumo.id_producto
                WHERE rp.id_producto_terminado = p.id_producto 
                AND rp.es_principal = 1 
                AND rp.es_activa = 1
                GROUP BY rp.id_receta_producto
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
      return res.status(500).json({ error: 'No se pudo obtener el resumen de stock del inventario. Por favor, intente de nuevo.' });
    }
    
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
    res.status(500).json({ error: 'Error al procesar la información de inventario: ' + error.message });
  }
}

// Construye los datos del Kardex (filas + filtros) a partir de los parámetros de
// consulta. Se comparte entre la exportación a PDF y a Excel.
// Fuentes de movimiento: detalle_entradas (compras/producción/merma),
// detalle_salidas (ventas/consumo/producción) y ajustes_inventario
// (diferencia con signo: positiva = entrada, negativa = salida).
async function construirDatosKardex(query) {
  const { fecha_inicio, fecha_fin, id_tipo_inventario } = query;

  // Rango por defecto: desde el inicio de los tiempos hasta hoy.
  const desde = fecha_inicio || '1900-01-01';
  const hasta = fecha_fin || new Date().toISOString().slice(0, 10);

  if (fecha_inicio && fecha_fin && fecha_inicio > fecha_fin) {
    const err = new Error('La fecha de inicio no puede ser mayor que la fecha de fin.');
    err.status = 400;
    throw err;
  }

  {
    // Subconsultas de movimientos: se calculan por producto tanto antes del
    // periodo (para el balance inicial) como dentro del periodo.
    const sql = `
      SELECT
        p.id_producto,
        p.codigo,
        p.nombre AS producto,
        p.unidad_medida,
        ti.nombre AS tipo_inventario,
        COALESCE(c.nombre, 'SIN CATEGORÍA') AS categoria,

        COALESCE((
          SELECT SUM(de.cantidad)
          FROM detalle_entradas de
          INNER JOIN entradas e ON de.id_entrada = e.id_entrada
          WHERE de.id_producto = p.id_producto
            AND COALESCE(e.estado, 'Activo') <> 'Anulado'
            AND DATE(e.fecha_movimiento) < ?
        ), 0) AS ent_antes,

        COALESCE((
          SELECT SUM(ds.cantidad)
          FROM detalle_salidas ds
          INNER JOIN salidas s ON ds.id_salida = s.id_salida
          WHERE ds.id_producto = p.id_producto
            AND COALESCE(s.estado, 'Activo') <> 'Anulado'
            AND DATE(s.fecha_movimiento) < ?
        ), 0) AS sal_antes,

        COALESCE((
          SELECT SUM(ai.diferencia)
          FROM ajustes_inventario ai
          WHERE ai.id_producto = p.id_producto
            AND DATE(ai.fecha_ajuste) < ?
        ), 0) AS aj_antes,

        COALESCE((
          SELECT SUM(de.cantidad)
          FROM detalle_entradas de
          INNER JOIN entradas e ON de.id_entrada = e.id_entrada
          WHERE de.id_producto = p.id_producto
            AND COALESCE(e.estado, 'Activo') <> 'Anulado'
            AND DATE(e.fecha_movimiento) BETWEEN ? AND ?
        ), 0) AS ent_periodo,

        COALESCE((
          SELECT SUM(ds.cantidad)
          FROM detalle_salidas ds
          INNER JOIN salidas s ON ds.id_salida = s.id_salida
          WHERE ds.id_producto = p.id_producto
            AND COALESCE(s.estado, 'Activo') <> 'Anulado'
            AND DATE(s.fecha_movimiento) BETWEEN ? AND ?
        ), 0) AS sal_periodo,

        COALESCE((
          SELECT SUM(ai.diferencia)
          FROM ajustes_inventario ai
          WHERE ai.id_producto = p.id_producto
            AND DATE(ai.fecha_ajuste) BETWEEN ? AND ?
        ), 0) AS aj_net_periodo

      FROM productos p
      INNER JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE p.estado = 'Activo'
      ${id_tipo_inventario ? 'AND p.id_tipo_inventario = ?' : ''}
      ORDER BY categoria ASC, p.codigo ASC
    `;

    const params = [
      desde, desde, desde,          // ..._antes
      desde, hasta,                 // ent_periodo
      desde, hasta,                 // sal_periodo
      desde, hasta                  // aj_net_periodo
    ];
    if (id_tipo_inventario) params.push(id_tipo_inventario);

    const result = await executeQuery(sql, params);

    if (!result.success) {
      const err = new Error('No se pudo generar el Kardex. Intente de nuevo.');
      err.status = 500;
      throw err;
    }

    // Consolidación: balance inicial, entradas y salidas del periodo (incluyendo
    // ajustes), y stock resultante. Se descartan productos sin movimiento ni
    // saldo en el periodo (no se pidió incluir stock cero).
    const filas = result.data
      .map(row => {
        // Balance inicial = lo que había hasta el día anterior a "desde"
        // (movimientos con fecha < desde). Se reconstruye del historial y puede
        // quedar negativo cuando nunca se cargó el inventario inicial de un
        // producto; en ese caso se fija en 0: no existen cantidades físicas
        // negativas en almacén.
        const balance_inicial = Math.max(
          0,
          parseFloat(row.ent_antes) - parseFloat(row.sal_antes) + parseFloat(row.aj_antes)
        );
        // Los ajustes del período se netean por producto: solo el saldo neto
        // suma a ENTRADA (si es positivo) o a SALIDA (si es negativo). Así los
        // pares de corrección que se cancelan (ej. subir a 800 y bajar a 0.80)
        // no inflan ambas columnas; el escenario de ajustes todos positivos
        // (0→2000 varias veces) se conserva porque el neto sigue siendo positivo.
        const ajNet = parseFloat(row.aj_net_periodo);
        const entrada = parseFloat(row.ent_periodo) + Math.max(0, ajNet);
        const salida = parseFloat(row.sal_periodo) + Math.max(0, -ajNet);
        // Stock terminado = lo que quedó al cierre del período (BI + entradas −
        // salidas). También se acota a 0 para no arrastrar negativos.
        const stock_terminado = Math.max(0, balance_inicial + entrada - salida);
        return {
          categoria: row.categoria,
          codigo: row.codigo,
          producto: row.producto,
          unidad: row.unidad_medida,
          balance_inicial,
          entrada,
          salida,
          stock_terminado
        };
      })
      // Se excluye la categoría Mermas y solo se listan productos con movimiento
      // en el período: si no hubo entrada ni salida (incluidos los ajustes ya
      // sumados en cada columna), el producto no aparece aunque tenga balance o
      // stock.
      .filter(f =>
        !/^merma/i.test(f.categoria || '') &&
        (f.entrada !== 0 || f.salida !== 0)
      );

    let tipoInventarioNombre = 'Todos';
    if (id_tipo_inventario && result.data.length > 0) {
      tipoInventarioNombre = result.data[0].tipo_inventario;
    } else if (id_tipo_inventario) {
      const tipoRes = await executeQuery(
        'SELECT nombre FROM tipos_inventario WHERE id_tipo_inventario = ?',
        [id_tipo_inventario]
      );
      if (tipoRes.success && tipoRes.data.length > 0) {
        tipoInventarioNombre = tipoRes.data[0].nombre;
      }
    }

    return {
      filas,
      filtros: {
        desde: fecha_inicio || null,
        hasta: fecha_fin || null,
        tipo_inventario: tipoInventarioNombre
      },
      desde,
      hasta
    };
  }
}

// Exportación del Kardex a PDF.
export async function generarKardexPDF(req, res) {
  try {
    const { filas, filtros, desde, hasta } = await construirDatosKardex(req.query);
    const pdfBuffer = await generarPDFKardex({ filas, filtros });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kardex_${desde}_${hasta}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al generar Kardex PDF:', error);
    res.status(error.status || 500).json({ error: 'Error al generar el Kardex: ' + error.message });
  }
}

// Exportación del Kardex a Excel (XLSX) con el mismo contenido que el PDF.
export async function generarKardexXLSX(req, res) {
  try {
    const { filas, filtros, desde, hasta } = await construirDatosKardex(req.query);
    const xlsxBuffer = await construirKardexXLSX({ filas, filtros });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="kardex_${desde}_${hasta}.xlsx"`);
    res.send(xlsxBuffer);
  } catch (error) {
    console.error('Error al generar Kardex XLSX:', error);
    res.status(error.status || 500).json({ error: 'Error al generar el Kardex: ' + error.message });
  }
}