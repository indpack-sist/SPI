import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../config/api';
import { 
    Search, User, DollarSign, AlertCircle, TrendingUp, 
    Calendar, FileText, BarChart3, PieChart,
    ExternalLink, Filter, Box, X, Coins, Clock, Zap
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
        moneda: '',
        tipoFecha: 'fecha_emision',
        fechaInicio: '',
        fechaFin: '',
        tipoComprobante: '',
        estadoSunat: '',
        soloVencidas: false
    });
    
    const [loading, setLoading] = useState(false);
    const [reporteData, setReporteData] = useState(null);
    const [error, setError] = useState(null);

    const [detalleExpandido, setDetalleExpandido] = useState({
        grupoKey: null, 
        chartType: null,
        titulo: '',
        data: []
    });

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
        setDetalleExpandido({ grupoKey: null, titulo: '', data: [] });
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

    const handleDrillDown = (entry, tipoGrafico, keyGrupo, tituloGrupo) => {
        if (!reporteData?.detalle) return;
        let ordenesFiltradas = [];
        let subTitulo = '';

        const detalleGrupo = reporteData.detalle.filter(item => {
            const moneda = item.moneda === 'USD' ? 'USD' : 'PEN';
            const tipo = String(item.tipo_comprobante || '').trim().toLowerCase();
            const tipoImpuesto = String(item.tipo_impuesto || '').toUpperCase().trim();
            const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(tipoImpuesto);
            const facturasExportacion = ['OV-2026-0380', 'OV-2026-0277', 'OV-2026-0162', 'OV-2026-0093'];

            let itemKey = '';
            if (tipo.includes('factura')) {
                itemKey = (!esSinImpuesto || facturasExportacion.includes(item.numero_orden)) ? `facturas${moneda}` : `notasVenta${moneda}`;
            } else if (tipo.includes('nota de venta')) {
                itemKey = `notasVenta${moneda}`;
            } else {
                itemKey = `sinCompr${moneda}`;
            }
            return itemKey === keyGrupo;
        });

        if (tipoGrafico === 'aging') {
            const label = entry.name;
            subTitulo = `${tituloGrupo} - Tramo: ${label}`;
            ordenesFiltradas = detalleGrupo.filter(item => {
                const dias = parseInt(item.dias_vencidos) || 0;
                if (label === 'Corriente') return dias <= 0;
                if (label === '0-30 días') return dias > 0 && dias <= 30;
                if (label === '31-60 días') return dias > 30 && dias <= 60;
                if (label === '61-90 días') return dias > 60 && dias <= 90;
                if (label === '+90 días') return dias > 90;
                return false;
            });
        } else {
            const nombreCliente = entry.name;
            subTitulo = `${tituloGrupo} - Cliente: ${entry.full_name || nombreCliente}`;
            ordenesFiltradas = detalleGrupo.filter(item => item.cliente === (entry.full_name || nombreCliente) || item.cliente.includes(nombreCliente));
        }

        if (ordenesFiltradas.length > 0) {
            setDetalleExpandido({ grupoKey: keyGrupo, titulo: subTitulo, data: ordenesFiltradas });
        }
    };

    const renderTablaAuditoria = () => (
        <div className="animate-in slide-in-from-top-4 fade-in duration-500 mt-6 border-t-2 border-primary/40 bg-carbon-dark rounded-b-2xl shadow-inner overflow-hidden col-span-1 lg:col-span-2" style={{ borderColor: 'rgba(232, 184, 75, 0.4)' }}>
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-carbon-light/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg shadow-inner">
                        <Zap size={20} className="text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">{detalleExpandido.titulo}</h3>
                        <p className="text-[9px] text-wire font-bold uppercase tracking-[0.2em]">Auditoría de documentos fuente</p>
                    </div>
                </div>
                <button 
                    onClick={() => setDetalleExpandido({ grupoKey: null, chartType: null, titulo: '', data: [] })}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#2a2a2a] hover:bg-red-500/30 border border-white/10 hover:border-red-500/50 text-wire hover:text-red-500 transition-all shadow-lg"
                    style={{ cursor: 'pointer' }}
                >
                    <X size={18} />
                </button>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar max-h-[400px]">
                <table className="table-gerencial w-full text-left border-collapse whitespace-nowrap">
                    <thead className="sticky top-0 z-10">
                        <tr>
                            <th className="pl-6 bg-carbon-light">Orden</th>
                            <th className="bg-carbon-light">Emisión / Venc.</th>
                            <th className="bg-carbon-light">Cliente</th>
                            <th className="text-right bg-carbon-light">Total Real</th>
                            <th className="text-right bg-carbon-light">Saldo Pendiente</th>
                            <th className="text-center bg-carbon-light">Mora</th>
                            <th className="text-right pr-6 bg-carbon-light">Auditar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {detalleExpandido.data.map(item => {
                            const dias = parseInt(item.dias_vencidos) || 0;
                            const esVencido = dias > 0;
                            let badge = "bg-green-500/15 text-green-400 border-green-500/30";
                            if (dias > 60) badge = "bg-red-600/15 text-red-400 border-red-600/30";
                            else if (dias > 30) badge = "bg-orange-500/15 text-orange-400 border-orange-500/30";
                            else if (dias > 0) badge = "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
                            
                            return (
                            <tr key={item.id_orden_venta} className="hover:bg-white/[0.04] border-b border-white/5 transition-colors">
                                <td className="pl-6 py-3">
                                    <div className="font-mono font-bold text-primary text-xs">{item.numero_orden}</div>
                                    <div className="text-[9px] text-wire uppercase font-black tracking-tight">{item.tipo_comprobante}</div>
                                </td>
                                <td className="py-3">
                                    <div className="text-xs text-white">{new Date(item.fecha_emision).toLocaleDateString('es-PE')}</div>
                                    <div className={`text-[9px] font-black ${esVencido ? 'text-red-400' : 'text-wire'}`}>Vence: {new Date(item.fecha_vencimiento).toLocaleDateString('es-PE')}</div>
                                </td>
                                <td className="text-xs text-mist font-bold truncate max-w-[200px] py-3" title={item.cliente}>{item.cliente}</td>
                                <td className="text-right font-mono font-bold text-wire text-xs py-3">{item.moneda} {formatearNum(item.total_real)}</td>
                                <td className="text-right font-mono py-3">
                                    <div className="font-black text-white text-xs">{item.moneda} {formatearNum(item.deuda_pendiente)}</div>
                                    <div className="text-[9px] text-green-500 font-black">Pagado: {parseFloat(item.monto_pagado).toFixed(2)}</div>
                                </td>
                                <td className="text-center py-3">
                                    <span className={`px-2 py-0.5 text-[9px] font-black border rounded-full ${badge}`}>
                                        {esVencido ? `${dias} DÍAS MORA` : 'AL DÍA'}
                                    </span>
                                </td>
                                <td className="text-right pr-6 py-3">
                                    <Link to={`/ventas/ordenes/${item.id_orden_venta}`} target="_blank" className="p-1.5 bg-[#222] border border-white/10 hover:border-primary/50 hover:bg-primary/20 text-primary transition-all inline-flex rounded-lg shadow-xl">
                                        <ExternalLink size={16} />
                                    </Link>
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>

            <div className="px-6 py-4 bg-carbon-light/40 border-t border-white/10 flex justify-between items-center">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Resumen de Selección</span>
                    <span className="text-[8px] text-wire font-bold uppercase tracking-[0.1em]">{detalleExpandido.data.length} registros componen este monto</span>
                </div>
            </div>
        </div>
    );

    const renderGrupoGraficos = (keyGrupo, tituloBase, color, moneda) => {
        const data = reporteData.resumen[keyGrupo];
        if (!data || parseFloat(data.total) <= 0) return null;
        const tituloTop = filtros.idCliente ? `Distribución de Deuda: ${busquedaCliente}` : "Top 5 Deudores Críticos";
        const isExpanded = detalleExpandido.grupoKey === keyGrupo;

        const DEUDORES_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

        const CustomTick = ({ x, y, payload }) => {
            const words = payload.value.split(' ');
            let lines = [];
            let currentLine = '';
            
            words.forEach(word => {
                if ((currentLine + word).length > 12) {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word + ' ';
                } else {
                    currentLine += word + ' ';
                }
            });
            if (currentLine) lines.push(currentLine.trim());

            return (
                <g transform={`translate(${x},${y})`}>
                    {lines.map((line, index) => (
                        <text 
                            key={index}
                            x={0} 
                            y={12 + index * 12} 
                            dy={16} 
                            textAnchor="middle" 
                            fill="#fff" 
                            fontSize={10} 
                            fontWeight="bold"
                        >
                            {line.length > 15 ? line.substring(0, 13) + '...' : line}
                        </text>
                    ))}
                </g>
            );
        };

        return (
            <div className="space-y-6 mt-12 pt-8 border-t border-white/10" key={keyGrupo}>
                <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent to-white/20"></div>
                    <h2 className="text-sm font-black text-white uppercase tracking-[0.4em] text-center px-8 py-3 bg-white/5 rounded-full border border-white/20 shadow-2xl">
                        {tituloBase}
                    </h2>
                    <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent to-white/20"></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Aging */}
                    <div className={`card border border-white/10 bg-carbon-mid shadow-2xl flex flex-col ${isExpanded && detalleExpandido.chartType === 'aging' ? 'ring-2 ring-primary/50' : ''}`}>
                        <div className="card-header border-b border-white/10 py-4 px-6 flex flex-col items-center justify-center gap-2 bg-carbon-light/20">
                            <PieChart size={20} style={{ color }} />
                            <h3 className="text-[0.75rem] font-black text-white uppercase tracking-[0.3em]">Antigüedad de Deuda (Aging)</h3>
                        </div>
                        <div className="card-body p-6 flex-1">
                            <div style={{ width: '100%', height: 320 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.aging} layout="vertical" margin={{ left: 30, right: 50, top: 10, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#444" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis 
                                            dataKey="name" 
                                            type="category" 
                                            stroke="#fff" 
                                            fontSize={13} 
                                            width={100} 
                                            tick={{ fontWeight: '900', fill: '#fff' }} 
                                        />
                                        <Tooltip 
                                            cursor={{ fill: 'rgba(255,255,255,0.08)' }} 
                                            contentStyle={{ backgroundColor: '#000', border: '2px solid #444', borderRadius: '12px', padding: '12px' }} 
                                            itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: '900' }}
                                            labelStyle={{ color: '#aaa', fontSize: '11px', marginBottom: '6px', fontWeight: 'bold' }}
                                            formatter={(v) => `${moneda === 'USD' ? '$' : 'S/'} ${formatearNum(v)}`} 
                                        />
                                        <Bar dataKey="monto" radius={[0, 6, 6, 0]} cursor="pointer">
                                            {data.aging.map((e, i) => (
                                                <Cell key={`cell-${i}`} fill={e.color} onClick={() => handleDrillDown(e, 'aging', keyGrupo, tituloBase)} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        {isExpanded && detalleExpandido.chartType === 'aging' && renderTablaAuditoria()}
                    </div>

                    {/* Top Deudores */}
                    <div className={`card border border-white/10 bg-carbon-mid shadow-2xl flex flex-col ${isExpanded && detalleExpandido.chartType === 'deudores' ? 'ring-2 ring-primary/50' : ''}`}>
                        <div className="card-header border-b border-white/10 py-4 px-6 flex flex-col items-center justify-center gap-2 bg-carbon-light/20">
                            <TrendingUp size={20} style={{ color }} />
                            <h3 className="text-[0.75rem] font-black text-white uppercase tracking-[0.3em]">{tituloTop}</h3>
                        </div>
                        <div className="card-body p-6 flex-1">
                            <div style={{ width: '100%', height: 320 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.topDeudores} margin={{ bottom: 50, top: 10, right: 30 }}>
                                        <XAxis 
                                            dataKey="name" 
                                            stroke="#fff" 
                                            fontSize={12} 
                                            angle={0} 
                                            textAnchor="middle" 
                                            interval={0} 
                                            height={70} 
                                            tick={{ fontWeight: '900', fill: '#fff' }}
                                            formatter={(val) => val.length > 15 ? val.substring(0, 12) + '...' : val}
                                        />
                                        <YAxis 
                                            stroke="#aaa" 
                                            fontSize={11} 
                                            tickFormatter={(v) => `${moneda === 'USD' ? '$' : 'S/'}${Math.round(v/1000)}k`} 
                                            tick={{ fontWeight: 'bold' }}
                                        />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#000', border: '2px solid #444', borderRadius: '12px', padding: '12px' }} 
                                            itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: '900' }}
                                            labelStyle={{ color: '#aaa', fontSize: '11px', marginBottom: '6px', fontWeight: 'bold' }}
                                            formatter={(v) => `${moneda === 'USD' ? '$' : 'S/'} ${formatearNum(v)}`} 
                                        />
                                        <Bar dataKey="deuda" fill={color} radius={[6, 6, 0, 0]} cursor="pointer">
                                            {data.topDeudores.map((e, i) => (
                                                <Cell key={`cell-${i}`} fill={color} onClick={() => handleDrillDown(e, 'deudores', keyGrupo, tituloBase)} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        {isExpanded && detalleExpandido.chartType === 'deudores' && renderTablaAuditoria()}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6 page-reporte-cuentas bg-carbon text-mist min-h-screen">
            <style dangerouslySetInnerHTML={{__html: `
                .page-reporte-cuentas .card { background-color: var(--carbon-mid); border: 1px solid rgba(255,255,255,0.08); }
                .page-reporte-cuentas .form-input, .page-reporte-cuentas .form-select {
                    background-color: var(--carbon-light) !important; border: 1px solid var(--steel) !important; color: white !important; height: 46px !important; font-size: 0.85rem !important; font-weight: 700 !important;
                }
                .page-reporte-cuentas .stat-card { min-height: 95px !important; display: flex !important; flex-direction: column !important; justify-content: center !important; padding: 0.75rem 1.25rem !important; border-radius: 12px !important; transition: all 0.3s; border-top: 1px solid rgba(255,255,255,0.08); shadow: 0 20px 25px -5px rgba(0,0,0,0.2); }
                .page-reporte-cuentas .stat-card:hover { transform: translateY(-4px); background-color: var(--carbon-light); }
                .page-reporte-cuentas .table-gerencial th { 
                    background-color: var(--carbon-light); color: var(--wire); text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.15em; padding: 14px; border-bottom: 2px solid var(--steel); font-weight: 900;
                }
                .page-reporte-cuentas .table-gerencial td { padding: 14px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 0.85rem; font-weight: 600; }
                .dropdown-menu-solido-absoluto { background-color: #000000 !important; border: 2px solid #444 !important; opacity: 1 !important; visibility: visible !important; z-index: 99999 !important; }
            `}} />

            <div className="mb-8 flex flex-col">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase font-barlow flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-2xl shadow-inner">
                        <BarChart3 size={32} className="text-primary" />
                    </div>
                    Reporte Gerencial x Cobrar
                </h1>
                <p className="text-wire text-[0.75rem] uppercase tracking-[0.4em] mt-3 font-black">Inteligencia de Cartera y Auditoría de Mora</p>
            </div>

            <div className="card mb-8 shadow-2xl border-t-2 border-primary/30">
                <div className="card-body p-6 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="form-group lg:col-span-1 relative" ref={dropdownClienteRef}>
                            <label className="text-[0.65rem] font-black text-wire uppercase tracking-widest mb-2 flex items-center gap-2"><User size={12}/> Cliente</label>
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-wire" />
                                <input
                                    type="text"
                                    className="form-input w-full"
                                    style={{ paddingLeft: '3rem' }}
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
                                    <div className="absolute z-[100] left-0 right-0 top-full mt-2 dropdown-menu-solido border-2 border-steel rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] max-h-72 overflow-y-auto p-2" style={{ backgroundColor: '#111111' }}>
                                        {clientesFiltrados.length > 0 ? (
                                            clientesFiltrados.map(c => (
                                                <div key={c.id_cliente} onClick={() => handleSelectCliente(c)} className="p-3.5 hover:bg-steel/40 cursor-pointer rounded-lg transition-all border-b border-white/5 last:border-0 mb-1">
                                                    <p className="font-black text-sm text-white uppercase tracking-tight">{c.razon_social}</p>
                                                    <p className="text-[10px] text-primary uppercase font-black tracking-widest mt-1">RUC: {c.ruc}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-wire text-xs font-black uppercase tracking-widest">Sin resultados</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="text-[0.65rem] font-black text-wire uppercase tracking-widest mb-2 flex items-center gap-2"><Coins size={12}/> Moneda</label>
                            <select name="moneda" value={filtros.moneda} onChange={handleChangeFiltro} className="form-select w-full font-bold">
                                <option value="">Todas las Monedas</option>
                                <option value="PEN">Soles (PEN)</option>
                                <option value="USD">Dólares (USD)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="text-[0.65rem] font-black text-wire uppercase tracking-widest mb-2 flex items-center gap-2"><FileText size={12}/> Comprobante</label>
                            <select name="tipoComprobante" value={filtros.tipoComprobante} onChange={handleChangeFiltro} className="form-select w-full font-bold">
                                <option value="">Todos los Tipos</option>
                                <option value="Factura">Factura</option>
                                <option value="Boleta">Boleta</option>
                                <option value="Nota de Venta">Nota de Venta</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="text-[0.65rem] font-black text-wire uppercase tracking-widest mb-2 flex items-center gap-2"><Box size={12}/> Estado SUNAT</label>
                            <select name="estadoSunat" value={filtros.estadoSunat} onChange={handleChangeFiltro} className="form-select w-full font-bold">
                                <option value="">Todos (SUNAT e Internos)</option>
                                <option value="con_correlativo">Solo con Correlativo SUNAT</option>
                                <option value="sin_correlativo">Solo Internos / Pendientes</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="form-group">
                            <label className="text-[0.65rem] font-black text-wire uppercase tracking-widest mb-2 flex items-center gap-2"><Clock size={12}/> Tipo de Fecha</label>
                            <select name="tipoFecha" value={filtros.tipoFecha} onChange={handleChangeFiltro} className="form-select w-full font-bold">
                                <option value="fecha_emision">Fecha de Emisión (Orden)</option>
                                <option value="fecha_sunat">Fecha de Facturación SUNAT</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="text-[0.65rem] font-black text-wire uppercase tracking-widest mb-2 block">Desde</label>
                            <input type="date" name="fechaInicio" value={filtros.fechaInicio} onChange={handleChangeFiltro} className="form-input w-full" />
                        </div>
                        <div className="form-group">
                            <label className="text-[0.65rem] font-black text-wire uppercase tracking-widest mb-2 block">Hasta</label>
                            <input type="date" name="fechaFin" value={filtros.fechaFin} onChange={handleChangeFiltro} className="form-input w-full" />
                        </div>
                        <div className="form-group">
                            <label className="text-[0.65rem] font-black text-wire uppercase tracking-widest mb-2 block">Acción</label>
                            <button onClick={generarReporte} disabled={loading} className="btn btn-primary w-full h-[46px] font-black tracking-widest uppercase text-[11px] shadow-2xl shadow-primary/30 flex items-center justify-center gap-2 transition-all active:scale-95 border-none">
                                <TrendingUp size={16}/> {loading ? 'PROCESANDO...' : 'GENERAR REPORTE'}
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                        <label className="flex items-center gap-4 cursor-pointer group">
                            <div className="relative flex items-center justify-center">
                                <input type="checkbox" name="soloVencidas" checked={filtros.soloVencidas} onChange={handleChangeFiltro} className="w-6 h-6 rounded-lg border-steel bg-carbon text-primary focus:ring-primary shadow-inner" />
                            </div>
                            <span className="text-[11px] font-black text-mist uppercase tracking-widest group-hover:text-white transition-colors">
                                Filtrar exclusivamente documentos con fecha de vencimiento superada (MORA)
                            </span>
                        </label>
                    </div>
                </div>
            </div>

            {reporteData && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                        <div className="card stat-card border-l-4 border-success/60 shadow-2xl">
                            <p className="text-[0.55rem] font-black text-wire uppercase tracking-[0.2em] mb-1">FACTURAS (PEN)</p>
                            <p className="text-xl font-black text-white">S/ {formatearNum(reporteData.resumen.facturasPEN.total)}</p>
                        </div>
                        <div className="card stat-card border-l-4 border-primary/60 shadow-2xl">
                            <p className="text-[0.55rem] font-black text-wire uppercase tracking-[0.2em] mb-1">FACTURAS (USD)</p>
                            <p className="text-xl font-black text-primary">$ {formatearNum(reporteData.resumen.facturasUSD.total)}</p>
                        </div>
                        <div className="card stat-card border-l-4 border-[#3B82F6]/60 shadow-2xl">
                            <p className="text-[0.55rem] font-black text-wire uppercase tracking-[0.2em] mb-1">N. VENTA (PEN)</p>
                            <p className="text-xl font-black text-white">S/ {formatearNum(reporteData.resumen.notasVentaPEN.total)}</p>
                        </div>
                        <div className="card stat-card border-l-4 border-[#60A5FA]/60 shadow-2xl">
                            <p className="text-[0.55rem] font-black text-wire uppercase tracking-[0.2em] mb-1">N. VENTA (USD)</p>
                            <p className="text-xl font-black text-white">$ {formatearNum(reporteData.resumen.notasVentaUSD.total)}</p>
                        </div>
                        <div className="card stat-card border-l-4 border-[#F59E0B]/60 shadow-2xl">
                            <p className="text-[0.55rem] font-black text-wire uppercase tracking-[0.2em] mb-1">SIN COMPR. (PEN)</p>
                            <p className="text-xl font-black text-white">S/ {formatearNum(reporteData.resumen.sinComprPEN.total)}</p>
                        </div>
                        <div className="card stat-card border-l-4 border-[#FCD34D]/60 shadow-2xl">
                            <p className="text-[0.55rem] font-black text-wire uppercase tracking-[0.2em] mb-1">SIN COMPR. (USD)</p>
                            <p className="text-xl font-black text-white">$ {formatearNum(reporteData.resumen.sinComprUSD.total)}</p>
                        </div>
                    </div>

                    <div className="space-y-20 pb-32 mt-12">
                        {renderGrupoGraficos('facturasPEN', 'Análisis: Facturas (PEN)', '#10B981', 'PEN')}
                        {renderGrupoGraficos('facturasUSD', 'Análisis: Facturas (USD)', '#e8b84b', 'USD')}
                        {renderGrupoGraficos('notasVentaPEN', 'Análisis: N. Venta (PEN)', '#3B82F6', 'PEN')}
                        {renderGrupoGraficos('notasVentaUSD', 'Análisis: N. Venta (USD)', '#60A5FA', 'USD')}
                        {renderGrupoGraficos('sinComprPEN', 'Análisis: Sin Compr. (PEN)', '#F59E0B', 'PEN')}
                        {renderGrupoGraficos('sinComprUSD', 'Análisis: Sin Compr. (USD)', '#FCD34D', 'USD')}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReporteDeudasClientes;