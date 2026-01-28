import { executeQuery, executeTransaction } from '../config/database.js';
import { generarPDFOrdenProduccion } from '../utils/pdf-generator.js';
import { generarPDFHojaRuta } from '../utils/pdf-generator.js';

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
    
    // 1. SANITIZACIÓN DE ENTRADA (La clave para evitar el error)
    // Usamos el operador || para asegurar que NUNCA sea undefined
    const body = req.body || {};
    
    let cantidad_kilos = parseFloat(body.cantidad_kilos) || 0;
    const cantidad_unidades = parseFloat(body.cantidad_unidades) || 0;
    const observaciones = body.observaciones || null; // Si no hay, pasa null a la BD
    const insumos_consumidos = Array.isArray(body.insumos_consumidos) ? body.insumos_consumidos : [];

    // 2. RECUPERACIÓN SEGURA DEL USUARIO
    // Intentamos leer id_usuario, si no existe probamos 'id', si no 'userId', si no NULL.
    const id_registrado_por = req.user?.id_usuario || req.user?.id || req.user?.userId || null;

    if (!id_registrado_por) {
      console.warn("⚠ ADVERTENCIA: No se pudo obtener el ID del usuario del token. Se registrará como NULL.");
    }

    const fechaActual = getFechaPeru();

    // 3. CÁLCULO AUTOMÁTICO DE KILOS (Tu lógica de negocio)
    if (cantidad_kilos === 0 && insumos_consumidos.length > 0) {
      cantidad_kilos = insumos_consumidos.reduce((acc, item) => acc + (parseFloat(item.cantidad) || 0), 0);
    }

    // Validación de estado de la orden
    const ordenCheck = await executeQuery(
      "SELECT estado FROM ordenes_produccion WHERE id_orden = ?",
      [id]
    );

    if (ordenCheck.data.length === 0) return res.status(404).json({ error: 'Orden no encontrada' });
    if (!['En Curso', 'En Pausa'].includes(ordenCheck.data[0].estado)) {
      return res.status(400).json({ error: 'La orden no está en estado válido para registrar avances.' });
    }

    const queries = [];

    // 4. QUERY DE INSERCIÓN (Aquí es donde fallaba antes)
    queries.push({
      sql: `INSERT INTO op_registros_produccion 
            (id_orden, cantidad_registrada, cantidad_unidades_registrada, id_registrado_por, fecha_registro, observaciones) 
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        id, 
        cantidad_kilos, 
        cantidad_unidades, 
        id_registrado_por, // Ahora seguro es un ID o null, nunca undefined
        fechaActual, 
        observaciones      // Ahora seguro es texto o null, nunca undefined
      ]
    });

    queries.push({
      sql: `UPDATE ordenes_produccion 
            SET cantidad_producida = cantidad_producida + ?,
                cantidad_unidades_producida = cantidad_unidades_producida + ?
            WHERE id_orden = ?`,
      params: [cantidad_kilos, cantidad_unidades, id]
    });

    // 5. PROCESAMIENTO DE INSUMOS
    if (insumos_consumidos.length > 0) {
      const consumoExistente = await executeQuery(
        `SELECT id_insumo FROM op_consumo_materiales WHERE id_orden = ?`,
        [id]
      );

      const insumosExistentesMap = {};
      if (consumoExistente.success) {
        consumoExistente.data.forEach(item => {
          insumosExistentesMap[item.id_insumo] = true;
        });
      }

      for (const insumo of insumos_consumidos) {
        // Validación estricta dentro del loop
        const idInsumo = insumo.id_insumo;
        const cantidad = parseFloat(insumo.cantidad) || 0;

        // Si el frontend manda un insumo mal formado (sin ID), lo saltamos
        if (!idInsumo) continue; 

        if (cantidad > 0) {
          if (insumosExistentesMap[idInsumo]) {
            queries.push({
              sql: `UPDATE op_consumo_materiales 
                    SET cantidad_real_consumida = IFNULL(cantidad_real_consumida, 0) + ? 
                    WHERE id_orden = ? AND id_insumo = ?`,
              params: [cantidad, id, idInsumo]
            });
          } else {
            const prodInfo = await executeQuery(
              'SELECT costo_unitario_promedio FROM productos WHERE id_producto = ?',
              [idInsumo]
            );
            
            const costoUnitario = prodInfo.success && prodInfo.data.length > 0 
              ? parseFloat(prodInfo.data[0].costo_unitario_promedio) || 0 // Prevenimos undefined aquí también
              : 0;

            queries.push({
              sql: `INSERT INTO op_consumo_materiales 
                    (id_orden, id_insumo, cantidad_requerida, cantidad_real_consumida, costo_unitario) 
                    VALUES (?, ?, 0, ?, ?)`,
              params: [id, idInsumo, cantidad, costoUnitario]
            });
          }

          queries.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
            params: [cantidad, idInsumo]
          });
        }
      }
    }

    const result = await executeTransaction(queries);
    if (!result.success) {
        // Log para que veas el error real en consola si ocurre
        console.error("Error SQL Transaction:", result.error); 
        return res.status(500).json({ error: "Error en base de datos al guardar." });
    }

    res.json({ success: true, message: 'Avance registrado correctamente' });

  } catch (error) {
    console.error('Error CRÍTICO en registrarParcial:', error);
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
    
    const fechaActual = getFechaPeru();

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
    
    const consumoMaterialesData = await executeQuery(
      `SELECT cm.id_insumo, cm.cantidad_real_consumida, cm.costo_unitario
       FROM op_consumo_materiales cm
       WHERE cm.id_orden = ?`,
      [id]
    );

    const insumosExistentesMap = {};
    if (consumoMaterialesData.success) {
      consumoMaterialesData.data.forEach(item => {
        insumosExistentesMap[item.id_insumo] = {
          cantidad_real_consumida: parseFloat(item.cantidad_real_consumida || 0),
          costo_unitario: parseFloat(item.costo_unitario)
        };
      });
    }

    const queries = [];
    let costoTotalOrden = 0;

    for (const insumo of insumos_reales) {
      const cantidadFinal = parseFloat(insumo.cantidad) || 0;
      const idInsumo = insumo.id_insumo;

      if (!idInsumo || cantidadFinal < 0) continue;

      const insumoExistente = insumosExistentesMap[idInsumo];
      
      if (insumoExistente) {
        const diferencia = cantidadFinal - insumoExistente.cantidad_real_consumida;
        
        if (diferencia !== 0) {
          queries.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
            params: [diferencia, idInsumo]
          });
        }

        queries.push({
          sql: `UPDATE op_consumo_materiales SET cantidad_real_consumida = ? WHERE id_orden = ? AND id_insumo = ?`,
          params: [cantidadFinal, id, idInsumo]
        });

        costoTotalOrden += cantidadFinal * insumoExistente.costo_unitario;
      } else {
        const prodInfo = await executeQuery(
          'SELECT costo_unitario_promedio FROM productos WHERE id_producto = ?',
          [idInsumo]
        );
        
        const costoUnitario = prodInfo.success && prodInfo.data.length > 0 
          ? (parseFloat(prodInfo.data[0].costo_unitario_promedio) || 0)
          : 0;
        
        queries.push({
          sql: `INSERT INTO op_consumo_materiales 
                (id_orden, id_insumo, cantidad_requerida, cantidad_real_consumida, costo_unitario) 
                VALUES (?, ?, 0, ?, ?)`,
          params: [id, idInsumo, cantidadFinal, costoUnitario]
        });
        
        queries.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
          params: [cantidadFinal, idInsumo]
        });
        
        costoTotalOrden += cantidadFinal * costoUnitario;
      }
    }

    const tiempoMinutos = Math.floor((new Date() - new Date(orden.fecha_inicio)) / 60000);
    
    queries.push({
      sql: `UPDATE ordenes_produccion 
            SET estado = 'Finalizada', 
                cantidad_producida = cantidad_producida + ?,
                cantidad_unidades_producida = cantidad_unidades_producida + ?,
                fecha_fin = ?, 
                tiempo_total_minutos = ?, 
                observaciones = ?,
                costo_materiales = costo_materiales + ?
            WHERE id_orden = ?`,
      params: [cantidad_kilos_final, cantidad_unidades_final, fechaActual, tiempoMinutos, observaciones, costoTotalOrden, id]
    });

    let cantidadParaStock = 0;
    let costoUnitarioFinal = 0;

    const esPorUnidad = ['UNIDAD', 'UND', 'ROLLO', 'PZA', 'PIEZA', 'MILLAR', 'MLL'].includes(orden.unidad_medida.toUpperCase()) || orden.nombre_producto.toUpperCase().includes('LÁMINA');

    if (esPorUnidad && cantidad_unidades_final > 0) {
      cantidadParaStock = cantidad_unidades_final;
      costoUnitarioFinal = costoTotalOrden / cantidad_unidades_final;
    } else {
      cantidadParaStock = cantidad_kilos_final;
      costoUnitarioFinal = cantidad_kilos_final > 0 ? (costoTotalOrden / cantidad_kilos_final) : 0;
    }

    if (cantidadParaStock > 0) {
      queries.push({
        sql: `INSERT INTO entradas (
          id_tipo_inventario, documento_soporte, total_costo, moneda,
          id_registrado_por, observaciones
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        params: [
          orden.id_tipo_inventario,
          `O.P. ${orden.numero_orden}`,
          costoTotalOrden,
          'PEN',
          orden.id_supervisor,
          `Producción Final: ${cantidadParaStock} ${orden.unidad_medida}`
        ]
      });
    }

    if (orden.id_orden_venta_origen) {
      queries.push({
        sql: "UPDATE ordenes_venta SET estado = 'Atendido por Producción' WHERE id_orden_venta = ?",
        params: [orden.id_orden_venta_origen]
      });
    }

    const result1 = await executeTransaction(queries);
    if (!result1.success) {
      console.error("Error SQL Transaction:", result1.error);
      return res.status(500).json({ error: result1.error });
    }

    if (cantidadParaStock > 0) {
      let idEntrada = null;
      for (let i = result1.data.length - 1; i >= 0; i--) {
        if (result1.data[i].insertId && !idEntrada) { 
          idEntrada = result1.data[i].insertId;
          break;
        }
      }
      
      if (!idEntrada) {
        const lastEntrada = await executeQuery('SELECT MAX(id_entrada) as id FROM entradas');
        idEntrada = lastEntrada.data[0].id;
      }

      if (idEntrada) {
        const queriesStock = [];
        
        queriesStock.push({
          sql: `INSERT INTO detalle_entradas (id_entrada, id_producto, cantidad, costo_unitario) VALUES (?, ?, ?, ?)`,
          params: [idEntrada, orden.id_producto_terminado, cantidadParaStock, costoUnitarioFinal]
        });

        queriesStock.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
          params: [cantidadParaStock, orden.id_producto_terminado]
        });

        await executeTransaction(queriesStock);
      }
    }

    if (mermas.length > 0) {
      const queriesMermas = [];
      let totalCostoMermas = 0;
      const mermasValidas = [];

      for (const m of mermas) {
        const cantidadMerma = parseFloat(m.cantidad) || 0;
        if (cantidadMerma > 0 && m.id_producto_merma) {
          queriesMermas.push({
            sql: 'INSERT INTO mermas_produccion (id_orden_produccion, id_producto_merma, cantidad, observaciones) VALUES (?, ?, ?, ?)',
            params: [id, m.id_producto_merma, cantidadMerma, m.observaciones || null]
          });
          
          const prodMermaInfo = await executeQuery('SELECT id_tipo_inventario, costo_unitario_promedio FROM productos WHERE id_producto = ?', [m.id_producto_merma]);
          
          if (prodMermaInfo.success && prodMermaInfo.data.length > 0) {
            const dataMerma = prodMermaInfo.data[0];
            const costoMerma = parseFloat(dataMerma.costo_unitario_promedio || 0);
            totalCostoMermas += cantidadMerma * costoMerma;
            
            mermasValidas.push({
              id_producto: m.id_producto_merma,
              cantidad: cantidadMerma,
              costo_unitario: costoMerma,
              id_tipo_inventario: dataMerma.id_tipo_inventario
            });
          }
        }
      }

      if (mermasValidas.length > 0) {
        queriesMermas.push({
          sql: `INSERT INTO entradas (
            id_tipo_inventario, documento_soporte, total_costo, moneda,
            id_registrado_por, observaciones
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          params: [
            mermasValidas[0].id_tipo_inventario, 
            `Recuperación Merma O.P. ${orden.numero_orden}`,
            totalCostoMermas,
            'PEN',
            orden.id_supervisor,
            'Ingreso por merma de producción'
          ]
        });
      }

      const resultMermas = await executeTransaction(queriesMermas);
      
      if (resultMermas.success && mermasValidas.length > 0) {
        const idEntradaMerma = resultMermas.data[resultMermas.data.length - 1].insertId;
        const queriesDetalleMerma = [];
        
        for (const m of mermasValidas) {
          queriesDetalleMerma.push({
            sql: `INSERT INTO detalle_entradas (id_entrada, id_producto, cantidad, costo_unitario) VALUES (?, ?, ?, ?)`,
            params: [idEntradaMerma, m.id_producto, m.cantidad, m.costo_unitario]
          });
          queriesDetalleMerma.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
            params: [m.cantidad, m.id_producto]
          });
        }
        await executeTransaction(queriesDetalleMerma);
      }
    }

    await notificarCambioEstado(id, `Producción Finalizada: ${orden.numero_orden}`, 'La orden ha sido completada.', 'success', req);

    res.json({
      success: true,
      message: 'Producción finalizada exitosamente',
      data: {
        kilos_finales: cantidad_kilos_final,
        unidades_finales: cantidad_unidades_final,
        costo_total: costoTotalOrden
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
  try {
    const { id } = req.params;
    const {
      id_producto_terminado,
      cantidad_planificada,
      cantidad_unidades,
      id_supervisor,
      turno,
      maquinista,
      ayudante,
      operario_corte,
      operario_embalaje,
      medida,
      peso_producto,
      gramaje,
      fecha_programada,
      fecha_programada_fin,
      observaciones,
      insumos,
      modo_receta
    } = req.body;

    const ordenCheck = await executeQuery(
      'SELECT * FROM ordenes_produccion WHERE id_orden = ?',
      [id]
    );

    if (ordenCheck.data.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const ordenActual = ordenCheck.data[0];

    if (!['Pendiente Asignación', 'Pendiente'].includes(ordenActual.estado)) {
      return res.status(400).json({ 
        error: 'Solo se pueden editar órdenes en estado "Pendiente Asignación" o "Pendiente"' 
      });
    }

    const queries = [];

    const payload = {
      id_producto_terminado: parseInt(id_producto_terminado),
      cantidad_planificada: parseFloat(cantidad_planificada),
      cantidad_unidades: parseFloat(cantidad_unidades || 0),
      id_supervisor: id_supervisor ? parseInt(id_supervisor) : null,
      turno: turno || 'Día',
      maquinista: maquinista || null,
      ayudante: ayudante || null,
      operario_corte: operario_corte || null,
      operario_embalaje: operario_embalaje || null,
      medida: medida || null,
      peso_producto: peso_producto || null,
      gramaje: gramaje || null,
      fecha_programada: fecha_programada || null,
      fecha_programada_fin: fecha_programada_fin || null,
      observaciones: observaciones || null
    };

    const productoChanged = parseInt(id_producto_terminado) !== parseInt(ordenActual.id_producto_terminado);
    const cantidadChanged = parseFloat(cantidad_planificada) !== parseFloat(ordenActual.cantidad_planificada);

    if (productoChanged || cantidadChanged || (insumos && insumos.length > 0)) {
      queries.push({
        sql: 'DELETE FROM op_consumo_materiales WHERE id_orden = ?',
        params: [id]
      });

      queries.push({
        sql: 'DELETE FROM op_recetas_provisionales WHERE id_orden = ?',
        params: [id]
      });

      if (insumos && insumos.length > 0 && modo_receta === 'porcentaje') {
        let costoTotalMateriales = 0;

        for (const insumo of insumos) {
          const porcentaje = parseFloat(insumo.porcentaje);
          const cantidadRequerida = (parseFloat(cantidad_planificada) * porcentaje) / 100;

          const insumoInfo = await executeQuery(
            'SELECT costo_unitario_promedio FROM productos WHERE id_producto = ?',
            [insumo.id_insumo]
          );

          const costoUnitario = insumoInfo.success && insumoInfo.data.length > 0
            ? parseFloat(insumoInfo.data[0].costo_unitario_promedio)
            : 0;

          costoTotalMateriales += cantidadRequerida * costoUnitario;

          if (ordenActual.estado === 'Pendiente') {
            queries.push({
              sql: `INSERT INTO op_consumo_materiales 
                    (id_orden, id_insumo, cantidad_requerida, costo_unitario, cantidad_real_consumida) 
                    VALUES (?, ?, ?, ?, 0)`,
              params: [id, insumo.id_insumo, cantidadRequerida, costoUnitario]
            });
          } else {
            queries.push({
              sql: `INSERT INTO op_recetas_provisionales 
                    (id_orden, id_insumo, porcentaje, cantidad_requerida, costo_unitario) 
                    VALUES (?, ?, ?, ?, ?)`,
              params: [id, insumo.id_insumo, porcentaje, cantidadRequerida, costoUnitario]
            });
          }
        }

        payload.costo_materiales = costoTotalMateriales;
      } else if (modo_receta === 'manual') {
        payload.es_orden_manual = 1;
        payload.costo_materiales = 0;
      }
    }

    const setClauses = Object.keys(payload).map(key => `${key} = ?`).join(', ');
    const values = Object.values(payload);

    queries.push({
      sql: `UPDATE ordenes_produccion SET ${setClauses} WHERE id_orden = ?`,
      params: [...values, id]
    });

    const result = await executeTransaction(queries);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    await notificarCambioEstado(
      id,
      `Orden Modificada: ${ordenActual.numero_orden}`,
      'La orden de producción ha sido editada.',
      'info',
      req
    );

    res.json({
      success: true,
      message: 'Orden actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error al editar orden:', error);
    res.status(500).json({ error: error.message });
  }
}
export async function anularOrden(req, res) {
  try {
    const { id } = req.params;
    const id_usuario = req.user?.id_usuario || req.user?.id || null;

    // 1. Obtener datos de la orden
    const ordenResult = await executeQuery(
      `SELECT * FROM ordenes_produccion WHERE id_orden = ?`,
      [id]
    );

    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const orden = ordenResult.data[0];

    // Validación de estado según el ENUM de tu tabla
    if (orden.estado === 'Cancelada') {
      return res.status(400).json({ error: 'La orden ya está cancelada' });
    }

    const queries = [];
    
    // Variables para rastrear los índices de los resultados de la transacción
    let hayEntradaInsumos = false;
    let haySalidaProducto = false;

    // ---------------------------------------------------------
    // PASO A: DEVOLVER INSUMOS CONSUMIDOS AL ALMACÉN (Entrada)
    // ---------------------------------------------------------
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

    if (consumoResult.data.length > 0) {
      hayEntradaInsumos = true;
      
      const totalCostoDevolucion = consumoResult.data.reduce((sum, item) => 
        sum + (parseFloat(item.cantidad_real_consumida) * parseFloat(item.costo_unitario)), 0
      );

      // CORRECCIÓN: Usamos 'fecha_movimiento' y 'tipo_entrada'
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
          totalCostoDevolucion,
          id_usuario,
          `Devolución de insumos por anulación de O.P. ${orden.numero_orden}`
        ]
      });
    }

    // ---------------------------------------------------------
    // PASO B: RETIRAR PRODUCTO TERMINADO (Salida) - Solo si finalizó
    // ---------------------------------------------------------
    let cantidadA_Retirar = 0;
    
    if (orden.estado === 'Finalizada' && parseFloat(orden.cantidad_producida) > 0) {
        
        // Lógica para determinar qué cantidad retirar del stock (Kilos o Unidades)
        // Por defecto el sistema mueve stock en base a la unidad de medida principal del producto
        // Si tu sistema mueve stock en Kilos:
        cantidadA_Retirar = parseFloat(orden.cantidad_producida);
        
        // Si es un caso especial donde el stock se mueve en unidades (ej. láminas manuales):
        // (Ajusta esta lógica según cómo guardas tu stock normalmente)
        if (orden.es_orden_manual === 1 && parseFloat(orden.cantidad_unidades_producida) > 0) {
             // Si el producto está configurado para controlar stock por unidades, descomenta esto:
             // cantidadA_Retirar = parseFloat(orden.cantidad_unidades_producida);
        }

        if (cantidadA_Retirar > 0) {
            haySalidaProducto = true;
            
            // Asumimos que la tabla salidas usa 'fecha_salida' o 'fecha_movimiento'. 
            // Si salidas tiene la misma estructura que entradas, usa 'fecha_movimiento'.
            // Mantendré 'fecha_salida' si tu tabla salidas es estándar, si falla cámbialo a 'fecha_movimiento'.
            queries.push({
                sql: `INSERT INTO salidas (
                    id_tipo_inventario, documento_soporte, id_solicitante, 
                    observaciones, fecha_salida, estado
                ) VALUES (?, ?, ?, ?, NOW(), 'Aprobado')`,
                params: [
                    3, // ID 3 = Producto Terminado
                    `Anulación O.P. ${orden.numero_orden}`,
                    id_usuario,
                    `Reversión de ingreso por anulación de O.P. ${orden.numero_orden}`
                ]
            });
        }
    }

    // ---------------------------------------------------------
    // PASO C: ACTUALIZAR ESTADO DE LA ORDEN
    // ---------------------------------------------------------
    // CORRECCIÓN: Estado 'Cancelada' (el enum no admite 'Anulada')
    queries.push({
      sql: `UPDATE ordenes_produccion 
            SET estado = 'Cancelada', 
                observaciones = CONCAT(IFNULL(observaciones, ''), ' [CANCELADA]') 
            WHERE id_orden = ?`,
      params: [id]
    });

    // ---------------------------------------------------------
    // PASO D: LIBERAR ORDEN DE VENTA (Si existe)
    // ---------------------------------------------------------
    if (orden.id_orden_venta_origen) {
      queries.push({
        sql: `UPDATE ordenes_venta SET estado = 'Pendiente' WHERE id_orden_venta = ?`,
        params: [orden.id_orden_venta_origen]
      });
    }

    // EJECUTAR TRANSACCIÓN DE CABECERAS
    const resultHeader = await executeTransaction(queries);
    
    if (!resultHeader.success) {
        throw new Error(resultHeader.error);
    }

    // ---------------------------------------------------------
    // PASO E: GESTIONAR DETALLES DE INVENTARIO (Stock Físico)
    // ---------------------------------------------------------
    const queriesDetalles = [];
    
    // Rastrear índices de los resultados para obtener los IDs generados
    let currentIndex = 0;
    
    // 1. Procesar Devolución de Insumos (Entrada)
    if (hayEntradaInsumos) {
        const idEntrada = resultHeader.data[currentIndex].insertId;
        currentIndex++;

        for (const item of consumoResult.data) {
            queriesDetalles.push({
                sql: `INSERT INTO detalle_entradas (id_entrada, id_producto, cantidad, costo_unitario) VALUES (?, ?, ?, ?)`,
                params: [idEntrada, item.id_insumo, item.cantidad_real_consumida, item.costo_unitario]
            });
            
            // Devolver Stock
            queriesDetalles.push({
                sql: `UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?`,
                params: [item.cantidad_real_consumida, item.id_insumo]
            });
        }
    }

    // 2. Procesar Retiro de Producto Terminado (Salida)
    if (haySalidaProducto) {
        const idSalida = resultHeader.data[currentIndex].insertId;
        // currentIndex++; // No es necesario incrementar si no hay más inserts con ID dependiente después

        queriesDetalles.push({
            sql: `INSERT INTO detalle_salidas (id_salida, id_producto, cantidad) VALUES (?, ?, ?)`,
            params: [idSalida, orden.id_producto_terminado, cantidadA_Retirar]
        });
        
        // Restar Stock (Revertir el ingreso de producción)
        queriesDetalles.push({
            sql: `UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?`,
            params: [cantidadA_Retirar, orden.id_producto_terminado]
        });
    }

    // Ejecutar movimientos de stock (Detalles y Updates)
    if (queriesDetalles.length > 0) {
        const resultDetalles = await executeTransaction(queriesDetalles);
        if (!resultDetalles.success) throw new Error(resultDetalles.error);
    }

    // Notificar (Asumiendo que tienes esta función)
    if (typeof notificarCambioEstado === 'function') {
        await notificarCambioEstado(id, `Orden Cancelada: ${orden.numero_orden}`, 'La orden y sus movimientos han sido revertidos.', 'error', req);
    }

    res.json({ success: true, message: 'Orden cancelada y movimientos revertidos correctamente.' });

  } catch (error) {
    console.error('Error al anular orden:', error);
    res.status(500).json({ error: error.message });
  }
}