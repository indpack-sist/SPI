import { pool, executeQuery, executeTransaction } from '../config/database.js';
import { generarPDFOrdenProduccion, generarPDFHojaRuta } from '../utils/pdf-generator.js';

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
        op.cantidad_unidades,
        op.cantidad_unidades_producida,
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
        op.turno,
        op.maquinista,
        op.ayudante,
        op.id_receta_producto,
        op.rendimiento_unidades,
        op.origen_tipo,
        op.id_orden_venta_origen,
        ov.numero_orden AS numero_orden_venta,
        ov.prioridad AS prioridad_venta,
        ov.fecha_entrega_estimada AS fecha_estimada_venta,
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
        ov.prioridad AS prioridad_venta,
        ov.fecha_entrega_estimada AS fecha_estimada_venta,
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
      fecha_programada_fin,
      turno,
      maquinista,
      ayudante,
      operario_corte,
      operario_embalaje
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

    if (turno !== undefined) {
      updates.push('turno = ?');
      params.push(turno);
    }

    if (maquinista !== undefined) {
      updates.push('maquinista = ?');
      params.push(maquinista);
    }

    if (ayudante !== undefined) {
      updates.push('ayudante = ?');
      params.push(ayudante);
    }

    if (operario_corte !== undefined) {
        updates.push('operario_corte = ?');
        params.push(operario_corte);
    }

    if (operario_embalaje !== undefined) {
        updates.push('operario_embalaje = ?');
        params.push(operario_embalaje);
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
      cantidad_unidades,
      id_supervisor,
      observaciones,
      insumos, 
      id_orden_venta_origen,
      turno,
      maquinista,
      ayudante,
      operario_corte,
      operario_embalaje,
      medida,
      peso_producto,
      gramaje
    } = req.body;
    
    const fechaActual = getFechaPeru();

    if (!id_producto_terminado) {
      return res.status(400).json({ 
        error: 'El producto terminado es requerido' 
      });
    }

    const productoResult = await executeQuery(
      'SELECT nombre, unidad_medida FROM productos WHERE id_producto = ?',
      [id_producto_terminado]
    );
    
    if (productoResult.data.length === 0) {
      return res.status(404).json({ error: 'Producto terminado no encontrado' });
    }

    const producto = productoResult.data[0];
    const nombreProd = producto.nombre.toUpperCase();
    const esLamina = nombreProd.includes('LÁMINA') || nombreProd.includes('LAMINA');

    if (esLamina) {
        if (!cantidad_unidades || cantidad_unidades <= 0) {
            return res.status(400).json({ error: 'Para Láminas, la cantidad en Unidades/Millares es requerida' });
        }
    } else {
        if (!cantidad_planificada || cantidad_planificada <= 0) {
            return res.status(400).json({ error: 'La cantidad planificada (Kilos) es requerida para este proceso' });
        }
    }

    if (!turno) {
      return res.status(400).json({ error: 'El turno (Mañana/Noche) es requerido' });
    }

    let estadoInicial = 'Pendiente';
    if (!id_supervisor) {
      estadoInicial = 'Pendiente Asignación';
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
    
    const origenTipo = id_orden_venta_origen ? 'Orden de Venta' : 'Supervisor';
    let costoMateriales = 0;
    let recetaCalculada = [];
    const kilosFinalesPlan = cantidad_planificada || 0;

    if (insumos && Array.isArray(insumos) && insumos.length > 0) {
      const insumosIds = insumos.map(i => i.id_insumo);
      const insumosResult = await executeQuery(
        `SELECT id_producto, costo_unitario_promedio 
         FROM productos WHERE id_producto IN (${insumosIds.map(() => '?').join(',')})`,
        insumosIds
      );

      recetaCalculada = insumos.map(item => {
        const insumoDb = insumosResult.data.find(i => i.id_producto == item.id_insumo);
        if (!insumoDb) throw new Error(`Insumo ${item.id_insumo} no encontrado`);
        
        const porcentaje = parseFloat(item.porcentaje);
        const baseCalculo = kilosFinalesPlan > 0 ? kilosFinalesPlan : (parseFloat(cantidad_unidades) * 1); 
        const cantidadCalculada = (baseCalculo * porcentaje) / 100;
        
        costoMateriales += cantidadCalculada * parseFloat(insumoDb.costo_unitario_promedio);

        return {
          id_insumo: item.id_insumo,
          cantidad_requerida: cantidadCalculada
        };
      });
    }

    const ordenResult = await executeQuery(
      `INSERT INTO ordenes_produccion (
        numero_orden, id_producto_terminado, 
        cantidad_planificada, cantidad_unidades,
        id_supervisor, costo_materiales, estado, observaciones,
        origen_tipo, id_orden_venta_origen, fecha_creacion,
        turno, maquinista, ayudante,
        operario_corte, operario_embalaje,
        medida, peso_producto, gramaje,
        es_orden_manual
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [
        numeroOrdenGenerado,
        id_producto_terminado,
        kilosFinalesPlan,
        cantidad_unidades || 0,
        id_supervisor || null, 
        costoMateriales,
        estadoInicial,
        observaciones || null,
        origenTipo,
        id_orden_venta_origen || null,
        fechaActual,
        turno,
        maquinista || null,
        ayudante || null,
        operario_corte || null,
        operario_embalaje || null,
        medida || null,
        peso_producto || null,
        gramaje || null,
        esLamina ? 1 : 0 
      ]
    );

    if (!ordenResult.success) {
      return res.status(500).json({ error: ordenResult.error });
    }
    
    const idOrden = ordenResult.data.insertId;
    
    if (recetaCalculada.length > 0) {
      const queries = recetaCalculada.map(item => ({
        sql: `INSERT INTO op_recetas_provisionales (id_orden, id_insumo, cantidad_requerida) VALUES (?, ?, ?)`,
        params: [idOrden, item.id_insumo, item.cantidad_requerida]
      }));
      await executeTransaction(queries);
    }

    if (id_orden_venta_origen) {
      let destinatarios = [];
      if (id_supervisor) {
        destinatarios.push(id_supervisor);
      } else {
        const supervisoresRes = await executeQuery("SELECT id_empleado FROM empleados WHERE rol = 'Supervisor' AND estado = 'Activo'");
        if (supervisoresRes.success) {
          destinatarios = supervisoresRes.data.map(s => s.id_empleado);
        }
      }

      const titulo = 'Nueva OP Generada';
      const mensaje = `La OP ${numeroOrdenGenerado} (desde Ventas) ha sido creada.`;
      const ruta = `/produccion/ordenes/${idOrden}`;

      for (const idDestino of destinatarios) {
        const insertResult = await executeQuery(`
          INSERT INTO notificaciones (id_usuario_destino, titulo, mensaje, tipo, ruta_destino)
          VALUES (?, ?, ?, ?, ?)
        `, [idDestino, titulo, mensaje, 'info', ruta]);

        const io = req.app.get('socketio');
        if (io) {
          io.to(`usuario_${idDestino}`).emit('nueva_notificacion', {
            id_notificacion: insertResult.data.insertId,
            titulo,
            mensaje,
            tipo: 'info',
            ruta_destino: ruta,
            leido: 0,
            fecha_creacion: new Date().toISOString()
          });
        }
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Orden de producción creada exitosamente',
      data: {
        id_orden: idOrden,
        numero_orden: numeroOrdenGenerado,
        estado: estadoInicial,
        cantidad_kilos: kilosFinalesPlan,
        cantidad_unidades: cantidad_unidades || 0,
        insumos_calculados: recetaCalculada
      }
    });

  } catch (error) {
    console.error('Error creando orden:', error);
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
    const recetaData = recetaResult.data;
    
    const queries = [];
    
    queries.push({
      sql: `UPDATE ordenes_produccion 
            SET estado = ?, fecha_inicio = ? 
            WHERE id_orden = ?`,
      params: ['En Curso', fechaActual, id]
    });
    
    for (const insumo of recetaData) {
      const costoUnitario = parseFloat(insumo.costo_unitario_promedio);
      
      queries.push({
        sql: `INSERT INTO op_consumo_materiales (
          id_orden, id_insumo, cantidad_requerida, costo_unitario, cantidad_real_consumida
        ) VALUES (?, ?, ?, ?, ?)`,
        params: [id, insumo.id_insumo, insumo.cantidad_requerida, costoUnitario, 0]
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
        materiales_registrados: recetaData.length
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

export async function registrarParcial(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    
    let cantidad_kilos = parseFloat(body.cantidad_kilos) || 0;
    const cantidad_unidades = parseFloat(body.cantidad_unidades) || 0;
    const observaciones = body.observaciones || null;
    const insumos_consumidos = Array.isArray(body.insumos_consumidos) ? body.insumos_consumidos : [];

    const id_registrado_por = req.user?.id_empleado || req.user?.id || req.user?.userId || null;

    const ordenResult = await executeQuery(
      `SELECT op.estado, op.numero_orden, op.id_producto_terminado, 
              p.id_tipo_inventario, p.unidad_medida, p.nombre as nombre_producto
       FROM ordenes_produccion op
       INNER JOIN productos p ON op.id_producto_terminado = p.id_producto
       WHERE op.id_orden = ?`,
      [id]
    );

    if (ordenResult.data.length === 0) return res.status(404).json({ error: 'Orden no encontrada' });
    const orden = ordenResult.data[0];

    if (!['En Curso', 'En Pausa'].includes(orden.estado)) {
      return res.status(400).json({ error: 'La orden no está en estado válido para registrar avances.' });
    }

    if (cantidad_kilos === 0 && insumos_consumidos.length > 0) {
      cantidad_kilos = insumos_consumidos.reduce((acc, item) => acc + (parseFloat(item.cantidad) || 0), 0);
    }

    const queries = [];

    queries.push({
      sql: `INSERT INTO op_registros_produccion 
            (id_orden, cantidad_registrada, cantidad_unidades_registrada, id_registrado_por, fecha_registro, observaciones) 
            VALUES (?, ?, ?, ?, NOW(), ?)`,
      params: [id, cantidad_kilos, cantidad_unidades, id_registrado_por, observaciones]
    });

    queries.push({
        sql: `SET @id_registro_actual = LAST_INSERT_ID();`,
        params: []
    });

    queries.push({
      sql: `UPDATE ordenes_produccion 
            SET cantidad_producida = cantidad_producida + ?,
                cantidad_unidades_producida = cantidad_unidades_producida + ?
            WHERE id_orden = ?`,
      params: [cantidad_kilos, cantidad_unidades, id]
    });

    let costoTotalParcial = 0;

    if (insumos_consumidos.length > 0) {
      const ids = insumos_consumidos.map(i => i.id_insumo).join(',');
      let mapaCostos = {};
      if(ids){
          const costos = await executeQuery(`SELECT id_producto, costo_unitario_promedio FROM productos WHERE id_producto IN (${ids})`);
          costos.data.forEach(p => mapaCostos[p.id_producto] = parseFloat(p.costo_unitario_promedio || 0));
      }

      const consumoExistente = await executeQuery(
        `SELECT id_insumo FROM op_consumo_materiales WHERE id_orden = ?`,
        [id]
      );
      const insumosMap = {};
      if (consumoExistente.success) consumoExistente.data.forEach(i => insumosMap[i.id_insumo] = true);

      for (const insumo of insumos_consumidos) {
        const idInsumo = insumo.id_insumo;
        const cantidad = parseFloat(insumo.cantidad) || 0;
        const costoU = mapaCostos[idInsumo] || 0;

        if (!idInsumo || cantidad <= 0) continue;

        costoTotalParcial += cantidad * costoU;

        queries.push({
          sql: `INSERT INTO op_detalle_registros_produccion (id_registro, id_insumo, cantidad) VALUES (@id_registro_actual, ?, ?)`,
          params: [idInsumo, cantidad]
        });

        if (insumosMap[idInsumo]) {
          queries.push({
            sql: `UPDATE op_consumo_materiales 
                  SET cantidad_real_consumida = IFNULL(cantidad_real_consumida, 0) + ? 
                  WHERE id_orden = ? AND id_insumo = ?`,
            params: [cantidad, id, idInsumo]
          });
        } else {
          queries.push({
            sql: `INSERT INTO op_consumo_materiales 
                  (id_orden, id_insumo, cantidad_requerida, cantidad_real_consumida, costo_unitario) 
                  VALUES (?, ?, 0, ?, ?)`,
            params: [id, idInsumo, cantidad, costoU]
          });
        }

        queries.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
          params: [cantidad, idInsumo]
        });
      }
    }

    const esPorUnidad = ['UNIDAD', 'UND', 'ROLLO', 'PZA', 'MILLAR', 'MLL', 'PIEZA'].includes(orden.unidad_medida?.toUpperCase()) || orden.nombre_producto?.toUpperCase().includes('LÁMINA');
    let cantidadStock = esPorUnidad ? cantidad_unidades : cantidad_kilos;
    let costoUnitarioPT = cantidadStock > 0 ? (costoTotalParcial / cantidadStock) : 0;

    if (cantidadStock > 0) {
        queries.push({
            sql: `INSERT INTO entradas (
                id_tipo_inventario, documento_soporte, total_costo, moneda,
                id_registrado_por, observaciones, tipo_entrada, fecha_movimiento, estado
            ) VALUES (?, ?, ?, 'PEN', ?, ?, 'Producción', NOW(), 'Activo')`,
            params: [
                orden.id_tipo_inventario,
                `Parcial O.P. ${orden.numero_orden}`,
                costoTotalParcial,
                id_registrado_por,
                `Ingreso parcial: ${cantidadStock} ${orden.unidad_medida}`
            ]
        });

        queries.push({
            sql: `SET @id_entrada_actual = LAST_INSERT_ID();`,
            params: []
        });

        queries.push({
            sql: `INSERT INTO detalle_entradas (id_entrada, id_producto, cantidad, costo_unitario) 
                  VALUES (@id_entrada_actual, ?, ?, ?)`,
            params: [orden.id_producto_terminado, cantidadStock, costoUnitarioPT]
        });

        queries.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
            params: [cantidadStock, orden.id_producto_terminado]
        });
        
        queries.push({
            sql: 'UPDATE ordenes_produccion SET costo_materiales = costo_materiales + ? WHERE id_orden = ?',
            params: [costoTotalParcial, id]
        });
    }

    const result = await executeTransaction(queries);
    if (!result.success) {
        console.error("Error SQL:", result.error); 
        return res.status(500).json({ error: "Error al guardar registro parcial." });
    }

    res.json({ success: true, message: 'Avance registrado correctamente' });

  } catch (error) {
    console.error('Error en registrarParcial:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function getRegistrosParcialesOrden(req, res) {
  try {
    const { id } = req.params;
    const result = await executeQuery(
      `SELECT 
        orp.id_registro,
        orp.fecha_registro,
        orp.cantidad_registrada,
        orp.cantidad_unidades_registrada,
        orp.observaciones,
        COALESCE(e.nombre_completo, 'Sistema') as registrado_por,
        (
            SELECT GROUP_CONCAT(
                CONCAT(
                    ROUND(odrp.cantidad, 2), 
                    ' ', 
                    COALESCE(p.unidad_medida, 'Und'), 
                    ' ', 
                    p.nombre
                ) SEPARATOR ', '
            )
            FROM op_detalle_registros_produccion odrp
            JOIN productos p ON odrp.id_insumo = p.id_producto
            WHERE odrp.id_registro = orp.id_registro
        ) as detalle_insumos
       FROM op_registros_produccion orp
       LEFT JOIN empleados e ON orp.id_registrado_por = e.id_empleado
       WHERE orp.id_orden = ?
       ORDER BY orp.fecha_registro DESC`,
      [id]
    );

    if (!result.success) return res.status(500).json({ success: false, error: result.error });

    const data = result.data.map(row => ({
        ...row,
        detalle_insumos: row.detalle_insumos || 'Sin detalle de insumos'
    }));

    res.json({ success: true, data: data });
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

export const descargarHojaRutaController = async (req, res) => {
  try {
    const { id } = req.params;

    const ordenResult = await executeQuery(`
      SELECT 
        op.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        e.nombre_completo AS supervisor
      FROM ordenes_produccion op
      LEFT JOIN productos p ON op.id_producto_terminado = p.id_producto
      LEFT JOIN empleados e ON op.id_supervisor = e.id_empleado
      WHERE op.id_orden = ?
    `, [id]);

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const orden = ordenResult.data[0];

    let receta = [];
    
    if (orden.id_receta_producto) {
       const recetaRes = await executeQuery(`
         SELECT 
           p.codigo AS codigo_insumo,
           p.nombre AS insumo,
           p.unidad_medida,
           (rd.cantidad_requerida * CEIL(? / rp.rendimiento_unidades)) as cantidad_requerida
         FROM recetas_detalle rd
         JOIN recetas_productos rp ON rd.id_receta_producto = rp.id_receta_producto
         JOIN productos p ON rd.id_insumo = p.id_producto
         WHERE rd.id_receta_producto = ?
       `, [orden.cantidad_planificada, orden.id_receta_producto]);
       receta = recetaRes.data;
    } else {
       const recetaProv = await executeQuery(`
         SELECT 
           p.codigo AS codigo_insumo,
           p.nombre AS insumo,
           p.unidad_medida,
           rp.cantidad_requerida
         FROM op_recetas_provisionales rp
         JOIN productos p ON rp.id_insumo = p.id_producto
         WHERE rp.id_orden = ?
       `, [id]);
       receta = recetaProv.data;
    }

    const pdfBuffer = await generarPDFHojaRuta(orden, receta);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="hoja_ruta_${orden.numero_orden}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generando Hoja de Ruta:', error);
    res.status(500).json({ error: error.message });
  }
};

export async function finalizarProduccion(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    
    let cantidad_kilos_final = parseFloat(body.cantidad_kilos_final) || 0;
    const cantidad_unidades_final = parseFloat(body.cantidad_unidades_final) || 0;
    const insumos_reales = Array.isArray(body.insumos_reales) ? body.insumos_reales : [];
    const observaciones = body.observaciones || null;
    const mermas = Array.isArray(body.mermas) ? body.mermas : [];
    
    const id_registrado_por = req.user?.id_empleado || req.user?.id || req.user?.userId || null;

    if (cantidad_kilos_final === 0 && insumos_reales.length > 0) {
      cantidad_kilos_final = insumos_reales.reduce((acc, item) => acc + (parseFloat(item.cantidad) || 0), 0);
    }

    const ordenResult = await executeQuery(
      `SELECT op.*, p.id_tipo_inventario, p.unidad_medida, p.nombre as nombre_producto
       FROM ordenes_produccion op
       INNER JOIN productos p ON op.id_producto_terminado = p.id_producto
       WHERE op.id_orden = ? AND op.estado IN (?, ?)`,
      [id, 'En Curso', 'En Pausa']
    );
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada o no está en curso' });
    }
    
    const orden = ordenResult.data[0];
    const queries = [];
    let costoAdicionalCierre = 0;

    queries.push({
      sql: `INSERT INTO op_registros_produccion 
            (id_orden, cantidad_registrada, cantidad_unidades_registrada, id_registrado_por, fecha_registro, observaciones) 
            VALUES (?, ?, ?, ?, NOW(), ?)`,
      params: [
        id, 
        cantidad_kilos_final, 
        cantidad_unidades_final, 
        id_registrado_por, 
        observaciones ? `[CIERRE] ${observaciones}` : '[CIERRE] Producción Finalizada'
      ]
    });

    queries.push({
        sql: `SET @id_registro_cierre = LAST_INSERT_ID();`,
        params: []
    });

    if (insumos_reales.length > 0) {
        const ids = insumos_reales.map(i => i.id_insumo).join(',');
        let mapaCostos = {};
        if(ids){
            const costos = await executeQuery(`SELECT id_producto, costo_unitario_promedio FROM productos WHERE id_producto IN (${ids})`);
            costos.data.forEach(p => mapaCostos[p.id_producto] = parseFloat(p.costo_unitario_promedio || 0));
        }

        const consumoExistenteData = await executeQuery(
            `SELECT id_insumo FROM op_consumo_materiales WHERE id_orden = ?`,
            [id]
        );
        const existeMap = {};
        consumoExistenteData.data.forEach(i => existeMap[i.id_insumo] = true);

        for (const insumo of insumos_reales) {
            const cantidadAdicional = parseFloat(insumo.cantidad) || 0;
            const idInsumo = insumo.id_insumo;
            const costoU = mapaCostos[idInsumo] || 0;

            if (!idInsumo || cantidadAdicional <= 0) continue;

            costoAdicionalCierre += cantidadAdicional * costoU;

            queries.push({
                sql: `INSERT INTO op_detalle_registros_produccion (id_registro, id_insumo, cantidad) VALUES (@id_registro_cierre, ?, ?)`,
                params: [idInsumo, cantidadAdicional]
            });

            if (existeMap[idInsumo]) {
                queries.push({
                    sql: `UPDATE op_consumo_materiales 
                          SET cantidad_real_consumida = cantidad_real_consumida + ? 
                          WHERE id_orden = ? AND id_insumo = ?`,
                    params: [cantidadAdicional, id, idInsumo]
                });
            } else {
                queries.push({
                    sql: `INSERT INTO op_consumo_materiales 
                          (id_orden, id_insumo, cantidad_requerida, cantidad_real_consumida, costo_unitario) 
                          VALUES (?, ?, 0, ?, ?)`,
                    params: [id, idInsumo, cantidadAdicional, costoU]
                });
            }

            queries.push({
                sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
                params: [cantidadAdicional, idInsumo]
            });
        }
    }

    const tiempoMinutos = Math.floor((new Date() - new Date(orden.fecha_inicio)) / 60000);
    
    queries.push({
      sql: `UPDATE ordenes_produccion 
            SET estado = 'Finalizada', 
                cantidad_producida = cantidad_producida + ?,
                cantidad_unidades_producida = cantidad_unidades_producida + ?,
                fecha_fin = NOW(), 
                tiempo_total_minutos = ?, 
                observaciones = ?,
                costo_materiales = costo_materiales + ?
            WHERE id_orden = ?`,
      params: [cantidad_kilos_final, cantidad_unidades_final, tiempoMinutos, observaciones, costoAdicionalCierre, id]
    });

    const esPorUnidad = ['UNIDAD', 'UND', 'ROLLO', 'PZA', 'MILLAR', 'MLL'].includes(orden.unidad_medida?.toUpperCase()) || orden.nombre_producto?.toUpperCase().includes('LÁMINA');
    
    let cantidadParaStock = 0;
    let costoUnitarioPT = 0;

    if (esPorUnidad && cantidad_unidades_final > 0) {
      cantidadParaStock = cantidad_unidades_final;
      costoUnitarioPT = costoAdicionalCierre / cantidad_unidades_final;
    } else {
      cantidadParaStock = cantidad_kilos_final;
      costoUnitarioPT = cantidad_kilos_final > 0 ? (costoAdicionalCierre / cantidad_kilos_final) : 0;
    }

    if (cantidadParaStock > 0) {
      queries.push({
        sql: `INSERT INTO entradas (
          id_tipo_inventario, documento_soporte, total_costo, moneda,
          id_registrado_por, observaciones, tipo_entrada, fecha_movimiento, estado
        ) VALUES (?, ?, ?, 'PEN', ?, ?, 'Producción', NOW(), 'Activo')`,
        params: [
          orden.id_tipo_inventario,
          `Cierre O.P. ${orden.numero_orden}`,
          costoAdicionalCierre,
          id_registrado_por,
          `Ingreso final de producción: ${cantidadParaStock} ${orden.unidad_medida}`
        ]
      });

      queries.push({
          sql: `SET @id_entrada_cierre = LAST_INSERT_ID();`,
          params: []
      });

      queries.push({
        sql: `INSERT INTO detalle_entradas (id_entrada, id_producto, cantidad, costo_unitario) VALUES (@id_entrada_cierre, ?, ?, ?)`,
        params: [orden.id_producto_terminado, cantidadParaStock, costoUnitarioPT]
      });

      queries.push({
        sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
        params: [cantidadParaStock, orden.id_producto_terminado]
      });
    }

    if (mermas.length > 0) {
        let totalCostoMermas = 0;
        let hayMermasValidas = false;
        const mermasValidas = [];

        for (const m of mermas) {
            const cantidadMerma = parseFloat(m.cantidad) || 0;
            if (cantidadMerma > 0 && m.id_producto_merma) {
                hayMermasValidas = true;
                queries.push({
                    sql: 'INSERT INTO mermas_produccion (id_orden_produccion, id_producto_merma, cantidad, observaciones) VALUES (?, ?, ?, ?)',
                    params: [id, m.id_producto_merma, cantidadMerma, m.observaciones || null]
                });
                mermasValidas.push({ id: m.id_producto_merma, cantidad: cantidadMerma });
            }
        }

        if(hayMermasValidas && mermasValidas.length > 0) {
             const idsMermas = mermasValidas.map(m => m.id).join(',');
             const costosMermas = await executeQuery(`SELECT id_producto, costo_unitario_promedio, id_tipo_inventario FROM productos WHERE id_producto IN (${idsMermas})`);
             
             let mapaCostosMermas = {};
             let tipoInventarioMerma = 3; 

             if(costosMermas.success){
                 costosMermas.data.forEach(p => {
                     mapaCostosMermas[p.id_producto] = parseFloat(p.costo_unitario_promedio || 0);
                     tipoInventarioMerma = p.id_tipo_inventario;
                 });
             }

             for (const m of mermasValidas) {
                 totalCostoMermas += m.cantidad * (mapaCostosMermas[m.id] || 0);
             }

             queries.push({
                sql: `INSERT INTO entradas (
                    id_tipo_inventario, documento_soporte, total_costo, moneda,
                    id_registrado_por, observaciones, tipo_entrada, fecha_movimiento, estado
                ) VALUES (?, ?, ?, 'PEN', ?, ?, 'Producción', NOW(), 'Activo')`,
                params: [
                    tipoInventarioMerma, 
                    `Recuperación Merma O.P. ${orden.numero_orden}`,
                    totalCostoMermas,
                    id_registrado_por,
                    'Ingreso por merma de producción'
                ]
            });

            queries.push({ sql: `SET @id_entrada_merma = LAST_INSERT_ID();`, params: [] });

            for (const m of mermasValidas) {
                 queries.push({
                    sql: `INSERT INTO detalle_entradas (id_entrada, id_producto, cantidad, costo_unitario) VALUES (@id_entrada_merma, ?, ?, ?)`,
                    params: [m.id, m.cantidad, mapaCostosMermas[m.id] || 0]
                 });
                 queries.push({
                    sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
                    params: [m.cantidad, m.id]
                 });
            }
        }
    }

    if (orden.id_orden_venta_origen) {
      queries.push({
        sql: "UPDATE ordenes_venta SET estado = 'Atendido por Producción' WHERE id_orden_venta = ?",
        params: [orden.id_orden_venta_origen]
      });
    }

    const result1 = await executeTransaction(queries);
    if (!result1.success) {
      console.error("Error SQL Finalizar:", result1.error);
      return res.status(500).json({ error: "Error al finalizar la orden en base de datos." });
    }

    await notificarCambioEstado(id, `Producción Finalizada: ${orden.numero_orden}`, 'La orden ha sido completada.', 'success', req);

    res.json({
      success: true,
      message: 'Producción finalizada exitosamente',
      data: {
        kilos_adicionales: cantidad_kilos_final,
        unidades_adicionales: cantidad_unidades_final
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
        stock_actual,
        id_tipo_inventario,
        costo_unitario_promedio
      FROM productos
      WHERE id_categoria = 10 AND estado = 'Activo'
      ORDER BY nombre ASC`,
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
      'SELECT * FROM ordenes_produccion WHERE id_orden = ? AND estado IN (?, ?, ?, ?)',
      [id, 'Pendiente Asignación', 'Pendiente', 'En Curso', 'En Pausa']
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
    
    res.json({ success: true, message: 'Orden cancelada y materiales devueltos al inventario' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
export async function completarAsignacionOP(req, res) {
  try {
    const { id } = req.params;
    const {
      id_supervisor,
      turno,
      maquinista,
      ayudante,
      operario_corte,
      operario_embalaje,
      medida,
      peso_producto,
      gramaje,
      modo_receta,
      id_receta_producto,
      receta_provisional,
      rendimiento_receta,
      insumos
    } = req.body;

    if (!id_supervisor) {
      return res.status(400).json({
        success: false,
        error: 'Supervisor es requerido'
      });
    }

    if (!turno) {
      return res.status(400).json({
        success: false,
        error: 'Turno es requerido'
      });
    }

    const ordenExistente = await executeQuery(`
      SELECT op.*, p.nombre as nombre_producto, p.unidad_medida
      FROM ordenes_produccion op
      INNER JOIN productos p ON op.id_producto_terminado = p.id_producto
      WHERE op.id_orden = ? AND op.estado = 'Pendiente Asignación'
    `, [id]);

    if (!ordenExistente.success || ordenExistente.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada o no está en estado Pendiente Asignación'
      });
    }

    const orden = ordenExistente.data[0];
    const nombreProducto = orden.nombre_producto.toUpperCase();
    const esLamina = nombreProducto.includes('LÁMINA') || nombreProducto.includes('LAMINA');
    const cantidadPlan = parseFloat(orden.cantidad_planificada);

    let costoMateriales = 0;
    let rendimientoUnidades = 1;
    let idRecetaProducto = null;
    let insumosReporte = [];
    let recetaCalculada = [];

    if (modo_receta === 'manual' || orden.es_orden_manual === 1) {
      const updateResult = await executeQuery(`
        UPDATE ordenes_produccion 
        SET id_supervisor = ?,
            turno = ?,
            maquinista = ?,
            ayudante = ?,
            operario_corte = ?,
            operario_embalaje = ?,
            medida = ?,
            peso_producto = ?,
            gramaje = ?,
            costo_materiales = 0,
            rendimiento_unidades = 1,
            es_orden_manual = 1,
            estado = 'Pendiente'
        WHERE id_orden = ?
      `, [
        id_supervisor,
        turno,
        maquinista || null,
        ayudante || null,
        operario_corte || null,
        operario_embalaje || null,
        medida || null,
        peso_producto || null,
        gramaje || null,
        id
      ]);

      if (!updateResult.success) {
        return res.status(500).json({
          success: false,
          error: updateResult.error
        });
      }

      return res.json({
        success: true,
        message: 'Orden asignada exitosamente (modo manual)',
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

    if (modo_receta === 'porcentaje' && insumos && Array.isArray(insumos) && insumos.length > 0) {
      const insumosIds = insumos.map(i => i.id_insumo);
      const insumosResult = await executeQuery(
        `SELECT id_producto, costo_unitario_promedio, nombre, unidad_medida, stock_actual
         FROM productos WHERE id_producto IN (${insumosIds.map(() => '?').join(',')})`,
        insumosIds
      );

      recetaCalculada = insumos.map(item => {
        const insumoDb = insumosResult.data.find(i => i.id_producto == item.id_insumo);
        if (!insumoDb) throw new Error(`Insumo ${item.id_insumo} no encontrado`);

        const porcentaje = parseFloat(item.porcentaje);
        const cantidadCalculada = (cantidadPlan * porcentaje) / 100;

        costoMateriales += cantidadCalculada * parseFloat(insumoDb.costo_unitario_promedio);

        insumosReporte.push({
          id_insumo: item.id_insumo,
          codigo: insumoDb.codigo,
          nombre: insumoDb.nombre,
          unidad_medida: insumoDb.unidad_medida,
          cantidad_requerida: cantidadCalculada,
          stock_actual: parseFloat(insumoDb.stock_actual),
          cubre_stock: parseFloat(insumoDb.stock_actual) >= cantidadCalculada,
          costo_unitario: parseFloat(insumoDb.costo_unitario_promedio)
        });

        return {
          id_insumo: item.id_insumo,
          cantidad_requerida: cantidadCalculada
        };
      });
    } else if (modo_receta === 'seleccionar' && id_receta_producto) {
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
          cantidad_requerida: cantidadTotalRequerida,
          stock_actual: parseFloat(insumo.stock_actual),
          cubre_stock: parseFloat(insumo.stock_actual) >= cantidadTotalRequerida,
          costo_unitario: costoUnitario
        });
      }

      idRecetaProducto = id_receta_producto;
    } else if (modo_receta === 'provisional' && receta_provisional && receta_provisional.length > 0) {
      rendimientoUnidades = parseFloat(rendimiento_receta) || 1;
      const lotesNecesarios = Math.ceil(cantidadPlan / rendimientoUnidades);

      for (const item of receta_provisional) {
        const insumoResult = await executeQuery(`
          SELECT codigo, nombre, unidad_medida, costo_unitario_promedio, stock_actual 
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
            cantidad_requerida: cantidadTotalRequerida,
            stock_actual: parseFloat(prodData.stock_actual),
            cubre_stock: parseFloat(prodData.stock_actual) >= cantidadTotalRequerida,
            costo_unitario: costoUnitario
          });
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar una receta o configuración de insumos válida'
      });
    }

    const updateResult = await executeQuery(`
      UPDATE ordenes_produccion 
      SET id_receta_producto = ?,
          id_supervisor = ?,
          turno = ?,
          maquinista = ?,
          ayudante = ?,
          operario_corte = ?,
          operario_embalaje = ?,
          medida = ?,
          peso_producto = ?,
          gramaje = ?,
          costo_materiales = ?,
          rendimiento_unidades = ?,
          estado = 'Pendiente'
      WHERE id_orden = ?
    `, [
      idRecetaProducto,
      id_supervisor,
      turno,
      maquinista || null,
      ayudante || null,
      operario_corte || null,
      operario_embalaje || null,
      medida || null,
      peso_producto || null,
      gramaje || null,
      costoMateriales,
      rendimientoUnidades,
      id
    ]);

    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: updateResult.error
      });
    }

    if (recetaCalculada.length > 0) {
      const queries = recetaCalculada.map(item => ({
        sql: `INSERT INTO op_recetas_provisionales (id_orden, id_insumo, cantidad_requerida) VALUES (?, ?, ?)`,
        params: [id, item.id_insumo, item.cantidad_requerida]
      }));
      await executeTransaction(queries);
    } else if (receta_provisional && receta_provisional.length > 0) {
      await executeQuery(`
        UPDATE ordenes_produccion 
        SET receta_provisional = ?
        WHERE id_orden = ?
      `, [JSON.stringify(receta_provisional), id]);
    }

    const lotesNecesarios = Math.ceil(cantidadPlan / rendimientoUnidades);

    res.json({
      success: true,
      message: 'Orden asignada y configurada exitosamente',
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
    console.error('Error al completar asignación:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
export async function editarOrdenCompleta(req, res) {
  const { id } = req.params;
  const { 
    cantidad_planificada,
    cantidad_unidades,
    id_supervisor,
    observaciones,
    fecha_programada, 
    fecha_programada_fin,
    turno,
    maquinista,
    ayudante,
    operario_corte,
    operario_embalaje,
    medida,
    peso_producto,
    gramaje,
    modo_receta,
    id_producto_terminado,
    insumos 
  } = req.body;

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Actualizar la cabecera de la orden
    // Forzamos id_receta_producto a NULL porque ahora es una receta personalizada (provisional)
    const updateQuery = `
      UPDATE ordenes_produccion 
      SET 
        id_producto_terminado = ?,
        cantidad_planificada = ?,
        cantidad_unidades = ?,
        id_supervisor = ?,
        observaciones = ?,
        fecha_programada = ?,
        fecha_programada_fin = ?,
        turno = ?,
        maquinista = ?,
        ayudante = ?,
        operario_corte = ?,
        operario_embalaje = ?,
        medida = ?,
        peso_producto = ?,
        gramaje = ?,
        es_orden_manual = ?,
        id_receta_producto = NULL
      WHERE id_orden = ?
    `;

    const esManual = modo_receta === 'manual' ? 1 : 0;

    await connection.query(updateQuery, [
      id_producto_terminado,
      parseFloat(cantidad_planificada),
      parseFloat(cantidad_unidades || 0),
      id_supervisor || null,
      observaciones,
      fecha_programada || null,
      fecha_programada_fin || null,
      turno,
      maquinista || null,
      ayudante || null,
      operario_corte || null,
      operario_embalaje || null,
      medida,
      peso_producto,
      gramaje,
      esManual,
      id
    ]);

    // 2. Limpiar datos previos
    // Borramos de ambas tablas para evitar datos fantasmas
    await connection.query('DELETE FROM op_consumo_materiales WHERE id_orden = ?', [id]);
    await connection.query('DELETE FROM op_recetas_provisionales WHERE id_orden = ?', [id]);

    let nuevoCostoMateriales = 0;

    // 3. Insertar nuevos insumos en la tabla PROVISIONAL
    if (modo_receta !== 'manual' && insumos && insumos.length > 0) {
      for (const insumo of insumos) {
        const porcentaje = parseFloat(insumo.porcentaje);
        // Calculamos la cantidad requerida en Kilos basada en el porcentaje
        const cantidadRequerida = (parseFloat(cantidad_planificada) * porcentaje) / 100;

        // Obtenemos costo unitario para actualizar el costo total de la orden
        const [productos] = await connection.query(
          'SELECT costo_unitario_promedio FROM productos WHERE id_producto = ?', 
          [insumo.id_insumo]
        );
        
        const costoUnitario = productos.length > 0 ? parseFloat(productos[0].costo_unitario_promedio) : 0;
        nuevoCostoMateriales += cantidadRequerida * costoUnitario;

        // CORRECCIÓN CLAVE: Insertar en op_recetas_provisionales
        // Esta es la tabla que lee el frontend cuando el estado es 'Pendiente'
        await connection.query(
          `INSERT INTO op_recetas_provisionales 
           (id_orden, id_insumo, cantidad_requerida) 
           VALUES (?, ?, ?)`,
          [id, insumo.id_insumo, cantidadRequerida]
        );
      }
    }

    // 4. Actualizar el costo total calculado en la cabecera
    await connection.query(
        'UPDATE ordenes_produccion SET costo_materiales = ? WHERE id_orden = ?',
        [nuevoCostoMateriales, id]
    );

    await connection.commit();
    res.json({ success: true, message: 'Orden actualizada exitosamente' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error al editar orden:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
}

export async function anularOrden(req, res) {
  try {
    const { id } = req.params;
    
    const id_usuario = req.user?.id_usuario || req.user?.id || req.user?.userId || req.user?.id_empleado;

    if (!id_usuario) {
        return res.status(401).json({ error: 'Acción no autorizada: No se pudo identificar al usuario.' });
    }

    const ordenResult = await executeQuery(
      `SELECT * FROM ordenes_produccion WHERE id_orden = ?`,
      [id]
    );

    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const orden = ordenResult.data[0];

    if (orden.estado === 'Cancelada') {
      return res.status(400).json({ error: 'La orden ya está cancelada' });
    }

    const queries = [];
    
    let hayEntradaInsumos = false;
    let haySalidaProducto = false;
    let totalCostoInsumos = 0; 

    // Buscar si hubo consumo real de materiales
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

    // Preparar devolución de insumos (Entrada al almacén)
    if (consumoResult.data.length > 0) {
      hayEntradaInsumos = true;
      
      totalCostoInsumos = consumoResult.data.reduce((sum, item) => 
        sum + (parseFloat(item.cantidad_real_consumida) * parseFloat(item.costo_unitario)), 0
      );

      queries.push({
        sql: `INSERT INTO entradas (
          id_tipo_inventario, 
          tipo_entrada,
          documento_soporte, 
          total_costo, 
          moneda,
          id_registrado_por, 
          observaciones, 
          fecha_movimiento,
          estado
        ) VALUES (?, 'Devolucion', ?, ?, 'PEN', ?, ?, NOW(), 'Activo')`,
        params: [
          consumoResult.data[0].id_tipo_inventario,
          `Anulación O.P. ${orden.numero_orden}`,
          totalCostoInsumos,
          id_usuario, 
          `Devolución de insumos por anulación de O.P. ${orden.numero_orden}`
        ]
      });
    }

    let cantidadA_Retirar = 0;
    let costoUnitarioPT = 0;

    // Preparar retiro de producto terminado (Salida del almacén)
    if (orden.estado === 'Finalizada' && parseFloat(orden.cantidad_producida) > 0) {
        
        cantidadA_Retirar = parseFloat(orden.cantidad_producida);
        
        if (cantidadA_Retirar > 0) {
            haySalidaProducto = true;
            
            costoUnitarioPT = totalCostoInsumos / cantidadA_Retirar;
            if (isNaN(costoUnitarioPT) || !isFinite(costoUnitarioPT)) costoUnitarioPT = 0;

            queries.push({
                sql: `INSERT INTO salidas (
                    id_tipo_inventario, 
                    tipo_movimiento, 
                    id_registrado_por, 
                    observaciones, 
                    fecha_movimiento, 
                    estado
                ) VALUES (?, 'Anulación Producción', ?, ?, NOW(), 'Activo')`,
                params: [
                    3, // ID tipo inventario para producto terminado (ajustar si varía)
                    id_usuario, 
                    `Reversión de ingreso por anulación de O.P. ${orden.numero_orden}`
                ]
            });
        }
    }

    // Cancelar la orden de producción
    queries.push({
      sql: `UPDATE ordenes_produccion 
            SET estado = 'Cancelada', 
                observaciones = CONCAT(IFNULL(observaciones, ''), ' [CANCELADA]') 
            WHERE id_orden = ?`,
      params: [id]
    });

    // Liberar la orden de venta si existe
    if (orden.id_orden_venta_origen) {
      queries.push({
        sql: `UPDATE ordenes_venta SET estado = 'Pendiente' WHERE id_orden_venta = ?`,
        params: [orden.id_orden_venta_origen]
      });
    }

    // Ejecutar cabeceras
    const resultHeader = await executeTransaction(queries);
    
    if (!resultHeader.success) {
        throw new Error(resultHeader.error);
    }

    const queriesDetalles = [];
    let currentIndex = 0;
    
    // Detalles de la Devolución de Insumos
    if (hayEntradaInsumos) {
        const idEntrada = resultHeader.data[currentIndex].insertId;
        currentIndex++;

        for (const item of consumoResult.data) {
            queriesDetalles.push({
                sql: `INSERT INTO detalle_entradas (id_entrada, id_producto, cantidad, costo_unitario) VALUES (?, ?, ?, ?)`,
                params: [idEntrada, item.id_insumo, item.cantidad_real_consumida, item.costo_unitario]
            });
            
            queriesDetalles.push({
                sql: `UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?`,
                params: [item.cantidad_real_consumida, item.id_insumo]
            });
        }
    }

    // Detalles del Retiro de Producto Terminado
    if (haySalidaProducto) {
        const idSalida = resultHeader.data[currentIndex].insertId;

        queriesDetalles.push({
            sql: `INSERT INTO detalle_salidas (id_salida, id_producto, cantidad, costo_unitario) VALUES (?, ?, ?, ?)`,
            params: [idSalida, orden.id_producto_terminado, cantidadA_Retirar, costoUnitarioPT]
        });
        
        queriesDetalles.push({
            sql: `UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?`,
            params: [cantidadA_Retirar, orden.id_producto_terminado]
        });
    }

    // Ejecutar detalles
    if (queriesDetalles.length > 0) {
        const resultDetalles = await executeTransaction(queriesDetalles);
        if (!resultDetalles.success) throw new Error(resultDetalles.error);
    }

    res.json({ success: true, message: 'Orden cancelada y movimientos revertidos correctamente.' });

  } catch (error) {
    console.error('Error al anular orden:', error);
    res.status(500).json({ error: error.message });
  }
}