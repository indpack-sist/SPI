import db from '../config/database.js';

export const getReporteVentas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, idCliente, idVendedor } = req.query;

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
            WHERE DATE(ov.fecha_emision) BETWEEN ? AND ?
            AND ov.estado != 'Cancelada'
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

        sql += ` ORDER BY ov.fecha_emision DESC`;

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
            totalVentasPEN: 0,
            totalVentasUSD: 0,
            totalPagadoPEN: 0,
            totalPagadoUSD: 0,
            totalPorCobrarPEN: 0,
            totalPorCobrarUSD: 0,
            totalContadoPEN: 0,
            totalContadoUSD: 0,
            totalCreditoPEN: 0,
            totalCreditoUSD: 0,
            pedidosAtrasados: 0,
            totalComisionesPEN: 0,
            totalComisionesUSD: 0
        };

        const conteoEstadoPagoPEN = { 'Pagado': 0, 'Parcial': 0, 'Pendiente': 0 };
        const conteoEstadoPagoUSD = { 'Pagado': 0, 'Parcial': 0, 'Pendiente': 0 };
        const ventasPorDia = {};
        const ventasPorVendedor = {};
        const ventasPorEstado = {};

        const listaDetalle = ordenes.map(orden => {
            const esDolar = orden.moneda === 'USD';
            
            const totalOriginal = parseFloat(orden.total) || 0;
            const pagadoOriginal = parseFloat(orden.monto_pagado) || 0;
            const subtotalOriginal = parseFloat(orden.subtotal) || 0;
            const igvOriginal = parseFloat(orden.igv) || 0;
            const comisionOriginal = parseFloat(orden.total_comision) || 0;
            const pendienteOriginal = totalOriginal - pagadoOriginal;

            if (esDolar) {
                kpis.totalVentasUSD += totalOriginal;
                kpis.totalPagadoUSD += pagadoOriginal;
                kpis.totalPorCobrarUSD += pendienteOriginal;
                kpis.totalComisionesUSD += comisionOriginal;
                
                if (orden.tipo_venta === 'Crédito') {
                    kpis.totalCreditoUSD += totalOriginal;
                } else {
                    kpis.totalContadoUSD += totalOriginal;
                }
                
                if (conteoEstadoPagoUSD[orden.estado_pago] !== undefined) {
                    conteoEstadoPagoUSD[orden.estado_pago] += totalOriginal;
                }
            } else {
                kpis.totalVentasPEN += totalOriginal;
                kpis.totalPagadoPEN += pagadoOriginal;
                kpis.totalPorCobrarPEN += pendienteOriginal;
                kpis.totalComisionesPEN += comisionOriginal;
                
                if (orden.tipo_venta === 'Crédito') {
                    kpis.totalCreditoPEN += totalOriginal;
                } else {
                    kpis.totalContadoPEN += totalOriginal;
                }
                
                if (conteoEstadoPagoPEN[orden.estado_pago] !== undefined) {
                    conteoEstadoPagoPEN[orden.estado_pago] += totalOriginal;
                }
            }

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
            ventasPorVendedor[keyVendedor] += totalOriginal;

            const keyEstado = `${orden.estado}_${orden.moneda}`;
            if (!ventasPorEstado[keyEstado]) ventasPorEstado[keyEstado] = 0;
            ventasPorEstado[keyEstado] += totalOriginal;

            const fechaStr = new Date(orden.fecha_emision).toISOString().split('T')[0];
            const keyDia = `${fechaStr}_${orden.moneda}`;
            if (!ventasPorDia[keyDia]) ventasPorDia[keyDia] = 0;
            ventasPorDia[keyDia] += totalOriginal;

            const detallesOrden = detallesMap[orden.id_orden_venta] || [];

            return {
                id: orden.id_orden_venta,
                numero: orden.numero_orden,
                numero_guia_interna: orden.numero_guia_interna,
                tipo_comprobante: orden.tipo_comprobante,
                numero_comprobante: orden.numero_comprobante,
                comprobante_url: orden.comprobante_url,
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
                tipo_cambio: parseFloat(orden.tipo_cambio) || 1,
                subtotal: subtotalOriginal.toFixed(2),
                igv: igvOriginal.toFixed(2),
                total: totalOriginal.toFixed(2),
                total_comision: comisionOriginal.toFixed(2),
                porcentaje_comision_promedio: parseFloat(orden.porcentaje_comision_promedio) || 0,
                monto_pagado: pagadoOriginal.toFixed(2),
                pendiente_cobro: pendienteOriginal.toFixed(2),
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
                porcentaje_impuesto: parseFloat(orden.porcentaje_impuesto) || 18,
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