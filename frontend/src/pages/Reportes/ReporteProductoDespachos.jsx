import React, { useState, useEffect } from 'react';
import { api } from '../../config/api';

const ReporteProductoDespachos = () => {
    const [productos, setProductos] = useState([]);
    const [filtros, setFiltros] = useState({
        idProducto: '',
        fechaInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        fechaFin: new Date().toISOString().split('T')[0]
    });
    
    const [loading, setLoading] = useState(false);
    const [reporteData, setReporteData] = useState(null);
    const [error, setError] = useState(null);

    // Cargar lista de productos para el select
    useEffect(() => {
        const fetchProductos = async () => {
            try {
                const response = await api.get('/productos');
                if (response.data.success) {
                    setProductos(response.data.data);
                }
            } catch (err) {
                console.error("Error cargando productos", err);
            }
        };
        fetchProductos();
    }, []);

    const handleChangeFiltro = (e) => {
        setFiltros({
            ...filtros,
            [e.target.name]: e.target.value
        });
    };

    const generarReporte = async () => {
        if (!filtros.idProducto) {
            setError("Debe seleccionar un producto.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/reportesventas/producto-despachos', { params: filtros });
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

    return (
        <div className="reportes-sire-container">
            <div className="header-actions">
                <h2>Historial de Despachos por Producto</h2>
            </div>

            <div className="filtros-container">
                <div className="filtro-grupo">
                    <label>Producto:</label>
                    <select 
                        name="idProducto" 
                        value={filtros.idProducto} 
                        onChange={handleChangeFiltro}
                        className="form-control"
                    >
                        <option value="">-- Seleccione un Producto --</option>
                        {productos.map(p => (
                            <option key={p.id_producto} value={p.id_producto}>
                                {p.codigo} - {p.nombre}
                            </option>
                        ))}
                    </select>
                </div>
                
                <div className="filtro-grupo">
                    <label>Fecha Inicio:</label>
                    <input 
                        type="date" 
                        name="fechaInicio" 
                        value={filtros.fechaInicio} 
                        onChange={handleChangeFiltro}
                        className="form-control"
                    />
                </div>

                <div className="filtro-grupo">
                    <label>Fecha Fin:</label>
                    <input 
                        type="date" 
                        name="fechaFin" 
                        value={filtros.fechaFin} 
                        onChange={handleChangeFiltro}
                        className="form-control"
                    />
                </div>

                <div className="filtro-grupo align-bottom">
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
                        <div className="kpi-card" style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #0d6efd', flex: 1 }}>
                            <h4>Unidades Despachadas</h4>
                            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                                {reporteData.resumen.total_cantidad}
                            </p>
                        </div>
                        <div className="kpi-card" style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #198754', flex: 1 }}>
                            <h4>Ingresos Totales (Soles)</h4>
                            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#198754' }}>
                                S/ {reporteData.resumen.total_ingresos_pen}
                            </p>
                        </div>
                        <div className="kpi-card" style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #198754', flex: 1 }}>
                            <h4>Ingresos Totales (Dólares)</h4>
                            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#198754' }}>
                                $ {reporteData.resumen.total_ingresos_usd}
                            </p>
                        </div>
                    </div>

                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fecha Emisión (Orden)</th>
                                    <th>Fecha Despacho</th>
                                    <th>N° Orden</th>
                                    <th>Cliente</th>
                                    <th style={{textAlign: 'right'}}>Cant. Despachada</th>
                                    <th style={{textAlign: 'right'}}>Precio Unit.</th>
                                    <th style={{textAlign: 'right'}}>Subtotal</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reporteData.detalle.length > 0 ? (
                                    reporteData.detalle.map((row, idx) => (
                                        <tr key={idx}>
                                            <td>{new Date(row.fecha_emision).toLocaleDateString('es-PE')}</td>
                                            <td>{row.fecha_despacho_real ? new Date(row.fecha_despacho_real).toLocaleDateString('es-PE') : 'Pendiente'}</td>
                                            <td><strong>{row.numero_orden}</strong></td>
                                            <td>{row.cliente}</td>
                                            <td style={{textAlign: 'right', fontWeight: 'bold'}}>{parseFloat(row.cantidad_despachada).toFixed(2)}</td>
                                            <td style={{textAlign: 'right'}}>
                                                {row.moneda === 'USD' ? '$' : 'S/'} {parseFloat(row.precio_unitario).toFixed(2)}
                                            </td>
                                            <td style={{textAlign: 'right', fontWeight: 'bold'}}>
                                                {row.moneda === 'USD' ? '$' : 'S/'} {parseFloat(row.subtotal_item).toFixed(2)}
                                            </td>
                                            <td>
                                                <span className={`badge ${row.estado === 'Entregada' ? 'bg-success' : 'bg-warning'}`}>
                                                    {row.estado}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="8" style={{ textAlign: 'center' }}>No se encontraron despachos para este producto en el rango de fechas.</td>
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

export default ReporteProductoDespachos;