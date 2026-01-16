import { executeQuery, executeTransaction } from '../config/database.js';
import { generarOrdenVentaPDF } from '../utils/pdfGenerators/ordenVentaPDF.js';
import { generarFacturaPDF } from '../utils/pdfGenerators/FacturaPDF.js';
import { generarNotaVentaPDF } from '../utils/pdfGenerators/NotaVentaPDF.js';
import { generarPDFSalida } from '../utils/pdf-generator.js';

function getFechaPeru() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
}

function getFechaISOPeru() {
    const peruDate = getFechaPeru();
    const year = peruDate.getFullYear();
    const month = String(peruDate.getMonth() + 1).padStart(2, '0');
    const day = String(peruDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function getAllOrdenesVenta(req, res) {
  try {
    const { estado, prioridad, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        ov.id_orden_venta,
        ov.numero_orden,
        ov.tipo_comprobante,    -- << AGREGAR ESTA LÍNEA
        ov.numero_comprobante,  -- << AGREGAR ESTA LÍNEA (para que se vea F001-...)
        ov.fecha_emision,
        ov.fecha_entrega_estimada,
        ov.fecha_entrega_real,
        ov.fecha_vencimiento,
        ov.tipo_venta,
        ov.dias_credito,
        ov.estado,
        ov.prioridad,
        ov.subtotal,
        ov.igv,
        ov.total,
        ov.moneda,
        ov.monto_pagado,
        ov.estado_pago,
        ov.id_cotizacion,
        ov.stock_reservado,
        c.numero_cotizacion,
        cl.id_cliente,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        e_comercial.nombre_completo AS comercial,
        e_registrado.nombre_completo AS registrado_por,
        ov.id_comercial,
        ov.id_registrado_por,
        (SELECT COUNT(*) FROM detalle_orden_venta WHERE id_orden_venta = ov.id_orden_venta) AS total_items,
        (SELECT COUNT(*) FROM salidas WHERE observaciones LIKE CONCAT('%', ov.numero_orden, '%') AND estado = 'Activo') AS total_despachos
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
    
    const estadosConDespacho = ['Despacho Parcial', 'Despachada', 'Entregada'];
    const mostrarAlertaStock = !estadosConDespacho.includes(orden.estado);
    
    const detalleResult = await executeQuery(`
      SELECT 
        dov.*,
        dov.cantidad_despachada, 
        (dov.cantidad - dov.cantidad_despachada) AS cantidad_pendiente,
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
    orden.mostrar_alerta_stock = mostrarAlertaStock;
    
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

export async function reservarStockOrden(req, res) {
  try {
    const { id } = req.params;

    const ordenResult = await executeQuery('SELECT stock_reservado, estado FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }

    const orden = ordenResult.data[0];

    if (orden.stock_reservado === 1) {
      return res.status(400).json({ success: false, error: 'Esta orden ya tiene stock reservado' });
    }

    const estadosNoPermitidos = ['Cancelada', 'Despacho Parcial', 'Despachada', 'Entregada'];
    if (estadosNoPermitidos.includes(orden.estado)) {
      return res.status(400).json({ success: false, error: 'No se puede reservar stock en el estado actual de la orden' });
    }

    const detalleResult = await executeQuery('SELECT id_producto, cantidad FROM detalle_orden_venta WHERE id_orden_venta = ?', [id]);
    const detalles = detalleResult.data;

    const queries = [];

    for (const item of detalles) {
      const productoResult = await executeQuery('SELECT stock_actual, nombre, requiere_receta FROM productos WHERE id_producto = ?', [item.id_producto]);
      
      if (productoResult.data.length > 0) {
        const producto = productoResult.data[0];
        
        if (producto.requiere_receta === 0) {
          if (parseFloat(producto.stock_actual) < parseFloat(item.cantidad)) {
            return res.status(400).json({ 
              success: false, 
              error: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock_actual}, Requerido: ${item.cantidad}` 
            });
          }

          queries.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
            params: [parseFloat(item.cantidad), item.id_producto]
          });
        }
      }
    }

    queries.push({
      sql: 'UPDATE ordenes_venta SET stock_reservado = 1 WHERE id_orden_venta = ?',
      params: [id]
    });

    const result = await executeTransaction(queries);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ success: true, message: 'Stock reservado exitosamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createOrdenVenta(req, res) {
  try {
    const {
      tipo_comprobante,
      id_cliente,
      id_cotizacion,
      fecha_emision,
      fecha_entrega_estimada,
      fecha_vencimiento,
      prioridad,
      moneda,
      tipo_cambio,
      tipo_impuesto,
      porcentaje_impuesto,
      tipo_venta,
      dias_credito,
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
      detalle,
      reservar_stock
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

    if (reservar_stock) {
      for (const item of detalle) {
        const productoResult = await executeQuery(
          'SELECT stock_actual, requiere_receta FROM productos WHERE id_producto = ?',
          [item.id_producto]
        );

        if (productoResult.success && productoResult.data.length > 0) {
          const producto = productoResult.data[0];
          
          if (producto.requiere_receta === 0) {
            const stockActual = parseFloat(producto.stock_actual);
            const cantidadRequerida = parseFloat(item.cantidad);

            if (stockActual < cantidadRequerida) {
              return res.status(400).json({
                success: false,
                error: `Stock insuficiente para el producto ID ${item.id_producto}. Disponible: ${stockActual}, Requerido: ${cantidadRequerida}`
              });
            }
          }
        }
      }
    }
    
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

    const tipoImpuestoFinal = (tipo_impuesto || 'IGV').toUpperCase().trim();
    let porcentaje = 18.00;

    // Aceptamos múltiples variantes para que no falle nunca
    if (['EXO', 'INA', 'INAFECTO', 'EXONERADO', '0'].includes(tipoImpuestoFinal)) {
      porcentaje = 0.00;
    } else if (porcentaje_impuesto !== null && porcentaje_impuesto !== undefined) {
      porcentaje = parseFloat(porcentaje_impuesto);
    }
    
    const impuesto = subtotal * (porcentaje / 100);
    const total = subtotal + impuesto;
    
    const clienteInfo = await executeQuery('SELECT usar_limite_credito, limite_credito_pen, limite_credito_usd FROM clientes WHERE id_cliente = ?', [id_cliente]);
    
    if (clienteInfo.success && clienteInfo.data.length > 0) {
      const cliente = clienteInfo.data[0];

      if (cliente.usar_limite_credito === 1) {
        const limiteAsignado = moneda === 'USD' ? parseFloat(cliente.limite_credito_usd || 0) : parseFloat(cliente.limite_credito_pen || 0);
        
        const deudaResult = await executeQuery(`
          SELECT COALESCE(SUM(total - monto_pagado), 0) as deuda_actual
          FROM ordenes_venta
          WHERE id_cliente = ? 
          AND moneda = ? 
          AND estado != 'Cancelada' 
          AND estado_pago != 'Pagado'
        `, [id_cliente, moneda]);

        const deudaActual = parseFloat(deudaResult.data[0]?.deuda_actual || 0);
        const nuevaDeudaTotal = deudaActual + total;

        if (nuevaDeudaTotal > limiteAsignado) {
          return res.status(400).json({
            success: false,
            error: `Límite de crédito excedido. 
                    Límite: ${moneda} ${limiteAsignado.toFixed(2)}. 
                    Deuda actual: ${moneda} ${deudaActual.toFixed(2)}. 
                    Nueva orden: ${moneda} ${total.toFixed(2)}. 
                    Total proyectado: ${moneda} ${nuevaDeudaTotal.toFixed(2)}.`
          });
        }
      }
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
    
    const numeroOrden = `OV-${getFechaPeru().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;
    
    const tipoComp = tipo_comprobante || 'Factura';
    let numeroComprobante = null;

    if (tipoComp === 'Factura') {
      const ultimaFactura = await executeQuery(`
        SELECT numero_comprobante 
        FROM ordenes_venta 
        WHERE tipo_comprobante = 'Factura'
        AND numero_comprobante IS NOT NULL
        ORDER BY id_orden_venta DESC 
        LIMIT 1
      `);

      let numeroSecuenciaFactura = 1;
      if (ultimaFactura.success && ultimaFactura.data.length > 0 && ultimaFactura.data[0].numero_comprobante) {
        const match = ultimaFactura.data[0].numero_comprobante.match(/F\d{3}-(\d+)$/);
        if (match) {
          numeroSecuenciaFactura = parseInt(match[1]) + 1;
        }
      }

      numeroComprobante = `F001-${String(numeroSecuenciaFactura).padStart(8, '0')}`;
      
    } else if (tipoComp === 'Nota de Venta') {
      const ultimaNota = await executeQuery(`
        SELECT numero_comprobante 
        FROM ordenes_venta 
        WHERE tipo_comprobante = 'Nota de Venta'
        AND numero_comprobante IS NOT NULL
        ORDER BY id_orden_venta DESC 
        LIMIT 1
      `);

      let numeroSecuenciaNota = 1;
      if (ultimaNota.success && ultimaNota.data.length > 0 && ultimaNota.data[0].numero_comprobante) {
        const match = ultimaNota.data[0].numero_comprobante.match(/NV\d{3}-(\d+)$/);
        if (match) {
          numeroSecuenciaNota = parseInt(match[1]) + 1;
        }
      }

      numeroComprobante = `NV001-${String(numeroSecuenciaNota).padStart(8, '0')}`;
    }
    
    let fechaVencimientoFinal = fecha_vencimiento;
    if (!fechaVencimientoFinal && fecha_emision) {
      const fechaBase = new Date(fecha_emision + 'T12:00:00');
      fechaBase.setDate(fechaBase.getDate() + (parseInt(dias_credito) || 0));
      fechaVencimientoFinal = fechaBase.toISOString().split('T')[0];
    }
    
    const result = await executeQuery(`
      INSERT INTO ordenes_venta (
        numero_orden,
        tipo_comprobante,
        numero_comprobante,
        id_cliente,
        id_cotizacion,
        fecha_emision,
        fecha_entrega_estimada,
        fecha_vencimiento,
        prioridad,
        moneda,
        tipo_cambio,
        tipo_impuesto,
        porcentaje_impuesto,
        tipo_venta,
        dias_credito,
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
        estado,
        stock_reservado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En Espera', ?)
    `, [
      numeroOrden,
      tipoComp,
      numeroComprobante,
      id_cliente,
      id_cotizacion || null,
      fecha_emision,
      fecha_entrega_estimada || null,
      fechaVencimientoFinal,
      prioridad || 'Media',
      moneda,
      parseFloat(tipo_cambio || 1.0000),
      tipoImpuestoFinal,
      porcentaje,
      tipo_venta || 'Contado',
      parseInt(dias_credito || 0),
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
      porcentajeComisionPromedio,
      reservar_stock ? 1 : 0
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    const idOrden = result.data.insertId;
    
    const queriesDetalle = [];

    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      const precioBase = parseFloat(item.precio_base);
      const porcentajeComision = parseFloat(item.porcentaje_comision || 0);
      const montoComision = precioBase * (porcentajeComision / 100);
      const precioFinal = precioBase + montoComision;
      
      queriesDetalle.push({
        sql: `INSERT INTO detalle_orden_venta (
          id_orden_venta,
          id_producto,
          cantidad,
          precio_unitario,
          precio_base,
          porcentaje_comision,
          monto_comision,
          descuento_porcentaje
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          idOrden,
          item.id_producto,
          parseFloat(item.cantidad),
          precioFinal,
          precioBase,
          porcentajeComision,
          montoComision,
          parseFloat(item.descuento_porcentaje || 0)
        ]
      });

      if (reservar_stock) {
        const productoCheck = await executeQuery(
          'SELECT requiere_receta FROM productos WHERE id_producto = ?',
          [item.id_producto]
        );

        if (productoCheck.success && productoCheck.data.length > 0 && productoCheck.data[0].requiere_receta === 0) {
          queriesDetalle.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
            params: [parseFloat(item.cantidad), item.id_producto]
          });
        }
      }
    }

    await executeTransaction(queriesDetalle);
    
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
        numero_orden: numeroOrden,
        tipo_comprobante: tipoComp,
        numero_comprobante: numeroComprobante,
        stock_reservado: reservar_stock ? 1 : 0
      },
      message: reservar_stock 
        ? 'Orden de venta creada exitosamente y stock reservado' 
        : 'Orden de venta creada exitosamente'
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function updateOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const {
      id_cliente,
      fecha_emision,
      fecha_entrega_estimada,
      fecha_vencimiento,
      prioridad,
      moneda,
      tipo_cambio,
      tipo_impuesto,
      porcentaje_impuesto,
      tipo_venta,
      dias_credito,
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

    const ordenExistente = await executeQuery(`
      SELECT estado, stock_reservado FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);

    if (!ordenExistente.success || ordenExistente.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden de venta no encontrada' });
    }

    if (ordenExistente.data[0].estado !== 'En Espera') {
      return res.status(400).json({ success: false, error: 'Solo se pueden editar órdenes en estado En Espera' });
    }

    if (!id_cliente || !detalle || detalle.length === 0) {
      return res.status(400).json({ success: false, error: 'Cliente y detalle son obligatorios' });
    }

    const stockReservado = ordenExistente.data[0].stock_reservado === 1;

    if (stockReservado) {
      const detalleAnterior = await executeQuery(
        'SELECT id_producto, cantidad FROM detalle_orden_venta WHERE id_orden_venta = ?',
        [id]
      );

      for (const itemAnterior of detalleAnterior.data) {
        const productoCheck = await executeQuery(
          'SELECT requiere_receta FROM productos WHERE id_producto = ?',
          [itemAnterior.id_producto]
        );

        if (productoCheck.success && productoCheck.data.length > 0 && productoCheck.data[0].requiere_receta === 0) {
          await executeQuery(
            'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
            [parseFloat(itemAnterior.cantidad), itemAnterior.id_producto]
          );
        }
      }
    }

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

    // CÓDIGO CORREGIDO
    // Normalizamos a mayúsculas y quitamos espacios para evitar errores de tipeo
    const tipoImpuestoFinal = (tipo_impuesto || 'IGV').toUpperCase().trim();
    let porcentaje = 18.00;
    
    // Agregamos más casos para asegurar que detecte inafecto/exonerado
    if (['EXO', 'INA', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(tipoImpuestoFinal)) {
      porcentaje = 0.00;
    } else if (porcentaje_impuesto !== null && porcentaje_impuesto !== undefined) {
      porcentaje = parseFloat(porcentaje_impuesto);
    }

    const impuesto = subtotal * (porcentaje / 100);
    const total = subtotal + impuesto;

    let fechaVencimientoFinal = fecha_vencimiento;
    if (!fechaVencimientoFinal && fecha_emision) {
        const fechaBase = new Date(fecha_emision + 'T12:00:00');
        fechaBase.setDate(fechaBase.getDate() + (parseInt(dias_credito) || 0));
        fechaVencimientoFinal = fechaBase.toISOString().split('T')[0];
    }

    const updateResult = await executeQuery(`
      UPDATE ordenes_venta 
      SET 
        id_cliente = ?,
        fecha_emision = ?,
        fecha_entrega_estimada = ?,
        fecha_vencimiento = ?,
        prioridad = ?,
        moneda = ?,
        tipo_cambio = ?,
        tipo_impuesto = ?,
        porcentaje_impuesto = ?,
        tipo_venta = ?,
        dias_credito = ?,
        plazo_pago = ?,
        forma_pago = ?,
        orden_compra_cliente = ?,
        direccion_entrega = ?,
        lugar_entrega = ?,
        ciudad_entrega = ?,
        contacto_entrega = ?,
        telefono_entrega = ?,
        observaciones = ?,
        id_comercial = ?,
        subtotal = ?,
        igv = ?,
        total = ?,
        total_comision = ?,
        porcentaje_comision_promedio = ?
      WHERE id_orden_venta = ?
    `, [
      id_cliente,
      fecha_emision,
      fecha_entrega_estimada || null,
      fechaVencimientoFinal,
      prioridad || 'Media',
      moneda,
      parseFloat(tipo_cambio || 1.0000),
      tipoImpuestoFinal,
      porcentaje,
      tipo_venta || 'Contado',
      parseInt(dias_credito || 0),
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
      subtotal,
      impuesto,
      total,
      totalComision,
      porcentajeComisionPromedio,
      id
    ]);

    if (!updateResult.success) {
      return res.status(500).json({ success: false, error: updateResult.error });
    }

    await executeQuery('DELETE FROM detalle_orden_venta WHERE id_orden_venta = ?', [id]);

    const queriesNuevoDetalle = [];

    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      const precioBase = parseFloat(item.precio_base);
      const porcentajeComision = parseFloat(item.porcentaje_comision || 0);
      const montoComision = precioBase * (porcentajeComision / 100);
      const precioFinal = precioBase + montoComision;

      queriesNuevoDetalle.push({
        sql: `INSERT INTO detalle_orden_venta (
          id_orden_venta,
          id_producto,
          cantidad,
          precio_unitario,
          precio_base,
          porcentaje_comision,
          monto_comision,
          descuento_porcentaje
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id,
          item.id_producto,
          parseFloat(item.cantidad),
          precioFinal,
          precioBase,
          porcentajeComision,
          montoComision,
          parseFloat(item.descuento_porcentaje || 0)
        ]
      });

      if (stockReservado) {
        const productoCheck = await executeQuery(
          'SELECT requiere_receta FROM productos WHERE id_producto = ?',
          [item.id_producto]
        );

        if (productoCheck.success && productoCheck.data.length > 0 && productoCheck.data[0].requiere_receta === 0) {
          queriesNuevoDetalle.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
            params: [parseFloat(item.cantidad), item.id_producto]
          });
        }
      }
    }

    await executeTransaction(queriesNuevoDetalle);

    res.json({ success: true, message: 'Orden de venta actualizada exitosamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
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
    
    const numeroOrdenProduccion = `OP-${getFechaPeru().getFullYear()}-${String(numeroSecuenciaOP).padStart(4, '0')}`;
    
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function registrarDespacho(req, res) {
  try {
    const { id } = req.params; 
    const { detalles_despacho, fecha_despacho } = req.body; 
    const id_usuario = req.user?.id_empleado || null;

    if (!detalles_despacho || detalles_despacho.length === 0) {
      return res.status(400).json({ success: false, error: 'No se han indicado productos para despachar' });
    }

    const ordenResult = await executeQuery('SELECT * FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenResult.data.length === 0) return res.status(404).json({ error: 'Orden no encontrada' });
    const orden = ordenResult.data[0];

    if (orden.estado === 'Cancelada') {
      return res.status(400).json({ error: 'No se puede despachar una orden cancelada' });
    }
    if (orden.estado === 'Entregada') {
      return res.status(400).json({ error: 'Esta orden ya fue entregada completamente' });
    }

    const itemsOrden = await executeQuery('SELECT * FROM detalle_orden_venta WHERE id_orden_venta = ?', [id]);
    
    let totalCosto = 0;
    let totalPrecio = 0;
    const itemsProcesados = [];

    for (const itemDespacho of detalles_despacho) {
      const itemDb = itemsOrden.data.find(i => i.id_producto === itemDespacho.id_producto);
      
      if (!itemDb) return res.status(400).json({ error: `El producto ID ${itemDespacho.id_producto} no pertenece a esta orden` });

      const pendiente = parseFloat(itemDb.cantidad) - parseFloat(itemDb.cantidad_despachada || 0);
      const cantidadADespachar = parseFloat(itemDespacho.cantidad);

      if (cantidadADespachar > pendiente) {
        return res.status(400).json({ error: `Exceso de cantidad para el producto ${itemDespacho.id_producto}. Pendiente: ${pendiente}, Solicitado: ${cantidadADespachar}` });
      }

      const productoStock = await executeQuery('SELECT stock_actual, costo_unitario_promedio, requiere_receta FROM productos WHERE id_producto = ?', [itemDespacho.id_producto]);
      
      if (productoStock.data[0].requiere_receta === 0 && !orden.stock_reservado) {
        if (parseFloat(productoStock.data[0].stock_actual) < cantidadADespachar) {
          return res.status(400).json({ error: `Stock insuficiente para el producto ID ${itemDespacho.id_producto}` });
        }
      }

      const costoUnitario = parseFloat(productoStock.data[0].costo_unitario_promedio || 0);
      const precioUnitario = parseFloat(itemDb.precio_unitario || 0);
      
      totalCosto += cantidadADespachar * costoUnitario;
      totalPrecio += cantidadADespachar * precioUnitario;

      itemsProcesados.push({
        ...itemDespacho,
        costo_unitario: costoUnitario,
        precio_unitario: precioUnitario,
        requiere_receta: productoStock.data[0].requiere_receta
      });
    }

    const queries = [];

    queries.push({
      sql: `INSERT INTO salidas (
        id_tipo_inventario, tipo_movimiento, id_cliente, total_costo, 
        total_precio, moneda, id_registrado_por, observaciones, estado, fecha_movimiento
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        3, 
        'Venta',
        orden.id_cliente,
        totalCosto,
        totalPrecio,
        orden.moneda,
        id_usuario,
        `Despacho Orden ${orden.numero_orden}`,
        'Activo',
        fecha_despacho || getFechaPeru()
      ]
    });

    const resultTx = await executeTransaction(queries);
    if (!resultTx.success) return res.status(500).json({ error: resultTx.error });

    const idSalida = resultTx.data[0].insertId;
    const queriesDetalle = [];

    for (const item of itemsProcesados) {
      queriesDetalle.push({
        sql: `INSERT INTO detalle_salidas (id_salida, id_producto, cantidad, costo_unitario, precio_unitario) VALUES (?, ?, ?, ?, ?)`,
        params: [idSalida, item.id_producto, item.cantidad, item.costo_unitario, item.precio_unitario]
      });

      if (item.requiere_receta === 0 && !orden.stock_reservado) {
        queriesDetalle.push({
          sql: `UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?`,
          params: [item.cantidad, item.id_producto]
        });
      }

      queriesDetalle.push({
        sql: `UPDATE detalle_orden_venta SET cantidad_despachada = cantidad_despachada + ? WHERE id_orden_venta = ? AND id_producto = ?`,
        params: [item.cantidad, id, item.id_producto]
      });
    }

    await executeTransaction(queriesDetalle);

    const verificacion = await executeQuery(`
      SELECT 
        COUNT(*) as total_items,
        SUM(CASE WHEN cantidad = cantidad_despachada THEN 1 ELSE 0 END) as items_completados
      FROM detalle_orden_venta WHERE id_orden_venta = ?
    `, [id]);

    const { total_items, items_completados } = verificacion.data[0];
    
    let nuevoEstado = 'Despacho Parcial';
    if (parseInt(total_items) === parseInt(items_completados)) {
      nuevoEstado = 'Despachada';
    }

    await executeQuery(
      'UPDATE ordenes_venta SET estado = ? WHERE id_orden_venta = ?', 
      [nuevoEstado, id]
    );

    res.json({
      success: true,
      message: `Despacho registrado correctamente. Orden pasó a estado: ${nuevoEstado}`,
      data: { 
        id_salida: idSalida, 
        nuevo_estado: nuevoEstado 
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function anularDespacho(req, res) {
  try {
    const { id, idSalida } = req.params;
    const id_usuario = req.user?.id_empleado || null;

    if (!id_usuario) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    const ordenResult = await executeQuery('SELECT * FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden de venta no encontrada' });
    }
    const orden = ordenResult.data[0];

    const salidaResult = await executeQuery(
      'SELECT * FROM salidas WHERE id_salida = ? AND observaciones LIKE ?', 
      [idSalida, `%${orden.numero_orden}%`]
    );
    
    if (salidaResult.data.length === 0) {
      return res.status(404).json({ error: 'Salida no encontrada o no pertenece a esta orden' });
    }

    const salida = salidaResult.data[0];

    if (salida.estado !== 'Activo') {
      return res.status(400).json({ error: 'Esta salida ya fue anulada' });
    }

    const detalleSalida = await executeQuery(
      'SELECT * FROM detalle_salidas WHERE id_salida = ?',
      [idSalida]
    );

    const queriesReversion = [];

    for (const item of detalleSalida.data) {
      const productoInfo = await executeQuery(
        'SELECT requiere_receta FROM productos WHERE id_producto = ?',
        [item.id_producto]
      );

      if (productoInfo.success && productoInfo.data.length > 0) {
        const requiereReceta = productoInfo.data[0].requiere_receta;

        if (requiereReceta === 0 && !orden.stock_reservado) {
          queriesReversion.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
            params: [item.cantidad, item.id_producto]
          });
        }
      }

      queriesReversion.push({
        sql: 'UPDATE detalle_orden_venta SET cantidad_despachada = cantidad_despachada - ? WHERE id_orden_venta = ? AND id_producto = ?',
        params: [item.cantidad, id, item.id_producto]
      });
    }

    queriesReversion.push({
      sql: 'UPDATE salidas SET estado = ?, observaciones = CONCAT(observaciones, " - ANULADA") WHERE id_salida = ?',
      params: ['Anulado', idSalida]
    });

    await executeTransaction(queriesReversion);

    const verificacion = await executeQuery(`
      SELECT 
        COUNT(*) as total_items,
        SUM(CASE WHEN cantidad_despachada > 0 THEN 1 ELSE 0 END) as items_con_despachos,
        SUM(CASE WHEN cantidad = cantidad_despachada THEN 1 ELSE 0 END) as items_completados
      FROM detalle_orden_venta WHERE id_orden_venta = ?
    `, [id]);

    const { total_items, items_con_despachos, items_completados } = verificacion.data[0];
    
    let nuevoEstado = 'En Espera';
    if (items_completados == total_items && total_items > 0) {
      nuevoEstado = 'Despachada';
    } else if (items_con_despachos > 0) {
      nuevoEstado = 'Despacho Parcial';
    }

    await executeQuery(
      'UPDATE ordenes_venta SET estado = ? WHERE id_orden_venta = ?',
      [nuevoEstado, id]
    );

    res.json({
      success: true,
      message: `Despacho anulado correctamente. Orden pasó a estado: ${nuevoEstado}`,
      data: {
        id_salida_anulada: idSalida,
        nuevo_estado: nuevoEstado
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function anularOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { motivo_anulacion } = req.body;
    const id_usuario = req.user?.id_empleado || null;

    if (!id_usuario) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    const ordenResult = await executeQuery('SELECT * FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden de venta no encontrada' });
    }
    const orden = ordenResult.data[0];

    if (orden.estado === 'Cancelada') {
      return res.status(400).json({ error: 'Esta orden ya fue cancelada' });
    }

    if (orden.estado === 'Entregada') {
      return res.status(400).json({ error: 'No se puede anular una orden que ya fue entregada' });
    }

    const queriesAnulacion = [];

    if (orden.stock_reservado === 1) {
      const detalleOrden = await executeQuery(
        'SELECT id_producto, cantidad FROM detalle_orden_venta WHERE id_orden_venta = ?',
        [id]
      );

      for (const item of detalleOrden.data) {
        const productoInfo = await executeQuery(
          'SELECT requiere_receta FROM productos WHERE id_producto = ?',
          [item.id_producto]
        );

        if (productoInfo.success && productoInfo.data.length > 0 && productoInfo.data[0].requiere_receta === 0) {
          queriesAnulacion.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
            params: [parseFloat(item.cantidad), item.id_producto]
          });
        }
      }
    }

    const salidasResult = await executeQuery(
      'SELECT * FROM salidas WHERE observaciones LIKE ? AND estado = ?',
      [`%${orden.numero_orden}%`, 'Activo']
    );

    for (const salida of salidasResult.data) {
      const detalleSalida = await executeQuery(
        'SELECT * FROM detalle_salidas WHERE id_salida = ?',
        [salida.id_salida]
      );

      for (const item of detalleSalida.data) {
        const productoInfo = await executeQuery(
          'SELECT requiere_receta FROM productos WHERE id_producto = ?',
          [item.id_producto]
        );

        if (productoInfo.success && productoInfo.data.length > 0) {
          const requiereReceta = productoInfo.data[0].requiere_receta;

          if (requiereReceta === 0 && !orden.stock_reservado) {
            queriesAnulacion.push({
              sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
              params: [item.cantidad, item.id_producto]
            });
          }
        }
      }

      queriesAnulacion.push({
        sql: 'UPDATE salidas SET estado = ?, observaciones = CONCAT(observaciones, " - ANULADA POR CANCELACIÓN OV") WHERE id_salida = ?',
        params: ['Anulado', salida.id_salida]
      });
    }

    queriesAnulacion.push({
      sql: 'UPDATE detalle_orden_venta SET cantidad_despachada = 0 WHERE id_orden_venta = ?',
      params: [id]
    });

    const motivoFinal = motivo_anulacion || 'Sin motivo especificado';
    queriesAnulacion.push({
      sql: 'UPDATE ordenes_venta SET estado = ?, observaciones = CONCAT(COALESCE(observaciones, ""), " - ANULADA: ", ?) WHERE id_orden_venta = ?',
      params: ['Cancelada', motivoFinal, id]
    });

    await executeTransaction(queriesAnulacion);

    if (orden.id_cotizacion) {
      await executeQuery(
        'UPDATE cotizaciones SET estado = ?, convertida_venta = 0, id_orden_venta = NULL WHERE id_cotizacion = ?',
        ['Enviada', orden.id_cotizacion]
      );
    }

    res.json({
      success: true,
      message: 'Orden de venta anulada correctamente',
      data: {
        salidas_anuladas: salidasResult.data.length,
        stock_devuelto: orden.stock_reservado === 1,
        motivo: motivoFinal
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function actualizarEstadoOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { estado, fecha_entrega_real } = req.body;
    const id_usuario = req.user?.id_empleado || null;
    
    const estadosValidos = ['En Espera', 'En Proceso', 'Atendido por Producción', 'Despacho Parcial', 'Despachada', 'Entregada', 'Cancelada'];
    
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

    if (estado === 'Entregada' && (estadoAnterior === 'Despacho Parcial' || estadoAnterior === 'Despachada')) {
      const updateResult = await executeQuery(`
        UPDATE ordenes_venta 
        SET estado = ?,
            fecha_entrega_real = ?
        WHERE id_orden_venta = ?
      `, [estado, fecha_entrega_real || getFechaISOPeru(), id]);

      if (!updateResult.success) {
        return res.status(500).json({ success: false, error: updateResult.error });
      }

      return res.json({
        success: true,
        message: `Estado actualizado a ${estado}`,
        data: { nuevo_estado: estado }
      });
    }
    
    const updateResult = await executeQuery(`
      UPDATE ordenes_venta 
      SET estado = ?,
          fecha_entrega_real = ?
      WHERE id_orden_venta = ?
    `, [estado, fecha_entrega_real || null, id]);
    
    if (!updateResult.success) {
      return res.status(500).json({ 
        success: false,
        error: updateResult.error 
      });
    }
    
    res.json({
      success: true,
      message: `Estado actualizado a ${estado}`,
      data: { nuevo_estado: estado }
    });
    
  } catch (error) {
    console.error(error);
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
    console.error(error);
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
        SUM(CASE WHEN estado = 'Despacho Parcial' THEN 1 ELSE 0 END) AS despacho_parcial,
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function descargarPDFOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { tipo } = req.query; 

    console.log("=========================================");
    console.log("🛑 DEBUG PDF - INICIO");
    console.log(`➡️ ID Recibido: '${id}' (Tipo: ${typeof id})`);
    
    // VALIDACIÓN 1: ¿El ID existe?
    if (!id || id === 'undefined' || id === 'null') {
      console.log("❌ ERROR: ID es inválido.");
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    // VALIDACIÓN 2: ¿Qué devuelve la base de datos?
    console.log("🔄 Ejecutando consulta SQL...");
    const ordenResult = await executeQuery(`SELECT * FROM ordenes_venta WHERE id_orden_venta = ?`, [id]);
    
    console.log("📊 Resultado SQL:", ordenResult.data); // <--- ESTO ES LO IMPORTANTE

    if (!ordenResult.success || ordenResult.data.length === 0) {
      console.log("❌ ERROR: La base de datos devolvió 0 filas.");
      return res.status(404).json({ success: false, error: 'Orden de venta no encontrada' });
    }

    const orden = ordenResult.data[0];
    console.log(`✅ Orden encontrada: ${orden.numero_orden}`);

    // ... (aquí sigue el resto de tu código normal de obtener detalle y generar PDF) ...
    // Solo para probar si el problema es la BD, corta aquí y envía un "OK" falso por un momento:
    /*
    return res.json({ success: true, message: "DEBUG: Orden encontrada, deteniendo antes de generar PDF" });
    */
    
    // Si descomentas lo de arriba, verás si la BD responde. Si lo dejas comentado, intentará generar el PDF.
    
    // -- CONTINUACIÓN ORIGINAL DEL CÓDIGO (Resumida para no pegar todo) --
    const detalleResult = await executeQuery(`
      SELECT dov.*, p.codigo AS codigo_producto, p.nombre AS producto, p.unidad_medida
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      WHERE dov.id_orden_venta = ?
    `, [id]);
    
    orden.detalle = detalleResult.data;

    let pdfBuffer;
    if (tipo === 'comprobante') {
        // ... lógica de comprobante
         pdfBuffer = await generarOrdenVentaPDF(orden); // Usamos el generador por defecto por ahora para probar
    } else {
        pdfBuffer = await generarOrdenVentaPDF(orden);
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Orden-${orden.numero_orden}.pdf"`);
    res.send(pdfBuffer);
    console.log("✅ PDF Enviado al cliente");

  } catch (error) {
    console.error("🔥 CRASH:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function descargarPDFDespacho(req, res) {
  try {
    const { id, idSalida } = req.params;

    const ordenResult = await executeQuery(`
      SELECT 
        ov.numero_orden,
        ov.estado,
        ov.moneda,
        ov.id_cliente,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
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

    const salidaResult = await executeQuery(`
      SELECT * FROM salidas 
      WHERE id_salida = ? AND observaciones LIKE ?
    `, [idSalida, `%${orden.numero_orden}%`]);

    if (!salidaResult.success || salidaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Salida no encontrada'
      });
    }

    const salida = salidaResult.data[0];

    const detalleResult = await executeQuery(`
      SELECT 
        ds.cantidad,
        ds.costo_unitario,
        ds.precio_unitario,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_salidas ds
      INNER JOIN productos p ON ds.id_producto = p.id_producto
      WHERE ds.id_salida = ?
    `, [idSalida]);

    if (!detalleResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener detalle de la salida'
      });
    }

    const datosPDF = {
      id_salida: salida.id_salida,
      numero_orden: orden.numero_orden,
      numero_cotizacion: orden.numero_cotizacion,
      fecha_movimiento: salida.fecha_movimiento,
      tipo_movimiento: salida.tipo_movimiento,
      estado: salida.estado,
      observaciones: salida.observaciones,
      moneda: orden.moneda,
      cliente: orden.cliente,
      detalles: detalleResult.data
    };

    const pdfBuffer = await generarPDFSalida(datosPDF);
    const filename = `Despacho-${orden.numero_orden}-Salida-${salida.id_salida}.pdf`;

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
    
    if (montoPagadoActual + montoNuevoPago > totalOrden + 0.1) {
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
    
    if (nuevoMontoPagado >= totalOrden - 0.1) {
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
    console.error(error);
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
    console.error(error);
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
    
    if (nuevoMontoPagado >= totalOrden - 0.1) {
      estadoPago = 'Pagado';
    } else if (nuevoMontoPagado <= 0.1) {
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
    console.error(error);
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getSalidasOrden(req, res) {
  try {
    const { id } = req.params;
    
    const ordenRes = await executeQuery('SELECT numero_orden FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    
    if (ordenRes.data.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const numeroOrden = ordenRes.data[0].numero_orden;
    
    const sql = `
      SELECT 
        s.id_salida, 
        s.id_salida as numero_salida, 
        s.fecha_movimiento as fecha_salida, 
        s.observaciones,
        s.estado,
        s.total_costo,
        (SELECT COUNT(*) FROM detalle_salidas WHERE id_salida = s.id_salida) as total_items
      FROM salidas s
      WHERE s.observaciones LIKE ? 
      ORDER BY s.fecha_movimiento DESC
    `;
    
    const result = await executeQuery(sql, [`%${numeroOrden}%`]);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result.data });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}
export async function actualizarTipoComprobante(req, res) {
  try {
    const { id } = req.params;
    const { tipo_comprobante } = req.body;

    if (!tipo_comprobante || !['Factura', 'Nota de Venta'].includes(tipo_comprobante)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de comprobante inválido. Debe ser "Factura" o "Nota de Venta"'
      });
    }

    const ordenResult = await executeQuery(
      'SELECT comprobante_editado, estado, tipo_comprobante FROM ordenes_venta WHERE id_orden_venta = ?',
      [id]
    );

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }

    const orden = ordenResult.data[0];

    if (orden.comprobante_editado === 1) {
      return res.status(400).json({
        success: false,
        error: 'El tipo de comprobante ya fue editado anteriormente. Solo se permite un cambio.'
      });
    }

    if (['Cancelada', 'Entregada'].includes(orden.estado)) {
      return res.status(400).json({
        success: false,
        error: 'No se puede editar el comprobante de una orden cancelada o entregada'
      });
    }

    let numeroComprobante = null;

    if (tipo_comprobante === 'Factura') {
      const ultimaFactura = await executeQuery(`
        SELECT numero_comprobante 
        FROM ordenes_venta 
        WHERE tipo_comprobante = 'Factura'
        AND numero_comprobante IS NOT NULL
        ORDER BY id_orden_venta DESC 
        LIMIT 1
      `);

      let numeroSecuenciaFactura = 1;
      if (ultimaFactura.success && ultimaFactura.data.length > 0 && ultimaFactura.data[0].numero_comprobante) {
        const match = ultimaFactura.data[0].numero_comprobante.match(/F\d{3}-(\d+)$/);
        if (match) {
          numeroSecuenciaFactura = parseInt(match[1]) + 1;
        }
      }

      numeroComprobante = `F001-${String(numeroSecuenciaFactura).padStart(8, '0')}`;

    } else if (tipo_comprobante === 'Nota de Venta') {
      const ultimaNota = await executeQuery(`
        SELECT numero_comprobante 
        FROM ordenes_venta 
        WHERE tipo_comprobante = 'Nota de Venta'
        AND numero_comprobante IS NOT NULL
        ORDER BY id_orden_venta DESC 
        LIMIT 1
      `);

      let numeroSecuenciaNota = 1;
      if (ultimaNota.success && ultimaNota.data.length > 0 && ultimaNota.data[0].numero_comprobante) {
        const match = ultimaNota.data[0].numero_comprobante.match(/NV\d{3}-(\d+)$/);
        if (match) {
          numeroSecuenciaNota = parseInt(match[1]) + 1;
        }
      }

      numeroComprobante = `NV001-${String(numeroSecuenciaNota).padStart(8, '0')}`;
    }

    const updateResult = await executeQuery(
      `UPDATE ordenes_venta 
       SET tipo_comprobante = ?, 
           numero_comprobante = ?,
           comprobante_editado = 1,
           fecha_actualizacion = NOW()
       WHERE id_orden_venta = ?`,
      [tipo_comprobante, numeroComprobante, id]
    );

    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: updateResult.error
      });
    }

    res.json({
      success: true,
      message: 'Tipo de comprobante actualizado exitosamente',
      data: {
        tipo_comprobante,
        numero_comprobante
      }
    });

  } catch (error) {
    console.error('Error al actualizar tipo de comprobante:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}