import { executeQuery, executeTransaction } from '../config/database.js';
import { generarOrdenCompraPDF } from '../utils/pdfGenerators/ordenCompraPDF.js';

export async function getAllOrdenesCompra(req, res) {
  try {
    const { estado, prioridad, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        oc.id_orden_compra,
        oc.numero_orden,
        oc.fecha_emision,
        oc.fecha_entrega_estimada,
        oc.fecha_entrega_real,
        oc.fecha_vencimiento,
        oc.tipo_compra,
        oc.dias_credito,
        oc.estado,
        oc.prioridad,
        oc.subtotal,
        oc.igv,
        oc.total,
        oc.moneda,
        oc.monto_pagado,
        oc.estado_pago,
        oc.id_cuenta_bancaria,
        cb.numero_cuenta AS numero_cuenta_bancaria,
        cb.banco AS banco_empresa,
        pr.id_proveedor,
        pr.razon_social AS proveedor,
        pr.ruc AS ruc_proveedor,
        e_responsable.nombre_completo AS responsable,
        e_registrado.nombre_completo AS registrado_por,
        oc.id_responsable,
        oc.id_registrado_por,
        (SELECT COUNT(*) FROM detalle_orden_compra WHERE id_orden_compra = oc.id_orden_compra) AS total_items
      FROM ordenes_compra oc
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      LEFT JOIN cuentas_bancarias cb ON oc.id_cuenta_bancaria = cb.id_cuenta_bancaria
      LEFT JOIN empleados e_responsable ON oc.id_responsable = e_responsable.id_empleado
      LEFT JOIN empleados e_registrado ON oc.id_registrado_por = e_registrado.id_empleado
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      sql += ` AND oc.estado = ?`;
      params.push(estado);
    }
    
    if (prioridad) {
      sql += ` AND oc.prioridad = ?`;
      params.push(prioridad);
    }
    
    if (fecha_inicio) {
      sql += ` AND DATE(oc.fecha_emision) >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND DATE(oc.fecha_emision) <= ?`;
      params.push(fecha_fin);
    }
    
    sql += ` ORDER BY oc.fecha_emision DESC, oc.id_orden_compra DESC`;
    
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

export async function getOrdenCompraById(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(`
      SELECT 
        oc.*,
        pr.razon_social AS proveedor,
        pr.ruc AS ruc_proveedor,
        pr.direccion AS direccion_proveedor,
        pr.telefono AS telefono_proveedor,
        pr.email AS email_proveedor,
        e.nombre_completo AS responsable,
        cb.banco AS banco_empresa,
        cb.numero_cuenta AS numero_cuenta_empresa,
        cb.moneda AS moneda_cuenta
      FROM ordenes_compra oc
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      LEFT JOIN empleados e ON oc.id_responsable = e.id_empleado
      LEFT JOIN cuentas_bancarias cb ON oc.id_cuenta_bancaria = cb.id_cuenta_bancaria
      WHERE oc.id_orden_compra = ?
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
        error: 'Orden de compra no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    const detalleResult = await executeQuery(`
      SELECT 
        doc.*,
        doc.subtotal AS valor_compra,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.stock_actual AS stock_disponible,
        ti.nombre AS tipo_inventario_nombre
      FROM detalle_orden_compra doc
      INNER JOIN productos p ON doc.id_producto = p.id_producto
      LEFT JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE doc.id_orden_compra = ?
      ORDER BY doc.id_detalle
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function createOrdenCompra(req, res) {
  try {
    const {
      id_proveedor,
      id_cuenta_bancaria,
      fecha_emision,
      fecha_entrega_estimada,
      fecha_vencimiento,
      prioridad,
      moneda,
      tipo_cambio,
      tipo_impuesto,
      porcentaje_impuesto,
      tipo_compra,
      dias_credito,
      plazo_pago,
      forma_pago,
      direccion_entrega,
      lugar_entrega,
      contacto_proveedor,
      observaciones,
      id_responsable,
      detalle
    } = req.body;
    
    const id_registrado_por = req.user?.id_empleado || null;
    
    if (!id_proveedor || !detalle || detalle.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Proveedor y detalle son obligatorios'
      });
    }
    
    if (!id_registrado_por) {
      return res.status(400).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
    
    let subtotal = 0;

    for (const item of detalle) {
      const precioUnitario = parseFloat(item.precio_unitario);
      const valorCompra = (item.cantidad * precioUnitario) * (1 - parseFloat(item.descuento_porcentaje || 0) / 100);
      subtotal += valorCompra;
    }
    
    const tipoImpuestoFinal = tipo_impuesto || 'IGV';
    let porcentaje = 18.00;
    
    if (tipoImpuestoFinal === 'EXO' || tipoImpuestoFinal === 'INA') {
      porcentaje = 0.00;
    } else if (porcentaje_impuesto !== null && porcentaje_impuesto !== undefined) {
      porcentaje = parseFloat(porcentaje_impuesto);
    }
    
    const impuesto = subtotal * (porcentaje / 100);
    const total = subtotal + impuesto;
    
    const ultimaResult = await executeQuery(`
      SELECT numero_orden 
      FROM ordenes_compra 
      ORDER BY id_orden_compra DESC 
      LIMIT 1
    `);
    
    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_orden.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const numeroOrden = `OC-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;
    
    let fechaVencimientoFinal = fecha_vencimiento;
    if (!fechaVencimientoFinal) {
      const fechaBase = new Date(fecha_emision);
      fechaBase.setDate(fechaBase.getDate() + (parseInt(dias_credito) || 0));
      fechaVencimientoFinal = fechaBase.toISOString().split('T')[0];
    }
    
    const result = await executeQuery(`
      INSERT INTO ordenes_compra (
        numero_orden,
        id_proveedor,
        id_cuenta_bancaria,
        fecha_emision,
        fecha_entrega_estimada,
        fecha_vencimiento,
        prioridad,
        moneda,
        tipo_cambio,
        tipo_impuesto,
        porcentaje_impuesto,
        tipo_compra,
        dias_credito,
        plazo_pago,
        forma_pago,
        direccion_entrega,
        lugar_entrega,
        contacto_proveedor,
        observaciones,
        id_responsable,
        id_registrado_por,
        subtotal,
        igv,
        total,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En Espera')
    `, [
      numeroOrden,
      id_proveedor,
      id_cuenta_bancaria || null,
      fecha_emision,
      fecha_entrega_estimada || null,
      fechaVencimientoFinal,
      prioridad || 'Media',
      moneda,
      parseFloat(tipo_cambio || 1.0000),
      tipoImpuestoFinal,
      porcentaje,
      tipo_compra || 'Contado',
      parseInt(dias_credito || 0),
      plazo_pago,
      forma_pago,
      direccion_entrega,
      lugar_entrega,
      contacto_proveedor,
      observaciones,
      id_responsable || null,
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
    
    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      const precioUnitario = parseFloat(item.precio_unitario);
      const descuento = parseFloat(item.descuento_porcentaje || 0);
      const subtotalItem = (item.cantidad * precioUnitario) * (1 - descuento / 100);
      
      await executeQuery(`
        INSERT INTO detalle_orden_compra (
          id_orden_compra,
          id_producto,
          cantidad,
          precio_unitario,
          descuento_porcentaje,
          subtotal
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        idOrden,
        item.id_producto,
        parseFloat(item.cantidad),
        precioUnitario,
        descuento,
        subtotalItem
      ]);
    }
    
    res.status(201).json({
      success: true,
      data: {
        id_orden_compra: idOrden,
        numero_orden: numeroOrden
      },
      message: 'Orden de compra creada exitosamente'
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function updateOrdenCompra(req, res) {
  try {
    const { id } = req.params;
    const {
      id_proveedor,
      id_cuenta_bancaria,
      fecha_emision,
      fecha_entrega_estimada,
      fecha_vencimiento,
      prioridad,
      moneda,
      tipo_cambio,
      tipo_impuesto,
      porcentaje_impuesto,
      tipo_compra,
      dias_credito,
      plazo_pago,
      forma_pago,
      direccion_entrega,
      lugar_entrega,
      contacto_proveedor,
      observaciones,
      id_responsable,
      detalle
    } = req.body;

    const ordenExistente = await executeQuery(`
      SELECT estado FROM ordenes_compra WHERE id_orden_compra = ?
    `, [id]);

    if (!ordenExistente.success || ordenExistente.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden de compra no encontrada' });
    }

    if (ordenExistente.data[0].estado !== 'En Espera') {
      return res.status(400).json({ success: false, error: 'Solo se pueden editar órdenes en estado En Espera' });
    }

    if (!id_proveedor || !detalle || detalle.length === 0) {
      return res.status(400).json({ success: false, error: 'Proveedor y detalle son obligatorios' });
    }

    let subtotal = 0;

    for (const item of detalle) {
      const precioUnitario = parseFloat(item.precio_unitario);
      const valorCompra = (item.cantidad * precioUnitario) * (1 - parseFloat(item.descuento_porcentaje || 0) / 100);
      subtotal += valorCompra;
    }

    const tipoImpuestoFinal = tipo_impuesto || 'IGV';
    let porcentaje = 18.00;
    if (tipoImpuestoFinal === 'EXO' || tipoImpuestoFinal === 'INA') porcentaje = 0.00;
    else if (porcentaje_impuesto !== undefined) porcentaje = parseFloat(porcentaje_impuesto);

    const impuesto = subtotal * (porcentaje / 100);
    const total = subtotal + impuesto;

    let fechaVencimientoFinal = fecha_vencimiento;
    if (!fechaVencimientoFinal) {
        const fechaBase = new Date(fecha_emision);
        fechaBase.setDate(fechaBase.getDate() + (parseInt(dias_credito) || 0));
        fechaVencimientoFinal = fechaBase.toISOString().split('T')[0];
    }

    const updateResult = await executeQuery(`
      UPDATE ordenes_compra 
      SET 
        id_proveedor = ?,
        id_cuenta_bancaria = ?,
        fecha_emision = ?,
        fecha_entrega_estimada = ?,
        fecha_vencimiento = ?,
        prioridad = ?,
        moneda = ?,
        tipo_cambio = ?,
        tipo_impuesto = ?,
        porcentaje_impuesto = ?,
        tipo_compra = ?,
        dias_credito = ?,
        plazo_pago = ?,
        forma_pago = ?,
        direccion_entrega = ?,
        lugar_entrega = ?,
        contacto_proveedor = ?,
        observaciones = ?,
        id_responsable = ?,
        subtotal = ?,
        igv = ?,
        total = ?
      WHERE id_orden_compra = ?
    `, [
      id_proveedor,
      id_cuenta_bancaria || null,
      fecha_emision,
      fecha_entrega_estimada || null,
      fechaVencimientoFinal,
      prioridad || 'Media',
      moneda,
      parseFloat(tipo_cambio || 1.0000),
      tipoImpuestoFinal,
      porcentaje,
      tipo_compra || 'Contado',
      parseInt(dias_credito || 0),
      plazo_pago,
      forma_pago,
      direccion_entrega,
      lugar_entrega,
      contacto_proveedor,
      observaciones,
      id_responsable || null,
      subtotal,
      impuesto,
      total,
      id
    ]);

    if (!updateResult.success) {
      return res.status(500).json({ success: false, error: updateResult.error });
    }

    await executeQuery('DELETE FROM detalle_orden_compra WHERE id_orden_compra = ?', [id]);

    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      const precioUnitario = parseFloat(item.precio_unitario);
      const descuento = parseFloat(item.descuento_porcentaje || 0);
      const subtotalItem = (item.cantidad * precioUnitario) * (1 - descuento / 100);

      await executeQuery(`
        INSERT INTO detalle_orden_compra (
          id_orden_compra,
          id_producto,
          cantidad,
          precio_unitario,
          descuento_porcentaje,
          subtotal
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        id,
        item.id_producto,
        parseFloat(item.cantidad),
        precioUnitario,
        descuento,
        subtotalItem
      ]);
    }

    res.json({ success: true, message: 'Orden de compra actualizada exitosamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function actualizarEstadoOrdenCompra(req, res) {
  try {
    const { id } = req.params;
    const { estado, fecha_entrega_real } = req.body;
    const id_usuario = req.user?.id_empleado || null;
    
    const estadosValidos = ['En Espera', 'En Proceso', 'Recibida', 'Cancelada'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }
    
    const ordenResult = await executeQuery(`
      SELECT oc.*, pr.razon_social AS proveedor
      FROM ordenes_compra oc
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      WHERE oc.id_orden_compra = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de compra no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    const estadoAnterior = orden.estado;
    
    let idIngreso = null;
    if (estado === 'Recibida' && estadoAnterior !== 'Recibida') {
      const detalleResult = await executeQuery(`
        SELECT 
          doc.id_producto,
          doc.cantidad,
          doc.precio_unitario,
          doc.subtotal,
          p.codigo AS codigo_producto,
          p.nombre AS producto
        FROM detalle_orden_compra doc
        INNER JOIN productos p ON doc.id_producto = p.id_producto
        WHERE doc.id_orden_compra = ?
      `, [id]);
      
      if (detalleResult.success && detalleResult.data.length > 0) {
        const detalles = detalleResult.data;
        
        const ingresoResult = await executeQuery(`
          INSERT INTO ingresos (
            id_tipo_inventario,
            tipo_movimiento,
            id_proveedor,
            total_costo,
            moneda,
            id_registrado_por,
            observaciones,
            estado
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          3,
          'Compra',
          orden.id_proveedor,
          parseFloat(orden.subtotal),
          orden.moneda || 'PEN',
          id_usuario,
          `Ingreso automático por recepción de ${orden.numero_orden}`,
          'Activo'
        ]);
        
        if (ingresoResult.success) {
          idIngreso = ingresoResult.data.insertId;
          
          for (const item of detalles) {
            const cantidadIngreso = parseFloat(item.cantidad);
            const costoUnitario = parseFloat(item.precio_unitario);
            
            await executeQuery(`
              INSERT INTO detalle_ingresos (
                id_ingreso,
                id_producto,
                cantidad,
                costo_unitario,
                total
              ) VALUES (?, ?, ?, ?, ?)
            `, [
              idIngreso,
              item.id_producto,
              cantidadIngreso,
              costoUnitario,
              parseFloat(item.subtotal)
            ]);
            
            await executeQuery(`
              UPDATE productos 
              SET stock_actual = stock_actual + ? 
              WHERE id_producto = ?
            `, [cantidadIngreso, item.id_producto]);
          }
        }
      }
    }
    
    const updateResult = await executeQuery(`
      UPDATE ordenes_compra 
      SET estado = ?,
          fecha_entrega_real = ?,
          id_ingreso = ?
      WHERE id_orden_compra = ?
    `, [estado, fecha_entrega_real || null, idIngreso, id]);
    
    if (!updateResult.success) {
      return res.status(500).json({ 
        success: false,
        error: updateResult.error 
      });
    }
    
    res.json({
      success: true,
      message: estado === 'Recibida' && idIngreso
        ? `Estado actualizado a ${estado}. Ingreso de inventario #${idIngreso} generado automáticamente.`
        : `Estado actualizado a ${estado}`,
      data: {
        id_ingreso: idIngreso
      }
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function actualizarPrioridadOrdenCompra(req, res) {
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
      SELECT id_orden_compra FROM ordenes_compra WHERE id_orden_compra = ?
    `, [id]);
    
    if (!ordenCheck.success || ordenCheck.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de compra no encontrada'
      });
    }
    
    const result = await executeQuery(`
      UPDATE ordenes_compra 
      SET prioridad = ?
      WHERE id_orden_compra = ?
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getEstadisticasOrdenesCompra(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_ordenes,
        SUM(CASE WHEN estado = 'En Espera' THEN 1 ELSE 0 END) AS en_espera,
        SUM(CASE WHEN estado = 'En Proceso' THEN 1 ELSE 0 END) AS en_proceso,
        SUM(CASE WHEN estado = 'Recibida' THEN 1 ELSE 0 END) AS recibidas,
        SUM(CASE WHEN prioridad = 'Urgente' THEN 1 ELSE 0 END) AS urgentes,
        SUM(total) AS monto_total,
        COUNT(DISTINCT id_proveedor) AS proveedores_unicos
      FROM ordenes_compra
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function descargarPDFOrdenCompra(req, res) {
  try {
    const { id } = req.params;

    const ordenResult = await executeQuery(`
      SELECT 
        oc.*,
        pr.razon_social AS proveedor,
        pr.ruc AS ruc_proveedor,
        pr.direccion AS direccion_proveedor,
        pr.telefono AS telefono_proveedor,
        pr.email AS email_proveedor,
        e_responsable.nombre_completo AS responsable,
        e_responsable.email AS email_responsable,
        e_registrado.nombre_completo AS registrado_por,
        cb.banco AS banco_empresa,
        cb.numero_cuenta AS numero_cuenta_empresa
      FROM ordenes_compra oc
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      LEFT JOIN empleados e_responsable ON oc.id_responsable = e_responsable.id_empleado
      LEFT JOIN empleados e_registrado ON oc.id_registrado_por = e_registrado.id_registrado_por
      LEFT JOIN cuentas_bancarias cb ON oc.id_cuenta_bancaria = cb.id_cuenta_bancaria
      WHERE oc.id_orden_compra = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de compra no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    const detalleResult = await executeQuery(`
      SELECT 
        doc.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_orden_compra doc
      INNER JOIN productos p ON doc.id_producto = p.id_producto
      WHERE doc.id_orden_compra = ?
      ORDER BY doc.id_detalle
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener detalle de la orden'
      });
    }
    
    orden.detalle = detalleResult.data;
    
    const pdfBuffer = await generarOrdenCompraPDF(orden);
    const filename = `OrdenCompra-${orden.numero_orden}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function registrarPagoOrdenCompra(req, res) {
  try {
    const { id } = req.params;
    const {
      fecha_pago,
      monto_pagado,
      metodo_pago,
      numero_operacion,
      banco_destino,
      observaciones,
      id_cuenta_bancaria_origen
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
      SELECT * FROM ordenes_compra WHERE id_orden_compra = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de compra no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    const totalOrden = parseFloat(orden.total);
    const montoPagadoActual = parseFloat(orden.monto_pagado || 0);
    const montoNuevoPago = parseFloat(monto_pagado);
    
    if (montoPagadoActual + montoNuevoPago > totalOrden + 0.1) {
      return res.status(400).json({
        success: false,
        error: `El monto a pagar (${montoNuevoPago}) excede el saldo pendiente (${totalOrden - montoPagadoActual})`
      });
    }
    
    const ultimoPagoResult = await executeQuery(`
      SELECT numero_pago 
      FROM pagos_ordenes_compra 
      WHERE id_orden_compra = ?
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
      INSERT INTO pagos_ordenes_compra (
        id_orden_compra,
        numero_pago,
        fecha_pago,
        monto_pagado,
        metodo_pago,
        numero_operacion,
        banco_destino,
        id_cuenta_bancaria_origen,
        observaciones,
        id_registrado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      numeroPago,
      fecha_pago,
      montoNuevoPago,
      metodo_pago || 'Transferencia',
      numero_operacion || null,
      banco_destino || null,
      id_cuenta_bancaria_origen || orden.id_cuenta_bancaria || null,
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
    
    if (nuevoMontoPagado >= totalOrden - 0.1) {
      estadoPago = 'Pagado';
    } else if (nuevoMontoPagado === 0) {
      estadoPago = 'Pendiente';
    }
    
    await executeQuery(`
      UPDATE ordenes_compra 
      SET monto_pagado = ?,
          estado_pago = ?
      WHERE id_orden_compra = ?
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getPagosOrdenCompra(req, res) {
  try {
    const { id } = req.params;
    
    const ordenCheck = await executeQuery(`
      SELECT id_orden_compra FROM ordenes_compra WHERE id_orden_compra = ?
    `, [id]);
    
    if (!ordenCheck.success || ordenCheck.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de compra no encontrada'
      });
    }
    
    const result = await executeQuery(`
      SELECT 
        p.*,
        e.nombre_completo AS registrado_por,
        cb.banco AS banco_origen,
        cb.numero_cuenta AS cuenta_origen
      FROM pagos_ordenes_compra p
      LEFT JOIN empleados e ON p.id_registrado_por = e.id_empleado
      LEFT JOIN cuentas_bancarias cb ON p.id_cuenta_bancaria_origen = cb.id_cuenta_bancaria
      WHERE p.id_orden_compra = ?
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function anularPagoOrdenCompra(req, res) {
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
      SELECT * FROM pagos_ordenes_compra 
      WHERE id_pago_orden = ? AND id_orden_compra = ?
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
      SELECT * FROM ordenes_compra WHERE id_orden_compra = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de compra no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    const montoPagadoActual = parseFloat(orden.monto_pagado || 0);
    const totalOrden = parseFloat(orden.total);
    
    await executeQuery(`
      DELETE FROM pagos_ordenes_compra WHERE id_pago_orden = ?
    `, [idPago]);
    
    const nuevoMontoPagado = montoPagadoActual - montoPago;
    let estadoPago = 'Parcial';
    
    if (nuevoMontoPagado >= totalOrden - 0.1) {
      estadoPago = 'Pagado';
    } else if (nuevoMontoPagado <= 0.1) {
      estadoPago = 'Pendiente';
    }
    
    await executeQuery(`
      UPDATE ordenes_compra 
      SET monto_pagado = ?,
          estado_pago = ?
      WHERE id_orden_compra = ?
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getResumenPagosOrdenCompra(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(`
      SELECT 
        numero_orden,
        total,
        monto_pagado,
        estado_pago,
        moneda
      FROM ordenes_compra 
      WHERE id_orden_compra = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de compra no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    const totalOrden = parseFloat(orden.total);
    const montoPagado = parseFloat(orden.monto_pagado || 0);
    
    const pagosResult = await executeQuery(`
      SELECT COUNT(*) as total_pagos
      FROM pagos_ordenes_compra
      WHERE id_orden_compra = ?
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}