import { executeQuery, executeTransaction } from '../config/database.js';
import { generarOrdenCompraPDF } from '../utils/pdfGenerators/ordenCompraPDF.js';

// ==================== OBTENER ÓRDENES DE COMPRA ====================

export async function getAllOrdenesCompra(req, res) {
  try {
    const { estado, prioridad, tipo_pago, fecha_inicio, fecha_fin, alertas } = req.query;
    
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
        oc.numero_cuotas,
        pr.razon_social AS proveedor,
        pr.ruc AS ruc_proveedor,
        e_responsable.nombre_completo AS responsable,
        e_registrado.nombre_completo AS registrado_por,
        cp.nombre AS cuenta_pago,
        (SELECT COUNT(*) FROM detalle_orden_compra WHERE id_orden_compra = oc.id_orden_compra) AS total_items,
        (SELECT COUNT(*) FROM cuotas_orden_compra WHERE id_orden_compra = oc.id_orden_compra AND estado = 'Pendiente') AS cuotas_pendientes,
        DATEDIFF(oc.fecha_vencimiento, CURDATE()) AS dias_para_vencer
      FROM ordenes_compra oc
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
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
    
    if (tipo_pago) {
      sql += ` AND oc.tipo_compra = ?`;
      params.push(tipo_pago);
    }
    
    if (fecha_inicio) {
      sql += ` AND DATE(oc.fecha_emision) >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND DATE(oc.fecha_emision) <= ?`;
      params.push(fecha_fin);
    }
    
    // Filtro de alertas
    if (alertas === 'proximas_vencer') {
      sql += ` AND oc.estado_pago != 'Pagado' AND DATEDIFF(oc.fecha_vencimiento, CURDATE()) BETWEEN 0 AND 7`;
    } else if (alertas === 'vencidas') {
      sql += ` AND oc.estado_pago != 'Pagado' AND oc.fecha_vencimiento < CURDATE()`;
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
      data: result.data[0]
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
}

// ==================== OBTENER CUOTAS ====================

export async function getCuotasOrdenCompra(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.query;
    
    let sql = `
      SELECT 
        coc.*,
        DATEDIFF(coc.fecha_vencimiento, CURDATE()) AS dias_para_vencer,
        CASE 
          WHEN coc.estado = 'Pagada' THEN 'success'
          WHEN coc.fecha_vencimiento < CURDATE() THEN 'danger'
          WHEN DATEDIFF(coc.fecha_vencimiento, CURDATE()) <= 7 THEN 'warning'
          ELSE 'info'
        END AS alerta_nivel
      FROM cuotas_orden_compra coc
      WHERE coc.id_orden_compra = ?
    `;
    
    const params = [id];
    
    if (estado) {
      sql += ' AND coc.estado = ?';
      params.push(estado);
    }
    
    sql += ' ORDER BY coc.numero_cuota';
    
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
      error: error
    });
  }
}

export async function getCuotaById(req, res) {
  try {
    const { id, idCuota } = req.params;
    
    const result = await executeQuery(`
      SELECT 
        coc.*,
        oc.numero_orden,
        oc.moneda,
        oc.id_proveedor,
        pr.razon_social AS proveedor,
        DATEDIFF(coc.fecha_vencimiento, CURDATE()) AS dias_para_vencer
      FROM cuotas_orden_compra coc
      INNER JOIN ordenes_compra oc ON coc.id_orden_compra = oc.id_orden_compra
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      WHERE coc.id_cuota = ? AND coc.id_orden_compra = ?
    `, [idCuota, id]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    if (result.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cuota no encontrada'
      });
    }
    
    const cuota = result.data[0];
    
    // Obtener historial de pagos de la cuota
    const pagosResult = await executeQuery(`
      SELECT 
        mc.*,
        cp.nombre AS cuenta_pago,
        e.nombre_completo AS registrado_por_nombre
      FROM movimientos_cuentas mc
      LEFT JOIN cuentas_pago cp ON mc.id_cuenta = cp.id_cuenta
      LEFT JOIN empleados e ON mc.id_registrado_por = e.id_empleado
      WHERE mc.id_cuota = ?
      ORDER BY mc.fecha_movimiento DESC
    `, [idCuota]);
    
    if (pagosResult.success) {
      cuota.historial_pagos = pagosResult.data;
    }
    
    res.json({
      success: true,
      data: cuota
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
}

// ==================== ACTUALIZAR ORDEN ====================

export async function updateOrdenCompra(req, res) {
  try {
    const { id } = req.params;
    const {
      id_proveedor,
      fecha_emision,
      fecha_entrega_estimada,
      prioridad,
      observaciones,
      id_responsable,
      detalle
    } = req.body;

    const ordenExistente = await executeQuery(`
      SELECT estado, tipo_compra FROM ordenes_compra WHERE id_orden_compra = ?
    `, [id]);

    if (!ordenExistente.success || ordenExistente.data.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Orden de compra no encontrada' 
      });
    }

    if (ordenExistente.data[0].estado === 'Recibida') {
      return res.status(400).json({ 
        success: false, 
        error: 'No se pueden editar órdenes ya recibidas. Solo se pueden gestionar pagos.' 
      });
    }

    if (!id_proveedor || !detalle || detalle.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Proveedor y detalle son obligatorios' 
      });
    }

    let subtotal = 0;
    for (const item of detalle) {
      const precioUnitario = parseFloat(item.precio_unitario);
      const valorCompra = (item.cantidad * precioUnitario) * (1 - parseFloat(item.descuento_porcentaje || 0) / 100);
      subtotal += valorCompra;
    }

    const impuesto = subtotal * 0.18;
    const total = subtotal + impuesto;

    const updateResult = await executeQuery(`
      UPDATE ordenes_compra 
      SET 
        id_proveedor = ?,
        fecha_emision = ?,
        fecha_entrega_estimada = ?,
        prioridad = ?,
        observaciones = ?,
        id_responsable = ?,
        subtotal = ?,
        igv = ?,
        total = ?
      WHERE id_orden_compra = ?
    `, [
      id_proveedor,
      fecha_emision,
      fecha_entrega_estimada || null,
      prioridad || 'Media',
      observaciones,
      id_responsable || null,
      subtotal,
      impuesto,
      total,
      id
    ]);

    if (!updateResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: updateResult.error 
      });
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

    res.json({ 
      success: true, 
      message: 'Orden de compra actualizada exitosamente' 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      error: error
    });
  }
}

// ==================== CANCELAR ORDEN ====================

export async function cancelarOrdenCompra(req, res) {
  try {
    const { id } = req.params;
    const { motivo_cancelacion } = req.body;
    
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
    
    if (orden.estado === 'Cancelada') {
      return res.status(400).json({
        success: false,
        error: 'Esta orden ya está cancelada'
      });
    }
    
    if (parseFloat(orden.monto_pagado || 0) > 0) {
      return res.status(400).json({
        success: false,
        error: 'No se puede cancelar una orden con pagos realizados'
      });
    }
    
    const operations = async (connection) => {
      // Cancelar orden
      await connection.query(`
        UPDATE ordenes_compra 
        SET estado = 'Cancelada',
            observaciones = CONCAT(COALESCE(observaciones, ''), '\nCANCELADA: ', ?)
        WHERE id_orden_compra = ?
      `, [motivo_cancelacion || 'Sin motivo especificado', id]);
      
      // Cancelar cuotas pendientes
      await connection.query(`
        UPDATE cuotas_orden_compra 
        SET estado = 'Cancelada'
        WHERE id_orden_compra = ? AND estado = 'Pendiente'
      `, [id]);
      
      // Revertir stock de productos
      const [detalles] = await connection.query(`
        SELECT id_producto, cantidad 
        FROM detalle_orden_compra 
        WHERE id_orden_compra = ?
      `, [id]);
      
      for (const detalle of detalles) {
        await connection.query(`
          UPDATE productos 
          SET stock_actual = stock_actual - ? 
          WHERE id_producto = ?
        `, [detalle.cantidad, detalle.id_producto]);
      }
      
      return { cancelada: true };
    };
    
    const result = await executeTransaction(operations);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.json({
      success: true,
      message: 'Orden de compra cancelada exitosamente'
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
}

// ==================== PDF ====================

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
        cp.nombre AS cuenta_pago,
        cp.banco,
        cp.numero_cuenta
      FROM ordenes_compra oc
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      LEFT JOIN empleados e_responsable ON oc.id_responsable = e_responsable.id_empleado
      LEFT JOIN empleados e_registrado ON oc.id_registrado_por = e_registrado.id_empleado
      LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
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
    
    // Obtener cuotas si es a crédito
    if (orden.tipo_compra === 'Credito') {
      const cuotasResult = await executeQuery(`
        SELECT * FROM cuotas_orden_compra 
        WHERE id_orden_compra = ? 
        ORDER BY numero_cuota
      `, [id]);
      
      if (cuotasResult.success) {
        orden.cuotas = cuotasResult.data;
      }
    }
    
    const pdfBuffer = await generarOrdenCompraPDF(orden);
    const filename = `OrdenCompra-${orden.numero_orden}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
}

// ==================== RESUMEN DE PAGOS ====================

export async function getResumenPagosOrden(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(`
      SELECT 
        oc.numero_orden,
        oc.tipo_compra,
        oc.total,
        oc.monto_pagado,
        oc.estado_pago,
        oc.moneda,
        oc.numero_cuotas,
        oc.fecha_vencimiento,
        pr.razon_social AS proveedor
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
    const totalOrden = parseFloat(orden.total);
    const montoPagado = parseFloat(orden.monto_pagado || 0);
    
    let cuotasInfo = null;
    if (orden.tipo_compra === 'Credito') {
      const cuotasResult = await executeQuery(`
        SELECT 
          COUNT(*) as total_cuotas,
          SUM(CASE WHEN estado = 'Pagada' THEN 1 ELSE 0 END) as cuotas_pagadas,
          SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) as cuotas_pendientes,
          SUM(CASE WHEN estado = 'Parcial' THEN 1 ELSE 0 END) as cuotas_parciales,
          SUM(CASE WHEN estado != 'Pagada' AND fecha_vencimiento < CURDATE() THEN 1 ELSE 0 END) as cuotas_vencidas,
          MIN(CASE WHEN estado != 'Pagada' THEN fecha_vencimiento END) as proxima_cuota_vencimiento
        FROM cuotas_orden_compra
        WHERE id_orden_compra = ?
      `, [id]);
      
      if (cuotasResult.success) {
        cuotasInfo = cuotasResult.data[0];
      }
    }
    
    const movimientosResult = await executeQuery(`
      SELECT COUNT(*) as total_movimientos
      FROM movimientos_cuentas
      WHERE id_orden_compra = ?
    `, [id]);
    
    res.json({
      success: true,
      data: {
        numero_orden: orden.numero_orden,
        proveedor: orden.proveedor,
        tipo_compra: orden.tipo_compra,
        total_orden: totalOrden,
        monto_pagado: montoPagado,
        saldo_pendiente: totalOrden - montoPagado,
        porcentaje_pagado: totalOrden > 0 ? ((montoPagado / totalOrden) * 100).toFixed(2) : 0,
        estado_pago: orden.estado_pago,
        moneda: orden.moneda,
        fecha_vencimiento: orden.fecha_vencimiento,
        cuotas: cuotasInfo,
        total_movimientos: movimientosResult.data[0].total_movimientos
      }
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
}

// ==================== HISTORIAL DE MOVIMIENTOS ====================

export async function getHistorialPagosOrden(req, res) {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(`
      SELECT 
        mc.*,
        cp.nombre AS cuenta_pago,
        cp.tipo AS tipo_cuenta,
        e.nombre_completo AS registrado_por_nombre,
        coc.numero_cuota,
        coc.monto_cuota
      FROM movimientos_cuentas mc
      LEFT JOIN cuentas_pago cp ON mc.id_cuenta = cp.id_cuenta
      LEFT JOIN empleados e ON mc.id_registrado_por = e.id_empleado
      LEFT JOIN cuotas_orden_compra coc ON mc.id_cuota = coc.id_cuota
      WHERE mc.id_orden_compra = ?
      ORDER BY mc.fecha_movimiento DESC
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
      error: error
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
        cp.nombre AS cuenta_pago,
        cp.tipo AS tipo_cuenta,
        cp.moneda AS moneda_cuenta,
        cp.saldo_actual AS saldo_cuenta,
        DATEDIFF(oc.fecha_vencimiento, CURDATE()) AS dias_para_vencer
      FROM ordenes_compra oc
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      LEFT JOIN empleados e ON oc.id_responsable = e.id_empleado
      LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
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
    
    // Obtener detalle de productos
    const detalleResult = await executeQuery(`
      SELECT 
        doc.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.stock_actual AS stock_disponible
      FROM detalle_orden_compra doc
      INNER JOIN productos p ON doc.id_producto = p.id_producto
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
    
    // Obtener cuotas si es compra a crédito
    if (orden.tipo_compra === 'Credito' && orden.numero_cuotas > 0) {
      const cuotasResult = await executeQuery(`
        SELECT 
          coc.*,
          DATEDIFF(coc.fecha_vencimiento, CURDATE()) AS dias_para_vencer
        FROM cuotas_orden_compra coc
        WHERE coc.id_orden_compra = ?
        ORDER BY coc.numero_cuota
      `, [id]);
      
      if (cuotasResult.success) {
        orden.cuotas = cuotasResult.data;
      }
    }
    
    res.json({
      success: true,
      data: orden
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
}

// ==================== CREAR ORDEN DE COMPRA ====================

export async function createOrdenCompra(req, res) {
  try {
    const {
      id_proveedor,
      id_cuenta_pago,
      fecha_emision,
      fecha_entrega_estimada,
      fecha_vencimiento,
      prioridad,
      moneda,
      tipo_compra,
      numero_cuotas,
      dias_entre_cuotas,
      fecha_primera_cuota,
      tipo_impuesto,
      porcentaje_impuesto,
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
    
    if (!id_cuenta_pago) {
      return res.status(400).json({
        success: false,
        error: 'Debe seleccionar una cuenta de pago'
      });
    }
    
    // Validar tipo de compra
    const tiposCompraValidos = ['Contado', 'Credito'];
    if (!tiposCompraValidos.includes(tipo_compra)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de compra no válido. Debe ser: Contado o Credito'
      });
    }
    
    // Calcular totales
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
    
    // Verificar saldo de cuenta si es al contado
    if (tipo_compra === 'Contado') {
      const cuentaResult = await executeQuery(`
        SELECT saldo_actual, moneda 
        FROM cuentas_pago 
        WHERE id_cuenta = ? AND estado = 'Activo'
      `, [id_cuenta_pago]);
      
      if (!cuentaResult.success || cuentaResult.data.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Cuenta de pago no encontrada o inactiva'
        });
      }
      
      const cuenta = cuentaResult.data[0];
      
      if (cuenta.moneda !== moneda) {
        return res.status(400).json({
          success: false,
          error: `La moneda de la cuenta (${cuenta.moneda}) no coincide con la moneda de la orden (${moneda})`
        });
      }
      
      if (parseFloat(cuenta.saldo_actual) < total) {
        return res.status(400).json({
          success: false,
          error: `Saldo insuficiente en la cuenta. Disponible: ${cuenta.saldo_actual} ${moneda}, Necesario: ${total} ${moneda}`});
      }
    }
    
    // Generar número de orden
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
    
    // Calcular fecha de vencimiento
    let fechaVencimientoFinal = fecha_vencimiento;
    if (!fechaVencimientoFinal) {
      const fechaBase = new Date(fecha_emision);
      const diasCredito = tipo_compra === 'Credito' && numero_cuotas ? 
        parseInt(numero_cuotas) * parseInt(dias_entre_cuotas || 30) : 30;
      fechaBase.setDate(fechaBase.getDate() + diasCredito);
      fechaVencimientoFinal = fechaBase.toISOString().split('T')[0];
    }
    
    const operations = async (connection) => {
      // Insertar orden de compra
      const [resultOrden] = await connection.query(`
        INSERT INTO ordenes_compra (
          numero_orden,
          id_proveedor,
          id_cuenta_pago,
          fecha_emision,
          fecha_entrega_estimada,
          fecha_vencimiento,
          prioridad,
          moneda,
          tipo_impuesto,
          porcentaje_impuesto,
          tipo_compra,
          numero_cuotas,
          dias_entre_cuotas,
          observaciones,
          id_responsable,
          id_registrado_por,
          subtotal,
          igv,
          total,
          estado,
          estado_pago
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Recibida', ?)
      `, [
        numeroOrden,
        id_proveedor,
        id_cuenta_pago,
        fecha_emision,
        fecha_entrega_estimada || null,
        fechaVencimientoFinal,
        prioridad || 'Media',
        moneda,
        tipoImpuestoFinal,
        porcentaje,
        tipo_compra,
        tipo_compra === 'Credito' ? parseInt(numero_cuotas || 0) : 0,
        tipo_compra === 'Credito' ? parseInt(dias_entre_cuotas || 30) : 0,
        observaciones,
        id_responsable || null,
        id_registrado_por,
        subtotal,
        impuesto,
        total,
        tipo_compra === 'Contado' ? 'Pagado' : 'Pendiente'
      ]);
      
      const idOrden = resultOrden.insertId;
      
      // Insertar detalles
      for (let i = 0; i < detalle.length; i++) {
        const item = detalle[i];
        const precioUnitario = parseFloat(item.precio_unitario);
        const descuento = parseFloat(item.descuento_porcentaje || 0);
        const subtotalItem = (item.cantidad * precioUnitario) * (1 - descuento / 100);
        
        await connection.query(`
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
        
        // Actualizar stock del producto
        await connection.query(`
          UPDATE productos 
          SET stock_actual = stock_actual + ? 
          WHERE id_producto = ?
        `, [parseFloat(item.cantidad), item.id_producto]);
      }
      
      // Si es al contado, descontar de la cuenta y registrar pago
      if (tipo_compra === 'Contado') {
        const [cuenta] = await connection.query(
          'SELECT saldo_actual FROM cuentas_pago WHERE id_cuenta = ? FOR UPDATE',
          [id_cuenta_pago]
        );
        
        const saldoAnterior = parseFloat(cuenta[0].saldo_actual);
        const saldoNuevo = saldoAnterior - total;
        
        await connection.query(
          'UPDATE cuentas_pago SET saldo_actual = ? WHERE id_cuenta = ?',
          [saldoNuevo, id_cuenta_pago]
        );
        
        await connection.query(`
          INSERT INTO movimientos_cuentas (
            id_cuenta,
            tipo_movimiento,
            monto,
            concepto,
            referencia,
            id_orden_compra,
            saldo_anterior,
            saldo_nuevo,
            id_registrado_por,
            fecha_movimiento
          ) VALUES (?, 'Egreso', ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          id_cuenta_pago,
          total,
          `Pago de ${numeroOrden}`,
          numeroOrden,
          idOrden,
          saldoAnterior,
          saldoNuevo,
          id_registrado_por
        ]);
        
        await connection.query(
          'UPDATE ordenes_compra SET monto_pagado = ? WHERE id_orden_compra = ?',
          [total, idOrden]
        );
      }
      
      // Si es a crédito, generar cuotas
      if (tipo_compra === 'Credito' && numero_cuotas > 0) {
        const cantidadCuotas = parseInt(numero_cuotas);
        const diasEntreCuotas = parseInt(dias_entre_cuotas || 30);
        const montoCuota = total / cantidadCuotas;
        
        let fechaCuota = new Date(fecha_primera_cuota || fecha_emision);
        if (fecha_primera_cuota) {
          fechaCuota = new Date(fecha_primera_cuota);
        } else {
          fechaCuota.setDate(fechaCuota.getDate() + diasEntreCuotas);
        }
        
        for (let i = 1; i <= cantidadCuotas; i++) {
          await connection.query(`
            INSERT INTO cuotas_orden_compra (
              id_orden_compra,
              numero_cuota,
              monto_cuota,
              fecha_vencimiento,
              estado
            ) VALUES (?, ?, ?, ?, 'Pendiente')
          `, [
            idOrden,
            i,
            montoCuota,
            fechaCuota.toISOString().split('T')[0]
          ]);
          
          fechaCuota.setDate(fechaCuota.getDate() + diasEntreCuotas);
        }
      }
      
      return {
        id_orden_compra: idOrden,
        numero_orden: numeroOrden
      };
    };
    
    const result = await executeTransaction(operations);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.status(201).json({
      success: true,
      data: result.data,
      message: tipo_compra === 'Contado' ? 
        'Orden de compra creada y pagada exitosamente' : 
        'Orden de compra a crédito creada exitosamente'
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
}

// ==================== PAGAR CUOTA ====================

export async function pagarCuota(req, res) {
  try {
    const { id, idCuota } = req.params;
    const {
      id_cuenta_pago,
      monto_pagado,
      fecha_pago,
      metodo_pago,
      referencia,
      observaciones
    } = req.body;
    
    const id_registrado_por = req.user?.id_empleado || null;
    
    if (!id_cuenta_pago || !monto_pagado || monto_pagado <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Cuenta de pago y monto son obligatorios'
      });
    }
    
    const operations = async (connection) => {
      // Obtener cuota
      const [cuotas] = await connection.query(`
        SELECT coc.*, oc.moneda, oc.total, oc.monto_pagado
        FROM cuotas_orden_compra coc
        INNER JOIN ordenes_compra oc ON coc.id_orden_compra = oc.id_orden_compra
        WHERE coc.id_cuota = ? AND coc.id_orden_compra = ?
        FOR UPDATE
      `, [idCuota, id]);
      
      if (cuotas.length === 0) {
        throw new Error('Cuota no encontrada');
      }
      
      const cuota = cuotas[0];
      
      if (cuota.estado === 'Pagada') {
        throw new Error('Esta cuota ya ha sido pagada');
      }
      
      const montoCuota = parseFloat(cuota.monto_cuota);
      const montoPago = parseFloat(monto_pagado);
      const montoPagadoCuota = parseFloat(cuota.monto_pagado || 0);
      
      if (montoPagadoCuota + montoPago > montoCuota + 0.01) {
        throw new Error(`El monto excede el valor de la cuota`);
      }
      
      // Verificar saldo de cuenta
      const [cuentas] = await connection.query(
        'SELECT * FROM cuentas_pago WHERE id_cuenta = ? AND estado = "Activo" FOR UPDATE',
        [id_cuenta_pago]
      );
      
      if (cuentas.length === 0) {
        throw new Error('Cuenta de pago no encontrada o inactiva');
      }
      
      const cuenta = cuentas[0];
      
      if (cuenta.moneda !== cuota.moneda) {
        throw new Error(`La moneda de la cuenta no coincide con la de la orden`);
      }
      
      const saldoAnterior = parseFloat(cuenta.saldo_actual);
      if (saldoAnterior < montoPago) {
        throw new Error(`Saldo insuficiente. Disponible: ${saldoAnterior} ${cuenta.moneda}`);
      }
      
      // Registrar movimiento en cuenta
      const saldoNuevo = saldoAnterior - montoPago;
      
      await connection.query(
        'UPDATE cuentas_pago SET saldo_actual = ? WHERE id_cuenta = ?',
        [saldoNuevo, id_cuenta_pago]
      );
      
      const [resultMov] = await connection.query(`
        INSERT INTO movimientos_cuentas (
          id_cuenta,
          tipo_movimiento,
          monto,
          concepto,
          referencia,
          id_orden_compra,
          id_cuota,
          saldo_anterior,
          saldo_nuevo,
          id_registrado_por,
          fecha_movimiento
        ) VALUES (?, 'Egreso', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id_cuenta_pago,
        montoPago,
        observaciones || `Pago cuota ${cuota.numero_cuota}`,
        referencia || null,
        id,
        idCuota,
        saldoAnterior,
        saldoNuevo,
        id_registrado_por,
        fecha_pago || new Date()
      ]);
      
      // Actualizar cuota
      const nuevoMontoPagadoCuota = montoPagadoCuota + montoPago;
      const estadoCuota = nuevoMontoPagadoCuota >= montoCuota - 0.01 ? 'Pagada' : 'Parcial';
      
      await connection.query(`
        UPDATE cuotas_orden_compra 
        SET monto_pagado = ?,
            estado = ?,
            fecha_pago = ?
        WHERE id_cuota = ?
      `, [nuevoMontoPagadoCuota, estadoCuota, fecha_pago || new Date(), idCuota]);
      
      // Actualizar orden de compra
      const nuevoMontoPagadoOrden = parseFloat(cuota.monto_pagado) + montoPago;
      const totalOrden = parseFloat(cuota.total);
      
      let estadoPagoOrden = 'Parcial';
      if (nuevoMontoPagadoOrden >= totalOrden - 0.01) {
        estadoPagoOrden = 'Pagado';
      }
      
      await connection.query(`
        UPDATE ordenes_compra 
        SET monto_pagado = ?,
            estado_pago = ?
        WHERE id_orden_compra = ?
      `, [nuevoMontoPagadoOrden, estadoPagoOrden, id]);
      
      return {
        id_movimiento: resultMov.insertId,
        monto_pagado: montoPago,
        nuevo_saldo_cuenta: saldoNuevo,
        estado_cuota: estadoCuota,
        estado_pago_orden: estadoPagoOrden
      };
    };
    
    const result = await executeTransaction(operations);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      message: 'Pago de cuota registrado exitosamente'
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
}

// ==================== ALERTAS Y ESTADÍSTICAS ====================

export async function getAlertasCompras(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        'cuotas_vencidas' as tipo_alerta,
        COUNT(*) as cantidad,
        SUM(coc.monto_cuota - COALESCE(coc.monto_pagado, 0)) as monto_total
      FROM cuotas_orden_compra coc
      WHERE coc.estado != 'Pagada' 
        AND coc.fecha_vencimiento < CURDATE()
      UNION ALL
      SELECT 
        'cuotas_proximas_vencer' as tipo_alerta,
        COUNT(*) as cantidad,
        SUM(coc.monto_cuota - COALESCE(coc.monto_pagado, 0)) as monto_total
      FROM cuotas_orden_compra coc
      WHERE coc.estado != 'Pagada' 
        AND DATEDIFF(coc.fecha_vencimiento, CURDATE()) BETWEEN 0 AND 7
      UNION ALL
      SELECT 
        'ordenes_vencidas' as tipo_alerta,
        COUNT(*) as cantidad,
        SUM(oc.total - COALESCE(oc.monto_pagado, 0)) as monto_total
      FROM ordenes_compra oc
      WHERE oc.estado_pago != 'Pagado' 
        AND oc.fecha_vencimiento < CURDATE()
    `);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    const alertas = {};
    result.data.forEach(row => {
      alertas[row.tipo_alerta] = {
        cantidad: row.cantidad,
        monto_total: parseFloat(row.monto_total || 0)
      };
    });
    
    res.json({
      success: true,
      data: alertas
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
}

export async function getEstadisticasOrdenesCompra(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_ordenes,
        SUM(CASE WHEN estado = 'Recibida' THEN 1 ELSE 0 END) AS recibidas,
        SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN estado_pago = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes_pago,
        SUM(CASE WHEN estado_pago = 'Parcial' THEN 1 ELSE 0 END) AS pagos_parciales,
        SUM(CASE WHEN estado_pago = 'Pagado' THEN 1 ELSE 0 END) AS pagadas,
        SUM(CASE WHEN tipo_compra = 'Contado' THEN 1 ELSE 0 END) AS al_contado,
        SUM(CASE WHEN tipo_compra = 'Credito' THEN 1 ELSE 0 END) AS a_credito,
        SUM(total) AS monto_total,
        SUM(monto_pagado) AS monto_pagado,
        SUM(total - COALESCE(monto_pagado, 0)) AS saldo_pendiente,
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
      error: error
    });
  }
}