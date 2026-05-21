import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../config/api';
import { 
    Search, User, DollarSign, AlertCircle, TrendingUp, 
    Calendar, FileText, BarChart3, PieChart,
    ExternalLink, Filter, Box, X, Coins, Clock
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

    const [modalDrillDown, setModalDrillDown] = useState({
        show: false,
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
            const tipoImpuesto = String(item.tipo_impuesto || '').toUpperCase().trim();
            const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(tipoImpuesto);
            const tipo = String(item.tipo_comprobante || '').trim();
            const facturasExportacion = ['OV-2026-0380', 'OV-2026-0277', 'OV-2026-0162', 'OV-2026-0093'];

            let itemKey = '';
            if (tipo.includes('Factura')) {
                itemKey = (!esSinImpuesto || facturasExportacion.includes(item.numero_orden)) ? `facturas${moneda}` : `notasVenta${moneda}`;
            } else if (tipo.includes('Nota de Venta')) {
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
            setModalDrillDown({ show: true, titulo: subTitulo, data: ordenesFiltradas });
        }
    };

    const renderGrupoGraficos = (keyGrupo, tituloBase, color, moneda) => {
        const data = reporteData.resumen[keyGrupo];
        if (!data || parseFloat(data.total) <= 0) return null;
        const tituloTop = filtros.idCliente ? `Distribución de Deuda: ${busquedaCliente}` : "Top 5 Deudores Críticos";

        return (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500 mt-8 pt-8 border-t border-white/5">
                <div className="flex items-center justify-center gap-3 mb-2">
                    <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent to-white/10"></div>
                    <h2 className="text-xs font-black text-white uppercase tracking-[0.4em] text-center px-6 py-2.5 bg-white/5 rounded-full border border-white/10">
                        {tituloBase}
                    </h2>
                    <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent to-white/10"></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="card border border-white/5 bg-carbon-mid overflow-hidden shadow-2xl">
                        <div className="card-header border-b border-white/5 py-3 px-5 flex flex-col items-center justify-center gap-1 bg-carbon-light/20">
                            <PieChart size={18} style={{ color }} />
                            <h3 className="text-[0.6rem] font-black text-white uppercase tracking-[0.2em]">Antigüedad de Deuda (Aging)</h3>
                        </div>
                        <div className="card-body p-5">
                            <div style={{ width: '100%', height: 240 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.aging} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" stroke="#fff" fontSize={10} width={85} tick={{ fontWeight: 'bold' }} />
                                        <Tooltip 
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                                            contentStyle={{ backgroundColor: '#111', border: '1px solid #444', borderRadius: '8px' }} 
                                            itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                                            formatter={(v) => `${moneda === 'USD' ? '$' : 'S/'} ${formatearNum(v)}`} 
                                        />
                                        <Bar dataKey="monto" radius={[0, 4, 4, 0]} cursor="pointer">
                                            {data.aging.map((e, i) => <Cell key={`cell-${i}`} fill={e.color} onClick={() => handleDrillDown(e, 'aging', keyGrupo, tituloBase)} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                    <div className="card border border-white/5 bg-carbon-mid overflow-hidden shadow-2xl">
                        <div className="card-header border-b border-white/5 py-3 px-5 flex flex-col items-center justify-center gap-1 bg-carbon-light/20">
                            <TrendingUp size={18} style={{ color }} />
                            <h3 className="text-[0.6rem] font-black text-white uppercase tracking-[0.2em]">{tituloTop}</h3>
                        </div>
                        <div className="card-body p-5">
                            <div style={{ width: '100%', height: 240 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.topDeudores} margin={{ bottom: 30, top: 10, right: 20 }}>
                                        <XAxis dataKey="name" stroke="#fff" fontSize={10} angle={-25} textAnchor="end" interval={0} height={60} tick={{ fontWeight: 'bold' }} />
                                        <YAxis stroke="#888" fontSize={9} tickFormatter={(v) => `${moneda === 'USD' ? '$' : 'S/'}${Math.round(v/1000)}k`} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#111', border: '1px solid #444', borderRadius: '8px' }} 
                                            itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                                            formatter={(v) => `${moneda === 'USD' ? '$' : 'S/'} ${formatearNum(v)}`} 
                                        />
                                        <Bar dataKey="deuda" fill={color} radius={[4, 4, 0, 0]} cursor="pointer">
                                            {data.topDeudores.map((e, i) => <Cell key={`cell-${i}`} fill={color} onClick={() => handleDrillDown(e, 'deudores', keyGrupo, tituloBase)} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6 page-reporte-cuentas bg-carbon text-mist min-h-screen">
            <style dangerouslySetInnerHTML={{__html: `
                .page-reporte-cuentas .card { background-color: var(--carbon-mid); border: 1px solid rgba(255,255,255,0.05); }
                .page-reporte-cuentas .form-input, .page-reporte-cuentas .form-select {
                    background-color: var(--carbon-light) !important; border: 1px solid var(--steel) !important; color: white !important; height: 42px !important; font-size: 0.75rem !important;
                }
                .page-reporte-cuentas .stat-card { min-height: 85px !important; display: flex !important; flex-direction: column !important; justify-content: center !important; padding: 0.75rem 1rem !important; border-radius: 8px !important; transition: all 0.3s; border-top: 1px solid rgba(255,255,255,0.05); }
                .page-reporte-cuentas .stat-card:hover { transform: translateY(-3px); background-color: var(--carbon-light); }
                .page-reporte-cuentas .table-gerencial th { 
                    background-color: var(--carbon-light); color: var(--wire); text-transform: uppercase; font-size: 0.6rem; letter-spacing: 0.1em; padding: 10px; border-bottom: 2px solid var(--steel);
                }
                .page-reporte-cuentas .table-gerencial td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.75rem; }
                .drill-down-modal { backdrop-filter: blur(8px); }
            `}} />

            <div className="mb-6 flex flex-col">
                <h1 className="text-2xl font-black text-white tracking-tighter uppercase font-barlow flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                        <BarChart3 size={28} className="text-primary" />
                    </div>
                    Cuentas x Cobrar Gerencial
                </h1>
                <p className="text-wire text-[0.65rem] uppercase tracking-[0.3em] mt-2 font-bold">Inteligencia de Cartera y Auditoría de Mora</p>
            </div>

            {/* Panel de Filtros Reorganizado */}
            <div className="card mb-6 shadow-2xl border-t-2 border-primary/20">
                <div className="card-body p-5 space-y-5">
                    {/* Fila 1: Filtros de Identidad y Tipo */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div className="form-group lg:col-span-1 relative" ref={dropdownClienteRef}>
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 flex items-center gap-1"><User size={10}/> Cliente</label>
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
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 flex items-center gap-1"><Coins size={10}/> Moneda</label>
                            <select name="moneda" value={filtros.moneda} onChange={handleChangeFiltro} className="form-select w-full font-bold">
                                <option value="">Todas las Monedas</option>
                                <option value="PEN">Soles (PEN)</option>
                                <option value="USD">Dólares (USD)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 flex items-center gap-1"><FileText size={10}/> Comprobante</label>
                            <select name="tipoComprobante" value={filtros.tipoComprobante} onChange={handleChangeFiltro} className="form-select w-full font-bold">
                                <option value="">Todos los Tipos</option>
                                <option value="Factura">Factura</option>
                                <option value="Boleta">Boleta</option>
                                <option value="Nota de Venta">Nota de Venta</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 flex items-center gap-1"><Box size={10}/> Estado SUNAT</label>
                            <select name="estadoSunat" value={filtros.estadoSunat} onChange={handleChangeFiltro} className="form-select w-full font-bold">
                                <option value="">Todos (SUNAT e Internos)</option>
                                <option value="con_correlativo">Solo con Correlativo SUNAT</option>
                                <option value="sin_correlativo">Solo Internos / Pendientes</option>
                            </select>
                        </div>
                    </div>

                    {/* Fila 2: Filtros Temporales */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div className="form-group">
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 flex items-center gap-1"><Clock size={10}/> Tipo de Fecha</label>
                            <select name="tipoFecha" value={filtros.tipoFecha} onChange={handleChangeFiltro} className="form-select w-full font-bold">
                                <option value="fecha_emision">Fecha de Emisión (Orden)</option>
                                <option value="fecha_sunat">Fecha de Facturación SUNAT</option>
                            </select>
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
                            <label className="text-[0.6rem] font-black text-wire uppercase tracking-widest mb-1.5 block">Acción</label>
                            <button onClick={generarReporte} disabled={loading} className="btn btn-primary w-full h-[42px] font-black tracking-widest uppercase text-[10px] shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                                <TrendingUp size={14}/> {loading ? 'PROCESANDO...' : 'GENERAR REPORTE'}
                            </button>
                        </div>
                    </div>

                    {/* Fila 3: Refinamiento Final */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative flex items-center justify-center">
                                <input type="checkbox" name="soloVencidas" checked={filtros.soloVencidas} onChange={handleChangeFiltro} className="w-5 h-5 rounded border-steel bg-carbon text-primary focus:ring-primary" />
                            </div>
                            <span className="text-[10px] font-black text-mist uppercase tracking-widest group-hover:text-white transition-colors">
                                Filtrar exclusivamente documentos con fecha de vencimiento superada (MORA)
                            </span>
                        </label>
                    </div>
                </div>
            </div>

            {reporteData && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                        <div className="card stat-card border-l-4 border-success/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">FACTURAS (PEN)</p>
                            <p className="text-lg font-black text-white">S/ {formatearNum(reporteData.resumen.facturasPEN.total)}</p>
                        </div>
                        <div className="card stat-card border-l-4 border-[#e8b84b]/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">FACTURAS (USD)</p>
                            <p className="text-lg font-black text-[#e8b84b]">$ {formatearNum(reporteData.resumen.facturasUSD.total)}</p>
                        </div>
                        <div className="card stat-card border-l-4 border-[#3B82F6]/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">N. VENTA (PEN)</p>
                            <p className="text-lg font-black text-white">S/ {formatearNum(reporteData.resumen.notasVentaPEN.total)}</p>
                        </div>
                        <div className="card stat-card border-l-4 border-[#60A5FA]/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">N. VENTA (USD)</p>
                            <p className="text-lg font-black text-white">$ {formatearNum(reporteData.resumen.notasVentaUSD.total)}</p>
                        </div>
                        <div className="card stat-card border-l-4 border-[#F59E0B]/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">SIN COMPR. (PEN)</p>
                            <p className="text-lg font-black text-white">S/ {formatearNum(reporteData.resumen.sinComprPEN.total)}</p>
                        </div>
                        <div className="card stat-card border-l-4 border-[#FCD34D]/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">SIN COMPR. (USD)</p>
                            <p className="text-lg font-black text-white">$ {formatearNum(reporteData.resumen.sinComprUSD.total)}</p>
                        </div>
                    </div>

                    <div className="card shadow-2xl mb-12 border border-white/5">
                        <div className="card-header border-b border-white/5 py-3 px-5 flex justify-between items-center bg-carbon-light/20">
                            <h3 className="text-[0.7rem] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <FileText size={16} className="text-wire" /> Trazabilidad de Deuda
                            </h3>
                            <span className="text-[9px] font-black px-3 py-1 bg-primary/10 text-primary rounded-full uppercase border border-primary/20">
                                {reporteData.detalle.length} movs
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
                                        <th className="text-right pr-6">Auditar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reporteData.detalle.length > 0 ? (
                                        reporteData.detalle.map((row) => {
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
                                                        <div className="font-bold text-primary font-mono">{row.numero_orden}</div>
                                                        <div className="text-[9px] text-wire uppercase font-black tracking-tighter">{row.tipo_comprobante}</div>
                                                    </td>
                                                    <td>
                                                        <div className="font-bold text-mist text-[11px] truncate max-w-[200px]" title={row.cliente}>{row.cliente}</div>
                                                        <div className="text-[9px] text-wire uppercase font-bold">{row.estado}</div>
                                                    </td>
                                                    <td className="text-right font-mono text-[10px] text-wire">{row.moneda} {formatearNum(row.total)}</td>
                                                    <td className="text-right font-mono">
                                                        <div className="font-black text-white text-xs">{row.moneda} {formatearNum(row.deuda_pendiente)}</div>
                                                        <div className="text-[9px] text-green-500 font-bold">Cobrado: {parseFloat(row.monto_pagado).toFixed(2)}</div>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`px-2 py-0.5 text-[9px] font-black border rounded ${badge}`}>
                                                            {esVencido ? `${dias} DÍAS MORA` : 'AL DÍA'}
                                                        </span>
                                                    </td>
                                                    <td className="text-right pr-6">
                                                        <Link to={`/ventas/ordenes/${row.id_orden_venta}`} target="_blank" className="p-1.5 hover:bg-primary/10 text-primary transition-all inline-flex rounded-md border border-white/5">
                                                            <ExternalLink size={14} />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr><td colSpan="7" className="text-center py-12 text-wire text-[10px] uppercase font-black tracking-widest italic">No hay movimientos pendientes</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-12 pb-20">
                        {renderGrupoGraficos('facturasPEN', 'Análisis: Facturas (PEN)', '#10B981', 'PEN')}
                        {renderGrupoGraficos('facturasUSD', 'Análisis: Facturas (USD)', '#e8b84b', 'USD')}
                        {renderGrupoGraficos('notasVentaPEN', 'Análisis: N. Venta (PEN)', '#3B82F6', 'PEN')}
                        {renderGrupoGraficos('notasVentaUSD', 'Análisis: N. Venta (USD)', '#60A5FA', 'USD')}
                        {renderGrupoGraficos('sinComprPEN', 'Análisis: Sin Compr. (PEN)', '#F59E0B', 'PEN')}
                        {renderGrupoGraficos('sinComprUSD', 'Análisis: Sin Compr. (USD)', '#FCD34D', 'USD')}
                    </div>
                </div>
            )}

            {modalDrillDown.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 drill-down-modal bg-black/70 animate-in fade-in duration-300">
                    <div className="bg-carbon border border-steel w-full max-w-4xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        <div className="px-6 py-4 border-b border-steel flex justify-between items-center bg-carbon-light/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg shadow-inner"><FileText size={20} className="text-primary" /></div>
                                <div>
                                    <h2 className="text-xs font-black text-white uppercase tracking-[0.2em]">{modalDrillDown.titulo}</h2>
                                    <p className="text-[9px] text-wire font-bold uppercase tracking-widest">Documentos fuente que alimentan este tramo</p>
                                </div>
                            </div>
                            <button onClick={() => setModalDrillDown({ ...modalDrillDown, show: false })} className="p-2 hover:bg-white/5 rounded-full text-wire hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-0">
                            <table className="table-gerencial w-full text-left border-collapse whitespace-nowrap">
                                <thead className="sticky top-0 z-10">
                                    <tr>
                                        <th>Orden</th>
                                        <th>Emisión</th>
                                        <th>Cliente</th>
                                        <th className="text-right">Saldo Pendiente</th>
                                        <th className="text-center">Mora</th>
                                        <th className="text-right pr-6">Ver</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modalDrillDown.data.map(item => (
                                        <tr key={item.id_orden_venta} className="hover:bg-white/[0.03] border-b border-white/5">
                                            <td className="font-mono font-bold text-primary text-xs">{item.numero_orden}</td>
                                            <td className="text-xs text-white">{new Date(item.fecha_emision).toLocaleDateString('es-PE')}</td>
                                            <td className="text-xs text-mist font-bold truncate max-w-[220px]" title={item.cliente}>{item.cliente}</td>
                                            <td className="text-right font-mono font-black text-white text-xs">
                                                <span className="text-wire mr-1 font-normal">{item.moneda}</span>
                                                {formatearNum(item.deuda_pendiente)}
                                            </td>
                                            <td className="text-center">
                                                <span className={`px-2 py-0.5 text-[9px] font-black border rounded ${
                                                    parseInt(item.dias_vencidos) > 0 ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'
                                                }`}>{parseInt(item.dias_vencidos) > 0 ? `${item.dias_vencidos} DÍAS MORA` : 'AL DÍA'}</span>
                                            </td>
                                            <td className="text-right pr-6">
                                                <Link to={`/ventas/ordenes/${item.id_orden_venta}`} target="_blank" className="p-1.5 hover:bg-primary/10 text-primary transition-all inline-flex rounded-md border border-primary/20">
                                                    <ExternalLink size={14} />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 border-t border-steel bg-carbon-light/30 flex justify-between items-center">
                            <span className="text-[10px] font-black text-wire uppercase tracking-widest">TOTAL REGISTROS: {modalDrillDown.data.length}</span>
                            <button onClick={() => setModalDrillDown({ ...modalDrillDown, show: false })} className="px-5 py-2.5 bg-steel/30 hover:bg-steel/50 text-white text-[10px] font-black rounded uppercase tracking-widest transition-colors border border-white/10 shadow-lg">Cerrar Detalle</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReporteDeudasClientes;