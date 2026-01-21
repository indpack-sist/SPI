import { executeQuery, executeTransaction } from '../config/database.js';
import { generarPDFOrdenProduccion } from '../utils/pdf-generator.js';

const getFechaPeru = () => {
  const now = new Date();
  const peruDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const year = peruDate.getFullYear();
  const month = String(peruDate.getMonth() + 1).padStart(2, '0');
  const day = String(peruDate.getDate()).padStart(2, '0');
  const hours = String(peruDate.getHours()).padStart(2, '0');
  const minutes = String(peruDate.getMinutes()).padStart(2, '0');
  const seconds = String(peruDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

async function notificarCambioEstado(idOrden, titulo, mensaje, tipo, req) {
  try {
    const datosResult = await executeQuery(`
      SELECT ov.id_comercial, ov.numero_orden as numero_ov, op.numero_orden as numero_op
      FROM ordenes_produccion op
      INNER JOIN ordenes_venta ov ON op.id_orden_venta_origen = ov.id_orden_venta
      WHERE op.id_orden = ?
    `, [idOrden]);

    if (datosResult.success && datosResult.data.length > 0) {
      const datos = datosResult.data[0];
      
      if (datos.id_comercial) {
        const ruta = `/produccion/ordenes/${idOrden}`;
        
        const insertResult = await executeQuery(`
          INSERT INTO notificaciones (id_usuario_destino, titulo, mensaje, tipo, ruta_destino)
          VALUES (?, ?, ?, ?, ?)
        `, [datos.id_comercial, titulo, mensaje, tipo, ruta]);

        const io = req.app.get('socketio');
        if (io) {
          io.to(`usuario_${datos.id_comercial}`).emit('nueva_notificacion', {
            id_notificacion: insertResult.data.insertId,
            titulo,
            mensaje,
            tipo,
            ruta_destino: ruta,
            leido: 0,
            fecha_creacion: new Date().toISOString()
          });
        }
      }
    }
  } catch (error) {
    console.error('Error enviando notificación automática:', error);
  }
}

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
        ov.prioridad AS prioridad_venta,
        e_comercial.nombre_completo AS comercial_venta,
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
      LEFT JOIN empleados e_comercial ON ov.id_comercial = e_comercial.id_empleado
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

    const ordenExistente = await executeQuery(`
      SELECT * FROM ordenes_produccion 
      WHERE id_orden = ? AND estado = 'Pendiente Asignación'
    `, [id]);
    
    if (!ordenExistente.success || ordenExistente.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada o no está en estado Pendiente Asignación'
      });
    }
    
    const orden = ordenExistente.data[0];
    const cantidadPlan = parseFloat(orden.cantidad_planificada);
    
    let costoMateriales = 0;
    let rendimientoUnidades = 1;
    let idRecetaProducto = null;
    
    let insumosReporte = []; 

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
          es_manual: true,
          insumos: [] 
        }
      });
    }

    if (modo_receta === 'seleccionar' && id_receta_producto) {
      const recetaResult = await executeQuery(`
        SELECT 
          rd.id_insumo,
          rd.cantidad_requerida,
          rd.unidad_medida,
          p.codigo AS codigo_insumo,     
          p.nombre AS nombre_insumo,     
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
        const cantidadTotalRequerida = parseFloat(insumo.cantidad_requerida) * lotesNecesarios;
        const costoUnitario = parseFloat(insumo.costo_unitario_promedio);
        costoMateriales += cantidadTotalRequerida * costoUnitario;

        insumosReporte.push({
            id_insumo: insumo.id_insumo,
            codigo: insumo.codigo_insumo,
            nombre: insumo.nombre_insumo,
            unidad_medida: insumo.unidad_medida,
            cantidad_unit: parseFloat(insumo.cantidad_requerida),
            cantidad_total_requerida: cantidadTotalRequerida,
            stock_actual: parseFloat(insumo.stock_actual),
            cubre_stock: parseFloat(insumo.stock_actual) >= cantidadTotalRequerida, 
            costo_unitario: costoUnitario
        });
      }
      
      idRecetaProducto = id_receta_producto;
    }

    else if (modo_receta === 'provisional' && receta_provisional && receta_provisional.length > 0) {
      rendimientoUnidades = parseFloat(rendimiento_receta) || 1;
      const lotesNecesarios = Math.ceil(cantidadPlan / rendimientoUnidades);
      
      for (const item of receta_provisional) {
        const insumoResult = await executeQuery(`
          SELECT 
            codigo, 
            nombre, 
            unidad_medida, 
            costo_unitario_promedio, 
            stock_actual 
          FROM productos WHERE id_producto = ?
        `, [item.id_insumo]);
        
        if (insumoResult.success && insumoResult.data.length > 0) {
          const prodData = insumoResult.data[0];
          const costoUnitario = parseFloat(prodData.costo_unitario_promedio);
          const cantidadTotalRequerida = parseFloat(item.cantidad_requerida) * lotesNecesarios;
          
          costoMateriales += cantidadTotalRequerida * costoUnitario;

          insumosReporte.push({
            id_insumo: item.id_insumo,
            codigo: prodData.codigo,
            nombre: prodData.nombre,
            unidad_medida: prodData.unidad_medida,
            cantidad_unit: parseFloat(item.cantidad_requerida),
            cantidad_total_requerida: cantidadTotalRequerida,
            stock_actual: parseFloat(prodData.stock_actual),
            cubre_stock: parseFloat(prodData.stock_actual) >= cantidadTotalRequerida,
            costo_unitario: costoUnitario
          });
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
        modo_receta: modo_receta,
        insumos: insumosReporte 
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

export async function updateOrden(req, res) {
  try {
    const { id } = req.params;
    const { 
      cantidad_planificada,
      id_supervisor,
      observaciones,
      fecha_programada, 
      fecha_programada_fin 
    } = req.body;

    const ordenExistente = await executeQuery(`
      SELECT op.*, ov.id_comercial, ov.numero_orden as numero_ov
      FROM ordenes_produccion op
      LEFT JOIN ordenes_venta ov ON op.id_orden_venta_origen = ov.id_orden_venta
      WHERE op.id_orden = ?
    `, [id]);

    if (!ordenExistente.success || ordenExistente.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }

    const orden = ordenExistente.data[0];

    if (!['Pendiente Asignación', 'Pendiente'].includes(orden.estado)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Solo se pueden editar órdenes en estado Pendiente Asignación o Pendiente' 
      });
    }

    const updates = [];
    const params = [];

    if (cantidad_planificada !== undefined) {
      updates.push('cantidad_planificada = ?');
      params.push(parseFloat(cantidad_planificada));
    }

    if (id_supervisor !== undefined) {
      updates.push('id_supervisor = ?');
      params.push(id_supervisor);
    }

    if (observaciones !== undefined) {
      updates.push('observaciones = ?');
      params.push(observaciones);
    }

    if (fecha_programada !== undefined) {
      updates.push('fecha_programada = ?');
      params.push(fecha_programada);
    }

    if (fecha_programada_fin !== undefined) {
      updates.push('fecha_programada_fin = ?');
      params.push(fecha_programada_fin);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay datos para actualizar' });
    }

    const sql = `UPDATE ordenes_produccion SET ${updates.join(', ')} WHERE id_orden = ?`;
    params.push(id);

    const result = await executeQuery(sql, params);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    if ((fecha_programada !== undefined || fecha_programada_fin !== undefined) && orden.id_comercial) {
      let titulo = '';
      let mensaje = '';
      let tipo = 'info';
      let ruta = '';

      if (fecha_programada === null || fecha_programada === '') {
        titulo = `Programación Cancelada: ${orden.numero_orden}`;
        mensaje = `La producción de la orden ${orden.numero_orden} ha sido desprogramada y retornada a la lista de pendientes.`;
        tipo = 'warning';
        ruta = '/produccion/ordenes';
      } else {
        titulo = `Producción Programada: ${orden.numero_orden}`;
        mensaje = `Su Orden de Venta ${orden.numero_ov || 'N/A'} ha sido programada del ${fecha_programada} al ${fecha_programada_fin}.`;
        tipo = 'success';
        ruta = `/produccion/calendario?fecha=${fecha_programada}`;
      }

      const insertResult = await executeQuery(`
        INSERT INTO notificaciones (id_usuario_destino, titulo, mensaje, tipo, ruta_destino)
        VALUES (?, ?, ?, ?, ?)
      `, [orden.id_comercial, titulo, mensaje, tipo, ruta]);

      const io = req.app.get('socketio');
      if (io) {
        io.to(`usuario_${orden.id_comercial}`).emit('nueva_notificacion', {
          id_notificacion: insertResult.data.insertId,
          titulo,
          mensaje,
          tipo,
          ruta_destino: ruta,
          leido: 0,
          fecha_creacion: new Date().toISOString()
        });
      }
    }

    res.json({ success: true, message: 'Orden actualizada exitosamente' });

  } catch (error) {
    console.error('Error al actualizar orden:', error);
    res.status(500).json({ success: false, error: error.message });
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
          cm.cantidad_real_consumida,
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
          NULL AS cantidad_real_consumida,
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
          NULL AS cantidad_real_consumida,
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
      id_producto_terminado,
      cantidad_planificada,
      id_supervisor,
      observaciones,
      id_receta_producto,
      receta_provisional,
      rendimiento_receta,
      es_orden_manual 
    } = req.body;
    
    const fechaActual = getFechaPeru();

    if (!id_producto_terminado || !cantidad_planificada || !id_supervisor) {
      return res.status(400).json({ 
        error: 'id_producto_terminado, cantidad_planificada e id_supervisor son requeridos' 
      });
    }
    
    if (cantidad_planificada <= 0) {
      return res.status(400).json({ error: 'La cantidad planificada debe ser mayor a 0' });
    }

    const ultimaOrdenResult = await executeQuery(`
      SELECT numero_orden 
      FROM ordenes_produccion 
      ORDER BY id_orden DESC 
      LIMIT 1
    `);

    let numeroSecuencia = 1;
    if (ultimaOrdenResult.success && ultimaOrdenResult.data.length > 0) {
      const match = ultimaOrdenResult.data[0].numero_orden.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }

    const yearActual = new Date().getFullYear();
    const numeroOrdenGenerado = `OP-${yearActual}-${String(numeroSecuencia).padStart(4, '0')}`;
    
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
          id_receta_producto, rendimiento_unidades, origen_tipo, fecha_creacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          numeroOrdenGenerado,
          id_producto_terminado,
          cantidad_planificada,
          id_supervisor,
          0, 
          'Pendiente',
          (observaciones || '') + '\n[ORDEN MANUAL - Sin receta ni consumo de materiales]',
          null, 
          1,
          'Supervisor',
          fechaActual
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
          numero_orden: numeroOrdenGenerado,
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
        id_receta_producto, rendimiento_unidades, origen_tipo, fecha_creacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numeroOrdenGenerado,
        id_producto_terminado,
        cantidad_planificada,
        id_supervisor,
        costoMateriales,
        'Pendiente',
        observaciones || null,
        id_receta_producto || null,
        rendimientoUnidades,
        'Supervisor',
        fechaActual
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
        numero_orden: numeroOrdenGenerado,
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
    
    const fechaActual = getFechaPeru();

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
        SET estado = 'En Curso', fecha_inicio = ? 
        WHERE id_orden = ?`,
        [fechaActual, id]
      );
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      await notificarCambioEstado(id, `Producción Iniciada: ${orden.numero_orden}`, 'La orden ha comenzado su proceso de fabricación.', 'info', req);
      
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
    
    const queries = [];
    
    queries.push({
      sql: `UPDATE ordenes_produccion 
            SET estado = ?, fecha_inicio = ? 
            WHERE id_orden = ?`,
      params: ['En Curso', fechaActual, id]
    });
    
    for (const insumo of recetaData) {
      const cantidadTotal = parseFloat(insumo.cantidad_requerida) * lotesNecesarios;
      const costoUnitario = parseFloat(insumo.costo_unitario_promedio);
      
      queries.push({
        sql: `INSERT INTO op_consumo_materiales (
          id_orden, id_insumo, cantidad_requerida, costo_unitario, cantidad_real_consumida
        ) VALUES (?, ?, ?, ?, ?)`,
        params: [id, insumo.id_insumo, cantidadTotal, costoUnitario, 0]
      });
    }
    
    const result = await executeTransaction(queries);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    await notificarCambioEstado(id, `Producción Iniciada: ${orden.numero_orden}`, 'La orden ha comenzado su proceso de fabricación.', 'info', req);
    
    res.json({
      success: true,
      message: 'Producción iniciada exitosamente',
      data: {
        estado: 'En Curso',
        materiales_registrados: recetaData.length,
        lotes_necesarios: lotesNecesarios
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

    await notificarCambioEstado(id, `Producción Pausada: ${ordenResult.data[0].numero_orden}`, 'La orden ha sido puesta en pausa.', 'warning', req);
    
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

    await notificarCambioEstado(id, `Producción Reanudada: ${ordenResult.data[0].numero_orden}`, 'La orden continúa su proceso.', 'info', req);
    
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
      insumos_consumidos,
      observaciones
    } = req.body;
    
    if (!cantidad_parcial || cantidad_parcial <= 0) {
      return res.status(400).json({ error: 'La cantidad parcial debe ser mayor a 0' });
    }

    if (!insumos_consumidos || !Array.isArray(insumos_consumidos) || insumos_consumidos.length === 0) {
      return res.status(400).json({ error: 'Debe especificar los insumos consumidos' });
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
    const cantidadParcialNum = parseFloat(cantidad_parcial);
    
    const queries = [];
    let costoTotalParcial = 0;

    for (const insumo of insumos_consumidos) {
      const cantidadConsumida = parseFloat(insumo.cantidad);
      
      if (cantidadConsumida <= 0) continue;

      const insumoInfo = await executeQuery(
        'SELECT costo_unitario_promedio, stock_actual FROM productos WHERE id_producto = ?',
        [insumo.id_insumo]
      );
      
      if (!insumoInfo.success || insumoInfo.data.length === 0) {
        return res.status(400).json({ error: `Insumo ${insumo.id_insumo} no encontrado` });
      }

      const stockActual = parseFloat(insumoInfo.data[0].stock_actual);
      if (stockActual < cantidadConsumida) {
        return res.status(400).json({ 
          error: `Stock insuficiente para insumo ${insumo.id_insumo}. Disponible: ${stockActual}, Requerido: ${cantidadConsumida}` 
        });
      }
      
      const costoUnitario = parseFloat(insumoInfo.data[0].costo_unitario_promedio);
      costoTotalParcial += cantidadConsumida * costoUnitario;

      queries.push({
        sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
        params: [cantidadConsumida, insumo.id_insumo]
      });

      queries.push({
        sql: `UPDATE op_consumo_materiales 
              SET cantidad_real_consumida = cantidad_real_consumida + ? 
              WHERE id_orden = ? AND id_insumo = ?`,
        params: [cantidadConsumida, id, insumo.id_insumo]
      });
    }

    const costoUnitarioProducto = cantidadParcialNum > 0 ? (costoTotalParcial / cantidadParcialNum) : 0;

    queries.push({
      sql: `UPDATE ordenes_produccion 
            SET cantidad_producida = cantidad_producida + ?
            WHERE id_orden = ?`,
      params: [cantidadParcialNum, id]
    });

    queries.push({
      sql: `INSERT INTO op_registros_produccion (
        id_orden, cantidad_registrada, observaciones, id_registrado_por
      ) VALUES (?, ?, ?, ?)`,
      params: [id, cantidadParcialNum, observaciones || null, orden.id_supervisor]
    });

    queries.push({
      sql: `INSERT INTO entradas (
        id_tipo_inventario, documento_soporte, total_costo, moneda,
        id_registrado_por, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        orden.id_tipo_inventario,
        `O.P. ${orden.numero_orden} (Parcial)`,
        costoTotalParcial,
        'PEN',
        orden.id_supervisor,
        `Producción Parcial - Cantidad: ${cantidadParcialNum}`
      ]
    });
    
    const resultTransaccion = await executeTransaction(queries);
    
    if (!resultTransaccion.success) {
      return res.status(500).json({ error: resultTransaccion.error });
    }

    const idEntrada = resultTransaccion.data[resultTransaccion.data.length - 1].insertId;

    const queriesFinales = [];

    queriesFinales.push({
      sql: `INSERT INTO detalle_entradas (
        id_entrada, id_producto, cantidad, costo_unitario
      ) VALUES (?, ?, ?, ?)`,
      params: [idEntrada, orden.id_producto_terminado, cantidadParcialNum, costoUnitarioProducto]
    });

    queriesFinales.push({
      sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
      params: [cantidadParcialNum, orden.id_producto_terminado]
    });

    const resultFinal = await executeTransaction(queriesFinales);

    if (!resultFinal.success) {
       return res.status(500).json({ error: 'Error al actualizar stock de producto terminado' });
    }
    
    res.json({
      success: true,
      message: 'Registro parcial guardado exitosamente',
      data: {
        cantidad_registrada: cantidadParcialNum,
        costo_total: costoTotalParcial,
        insumos_consumidos: insumos_consumidos.length
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
      cantidad_final, 
      insumos_finales,
      observaciones,
      mermas
    } = req.body;
    
    const fechaActual = getFechaPeru();

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

    const registrosParciales = await executeQuery(
      'SELECT SUM(cantidad_registrada) as total_parcial FROM op_registros_produccion WHERE id_orden = ?',
      [id]
    );

    const consumoParciales = await executeQuery(
      `SELECT 
        id_insumo,
        SUM(cantidad_real_consumida) as total_consumido
       FROM op_consumo_materiales
       WHERE id_orden = ?
       GROUP BY id_insumo`,
      [id]
    );

    const totalProducidoParcial = parseFloat(registrosParciales.data[0]?.total_parcial || 0);
    const cantidadPlanificada = parseFloat(orden.cantidad_planificada);
    const cantidadFinalNum = parseFloat(cantidad_final || 0);
    const cantidadTotalFinal = totalProducidoParcial + cantidadFinalNum;

    const varianzaCantidad = cantidadTotalFinal - cantidadPlanificada;

    const consumoMaterialesData = await executeQuery(
      `SELECT 
        cm.id_insumo,
        cm.cantidad_requerida,
        cm.cantidad_real_consumida,
        cm.costo_unitario,
        p.nombre as insumo,
        p.stock_actual
       FROM op_consumo_materiales cm
       INNER JOIN productos p ON cm.id_insumo = p.id_producto
       WHERE cm.id_orden = ?`,
      [id]
    );

    const queries = [];
    let costoTotalFinal = 0;
    const resumenInsumos = [];

    if (insumos_finales && Array.isArray(insumos_finales)) {
      for (const insumo of insumos_finales) {
        const cantidadFinalInsumo = parseFloat(insumo.cantidad);
        
        if (cantidadFinalInsumo <= 0) continue;

        const insumoData = consumoMaterialesData.data.find(cm => cm.id_insumo === insumo.id_insumo);
        
        if (!insumoData) {
          return res.status(400).json({ error: `Insumo ${insumo.id_insumo} no encontrado en la orden` });
        }

        const stockActual = parseFloat(insumoData.stock_actual);
        if (stockActual < cantidadFinalInsumo) {
          return res.status(400).json({ 
            error: `Stock insuficiente para ${insumoData.insumo}. Disponible: ${stockActual}, Requerido: ${cantidadFinalInsumo}` 
          });
        }

        const costoUnitario = parseFloat(insumoData.costo_unitario);
        costoTotalFinal += cantidadFinalInsumo * costoUnitario;

        const totalConsumidoParcial = parseFloat(insumoData.cantidad_real_consumida || 0);
        const totalConsumidoFinal = totalConsumidoParcial + cantidadFinalInsumo;
        const cantidadRequerida = parseFloat(insumoData.cantidad_requerida);
        const varianzaInsumo = totalConsumidoFinal - cantidadRequerida;

        resumenInsumos.push({
          insumo: insumoData.insumo,
          planificado: cantidadRequerida,
          consumido_parcial: totalConsumidoParcial,
          consumido_final: cantidadFinalInsumo,
          total_consumido: totalConsumidoFinal,
          varianza: varianzaInsumo
        });

        queries.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
          params: [cantidadFinalInsumo, insumo.id_insumo]
        });

        queries.push({
          sql: `UPDATE op_consumo_materiales 
                SET cantidad_real_consumida = cantidad_real_consumida + ? 
                WHERE id_orden = ? AND id_insumo = ?`,
          params: [cantidadFinalInsumo, id, insumo.id_insumo]
        });
      }
    }

    const tiempoMinutos = Math.floor((new Date() - new Date(orden.fecha_inicio)) / 60000);
    
    let obsFinal = observaciones || '';
    if (varianzaCantidad > 0) {
      obsFinal += `\n[VARIANZA POSITIVA] Producción total: ${cantidadTotalFinal} (planificado: ${cantidadPlanificada}, exceso: +${varianzaCantidad})`;
    } else if (varianzaCantidad < 0) {
      obsFinal += `\n[VARIANZA NEGATIVA] Producción total: ${cantidadTotalFinal} (planificado: ${cantidadPlanificada}, déficit: ${varianzaCantidad})`;
    }

    queries.push({
      sql: `UPDATE ordenes_produccion 
            SET estado = 'Finalizada', 
                cantidad_producida = cantidad_producida + ?, 
                fecha_fin = ?, 
                tiempo_total_minutos = ?, 
                observaciones = CONCAT(COALESCE(observaciones, ''), ?)
            WHERE id_orden = ?`,
      params: [cantidadFinalNum, fechaActual, tiempoMinutos, obsFinal, id]
    });

    if (cantidadFinalNum > 0) {
      const costoUnitarioProductoFinal = cantidadFinalNum > 0 ? (costoTotalFinal / cantidadFinalNum) : 0;

      queries.push({
        sql: `INSERT INTO entradas (
          id_tipo_inventario, documento_soporte, total_costo, moneda,
          id_registrado_por, observaciones
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        params: [
          orden.id_tipo_inventario,
          `O.P. ${orden.numero_orden} (Final)`,
          costoTotalFinal,
          'PEN',
          orden.id_supervisor,
          `Cierre Producción - Cantidad: ${cantidadFinalNum}`
        ]
      });
    }

    const result1 = await executeTransaction(queries);
    if (!result1.success) return res.status(500).json({ error: result1.error });

    if (cantidadFinalNum > 0) {
        const idEntrada = result1.data[result1.data.length - 1].insertId;
        const costoUnitarioProductoFinal = cantidadFinalNum > 0 ? (costoTotalFinal / cantidadFinalNum) : 0;
        
        const queriesStock = [];
        queriesStock.push({
          sql: `INSERT INTO detalle_entradas (id_entrada, id_producto, cantidad, costo_unitario) VALUES (?, ?, ?, ?)`,
          params: [idEntrada, orden.id_producto_terminado, cantidadFinalNum, costoUnitarioProductoFinal]
        });

        queriesStock.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
          params: [cantidadFinalNum, orden.id_producto_terminado]
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

    await notificarCambioEstado(id, `Producción Finalizada: ${orden.numero_orden}`, 'La orden ha sido completada y cerrada.', 'success', req);

    res.json({
      success: true,
      message: 'Producción finalizada exitosamente',
      data: {
        resumen: {
          cantidad_planificada: cantidadPlanificada,
          registros_parciales: {
            cantidad: totalProducidoParcial,
            numero_registros: registrosParciales.data[0]?.total_parcial ? 1 : 0
          },
          produccion_final: cantidadFinalNum,
          total_producido: cantidadTotalFinal,
          varianza_cantidad: varianzaCantidad,
          varianza_tipo: varianzaCantidad > 0 ? 'POSITIVA' : varianzaCantidad < 0 ? 'NEGATIVA' : 'SIN VARIANZA'
        },
        insumos: resumenInsumos
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
        cm.cantidad_real_consumida,
        cm.costo_unitario,
        p.id_tipo_inventario
      FROM op_consumo_materiales cm
      INNER JOIN productos p ON cm.id_insumo = p.id_producto
      WHERE cm.id_orden = ? AND cm.cantidad_real_consumida > 0`,
      [id]
    );
    
    if (consumoResult.data.length === 0) {
      await executeQuery(
        'UPDATE ordenes_produccion SET estado = ? WHERE id_orden = ?',
        ['Cancelada', id]
      );
      await notificarCambioEstado(id, `Producción Cancelada: ${orden.numero_orden}`, 'La orden ha sido cancelada sin consumo.', 'danger', req);
      return res.json({ success: true, message: 'Orden cancelada (sin materiales devueltos)' });
    }
    
    const totalCostoDevolucion = consumoResult.data.reduce((sum, item) => 
      sum + (parseFloat(item.cantidad_real_consumida) * parseFloat(item.costo_unitario)), 0
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
            params: [idEntrada, consumo.id_insumo, consumo.cantidad_real_consumida, consumo.costo_unitario]
        });
        queriesDetalle.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
            params: [consumo.cantidad_real_consumida, consumo.id_insumo]
        });
    }

    await executeTransaction(queriesDetalle);

    await notificarCambioEstado(id, `Producción Cancelada: ${orden.numero_orden}`, 'La orden ha sido cancelada y los materiales devueltos.', 'danger', req);
    
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
        COALESCE(cm.cantidad_real_consumida, 0) - cm.cantidad_requerida AS diferencia,
        cm.costo_unitario,
        cm.costo_total AS costo_planificado,
        (COALESCE(cm.cantidad_real_consumida, 0) * cm.costo_unitario) AS costo_real
      FROM op_consumo_materiales cm
      INNER JOIN productos p ON cm.id_insumo = p.id_producto
      WHERE cm.id_orden = ?
      ORDER BY ABS(COALESCE(cm.cantidad_real_consumida, 0) - cm.cantidad_requerida) DESC`,
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
        rp.nombre_receta AS nombre_receta,
        ov.numero_orden AS numero_orden_venta,
        cl.razon_social AS cliente
      FROM ordenes_produccion op
      INNER JOIN productos p ON op.id_producto_terminado = p.id_producto
      INNER JOIN empleados e ON op.id_supervisor = e.id_empleado
      LEFT JOIN recetas_productos rp ON op.id_receta_producto = rp.id_receta_producto
      LEFT JOIN ordenes_venta ov ON op.id_orden_venta_origen = ov.id_orden_venta
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
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