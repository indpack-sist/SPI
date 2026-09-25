import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, CalendarDays, ChevronDown, ChevronRight, Download, FileCheck2,
  FileText, Filter, Layers, Link2, Loader2, Package, RefreshCw, RotateCcw, Search,
  ShieldCheck, Truck, X, XCircle, DownloadCloud
} from 'lucide-react';
import { sunatAPI, ordenesVentaAPI, guiasRemisionAPI } from '../../config/api';
import { useDescargaMasiva, soportaDescargaCarpetas } from '../../context/DescargaMasivaContext';
import ModalDescargaMasiva from '../../components/Descargas/ModalDescargaMasiva';
import './TrazabilidadSee.css';

/* --------------------------------------------------------------------------
 * Trazabilidad SEE — vista administrativa de solo lectura de toda la emisión
 * electrónica: comprobantes (facturas + notas de crédito/débito) y guías de
 * remisión, con todos sus estados y motivos. Diseño con tokens de tema
 * (claro/oscuro) — sin colores fijos de fondo/texto.
 * ------------------------------------------------------------------------ */

const ESTADOS_META = {
  ACEPTADO:  { label: 'Aceptado',  color: '#22c55e' },
  OBSERVADO: { label: 'Observado', color: '#38bdf8' },
  ENVIADO:   { label: 'En proceso', color: '#f59e0b' },
  PENDIENTE: { label: 'Pendiente', color: '#94a3b8' },
  RECHAZADO: { label: 'Rechazado', color: '#ef4444' },
  ERROR:     { label: 'Error',     color: '#dc2626' },
  ANULADA:   { label: 'Anulada',   color: '#a855f7' },
  BAJA:      { label: 'Baja',      color: '#64748b' },
  GENERADO:  { label: 'Generado',  color: '#94a3b8' },
};
const estadoMeta = (e) => ESTADOS_META[String(e || '').toUpperCase()] || { label: e || '—', color: '#94a3b8' };

const CLASES = {
  FACTURA:      { label: 'Factura',          sigla: 'FAC', color: '#6366f1' },
  NOTA_CREDITO: { label: 'Nota de Crédito',  sigla: 'N/C', color: '#f59e0b' },
  NOTA_DEBITO:  { label: 'Nota de Débito',   sigla: 'N/D', color: '#0ea5e9' },
  GUIA:         { label: 'Guía de Remisión', sigla: 'GRE', color: '#14b8a6' },
};

// Catálogo 09 (motivos de nota de crédito).
const MOTIVOS_NC = {
  '01': 'Anulación de la operación', '02': 'Anulación por error en el RUC',
  '03': 'Corrección por error en la descripción', '04': 'Descuento global',
  '05': 'Descuento por ítem', '06': 'Devolución total', '07': 'Devolución por ítem',
  '08': 'Bonificación', '09': 'Disminución en el valor', '10': 'Otros conceptos',
  '11': 'Ajustes de operaciones de exportación', '12': 'Ajustes afectos al SPOT', '13': 'Ajuste - montos y/o fechas de pago',
};
// Catálogo 10 (motivos de nota de débito).
const MOTIVOS_ND = {
  '01': 'Intereses por mora', '02': 'Aumento en el valor', '03': 'Penalidades / otros conceptos',
  '11': 'Ajustes de operaciones de exportación',
};
// Catálogo 20 (motivo de traslado de la guía).
const MOTIVOS_TRASLADO = {
  '01': 'Venta', '02': 'Compra', '04': 'Traslado entre establecimientos de la misma empresa',
  '08': 'Importación', '09': 'Exportación', '13': 'Otros', '14': 'Venta sujeta a confirmación',
  '18': 'Traslado emisor itinerante CP', '19': 'Traslado a zona primaria',
};

const fmtFecha = (v, opts = {}) => v == null ? '—'
  : new Date(v).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', ...opts });
const fmtDia = (v) => fmtFecha(v, { hour: undefined, minute: undefined });
const fmtMoneda = (valor, moneda) => {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  try { return new Intl.NumberFormat('es-PE', { style: 'currency', currency: (moneda || 'PEN').toUpperCase() }).format(n); }
  catch { return `${moneda || ''} ${n.toFixed(2)}`; }
};

function Badge({ estado }) {
  const meta = estadoMeta(estado);
  return (
    <span className="tz-badge" style={{ '--c': meta.color }}>
      <i /> {meta.label}
    </span>
  );
}

function TipoTag({ clase }) {
  const meta = CLASES[clase] || CLASES.FACTURA;
  return <span className="tz-tipo" style={{ '--c': meta.color }} title={meta.label}>{meta.sigla}</span>;
}

function IconBtn({ icon: Icon, label, onClick, disabled }) {
  return (
    <button type="button" className="tz-iconbtn" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      <Icon size={15} />
    </button>
  );
}

/* ----------------------------- Drawer de orden ---------------------------- */
function OrdenDrawer({ idOrden, onClose }) {
  const navigate = useNavigate();
  const [estado, setEstado] = useState({ loading: true, error: null, orden: null, facturas: [], guias: [] });

  useEffect(() => {
    let vivo = true;
    setEstado({ loading: true, error: null, orden: null, facturas: [], guias: [] });
    (async () => {
      try {
        const [ovRes, facRes, greRes] = await Promise.allSettled([
          ordenesVentaAPI.getById(idOrden),
          ordenesVentaAPI.getFacturas(idOrden),
          guiasRemisionAPI.getAll({ id_orden_venta: idOrden }),
        ]);
        if (!vivo) return;
        const orden = ovRes.status === 'fulfilled' ? (ovRes.value.data?.data || ovRes.value.data) : null;
        const facturas = facRes.status === 'fulfilled' ? (facRes.value.data?.data || []) : [];
        const guias = greRes.status === 'fulfilled' ? (greRes.value.data?.data || []) : [];
        if (!orden) throw new Error('No se pudo cargar la orden asociada.');
        setEstado({ loading: false, error: null, orden, facturas, guias });
      } catch (e) {
        if (vivo) setEstado({ loading: false, error: e?.response?.data?.error || e.message, orden: null, facturas: [], guias: [] });
      }
    })();
    return () => { vivo = false; };
  }, [idOrden]);

  const { loading, error, orden, facturas, guias } = estado;
  const items = orden?.detalle || [];

  return (
    <div className="tz-drawer-scrim" onClick={onClose}>
      <aside className="tz-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Detalle de la orden">
        <header className="tz-drawer-head">
          <div>
            <span className="tz-eyebrow">Orden de venta</span>
            <h2>{orden?.numero_orden || (loading ? 'Cargando…' : `#${idOrden}`)}</h2>
          </div>
          <button className="tz-drawer-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        {loading && <div className="tz-drawer-loading"><Loader2 className="tz-spin" size={22} /><span>Cargando orden…</span></div>}
        {error && <div className="tz-inline-error"><XCircle size={16} /> {error}</div>}

        {!loading && orden && (
          <div className="tz-drawer-body">
            <section className="tz-drawer-card">
              <div className="tz-kv"><span>Cliente</span><strong>{orden.cliente || '—'}</strong></div>
              <div className="tz-kv"><span>RUC / DNI</span><strong>{orden.ruc_cliente || '—'}</strong></div>
              <div className="tz-kv"><span>Estado</span><strong>{orden.estado || '—'}</strong></div>
              <div className="tz-kv"><span>Fecha</span><strong>{fmtDia(orden.fecha_emision || orden.fecha_creacion)}</strong></div>
              <div className="tz-kv"><span>Moneda</span><strong>{orden.moneda || 'PEN'}</strong></div>
              <div className="tz-kv"><span>Total</span><strong>{fmtMoneda(orden.total, orden.moneda)}</strong></div>
              {orden.orden_compra_cliente && <div className="tz-kv"><span>OC cliente</span><strong>{orden.orden_compra_cliente}</strong></div>}
              {orden.comercial && <div className="tz-kv"><span>Comercial</span><strong>{orden.comercial}</strong></div>}
            </section>

            <section>
              <div className="tz-drawer-subtitle"><Package size={14} /> Ítems <b>{items.length}</b></div>
              <div className="tz-mini-table">
                <div className="tz-mini-head"><span>Producto</span><span>Cant.</span><span>P. Unit.</span><span>Subtotal</span></div>
                {items.length ? items.map((it) => (
                  <div className="tz-mini-row" key={it.id_detalle}>
                    <span className="tz-mini-prod"><b>{it.producto}</b><small>{it.codigo_producto}</small></span>
                    <span>{Number(it.cantidad).toLocaleString('es-PE')}</span>
                    <span>{fmtMoneda(it.precio_unitario, orden.moneda)}</span>
                    <span>{fmtMoneda(it.subtotal ?? it.valor_venta, orden.moneda)}</span>
                  </div>
                )) : <div className="tz-mini-empty">Sin ítems registrados.</div>}
              </div>
            </section>

            <section>
              <div className="tz-drawer-subtitle"><FileText size={14} /> Comprobantes <b>{facturas.length}</b></div>
              {facturas.length ? (
                <ul className="tz-doc-list">
                  {facturas.map((f) => (
                    <li key={f.id_factura}>
                      <span className="tz-doc-id">{f.numero_factura || `${f.serie}-${f.numero}`}</span>
                      <Badge estado={f.estado === 'Anulada' ? 'ANULADA' : (f.sunat_estado || 'ACEPTADO')} />
                      <span className="tz-doc-monto">{fmtMoneda(f.total, f.moneda)}</span>
                    </li>
                  ))}
                </ul>
              ) : <div className="tz-mini-empty">Sin comprobantes.</div>}
            </section>

            <section>
              <div className="tz-drawer-subtitle"><Truck size={14} /> Guías de remisión <b>{guias.length}</b></div>
              {guias.length ? (
                <ul className="tz-doc-list">
                  {guias.map((g) => (
                    <li key={g.id_guia}>
                      <span className="tz-doc-id">{(g.serie_sunat && g.numero_sunat) ? `${g.serie_sunat}-${g.numero_sunat}` : g.numero_guia}</span>
                      <Badge estado={g.estado === 'Anulada' ? 'ANULADA' : (g.sunat_estado || 'GENERADO')} />
                    </li>
                  ))}
                </ul>
              ) : <div className="tz-mini-empty">Sin guías.</div>}
            </section>
          </div>
        )}

        <footer className="tz-drawer-foot">
          <button className="tz-btn tz-btn-primary" onClick={() => navigate(`/ventas/ordenes/${idOrden}`)}>
            Abrir orden completa <ArrowUpRight size={15} />
          </button>
        </footer>
      </aside>
    </div>
  );
}

/* ------------------------------ Página principal -------------------------- */
const TABS = [
  { id: 'comprobantes', label: 'Comprobantes', icon: FileText },
  { id: 'guias', label: 'Guías de Remisión', icon: Truck },
  { id: 'descarga', label: 'Descarga masiva', icon: DownloadCloud },
];
const ESTADO_OPCIONES = ['all', 'ACEPTADO', 'ENVIADO', 'OBSERVADO', 'RECHAZADO', 'ERROR', 'ANULADA', 'PENDIENTE'];

export default function TrazabilidadSee() {
  const [tab, setTab] = useState('comprobantes');
  const [filtros, setFiltros] = useState({ tipo: 'all', estado: 'all', desde: '', hasta: '', q: '' });
  const [busqueda, setBusqueda] = useState('');
  const [data, setData] = useState([]);
  const [resumen, setResumen] = useState({ total: 0, porEstado: {}, porClase: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [drawerOrden, setDrawerOrden] = useState(null);
  const [aviso, setAviso] = useState(null);
  const reqId = useRef(0);

  // Debounce del buscador → filtros.q.
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => ({ ...f, q: busqueda.trim() })), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  // El servidor filtra por tipo/fecha/texto; el estado se resuelve en cliente sobre `estado_final`
  // (que reconoce ANULADA por NC, BAJA y facturas manuales aceptadas), y así los chips de estado
  // muestran siempre la distribución completa sin recargar.
  const cargar = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true); setError(null);
    try {
      const payload = tab === 'comprobantes'
        ? { tipo: filtros.tipo, desde: filtros.desde, hasta: filtros.hasta, q: filtros.q }
        : { desde: filtros.desde, hasta: filtros.hasta, q: filtros.q };
      const res = tab === 'comprobantes'
        ? await sunatAPI.trazabilidadComprobantes(payload)
        : await sunatAPI.trazabilidadGuias(payload);
      if (id !== reqId.current) return; // respuesta obsoleta
      setData(res.data?.data || []);
      setResumen(res.data?.resumen || { total: 0, porEstado: {}, porClase: {} });
    } catch (e) {
      if (id !== reqId.current) return;
      setError(e?.response?.data?.error || e.message || 'No se pudo cargar la trazabilidad.');
      setData([]); setResumen({ total: 0, porEstado: {}, porClase: {} });
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [tab, filtros.tipo, filtros.desde, filtros.hasta, filtros.q]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setExpandido(null); }, [tab, filtros]);

  const visibles = useMemo(
    () => filtros.estado === 'all' ? data : data.filter((r) => r.estado_final === filtros.estado),
    [data, filtros.estado]
  );

  const cambiarTab = (id) => {
    if (id === tab) return;
    setTab(id);
    setFiltros((f) => ({ ...f, tipo: 'all', estado: 'all' }));
    setExpandido(null);
  };
  const limpiar = () => { setBusqueda(''); setFiltros({ tipo: 'all', estado: 'all', desde: '', hasta: '', q: '' }); };
  const hayFiltros = filtros.tipo !== 'all' || filtros.estado !== 'all' || filtros.desde || filtros.hasta || filtros.q;

  const descargar = useCallback(async (accion, etiqueta) => {
    try { setAviso(null); await accion(); }
    catch (e) { setAviso(`No se pudo descargar ${etiqueta}: ${e?.response?.data?.error || e.message || 'error'}`); }
  }, []);

  const chips = useMemo(() => Object.entries(resumen.porEstado || {})
    .sort((a, b) => b[1] - a[1]), [resumen]);

  return (
    <main className="tz-page">
      <header className="tz-header">
        <div className="tz-heading">
          <span className="tz-eyebrow"><ShieldCheck size={13} /> Facturación Electrónica</span>
          <h1>Trazabilidad SEE</h1>
          <p>Historial detallado y auditable de comprobantes y guías: emisión, aceptación, rechazo, anulación y bajas ante SUNAT.</p>
        </div>
        <button className="tz-refresh" onClick={cargar} disabled={loading} title="Actualizar">
          <RefreshCw className={loading ? 'tz-spin' : ''} size={16} /> Actualizar
        </button>
      </header>

      <div className="tz-tabs" role="tablist">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} role="tab" aria-selected={tab === t.id}
              className={`tz-tab ${tab === t.id ? 'active' : ''}`} onClick={() => cambiarTab(t.id)}>
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab !== 'descarga' && (<>
      <section className="tz-toolbar">
        <div className="tz-search">
          <Search size={15} />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar documento, cliente, RUC u orden…" />
          {busqueda && <button className="tz-search-clear" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda"><X size={13} /></button>}
        </div>
        <div className="tz-filters">
          {tab === 'comprobantes' && (
            <label className="tz-field">
              <Layers size={13} />
              <select value={filtros.tipo} onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value }))}>
                <option value="all">Todo tipo</option>
                <option value="FACTURA">Facturas</option>
                <option value="NOTA_CREDITO">Notas de crédito</option>
                <option value="NOTA_DEBITO">Notas de débito</option>
              </select>
            </label>
          )}
          <label className="tz-field">
            <Filter size={13} />
            <select value={filtros.estado} onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}>
              {ESTADO_OPCIONES.map((e) => <option key={e} value={e}>{e === 'all' ? 'Todo estado' : estadoMeta(e).label}</option>)}
            </select>
          </label>
          <label className="tz-field tz-field-date">
            <CalendarDays size={13} />
            <input type="date" value={filtros.desde} onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))} title="Desde" />
          </label>
          <label className="tz-field tz-field-date">
            <span className="tz-date-sep">→</span>
            <input type="date" value={filtros.hasta} onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))} title="Hasta" />
          </label>
          <button className="tz-btn tz-btn-ghost" onClick={limpiar} disabled={!hayFiltros}>
            <RotateCcw size={14} /> Limpiar
          </button>
        </div>
      </section>

      <section className="tz-chips">
        <span className={`tz-chip total ${filtros.estado === 'all' ? 'on' : ''}`}
          onClick={() => setFiltros((f) => ({ ...f, estado: 'all' }))}>
          <b>{resumen.total}</b> {tab === 'comprobantes' ? 'comprobantes' : 'guías'}
        </span>
        {chips.map(([est, n]) => {
          const meta = estadoMeta(est);
          return (
            <span key={est} className={`tz-chip ${filtros.estado === est ? 'on' : ''}`} style={{ '--c': meta.color }}
              onClick={() => setFiltros((f) => ({ ...f, estado: f.estado === est ? 'all' : est }))}>
              <i /> {meta.label} <b>{n}</b>
            </span>
          );
        })}
      </section>

      {aviso && <div className="tz-toast" onClick={() => setAviso(null)}><XCircle size={15} /> {aviso}</div>}

      <section className="tz-table-wrap">
        {error ? (
          <div className="tz-state"><XCircle size={26} /><strong>No se pudo cargar</strong><span>{error}</span>
            <button className="tz-btn tz-btn-primary" onClick={cargar}>Reintentar</button></div>
        ) : loading && !data.length ? (
          <div className="tz-state"><Loader2 className="tz-spin" size={26} /><strong>Cargando trazabilidad…</strong></div>
        ) : !visibles.length ? (
          <div className="tz-state"><FileCheck2 size={26} /><strong>Sin resultados</strong>
            <span>{hayFiltros ? 'Ajusta los filtros para ver más documentos.' : 'Aún no hay documentos emitidos.'}</span></div>
        ) : tab === 'comprobantes'
          ? <TablaComprobantes data={visibles} expandido={expandido} setExpandido={setExpandido} onOrden={setDrawerOrden} onDescargar={descargar} />
          : tab === 'guias'
          ? <TablaGuias data={visibles} expandido={expandido} setExpandido={setExpandido} onOrden={setDrawerOrden} onDescargar={descargar} />
          : null}
      </section>
      </>)}

      {tab === 'descarga' && (
        <PanelDescargaMasiva onDescargarUno={descargar} />
      )}

      {drawerOrden && <OrdenDrawer idOrden={drawerOrden} onClose={() => setDrawerOrden(null)} />}
    </main>
  );
}

/* ----------------------------- Tabla comprobantes ------------------------- */
function TablaComprobantes({ data, expandido, setExpandido, onOrden, onDescargar }) {
  return (
    <table className="tz-table">
      <thead>
        <tr>
          <th className="tz-col-exp" />
          <th>Documento</th>
          <th>Emisión</th>
          <th>Cliente</th>
          <th>Orden</th>
          <th className="tz-num">Total</th>
          <th>Estado</th>
          <th>Motivo / Respuesta</th>
          <th className="tz-col-acc">Archivos</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r) => {
          const abierto = expandido === r.id_factura;
          const motivo = r.clase === 'NOTA_CREDITO' ? MOTIVOS_NC[r.motivo_nota_codigo]
            : r.clase === 'NOTA_DEBITO' ? MOTIVOS_ND[r.motivo_nota_codigo] : null;
          const respuesta = r.estado_final === 'ANULADA' ? (r.motivo_anulacion || 'Anulada')
            : (r.sunat_response_desc || (motivo ? '' : '—'));
          return (
            <Fragment key={r.id_factura}>
              <tr className={`tz-row ${abierto ? 'open' : ''}`} onClick={() => setExpandido(abierto ? null : r.id_factura)}>
                <td className="tz-col-exp">{abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                <td>
                  <div className="tz-doc"><TipoTag clase={r.clase} /><b>{r.documento}</b></div>
                  {r.es_manual && <span className="tz-tag-manual">registro manual</span>}
                  {r.es_exportacion === 1 && <span className="tz-tag-exp">exportación</span>}
                </td>
                <td className="tz-nowrap">{fmtDia(r.fecha_emision)}</td>
                <td><div className="tz-cli"><b>{r.cliente || '—'}</b><small>{r.ruc_cliente || ''}</small></div></td>
                <td>
                  {r.id_orden_venta
                    ? <button className="tz-link" onClick={(e) => { e.stopPropagation(); onOrden(r.id_orden_venta); }}>
                        {r.numero_orden || `#${r.id_orden_venta}`} <Link2 size={13} />
                      </button>
                    : <span className="tz-muted">—</span>}
                </td>
                <td className="tz-num tz-nowrap">{fmtMoneda(r.total, r.moneda)}</td>
                <td><Badge estado={r.estado_final} /></td>
                <td className="tz-motivo">
                  {motivo && <span className="tz-motivo-cod">{r.motivo_nota_codigo} · {motivo}</span>}
                  {respuesta && <span className="tz-motivo-desc">{respuesta}</span>}
                  {r.ref_documento && r.ref_documento !== 'null-null' &&
                    <span className="tz-ref">afecta {r.ref_documento}</span>}
                </td>
                <td className="tz-col-acc" onClick={(e) => e.stopPropagation()}>
                  <div className="tz-acc">
                    <IconBtn icon={FileText} label="PDF" onClick={() => onDescargar(() => sunatAPI.verPdfComprobante(r.id_factura), 'el PDF')} />
                    <IconBtn icon={Download} label="XML" disabled={!r.xml_url}
                      onClick={() => onDescargar(() => sunatAPI.descargarArchivoUrl(r.xml_url, `${r.documento}.xml`), 'el XML')} />
                    <IconBtn icon={FileCheck2} label="CDR" disabled={!r.cdr_url}
                      onClick={() => onDescargar(() => sunatAPI.descargarArchivoUrl(r.cdr_url, `R-${r.documento}.zip`), 'el CDR')} />
                  </div>
                </td>
              </tr>
              {abierto && (
                <tr className="tz-detail-row">
                  <td colSpan={9}>
                    <div className="tz-detail">
                      <DetItem label="Tipo" value={(CLASES[r.clase] || {}).label} />
                      <DetItem label="Serie · Número" value={r.documento} />
                      <DetItem label="Moneda" value={r.moneda} />
                      <DetItem label="Subtotal" value={fmtMoneda(r.subtotal, r.moneda)} />
                      <DetItem label="IGV" value={fmtMoneda(r.igv, r.moneda)} />
                      <DetItem label="Total" value={fmtMoneda(r.total, r.moneda)} />
                      <DetItem label="Código SUNAT" value={r.sunat_response_code || '—'} />
                      <DetItem label="Ticket" value={r.sunat_ticket || '—'} />
                      <DetItem label="Enviado" value={r.sunat_fecha_envio ? fmtFecha(r.sunat_fecha_envio, { hour: '2-digit', minute: '2-digit' }) : '—'} />
                      <DetItem label="Registrado por" value={r.registrado_por || '—'} />
                      {r.estado_final === 'ANULADA' && <>
                        <DetItem label="Anulado por" value={r.anulado_por || (r.anulada_por_nc ? 'Nota de crédito' : '—')} />
                        <DetItem label="Fecha anulación" value={r.fecha_anulacion ? fmtDia(r.fecha_anulacion) : '—'} />
                      </>}
                      {(r.sunat_response_desc || r.motivo_anulacion) &&
                        <DetItem wide label="Respuesta SUNAT / Motivo" value={r.sunat_response_desc || r.motivo_anulacion} />}
                      {r.observaciones && <DetItem wide label="Observaciones" value={r.observaciones} />}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

/* -------------------------------- Tabla guías ----------------------------- */
function TablaGuias({ data, expandido, setExpandido, onOrden, onDescargar }) {
  return (
    <table className="tz-table">
      <thead>
        <tr>
          <th className="tz-col-exp" />
          <th>Guía</th>
          <th>Emisión</th>
          <th>Cliente</th>
          <th>Orden</th>
          <th>Traslado</th>
          <th className="tz-num">Ítems</th>
          <th>Estado</th>
          <th>Respuesta</th>
          <th className="tz-col-acc">Archivos</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r) => {
          const abierto = expandido === r.id_guia;
          const traslado = MOTIVOS_TRASLADO[r.motivo_traslado_cod] || (r.motivo_traslado_cod ? `Cód. ${r.motivo_traslado_cod}` : '—');
          const respuesta = r.estado_final === 'ANULADA' ? (r.motivo_anulacion || 'Dejada sin efecto')
            : (r.sunat_response_desc || '—');
          return (
            <Fragment key={r.id_guia}>
              <tr className={`tz-row ${abierto ? 'open' : ''}`} onClick={() => setExpandido(abierto ? null : r.id_guia)}>
                <td className="tz-col-exp">{abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                <td><div className="tz-doc"><TipoTag clase="GUIA" /><b>{r.documento}</b></div></td>
                <td className="tz-nowrap">{fmtDia(r.fecha_emision)}</td>
                <td><div className="tz-cli"><b>{r.cliente || '—'}</b><small>{r.ruc_cliente || ''}</small></div></td>
                <td>
                  {r.id_orden_venta
                    ? <button className="tz-link" onClick={(e) => { e.stopPropagation(); onOrden(r.id_orden_venta); }}>
                        {r.numero_orden || `#${r.id_orden_venta}`} <Link2 size={13} />
                      </button>
                    : <span className="tz-muted">—</span>}
                </td>
                <td className="tz-nowrap">{traslado}</td>
                <td className="tz-num">{r.total_items ?? '—'}</td>
                <td><Badge estado={r.estado_final} /></td>
                <td className="tz-motivo"><span className="tz-motivo-desc">{respuesta}</span></td>
                <td className="tz-col-acc" onClick={(e) => e.stopPropagation()}>
                  <div className="tz-acc">
                    <IconBtn icon={FileText} label="PDF" onClick={() => onDescargar(() => sunatAPI.verPdfGuia(r.id_guia), 'el PDF')} />
                    <IconBtn icon={Download} label="XML" disabled={!r.xml_url}
                      onClick={() => onDescargar(() => sunatAPI.descargarXmlGuia(r.id_guia), 'el XML')} />
                    <IconBtn icon={FileCheck2} label="CDR" disabled={!r.cdr_url}
                      onClick={() => onDescargar(() => sunatAPI.descargarCdrGuia(r.id_guia), 'el CDR')} />
                  </div>
                </td>
              </tr>
              {abierto && (
                <tr className="tz-detail-row">
                  <td colSpan={10}>
                    <div className="tz-detail">
                      <DetItem label="Serie · Número" value={r.documento} />
                      <DetItem label="Nº interno" value={r.numero_guia || '—'} />
                      <DetItem label="Motivo traslado" value={traslado} />
                      <DetItem label="Peso bruto (kg)" value={r.peso_bruto_total ?? r.peso_bruto_kg ?? '—'} />
                      <DetItem label="Código SUNAT" value={r.sunat_response_code || '—'} />
                      <DetItem label="Enviado" value={r.sunat_fecha_envio ? fmtFecha(r.sunat_fecha_envio, { hour: '2-digit', minute: '2-digit' }) : '—'} />
                      {r.estado_final === 'ANULADA' && <>
                        <DetItem label="Anulado por" value={r.anulado_por || '—'} />
                        <DetItem label="Fecha anulación" value={r.fecha_anulacion ? fmtDia(r.fecha_anulacion) : '—'} />
                        <DetItem label="Baja confirmada" value={Number(r.baja_sunat_confirmada) === 1 ? 'Sí' : 'No'} />
                      </>}
                      {r.direccion_llegada && <DetItem wide label="Punto de llegada" value={r.direccion_llegada} />}
                      {(r.sunat_response_desc || r.motivo_anulacion) &&
                        <DetItem wide label="Respuesta SUNAT / Motivo" value={r.sunat_response_desc || r.motivo_anulacion} />}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

/* ------------------------- Pestaña: descarga masiva ----------------------- */
function PanelDescargaMasiva({ onDescargarUno }) {
  const { estado: estadoDescarga, iniciarDescarga } = useDescargaMasiva();
  const [rango, setRango] = useState({ desde: '', hasta: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [consultado, setConsultado] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [modal, setModal] = useState(false);
  const [aviso, setAviso] = useState(null);

  const consultar = useCallback(async () => {
    if (!rango.desde || !rango.hasta) { setError('Elige la fecha de inicio y de fin.'); return; }
    setLoading(true); setError(null); setSel(new Set());
    try {
      const res = await sunatAPI.trazabilidadComprobantes({ desde: rango.desde, hasta: rango.hasta, solo_sistema: 1 });
      setRows(res.data?.data || []);
      setConsultado(true);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'No se pudo consultar.');
      setRows([]);
    } finally { setLoading(false); }
  }, [rango.desde, rango.hasta]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todos = rows.length > 0 && sel.size === rows.length;
  const toggleTodos = () => setSel(todos ? new Set() : new Set(rows.map((r) => r.id_factura)));

  const abrirModal = () => {
    if (!soportaDescargaCarpetas()) { setAviso('Tu navegador no permite descargar carpetas. Usa Google Chrome o Microsoft Edge.'); return; }
    if (!sel.size) { setAviso('Selecciona al menos un comprobante.'); return; }
    setAviso(null); setModal(true);
  };

  const confirmar = async (opciones) => {
    setModal(false);
    const elegidos = rows.filter((r) => sel.has(r.id_factura))
      .map((r) => ({ id_factura: r.id_factura, documento: r.documento, xml_url: r.xml_url, cdr_url: r.cdr_url }));
    try {
      await iniciarDescarga(elegidos, opciones, rango);
    } catch (e) {
      setAviso(e?.message || 'No se pudo iniciar la descarga.');
    }
  };

  const hayResultados = consultado && !loading && !error && rows.length > 0;

  return (
    <div className="tz-descarga">
      {/* Paso 1 — consulta por rango de fechas */}
      <div className="tz-dm-consulta">
        <div className="tz-dm-consulta-lead">
          <span className="tz-eyebrow"><CalendarDays size={13} /> Rango de emisión</span>
          <p>Elige inicio y fin para listar tus comprobantes emitidos electrónicamente.</p>
        </div>
        <div className="tz-dm-consulta-form">
          <label className="tz-field tz-field-date">
            <CalendarDays size={13} />
            <input type="date" value={rango.desde} onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))} title="Fecha de inicio" />
          </label>
          <span className="tz-date-sep">→</span>
          <label className="tz-field tz-field-date">
            <input type="date" value={rango.hasta} onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))} title="Fecha de fin" />
          </label>
          <button className="tz-btn tz-btn-primary" onClick={consultar} disabled={loading}>
            {loading ? <Loader2 className="tz-spin" size={15} /> : <Search size={15} />} Consultar
          </button>
        </div>
      </div>

      {aviso && <div className="tz-toast" onClick={() => setAviso(null)}><XCircle size={15} /> {aviso}</div>}
      {estadoDescarga.activa && (
        <div className="tz-descarga-nota">
          <Loader2 className="tz-spin" size={14} />
          Descarga en curso — puedes seguir usando el sistema; no cierres ni recargues esta pestaña.
        </div>
      )}

      {/* Paso 2 — barra de acción: selección + descarga */}
      {hayResultados && (
        <div className={`tz-dm-actionbar ${sel.size ? 'has-sel' : ''}`}>
          <div className="tz-dm-count">
            {sel.size > 0
              ? <><b>{sel.size}</b> de {rows.length} seleccionado(s)</>
              : <>{rows.length} comprobante(s) — marca los que quieras descargar</>}
          </div>
          {sel.size > 0 && (
            <button className="tz-dm-clear" onClick={() => setSel(new Set())}>Limpiar selección</button>
          )}
          <button className="tz-btn tz-btn-download" onClick={abrirModal} disabled={!sel.size || estadoDescarga.activa}>
            <DownloadCloud size={15} /> Descargar{sel.size > 0 ? ` (${sel.size})` : ''}
          </button>
        </div>
      )}

      {/* Paso 3 — estados / tabla */}
      {error ? (
        <div className="tz-state"><XCircle size={26} /><strong>No se pudo consultar</strong><span>{error}</span></div>
      ) : loading ? (
        <div className="tz-state"><Loader2 className="tz-spin" size={26} /><strong>Consultando…</strong></div>
      ) : !consultado ? (
        <div className="tz-state"><CalendarDays size={26} /><strong>Elige un rango de fechas</strong><span>Selecciona inicio y fin, luego pulsa Consultar para ver tus comprobantes.</span></div>
      ) : !rows.length ? (
        <div className="tz-state"><FileCheck2 size={26} /><strong>Sin comprobantes</strong><span>No hay comprobantes emitidos por el sistema en ese rango.</span></div>
      ) : (
        <div className="tz-table-wrap">
          <table className="tz-table tz-table-descarga">
            <thead>
              <tr>
                <th className="tz-col-check">
                  <input type="checkbox" checked={todos} ref={(el) => { if (el) el.indeterminate = sel.size > 0 && !todos; }}
                    onChange={toggleTodos} title="Seleccionar todo" aria-label="Seleccionar todo" />
                </th>
                <th>Fecha emisión</th>
                <th>Nº comprobante</th>
                <th>Receptor</th>
                <th className="tz-num">Importe</th>
                <th>Fecha rechazo</th>
                <th>Anulado</th>
                <th className="tz-col-acc">Archivos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id_factura} className={`tz-dm-row ${sel.has(r.id_factura) ? 'sel' : ''}`}
                  style={{ '--i': Math.min(i, 24) }} onClick={() => toggle(r.id_factura)}>
                  <td className="tz-col-check">
                    <input type="checkbox" checked={sel.has(r.id_factura)} onChange={() => toggle(r.id_factura)}
                      onClick={(e) => e.stopPropagation()} aria-label={`Seleccionar ${r.documento}`} />
                  </td>
                  <td className="tz-nowrap">{fmtDia(r.fecha_emision)}</td>
                  <td><div className="tz-doc"><TipoTag clase={r.clase} /><b>{r.documento}</b></div></td>
                  <td><div className="tz-cli"><b>{r.cliente || '—'}</b><small>{r.ruc_cliente || ''}</small></div></td>
                  <td className="tz-num tz-nowrap">{fmtMoneda(r.total, r.moneda)}</td>
                  <td className="tz-nowrap">{r.estado_final === 'RECHAZADO' && r.sunat_fecha_envio ? fmtDia(r.sunat_fecha_envio) : <span className="tz-muted">—</span>}</td>
                  <td>{r.estado_final === 'ANULADA' ? <span className="tz-anulado-si">Sí</span> : <span className="tz-muted">No</span>}</td>
                  <td className="tz-col-acc" onClick={(e) => e.stopPropagation()}>
                    <div className="tz-acc">
                      <IconBtn icon={FileText} label="Ver CP (PDF)" onClick={() => onDescargarUno(() => sunatAPI.verPdfComprobante(r.id_factura), 'el PDF')} />
                      <IconBtn icon={Download} label="XML" disabled={!r.xml_url}
                        onClick={() => onDescargarUno(() => sunatAPI.descargarArchivoUrl(r.xml_url, `${r.documento}.xml`), 'el XML')} />
                      <IconBtn icon={FileCheck2} label="CDR" disabled={!r.cdr_url}
                        onClick={() => onDescargarUno(() => sunatAPI.descargarArchivoUrl(r.cdr_url, `R-${r.documento}.zip`), 'el CDR')} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModalDescargaMasiva abierto={modal} cantidad={sel.size} onCerrar={() => setModal(false)} onConfirmar={confirmar} />
    </div>
  );
}

function DetItem({ label, value, wide }) {
  return (
    <div className={`tz-det-item ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
    </div>
  );
}
