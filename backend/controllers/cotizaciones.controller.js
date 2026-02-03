import { executeQuery, executeTransaction } from '../config/database.js';
import pool from '../config/database.js';

function getFechaPeru() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
}

export async function getAllCotizaciones(req, res) {
  try {
    const { estado, prioridad, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        c.id_cotizacion,
        c.numero_cotizacion,
        DATE_FORMAT(c.fecha_emision, '%Y-%m-%d') as fecha_emision,
        DATE_FORMAT(c.fecha_vencimiento, '%Y-%m-%d') as fecha_vencimiento,
        c.estado,
        c.prioridad,
        c.subtotal,
        c.igv,
        CASE 
          WHEN c.total > 0.001 THEN c.total
          ELSE (
            SELECT SUM(dc.cantidad * dc.precio_unitario * (1 - COALESCE(dc.descuento_porcentaje, 0) / 100))
            FROM detalle_cotizacion dc
            WHERE dc.id_cotizacion = c.id_cotizacion
          ) * CASE 
            WHEN c.tipo_impuesto IN ('EXO', 'INA', 'EXONERADO', 'INAFECTO') THEN 1
            ELSE (1 + (COALESCE(c.porcentaje_impuesto, 18) / 100))
          END
        END AS total,
        c.moneda,
        c.tipo_impuesto,
        c.porcentaje_impuesto,
        c.tipo_cambio,
        c.observaciones,
        c.fecha_creacion,
        c.convertida_venta,
        c.id_orden_venta,
        cl.id_cliente,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        e.id_empleado AS id_comercial,
        e.nombre_completo AS comercial,
        (SELECT COUNT(*) FROM detalle_cotizacion WHERE id_cotizacion = c.id_cotizacion) AS total_items
      FROM cotizaciones c
      LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON c.id_comercial = e.id_empleado
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      sql += ` AND c.estado = ?`;
      params.push(estado);
    }
    
    if (prioridad) {
      sql += ` AND c.prioridad = ?`;
      params.push(prioridad);
    }
    
    if (fecha_inicio) {
      sql += ` AND DATE(c.fecha_emision) >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND DATE(c.fecha_emision) <= ?`;
      params.push(fecha_fin);
    }
    
    sql += ` ORDER BY c.fecha_creacion DESC`;
    
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

export async function getCotizacionById(req, res) {
  try {
    const { id } = req.params;
    
    const cotizacionResult = await executeQuery(`
      SELECT 
        c.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        e.nombre_completo AS comercial,
        e.email AS email_comercial
      FROM cotizaciones c
      LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON c.id_comercial = e.id_empleado
      WHERE c.id_cotizacion = ?
    `, [id]);
    
    if (!cotizacionResult.success) {
      return res.status(500).json({ 
        success: false,
        error: cotizacionResult.error 
      });
    }
    
    if (cotizacionResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }
    
    const cotizacion = cotizacionResult.data[0];
    
    const detalleResult = await executeQuery(`
      SELECT 
        dc.id_detalle,
        dc.id_cotizacion,
        dc.id_producto,
        dc.cantidad,
        dc.precio_unitario,
        dc.precio_base,
        dc.porcentaje_comision,
        dc.monto_comision,
        dc.descuento_porcentaje,
        dc.valor_venta,
        dc.subtotal,
        dc.orden,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.stock_actual AS stock_disponible,
        p.requiere_receta
      FROM detalle_cotizacion dc
      INNER JOIN productos p ON dc.id_producto = p.id_producto
      WHERE dc.id_cotizacion = ?
      ORDER BY dc.orden
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false,
        error: detalleResult.error 
      });
    }
    
    cotizacion.detalle = detalleResult.data || [];
    
    res.json({
      success: true,
      data: cotizacion
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function createCotizacion(req, res) {
  try {
    const {
      id_cliente,
      fecha_emision,
      prioridad,
      moneda,
      tipo_impuesto,
      porcentaje_impuesto,
      tipo_cambio,
      plazo_pago,        
      forma_pago,
      direccion_entrega,
      observaciones,
      id_comercial,        
      validez_dias,        
      plazo_entrega,
      lugar_entrega,
      detalle
    } = req.body;
    
    if (!id_cliente) return res.status(400).json({ success: false, error: 'Cliente es obligatorio' });
    if (!detalle || detalle.length === 0) return res.status(400).json({ success: false, error: 'Debe agregar al menos un producto' });
    if (!plazo_pago || plazo_pago.trim() === '') return res.status(400).json({ success: false, error: 'Plazo de pago es obligatorio' });
    
    const comercialFinal = id_comercial || req.user?.id_empleado;
    if (!comercialFinal) return res.status(400).json({ success: false, error: 'No se pudo determinar el comercial responsable' });
    
    // --- Lógica de Fechas ---
    let fechaEmisionFinal = fecha_emision;
    if (!fechaEmisionFinal) {
        const peruDate = getFechaPeru();
        const year = peruDate.getFullYear();
        const month = String(peruDate.getMonth() + 1).padStart(2, '0');
        const day = String(peruDate.getDate()).padStart(2, '0');
        fechaEmisionFinal = `${year}-${month}-${day}`;
    }

    const validezDiasFinal = parseInt(validez_dias) || 7;
    const fechaEmisionDate = new Date(fechaEmisionFinal + 'T12:00:00');
    fechaEmisionDate.setDate(fechaEmisionDate.getDate() + validezDiasFinal);
    const fechaVencimientoCalculada = fechaEmisionDate.toISOString().split('T')[0];
    
    // --- Lógica de Moneda ---
    let tipoCambioFinal = parseFloat(tipo_cambio) || 1.0000;
    if (moneda === 'PEN') tipoCambioFinal = 1.0000;
    
    // --- Generar Correlativo ---
    const ultimaResult = await executeQuery(`
      SELECT numero_cotizacion 
      FROM cotizaciones 
      ORDER BY id_cotizacion DESC 
      LIMIT 1
    `);
    
    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_cotizacion.match(/(\d+)$/);
      if (match) numeroSecuencia = parseInt(match[1]) + 1;
    }
    const numeroCotizacion = `COT-${getFechaPeru().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;
    
    // --- CÁLCULO DE SUBTOTAL (SOLO P.VENTA x CANTIDAD) ---
    let subtotal = 0;

    for (const item of detalle) {
      const cantidad = parseFloat(item.cantidad || 0);
      // Aquí aseguramos usar estrictamente el precio_venta enviado
      const precioVenta = parseFloat(item.precio_venta || 0);

      const valorVenta = cantidad * precioVenta;
      
      if (!isNaN(valorVenta)) {
        subtotal += valorVenta;
      }
    }
    
    // --- Cálculo de Impuestos ---
    const tipoImpuestoFinal = tipo_impuesto || 'IGV';
    let porcentaje = 18.00;
    
    if (['EXO', 'INA', 'EXONERADO', 'INAFECTO'].includes(tipoImpuestoFinal.toUpperCase())) {
      porcentaje = 0.00;
    } else if (porcentaje_impuesto !== null && porcentaje_impuesto !== undefined) {
      porcentaje = parseFloat(porcentaje_impuesto);
    }
    
    let igv = subtotal * (porcentaje / 100);
    let total = subtotal + igv;

    // --- Validaciones de Crédito (Lógica Original) ---
    if (plazo_pago !== 'Contado') {
      const clienteInfo = await executeQuery(
        `SELECT usar_limite_credito, 
                COALESCE(limite_credito_pen, 0) as limite_pen, 
                COALESCE(limite_credito_usd, 0) as limite_usd 
         FROM clientes WHERE id_cliente = ?`,
        [id_cliente]
      );
      
      if (clienteInfo.success && clienteInfo.data.length > 0) {
        const cliente = clienteInfo.data[0];
        if (cliente.usar_limite_credito == 1) {
          const deudaRes = await executeQuery(`
            SELECT COALESCE(SUM(total - monto_pagado), 0) as deuda_actual
            FROM ordenes_venta
            WHERE id_cliente = ? 
            AND moneda = ? 
            AND estado NOT IN ('Cancelada', 'Entregada') 
            AND estado_pago != 'Pagado'
          `, [id_cliente, moneda]);

          const limite = moneda === 'USD' ? parseFloat(cliente.limite_usd) : parseFloat(cliente.limite_pen);
          const deudaActual = parseFloat(deudaRes.data[0]?.deuda_actual || 0);
          const disponible = limite - deudaActual;

          if ((deudaActual + total) > limite) {
             console.warn(`Cliente ${id_cliente} excede límite de crédito.`);
          }
        }
      }
    }
    
    // --- INSERT CABECERA ---
    const result = await executeQuery(`
      INSERT INTO cotizaciones (
        numero_cotizacion, id_cliente, id_comercial, fecha_emision, fecha_vencimiento,
        prioridad, moneda, tipo_impuesto, porcentaje_impuesto, tipo_cambio,
        plazo_pago, forma_pago, direccion_entrega, observaciones, validez_dias,
        plazo_entrega, lugar_entrega, subtotal, igv, total, estado, id_creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?)
    `, [
      numeroCotizacion, id_cliente, comercialFinal, fechaEmisionFinal, fechaVencimientoCalculada,
      prioridad || 'Media', moneda || 'PEN', tipoImpuestoFinal, porcentaje, tipoCambioFinal,                  
      plazo_pago, forma_pago || null, direccion_entrega || null, observaciones || null, validezDiasFinal,                  
      plazo_entrega || null, lugar_entrega || null, 
      subtotal, igv, total, 
      comercialFinal                      
    ]);
    
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    
    const idCotizacion = result.data.insertId;
    
    // --- INSERT DETALLE ---
    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      const cantidad = parseFloat(item.cantidad || 0);
      const precioVenta = parseFloat(item.precio_venta || 0); // Este es el que manda
      const precioBase = parseFloat(item.precio_base || 0);   // Solo referencia

      // Calculamos margen solo para guardarlo como dato, no afecta precios
      let porcentajeCalculado = 0;
      if (precioBase !== 0) {
        porcentajeCalculado = ((precioVenta - precioBase) / precioBase) * 100;
      }
      
      await executeQuery(`
        INSERT INTO detalle_cotizacion (
          id_cotizacion, id_producto, cantidad, precio_unitario, precio_base,
          descuento_porcentaje, orden
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        idCotizacion,
        item.id_producto,
        cantidad,
        precioVenta, // Guardamos el Precio Venta REAL
        precioBase,  // Guardamos el Precio Base REFERENCIAL
        porcentajeCalculado.toFixed(2), // Guardamos el margen referencial
        i + 1
      ]);
    }
    
    res.status(201).json({
      success: true,
      data: { id_cotizacion: idCotizacion, numero_cotizacion: numeroCotizacion, fecha_vencimiento: fechaVencimientoCalculada },
      message: 'Cotización creada exitosamente'
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateCotizacion(req, res) {
  try {
    const { id } = req.params;
    const {
      id_cliente,
      fecha_emision,
      prioridad,
      moneda,
      tipo_impuesto,
      porcentaje_impuesto,
      tipo_cambio,
      plazo_pago,
      forma_pago,
      direccion_entrega,
      observaciones,
      id_comercial,
      validez_dias,
      plazo_entrega,
      lugar_entrega,
      detalle
    } = req.body;

    // Validar existencia
    const cotizacionExistente = await executeQuery(`
      SELECT c.id_cotizacion, c.estado, c.convertida_venta, c.id_orden_venta, 
             cl.usar_limite_credito, cl.limite_credito_pen, cl.limite_credito_usd
      FROM cotizaciones c
      INNER JOIN clientes cl ON c.id_cliente = cl.id_cliente
      WHERE c.id_cotizacion = ?
    `, [id]);

    if (!cotizacionExistente.success || cotizacionExistente.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Cotización no encontrada' });
    }

    const cotActual = cotizacionExistente.data[0];

    // Validaciones básicas
    if (!id_cliente) return res.status(400).json({ success: false, error: 'Cliente es obligatorio' });
    if (!detalle || detalle.length === 0) return res.status(400).json({ success: false, error: 'Debe agregar al menos un producto' });
    if (!plazo_pago || plazo_pago.trim() === '') return res.status(400).json({ success: false, error: 'Plazo de pago es obligatorio' });

    const comercialFinal = id_comercial || req.user?.id_empleado;
    if (!comercialFinal) return res.status(400).json({ success: false, error: 'No se pudo determinar el comercial responsable' });

    // Lógica Fechas
    let fechaEmisionFinal = fecha_emision;
    if (!fechaEmisionFinal) {
        const peruDate = getFechaPeru();
        const year = peruDate.getFullYear();
        const month = String(peruDate.getMonth() + 1).padStart(2, '0');
        const day = String(peruDate.getDate()).padStart(2, '0');
        fechaEmisionFinal = `${year}-${month}-${day}`;
    }

    const validezDiasFinal = parseInt(validez_dias) || 7;
    const fechaEmisionDate = new Date(fechaEmisionFinal + 'T12:00:00');
    fechaEmisionDate.setDate(fechaEmisionDate.getDate() + validezDiasFinal);
    const fechaVencimientoCalculada = fechaEmisionDate.toISOString().split('T')[0];

    let tipoCambioFinal = parseFloat(tipo_cambio) || 1.0000;
    if (moneda === 'PEN') tipoCambioFinal = 1.0000;

    // --- CÁLCULO SUBTOTAL SIMPLIFICADO (SOLO P.VENTA x CANTIDAD) ---
    let subtotal = 0;
    let totalComision = 0; // Se mantiene en 0 o se calcula informativo, pero NO afecta precio
    let sumaComisionPorcentual = 0;

    for (const item of detalle) {
      const cantidad = parseFloat(item.cantidad || 0);
      // Forzamos el uso de precio_venta o precio_unitario (el que venga del front)
      // IGNORAMOS precio_base para este cálculo
      const precioVenta = parseFloat(item.precio_venta || item.precio_unitario || 0);
      
      const valorVenta = cantidad * precioVenta;
      
      if (!isNaN(valorVenta)) subtotal += valorVenta;
      
      // Cálculo meramente informativo de comisiones (opcional)
      const precioBase = parseFloat(item.precio_base || 0);
      const pctComision = parseFloat(item.porcentaje_comision || 0);
      const montoComision = precioBase * (pctComision / 100);
      totalComision += montoComision * cantidad;
      sumaComisionPorcentual += pctComision;
    }

    const porcentajeComisionPromedio = detalle.length > 0 ? sumaComisionPorcentual / detalle.length : 0;
    
    // --- Cálculo de Impuestos ---
    const tipoImpuestoFinal = tipo_impuesto || 'IGV';
    let porcentaje = 18.00;
    
    if (['EXO', 'INA', 'EXONERADO', 'INAFECTO'].includes(tipoImpuestoFinal.toUpperCase())) {
      porcentaje = 0.00;
    } else if (porcentaje_impuesto !== null && porcentaje_impuesto !== undefined) {
      porcentaje = parseFloat(porcentaje_impuesto);
    }

    let igv = subtotal * (porcentaje / 100);
    let total = subtotal + igv;

    // Validar crédito
    if (cotActual.usar_limite_credito == 1 && plazo_pago !== 'Contado') {
      const deudaRes = await executeQuery(`
        SELECT COALESCE(SUM(total - monto_pagado), 0) as deuda_actual
        FROM ordenes_venta
        WHERE id_cliente = ? AND moneda = ? AND estado != 'Cancelada' AND estado_pago != 'Pagado'
      `, [id_cliente, moneda]);

      const limite = moneda === 'USD' ? parseFloat(cotActual.limite_credito_usd || 0) : parseFloat(cotActual.limite_credito_pen || 0);
      const deudaActual = parseFloat(deudaRes.data[0].deuda_actual);

      if ((deudaActual + total) > limite) {
        console.warn(`Cliente ${id_cliente} excede límite de crédito en edición.`);
      }
    }

    const queries = [];

    // --- UPDATE CABECERA ---
    queries.push({
      sql: `UPDATE cotizaciones 
            SET id_cliente=?, id_comercial=?, fecha_emision=?, fecha_vencimiento=?, prioridad=?, moneda=?, tipo_impuesto=?, porcentaje_impuesto=?, tipo_cambio=?, plazo_pago=?, forma_pago=?, direccion_entrega=?, observaciones=?, validez_dias=?, plazo_entrega=?, lugar_entrega=?, 
            subtotal=?, igv=?, total=?, total_comision=?, porcentaje_comision_promedio=?
            WHERE id_cotizacion=?`,
      params: [
        id_cliente, comercialFinal, fechaEmisionFinal, fechaVencimientoCalculada, prioridad || 'Media', moneda || 'PEN', tipoImpuestoFinal, porcentaje, tipoCambioFinal, plazo_pago, forma_pago || null, direccion_entrega || null, observaciones || null, validezDiasFinal, plazo_entrega || null, lugar_entrega || null, 
        subtotal, igv, total, totalComision, porcentajeComisionPromedio, id
      ]
    });

    queries.push({
      sql: 'DELETE FROM detalle_cotizacion WHERE id_cotizacion = ?',
      params: [id]
    });

    // --- INSERT NUEVO DETALLE ---
    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      const cantidad = parseFloat(item.cantidad || 0);
      const precioBase = parseFloat(item.precio_base || 0);
      const precioVenta = parseFloat(item.precio_venta || item.precio_unitario || 0); // EL QUE MANDA
      
      const pctComision = parseFloat(item.porcentaje_comision || 0);
      const pctDescuento = parseFloat(item.descuento_porcentaje || 0);
      const montoComision = precioBase * (pctComision / 100); // Informativo

      queries.push({
        sql: `INSERT INTO detalle_cotizacion (id_cotizacion, id_producto, cantidad, precio_unitario, precio_base, porcentaje_comision, monto_comision, descuento_porcentaje, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [id, item.id_producto, cantidad, precioVenta, precioBase, pctComision, montoComision, pctDescuento, i + 1]
      });
    }

    // --- LÓGICA SI YA ERA ORDEN DE VENTA ---
    if (cotActual.convertida_venta === 1 && cotActual.id_orden_venta) {
      const idOrden = cotActual.id_orden_venta;
      
      const ordenCheck = await executeQuery('SELECT stock_reservado FROM ordenes_venta WHERE id_orden_venta = ?', [idOrden]);
      const stockReservado = ordenCheck.data.length > 0 && ordenCheck.data[0].stock_reservado === 1;

      // Devolver stock anterior
      if (stockReservado) {
        const detalleAnteriorOV = await executeQuery('SELECT id_producto, cantidad FROM detalle_orden_venta WHERE id_orden_venta = ?', [idOrden]);
        for (const itemAnt of detalleAnteriorOV.data) {
          const prodInfo = await executeQuery('SELECT requiere_receta FROM productos WHERE id_producto = ?', [itemAnt.id_producto]);
          if (prodInfo.data.length > 0 && prodInfo.data[0].requiere_receta === 0) {
            queries.push({
              sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
              params: [parseFloat(itemAnt.cantidad), itemAnt.id_producto]
            });
          }
        }
      }

      queries.push({
        sql: `UPDATE ordenes_venta 
              SET id_cliente=?, fecha_emision=?, fecha_vencimiento=?, prioridad=?, moneda=?, tipo_impuesto=?, porcentaje_impuesto=?, tipo_cambio=?, plazo_pago=?, forma_pago=?, direccion_entrega=?, observaciones=?, lugar_entrega=?, 
              subtotal=?, igv=?, total=?, total_comision=?, porcentaje_comision_promedio=?
              WHERE id_orden_venta=?`,
        params: [
          id_cliente, fechaEmisionFinal, fechaVencimientoCalculada, prioridad || 'Media', moneda || 'PEN', tipoImpuestoFinal, porcentaje, tipoCambioFinal, plazo_pago, forma_pago || null, direccion_entrega || null, observaciones || null, lugar_entrega || null, 
          subtotal, igv, total, totalComision, porcentajeComisionPromedio, idOrden
        ]
      });

      queries.push({
        sql: 'DELETE FROM detalle_orden_venta WHERE id_orden_venta = ?',
        params: [idOrden]
      });

      for (let i = 0; i < detalle.length; i++) {
        const item = detalle[i];
        const cantidad = parseFloat(item.cantidad || 0);
        const precioBase = parseFloat(item.precio_base || 0);
        const precioVenta = parseFloat(item.precio_venta || item.precio_unitario || 0); // EL QUE MANDA
        
        const pctComision = parseFloat(item.porcentaje_comision || 0);
        const pctDescuento = parseFloat(item.descuento_porcentaje || 0);
        const montoComision = precioBase * (pctComision / 100);

        queries.push({
          sql: `INSERT INTO detalle_orden_venta (id_orden_venta, id_producto, cantidad, precio_unitario, precio_base, porcentaje_comision, monto_comision, descuento_porcentaje, stock_reservado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [idOrden, item.id_producto, cantidad, precioVenta, precioBase, pctComision, montoComision, pctDescuento, stockReservado ? 1 : 0]
        });

        // Reservar nuevo stock
        if (stockReservado) {
          const prodCheck = await executeQuery('SELECT requiere_receta FROM productos WHERE id_producto = ?', [item.id_producto]);
          if (prodCheck.data.length > 0 && prodCheck.data[0].requiere_receta === 0) {
            queries.push({
              sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
              params: [cantidad, item.id_producto]
            });
          }
        }
      }
    }

    await executeTransaction(queries);

    res.json({ success: true, message: 'Cotización actualizada exitosamente' + (cotActual.convertida_venta ? ' y sincronizada con Orden de Venta' : '') });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}
export async function duplicarCotizacion(req, res) {
  try {
    const { id } = req.params;

    const cotizacionResult = await executeQuery(`
      SELECT * FROM cotizaciones WHERE id_cotizacion = ?
    `, [id]);

    if (!cotizacionResult.success || cotizacionResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }

    const cotizacionOriginal = cotizacionResult.data[0];

    const detalleResult = await executeQuery(`
      SELECT * FROM detalle_cotizacion WHERE id_cotizacion = ?
      ORDER BY orden
    `, [id]);

    if (!detalleResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener detalle de cotización'
      });
    }

    const peruDate = getFechaPeru();
    const year = peruDate.getFullYear();
    const month = String(peruDate.getMonth() + 1).padStart(2, '0');
    const day = String(peruDate.getDate()).padStart(2, '0');
    const fechaEmisionFinal = `${year}-${month}-${day}`;

    const validezDiasFinal = parseInt(cotizacionOriginal.validez_dias) || 7;

    const fechaEmisionDate = new Date(fechaEmisionFinal + 'T12:00:00');
    fechaEmisionDate.setDate(fechaEmisionDate.getDate() + validezDiasFinal);
    const fechaVencimientoCalculada = fechaEmisionDate.toISOString().split('T')[0];

    const ultimaResult = await executeQuery(`
      SELECT numero_cotizacion 
      FROM cotizaciones 
      ORDER BY id_cotizacion DESC 
      LIMIT 1
    `);

    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_cotizacion.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }

    const numeroCotizacion = `COT-${getFechaPeru().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;

    const insertResult = await executeQuery(`
      INSERT INTO cotizaciones (
        numero_cotizacion,
        id_cliente,
        id_comercial,
        fecha_emision,
        fecha_vencimiento,
        prioridad,
        moneda,
        tipo_impuesto,
        porcentaje_impuesto,
        tipo_cambio,
        plazo_pago,
        forma_pago,
        direccion_entrega,
        observaciones,
        validez_dias,
        plazo_entrega,
        lugar_entrega,
        subtotal,
        igv,
        total,
        total_comision,
        porcentaje_comision_promedio,
        estado,
        id_creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?)
    `, [
      numeroCotizacion,
      cotizacionOriginal.id_cliente,
      cotizacionOriginal.id_comercial,
      fechaEmisionFinal,
      fechaVencimientoCalculada,
      cotizacionOriginal.prioridad,
      cotizacionOriginal.moneda,
      cotizacionOriginal.tipo_impuesto,
      cotizacionOriginal.porcentaje_impuesto,
      cotizacionOriginal.tipo_cambio,
      cotizacionOriginal.plazo_pago,
      cotizacionOriginal.forma_pago,
      cotizacionOriginal.direccion_entrega,
      cotizacionOriginal.observaciones,
      validezDiasFinal,
      cotizacionOriginal.plazo_entrega,
      cotizacionOriginal.lugar_entrega,
      cotizacionOriginal.subtotal,
      cotizacionOriginal.igv,
      cotizacionOriginal.total,
      cotizacionOriginal.total_comision || 0,
      cotizacionOriginal.porcentaje_comision_promedio || 0,
      req.user?.id_empleado || cotizacionOriginal.id_comercial
    ]);

    if (!insertResult.success) {
      return res.status(500).json({
        success: false,
        error: insertResult.error
      });
    }

    const idNuevaCotizacion = insertResult.data.insertId;

    for (let i = 0; i < detalleResult.data.length; i++) {
      const item = detalleResult.data[i];

      await executeQuery(`
        INSERT INTO detalle_cotizacion (
          id_cotizacion,
          id_producto,
          cantidad,
          precio_unitario,
          precio_base,
          porcentaje_comision,
          monto_comision,
          descuento_porcentaje,
          orden
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        idNuevaCotizacion,
        item.id_producto,
        item.cantidad,
        item.precio_unitario,
        item.precio_base || item.precio_unitario,
        item.porcentaje_comision || 0,
        item.monto_comision || 0,
        item.descuento_porcentaje,
        i + 1
      ]);
    }

    res.status(201).json({
      success: true,
      data: {
        id_cotizacion: idNuevaCotizacion,
        numero_cotizacion: numeroCotizacion,
        fecha_vencimiento: fechaVencimientoCalculada
      },
      message: 'Cotización duplicada exitosamente'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function actualizarEstadoCotizacion(req, res) {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    const estadosValidos = ['Pendiente', 'Enviada', 'Aprobada', 'Rechazada', 'Convertida', 'Vencida'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }

    await connection.beginTransaction();

    const [cotizaciones] = await connection.query(`
      SELECT * FROM cotizaciones WHERE id_cotizacion = ?
    `, [id]);

    if (cotizaciones.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }

    const cotizacion = cotizaciones[0];

    await connection.query(`
      UPDATE cotizaciones 
      SET estado = ? 
      WHERE id_cotizacion = ?
    `, [estado, id]);

    await connection.commit();

    res.json({
      success: true,
      message: `Estado actualizado a ${estado}`,
      data: {
        id_cotizacion: id,
        estado: estado,
        requiere_orden_venta: estado === 'Aprobada'
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar estado:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    connection.release();
  }
}

export async function actualizarPrioridadCotizacion(req, res) {
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
      UPDATE cotizaciones 
      SET prioridad = ? 
      WHERE id_cotizacion = ?
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getEstadisticasCotizaciones(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_cotizaciones,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'Enviada' THEN 1 ELSE 0 END) AS enviadas,
        SUM(CASE WHEN estado = 'Aprobada' THEN 1 ELSE 0 END) AS aprobadas,
        SUM(CASE WHEN estado = 'Rechazada' THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN estado = 'Convertida' THEN 1 ELSE 0 END) AS convertidas,
        SUM(total) AS monto_total,
        COUNT(DISTINCT id_cliente) AS clientes_unicos,
        COUNT(DISTINCT id_comercial) AS comerciales_activos
      FROM cotizaciones
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

export async function descargarPDFCotizacion(req, res) {
  try {
    const { id } = req.params;

    const cotizacionResult = await executeQuery(`
      SELECT 
        c.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        cl.telefono AS telefono_cliente,
        cl.email AS email_cliente,
        e.nombre_completo AS comercial,
        e.email AS email_comercial
      FROM cotizaciones c
      LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON c.id_comercial = e.id_empleado
      WHERE c.id_cotizacion = ?
    `, [id]);

    if (!cotizacionResult.success || cotizacionResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }

    const cotizacion = cotizacionResult.data[0];

    const detalleResult = await executeQuery(`
      SELECT 
        dc.id_detalle,
        dc.cantidad,
        dc.precio_unitario,
        dc.descuento_porcentaje,
        dc.valor_venta,
        dc.orden,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_cotizacion dc
      INNER JOIN productos p ON dc.id_producto = p.id_producto
      WHERE dc.id_cotizacion = ?
      ORDER BY dc.orden
    `, [id]);

    if (!detalleResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener detalle de cotización'
      });
    }

    cotizacion.detalle = detalleResult.data;

    const { generarCotizacionPDF } = await import('../utils/pdfGenerators/cotizacionPDF.js');
    const pdfBuffer = await generarCotizacionPDF(cotizacion);

    const clienteSanitizado = cotizacion.cliente
      ? cotizacion.cliente
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .trim()
          .replace(/\s+/g, "_")
          .toUpperCase()
      : 'CLIENTE';

    const nroCot = cotizacion.numero_cotizacion || id;
    
    const nombreArchivo = `${clienteSanitizado}_${nroCot}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error en descargarPDFCotizacion:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al generar PDF'
    });
  }
}

export async function agregarDireccionClienteDesdeCotizacion(req, res) {
  try {
    const { id_cliente, direccion, referencia } = req.body;

    if (!id_cliente) {
      return res.status(400).json({ 
        success: false, 
        error: 'El ID del cliente es obligatorio' 
      });
    }

    if (!direccion || direccion.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'La dirección es requerida' 
      });
    }

    const clienteCheck = await executeQuery(
      'SELECT id_cliente FROM clientes WHERE id_cliente = ?',
      [id_cliente]
    );

    if (clienteCheck.data.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente no encontrado' 
      });
    }

    const result = await executeQuery(
      `INSERT INTO clientes_direcciones (
        id_cliente, 
        direccion, 
        referencia, 
        es_principal, 
        estado
      ) VALUES (?, ?, ?, 0, 'Activo')`,
      [id_cliente, direccion, referencia || null]
    );

    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }

    res.status(201).json({
      success: true,
      message: 'Dirección agregada exitosamente',
      data: {
        id_direccion: result.data.insertId,
        id_cliente: id_cliente,
        direccion: direccion,
        referencia: referencia || null
      }
    });

  } catch (error) {
    console.error('Error al agregar dirección desde cotización:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

export async function getNavegacionCotizacion(req, res) {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(`
      SELECT 
        c.id_cotizacion,
        c.numero_cotizacion
      FROM cotizaciones c
      ORDER BY c.fecha_creacion DESC, c.id_cotizacion DESC
    `);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }
    
    const lista = result.data;
    const currentIndex = lista.findIndex(c => String(c.id_cotizacion) === String(id));
    
    if (currentIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: {
        prev: currentIndex > 0 ? lista[currentIndex - 1].id_cotizacion : null,
        next: currentIndex < lista.length - 1 ? lista[currentIndex + 1].id_cotizacion : null,
        current: currentIndex + 1,
        total: lista.length
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

export async function rectificarCantidadCotizacion(req, res) {
  try {
    const { id } = req.params;
    const { id_producto, nueva_cantidad, motivo } = req.body;
    
    if (!id_producto || nueva_cantidad === undefined || nueva_cantidad < 0) {
        return res.status(400).json({ success: false, error: 'Datos incompletos' });
    }

    const cotResult = await executeQuery('SELECT * FROM cotizaciones WHERE id_cotizacion = ?', [id]);
    if (cotResult.data.length === 0) return res.status(404).json({ success: false, error: 'Cotización no encontrada' });
    const cotizacion = cotResult.data[0];

    const detResult = await executeQuery('SELECT * FROM detalle_cotizacion WHERE id_cotizacion = ? AND id_producto = ?', [id, id_producto]);
    if (detResult.data.length === 0) return res.status(404).json({ success: false, error: 'Producto no en cotización' });
    
    const itemDetalle = detResult.data[0];
    const cantidadAnterior = parseFloat(itemDetalle.cantidad);
    const cantidadNueva = parseFloat(nueva_cantidad);
    const diferencia = cantidadNueva - cantidadAnterior;

    if (diferencia === 0) return res.json({ success: true, message: 'Sin cambios' });

    const queries = [];

    queries.push({
        sql: 'UPDATE detalle_cotizacion SET cantidad = ? WHERE id_detalle = ?',
        params: [cantidadNueva, itemDetalle.id_detalle]
    });

    queries.push({
        sql: `UPDATE cotizaciones c
              SET 
                subtotal = (SELECT SUM(cantidad * precio_unitario * (1 - COALESCE(descuento_porcentaje,0)/100)) FROM detalle_cotizacion WHERE id_cotizacion = c.id_cotizacion),
                igv = (SELECT SUM(cantidad * precio_unitario * (1 - COALESCE(descuento_porcentaje,0)/100)) FROM detalle_cotizacion WHERE id_cotizacion = c.id_cotizacion) * (COALESCE(porcentaje_impuesto,18)/100),
                total = (SELECT SUM(cantidad * precio_unitario * (1 - COALESCE(descuento_porcentaje,0)/100)) FROM detalle_cotizacion WHERE id_cotizacion = c.id_cotizacion) * (1 + COALESCE(porcentaje_impuesto,18)/100),
                observaciones = CONCAT(COALESCE(observaciones, ""), " [Rect: Prod ", ?, " ", ?, "->", ?, "]")
              WHERE c.id_cotizacion = ?`,
        params: [id_producto, cantidadAnterior, cantidadNueva, id]
    });

    if (cotizacion.convertida_venta === 1 && cotizacion.id_orden_venta) {
        const idOrden = cotizacion.id_orden_venta;
        
        if (diferencia > 0) {
            const prodCheck = await executeQuery('SELECT stock_actual, requiere_receta FROM productos WHERE id_producto = ?', [id_producto]);
            if (prodCheck.data.length > 0 && prodCheck.data[0].requiere_receta === 0) {
                if (parseFloat(prodCheck.data[0].stock_actual) < diferencia) {
                    return res.status(400).json({ success: false, error: 'Stock insuficiente para reflejar el cambio en la Orden de Venta vinculada' });
                }
                queries.push({ sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?', params: [diferencia, id_producto] });
            }
        } else {
            const prodCheck = await executeQuery('SELECT requiere_receta FROM productos WHERE id_producto = ?', [id_producto]);
            if (prodCheck.data.length > 0 && prodCheck.data[0].requiere_receta === 0) {
                queries.push({ sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?', params: [Math.abs(diferencia), id_producto] });
            }
        }

        const ordenCheck = await executeQuery('SELECT estado, numero_orden, porcentaje_impuesto FROM ordenes_venta WHERE id_orden_venta = ?', [idOrden]);
        const ordenData = ordenCheck.data[0];

        let sqlUpdateOV = 'UPDATE detalle_orden_venta SET cantidad = ? WHERE id_orden_venta = ? AND id_producto = ?';
        let paramsUpdateOV = [cantidadNueva, idOrden, id_producto];

        if (['Despachada', 'Entregada'].includes(ordenData.estado)) {
            sqlUpdateOV = 'UPDATE detalle_orden_venta SET cantidad = ?, cantidad_despachada = ? WHERE id_orden_venta = ? AND id_producto = ?';
            paramsUpdateOV = [cantidadNueva, cantidadNueva, idOrden, id_producto];
        } else if (ordenData.estado === 'Despacho Parcial') {
            sqlUpdateOV = 'UPDATE detalle_orden_venta SET cantidad = ?, cantidad_despachada = IF(cantidad_despachada > 0, ?, cantidad_despachada) WHERE id_orden_venta = ? AND id_producto = ?';
            paramsUpdateOV = [cantidadNueva, cantidadNueva, idOrden, id_producto];
        }
        queries.push({ sql: sqlUpdateOV, params: paramsUpdateOV });

        queries.push({
            sql: `UPDATE ordenes_venta ov
                  SET 
                    subtotal = (SELECT SUM(cantidad * precio_unitario * (1 - COALESCE(descuento_porcentaje,0)/100)) FROM detalle_orden_venta WHERE id_orden_venta = ov.id_orden_venta),
                    igv = (SELECT SUM(cantidad * precio_unitario * (1 - COALESCE(descuento_porcentaje,0)/100)) FROM detalle_orden_venta WHERE id_orden_venta = ov.id_orden_venta) * (COALESCE(porcentaje_impuesto,18)/100),
                    total = (SELECT SUM(cantidad * precio_unitario * (1 - COALESCE(descuento_porcentaje,0)/100)) FROM detalle_orden_venta WHERE id_orden_venta = ov.id_orden_venta) * (1 + COALESCE(porcentaje_impuesto,18)/100)
                  WHERE ov.id_orden_venta = ?`,
            params: [idOrden]
        });

        if (['Despachada', 'Entregada', 'Despacho Parcial'].includes(ordenData.estado)) {
             const salidaRes = await executeQuery('SELECT id_salida FROM salidas WHERE observaciones LIKE ? AND estado = "Activo" ORDER BY id_salida DESC LIMIT 1', [`%${ordenData.numero_orden}%`]);
             if (salidaRes.data.length > 0) {
                 const idSalida = salidaRes.data[0].id_salida;
                 
                 queries.push({
                     sql: 'UPDATE detalle_salidas SET cantidad = ? WHERE id_salida = ? AND id_producto = ?',
                     params: [cantidadNueva, idSalida, id_producto]
                 });
                 
                 queries.push({
                    sql: `UPDATE salidas s SET 
                            total_costo = (SELECT COALESCE(SUM(cantidad * costo_unitario), 0) FROM detalle_salidas WHERE id_salida = s.id_salida),
                            total_precio = (SELECT COALESCE(SUM(cantidad * precio_unitario), 0) FROM detalle_salidas WHERE id_salida = s.id_salida)
                          WHERE s.id_salida = ?`,
                    params: [idSalida]
                });
             }
        }
    }

    await executeTransaction(queries);
    res.json({ success: true, message: 'Cotización (y Orden vinculada) rectificada correctamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}