import { executeQuery, executeTransaction } from '../config/database.js';
import { generarCompraPDF } from '../utils/pdfGenerators/compraPDF.js';

// ==================== OBTENER COMPRAS ====================

export async function getAllCompras(req, res) {
  try {
    const { 
      estado, 
      prioridad, 
      tipo_compra, 
      tipo_cuenta,
      id_cuenta_pago,
      fecha_inicio, 
      fecha_fin,
      mes,
      anio,
      alertas 
    } = req.query;
    
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
        cp.tipo AS tipo_cuenta_pago,
        cp.moneda AS moneda_cuenta,
        (SELECT COUNT(*) FROM detalle_orden_compra WHERE id_orden_compra = oc.id_orden_compra) AS total_items,
        (SELECT COUNT(*) FROM cuotas_orden_compra WHERE id_orden_compra = oc.id_orden_compra AND estado = 'Pendiente') AS cuotas_pendientes,
        DATEDIFF(oc.fecha_vencimiento, CURDATE()) AS dias_para_vencer,
        CASE 
          WHEN oc.estado_pago = 'Pagado' THEN 'success'
          WHEN oc.fecha_vencimiento < CURDATE() AND oc.estado_pago != 'Pagado' THEN 'danger'
          WHEN DATEDIFF(oc.fecha_vencimiento, CURDATE()) <= 7 AND oc.estado_pago != 'Pagado' THEN 'warning'
          ELSE 'info'
        END AS nivel_alerta
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
    
    if (tipo_compra) {
      sql += ` AND oc.tipo_compra = ?`;
      params.push(tipo_compra);
    }
    
    if (tipo_cuenta) {
      sql += ` AND cp.tipo = ?`;
      params.push(tipo_cuenta);
    }
    
    if (id_cuenta_pago) {
      sql += ` AND oc.id_cuenta_pago = ?`;
      params.push(id_cuenta_pago);
    }
    
    if (fecha_inicio) {
      sql += ` AND DATE(oc.fecha_emision) >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND DATE(oc.fecha_emision) <= ?`;
      params.push(fecha_fin);
    }
    
    if (mes && anio) {
      sql += ` AND MONTH(oc.fecha_emision) = ? AND YEAR(oc.fecha_emision) = ?`;
      params.push(mes, anio);
    } else if (anio) {
      sql += ` AND YEAR(oc.fecha_emision) = ?`;
      params.push(anio);
    }
    
    // Filtros de alertas inteligentes
    if (alertas === 'proximas_vencer') {
      sql += ` AND oc.estado_pago != 'Pagado' AND DATEDIFF(oc.fecha_vencimiento, CURDATE()) BETWEEN 0 AND 7`;
    } else if (alertas === 'vencidas') {
      sql += ` AND oc.estado_pago != 'Pagado' AND oc.fecha_vencimiento < CURDATE()`;
    } else if (alertas === 'pendiente_pago') {
      sql += ` AND oc.estado_pago = 'Pendiente'`;
    } else if (alertas === 'pago_parcial') {
      sql += ` AND oc.estado_pago = 'Parcial'`;
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

// ==================== OBTENER COMPRA POR ID ====================

export async function getCompraById(req, res) {
  try {
    const { id } = req.params;
    
    const compraResult = await executeQuery(`
      SELECT 
        oc.*,
        pr.razon_social AS proveedor,
        pr.ruc AS ruc_proveedor,
        pr.direccion AS direccion_proveedor,
        pr.telefono AS telefono_proveedor,
        pr.email AS email_proveedor,
        pr.contacto AS contacto_proveedor,
        e.nombre_completo AS responsable,
        e_reg.nombre_completo AS registrado_por,
        cp.nombre AS cuenta_pago,
        cp.tipo AS tipo_cuenta,
        cp.moneda AS moneda_cuenta,
        cp.saldo_actual AS saldo_cuenta,
        cp.banco AS banco_cuenta,
        cp.numero_cuenta AS numero_cuenta_pago,
        DATEDIFF(oc.fecha_vencimiento, CURDATE()) AS dias_para_vencer
      FROM ordenes_compra oc
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      LEFT JOIN empleados e ON oc.id_responsable = e.id_empleado
      LEFT JOIN empleados e_reg ON oc.id_registrado_por = e_reg.id_empleado
      LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
      WHERE oc.id_orden_compra = ?
    `, [id]);
    
    if (!compraResult.success) {
      return res.status(500).json({ 
        success: false,
        error: compraResult.error 
      });
    }
    
    if (compraResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Compra no encontrada'
      });
    }
    
    const compra = compraResult.data[0];
    
    // Obtener detalle de productos
    const detalleResult = await executeQuery(`
      SELECT 
        doc.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.stock_actual AS stock_disponible,
        ti.nombre AS tipo_inventario
      FROM detalle_orden_compra doc
      INNER JOIN productos p ON doc.id_producto = p.id_producto
      LEFT JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE doc.id_orden_compra = ?
      ORDER BY doc.orden, doc.id_detalle
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false,
        error: detalleResult.error 
      });
    }
    
    compra.detalle = detalleResult.data;
    
    // Obtener cuotas si es compra a crédito
    if (compra.tipo_compra === 'Credito' && compra.numero_cuotas > 0) {
      const cuotasResult = await executeQuery(`
        SELECT 
          coc.*,
          DATEDIFF(coc.fecha_vencimiento, CURDATE()) AS dias_para_vencer,
          CASE 
            WHEN coc.estado = 'Pagada' THEN 'success'
            WHEN coc.fecha_vencimiento < CURDATE() THEN 'danger'
            WHEN DATEDIFF(coc.fecha_vencimiento, CURDATE()) <= 7 THEN 'warning'
            ELSE 'info'
          END AS nivel_alerta
        FROM cuotas_orden_compra coc
        WHERE coc.id_orden_compra = ?
        ORDER BY coc.numero_cuota
      `, [id]);
      
      if (cuotasResult.success) {
        compra.cuotas = cuotasResult.data;
      }
    }
    
    res.json({
      success: true,
      data: compra
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ==================== CREAR COMPRA ====================

export async function createCompra(req, res) {
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
      dias_credito,
      fecha_primera_cuota,
      tipo_impuesto,
      porcentaje_impuesto,
      observaciones,
      id_responsable,
      contacto_proveedor,
      direccion_entrega,
      detalle
    } = req.body;
    
    const id_registrado_por = req.user?.id_empleado || null;
    
    // Validaciones
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
    
    // Verificar cuenta de pago
    const cuentaResult = await executeQuery(`
      SELECT * FROM cuentas_pago 
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
        error: `La moneda de la cuenta (${cuenta.moneda}) no coincide con la moneda de la compra (${moneda})`
      });
    }
    
    // Verificar saldo si es al contado
    if (tipo_compra === 'Contado') {
      if (parseFloat(cuenta.saldo_actual) < total) {
        return res.status(400).json({
          success: false,
          error: `Saldo insuficiente en la cuenta "${cuenta.nombre}". Disponible: ${cuenta.saldo_actual} ${moneda}, Necesario: ${total.toFixed(2)} ${moneda}`
        });
      }
    }
    
    // Generar número de compra
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
    
    const numeroCompra = `COM-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(5, '0')}`;
    
    // Calcular fecha de vencimiento
    let fechaVencimientoFinal = fecha_vencimiento;
    if (!fechaVencimientoFinal) {
      const fechaBase = new Date(fecha_emision);
      let diasTotal = 30;
      
      if (tipo_compra === 'Credito') {
        if (dias_credito) {
          diasTotal = parseInt(dias_credito);
        } else if (numero_cuotas && dias_entre_cuotas) {
          diasTotal = parseInt(numero_cuotas) * parseInt(dias_entre_cuotas);
        }
      }
      
      fechaBase.setDate(fechaBase.getDate() + diasTotal);
      fechaVencimientoFinal = fechaBase.toISOString().split('T')[0];
    }
    
    const operations = async (connection) => {
      // Insertar compra
      const [resultCompra] = await connection.query(`
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
          dias_credito,
          contacto_proveedor,
          direccion_entrega,
          observaciones,
          id_responsable,
          id_registrado_por,
          subtotal,
          igv,
          total,
          estado,
          estado_pago
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Recibida', ?)
      `, [
        numeroCompra,
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
        tipo_compra === 'Credito' ? parseInt(dias_credito || 30) : 0,
        contacto_proveedor || null,
        direccion_entrega || null,
        observaciones,
        id_responsable || null,
        id_registrado_por,
        subtotal,
        impuesto,
        total,
        tipo_compra === 'Contado' ? 'Pagado' : 'Pendiente'
      ]);
      
      const idCompra = resultCompra.insertId;
      
      // Insertar detalles y actualizar stock
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
            subtotal,
            orden
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          idCompra,
          item.id_producto,
          parseFloat(item.cantidad),
          precioUnitario,
          descuento,
          subtotalItem,
          i + 1
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
        const [cuentaLock] = await connection.query(
          'SELECT saldo_actual FROM cuentas_pago WHERE id_cuenta = ? FOR UPDATE',
          [id_cuenta_pago]
        );
        
        const saldoAnterior = parseFloat(cuentaLock[0].saldo_actual);
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
          `Pago de compra ${numeroCompra}`,
          numeroCompra,
          idCompra,
          saldoAnterior,
          saldoNuevo,
          id_registrado_por
        ]);
        
        await connection.query(
          'UPDATE ordenes_compra SET monto_pagado = ? WHERE id_orden_compra = ?',
          [total, idCompra]
        );
      }
      
      // Si es a crédito, generar cuotas
      if (tipo_compra === 'Credito' && numero_cuotas > 0) {
        const cantidadCuotas = parseInt(numero_cuotas);
        const diasEntreCuotas = parseInt(dias_entre_cuotas || 30);
        const montoCuota = total / cantidadCuotas;
        
        let fechaCuota = new Date(fecha_primera_cuota || fecha_emision);
        if (!fecha_primera_cuota) {
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
            idCompra,
            i,
            montoCuota,
            fechaCuota.toISOString().split('T')[0]
          ]);
          
          fechaCuota.setDate(fechaCuota.getDate() + diasEntreCuotas);
        }
      }
      
      return {
        id_orden_compra: idCompra,
        numero_orden: numeroCompra,
        tipo_cuenta: cuenta.tipo,
        cuenta_utilizada: cuenta.nombre
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
        'Compra creada y pagada exitosamente' : 
        'Compra a crédito creada exitosamente'
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ==================== ACTUALIZAR COMPRA ====================

export async function updateCompra(req, res) {
  try {
    const { id } = req.params;
    const {
      id_proveedor,
      fecha_emision,
      fecha_entrega_estimada,
      prioridad,
      observaciones,
      id_responsable,
      contacto_proveedor,
      direccion_entrega,
      detalle
    } = req.body;

    const compraExistente = await executeQuery(`
      SELECT estado, tipo_compra FROM ordenes_compra WHERE id_orden_compra = ?
    `, [id]);

    if (!compraExistente.success || compraExistente.data.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Compra no encontrada' 
      });
    }

    if (compraExistente.data[0].estado === 'Recibida') {
      return res.status(400).json({ 
        success: false, 
        error: 'No se pueden editar compras ya recibidas. Solo se pueden gestionar pagos.' 
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
        contacto_proveedor = ?,
        direccion_entrega = ?,
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
      contacto_proveedor || null,
      direccion_entrega || null,
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
          subtotal,
          orden
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        item.id_producto,
        parseFloat(item.cantidad),
        precioUnitario,
        descuento,
        subtotalItem,
        i + 1
      ]);
    }

    res.json({ 
      success: true, 
      message: 'Compra actualizada exitosamente' 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
}

// ==================== CANCELAR COMPRA ====================

export async function cancelarCompra(req, res) {
  try {
    const { id } = req.params;
    const { motivo_cancelacion } = req.body;
    
    const compraResult = await executeQuery(`
      SELECT * FROM ordenes_compra WHERE id_orden_compra = ?
    `, [id]);
    
    if (!compraResult.success || compraResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Compra no encontrada'
      });
    }
    
    const compra = compraResult.data[0];
    
    if (compra.estado === 'Cancelada') {
      return res.status(400).json({
        success: false,
        error: 'Esta compra ya está cancelada'
      });
    }
    
    if (parseFloat(compra.monto_pagado || 0) > 0) {
      return res.status(400).json({
        success: false,
        error: 'No se puede cancelar una compra con pagos realizados'
      });
    }
    
    const operations = async (connection) => {
      // Cancelar compra
      await connection.query(`
        UPDATE ordenes_compra 
        SET estado = 'Cancelada',
            observaciones = CONCAT(COALESCE(observaciones, ''), '\n[CANCELADA] ', ?)
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
      message: 'Compra cancelada exitosamente'
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ==================== CUOTAS ====================

export async function getCuotasCompra(req, res) {
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
        END AS nivel_alerta
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
      error: error.message
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
        oc.id_cuenta_pago,
        pr.razon_social AS proveedor,
        cp.nombre AS cuenta_pago,
        cp.tipo AS tipo_cuenta,
        cp.saldo_actual AS saldo_cuenta,
        DATEDIFF(coc.fecha_vencimiento, CURDATE()) AS dias_para_vencer
      FROM cuotas_orden_compra coc
      INNER JOIN ordenes_compra oc ON coc.id_orden_compra = oc.id_orden_compra
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
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
        cp.tipo AS tipo_cuenta,
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
      error: error.message
    });
  }
}

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
        throw new Error(`La moneda de la cuenta no coincide con la de la compra`);
      }
      
      const saldoAnterior = parseFloat(cuenta.saldo_actual);
      if (saldoAnterior < montoPago) {
        throw new Error(`Saldo insuficiente en "${cuenta.nombre}". Disponible: ${saldoAnterior} ${cuenta.moneda}`);
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
      
      // Actualizar compra
      const nuevoMontoPagadoCompra = parseFloat(cuota.monto_pagado) + montoPago;
      const totalCompra = parseFloat(cuota.total);
      
      let estadoPagoCompra = 'Parcial';
      if (nuevoMontoPagadoCompra >= totalCompra - 0.01) {
        estadoPagoCompra = 'Pagado';
      }
      
      await connection.query(`
        UPDATE ordenes_compra 
        SET monto_pagado = ?,
            estado_pago = ?
        WHERE id_orden_compra = ?
      `, [nuevoMontoPagadoCompra, estadoPagoCompra, id]);
      
      return {
        id_movimiento: resultMov.insertId,
        monto_pagado: montoPago,
        nuevo_saldo_cuenta: saldoNuevo,
        estado_cuota: estadoCuota,
        estado_pago_compra: estadoPagoCompra,
        cuenta_utilizada: cuenta.nombre
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
      error: error.message
    });
  }
}

// ==================== ALERTAS INTELIGENTES ====================

export async function getAlertasCompras(req, res) {
  try {
    const { tipo_cuenta, id_cuenta_pago } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (tipo_cuenta) {
      whereClause += ' AND cp.tipo = ?';
      params.push(tipo_cuenta);
    }
    
    if (id_cuenta_pago) {
      whereClause += ' AND oc.id_cuenta_pago = ?';
      params.push(id_cuenta_pago);
    }
    
    const result = await executeQuery(`
      SELECT 
        'cuotas_vencidas' as tipo_alerta,
        COUNT(DISTINCT coc.id_cuota) as cantidad,
        SUM(coc.monto_cuota - COALESCE(coc.monto_pagado, 0)) as monto_total,
        COUNT(DISTINCT oc.id_orden_compra) as compras_afectadas
      FROM cuotas_orden_compra coc
      INNER JOIN ordenes_compra oc ON coc.id_orden_compra = oc.id_orden_compra
      LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
      WHERE coc.estado != 'Pagada' 
        AND coc.fecha_vencimiento < CURDATE()
        ${whereClause}
      UNION ALL
      SELECT 
        'cuotas_proximas_vencer' as tipo_alerta,
        COUNT(DISTINCT coc.id_cuota) as cantidad,
        SUM(coc.monto_cuota - COALESCE(coc.monto_pagado, 0)) as monto_total,
        COUNT(DISTINCT oc.id_orden_compra) as compras_afectadas
      FROM cuotas_orden_compra coc
      INNER JOIN ordenes_compra oc ON coc.id_orden_compra = oc.id_orden_compra
      LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
      WHERE coc.estado != 'Pagada' 
        AND DATEDIFF(coc.fecha_vencimiento, CURDATE()) BETWEEN 0 AND 7
        ${whereClause}
      UNION ALL
      SELECT 
        'compras_vencidas' as tipo_alerta,
        COUNT(DISTINCT oc.id_orden_compra) as cantidad,
        SUM(oc.total - COALESCE(oc.monto_pagado, 0)) as monto_total,
        COUNT(DISTINCT oc.id_orden_compra) as compras_afectadas
      FROM ordenes_compra oc
      LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
      WHERE oc.estado_pago != 'Pagado' 
        AND oc.fecha_vencimiento < CURDATE()
        ${whereClause}
      UNION ALL
      SELECT 
        'pagos_pendientes' as tipo_alerta,
        COUNT(*) as cantidad,
        SUM(oc.total - COALESCE(oc.monto_pagado, 0)) as monto_total,
        COUNT(*) as compras_afectadas
      FROM ordenes_compra oc
      LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
      WHERE oc.estado_pago = 'Pendiente'
        ${whereClause}
    `, [...params, ...params, ...params, ...params]);
    
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
        monto_total: parseFloat(row.monto_total || 0),
        compras_afectadas: row.compras_afectadas
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
      error: error.message
    });
  }
}

// ==================== ESTADÍSTICAS ====================

export async function getEstadisticasCompras(req, res) {
  try {
    const { mes, anio, tipo_cuenta, id_cuenta_pago } = req.query;
    
    let whereClause = "WHERE oc.estado != 'Cancelada'";
    const params = [];
    
    if (mes && anio) {
      whereClause += ' AND MONTH(oc.fecha_emision) = ? AND YEAR(oc.fecha_emision) = ?';
      params.push(mes, anio);
    } else if (anio) {
      whereClause += ' AND YEAR(oc.fecha_emision) = ?';
      params.push(anio);
    }
    
    if (tipo_cuenta) {
      whereClause += ' AND cp.tipo = ?';
      params.push(tipo_cuenta);
    }
    
    if (id_cuenta_pago) {
      whereClause += ' AND oc.id_cuenta_pago = ?';
      params.push(id_cuenta_pago);
    }
    
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_compras,
        SUM(CASE WHEN oc.estado = 'Recibida' THEN 1 ELSE 0 END) AS recibidas,
        SUM(CASE WHEN oc.estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN oc.estado_pago = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes_pago,
        SUM(CASE WHEN oc.estado_pago = 'Parcial' THEN 1 ELSE 0 END) AS pagos_parciales,
        SUM(CASE WHEN oc.estado_pago = 'Pagado' THEN 1 ELSE 0 END) AS pagadas,
        SUM(CASE WHEN oc.tipo_compra = 'Contado' THEN 1 ELSE 0 END) AS al_contado,
        SUM(CASE WHEN oc.tipo_compra = 'Credito' THEN 1 ELSE 0 END) AS a_credito,
        SUM(oc.total) AS monto_total,
        SUM(oc.monto_pagado) AS monto_pagado,
        SUM(oc.total - COALESCE(oc.monto_pagado, 0)) AS saldo_pendiente,
        COUNT(DISTINCT oc.id_proveedor) AS proveedores_unicos,
        COUNT(DISTINCT oc.id_cuenta_pago) AS cuentas_utilizadas,
        AVG(oc.total) AS ticket_promedio
      FROM ordenes_compra oc
      LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
      ${whereClause}
    `, params);
    
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

// ==================== RESUMEN DE PAGOS ====================

export async function getResumenPagosCompra(req, res) {
  try {
    const { id } = req.params;
    
    const compraResult = await executeQuery(`
      SELECT 
        oc.numero_orden,
        oc.tipo_compra,
        oc.total,
        oc.monto_pagado,
        oc.estado_pago,
        oc.moneda,
        oc.numero_cuotas,
        oc.fecha_vencimiento,
        pr.razon_social AS proveedor,
        cp.nombre AS cuenta_pago,
        cp.tipo AS tipo_cuenta
      FROM ordenes_compra oc
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
      WHERE oc.id_orden_compra = ?
    `, [id]);
    
    if (!compraResult.success || compraResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Compra no encontrada'
      });
    }
    
    const compra = compraResult.data[0];
    const totalCompra = parseFloat(compra.total);
    const montoPagado = parseFloat(compra.monto_pagado || 0);
    
    let cuotasInfo = null;
    if (compra.tipo_compra === 'Credito') {
      const cuotasResult = await executeQuery(`
        SELECT 
          COUNT(*) as total_cuotas,
          SUM(CASE WHEN estado = 'Pagada' THEN 1 ELSE 0 END) as cuotas_pagadas,
          SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) as cuotas_pendientes,
          SUM(CASE WHEN estado = 'Parcial' THEN 1 ELSE 0 END) as cuotas_parciales,
          SUM(CASE WHEN estado != 'Pagada' AND fecha_vencimiento < CURDATE() THEN 1 ELSE 0 END) as cuotas_vencidas,
          MIN(CASE WHEN estado != 'Pagada' THEN fecha_vencimiento END) as proxima_cuota_vencimiento,
          MIN(CASE WHEN estado != 'Pagada' THEN DATEDIFF(fecha_vencimiento, CURDATE()) END) as dias_proxima_cuota
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
        numero_orden: compra.numero_orden,
        proveedor: compra.proveedor,
        tipo_compra: compra.tipo_compra,
        total_compra: totalCompra,
        monto_pagado: montoPagado,
        saldo_pendiente: totalCompra - montoPagado,
        porcentaje_pagado: totalCompra > 0 ? ((montoPagado / totalCompra) * 100).toFixed(2) : 0,
        estado_pago: compra.estado_pago,
        moneda: compra.moneda,
        fecha_vencimiento: compra.fecha_vencimiento,
        cuenta_pago: compra.cuenta_pago,
        tipo_cuenta: compra.tipo_cuenta,
        cuotas: cuotasInfo,
        total_movimientos: movimientosResult.data[0].total_movimientos
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

// ==================== HISTORIAL DE MOVIMIENTOS ====================

export async function getHistorialPagosCompra(req, res) {
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
      error: error.message
    });
  }
}

// ==================== PDF ====================

export async function descargarPDFCompra(req, res) {
  try {
    const { id } = req.params;

    const compraResult = await executeQuery(`
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
        cp.tipo AS tipo_cuenta,
        cp.banco,
        cp.numero_cuenta
      FROM ordenes_compra oc
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      LEFT JOIN empleados e_responsable ON oc.id_responsable = e_responsable.id_empleado
      LEFT JOIN empleados e_registrado ON oc.id_registrado_por = e_registrado.id_empleado
      LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
      WHERE oc.id_orden_compra = ?
    `, [id]);
    
    if (!compraResult.success || compraResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Compra no encontrada'
      });
    }
    
    const compra = compraResult.data[0];
    
    const detalleResult = await executeQuery(`
      SELECT 
        doc.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_orden_compra doc
      INNER JOIN productos p ON doc.id_producto = p.id_producto
      WHERE doc.id_orden_compra = ?
      ORDER BY doc.orden, doc.id_detalle
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener detalle de la compra'
      });
    }
    
    compra.detalle = detalleResult.data;
    
    // Obtener cuotas si es a crédito
    if (compra.tipo_compra === 'Credito') {
      const cuotasResult = await executeQuery(`
        SELECT * FROM cuotas_orden_compra 
        WHERE id_orden_compra = ? 
        ORDER BY numero_cuota
      `, [id]);
      
      if (cuotasResult.success) {
        compra.cuotas = cuotasResult.data;
      }
    }
    
    const pdfBuffer = await generarCompraPDF(compra);
    const filename = `Compra-${compra.numero_orden}.pdf`;
    
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

// ==================== COMPRAS POR CUENTA ====================

export async function getComprasPorCuenta(req, res) {
  try {
    const { mes, anio } = req.query;
    
    let whereClause = "WHERE oc.estado != 'Cancelada'";
    const params = [];
    
    if (mes && anio) {
      whereClause += ' AND MONTH(oc.fecha_emision) = ? AND YEAR(oc.fecha_emision) = ?';
      params.push(mes, anio);
    } else if (anio) {
      whereClause += ' AND YEAR(oc.fecha_emision) = ?';
      params.push(anio);
    }
    
    const result = await executeQuery(`
      SELECT 
        cp.id_cuenta,
        cp.nombre AS cuenta,
        cp.tipo AS tipo_cuenta,
        cp.moneda,
        COUNT(oc.id_orden_compra) AS total_compras,
        SUM(oc.total) AS monto_total,
        SUM(oc.monto_pagado) AS monto_pagado,
        SUM(oc.total - COALESCE(oc.monto_pagado, 0)) AS saldo_pendiente,
        SUM(CASE WHEN oc.tipo_compra = 'Contado' THEN 1 ELSE 0 END) AS compras_contado,
        SUM(CASE WHEN oc.tipo_compra = 'Credito' THEN 1 ELSE 0 END) AS compras_credito
      FROM cuentas_pago cp
      LEFT JOIN ordenes_compra oc ON cp.id_cuenta = oc.id_cuenta_pago
      ${whereClause}
      GROUP BY cp.id_cuenta, cp.nombre, cp.tipo, cp.moneda
      HAVING total_compras > 0
      ORDER BY monto_total DESC
    `, params);
    
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