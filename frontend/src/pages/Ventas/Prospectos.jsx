import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Radar, Search, Upload, Users, Flame, Sparkles, UserCheck, Gauge,
  Phone, Mail, Globe, Building2, CheckCircle2, X, Loader,
  UserPlus, Trash2, Eye, AlertTriangle, Activity, Zap, FileSpreadsheet,
  EyeOff, RotateCcw, Lock, Unlock, Clock, History,
  ExternalLink, RefreshCw, ShieldCheck, Compass, MapPin, AlertCircle, MessageSquare, XCircle
} from 'lucide-react';
import { io } from 'socket.io-client';
import { prospectosAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import PgDrawer from '../../components/UI/PgDrawer';
import PgPager from '../../components/UI/PgPager';
import './Ventas.css';
import './Prospectos.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const SCORE_CALIENTE = 75;
const SCORE_TIBIO = 45;
const colorScore = (s) => (s >= SCORE_CALIENTE ? 'var(--success)' : s >= SCORE_TIBIO ? 'var(--warning)' : 'var(--danger)');
const bandaScore = (s) => (s >= SCORE_CALIENTE ? 'Caliente' : s >= SCORE_TIBIO ? 'Tibio' : 'Frío');

const safeParse = (s) => { try { return JSON.parse(s); } catch { return {}; } };

const hostFromUrl = (u) => { try { return new URL(u).host.replace(/^www\./i, ''); } catch { return u || ''; } };

const fechaPeruISO = (f) => {
  if (!f) return '';
  const d = new Date(String(f).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(f).slice(0, 10);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
};
const hoyPeruISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

const fechaCorta = (f) => {
  const iso = fechaPeruISO(f);
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};
const diasDesde = (f) => {
  const iso = fechaPeruISO(f);
  if (!iso) return Infinity;
  const cap = new Date(`${iso}T00:00:00Z`).getTime();
  const hoy = new Date(`${hoyPeruISO()}T00:00:00Z`).getTime();
  return Number.isNaN(cap) ? Infinity : Math.round((hoy - cap) / 86400000);
};
const etiquetaRecencia = (f) => {
  const d = diasDesde(f);
  if (d <= 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  if (d < 7) return `Hace ${d} días`;
  return null;
};

const FUENTE_LABEL = {
  web: 'sitio web', social: 'red social', google_places: 'Google Maps',
  sunat: 'SUNAT', manual: 'ingresado a mano',
};

const POR_PAGINA = 50;

function construirPaginas(actual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const paginas = new Set([1, total, actual, actual - 1, actual + 1]);
  if (actual <= 3) [2, 3, 4].forEach((n) => paginas.add(n));
  if (actual >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => paginas.add(n));
  const ord = [...paginas].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const res = [];
  for (let i = 0; i < ord.length; i++) {
    if (i > 0 && ord[i] - ord[i - 1] > 1) res.push(`…${i}`);
    res.push(ord[i]);
  }
  return res;
}

const imgSrc = (p) => {
  if (p.logo_url) return p.logo_url;
  if (p.foto_referencia) {
    const token = localStorage.getItem('tokenMedia') || localStorage.getItem('token') || '';
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

const ACCION_LOTE = {
  descubrir:   { label: 'Procesando (histórico)' },
  enriquecer:  { label: 'Buscando web y contactos' },
  redescubrir: { label: 'Re-verificando datos' },
};

const ESTADO_CHIP = {
  Nuevo:      { badge: 'badge-info',      icon: Sparkles,      label: 'Nuevo' },
  En_gestion: { badge: 'badge-primary',   icon: Activity,      label: 'En gestión' },
  Contactado: { badge: 'badge-warning',   icon: MessageSquare, label: 'Contactado' },
  Convertido: { badge: 'badge-success',   icon: UserCheck,     label: 'Convertido' },
  Descartado: { badge: 'badge-secondary', icon: XCircle,       label: 'Descartado' },
};

const JOB_BADGE = {
  pendiente:  { badge: 'badge-secondary', icon: Clock },
  procesando: { badge: 'badge-info',      icon: Loader },
  completado: { badge: 'badge-success',   icon: CheckCircle2 },
  error:      { badge: 'badge-danger',    icon: AlertTriangle },
};

function ScoreRing({ score }) {
  const c = colorScore(score);
  return (
    <div
      className="pros-ring"
      style={{ background: `conic-gradient(${c} ${score * 3.6}deg, var(--steel) 0deg)` }}
      title={`Potencial ${score}/100 · ${bandaScore(score)}`}
    >
      <span>{score}</span>
    </div>
  );
}

function DupBadge({ flag }) {
  if (flag === 'Ya_cliente') return <span className="badge badge-success"><UserCheck size={11} /> Ya cliente</span>;
  if (flag === 'Posible_duplicado') return <span className="badge badge-warning"><AlertTriangle size={11} /> Posible dup.</span>;
  return null;
}

export default function Prospectos() {
  const { user } = useAuth();
  const [prospectos, setProspectos] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [search, setSearch] = useState('');
  const [fSegmento, setFSegmento] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fFlag, setFFlag] = useState('');
  const [fSector, setFSector] = useState('');
  const [fBusqueda, setFBusqueda] = useState('');
  const [fMinScore, setFMinScore] = useState('');
  const [orden, setOrden] = useState('recientes');
  const [vista, setVista] = useState('activos');
  const [facetas, setFacetas] = useState({ sectores: [], busquedas: [] });

  const [page, setPage] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportModo, setExportModo] = useState('todo');
  const [exportDesde, setExportDesde] = useState(1);
  const [exportHasta, setExportHasta] = useState(1);
  const [exportLoading, setExportLoading] = useState(false);

  const [ingestaOpen, setIngestaOpen] = useState(false);
  const [ingestaTexto, setIngestaTexto] = useState('');
  const [ingestaSegmento, setIngestaSegmento] = useState('Formal');
  const [ingestaLoading, setIngestaLoading] = useState(false);
  const [ingestaRes, setIngestaRes] = useState(null);

  const [detalle, setDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [buscandoRuc, setBuscandoRuc] = useState(null);

  const [convertOpen, setConvertOpen] = useState(false);
  const [convertData, setConvertData] = useState(null);
  const [convertLoading, setConvertLoading] = useState(false);

  const [descubrirOpen, setDescubrirOpen] = useState(false);
  const [descubrirLoading, setDescubrirLoading] = useState(false);
  const [padron, setPadron] = useState(null);
  const [padronSel, setPadronSel] = useState({ departamentos: [], sectores: [], limite: 500 });

  const [enriqMasivoLoading, setEnriqMasivoLoading] = useState(false);
  const [redescMasivoLoading, setRedescMasivoLoading] = useState(false);

  const [jobs, setJobs] = useState([]);
  const [jobsOpen, setJobsOpen] = useState(false);
  const completadosRef = useRef(new Set());

  const [lotesActivos, setLotesActivos] = useState([]);

  const [enVivo, setEnVivo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { orden, page, limit: POR_PAGINA };
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
      setTotalRegistros(lista.data.total || 0);
      setTotalPaginas(lista.data.total_paginas || 1);
      setStats(est.data.data || {});
    } catch (err) {
      setError(err.error || 'Error al cargar prospectos');
    } finally {
      setLoading(false);
    }
  }, [search, fSegmento, fEstado, fFlag, fSector, fBusqueda, fMinScore, orden, vista, page]);

  useEffect(() => {
    const t = setTimeout(cargar, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [cargar, search]);

  useEffect(() => {
    setPage(1);
  }, [search, fSegmento, fEstado, fFlag, fSector, fBusqueda, fMinScore, orden, vista]);

  const irAPagina = (n) => {
    const destino = Math.min(Math.max(1, n), totalPaginas);
    if (destino !== page) setPage(destino);
  };

  const cargarFacetas = useCallback(async () => {
    try {
      const res = await prospectosAPI.getFacetas();
      setFacetas(res.data.data || { sectores: [], busquedas: [] });
    } catch { /* noop */ }
  }, []);

  useEffect(() => { cargarFacetas(); }, [cargarFacetas]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); };

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
      if (algoTermino) { cargar(); cargarFacetas(); }
      return data;
    } catch { return []; }
  }, [cargar, cargarFacetas]);

  useEffect(() => {
    refreshJobs();
    const hayActivos = jobs.some((j) => j.estado === 'pendiente' || j.estado === 'procesando');
    const cada = hayActivos || jobsOpen ? 8000 : 30000;
    const t = setInterval(refreshJobs, cada);
    return () => clearInterval(t);
  }, [refreshJobs, jobsOpen, jobs.length]);

  const jobsActivos = jobs.filter((j) => j.estado === 'pendiente' || j.estado === 'procesando').length;

  const cargarLotes = useCallback(async () => {
    try {
      const res = await prospectosAPI.getLotesActivos();
      setLotesActivos(res.data.data || []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    cargarLotes();
    const hay = lotesActivos.length > 0;
    const t = setInterval(cargarLotes, hay ? 5000 : 20000);
    return () => clearInterval(t);
  }, [cargarLotes, lotesActivos.length]);

  const cargarRef = useRef(cargar);
  const cargarFacetasRef = useRef(cargarFacetas);
  const cargarLotesRef = useRef(cargarLotes);
  const detalleIdRef = useRef(null);
  useEffect(() => { cargarRef.current = cargar; }, [cargar]);
  useEffect(() => { cargarFacetasRef.current = cargarFacetas; }, [cargarFacetas]);
  useEffect(() => { cargarLotesRef.current = cargarLotes; }, [cargarLotes]);
  useEffect(() => { detalleIdRef.current = detalle?.id_prospecto || null; }, [detalle]);

  const recargarDetalleSilencioso = useCallback(async (id) => {
    try {
      const res = await prospectosAPI.getById(id);
      setDetalle((prev) => (prev && prev.id_prospecto === id ? res.data.data : prev));
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;
    const SOCKET_URL = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace('/api', '')
      : 'http://localhost:3000';
    const socket = io(SOCKET_URL, {
      auth: { token: localStorage.getItem('token') || '' },
      withCredentials: true,
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    let debounce = null;
    const onCambio = (data) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        cargarRef.current?.();
        cargarFacetasRef.current?.();
      }, 600);
      const abierto = detalleIdRef.current;
      if (abierto && (!data?.id_prospecto || Number(data.id_prospecto) === Number(abierto))) {
        recargarDetalleSilencioso(abierto);
      }
    };

    let loteDebounce = null;
    const onScraping = () => {
      clearTimeout(loteDebounce);
      loteDebounce = setTimeout(() => cargarLotesRef.current?.(), 350);
    };

    socket.on('connect', () => setEnVivo(true));
    socket.on('disconnect', () => setEnVivo(false));
    socket.on('prospectos:cambio', onCambio);
    socket.on('prospectos:cambio', onScraping);
    socket.on('scraping:update', onScraping);

    return () => {
      clearTimeout(debounce);
      clearTimeout(loteDebounce);
      socket.off('prospectos:cambio', onCambio);
      socket.off('prospectos:cambio', onScraping);
      socket.off('scraping:update', onScraping);
      socket.disconnect();
    };
  }, [user?.id, recargarDetalleSilencioso]);

  const abrirDescubrir = async () => {
    setDescubrirOpen(true);
    try {
      const res = await prospectosAPI.padronStats();
      setPadron(res.data.data || { total: 0, departamentos: [], sectores: [] });
    } catch {
      setPadron({ total: 0, departamentos: [], sectores: [] });
    }
  };

  const togglePadron = (campo, valor) => setPadronSel((s) => ({
    ...s,
    [campo]: s[campo].includes(valor) ? s[campo].filter((x) => x !== valor) : [...s[campo], valor],
  }));

  const hacerDescubrir = async () => {
    if (!padronSel.departamentos.length) { setError('Elige al menos un departamento'); return; }
    try {
      setDescubrirLoading(true);
      const res = await prospectosAPI.descubrirPadron({
        departamentos: padronSel.departamentos,
        sectores: padronSel.sectores,
        limite: padronSel.limite,
      });
      const r = res.data.resumen || {};
      notify(res.data.message || `Creados ${r.creados || 0} prospecto(s).`);
      setDescubrirOpen(false);
      setJobsOpen(true);
      refreshJobs();
      cargarLotes();
      cargar();
    } catch (err) {
      setError(err.error || 'No se pudo descubrir desde el padrón');
    } finally {
      setDescubrirLoading(false);
    }
  };

  const filtrosActuales = () => {
    const params = { orden };
    if (search) params.search = search;
    if (fSegmento) params.segmento = fSegmento;
    if (fEstado) params.estado = fEstado;
    if (fFlag) params.flag = fFlag;
    if (fSector) params.sector = fSector;
    if (fBusqueda) params.busqueda = fBusqueda;
    if (fMinScore) params.min_score = fMinScore;
    if (vista === 'excluidos') params.vista = 'excluidos';
    return params;
  };

  const abrirExport = () => {
    if (totalRegistros === 0) { setError('No hay prospectos para exportar'); return; }
    setExportModo('todo');
    setExportDesde(1);
    setExportHasta(totalPaginas);
    setExportOpen(true);
  };

  const exportarExcel = async () => {
    const base = filtrosActuales();
    const params = { ...base };
    if (exportModo === 'rango') {
      const desde = Math.max(1, Math.min(exportDesde, totalPaginas));
      const hasta = Math.max(desde, Math.min(exportHasta, totalPaginas));
      params.desde_pagina = desde;
      params.hasta_pagina = hasta;
    }
    try {
      setExportLoading(true);
      setError(null);
      await prospectosAPI.exportarExcel(params);
      setExportOpen(false);
      notify('Excel generado. Revisa tu carpeta de descargas.');
    } catch (err) {
      setError(err.message || 'No se pudo exportar a Excel');
    } finally {
      setExportLoading(false);
    }
  };

  const enriquecer = async (id, web) => {
    try {
      await prospectosAPI.enriquecer(id, web ? { web } : {});
      notify(web
        ? 'Enriquecimiento encolado (lectura de la web del prospecto).'
        : 'Búsqueda encolada: se buscará la web y sus contactos automáticamente.');
      setJobsOpen(true);
      refreshJobs();
      cargarLotes();
    } catch (err) {
      setError(err.error || 'No se pudo enriquecer el prospecto');
    }
  };

  const redescubrir = async (id) => {
    if (!window.confirm(
      'Se hará una búsqueda NUEVA (no en caché) de la web y los contactos de esta empresa.\n\n' +
      '• Se BORRA lo recolectado automáticamente (web, teléfonos, correos y redes) para volver a verificarlo desde cero.\n' +
      '• Se CONSERVA lo que agregaste a mano.\n' +
      '• Si no se halla una web que corresponda al nombre, quedará solo con sus datos oficiales (SUNAT).\n\n¿Continuar?'
    )) return;
    try {
      await prospectosAPI.redescubrir(id);
      notify('Re-descubrimiento encolado: verificando datos desde cero en segundo plano.');
      setJobsOpen(true);
      refreshJobs();
      cargarLotes();
    } catch (err) {
      setError(err.error || 'No se pudo iniciar el re-descubrimiento');
    }
  };

  const enriquecerTodo = async () => {
    if (!window.confirm(
      'Se buscarán web y contactos para las empresas SIN contacto que aún están sin trabajar.\n\n' +
      '• No se borra ni se pisa nada (solo se agrega información).\n' +
      '• Se SALTAN los que ya se buscaron y no tienen web (no se re-gasta crédito de la API en ellos); sí se reintentan los que quedaron pendientes por falta de crédito.\n' +
      '• Se procesan de mayor a menor potencial (score), en segundo plano.\n\n¿Continuar?'
    )) return;
    const limStr = window.prompt(
      '¿Cuántos procesar en esta corrida? (para no pasarte de los créditos de la API)\n\nDeja vacío o 0 para procesar TODOS.',
      '2400'
    );
    if (limStr === null) return;
    const limite = parseInt(limStr, 10);
    try {
      setEnriqMasivoLoading(true);
      const res = await prospectosAPI.enriquecerMasivo({
        solo_sin_contacto: true,
        saltar_ya_buscados: true,
        ...(Number.isFinite(limite) && limite > 0 ? { limite } : {}),
      });
      notify(res.data.message || `Se encolaron ${res.data.encolados} enriquecimientos.`);
      setJobsOpen(true);
      refreshJobs();
      cargarLotes();
    } catch (err) {
      setError(err.error || 'No se pudo iniciar el enriquecimiento masivo');
    } finally {
      setEnriqMasivoLoading(false);
    }
  };

  const redescubrirTodo = async () => {
    if (!window.confirm(
      'Se RE-BUSCARÁN los datos de TODOS los prospectos (menos los que ya son clientes) desde cero.\n\n' +
      '• A los que ya son CLIENTES o están Convertidos NO se les toca nada.\n' +
      '• A los que están En gestión / Contactado SÍ se les refrescan los datos, pero se CONSERVA su historial, su estado y su gestor.\n' +
      '• Se BORRAN los datos automáticos (web/teléfonos/correos fantasma) y se CONSERVA lo que agregaste a mano.\n' +
      '• A los que están SIN RUC se les intenta recuperar el RUC por nombre (ruc.pe).\n' +
      '• La web y los contactos se re-buscan anclados al RUC. Corre en segundo plano; con ~4 mil puede tardar horas.\n\n¿Continuar?'
    )) return;
    try {
      setRedescMasivoLoading(true);
      const res = await prospectosAPI.redescubrirMasivo({ solo_sin_fuente: false });
      notify(res.data.message || `Se encolaron ${res.data.encolados} re-búsquedas.`);
      setJobsOpen(true);
      refreshJobs();
      cargarLotes();
    } catch (err) {
      setError(err.error || 'No se pudo iniciar la re-búsqueda masiva');
    } finally {
      setRedescMasivoLoading(false);
    }
  };

  const buscarRuc = async (id) => {
    try {
      setBuscandoRuc(id);
      const res = await prospectosAPI.buscarRuc(id);
      const d = res.data;
      if (d.found) {
        notify(d.ya_tenia
          ? `El prospecto ya tenía RUC ${d.ruc}.`
          : `RUC encontrado: ${d.ruc}${d.ya_cliente ? ' — ¡ya es cliente!' : ''}`);
        cargar();
        if (detalle?.id_prospecto === id) await refrescarDetalle(id);
      } else {
        setError(d.message || 'No se encontró un RUC que coincida en ruc.pe.');
      }
    } catch (err) {
      setError(err.error || 'Error al buscar el RUC');
    } finally {
      setBuscandoRuc(null);
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

  const esAdmin = user?.rol === 'Administrador';
  const detalleDueno = detalle?.id_gestor || null;
  const bloqueado = !!detalleDueno && Number(detalleDueno) !== Number(user?.id);
  const puedeLiberar = !!detalleDueno && (!bloqueado || esAdmin);
  const ACCION_LABEL = { estado: 'Cambió estado', liberar: 'Liberó la gestión', convertido: 'Convirtió a cliente' };

  const hayFiltros = !!(search || fSegmento || fEstado || fFlag || fSector || fBusqueda || fMinScore);

  return (
    <div className="pg-page vt-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow">
            <Radar size={13} /> Ventas
            <span className={`pros-live ${enVivo ? 'on' : 'off'}`} title={enVivo ? 'Actualización en vivo activa: verás los cambios de otros usuarios sin recargar' : 'Sin conexión en vivo (se reintenta automáticamente)'}>
              <span className="pros-live-dot" /> {enVivo ? 'En vivo' : 'Sin conexión'}
            </span>
          </span>
          <h1 className="pg-title">Prospección de ventas</h1>
          <p className="pg-subtitle">Captación por RUC + enriquecimiento verificado (datos anclados al RUC) · scoring y anti-duplicados</p>
        </div>
        <div className="pg-actions">
          <button type="button" className="btn btn-outline pros-activity-btn" onClick={() => setJobsOpen((v) => !v)} title="Actividad de búsquedas" aria-expanded={jobsOpen}>
            <Activity size={16} /> Actividad
            {jobsActivos > 0 && <span className="pros-activity-dot">{jobsActivos}</span>}
          </button>
          <button type="button" className="btn btn-outline" onClick={abrirDescubrir} title="Descubrir empresas reales del Padrón SUNAT por departamento y sector">
            <Compass size={16} /> Descubrir
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={enriquecerTodo}
            disabled={enriqMasivoLoading}
            title="Buscar web y contactos (anclados al RUC) para todas las empresas sin contacto. No borra nada."
          >
            {enriqMasivoLoading ? <Loader size={16} className="pros-spin" /> : <Zap size={16} />} Enriquecer todo
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={redescubrirTodo}
            disabled={redescMasivoLoading}
            title="Re-buscar desde cero los datos de todos los prospectos (menos clientes): recupera RUC faltante y re-trae web/contactos anclados al RUC. Conserva historial, estado y lo agregado a mano."
          >
            {redescMasivoLoading ? <Loader size={16} className="pros-spin" /> : <ShieldCheck size={16} />} Rebuscar todo
          </button>
          <button type="button" className="btn btn-outline" onClick={abrirExport} title="Exportar a Excel (todo o por rango de hojas)">
            <FileSpreadsheet size={16} /> Excel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => { setIngestaOpen(true); setIngestaRes(null); setIngestaTexto(''); }}>
            <Upload size={16} /> Ingresar RUCs
          </button>
        </div>
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        <div className="pg-kpis">
          <div className="pg-kpi is-accent">
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Prospectos</span>
              <span className="pg-kpi-icon"><Users size={16} /></span>
            </div>
            <span className="pg-kpi-value">{stats.total || 0}</span>
            <span className="pg-kpi-foot">En la bandeja</span>
          </div>
          <div className="pg-kpi is-success">
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Calientes (≥75)</span>
              <span className="pg-kpi-icon"><Flame size={16} /></span>
            </div>
            <span className="pg-kpi-value">{stats.calientes || 0}</span>
            <span className="pg-kpi-foot">Alto potencial, aún no clientes</span>
          </div>
          <button type="button" className={`pg-kpi is-info ${fEstado === 'Nuevo' ? 'on' : ''}`} aria-pressed={fEstado === 'Nuevo'}
            onClick={() => setFEstado(fEstado === 'Nuevo' ? '' : 'Nuevo')}>
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Nuevos</span>
              <span className="pg-kpi-icon"><Sparkles size={16} /></span>
            </div>
            <span className="pg-kpi-value">{stats.nuevos || 0}</span>
            <span className="pg-kpi-foot">{fEstado === 'Nuevo' ? 'Filtro activo · pulsa para quitar' : 'Pulsa para filtrar'}</span>
          </button>
          <button type="button" className={`pg-kpi is-warning ${fFlag === 'Ya_cliente' ? 'on' : ''}`} aria-pressed={fFlag === 'Ya_cliente'}
            onClick={() => setFFlag(fFlag === 'Ya_cliente' ? '' : 'Ya_cliente')}>
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Ya clientes</span>
              <span className="pg-kpi-icon"><UserCheck size={16} /></span>
            </div>
            <span className="pg-kpi-value">{stats.ya_clientes || 0}</span>
            <span className="pg-kpi-foot">{fFlag === 'Ya_cliente' ? 'Filtro activo · pulsa para quitar' : 'Pulsa para filtrar'}</span>
          </button>
          <div className="pg-kpi">
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Score promedio</span>
              <span className="pg-kpi-icon"><Gauge size={16} /></span>
            </div>
            <span className="pg-kpi-value">{stats.score_promedio || 0}</span>
            <div className="pg-meter" style={{ '--meter-c': colorScore(Number(stats.score_promedio || 0)) }}>
              <span style={{ width: `${Math.min(100, Number(stats.score_promedio || 0))}%` }} />
            </div>
            <span className="pg-kpi-foot">{bandaScore(Number(stats.score_promedio || 0))}</span>
          </div>
        </div>

        {lotesActivos.length > 0 && (
          <div className="pros-lotes">
            {lotesActivos.map((l) => (
              <div className="pg-panel pros-lote" key={l.lote}>
                <div className="pros-lote-head">
                  <span className="pros-lote-title">
                    <Loader size={15} className="pros-spin" />
                    {ACCION_LOTE[l.accion]?.label || 'Procesando'}
                    <span className="pros-lote-user">· {l.usuario}</span>
                  </span>
                  <span className="pros-lote-pct">{l.porcentaje}%</span>
                </div>
                <div className="pg-meter pros-lote-track">
                  <span style={{ width: `${l.porcentaje}%` }} />
                </div>
                <div className="pros-lote-sub">
                  {l.hechos}/{l.total} listos
                  {l.en_proceso ? ` · ${l.en_proceso} en curso` : ''}
                  {l.pendientes ? ` · ${l.pendientes} en cola` : ''}
                  {l.errores ? ` · ${l.errores} con error` : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {jobsOpen && (
          <section className="pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><Activity size={16} /> Actividad de búsquedas y enriquecimiento</h2>
              <button type="button" className="pg-iconbtn" onClick={() => setJobsOpen(false)} aria-label="Cerrar actividad"><X size={15} /></button>
            </div>
            {jobs.length === 0 ? (
              <p className="pg-empty-line pros-jobs-empty">Sin trabajos todavía.</p>
            ) : (
              <ul className="pros-jobs">
                {jobs.slice(0, 10).map((j) => {
                  const par = typeof j.parametros === 'string' ? safeParse(j.parametros) : (j.parametros || {});
                  const rez = typeof j.resultado === 'string' ? safeParse(j.resultado) : (j.resultado || {});
                  const jb = JOB_BADGE[j.estado] || JOB_BADGE.pendiente;
                  return (
                    <li className="pros-job-row" key={j.id_job}>
                      <Zap size={15} className="pros-job-icon" />
                      <div className="pros-job-desc">
                        {j.tipo === 'google_places'
                          ? <>Descubrir “{par.query}” · <small>{par.zona} · histórico</small></>
                          : <>Buscar web y contactos · <small>prospecto #{par.id_prospecto}</small></>}
                        {j.estado === 'completado' && (
                          <div><small>
                            {j.tipo === 'google_places'
                              ? `${rez.creados ?? 0} creados · ${rez.duplicados ?? 0} dup · ${rez.ya_cliente ?? 0} ya clientes${rez.irrelevantes ? ` · ${rez.irrelevantes} descartados` : ''}`
                              : rez.rechazada
                                ? `Web descartada: no publica el RUC del prospecto · score ${rez.score ?? '—'}`
                                : rez.purgado
                                  ? `Datos no verificables removidos · sin web que publique el RUC · score ${rez.score ?? '—'}`
                                  : `${rez.contactos_nuevos ?? 0} contactos nuevos · score ${rez.score ?? '—'}`}
                          </small></div>
                        )}
                        {j.estado === 'error' && <div><small className="pros-text-danger">{j.error}</small></div>}
                      </div>
                      <span className={`badge ${jb.badge}`}>
                        {j.estado === 'procesando' ? <Loader size={10} className="pros-spin" /> : <jb.icon size={10} />}
                        {j.estado}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <section className="pg-panel">
          <div className="pg-filters">
            <div className="pg-filters-row">
              <div className="pg-field pg-field-grow pg-search">
                <label className="pg-field-label" htmlFor="pros-busqueda">Buscar</label>
                <Search size={14} />
                <input id="pros-busqueda" type="search" className="form-input" placeholder="Nombre o documento" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="pg-field">
                <label className="pg-field-label" htmlFor="pros-segmento">Segmento</label>
                <select id="pros-segmento" className="form-select" value={fSegmento} onChange={(e) => setFSegmento(e.target.value)}>
                  <option value="">Todo segmento</option>
                  <option value="Formal">Formal</option>
                  <option value="Pequeno">Pequeño</option>
                  <option value="Informal">Informal</option>
                </select>
              </div>
              <div className="pg-field">
                <label className="pg-field-label" htmlFor="pros-estado">Estado</label>
                <select id="pros-estado" className="form-select" value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
                  <option value="">Todo estado</option>
                  <option value="Nuevo">Nuevo</option>
                  <option value="En_gestion">En gestión</option>
                  <option value="Contactado">Contactado</option>
                  <option value="Convertido">Convertido</option>
                  <option value="Descartado">Descartado</option>
                </select>
              </div>
              <div className="pg-field">
                <label className="pg-field-label" htmlFor="pros-flag">Relación</label>
                <select id="pros-flag" className="form-select" value={fFlag} onChange={(e) => setFFlag(e.target.value)}>
                  <option value="">Nuevos y clientes</option>
                  <option value="Ninguno">Solo nuevos</option>
                  <option value="Ya_cliente">Ya clientes</option>
                  <option value="Posible_duplicado">Posibles duplicados</option>
                </select>
              </div>
              <div className="pg-field">
                <label className="pg-field-label" htmlFor="pros-score">Potencial</label>
                <select id="pros-score" className="form-select" value={fMinScore} onChange={(e) => setFMinScore(e.target.value)} title="Mostrar solo prospectos con este potencial o más">
                  <option value="">Todo potencial</option>
                  <option value="75">Caliente · ≥ 75%</option>
                  <option value="45">Tibio · ≥ 45%</option>
                </select>
              </div>
            </div>
            <div className="pg-filters-row">
              {facetas.busquedas.length > 0 && (
                <div className="pg-field">
                  <label className="pg-field-label" htmlFor="pros-origen">Búsqueda de origen</label>
                  <select id="pros-origen" className="form-select" value={fBusqueda} onChange={(e) => setFBusqueda(e.target.value)} title="Filtrar por la búsqueda que originó el prospecto">
                    <option value="">Toda búsqueda</option>
                    {facetas.busquedas.map((b) => (
                      <option key={b.valor} value={b.valor}>{b.valor} ({b.total})</option>
                    ))}
                  </select>
                </div>
              )}
              {facetas.sectores.length > 0 && (
                <div className="pg-field">
                  <label className="pg-field-label" htmlFor="pros-sector">Sector</label>
                  <select id="pros-sector" className="form-select" value={fSector} onChange={(e) => setFSector(e.target.value)} title="Filtrar por sector detectado">
                    <option value="">Todo sector</option>
                    {facetas.sectores.map((s) => (
                      <option key={s.valor} value={s.valor}>{s.valor} ({s.total})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="pg-field">
                <label className="pg-field-label" htmlFor="pros-orden">Orden</label>
                <select id="pros-orden" className="form-select" value={orden} onChange={(e) => setOrden(e.target.value)}>
                  <option value="recientes">Más recientes</option>
                  <option value="score">Mayor score</option>
                  <option value="nombre">Nombre A-Z</option>
                </select>
              </div>
              <div className="pg-field">
                <span className="pg-field-label">Vista</span>
                <div className="pg-segmented" role="group" aria-label="Vista de prospectos">
                  <button type="button" className={vista !== 'excluidos' ? 'active' : ''} aria-pressed={vista !== 'excluidos'}
                    onClick={() => { if (vista === 'excluidos') setVista((v) => (v === 'excluidos' ? 'activos' : 'excluidos')); }}>
                    <Eye size={13} /> Activos
                  </button>
                  <button type="button" className={vista === 'excluidos' ? 'active' : ''} aria-pressed={vista === 'excluidos'}
                    onClick={() => { if (vista !== 'excluidos') setVista((v) => (v === 'excluidos' ? 'activos' : 'excluidos')); }}
                    title="Ver la lista de excluidos">
                    <EyeOff size={13} /> Excluidos
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pg-panel">
          <div className="pg-panel-head">
            <h2 className="pg-panel-title">
              <Radar size={16} /> {vista === 'excluidos' ? 'Prospectos excluidos' : 'Bandeja de prospectos'} <span className="pg-count">{totalRegistros.toLocaleString('es-PE')}</span>
            </h2>
            <span className="pg-panel-meta">Pulsa una fila para ver el detalle</span>
          </div>
          {loading ? (
            <div className="pg-loading"><Loader size={24} className="pros-spin" /><span>Cargando prospectos…</span></div>
          ) : prospectos.length === 0 ? (
            <div className="pg-empty">
              <Radar size={28} />
              <strong>{hayFiltros || vista === 'excluidos' ? 'Ningún prospecto coincide' : 'Aún no hay prospectos'}</strong>
              <span>{hayFiltros || vista === 'excluidos' ? 'Cambia los filtros o la vista.' : 'Usa “Ingresar RUCs” para captar empresas y enriquecerlas con SUNAT.'}</span>
            </div>
          ) : (
            <div className="pg-table-wrap">
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Score</th>
                    <th>Empresa</th>
                    <th className="pros-hide-sm">Sector</th>
                    <th className="pros-hide-sm">Ubicación</th>
                    <th>Descubierto</th>
                    <th>Estado</th>
                    <th className="num">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {prospectos.map((p) => {
                    const ec = ESTADO_CHIP[p.estado_workflow] || ESTADO_CHIP.Nuevo;
                    return (
                      <tr key={p.id_prospecto} className="is-clickable" onClick={() => verDetalle(p.id_prospecto)}>
                        <td>
                          <ScoreRing score={p.score} />
                          <span className="pg-cell-sub pros-banda">{bandaScore(p.score)}</span>
                        </td>
                        <td>
                          <div className="pros-empresa">
                            <Thumb p={p} />
                            <div>
                              <span className="pg-cell-main">{p.razon_social}</span>
                              <span className="pg-cell-sub">
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
                              {p.flag_duplicado && p.flag_duplicado !== 'Ninguno' && (
                                <div className="pg-tags"><DupBadge flag={p.flag_duplicado} /></div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="pros-hide-sm">{p.sector || <span className="pg-muted">—</span>}</td>
                        <td className="pros-hide-sm pg-muted">
                          {[p.distrito, p.provincia].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="nowrap">
                          <span className="pg-cell-main">{fechaCorta(p.fecha_captura)}</span>
                          {etiquetaRecencia(p.fecha_captura) && (
                            <span className="pg-tags"><span className="pg-tag is-success"><Sparkles size={10} />{etiquetaRecencia(p.fecha_captura)}</span></span>
                          )}
                        </td>
                        <td className="nowrap">
                          <span className={`badge ${ec.badge}`}><ec.icon size={11} />{ec.label}</span>
                          {p.id_gestor && Number(p.id_gestor) !== Number(user?.id) && (
                            <span className="pros-lock-icon" title="Gestionado por otro usuario" aria-label="Gestionado por otro usuario">
                              <Lock size={13} />
                            </span>
                          )}
                        </td>
                        <td className="num" onClick={(e) => e.stopPropagation()}>
                          <div className="pg-rowactions">
                            <button type="button" className="pg-iconbtn" title="Ver detalle" aria-label={`Ver detalle de ${p.razon_social}`} onClick={() => verDetalle(p.id_prospecto)}><Eye size={15} /></button>
                            {!p.documento && (
                              <button type="button" className="pg-iconbtn" title="Buscar RUC por nombre (ruc.pe)" aria-label="Buscar RUC por nombre" disabled={buscandoRuc === p.id_prospecto} onClick={() => buscarRuc(p.id_prospecto)}>
                                {buscandoRuc === p.id_prospecto ? <Loader size={15} className="pros-spin" /> : <Search size={15} />}
                              </button>
                            )}
                            <button
                              type="button"
                              className="pg-iconbtn"
                              title={p.web ? "Enriquecer desde su web" : "Buscar datos de contacto (web y redes)"}
                              aria-label={p.web ? "Enriquecer desde su web" : "Buscar datos de contacto"}
                              onClick={() => enriquecer(p.id_prospecto, p.web)}
                            >
                              <Zap size={15} />
                            </button>
                            {vista === 'excluidos' ? (
                              <button type="button" className="pg-iconbtn is-on" title="Cancelar exclusión" aria-label="Cancelar exclusión" onClick={() => excluir(p.id_prospecto, false)}><RotateCcw size={15} /></button>
                            ) : (
                              <button type="button" className="pg-iconbtn" title="Excluir del descubrimiento" aria-label="Excluir del descubrimiento" onClick={() => excluir(p.id_prospecto, true)}><EyeOff size={15} /></button>
                            )}
                            {p.estado_workflow !== 'Convertido' && (
                              <button type="button" className="pg-iconbtn pros-iconbtn-ok" title="Crear cliente" aria-label={`Crear cliente desde ${p.razon_social}`} onClick={() => abrirConvertir(p)}><UserPlus size={15} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && totalRegistros > 0 && (
            <PgPager
              currentPage={page}
              totalPages={totalPaginas}
              totalItems={totalRegistros}
              itemsPerPage={POR_PAGINA}
              setCurrentPage={irAPagina}
              sustantivo="prospectos"
            />
          )}
        </section>
      </div>

      {detalle && (
        <PgDrawer
          eyebrow={<><Radar size={12} /> Prospecto</>}
          title={detalle.razon_social || 'Cargando…'}
          badges={(
            <>
              <span className="pros-drawer-id">
                <Thumb p={detalle} size={40} />
                <ScoreRing score={detalle.score || 0} />
                <span className="pg-cell-sub">{detalle.documento || 'Sin documento'} · {detalle.segmento}</span>
              </span>
              <DupBadge flag={detalle.flag_duplicado} />
            </>
          )}
          onClose={() => setDetalle(null)}
          footer={(
            <div className="pros-drawer-foot">
              <button type="button" className="btn btn-danger btn-sm" disabled={bloqueado} title={bloqueado ? 'Bloqueado por otro usuario' : undefined} onClick={() => descartar(detalle.id_prospecto)}><Trash2 size={15} /> Descartar</button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                title={detalle.web ? "Enriquecer desde su web" : "Buscar datos de contacto (web y redes)"}
                onClick={() => enriquecer(detalle.id_prospecto, detalle.web)}
              >
                <Zap size={15} /> {detalle.web ? "Enriquecer" : "Buscar datos"}
              </button>
              {detalle.estado_workflow !== 'Convertido' && detalle.flag_duplicado !== 'Ya_cliente' && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={bloqueado && !esAdmin}
                  title={bloqueado
                    ? (esAdmin
                        ? 'Gestionado por otro usuario — permitido como administrador'
                        : 'Bloqueado: lo gestiona otro usuario')
                    : 'Búsqueda nueva (sin caché): borra lo auto-recolectado y re-verifica web y contactos desde cero'}
                  onClick={() => redescubrir(detalle.id_prospecto)}
                >
                  <RefreshCw size={15} /> Descubrir de nuevo
                </button>
              )}
              {vista === 'excluidos' ? (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => excluir(detalle.id_prospecto, false)}><RotateCcw size={15} /> Restaurar</button>
              ) : (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => excluir(detalle.id_prospecto, true)}><EyeOff size={15} /> Excluir</button>
              )}
              {detalle.estado_workflow !== 'Convertido' ? (
                <button type="button" className="btn btn-success" disabled={bloqueado} title={bloqueado ? 'Bloqueado por otro usuario' : undefined} onClick={() => abrirConvertir(detalle)}><UserPlus size={16} /> Crear cliente</button>
              ) : (
                <span className="badge badge-success"><CheckCircle2 size={12} /> Convertido en cliente</span>
              )}
            </div>
          )}
        >
          {detalleLoading ? (
            <div className="pg-loading"><Loader size={20} className="pros-spin" /><span>Cargando…</span></div>
          ) : (
            <>
              {detalleDueno && (
                <div className={`vt-note ${bloqueado ? 'is-danger' : 'is-info'}`}>
                  {bloqueado ? <Lock size={16} /> : <UserCheck size={16} />}
                  <div>
                    <strong>{bloqueado ? `Gestionado por ${detalle.gestor_nombre || 'otro usuario'}` : 'Lo estás gestionando tú'}</strong>
                    {detalle.fecha_gestion && (
                      <p>Desde {String(detalle.fecha_gestion).slice(0, 16).replace('T', ' ')}</p>
                    )}
                    {bloqueado && (
                      <p>No puedes editarlo hasta que lo libere{esAdmin ? ' (o libéralo tú como administrador)' : ''}.</p>
                    )}
                  </div>
                  {puedeLiberar && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => liberar(detalle.id_prospecto)}>
                      <Unlock size={14} /> Liberar
                    </button>
                  )}
                </div>
              )}

              {(detalleWhy || detalleSignals.length > 0) && (
                <section>
                  <h3 className="pg-section-title"><Sparkles size={14} /> ¿Por qué contactarlo?</h3>
                  {detalleWhy && <div className="vt-note is-accent"><div><p className="pros-why-text">{detalleWhy}</p></div></div>}
                  {detalleSignals.length > 0 && (
                    <ul className="pros-signals">
                      {detalleSignals.map((s, i) => <li key={i}><CheckCircle2 size={14} /> {s}</li>)}
                    </ul>
                  )}
                </section>
              )}

              {!detalle.documento && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm pros-full"
                  disabled={buscandoRuc === detalle.id_prospecto}
                  onClick={() => buscarRuc(detalle.id_prospecto)}
                  title="Consulta ruc.pe por el nombre y completa el RUC si coincide (gratis)"
                >
                  {buscandoRuc === detalle.id_prospecto
                    ? <><Loader size={14} className="pros-spin" /> Buscando RUC en ruc.pe…</>
                    : <><Search size={14} /> Buscar RUC por nombre</>}
                </button>
              )}

              <section>
                <h3 className="pg-section-title"><Building2 size={14} /> Datos</h3>
                <div className="pg-kv">
                  {detalle.sector && <div><span>Sector</span><strong>{detalle.sector}</strong></div>}
                  {(detalle.distrito || detalle.provincia || detalle.departamento) && (
                    <div><span>Ubicación</span><strong>{[detalle.distrito, detalle.provincia, detalle.departamento].filter(Boolean).join(', ')}</strong></div>
                  )}
                  {detalle.direccion && <div className="wide"><span>Dirección</span><strong>{detalle.direccion}</strong></div>}
                  {detalle.web && (
                    <div className="wide">
                      <span>Sitio web</span>
                      <strong>
                        <a className="pros-link" href={detalle.web} target="_blank" rel="noopener noreferrer" title={`Abrir ${detalle.web}`}>
                          {hostFromUrl(detalle.web)} <ExternalLink size={11} />
                        </a>
                      </strong>
                    </div>
                  )}
                  {!detalle.sector && !detalle.direccion && !detalle.web && !(detalle.distrito || detalle.provincia || detalle.departamento) && (
                    <div className="wide"><strong className="pg-muted">Sin datos registrados</strong></div>
                  )}
                </div>

                {(detalle.fuentes || []).length > 0 && (
                  <div className="pros-fuentes">
                    <span className="pg-field-label"><ShieldCheck size={12} /> Fuentes de datos</span>
                    {detalle.fuentes.map((f) => (
                      f.url ? (
                        <a key={f.id_fuente} className="pros-link" href={f.url} target="_blank" rel="noopener noreferrer"
                           title={`Verificar la fuente:\n${f.url}`}>
                          <ExternalLink size={11} />
                          <span>{FUENTE_LABEL[f.fuente] || f.fuente} · {hostFromUrl(f.url)}</span>
                          <small>{String(f.fecha_scraping || '').slice(0, 10)}</small>
                        </a>
                      ) : (
                        <span key={f.id_fuente} className="pg-muted">
                          {FUENTE_LABEL[f.fuente] || f.fuente} <small>{String(f.fecha_scraping || '').slice(0, 10)}</small>
                        </span>
                      )
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="pg-section-title"><Phone size={14} /> Contactos</h3>
                {(() => {
                  const orden = { Email: 0, Telefono: 1, Celular: 1, Whatsapp: 1, Web: 2, RedSocial: 3 };
                  const esMovil = (c) => /^9\d{8}$/.test(c.valor_normalizado || '');
                  const cts = [...(detalle.contactos || [])].sort((a, b) => {
                    const d = (orden[a.tipo] ?? 9) - (orden[b.tipo] ?? 9);
                    return d !== 0 ? d : (esMovil(a) ? 0 : 1) - (esMovil(b) ? 0 : 1);
                  });
                  const tieneTel = cts.some((c) => ['Telefono', 'Celular', 'Whatsapp'].includes(c.tipo));
                  const tieneEmail = cts.some((c) => c.tipo === 'Email');
                  if (cts.length === 0) {
                    return <div className="vt-note is-warning is-compact"><AlertTriangle size={14} /><span>Sin datos de contacto todavía.</span></div>;
                  }
                  return (
                    <>
                      <ul className="pg-list">
                        {cts.map((c) => (
                          <li className="pros-contact-row" key={c.id_contacto}>
                            {c.tipo === 'Email' ? <Mail size={15} /> : c.tipo === 'Web' ? <Globe size={15} /> : c.tipo === 'RedSocial' ? <Globe size={15} /> : <Phone size={15} />}
                            <div className="pros-contact-main">
                              <div className="pros-contact-val">
                                {c.fuente_url ? (
                                  <a
                                    className="pros-link"
                                    href={c.fuente_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`Verificar en la fuente:\n${c.fuente_url}\n(clic para abrir en otra pestaña)`}
                                  >
                                    {c.valor} <ExternalLink size={11} />
                                  </a>
                                ) : (
                                  <span
                                    className="pros-break"
                                    title={c.fuente === 'manual' ? 'Ingresado a mano (sin fuente web)' : 'Sin URL de origen registrada'}
                                  >
                                    {c.valor}
                                  </span>
                                )}
                                {c.area && <span className="pg-tag is-accent">{c.area}</span>}
                              </div>
                              {c.fuente_url ? (
                                <span className="pg-cell-sub" title={c.fuente_url}>
                                  Fuente: {FUENTE_LABEL[c.fuente] || c.fuente} · {hostFromUrl(c.fuente_url)}
                                </span>
                              ) : c.fuente && c.fuente !== 'manual' ? (
                                <span className="pg-cell-sub">
                                  Fuente: {FUENTE_LABEL[c.fuente] || c.fuente}
                                </span>
                              ) : null}
                              {(c.nombre_persona || c.cargo) && (
                                <span className="pg-cell-sub">
                                  {c.nombre_persona}{c.nombre_persona && c.cargo ? ' · ' : ''}{c.cargo}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                      {!tieneTel && (
                        <div className="vt-note is-warning is-compact"><AlertTriangle size={14} /><span>Sin número de contacto.</span></div>
                      )}
                      {!tieneEmail && (
                        <div className="vt-note is-warning is-compact"><AlertTriangle size={14} /><span>Sin correo de contacto.</span></div>
                      )}
                    </>
                  );
                })()}
              </section>

              <section>
                <h3 className="pg-section-title"><Gauge size={14} /> Estado comercial</h3>
                <select
                  className="form-select"
                  aria-label="Estado comercial"
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
              </section>

              <section>
                <h3 className="pg-section-title"><History size={14} /> Historial de gestión</h3>
                {(detalle.historial || []).length === 0 ? (
                  <p className="pg-empty-line">Sin movimientos registrados aún.</p>
                ) : (
                  <ul className="pros-historial">
                    {(detalle.historial || []).map((h) => (
                      <li key={h.id_historial}>
                        <Clock size={13} />
                        <div>
                          <span className="pg-cell-main">
                            {ACCION_LABEL[h.accion] || h.accion}
                            {h.valor_nuevo && <span className="pg-muted"> → {ESTADO_CHIP[h.valor_nuevo]?.label || h.valor_nuevo}</span>}
                          </span>
                          <span className="pg-cell-sub">{h.usuario || 'Sistema'} · {h.fecha}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </PgDrawer>
      )}

      <Modal isOpen={ingestaOpen} onClose={() => setIngestaOpen(false)} title="Ingresar empresas por RUC" size="md">
        <p className="pros-modal-intro">
          Pega uno o varios RUCs (separados por espacio, coma o salto de línea). Se consultan en <b>fuentes públicas de SUNAT</b> (razón social, estado, dirección, <b>actividad CIIU</b> y representantes) y <b>se buscan sus datos de contacto automáticamente</b> (web, correos, teléfonos y redes) anclados al RUC. Se calcula su score y se marcan los que ya son clientes. Máx. 50 por lote.
        </p>
        <div className="form-group">
          <label className="form-label" htmlFor="pros-ingesta-rucs">RUCs</label>
          <textarea
            id="pros-ingesta-rucs"
            className="form-input pros-mono"
            rows={5}
            placeholder="20512345678, 20487654321…"
            value={ingestaTexto}
            onChange={(e) => setIngestaTexto(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="pros-ingesta-segmento">Segmento</label>
          <select id="pros-ingesta-segmento" className="form-select" value={ingestaSegmento} onChange={(e) => setIngestaSegmento(e.target.value)}>
            <option value="Formal">Formal (empresa con factura)</option>
            <option value="Pequeno">Pequeño (compra libre / sin IGV)</option>
          </select>
        </div>

        {ingestaRes && (
          <div className="pros-ingesta-res">
            <div className="pros-ingesta-box is-success"><b>{ingestaRes.creados}</b><span>Creados</span></div>
            <div className="pros-ingesta-box is-warning"><b>{ingestaRes.ya_cliente}</b><span>Ya clientes</span></div>
            <div className="pros-ingesta-box"><b>{ingestaRes.ya_prospecto}</b><span>Ya existían</span></div>
          </div>
        )}
        {ingestaRes?.errores?.length > 0 && (
          <p className="vt-error pros-mt">{ingestaRes.errores.length} RUC(s) con error o no encontrados en las fuentes públicas.</p>
        )}

        <div className="vt-lp-modal-foot pros-mt-lg">
          <button type="button" className="btn btn-outline" onClick={() => setIngestaOpen(false)}>Cerrar</button>
          <button type="button" className="btn btn-primary" onClick={hacerIngesta} disabled={ingestaLoading || !ingestaTexto.trim()}>
            {ingestaLoading ? <><Loader size={16} className="pros-spin" /> Procesando…</> : <><Upload size={16} /> Procesar</>}
          </button>
        </div>
      </Modal>

      <Modal isOpen={exportOpen} onClose={() => setExportOpen(false)} title="Exportar prospectos a Excel" size="sm">
        <p className="pros-modal-intro">
          Se exportan los prospectos con los <b>filtros actuales</b> ({totalRegistros.toLocaleString('es-PE')} registros · {totalPaginas.toLocaleString('es-PE')} hojas de 50). El archivo se genera en el servidor y se descarga directo.
        </p>

        <div className="pros-radios">
          <label className="pg-check">
            <input type="radio" name="export-modo" checked={exportModo === 'todo'} onChange={() => setExportModo('todo')} />
            <div><span>Exportar todo</span><small>Los {totalRegistros.toLocaleString('es-PE')} registros del filtro actual en un solo archivo.</small></div>
          </label>

          <label className="pg-check">
            <input type="radio" name="export-modo" checked={exportModo === 'rango'} onChange={() => setExportModo('rango')} />
            <div><span>Rango de hojas</span><small>Elige desde y hasta qué hoja abarcar (50 registros por hoja).</small></div>
          </label>
        </div>

        {exportModo === 'rango' && (
          <div className="pros-rango">
            <div className="pg-field">
              <label className="pg-field-label" htmlFor="pros-export-desde">Desde hoja</label>
              <input id="pros-export-desde" type="number" className="form-input pros-num" min={1} max={totalPaginas}
                value={exportDesde}
                onChange={(e) => setExportDesde(Math.max(1, Math.min(parseInt(e.target.value) || 1, totalPaginas)))} />
            </div>
            <div className="pg-field">
              <label className="pg-field-label" htmlFor="pros-export-hasta">Hasta hoja</label>
              <input id="pros-export-hasta" type="number" className="form-input pros-num" min={1} max={totalPaginas}
                value={exportHasta}
                onChange={(e) => setExportHasta(Math.max(1, Math.min(parseInt(e.target.value) || 1, totalPaginas)))} />
            </div>
            <span className="pg-hint">
              ≈ {(Math.max(0, Math.min(exportHasta, totalPaginas) - Math.min(exportDesde, totalPaginas) + 1) * POR_PAGINA).toLocaleString('es-PE')} registros
            </span>
          </div>
        )}

        <div className="vt-lp-modal-foot pros-mt-lg">
          <button type="button" className="btn btn-outline" onClick={() => setExportOpen(false)} disabled={exportLoading}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={exportarExcel} disabled={exportLoading}>
            {exportLoading ? <><Loader size={16} className="pros-spin" /> Generando…</> : <><FileSpreadsheet size={16} /> Descargar</>}
          </button>
        </div>
      </Modal>

      <Modal isOpen={descubrirOpen} onClose={() => setDescubrirOpen(false)} title="Descubrir empresas por departamento y sector" size="md">
        <p className="pros-modal-intro">
          Trae empresas <b>reales del Padrón de SUNAT</b> (personas jurídicas activas) de los sectores que compran empaque, filtradas por departamento. Se crean como prospectos con razón social, estado y ubicación oficiales, y se les busca web/contactos anclados al RUC. <b>No duplica</b> lo que ya tienes ni toca a tus clientes.
        </p>

        {padron === null ? (
          <div className="pg-loading"><Loader size={18} className="pros-spin" /><span>Cargando disponibilidad del padrón…</span></div>
        ) : padron.total === 0 ? (
          <div className="vt-note is-warning">
            <AlertTriangle size={16} />
            <div>
              <strong>El padrón aún no está cargado</strong>
              <p>
                Un administrador debe importarlo una vez con:<br />
                <code className="pros-code">npm run import:padron -- --file=padron_reducido_ruc.zip</code><br />
                (descarga el Padrón Reducido RUC del portal de SUNAT). Luego vuelve aquí.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="pg-hint pros-mb">
              <b>{Number(padron.total).toLocaleString('es-PE')}</b> empresas objetivo en el padrón
              {padron.ultima_import ? ` · actualizado ${String(padron.ultima_import).slice(0, 10)}` : ''}.
            </p>

            <span className="form-label"><MapPin size={13} /> Departamentos</span>
            <div className="pros-zonas-grid">
              {(padron.departamentos || []).map((d) => {
                const on = padronSel.departamentos.includes(d.valor);
                return (
                  <label key={d.valor} className={`pros-zona-chk ${on ? 'on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => togglePadron('departamentos', d.valor)} />
                    <span>{d.valor} <small>({Number(d.total).toLocaleString('es-PE')})</small></span>
                  </label>
                );
              })}
            </div>

            <span className="form-label pros-mt">Sectores <small className="pg-muted">(vacío = todos)</small></span>
            <div className="pros-zonas-grid">
              {(padron.sectores || []).map((s) => {
                const on = padronSel.sectores.includes(s.valor);
                return (
                  <label key={s.valor} className={`pros-zona-chk ${on ? 'on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => togglePadron('sectores', s.valor)} />
                    <span>{s.valor} <small>({Number(s.total).toLocaleString('es-PE')})</small></span>
                  </label>
                );
              })}
            </div>

            <div className="form-group pros-mt pros-limite">
              <label className="form-label" htmlFor="pros-padron-limite">Cuántas crear por vez (máx. {Number(padron.max_por_lote || 2000).toLocaleString('es-PE')})</label>
              <input id="pros-padron-limite" type="number" className="form-input" min={1} max={padron.max_por_lote || 2000} value={padronSel.limite}
                onChange={(e) => setPadronSel({ ...padronSel, limite: Math.max(1, Math.min(parseInt(e.target.value) || 1, padron.max_por_lote || 2000)) })} />
            </div>

            <div className="vt-note is-compact">
              <AlertCircle size={14} />
              <span>Se crean solo empresas que aún no tienes (ni prospecto ni cliente). Es un tope <b>por vez</b> (puedes repetir). Cada una encola un enriquecimiento (web/correos/teléfonos por RUC) que corre en segundo plano; por eso no conviene crear decenas de miles de golpe. Lotes grandes tardan un poco en crearse.</span>
            </div>
          </>
        )}

        <div className="vt-lp-modal-foot pros-mt-lg">
          <button type="button" className="btn btn-outline" onClick={() => setDescubrirOpen(false)}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={hacerDescubrir}
            disabled={descubrirLoading || !padron || padron.total === 0 || padronSel.departamentos.length === 0}>
            {descubrirLoading ? <><Loader size={16} className="pros-spin" /> Creando…</> : <><Compass size={16} /> Descubrir</>}
          </button>
        </div>
      </Modal>

      <Modal isOpen={convertOpen} onClose={() => setConvertOpen(false)} title="Crear cliente desde prospecto" size="md">
        {convertData && (
          <>
            <div className="vt-note is-accent pros-mb">
              <Building2 size={16} />
              <div><strong>{convertData.razon_social}</strong></div>
            </div>
            <div className="pros-conv-doc">
              <div className="form-group">
                <label className="form-label" htmlFor="pros-conv-tipo">Tipo doc.</label>
                <select id="pros-conv-tipo" className="form-select" value={convertData.tipo_documento} onChange={(e) => setConvertData({ ...convertData, tipo_documento: e.target.value })}>
                  <option value="RUC">RUC</option>
                  <option value="DNI">DNI</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pros-conv-doc">Documento *</label>
                <input id="pros-conv-doc" className="form-input" value={convertData.documento} onChange={(e) => setConvertData({ ...convertData, documento: e.target.value })} placeholder="RUC o DNI" />
              </div>
            </div>
            <div className="pg-form-grid">
              <div className="form-group"><label className="form-label" htmlFor="pros-conv-tel">Teléfono</label><input id="pros-conv-tel" className="form-input" value={convertData.telefono} onChange={(e) => setConvertData({ ...convertData, telefono: e.target.value })} /></div>
              <div className="form-group"><label className="form-label" htmlFor="pros-conv-email">Email</label><input id="pros-conv-email" className="form-input" value={convertData.email} onChange={(e) => setConvertData({ ...convertData, email: e.target.value })} /></div>
            </div>
            <div className="pg-form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="pros-conv-cond">Condición</label>
                <select id="pros-conv-cond" className="form-select" value={convertData.condicion_pago} onChange={(e) => setConvertData({ ...convertData, condicion_pago: e.target.value })}>
                  <option value="Contado">Contado</option>
                  <option value="Credito">Crédito</option>
                </select>
              </div>
              {convertData.condicion_pago === 'Credito' && (
                <div className="form-group"><label className="form-label" htmlFor="pros-conv-dias">Días crédito</label><input id="pros-conv-dias" type="number" className="form-input" value={convertData.dias_credito} onChange={(e) => setConvertData({ ...convertData, dias_credito: e.target.value })} /></div>
              )}
            </div>
            <p className="pg-hint">
              Se creará en tu tabla de clientes. Si el documento ya existe, se enlaza sin duplicar.
            </p>
            <div className="vt-lp-modal-foot pros-mt-lg">
              <button type="button" className="btn btn-outline" onClick={() => setConvertOpen(false)}>Cancelar</button>
              <button type="button" className="btn btn-success" onClick={confirmarConvertir} disabled={convertLoading || !convertData.documento}>
                {convertLoading ? <><Loader size={16} className="pros-spin" /> Creando…</> : <><UserPlus size={16} /> Crear cliente</>}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
