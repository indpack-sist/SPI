import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Radar, Search, Upload, Users, Flame, Sparkles, UserCheck, Gauge,
  Phone, Mail, Globe, Building2, CheckCircle2, X, Loader,
  UserPlus, Trash2, Eye, AlertTriangle, Compass, Activity, Zap, FileSpreadsheet,
  EyeOff, RotateCcw, Lock, Unlock, Clock, History
} from 'lucide-react';
import { prospectosAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import './Prospectos.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Semáforo de potencial (0-100), unificado en todo el módulo:
//   🔴 Frío 0-44 · 🟡 Tibio 45-74 · 🟢 Caliente 75-100
const SCORE_CALIENTE = 75;
const SCORE_TIBIO = 45;
const colorScore = (s) => (s >= SCORE_CALIENTE ? '#2ecc71' : s >= SCORE_TIBIO ? '#e8b84b' : '#e74c3c');
const bandaScore = (s) => (s >= SCORE_CALIENTE ? 'Caliente' : s >= SCORE_TIBIO ? 'Tibio' : 'Frío');

const safeParse = (s) => { try { return JSON.parse(s); } catch { return {}; } };

// Fuente de imagen del prospecto: logo de su web (directo) o foto de
// Google Places (vía proxy del backend con token en la URL).
const imgSrc = (p) => {
  if (p.logo_url) return p.logo_url;
  if (p.foto_referencia) {
    const token = localStorage.getItem('token') || '';
    return `${API_URL}/prospectos-media/foto?ref=${encodeURIComponent(p.foto_referencia)}&token=${token}`;
  }
  return null;
};

function Thumb({ p, size = 34 }) {
  const src = imgSrc(p);
  if (!src) {
    return (
      <div className="pros-thumb pros-thumb-empty" style={{ width: size, height: size }}>
        <Building2 size={size * 0.5} />
      </div>
    );
  }
  return <img className="pros-thumb" style={{ width: size, height: size }} src={src} alt="" loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />;
}

// Rubros objetivo: empresas que COMPRAN empaque industrial (burbupack,
// stretch film, zunchos, esquineros, flejadoras…). Son negocios que mueven,
// paletizan o protegen carga. El valor es el término que se busca en Maps.
const RUBROS_OBJETIVO = [
  { label: 'Agroexportadoras', q: 'empresa agroexportadora' },
  { label: 'Operadores logísticos / almacenes', q: 'operador logistico almacen' },
  { label: 'Centros de distribución', q: 'centro de distribucion' },
  { label: 'E-commerce / tiendas online', q: 'empresa ecommerce tienda online' },
  { label: 'Courier / paquetería', q: 'empresa courier paqueteria' },
  { label: 'Empresas de mudanzas', q: 'empresa de mudanzas y embalaje' },
  { label: 'Procesadoras de alimentos', q: 'planta procesadora de alimentos' },
  { label: 'Plantas de bebidas', q: 'planta embotelladora de bebidas' },
  { label: 'Distribuidoras mayoristas', q: 'distribuidora mayorista' },
  { label: 'Importadoras', q: 'empresa importadora' },
  { label: 'Fábricas / industrias', q: 'fabrica industrial' },
  { label: 'Electrodomésticos / electrónica', q: 'distribuidora de electrodomesticos' },
  { label: 'Vidrios / cerámicos', q: 'fabrica de vidrios y ceramicos' },
  { label: 'Fábricas de muebles', q: 'fabrica de muebles' },
  { label: 'Laboratorios / farmacéutica', q: 'laboratorio farmaceutico' },
  { label: 'Ferreterías industriales', q: 'ferreteria industrial' },
];

// Los 25 departamentos del Perú (incluye Callao) para el selector de zonas del
// descubrimiento. Se envían a Google como "<Departamento>, Perú".
const DEPARTAMENTOS_PERU = [
  'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco',
  'Huancavelica', 'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 'Loreto',
  'Madre de Dios', 'Moquegua', 'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali',
];

const ESTADO_CHIP = {
  Nuevo:      { cls: 'chip-nuevo', label: 'Nuevo' },
  En_gestion: { cls: 'chip-gestion', label: 'En gestión' },
  Contactado: { cls: 'chip-contact', label: 'Contactado' },
  Convertido: { cls: 'chip-conv', label: 'Convertido' },
  Descartado: { cls: 'chip-desc', label: 'Descartado' },
};

function ScoreRing({ score }) {
  const c = colorScore(score);
  return (
    <div
      className="pros-ring"
      style={{ background: `conic-gradient(${c} ${score * 3.6}deg, var(--steel) 0deg)` }}
      title={`Potencial ${score}/100 · ${bandaScore(score)}`}
    >
      <span style={{ color: c }}>{score}</span>
    </div>
  );
}

function DupBadge({ flag }) {
  if (flag === 'Ya_cliente') return <span className="pros-chip chip-yacli"><UserCheck size={11} /> Ya cliente</span>;
  if (flag === 'Posible_duplicado') return <span className="pros-chip chip-posdup"><AlertTriangle size={11} /> Posible dup.</span>;
  return null;
}

export default function Prospectos() {
  const { user } = useAuth();
  const [prospectos, setProspectos] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [barridos, setBarridos] = useState([]);

  const [search, setSearch] = useState('');
  const [fSegmento, setFSegmento] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fFlag, setFFlag] = useState('');
  const [fSector, setFSector] = useState('');
  const [fBusqueda, setFBusqueda] = useState('');
  const [fMinScore, setFMinScore] = useState(''); // umbral de potencial mínimo
  const [orden, setOrden] = useState('score');
  const [vista, setVista] = useState('activos'); // 'activos' | 'excluidos'
  const [facetas, setFacetas] = useState({ sectores: [], busquedas: [] });

  // Ingesta
  const [ingestaOpen, setIngestaOpen] = useState(false);
  const [ingestaTexto, setIngestaTexto] = useState('');
  const [ingestaSegmento, setIngestaSegmento] = useState('Formal');
  const [ingestaLoading, setIngestaLoading] = useState(false);
  const [ingestaRes, setIngestaRes] = useState(null);

  // Detalle
  const [detalle, setDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  // Conversion
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertData, setConvertData] = useState(null);
  const [convertLoading, setConvertLoading] = useState(false);

  // Descubrimiento (Google Places)
  const [descubrirOpen, setDescubrirOpen] = useState(false);
  const [descubrirData, setDescubrirData] = useState({ query: '', zonasSel: ['Lima'], otras: '', segmento: 'Formal', limite: 20, todos: true });
  const [descubrirLoading, setDescubrirLoading] = useState(false);

  // Panel de actividad (jobs)
  const [jobs, setJobs] = useState([]);
  const [jobsOpen, setJobsOpen] = useState(false);
  const completadosRef = useRef(new Set());

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { orden };
      if (search) params.search = search;
      if (fSegmento) params.segmento = fSegmento;
      if (fEstado) params.estado = fEstado;
      if (fFlag) params.flag = fFlag;
      if (fSector) params.sector = fSector;
      if (fBusqueda) params.busqueda = fBusqueda;
      if (fMinScore) params.min_score = fMinScore;
      if (vista === 'excluidos') params.vista = 'excluidos';
      const [lista, est] = await Promise.all([
        prospectosAPI.getAll(params),
        prospectosAPI.getEstadisticas(fMinScore ? { min_score: fMinScore } : undefined),
      ]);
      setProspectos(lista.data.data);
      setStats(est.data.data || {});
    } catch (err) {
      setError(err.error || 'Error al cargar prospectos');
    } finally {
      setLoading(false);
    }
  }, [search, fSegmento, fEstado, fFlag, fSector, fBusqueda, fMinScore, orden, vista]);

  useEffect(() => {
    const t = setTimeout(cargar, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [cargar, search]);

  // Facetas (sectores y búsquedas) para poblar los desplegables de filtro.
  const cargarFacetas = useCallback(async () => {
    try {
      const res = await prospectosAPI.getFacetas();
      setFacetas(res.data.data || { sectores: [], busquedas: [] });
    } catch { /* silencioso: si falla, los selects quedan vacíos */ }
  }, []);

  // Barridos previos por zona: para avisar si una zona ya fue explorada.
  const cargarBarridos = useCallback(async () => {
    try {
      const res = await prospectosAPI.getBarridos();
      setBarridos(res.data.data || []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { cargarFacetas(); cargarBarridos(); }, [cargarFacetas, cargarBarridos]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); };

  // Polling de jobs: refresca la cola y, cuando un job termina, recarga la lista.
  const refreshJobs = useCallback(async () => {
    try {
      const res = await prospectosAPI.getJobs();
      const data = res.data.data || [];
      setJobs(data);
      let algoTermino = false;
      for (const j of data) {
        if (j.estado === 'completado' && !completadosRef.current.has(j.id_job)) {
          completadosRef.current.add(j.id_job);
          algoTermino = true;
        }
      }
      if (algoTermino) { cargar(); cargarFacetas(); cargarBarridos(); }
      return data;
    } catch { return []; }
  }, [cargar, cargarFacetas, cargarBarridos]);

  useEffect(() => {
    refreshJobs();
    const hayActivos = jobs.some((j) => j.estado === 'pendiente' || j.estado === 'procesando');
    const cada = hayActivos || jobsOpen ? 4000 : 12000;
    const t = setInterval(refreshJobs, cada);
    return () => clearInterval(t);
  }, [refreshJobs, jobsOpen, jobs.length]);

  const jobsActivos = jobs.filter((j) => j.estado === 'pendiente' || j.estado === 'procesando').length;

  // Zonas finales a barrer: departamentos marcados (como "X, Perú") + otras
  // localidades sueltas escritas a mano (una por línea).
  const construirZonas = () => [
    ...(descubrirData.zonasSel || []).map((d) => `${d}, Perú`),
    ...(descubrirData.otras || '').split('\n').map((z) => z.trim()).filter(Boolean),
  ];

  const toggleDep = (dep) => setDescubrirData((d) => ({
    ...d,
    zonasSel: d.zonasSel.includes(dep) ? d.zonasSel.filter((x) => x !== dep) : [...d.zonasSel, dep],
  }));
  const marcarTodo = () => setDescubrirData((d) => ({ ...d, zonasSel: [...DEPARTAMENTOS_PERU] }));
  const desmarcarTodo = () => setDescubrirData((d) => ({ ...d, zonasSel: [] }));

  const hacerDescubrir = async () => {
    try {
      setDescubrirLoading(true);
      const zonasArr = construirZonas();
      const zonas = zonasArr.length ? zonasArr : ['Perú'];
      const { segmento, limite } = descubrirData;

      if (descubrirData.todos) {
        const res = await prospectosAPI.descubrirTodo({ zonas, segmento, limite });
        notify(res.data.message || 'Búsqueda masiva encolada.');
      } else {
        if (!descubrirData.query.trim()) { setError('Elige un rubro o escribe uno'); return; }
        for (const z of zonas) {
          await prospectosAPI.descubrir({ query: descubrirData.query, zona: z, segmento, limite });
        }
        notify(`Búsqueda encolada en ${zonas.length} zona(s).`);
      }
      setDescubrirOpen(false);
      setJobsOpen(true);
      refreshJobs();
    } catch (err) {
      setError(err.error || 'No se pudo iniciar el descubrimiento');
    } finally {
      setDescubrirLoading(false);
    }
  };

  const exportarExcel = async () => {
    if (prospectos.length === 0) { setError('No hay prospectos para exportar'); return; }
    const XLSX = await import('xlsx');
    const rows = prospectos.map((p) => ({
      Score: p.score,
      'Razón social': p.razon_social,
      Documento: p.documento || '',
      Segmento: p.segmento,
      Sector: p.sector || '',
      Estado: ESTADO_CHIP[p.estado_workflow]?.label || p.estado_workflow,
      Duplicado: p.flag_duplicado === 'Ya_cliente' ? 'Ya cliente' : p.flag_duplicado === 'Posible_duplicado' ? 'Posible duplicado' : '',
      Departamento: p.departamento || '',
      Provincia: p.provincia || '',
      Distrito: p.distrito || '',
      Teléfonos: p.telefonos || '',
      Emails: p.emails || '',
      Web: p.web || '',
      Asignado: p.empleado_asignado || '',
      Origen: p.origen,
      'Fecha captura': p.fecha_captura ? String(p.fecha_captura).replace('T', ' ').slice(0, 16) : '',
      'Por qué contactar': p.score_detalle?.por_que_contactar || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [6, 38, 13, 10, 20, 12, 16, 14, 16, 16, 22, 26, 26, 20, 12, 17, 60].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Prospectos');
    XLSX.writeFile(wb, `prospectos-${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify(`Exportados ${rows.length} prospectos a Excel`);
  };

  const enriquecer = async (id, web) => {
    try {
      await prospectosAPI.enriquecer(id, web ? { web } : {});
      notify('Enriquecimiento encolado (lectura de la web del prospecto).');
      setJobsOpen(true);
      refreshJobs();
    } catch (err) {
      setError(err.error || 'No se pudo enriquecer el prospecto');
    }
  };

  const excluir = async (id, excluido) => {
    try {
      await prospectosAPI.excluir(id, excluido);
      notify(excluido ? 'Prospecto excluido del descubrimiento' : 'Exclusión cancelada');
      setDetalle(null);
      cargar();
    } catch (err) {
      setError(err.error || 'No se pudo actualizar la exclusión');
    }
  };

  const hacerIngesta = async () => {
    try {
      setIngestaLoading(true);
      setIngestaRes(null);
      const res = await prospectosAPI.ingestaLista({ texto: ingestaTexto, segmento: ingestaSegmento });
      setIngestaRes(res.data.resumen);
      cargar();
    } catch (err) {
      setError(err.error || 'Error en la ingesta');
    } finally {
      setIngestaLoading(false);
    }
  };

  const verDetalle = async (id) => {
    try {
      setDetalleLoading(true);
      setDetalle({ id_prospecto: id });
      const res = await prospectosAPI.getById(id);
      setDetalle(res.data.data);
    } catch (err) {
      setError(err.error || 'Error al cargar el detalle');
      setDetalle(null);
    } finally {
      setDetalleLoading(false);
    }
  };

  // Recarga el detalle abierto (para reflejar dueño/historial actualizados).
  const refrescarDetalle = async (id) => {
    try {
      const res = await prospectosAPI.getById(id);
      setDetalle(res.data.data);
    } catch { /* noop */ }
  };

  const cambiarEstado = async (id, estado) => {
    try {
      await prospectosAPI.cambiarEstado(id, estado);
      notify('Estado actualizado');
      cargar();
      if (detalle?.id_prospecto === id) await refrescarDetalle(id);
    } catch (err) {
      setError(err.error || err.response?.data?.error || 'Error al cambiar estado');
      if (detalle?.id_prospecto === id) await refrescarDetalle(id);
    }
  };

  const descartar = async (id) => {
    if (!window.confirm('¿Descartar este prospecto?')) return;
    try {
      await prospectosAPI.descartar(id);
      notify('Prospecto descartado');
      setDetalle(null);
      cargar();
    } catch (err) {
      setError(err.error || err.response?.data?.error || 'Error al descartar');
    }
  };

  const liberar = async (id) => {
    try {
      await prospectosAPI.liberar(id);
      notify('Prospecto liberado. Ya puede gestionarlo otro usuario.');
      cargar();
      if (detalle?.id_prospecto === id) await refrescarDetalle(id);
    } catch (err) {
      setError(err.error || err.response?.data?.error || 'Error al liberar');
    }
  };

  const abrirConvertir = (p) => {
    setConvertData({
      id_prospecto: p.id_prospecto,
      razon_social: p.razon_social,
      documento: p.documento || '',
      tipo_documento: p.tipo_documento || (String(p.documento || '').length === 8 ? 'DNI' : 'RUC'),
      telefono: '',
      email: '',
      condicion_pago: 'Contado',
      dias_credito: 0,
    });
    setConvertOpen(true);
  };

  const confirmarConvertir = async () => {
    try {
      setConvertLoading(true);
      const res = await prospectosAPI.convertir(convertData.id_prospecto, convertData);
      notify(res.data.message || 'Cliente creado desde el prospecto');
      setConvertOpen(false);
      setDetalle(null);
      cargar();
    } catch (err) {
      setError(err.error || 'Error al convertir en cliente');
    } finally {
      setConvertLoading(false);
    }
  };

  const detalleSignals = detalle?.score_detalle?.señales || [];
  const detalleWhy = detalle?.score_detalle?.por_que_contactar;

  // Bloqueo por gestor: si otro usuario lo gestiona, se bloquea la edición.
  const esAdmin = user?.rol === 'Administrador';
  const detalleDueno = detalle?.id_gestor || null;
  const bloqueado = !!detalleDueno && Number(detalleDueno) !== Number(user?.id);
  const puedeLiberar = !!detalleDueno && (!bloqueado || esAdmin);
  const ACCION_LABEL = { estado: 'Cambió estado', liberar: 'Liberó la gestión', convertido: 'Convirtió a cliente' };

  // Aviso de barrido: zonas elegidas en el modal que ya fueron exploradas antes.
  const zonasElegidas = construirZonas();
  const barridosMap = new Map(barridos.map((b) => [String(b.zona || '').toLowerCase(), b]));
  const zonasYaBarridas = zonasElegidas
    .map((z) => barridosMap.get(z.toLowerCase()))
    .filter(Boolean);

  return (
    <div className="pros-wrap">
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Encabezado */}
      <div className="pros-head">
        <div>
          <div className="pros-title"><Radar size={26} /> Prospección de Ventas</div>
          <div className="pros-subtitle">Captación e inteligencia comercial de empresas · scoring y anti-duplicados</div>
        </div>
        <div className="pros-head-actions">
          <button className="btn btn-outline pros-activity-btn" onClick={() => setJobsOpen((v) => !v)} title="Actividad de búsquedas">
            <Activity size={16} /> Actividad
            {jobsActivos > 0 && <span className="pros-activity-dot">{jobsActivos}</span>}
          </button>
          <button className="btn btn-outline" onClick={() => setDescubrirOpen(true)}>
            <Compass size={16} /> Descubrir
          </button>
          <button className="btn btn-outline" onClick={exportarExcel} title="Exportar la vista actual a Excel">
            <FileSpreadsheet size={16} /> Excel
          </button>
          <button className="btn btn-primary" onClick={() => { setIngestaOpen(true); setIngestaRes(null); setIngestaTexto(''); }}>
            <Upload size={16} /> Ingresar RUCs
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="pros-stats">
        <div className="pros-stat">
          <div className="pros-stat-ico ico-total"><Users size={20} /></div>
          <div><div className="pros-stat-val">{stats.total || 0}</div><div className="pros-stat-lbl">Prospectos</div></div>
        </div>
        <div className="pros-stat">
          <div className="pros-stat-ico ico-hot"><Flame size={20} /></div>
          <div><div className="pros-stat-val">{stats.calientes || 0}</div><div className="pros-stat-lbl">Calientes (≥75)</div></div>
        </div>
        <div className="pros-stat">
          <div className="pros-stat-ico ico-new"><Sparkles size={20} /></div>
          <div><div className="pros-stat-val">{stats.nuevos || 0}</div><div className="pros-stat-lbl">Nuevos</div></div>
        </div>
        <div className="pros-stat">
          <div className="pros-stat-ico ico-client"><UserCheck size={20} /></div>
          <div><div className="pros-stat-val">{stats.ya_clientes || 0}</div><div className="pros-stat-lbl">Ya clientes</div></div>
        </div>
        <div className="pros-stat">
          <div className="pros-stat-ico ico-score"><Gauge size={20} /></div>
          <div><div className="pros-stat-val">{stats.score_promedio || 0}</div><div className="pros-stat-lbl">Score prom.</div></div>
        </div>
      </div>

      {/* Panel de actividad (jobs) */}
      {jobsOpen && (
        <div className="pros-jobs">
          <div className="pros-jobs-head">
            <span><Activity size={13} style={{ verticalAlign: -2 }} /> Actividad de búsquedas y enriquecimiento</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setJobsOpen(false)}><X size={14} /></button>
          </div>
          {jobs.length === 0 ? (
            <div style={{ padding: '0.9rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Sin trabajos todavía.</div>
          ) : (
            jobs.slice(0, 10).map((j) => {
              const par = typeof j.parametros === 'string' ? safeParse(j.parametros) : (j.parametros || {});
              const rez = typeof j.resultado === 'string' ? safeParse(j.resultado) : (j.resultado || {});
              return (
                <div className="pros-job-row" key={j.id_job}>
                  {j.tipo === 'google_places' ? <Compass size={15} style={{ color: 'var(--accent)' }} /> : <Zap size={15} style={{ color: 'var(--accent)' }} />}
                  <div className="pros-job-desc">
                    {j.tipo === 'google_places'
                      ? <>Descubrir “{par.query}” · <small>{par.zona}</small></>
                      : <>Enriquecer web · <small>prospecto #{par.id_prospecto}</small></>}
                    {j.estado === 'completado' && (
                      <div><small>
                        {j.tipo === 'google_places'
                          ? `${rez.creados ?? 0} creados · ${rez.duplicados ?? 0} dup · ${rez.ya_cliente ?? 0} ya clientes${rez.irrelevantes ? ` · ${rez.irrelevantes} descartados` : ''}`
                          : `${rez.contactos_nuevos ?? 0} contactos nuevos · score ${rez.score ?? '—'}`}
                      </small></div>
                    )}
                    {j.estado === 'error' && <div><small style={{ color: '#e74c3c' }}>{j.error}</small></div>}
                  </div>
                  <span className={`job-badge job-${j.estado}`}>
                    {j.estado === 'procesando' && <Loader size={10} className="pros-spin" style={{ verticalAlign: -1, marginRight: 3 }} />}
                    {j.estado}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="pros-toolbar">
        <div className="pros-search">
          <Search size={16} />
          <input className="form-input" placeholder="Buscar por nombre o documento…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ maxWidth: 160 }} value={fSegmento} onChange={(e) => setFSegmento(e.target.value)}>
          <option value="">Todo segmento</option>
          <option value="Formal">Formal</option>
          <option value="Pequeno">Pequeño</option>
          <option value="Informal">Informal</option>
        </select>
        <select className="form-select" style={{ maxWidth: 160 }} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
          <option value="">Todo estado</option>
          <option value="Nuevo">Nuevo</option>
          <option value="En_gestion">En gestión</option>
          <option value="Contactado">Contactado</option>
          <option value="Convertido">Convertido</option>
          <option value="Descartado">Descartado</option>
        </select>
        <select className="form-select" style={{ maxWidth: 170 }} value={fFlag} onChange={(e) => setFFlag(e.target.value)}>
          <option value="">Nuevos y clientes</option>
          <option value="Ninguno">Solo nuevos</option>
          <option value="Ya_cliente">Ya clientes</option>
          <option value="Posible_duplicado">Posibles duplicados</option>
        </select>
        {facetas.busquedas.length > 0 && (
          <select className="form-select" style={{ maxWidth: 220 }} value={fBusqueda} onChange={(e) => setFBusqueda(e.target.value)} title="Filtrar por la búsqueda que originó el prospecto">
            <option value="">Toda búsqueda</option>
            {facetas.busquedas.map((b) => (
              <option key={b.valor} value={b.valor}>{b.valor} ({b.total})</option>
            ))}
          </select>
        )}
        {facetas.sectores.length > 0 && (
          <select className="form-select" style={{ maxWidth: 200 }} value={fSector} onChange={(e) => setFSector(e.target.value)} title="Filtrar por sector detectado">
            <option value="">Todo sector</option>
            {facetas.sectores.map((s) => (
              <option key={s.valor} value={s.valor}>{s.valor} ({s.total})</option>
            ))}
          </select>
        )}
        <select className="form-select" style={{ maxWidth: 170 }} value={fMinScore} onChange={(e) => setFMinScore(e.target.value)} title="Mostrar solo prospectos con este potencial o más">
          <option value="">Todo potencial</option>
          <option value="75">🟢 Caliente · ≥ 75%</option>
          <option value="45">🟡 Tibio · ≥ 45%</option>
        </select>
        <select className="form-select" style={{ maxWidth: 150 }} value={orden} onChange={(e) => setOrden(e.target.value)}>
          <option value="score">Mayor score</option>
          <option value="recientes">Más recientes</option>
          <option value="nombre">Nombre A-Z</option>
        </select>
        <button
          className={`btn btn-sm ${vista === 'excluidos' ? 'btn-warning' : 'btn-outline'}`}
          onClick={() => setVista((v) => (v === 'excluidos' ? 'activos' : 'excluidos'))}
          title="Ver la lista de excluidos"
        >
          {vista === 'excluidos' ? <><RotateCcw size={15} /> Ver activos</> : <><EyeOff size={15} /> Excluidos</>}
        </button>
      </div>

      {/* Tabla */}
      <div className="pros-table-wrap">
        {loading ? (
          <div className="pros-empty"><Loader size={28} className="pros-spin" /><div>Cargando prospectos…</div></div>
        ) : prospectos.length === 0 ? (
          <div className="pros-empty">
            <Radar size={40} />
            <div style={{ fontWeight: 600, color: 'var(--white)' }}>Aún no hay prospectos</div>
            <div>Usa “Ingresar RUCs” para captar empresas y enriquecerlas con SUNAT.</div>
          </div>
        ) : (
          <table className="pros-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Score</th>
                <th>Empresa</th>
                <th className="pros-hide-sm">Sector</th>
                <th className="pros-hide-sm">Ubicación</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {prospectos.map((p, i) => {
                const ec = ESTADO_CHIP[p.estado_workflow] || ESTADO_CHIP.Nuevo;
                return (
                  <tr key={p.id_prospecto} style={{ animationDelay: `${Math.min(i * 0.025, 0.5)}s` }} onClick={() => verDetalle(p.id_prospecto)}>
                    <td><ScoreRing score={p.score} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Thumb p={p} />
                        <div style={{ minWidth: 0 }}>
                          <span className="pros-empresa-nom">{p.razon_social}</span>
                          <span className="pros-empresa-doc">
                            {p.documento
                              ? `${p.tipo_documento || 'RUC'} ${p.documento}`
                              : <span className="pros-sin-doc">Sin RUC</span>} · {p.segmento}
                          </span>
                          <div className="pros-contact-mini">
                            {p.emails ? (
                              <span title={p.emails}><Mail size={11} /> {p.emails.split(' / ')[0]}</span>
                            ) : (
                              <span className="pros-mini-warn"><AlertTriangle size={11} /> Sin correo</span>
                            )}
                            {p.telefonos ? (
                              <span title={p.telefonos}><Phone size={11} /> {p.telefonos.split(' / ')[0]}</span>
                            ) : (
                              <span className="pros-mini-warn"><AlertTriangle size={11} /> Sin teléfono</span>
                            )}
                          </div>
                          <div style={{ marginTop: 4 }}><DupBadge flag={p.flag_duplicado} /></div>
                        </div>
                      </div>
                    </td>
                    <td className="pros-hide-sm">{p.sector || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                    <td className="pros-hide-sm" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {[p.distrito, p.provincia].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td>
                      <span className={`pros-chip ${ec.cls}`}>{ec.label}</span>
                      {p.id_gestor && Number(p.id_gestor) !== Number(user?.id) && (
                        <span title="Gestionado por otro usuario" style={{ marginLeft: 6, color: '#e74c3c', verticalAlign: 'middle', display: 'inline-flex' }}>
                          <Lock size={13} />
                        </span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="pros-actions-cell">
                        <button className="btn btn-ghost btn-sm" title="Ver detalle" onClick={() => verDetalle(p.id_prospecto)}><Eye size={15} /></button>
                        {p.web && (
                          <button className="btn btn-ghost btn-sm" title="Enriquecer desde su web" onClick={() => enriquecer(p.id_prospecto, p.web)}><Zap size={15} /></button>
                        )}
                        {vista === 'excluidos' ? (
                          <button className="btn btn-outline btn-sm" title="Cancelar exclusión" onClick={() => excluir(p.id_prospecto, false)}><RotateCcw size={15} /></button>
                        ) : (
                          <button className="btn btn-ghost btn-sm" title="Excluir del descubrimiento" onClick={() => excluir(p.id_prospecto, true)}><EyeOff size={15} /></button>
                        )}
                        {p.estado_workflow !== 'Convertido' && (
                          <button className="btn btn-success btn-sm" title="Crear cliente" onClick={() => abrirConvertir(p)}><UserPlus size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------- Panel de detalle ---------- */}
      {detalle && (
        <>
          <div className="pros-overlay" onClick={() => setDetalle(null)} />
          <aside className="pros-panel">
            <div className="pros-panel-head">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Thumb p={detalle} size={48} />
                  <ScoreRing score={detalle.score || 0} />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--white)', fontSize: '1rem' }}>{detalle.razon_social || 'Cargando…'}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{detalle.documento || 'Sin documento'} · {detalle.segmento}</div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}><DupBadge flag={detalle.flag_duplicado} /></div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetalle(null)}><X size={18} /></button>
            </div>

            <div className="pros-panel-body">
              {detalleLoading ? (
                <div className="pros-loading-inline"><Loader size={16} className="pros-spin" /> Cargando…</div>
              ) : (
                <>
                  {detalleDueno && (
                    <div className={`pros-lock ${bloqueado ? 'pros-lock-blocked' : 'pros-lock-mine'}`}>
                      {bloqueado ? <Lock size={15} /> : <UserCheck size={15} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--white)' }}>
                          {bloqueado ? `Gestionado por ${detalle.gestor_nombre || 'otro usuario'}` : 'Lo estás gestionando tú'}
                        </div>
                        {detalle.fecha_gestion && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            Desde {String(detalle.fecha_gestion).slice(0, 16).replace('T', ' ')}
                          </div>
                        )}
                        {bloqueado && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            No puedes editarlo hasta que lo libere{esAdmin ? ' (o libéralo tú como administrador)' : ''}.
                          </div>
                        )}
                      </div>
                      {puedeLiberar && (
                        <button className="btn btn-outline btn-sm" onClick={() => liberar(detalle.id_prospecto)}>
                          <Unlock size={14} /> Liberar
                        </button>
                      )}
                    </div>
                  )}

                  {detalleWhy && (
                    <div className="pros-why">
                      <div className="pros-why-title">¿Por qué contactarlo?</div>
                      {detalleWhy}
                    </div>
                  )}

                  {detalleSignals.length > 0 && (
                    <ul className="pros-signals">
                      {detalleSignals.map((s, i) => <li key={i}><CheckCircle2 size={14} /> {s}</li>)}
                    </ul>
                  )}

                  <div className="pros-section-title">Datos</div>
                  {detalle.sector && <div className="pros-field"><div className="pros-field-lbl">Sector</div><div className="pros-field-val">{detalle.sector}</div></div>}
                  {detalle.direccion && <div className="pros-field"><div className="pros-field-lbl">Dirección</div><div className="pros-field-val">{detalle.direccion}</div></div>}
                  {(detalle.distrito || detalle.provincia || detalle.departamento) && (
                    <div className="pros-field"><div className="pros-field-lbl">Ubicación</div>
                      <div className="pros-field-val">{[detalle.distrito, detalle.provincia, detalle.departamento].filter(Boolean).join(', ')}</div></div>
                  )}

                  <div className="pros-section-title">Contactos</div>
                  {(() => {
                    // Correos primero (canal prioritario), luego teléfonos y el resto.
                    const orden = { Email: 0, Telefono: 1, Celular: 1, Whatsapp: 1, Web: 2, RedSocial: 3 };
                    const cts = [...(detalle.contactos || [])].sort((a, b) => (orden[a.tipo] ?? 9) - (orden[b.tipo] ?? 9));
                    const tieneTel = cts.some((c) => ['Telefono', 'Celular', 'Whatsapp'].includes(c.tipo));
                    const tieneEmail = cts.some((c) => c.tipo === 'Email');
                    if (cts.length === 0) {
                      return <div className="pros-nocontact"><AlertTriangle size={14} /> Sin datos de contacto todavía.</div>;
                    }
                    return (
                      <>
                        {cts.map((c) => (
                          <div className="pros-contact-row" key={c.id_contacto}>
                            {c.tipo === 'Email' ? <Mail size={15} /> : c.tipo === 'Web' ? <Globe size={15} /> : c.tipo === 'RedSocial' ? <Globe size={15} /> : <Phone size={15} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: 'var(--white)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ wordBreak: 'break-all' }}>{c.valor}</span>
                                {c.area && <span className="pros-area-badge">{c.area}</span>}
                              </div>
                              {(c.nombre_persona || c.cargo) && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                  {c.nombre_persona}{c.nombre_persona && c.cargo ? ' · ' : ''}{c.cargo}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {!tieneTel && (
                          <div className="pros-nocontact"><AlertTriangle size={14} /> Sin número de contacto.</div>
                        )}
                        {!tieneEmail && (
                          <div className="pros-nocontact"><AlertTriangle size={14} /> Sin correo de contacto.</div>
                        )}
                      </>
                    );
                  })()}

                  <div className="pros-section-title">Estado comercial</div>
                  <select
                    className="form-select"
                    value={detalle.estado_workflow || 'Nuevo'}
                    disabled={bloqueado}
                    title={bloqueado ? 'Bloqueado: lo gestiona otro usuario' : undefined}
                    onChange={(e) => cambiarEstado(detalle.id_prospecto, e.target.value)}
                  >
                    <option value="Nuevo">Nuevo</option>
                    <option value="En_gestion">En gestión</option>
                    <option value="Contactado">Contactado</option>
                    <option value="Descartado">Descartado</option>
                  </select>

                  <div className="pros-section-title"><History size={13} style={{ verticalAlign: -2 }} /> Historial de gestión</div>
                  {(detalle.historial || []).length === 0 ? (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Sin movimientos registrados aún.</div>
                  ) : (
                    <ul className="pros-historial">
                      {(detalle.historial || []).map((h) => (
                        <li key={h.id_historial}>
                          <Clock size={13} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: 'var(--white)', fontSize: '0.82rem' }}>
                              {ACCION_LABEL[h.accion] || h.accion}
                              {h.valor_nuevo && <span style={{ color: 'var(--text-secondary)' }}> → {ESTADO_CHIP[h.valor_nuevo]?.label || h.valor_nuevo}</span>}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              {h.usuario || 'Sistema'} · {h.fecha}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="pros-panel-foot">
              <button className="btn btn-danger btn-sm" disabled={bloqueado} title={bloqueado ? 'Bloqueado por otro usuario' : undefined} onClick={() => descartar(detalle.id_prospecto)}><Trash2 size={15} /> Descartar</button>
              {detalle.web && (
                <button className="btn btn-outline btn-sm" onClick={() => enriquecer(detalle.id_prospecto, detalle.web)}><Zap size={15} /> Enriquecer</button>
              )}
              {vista === 'excluidos' ? (
                <button className="btn btn-outline btn-sm" onClick={() => excluir(detalle.id_prospecto, false)}><RotateCcw size={15} /> Restaurar</button>
              ) : (
                <button className="btn btn-outline btn-sm" onClick={() => excluir(detalle.id_prospecto, true)}><EyeOff size={15} /> Excluir</button>
              )}
              {detalle.estado_workflow !== 'Convertido' ? (
                <button className="btn btn-success" style={{ flex: 1 }} disabled={bloqueado} title={bloqueado ? 'Bloqueado por otro usuario' : undefined} onClick={() => abrirConvertir(detalle)}><UserPlus size={16} /> Crear cliente</button>
              ) : (
                <span className="pros-chip chip-conv" style={{ alignSelf: 'center' }}><CheckCircle2 size={12} /> Convertido en cliente</span>
              )}
            </div>
          </aside>
        </>
      )}

      {/* ---------- Modal ingesta ---------- */}
      <Modal isOpen={ingestaOpen} onClose={() => setIngestaOpen(false)} title="Ingresar empresas por RUC" size="md">
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>
          Pega uno o varios RUCs (separados por espacio, coma o salto de línea). Se validan y enriquecen con SUNAT, se calcula su score y se marcan los que ya son clientes. Máx. 50 por lote.
        </p>
        <label className="form-label">RUCs</label>
        <textarea
          className="form-input"
          rows={5}
          placeholder="20512345678, 20487654321…"
          value={ingestaTexto}
          onChange={(e) => setIngestaTexto(e.target.value)}
          style={{ resize: 'vertical', fontFamily: 'monospace' }}
        />
        <div style={{ marginTop: '0.8rem' }}>
          <label className="form-label">Segmento</label>
          <select className="form-select" value={ingestaSegmento} onChange={(e) => setIngestaSegmento(e.target.value)}>
            <option value="Formal">Formal (empresa con factura)</option>
            <option value="Pequeno">Pequeño (compra libre / sin IGV)</option>
          </select>
        </div>

        {ingestaRes && (
          <div className="pros-ingesta-res">
            <div className="pros-ingesta-box"><b style={{ color: '#2ecc71' }}>{ingestaRes.creados}</b><span>Creados</span></div>
            <div className="pros-ingesta-box"><b style={{ color: '#e8b84b' }}>{ingestaRes.ya_cliente}</b><span>Ya clientes</span></div>
            <div className="pros-ingesta-box"><b style={{ color: 'var(--wire)' }}>{ingestaRes.ya_prospecto}</b><span>Ya existían</span></div>
          </div>
        )}
        {ingestaRes?.errores?.length > 0 && (
          <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#e74c3c' }}>{ingestaRes.errores.length} RUC(s) con error o no encontrados en SUNAT.</div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
          <button className="btn btn-outline" onClick={() => setIngestaOpen(false)}>Cerrar</button>
          <button className="btn btn-primary" onClick={hacerIngesta} disabled={ingestaLoading || !ingestaTexto.trim()}>
            {ingestaLoading ? <><Loader size={16} className="pros-spin" /> Procesando…</> : <><Upload size={16} /> Procesar</>}
          </button>
        </div>
      </Modal>

      {/* ---------- Modal descubrir (Google Places) ---------- */}
      <Modal isOpen={descubrirOpen} onClose={() => setDescubrirOpen(false)} title="Descubrir empresas por rubro y zona" size="md">
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.9rem' }}>
          Busca en Google Maps <b>empresas que compran empaque industrial</b> (burbupack, stretch film, zunchos, esquineros…): negocios que mueven, paletizan o protegen carga. Se crean como prospectos con teléfono, web y foto, se puntúan y se marcan los que ya son clientes. <b>No duplica</b> lo que ya tienes.
        </p>

        <label className="pros-toggle">
          <input type="checkbox" checked={descubrirData.todos} onChange={(e) => setDescubrirData({ ...descubrirData, todos: e.target.checked })} />
          <span><b>Descubrir en TODOS los rubros objetivo</b><br /><small style={{ color: 'var(--text-secondary)' }}>Barre los {RUBROS_OBJETIVO.length} rubros, priorizando los de mayor afinidad (agroexport, logística, e-commerce… primero).</small></span>
        </label>

        {!descubrirData.todos && (
          <>
            <label className="form-label">Rubro objetivo</label>
            <select className="form-select" value={descubrirData.query} onChange={(e) => setDescubrirData({ ...descubrirData, query: e.target.value })}>
              <option value="">— Elige un rubro —</option>
              {RUBROS_OBJETIVO.map((r) => <option key={r.q} value={r.q}>{r.label}</option>)}
            </select>
            <label className="form-label" style={{ marginTop: '0.6rem' }}>…o escribe uno personalizado</label>
            <input className="form-input" placeholder="ej. exportadora de textiles, distribuidora de licores…"
              value={descubrirData.query} onChange={(e) => setDescubrirData({ ...descubrirData, query: e.target.value })} />
          </>
        )}

        <div className="pros-zonas-head">
          <label className="form-label" style={{ margin: 0 }}>Ubicaciones — departamentos del Perú</label>
          <div className="pros-zonas-actions">
            <button type="button" className="btn btn-ghost btn-xs" onClick={marcarTodo}>Marcar todo</button>
            <button type="button" className="btn btn-ghost btn-xs" onClick={desmarcarTodo}>Desmarcar todo</button>
            <span className="pros-zonas-count">{descubrirData.zonasSel.length}/{DEPARTAMENTOS_PERU.length}</span>
          </div>
        </div>
        <div className="pros-zonas-grid">
          {DEPARTAMENTOS_PERU.map((dep) => {
            const on = descubrirData.zonasSel.includes(dep);
            return (
              <label key={dep} className={`pros-zona-chk ${on ? 'on' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => toggleDep(dep)} />
                <span>{dep}</span>
              </label>
            );
          })}
        </div>
        <label className="form-label" style={{ marginTop: '0.6rem' }}>Otras localidades (opcional, una por línea — distritos, ciudades…)</label>
        <textarea className="form-input" rows={2} placeholder={'ej. Trujillo\nChincha Alta'}
          value={descubrirData.otras} onChange={(e) => setDescubrirData({ ...descubrirData, otras: e.target.value })}
          style={{ resize: 'vertical' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.6rem' }}>
          <div>
            <label className="form-label">Cantidad por búsqueda</label>
            <input type="number" className="form-input" min={1} max={40} value={descubrirData.limite} onChange={(e) => setDescubrirData({ ...descubrirData, limite: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Segmento</label>
            <select className="form-select" value={descubrirData.segmento} onChange={(e) => setDescubrirData({ ...descubrirData, segmento: e.target.value })}>
              <option value="Formal">Formal</option>
              <option value="Pequeno">Pequeño (compra libre)</option>
              <option value="Informal">Informal</option>
            </select>
          </div>
        </div>

        {zonasYaBarridas.length > 0 && (
          <div style={{ marginTop: '0.8rem', fontSize: '0.78rem', background: 'rgba(232,184,75,0.12)', border: '1px solid rgba(232,184,75,0.5)', borderRadius: 8, padding: '0.6rem 0.7rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e8b84b', fontWeight: 700, marginBottom: 4 }}>
              <AlertTriangle size={15} /> Zona(s) ya exploradas — evita repetir
            </div>
            {zonasYaBarridas.map((b) => (
              <div key={b.zona} style={{ color: 'var(--text-secondary)' }}>
                <b style={{ color: 'var(--white)' }}>{b.zona}</b>: barrida el {String(b.ultima_fecha).slice(0, 16).replace('T', ' ')} por {b.ultimo_usuario} ({b.busquedas} búsqueda{b.busquedas === 1 ? '' : 's'}).
              </div>
            ))}
            <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
              Repetir solo trae lo nuevo (los duplicados no se re-cobran), pero el Text Search sí consume cuota. Si solo quieres novedades, adelante; si no, cambia de zona.
            </div>
          </div>
        )}

        <div style={{ marginTop: '0.8rem', fontSize: '0.76rem', color: 'var(--text-secondary)', background: 'var(--carbon)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.7rem' }}>
          {descubrirData.todos
            ? <>El modo “todos” lanza {RUBROS_OBJETIVO.length} búsquedas por ubicación y consume más cuota de Google. Recomendado 1 vez por zona; las siguientes veces solo trae lo nuevo (no re-cobra los duplicados).</>
            : <>Requiere <b>GOOGLE_PLACES_API_KEY</b> en el backend. Si falta, el sistema te avisará.</>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.1rem' }}>
          <button className="btn btn-outline" onClick={() => setDescubrirOpen(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={hacerDescubrir} disabled={descubrirLoading || zonasElegidas.length === 0 || (!descubrirData.todos && !descubrirData.query.trim())}>
            {descubrirLoading ? <><Loader size={16} className="pros-spin" /> Encolando…</> : <><Compass size={16} /> {descubrirData.todos ? 'Descubrir todo' : 'Buscar'}</>}
          </button>
        </div>
      </Modal>

      {/* ---------- Modal convertir ---------- */}
      <Modal isOpen={convertOpen} onClose={() => setConvertOpen(false)} title="Crear cliente desde prospecto" size="md">
        {convertData && (
          <>
            <div style={{ marginBottom: '0.9rem', padding: '0.6rem 0.8rem', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 8 }}>
              <Building2 size={15} style={{ verticalAlign: -2, color: 'var(--accent)' }} /> <b style={{ color: 'var(--white)' }}>{convertData.razon_social}</b>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '0.6rem' }}>
              <div>
                <label className="form-label">Tipo doc.</label>
                <select className="form-select" value={convertData.tipo_documento} onChange={(e) => setConvertData({ ...convertData, tipo_documento: e.target.value })}>
                  <option value="RUC">RUC</option>
                  <option value="DNI">DNI</option>
                </select>
              </div>
              <div>
                <label className="form-label">Documento *</label>
                <input className="form-input" value={convertData.documento} onChange={(e) => setConvertData({ ...convertData, documento: e.target.value })} placeholder="RUC o DNI" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.6rem' }}>
              <div><label className="form-label">Teléfono</label><input className="form-input" value={convertData.telefono} onChange={(e) => setConvertData({ ...convertData, telefono: e.target.value })} /></div>
              <div><label className="form-label">Email</label><input className="form-input" value={convertData.email} onChange={(e) => setConvertData({ ...convertData, email: e.target.value })} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.6rem' }}>
              <div>
                <label className="form-label">Condición</label>
                <select className="form-select" value={convertData.condicion_pago} onChange={(e) => setConvertData({ ...convertData, condicion_pago: e.target.value })}>
                  <option value="Contado">Contado</option>
                  <option value="Credito">Crédito</option>
                </select>
              </div>
              {convertData.condicion_pago === 'Credito' && (
                <div><label className="form-label">Días crédito</label><input type="number" className="form-input" value={convertData.dias_credito} onChange={(e) => setConvertData({ ...convertData, dias_credito: e.target.value })} /></div>
              )}
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.7rem' }}>
              Se creará en tu tabla de clientes. Si el documento ya existe, se enlaza sin duplicar.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.1rem' }}>
              <button className="btn btn-outline" onClick={() => setConvertOpen(false)}>Cancelar</button>
              <button className="btn btn-success" onClick={confirmarConvertir} disabled={convertLoading || !convertData.documento}>
                {convertLoading ? <><Loader size={16} className="pros-spin" /> Creando…</> : <><UserPlus size={16} /> Crear cliente</>}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
