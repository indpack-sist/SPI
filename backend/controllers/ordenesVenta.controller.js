import { executeQuery } from '../config/database.js';

export async function getAllOrdenesVenta(req, res) {
  try {
    const { estado, prioridad, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        ov.id_orden_venta,
        ov.numero_orden,
        ov.fecha_emision,
        ov.fecha_entrega_estimada,
        ov.estado,
        ov.prioridad,
        ov.subtotal,
        ov.igv,
        ov.total,
        ov.moneda,
        ov.id_cotizacion,
        c.numero_cotizacion,
        cl.id_cliente,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        e_comercial.nombre_completo AS comercial,
        e_registrado.nombre_completo AS registrado_por,
        ov.id_comercial,
        ov.id_registrado_por
      FROM ordenes_venta ov
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e_comercial ON ov.id_comercial = e_comercial.id_empleado
      LEFT JOIN empleados e_registrado ON ov.id_registrado_por = e_registrado.id_empleado
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      sql += ` AND ov.estado = ?`;
      params.push(estado);
    }
    
    if (prioridad) {
      sql += ` AND ov.prioridad = ?`;
      params.push(prioridad);
    }
    
    if (fecha_inicio) {
      sql += ` AND DATE(ov.fecha_emision) >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND DATE(ov.fecha_emision) <= ?`;
      params.push(fecha_fin);
    }
    
    sql += ` ORDER BY ov.fecha_emision DESC, ov.id_orden_venta DESC`;
    
    const result = await executeQuery(sql, params);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.json({
      success: true,
      data: result.data
    });
    
  } catch (error) {
    console.error('Error al obtener órdenes de venta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getOrdenVentaById(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(`
      SELECT 
        ov.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        cl.telefono AS telefono_cliente,
        e.nombre_completo AS comercial,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      WHERE ov.id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success) {
      return res.status(500).json({ 
        success: false,
        error: ordenResult.error 
      });
    }
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    // ✅ CORRECCIÓN: Usar p.stock_actual directamente
    const detalleResult = await executeQuery(`
      SELECT 
        dov.*,
        dov.subtotal AS valor_venta,  // ← AGREGAR ALIAS
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.requiere_receta,
        p.stock_actual AS stock_disponible,
        ti.nombre AS tipo_inventario_nombre
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      LEFT JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE dov.id_orden_venta = ?
      ORDER BY dov.id_detalle
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false,
        error: detalleResult.error 
      });
    }
    
    orden.detalle = detalleResult.data;
    
    res.json({
      success: true,
      data: orden
    });
    
  } catch (error) {
    console.error('Error al obtener orden de venta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
export async function createOrdenVenta(req, res) {
  try {
    const {
      id_cliente,
      id_cotizacion,
      fecha_emision,
      fecha_entrega_estimada,
      prioridad,
      moneda,
      tipo_cambio,
      tipo_impuesto,
      porcentaje_impuesto,
      plazo_pago,
      forma_pago,
      orden_compra_cliente,
      direccion_entrega,
      lugar_entrega,
      ciudad_entrega,
      contacto_entrega,
      telefono_entrega,
      observaciones,
      id_comercial,
      detalle
    } = req.body;
    
    let id_registrado_por = null;
    
    if (id_comercial) {
      id_registrado_por = id_comercial;
    } else if (req.user?.id_empleado) {
      id_registrado_por = req.user.id_empleado;
    }
    
    if (!id_cliente || !detalle || detalle.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cliente y detalle son obligatorios'
      });
    }
    
    if (!id_registrado_por) {
      return res.status(400).json({
        success: false,
        error: 'Debe especificar un vendedor/comercial para la orden'
      });
    }
    
    const ultimaResult = await executeQuery(`
      SELECT numero_orden 
      FROM ordenes_venta 
      ORDER BY id_orden_venta DESC 
      LIMIT 1
    `);
    
    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_orden.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const numeroOrden = `OV-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;
    
    let subtotal = 0;
    for (const item of detalle) {
      const valorVenta = parseFloat(item.cantidad) * parseFloat(item.precio_unitario);
      const descuentoItem = valorVenta * (parseFloat(item.descuento_porcentaje || 0) / 100);
      subtotal += valorVenta - descuentoItem;
    }
    
    const porcentaje_imp = parseFloat(porcentaje_impuesto || 18);
    const impuesto = subtotal * (porcentaje_imp / 100);
    const total = subtotal + impuesto;
    
    const result = await executeQuery(`
      INSERT INTO ordenes_venta (
        numero_orden,
        id_cliente,
        id_cotizacion,
        fecha_emision,
        fecha_entrega_estimada,
        prioridad,
        moneda,
        tipo_cambio,
        tipo_impuesto,
        porcentaje_impuesto,
        plazo_pago,
        forma_pago,
        orden_compra_cliente,
        direccion_entrega,
        lugar_entrega,
        ciudad_entrega,
        contacto_entrega,
        telefono_entrega,
        observaciones,
        id_comercial,
        id_registrado_por,
        subtotal,
        igv,
        total,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
    `, [
      numeroOrden,
      id_cliente,
      id_cotizacion || null,
      fecha_emision,
      fecha_entrega_estimada || null,
      prioridad || 'Media',
      moneda,
      parseFloat(tipo_cambio || 1.0000),
      tipo_impuesto || 'IGV',
      porcentaje_imp,
      plazo_pago,
      forma_pago,
      orden_compra_cliente,
      direccion_entrega,
      lugar_entrega,
      ciudad_entrega,
      contacto_entrega,
      telefono_entrega,
      observaciones,
      id_comercial || id_registrado_por,
      id_registrado_por,
      subtotal,
      impuesto,
      total
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    const idOrden = result.data.insertId;
    
    // ✅ CORRECCIÓN: Quitar valor_venta y orden
    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      
      await executeQuery(`
        INSERT INTO detalle_orden_venta (
          id_orden_venta,
          id_producto,
          cantidad,
          precio_unitario,
          descuento_porcentaje
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        idOrden,
        item.id_producto,
        parseFloat(item.cantidad),
        parseFloat(item.precio_unitario),
        parseFloat(item.descuento_porcentaje || 0)
      ]);
      
      // MySQL calcula automáticamente:
      // subtotal = cantidad * precio_unitario * (1 - descuento_porcentaje/100)
      // margen = (precio_unitario - costo_unitario) * cantidad
    }
    
    if (id_cotizacion) {
      await executeQuery(`
        UPDATE cotizaciones 
        SET estado = 'Convertida',
            id_orden_venta = ?
        WHERE id_cotizacion = ?
      `, [idOrden, id_cotizacion]);
    }
    
    res.status(201).json({
      success: true,
      data: {
        id_orden_venta: idOrden,
        numero_orden: numeroOrden
      },
      message: 'Orden de venta creada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al crear orden de venta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function actualizarEstadoOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { estado, fecha_entrega_real } = req.body;
    
    const estadosValidos = ['Pendiente', 'Confirmada', 'En Preparación', 'Despachada', 'Entregada', 'Cancelada'];

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }
    
    if (estado === 'Entregada') {
      const detalleResult = await executeQuery(`
        SELECT * FROM detalle_orden_venta WHERE id_orden_venta = ?
      `, [id]);
      
      const pendientes = detalleResult.data.filter(d => 
        parseFloat(d.cantidad_despachada) < parseFloat(d.cantidad)
      );
      
      if (pendientes.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'No se puede marcar como entregada. Hay productos pendientes de despacho.'
        });
      }
    }
    
    const result = await executeQuery(`
      UPDATE ordenes_venta 
      SET estado = ?,
          fecha_entrega_real = ?
      WHERE id_orden_venta = ?
    `, [estado, fecha_entrega_real || null, id]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.json({
      success: true,
      message: 'Estado actualizado exitosamente'
    });
    
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function actualizarPrioridadOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { prioridad } = req.body;
    
    const prioridadesValidas = ['Baja', 'Media', 'Alta', 'Urgente'];
    
    if (!prioridadesValidas.includes(prioridad)) {
      return res.status(400).json({
        success: false,
        error: 'Prioridad no válida'
      });
    }
    
    const result = await executeQuery(`
      UPDATE ordenes_venta 
      SET prioridad = ? 
      WHERE id_orden_venta = ?
    `, [prioridad, id]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.json({
      success: true,
      message: 'Prioridad actualizada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al actualizar prioridad:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function actualizarProgresoOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { detalle } = req.body;
    
    // Actualizar cada línea del detalle
    for (const item of detalle) {
      await executeQuery(`
        UPDATE detalle_orden_venta 
        SET cantidad_producida = ?,
            cantidad_despachada = ?
        WHERE id_detalle = ?
      `, [
        item.cantidad_producida || 0,
        item.cantidad_despachada || 0,
        item.id_detalle
      ]);
    }
    
    res.json({
      success: true,
      message: 'Progreso actualizado exitosamente'
    });
    
  } catch (error) {
    console.error('Error al actualizar progreso:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getEstadisticasOrdenesVenta(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_ordenes,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'En Proceso' THEN 1 ELSE 0 END) AS en_proceso,
        SUM(CASE WHEN estado = 'Despachada' THEN 1 ELSE 0 END) AS despachadas,
        SUM(CASE WHEN estado = 'Entregada' THEN 1 ELSE 0 END) AS entregadas,
        SUM(CASE WHEN prioridad = 'Urgente' THEN 1 ELSE 0 END) AS urgentes,
        SUM(total) AS monto_total,
        COUNT(DISTINCT id_cliente) AS clientes_unicos
      FROM ordenes_venta
      WHERE estado != 'Cancelada'
    `);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
    
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function descargarPDFOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    
    // Obtener orden con detalle
    const ordenResult = await executeQuery(`
      SELECT 
        ov.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        cl.telefono AS telefono_cliente,
        e_comercial.nombre_completo AS comercial,
        e_comercial.email AS email_comercial,
        e_registrado.nombre_completo AS registrado_por,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e_comercial ON ov.id_comercial = e_comercial.id_empleado
      LEFT JOIN empleados e_registrado ON ov.id_registrado_por = e_registrado.id_empleado
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      WHERE ov.id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    // Obtener detalle
    const detalleResult = await executeQuery(`
      SELECT 
        dov.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      WHERE dov.id_orden_venta = ?
      ORDER BY dov.id_detalle
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener detalle de la orden'
      });
    }
    
    orden.detalle = detalleResult.data;
    
    // Generar PDF
    const pdfBuffer = await generarOrdenVentaPDF(orden);
    
    // Enviar PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="OrdenVenta-${orden.numero_orden}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error al generar PDF de orden de venta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}