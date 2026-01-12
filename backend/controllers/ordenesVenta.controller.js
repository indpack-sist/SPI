import { executeQuery, executeTransaction } from '../config/database.js';
import { generarOrdenVentaPDF } from '../utils/pdfGenerators/ordenVentaPDF.js';

export async function getAllOrdenesVenta(req, res) {
  try {
    const { estado, prioridad, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
  SELECT 
    ov.id_orden_venta,
    ov.numero_orden,
    ov.fecha_emision,
    ov.fecha_entrega_estimada,
    ov.fecha_entrega_real,
    ov.estado,
    ov.prioridad,
    ov.subtotal,
    ov.igv,
    ov.total,
    ov.moneda,
    ov.monto_pagado,
    ov.estado_pago,
    ov.id_cotizacion,
    c.numero_cotizacion,
    cl.id_cliente,
    cl.razon_social AS cliente,
    cl.ruc AS ruc_cliente,
    e_comercial.nombre_completo AS comercial,
    e_registrado.nombre_completo AS registrado_por,
    ov.id_comercial,
    ov.id_registrado_por,
    (SELECT COUNT(*) FROM detalle_orden_venta WHERE id_orden_venta = ov.id_orden_venta) AS total_items
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
    console.error(error);
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
    
    const detalleResult = await executeQuery(`
      SELECT 
        dov.*,
        dov.subtotal AS valor_venta,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.requiere_receta,
        p.stock_actual AS stock_disponible,
        ti.nombre AS tipo_inventario_nombre,
        (SELECT COUNT(*) FROM ordenes_produccion WHERE id_orden_venta_origen = ? AND id_producto_terminado = dov.id_producto) AS tiene_op
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      LEFT JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE dov.id_orden_venta = ?
      ORDER BY dov.id_detalle
    `, [id, id]);
    
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
    console.error(error);
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
    
    const id_registrado_por = req.user?.id_empleado || null;
    
    if (!id_cliente || !detalle || detalle.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cliente y detalle son obligatorios'
      });
    }
    
    if (!id_registrado_por) {
      return res.status(400).json({
        success: false,
        error: 'Usuario no autenticado'
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
    let totalComision = 0;
    let sumaComisionPorcentual = 0;

    for (const item of detalle) {
      const precioBase = parseFloat(item.precio_base);
      const porcentajeComision = parseFloat(item.porcentaje_comision || 0);
      const montoComision = precioBase * (porcentajeComision / 100);
      const precioFinal = precioBase + montoComision;

      const valorVenta = (item.cantidad * precioFinal) * (1 - parseFloat(item.descuento_porcentaje || 0) / 100);
      subtotal += valorVenta;

      totalComision += montoComision * item.cantidad;
      sumaComisionPorcentual += porcentajeComision;
    }
    
    const porcentajeComisionPromedio = detalle.length > 0 ? sumaComisionPorcentual / detalle.length : 0;

    const tipoImpuestoFinal = tipo_impuesto || 'IGV';
    let porcentaje = 18.00;
    
    if (tipoImpuestoFinal === 'EXO' || tipoImpuestoFinal === 'INA') {
      porcentaje = 0.00;
    } else if (porcentaje_impuesto !== null && porcentaje_impuesto !== undefined) {
      porcentaje = parseFloat(porcentaje_impuesto);
    }
    
    const impuesto = subtotal * (porcentaje / 100);
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
        total_comision,
        porcentaje_comision_promedio,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En Espera')
    `, [
      numeroOrden,
      id_cliente,
      id_cotizacion || null,
      fecha_emision,
      fecha_entrega_estimada || null,
      prioridad || 'Media',
      moneda,
      parseFloat(tipo_cambio || 1.0000),
      tipoImpuestoFinal,
      porcentaje,
      plazo_pago,
      forma_pago,
      orden_compra_cliente,
      direccion_entrega,
      lugar_entrega,
      ciudad_entrega,
      contacto_entrega,
      telefono_entrega,
      observaciones,
      id_comercial || null,
      id_registrado_por,
      subtotal,
      impuesto,
      total,
      totalComision,
      porcentajeComisionPromedio
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    const idOrden = result.data.insertId;
    
    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      const precioBase = parseFloat(item.precio_base);
      const porcentajeComision = parseFloat(item.porcentaje_comision || 0);
      const montoComision = precioBase * (porcentajeComision / 100);
      const precioFinal = precioBase + montoComision;
      
      await executeQuery(`
        INSERT INTO detalle_orden_venta (
          id_orden_venta,
          id_producto,
          cantidad,
          precio_unitario,
          precio_base,
          porcentaje_comision,
          monto_comision,
          descuento_porcentaje
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        idOrden,
        item.id_producto,
        parseFloat(item.cantidad),
        precioFinal,
        precioBase,
        porcentajeComision,
        montoComision,
        parseFloat(item.descuento_porcentaje || 0)
      ]);
    }
    
    if (id_cotizacion) {
      await executeQuery(`
        UPDATE cotizaciones 
        SET estado = 'Convertida',
            convertida_venta = 1,
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

export async function crearOrdenProduccionDesdeVenta(req, res) {
  try {
    const { id } = req.params;
    const { id_producto, cantidad } = req.body;
    const id_usuario = req.user?.id_empleado || null;
    
    if (!id_usuario) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
    
    if (!id_producto || !cantidad || cantidad <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Producto y cantidad son requeridos'
      });
    }
    
    const ordenVentaResult = await executeQuery(`
      SELECT * FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenVentaResult.success || ordenVentaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const ordenVenta = ordenVentaResult.data[0];
    
    const productoResult = await executeQuery(`
      SELECT * FROM productos WHERE id_producto = ? AND requiere_receta = 1
    `, [id_producto]);
    
    if (!productoResult.success || productoResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado o no requiere producción'
      });
    }
    
    const yaExisteOPResult = await executeQuery(`
      SELECT * FROM ordenes_produccion 
      WHERE id_orden_venta_origen = ? 
      AND id_producto_terminado = ?
      AND estado != 'Cancelada'
    `, [id, id_producto]);
    
    if (yaExisteOPResult.success && yaExisteOPResult.data.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe una orden de producción para este producto en esta orden de venta'
      });
    }
    
    const ultimaOPResult = await executeQuery(`
      SELECT numero_orden 
      FROM ordenes_produccion 
      ORDER BY id_orden DESC 
      LIMIT 1
    `);
    
    let numeroSecuenciaOP = 1;
    if (ultimaOPResult.success && ultimaOPResult.data.length > 0) {
      const match = ultimaOPResult.data[0].numero_orden.match(/(\d+)$/);
      if (match) {
        numeroSecuenciaOP = parseInt(match[1]) + 1;
      }
    }
    
    const numeroOrdenProduccion = `OP-${new Date().getFullYear()}-${String(numeroSecuenciaOP).padStart(4, '0')}`;
    
    const opResult = await executeQuery(`
      INSERT INTO ordenes_produccion (
        numero_orden,
        id_producto_terminado,
        cantidad_planificada,
        id_supervisor,
        costo_materiales,
        estado,
        observaciones,
        id_orden_venta_origen,
        origen_tipo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      numeroOrdenProduccion,
      id_producto,
      cantidad,
      null,
      0,
      'Pendiente Asignación',
      `Generada desde Orden de Venta ${ordenVenta.numero_orden}`,
      id,
      'Orden de Venta'
    ]);
    
    if (!opResult.success) {
      return res.status(500).json({
        success: false,
        error: opResult.error
      });
    }
    
    const updateOVResult = await executeQuery(`
      UPDATE ordenes_venta 
      SET estado = 'En Espera'
      WHERE id_orden_venta = ?
    `, [id]);
    
    if (!updateOVResult.success) {
      return res.status(500).json({
        success: false,
        error: updateOVResult.error
      });
    }
    
    res.status(201).json({
      success: true,
      data: {
        id_orden_produccion: opResult.data.insertId,
        numero_orden_produccion: numeroOrdenProduccion,
        estado_orden_venta: 'En Espera'
      },
      message: 'Orden de producción creada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al crear orden de producción:', error);
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
    const id_usuario = req.user?.id_empleado || null;
    
    const estadosValidos = ['En Espera', 'En Proceso', 'Atendido por Producción', 'Despachada', 'Entregada', 'Cancelada'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }
    
    const ordenResult = await executeQuery(`
      SELECT ov.*, cl.razon_social AS cliente
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      WHERE ov.id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    const estadoAnterior = orden.estado;
    
    let idSalida = null;
    if (estado === 'Despachada' && estadoAnterior !== 'Despachada') {
      const detalleResult = await executeQuery(`
        SELECT 
          dov.id_producto,
          dov.cantidad,
          p.codigo AS codigo_producto,
          p.nombre AS producto,
          p.costo_unitario_promedio
        FROM detalle_orden_venta dov
        INNER JOIN productos p ON dov.id_producto = p.id_producto
        WHERE dov.id_orden_venta = ?
      `, [id]);
      
      if (detalleResult.success && detalleResult.data.length > 0) {
        const detalles = detalleResult.data;
        
        let totalCosto = 0;
        let totalPrecio = 0;
        
        for (const item of detalles) {
          const cantidad = parseFloat(item.cantidad);
          const costoUnitario = parseFloat(item.costo_unitario_promedio || 0);
          totalCosto += cantidad * costoUnitario;
          totalPrecio += parseFloat(orden.total);
        }
        
        const salidaResult = await executeQuery(`
          INSERT INTO salidas (
            id_tipo_inventario,
            tipo_movimiento,
            id_cliente,
            total_costo,
            total_precio,
            moneda,
            id_registrado_por,
            observaciones,
            estado
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          3,
          'Venta',
          orden.id_cliente,
          totalCosto,
          parseFloat(orden.total),
          orden.moneda || 'PEN',
          id_usuario,
          `Salida automática por despacho de ${orden.numero_orden}`,
          'Activo'
        ]);
        
        if (salidaResult.success) {
          idSalida = salidaResult.data.insertId;
          
          for (const item of detalles) {
            const stockCheck = await executeQuery(`
              SELECT stock_actual FROM productos WHERE id_producto = ?
            `, [item.id_producto]);
            
            const stockActual = parseFloat(stockCheck.data[0].stock_actual);
            const cantidadSalida = parseFloat(item.cantidad);
            
            if (stockActual < cantidadSalida) {
              return res.status(400).json({
                success: false,
                error: `Stock insuficiente para ${item.producto}. Disponible: ${stockActual}, Requerido: ${cantidadSalida}`
              });
            }
            
            await executeQuery(`
              INSERT INTO detalle_salidas (
                id_salida,
                id_producto,
                cantidad,
                costo_unitario,
                precio_unitario
              ) VALUES (?, ?, ?, ?, ?)
            `, [
              idSalida,
              item.id_producto,
              cantidadSalida,
              parseFloat(item.costo_unitario_promedio || 0),
              parseFloat(orden.subtotal) / detalles.length
            ]);
            
            await executeQuery(`
              UPDATE productos 
              SET stock_actual = stock_actual - ? 
              WHERE id_producto = ?
            `, [cantidadSalida, item.id_producto]);
          }
        }
      }
    }
    
    const updateResult = await executeQuery(`
      UPDATE ordenes_venta 
      SET estado = ?,
          fecha_entrega_real = ?,
          id_salida = ?
      WHERE id_orden_venta = ?
    `, [estado, fecha_entrega_real || null, idSalida, id]);
    
    if (!updateResult.success) {
      return res.status(500).json({ 
        success: false,
        error: updateResult.error 
      });
    }
    
    res.json({
      success: true,
      message: estado === 'Despachada' && idSalida
        ? `Estado actualizado a ${estado}. Salida de inventario #${idSalida} generada automáticamente.`
        : `Estado actualizado a ${estado}`,
      data: {
        id_salida: idSalida
      }
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
        error: 'Prioridad no válida. Debe ser: Baja, Media, Alta o Urgente'
      });
    }
    
    const ordenCheck = await executeQuery(`
      SELECT id_orden_venta FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenCheck.success || ordenCheck.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
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
      message: `Prioridad actualizada a ${prioridad}`,
      data: {
        prioridad
      }
    });
    
  } catch (error) {
    console.error('Error al actualizar prioridad:', error);
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
        SUM(CASE WHEN estado = 'En Espera' THEN 1 ELSE 0 END) AS en_espera,
        SUM(CASE WHEN estado = 'En Proceso' THEN 1 ELSE 0 END) AS en_proceso,
        SUM(CASE WHEN estado = 'Atendido por Producción' THEN 1 ELSE 0 END) AS atendidas,
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
    
    const pdfBuffer = await generarOrdenVentaPDF(orden);
    
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

export async function registrarPagoOrden(req, res) {
  try {
    const { id } = req.params;
    const {
      fecha_pago,
      monto_pagado,
      metodo_pago,
      numero_operacion,
      banco,
      observaciones
    } = req.body;
    
    const id_registrado_por = req.user?.id_empleado || null;
    
    if (!id_registrado_por) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
    
    if (!fecha_pago || !monto_pagado || monto_pagado <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Fecha de pago y monto son obligatorios'
      });
    }
    
    const ordenResult = await executeQuery(`
      SELECT * FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    const totalOrden = parseFloat(orden.total);
    const montoPagadoActual = parseFloat(orden.monto_pagado || 0);
    const montoNuevoPago = parseFloat(monto_pagado);
    
    if (montoPagadoActual + montoNuevoPago > totalOrden) {
      return res.status(400).json({
        success: false,
        error: `El monto a pagar (${montoNuevoPago}) excede el saldo pendiente (${totalOrden - montoPagadoActual})`
      });
    }
    
    const ultimoPagoResult = await executeQuery(`
      SELECT numero_pago 
      FROM pagos_ordenes_venta 
      WHERE id_orden_venta = ?
      ORDER BY id_pago_orden DESC 
      LIMIT 1
    `, [id]);
    
    let numeroSecuencia = 1;
    if (ultimoPagoResult.success && ultimoPagoResult.data.length > 0) {
      const match = ultimoPagoResult.data[0].numero_pago.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const numeroPago = `${orden.numero_orden}-P${String(numeroSecuencia).padStart(2, '0')}`;
    
    const pagoResult = await executeQuery(`
      INSERT INTO pagos_ordenes_venta (
        id_orden_venta,
        numero_pago,
        fecha_pago,
        monto_pagado,
        metodo_pago,
        numero_operacion,
        banco,
        observaciones,
        id_registrado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      numeroPago,
      fecha_pago,
      montoNuevoPago,
      metodo_pago || 'Transferencia',
      numero_operacion || null,
      banco || null,
      observaciones || null,
      id_registrado_por
    ]);
    
    if (!pagoResult.success) {
      return res.status(500).json({
        success: false,
        error: pagoResult.error
      });
    }
    
    const nuevoMontoPagado = montoPagadoActual + montoNuevoPago;
    let estadoPago = 'Parcial';
    
    if (nuevoMontoPagado >= totalOrden) {
      estadoPago = 'Pagado';
    } else if (nuevoMontoPagado === 0) {
      estadoPago = 'Pendiente';
    }
    
    await executeQuery(`
      UPDATE ordenes_venta 
      SET monto_pagado = ?,
          estado_pago = ?
      WHERE id_orden_venta = ?
    `, [nuevoMontoPagado, estadoPago, id]);
    
    res.status(201).json({
      success: true,
      data: {
        id_pago_orden: pagoResult.data.insertId,
        numero_pago: numeroPago,
        monto_pagado: montoNuevoPago,
        nuevo_monto_total_pagado: nuevoMontoPagado,
        saldo_pendiente: totalOrden - nuevoMontoPagado,
        estado_pago: estadoPago
      },
      message: 'Pago registrado exitosamente'
    });
    
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getPagosOrden(req, res) {
  try {
    const { id } = req.params;
    
    const ordenCheck = await executeQuery(`
      SELECT id_orden_venta FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenCheck.success || ordenCheck.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const result = await executeQuery(`
      SELECT 
        p.*,
        e.nombre_completo AS registrado_por
      FROM pagos_ordenes_venta p
      LEFT JOIN empleados e ON p.id_registrado_por = e.id_empleado
      WHERE p.id_orden_venta = ?
      ORDER BY p.fecha_pago DESC, p.id_pago_orden DESC
    `, [id]);
    
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
    console.error('Error al obtener pagos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function anularPagoOrden(req, res) {
  try {
    const { id, idPago } = req.params;
    const id_usuario = req.user?.id_empleado || null;
    
    if (!id_usuario) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
    
    const pagoResult = await executeQuery(`
      SELECT * FROM pagos_ordenes_venta 
      WHERE id_pago_orden = ? AND id_orden_venta = ?
    `, [idPago, id]);
    
    if (!pagoResult.success || pagoResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado'
      });
    }
    
    const pago = pagoResult.data[0];
    const montoPago = parseFloat(pago.monto_pagado);
    
    const ordenResult = await executeQuery(`
      SELECT * FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    const montoPagadoActual = parseFloat(orden.monto_pagado || 0);
    const totalOrden = parseFloat(orden.total);
    
    await executeQuery(`
      DELETE FROM pagos_ordenes_venta WHERE id_pago_orden = ?
    `, [idPago]);
    
    const nuevoMontoPagado = montoPagadoActual - montoPago;
    let estadoPago = 'Parcial';
    
    if (nuevoMontoPagado >= totalOrden) {
      estadoPago = 'Pagado';
    } else if (nuevoMontoPagado === 0) {
      estadoPago = 'Pendiente';
    }
    
    await executeQuery(`
      UPDATE ordenes_venta 
      SET monto_pagado = ?,
          estado_pago = ?
      WHERE id_orden_venta = ?
    `, [nuevoMontoPagado, estadoPago, id]);
    
    res.json({
      success: true,
      data: {
        monto_anulado: montoPago,
        nuevo_monto_total_pagado: nuevoMontoPagado,
        saldo_pendiente: totalOrden - nuevoMontoPagado,
        estado_pago: estadoPago
      },
      message: 'Pago anulado exitosamente'
    });
    
  } catch (error) {
    console.error('Error al anular pago:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getResumenPagosOrden(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(`
      SELECT 
        numero_orden,
        total,
        monto_pagado,
        estado_pago,
        moneda
      FROM ordenes_venta 
      WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    const totalOrden = parseFloat(orden.total);
    const montoPagado = parseFloat(orden.monto_pagado || 0);
    
    const pagosResult = await executeQuery(`
      SELECT COUNT(*) as total_pagos
      FROM pagos_ordenes_venta
      WHERE id_orden_venta = ?
    `, [id]);
    
    res.json({
      success: true,
      data: {
        numero_orden: orden.numero_orden,
        total_orden: totalOrden,
        monto_pagado: montoPagado,
        saldo_pendiente: totalOrden - montoPagado,
        porcentaje_pagado: totalOrden > 0 ? ((montoPagado / totalOrden) * 100).toFixed(2) : 0,
        estado_pago: orden.estado_pago,
        moneda: orden.moneda,
        total_pagos: pagosResult.data[0].total_pagos
      }
    });
    
  } catch (error) {
    console.error('Error al obtener resumen de pagos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}