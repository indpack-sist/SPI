import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Activity, AlertTriangle, ArrowRight, Ban, BarChart3, Check, CheckCircle2,
  ChevronDown, ChevronUp, CircleDot, Copy, FileText, Gauge, Inbox, Info,
  Radio, RefreshCw, Search, ServerCrash, ShieldCheck, Timer, Truck, Wifi,
  WifiOff, XCircle
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { sunatAPI } from '../../config/api';
import './MonitorSunat.css';

const PERIODOS = [{ id: '24h', label: '24 horas' }, { id: '7d', label: '7 días' }, { id: '30d', label: '30 días' }];
const ESTADOS = [
  { id: 'ACEPTADO', color: '#2ecc71' }, { id: 'OBSERVADO', color: '#5dade2' },
  { id: 'ENVIADO', color: '#f39c12' }, { id: 'PENDIENTE', color: '#8b95a5' },
  { id: 'RECHAZADO', color: '#e74c3c' }, { id: 'ERROR', color: '#c0392b' },
  { id: 'BAJA', color: '#6f7782' }, { id: 'ANULADA', color: '#6f7782' },
  { id: 'REEMPLAZADA', color: '#9b59b6' }, { id: 'GENERADO', color: '#8b95a5' }
];
const numero = (valor) => Number(valor || 0);
const porcentaje = (valor) => `${Number.isFinite(valor) ? valor.toFixed(1) : '0.0'}%`;
const fmtFecha = (fecha, opciones = {}) => fecha == null ? '—' : new Date(fecha).toLocaleString('es-PE', { timeZone: 'America/Lima', ...opciones });

function calcularSalud({ tasa, abiertos, errores }) {
  if (!errores && !abiertos) return { score: 100, nivel: 'Saludable', tono: 'good', texto: 'Sin incidencias activas' };
  const score = Math.max(0, Math.round(100 - (100 - tasa) * .75 - Math.min(abiertos * 5, 20) - Math.min(errores * 2, 15)));
  if (score >= 95) return { score, nivel: 'Saludable', tono: 'good', texto: 'Operación dentro de parámetros' };
  if (score >= 80) return { score, nivel: 'Atención', tono: 'warning', texto: 'Existen eventos por revisar' };
  return { score, nivel: 'Crítico', tono: 'danger', texto: 'La operación requiere intervención' };
}

function EmptyState({ icon: Icon = CheckCircle2, title, text }) {
  return <div className="sunat-empty"><span><Icon size={22} /></span><strong>{title}</strong>{text && <p>{text}</p>}</div>;
}

function EstadoBar({ titulo, icon: Icon, rows = [], totalAbiertos = 0, href, indicador = 'aceptación' }) {
  const total = rows.reduce((acc, row) => acc + numero(row.n), 0);
  const manuales = rows.reduce((acc, row) => acc + numero(row.manuales ?? row.manual), 0);
  const mapa = Object.fromEntries(rows.map((row) => [String(row.estado).toUpperCase(), numero(row.n)]));
  const visibles = ESTADOS.filter((estado) => mapa[estado.id] > 0);
  const tasa = total ? (numero(mapa.ACEPTADO) / total) * 100 : 0;
  return (
    <article className="sunat-flow-row">
      <div className="sunat-flow-title"><span className="sunat-flow-icon"><Icon size={18} /></span><div><strong>{titulo}</strong><small>{total.toLocaleString('es-PE')} documentos históricos</small>{manuales > 0 && <small className="sunat-manual-note">{manuales} aceptados por registro manual</small>}</div></div>
      <div className="sunat-flow-main">
        <div className="sunat-segmented" aria-label={`Distribución de estados de ${titulo}`}>
          {visibles.map((estado) => <span key={estado.id} style={{ width: `${Math.max((mapa[estado.id] / Math.max(total, 1)) * 100, 1)}%`, background: estado.color }} title={`${estado.id}: ${mapa[estado.id]}`} />)}
        </div>
        <div className="sunat-flow-legend">{visibles.map((estado) => <span key={estado.id}><i style={{ background: estado.color }} />{estado.id.toLowerCase()} <b>{mapa[estado.id]}</b></span>)}</div>
      </div>
      <div className="sunat-flow-result"><strong>{porcentaje(tasa)}</strong><small>{indicador}</small>{totalAbiertos > 0 && <em>{totalAbiertos} en proceso</em>}</div>
      <Link to={href} className="sunat-icon-link" title={`Abrir ${titulo}`}><ArrowRight size={17} /></Link>
    </article>
  );
}

function Metric({ icon: Icon, label, value, detail, tone = 'neutral' }) {
  return <div className={`sunat-metric ${tone}`}><span className="sunat-metric-icon"><Icon size={17} /></span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></div>;
}

function TicketRow({ icon: Icon, label, count, age, href }) {
  const activo = count > 0;
  const edad = age == null ? 'Sin espera registrada' : age < 60 ? `${age} min de espera máxima` : `${Math.floor(age / 60)} h ${age % 60} min de espera máxima`;
  return <Link to={href} className={`sunat-ticket ${activo ? 'active' : ''}`}><span className="sunat-ticket-icon"><Icon size={17} /></span><span><strong>{label}</strong><small>{edad}</small></span><b>{count}</b><ArrowRight size={15} /></Link>;
}

function IncidenciaRow({ item, tipo, expanded, onToggle }) {
  const esLog = tipo === 'log';
  const origen = String(item.origen || 'SUNAT').replaceAll('_', ' ');
  const titulo = esLog ? item.evento : item.comprobante;
  const codigo = esLog ? item.http_status : item.codigo;
  const href = item.origen === 'GUIA' ? `/ventas/guias-remision/${item.id}` : '/ventas/ordenes';
  const copiar = async (event) => { event.stopPropagation(); await navigator.clipboard?.writeText(item.detalle || ''); };
  return (
    <div className={`sunat-incident ${expanded ? 'expanded' : ''}`}>
      <button className="sunat-incident-main" onClick={onToggle} aria-expanded={expanded}>
        <span className="sunat-incident-severity"><XCircle size={17} /></span>
        <span className="sunat-incident-when">{fmtFecha(item.fecha_ms, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        <span className="sunat-incident-id"><small>{origen}</small><strong>{titulo || `Ref. ${item.referencia_id || '—'}`}</strong></span>
        <span className="sunat-incident-message">{item.detalle || 'SUNAT no devolvió un detalle descriptivo.'}</span>
        <span className="sunat-incident-code">{codigo || 'S/C'}</span>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && <div className="sunat-incident-detail">
        <div><small>Detalle técnico</small><p>{item.detalle || 'No existe detalle adicional para este evento.'}</p></div>
        {esLog && <div className="sunat-detail-facts"><span>Referencia <b>{item.referencia_id || '—'}</b></span><span>Duración <b>{item.duracion_ms ? `${item.duracion_ms} ms` : '—'}</b></span></div>}
        <div className="sunat-detail-actions"><button className="btn btn-outline btn-sm" onClick={copiar}><Copy size={13} /> Copiar detalle</button>{!esLog && <Link to={href} className="btn btn-primary btn-sm">Abrir documento <ArrowRight size={13} /></Link>}</div>
      </div>}
    </div>
  );
}

export default function MonitorSunat() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaCarga, setUltimaCarga] = useState(null);
  const [enVivo, setEnVivo] = useState(false);
  const [periodo, setPeriodo] = useState('24h');
  const [bandeja, setBandeja] = useState('documentos');
  const [busqueda, setBusqueda] = useState('');
  const [expandido, setExpandido] = useState(null);

  const cargar = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try { const res = await sunatAPI.monitor(); setData(res.data); setError(null); setUltimaCarga(new Date()); }
    catch (e) { setError(e?.response?.data?.error || e?.error || e?.message || 'No se pudo cargar el monitor SUNAT.'); }
    finally { if (!silent) setLoading(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const cargarRef = useRef(cargar);
  useEffect(() => { cargarRef.current = cargar; }, [cargar]);
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:3000';
    const socket = io(socketUrl, { withCredentials: true, transports: ['polling', 'websocket'], reconnection: true, reconnectionDelay: 1000 });
    let debounce;
    const refrescar = () => { clearTimeout(debounce); debounce = setTimeout(() => cargarRef.current?.({ silent: true }), 500); };
    socket.on('connect', () => setEnVivo(true)); socket.on('disconnect', () => setEnVivo(false)); socket.on('sunat:cambio', refrescar);
    const intervalo = setInterval(() => { if (document.visibilityState === 'visible') cargarRef.current?.({ silent: true }); }, 15000);
    const onVisible = () => { if (document.visibilityState === 'visible') cargarRef.current?.({ silent: true }); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(debounce); clearInterval(intervalo); document.removeEventListener('visibilitychange', onVisible); socket.off('sunat:cambio', refrescar); socket.disconnect(); };
  }, []);

  const totalAbiertos = useMemo(() => data ? ['facturas', 'notasCredito', 'notasDebito', 'guias', 'bajas'].reduce((total, clave) => total + numero(data.ticketsAbiertos?.[clave]), 0) : 0, [data]);
  const ventana = data?.analitica?.ventanas || {};
  const estadistica = useMemo(() => {
    const total = numero(ventana[`total_${periodo}`]), exitos = numero(ventana[`exitos_${periodo}`]), errores = numero(ventana[`errores_${periodo}`]);
    return { total, exitos, errores, latencia: numero(ventana[`latencia_${periodo}`]), tasa: total ? (exitos / total) * 100 : 100 };
  }, [ventana, periodo]);
  const salud = calcularSalud({ tasa: estadistica.tasa, abiertos: totalAbiertos, errores: estadistica.errores });
  const actividad = useMemo(() => {
    const rows = periodo === '24h' ? (data?.analitica?.actividadHoraria || []).slice(-24) : (data?.analitica?.actividadDiaria || []).slice(periodo === '7d' ? -7 : -30);
    return rows.map((row) => ({ ...row, total: numero(row.total), exitos: numero(row.exitos), errores: numero(row.errores), latencia_ms: numero(row.latencia_ms), etiqueta: periodo === '24h' ? fmtFecha(numero(row.periodo_ms), { hour: '2-digit', minute: '2-digit' }) : new Date(`${row.periodo}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) }));
  }, [data, periodo]);
  const itemsBandeja = useMemo(() => {
    const source = bandeja === 'documentos' ? (data?.ultimosRechazos || []) : (data?.erroresLog || []), q = busqueda.trim().toLowerCase();
    return !q ? source : source.filter((item) => Object.values(item).some((value) => String(value ?? '').toLowerCase().includes(q)));
  }, [data, bandeja, busqueda]);

  if (loading && !data) return <div className="sunat-loading"><RefreshCw className="sunat-spin" size={28} /><strong>Conectando con el centro de control</strong><span>Recopilando actividad, colas e incidencias…</span></div>;
  return <main className="sunat-monitor">
    <header className="sunat-command-header">
      <div className="sunat-heading"><div className="sunat-eyebrow"><Radio size={12} /> Centro de control tributario</div><h1>Monitor SUNAT <span>/ SEE</span></h1><p>Supervisión operativa de comprobantes electrónicos, guías y comunicaciones de baja.</p></div>
      <div className="sunat-header-actions"><div className={`sunat-live ${enVivo ? 'online' : ''}`}>{enVivo ? <Wifi size={14} /> : <WifiOff size={14} />}<span><b>{enVivo ? 'Sincronización activa' : 'Reconectando'}</b><small>{ultimaCarga ? `Última lectura ${fmtFecha(ultimaCarga, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Esperando primera lectura'}</small></span></div><span className={`sunat-mode ${data?.mode === 'PROD' ? 'prod' : 'beta'}`}><ShieldCheck size={14} /> Ambiente {data?.mode || '—'}</span><button className="sunat-refresh" onClick={() => cargar()} disabled={loading} title="Actualizar ahora"><RefreshCw className={loading ? 'sunat-spin' : ''} size={17} /></button></div>
    </header>
    {error && <div className="sunat-alert"><ServerCrash size={17} /><span><b>No se pudo actualizar la información.</b> {error}</span><button onClick={() => cargar()}>Reintentar</button></div>}
    <section className="sunat-status-grid">
      <article className={`sunat-health ${salud.tono}`}><div className="sunat-health-ring" style={{ '--score': `${salud.score * 3.6}deg` }}><div><strong>{salud.score}</strong><small>/ 100</small></div></div><div><span className="sunat-section-kicker">Salud operativa</span><h2>{salud.nivel}</h2><p>{salud.texto}</p></div><div className="sunat-health-signal"><CircleDot size={14} /> Calculado en {PERIODOS.find((p) => p.id === periodo)?.label}</div></article>
      <div className="sunat-summary"><div className="sunat-periods">{PERIODOS.map((p) => <button key={p.id} className={periodo === p.id ? 'active' : ''} onClick={() => setPeriodo(p.id)}>{p.label}</button>)}</div><div className="sunat-metrics-grid"><Metric icon={CheckCircle2} label="Tasa de éxito" value={porcentaje(estadistica.tasa)} detail={`${estadistica.exitos} operaciones correctas`} tone="success" /><Metric icon={Activity} label="Operaciones" value={estadistica.total.toLocaleString('es-PE')} detail={`${estadistica.errores} con error`} /><Metric icon={Timer} label="Tiempo de respuesta" value={estadistica.latencia ? `${estadistica.latencia} ms` : '—'} detail="Promedio de servicios SUNAT" /><Metric icon={Inbox} label="Cola activa" value={totalAbiertos} detail={totalAbiertos ? 'Esperando CDR o ticket' : 'Sin documentos en espera'} tone={totalAbiertos ? 'warning' : 'success'} /></div></div>
    </section>
    <section className="sunat-workspace-grid">
      <article className="sunat-panel sunat-chart-panel"><div className="sunat-panel-header"><div><span className="sunat-section-kicker">Telemetría</span><h2>Actividad de servicios</h2><p>Operaciones registradas contra SUNAT en el periodo seleccionado.</p></div><div className="sunat-chart-legend"><span><i className="success" />Exitosas</span><span><i className="error" />Errores</span></div></div><div className="sunat-chart">{actividad.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={actividad} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id="sunatSuccess" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2ecc71" stopOpacity={.35} /><stop offset="100%" stopColor="#2ecc71" stopOpacity={0} /></linearGradient><linearGradient id="sunatError" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e74c3c" stopOpacity={.35} /><stop offset="100%" stopColor="#e74c3c" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="etiqueta" stroke="var(--text-secondary)" tickLine={false} axisLine={false} fontSize={11} minTickGap={24} /><YAxis stroke="var(--text-secondary)" tickLine={false} axisLine={false} allowDecimals={false} fontSize={11} /><Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6 }} labelStyle={{ color: 'var(--text-primary)' }} /><Area type="monotone" dataKey="exitos" name="Exitosas" stroke="#2ecc71" fill="url(#sunatSuccess)" strokeWidth={2} /><Area type="monotone" dataKey="errores" name="Errores" stroke="#e74c3c" fill="url(#sunatError)" strokeWidth={2} /></AreaChart></ResponsiveContainer> : <EmptyState icon={BarChart3} title="Aún no hay telemetría" text="La gráfica aparecerá cuando se registren operaciones contra SUNAT." />}</div><div className="sunat-origin-strip">{(data?.analitica?.porOrigen || []).slice(0, 5).map((item) => { const total = numero(item.total), tasa = total ? numero(item.exitos) / total * 100 : 100; return <div key={item.origen}><span>{String(item.origen).replaceAll('_', ' ')}</span><strong>{porcentaje(tasa)}</strong><small>{total} ops · {numero(item.latencia_ms) || '—'} ms</small></div>; })}</div></article>
      <aside className="sunat-panel sunat-queue-panel"><div className="sunat-panel-header"><div><span className="sunat-section-kicker">Cola de conciliación</span><h2>Esperando respuesta</h2><p>Enviados que aún no cuentan con respuesta final.</p></div><span className={`sunat-count ${totalAbiertos ? 'warning' : ''}`}>{totalAbiertos}</span></div><div className="sunat-ticket-list"><TicketRow icon={FileText} label="Facturas" count={numero(data?.ticketsAbiertos?.facturas)} age={data?.antiguedadTickets?.facturas_min} href="/ventas/ordenes" /><TicketRow icon={FileText} label="Notas de crédito" count={numero(data?.ticketsAbiertos?.notasCredito)} age={data?.antiguedadTickets?.notas_credito_min} href="/ventas/ordenes" /><TicketRow icon={FileText} label="Notas de débito" count={numero(data?.ticketsAbiertos?.notasDebito)} age={data?.antiguedadTickets?.notas_debito_min} href="/ventas/ordenes" /><TicketRow icon={Truck} label="Guías de remisión" count={numero(data?.ticketsAbiertos?.guias)} age={data?.antiguedadTickets?.guias_min} href="/ventas/guias-remision" /><TicketRow icon={Ban} label="Comunicaciones de baja" count={numero(data?.ticketsAbiertos?.bajas)} age={data?.antiguedadTickets?.bajas_min} href="/ventas/ordenes" /></div><div className="sunat-queue-note"><Info size={15} /><span>La conciliación automática consulta los tickets abiertos. Una espera prolongada debe contrastarse con la bandeja de incidencias.</span></div></aside>
    </section>
    <section className="sunat-panel sunat-flow-panel"><div className="sunat-panel-header"><div><span className="sunat-section-kicker">Ciclo documental</span><h2>Estado del flujo electrónico</h2><p>Distribución completa y vigencia operativa por tipo documental.</p></div><span className="sunat-header-hint"><Gauge size={15} /> Lectura acumulada</span></div><div className="sunat-flow-list"><EstadoBar titulo="Facturas" icon={FileText} rows={data?.facturas || data?.comprobantes} totalAbiertos={numero(data?.ticketsAbiertos?.facturas)} href="/ventas/ordenes" indicador="vigentes" /><EstadoBar titulo="Notas de crédito" icon={FileText} rows={data?.notasCredito} totalAbiertos={numero(data?.ticketsAbiertos?.notasCredito)} href="/ventas/ordenes" /><EstadoBar titulo="Notas de débito" icon={FileText} rows={data?.notasDebito} totalAbiertos={numero(data?.ticketsAbiertos?.notasDebito)} href="/ventas/ordenes" /><EstadoBar titulo="Guías de remisión" icon={Truck} rows={data?.guias} totalAbiertos={numero(data?.ticketsAbiertos?.guias)} href="/ventas/guias-remision" /><EstadoBar titulo="Comunicaciones de baja" icon={Ban} rows={data?.bajas} totalAbiertos={numero(data?.ticketsAbiertos?.bajas)} href="/ventas/ordenes" /></div></section>
    <section className="sunat-panel sunat-incidents-panel"><div className="sunat-panel-header sunat-incidents-heading"><div><span className="sunat-section-kicker">Centro de incidencias</span><h2>Bandeja de atención</h2><p>Errores tributarios y técnicos con contexto suficiente para investigar.</p></div><div className="sunat-search"><Search size={15} /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar código, documento o mensaje…" /></div></div><div className="sunat-tabs"><button className={bandeja === 'documentos' ? 'active' : ''} onClick={() => { setBandeja('documentos'); setExpandido(null); }}><AlertTriangle size={14} /> Documentos rechazados <b>{data?.ultimosRechazos?.length || 0}</b></button><button className={bandeja === 'tecnicos' ? 'active' : ''} onClick={() => { setBandeja('tecnicos'); setExpandido(null); }}><ServerCrash size={14} /> Eventos técnicos <b>{data?.erroresLog?.length || 0}</b></button></div><div className="sunat-incident-columns"><span>Severidad</span><span>Fecha</span><span>Origen / referencia</span><span>Resumen</span><span>Código</span><span /></div><div className="sunat-incident-list">{itemsBandeja.length ? itemsBandeja.map((item, index) => { const key = `${bandeja}-${item.origen}-${item.id || item.referencia_id}-${item.fecha_ms || index}`; return <IncidenciaRow key={key} item={item} tipo={bandeja === 'tecnicos' ? 'log' : 'documento'} expanded={expandido === key} onToggle={() => setExpandido(expandido === key ? null : key)} />; }) : <EmptyState icon={busqueda ? Search : Check} title={busqueda ? 'No hay coincidencias' : 'Bandeja limpia'} text={busqueda ? 'Prueba con otro código o término.' : 'No se registran incidencias en esta vista.'} />}</div></section>
  </main>;
}
