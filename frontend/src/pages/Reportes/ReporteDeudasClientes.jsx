import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../config/api';
import { 
    Search, User, DollarSign, AlertCircle, TrendingUp, 
    Calendar, FileText, ChevronRight, BarChart3, PieChart,
    ExternalLink, Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    Legend, ResponsiveContainer, Cell
} from 'recharts';

const ReporteDeudasClientes = () => {
    // Estados para filtros y búsqueda
    const [clientes, setClientes] = useState([]);
    const [busquedaCliente, setBusquedaCliente] = useState('');
    const [mostrarDropdownCliente, setMostrarDropdownCliente] = useState(false);
    const dropdownClienteRef = useRef(null);

    const [filtros, setFiltros] = useState({
        idCliente: '',
        soloVencidas: false,
        tipoComprobante: '',
        estadoSunat: '',
        fechaInicio: '',
        fechaFin: ''
    });
    
    const [loading, setLoading] = useState(false);
    const [reporteData, setReporteData] = useState(null);
    const [error, setError] = useState(null);

    // Cargar clientes iniciales
    useEffect(() => {
        const fetchClientes = async () => {
            try {
                const response = await api.get('/clientes');
                if (response.data.success) setClientes(response.data.data);
            } catch (err) { console.error("Error cargando clientes", err); }
        };
        fetchClientes();
    }, []);

    // Clic fuera para cerrar dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownClienteRef.current && !dropdownClienteRef.current.contains(event.target)) {
                setMostrarDropdownCliente(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Buscador optimizado
    const clientesFiltrados = useMemo(() => {
        if (!busquedaCliente) return [];
        const term = busquedaCliente.toLowerCase();
        return clientes.filter(c => 
            c.razon_social.toLowerCase().includes(term) || (c.ruc && c.ruc.includes(term))
        ).slice(0, 50);
    }, [clientes, busquedaCliente]);

    const handleSelectCliente = (cliente) => {
        setFiltros({ ...filtros, idCliente: cliente.id_cliente });
        setBusquedaCliente(cliente.razon_social);
        setMostrarDropdownCliente(false);
    };

    const handleChangeFiltro = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFiltros({ ...filtros, [e.target.name]: value });
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
            setError(err.response?.data?.error || "Error de conexión.");
        } finally {
            setLoading(false);
        }
    };

    const formatearMonto = (monto, moneda) => {
        const simbolo = moneda === 'USD' ? '$' : 'S/';
        return `${simbolo} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(monto)}`;
    };

    // --- Preparación de Datos para Gráficos ---
    const datosAging = useMemo(() => {
        if (!reporteData?.aging) return [];
        const a = reporteData.aging.pen;
        return [
            { name: 'Corriente', monto: parseFloat(a.corriente), color: '#10B981' },
            { name: '0-30 días', monto: parseFloat(a.m_0_30), color: '#FBBF24' },
            { name: '31-60 días', monto: parseFloat(a.m_31_60), color: '#F59E0B' },
            { name: '61-90 días', monto: parseFloat(a.m_61_90), color: '#EF4444' },
            { name: '+90 días', monto: parseFloat(a.m_90_mas), color: '#7F1D1D' },
        ];
    }, [reporteData]);

    const datosTopDeudores = useMemo(() => {
        if (!reporteData?.topDeudores) return [];
        return reporteData.topDeudores.map(d => ({
            name: d.cliente.length > 20 ? d.cliente.substring(0, 20) + '...' : d.cliente,
            full_name: d.cliente,
            deuda: parseFloat(d.deudaPEN)
        }));
    }, [reporteData]);

    return (
        <div className="p-4 md:p-6 page-reporte-cuentas bg-carbon text-mist">
            <style dangerouslySetInnerHTML={{__html: `
                .page-reporte-cuentas .card { background-color: var(--carbon-mid); border: 1px solid rgba(255,255,255,0.05); }
                .page-reporte-cuentas .form-input, .page-reporte-cuentas .form-select {
                    background-color: var(--carbon-light) !important; border: 1px solid var(--steel) !important; color: white !important; height: 42px !important; font-size: 0.75rem !important;
                }
                .page-reporte-cuentas .table-gerencial th { 
                    background-color: var(--carbon-light); color: var(--wire); text-transform: uppercase; font-size: 0.6rem; letter-spacing: 0.1em; padding: 10px; border-bottom: 2px solid var(--steel);
                }
                .page-reporte-cuentas .table-gerencial td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.75rem; }
                .page-reporte-cuentas .kpi-card { border-left-width: 4px; transition: transform 0.2s; }
                .page-reporte-cuentas .kpi-card:hover { transform: translateY(-2px); }
            `}} />

            {/* Cabecera */}
            <div className="mb-6">
                <h1 className="text-2xl font-black text-white tracking-tighter uppercase font-barlow flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                        <BarChart3 size={28} className="text-primary" />
                    </div>
                    Cuentas por Cobrar Gerencial
                </h1>
                <p className="text-wire text-[0.65rem] uppercase tracking-[0.3em] mt-1 font-bold">
                    Control de Riesgo, Aging y Morosidad Consolidada
                </p>
            </div>

            {/* Filtros Inteligentes (Conjuntos) */}
            <div className="card mb-6 shadow-2xl">
                <div className="card-header border-b border-white/5 py-3 px-5 flex items-center gap-2">
                    <Filter size={14} className="text-primary" />
                    <span className="text-[0.65rem] font-black text-white uppercase tracking-widest">Filtros de Análisis</span>
                </div>
                <div className="card-body p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                        {/* Cliente */}
                        <div className="form-group lg:col-span-2 relative" ref={dropdownClienteRef}>
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 block">Filtrar Cliente</label>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-wire" />
                                <input
                                    type="text"
                                    className="form-input pl-10 w-full"
                                    placeholder="RUC o Razón Social..."
                                    value={busquedaCliente}
                                    onChange={(e) => {
                                        setBusquedaCliente(e.target.value);
                                        setMostrarDropdownCliente(true);
                                        if (!e.target.value) setFiltros({ ...filtros, idCliente: '' });
                                    }}
                                    onFocus={() => setMostrarDropdownCliente(true)}
                                />
                                {mostrarDropdownCliente && busquedaCliente && (
                                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-carbon-light border border-steel rounded-lg shadow-2xl max-h-60 overflow-y-auto p-1">
                                        {clientesFiltrados.length > 0 ? (
                                            clientesFiltrados.map(c => (
                                                <div key={c.id_cliente} onClick={() => handleSelectCliente(c)} className="p-2.5 hover:bg-steel/30 cursor-pointer rounded transition-colors border-b border-white/5 last:border-0">
                                                    <p className="font-bold text-xs text-white">{c.razon_social}</p>
                                                    <p className="text-[9px] text-wire uppercase font-black tracking-tighter">RUC: {c.ruc}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-3 text-center text-wire text-[10px]">Sin resultados</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Rango de Fechas */}
                        <div className="form-group">
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 block">Emisión Desde</label>
                            <input type="date" name="fechaInicio" value={filtros.fechaInicio} onChange={handleChangeFiltro} className="form-input w-full" />
                        </div>
                        <div className="form-group">
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 block">Emisión Hasta</label>
                            <input type="date" name="fechaFin" value={filtros.fechaFin} onChange={handleChangeFiltro} className="form-input w-full" />
                        </div>

                        {/* Documento */}
                        <div className="form-group">
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 block">Comprobante</label>
                            <select name="tipoComprobante" value={filtros.tipoComprobante} onChange={handleChangeFiltro} className="form-select w-full font-bold">
                                <option value="">Todos</option>
                                <option value="Factura">Factura</option>
                                <option value="Boleta">Boleta</option>
                                <option value="Nota de Venta">Nota de Venta</option>
                            </select>
                        </div>

                        {/* Botón Principal */}
                        <button onClick={generarReporte} disabled={loading} className="btn btn-primary h-[42px] font-black tracking-widest uppercase text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95">
                            {loading ? 'ANALIZANDO...' : 'GENERAR REPORTE'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 border-t border-white/5 pt-4">
                        {/* Estado SUNAT */}
                        <div className="form-group">
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 block">Estado Administrativo / SUNAT</label>
                            <select name="estadoSunat" value={filtros.estadoSunat} onChange={handleChangeFiltro} className="form-select w-full font-bold">
                                <option value="">-- Todos los estados --</option>
                                <option value="con_correlativo">Emitidos con Correlativo (SUNAT)</option>
                                <option value="sin_correlativo">Pendientes / Intención de Venta</option>
                            </select>
                        </div>

                        {/* Checkbox */}
                        <div className="form-group">
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 block">Filtro Rápido</label>
                            <div className="flex items-center h-[42px] px-4 bg-carbon-light border border-steel rounded">
                                <label className="flex items-center gap-2 cursor-pointer text-[10px] font-black text-mist uppercase tracking-widest w-full">
                                    <input 
                                        type="checkbox" 
                                        name="soloVencidas" 
                                        checked={filtros.soloVencidas} 
                                        onChange={handleChangeFiltro}
                                        className="w-4 h-4 rounded border-steel bg-carbon text-primary focus:ring-primary"
                                    />
                                    Mostrar SOLO documentos vencidos
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border-l-4 border-red-500 p-4 mb-6 rounded flex items-center gap-3">
                    <AlertCircle size={20} className="text-red-500" />
                    <p className="text-red-500 font-bold text-xs">{error}</p>
                </div>
            )}

            {reporteData && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    
                    {/* KPIs Panel */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="card kpi-card border-l-primary/50">
                            <div className="card-body py-4 px-5">
                                <p className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1">Cartera Total (PEN)</p>
                                <h2 className="text-xl font-black text-white">{formatearMonto(reporteData.resumen.deuda_total_pen, 'PEN')}</h2>
                                <span className="mt-2 inline-block px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black rounded-full border border-primary/20">
                                    MOROSIDAD: {reporteData.resumen.indice_morosidad_pen}%
                                </span>
                            </div>
                        </div>

                        <div className="card kpi-card border-l-red-500/50">
                            <div className="card-body py-4 px-5">
                                <p className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1">Vencido (PEN)</p>
                                <h2 className="text-xl font-black text-red-500">{formatearMonto(reporteData.resumen.deuda_vencida_pen, 'PEN')}</h2>
                                <p className="text-[8px] text-wire font-bold mt-1 uppercase">Sano: {formatearMonto(reporteData.resumen.deuda_corriente_pen, 'PEN')}</p>
                            </div>
                        </div>

                        <div className="card kpi-card border-l-green-500/50">
                            <div className="card-body py-4 px-5">
                                <p className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1">Cartera Total (USD)</p>
                                <h2 className="text-xl font-black text-white">{formatearMonto(reporteData.resumen.deuda_total_usd, 'USD')}</h2>
                                <span className="mt-2 inline-block px-2 py-0.5 bg-green-500/10 text-green-500 text-[9px] font-black rounded-full border border-green-500/20">
                                    MOROSIDAD: {reporteData.resumen.indice_morosidad_usd}%
                                </span>
                            </div>
                        </div>

                        <div className="card kpi-card border-l-orange-500/50">
                            <div className="card-body py-4 px-5">
                                <p className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1">Vencido (USD)</p>
                                <h2 className="text-xl font-black text-orange-500">{formatearMonto(reporteData.resumen.deuda_vencida_usd, 'USD')}</h2>
                                <p className="text-[8px] text-wire font-bold mt-1 uppercase">Sano: {formatearMonto(reporteData.resumen.deuda_corriente_usd, 'USD')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Gráficos Panel */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <div className="card shadow-xl overflow-hidden border border-white/5">
                            <div className="card-header border-b border-white/5 py-3 px-5 flex items-center justify-center gap-2 bg-carbon-light/20">
                                <PieChart size={16} className="text-primary" />
                                <h3 className="text-[0.65rem] font-black text-white uppercase tracking-widest">Aging de Cartera (Soles)</h3>
                            </div>
                            <div className="card-body p-5">
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={datosAging} layout="vertical" margin={{ left: 10, right: 30 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" stroke="#888" fontSize={9} width={75} />
                                            <Tooltip 
                                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                                contentStyle={{ backgroundColor: '#161616', border: '1px solid #333', borderRadius: '4px', fontSize: '10px' }}
                                                formatter={(value) => `S/ ${new Intl.NumberFormat().format(value)}`}
                                            />
                                            <Bar dataKey="monto" radius={[0, 4, 4, 0]}>
                                                {datosAging.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="card shadow-xl overflow-hidden border border-white/5">
                            <div className="card-header border-b border-white/5 py-3 px-5 flex items-center justify-center gap-2 bg-carbon-light/20">
                                <TrendingUp size={16} className="text-primary" />
                                <h3 className="text-[0.65rem] font-black text-white uppercase tracking-widest">Top 10 Deudores (Impacto PEN)</h3>
                            </div>
                            <div className="card-body p-5">
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={datosTopDeudores} margin={{ bottom: 20 }}>
                                            <XAxis dataKey="name" stroke="#888" fontSize={8} angle={-35} textAnchor="end" interval={0} height={50} />
                                            <YAxis stroke="#888" fontSize={8} tickFormatter={(val) => `S/${val/1000}k`} />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#161616', border: '1px solid #333', borderRadius: '4px', fontSize: '10px' }}
                                                formatter={(value) => `S/ ${new Intl.NumberFormat().format(value)}`}
                                            />
                                            <Bar dataKey="deuda" fill="#e8b84b" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabla Detallada */}
                    <div className="card shadow-2xl">
                        <div className="card-header border-b border-white/5 py-3 px-5 flex justify-between items-center bg-carbon-light/20">
                            <div className="flex items-center gap-2">
                                <FileText size={16} className="text-wire" />
                                <h3 className="text-[0.7rem] font-black text-white uppercase tracking-widest">Trazabilidad de Deuda Pendiente</h3>
                            </div>
                            <span className="text-[9px] font-black px-2 py-0.5 bg-white/5 rounded text-wire uppercase tracking-[0.2em]">
                                {reporteData.detalle.length} movs
                            </span>
                        </div>
                        
                        <div className="card-body p-0 overflow-x-auto">
                            <table className="table-gerencial w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                    <tr>
                                        <th>Emisión / Venc.</th>
                                        <th>N° Orden / Comprobante</th>
                                        <th>Cliente</th>
                                        <th className="text-right">Total</th>
                                        <th className="text-right">Pendiente</th>
                                        <th className="text-center">Antigüedad</th>
                                        <th className="text-right pr-6">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reporteData.detalle.length > 0 ? (
                                        reporteData.detalle.map((row) => {
                                            const dias = parseInt(row.dias_vencidos);
                                            const esVencido = dias > 0;
                                            
                                            let badgeColor = "bg-green-500/10 text-green-500 border-green-500/20";
                                            if (dias > 60) badgeColor = "bg-red-600/10 text-red-600 border-red-600/20";
                                            else if (dias > 30) badgeColor = "bg-orange-500/10 text-orange-500 border-orange-500/20";
                                            else if (dias > 0) badgeColor = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";

                                            return (
                                                <tr key={row.id_orden_venta} className="hover:bg-white/[0.02] transition-colors border-b border-white/[0.02] last:border-0">
                                                    <td>
                                                        <div className="font-bold text-white mb-0.5">{new Date(row.fecha_emision).toLocaleDateString('es-PE')}</div>
                                                        <div className={`text-[9px] flex items-center gap-1 font-bold ${esVencido ? 'text-red-400' : 'text-wire'}`}>
                                                            Vence: {new Date(row.fecha_vencimiento).toLocaleDateString('es-PE')}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="font-bold text-primary flex items-center gap-1">
                                                            {row.numero_orden}
                                                            {row.numero_comprobante_sunat && (
                                                                <span className="text-[9px] text-wire font-normal">({row.numero_comprobante_sunat})</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[9px] text-wire uppercase font-black tracking-widest">{row.tipo_comprobante}</div>
                                                    </td>
                                                    <td>
                                                        <div className="font-bold text-mist truncate max-w-[200px]" title={row.cliente}>{row.cliente}</div>
                                                        <div className="text-[9px] text-wire font-medium">Tlf: {row.telefono_cliente || 'N/A'}</div>
                                                    </td>
                                                    <td className="text-right font-mono text-[10px]">
                                                        <span className="text-wire mr-1">{row.moneda}</span>
                                                        {parseFloat(row.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="text-right font-mono">
                                                        <div className="font-black text-white text-xs">
                                                            <span className="text-wire mr-1 font-normal">{row.moneda}</span>
                                                            {parseFloat(row.deuda_pendiente).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </div>
                                                        <div className="text-[9px] text-green-500 font-bold">Cobrado: {parseFloat(row.monto_pagado).toFixed(2)}</div>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded ${badgeColor}`}>
                                                            {esVencido ? `${dias} DÍAS MORA` : 'AL DÍA'}
                                                        </span>
                                                    </td>
                                                    <td className="text-right pr-6">
                                                        <Link 
                                                            to={`/ventas/ordenes/${row.id_orden_venta}`}
                                                            target="_blank"
                                                            className="p-1.5 hover:bg-primary/10 text-wire hover:text-primary transition-all inline-flex rounded-md border border-transparent hover:border-primary/20"
                                                            title="Ver Detalle de Orden"
                                                        >
                                                            <ExternalLink size={14} />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="text-center py-12 text-wire text-[10px] uppercase font-black tracking-widest">
                                                No se encontraron resultados con los filtros aplicados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReporteDeudasClientes;