import React, { useState, useEffect } from 'react';
import { api } from '../../config/api';

const ReporteDeudasClientes = () => {
    const [clientes, setClientes] = useState([]);
    const [filtros, setFiltros] = useState({
        idCliente: '',
        soloVencidas: false,
        tipoComprobante: '',
        estadoSunat: ''
    });
    
    const [loading, setLoading] = useState(false);
    const [reporteData, setReporteData] = useState(null);
    const [error, setError] = useState(null);

    // Cargar clientes para el select
    useEffect(() => {
        const fetchClientes = async () => {
            try {
                const response = await api.get('/clientes');
                if (response.data.success) {
                    setClientes(response.data.data);
                }
            } catch (err) {
                console.error("Error cargando clientes", err);
            }
        };
        fetchClientes();
    }, []);

    const handleChangeFiltro = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFiltros({
            ...filtros,
            [e.target.name]: value
        });
    };

    const generarReporte = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/reportes/deudas-clientes', { params: filtros });
            if (response.data.success) {
                setReporteData(response.data.data);
            } else {
                setError(response.data.error || "Error al obtener el reporte.");
            }
        } catch (err) {
            setError(err.response?.data?.error || "Error de conexión al generar el reporte.");
        } finally {
            setLoading(false);
        }
    };

    const getBadgeClass = (diasVencidos) => {
        if (diasVencidos > 30) return "bg-red-100 text-red-800";
        if (diasVencidos > 0) return "bg-yellow-100 text-yellow-800";
        return "bg-green-100 text-green-800";
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Cuentas por Cobrar y Morosidad</h1>

            <div className="card mb-6">
                <div className="card-body">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="form-group flex-1 min-w-[200px]">
                            <label className="form-label">Cliente (Opcional):</label>
                            <select 
                                name="idCliente" 
                                value={filtros.idCliente} 
                                onChange={handleChangeFiltro}
                                className="form-select w-full"
                            >
                                <option value="">-- Todos los Clientes --</option>
                                {clientes.map(c => (
                                    <option key={c.id_cliente} value={c.id_cliente}>
                                        {c.ruc} - {c.razon_social}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="form-group flex-1 min-w-[150px]">
                            <label className="form-label">Tipo Documento:</label>
                            <select 
                                name="tipoComprobante" 
                                value={filtros.tipoComprobante} 
                                onChange={handleChangeFiltro}
                                className="form-select w-full"
                            >
                                <option value="">-- Todos --</option>
                                <option value="Factura">Factura</option>
                                <option value="Boleta">Boleta</option>
                                <option value="Nota de Venta">Nota de Venta</option>
                            </select>
                        </div>

                        <div className="form-group flex-1 min-w-[200px]">
                            <label className="form-label">Estado SUNAT:</label>
                            <select 
                                name="estadoSunat" 
                                value={filtros.estadoSunat} 
                                onChange={handleChangeFiltro}
                                className="form-select w-full"
                            >
                                <option value="">-- Todos --</option>
                                <option value="con_correlativo">Con Correlativo SUNAT</option>
                                <option value="sin_correlativo">Pendiente de Correlativo</option>
                            </select>
                        </div>

                        <div className="form-group flex items-center h-[38px] px-2">
                            <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                                <input 
                                    type="checkbox" 
                                    name="soloVencidas" 
                                    checked={filtros.soloVencidas} 
                                    onChange={handleChangeFiltro}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                SOLO Vencidas
                            </label>
                        </div>

                        <div className="form-group">
                            <button 
                                onClick={generarReporte} 
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? 'Generando...' : 'Generar Reporte'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 text-red-700">
                    <p>{error}</p>
                </div>
            )}

            {reporteData && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        
                        {/* KPIs SOLES */}
                        <div className="flex flex-col gap-4">
                            <div className="card bg-blue-50 border border-blue-100">
                                <div className="card-body py-4">
                                    <h4 className="text-blue-800 text-sm font-semibold mb-1">Deuda Total (Soles)</h4>
                                    <p className="text-2xl font-bold text-blue-900">
                                        S/ {reporteData.resumen.deuda_total_pen}
                                    </p>
                                </div>
                            </div>
                            <div className="card bg-red-50 border border-red-100">
                                <div className="card-body py-4">
                                    <h4 className="text-red-800 text-sm font-semibold mb-1">Deuda Vencida (Soles)</h4>
                                    <p className="text-2xl font-bold text-red-900">
                                        S/ {reporteData.resumen.deuda_vencida_pen}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* KPIs DOLARES */}
                        <div className="flex flex-col gap-4">
                            <div className="card bg-green-50 border border-green-100">
                                <div className="card-body py-4">
                                    <h4 className="text-green-800 text-sm font-semibold mb-1">Deuda Total (Dólares)</h4>
                                    <p className="text-2xl font-bold text-green-900">
                                        $ {reporteData.resumen.deuda_total_usd}
                                    </p>
                                </div>
                            </div>
                            <div className="card bg-red-50 border border-red-100">
                                <div className="card-body py-4">
                                    <h4 className="text-red-800 text-sm font-semibold mb-1">Deuda Vencida (Dólares)</h4>
                                    <p className="text-2xl font-bold text-red-900">
                                        $ {reporteData.resumen.deuda_vencida_usd}
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Detalle de Deudas</h3>
                        </div>
                        <div className="card-body p-0 overflow-x-auto">
                            <table className="table table-sm text-sm w-full">
                                <thead>
                                    <tr>
                                        <th>N° Orden</th>
                                        <th>Documento</th>
                                        <th>Cliente</th>
                                        <th>Vencimiento</th>
                                        <th className="text-right">Total</th>
                                        <th className="text-right">Pagado</th>
                                        <th className="text-right">Pendiente</th>
                                        <th className="text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reporteData.detalle.length > 0 ? (
                                        reporteData.detalle.map((row) => {
                                            const esVencido = row.dias_vencidos > 0;
                                            
                                            // Logica visual para el comprobante
                                            let documentoTexto = row.tipo_comprobante || 'Desconocido';
                                            let documentoEstado = null;
                                            
                                            if (['Factura', 'Boleta'].includes(row.tipo_comprobante)) {
                                                if (row.numero_comprobante_sunat) {
                                                    documentoTexto = `${row.tipo_comprobante} (${row.numero_comprobante_sunat})`;
                                                    documentoEstado = <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 mt-1">Emitido SUNAT</span>;
                                                } else {
                                                    documentoEstado = <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 mt-1">Intención - Sin Correlativo</span>;
                                                }
                                            }

                                            return (
                                                <tr key={row.id_orden_venta} className={esVencido ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}>
                                                    <td>
                                                        <div className="font-semibold text-gray-900">{row.numero_orden}</div>
                                                        <div className="text-xs text-gray-500">{new Date(row.fecha_emision).toLocaleDateString('es-PE')}</div>
                                                    </td>
                                                    <td>
                                                        <div className="font-medium text-gray-900">{documentoTexto}</div>
                                                        {documentoEstado}
                                                    </td>
                                                    <td>
                                                        <div className="truncate max-w-[200px] text-gray-900">{row.cliente}</div>
                                                        <div className="text-xs text-gray-500">{row.telefono_cliente || 'Sin Tlf'}</div>
                                                    </td>
                                                    <td className={esVencido ? 'text-red-600 font-medium' : 'text-gray-900'}>
                                                        {row.fecha_vencimiento ? new Date(row.fecha_vencimiento).toLocaleDateString('es-PE') : '-'}
                                                    </td>
                                                    <td className="text-right text-gray-600">
                                                        {row.moneda} {parseFloat(row.total).toFixed(2)}
                                                    </td>
                                                    <td className="text-right text-green-600">
                                                        {row.moneda} {parseFloat(row.monto_pagado).toFixed(2)}
                                                    </td>
                                                    <td className={`text-right font-bold ${esVencido ? 'text-red-700' : 'text-gray-900'}`}>
                                                        {row.moneda} {parseFloat(row.deuda_pendiente).toFixed(2)}
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getBadgeClass(row.dias_vencidos)}`}>
                                                            {row.dias_vencidos > 0 
                                                                ? `Vencido (${row.dias_vencidos} días)` 
                                                                : 'Al Día'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="8" className="text-center py-8 text-gray-500">
                                                No se encontraron deudas pendientes con los filtros seleccionados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ReporteDeudasClientes;