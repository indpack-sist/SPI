import { executeQuery, executeTransaction } from '../config/database.js';
import pool from '../config/database.js';

export async function getAllProductos(req, res) {
  try {
    const { estado, id_tipo_inventario, id_categoria, requiere_receta } = req.query;
    
    let sql = `
      SELECT 
        p.*,
        ti.nombre AS tipo_inventario,
        c.nombre AS categoria,
        c.id_tipo_insumo_sugerido,
        (SELECT COUNT(*) FROM recetas_productos WHERE id_producto_terminado = p.id_producto AND es_activa = 1) AS total_recetas
      FROM productos p
      INNER JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE 1=1
    `;
    const params = [];
    
    if (estado) {
      sql += ' AND p.estado = ?';
      params.push(estado);
    }
    
    if (id_tipo_inventario) {
      const ids = id_tipo_inventario.split(',').map(id => id.trim());
      const placeholders = ids.map(() => '?').join(',');
      sql += ` AND p.id_tipo_inventario IN (${placeholders})`;
      params.push(...ids);
    }
    
    if (id_categoria) {
      sql += ' AND p.id_categoria = ?';
      params.push(id_categoria);
    }
    
    if (requiere_receta !== undefined) {
      sql += ' AND p.requiere_receta = ?';
      params.push(requiere_receta === 'true' ? 1 : 0);
    }
    
    sql += ' ORDER BY p.nombre ASC';
    
    const result = await executeQuery(sql, params);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getProductoById(req, res) {
  try {
    const { id } = req.params;
    
    const sql = `
      SELECT 
        p.*,
        ti.nombre AS tipo_inventario,
        c.nombre AS categoria,
        c.id_tipo_insumo_sugerido,
        (SELECT COUNT(*) FROM recetas_productos WHERE id_producto_terminado = p.id_producto AND es_activa = 1) AS total_recetas,
        (SELECT nombre_receta FROM recetas_productos WHERE id_producto_terminado = p.id_producto AND es_principal = 1 LIMIT 1) AS receta_principal
      FROM productos p
      INNER JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE p.id_producto = ?
    `;
    
    const result = await executeQuery(sql, [id]);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    if (result.data.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getAllProductosConCosto(req, res) {
  try {
    const { estado, id_tipo_inventario } = req.query;
    
    let sql = `
      SELECT 
        p.*,
        ti.nombre AS tipo_inventario,
        c.nombre AS categoria,
        c.id_tipo_insumo_sugerido,
        COALESCE(
          (
            SELECT SUM(op.costo_materiales) / SUM(op.cantidad_producida)
            FROM ordenes_produccion op
            WHERE op.id_producto_terminado = p.id_producto 
            AND op.estado = 'Finalizada' 
            AND op.cantidad_producida > 0 
            AND op.costo_materiales > 0
          ),
          (
            SELECT 
              SUM(rd.cantidad_requerida * i.costo_unitario_promedio) / MAX(rp.rendimiento_unidades)
            FROM recetas_productos rp
            INNER JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
            INNER JOIN productos i ON rd.id_insumo = i.id_producto
            WHERE rp.id_producto_terminado = p.id_producto 
            AND rp.es_principal = 1 
            AND rp.es_activa = 1
            GROUP BY rp.id_receta_producto
          ),
          p.costo_unitario_promedio,
          0
        ) AS costo_produccion_calculado
      FROM productos p
      INNER JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE 1=1
    `;

    const params = [];
    if (estado) { sql += ' AND p.estado = ?'; params.push(estado); }
    if (id_tipo_inventario) { sql += ' AND p.id_tipo_inventario = ?'; params.push(id_tipo_inventario); }
    sql += ' ORDER BY p.nombre ASC';

    const result = await executeQuery(sql, params);

    if (!result || !result.success || !Array.isArray(result.data)) {
       return res.json({ success: true, data: [], total: 0 });
    }

    const dataFinal = result.data.map(prod => {
      const costo = parseFloat(prod.costo_produccion_calculado || 0);
      const stock = parseFloat(prod.stock_actual || 0);
      return {
        ...prod,
        costo_unitario_promedio: costo, 
        valor_inventario: stock * costo
      };
    });

    res.json({
      success: true,
      data: dataFinal,
      total: dataFinal.length
    });
  } catch (error) {
    console.error("Error en getAllProductosConCosto:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function createProducto(req, res) {
  try {
    const {
      codigo,
      nombre,
      descripcion,
      id_categoria,
      id_tipo_inventario,
      unidad_medida,
      costo_unitario_promedio,
      costo_unitario_promedio_usd,
      precio_venta,
      stock_actual,
      stock_minimo,
      stock_maximo,
      requiere_receta,
      estado
    } = req.body;
    
    if (!codigo || !nombre || !id_tipo_inventario || !unidad_medida) {
      return res.status(400).json({ 
        error: 'codigo, nombre, id_tipo_inventario y unidad_medida son requeridos' 
      });
    }
    
    const checkCodigo = await executeQuery(
      'SELECT * FROM productos WHERE codigo = ?',
      [codigo]
    );
    
    if (checkCodigo.data.length > 0) {
      return res.status(400).json({ error: 'El código ya está registrado' });
    }
    
    const result = await executeQuery(
      `INSERT INTO productos (
        codigo, nombre, descripcion, id_categoria, id_tipo_inventario,
        unidad_medida, costo_unitario_promedio, costo_unitario_promedio_usd, precio_venta, stock_actual, stock_minimo,
        stock_maximo, requiere_receta, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo,
        nombre,
        descripcion,
        id_categoria || null,
        id_tipo_inventario,
        unidad_medida,
        costo_unitario_promedio || 0,
        costo_unitario_promedio_usd || 0,
        precio_venta || 0,
        stock_actual || 0,
        stock_minimo || 0,
        stock_maximo || 0,
        requiere_receta || false,
        estado || 'Activo'
      ]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: {
        id_producto: result.data.insertId,
        codigo,
        nombre
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateProducto(req, res) {
  try {
    const { id } = req.params;
    const {
      codigo,
      nombre,
      descripcion,
      id_categoria,
      id_tipo_inventario,
      unidad_medida,
      precio_venta,
      stock_minimo,
      stock_maximo,
      requiere_receta,
      estado
    } = req.body;
    
    const checkResult = await executeQuery(
      'SELECT * FROM productos WHERE id_producto = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    if (codigo !== checkResult.data[0].codigo) {
      const checkCodigo = await executeQuery(
        'SELECT * FROM productos WHERE codigo = ? AND id_producto != ?',
        [codigo, id]
      );
      
      if (checkCodigo.data.length > 0) {
        return res.status(400).json({ error: 'El código ya está registrado' });
      }
    }
    
    const result = await executeQuery(
      `UPDATE productos SET 
        codigo = ?, nombre = ?, descripcion = ?, id_categoria = ?,
        id_tipo_inventario = ?, unidad_medida = ?, precio_venta = ?, stock_minimo = ?,
        stock_maximo = ?, requiere_receta = ?, estado = ?
      WHERE id_producto = ?`,
      [
        codigo,
        nombre,
        descripcion,
        id_categoria,
        id_tipo_inventario,
        unidad_medida,
        precio_venta || 0,
        stock_minimo,
        stock_maximo,
        requiere_receta,
        estado,
        id
      ]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Producto actualizado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteProducto(req, res) {
  try {
    const { id } = req.params;
    
    const checkResult = await executeQuery(
      'SELECT * FROM productos WHERE id_producto = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    const result = await executeQuery(
      'UPDATE productos SET estado = ? WHERE id_producto = ?',
      ['Inactivo', id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Producto desactivado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


export async function getHistorialMovimientos(req, res) {
  try {
    const { id } = req.params;
    const { tipo_movimiento } = req.query;
    
    const checkProducto = await executeQuery(
      'SELECT codigo, nombre FROM productos WHERE id_producto = ?',
      [id]
    );
    
    if (checkProducto.data.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    let movimientos = [];
    
    if (!tipo_movimiento || tipo_movimiento === 'entrada') {
      const entradas = await executeQuery(
        `SELECT 
          'entrada' AS tipo_movimiento,
          e.id_entrada AS id_movimiento,
          e.fecha_movimiento,
          e.moneda,
          ti.nombre AS inventario,
          p.razon_social AS proveedor,
          ed.cantidad,
          ed.costo_unitario,
          (ed.cantidad * ed.costo_unitario) AS costo_total,
          e.documento_soporte,
          emp.nombre_completo AS registrado_por,
          e.observaciones
        FROM entradas e
        INNER JOIN detalle_entradas ed ON e.id_entrada = ed.id_entrada
        INNER JOIN tipos_inventario ti ON e.id_tipo_inventario = ti.id_tipo_inventario
        LEFT JOIN proveedores p ON e.id_proveedor = p.id_proveedor
        LEFT JOIN empleados emp ON e.id_registrado_por = emp.id_empleado
        WHERE ed.id_producto = ?
        ORDER BY e.fecha_movimiento DESC`,
        [id]
      );
      
      if (entradas.success) {
        movimientos = [...movimientos, ...entradas.data];
      }
    }
    
    if (!tipo_movimiento || tipo_movimiento === 'salida') {
      const salidas = await executeQuery(
        `SELECT 
          'salida' AS tipo_movimiento,
          s.id_salida AS id_movimiento,
          s.fecha_movimiento,
          s.moneda,
          ti.nombre AS inventario,
          s.tipo_movimiento AS motivo_salida,
          COALESCE(c.razon_social, s.departamento) AS destino,
          sd.cantidad,
          sd.precio_unitario AS costo_unitario,
          (sd.cantidad * sd.precio_unitario) AS costo_total,
          NULL AS documento_soporte,
          emp.nombre_completo AS registrado_por,
          s.observaciones
        FROM salidas s
        INNER JOIN detalle_salidas sd ON s.id_salida = sd.id_salida
        INNER JOIN tipos_inventario ti ON s.id_tipo_inventario = ti.id_tipo_inventario
        LEFT JOIN clientes c ON s.id_cliente = c.id_cliente
        LEFT JOIN empleados emp ON s.id_registrado_por = emp.id_empleado
        WHERE sd.id_producto = ?
        ORDER BY s.fecha_movimiento DESC`,
        [id]
      );
      
      if (salidas.success) {
        movimientos = [...movimientos, ...salidas.data];
      }
    }
    
    if (!tipo_movimiento || tipo_movimiento === 'transferencia') {
      const transferencias = await executeQuery(
        `SELECT 
          'transferencia_salida' AS tipo_movimiento,
          tc.id_transferencia_cabecera AS id_movimiento,
          tc.fecha_transferencia AS fecha_movimiento,
          'PEN' AS moneda,
          ti_origen.nombre AS inventario,
          CONCAT('→ ', ti_destino.nombre) AS destino,
          td.cantidad,
          prod_origen.costo_unitario_promedio AS costo_unitario,
          (td.cantidad * prod_origen.costo_unitario_promedio) AS costo_total,
          NULL AS documento_soporte,
          emp.nombre_completo AS registrado_por,
          tc.observaciones
        FROM transferencias_cabecera tc
        INNER JOIN detalle_transferencias td ON tc.id_transferencia_cabecera = td.id_transferencia
        INNER JOIN productos prod_origen ON td.id_producto = prod_origen.id_producto
        INNER JOIN tipos_inventario ti_origen ON tc.id_tipo_inventario_origen = ti_origen.id_tipo_inventario
        INNER JOIN tipos_inventario ti_destino ON tc.id_tipo_inventario_destino = ti_destino.id_tipo_inventario
        LEFT JOIN empleados emp ON tc.id_registrado_por = emp.id_empleado
        WHERE td.id_producto = ? AND tc.id_tipo_inventario_origen = (SELECT id_tipo_inventario FROM productos WHERE id_producto = ?)
        ORDER BY tc.fecha_transferencia DESC`,
        [id, id]
      );
      
      if (transferencias.success) {
        movimientos = [...movimientos, ...transferencias.data];
      }
      
      const transferenciasDestino = await executeQuery(
        `SELECT 
          'transferencia_entrada' AS tipo_movimiento,
          tc.id_transferencia_cabecera AS id_movimiento,
          tc.fecha_transferencia AS fecha_movimiento,
          'PEN' AS moneda,
          ti_destino.nombre AS inventario,
          CONCAT('← ', ti_origen.nombre) AS destino,
          td.cantidad,
          prod_origen.costo_unitario_promedio AS costo_unitario,
          (td.cantidad * prod_origen.costo_unitario_promedio) AS costo_total,
          NULL AS documento_soporte,
          emp.nombre_completo AS registrado_por,
          tc.observaciones
        FROM transferencias_cabecera tc
        INNER JOIN detalle_transferencias td ON tc.id_transferencia_cabecera = td.id_transferencia
        INNER JOIN productos prod_origen ON td.id_producto = prod_origen.id_producto
        INNER JOIN tipos_inventario ti_origen ON tc.id_tipo_inventario_origen = ti_origen.id_tipo_inventario
        INNER JOIN tipos_inventario ti_destino ON tc.id_tipo_inventario_destino = ti_destino.id_tipo_inventario
        LEFT JOIN empleados emp ON tc.id_registrado_por = emp.id_empleado
        WHERE td.id_producto = ? AND tc.id_tipo_inventario_destino = (SELECT id_tipo_inventario FROM productos WHERE id_producto = ?)
        ORDER BY tc.fecha_transferencia DESC`,
        [id, id]
      );
      
      if (transferenciasDestino.success) {
        movimientos = [...movimientos, ...transferenciasDestino.data];
      }
    }
    
    if (!tipo_movimiento || tipo_movimiento === 'produccion') {
      const produccion = await executeQuery(
        `SELECT 
          'produccion_consumo' AS tipo_movimiento,
          op.id_orden AS id_movimiento,
          op.fecha_fin AS fecha_movimiento,
          'PEN' AS moneda,
          'Producción' AS inventario,
          CONCAT('Orden ', op.numero_orden, ' - ', pt.nombre) AS destino,
          opm.cantidad_requerida AS cantidad,
          opm.costo_unitario,
          opm.costo_total,
          NULL AS documento_soporte,
          emp.nombre_completo AS registrado_por,
          op.observaciones
        FROM op_consumo_materiales opm
        INNER JOIN ordenes_produccion op ON opm.id_orden = op.id_orden
        INNER JOIN productos pt ON op.id_producto_terminado = pt.id_producto
        LEFT JOIN empleados emp ON op.id_supervisor = emp.id_empleado
        WHERE opm.id_insumo = ? AND op.estado = 'Finalizada'
        ORDER BY op.fecha_fin DESC`,
        [id]
      );
      
      if (produccion.success) {
        movimientos = [...movimientos, ...produccion.data];
      }
    }
    
    movimientos.sort((a, b) => new Date(b.fecha_movimiento) - new Date(a.fecha_movimiento));
    
    res.json({
      success: true,
      data: movimientos,
      total: movimientos.length,
      producto: checkProducto.data[0]
    });
  } catch (error) {
    console.error('Error en getHistorialMovimientos:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function getRecetasByProducto(req, res) {
  try {
    const { id } = req.params;
    
    const sql = `
      SELECT 
        rp.id_receta_producto,
        rp.nombre_receta,
        rp.descripcion,
        rp.version,
        rp.es_activa,
        rp.es_principal,
        rp.rendimiento_unidades,
        rp.tiempo_produccion_minutos,
        rp.fecha_creacion,
        rp.fecha_modificacion,
        COUNT(rd.id_detalle) AS total_insumos,
        SUM(rd.cantidad_requerida * i.costo_unitario_promedio) AS costo_total_materiales
      FROM recetas_productos rp
      LEFT JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
      LEFT JOIN productos i ON rd.id_insumo = i.id_producto
      WHERE rp.id_producto_terminado = ?
      GROUP BY rp.id_receta_producto
      ORDER BY rp.es_principal DESC, rp.fecha_creacion DESC
    `;
    
    const result = await executeQuery(sql, [id]);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getDetalleReceta(req, res) {
  try {
    const { idReceta } = req.params;
    
    const sql = `
      SELECT 
        rd.id_detalle,
        rd.id_receta_producto,
        rd.id_insumo,
        i.codigo AS codigo_insumo,
        i.nombre AS insumo,
        rd.cantidad_requerida,
        rd.unidad_medida,
        rd.orden_agregado,
        rd.es_critico,
        i.costo_unitario_promedio,
        (rd.cantidad_requerida * i.costo_unitario_promedio) AS costo_total_insumo,
        i.stock_actual,
        rd.notas
      FROM recetas_detalle rd
      INNER JOIN productos i ON rd.id_insumo = i.id_producto
      WHERE rd.id_receta_producto = ?
      ORDER BY rd.orden_agregado ASC, i.nombre ASC
    `;
    
    const result = await executeQuery(sql, [idReceta]);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    const costoTotal = result.data.reduce((sum, item) => {
      return sum + parseFloat(item.costo_total_insumo || 0);
    }, 0);
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length,
      costo_produccion: costoTotal
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createReceta(req, res) {
  try {
    const {
      id_producto_terminado,
      nombre_receta,
      descripcion,
      version,
      es_principal,
      rendimiento_unidades,
      tiempo_produccion_minutos,
      notas
    } = req.body;
    
    if (!id_producto_terminado || !nombre_receta) {
      return res.status(400).json({ 
        error: 'id_producto_terminado y nombre_receta son requeridos' 
      });
    }
    
    const checkPT = await executeQuery(
      'SELECT requiere_receta FROM productos WHERE id_producto = ?',
      [id_producto_terminado]
    );
    
    if (checkPT.data.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    if (!checkPT.data[0].requiere_receta) {
      return res.status(400).json({ 
        error: 'Este producto no requiere receta (producto de reventa)' 
      });
    }
    
    if (es_principal) {
      await executeQuery(
        'UPDATE recetas_productos SET es_principal = 0 WHERE id_producto_terminado = ?',
        [id_producto_terminado]
      );
    }
    
    const result = await executeQuery(
      `INSERT INTO recetas_productos (
        id_producto_terminado, nombre_receta, descripcion, version,
        es_principal, rendimiento_unidades, tiempo_produccion_minutos, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_producto_terminado,
        nombre_receta,
        descripcion || null,
        version || null,
        es_principal || 0,
        rendimiento_unidades || 1,
        tiempo_produccion_minutos || 0,
        notas || null
      ]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      message: 'Receta creada exitosamente',
      data: {
        id_receta_producto: result.data.insertId
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateReceta(req, res) {
  try {
    const { idReceta } = req.params;
    const {
      nombre_receta,
      descripcion,
      version,
      es_activa,
      es_principal,
      rendimiento_unidades,
      tiempo_produccion_minutos,
      notas
    } = req.body;
    
    const checkResult = await executeQuery(
      'SELECT id_producto_terminado FROM recetas_productos WHERE id_receta_producto = ?',
      [idReceta]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    if (es_principal) {
      await executeQuery(
        'UPDATE recetas_productos SET es_principal = 0 WHERE id_producto_terminado = ? AND id_receta_producto != ?',
        [checkResult.data[0].id_producto_terminado, idReceta]
      );
    }
    
    const result = await executeQuery(
      `UPDATE recetas_productos SET 
        nombre_receta = ?, descripcion = ?, version = ?, es_activa = ?,
        es_principal = ?, rendimiento_unidades = ?, tiempo_produccion_minutos = ?, notas = ?
      WHERE id_receta_producto = ?`,
      [
        nombre_receta,
        descripcion,
        version,
        es_activa,
        es_principal,
        rendimiento_unidades,
        tiempo_produccion_minutos,
        notas,
        idReceta
      ]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Receta actualizada exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteReceta(req, res) {
  try {
    const { idReceta } = req.params;
    
    const checkResult = await executeQuery(
      'SELECT * FROM recetas_productos WHERE id_receta_producto = ?',
      [idReceta]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    if (checkResult.data[0].es_principal) {
      const countRecetas = await executeQuery(
        'SELECT COUNT(*) as total FROM recetas_productos WHERE id_producto_terminado = ? AND es_activa = 1',
        [checkResult.data[0].id_producto_terminado]
      );
      
      if (countRecetas.data[0].total === 1) {
        return res.status(400).json({ 
          error: 'No se puede eliminar la única receta activa del producto' 
        });
      }
    }
    
    const result = await executeQuery(
      'DELETE FROM recetas_productos WHERE id_receta_producto = ?',
      [idReceta]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Receta eliminada exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createRecetaItem(req, res) {
  try {
    const {
      id_receta_producto,
      id_insumo,
      cantidad_requerida,
      unidad_medida,
      orden_agregado,
      es_critico,
      notas
    } = req.body;
    
    if (!id_receta_producto || !id_insumo || !cantidad_requerida || !unidad_medida) {
      return res.status(400).json({ 
        error: 'Todos los campos son requeridos excepto notas' 
      });
    }
    
    const checkReceta = await executeQuery(
      'SELECT * FROM recetas_productos WHERE id_receta_producto = ?',
      [id_receta_producto]
    );
    
    if (checkReceta.data.length === 0) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    const checkInsumo = await executeQuery(
      'SELECT id_producto FROM productos WHERE id_producto = ?',
      [id_insumo]
    );
    
    if (checkInsumo.data.length === 0) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }
    
    const checkDuplicate = await executeQuery(
      'SELECT * FROM recetas_detalle WHERE id_receta_producto = ? AND id_insumo = ?',
      [id_receta_producto, id_insumo]
    );
    
    if (checkDuplicate.data.length > 0) {
      return res.status(400).json({ 
        error: 'Este insumo ya está en esta receta' 
      });
    }
    
    const result = await executeQuery(
      `INSERT INTO recetas_detalle (
        id_receta_producto, id_insumo, cantidad_requerida, unidad_medida,
        orden_agregado, es_critico, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id_receta_producto,
        id_insumo,
        cantidad_requerida,
        unidad_medida,
        orden_agregado || 0,
        es_critico || 0,
        notas || null
      ]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      message: 'Insumo agregado a la receta exitosamente',
      data: {
        id_detalle: result.data.insertId
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateRecetaItem(req, res) {
  try {
    const { id } = req.params;
    const { cantidad_requerida, unidad_medida, orden_agregado, es_critico, notas } = req.body;
    
    const checkResult = await executeQuery(
      'SELECT * FROM recetas_detalle WHERE id_detalle = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Ítem de receta no encontrado' });
    }
    
    const result = await executeQuery(
      `UPDATE recetas_detalle SET 
        cantidad_requerida = ?, unidad_medida = ?, orden_agregado = ?, es_critico = ?, notas = ?
      WHERE id_detalle = ?`,
      [cantidad_requerida, unidad_medida, orden_agregado, es_critico, notas, id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Ítem de receta actualizado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteRecetaItem(req, res) {
  try {
    const { id } = req.params;
    
    const checkResult = await executeQuery(
      'SELECT * FROM recetas_detalle WHERE id_detalle = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Ítem de receta no encontrado' });
    }
    
    const result = await executeQuery(
      'DELETE FROM recetas_detalle WHERE id_detalle = ?',
      [id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Ítem de receta eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function duplicarReceta(req, res) {
  try {
    const { idReceta } = req.params;
    const { nuevo_nombre } = req.body;
    
    if (!nuevo_nombre) {
      return res.status(400).json({ error: 'nuevo_nombre es requerido' });
    }
    
    const recetaOriginal = await executeQuery(
      'SELECT * FROM recetas_productos WHERE id_receta_producto = ?',
      [idReceta]
    );
    
    if (recetaOriginal.data.length === 0) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    const receta = recetaOriginal.data[0];
    
    const nuevaReceta = await executeQuery(
      `INSERT INTO recetas_productos (
        id_producto_terminado, nombre_receta, descripcion, version,
        es_principal, rendimiento_unidades, tiempo_produccion_minutos, notas
      ) VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        receta.id_producto_terminado,
        nuevo_nombre,
        `Copia de: ${receta.nombre_receta}`,
        receta.version,
        receta.rendimiento_unidades,
        receta.tiempo_produccion_minutos,
        receta.notas
      ]
    );
    
    const nuevoIdReceta = nuevaReceta.data.insertId;
    
    await executeQuery(
      `INSERT INTO recetas_detalle (
        id_receta_producto, id_insumo, cantidad_requerida, unidad_medida,
        orden_agregado, es_critico, notas
      )
      SELECT ?, id_insumo, cantidad_requerida, unidad_medida,
        orden_agregado, es_critico, notas
      FROM recetas_detalle
      WHERE id_receta_producto = ?`,
      [nuevoIdReceta, idReceta]
    );
    
    res.status(201).json({
      success: true,
      message: 'Receta duplicada exitosamente',
      data: {
        id_receta_producto: nuevoIdReceta
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


export async function getTiposInventario(req, res) {
  try {
    const result = await executeQuery(
      'SELECT * FROM tipos_inventario WHERE estado = ? ORDER BY nombre ASC',
      ['Activo']
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getCategorias(req, res) {
  try {
    const result = await executeQuery(
      'SELECT * FROM categorias WHERE estado = ? ORDER BY nombre ASC',
      ['Activo']
    );  
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


export async function recalcularTodosCUP(req, res) {
  try {
    const productosResult = await executeQuery(
      `SELECT DISTINCT p.id_producto, p.codigo, p.nombre
       FROM productos p
       WHERE p.requiere_receta = 1
       AND p.estado = 'Activo'
       AND EXISTS (
         SELECT 1 FROM recetas_productos rp 
         WHERE rp.id_producto_terminado = p.id_producto 
         AND rp.es_principal = 1 
         AND rp.es_activa = 1
       )`
    );
    
    const productos = productosResult.data;
    const resultados = [];
    
    for (const producto of productos) {
      const cupResult = await executeQuery(
        `SELECT 
          COALESCE(
            SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio) / MAX(rp.rendimiento_unidades),
            0
          ) AS cup_calculado
         FROM recetas_productos rp
         INNER JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
         INNER JOIN productos insumo ON rd.id_insumo = insumo.id_producto
         WHERE rp.id_producto_terminado = ?
         AND rp.es_principal = 1
         AND rp.es_activa = 1
         GROUP BY rp.id_receta_producto`,
        [producto.id_producto]
      );
      
      const cupCalculado = parseFloat(cupResult.data[0]?.cup_calculado || 0);
      
      if (cupCalculado > 0) {
        await executeQuery(
          'UPDATE productos SET costo_unitario_promedio = ? WHERE id_producto = ?',
          [cupCalculado, producto.id_producto]
        );
        
        resultados.push({
          codigo: producto.codigo,
          nombre: producto.nombre,
          cup_calculado: cupCalculado,
          actualizado: true
        });
      } else {
        resultados.push({
          codigo: producto.codigo,
          nombre: producto.nombre,
          cup_calculado: 0,
          actualizado: false,
          error: 'CUP calculado es 0'
        });
      }
    }
    
    res.json({
      success: true,
      message: `Se recalcularon ${resultados.filter(r => r.actualizado).length} de ${resultados.length} productos`,
      data: resultados
    });
    
  } catch (error) {
    console.error('Error al recalcular CUP:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function verCUPPorRecetas(req, res) {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(
      `SELECT 
        rp.id_receta_producto,
        rp.nombre_receta,
        rp.version,
        rp.es_principal,
        rp.es_activa,
        rp.rendimiento_unidades,
        COALESCE(
          SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio),
          0
        ) AS costo_total_materiales,
        COALESCE(
          SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio) / NULLIF(rp.rendimiento_unidades, 0),
          0
        ) AS cup_por_unidad,
        COALESCE(
          SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio) / NULLIF(rp.rendimiento_unidades, 0) * 10,
          0
        ) AS cup_por_10_unidades,
        COUNT(rd.id_detalle) AS total_insumos
       FROM recetas_productos rp
       LEFT JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
       LEFT JOIN productos insumo ON rd.id_insumo = insumo.id_producto
       WHERE rp.id_producto_terminado = ?
       GROUP BY rp.id_receta_producto, rp.nombre_receta, rp.version, rp.es_principal, rp.es_activa, rp.rendimiento_unidades
       ORDER BY rp.es_principal DESC, rp.es_activa DESC, rp.fecha_creacion DESC`,
      [id]
    );
    
    res.json({
      success: true,
      data: result.data.map(r => ({
        ...r,
        rendimiento_unidades: parseFloat(r.rendimiento_unidades),
        costo_total_materiales: parseFloat(r.costo_total_materiales),
        cup_por_unidad: parseFloat(r.cup_por_unidad),
        cup_por_10_unidades: parseFloat(r.cup_por_10_unidades)
      }))
    });
    
  } catch (error) {
    console.error('Error al obtener CUP por recetas:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function calcularCUPDesdeReceta(req, res) {
  try {
    const { id } = req.params;

    const productoResult = await executeQuery(
      'SELECT * FROM productos WHERE id_producto = ?',
      [id]
    );

    if (productoResult.data.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const producto = productoResult.data[0];

    if (!producto.requiere_receta) {
      return res.json({
        success: true,
        cup_calculado: parseFloat(producto.costo_unitario_promedio || 0),
        desde_receta: false,
        mensaje: 'Producto no requiere receta',
        origen: 'no_requiere_receta'
      });
    }

    const produccionesResult = await executeQuery(
      `SELECT 
        op.id_orden,
        op.numero_orden,
        op.cantidad_producida,
        op.costo_materiales,
        (op.costo_materiales / op.cantidad_producida) AS cup_produccion,
        op.fecha_fin,
        rp.nombre_receta
       FROM ordenes_produccion op
       LEFT JOIN recetas_productos rp ON op.id_receta_producto = rp.id_receta_producto
       WHERE op.id_producto_terminado = ?
       AND op.estado = 'Finalizada'
       AND op.cantidad_producida > 0
       AND op.costo_materiales > 0
       ORDER BY op.fecha_fin DESC`,
      [id]
    );

    const producciones = produccionesResult.data || [];

    if (producciones.length > 0) {
      const sumaTotal = producciones.reduce((acc, p) => {
        return acc + (parseFloat(p.cantidad_producida) * parseFloat(p.cup_produccion));
      }, 0);

      const cantidadTotal = producciones.reduce((acc, p) => {
        return acc + parseFloat(p.cantidad_producida);
      }, 0);

      const cupPromedioPonderado = sumaTotal / cantidadTotal;

      return res.json({
        success: true,
        cup_calculado: cupPromedioPonderado,
        desde_receta: false,
        tiene_receta_principal: true,
        origen: 'promedio_ponderado',
        mensaje: 'CUP calculado como promedio ponderado de todas las producciones',
        detalle: {
          total_producciones: producciones.length,
          cantidad_total_producida: cantidadTotal,
          suma_costos_totales: sumaTotal,
          producciones_recientes: producciones.slice(0, 5).map(p => ({
            numero_orden: p.numero_orden,
            receta: p.nombre_receta || 'Manual',
            cantidad: parseFloat(p.cantidad_producida),
            cup: parseFloat(p.cup_produccion),
            fecha: p.fecha_fin
          }))
        }
      });
    }

    const recetaResult = await executeQuery(
      `SELECT id_receta_producto, nombre_receta, rendimiento_unidades
       FROM recetas_productos
       WHERE id_producto_terminado = ? 
       AND es_principal = 1 
       AND es_activa = 1
       LIMIT 1`,
      [id]
    );

    if (recetaResult.data.length === 0) {
      return res.json({
        success: true,
        cup_calculado: 0,
        desde_receta: false,
        tiene_receta_principal: false,
        mensaje: 'No hay receta principal activa y no hay producciones registradas',
        origen: 'sin_datos'
      });
    }

    const receta = recetaResult.data[0];

    const detalleResult = await executeQuery(
      `SELECT 
        SUM(rd.cantidad_requerida * p.costo_unitario_promedio) as costo_total_materiales
       FROM recetas_detalle rd
       INNER JOIN productos p ON rd.id_insumo = p.id_producto
       WHERE rd.id_receta_producto = ?`,
      [receta.id_receta_producto]
    );

    const costoTotalMateriales = parseFloat(detalleResult.data[0]?.costo_total_materiales || 0);
    const rendimiento = parseFloat(receta.rendimiento_unidades || 1);
    const cupTeoricoReceta = costoTotalMateriales / rendimiento;

    const insumosSinCUPResult = await executeQuery(
      `SELECT COUNT(*) as total
       FROM recetas_detalle rd
       INNER JOIN productos p ON rd.id_insumo = p.id_producto
       WHERE rd.id_receta_producto = ?
       AND (p.costo_unitario_promedio = 0 OR p.costo_unitario_promedio IS NULL)`,
      [receta.id_receta_producto]
    );

    const hayInsumosSinCUP = insumosSinCUPResult.data[0].total > 0;

    return res.json({
      success: true,
      cup_calculado: cupTeoricoReceta,
      costo_total_materiales: costoTotalMateriales,
      rendimiento_unidades: rendimiento,
      desde_receta: true,
      tiene_receta_principal: true,
      insumos_sin_cup: hayInsumosSinCUP,
      origen: 'receta_teorica',
      mensaje: 'CUP teórico desde receta principal (no hay producciones con costo registradas)',
      receta_usada: receta.nombre_receta,
      advertencia: hayInsumosSinCUP 
        ? 'Algunos insumos no tienen CUP' 
        : 'Cálculo teórico - Aún no hay producciones con costo de materiales'
    });

  } catch (error) {
    console.error('Error al calcular CUP:', error);
    res.status(500).json({ 
      error: 'Error al calcular CUP',
      details: error.message 
    });
  }
}

export async function calcularEvolucionCUP(req, res) {
  try {
    const { id } = req.params;

    const productoResult = await executeQuery(
      'SELECT * FROM productos WHERE id_producto = ?',
      [id]
    );

    if (productoResult.data.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const producto = productoResult.data[0];

    if (!producto.requiere_receta) {
      return res.json({
        success: true,
        evolucion: [],
        mensaje: 'Producto no requiere receta'
      });
    }

    const produccionesResult = await executeQuery(
      `SELECT 
        op.id_orden,
        op.numero_orden,
        op.cantidad_producida,
        op.costo_materiales,
        (op.costo_materiales / op.cantidad_producida) AS cup_produccion,
        op.fecha_fin,
        COALESCE(rp.nombre_receta, 'Sin Receta') AS nombre_receta,
        CASE 
          WHEN op.id_receta_producto IS NULL THEN 1
          ELSE 0
        END AS es_manual
       FROM ordenes_produccion op
       LEFT JOIN recetas_productos rp ON op.id_receta_producto = rp.id_receta_producto
       WHERE op.id_producto_terminado = ?
       AND op.estado = 'Finalizada'
       AND op.cantidad_producida > 0
       AND op.costo_materiales > 0
       ORDER BY op.fecha_fin ASC`,
      [id]
    );

    const producciones = produccionesResult.data || [];

    if (producciones.length === 0) {
      return res.json({
        success: true,
        evolucion: [],
        cup_actual: 0,
        mensaje: 'No hay producciones con costo registradas'
      });
    }

    let cantidadAcumulada = 0;
    let costoTotalAcumulado = 0;
    let cupAnterior = null;
    
    const evolucion = producciones.map((prod, index) => {
      const cantidadProd = parseFloat(prod.cantidad_producida);
      const cupProd = parseFloat(prod.cup_produccion);
      const costoTotalProd = cantidadProd * cupProd;

      cantidadAcumulada += cantidadProd;
      costoTotalAcumulado += costoTotalProd;

      const cupAcumulado = costoTotalAcumulado / cantidadAcumulada;

      let tendencia = 'igual';
      let diferencia = 0;
      
      if (cupAnterior !== null) {
        diferencia = cupAcumulado - cupAnterior;
        if (cupAcumulado > cupAnterior) {
          tendencia = 'sube';
        } else if (cupAcumulado < cupAnterior) {
          tendencia = 'baja';
        }
      }

      const resultado = {
        numero_orden: prod.numero_orden,
        fecha: prod.fecha_fin,
        receta: prod.nombre_receta,
        es_manual: prod.es_manual === 1,
        cantidad: cantidadProd,
        cup_produccion: cupProd,
        costo_total: costoTotalProd,
        cantidad_acumulada: cantidadAcumulada,
        costo_total_acumulado: costoTotalAcumulado,
        cup_acumulado: cupAcumulado,
        tendencia,
        diferencia
      };

      cupAnterior = cupAcumulado;

      return resultado;
    });

    const cupFinal = evolucion[evolucion.length - 1].cup_acumulado;

    res.json({
      success: true,
      evolucion,
      cup_actual: cupFinal,
      total_producciones: producciones.length,
      cantidad_total_producida: cantidadAcumulada,
      costo_total_acumulado: costoTotalAcumulado
    });

  } catch (error) {
    console.error('Error al calcular evolución CUP:', error);
    res.status(500).json({ 
      error: 'Error al calcular evolución CUP',
      details: error.message 
    });
  }
}
export async function getHistorialComprasProducto(req, res) {
  try {
    const { id } = req.params;
    const { limite = 10 } = req.query;
    
    const sql = `
      SELECT 
        oc.id_orden_compra,
        oc.numero_orden,
        oc.fecha_emision,
        oc.moneda,
        doc.cantidad,
        doc.precio_unitario,
        doc.descuento_porcentaje,
        doc.subtotal,
        pr.razon_social AS proveedor,
        pr.ruc AS ruc_proveedor,
        e.nombre_completo AS registrado_por,
        oc.estado,
        oc.tipo_compra,
        DATEDIFF(CURDATE(), oc.fecha_emision) AS dias_desde_compra
      FROM detalle_orden_compra doc
      INNER JOIN ordenes_compra oc ON doc.id_orden_compra = oc.id_orden_compra
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      LEFT JOIN empleados e ON oc.id_registrado_por = e.id_empleado
      WHERE doc.id_producto = ?
        AND oc.estado != 'Cancelada'
      ORDER BY oc.fecha_emision DESC
      LIMIT ?
    `;
    
    const [rows] = await pool.query(sql, [id, parseInt(limite)]);
    
    let totalCompras = 0;
    let cantidadTotalComprada = 0;
    let precioPromedio = 0;
    let precioMinimo = null;
    let precioMaximo = null;
    let ultimaCompra = null;
    
    if (rows.length > 0) {
      totalCompras = rows.length;
      
      rows.forEach(compra => {
        cantidadTotalComprada += parseFloat(compra.cantidad);
        const precio = parseFloat(compra.precio_unitario);
        
        if (precioMinimo === null || precio < precioMinimo) {
          precioMinimo = precio;
        }
        if (precioMaximo === null || precio > precioMaximo) {
          precioMaximo = precio;
        }
      });
      
      precioPromedio = rows.reduce((sum, c) => sum + parseFloat(c.precio_unitario), 0) / totalCompras;
      ultimaCompra = rows[0].fecha_emision;
    }
    
    res.json({
      success: true,
      data: {
        historial: rows,
        estadisticas: {
          total_compras: totalCompras,
          cantidad_total_comprada: cantidadTotalComprada,
          precio_promedio: precioPromedio,
          precio_minimo: precioMinimo,
          precio_maximo: precioMaximo,
          ultima_compra: ultimaCompra
        }
      }
    });
    
  } catch (error) {
    console.error('Error al obtener historial de compras:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}