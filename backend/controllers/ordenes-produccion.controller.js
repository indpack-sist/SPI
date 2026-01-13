import { executeQuery, executeTransaction } from '../config/database.js';
import { generarPDFOrdenProduccion } from '../utils/pdf-generator.js';

export async function getAllOrdenes(req, res) {
  try {
    const { estado, fecha_inicio, fecha_fin, origen_tipo } = req.query;
    
    let sql = `
      SELECT 
        op.id_orden,
        op.numero_orden,
        op.fecha_programada,
        op.fecha_programada_fin,
        op.id_producto_terminado,
        p.codigo AS codigo_producto,
        COALESCE(p.nombre, '[PRODUCTO ELIMINADO]') AS producto,
        p.unidad_medida,
        op.cantidad_planificada,
        op.cantidad_producida,
        op.id_supervisor,
        e.nombre_completo AS supervisor,
        op.costo_materiales,
        op.estado,
        op.fecha_creacion,
        op.fecha_inicio,
        op.fecha_fin,
        op.tiempo_total_minutos,
        op.observaciones,
        op.id_receta_producto,
        op.rendimiento_unidades,
        op.origen_tipo,
        op.id_orden_venta_origen,
        ov.numero_orden AS numero_orden_venta,
        rp.nombre_receta,
        CASE 
          WHEN op.id_receta_producto IS NULL AND op.costo_materiales = 0 THEN 1
          ELSE 0
        END AS es_manual,
        CASE 
          WHEN p.id_producto IS NULL THEN 1
          ELSE 0
        END AS producto_eliminado
      FROM ordenes_produccion op
      LEFT JOIN productos p ON op.id_producto_terminado = p.id_producto
      LEFT JOIN empleados e ON op.id_supervisor = e.id_empleado
      LEFT JOIN recetas_productos rp ON op.id_receta_producto = rp.id_receta_producto
      LEFT JOIN ordenes_venta ov ON op.id_orden_venta_origen = ov.id_orden_venta
      WHERE 1=1
    `;
    const params = [];
    
    if (estado) {
      const estadosArray = estado.split(','); 
      const placeholders = estadosArray.map(() => '?').join(','); 
      sql += ` AND op.estado IN (${placeholders})`;
      params.push(...estadosArray); 
    }
    
    if (fecha_inicio) {
      sql += ' AND DATE(op.fecha_creacion) >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ' AND DATE(op.fecha_creacion) <= ?';
      params.push(fecha_fin);
    }
    
    if (origen_tipo) {
      if (origen_tipo === 'Supervisor') {
        sql += ' AND (op.origen_tipo IS NULL OR op.origen_tipo = ?)';
        params.push('Supervisor');
      } else if (origen_tipo === 'Orden de Venta') {
        sql += ' AND op.origen_tipo = ?';
        params.push('Orden de Venta');
      }
    }
    
    sql += ' ORDER BY op.fecha_creacion DESC';
    
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

export async function getOrdenById(req, res) {
  try {
    const { id } = req.params;
    
    const sql = `
      SELECT 
        op.*,
        p.codigo AS codigo_producto,
        COALESCE(p.nombre, '[PRODUCTO ELIMINADO]') AS producto,
        p.unidad_medida,
        e.nombre_completo AS supervisor,
        rp.nombre_receta,
        rp.descripcion AS descripcion_receta,
        ov.numero_orden AS numero_orden_venta,
        ov.id_orden_venta,
        CASE 
          WHEN op.id_receta_producto IS NULL AND op.costo_materiales = 0 THEN 1
          ELSE 0
        END AS es_manual,
        CASE 
          WHEN p.id_producto IS NULL THEN 1
          ELSE 0
        END AS producto_eliminado
      FROM ordenes_produccion op
      LEFT JOIN productos p ON op.id_producto_terminado = p.id_producto
      LEFT JOIN empleados e ON op.id_supervisor = e.id_empleado
      LEFT JOIN recetas_productos rp ON op.id_receta_producto = rp.id_receta_producto
      LEFT JOIN ordenes_venta ov ON op.id_orden_venta_origen = ov.id_orden_venta
      WHERE op.id_orden = ?
    `;
    
    const result = await executeQuery(sql, [id]);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    if (result.data.length === 0) {
      return res.status(404).json({ error: 'Orden de producción no encontrada' });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function asignarRecetaYSupervisor(req, res) {
  try {
    const { id } = req.params;
    const { 
      id_supervisor, 
      modo_receta, 
      id_receta_producto, 
      receta_provisional, 
      rendimiento_receta,
      es_orden_manual 
    } = req.body;
    
    if (!id_supervisor) {
      return res.status(400).json({
        success: false,
        error: 'Supervisor es requerido'
      });
    }

    const ordenResult = await executeQuery(`
      SELECT * FROM ordenes_produccion 
      WHERE id_orden = ? AND estado = 'Pendiente Asignación'
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada o no está en estado Pendiente Asignación'
      });
    }
    
    const orden = ordenResult.data[0];
    const cantidadPlan = parseFloat(orden.cantidad_planificada);
    
    let costoMateriales = 0;
    let rendimientoUnidades = 1;
    let idRecetaProducto = null;

    if (modo_receta === 'manual' || es_orden_manual) {
      const updateResult = await executeQuery(`
        UPDATE ordenes_produccion 
        SET id_supervisor = ?,
            costo_materiales = 0,
            rendimiento_unidades = 1,
            es_orden_manual = 1,
            estado = 'Pendiente'
        WHERE id_orden = ?
      `, [id_supervisor, id]);
      
      if (!updateResult.success) {
        return res.status(500).json({
          success: false,
          error: updateResult.error
        });
      }
      
      return res.json({
        success: true,
        message: 'Orden manual asignada exitosamente (sin consumo de materiales)',
        data: {
          costo_materiales: 0,
          lotes_necesarios: 0,
          rendimiento_unidades: 1,
          estado: 'Pendiente',
          es_manual: true
        }
      });
    }

    if (modo_receta === 'seleccionar' && id_receta_producto) {
      const recetaResult = await executeQuery(`
        SELECT 
          rd.id_insumo,
          rd.cantidad_requerida,
          rd.unidad_medida,
          p.costo_unitario_promedio,
          p.stock_actual,
          p.id_tipo_inventario,
          rp.rendimiento_unidades
        FROM recetas_detalle rd
        INNER JOIN recetas_productos rp ON rd.id_receta_producto = rp.id_receta_producto
        INNER JOIN productos p ON rd.id_insumo = p.id_producto
        WHERE rd.id_receta_producto = ?
      `, [id_receta_producto]);
      
      if (!recetaResult.success || recetaResult.data.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'La receta seleccionada no tiene insumos configurados'
        });
      }
      
      const recetaData = recetaResult.data;
      rendimientoUnidades = parseFloat(recetaData[0].rendimiento_unidades) || 1;
      const lotesNecesarios = Math.ceil(cantidadPlan / rendimientoUnidades);
      
      for (const insumo of recetaData) {
        const cantidadTotal = parseFloat(insumo.cantidad_requerida) * lotesNecesarios;
        costoMateriales += cantidadTotal * parseFloat(insumo.costo_unitario_promedio);
      }
      
      idRecetaProducto = id_receta_producto;
    }
    
    else if (modo_receta === 'provisional' && receta_provisional && receta_provisional.length > 0) {
      rendimientoUnidades = parseFloat(rendimiento_receta) || 1;
      const lotesNecesarios = Math.ceil(cantidadPlan / rendimientoUnidades);
      
      for (const item of receta_provisional) {
        const insumoResult = await executeQuery(`
          SELECT costo_unitario_promedio FROM productos WHERE id_producto = ?
        `, [item.id_insumo]);
        
        if (insumoResult.success && insumoResult.data.length > 0) {
          const costoUnitario = parseFloat(insumoResult.data[0].costo_unitario_promedio);
          const cantidadTotal = parseFloat(item.cantidad_requerida) * lotesNecesarios;
          costoMateriales += cantidadTotal * costoUnitario;
        }
      }
      
      await executeQuery(`
        UPDATE ordenes_produccion 
        SET receta_provisional = ?
        WHERE id_orden = ?
      `, [JSON.stringify(receta_provisional), id]);
    }
    
    else {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar una receta existente o una receta provisional'
      });
    }

    const updateResult = await executeQuery(`
      UPDATE ordenes_produccion 
      SET id_receta_producto = ?,
          id_supervisor = ?,
          costo_materiales = ?,
          rendimiento_unidades = ?,
          estado = 'Pendiente'
      WHERE id_orden = ?
    `, [idRecetaProducto, id_supervisor, costoMateriales, rendimientoUnidades, id]);
    
    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: updateResult.error
      });
    }
    
    const lotesNecesarios = Math.ceil(cantidadPlan / rendimientoUnidades);
    
    res.json({
      success: true,
      message: 'Receta y supervisor asignados exitosamente',
      data: {
        costo_materiales: costoMateriales,
        lotes_necesarios: lotesNecesarios,
        rendimiento_unidades: rendimientoUnidades,
        estado: 'Pendiente',
        modo_receta: modo_receta
      }
    });
    
  } catch (error) {
    console.error('Error al asignar receta y supervisor:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getConsumoMaterialesOrden(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(
      'SELECT estado, id_receta_producto FROM ordenes_produccion WHERE id_orden = ?',
      [id]
    );
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    
    const orden = ordenResult.data[0];
    
    if (orden.estado !== 'Pendiente' && orden.estado !== 'Pendiente Asignación') {
      const sql = `
        SELECT 
          cm.id_consumo,
          cm.id_orden,
          cm.id_insumo,
          p.codigo AS codigo_insumo,
          p.nombre AS insumo,
          p.unidad_medida,
          cm.cantidad_requerida,
          cm.costo_unitario,
          cm.costo_total,
          cm.fecha_consumo
        FROM op_consumo_materiales cm
        INNER JOIN productos p ON cm.id_insumo = p.id_producto
        WHERE cm.id_orden = ?
        ORDER BY p.nombre ASC
      `;
      
      const result = await executeQuery(sql, [id]);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      return res.json({
        success: true,
        data: result.data,
        total: result.data.length
      });
    }
    
    let sql = '';
    let params = [];
    
    if (orden.id_receta_producto) {
      sql = `
        SELECT 
          rd.id_detalle AS id_consumo,
          ? AS id_orden,
          rd.id_insumo,
          p.codigo AS codigo_insumo,
          p.nombre AS insumo,
          p.unidad_medida,
          rd.cantidad_requerida,
          p.costo_unitario_promedio AS costo_unitario,
          (rd.cantidad_requerida * p.costo_unitario_promedio) AS costo_total,
          NULL AS fecha_consumo
        FROM recetas_detalle rd
        INNER JOIN productos p ON rd.id_insumo = p.id_producto
        WHERE rd.id_receta_producto = ?
        ORDER BY p.nombre ASC
      `;
      params = [id, orden.id_receta_producto];
    } else {
      sql = `
        SELECT 
          rp.id_receta_provisional AS id_consumo,
          rp.id_orden,
          rp.id_insumo,
          p.codigo AS codigo_insumo,
          p.nombre AS insumo,
          p.unidad_medida,
          rp.cantidad_requerida,
          p.costo_unitario_promedio AS costo_unitario,
          (rp.cantidad_requerida * p.costo_unitario_promedio) AS costo_total,
          NULL AS fecha_consumo
        FROM op_recetas_provisionales rp
        INNER JOIN productos p ON rp.id_insumo = p.id_producto
        WHERE rp.id_orden = ?
        ORDER BY p.nombre ASC
      `;
      params = [id];
    }
    
    const result = await executeQuery(sql, params);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length,
      estado: orden.estado 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createOrden(req, res) {
  try {
    const {
      numero_orden,
      id_producto_terminado,
      cantidad_planificada,
      id_supervisor,
      observaciones,
      id_receta_producto,
      receta_provisional,
      rendimiento_receta,
      es_orden_manual 
    } = req.body;
    
    if (!numero_orden || !id_producto_terminado || !cantidad_planificada || !id_supervisor) {
      return res.status(400).json({ 
        error: 'numero_orden, id_producto_terminado, cantidad_planificada e id_supervisor son requeridos' 
      });
    }
    
    if (cantidad_planificada <= 0) {
      return res.status(400).json({ error: 'La cantidad planificada debe ser mayor a 0' });
    }
    
    const checkNumero = await executeQuery(
      'SELECT * FROM ordenes_produccion WHERE numero_orden = ?',
      [numero_orden]
    );
    
    if (checkNumero.data.length > 0) {
      return res.status(400).json({ error: 'El número de orden ya existe' });
    }
    
    const productoResult = await executeQuery(
      'SELECT requiere_receta, unidad_medida FROM productos WHERE id_producto = ?',
      [id_producto_terminado]
    );
    
    if (productoResult.data.length === 0) {
      return res.status(404).json({ error: 'Producto terminado no encontrado' });
    }
    
    if (!productoResult.data[0].requiere_receta) {
      return res.status(400).json({ 
        error: 'Este producto no requiere producción (es producto de reventa)' 
      });
    }

    if (es_orden_manual === true) {
      const ordenResult = await executeQuery(
        `INSERT INTO ordenes_produccion (
          numero_orden, id_producto_terminado, cantidad_planificada,
          id_supervisor, costo_materiales, estado, observaciones,
          id_receta_producto, rendimiento_unidades, origen_tipo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          numero_orden,
          id_producto_terminado,
          cantidad_planificada,
          id_supervisor,
          0, 
          'Pendiente',
          (observaciones || '') + '\n[ORDEN MANUAL - Sin receta ni consumo de materiales]',
          null, 
          1,
          'Supervisor'
        ]
      );
      
      if (!ordenResult.success) {
        return res.status(500).json({ error: ordenResult.error });
      }
      
      return res.status(201).json({
        success: true,
        message: 'Orden manual creada exitosamente (sin consumo de materiales)',
        data: {
          id_orden: ordenResult.data.insertId,
          numero_orden,
          costo_materiales: 0,
          es_manual: true,
          estado: 'Pendiente'
        }
      });
    }
  
    let recetaData = [];
    let rendimientoUnidades = parseFloat(rendimiento_receta) || 1;
    if (id_receta_producto) {
      const recetaResult = await executeQuery(
        `SELECT 
          rd.id_insumo,
          rd.cantidad_requerida,
          rd.unidad_medida,
          p.costo_unitario_promedio,
          p.stock_actual,
          p.id_tipo_inventario,
          rp.rendimiento_unidades
        FROM recetas_detalle rd
        INNER JOIN recetas_productos rp ON rd.id_receta_producto = rp.id_receta_producto
        INNER JOIN productos p ON rd.id_insumo = p.id_producto
        WHERE rd.id_receta_producto = ?`,
        [id_receta_producto]
      );
      
      if (recetaResult.data.length === 0) {
        return res.status(400).json({ error: 'La receta seleccionada no tiene insumos configurados' });
      }
      
      recetaData = recetaResult.data;
      rendimientoUnidades = parseFloat(recetaResult.data[0].rendimiento_unidades) || 1;
    }
    else if (receta_provisional && Array.isArray(receta_provisional) && receta_provisional.length > 0) {
      const insumosIds = receta_provisional.map(i => i.id_insumo);
      
      const insumosResult = await executeQuery(
        `SELECT 
          id_producto,
          costo_unitario_promedio,
          stock_actual,
          id_tipo_inventario,
          unidad_medida
        FROM productos 
        WHERE id_producto IN (${insumosIds.map(() => '?').join(',')})`,
        insumosIds
      );
      
      recetaData = receta_provisional.map(item => {
        const insumo = insumosResult.data.find(i => i.id_producto == item.id_insumo);
        if (!insumo) {
          throw new Error(`Insumo ${item.id_insumo} no encontrado`);
        }
        
        return {
          id_insumo: item.id_insumo,
          cantidad_requerida: parseFloat(item.cantidad_requerida),
          unidad_medida: insumo.unidad_medida,
          costo_unitario_promedio: parseFloat(insumo.costo_unitario_promedio),
          stock_actual: parseFloat(insumo.stock_actual),
          id_tipo_inventario: insumo.id_tipo_inventario
        };
      });
    } else {
      return res.status(400).json({ 
        error: 'Debe proporcionar id_receta_producto, receta_provisional o es_orden_manual' 
      });
    }
    
    const insumosSinCUP = recetaData.filter(i => parseFloat(i.costo_unitario_promedio) === 0);
    if (insumosSinCUP.length > 0) {
      return res.status(400).json({ 
        error: 'Algunos insumos no tienen costo unitario definido. Registre entradas primero.' 
      });
    }
    
    const cantidadPlan = parseFloat(cantidad_planificada);
    const lotesNecesarios = Math.ceil(cantidadPlan / rendimientoUnidades);
    
    let costoMateriales = 0;
    for (const insumo of recetaData) {
      const cantidadTotal = parseFloat(insumo.cantidad_requerida) * lotesNecesarios;
      costoMateriales += cantidadTotal * parseFloat(insumo.costo_unitario_promedio);
    }
    
    const ordenResult = await executeQuery(
      `INSERT INTO ordenes_produccion (
        numero_orden, id_producto_terminado, cantidad_planificada,
        id_supervisor, costo_materiales, estado, observaciones,
        id_receta_producto, rendimiento_unidades, origen_tipo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero_orden,
        id_producto_terminado,
        cantidad_planificada,
        id_supervisor,
        costoMateriales,
        'Pendiente',
        observaciones || null,
        id_receta_producto || null,
        rendimientoUnidades,
        'Supervisor'
      ]
    );
    
    if (!ordenResult.success) {
      return res.status(500).json({ error: ordenResult.error });
    }
    
    const idOrden = ordenResult.data.insertId;
    
    if (!id_receta_producto && receta_provisional) {
      const queries = receta_provisional.map(item => ({
        sql: `INSERT INTO op_recetas_provisionales (
          id_orden, id_insumo, cantidad_requerida
        ) VALUES (?, ?, ?)`,
        params: [idOrden, item.id_insumo, item.cantidad_requerida]
      }));
      
      await executeTransaction(queries);
    }
    
    res.status(201).json({
      success: true,
      message: 'Orden de producción creada exitosamente',
      data: {
        id_orden: idOrden,
        numero_orden,
        costo_materiales: costoMateriales,
        lotes_necesarios: lotesNecesarios,
        rendimiento_unidades: rendimientoUnidades,
        estado: 'Pendiente'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function iniciarProduccion(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(
      `SELECT op.*, p.id_tipo_inventario 
      FROM ordenes_produccion op
      INNER JOIN productos p ON op.id_producto_terminado = p.id_producto
      WHERE op.id_orden = ? AND op.estado = ?`,
      [id, 'Pendiente']
    );
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Orden no encontrada o no está en estado Pendiente' 
      });
    }
    
    const orden = ordenResult.data[0];
    
    if (orden.id_orden_venta_origen) {
      await executeQuery(`
        UPDATE ordenes_venta 
        SET estado = 'En Proceso'
        WHERE id_orden_venta = ?
      `, [orden.id_orden_venta_origen]);
    }
    
    if (orden.id_receta_producto === null && parseFloat(orden.costo_materiales) === 0) {
      const result = await executeQuery(
        `UPDATE ordenes_produccion 
        SET estado = 'En Curso', fecha_inicio = NOW() 
        WHERE id_orden = ?`,
        [id]
      );
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      return res.json({
        success: true,
        message: 'Orden manual iniciada (sin consumo de materiales)',
        data: {
          estado: 'En Curso',
          es_manual: true,
          materiales_consumidos: 0
        }
      });
    }

    const cantidadPlan = parseFloat(orden.cantidad_planificada);
    const rendimiento = parseFloat(orden.rendimiento_unidades) || 1;
    const lotesNecesarios = Math.ceil(cantidadPlan / rendimiento);
    
    let recetaData = [];
    
    if (orden.id_receta_producto) {
      const recetaResult = await executeQuery(
        `SELECT 
          rd.id_insumo,
          rd.cantidad_requerida,
          p.costo_unitario_promedio,
          p.stock_actual,
          p.id_tipo_inventario
        FROM recetas_detalle rd
        INNER JOIN productos p ON rd.id_insumo = p.id_producto
        WHERE rd.id_receta_producto = ?`,
        [orden.id_receta_producto]
      );
      recetaData = recetaResult.data;
    } else {
      const recetaResult = await executeQuery(
        `SELECT 
          rp.id_insumo,
          rp.cantidad_requerida,
          p.costo_unitario_promedio,
          p.stock_actual,
          p.id_tipo_inventario
        FROM op_recetas_provisionales rp
        INNER JOIN productos p ON rp.id_insumo = p.id_producto
        WHERE rp.id_orden = ?`,
        [id]
      );
      recetaData = recetaResult.data;
    }
    
    const insumosInsuficientes = [];
    for (const insumo of recetaData) {
      const cantidadTotal = parseFloat(insumo.cantidad_requerida) * lotesNecesarios;
      if (parseFloat(insumo.stock_actual) < cantidadTotal) {
        insumosInsuficientes.push({
          id_insumo: insumo.id_insumo,
          requerido: cantidadTotal,
          disponible: insumo.stock_actual
        });
      }
    }
    
    if (insumosInsuficientes.length > 0) {
      return res.status(400).json({ 
        error: 'Stock insuficiente de insumos',
        detalles: insumosInsuficientes
      });
    }
    
    let totalCosto = 0;
    const detallesSalida = [];
    
    for (const insumo of recetaData) {
      const cantidadTotal = parseFloat(insumo.cantidad_requerida) * lotesNecesarios;
      const costoUnitario = parseFloat(insumo.costo_unitario_promedio);
      
      totalCosto += cantidadTotal * costoUnitario;
      
      detallesSalida.push({
        id_insumo: insumo.id_insumo,
        cantidad: cantidadTotal,
        costo_unitario: costoUnitario,
        id_tipo_inventario: insumo.id_tipo_inventario
      });
    }
    
    const queries = [];
    
    queries.push({
      sql: `UPDATE ordenes_produccion 
            SET estado = ?, fecha_inicio = NOW() 
            WHERE id_orden = ?`,
      params: ['En Curso', id]
    });
    
    queries.push({
      sql: `INSERT INTO salidas (
        id_tipo_inventario, tipo_movimiento, departamento, total_costo,
        id_registrado_por, observaciones, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        orden.id_tipo_inventario,
        'Consumo Interno',
        'Producción',
        totalCosto,
        orden.id_supervisor,
        `Consumo para O.P. ${orden.numero_orden}`,
        'Activo'
      ]
    });
    
    const resultParcial = await executeTransaction(queries);
    
    if (!resultParcial.success) {
      return res.status(500).json({ error: resultParcial.error });
    }
    
    const idSalida = resultParcial.data[1].insertId;
    
    const queriesDetalle = [];
    
    for (const detalle of detallesSalida) {
      queriesDetalle.push({
        sql: `INSERT INTO detalle_salidas (
          id_salida, id_producto, cantidad, costo_unitario
        ) VALUES (?, ?, ?, ?)`,
        params: [idSalida, detalle.id_insumo, detalle.cantidad, detalle.costo_unitario]
      });
      
      queriesDetalle.push({
        sql: `INSERT INTO op_consumo_materiales (
          id_orden, id_insumo, cantidad_requerida, costo_unitario
        ) VALUES (?, ?, ?, ?)`,
        params: [id, detalle.id_insumo, detalle.cantidad, detalle.costo_unitario]
      });
      
      queriesDetalle.push({
        sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
        params: [detalle.cantidad, detalle.id_insumo]
      });
    }
    
    const resultFinal = await executeTransaction(queriesDetalle);
    
    if (!resultFinal.success) {
      await executeQuery(
        'UPDATE ordenes_produccion SET estado = ? WHERE id_orden = ?',
        ['Pendiente', id]
      );
      return res.status(500).json({ error: resultFinal.error });
    }
    
    res.json({
      success: true,
      message: 'Producción iniciada exitosamente',
      data: {
        estado: 'En Curso',
        materiales_consumidos: recetaData.length,
        lotes_necesarios: lotesNecesarios,
        id_salida: idSalida,
        total_costo: totalCosto
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function pausarProduccion(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(
      'SELECT * FROM ordenes_produccion WHERE id_orden = ? AND estado = ?',
      [id, 'En Curso']
    );
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Orden no encontrada o no está en curso' 
      });
    }
    
    const result = await executeQuery(
      'UPDATE ordenes_produccion SET estado = ? WHERE id_orden = ?',
      ['En Pausa', id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Producción pausada exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function reanudarProduccion(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(
      'SELECT * FROM ordenes_produccion WHERE id_orden = ? AND estado = ?',
      [id, 'En Pausa']
    );
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Orden no encontrada o no está pausada' 
      });
    }
    
    const result = await executeQuery(
      'UPDATE ordenes_produccion SET estado = ? WHERE id_orden = ?',
      ['En Curso', id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Producción reanudada exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function registrarProduccionParcial(req, res) {
  try {
    const { id } = req.params;
    const { 
      cantidad_parcial,
      observaciones,
      consumo_real,
      confirmar_exceso
    } = req.body;
    
    if (!cantidad_parcial || cantidad_parcial <= 0) {
      return res.status(400).json({ error: 'La cantidad parcial debe ser mayor a 0' });
    }
    
    const ordenResult = await executeQuery(
      `SELECT op.*, p.id_tipo_inventario 
       FROM ordenes_produccion op
       INNER JOIN productos p ON op.id_producto_terminado = p.id_producto
       WHERE op.id_orden = ? AND op.estado IN (?, ?)`,
      [id, 'En Curso', 'En Pausa']
    );
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada o no está en curso' });
    }
    
    const orden = ordenResult.data[0];
    
    const cantidadYaProducida = parseFloat(orden.cantidad_producida || 0);
    const cantidadPlanificada = parseFloat(orden.cantidad_planificada);
    const cantidadNueva = parseFloat(cantidad_parcial);
    const cantidadTotalProyectada = cantidadYaProducida + cantidadNueva;
    
    const exceso = cantidadTotalProyectada - cantidadPlanificada;

    if (exceso > 0 && confirmar_exceso !== true) {
      return res.status(409).json({
        error: 'Exceso de producción detectado',
        requiere_confirmacion: true,
        mensaje: `La cantidad ingresada (${cantidadNueva}) hace que el total (${cantidadTotalProyectada}) supere lo planificado (${cantidadPlanificada}) en ${exceso} unidades. ¿Desea continuar?`,
        datos_validacion: {
          planificado: cantidadPlanificada,
          acumulado_actual: cantidadYaProducida,
          nuevo_ingreso: cantidadNueva,
          exceso: exceso
        }
      });
    }
    
    let costoUnitario = 0;
    let costoTotalProduccion = 0;
    
    const ajustesConsumoExtra = []; 
    const ajustesAhorro = [];
    
    if (consumo_real && Array.isArray(consumo_real) && consumo_real.length > 0) {
      for (const item of consumo_real) {
        const insumoResult = await executeQuery(
          'SELECT costo_unitario_promedio, id_tipo_inventario FROM productos WHERE id_producto = ?',
          [item.id_insumo]
        );
        
        if (insumoResult.data.length > 0) {
          const datosInsumo = insumoResult.data[0];
          const costoInsumoTotal = parseFloat(item.cantidad_real) * parseFloat(datosInsumo.costo_unitario_promedio);
          costoTotalProduccion += costoInsumoTotal;

          const planificadoResult = await executeQuery(
            `SELECT cantidad_requerida, costo_unitario 
             FROM op_consumo_materiales 
             WHERE id_orden = ? AND id_insumo = ?`,
            [id, item.id_insumo]
          );

          if (planificadoResult.data.length > 0) {
            const planificado = planificadoResult.data[0];
            
            const porcentajeAvance = cantidadNueva / cantidadPlanificada;
            const cantidadTeoricaLote = parseFloat(planificado.cantidad_requerida) * porcentajeAvance;
            
            const cantidadReal = parseFloat(item.cantidad_real);
            const diferencia = cantidadReal - cantidadTeoricaLote;

            if (Math.abs(diferencia) > 0.0001) {
              const datosAjuste = {
                id_insumo: item.id_insumo,
                cantidad_diferencia: Math.abs(diferencia),
                costo_unitario: datosInsumo.costo_unitario_promedio,
                id_tipo_inventario: datosInsumo.id_tipo_inventario,
                cantidad_planificada: cantidadTeoricaLote,
                cantidad_real: cantidadReal,
                costo_planificado_original: planificado.costo_unitario
              };

              if (diferencia > 0) ajustesConsumoExtra.push(datosAjuste);
              else ajustesAhorro.push(datosAjuste);
            }
          }
        }
      }
      costoUnitario = costoTotalProduccion / cantidadNueva;

    } else {
      if (parseFloat(orden.costo_materiales) > 0) {
        costoUnitario = parseFloat(orden.costo_materiales) / cantidadPlanificada;
        costoTotalProduccion = costoUnitario * cantidadNueva;
      }
    }
    
    const queries = [];

    let obsFinal = observaciones || '';
    if (exceso > 0) obsFinal += `\n[ALERTA] Parcial con exceso (+${exceso} u.) autorizado.`;

    queries.push({
      sql: `UPDATE ordenes_produccion 
            SET cantidad_producida = cantidad_producida + ?
            WHERE id_orden = ?`,
      params: [cantidadNueva, id]
    });

    queries.push({
      sql: `INSERT INTO op_registros_produccion (
        id_orden, cantidad_registrada, observaciones, id_registrado_por
      ) VALUES (?, ?, ?, ?)`,
      params: [id, cantidadNueva, obsFinal || null, orden.id_supervisor]
    });

    queries.push({
      sql: `INSERT INTO entradas (
        id_tipo_inventario, documento_soporte, total_costo, moneda,
        id_registrado_por, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        orden.id_tipo_inventario,
        `O.P. ${orden.numero_orden} (Parcial)`,
        costoTotalProduccion,
        'PEN',
        orden.id_supervisor,
        `Ingreso Parcial O.P.`
      ]
    });

    const resultBloque1 = await executeTransaction(queries);
    if (!resultBloque1.success) return res.status(500).json({ error: resultBloque1.error });

    const idRegistroProduccion = resultBloque1.data[1].insertId;
    const idEntradaProducto = resultBloque1.data[2].insertId;

    const queriesBloque2 = [];

    queriesBloque2.push({
      sql: `INSERT INTO detalle_entradas (
        id_entrada, id_producto, cantidad, costo_unitario
      ) VALUES (?, ?, ?, ?)`,
      params: [idEntradaProducto, orden.id_producto_terminado, cantidadNueva, costoUnitario]
    });

    queriesBloque2.push({
      sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
      params: [cantidadNueva, orden.id_producto_terminado]
    });
    
    for (const ajuste of ajustesConsumoExtra) {
      queriesBloque2.push({
        sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
        params: [ajuste.cantidad_diferencia, ajuste.id_insumo]
      });
    }

    for (const ajuste of ajustesAhorro) {
      queriesBloque2.push({
        sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
        params: [ajuste.cantidad_diferencia, ajuste.id_insumo]
      });
    }

    if (queriesBloque2.length > 0) {
      const resultBloque2 = await executeTransaction(queriesBloque2);
      if (!resultBloque2.success) return res.status(500).json({ error: resultBloque2.error });
    }
    
    res.json({
      success: true,
      message: exceso > 0 
        ? 'Registro parcial con EXCESO registrado exitosamente' 
        : 'Registro parcial guardado exitosamente',
      data: {
        id_registro: idRegistroProduccion,
        cantidad_registrada: cantidadNueva,
        total_acumulado: cantidadTotalProyectada,
        exceso_registrado: exceso > 0 ? exceso : 0
      }
    });
    
  } catch (error) {
    console.error('Error al registrar producción parcial:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function finalizarProduccion(req, res) {
  try {
    const { id } = req.params;
    const { 
      cantidad_producida, 
      observaciones,
      mermas,
      consumo_real, 
      confirmar_exceso 
    } = req.body;
    
    if (cantidad_producida === undefined || parseFloat(cantidad_producida) < 0) {
      return res.status(400).json({ error: 'La cantidad producida es inválida' });
    }
    
    const ordenResult = await executeQuery(
      `SELECT op.*, p.id_tipo_inventario 
       FROM ordenes_produccion op
       INNER JOIN productos p ON op.id_producto_terminado = p.id_producto
       WHERE op.id_orden = ? AND op.estado IN (?, ?)`,
      [id, 'En Curso', 'En Pausa']
    );
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada para finalizar' });
    }
    
    const orden = ordenResult.data[0];
    
    const cantidadYaProducida = parseFloat(orden.cantidad_producida || 0);
    const cantidadFinalInput = parseFloat(cantidad_producida);
    const cantidadTotalReal = cantidadYaProducida + cantidadFinalInput;
    const cantidadPlanificada = parseFloat(orden.cantidad_planificada);
    
    const exceso = cantidadTotalReal - cantidadPlanificada;

    if (exceso > 0 && confirmar_exceso !== true) {
       return res.status(409).json({ 
        error: 'Exceso de producción al finalizar',
        requiere_confirmacion: true,
        mensaje: `Con este ingreso de ${cantidadFinalInput}, el total producido será ${cantidadTotalReal}, excediendo lo planificado (${cantidadPlanificada}) en ${exceso}. ¿Confirmar ingreso de varianza?`,
        datos_validacion: {
          planificado: cantidadPlanificada,
          acumulado_actual: cantidadYaProducida,
          nuevo_ingreso: cantidadFinalInput,
          total_final: cantidadTotalReal,
          exceso: exceso
        }
      });
    }

    let costoTotalRealMateriales = 0;
    const queries = [];
    
    if (consumo_real && Array.isArray(consumo_real)) {
      for (const item of consumo_real) {
        const insumoInfo = await executeQuery(
          'SELECT costo_unitario_promedio, stock_actual FROM productos WHERE id_producto = ?', 
          [item.id_insumo]
        );
        const costoInsumoUnitario = insumoInfo.data[0]?.costo_unitario_promedio || 0;
        
        costoTotalRealMateriales += (parseFloat(item.cantidad_real_total) * parseFloat(costoInsumoUnitario));

        const planificadoRes = await executeQuery(
          'SELECT cantidad_requerida FROM op_consumo_materiales WHERE id_orden = ? AND id_insumo = ?',
          [id, item.id_insumo]
        );
        
        if (planificadoRes.data.length > 0) {
          const cantidadTeoricaDescontada = parseFloat(planificadoRes.data[0].cantidad_requerida);
          const diferencia = parseFloat(item.cantidad_real_total) - cantidadTeoricaDescontada;

          queries.push({
            sql: 'UPDATE op_consumo_materiales SET cantidad_real_consumida = ? WHERE id_orden = ? AND id_insumo = ?',
            params: [item.cantidad_real_total, id, item.id_insumo]
          });

          if (Math.abs(diferencia) > 0.0001) {
            if (diferencia > 0) {
              queries.push({
                sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
                params: [diferencia, item.id_insumo]
              });
            } else {
              queries.push({
                sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
                params: [Math.abs(diferencia), item.id_insumo]
              });
            }
          }
        }
      }
    } else {
        costoTotalRealMateriales = parseFloat(orden.costo_materiales);
    }

    const costoUnitarioFinal = cantidadTotalReal > 0 ? (costoTotalRealMateriales / cantidadTotalReal) : 0;

    const tiempoMinutos = Math.floor((new Date() - new Date(orden.fecha_inicio)) / 60000);
    
    let obsFinal = observaciones || '';
    if (exceso > 0) obsFinal += `\n[VARIACIÓN POSITIVA] Producción finalizó con exceso de ${exceso} u.`;

    queries.push({
      sql: `UPDATE ordenes_produccion 
            SET estado = 'Finalizada', 
                cantidad_producida = ?, 
                fecha_fin = NOW(),
                tiempo_total_minutos = ?, 
                observaciones = CONCAT(COALESCE(observaciones, ''), '\n', ?)
            WHERE id_orden = ?`,
      params: [cantidadTotalReal, tiempoMinutos, obsFinal, id]
    });

    if (cantidadFinalInput > 0) {
      const costoTotalIngresoActual = cantidadFinalInput * costoUnitarioFinal;

      queries.push({
        sql: `INSERT INTO entradas (
          id_tipo_inventario, documento_soporte, total_costo, moneda,
          id_registrado_por, observaciones
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        params: [
          orden.id_tipo_inventario,
          `O.P. ${orden.numero_orden} (Final)`,
          costoTotalIngresoActual,
          'PEN',
          orden.id_supervisor,
          `Cierre Producción. CUP Real Ajustado: ${costoUnitarioFinal.toFixed(4)}`
        ]
      });
    }

    const result1 = await executeTransaction(queries);
    if (!result1.success) return res.status(500).json({ error: result1.error });

    if (cantidadFinalInput > 0) {
        const idEntrada = result1.data[result1.data.length - 1].insertId; 
        
        const queriesStock = [];
        queriesStock.push({
            sql: `INSERT INTO detalle_entradas (id_entrada, id_producto, cantidad, costo_unitario) VALUES (?, ?, ?, ?)`,
            params: [idEntrada, orden.id_producto_terminado, cantidadFinalInput, costoUnitarioFinal]
        });

        queriesStock.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual + ?, costo_unitario_promedio = ? WHERE id_producto = ?',
            params: [cantidadFinalInput, costoUnitarioFinal, orden.id_producto_terminado]
        });

        await executeTransaction(queriesStock);
    }

    if (mermas && mermas.length > 0) {
        const queriesMermas = [];
        for (const m of mermas) {
            if (m.cantidad > 0) {
                queriesMermas.push({
                    sql: 'INSERT INTO mermas_produccion (id_orden_produccion, id_producto_merma, cantidad, observaciones) VALUES (?, ?, ?, ?)',
                    params: [id, m.id_producto_merma, m.cantidad, m.observaciones]
                });
                queriesMermas.push({
                    sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
                    params: [m.cantidad, m.id_producto_merma]
                });
            }
        }
        if(queriesMermas.length > 0) await executeTransaction(queriesMermas);
    }

    if (orden.id_orden_venta_origen) {
        await executeQuery(
            "UPDATE ordenes_venta SET estado = 'Atendido por Producción' WHERE id_orden_venta = ?", 
            [orden.id_orden_venta_origen]
        );
    }

    res.json({
      success: true,
      message: 'Producción finalizada exitosamente con ajustes de consumo real.',
      data: {
        total_producido: cantidadTotalReal,
        varianza_cantidad: exceso,
        costo_unitario_final: costoUnitarioFinal
      }
    });

  } catch (error) {
    console.error('Error al finalizar producción:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function getProductosMerma(req, res) {
  try {
    const result = await executeQuery(
      `SELECT 
        id_producto,
        codigo,
        nombre,
        unidad_medida,
        stock_actual
      FROM productos
      WHERE id_categoria = 10 AND estado = 'Activo'
      ORDER BY nombre`,
      []
    );
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error al obtener productos de merma:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getMermasOrden(req, res) {
  try {
    const { id } = req.params;
    const result = await executeQuery(
      `SELECT 
        mp.*,
        p.codigo,
        p.nombre AS producto_merma,
        p.unidad_medida
       FROM mermas_produccion mp
       INNER JOIN productos p ON mp.id_producto_merma = p.id_producto
       WHERE mp.id_orden_produccion = ?`,
      [id]
    );
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error al obtener mermas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function cancelarOrden(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(
      'SELECT * FROM ordenes_produccion WHERE id_orden = ? AND estado IN (?, ?, ?)',
      [id, 'Pendiente', 'En Curso', 'En Pausa']
    );
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada o no puede ser cancelada' });
    }
    
    const orden = ordenResult.data[0];
    
    const consumoResult = await executeQuery(
      `SELECT 
        cm.id_insumo,
        cm.cantidad_requerida,
        cm.costo_unitario,
        p.id_tipo_inventario
      FROM op_consumo_materiales cm
      INNER JOIN productos p ON cm.id_insumo = p.id_producto
      WHERE cm.id_orden = ?`,
      [id]
    );
    
    if (consumoResult.data.length === 0) {
      await executeQuery(
        'UPDATE ordenes_produccion SET estado = ? WHERE id_orden = ?',
        ['Cancelada', id]
      );
      return res.json({ success: true, message: 'Orden cancelada (sin materiales devueltos)' });
    }
    
    const totalCostoDevolucion = consumoResult.data.reduce((sum, item) => 
      sum + (parseFloat(item.cantidad_requerida) * parseFloat(item.costo_unitario)), 0
    );
    
    const queries = [];
    queries.push({
        sql: 'UPDATE ordenes_produccion SET estado = ? WHERE id_orden = ?',
        params: ['Cancelada', id]
    });

    queries.push({
        sql: `INSERT INTO entradas (
          id_tipo_inventario, documento_soporte, total_costo,
          id_registrado_por, observaciones
        ) VALUES (?, ?, ?, ?, ?)`,
        params: [
          consumoResult.data[0].id_tipo_inventario,
          `Cancelación O.P. ${orden.numero_orden}`,
          totalCostoDevolucion,
          orden.id_supervisor,
          `Devolución por cancelación de O.P. ${orden.numero_orden}`
        ]
    });

    const resultTransaction = await executeTransaction(queries);
    if (!resultTransaction.success) return res.status(500).json({ error: resultTransaction.error });

    const idEntrada = resultTransaction.data[1].insertId;
    const queriesDetalle = [];

    for (const consumo of consumoResult.data) {
        queriesDetalle.push({
            sql: `INSERT INTO detalle_entradas (id_entrada, id_producto, cantidad, costo_unitario) VALUES (?, ?, ?, ?)`,
            params: [idEntrada, consumo.id_insumo, consumo.cantidad_requerida, consumo.costo_unitario]
        });
        queriesDetalle.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
            params: [consumo.cantidad_requerida, consumo.id_insumo]
        });
    }

    await executeTransaction(queriesDetalle);
    
    res.json({ success: true, message: 'Orden cancelada y materiales devueltos al inventario' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getRegistrosParcialesOrden(req, res) {
  try {
    const { id } = req.params;
    const result = await executeQuery(
      `SELECT 
        orp.*, 
        e.nombre_completo as registrado_por
       FROM op_registros_produccion orp
       LEFT JOIN empleados e ON orp.id_registrado_por = e.id_empleado
       WHERE orp.id_orden = ?
       ORDER BY orp.fecha_registro DESC`,
      [id]
    );

    if (!result.success) return res.status(500).json({ success: false, error: result.error });

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getAnalisisConsumoOrden(req, res) {
  try {
    const { id } = req.params;
    const result = await executeQuery(
      `SELECT 
        cm.id_insumo,
        p.codigo,
        p.nombre AS insumo,
        p.unidad_medida,
        cm.cantidad_requerida AS cantidad_planificada,
        cm.cantidad_real_consumida AS cantidad_real,
        COALESCE(cm.cantidad_real_consumida, cm.cantidad_requerida) - cm.cantidad_requerida AS diferencia,
        cm.costo_unitario,
        cm.costo_total AS costo_planificado,
        (COALESCE(cm.cantidad_real_consumida, cm.cantidad_requerida) * cm.costo_unitario) AS costo_real
      FROM op_consumo_materiales cm
      INNER JOIN productos p ON cm.id_insumo = p.id_producto
      WHERE cm.id_orden = ?
      ORDER BY ABS(COALESCE(cm.cantidad_real_consumida, cm.cantidad_requerida) - cm.cantidad_requerida) DESC`,
      [id]
    );

    if (!result.success) return res.status(500).json({ success: false, error: result.error });

    let totalPlanificado = 0;
    let totalReal = 0;

    result.data.forEach(item => {
      totalPlanificado += parseFloat(item.costo_planificado || 0);
      totalReal += parseFloat(item.costo_real || 0);
    });

    res.json({
      success: true,
      data: {
        detalle: result.data,
        resumen: {
          total_insumos: result.data.length,
          costo_planificado: totalPlanificado,
          costo_real: totalReal,
          diferencia: totalReal - totalPlanificado,
          porcentaje_variacion: totalPlanificado > 0 
            ? ((totalReal - totalPlanificado) / totalPlanificado * 100).toFixed(2)
            : 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export const generarPDFOrdenController = async (req, res) => {
  try {
    const { id } = req.params;
    const ordenResult = await executeQuery(`
      SELECT 
        op.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        e.nombre_completo AS supervisor,
        rp.nombre_receta AS nombre_receta
      FROM ordenes_produccion op
      INNER JOIN productos p ON op.id_producto_terminado = p.id_producto
      INNER JOIN empleados e ON op.id_supervisor = e.id_empleado
      LEFT JOIN recetas_productos rp ON op.id_receta_producto = rp.id_receta_producto
      WHERE op.id_orden = ?
    `, [id]);

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden de producción no encontrada' });
    }

    const orden = ordenResult.data[0];

    const consumoResult = await executeQuery(`
      SELECT 
        opm.cantidad_requerida,
        opm.cantidad_real_consumida,
        opm.costo_unitario,
        opm.costo_total,
        p.nombre AS insumo,
        p.unidad_medida
      FROM op_consumo_materiales opm
      INNER JOIN productos p ON opm.id_insumo = p.id_producto
      WHERE opm.id_orden = ?
      ORDER BY p.nombre
    `, [id]);
    const consumo = consumoResult.success ? consumoResult.data : [];

    const mermasResult = await executeQuery(`
      SELECT 
        mp.cantidad,
        mp.observaciones,
        p.codigo,
        p.nombre AS producto_merma,
        p.unidad_medida
      FROM mermas_produccion mp
      INNER JOIN productos p ON mp.id_producto_merma = p.id_producto
      WHERE mp.id_orden_produccion = ?
    `, [id]);
    const mermas = mermasResult.success ? mermasResult.data : [];

    const pdfBuffer = await generarPDFOrdenProduccion(orden, consumo, mermas);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="orden_${orden.numero_orden}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({ error: error.message });
  }
};
// ... (resto de tu código anterior) ...

export async function updateOrden(req, res) {
  try {
    const { id } = req.params;
    // Ahora aceptamos ambos campos
    const { fecha_programada, fecha_programada_fin } = req.body;

    // Construimos la query dinámica
    let sql = 'UPDATE ordenes_produccion SET ';
    const params = [];
    const updates = [];

    if (fecha_programada !== undefined) {
      updates.push('fecha_programada = ?');
      params.push(fecha_programada);
    }

    if (fecha_programada_fin !== undefined) {
      updates.push('fecha_programada_fin = ?');
      params.push(fecha_programada_fin);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    sql += updates.join(', ') + ' WHERE id_orden = ?';
    params.push(id);

    const result = await executeQuery(sql, params);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ success: true, message: 'Programación actualizada' });

  } catch (error) {
    console.error('Error al actualizar orden:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}