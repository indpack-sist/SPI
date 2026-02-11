import db from '../config/database.js';
import PDFDocument from 'pdfkit';

export const getReporteVentas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, idCliente, idVendedor, format } = req.query;

        let sql = `
            SELECT 
                ov.*,
                c.razon_social,
                c.ruc,
                c.direccion,
                CONCAT(COALESCE(e.nombres,''), ' ', COALESCE(e.apellidos,'')) as nombre_vendedor
            FROM ordenes_venta ov
            INNER JOIN clientes c ON ov.id_cliente = c.id_cliente
            LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
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

        let kpis = {
            totalVentasPEN: 0,
            totalPagadoPEN: 0,
            totalPorCobrarPEN: 0,
            totalContado: 0,
            totalCredito: 0,
            pedidosAtrasados: 0
        };

        const conteoEstadoPago = { 'Pagado': 0, 'Parcial': 0, 'Pendiente': 0 };
        const ventasPorDia = {};
        const ventasPorVendedor = {};

        const listaDetalle = ordenes.map(orden => {
            const esDolar = orden.moneda === 'USD';
            const tipoCambio = parseFloat(orden.tipo_cambio) || 1;
            
            const totalOriginal = parseFloat(orden.total) || 0;
            const pagadoOriginal = parseFloat(orden.monto_pagado) || 0;

            const totalPEN = esDolar ? totalOriginal * tipoCambio : totalOriginal;
            const pagadoPEN = esDolar ? pagadoOriginal * tipoCambio : pagadoOriginal;
            const pendientePEN = totalPEN - pagadoPEN;

            kpis.totalVentasPEN += totalPEN;
            kpis.totalPagadoPEN += pagadoPEN;
            kpis.totalPorCobrarPEN += pendientePEN;

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

            const fechaStr = new Date(orden.fecha_emision).toISOString().split('T')[0];
            if (!ventasPorDia[fechaStr]) ventasPorDia[fechaStr] = 0;
            ventasPorDia[fechaStr] += totalPEN;

            return {
                id: orden.id_orden_venta,
                numero: orden.numero_orden,
                cliente: orden.razon_social,
                ruc: orden.ruc,
                vendedor: vendedor,
                fecha_emision: fechaStr,
                fecha_despacho: orden.fecha_entrega_real ? new Date(orden.fecha_entrega_real).toISOString().split('T')[0] : 'Pendiente',
                moneda: orden.moneda,
                total_original: totalOriginal.toFixed(2),
                total_pen: totalPEN.toFixed(2),
                pagado: pagadoOriginal.toFixed(2),
                tipo_venta: orden.tipo_venta,
                estado_pago: orden.estado_pago,
                estado_logistico: estadoLogistico,
                estado_pedido: orden.estado
            };
        });

        if (format === 'pdf') {
            const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=reporte_ventas_${Date.now()}.pdf`);
            
            doc.pipe(res);

            doc.fontSize(18).text('Reporte General de Ventas', { align: 'center' });
            doc.fontSize(10).text(`Generado: ${new Date().toLocaleString()}`, { align: 'center' });
            doc.moveDown();

            doc.fontSize(12).text(`Total Ventas (PEN): S/ ${kpis.totalVentasPEN.toFixed(2)}`);
            doc.text(`Total Cobrado: S/ ${kpis.totalPagadoPEN.toFixed(2)}`);
            doc.text(`Por Cobrar: S/ ${kpis.totalPorCobrarPEN.toFixed(2)}`);
            doc.moveDown();

            const tableTop = 150;
            let currentY = tableTop;
            const rowHeight = 20;

            doc.fontSize(8).font('Helvetica-Bold');
            doc.text('Orden', 30, currentY);
            doc.text('Cliente', 80, currentY);
            doc.text('Emisión', 230, currentY);
            doc.text('Despacho', 280, currentY);
            doc.text('Total', 330, currentY);
            doc.text('Pago', 380, currentY);
            doc.text('Logística', 430, currentY);
            doc.text('Vendedor', 480, currentY);

            doc.moveTo(30, currentY + 10).lineTo(800, currentY + 10).stroke();
            doc.font('Helvetica');

            listaDetalle.forEach(item => {
                currentY += rowHeight;
                
                if (currentY > 550) {
                    doc.addPage({ layout: 'landscape' });
                    currentY = 50;
                }

                doc.text(item.numero, 30, currentY);
                doc.text(item.cliente.substring(0, 25), 80, currentY);
                doc.text(item.fecha_emision, 230, currentY);
                doc.text(item.fecha_despacho, 280, currentY);
                doc.text(`${item.moneda} ${item.total_original}`, 330, currentY);
                doc.text(item.estado_pago, 380, currentY);
                doc.text(item.estado_logistico, 430, currentY);
                doc.text(item.vendedor.substring(0, 15), 480, currentY);
            });

            doc.end();
            return;
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

        res.json({
            success: true,
            data: {
                resumen: {
                    total_ventas_pen: parseFloat(kpis.totalVentasPEN.toFixed(2)),
                    total_pagado_pen: parseFloat(kpis.totalPagadoPEN.toFixed(2)),
                    total_pendiente_pen: parseFloat(kpis.totalPorCobrarPEN.toFixed(2)),
                    contado_pen: parseFloat(kpis.totalContado.toFixed(2)),
                    credito_pen: parseFloat(kpis.totalCredito.toFixed(2)),
                    pedidos_retrasados: kpis.pedidosAtrasados,
                    cantidad_ordenes: ordenes.length
                },
                graficos: {
                    estado_pago: graficoEstadoPago,
                    ventas_dia: graficoVentasDia,
                    top_vendedores: graficoVendedores
                },
                detalle: listaDetalle
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al generar reporte' });
    }
};