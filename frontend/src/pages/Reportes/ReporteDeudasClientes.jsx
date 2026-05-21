import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../config/api';
import { 
    Search, User, DollarSign, AlertCircle, TrendingUp, 
    Calendar, FileText, BarChart3, PieChart,
    ExternalLink, Filter, Box
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    Legend, ResponsiveContainer, Cell
} from 'recharts';

const ReporteDeudasClientes = () => {
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

    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const res = await api.get('/clientes');
                if (res.data.success) setClientes(res.data.data);
            } catch (err) { console.error(err); }
        };
        fetchInitial();
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownClienteRef.current && !dropdownClienteRef.current.contains(e.target)) setMostrarDropdownCliente(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    const formatearNum = (v) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

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
            name: d.cliente.length > 15 ? d.cliente.substring(0, 15) + '..' : d.cliente,
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
                .page-reporte-cuentas .stat-card { min-height: 85px !important; display: flex !important; flex-direction: column !important; justify-content: center !important; padding: 0.75rem 1rem !important; border-radius: 8px !important; }
                .page-reporte-cuentas .table-gerencial th { 
                    background-color: var(--carbon-light); color: var(--wire); text-transform: uppercase; font-size: 0.6rem; letter-spacing: 0.1em; padding: 10px; border-bottom: 2px solid var(--steel);
                }
                .page-reporte-cuentas .table-gerencial td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.75rem; }
            `}} />

            <div className="mb-6">
                <h1 className="text-2xl font-black text-white tracking-tighter uppercase font-barlow flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                        <BarChart3 size={28} className="text-primary" />
                    </div>
                    Cuentas por Cobrar Gerencial
                </h1>
            </div>

            <div className="card mb-6 shadow-2xl">
                <div className="card-body p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                        <div className="form-group lg:col-span-2 relative" ref={dropdownClienteRef}>
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 block">Cliente</label>
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

                        <div className="form-group">
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 block">Desde</label>
                            <input type="date" name="fechaInicio" value={filtros.fechaInicio} onChange={handleChangeFiltro} className="form-input w-full" />
                        </div>
                        <div className="form-group">
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 block">Hasta</label>
                            <input type="date" name="fechaFin" value={filtros.fechaFin} onChange={handleChangeFiltro} className="form-input w-full" />
                        </div>

                        <div className="form-group">
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 block">Comprobante</label>
                            <select name="tipoComprobante" value={filtros.tipoComprobante} onChange={handleChangeFiltro} className="form-select w-full font-bold">
                                <option value="">Todos</option>
                                <option value="Factura">Factura</option>
                                <option value="Boleta">Boleta</option>
                                <option value="Nota de Venta">Nota de Venta</option>
                            </select>
                        </div>

                        <button onClick={generarReporte} disabled={loading} className="btn btn-primary h-[42px] font-black tracking-widest uppercase text-[10px] shadow-lg shadow-primary/20">
                            {loading ? 'BUSCANDO...' : 'GENERAR REPORTE'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 border-t border-white/5 pt-4">
                        <div className="form-group">
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 block">Estado SUNAT</label>
                            <select name="estadoSunat" value={filtros.estadoSunat} onChange={handleChangeFiltro} className="form-select w-full font-bold">
                                <option value="">Todos</option>
                                <option value="con_correlativo">Emitidos SUNAT</option>
                                <option value="sin_correlativo">Internos / Sin Correlativo</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 block">Filtro Rápido</label>
                            <div className="flex items-center h-[42px] px-4 bg-carbon-light border border-steel rounded">
                                <label className="flex items-center gap-2 cursor-pointer text-[10px] font-black text-mist uppercase tracking-widest w-full">
                                    <input type="checkbox" name="soloVencidas" checked={filtros.soloVencidas} onChange={handleChangeFiltro} className="w-4 h-4 rounded border-steel bg-carbon text-primary" />
                                    Mostrar solo documentos vencidos
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {reporteData && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                        <div className="card stat-card bg-carbon-mid border-l-4 border-success/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">FACTURAS (PEN)</p>
                            <p className="text-lg font-black text-white">S/ {formatearNum(reporteData.resumen.facturas_pen)}</p>
                        </div>
                        <div className="card stat-card bg-carbon-mid border-l-4 border-primary/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">FACTURAS (USD)</p>
                            <p className="text-lg font-black text-primary">$ {formatearNum(reporteData.resumen.facturas_usd)}</p>
                        </div>
                        <div className="card stat-card bg-carbon-mid border-l-4 border-info/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">N. VENTA (PEN)</p>
                            <p className="text-lg font-black text-white">S/ {formatearNum(reporteData.resumen.notas_venta_pen)}</p>
                        </div>
                        <div className="card stat-card bg-carbon-mid border-l-4 border-info/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">N. VENTA (USD)</p>
                            <p className="text-lg font-black text-white">$ {formatearNum(reporteData.resumen.notas_venta_usd)}</p>
                        </div>
                        <div className="card stat-card bg-carbon-mid border-l-4 border-warning/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">SIN COMPR. (PEN)</p>
                            <p className="text-lg font-black text-warning">S/ {formatearNum(reporteData.resumen.sin_comprobante_pen)}</p>
                        </div>
                        <div className="card stat-card bg-carbon-mid border-l-4 border-warning/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">SIN COMPR. (USD)</p>
                            <p className="text-lg font-black text-warning">$ {formatearNum(reporteData.resumen.sin_comprobante_usd)}</p>
                        </div>
                    </div>

                    <div className="card shadow-2xl mb-6">
                        <div className="card-header border-b border-white/5 py-3 px-5 flex justify-between items-center bg-carbon-light/20">
                            <h3 className="text-[0.7rem] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <FileText size={16} className="text-wire" /> Trazabilidad de Deuda
                            </h3>
                            <span className="text-[9px] font-black px-2 py-0.5 bg-primary/10 text-primary rounded uppercase">
                                {reporteData.resumen.indice_morosidad_pen}% MOROSIDAD (PEN)
                            </span>
                        </div>
                        <div className="card-body p-0 overflow-x-auto">
                            <table className="table-gerencial w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                    <tr>
                                        <th>Emisión / Venc.</th>
                                        <th>N° Orden</th>
                                        <th>Cliente</th>
                                        <th className="text-right">Total</th>
                                        <th className="text-right">Pendiente</th>
                                        <th className="text-center">Estado / Mora</th>
                                        <th className="text-right pr-6">Ver</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reporteData.detalle.map((row) => {
                                        const dias = parseInt(row.dias_vencidos);
                                        const esVencido = dias > 0;
                                        let badge = "bg-green-500/10 text-green-500 border-green-500/20";
                                        if (dias > 60) badge = "bg-red-600/10 text-red-600 border-red-600/20";
                                        else if (dias > 30) badge = "bg-orange-500/10 text-orange-500 border-orange-500/20";
                                        else if (dias > 0) badge = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";

                                        return (
                                            <tr key={row.id_orden_venta} className="hover:bg-white/[0.02] border-b border-white/[0.02]">
                                                <td>
                                                    <div className="font-bold text-white text-[11px]">{new Date(row.fecha_emision).toLocaleDateString('es-PE')}</div>
                                                    <div className={`text-[9px] font-bold ${esVencido ? 'text-red-400' : 'text-wire'}`}>Vence: {new Date(row.fecha_vencimiento).toLocaleDateString('es-PE')}</div>
                                                </td>
                                                <td>
                                                    <div className="font-bold text-primary">{row.numero_orden}</div>
                                                    <div className="text-[9px] text-wire uppercase font-black">{row.tipo_comprobante}</div>
                                                </td>
                                                <td>
                                                    <div className="font-bold text-mist text-[11px] truncate max-w-[180px]" title={row.cliente}>{row.cliente}</div>
                                                    <div className="text-[9px] text-wire uppercase">{row.estado}</div>
                                                </td>
                                                <td className="text-right font-mono text-[10px] text-wire">
                                                    {row.moneda} {formatearNum(row.total)}
                                                </td>
                                                <td className="text-right font-mono">
                                                    <div className="font-black text-white text-[11px]">{row.moneda} {formatearNum(row.deuda_pendiente)}</div>
                                                    <div className="text-[9px] text-green-500 font-bold">Cobrado: {parseFloat(row.monto_pagado).toFixed(2)}</div>
                                                </td>
                                                <td className="text-center">
                                                    <span className={`px-2 py-0.5 text-[9px] font-black border rounded ${badge}`}>
                                                        {esVencido ? `${dias} DÍAS MORA` : 'AL DÍA'}
                                                    </span>
                                                </td>
                                                <td className="text-right pr-6">
                                                    <Link to={`/ventas/ordenes/${row.id_orden_venta}`} target="_blank" className="p-1.5 hover:bg-primary/10 text-wire hover:text-primary transition-all inline-flex rounded-md border border-white/5">
                                                        <ExternalLink size={14} />
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="card border border-white/5 bg-carbon-mid overflow-hidden" style={{ minHeight: 320 }}>
                            <div className="card-header border-b border-white/5 py-3 px-5 flex items-center justify-center gap-2 bg-carbon-light/20">
                                <PieChart size={16} className="text-primary" />
                                <h3 className="text-[0.65rem] font-black text-white uppercase tracking-widest">Aging de Cartera (Soles)</h3>
                            </div>
                            <div className="card-body p-5">
                                <div style={{ width: '100%', height: 240 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={datosAging} layout="vertical" margin={{ left: 10, right: 30 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" stroke="#888" fontSize={9} width={75} />
                                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ backgroundColor: '#161616', border: '1px solid #333', fontSize: '10px' }} formatter={(v) => `S/ ${formatearNum(v)}`} />
                                            <Bar dataKey="monto" radius={[0, 4, 4, 0]}>
                                                {datosAging.map((e, i) => <Cell key={`cell-${i}`} fill={e.color} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="card border border-white/5 bg-carbon-mid overflow-hidden" style={{ minHeight: 320 }}>
                            <div className="card-header border-b border-white/5 py-3 px-5 flex items-center justify-center gap-2 bg-carbon-light/20">
                                <TrendingUp size={16} className="text-primary" />
                                <h3 className="text-[0.65rem] font-black text-white uppercase tracking-widest">Top 10 Deudores (Impacto PEN)</h3>
                            </div>
                            <div className="card-body p-5">
                                <div style={{ width: '100%', height: 240 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={datosTopDeudores} margin={{ bottom: 20 }}>
                                            <XAxis dataKey="name" stroke="#888" fontSize={8} angle={-35} textAnchor="end" interval={0} height={50} />
                                            <YAxis stroke="#888" fontSize={8} tickFormatter={(v) => `S/${Math.round(v/1000)}k`} />
                                            <Tooltip contentStyle={{ backgroundColor: '#161616', border: '1px solid #333', fontSize: '10px' }} formatter={(v) => `S/ ${formatearNum(v)}`} />
                                            <Bar dataKey="deuda" fill="#e8b84b" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReporteDeudasClientes;