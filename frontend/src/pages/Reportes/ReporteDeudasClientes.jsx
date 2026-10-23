import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../config/api';
import {
    Search, AlertCircle, TrendingUp, FileText, BarChart3, ExternalLink, X, AlertTriangle,
    CheckCircle, CalendarClock, ListChecks, Wallet, Receipt, Banknote
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import '../Ventas/Ventas.css';

const ETIQUETAS_AGING = {
    'Corriente': 'Por vencer',
    '0-30 días': 'Vencida 1-30 d',
    '31-60 días': 'Vencida 31-60 d',
    '61-90 días': 'Vencida 61-90 d',
    '+90 días': 'Vencida +90 d'
};

const GRUPOS_CXC = [
    { key: 'facturasPEN', label: 'Facturas', moneda: 'PEN', tono: 'is-accent', icon: FileText },
    { key: 'facturasUSD', label: 'Facturas', moneda: 'USD', tono: 'is-accent', icon: FileText },
    { key: 'notasVentaPEN', label: 'N. venta', moneda: 'PEN', tono: 'is-info', icon: Receipt },
    { key: 'notasVentaUSD', label: 'N. venta', moneda: 'USD', tono: 'is-info', icon: Receipt },
    { key: 'sinComprPEN', label: 'Sin comprobante', moneda: 'PEN', tono: 'is-warning', icon: Banknote },
    { key: 'sinComprUSD', label: 'Sin comprobante', moneda: 'USD', tono: 'is-warning', icon: Banknote }
];

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
    const [errorFecha, setErrorFecha] = useState('');

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
        const nuevosFiltros = { ...filtros, [e.target.name]: value };
        setFiltros(nuevosFiltros);

        const inicio = e.target.name === 'fechaInicio' ? value : nuevosFiltros.fechaInicio;
        const fin = e.target.name === 'fechaFin' ? value : nuevosFiltros.fechaFin;

        if (inicio && fin) {
            if (inicio > fin) {
                setErrorFecha('La fecha "Desde" no puede ser posterior a la fecha "Hasta".');
            } else {
                setErrorFecha('');
            }
        } else {
            setErrorFecha('');
        }
    };

    const generarReporte = async () => {
        if (errorFecha) return;
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
            setDetalleExpandido({ grupoKey: keyGrupo, chartType: tipoGrafico, titulo: subTitulo, data: ordenesFiltradas });
        }
    };

    const simbolo = (moneda) => (moneda === 'USD' ? '$' : 'S/');

    const renderTooltip = (moneda, etiqueta) => ({ active, payload }) => {
        if (!active || !payload || payload.length === 0) return null;
        const punto = payload[0].payload;
        return (
            <div className="vt-tooltip">
                {etiqueta(punto)}
                <strong>{simbolo(moneda)} {formatearNum(payload[0].value)}</strong>
                <span>Pulsa la barra para auditar los documentos</span>
            </div>
        );
    };

    const renderTablaAuditoria = () => (
        <div className="vt-audit">
            <div className="pg-panel-head">
                <h3 className="pg-panel-title"><ListChecks size={16} /> {detalleExpandido.titulo} <span className="pg-count">{detalleExpandido.data.length}</span></h3>
                <button
                    type="button"
                    className="pg-iconbtn"
                    onClick={() => setDetalleExpandido({ grupoKey: null, chartType: null, titulo: '', data: [] })}
                    aria-label="Cerrar auditoría"
                    title="Cerrar auditoría"
                >
                    <X size={16} />
                </button>
            </div>
            <div className="pg-table-wrap">
                <table className="pg-table">
                    <thead>
                        <tr>
                            <th>Orden</th>
                            <th>Emisión / vencimiento</th>
                            <th>Cliente</th>
                            <th className="num">Total real</th>
                            <th className="num">Saldo pendiente</th>
                            <th className="center">Mora</th>
                            <th className="center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {detalleExpandido.data.map(item => {
                            const dias = parseInt(item.dias_vencidos) || 0;
                            const esVencido = dias > 0;
                            const claseMora = dias > 60 ? 'badge-danger' : dias > 0 ? 'badge-warning' : 'badge-success';
                            const IconoMora = esVencido ? AlertTriangle : CheckCircle;
                            return (
                                <tr key={item.id_orden_venta}>
                                    <td className="nowrap">
                                        <span className="pg-code">{item.numero_orden}</span>
                                        <span className="pg-cell-sub">{item.tipo_comprobante || 'Sin comprobante'}{item.numero_comprobante_sunat ? ` · ${item.numero_comprobante_sunat}` : ''}</span>
                                    </td>
                                    <td className="nowrap">
                                        <span className="pg-cell-main">{new Date(item.fecha_emision).toLocaleDateString('es-PE')}</span>
                                        <span className="pg-cell-sub" style={esVencido ? { color: 'var(--danger)' } : undefined}>
                                            Vence {new Date(item.fecha_vencimiento).toLocaleDateString('es-PE')}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="pg-cell-main pg-truncate" title={item.cliente}>{item.cliente}</span>
                                        {(item.contacto_cliente || item.telefono_cliente) && (
                                            <span className="pg-cell-sub">{[item.contacto_cliente, item.telefono_cliente].filter(Boolean).join(' · ')}</span>
                                        )}
                                    </td>
                                    <td className="num pg-muted">{item.moneda} {formatearNum(item.total_real)}</td>
                                    <td className="num">
                                        <span className="pg-money"><b>{item.moneda} {formatearNum(item.deuda_pendiente)}</b></span>
                                        <span className="pg-cell-sub">Pagado {parseFloat(item.monto_pagado).toFixed(2)}</span>
                                    </td>
                                    <td className="center">
                                        <span className={`badge ${claseMora}`}>
                                            <IconoMora size={11} />{esVencido ? `${dias} días de mora` : 'Al día'}
                                        </span>
                                    </td>
                                    <td className="center">
                                        <Link
                                            to={`/ventas/ordenes/${item.id_orden_venta}`}
                                            target="_blank"
                                            className="pg-iconbtn"
                                            title="Abrir la orden en otra pestaña"
                                            aria-label={`Abrir ${item.numero_orden} en otra pestaña`}
                                        >
                                            <ExternalLink size={15} />
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="pg-pager">
                <span><b>{detalleExpandido.data.length}</b> documentos componen este monto</span>
            </div>
        </div>
    );

    const renderGrupoGraficos = (keyGrupo, tituloBase, moneda) => {
        const data = reporteData.resumen[keyGrupo];
        if (!data || parseFloat(data.total) <= 0) return null;
        const tituloTop = filtros.idCliente ? `Distribución de Deuda: ${busquedaCliente}` : "Top 5 Deudores Críticos";
        const isExpanded = detalleExpandido.grupoKey === keyGrupo;
        const morosidad = parseFloat(data.morosidad || 0);

        return (
            <section className="pg-panel" key={keyGrupo} id={`vt-cxc-${keyGrupo}`}>
                <div className="pg-panel-head">
                    <h2 className="pg-panel-title"><FileText size={16} /> {tituloBase}</h2>
                    <div className="vt-figures">
                        <div className="vt-figure"><span>Por cobrar</span><b>{simbolo(moneda)} {formatearNum(data.total)}</b></div>
                        <div className="vt-figure"><span>Vencido</span><b className={parseFloat(data.vencido) > 0 ? 'is-danger' : ''}>{simbolo(moneda)} {formatearNum(data.vencido)}</b></div>
                        <div className="vt-figure"><span>Morosidad</span><b className={morosidad > 0 ? 'is-warning' : 'is-success'}>{morosidad.toFixed(1)}%</b></div>
                    </div>
                </div>
                <div className="pg-grid pg-grid-even vt-chart-pair">
                    <div className="vt-chart-block">
                        <h3 className="pg-section-title"><CalendarClock size={14} /> Antigüedad de la deuda</h3>
                        <div className="vt-chart">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.aging} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }} barCategoryGap="22%">
                                    <CartesianGrid stroke="var(--vt-grid)" horizontal={false} />
                                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: 'var(--vt-axis)', fontSize: 11 }}
                                        tickFormatter={(v) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)} />
                                    <YAxis dataKey="name" type="category" width={112} tickLine={false} axisLine={{ stroke: 'var(--steel)' }}
                                        tick={{ fill: 'var(--text-primary)', fontSize: 12 }} tickFormatter={(v) => ETIQUETAS_AGING[v] || v} />
                                    <Tooltip cursor={{ fill: 'var(--bg-tertiary)' }} content={renderTooltip(moneda, (p) => ETIQUETAS_AGING[p.name] || p.name)} />
                                    <Bar
                                        dataKey="monto"
                                        fill="var(--vt-s1)"
                                        radius={[0, 4, 4, 0]}
                                        cursor="pointer"
                                        isAnimationActive={false}
                                        onClick={(barData) => handleDrillDown(barData, 'aging', keyGrupo, tituloBase)}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="vt-chart-block">
                        <h3 className="pg-section-title"><TrendingUp size={14} /> {tituloTop}</h3>
                        <div className="vt-chart">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.topDeudores} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }} barCategoryGap="22%">
                                    <CartesianGrid stroke="var(--vt-grid)" horizontal={false} />
                                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: 'var(--vt-axis)', fontSize: 11 }}
                                        tickFormatter={(v) => `${simbolo(moneda)}${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)}`} />
                                    <YAxis dataKey="name" type="category" width={150} tickLine={false} axisLine={{ stroke: 'var(--steel)' }}
                                        tick={{ fill: 'var(--text-primary)', fontSize: 11 }} tickFormatter={(v) => (String(v).length > 22 ? `${String(v).slice(0, 21)}…` : v)} />
                                    <Tooltip cursor={{ fill: 'var(--bg-tertiary)' }} content={renderTooltip(moneda, (p) => p.full_name || p.name)} />
                                    <Bar
                                        dataKey="deuda"
                                        fill="var(--vt-s1)"
                                        radius={[0, 4, 4, 0]}
                                        cursor="pointer"
                                        isAnimationActive={false}
                                        onClick={(barData) => handleDrillDown(barData, 'deudores', keyGrupo, tituloBase)}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
                {isExpanded && renderTablaAuditoria()}
            </section>
        );
    };

    return (
        <div className="pg-page vt-page">
            <header className="pg-header">
                <div>
                    <span className="pg-eyebrow"><BarChart3 size={13} /> Reportes de ventas</span>
                    <h1 className="pg-title">Cuentas por cobrar</h1>
                    <p className="pg-subtitle">Cartera pendiente por tipo de comprobante y moneda, antigüedad de la deuda y auditoría de mora</p>
                </div>
            </header>

            <div className="pg-stack">
                <section className="pg-panel">
                    <div className="pg-filters">
                        <div className="vt-filters-grid">
                            <div className="pg-field pg-field-grow vt-combo" ref={dropdownClienteRef}>
                                <label className="pg-field-label" htmlFor="vt-cxc-cliente">Cliente</label>
                                <Search size={14} className="vt-combo-icon" />
                                <input
                                    id="vt-cxc-cliente"
                                    type="text"
                                    autoComplete="off"
                                    className="form-input"
                                    placeholder="RUC o razón social"
                                    value={busquedaCliente}
                                    onChange={(e) => {
                                        setBusquedaCliente(e.target.value);
                                        setMostrarDropdownCliente(true);
                                        if (!e.target.value) setFiltros({ ...filtros, idCliente: '' });
                                    }}
                                    onFocus={() => setMostrarDropdownCliente(true)}
                                />
                                {mostrarDropdownCliente && busquedaCliente && (
                                    <ul className="vt-suggest">
                                        {clientesFiltrados.length > 0 ? (
                                            clientesFiltrados.map(c => (
                                                <li key={c.id_cliente}>
                                                    <button type="button" onClick={() => handleSelectCliente(c)}>
                                                        {c.razon_social}
                                                        <small>RUC {c.ruc}</small>
                                                    </button>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="vt-suggest-empty">Sin resultados</li>
                                        )}
                                    </ul>
                                )}
                            </div>
                            <div className="pg-field">
                                <label className="pg-field-label" htmlFor="vt-cxc-moneda">Moneda</label>
                                <select id="vt-cxc-moneda" name="moneda" value={filtros.moneda} onChange={handleChangeFiltro} className="form-select">
                                    <option value="">Todas las Monedas</option>
                                    <option value="PEN">Soles (PEN)</option>
                                    <option value="USD">Dólares (USD)</option>
                                </select>
                            </div>
                            <div className="pg-field">
                                <label className="pg-field-label" htmlFor="vt-cxc-comprobante">Comprobante</label>
                                <select id="vt-cxc-comprobante" name="tipoComprobante" value={filtros.tipoComprobante} onChange={handleChangeFiltro} className="form-select">
                                    <option value="">Todos los Tipos</option>
                                    <option value="Factura">Factura</option>
                                    <option value="Boleta">Boleta</option>
                                    <option value="Nota de Venta">Nota de Venta</option>
                                </select>
                            </div>
                            <div className="pg-field">
                                <label className="pg-field-label" htmlFor="vt-cxc-sunat">Estado SUNAT</label>
                                <select id="vt-cxc-sunat" name="estadoSunat" value={filtros.estadoSunat} onChange={handleChangeFiltro} className="form-select">
                                    <option value="">Todos (SUNAT e Internos)</option>
                                    <option value="con_correlativo">Solo con Correlativo SUNAT</option>
                                    <option value="sin_correlativo">Solo Internos / Pendientes</option>
                                </select>
                            </div>
                            <div className="pg-field">
                                <label className="pg-field-label" htmlFor="vt-cxc-tipo-fecha">Tipo de fecha</label>
                                <select id="vt-cxc-tipo-fecha" name="tipoFecha" value={filtros.tipoFecha} onChange={handleChangeFiltro} className="form-select">
                                    <option value="fecha_emision">Fecha de Emisión (Orden)</option>
                                    <option value="fecha_sunat">Fecha de Facturación SUNAT</option>
                                </select>
                            </div>
                            <div className="pg-field">
                                <label className="pg-field-label" htmlFor="vt-cxc-desde">Desde</label>
                                <input
                                    id="vt-cxc-desde"
                                    type="date"
                                    name="fechaInicio"
                                    value={filtros.fechaInicio}
                                    onChange={handleChangeFiltro}
                                    max={filtros.fechaFin || undefined}
                                    className={`form-input ${errorFecha ? 'is-invalid' : ''}`}
                                />
                            </div>
                            <div className="pg-field">
                                <label className="pg-field-label" htmlFor="vt-cxc-hasta">Hasta</label>
                                <input
                                    id="vt-cxc-hasta"
                                    type="date"
                                    name="fechaFin"
                                    value={filtros.fechaFin}
                                    onChange={handleChangeFiltro}
                                    min={filtros.fechaInicio || undefined}
                                    className={`form-input ${errorFecha ? 'is-invalid' : ''}`}
                                />
                            </div>
                        </div>

                        <label className="pg-check">
                            <input type="checkbox" name="soloVencidas" checked={filtros.soloVencidas} onChange={handleChangeFiltro} />
                            <div>
                                <span><AlertTriangle size={14} />Solo documentos vencidos</span>
                                <small>Filtra exclusivamente documentos con fecha de vencimiento superada (mora).</small>
                            </div>
                        </label>

                        {errorFecha && (
                            <span className="vt-error" role="alert"><AlertCircle size={14} /> {errorFecha}</span>
                        )}
                    </div>
                    <div className="vt-filters-foot">
                        <span className="pg-hint">Si no indicas Desde y Hasta se consideran todos los documentos con saldo pendiente.</span>
                        <button
                            type="button"
                            onClick={generarReporte}
                            disabled={loading || !!errorFecha}
                            className="btn btn-primary"
                        >
                            <TrendingUp size={16} /> {loading ? 'Procesando…' : 'Generar reporte'}
                        </button>
                    </div>
                </section>

                {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

                {!reporteData && !loading && (
                    <section className="pg-panel">
                        <div className="pg-empty">
                            <Wallet size={28} />
                            <strong>Configura los filtros y genera el reporte</strong>
                            <span>Verás la deuda pendiente por comprobante y moneda, su antigüedad y los principales deudores.</span>
                        </div>
                    </section>
                )}

                {loading && !reporteData && <Loading variant="table" />}

                {reporteData && (
                    <>
                        <div className="pg-kpis">
                            {GRUPOS_CXC.map(g => {
                                const datos = reporteData.resumen[g.key];
                                const total = parseFloat(datos?.total || 0);
                                const morosidad = parseFloat(datos?.morosidad || 0);
                                const contenido = (
                                    <>
                                        <div className="pg-kpi-top">
                                            <span className="pg-kpi-label">{g.label} · {g.moneda}</span>
                                            <span className="pg-kpi-icon"><g.icon size={16} /></span>
                                        </div>
                                        <span className="pg-kpi-value"><small>{simbolo(g.moneda)}</small>{formatearNum(total)}</span>
                                        <div className="pg-meter" style={{ '--meter-c': 'var(--danger)' }} title={`${morosidad.toFixed(1)}% vencido`}>
                                            <span style={{ width: `${Math.min(100, morosidad)}%` }} />
                                        </div>
                                        <span className="pg-kpi-foot">
                                            {total > 0
                                                ? <>Vencido <b>{simbolo(g.moneda)} {formatearNum(datos?.vencido || 0)}</b> · {morosidad.toFixed(1)}% mora</>
                                                : 'Sin saldo pendiente'}
                                        </span>
                                    </>
                                );
                                return total > 0 ? (
                                    <a key={g.key} href={`#vt-cxc-${g.key}`} className={`pg-kpi vt-kpi-link ${g.tono}`}>{contenido}</a>
                                ) : (
                                    <div key={g.key} className="pg-kpi">{contenido}</div>
                                );
                            })}
                        </div>

                        {GRUPOS_CXC.every(g => parseFloat(reporteData.resumen[g.key]?.total || 0) <= 0) && (
                            <section className="pg-panel">
                                <div className="pg-empty">
                                    <CheckCircle size={28} />
                                    <strong>No hay deuda pendiente con estos filtros</strong>
                                    <span>Cambia el cliente, la moneda o el rango de fechas para revisar otra parte de la cartera.</span>
                                </div>
                            </section>
                        )}

                        {renderGrupoGraficos('facturasPEN', 'Facturas (PEN)', 'PEN')}
                        {renderGrupoGraficos('facturasUSD', 'Facturas (USD)', 'USD')}
                        {renderGrupoGraficos('notasVentaPEN', 'N. Venta (PEN)', 'PEN')}
                        {renderGrupoGraficos('notasVentaUSD', 'N. Venta (USD)', 'USD')}
                        {renderGrupoGraficos('sinComprPEN', 'Sin Compr. (PEN)', 'PEN')}
                        {renderGrupoGraficos('sinComprUSD', 'Sin Compr. (USD)', 'USD')}
                    </>
                )}
            </div>
        </div>
    );
};

export default ReporteDeudasClientes;
