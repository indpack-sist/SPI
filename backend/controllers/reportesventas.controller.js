import db from '../config/database.js'; // Tu conexión a la BD

export const getReporteVentas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, idCliente } = req.query;

        // 1. Construcción de la Query Dinámica
        let sql = `
            SELECT 
                ov.*,
                c.razon_social,
                c.ruc
            FROM ordenes_venta ov
            INNER JOIN clientes c ON ov.id_cliente = c.id_cliente
            WHERE DATE(ov.fecha_emision) BETWEEN ? AND ?
            AND ov.estado != 'Cancelada'
        `;

        const params = [fechaInicio, fechaFin];

        if (idCliente && idCliente !== 'null' && idCliente !== '') {
            sql += ` AND ov.id_cliente = ?`;
            params.push(idCliente);
        }

        sql += ` ORDER BY ov.fecha_emision DESC`;

        // 2. Ejecutar la consulta
        const [ordenes] = await db.query(sql, params);

        // 3. Procesamiento de Datos (Resumen y Gráficos)
        let totalVentasPEN = 0;
        let totalPagadoPEN = 0;
        let totalPendientePEN = 0;

        // Acumuladores para gráficos
        const conteoEstadoPago = { 'Pagado': 0, 'Parcial': 0, 'Pendiente': 0 };
        const ventasPorDia = {}; // Objeto para agrupar: { '2025-02-01': 1500.00 }

        const listaDetalle = ordenes.map(orden => {
            // Normalización de Moneda a Soles para el reporte
            const esDolar = orden.moneda === 'USD';
            const tipoCambio = parseFloat(orden.tipo_cambio) || 1;
            
            // Valores originales
            const totalOriginal = parseFloat(orden.total) || 0;
            const pagadoOriginal = parseFloat(orden.monto_pagado) || 0;

            // Conversión a PEN para estadísticas globales
            const totalPEN = esDolar ? totalOriginal * tipoCambio : totalOriginal;
            const pagadoPEN = esDolar ? pagadoOriginal * tipoCambio : pagadoOriginal;
            const pendientePEN = totalPEN - pagadoPEN;

            // Sumar a totales generales
            totalVentasPEN += totalPEN;
            totalPagadoPEN += pagadoPEN;
            totalPendientePEN += pendientePEN;

            // Conteo para gráfico circular
            if (conteoEstadoPago[orden.estado_pago] !== undefined) {
                conteoEstadoPago[orden.estado_pago] += totalPEN; // Sumamos monto, no cantidad (opcional: puedes sumar +1 si prefieres cantidad de ordenes)
            }

            // Agrupación para gráfico de barras (Ventas por día)
            const fechaStr = new Date(orden.fecha_emision).toISOString().split('T')[0]; // YYYY-MM-DD
            if (!ventasPorDia[fechaStr]) {
                ventasPorDia[fechaStr] = 0;
            }
            ventasPorDia[fechaStr] += totalPEN;

            // Retornamos la orden formateada para la tabla de detalle
            return {
                id: orden.id_orden_venta,
                numero: orden.numero_orden,
                cliente: orden.razon_social,
                fecha: fechaStr,
                moneda: orden.moneda,
                total: totalOriginal,
                pagado: pagadoOriginal,
                estado_pago: orden.estado_pago,
                estado: orden.estado,
                tipo_cambio: orden.tipo_cambio
            };
        });

        // 4. Formatear datos para Recharts

        // A) Gráfico Circular (Pie Chart)
        const graficoEstadoPago = [
            { name: 'Pagado', value: parseFloat(conteoEstadoPago['Pagado'].toFixed(2)), color: '#10B981' }, // Verde
            { name: 'Parcial', value: parseFloat(conteoEstadoPago['Parcial'].toFixed(2)), color: '#F59E0B' }, // Ambar
            { name: 'Pendiente', value: parseFloat(conteoEstadoPago['Pendiente'].toFixed(2)), color: '#EF4444' } // Rojo
        ].filter(item => item.value > 0); // Solo enviamos lo que tenga datos

        // B) Gráfico de Barras (Bar Chart) - Ordenado por fecha
        const graficoVentasDia = Object.keys(ventasPorDia).sort().map(fecha => ({
            fecha: fecha.split('-').slice(1).join('/'), // Formato DD/MM para el gráfico
            total: parseFloat(ventasPorDia[fecha].toFixed(2)),
            fechaCompleta: fecha // Para tooltips o referencias
        }));

        // 5. Respuesta Final
        res.json({
            success: true,
            data: {
                resumen: {
                    total_ventas_pen: parseFloat(totalVentasPEN.toFixed(2)),
                    total_pagado_pen: parseFloat(totalPagadoPEN.toFixed(2)),
                    total_pendiente_pen: parseFloat(totalPendientePEN.toFixed(2)),
                    cantidad_ordenes: ordenes.length
                },
                graficos: {
                    estado_pago: graficoEstadoPago,
                    ventas_dia: graficoVentasDia
                },
                detalle: listaDetalle
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al generar el reporte de ventas' });
    }
};