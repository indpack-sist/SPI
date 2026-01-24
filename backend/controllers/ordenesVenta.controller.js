import { executeQuery, executeTransaction } from '../config/database.js';
import { generarOrdenVentaPDF } from '../utils/pdfGenerators/ordenVentaPDF.js';
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
        ov.tipo_comprobante,
        ov.numero_comprobante,
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
        ov.orden_compra_cliente,
        ov.id_vehiculo,
        ov.id_conductor,
        ov.tipo_entrega,
        ov.transporte_nombre,
        ov.transporte_placa,
        ov.transporte_conductor,
        ov.transporte_dni,
        c.numero_cotizacion,
        cl.id_cliente,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        e_comercial.nombre_completo AS comercial,
        e_registrado.nombre_completo AS registrado_por,
        e_conductor.nombre_completo AS conductor,
        f.placa AS vehiculo_placa,
        f.marca_modelo AS vehiculo_modelo,
        ov.id_comercial,
        ov.id_registrado_por,
        (SELECT COUNT(*) FROM detalle_orden_venta WHERE id_orden_venta = ov.id_orden_venta) AS total_items,
        (SELECT COUNT(*) FROM salidas WHERE observaciones LIKE CONCAT('%', ov.numero_orden, '%') AND estado = 'Activo') AS total_despachos
      FROM ordenes_venta ov
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e_comercial ON ov.id_comercial = e_comercial.id_empleado
      LEFT JOIN empleados e_registrado ON ov.id_registrado_por = e_registrado.id_empleado
      LEFT JOIN empleados e_conductor ON ov.id_conductor = e_conductor.id_empleado
      LEFT JOIN flota f ON ov.id_vehiculo = f.id_vehiculo
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
        e_conductor.nombre_completo AS conductor_nombre,
        f.placa AS vehiculo_placa_interna,
        f.marca_modelo AS vehiculo_modelo,
        f.capacidad_kg AS vehiculo_capacidad_kg,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
      LEFT JOIN empleados e_conductor ON ov.id_conductor = e_conductor.id_empleado
      LEFT JOIN flota f ON ov.id_vehiculo = f.id_vehiculo
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
        (SELECT COUNT(*) FROM ordenes_produccion WHERE id_orden_venta_origen = ? AND id_producto_terminado = dov.id_producto AND estado != 'Cancelada') AS tiene_op
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

    const detalleResult = await executeQuery(`
      SELECT 
        dov.id_detalle, 
        dov.id_producto, 
        dov.cantidad, 
        COALESCE(dov.cantidad_reservada, 0) AS cantidad_reservada_actual,
        dov.stock_reservado AS estado_reserva_item,
        p.stock_actual, 
        p.nombre, 
        p.requiere_receta 
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      WHERE dov.id_orden_venta = ?
    `, [id]);

    if (!detalleResult.success || detalleResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada o sin detalles' });
    }

    const detalles = detalleResult.data;
    const productosParaReservar = [];

    for (const item of detalles) {
      const stockEnAlmacen = parseFloat(item.stock_actual || 0);
      const cantidadRequerida = parseFloat(item.cantidad);
      const yaReservado = parseFloat(item.cantidad_reservada_actual);

      const stockTotalDisponibleParaLinea = stockEnAlmacen + yaReservado;

      let estadoSugerido = 'sin_stock';
      let cantidadSugerida = yaReservado;

      if (yaReservado >= cantidadRequerida - 0.001) {
        estadoSugerido = 'completo';
      } else if (yaReservado > 0) {
        estadoSugerido = 'parcial';
      } else {
        if (stockEnAlmacen >= cantidadRequerida) {
             cantidadSugerida = cantidadRequerida;
             estadoSugerido = 'completo'; 
        } else if (stockEnAlmacen > 0) {
             cantidadSugerida = stockEnAlmacen; 
             estadoSugerido = 'parcial';
        } else {
             cantidadSugerida = 0;
             estadoSugerido = item.requiere_receta === 1 ? 'requiere_produccion' : 'sin_stock';
        }
      }

      productosParaReservar.push({
        id_producto: item.id_producto,
        id_detalle: item.id_detalle,
        nombre: item.nombre,
        cantidad_requerida: cantidadRequerida,
        stock_maximo_disponible: stockTotalDisponibleParaLinea, 
        cantidad_ya_reservada: yaReservado,
        cantidad_reservable: cantidadSugerida, 
        estado_reserva: estadoSugerido
      });
    }

    const resumen = {
      total_items: productosParaReservar.length,
      con_stock_completo: productosParaReservar.filter(p => p.estado_reserva === 'completo').length,
      con_stock_parcial: productosParaReservar.filter(p => p.estado_reserva === 'parcial').length,
      sin_stock: productosParaReservar.filter(p => p.estado_reserva === 'sin_stock').length,
      requieren_produccion: productosParaReservar.filter(p => p.estado_reserva === 'requiere_produccion').length
    };

    res.json({
      success: true,
      data: {
        productos: productosParaReservar,
        resumen: resumen
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function ejecutarReservaStock(req, res) {
  try {
    const { id } = req.params;
    const { productos_a_reservar } = req.body;

    const ordenCheck = await executeQuery('SELECT estado FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenCheck.data.length > 0 && ordenCheck.data[0].estado === 'Cancelada') {
       return res.status(400).json({ error: 'No se puede modificar reservas de una orden cancelada' });
    }

    if (!productos_a_reservar || productos_a_reservar.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay datos para procesar' });
    }

    const queries = [];
    
    const estadoActualResult = await executeQuery(
      'SELECT id_detalle, id_producto, cantidad, COALESCE(cantidad_reservada, 0) as reservado_bd FROM detalle_orden_venta WHERE id_orden_venta = ?',
      [id]
    );
    
    const mapaActual = {};
    if (estadoActualResult.success) {
        estadoActualResult.data.forEach(row => {
            mapaActual[row.id_detalle] = {
                id_producto: row.id_producto,
                reservado: parseFloat(row.reservado_bd),
                requerido: parseFloat(row.cantidad)
            };
        });
    }

    for (const item of productos_a_reservar) {
      const infoActual = mapaActual[item.id_detalle];
      if (!infoActual) continue;

      const nuevaCantidad = parseFloat(item.nueva_cantidad_reserva);
      const cantidadAnterior = infoActual.reservado;
      const diferencia = nuevaCantidad - cantidadAnterior;

      if (diferencia !== 0) {
        if (diferencia > 0) {
             const stockCheck = await executeQuery('SELECT stock_actual FROM productos WHERE id_producto = ?', [infoActual.id_producto]);
             if (stockCheck.success && stockCheck.data.length > 0) {
                 if (parseFloat(stockCheck.data[0].stock_actual) < diferencia) {
                     return res.status(400).json({ error: `Stock insuficiente para aumentar la reserva (Faltan ${diferencia - parseFloat(stockCheck.data[0].stock_actual)})` });
                 }
             }
        }
        queries.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
          params: [diferencia, item.id_producto]
        });
      }

      let nuevoEstadoItem = 0; 
      if (nuevaCantidad >= infoActual.requerido - 0.001 && nuevaCantidad > 0) {
          nuevoEstadoItem = 1; 
      } else if (nuevaCantidad > 0) {
          nuevoEstadoItem = 2; 
      }

      queries.push({
        sql: 'UPDATE detalle_orden_venta SET stock_reservado = ?, cantidad_reservada = ? WHERE id_detalle = ?',
        params: [nuevoEstadoItem, nuevaCantidad, item.id_detalle]
      });
    }

    await executeTransaction(queries);

    await executeQuery(`
        UPDATE ordenes_venta 
        SET stock_reservado = CASE 
            WHEN (SELECT COUNT(*) FROM detalle_orden_venta WHERE id_orden_venta = ? AND stock_reservado != 1) = 0 THEN 1 
            WHEN (SELECT COUNT(*) FROM detalle_orden_venta WHERE id_orden_venta = ? AND stock_reservado > 0) > 0 THEN 2 
            ELSE 0 
        END
        WHERE id_orden_venta = ?
    `, [id, id, id]);

    res.json({
      success: true,
      message: 'Reserva actualizada correctamente'
    });

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
      id_vehiculo,
      id_conductor,
      tipo_entrega,
      transporte_nombre,
      transporte_placa,
      transporte_conductor,
      transporte_dni,
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

    let idVehiculoFinal = null;
    let idConductorFinal = null;
    let transNombreFinal = null;
    let transPlacaFinal = null;
    let transCondFinal = null;
    let transDniFinal = null;

    if (tipo_entrega === 'Vehiculo Empresa') {
      idVehiculoFinal = id_vehiculo || null;
      idConductorFinal = id_conductor || null;

      if (idVehiculoFinal) {
        const vehiculoResult = await executeQuery(
          'SELECT * FROM flota WHERE id_vehiculo = ? AND estado IN ("Disponible", "En Uso")',
          [idVehiculoFinal]
        );

        if (!vehiculoResult.success || vehiculoResult.data.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Vehículo no encontrado o no disponible'
          });
        }
      }

      if (idConductorFinal) {
        const conductorResult = await executeQuery(
          'SELECT * FROM empleados WHERE id_empleado = ? AND rol = "Conductor" AND estado = "Activo"',
          [idConductorFinal]
        );

        if (!conductorResult.success || conductorResult.data.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Conductor no encontrado o no activo'
          });
        }
      }
    } else if (tipo_entrega === 'Transporte Privado') {
      transNombreFinal = transporte_nombre || null;
      transPlacaFinal = transporte_placa || null;
      transCondFinal = transporte_conductor || null;
      transDniFinal = transporte_dni || null;
    }

    let subtotal = 0;

    for (const item of detalle) {
      const precioVenta = parseFloat(item.precio_venta);
      const valorVenta = (item.cantidad * precioVenta) * (1 - parseFloat(item.descuento_porcentaje || 0) / 100);
      subtotal += valorVenta;
    }

    const tipoImpuestoFinal = (tipo_impuesto || 'IGV').toUpperCase().trim();
    let porcentaje = 18.00;

    if (['EXO', 'INA', 'INAFECTO', 'EXONERADO', '0'].includes(tipoImpuestoFinal)) {
      porcentaje = 0.00;
    } else if (porcentaje_impuesto !== null && porcentaje_impuesto !== undefined) {
      porcentaje = parseFloat(porcentaje_impuesto);
    }

    const impuesto = subtotal * (porcentaje / 100);
    const total = subtotal + impuesto;

    if (plazo_pago !== 'Contado') {
        const clienteInfo = await executeQuery(
            'SELECT usar_limite_credito, COALESCE(limite_credito_pen, 0) as limite_pen, COALESCE(limite_credito_usd, 0) as limite_usd FROM clientes WHERE id_cliente = ?', 
            [id_cliente]
        );
  
        if (clienteInfo.success && clienteInfo.data.length > 0) {
            const cliente = clienteInfo.data[0];
            
            if (cliente.usar_limite_credito == 1) {
                const deudaResult = await executeQuery(`
                    SELECT COALESCE(SUM(total - monto_pagado), 0) as deuda_actual
                    FROM ordenes_venta
                    WHERE id_cliente = ? 
                    AND moneda = ? 
                    AND estado != 'Cancelada' 
                    AND estado_pago != 'Pagado'
                `, [id_cliente, moneda]);
  
                const limiteAsignado = moneda === 'USD' ? parseFloat(cliente.limite_usd) : parseFloat(cliente.limite_pen);
                const deudaActual = parseFloat(deudaResult.data[0]?.deuda_actual || 0);
                const nuevaDeudaTotal = deudaActual + total;
  
                if (nuevaDeudaTotal > limiteAsignado) {
                    return res.status(400).json({
                        success: false,
                        error: `Límite de crédito excedido. Disponible: ${moneda} ${(limiteAsignado - deudaActual).toFixed(2)}. Requerido: ${moneda} ${total.toFixed(2)}.`
                    });
                }
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
        id_vehiculo,
        id_conductor,
        tipo_entrega,
        transporte_nombre,
        transporte_placa,
        transporte_conductor,
        transporte_dni,
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
        estado,
        stock_reservado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En Espera', 0)
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
      orden_compra_cliente || null,
      idVehiculoFinal,
      idConductorFinal,
      tipo_entrega || 'Vehiculo Empresa',
      transNombreFinal,
      transPlacaFinal,
      transCondFinal,
      transDniFinal,
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
      total
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
      const precioVenta = parseFloat(item.precio_venta);

      queriesDetalle.push({
        sql: `INSERT INTO detalle_orden_venta (
          id_orden_venta,
          id_producto,
          cantidad,
          precio_unitario,
          precio_base,
          descuento_porcentaje,
          stock_reservado
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [
          idOrden,
          item.id_producto,
          parseFloat(item.cantidad),
          precioVenta,
          precioBase,
          parseFloat(item.descuento_porcentaje || 0),
          reservar_stock ? 1 : 0
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

    if (reservar_stock) {
        queriesDetalle.push({
            sql: 'UPDATE ordenes_venta SET stock_reservado = 1 WHERE id_orden_venta = ?',
            params: [idOrden]
        });
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
      message: 'Orden de venta creada exitosamente'
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
      id_vehiculo,
      id_conductor,
      tipo_entrega,
      transporte_nombre,
      transporte_placa,
      transporte_conductor,
      transporte_dni,
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
      SELECT estado, stock_reservado, id_cotizacion FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);

    if (!ordenExistente.success || ordenExistente.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden de venta no encontrada' });
    }

    const ordenActual = ordenExistente.data[0];
    
    if (ordenActual.estado === 'Cancelada') {
        return res.status(400).json({ success: false, error: 'No se puede editar una orden Cancelada' });
    }

    if (!id_cliente || !detalle || detalle.length === 0) {
      return res.status(400).json({ success: false, error: 'Cliente y detalle son obligatorios' });
    }

    const stockReservado = ordenActual.stock_reservado === 1;

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

    const tipoImpuestoFinal = (tipo_impuesto || 'IGV').toUpperCase().trim();
    let porcentaje = 18.00;
    
    if (['EXO', 'INA', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(tipoImpuestoFinal)) {
      porcentaje = 0.00;
    } else if (porcentaje_impuesto !== null && porcentaje_impuesto !== undefined) {
      porcentaje = parseFloat(porcentaje_impuesto);
    }

    const impuesto = subtotal * (porcentaje / 100);
    const total = subtotal + impuesto;

    if (plazo_pago !== 'Contado') {
        const clienteInfo = await executeQuery(
            'SELECT usar_limite_credito, COALESCE(limite_credito_pen, 0) as limite_pen, COALESCE(limite_credito_usd, 0) as limite_usd FROM clientes WHERE id_cliente = ?', 
            [id_cliente]
        );
  
        if (clienteInfo.success && clienteInfo.data.length > 0) {
            const cliente = clienteInfo.data[0];
            
            if (cliente.usar_limite_credito == 1) {
                const deudaResult = await executeQuery(`
                    SELECT COALESCE(SUM(total - monto_pagado), 0) as deuda_actual
                    FROM ordenes_venta
                    WHERE id_cliente = ? 
                    AND moneda = ? 
                    AND estado != 'Cancelada' 
                    AND estado_pago != 'Pagado'
                    AND id_orden_venta != ?
                `, [id_cliente, moneda, id]);
  
                const limiteAsignado = moneda === 'USD' ? parseFloat(cliente.limite_usd) : parseFloat(cliente.limite_pen);
                const deudaActual = parseFloat(deudaResult.data[0]?.deuda_actual || 0);
                const nuevaDeudaTotal = deudaActual + total;
  
                if (nuevaDeudaTotal > limiteAsignado) {
                    return res.status(400).json({
                        success: false,
                        error: `Límite de crédito excedido en la edición. Disponible: ${moneda} ${(limiteAsignado - deudaActual).toFixed(2)}. Requerido: ${moneda} ${total.toFixed(2)}.`
                    });
                }
            }
        }
    }

    let fechaVencimientoFinal = fecha_vencimiento;
    if (!fechaVencimientoFinal && fecha_emision) {
        const fechaBase = new Date(fecha_emision + 'T12:00:00');
        fechaBase.setDate(fechaBase.getDate() + (parseInt(dias_credito) || 0));
        fechaVencimientoFinal = fechaBase.toISOString().split('T')[0];
    }

    const tipoEntregaFinal = tipo_entrega || 'Vehiculo Empresa';
    
    let idVehiculoFinal = null;
    let idConductorFinal = null;
    let transporteNombreFinal = null;
    let transportePlacaFinal = null;
    let transporteConductorFinal = null;
    let transporteDniFinal = null;

    if (tipoEntregaFinal === 'Vehiculo Empresa') {
      idVehiculoFinal = id_vehiculo || null;
      idConductorFinal = id_conductor || null;
    } else if (tipoEntregaFinal === 'Transporte Privado') {
      transporteNombreFinal = transporte_nombre || null;
      transportePlacaFinal = transporte_placa || null;
      transporteConductorFinal = transporte_conductor || null;
      transporteDniFinal = transporte_dni || null;
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
        id_vehiculo = ?,
        id_conductor = ?,
        tipo_entrega = ?,
        transporte_nombre = ?,
        transporte_placa = ?,
        transporte_conductor = ?,
        transporte_dni = ?,
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
      forma_pago || null,
      orden_compra_cliente || null,
      idVehiculoFinal,
      idConductorFinal,
      tipoEntregaFinal,
      transporteNombreFinal,
      transportePlacaFinal,
      transporteConductorFinal,
      transporteDniFinal,
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
          descuento_porcentaje,
          stock_reservado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id,
          item.id_producto,
          parseFloat(item.cantidad),
          precioFinal,
          precioBase,
          porcentajeComision,
          montoComision,
          parseFloat(item.descuento_porcentaje || 0),
          stockReservado ? 1 : 0
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

    if (ordenActual.id_cotizacion) {
        queriesNuevoDetalle.push({
            sql: 'DELETE FROM detalle_cotizacion WHERE id_cotizacion = ?',
            params: [ordenActual.id_cotizacion]
        });

        for (let i = 0; i < detalle.length; i++) {
          const item = detalle[i];
          const cantidad = parseFloat(item.cantidad);
          const precioBase = parseFloat(item.precio_base);
          const pctComision = parseFloat(item.porcentaje_comision || 0);
          const montoComision = precioBase * (pctComision / 100);
          const precioFinal = precioBase + montoComision;
          const descuento = parseFloat(item.descuento_porcentaje || 0);

          queriesNuevoDetalle.push({
            sql: `INSERT INTO detalle_cotizacion (
              id_cotizacion, id_producto, cantidad, precio_unitario, precio_base, 
              porcentaje_comision, monto_comision, descuento_porcentaje, orden
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params: [
              ordenActual.id_cotizacion,
              item.id_producto,
              cantidad,
              precioFinal,
              precioBase,
              pctComision,
              montoComision,
              descuento,
              i + 1
            ]
          });
        }

        queriesNuevoDetalle.push({
            sql: `UPDATE cotizaciones 
                  SET 
                    subtotal = ?, 
                    igv = ?, 
                    total = ?, 
                    total_comision = ?, 
                    porcentaje_comision_promedio = ?,
                    observaciones = ?,
                    moneda = ?,
                    tipo_cambio = ?
                  WHERE id_cotizacion = ?`,
            params: [
                subtotal, 
                impuesto, 
                total, 
                totalComision, 
                porcentajeComisionPromedio, 
                observaciones, 
                moneda, 
                parseFloat(tipo_cambio || 1.0000),
                ordenActual.id_cotizacion
            ]
        });
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

    if (['Cancelada', 'Despachada', 'Entregada'].includes(ordenVenta.estado)) {
        return res.status(400).json({
          success: false,
          error: `No se puede crear una orden de producción para una orden ${ordenVenta.estado}`
        });
    }
    
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

    const nombreProducto = productoResult.data[0].nombre;

    const supervisoresResult = await executeQuery(
      "SELECT id_empleado FROM empleados WHERE rol IN ('Supervisor', 'Jefe de Planta', 'Jefe de Producción') AND estado = 'Activo'"
    );

    if (supervisoresResult.success) {
      for (const sup of supervisoresResult.data) {
        await executeQuery(`
          INSERT INTO notificaciones (id_usuario_destino, titulo, mensaje, tipo, ruta_destino)
          VALUES (?, ?, ?, 'warning', ?)
        `, [
          sup.id_empleado,
          `Nueva OP: ${numeroOrdenProduccion}`,
          `Origen: Ventas ${ordenVenta.numero_orden}. Producto: ${nombreProducto}. Cant: ${cantidad}`,
          '/produccion/ordenes'
        ]);
      }
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
      
      if (productoStock.data.length === 0) {
        return res.status(404).json({ error: `Producto ID ${itemDespacho.id_producto} no encontrado en inventario` });
      }

      const infoProducto = productoStock.data[0];
      const estabaReservado = itemDb.stock_reservado === 1; 

      if (infoProducto.requiere_receta === 0 && !estabaReservado) {
        if (parseFloat(infoProducto.stock_actual) < cantidadADespachar) {
          return res.status(400).json({ error: `Stock insuficiente para el producto ID ${itemDespacho.id_producto}. (No estaba reservado)` });
        }
      }

      const costoUnitario = parseFloat(infoProducto.costo_unitario_promedio || 0);
      const precioUnitario = parseFloat(itemDb.precio_unitario || 0);
      
      totalCosto += cantidadADespachar * costoUnitario;
      totalPrecio += cantidadADespachar * precioUnitario;

      itemsProcesados.push({
        ...itemDespacho,
        costo_unitario: costoUnitario,
        precio_unitario: precioUnitario,
        requiere_receta: infoProducto.requiere_receta,
        estaba_reservado: estabaReservado
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

      if (item.requiere_receta === 0 && !item.estaba_reservado) {
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

    if (['Cancelada', 'Entregada'].includes(orden.estado)) {
      return res.status(400).json({ error: `No se puede anular una orden en estado ${orden.estado}` });
    }

    const queriesAnulacion = [];

    const detalleOrden = await executeQuery(
      `SELECT id_producto, cantidad, cantidad_reservada, stock_reservado 
       FROM detalle_orden_venta 
       WHERE id_orden_venta = ?`,
      [id]
    );

    for (const item of detalleOrden.data) {
      const reservado = parseFloat(item.cantidad_reservada || 0);

      if (reservado > 0) {
        queriesAnulacion.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
          params: [reservado, item.id_producto]
        });

        queriesAnulacion.push({
          sql: 'UPDATE detalle_orden_venta SET stock_reservado = 0, cantidad_reservada = 0 WHERE id_orden_venta = ? AND id_producto = ?',
          params: [id, item.id_producto]
        });
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
           const itemEnOrden = detalleOrden.data.find(d => d.id_producto === item.id_producto);
           const teniaReserva = itemEnOrden && parseFloat(itemEnOrden.cantidad_reservada) > 0;

           if (requiereReceta === 0 && !teniaReserva) {
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
      sql: 'UPDATE ordenes_venta SET estado = ?, stock_reservado = 0, observaciones = CONCAT(COALESCE(observaciones, ""), " - ANULADA: ", ?) WHERE id_orden_venta = ?',
      params: ['Cancelada', motivoFinal, id]
    });

    if (orden.id_cotizacion) {
      queriesAnulacion.push({
        sql: "UPDATE cotizaciones SET estado = 'Rechazada', convertida_venta = 0, id_orden_venta = NULL WHERE id_cotizacion = ?",
        params: [orden.id_cotizacion]
      });
    }

    queriesAnulacion.push({
        sql: `UPDATE ordenes_produccion 
              SET estado = 'Cancelada', 
                  observaciones = CONCAT(COALESCE(observaciones, ''), ' - Cancelada autom. por anulación de OV') 
              WHERE id_orden_venta_origen = ? 
              AND estado NOT IN ('Cancelada', 'Terminada')`,
        params: [id]
    });

    await executeTransaction(queriesAnulacion);

    res.json({
      success: true,
      message: 'Orden de venta anulada correctamente y stock retornado',
      data: {
        salidas_anuladas: salidasResult.data.length,
        motivo: motivoFinal,
        produccion_anulada: true
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
      SELECT id_orden_venta, estado FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenCheck.success || ordenCheck.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }

    if (ordenCheck.data[0].estado === 'Cancelada') {
        return res.status(400).json({ success: false, error: 'No se puede modificar una orden Cancelada' });
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
    const { tipo } = req.query; // 'orden' o 'comprobante'

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const ordenResult = await executeQuery(`
      SELECT 
        ov.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente_base,
        cl.telefono AS telefono_cliente,
        e.nombre_completo AS comercial,
        e.email AS email_comercial,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      WHERE ov.id_orden_venta = ?
    `, [id]);

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden de venta no encontrada' });
    }

    const orden = ordenResult.data[0];

    const detalleResult = await executeQuery(`
      SELECT 
        dov.id_detalle,
        dov.id_producto,
        dov.cantidad,
        dov.precio_unitario,
        dov.descuento_porcentaje,
        p.codigo AS codigo_producto, 
        p.nombre AS producto, 
        p.unidad_medida
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      WHERE dov.id_orden_venta = ?
      ORDER BY dov.orden ASC
    `, [id]);

    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Error al obtener detalle de la orden' 
      });
    }

    orden.detalle = detalleResult.data || [];

    const direccionFinal = orden.direccion_entrega && orden.direccion_entrega.trim() !== '' 
      ? orden.direccion_entrega 
      : orden.direccion_cliente_base;

    orden.direccion_entrega = direccionFinal;

    let pdfBuffer;
    let nombreArchivo;

    // 2. LÓGICA PARA SELECCIONAR EL GENERADOR CORRECTO
    // Si el frontend solicita específicamente el "comprobante" Y es una Nota de Venta
    if (tipo === 'comprobante' && orden.tipo_comprobante === 'Nota de Venta') {
        pdfBuffer = await generarNotaVentaPDF(orden);
        const correlativo = orden.numero_comprobante || orden.numero_orden;
        nombreArchivo = `NotaVenta-${correlativo}.pdf`;
    } 
    // Si tienes un generador de Factura, agrégalo aquí con un else if
    // else if (tipo === 'comprobante' && orden.tipo_comprobante === 'Factura') { ... }
    else {
        // Por defecto o si piden tipo 'orden', genera la Orden Interna
        pdfBuffer = await generarOrdenVentaPDF(orden);
        nombreArchivo = `Orden-${orden.numero_orden}.pdf`;
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function descargarPDFDespacho(req, res) {
  try {
    const { id, idSalida } = req.params;

    const ordenResult = await executeQuery(`
      SELECT 
        ov.numero_orden,
        ov.orden_compra_cliente,
        ov.direccion_entrega,
        ov.estado,
        ov.moneda,
        ov.id_cliente,
        ov.tipo_entrega,
        ov.transporte_nombre,
        ov.transporte_placa,
        ov.transporte_conductor,
        ov.transporte_dni,
        ov.transporte_licencia,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        c.numero_cotizacion,
        f.placa AS vehiculo_placa,
        f.marca_modelo AS vehiculo_modelo,
        e_cond.nombre_completo AS conductor_nombre,
        e_cond.dni AS conductor_dni
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      LEFT JOIN flota f ON ov.id_vehiculo = f.id_vehiculo 
      LEFT JOIN empleados e_cond ON ov.id_conductor = e_cond.id_empleado
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
        error: 'Salida no encontrada para esta orden'
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
      ORDER BY p.codigo
    `, [idSalida]);

    if (!detalleResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener detalle de la salida'
      });
    }

    const datosPDF = {
      id_salida: salida.id_salida,
      fecha_movimiento: salida.fecha_movimiento,
      tipo_movimiento: salida.tipo_movimiento,
      estado: salida.estado,
      observaciones: salida.observaciones,
      tipo_inventario: 'Venta',
      numero_orden: orden.numero_orden,
      oc_cliente: orden.orden_compra_cliente,
      numero_cotizacion: orden.numero_cotizacion,
      moneda: orden.moneda,
      cliente: orden.cliente,
      ruc_cliente: orden.ruc_cliente,
      direccion_despacho: orden.direccion_entrega,
      tipo_entrega: orden.tipo_entrega,
      conductor: orden.conductor_nombre,
      conductor_dni: orden.conductor_dni,
      vehiculo_placa: orden.vehiculo_placa,
      vehiculo_modelo: orden.vehiculo_modelo,
      transporte_privado_nombre: orden.transporte_nombre,
      transporte_privado_placa: orden.transporte_placa,
      transporte_privado_conductor: orden.transporte_conductor,
      transporte_privado_dni: orden.transporte_dni,
      transporte_licencia: orden.transporte_licencia,
      detalles: detalleResult.data
    };

    const pdfBuffer = await generarPDFSalida(datosPDF);
    const filename = `GuiaRemision-${orden.numero_orden}-Despacho-${salida.id_salida}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error en descargarPDFDespacho:', error);
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
      observaciones,
      id_cuenta_destino 
    } = req.body;
    
    const id_registrado_por = req.user?.id_empleado || null;
    
    if (!id_registrado_por) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
    
    const ordenCheck = await executeQuery('SELECT estado FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenCheck.data.length > 0 && ordenCheck.data[0].estado === 'Cancelada') {
        return res.status(400).json({ success: false, error: 'No se puede registrar pagos en una orden Cancelada' });
    }

    if (!fecha_pago || !monto_pagado || monto_pagado <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Fecha de pago y monto son obligatorios'
      });
    }

    if (id_cuenta_destino) {
      const cuentaResult = await executeQuery(
        'SELECT * FROM cuentas_pago WHERE id_cuenta = ? AND estado = "Activo"',
        [id_cuenta_destino]
      );
      
      if (!cuentaResult.success || cuentaResult.data.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Cuenta no encontrada o inactiva'
        });
      }
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
    
    const queries = [
      {
        sql: `INSERT INTO pagos_ordenes_venta (
          id_orden_venta,
          numero_pago,
          fecha_pago,
          monto_pagado,
          metodo_pago,
          numero_operacion,
          banco,
          observaciones,
          id_registrado_por
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id,
          numeroPago,
          fecha_pago,
          montoNuevoPago,
          metodo_pago || 'Transferencia',
          numero_operacion || null,
          banco || null,
          observaciones || null,
          id_registrado_por
        ]
      }
    ];

    const nuevoMontoPagado = montoPagadoActual + montoNuevoPago;
    let estadoPago = 'Parcial';
    
    if (nuevoMontoPagado >= totalOrden - 0.1) {
      estadoPago = 'Pagado';
    } else if (nuevoMontoPagado === 0) {
      estadoPago = 'Pendiente';
    }

    queries.push({
      sql: `UPDATE ordenes_venta 
            SET monto_pagado = ?,
                estado_pago = ?
            WHERE id_orden_venta = ?`,
      params: [nuevoMontoPagado, estadoPago, id]
    });

    if (id_cuenta_destino) {
      const cuentaResult = await executeQuery(
        'SELECT saldo_actual, moneda FROM cuentas_pago WHERE id_cuenta = ?',
        [id_cuenta_destino]
      );
      
      const cuenta = cuentaResult.data[0];
      const saldoAnterior = parseFloat(cuenta.saldo_actual);
      const saldoNuevo = saldoAnterior + montoNuevoPago;

      queries.push({
        sql: `INSERT INTO movimientos_cuentas (
          id_cuenta,
          tipo_movimiento,
          monto,
          concepto,
          referencia,
          saldo_anterior,
          saldo_nuevo,
          id_registrado_por,
          fecha_movimiento
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id_cuenta_destino,
          'Ingreso',
          montoNuevoPago,
          `Cobranza Orden ${orden.numero_orden}`,
          numeroPago,
          saldoAnterior,
          saldoNuevo,
          id_registrado_por,
          fecha_pago
        ]
      });

      queries.push({
        sql: 'UPDATE cuentas_pago SET saldo_actual = ? WHERE id_cuenta = ?',
        params: [saldoNuevo, id_cuenta_destino]
      });
    }

    const result = await executeTransaction(queries);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    const idPagoOrden = result.data[0].insertId;
    
    res.status(201).json({
      success: true,
      data: {
        id_pago_orden: idPagoOrden,
        numero_pago: numeroPago,
        monto_pagado: montoNuevoPago,
        nuevo_monto_total_pagado: nuevoMontoPagado,
        saldo_pendiente: totalOrden - nuevoMontoPagado,
        estado_pago: estadoPago,
        cuenta_actualizada: !!id_cuenta_destino
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

    const ordenCheck = await executeQuery('SELECT estado FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenCheck.data.length > 0 && ordenCheck.data[0].estado === 'Cancelada') {
        return res.status(400).json({ success: false, error: 'No se puede modificar pagos en una orden Cancelada' });
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

    if (orden.estado === 'Cancelada') {
      return res.status(400).json({
        success: false,
        error: 'No se puede editar el comprobante de una orden cancelada'
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

export async function actualizarDatosTransporte(req, res) {
  try {
    const { id } = req.params;
    const {
      tipo_entrega,
      id_vehiculo,
      id_conductor,
      transporte_nombre,
      transporte_placa,
      transporte_conductor,
      transporte_dni,
      fecha_entrega_estimada 
    } = req.body;

    const ordenCheck = await executeQuery('SELECT estado FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenCheck.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }
    
    if (ordenCheck.data[0].estado === 'Cancelada') {
      return res.status(400).json({ 
        success: false, 
        error: 'No se pueden modificar datos de transporte en una orden Cancelada' 
      });
    }

    // ✅ Preparar valores según tipo de entrega
    let idVehiculoFinal = null;
    let idConductorFinal = null;
    let transNombreFinal = null;
    let transPlacaFinal = null;
    let transCondFinal = null;
    let transDniFinal = null;

    if (tipo_entrega === 'Vehiculo Empresa') {
      idVehiculoFinal = id_vehiculo || null;
      idConductorFinal = id_conductor || null;
      
      // Validar que el vehículo exista si se proporcionó
      if (idVehiculoFinal) {
        const vCheck = await executeQuery('SELECT id_vehiculo FROM flota WHERE id_vehiculo = ?', [idVehiculoFinal]);
        if (!vCheck.success || vCheck.data.length === 0) {
          return res.status(400).json({ success: false, error: 'Vehículo no válido' });
        }
      }
      
      // Validar que el conductor exista si se proporcionó
      if (idConductorFinal) {
        const cCheck = await executeQuery('SELECT id_empleado FROM empleados WHERE id_empleado = ?', [idConductorFinal]);
        if (!cCheck.success || cCheck.data.length === 0) {
          return res.status(400).json({ success: false, error: 'Conductor no válido' });
        }
      }
      
    } else if (tipo_entrega === 'Transporte Privado') {
      transNombreFinal = transporte_nombre || null;
      transPlacaFinal = transporte_placa || null;
      transCondFinal = transporte_conductor || null;
      transDniFinal = transporte_dni || null;
    }
    // Si es 'Recojo Tienda', todos quedan null

    const result = await executeQuery(`
      UPDATE ordenes_venta 
      SET 
        tipo_entrega = ?,
        id_vehiculo = ?,
        id_conductor = ?,
        transporte_nombre = ?,
        transporte_placa = ?,
        transporte_conductor = ?,
        transporte_dni = ?,
        fecha_entrega_estimada = COALESCE(?, fecha_entrega_estimada)
      WHERE id_orden_venta = ?
    `, [
      tipo_entrega,
      idVehiculoFinal,
      idConductorFinal,
      transNombreFinal,
      transPlacaFinal,
      transCondFinal,
      transDniFinal,
      fecha_entrega_estimada || null,
      id
    ]);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ 
      success: true, 
      message: 'Datos de transporte actualizados correctamente',
      data: {
        tipo_entrega,
        id_vehiculo: idVehiculoFinal,
        id_conductor: idConductorFinal,
        transporte_nombre: transNombreFinal,
        transporte_placa: transPlacaFinal
      }
    });

  } catch (error) {
    console.error('Error en actualizarDatosTransporte:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function agregarDireccionClienteDesdeOrden(req, res) {
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
    console.error('Error al agregar dirección desde orden:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

export async function rectificarCantidadProducto(req, res) {
  try {
    const { id } = req.params;
    const { id_producto, nueva_cantidad, motivo } = req.body;
    const id_registrado_por = req.user?.id_empleado || null;

    if (!id_registrado_por) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    if (!id_producto || nueva_cantidad === undefined || nueva_cantidad < 0) {
      return res.status(400).json({ success: false, error: 'Producto y cantidad válida requeridos' });
    }

    const ordenResult = await executeQuery('SELECT * FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }
    const orden = ordenResult.data[0];

    if (orden.estado === 'Cancelada') {
        return res.status(400).json({ success: false, error: 'No se puede rectificar una orden Cancelada' });
    }

    const detalleResult = await executeQuery(
      'SELECT * FROM detalle_orden_venta WHERE id_orden_venta = ? AND id_producto = ?', 
      [id, id_producto]
    );

    if (detalleResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado en esta orden' });
    }

    const itemDetalle = detalleResult.data[0];
    const cantidadAnterior = parseFloat(itemDetalle.cantidad);
    const cantidadNueva = parseFloat(nueva_cantidad);
    const diferencia = cantidadNueva - cantidadAnterior;

    if (diferencia === 0) {
      return res.json({ success: true, message: 'No hay cambios en la cantidad' });
    }

    const queries = [];

    if (diferencia > 0) {
      const productoCheck = await executeQuery('SELECT stock_actual, requiere_receta FROM productos WHERE id_producto = ?', [id_producto]);
      if (productoCheck.data.length > 0) {
        const prod = productoCheck.data[0];
        if (prod.requiere_receta === 0) {
          if (parseFloat(prod.stock_actual) < diferencia) {
            return res.status(400).json({ success: false, error: 'Stock insuficiente para el incremento en la rectificación' });
          }
          queries.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
            params: [diferencia, id_producto]
          });
        }
      }
    } else {
      const productoCheck = await executeQuery('SELECT requiere_receta FROM productos WHERE id_producto = ?', [id_producto]);
      if (productoCheck.data.length > 0 && productoCheck.data[0].requiere_receta === 0) {
        queries.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
          params: [Math.abs(diferencia), id_producto]
        });
      }
    }

    let sqlUpdateDetalle = 'UPDATE detalle_orden_venta SET cantidad = ? WHERE id_detalle = ?';
    let paramsUpdateDetalle = [cantidadNueva, itemDetalle.id_detalle];

    if (['Despachada', 'Entregada'].includes(orden.estado)) {
        sqlUpdateDetalle = 'UPDATE detalle_orden_venta SET cantidad = ?, cantidad_despachada = ? WHERE id_detalle = ?';
        paramsUpdateDetalle = [cantidadNueva, cantidadNueva, itemDetalle.id_detalle];
    } else if (orden.estado === 'Despacho Parcial') {
        sqlUpdateDetalle = 'UPDATE detalle_orden_venta SET cantidad = ?, cantidad_despachada = IF(cantidad_despachada > 0, ?, cantidad_despachada) WHERE id_detalle = ?';
        paramsUpdateDetalle = [cantidadNueva, cantidadNueva, itemDetalle.id_detalle];
    }

    queries.push({
      sql: sqlUpdateDetalle,
      params: paramsUpdateDetalle
    });

    const ordenCompletaDetalle = await executeQuery('SELECT * FROM detalle_orden_venta WHERE id_orden_venta = ?', [id]);
    let nuevoSubtotalOrden = 0;
    
    ordenCompletaDetalle.data.forEach(d => {
      const cant = (d.id_producto == id_producto) ? cantidadNueva : parseFloat(d.cantidad);
      nuevoSubtotalOrden += (cant * parseFloat(d.precio_unitario)) * (1 - parseFloat(d.descuento_porcentaje || 0) / 100);
    });

    const porcentajeImpuesto = parseFloat(orden.porcentaje_impuesto || 18);
    const nuevoImpuesto = nuevoSubtotalOrden * (porcentajeImpuesto / 100);
    const nuevoTotal = nuevoSubtotalOrden + nuevoImpuesto;

    queries.push({
      sql: 'UPDATE ordenes_venta SET subtotal = ?, igv = ?, total = ?, observaciones = CONCAT(COALESCE(observaciones, ""), " [Rect: ", ? ) WHERE id_orden_venta = ?',
      params: [nuevoSubtotalOrden, nuevoImpuesto, nuevoTotal, `Prod ${id_producto}: ${cantidadAnterior}->${cantidadNueva}. ${motivo || ''}`, id]
    });

    if (['Despachada', 'Entregada', 'Despacho Parcial'].includes(orden.estado)) {
      const salidaResult = await executeQuery(
        'SELECT id_salida FROM salidas WHERE observaciones LIKE ? AND estado = "Activo" ORDER BY id_salida DESC LIMIT 1', 
        [`%${orden.numero_orden}%`]
      );

      if (salidaResult.data.length > 0) {
        const idSalida = salidaResult.data[0].id_salida;
        const detalleSalidaCheck = await executeQuery('SELECT * FROM detalle_salidas WHERE id_salida = ? AND id_producto = ?', [idSalida, id_producto]);
        
        if (detalleSalidaCheck.data.length > 0) {
          if (cantidadNueva <= 0) {
             queries.push({ sql: 'DELETE FROM detalle_salidas WHERE id_salida = ? AND id_producto = ?', params: [idSalida, id_producto] });
          } else {
             queries.push({ sql: 'UPDATE detalle_salidas SET cantidad = ? WHERE id_salida = ? AND id_producto = ?', params: [cantidadNueva, idSalida, id_producto] });
          }
        } else if (cantidadNueva > 0) {
           const infoProd = await executeQuery('SELECT costo_unitario_promedio FROM productos WHERE id_producto = ?', [id_producto]);
           const costo = infoProd.data[0]?.costo_unitario_promedio || 0;
           const precioUnitario = parseFloat(itemDetalle.precio_unitario);
           queries.push({ sql: 'INSERT INTO detalle_salidas (id_salida, id_producto, cantidad, costo_unitario, precio_unitario) VALUES (?, ?, ?, ?, ?)', params: [idSalida, id_producto, cantidadNueva, costo, precioUnitario] });
        }
        
        queries.push({
            sql: `UPDATE salidas s SET 
                    total_costo = (SELECT COALESCE(SUM(cantidad * costo_unitario), 0) FROM detalle_salidas WHERE id_salida = s.id_salida),
                    total_precio = (SELECT COALESCE(SUM(cantidad * precio_unitario), 0) FROM detalle_salidas WHERE id_salida = s.id_salida)
                  WHERE s.id_salida = ?`,
            params: [idSalida]
        });
      }
    }

    if (orden.id_cotizacion) {
        queries.push({
            sql: 'UPDATE detalle_cotizacion SET cantidad = ? WHERE id_cotizacion = ? AND id_producto = ?',
            params: [cantidadNueva, orden.id_cotizacion, id_producto]
        });

        queries.push({
            sql: `UPDATE cotizaciones c
                  SET 
                    subtotal = (SELECT SUM(cantidad * precio_unitario * (1 - COALESCE(descuento_porcentaje,0)/100)) FROM detalle_cotizacion WHERE id_cotizacion = c.id_cotizacion),
                    igv = (SELECT SUM(cantidad * precio_unitario * (1 - COALESCE(descuento_porcentaje,0)/100)) FROM detalle_cotizacion WHERE id_cotizacion = c.id_cotizacion) * (COALESCE(porcentaje_impuesto,18)/100),
                    total = (SELECT SUM(cantidad * precio_unitario * (1 - COALESCE(descuento_porcentaje,0)/100)) FROM detalle_cotizacion WHERE id_cotizacion = c.id_cotizacion) * (1 + COALESCE(porcentaje_impuesto,18)/100)
                  WHERE c.id_cotizacion = ?`,
            params: [orden.id_cotizacion]
        });
    }

    await executeTransaction(queries);

    res.json({
      success: true,
      message: 'Cantidad rectificada en Orden y Cotización correctamente',
      data: {
        cantidad_anterior: cantidadAnterior,
        cantidad_nueva: cantidadNueva,
        diferencia: diferencia
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}
export async function generarGuiaInterna(req, res) {
    try {
        const { id } = req.params; // ID de la Orden de Venta
        const id_usuario = req.user?.id_empleado || null;

        // 1. Validar Orden
        const ordenResult = await executeQuery('SELECT * FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
        if (!ordenResult.success || ordenResult.data.length === 0) {
            return res.status(404).json({ success: false, error: 'Orden no encontrada' });
        }
        const orden = ordenResult.data[0];

        if (orden.tipo_comprobante !== 'Nota de Venta') {
            return res.status(400).json({ success: false, error: 'La Guía Interna solo está disponible para Notas de Venta' });
        }
        if (['Despachada', 'Entregada', 'Cancelada'].includes(orden.estado)) {
            return res.status(400).json({ success: false, error: `La orden ya está en estado ${orden.estado}` });
        }

        // 2. Obtener Detalle y Productos
        const detalleResult = await executeQuery('SELECT * FROM detalle_orden_venta WHERE id_orden_venta = ?', [id]);
        const detalleOrden = detalleResult.data;

        // 3. Generar Correlativo GI (GI-2026-0001)
        const year = new Date().getFullYear();
        const ultimaGuia = await executeQuery(`
            SELECT observaciones 
            FROM salidas 
            WHERE observaciones LIKE ? 
            ORDER BY id_salida DESC LIMIT 1
        `, [`GI-${year}-%`]);

        let secuencia = 1;
        if (ultimaGuia.success && ultimaGuia.data.length > 0) {
            const obs = ultimaGuia.data[0].observaciones;
            const match = obs.match(/GI-\d{4}-(\d+)/);
            if (match) secuencia = parseInt(match[1]) + 1;
        }
        const numeroGuia = `GI-${year}-${String(secuencia).padStart(4, '0')}`;

        // 4. Preparar Datos para Salida
        let totalCosto = 0;
        const itemsParaSalida = [];
        
        for (const item of detalleOrden) {
             const prodData = await executeQuery('SELECT costo_unitario_promedio, requiere_receta FROM productos WHERE id_producto = ?', [item.id_producto]);
             const prod = prodData.data[0];
             const costo = parseFloat(prod?.costo_unitario_promedio || 0);
             const cantidad = parseFloat(item.cantidad);
             
             totalCosto += (costo * cantidad);
             
             itemsParaSalida.push({
                 id_producto: item.id_producto,
                 cantidad: cantidad,
                 costo_unitario: costo,
                 precio_unitario: item.precio_unitario,
                 requiere_receta: prod?.requiere_receta || 0,
                 stock_reservado_en_ov: orden.stock_reservado // Si la orden ya reservó stock, no lo descontamos doble
             });
        }

        // 5. Transacción de Creación de Guía
        const queries = [];

        // Insertar Cabecera Salida
        queries.push({
            sql: `INSERT INTO salidas (
                id_tipo_inventario, tipo_movimiento, id_cliente, total_costo, total_precio,
                moneda, id_registrado_por, observaciones, estado, fecha_movimiento
            ) VALUES (3, 'Venta', ?, ?, ?, ?, ?, ?, 'Activo', ?)`,
            params: [
                orden.id_cliente, totalCosto, orden.total, orden.moneda,
                id_usuario, `${numeroGuia} - Guía Interna Automática OV ${orden.numero_orden}`, getFechaPeru()
            ]
        });

        // Ejecutamos primero la cabecera para tener el ID
        const resultSalida = await executeTransaction(queries);
        if (!resultSalida.success) throw new Error(resultSalida.error);
        
        const idSalida = resultSalida.data[0].insertId;
        const queriesDetalles = [];

        // Insertar Detalles y Actualizar Stock/Estado
        for (const item of itemsParaSalida) {
            // Detalle Salida
            queriesDetalles.push({
                sql: `INSERT INTO detalle_salidas (id_salida, id_producto, cantidad, costo_unitario, precio_unitario) VALUES (?, ?, ?, ?, ?)`,
                params: [idSalida, item.id_producto, item.cantidad, item.costo_unitario, item.precio_unitario]
            });

            // Descontar Stock si NO es receta y NO estaba ya reservado
            // OJO: Al ser guía interna, asumimos que sale de almacén. 
            // Si estaba reservado, el stock físico ya se descontó en createOrdenVenta, así que no hacemos nada.
            // Si NO estaba reservado, descontamos ahora.
            if (item.requiere_receta === 0 && (!orden.stock_reservado || orden.stock_reservado == 0)) {
                 queriesDetalles.push({
                     sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
                     params: [item.cantidad, item.id_producto]
                 });
            }

            // Marcar cantidad despachada en la OV
            queriesDetalles.push({
                sql: 'UPDATE detalle_orden_venta SET cantidad_despachada = ? WHERE id_orden_venta = ? AND id_producto = ?',
                params: [item.cantidad, id, item.id_producto]
            });
        }

        // Actualizar estado de la OV a Despachada
        queriesDetalles.push({
            sql: 'UPDATE ordenes_venta SET estado = ?, fecha_entrega_real = ? WHERE id_orden_venta = ?',
            params: ['Despachada', getFechaISOPeru(), id]
        });

        await executeTransaction(queriesDetalles);

        res.json({
            success: true,
            message: `Guía Interna ${numeroGuia} generada correctamente.`,
            data: {
                id_salida: idSalida,
                numero_guia: numeroGuia
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
}
export async function descargarPDFGuiaInterna(req, res) {
  try {
    const { id } = req.params;

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const ordenResult = await executeQuery(`
      SELECT 
        ov.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente_base,
        cl.telefono AS telefono_cliente,
        e.nombre_completo AS comercial,
        e.email AS email_comercial,
        e_conductor.nombre_completo AS conductor_nombre,
        e_conductor.dni AS conductor_dni,
        f.placa AS vehiculo_placa,
        f.marca_modelo AS vehiculo_modelo,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
      LEFT JOIN empleados e_conductor ON ov.id_conductor = e_conductor.id_empleado
      LEFT JOIN flota f ON ov.id_vehiculo = f.id_vehiculo
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      WHERE ov.id_orden_venta = ?
    `, [id]);

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden de venta no encontrada' });
    }

    const orden = ordenResult.data[0];

    if (orden.tipo_comprobante !== 'Nota de Venta') {
      return res.status(400).json({ 
        success: false, 
        error: 'La Guía Interna solo está disponible para Notas de Venta' 
      });
    }

    const detalleResult = await executeQuery(`
      SELECT 
        dov.id_detalle,
        dov.id_producto,
        dov.cantidad,
        dov.precio_unitario,
        dov.descuento_porcentaje,
        p.codigo AS codigo_producto, 
        p.nombre AS producto, 
        p.unidad_medida
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      WHERE dov.id_orden_venta = ?
      ORDER BY dov.orden ASC
    `, [id]);

    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Error al obtener detalle de la orden' 
      });
    }

    orden.detalle = detalleResult.data || [];

    const direccionFinal = orden.direccion_entrega && orden.direccion_entrega.trim() !== '' 
      ? orden.direccion_entrega 
      : orden.direccion_cliente_base;

    orden.direccion_entrega = direccionFinal;

    const ultimaGuia = await executeQuery(`
      SELECT numero_guia_interna 
      FROM ordenes_venta 
      WHERE numero_guia_interna IS NOT NULL
      ORDER BY id_orden_venta DESC 
      LIMIT 1
    `);

    let numeroSecuencia = 1;
    const year = new Date().getFullYear();
    
    if (ultimaGuia.success && ultimaGuia.data.length > 0) {
      const match = ultimaGuia.data[0].numero_guia_interna.match(/GI-\d{4}-(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }

    const numeroGuiaInterna = `GI-${year}-${String(numeroSecuencia).padStart(4, '0')}`;

    await executeQuery(
      'UPDATE ordenes_venta SET numero_guia_interna = ? WHERE id_orden_venta = ?',
      [numeroGuiaInterna, id]
    );

    const { generarPDFGuiaInterna } = await import('../utils/pdfGenerators/guiaInternaPDF.js');
    const pdfBuffer = await generarPDFGuiaInterna(orden, numeroGuiaInterna);
    
    const nombreArchivo = `Guia-Interna-${numeroGuiaInterna}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}