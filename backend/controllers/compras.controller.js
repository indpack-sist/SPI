import { executeQuery, executeTransaction } from '../config/database.js';
import { generarCompraPDF } from '../utils/pdfGenerators/compraPDF.js';
import pool from '../config/database.js';

export async function getAllCompras(req, res) {
  try {
    const { 
      estado, prioridad, tipo_compra, tipo_cuenta, id_cuenta_pago,
      fecha_inicio, fecha_fin, mes, anio, alertas 
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
        oc.tipo_cambio,
        oc.monto_pagado,
        oc.saldo_pendiente,
        oc.estado_pago,
        oc.numero_cuotas,
        oc.cronograma_definido,
        oc.tipo_documento,
        oc.serie_documento,
        oc.numero_documento,
        oc.fecha_emision_documento,
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
          WHEN oc.saldo_pendiente > 0.01 AND oc.fecha_vencimiento < CURDATE() THEN 'danger'
          WHEN oc.saldo_pendiente > 0.01 AND DATEDIFF(oc.fecha_vencimiento, CURDATE()) <= 7 THEN 'warning'
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
    
    if (estado) { sql += ` AND oc.estado = ?`; params.push(estado); }
    if (prioridad) { sql += ` AND oc.prioridad = ?`; params.push(prioridad); }
    if (tipo_compra) { sql += ` AND oc.tipo_compra = ?`; params.push(tipo_compra); }
    if (tipo_cuenta) { sql += ` AND cp.tipo = ?`; params.push(tipo_cuenta); }
    if (id_cuenta_pago) { sql += ` AND oc.id_cuenta_pago = ?`; params.push(id_cuenta_pago); }
    
    if (fecha_inicio) { sql += ` AND DATE(oc.fecha_emision) >= ?`; params.push(fecha_inicio); }
    if (fecha_fin) { sql += ` AND DATE(oc.fecha_emision) <= ?`; params.push(fecha_fin); }
    
    if (mes && anio) {
      sql += ` AND MONTH(oc.fecha_emision) = ? AND YEAR(oc.fecha_emision) = ?`;
      params.push(mes, anio);
    } else if (anio) {
      sql += ` AND YEAR(oc.fecha_emision) = ?`;
      params.push(anio);
    }
    
    if (alertas === 'proximas_vencer') {
      sql += ` AND oc.saldo_pendiente > 0 AND DATEDIFF(oc.fecha_vencimiento, CURDATE()) BETWEEN 0 AND 7`;
    } else if (alertas === 'vencidas') {
      sql += ` AND oc.saldo_pendiente > 0 AND oc.fecha_vencimiento < CURDATE()`;
    } else if (alertas === 'pendiente_pago') {
      sql += ` AND oc.estado_pago = 'Pendiente'`;
    } else if (alertas === 'pago_parcial') {
      sql += ` AND oc.estado_pago = 'Parcial'`;
    } else if (alertas === 'sin_cronograma') {
      sql += ` AND oc.tipo_compra = 'Credito' AND oc.cronograma_definido = 0`;
    }
    
    sql += ` ORDER BY oc.fecha_emision DESC, oc.id_orden_compra DESC`;
    
    const result = await executeQuery(sql, params);
    
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    
    res.json({ success: true, data: result.data, total: result.data.length });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getCompraById(req, res) {
  try {
    const { id } = req.params;
    
    const compraResult = await executeQuery(`
      SELECT 
        oc.*,
        pr.razon_social AS proveedor,
        pr.ruc AS ruc_proveedor,
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
    
    if (!compraResult.success) return res.status(500).json({ success: false, error: compraResult.error });
    if (compraResult.data.length === 0) return res.status(404).json({ success: false, error: 'Compra no encontrada' });
    
    const compra = compraResult.data[0];
    
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
    
    if (!detalleResult.success) return res.status(500).json({ success: false, error: detalleResult.error });
    compra.detalle = detalleResult.data;
    
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
    
    if (cuotasResult.success) compra.cuotas = cuotasResult.data;

    const pagosResult = await executeQuery(`
        SELECT 
            mc.*, 
            cp.nombre as cuenta_origen,
            cp.tipo as tipo_cuenta
        FROM movimientos_cuentas mc
        JOIN cuentas_pago cp ON mc.id_cuenta = cp.id_cuenta
        WHERE mc.id_orden_compra = ?
        ORDER BY mc.fecha_movimiento DESC
    `, [id]);
    compra.pagos_realizados = pagosResult.data || [];
    
    res.json({ success: true, data: compra });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createCompra(req, res) {
  let connection;
  try {
    const {
      id_proveedor, id_cuenta_pago, fecha_emision, fecha_entrega_estimada, fecha_vencimiento,
      prioridad, moneda, tipo_compra, numero_cuotas, dias_entre_cuotas, dias_credito,
      tipo_impuesto, porcentaje_impuesto, observaciones, id_responsable, contacto_proveedor,
      direccion_entrega, tipo_cambio, detalle, tipo_recepcion, tipo_documento,
      serie_documento, numero_documento, fecha_emision_documento,
      monto_pagado_inicial, url_comprobante
    } = req.body;

    const id_registrado_por = req.user?.id_empleado || null;

    if (!id_proveedor || !detalle || detalle.length === 0) return res.status(400).json({ success: false, error: 'Datos incompletos' });
    if (!id_registrado_por) return res.status(400).json({ success: false, error: 'Usuario no autenticado' });
    if (!moneda) return res.status(400).json({ success: false, error: 'Especifique la moneda' });

    let subtotal = 0;
    let subtotalRecepcion = 0;
    let tieneItemsParaRecepcion = false;

    for (const item of detalle) {
      const precioUnitario = parseFloat(item.precio_unitario);
      const valorCompra = (item.cantidad * precioUnitario) * (1 - parseFloat(item.descuento_porcentaje || 0) / 100);
      subtotal += valorCompra;

      let cantidadRecibirAhora = 0;
      if (tipo_recepcion === 'Total') {
        cantidadRecibirAhora = parseFloat(item.cantidad);
      } else if (tipo_recepcion === 'Parcial') {
        cantidadRecibirAhora = parseFloat(item.cantidad_a_recibir || 0);
      }

      if (cantidadRecibirAhora > 0) {
        const valorRecepcion = (cantidadRecibirAhora * precioUnitario) * (1 - parseFloat(item.descuento_porcentaje || 0) / 100);
        subtotalRecepcion += valorRecepcion;
        tieneItemsParaRecepcion = true;
      }
    }

    const tipoImpuestoFinal = tipo_impuesto || 'IGV';
    let porcentaje = 18.00;
    if (tipoImpuestoFinal === 'EXO' || tipoImpuestoFinal === 'INA') porcentaje = 0.00;
    else if (porcentaje_impuesto !== null && porcentaje_impuesto !== undefined) porcentaje = parseFloat(porcentaje_impuesto);

    const impuesto = subtotal * (porcentaje / 100);
    const total = subtotal + impuesto;
    const impuestoRecepcion = subtotalRecepcion * (porcentaje / 100);
    const totalRecepcion = subtotalRecepcion + impuestoRecepcion;

    const pagoInicial = parseFloat(monto_pagado_inicial || 0);
    const saldoPendiente = total - pagoInicial;
    const estadoPago = 'Pendiente';

    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [cuentas] = await connection.query('SELECT * FROM cuentas_pago WHERE id_cuenta = ? AND estado = "Activo"', [id_cuenta_pago]);
      let cuenta = null;
      let tipoCambioFinal = parseFloat(tipo_cambio || 1.0000);

      if (id_cuenta_pago) {
        if (cuentas.length === 0) throw new Error('Cuenta de pago no válida');
        cuenta = cuentas[0];
        
        if (cuenta.moneda !== moneda) {
            if (!tipo_cambio || parseFloat(tipo_cambio) <= 0) throw new Error(`Falta tipo de cambio: ${cuenta.moneda} vs ${moneda}`);
        }
      }

      const [ultimaResult] = await connection.query('SELECT numero_orden FROM ordenes_compra ORDER BY id_orden_compra DESC LIMIT 1');
      let numeroSecuencia = 1;
      if (ultimaResult.length > 0) {
        const match = ultimaResult[0].numero_orden.match(/(\d+)$/);
        if (match) numeroSecuencia = parseInt(match[1]) + 1;
      }
      const numeroCompra = `COM-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(5, '0')}`;

      let fechaVencimientoFinal = fecha_vencimiento;
      if (!fechaVencimientoFinal) {
        const fechaBase = new Date(fecha_emision);
        let diasTotal = 30;
        if (tipo_compra === 'Credito') {
          if (dias_credito) diasTotal = parseInt(dias_credito);
          else if (numero_cuotas && dias_entre_cuotas) diasTotal = parseInt(numero_cuotas) * parseInt(dias_entre_cuotas);
        }
        fechaBase.setDate(fechaBase.getDate() + diasTotal);
        fechaVencimientoFinal = fechaBase.toISOString().split('T')[0];
      }

      let estadoOrden = 'Confirmada';
      if (tipo_recepcion === 'Total') estadoOrden = 'Recibida';

      const [resultCompra] = await connection.query(`
        INSERT INTO ordenes_compra (
          numero_orden, id_proveedor, id_cuenta_pago, fecha_emision, fecha_entrega_estimada, fecha_vencimiento,
          prioridad, moneda, tipo_cambio, tipo_impuesto, porcentaje_impuesto, tipo_compra,
          numero_cuotas, dias_entre_cuotas, dias_credito, contacto_proveedor, direccion_entrega,
          observaciones, id_responsable, id_registrado_por, subtotal, igv, total,
          estado, estado_pago, saldo_pendiente, monto_pagado, cronograma_definido,
          tipo_documento, serie_documento, numero_documento, fecha_emision_documento, url_comprobante
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
      `, [
        numeroCompra, id_proveedor, id_cuenta_pago || null, fecha_emision, fecha_entrega_estimada || null, fechaVencimientoFinal,
        prioridad || 'Media', moneda, tipoCambioFinal, tipoImpuestoFinal, porcentaje, tipo_compra,
        tipo_compra === 'Credito' ? parseInt(numero_cuotas || 0) : 0,
        tipo_compra === 'Credito' ? parseInt(dias_entre_cuotas || 30) : 0,
        tipo_compra === 'Credito' ? parseInt(dias_credito || 30) : 0,
        contacto_proveedor || null, direccion_entrega || null, observaciones, id_responsable || null, id_registrado_por,
        subtotal, impuesto, total, estadoOrden, estadoPago, saldoPendiente, pagoInicial,
        tipo_documento || null, serie_documento || null, numero_documento || null, fecha_emision_documento || null, url_comprobante || null
      ]);

      const idCompra = resultCompra.insertId;
      let idEntrada = null;

      if (tieneItemsParaRecepcion) {
        const [primerProducto] = await connection.query('SELECT id_tipo_inventario FROM productos WHERE id_producto = ?', [detalle[0].id_producto]);
        const id_tipo_inventario_entrada = primerProducto[0]?.id_tipo_inventario;
        if (!id_tipo_inventario_entrada) throw new Error('Error al determinar inventario');

        const [resultEntrada] = await connection.query(`
          INSERT INTO entradas ( 
            id_tipo_inventario, tipo_entrada, id_proveedor, documento_soporte, total_costo, subtotal, igv, total, porcentaje_igv, 
            moneda, tipo_cambio, monto_pagado, estado_pago, id_cuenta_pago, id_registrado_por, observaciones, id_orden_compra
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id_tipo_inventario_entrada, 'Compra', id_proveedor, numero_documento ? `${serie_documento}-${numero_documento}` : numeroCompra,
          subtotalRecepcion, subtotalRecepcion, impuestoRecepcion, totalRecepcion, porcentaje, moneda, tipoCambioFinal,
          pagoInicial >= totalRecepcion ? totalRecepcion : pagoInicial,
          pagoInicial >= totalRecepcion ? 'Pagado' : 'Pendiente',
          id_cuenta_pago, id_registrado_por, `Entrada por Compra ${numeroCompra}`, idCompra
        ]);
        idEntrada = resultEntrada.insertId;
      }

      for (let i = 0; i < detalle.length; i++) {
        const item = detalle[i];
        const precioUnitario = parseFloat(item.precio_unitario);
        const descuento = parseFloat(item.descuento_porcentaje || 0);
        const subtotalItem = (item.cantidad * precioUnitario) * (1 - descuento / 100);
        
        let cantidadRecibida = 0;
        if (tipo_recepcion === 'Total') cantidadRecibida = parseFloat(item.cantidad);
        else if (tipo_recepcion === 'Parcial') cantidadRecibida = parseFloat(item.cantidad_a_recibir || 0);

        await connection.query(`
          INSERT INTO detalle_orden_compra (id_orden_compra, id_producto, cantidad, cantidad_recibida, precio_unitario, descuento_porcentaje, subtotal, orden)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [idCompra, item.id_producto, parseFloat(item.cantidad), cantidadRecibida, precioUnitario, descuento, subtotalItem, i + 1]);

        if (idEntrada && cantidadRecibida > 0) {
          const costoUnitarioNeto = precioUnitario * (1 - descuento / 100);
          let costoPEN = 0, costoUSD = 0;

          if (moneda === 'PEN') {
            costoPEN = costoUnitarioNeto;
            costoUSD = costoUnitarioNeto / tipoCambioFinal;
          } else {
            costoUSD = costoUnitarioNeto;
            costoPEN = costoUnitarioNeto * tipoCambioFinal;
          }

          await connection.query(`
            INSERT INTO detalle_entradas (id_entrada, id_producto, cantidad, costo_unitario, costo_unitario_calculado_pen, costo_unitario_calculado_usd)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [idEntrada, item.id_producto, cantidadRecibida, costoUnitarioNeto, costoPEN, costoUSD]);

          const [productoInfo] = await connection.query('SELECT stock_actual, costo_unitario_promedio, costo_unitario_promedio_usd FROM productos WHERE id_producto = ? FOR UPDATE', [item.id_producto]);
          const stockActual = parseFloat(productoInfo[0].stock_actual || 0);
          const cupActualPEN = parseFloat(productoInfo[0].costo_unitario_promedio || 0);
          const cupActualUSD = parseFloat(productoInfo[0].costo_unitario_promedio_usd || 0);
          const nuevoStock = stockActual + cantidadRecibida;
          
          const nuevoCostoPromedioPEN = nuevoStock > 0 
            ? ((stockActual * cupActualPEN) + (cantidadRecibida * costoPEN)) / nuevoStock 
            : costoPEN;
            
          const nuevoCostoPromedioUSD = nuevoStock > 0 
            ? ((stockActual * cupActualUSD) + (cantidadRecibida * costoUSD)) / nuevoStock 
            : costoUSD;

          await connection.query(`
            UPDATE productos SET stock_actual = ?, costo_unitario_promedio = ?, costo_unitario_promedio_usd = ? WHERE id_producto = ?
          `, [nuevoStock, nuevoCostoPromedioPEN, nuevoCostoPromedioUSD, item.id_producto]);
        }
      }

      await connection.commit();
      res.status(201).json({ success: true, message: 'Compra registrada exitosamente', data: { id: idCompra, numero: numeroCompra } });

    } catch (err) {
      await connection.rollback();
      throw err;
    }
  } catch (error) {
    console.error(error);
    if (connection) connection.release();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
}

export async function establecerCronograma(req, res) {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { cuotas, url_letras } = req.body;
        
        await connection.beginTransaction();

        const [compra] = await connection.query('SELECT total, saldo_pendiente FROM ordenes_compra WHERE id_orden_compra = ?', [id]);
        if(compra.length === 0) throw new Error("Compra no encontrada");

        const totalLetras = cuotas.reduce((acc, c) => acc + parseFloat(c.monto), 0);
        
        if (Math.abs(totalLetras - parseFloat(compra[0].saldo_pendiente)) > 1.00) {
            throw new Error(`La suma de las letras (${totalLetras}) no coincide con el saldo pendiente (${compra[0].saldo_pendiente})`);
        }

        await connection.query('DELETE FROM cuotas_orden_compra WHERE id_orden_compra = ? AND estado = "Pendiente"', [id]);

        for (const cuota of cuotas) {
            await connection.query(`
                INSERT INTO cuotas_orden_compra (
                    id_orden_compra, numero_cuota, codigo_letra, monto_cuota, fecha_vencimiento, estado
                ) VALUES (?, ?, ?, ?, ?, 'Pendiente')
            `, [id, cuota.numero, cuota.codigo_letra || null, cuota.monto, cuota.fecha_vencimiento]);
        }

        await connection.query(`
            UPDATE ordenes_compra 
            SET cronograma_definido = 1, url_letras = ? 
            WHERE id_orden_compra = ?
        `, [url_letras || null, id]);

        await connection.commit();
        res.json({ success: true, message: 'Cronograma de letras establecido correctamente' });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

export async function updateCompra(req, res) {
  try {
    const { id } = req.params;
    const {
      id_proveedor, fecha_emision, fecha_entrega_estimada, prioridad, observaciones,
      id_responsable, contacto_proveedor, direccion_entrega, detalle
    } = req.body;

    const compraExistente = await executeQuery('SELECT estado FROM ordenes_compra WHERE id_orden_compra = ?', [id]);
    if (!compraExistente.success || compraExistente.data.length === 0) return res.status(404).json({ success: false, error: 'Compra no encontrada' });
    if (compraExistente.data[0].estado === 'Recibida') return res.status(400).json({ success: false, error: 'No se pueden editar compras ya recibidas.' });

    let subtotal = 0;
    for (const item of detalle) {
      const precio = parseFloat(item.precio_unitario);
      const desc = parseFloat(item.descuento_porcentaje || 0);
      subtotal += (item.cantidad * precio) * (1 - desc / 100);
    }
    const impuesto = subtotal * 0.18;
    const total = subtotal + impuesto;

    await executeQuery(`
      UPDATE ordenes_compra SET id_proveedor=?, fecha_emision=?, fecha_entrega_estimada=?, prioridad=?, observaciones=?, id_responsable=?, contacto_proveedor=?, direccion_entrega=?, subtotal=?, igv=?, total=? WHERE id_orden_compra=?
    `, [id_proveedor, fecha_emision, fecha_entrega_estimada||null, prioridad||'Media', observaciones, id_responsable||null, contacto_proveedor||null, direccion_entrega||null, subtotal, impuesto, total, id]);

    await executeQuery('DELETE FROM detalle_orden_compra WHERE id_orden_compra = ?', [id]);

    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      const precio = parseFloat(item.precio_unitario);
      const desc = parseFloat(item.descuento_porcentaje || 0);
      const subItem = (item.cantidad * precio) * (1 - desc / 100);
      await executeQuery(`
        INSERT INTO detalle_orden_compra (id_orden_compra, id_producto, cantidad, precio_unitario, descuento_porcentaje, subtotal, orden) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, item.id_producto, parseFloat(item.cantidad), precio, desc, subItem, i+1]);
    }

    res.json({ success: true, message: 'Compra actualizada exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function cancelarCompra(req, res) {
  try {
    const { id } = req.params;
    const { motivo_cancelacion } = req.body;
    
    const compraResult = await executeQuery('SELECT * FROM ordenes_compra WHERE id_orden_compra = ?', [id]);
    if (!compraResult.success || compraResult.data.length === 0) return res.status(404).json({ success: false, error: 'Compra no encontrada' });
    
    const compra = compraResult.data[0];
    if (compra.estado === 'Cancelada') return res.status(400).json({ success: false, error: 'Ya está cancelada' });
    if (parseFloat(compra.monto_pagado || 0) > 0) return res.status(400).json({ success: false, error: 'No se puede cancelar una compra con pagos' });
    
    const operations = async (connection) => {
      await connection.query(`UPDATE ordenes_compra SET estado='Cancelada', observaciones=CONCAT(COALESCE(observaciones,''), '\n[CANCELADA] ', ?) WHERE id_orden_compra=?`, [motivo_cancelacion||'Sin motivo', id]);
      await connection.query(`UPDATE cuotas_orden_compra SET estado='Cancelada' WHERE id_orden_compra=? AND estado='Pendiente'`, [id]);
      
      const [detalles] = await connection.query('SELECT id_producto, cantidad FROM detalle_orden_compra WHERE id_orden_compra = ?', [id]);
      for (const d of detalles) {
        await connection.query('UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?', [d.cantidad, d.id_producto]);
      }
      return { cancelada: true };
    };
    
    const result = await executeTransaction(operations);
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    res.json({ success: true, message: 'Compra cancelada exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getCuotasCompra(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.query;
    let sql = `SELECT coc.*, DATEDIFF(coc.fecha_vencimiento, CURDATE()) AS dias_para_vencer FROM cuotas_orden_compra coc WHERE coc.id_orden_compra = ?`;
    const params = [id];
    if (estado) { sql += ' AND coc.estado = ?'; params.push(estado); }
    sql += ' ORDER BY coc.numero_cuota';
    const result = await executeQuery(sql, params);
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getCuotaById(req, res) {
  try {
    const { id, idCuota } = req.params;
    const result = await executeQuery(`
      SELECT coc.*, oc.numero_orden, oc.moneda, oc.id_proveedor, oc.id_cuenta_pago, pr.razon_social AS proveedor, cp.nombre AS cuenta_pago
      FROM cuotas_orden_compra coc
      INNER JOIN ordenes_compra oc ON coc.id_orden_compra = oc.id_orden_compra
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
      WHERE coc.id_cuota = ? AND coc.id_orden_compra = ?
    `, [idCuota, id]);
    
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    if (result.data.length === 0) return res.status(404).json({ success: false, error: 'Cuota no encontrada' });
    
    const cuota = result.data[0];
    const pagosResult = await executeQuery(`
      SELECT mc.*, cp.nombre AS cuenta_pago, e.nombre_completo AS registrado_por_nombre
      FROM movimientos_cuentas mc
      LEFT JOIN cuentas_pago cp ON mc.id_cuenta = cp.id_cuenta
      LEFT JOIN empleados e ON mc.id_registrado_por = e.id_empleado
      WHERE mc.id_cuota = ? ORDER BY mc.fecha_movimiento DESC
    `, [idCuota]);
    
    cuota.historial_pagos = pagosResult.data || [];
    res.json({ success: true, data: cuota });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function pagarCuota(req, res) {
  try {
    const { id, idCuota } = req.params;
    const { id_cuenta_pago, monto_pagado, referencia, observaciones } = req.body;
    const id_registrado_por = req.user?.id_empleado || null;
    
    if (!id_cuenta_pago || !monto_pagado) return res.status(400).json({ success: false, error: 'Faltan datos' });

    const operations = async (connection) => {
      const [cuotas] = await connection.query('SELECT coc.*, oc.moneda, oc.total, oc.monto_pagado FROM cuotas_orden_compra coc INNER JOIN ordenes_compra oc ON coc.id_orden_compra = oc.id_orden_compra WHERE coc.id_cuota = ? FOR UPDATE', [idCuota]);
      if (cuotas.length === 0) throw new Error('Cuota no encontrada');
      const cuota = cuotas[0];
      if (cuota.estado === 'Pagada') throw new Error('Cuota ya pagada');

      const [cuentas] = await connection.query('SELECT * FROM cuentas_pago WHERE id_cuenta = ? FOR UPDATE', [id_cuenta_pago]);
      if (cuentas.length === 0) throw new Error('Cuenta no encontrada');
      const cuenta = cuentas[0];
      if (cuenta.moneda !== cuota.moneda) throw new Error('Moneda no coincide');

      const nuevoSaldoCuenta = parseFloat(cuenta.saldo_actual) - parseFloat(monto_pagado);
      await connection.query('UPDATE cuentas_pago SET saldo_actual = ? WHERE id_cuenta = ?', [nuevoSaldoCuenta, id_cuenta_pago]);

      await connection.query(`
        INSERT INTO movimientos_cuentas (id_cuenta, tipo_movimiento, monto, concepto, referencia, id_orden_compra, id_cuota, saldo_anterior, saldo_nuevo, id_registrado_por, fecha_movimiento)
        VALUES (?, 'Egreso', ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [id_cuenta_pago, monto_pagado, observaciones||`Pago Cuota ${cuota.numero_cuota}`, referencia, id, idCuota, cuenta.saldo_actual, nuevoSaldoCuenta, id_registrado_por]);

      const nuevoPagadoCuota = parseFloat(cuota.monto_pagado || 0) + parseFloat(monto_pagado);
      const estadoCuota = nuevoPagadoCuota >= parseFloat(cuota.monto_cuota) - 0.01 ? 'Pagada' : 'Parcial';
      await connection.query('UPDATE cuotas_orden_compra SET monto_pagado = ?, estado = ?, fecha_pago = NOW() WHERE id_cuota = ?', [nuevoPagadoCuota, estadoCuota, idCuota]);

      await connection.query('UPDATE ordenes_compra SET monto_pagado = monto_pagado + ?, saldo_pendiente = saldo_pendiente - ? WHERE id_orden_compra = ?', [monto_pagado, monto_pagado, id]);
      
      return { nuevo_saldo: nuevoSaldoCuenta };
    };

    const result = await executeTransaction(operations);
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    res.json({ success: true, message: 'Cuota pagada', data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function registrarPagoCompra(req, res) {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { id_cuenta_pago, monto_pagado, referencia, observaciones } = req.body;
    const id_registrado_por = req.user?.id_empleado || null;

    await connection.beginTransaction();

    const [compras] = await connection.query('SELECT * FROM ordenes_compra WHERE id_orden_compra = ? FOR UPDATE', [id]);
    const compra = compras[0];

    if (parseFloat(compra.saldo_pendiente) <= 0) throw new Error('La compra ya está pagada');
    if (parseFloat(monto_pagado) > parseFloat(compra.saldo_pendiente) + 0.1) throw new Error('Monto excede saldo pendiente');

    await connection.query('UPDATE cuentas_pago SET saldo_actual = saldo_actual - ? WHERE id_cuenta = ?', [monto_pagado, id_cuenta_pago]);
    const [cuentaInfo] = await connection.query('SELECT saldo_actual FROM cuentas_pago WHERE id_cuenta = ?', [id_cuenta_pago]);

    await connection.query(`
        INSERT INTO movimientos_cuentas (id_cuenta, tipo_movimiento, monto, concepto, referencia, id_orden_compra, saldo_anterior, saldo_nuevo, id_registrado_por, fecha_movimiento)
        VALUES (?, 'Egreso', ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [id_cuenta_pago, monto_pagado, observaciones || `Amortización Compra ${compra.numero_orden}`, referencia, id, parseFloat(cuentaInfo[0].saldo_actual) + parseFloat(monto_pagado), cuentaInfo[0].saldo_actual, id_registrado_por]);

    const nuevoMontoPagado = parseFloat(compra.monto_pagado) + parseFloat(monto_pagado);
    const nuevoSaldo = parseFloat(compra.saldo_pendiente) - parseFloat(monto_pagado);
    const nuevoEstado = nuevoSaldo <= 0.01 ? 'Pagado' : 'Parcial';

    await connection.query('UPDATE ordenes_compra SET monto_pagado = ?, saldo_pendiente = ?, estado_pago = ? WHERE id_orden_compra = ?', [nuevoMontoPagado, nuevoSaldo, nuevoEstado, id]);

    await connection.commit();
    res.json({ success: true, message: 'Pago registrado', data: { nuevo_saldo: nuevoSaldo } });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
}

export async function getAlertasCompras(req, res) {
  try {
    const { tipo_cuenta, id_cuenta_pago } = req.query;
    let whereClause = '';
    const params = [];
    if (tipo_cuenta) { whereClause += ' AND cp.tipo = ?'; params.push(tipo_cuenta); }
    if (id_cuenta_pago) { whereClause += ' AND oc.id_cuenta_pago = ?'; params.push(id_cuenta_pago); }
    
    const result = await executeQuery(`
      SELECT 'cuotas_vencidas' as tipo_alerta, COUNT(DISTINCT coc.id_cuota) as cantidad, SUM(coc.monto_cuota - COALESCE(coc.monto_pagado, 0)) as monto_total
      FROM cuotas_orden_compra coc JOIN ordenes_compra oc ON coc.id_orden_compra = oc.id_orden_compra LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
      WHERE coc.estado != 'Pagada' AND coc.fecha_vencimiento < CURDATE() ${whereClause}
      UNION ALL
      SELECT 'compras_vencidas' as tipo_alerta, COUNT(DISTINCT oc.id_orden_compra) as cantidad, SUM(oc.saldo_pendiente) as monto_total
      FROM ordenes_compra oc LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta
      WHERE oc.saldo_pendiente > 0 AND oc.fecha_vencimiento < CURDATE() ${whereClause}
    `, [...params, ...params]);
    
    const alertas = {};
    result.data.forEach(row => { alertas[row.tipo_alerta] = { cantidad: row.cantidad, monto_total: parseFloat(row.monto_total || 0) }; });
    res.json({ success: true, data: alertas });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getEstadisticasCompras(req, res) {
  try {
    const { mes, anio, tipo_cuenta, id_cuenta_pago } = req.query;
    let whereClause = "WHERE oc.estado != 'Cancelada'";
    const params = [];
    if (mes && anio) { whereClause += ' AND MONTH(oc.fecha_emision) = ? AND YEAR(oc.fecha_emision) = ?'; params.push(mes, anio); }
    const result = await executeQuery(`
      SELECT COUNT(*) AS total_compras, SUM(oc.total) AS monto_total, SUM(oc.monto_pagado) AS monto_pagado, SUM(oc.saldo_pendiente) AS saldo_pendiente
      FROM ordenes_compra oc LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta ${whereClause}
    `, params);
    res.json({ success: true, data: result.data[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getResumenPagosCompra(req, res) {
  try {
    const { id } = req.params;
    const compraResult = await executeQuery(`
      SELECT oc.numero_orden, oc.tipo_compra, oc.total, oc.monto_pagado, oc.saldo_pendiente, oc.estado_pago, oc.moneda, cp.nombre AS cuenta_pago
      FROM ordenes_compra oc LEFT JOIN cuentas_pago cp ON oc.id_cuenta_pago = cp.id_cuenta WHERE oc.id_orden_compra = ?
    `, [id]);
    if (!compraResult.success || !compraResult.data.length) return res.status(404).json({ success: false, error: 'No encontrada' });
    const compra = compraResult.data[0];
    
    let cuotasInfo = null;
    if (compra.tipo_compra === 'Credito') {
      const cuotas = await executeQuery(`
        SELECT COUNT(*) as total, SUM(CASE WHEN estado='Pagada' THEN 1 ELSE 0 END) as pagadas, SUM(CASE WHEN estado!='Pagada' AND fecha_vencimiento<CURDATE() THEN 1 ELSE 0 END) as vencidas
        FROM cuotas_orden_compra WHERE id_orden_compra = ?
      `, [id]);
      cuotasInfo = cuotas.data[0];
    }
    res.json({ success: true, data: { ...compra, cuotas_info: cuotasInfo } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getHistorialPagosCompra(req, res) {
  try {
    const { id } = req.params;
    const result = await executeQuery(`
      SELECT mc.*, cp.nombre AS cuenta_pago, e.nombre_completo AS registrado_por FROM movimientos_cuentas mc 
      LEFT JOIN cuentas_pago cp ON mc.id_cuenta = cp.id_cuenta LEFT JOIN empleados e ON mc.id_registrado_por = e.id_empleado
      WHERE mc.id_orden_compra = ? ORDER BY mc.fecha_movimiento DESC
    `, [id]);
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function descargarPDFCompra(req, res) {
  try {
    const { id } = req.params;
    const compraResult = await executeQuery('SELECT * FROM ordenes_compra WHERE id_orden_compra = ?', [id]);
    if (!compraResult.success || !compraResult.data.length) return res.status(404).send('No encontrado');
    const compra = compraResult.data[0];
    const detalleResult = await executeQuery(`SELECT doc.*, p.nombre as producto, p.unidad_medida FROM detalle_orden_compra doc JOIN productos p ON doc.id_producto=p.id_producto WHERE doc.id_orden_compra=?`, [id]);
    compra.detalle = detalleResult.data;
    const pdfBuffer = await generarCompraPDF(compra);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="OC-${compra.numero_orden}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).send(error.message);
  }
}

export async function getComprasPorCuenta(req, res) {
  try {
    const result = await executeQuery(`
      SELECT cp.nombre, COUNT(oc.id_orden_compra) as cantidad, SUM(oc.total) as total FROM cuentas_pago cp 
      JOIN ordenes_compra oc ON cp.id_cuenta = oc.id_cuenta_pago GROUP BY cp.nombre
    `);
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
export async function registrarLetrasCompra(req, res) {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { letras } = req.body;
    const id_registrado_por = req.user?.id_empleado || null;

    if (!letras || letras.length === 0) {
      return res.status(400).json({ success: false, error: 'Debe proporcionar al menos una letra' });
    }

    await connection.beginTransaction();

    const [compras] = await connection.query(
      'SELECT * FROM ordenes_compra WHERE id_orden_compra = ? FOR UPDATE',
      [id]
    );

    if (compras.length === 0) {
      throw new Error('Orden de compra no encontrada');
    }

    const compra = compras[0];

    if (compra.forma_pago_detalle !== 'Letras') {
      throw new Error('Esta orden no está configurada para pago con letras');
    }

    if (compra.letras_registradas === 1) {
      throw new Error('Las letras ya fueron registradas para esta orden');
    }

    const totalLetras = letras.reduce((sum, l) => sum + parseFloat(l.monto), 0);
    
    if (Math.abs(totalLetras - parseFloat(compra.saldo_pendiente)) > 1.00) {
      throw new Error(
        `La suma de las letras (${totalLetras.toFixed(2)}) no coincide con el saldo pendiente (${parseFloat(compra.saldo_pendiente).toFixed(2)})`
      );
    }

    for (const letra of letras) {
      await connection.query(`
        INSERT INTO letras_compra (
          id_orden_compra, numero_letra, monto, fecha_emision, 
          fecha_vencimiento, banco, observaciones, id_registrado_por
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        letra.numero_letra,
        parseFloat(letra.monto),
        letra.fecha_emision || new Date().toISOString().split('T')[0],
        letra.fecha_vencimiento,
        letra.banco || null,
        letra.observaciones || null,
        id_registrado_por
      ]);
    }

    await connection.query(`
      UPDATE ordenes_compra 
      SET letras_registradas = 1, fecha_registro_letras = CURDATE() 
      WHERE id_orden_compra = ?
    `, [id]);

    await connection.commit();

    res.json({ 
      success: true, 
      message: `${letras.length} letra(s) registrada(s) exitosamente` 
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
}

export async function getLetrasCompra(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.query;

    let sql = `
      SELECT 
        lc.*,
        DATEDIFF(lc.fecha_vencimiento, CURDATE()) AS dias_para_vencer,
        (lc.monto - COALESCE((
          SELECT SUM(plc.monto_pagado) 
          FROM pagos_letras_compra plc 
          WHERE plc.id_letra = lc.id_letra
        ), 0)) AS saldo_pendiente,
        CASE 
          WHEN lc.estado = 'Pagada' THEN 'success'
          WHEN lc.fecha_vencimiento < CURDATE() AND lc.estado = 'Pendiente' THEN 'danger'
          WHEN DATEDIFF(lc.fecha_vencimiento, CURDATE()) <= 7 AND lc.estado = 'Pendiente' THEN 'warning'
          ELSE 'info'
        END AS nivel_alerta
      FROM letras_compra lc
      WHERE lc.id_orden_compra = ?
    `;

    const params = [id];

    if (estado) {
      sql += ' AND lc.estado = ?';
      params.push(estado);
    }

    sql += ' ORDER BY lc.fecha_vencimiento ASC, lc.numero_letra ASC';

    const result = await executeQuery(sql, params);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result.data });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function pagarLetraCompra(req, res) {
  const connection = await pool.getConnection();
  try {
    const { idLetra } = req.params;
    const { id_cuenta_pago, monto_pagado, metodo_pago, numero_operacion, observaciones } = req.body;
    const id_registrado_por = req.user?.id_empleado || null;

    if (!id_cuenta_pago || !monto_pagado) {
      return res.status(400).json({ success: false, error: 'Faltan datos requeridos' });
    }

    await connection.beginTransaction();

    const [letras] = await connection.query(`
      SELECT lc.*, oc.moneda, oc.numero_orden
      FROM letras_compra lc
      INNER JOIN ordenes_compra oc ON lc.id_orden_compra = oc.id_orden_compra
      WHERE lc.id_letra = ? FOR UPDATE
    `, [idLetra]);

    if (letras.length === 0) {
      throw new Error('Letra no encontrada');
    }

    const letra = letras[0];

    if (letra.estado === 'Pagada') {
      throw new Error('La letra ya está pagada');
    }

    const [pagosAnteriores] = await connection.query(
      'SELECT COALESCE(SUM(monto_pagado), 0) as total_pagado FROM pagos_letras_compra WHERE id_letra = ?',
      [idLetra]
    );

    const totalPagado = parseFloat(pagosAnteriores[0].total_pagado);
    const saldoLetra = parseFloat(letra.monto) - totalPagado;

    if (parseFloat(monto_pagado) > saldoLetra + 0.01) {
      throw new Error(`El monto excede el saldo pendiente de la letra (${saldoLetra.toFixed(2)})`);
    }

    const [cuentas] = await connection.query(
      'SELECT * FROM cuentas_pago WHERE id_cuenta = ? AND estado = "Activo" FOR UPDATE',
      [id_cuenta_pago]
    );

    if (cuentas.length === 0) {
      throw new Error('Cuenta de pago no encontrada o inactiva');
    }

    const cuenta = cuentas[0];

    if (cuenta.moneda !== letra.moneda) {
      throw new Error(`La moneda de la cuenta (${cuenta.moneda}) no coincide con la de la letra (${letra.moneda})`);
    }

    if (parseFloat(cuenta.saldo_actual) < parseFloat(monto_pagado)) {
      throw new Error('Saldo insuficiente en la cuenta');
    }

    const nuevoSaldoCuenta = parseFloat(cuenta.saldo_actual) - parseFloat(monto_pagado);

    await connection.query(
      'UPDATE cuentas_pago SET saldo_actual = ? WHERE id_cuenta = ?',
      [nuevoSaldoCuenta, id_cuenta_pago]
    );

    await connection.query(`
      INSERT INTO pagos_letras_compra (
        id_letra, id_cuenta_pago, monto_pagado, fecha_pago, 
        metodo_pago, numero_operacion, observaciones, id_registrado_por
      ) VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?)
    `, [
      idLetra,
      id_cuenta_pago,
      monto_pagado,
      metodo_pago || null,
      numero_operacion || null,
      observaciones || null,
      id_registrado_por
    ]);

    const nuevoTotalPagado = totalPagado + parseFloat(monto_pagado);
    const nuevoEstadoLetra = (nuevoTotalPagado >= parseFloat(letra.monto) - 0.01) ? 'Pagada' : 'Pendiente';

    await connection.query(
      'UPDATE letras_compra SET estado = ?, fecha_pago = CURDATE() WHERE id_letra = ?',
      [nuevoEstadoLetra, idLetra]
    );

    await connection.query(
      'UPDATE ordenes_compra SET monto_pagado = monto_pagado + ?, saldo_pendiente = saldo_pendiente - ? WHERE id_orden_compra = ?',
      [monto_pagado, monto_pagado, letra.id_orden_compra]
    );

    await connection.query(`
      INSERT INTO movimientos_cuentas (
        id_cuenta, tipo_movimiento, monto, concepto, referencia, 
        id_orden_compra, id_letra_compra, saldo_anterior, saldo_nuevo, 
        id_registrado_por, fecha_movimiento
      ) VALUES (?, 'Egreso', ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      id_cuenta_pago,
      monto_pagado,
      `Pago Letra ${letra.numero_letra} - OC ${letra.numero_orden}`,
      numero_operacion || letra.numero_letra,
      letra.id_orden_compra,
      idLetra,
      cuenta.saldo_actual,
      nuevoSaldoCuenta,
      id_registrado_por
    ]);

    await connection.commit();

    res.json({ 
      success: true, 
      message: 'Pago de letra registrado exitosamente',
      data: {
        nuevo_saldo_cuenta: nuevoSaldoCuenta,
        estado_letra: nuevoEstadoLetra
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
}

export async function registrarReembolsoComprador(req, res) {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { id_cuenta_pago, monto_reembolso, referencia, observaciones } = req.body;
    const id_registrado_por = req.user?.id_empleado || null;

    if (!id_cuenta_pago || !monto_reembolso) {
      return res.status(400).json({ success: false, error: 'Faltan datos requeridos' });
    }

    await connection.beginTransaction();

    const [compras] = await connection.query(
      'SELECT * FROM ordenes_compra WHERE id_orden_compra = ? FOR UPDATE',
      [id]
    );

    if (compras.length === 0) {
      throw new Error('Orden de compra no encontrada');
    }

    const compra = compras[0];

    if (compra.usa_fondos_propios !== 1) {
      throw new Error('Esta orden no utiliza fondos propios del comprador');
    }

    const saldoReembolso = parseFloat(compra.monto_reembolsar) - parseFloat(compra.monto_reembolsado);

    if (saldoReembolso <= 0) {
      throw new Error('No hay saldo pendiente de reembolso');
    }

    if (parseFloat(monto_reembolso) > saldoReembolso + 0.01) {
      throw new Error(`El monto excede el saldo pendiente de reembolso (${saldoReembolso.toFixed(2)})`);
    }

    const [cuentas] = await connection.query(
      'SELECT * FROM cuentas_pago WHERE id_cuenta = ? AND estado = "Activo" FOR UPDATE',
      [id_cuenta_pago]
    );

    if (cuentas.length === 0) {
      throw new Error('Cuenta de pago no encontrada');
    }

    const cuenta = cuentas[0];

    const nuevoSaldoCuenta = parseFloat(cuenta.saldo_actual) - parseFloat(monto_reembolso);

    await connection.query(
      'UPDATE cuentas_pago SET saldo_actual = ? WHERE id_cuenta = ?',
      [nuevoSaldoCuenta, id_cuenta_pago]
    );

    const [resultPago] = await connection.query(`
      INSERT INTO pagos_ordenes_compra (
        id_orden_compra, fecha_pago, monto_pagado, metodo_pago, 
        numero_operacion, observaciones, id_cuenta_bancaria_origen,
        tipo_pago, es_reembolso, id_empleado_beneficiario, id_registrado_por
      ) VALUES (?, CURDATE(), ?, ?, ?, ?, ?, 'Reembolso a Comprador', 1, ?, ?)
    `, [
      id,
      monto_reembolso,
      'Transferencia',
      referencia || null,
      observaciones || `Reembolso a comprador por OC ${compra.numero_orden}`,
      id_cuenta_pago,
      compra.id_comprador,
      id_registrado_por
    ]);

    const nuevoMontoReembolsado = parseFloat(compra.monto_reembolsado) + parseFloat(monto_reembolso);
    const nuevoEstadoReembolso = (nuevoMontoReembolsado >= parseFloat(compra.monto_reembolsar) - 0.01) 
      ? 'Completado' 
      : 'Parcial';

    await connection.query(`
      UPDATE ordenes_compra 
      SET monto_reembolsado = ?, estado_reembolso = ? 
      WHERE id_orden_compra = ?
    `, [nuevoMontoReembolsado, nuevoEstadoReembolso, id]);

    await connection.query(`
      INSERT INTO movimientos_cuentas (
        id_cuenta, tipo_movimiento, monto, concepto, referencia, 
        id_orden_compra, id_pago_orden_compra, es_reembolso, 
        id_empleado_relacionado, saldo_anterior, saldo_nuevo, 
        id_registrado_por, fecha_movimiento
      ) VALUES (?, 'Egreso', ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, NOW())
    `, [
      id_cuenta_pago,
      monto_reembolso,
      `Reembolso Comprador - OC ${compra.numero_orden}`,
      referencia || 'Reembolso fondos propios',
      id,
      resultPago.insertId,
      compra.id_comprador,
      cuenta.saldo_actual,
      nuevoSaldoCuenta,
      id_registrado_por
    ]);

    await connection.commit();

    res.json({
      success: true,
      message: 'Reembolso registrado exitosamente',
      data: {
        nuevo_saldo_reembolso: parseFloat(compra.monto_reembolsar) - nuevoMontoReembolsado,
        estado_reembolso: nuevoEstadoReembolso
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
}

export async function registrarIngresoInventario(req, res) {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { productos, observaciones } = req.body;
    const id_registrado_por = req.user?.id_empleado || null;

    if (!productos || productos.length === 0) {
      return res.status(400).json({ success: false, error: 'Debe especificar productos a ingresar' });
    }

    await connection.beginTransaction();

    const [compras] = await connection.query(`
      SELECT oc.*, pr.razon_social as proveedor
      FROM ordenes_compra oc
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      WHERE oc.id_orden_compra = ? FOR UPDATE
    `, [id]);

    if (compras.length === 0) {
      throw new Error('Orden de compra no encontrada');
    }

    const compra = compras[0];

    const [detalleOC] = await connection.query(
      'SELECT * FROM detalle_orden_compra WHERE id_orden_compra = ?',
      [id]
    );

    let subtotalIngreso = 0;
    let cantidadTotalIngresada = 0;

    for (const prod of productos) {
      const itemOC = detalleOC.find(d => d.id_producto == prod.id_producto);
      
      if (!itemOC) {
        throw new Error(`Producto ID ${prod.id_producto} no encontrado en la orden de compra`);
      }

      const cantidadPendiente = parseFloat(itemOC.cantidad) - parseFloat(itemOC.cantidad_recibida || 0);

      if (parseFloat(prod.cantidad_ingresar) > cantidadPendiente + 0.001) {
        throw new Error(`La cantidad a ingresar excede la cantidad pendiente para el producto ID ${prod.id_producto}`);
      }

      const precioUnitario = parseFloat(itemOC.precio_unitario);
      const descuento = parseFloat(itemOC.descuento_porcentaje || 0);
      const costoNeto = precioUnitario * (1 - descuento / 100);
      
      subtotalIngreso += costoNeto * parseFloat(prod.cantidad_ingresar);
      cantidadTotalIngresada += parseFloat(prod.cantidad_ingresar);
    }

    const porcentajeIGV = parseFloat(compra.porcentaje_impuesto || 18);
    const igvIngreso = subtotalIngreso * (porcentajeIGV / 100);
    const totalIngreso = subtotalIngreso + igvIngreso;

    const [primerProducto] = await connection.query(
      'SELECT id_tipo_inventario FROM productos WHERE id_producto = ?',
      [productos[0].id_producto]
    );

    const [resultEntrada] = await connection.query(`
      INSERT INTO entradas (
        id_tipo_inventario, tipo_entrada, id_proveedor, documento_soporte,
        total_costo, subtotal, igv, total, porcentaje_igv, moneda, tipo_cambio,
        monto_pagado, estado_pago, id_cuenta_pago, id_registrado_por,
        observaciones, id_orden_compra, cantidad_items_total, cantidad_items_ingresada, estado_ingreso
      ) VALUES (?, 'Compra', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Pendiente', ?, ?, ?, ?, 0, ?, 'Parcial')
    `, [
      primerProducto[0].id_tipo_inventario,
      compra.id_proveedor,
      compra.numero_documento ? `${compra.serie_documento}-${compra.numero_documento}` : compra.numero_orden,
      subtotalIngreso,
      subtotalIngreso,
      igvIngreso,
      totalIngreso,
      porcentajeIGV,
      compra.moneda,
      compra.tipo_cambio,
      compra.id_cuenta_pago,
      id_registrado_por,
      observaciones || `Ingreso parcial OC ${compra.numero_orden}`,
      id,
      cantidadTotalIngresada
    ]);

    const idEntrada = resultEntrada.insertId;

    for (const prod of productos) {
      const itemOC = detalleOC.find(d => d.id_producto == prod.id_producto);
      const precioUnitario = parseFloat(itemOC.precio_unitario);
      const descuento = parseFloat(itemOC.descuento_porcentaje || 0);
      const costoNeto = precioUnitario * (1 - descuento / 100);

      let costoPEN = 0, costoUSD = 0;
      if (compra.moneda === 'PEN') {
        costoPEN = costoNeto;
        costoUSD = costoNeto / parseFloat(compra.tipo_cambio);
      } else {
        costoUSD = costoNeto;
        costoPEN = costoNeto * parseFloat(compra.tipo_cambio);
      }

      await connection.query(`
        INSERT INTO detalle_entradas (
          id_entrada, id_producto, cantidad, costo_unitario,
          costo_unitario_calculado_pen, costo_unitario_calculado_usd
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [idEntrada, prod.id_producto, parseFloat(prod.cantidad_ingresar), costoNeto, costoPEN, costoUSD]);

      const [productoInfo] = await connection.query(
        'SELECT stock_actual, costo_unitario_promedio, costo_unitario_promedio_usd FROM productos WHERE id_producto = ? FOR UPDATE',
        [prod.id_producto]
      );

      const stockActual = parseFloat(productoInfo[0].stock_actual || 0);
      const cupActualPEN = parseFloat(productoInfo[0].costo_unitario_promedio || 0);
      const cupActualUSD = parseFloat(productoInfo[0].costo_unitario_promedio_usd || 0);
      const cantidadIngresada = parseFloat(prod.cantidad_ingresar);
      const nuevoStock = stockActual + cantidadIngresada;

      const nuevoCUP_PEN = nuevoStock > 0 
        ? ((stockActual * cupActualPEN) + (cantidadIngresada * costoPEN)) / nuevoStock 
        : costoPEN;

      const nuevoCUP_USD = nuevoStock > 0 
        ? ((stockActual * cupActualUSD) + (cantidadIngresada * costoUSD)) / nuevoStock 
        : costoUSD;

      await connection.query(
        'UPDATE productos SET stock_actual = ?, costo_unitario_promedio = ?, costo_unitario_promedio_usd = ? WHERE id_producto = ?',
        [nuevoStock, nuevoCUP_PEN, nuevoCUP_USD, prod.id_producto]
      );

      await connection.query(
        'UPDATE detalle_orden_compra SET cantidad_recibida = cantidad_recibida + ? WHERE id_orden_compra = ? AND id_producto = ?',
        [cantidadIngresada, id, prod.id_producto]
      );
    }

    const [cantidadesOC] = await connection.query(
      'SELECT SUM(cantidad) as total_ordenado, SUM(cantidad_recibida) as total_recibido FROM detalle_orden_compra WHERE id_orden_compra = ?',
      [id]
    );

    const totalOrdenado = parseFloat(cantidadesOC[0].total_ordenado || 0);
    const totalRecibido = parseFloat(cantidadesOC[0].total_recibido || 0);

    let nuevoEstadoOC = compra.estado;
    let estadoIngresoFinal = 'Parcial';

    if (totalRecibido >= totalOrdenado - 0.001) {
      nuevoEstadoOC = 'Recibida';
      estadoIngresoFinal = 'Completo';
      await connection.query(
        'UPDATE ordenes_compra SET estado = ?, fecha_recepcion = CURDATE() WHERE id_orden_compra = ?',
        [nuevoEstadoOC, id]
      );
      await connection.query(
        'UPDATE entradas SET estado_ingreso = ?, fecha_ingreso_completo = NOW() WHERE id_entrada = ?',
        [estadoIngresoFinal, idEntrada]
      );
    } else if (totalRecibido > 0) {
      nuevoEstadoOC = 'En Tránsito';
      await connection.query(
        'UPDATE ordenes_compra SET estado = ? WHERE id_orden_compra = ?',
        [nuevoEstadoOC, id]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Ingreso a inventario registrado exitosamente',
      data: {
        id_entrada: idEntrada,
        total_ingresado: totalIngreso,
        nuevo_estado_orden: nuevoEstadoOC,
        estado_ingreso: estadoIngresoFinal,
        porcentaje_recibido: ((totalRecibido / totalOrdenado) * 100).toFixed(2)
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
}

export async function getIngresosCompra(req, res) {
  try {
    const { id } = req.params;

    const result = await executeQuery(`
      SELECT 
        e.id_entrada,
        e.fecha_movimiento,
        e.total_costo,
        e.subtotal,
        e.igv,
        e.total,
        e.observaciones,
        e.cantidad_items_ingresada,
        e.estado_ingreso,
        emp.nombre_completo as registrado_por
      FROM entradas e
      LEFT JOIN empleados emp ON e.id_registrado_por = emp.id_empleado
      WHERE e.id_orden_compra = ?
      ORDER BY e.fecha_movimiento DESC
    `, [id]);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result.data });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getItemsPendientesIngreso(req, res) {
  try {
    const { id } = req.params;

    const result = await executeQuery(`
      SELECT 
        doc.id_producto,
        p.codigo,
        p.nombre,
        p.unidad_medida,
        doc.cantidad as cantidad_ordenada,
        doc.cantidad_recibida,
        (doc.cantidad - doc.cantidad_recibida) as cantidad_pendiente,
        doc.precio_unitario,
        doc.descuento_porcentaje
      FROM detalle_orden_compra doc
      INNER JOIN productos p ON doc.id_producto = p.id_producto
      WHERE doc.id_orden_compra = ?
      AND (doc.cantidad - doc.cantidad_recibida) > 0.001
      ORDER BY doc.orden
    `, [id]);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result.data });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}