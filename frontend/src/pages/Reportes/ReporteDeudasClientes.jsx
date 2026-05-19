import React, { useState, useEffect } from 'react';
import api from '../../config/api';

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
            const response = await api.get('/reportesventas/deudas-clientes', { params: filtros });
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

    // Estilos inline para consistencia visual rápida
    const getBadgeStyle = (diasVencidos) => {
        if (diasVencidos > 30) return "badge bg-danger";
        if (diasVencidos > 0) return "badge bg-warning text-dark";
        return "badge bg-success";
    };

    return (
        <div className="reportes-sire-container">
            <div className="header-actions">
                <h2>Cuentas por Cobrar y Morosidad</h2>
            </div>

            <div className="filtros-container" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div className="filtro-grupo">
                    <label>Cliente (Opcional):</label>
                    <select 
                        name="idCliente" 
                        value={filtros.idCliente} 
                        onChange={handleChangeFiltro}
                        className="form-control"
                    >
                        <option value="">-- Todos los Clientes --</option>
                        {clientes.map(c => (
                            <option key={c.id_cliente} value={c.id_cliente}>
                                {c.ruc} - {c.razon_social}
                            </option>
                        ))}
                    </select>
                </div>
                
                <div className="filtro-grupo">
                    <label>Tipo Documento:</label>
                    <select 
                        name="tipoComprobante" 
                        value={filtros.tipoComprobante} 
                        onChange={handleChangeFiltro}
                        className="form-control"
                    >
                        <option value="">-- Todos --</option>
                        <option value="Factura">Factura</option>
                        <option value="Boleta">Boleta</option>
                        <option value="Nota de Venta">Nota de Venta</option>
                    </select>
                </div>

                <div className="filtro-grupo">
                    <label>Estado SUNAT:</label>
                    <select 
                        name="estadoSunat" 
                        value={filtros.estadoSunat} 
                        onChange={handleChangeFiltro}
                        className="form-control"
                    >
                        <option value="">-- Todos --</option>
                        <option value="con_correlativo">Con Correlativo SUNAT</option>
                        <option value="sin_correlativo">Pendiente de Correlativo (Solo Intención)</option>
                    </select>
                </div>

                <div className="filtro-grupo" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '28px', minWidth: '200px' }}>
                    <input 
                        type="checkbox" 
                        id="soloVencidas"
                        name="soloVencidas" 
                        checked={filtros.soloVencidas} 
                        onChange={handleChangeFiltro}
                        style={{ width: '18px', height: '18px' }}
                    />
                    <label htmlFor="soloVencidas" style={{ margin: 0, cursor: 'pointer', fontWeight: 'bold' }}>
                        SOLO Vencidas
                    </label>
                </div>

                <div className="filtro-grupo align-bottom" style={{ marginTop: '20px' }}>
                    <button 
                        onClick={generarReporte} 
                        className="btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Generando...' : 'Generar Reporte'}
                    </button>
                </div>
            </div>

            {error && <div className="alert alert-danger" style={{marginTop: '15px'}}>{error}</div>}

            {reporteData && (
                <>
                    <div className="resumen-kpis" style={{ display: 'flex', gap: '20px', marginTop: '20px', marginBottom: '20px' }}>
                        
                        {/* KPIs SOLES */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div className="kpi-card" style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #0d6efd' }}>
                                <h4>Deuda Total (Soles)</h4>
                                <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                                    S/ {reporteData.resumen.deuda_total_pen}
                                </p>
                            </div>
                            <div className="kpi-card" style={{ background: '#fff3f3', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #dc3545' }}>
                                <h4 style={{color: '#dc3545'}}>Deuda Vencida (Soles)</h4>
                                <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#dc3545' }}>
                                    S/ {reporteData.resumen.deuda_vencida_pen}
                                </p>
                            </div>
                        </div>

                        {/* KPIs DOLARES */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div className="kpi-card" style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #198754' }}>
                                <h4>Deuda Total (Dólares)</h4>
                                <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#198754' }}>
                                    $ {reporteData.resumen.deuda_total_usd}
                                </p>
                            </div>
                            <div className="kpi-card" style={{ background: '#fff3f3', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #dc3545' }}>
                                <h4 style={{color: '#dc3545'}}>Deuda Vencida (Dólares)</h4>
                                <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#dc3545' }}>
                                    $ {reporteData.resumen.deuda_vencida_usd}
                                </p>
                            </div>
                        </div>

                    </div>

                    <div className="table-container">
                        <table className="table table-hover">
                            <thead>
                                <tr>
                                    <th>N° Orden</th>
                                    <th>Documento</th>
                                    <th>Cliente</th>
                                    <th>Vencimiento</th>
                                    <th style={{textAlign: 'right'}}>Total</th>
                                    <th style={{textAlign: 'right'}}>Pagado</th>
                                    <th style={{textAlign: 'right'}}>Pendiente</th>
                                    <th style={{textAlign: 'center'}}>Estado</th>
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
                                                documentoEstado = <span className="badge bg-success" style={{fontSize:'0.65rem'}}>Emitido SUNAT</span>;
                                            } else {
                                                documentoEstado = <span className="badge bg-secondary" style={{fontSize:'0.65rem'}}>Intención - Sin Correlativo</span>;
                                            }
                                        }

                                        return (
                                            <tr key={row.id_orden_venta} style={esVencido ? { background: '#fffcfc' } : {}}>
                                                <td><strong>{row.numero_orden}</strong><br/><small className="text-muted">{new Date(row.fecha_emision).toLocaleDateString('es-PE')}</small></td>
                                                <td>
                                                    <strong>{documentoTexto}</strong><br/>
                                                    {documentoEstado}
                                                </td>
                                                <td>
                                                    {row.cliente}<br/>
                                                    <small className="text-muted">{row.telefono_cliente || 'Sin Tlf'}</small>
                                                </td>
                                                <td style={esVencido ? {color: 'red', fontWeight: 'bold'} : {}}>
                                                    {row.fecha_vencimiento ? new Date(row.fecha_vencimiento).toLocaleDateString('es-PE') : '-'}
                                                </td>
                                                <td style={{textAlign: 'right'}}>
                                                    <small>{row.moneda}</small> {parseFloat(row.total).toFixed(2)}
                                                </td>
                                                <td style={{textAlign: 'right', color: '#198754'}}>
                                                    <small>{row.moneda}</small> {parseFloat(row.monto_pagado).toFixed(2)}
                                                </td>
                                                <td style={{textAlign: 'right', fontWeight: 'bold', color: esVencido ? '#dc3545' : '#000'}}>
                                                    <small>{row.moneda}</small> {parseFloat(row.deuda_pendiente).toFixed(2)}
                                                </td>
                                                <td style={{textAlign: 'center'}}>
                                                    <span className={getBadgeStyle(row.dias_vencidos)}>
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
                                        <td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>
                                            No se encontraron deudas pendientes con los filtros seleccionados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

export default ReporteDeudasClientes;