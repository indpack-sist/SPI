import { executeQuery, executeTransaction } from '../config/database.js';

export async function realizarConteoFisico(req, res) {
  try {
    const {
      id_producto,
      stock_fisico,
      motivo,
      observaciones
    } = req.body;

    const id_usuario_ajuste = req.user?.id_empleado;

    if (!id_producto || stock_fisico === undefined || !motivo) {
      return res.status(400).json({
        success: false,
        error: 'id_producto, stock_fisico y motivo son requeridos'
      });
    }

    if (!id_usuario_ajuste) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    const productoResult = await executeQuery(
      `SELECT 
        id_producto,
        codigo,
        nombre,
        stock_actual,
        costo_unitario_promedio,
        unidad_medida
      FROM productos 
      WHERE id_producto = ?`,
      [id_producto]
    );

    if (!productoResult.success || productoResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    const producto = productoResult.data[0];
    const stock_sistema = parseFloat(producto.stock_actual);
    const stock_fisico_decimal = parseFloat(stock_fisico);
    const diferencia = stock_fisico_decimal - stock_sistema;
    const tipo_ajuste = diferencia >= 0 ? 'Positivo' : 'Negativo';

    if (diferencia === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay diferencia entre stock sistema y stock físico'
      });
    }

    const result = await executeTransaction(async (connection) => {
      const ajusteResult = await executeQuery(
        `INSERT INTO ajustes_inventario (
          id_producto,
          stock_sistema,
          stock_fisico,
          diferencia,
          tipo_ajuste,
          motivo,
          observaciones,
          id_usuario_ajuste
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id_producto,
          stock_sistema,
          stock_fisico_decimal,
          diferencia,
          tipo_ajuste,
          motivo,
          observaciones || null,
          id_usuario_ajuste
        ],
        connection
      );

      const id_ajuste = ajusteResult.data.insertId;

      await executeQuery(
        'UPDATE productos SET stock_actual = ? WHERE id_producto = ?',
        [stock_fisico_decimal, id_producto],
        connection
      );

      return { id_ajuste };
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al realizar el ajuste de inventario'
      });
    }

    const ajusteCompleto = await executeQuery(
      'SELECT * FROM vista_ajustes_inventario WHERE id_ajuste = ?',
      [result.data.id_ajuste]
    );

    res.status(201).json({
      success: true,
      message: `Ajuste ${tipo_ajuste.toLowerCase()} realizado exitosamente`,
      data: {
        id_ajuste: result.data.id_ajuste,
        producto: producto.nombre,
        stock_anterior: stock_sistema,
        stock_nuevo: stock_fisico_decimal,
        diferencia: diferencia,
        tipo_ajuste: tipo_ajuste,
        valor_ajuste: Math.abs(diferencia) * parseFloat(producto.costo_unitario_promedio || 0),
        ajuste_completo: ajusteCompleto.data[0]
      }
    });

  } catch (error) {
    console.error('Error al realizar conteo físico:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al realizar conteo físico'
    });
  }
}

export async function getAjustesPorProducto(req, res) {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;

    const result = await executeQuery(
      `SELECT * FROM vista_ajustes_inventario 
       WHERE id_producto = ? 
       ORDER BY fecha_ajuste DESC 
       LIMIT ?`,
      [id, parseInt(limit)]
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    const resumen = await executeQuery(
      `SELECT 
        COUNT(*) as total_ajustes,
        SUM(CASE WHEN tipo_ajuste = 'Positivo' THEN 1 ELSE 0 END) as ajustes_positivos,
        SUM(CASE WHEN tipo_ajuste = 'Negativo' THEN 1 ELSE 0 END) as ajustes_negativos,
        SUM(ABS(diferencia)) as total_unidades_ajustadas,
        SUM(ABS(diferencia) * costo_unitario_promedio) as valor_total_ajustes
      FROM vista_ajustes_inventario
      WHERE id_producto = ?`,
      [id]
    );

    res.json({
      success: true,
      data: result.data,
      total: result.data.length,
      resumen: resumen.data[0]
    });

  } catch (error) {
    console.error('Error al obtener ajustes del producto:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getTodosLosAjustes(req, res) {
  try {
    const { 
      fecha_inicio,
      fecha_fin,
      tipo_ajuste,
      id_usuario,
      limit = 100,
      offset = 0
    } = req.query;

    let sql = 'SELECT * FROM vista_ajustes_inventario WHERE 1=1';
    const params = [];

    if (fecha_inicio) {
      sql += ' AND fecha_ajuste >= ?';
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      sql += ' AND fecha_ajuste <= ?';
      params.push(fecha_fin);
    }

    if (tipo_ajuste) {
      sql += ' AND tipo_ajuste = ?';
      params.push(tipo_ajuste);
    }

    if (id_usuario) {
      sql += ' AND id_usuario_ajuste = ?';
      params.push(id_usuario);
    }

    sql += ' ORDER BY fecha_ajuste DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const result = await executeQuery(sql, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    const countResult = await executeQuery(
      'SELECT COUNT(*) as total FROM ajustes_inventario'
    );

    res.json({
      success: true,
      data: result.data,
      total: result.data.length,
      total_registros: countResult.data[0].total
    });

  } catch (error) {
    console.error('Error al obtener todos los ajustes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getHistorialAjustes(req, res) {
  try {
    const { id_producto, limit = 50 } = req.query;

    let sql = `
      SELECT 
        h.*,
        DATE_FORMAT(h.fecha_ajuste, '%d/%m/%Y %H:%i') as fecha_formato
      FROM historial_ajustes_inventario h
      WHERE 1=1
    `;
    const params = [];

    if (id_producto) {
      sql += ' AND h.id_producto = ?';
      params.push(id_producto);
    }

    sql += ' ORDER BY h.fecha_ajuste DESC LIMIT ?';
    params.push(parseInt(limit));

    const result = await executeQuery(sql, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });

  } catch (error) {
    console.error('Error al obtener historial de ajustes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getDetalleAjuste(req, res) {
  try {
    const { id } = req.params;

    const ajusteResult = await executeQuery(
      'SELECT * FROM vista_ajustes_inventario WHERE id_ajuste = ?',
      [id]
    );

    if (!ajusteResult.success || ajusteResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ajuste no encontrado'
      });
    }

    const historialResult = await executeQuery(
      'SELECT * FROM historial_ajustes_inventario WHERE id_ajuste = ?',
      [id]
    );

    res.json({
      success: true,
      data: {
        ajuste: ajusteResult.data[0],
        historial: historialResult.data[0]
      }
    });

  } catch (error) {
    console.error('Error al obtener detalle del ajuste:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getEstadisticasAjustes(req, res) {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    let sqlFiltro = '';
    const params = [];

    if (fecha_inicio && fecha_fin) {
      sqlFiltro = 'WHERE fecha_ajuste BETWEEN ? AND ?';
      params.push(fecha_inicio, fecha_fin);
    }

    const resumenResult = await executeQuery(
      `SELECT 
        COUNT(*) as total_ajustes,
        SUM(CASE WHEN tipo_ajuste = 'Positivo' THEN 1 ELSE 0 END) as ajustes_positivos,
        SUM(CASE WHEN tipo_ajuste = 'Negativo' THEN 1 ELSE 0 END) as ajustes_negativos,
        SUM(CASE WHEN tipo_ajuste = 'Positivo' THEN diferencia ELSE 0 END) as total_sobrantes,
        SUM(CASE WHEN tipo_ajuste = 'Negativo' THEN ABS(diferencia) ELSE 0 END) as total_faltantes,
        SUM(ABS(diferencia) * costo_unitario_promedio) as valor_total_ajustes,
        COUNT(DISTINCT id_producto) as productos_ajustados
      FROM vista_ajustes_inventario
      ${sqlFiltro}`,
      params
    );

    const porMotivoResult = await executeQuery(
      `SELECT 
        motivo,
        COUNT(*) as cantidad,
        SUM(ABS(diferencia)) as unidades_totales,
        SUM(ABS(diferencia) * costo_unitario_promedio) as valor_total
      FROM vista_ajustes_inventario
      ${sqlFiltro}
      GROUP BY motivo
      ORDER BY cantidad DESC`,
      params
    );

    const porUsuarioResult = await executeQuery(
      `SELECT 
        usuario_ajuste,
        COUNT(*) as cantidad_ajustes,
        SUM(ABS(diferencia)) as unidades_totales
      FROM vista_ajustes_inventario
      ${sqlFiltro}
      GROUP BY usuario_ajuste
      ORDER BY cantidad_ajustes DESC
      LIMIT 10`,
      params
    );

    const productosMasAjustadosResult = await executeQuery(
      `SELECT 
        codigo_producto,
        nombre_producto,
        tipo_inventario,
        COUNT(*) as veces_ajustado,
        SUM(ABS(diferencia)) as total_unidades,
        SUM(ABS(diferencia) * costo_unitario_promedio) as valor_total
      FROM vista_ajustes_inventario
      ${sqlFiltro}
      GROUP BY id_producto, codigo_producto, nombre_producto, tipo_inventario
      ORDER BY veces_ajustado DESC
      LIMIT 10`,
      params
    );

    res.json({
      success: true,
      data: {
        resumen: resumenResult.data[0],
        por_motivo: porMotivoResult.data,
        por_usuario: porUsuarioResult.data,
        productos_mas_ajustados: productosMasAjustadosResult.data
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas de ajustes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function aprobarAjuste(req, res) {
  try {
    const { id } = req.params;
    const id_usuario_aprobacion = req.user?.id_empleado;

    if (!id_usuario_aprobacion) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    const checkResult = await executeQuery(
      'SELECT * FROM ajustes_inventario WHERE id_ajuste = ?',
      [id]
    );

    if (!checkResult.success || checkResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ajuste no encontrado'
      });
    }

    if (checkResult.data[0].aprobado) {
      return res.status(400).json({
        success: false,
        error: 'El ajuste ya fue aprobado'
      });
    }

    const result = await executeQuery(
      `UPDATE ajustes_inventario 
       SET aprobado = TRUE, id_usuario_aprobacion = ? 
       WHERE id_ajuste = ?`,
      [id_usuario_aprobacion, id]
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al aprobar el ajuste'
      });
    }

    res.json({
      success: true,
      message: 'Ajuste aprobado exitosamente'
    });

  } catch (error) {
    console.error('Error al aprobar ajuste:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getMotivosAjuste(req, res) {
  try {
    const motivos = [
      { value: 'Merma natural', label: 'Merma natural' },
      { value: 'Producto vencido', label: 'Producto vencido' },
      { value: 'Robo/Extravío', label: 'Robo/Extravío' },
      { value: 'Error de conteo anterior', label: 'Error de conteo anterior' },
      { value: 'Devolución no registrada', label: 'Devolución no registrada' },
      { value: 'Daño en almacén', label: 'Daño en almacén' },
      { value: 'Error de sistema', label: 'Error de sistema' },
      { value: 'Ajuste por inventario inicial', label: 'Ajuste por inventario inicial' },
      { value: 'Diferencia de unidades', label: 'Diferencia de unidades' },
      { value: 'Producto encontrado', label: 'Producto encontrado (stock adicional)' },
      { value: 'Otro', label: 'Otro (especificar en observaciones)' }
    ];

    res.json({
      success: true,
      data: motivos
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}