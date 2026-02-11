import db from '../config/database.js';
import { generarReporteVentasPDF } from '../utils/reporteVentasPDF.js';

export const getReporteVentas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, idCliente, idVendedor, format } = req.query;

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
        cot.numero_cotizacion
    FROM ordenes_venta ov
    INNER JOIN clientes c ON ov.id_cliente = c.id_cliente
    LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
    LEFT JOIN empleados ev ON ov.id_verificador = ev.id_empleado
    LEFT JOIN empleados er ON ov.id_registrado_por = er.id_empleado
    LEFT JOIN flota v ON ov.id_vehiculo = v.id_vehiculo
    LEFT JOIN empleados ec ON ov.id_conductor = ec.id_empleado
    LEFT JOIN cotizaciones cot ON ov.id_cotizacion = cot.id_cotizacion
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
                    p.codigo_producto,
                    p.unidad_medida,
                    p.descripcion as producto_descripcion
                FROM detalle_orden_venta dov
                LEFT JOIN productos p ON dov.id_producto = p.id_producto
                WHERE dov.id_orden_venta IN (?)
                ORDER BY dov.id_detalle_orden
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
            totalPagadoPEN: 0,
            totalPorCobrarPEN: 0,
            totalContado: 0,
            totalCredito: 0,
            pedidosAtrasados: 0,
            totalComisionesPEN: 0
        };

        const conteoEstadoPago = { 'Pagado': 0, 'Parcial': 0, 'Pendiente': 0 };
        const ventasPorDia = {};
        const ventasPorVendedor = {};
        const ventasPorEstado = {};

        const listaDetalle = ordenes.map(orden => {
            const esDolar = orden.moneda === 'USD';
            const tipoCambio = parseFloat(orden.tipo_cambio) || 1;
            
            const totalOriginal = parseFloat(orden.total) || 0;
            const pagadoOriginal = parseFloat(orden.monto_pagado) || 0;
            const subtotalOriginal = parseFloat(orden.subtotal) || 0;
            const igvOriginal = parseFloat(orden.igv) || 0;
            const comisionOriginal = parseFloat(orden.total_comision) || 0;

            const totalPEN = esDolar ? totalOriginal * tipoCambio : totalOriginal;
            const pagadoPEN = esDolar ? pagadoOriginal * tipoCambio : pagadoOriginal;
            const pendientePEN = totalPEN - pagadoPEN;
            const comisionPEN = esDolar ? comisionOriginal * tipoCambio : comisionOriginal;

            kpis.totalVentasPEN += totalPEN;
            kpis.totalPagadoPEN += pagadoPEN;
            kpis.totalPorCobrarPEN += pendientePEN;
            kpis.totalComisionesPEN += comisionPEN;

            if (orden.tipo_venta === 'Crédito') {
                kpis.totalCredito += totalPEN;
            } else {
                kpis.totalContado += totalPEN;
            }

            let estadoLogistico = 'A tiempo';
            if (orden.fecha_entrega_programada && orden.fecha_entrega_real) {
                if (new Date(orden.fecha_entrega_real) > new Date(orden.fecha_entrega_programada)) {
                    estadoLogistico = 'Retrasado';
                    kpis.pedidosAtrasados++;
                }
            } else if (orden.fecha_entrega_programada && !orden.fecha_entrega_real) {
                if (new Date() > new Date(orden.fecha_entrega_programada)) {
                    estadoLogistico = 'Vencido';
                    kpis.pedidosAtrasados++;
                } else {
                    estadoLogistico = 'En plazo';
                }
            }

            if (conteoEstadoPago[orden.estado_pago] !== undefined) {
                conteoEstadoPago[orden.estado_pago] += totalPEN;
            }

            const vendedor = orden.nombre_vendedor || 'Sin Asignar';
            if (!ventasPorVendedor[vendedor]) ventasPorVendedor[vendedor] = 0;
            ventasPorVendedor[vendedor] += totalPEN;

            if (!ventasPorEstado[orden.estado]) ventasPorEstado[orden.estado] = 0;
            ventasPorEstado[orden.estado] += totalPEN;

            const fechaStr = new Date(orden.fecha_emision).toISOString().split('T')[0];
            if (!ventasPorDia[fechaStr]) ventasPorDia[fechaStr] = 0;
            ventasPorDia[fechaStr] += totalPEN;

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
                tipo_cambio: tipoCambio,
                subtotal: subtotalOriginal.toFixed(2),
                igv: igvOriginal.toFixed(2),
                total: totalOriginal.toFixed(2),
                total_comision: comisionOriginal.toFixed(2),
                porcentaje_comision_promedio: parseFloat(orden.porcentaje_comision_promedio) || 0,
                total_pen: totalPEN.toFixed(2),
                monto_pagado: pagadoOriginal.toFixed(2),
                pendiente_cobro: (totalOriginal - pagadoOriginal).toFixed(2),
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
                    id: det.id_detalle_orden,
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

        if (format === 'pdf') {
            try {
                const dataReporte = {
                    resumen: {
                        total_ventas_pen: parseFloat(kpis.totalVentasPEN.toFixed(2)),
                        total_pagado_pen: parseFloat(kpis.totalPagadoPEN.toFixed(2)),
                        total_pendiente_pen: parseFloat(kpis.totalPorCobrarPEN.toFixed(2)),
                        total_comisiones_pen: parseFloat(kpis.totalComisionesPEN.toFixed(2)),
                        contado_pen: parseFloat(kpis.totalContado.toFixed(2)),
                        credito_pen: parseFloat(kpis.totalCredito.toFixed(2)),
                        pedidos_retrasados: kpis.pedidosAtrasados,
                        cantidad_ordenes: ordenes.length
                    },
                    detalle: listaDetalle
                };

                const pdfBuffer = await generarReporteVentasPDF(dataReporte);
                
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=reporte_ventas_${Date.now()}.pdf`);
                res.send(pdfBuffer);
                return;
            } catch (pdfError) {
                console.error('Error generando PDF:', pdfError);
                return res.status(500).json({ success: false, error: 'Error al generar PDF' });
            }
        }

        const graficoVendedores = Object.keys(ventasPorVendedor)
            .map(v => ({ name: v, value: parseFloat(ventasPorVendedor[v].toFixed(2)) }))
            .sort((a, b) => b.value - a.value);

        const graficoEstadoPago = [
            { name: 'Pagado', value: parseFloat(conteoEstadoPago['Pagado'].toFixed(2)), color: '#10B981' },
            { name: 'Parcial', value: parseFloat(conteoEstadoPago['Parcial'].toFixed(2)), color: '#F59E0B' },
            { name: 'Pendiente', value: parseFloat(conteoEstadoPago['Pendiente'].toFixed(2)), color: '#EF4444' }
        ].filter(item => item.value > 0);

        const graficoVentasDia = Object.keys(ventasPorDia).sort().map(fecha => ({
            fecha: fecha.split('-').slice(1).join('/'),
            total: parseFloat(ventasPorDia[fecha].toFixed(2)),
            fechaCompleta: fecha
        }));

        const graficoEstados = Object.keys(ventasPorEstado)
            .map(e => ({ name: e, value: parseFloat(ventasPorEstado[e].toFixed(2)) }))
            .sort((a, b) => b.value - a.value);

        res.json({
            success: true,
            data: {
                resumen: {
                    total_ventas_pen: parseFloat(kpis.totalVentasPEN.toFixed(2)),
                    total_pagado_pen: parseFloat(kpis.totalPagadoPEN.toFixed(2)),
                    total_pendiente_pen: parseFloat(kpis.totalPorCobrarPEN.toFixed(2)),
                    total_comisiones_pen: parseFloat(kpis.totalComisionesPEN.toFixed(2)),
                    contado_pen: parseFloat(kpis.totalContado.toFixed(2)),
                    credito_pen: parseFloat(kpis.totalCredito.toFixed(2)),
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