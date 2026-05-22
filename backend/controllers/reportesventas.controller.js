import db from '../config/database.js';

export const getReporteVentas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, idCliente, idVendedor, filtro_fecha, estadoOrden, estadoPago, moneda } = req.query;

        let campoFecha = 'ov.fecha_emision';
        if (filtro_fecha === 'fecha_sunat') campoFecha = 'ov.fecha_facturacion_sunat';
        if (filtro_fecha === 'fecha_despacho') campoFecha = 's.fecha_movimiento';

        let sql = `
            SELECT 
                ov.*,
                c.razon_social,
                c.ruc,
                c.direccion_despacho as direccion_cliente,
                c.email as email_cliente,
                c.telefono as telefono_cliente,
                c.contacto,
                e.nombre_completo as nombre_vendedor,
                ev.nombre_completo as nombre_verificador,
                er.nombre_completo as nombre_registrador,
                v.placa as vehiculo_placa,
                v.marca_modelo as vehiculo_marca,
                ec.nombre_completo as nombre_conductor,
                ec.dni as dni_conductor,
                cot.numero_cotizacion,
                s.fecha_movimiento as fecha_despacho
            FROM ordenes_venta ov
            INNER JOIN clientes c ON ov.id_cliente = c.id_cliente
            LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
            LEFT JOIN empleados ev ON ov.id_verificador = ev.id_empleado
            LEFT JOIN empleados er ON ov.id_registrado_por = er.id_empleado
            LEFT JOIN flota v ON ov.id_vehiculo = v.id_vehiculo
            LEFT JOIN empleados ec ON ov.id_conductor = ec.id_empleado
            LEFT JOIN cotizaciones cot ON ov.id_cotizacion = cot.id_cotizacion
            LEFT JOIN salidas s ON ov.id_salida = s.id_salida
            WHERE DATE(${campoFecha}) BETWEEN ? AND ?
            AND ov.estado != 'Cancelada'
            AND ov.estado_verificacion = 'Aprobada'
        `;

        const params = [fechaInicio, fechaFin];

        if (idCliente && idCliente !== 'null' && idCliente !== '') {
            sql += ` AND ov.id_cliente = ?`;
            params.push(idCliente);
        }

        if (idVendedor && idVendedor !== 'null' && idVendedor !== '') {
            sql += ` AND ov.id_comercial = ?`;
            params.push(idVendedor);
        }

        if (estadoOrden) {
            const estados = estadoOrden.split(',');
            sql += ` AND ov.estado IN (${estados.map(() => '?').join(',')})`;
            params.push(...estados);
        }

        if (estadoPago) {
            const estadosPago = estadoPago.split(',');
            sql += ` AND ov.estado_pago IN (${estadosPago.map(() => '?').join(',')})`;
            params.push(...estadosPago);
        }

        if (moneda) {
            const monedas = moneda.split(',').map(m => m.trim().toUpperCase());
            sql += ` AND TRIM(UPPER(ov.moneda)) IN (${monedas.map(() => '?').join(',')})`;
            params.push(...monedas);
        }

        sql += ` ORDER BY ${campoFecha} DESC`;

        const [ordenes] = await db.query(sql, params);

        const ordenesIds = ordenes.map(o => o.id_orden_venta);
        let detallesMap = {};

        if (ordenesIds.length > 0) {
            const [detalles] = await db.query(`
                SELECT 
                    dov.*,
                    p.nombre as producto_nombre,
                    p.codigo as codigo_producto,
                    p.unidad_medida,
                    p.descripcion as producto_descripcion
                FROM detalle_orden_venta dov
                LEFT JOIN productos p ON dov.id_producto = p.id_producto
                WHERE dov.id_orden_venta IN (?)
                ORDER BY dov.id_detalle
            `, [ordenesIds]);

            detalles.forEach(det => {
                if (!detallesMap[det.id_orden_venta]) {
                    detallesMap[det.id_orden_venta] = [];
                }
                detallesMap[det.id_orden_venta].push(det);
            });
        }

        let kpis = {
            totalVentasPEN: 0, totalVentasUSD: 0,
            totalPagadoPEN: 0, totalPagadoUSD: 0,
            totalPorCobrarPEN: 0, totalPorCobrarUSD: 0,
            totalContadoPEN: 0, totalContadoUSD: 0,
            totalCreditoPEN: 0, totalCreditoUSD: 0,
            pedidosAtrasados: 0,
            totalComisionesPEN: 0, totalComisionesUSD: 0,
            
            // Desglose por tipo y moneda
            facturaPEN: 0, facturaUSD: 0,
            notaVentaPEN: 0, notaVentaUSD: 0,
            sinComprobantePEN: 0, sinComprobanteUSD: 0,

            unificadoVentasPEN: 0,
            unificadoPagadoPEN: 0,
            unificadoPorCobrarPEN: 0,
            cantidadOrdenes: ordenes.length
        };

        const conteoEstadoPagoPEN = { 'Pagado': 0, 'Parcial': 0, 'Pendiente': 0 };
        const conteoEstadoPagoUSD = { 'Pagado': 0, 'Parcial': 0, 'Pendiente': 0 };
        const ventasPorDia = {};
        const ventasPorVendedor = {};
        const ventasPorEstado = {};

        const listaDetalle = ordenes.map(orden => {
            const esDolar = orden.moneda === 'USD';
            const tcOrden = parseFloat(orden.tipo_cambio) || 1;
            const subtotalOriginal = parseFloat(orden.subtotal) || 0;
            const pagadoOriginal = parseFloat(orden.monto_pagado) || 0;
            const comisionOriginal = parseFloat(orden.total_comision) || 0;

            const tipoImpuesto = String(orden.tipo_impuesto || '').toUpperCase().trim();
            const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(tipoImpuesto);
            
            // Lógica Sincronizada con OrdenesVenta.jsx: Usar subtotal si no hay impuesto
            const montoOriginal = esSinImpuesto ? subtotalOriginal : (parseFloat(orden.total) || 0);

            const tipoComprobante = String(orden.tipo_comprobante || '').trim();
            const esFacturaRaw = tipoComprobante.includes('Factura');
            const esNotaVenta = tipoComprobante.includes('Nota de Venta');
            const facturasExportacion = ['OV-2026-0380', 'OV-2026-0277', 'OV-2026-0162', 'OV-2026-0093'];

            // Clasificación Sincronizada:
            let categoria = 'sin_comprobante';
            if (esFacturaRaw) {
                // Si es factura pero no tiene impuesto (y no es exportación aprobada), se cuenta como nota de venta
                if (!esSinImpuesto || facturasExportacion.includes(orden.numero_orden)) {
                    categoria = 'factura';
                } else {
                    categoria = 'nota_venta';
                }
            } else if (esNotaVenta) {
                categoria = 'nota_venta';
            }

            const pendienteOriginal = Math.max(0, montoOriginal - pagadoOriginal);

            const subtotalPEN = esDolar ? subtotalOriginal * tcOrden : subtotalOriginal;
            const totalPEN = esDolar ? montoOriginal * tcOrden : montoOriginal;
            const igvPEN = totalPEN - subtotalPEN;
            const pagadoPEN = esDolar ? pagadoOriginal * tcOrden : pagadoOriginal;
            const pendientePEN = esDolar ? pendienteOriginal * tcOrden : pendienteOriginal;

            // Bloque de Acumulación Restaurado
            if (esDolar) {
                kpis.totalVentasUSD += montoOriginal;
                kpis.totalPagadoUSD += pagadoOriginal;
                kpis.totalPorCobrarUSD += pendienteOriginal;
                kpis.totalComisionesUSD += comisionOriginal;

                if (categoria === 'factura') kpis.facturaUSD += montoOriginal;
                else if (categoria === 'nota_venta') kpis.notaVentaUSD += montoOriginal;
                else kpis.sinComprobanteUSD += montoOriginal;

                if (orden.tipo_venta === 'Crédito') kpis.totalCreditoUSD += montoOriginal;
                else kpis.totalContadoUSD += montoOriginal;

                if (conteoEstadoPagoUSD[orden.estado_pago] !== undefined) {
                    conteoEstadoPagoUSD[orden.estado_pago] += montoOriginal;
                }
            } else {
                kpis.totalVentasPEN += montoOriginal;
                kpis.totalPagadoPEN += pagadoOriginal;
                kpis.totalPorCobrarPEN += pendienteOriginal;
                kpis.totalComisionesPEN += comisionOriginal;

                if (categoria === 'factura') kpis.facturaPEN += montoOriginal;
                else if (categoria === 'nota_venta') kpis.notaVentaPEN += montoOriginal;
                else kpis.sinComprobantePEN += montoOriginal;

                if (orden.tipo_venta === 'Crédito') kpis.totalCreditoPEN += montoOriginal;
                else kpis.totalContadoPEN += montoOriginal;

                if (conteoEstadoPagoPEN[orden.estado_pago] !== undefined) {
                    conteoEstadoPagoPEN[orden.estado_pago] += montoOriginal;
                }
            }

            // Acumular unificados (todo a PEN usando TC de la orden)
            kpis.unificadoVentasPEN += totalPEN;
            kpis.unificadoPagadoPEN += pagadoPEN;
            kpis.unificadoPorCobrarPEN += pendientePEN;

            let estadoLogistico = 'A tiempo';
            const fechaReferencia = orden.fecha_despacho || orden.fecha_entrega_real;
            
            if (orden.fecha_entrega_programada && fechaReferencia) {
                if (new Date(fechaReferencia) > new Date(orden.fecha_entrega_programada)) {
                    estadoLogistico = 'Retrasado';
                    kpis.pedidosAtrasados++;
                }
            } else if (orden.fecha_entrega_programada && !fechaReferencia) {
                if (new Date() > new Date(orden.fecha_entrega_programada)) {
                    estadoLogistico = 'Vencido';
                    kpis.pedidosAtrasados++;
                } else {
                    estadoLogistico = 'En plazo';
                }
            }

            const vendedor = orden.nombre_vendedor || 'Sin Asignar';
            const keyVendedor = `${vendedor}_${orden.moneda}`;
            if (!ventasPorVendedor[keyVendedor]) ventasPorVendedor[keyVendedor] = 0;
            ventasPorVendedor[keyVendedor] += montoOriginal;

            const keyEstado = `${orden.estado}_${orden.moneda}`;
            if (!ventasPorEstado[keyEstado]) ventasPorEstado[keyEstado] = 0;
            ventasPorEstado[keyEstado] += montoOriginal;

            const fechaStr = new Date(orden.fecha_emision).toISOString().split('T')[0];
            const keyDia = `${fechaStr}_${orden.moneda}`;
            if (!ventasPorDia[keyDia]) ventasPorDia[keyDia] = 0;
            ventasPorDia[keyDia] += montoOriginal;

            const detallesOrden = detallesMap[orden.id_orden_venta] || [];

            return {
                id: orden.id_orden_venta,
                numero: orden.numero_orden,
                numero_guia_interna: orden.numero_guia_interna,
                tipo_comprobante: orden.tipo_comprobante,
                numero_comprobante: orden.numero_comprobante,
                comprobante_url: orden.comprobante_url,
                facturado_sunat: orden.facturado_sunat,
                numero_comprobante_sunat: orden.numero_comprobante_sunat,
                fecha_facturacion_sunat: orden.fecha_facturacion_sunat,
                orden_compra_cliente: orden.orden_compra_cliente,
                orden_compra_url: orden.orden_compra_url,
                numero_cotizacion: orden.numero_cotizacion,
                cliente: orden.razon_social,
                ruc: orden.ruc,
                direccion_cliente: orden.direccion_cliente,
                email_cliente: orden.email_cliente,
                telefono_cliente: orden.telefono_cliente,
                vendedor: vendedor,
                verificador: orden.nombre_verificador || 'No asignado',
                registrador: orden.nombre_registrador || 'Desconocido',
                fecha_emision: orden.fecha_emision,
                fecha_creacion: orden.fecha_creacion,
                fecha_actualizacion: orden.fecha_actualizacion,
                fecha_vencimiento: orden.fecha_vencimiento,
                fecha_entrega_estimada: orden.fecha_entrega_estimada,
                fecha_entrega_programada: orden.fecha_entrega_programada,
                fecha_entrega_real: orden.fecha_entrega_real,
                fecha_despacho: orden.fecha_despacho,
                fecha_verificacion: orden.fecha_verificacion,
                prioridad: orden.prioridad,
                tipo_entrega: orden.tipo_entrega,
                vehiculo_placa: orden.vehiculo_placa,
                vehiculo_marca: orden.vehiculo_marca,
                conductor_nombre: orden.nombre_conductor,
                conductor_dni: orden.dni_conductor,
                conductor_licencia: orden.transporte_licencia,
                transporte_nombre: orden.transporte_nombre,
                transporte_placa: orden.transporte_placa,
                transporte_conductor: orden.transporte_conductor,
                transporte_dni: orden.transporte_dni,
                transporte_licencia: orden.transporte_licencia,
                direccion_entrega: orden.direccion_entrega,
                lugar_entrega: orden.lugar_entrega,
                ciudad_entrega: orden.ciudad_entrega,
                contacto_entrega: orden.contacto_entrega,
                telefono_entrega: orden.telefono_entrega,
                moneda: orden.moneda,
                tipo_cambio: tcOrden,
                subtotal: subtotalOriginal.toFixed(3),
                igv: (montoOriginal - subtotalOriginal).toFixed(3),
                total: montoOriginal.toFixed(3),
                subtotal_pen: subtotalPEN.toFixed(3),
                igv_pen: igvPEN.toFixed(3),
                total_pen: totalPEN.toFixed(3),
                monto_pagado_pen: pagadoPEN.toFixed(3),
                pendiente_cobro_pen: pendientePEN.toFixed(3),
                monto_pagado: pagadoOriginal.toFixed(3),
                pendiente_cobro: pendienteOriginal.toFixed(3),
                total_comision: comisionOriginal.toFixed(3),
                porcentaje_comision_promedio: parseFloat(orden.porcentaje_comision_promedio) || 0,
                tipo_venta: orden.tipo_venta,
                dias_credito: orden.dias_credito,
                plazo_pago: orden.plazo_pago,
                forma_pago: orden.forma_pago,
                estado_pago: orden.estado_pago,
                estado: orden.estado,
                estado_verificacion: orden.estado_verificacion,
                estado_logistico: estadoLogistico,
                stock_reservado: orden.stock_reservado,
                comprobante_editado: orden.comprobante_editado,
                tipo_impuesto: orden.tipo_impuesto,
                porcentaje_impuesto: orden.porcentaje_impuesto !== null && orden.porcentaje_impuesto !== undefined 
                    ? parseFloat(orden.porcentaje_impuesto) 
                    : 18,
                observaciones: orden.observaciones,
                motivo_rechazo: orden.motivo_rechazo,
                observaciones_verificador: orden.observaciones_verificador,
                detalles: detallesOrden.map(det => ({
                    id: det.id_detalle,
                    producto_nombre: det.producto_nombre,
                    codigo_producto: det.codigo_producto,
                    descripcion: det.producto_descripcion,
                    cantidad: parseFloat(det.cantidad),
                    unidad_medida: det.unidad_medida,
                    precio_unitario: parseFloat(det.precio_unitario).toFixed(2),
                    precio_unitario_original: parseFloat(det.precio_unitario_original || det.precio_unitario).toFixed(2),
                    descuento: parseFloat(det.descuento || 0).toFixed(2),
                    subtotal: parseFloat(det.subtotal).toFixed(2),
                    cantidad_despachada: parseFloat(det.cantidad_despachada || 0),
                    cantidad_pendiente: parseFloat(det.cantidad) - parseFloat(det.cantidad_despachada || 0)
                }))
            };
        });

        const graficoVendedores = Object.keys(ventasPorVendedor)
            .map(key => {
                const [nombre, moneda] = key.split('_');
                return { name: `${nombre} (${moneda})`, value: parseFloat(ventasPorVendedor[key].toFixed(2)), moneda };
            })
            .sort((a, b) => b.value - a.value);

        const graficoEstadoPagoPEN = [
            { name: 'Pagado', value: parseFloat(conteoEstadoPagoPEN['Pagado'].toFixed(2)), color: '#10B981' },
            { name: 'Parcial', value: parseFloat(conteoEstadoPagoPEN['Parcial'].toFixed(2)), color: '#F59E0B' },
            { name: 'Pendiente', value: parseFloat(conteoEstadoPagoPEN['Pendiente'].toFixed(2)), color: '#EF4444' }
        ].filter(item => item.value > 0);

        const graficoEstadoPagoUSD = [
            { name: 'Pagado USD', value: parseFloat(conteoEstadoPagoUSD['Pagado'].toFixed(2)), color: '#059669' },
            { name: 'Parcial USD', value: parseFloat(conteoEstadoPagoUSD['Parcial'].toFixed(2)), color: '#D97706' },
            { name: 'Pendiente USD', value: parseFloat(conteoEstadoPagoUSD['Pendiente'].toFixed(2)), color: '#DC2626' }
        ].filter(item => item.value > 0);

        const graficoEstadoPago = [...graficoEstadoPagoPEN, ...graficoEstadoPagoUSD];

        const graficoVentasDia = Object.keys(ventasPorDia).sort().map(key => {
            const [fecha, moneda] = key.split('_');
            return {
                fecha: fecha.split('-').slice(1).join('/'),
                total: parseFloat(ventasPorDia[key].toFixed(2)),
                fechaCompleta: fecha,
                moneda
            };
        });

        const graficoEstados = Object.keys(ventasPorEstado)
            .map(key => {
                const [estado, moneda] = key.split('_');
                return { name: `${estado} (${moneda})`, value: parseFloat(ventasPorEstado[key].toFixed(2)), moneda };
            })
            .sort((a, b) => b.value - a.value);

        res.json({
            success: true,
            data: {
                resumen: {
                    total_ventas_pen: parseFloat(kpis.totalVentasPEN.toFixed(2)),
                    total_ventas_usd: parseFloat(kpis.totalVentasUSD.toFixed(2)),
                    total_pagado_pen: parseFloat(kpis.totalPagadoPEN.toFixed(2)),
                    total_pagado_usd: parseFloat(kpis.totalPagadoUSD.toFixed(2)),
                    total_pendiente_pen: parseFloat(kpis.totalPorCobrarPEN.toFixed(2)),
                    total_pendiente_usd: parseFloat(kpis.totalPorCobrarUSD.toFixed(2)),
                    total_comisiones_pen: parseFloat(kpis.totalComisionesPEN.toFixed(2)),
                    total_comisiones_usd: parseFloat(kpis.totalComisionesUSD.toFixed(2)),
                    contado_pen: parseFloat(kpis.totalContadoPEN.toFixed(2)),
                    contado_usd: parseFloat(kpis.totalContadoUSD.toFixed(2)),
                    credito_pen: parseFloat(kpis.totalCreditoPEN.toFixed(2)),
                    credito_usd: parseFloat(kpis.totalCreditoUSD.toFixed(2)),
                    
                    // Nuevos campos para los 6 cards
                    factura_pen: parseFloat(kpis.facturaPEN.toFixed(2)),
                    factura_usd: parseFloat(kpis.facturaUSD.toFixed(2)),
                    nota_venta_pen: parseFloat(kpis.notaVentaPEN.toFixed(2)),
                    nota_venta_usd: parseFloat(kpis.notaVentaUSD.toFixed(2)),
                    sin_comprobante_pen: parseFloat(kpis.sinComprobantePEN.toFixed(2)),
                    sin_comprobante_usd: parseFloat(kpis.sinComprobanteUSD.toFixed(2)),

                    pedidos_retrasados: kpis.pedidosAtrasados,
                    cantidad_ordenes: ordenes.length
                },
                graficos: {
                    estado_pago: graficoEstadoPago,
                    ventas_dia: graficoVentasDia,
                    top_vendedores: graficoVendedores,
                    ventas_por_estado: graficoEstados
                },
                detalle: listaDetalle
            }
        });

    } catch (error) {
        console.error('Error en getReporteVentas:', error);
        res.status(500).json({ success: false, error: 'Error al generar reporte' });
    }
};

export const getReporteProductoDespachos = async (req, res) => {
    try {
        const { idProducto, fechaInicio, fechaFin, idCliente, estados, tipoFecha } = req.query;
        if (!idProducto || !fechaInicio || !fechaFin) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros: idProducto, fechaInicio y fechaFin son requeridos' });
        }

        let listaEstados = ['Despachada', 'Despacho Parcial', 'Entregada'];
        if (estados) {
            listaEstados = Array.isArray(estados) ? estados : estados.split(',');
        }

        const campoFechaFiltro = tipoFecha === 'despacho' ? 's.fecha_movimiento' : 'ov.fecha_emision';

        let sql = `
            SELECT 
                ov.id_orden_venta,
                ov.numero_orden,
                ov.fecha_emision,
                ov.moneda,
                ov.tipo_comprobante,
                ov.tipo_impuesto,
                ov.subtotal AS subtotal_orden,
                ov.total AS total_orden,
                c.razon_social as cliente,
                dov.cantidad AS cantidad_total,
                dov.cantidad_despachada,
                dov.precio_unitario,
                (dov.cantidad_despachada * dov.precio_unitario) as subtotal_item,
                s.fecha_movimiento as fecha_despacho_real,
                ov.estado,
                ov.estado_pago
            FROM detalle_orden_venta dov
            INNER JOIN ordenes_venta ov ON dov.id_orden_venta = ov.id_orden_venta
            INNER JOIN clientes c ON ov.id_cliente = c.id_cliente
            LEFT JOIN salidas s ON ov.id_salida = s.id_salida
            WHERE dov.id_producto = ? 
              AND dov.cantidad_despachada > 0 
              AND DATE(${campoFechaFiltro}) BETWEEN ? AND ?
              AND ov.estado IN (?)
              AND (s.id_salida IS NULL OR (s.estado != 'Cancelada' AND s.estado != 'Anulado'))
        `;
        
        const params = [idProducto, fechaInicio, fechaFin, listaEstados];

        if (idCliente && idCliente !== 'null' && idCliente !== '') {
            sql += ` AND ov.id_cliente = ?`;
            params.push(idCliente);
        }

        sql += ` ORDER BY ov.fecha_emision DESC;`;

        const [resultados] = await db.query(sql, params);

        let totalCantidad = 0;
        let totalIngresosPEN = 0;
        let totalIngresosUSD = 0;

        resultados.forEach(row => {
            totalCantidad += parseFloat(row.cantidad_despachada) || 0;
            const subtotal = parseFloat(row.subtotal_item) || 0;
            if (row.moneda === 'USD') {
                totalIngresosUSD += subtotal;
            } else {
                totalIngresosPEN += subtotal;
            }
        });

        res.json({
            success: true,
            data: {
                resumen: {
                    total_cantidad: totalCantidad,
                    total_ingresos_pen: totalIngresosPEN.toFixed(2),
                    total_ingresos_usd: totalIngresosUSD.toFixed(2)
                },
                detalle: resultados
            }
        });
    } catch (error) {
        console.error('Error en getReporteProductoDespachos:', error);
        res.status(500).json({ success: false, error: 'Error al generar reporte de despachos por producto' });
    }
};

export const getReporteDeudasClientes = async (req, res) => {
    try {
        const { idCliente, soloVencidas, tipoComprobante, estadoSunat, fechaInicio, fechaFin, moneda, tipoFecha } = req.query;

        let sql = `
            SELECT 
                ov.id_orden_venta,
                ov.numero_orden,
                ov.tipo_comprobante,
                ov.numero_comprobante_sunat,
                ov.fecha_emision,
                ov.fecha_facturacion_sunat,
                ov.fecha_vencimiento,
                ov.moneda,
                ov.subtotal,
                ov.igv,
                ov.total,
                ov.monto_pagado,
                ov.tipo_impuesto,
                ov.porcentaje_impuesto,
                ov.estado_pago,
                ov.estado,
                c.id_cliente,
                c.razon_social as cliente,
                c.telefono as telefono_cliente,
                c.contacto as contacto_cliente,
                DATEDIFF(CURRENT_DATE, ov.fecha_vencimiento) as dias_vencidos
            FROM ordenes_venta ov
            INNER JOIN clientes c ON ov.id_cliente = c.id_cliente
            WHERE ov.estado NOT IN ('Cancelada', 'Borrador')
              AND ov.estado_pago IN ('Pendiente', 'Parcial')
        `;
        
        const params = [];

        if (idCliente && idCliente !== '' && idCliente !== 'null') {
            sql += ` AND ov.id_cliente = ?`;
            params.push(idCliente);
        }

        if (moneda && moneda !== '') {
            sql += ` AND ov.moneda = ?`;
            params.push(moneda);
        }

        if (soloVencidas === 'true') {
            sql += ` AND ov.fecha_vencimiento < CURRENT_DATE`;
        }

        if (tipoComprobante && tipoComprobante !== '') {
            sql += ` AND ov.tipo_comprobante = ?`;
            params.push(tipoComprobante);
        }

        const campoFecha = tipoFecha === 'fecha_sunat' ? 'ov.fecha_facturacion_sunat' : 'ov.fecha_emision';
        if (fechaInicio && fechaInicio !== '' && fechaFin && fechaFin !== '') {
            sql += ` AND DATE(${campoFecha}) BETWEEN ? AND ?`;
            params.push(fechaInicio, fechaFin);
        }

        if (estadoSunat === 'con_correlativo') {
            sql += ` AND ov.numero_comprobante_sunat IS NOT NULL AND ov.numero_comprobante_sunat != ''`;
        } else if (estadoSunat === 'sin_correlativo') {
            sql += ` AND (ov.numero_comprobante_sunat IS NULL OR ov.numero_comprobante_sunat = '')`;
        }

        sql += ` ORDER BY ov.fecha_vencimiento ASC`;

        const [resultadosRaw] = await db.query(sql, params);
        const facturasExportacion = ['OV-2026-0380', 'OV-2026-0277', 'OV-2026-0162', 'OV-2026-0093'];

        // Sincronizar montos con lógica real de ventas
        const resultados = resultadosRaw.map(row => {
            const subtotal = parseFloat(row.subtotal) || 0;
            const montoPagado = parseFloat(row.monto_pagado) || 0;
            const tipoImpuesto = String(row.tipo_impuesto || '').toUpperCase().trim();
            const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(tipoImpuesto);
            const tipoDoc = String(row.tipo_comprobante || '').trim();

            let totalReal = 0;
            if (tipoDoc.includes('Nota de Venta')) {
                totalReal = subtotal; // Notas de venta NO tienen IGV
            } else if (tipoDoc.includes('Factura') || tipoDoc.includes('Boleta')) {
                if (esSinImpuesto && !facturasExportacion.includes(row.numero_orden)) {
                    totalReal = subtotal;
                } else {
                    const pct = row.porcentaje_impuesto !== null ? parseFloat(row.porcentaje_impuesto) : 18;
                    totalReal = subtotal + (subtotal * (pct / 100));
                }
            } else {
                totalReal = parseFloat(row.total) || subtotal;
            }

            const deudaPendiente = Math.max(0, totalReal - montoPagado);

            return {
                ...row,
                total_real: totalReal.toFixed(2),
                deuda_pendiente: deudaPendiente.toFixed(2)
            };
        }).filter(r => parseFloat(r.deuda_pendiente) > 0.01);

        const inicializarGrupo = () => ({
            total: 0,
            vencido: 0,
            morosidad: 0,
            aging: [
                { name: 'Corriente', monto: 0, color: '#10B981' },
                { name: '0-30 días', monto: 0, color: '#FBBF24' },
                { name: '31-60 días', monto: 0, color: '#F59E0B' },
                { name: '61-90 días', monto: 0, color: '#EF4444' },
                { name: '+90 días', monto: 0, color: '#7F1D1D' }
            ],
            deudoresMap: {}
        });

        const grupos = {
            facturasPEN: inicializarGrupo(),
            facturasUSD: inicializarGrupo(),
            notasVentaPEN: inicializarGrupo(),
            notasVentaUSD: inicializarGrupo(),
            sinComprPEN: inicializarGrupo(),
            sinComprUSD: inicializarGrupo()
        };

        resultados.forEach(row => {
            const deuda = parseFloat(row.deuda_pendiente);
            const dias = parseInt(row.dias_vencidos) || 0;
            const moneda = row.moneda === 'USD' ? 'USD' : 'PEN';
            const tipo = String(row.tipo_comprobante || '').trim();
            
            // Misma segmentación que Reporte Producto
            let key = '';
            if (tipo.includes('Factura')) {
                // Nota: ya calculamos total_real arriba, aquí solo clasificamos
                key = `facturas${moneda}`;
            } else if (tipo.includes('Nota de Venta')) {
                key = `notasVenta${moneda}`;
            } else {
                key = `sinCompr${moneda}`;
            }

            const g = grupos[key];
            g.total += deuda;
            
            if (dias > 0) {
                g.vencido += deuda;
                if (dias <= 30) g.aging[1].monto += deuda;
                else if (dias <= 60) g.aging[2].monto += deuda;
                else if (dias <= 90) g.aging[3].monto += deuda;
                else g.aging[4].monto += deuda;
            } else {
                g.aging[0].monto += deuda;
            }

            if (!g.deudoresMap[row.id_cliente]) {
                g.deudoresMap[row.id_cliente] = { name: row.cliente, deuda: 0 };
            }
            g.deudoresMap[row.id_cliente].deuda += deuda;
        });

        const reporteFinal = {};
        Object.keys(grupos).forEach(k => {
            const g = grupos[k];
            reporteFinal[k] = {
                total: g.total.toFixed(2),
                vencido: g.vencido.toFixed(2),
                morosidad: g.total > 0 ? ((g.vencido / g.total) * 100).toFixed(2) : "0.00",
                aging: g.aging.filter(a => a.monto > 0.01),
                topDeudores: Object.values(g.deudoresMap)
                    .sort((a, b) => b.deuda - a.deuda)
                    .slice(0, 5)
            };
        });

        res.json({
            success: true,
            data: {
                resumen: reporteFinal,
                detalle: resultados
            }
        });

    } catch (error) {
        console.error('Error en getReporteDeudasClientes:', error);
        res.status(500).json({ success: false, error: 'Error al generar reporte de deudas por cliente' });
    }
};

