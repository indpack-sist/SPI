import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Eye, Filter, Search, XCircle, RefreshCw, ShieldAlert,
  AlertTriangle, AlertCircle, CheckCircle, Clock, Paperclip,
  ShoppingCart, Factory, Package, Calendar
} from 'lucide-react';
import { incidenciasAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import ModalNuevaIncidencia from './ModalNuevaIncidencia';

const ESTADOS = ['Abierta', 'En análisis', 'En tratamiento', 'Verificación', 'Cerrada', 'Anulada'];
const SEVERIDADES = ['Crítica', 'Mayor', 'Menor'];

export const getEstadoBadge = (estado) => {
  const configs = {
    'Abierta': { bg: 'badge-danger', icono: AlertCircle },
    'En análisis': { bg: 'badge-warning', icono: Clock },
    'En tratamiento': { bg: 'badge-info', icono: RefreshCw },
    'Verificación': { bg: 'badge-primary', icono: ShieldAlert },
    'Cerrada': { bg: 'badge-success', icono: CheckCircle },
    'Anulada': { bg: 'badge-secondary', icono: XCircle }
  };
  return configs[estado] || configs['Abierta'];
};

export const getSeveridadBadge = (severidad) => {
  if (severidad === 'Crítica') return 'badge-danger animate-pulse';
  if (severidad === 'Mayor') return 'badge-warning';
  return 'badge-success';
};

// Formatea SIEMPRE en hora de Perú (America/Lima), sin importar la zona del navegador.
export const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  const str = String(fecha);

  // Caso 1: texto plano "YYYY-MM-DD HH:mm[:ss]" (hora de pared de Perú ya guardada).
  // No lo pasamos por new Date() para no reinterpretarlo con la zona del navegador.
  const naive = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?$/.exec(str);
  if (naive) {
    const [, y, mo, d, h, mi] = naive;
    let hh = parseInt(h, 10);
    const ampm = hh >= 12 ? 'p. m.' : 'a. m.';
    hh = hh % 12; if (hh === 0) hh = 12;
    return `${d}/${mo}/${y}, ${String(hh).padStart(2, '0')}:${mi} ${ampm}`;
  }

  // Caso 2: ISO con zona (ej. "2026-06-24T13:00:00.000Z") → instante real → lo mostramos en Perú.
  const dt = new Date(str);
  if (!isNaN(dt.getTime()) && (str.includes('T') || str.includes('Z'))) {
    return dt.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  // Caso 3: solo fecha "YYYY-MM-DD".
  const partes = str.split(' ')[0].split('-');
  if (partes.length === 3) {
    const [year, month, day] = partes;
    return `${day}/${month}/${year}`;
  }
  return str;
};

function Incidencias() {
  const navigate = useNavigate();

  const [incidencias, setIncidencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroSeveridad, setFiltroSeveridad] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [modalNueva, setModalNueva] = useState(false);

  useEffect(() => {
    cargarDatos({ silencioso: incidencias.length > 0 });
  }, [filtroEstado, filtroSeveridad]);

  const cargarDatos = async ({ silencioso = false } = {}) => {
    try {
      silencioso ? setRefreshing(true) : setLoading(true);
      setError(null);
      const params = {};
      if (filtroEstado) params.estado = filtroEstado;
      if (filtroSeveridad) params.severidad = filtroSeveridad;
      const res = await incidenciasAPI.getAll(params);
      setIncidencias(res.data.data || []);
    } catch (err) {
      setError(err.error || 'Error al cargar las incidencias');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const stats = {
    total: incidencias.length,
    abiertas: incidencias.filter(i => !['Cerrada', 'Anulada'].includes(i.estado)).length,
    criticas: incidencias.filter(i => i.severidad === 'Crítica' && !['Cerrada', 'Anulada'].includes(i.estado)).length,
    cerradas: incidencias.filter(i => i.estado === 'Cerrada').length
  };

  const incidenciasFiltradas = incidencias.filter(i => {
    if (!busqueda) return true;
    const t = busqueda.toLowerCase();
    return (
      i.codigo?.toLowerCase().includes(t) ||
      i.producto?.toLowerCase().includes(t) ||
      i.numero_op?.toLowerCase().includes(t) ||
      i.numero_ov?.toLowerCase().includes(t) ||
      i.descripcion?.toLowerCase().includes(t)
    );
  });

  const limpiarFiltros = () => {
    setFiltroEstado('');
    setFiltroSeveridad('');
    setBusqueda('');
  };

  const columns = [
    {
      header: 'Código',
      accessor: 'codigo',
      width: '130px',
      render: (value, row) => (
        <div>
          <span className="font-mono font-bold text-primary">{value}</span>
          <div className="text-xs text-muted mt-1">{formatearFecha(row.fecha_deteccion)}</div>
        </div>
      )
    },
    {
      header: 'Producto / Origen',
      accessor: 'producto',
      render: (value, row) => (
        <div className="flex flex-col gap-1">
          <div className="font-medium text-sm flex items-center gap-1">
            <Package size={12} className="text-muted" /> {value || 'Sin producto'}
          </div>
          {row.codigo_producto && <div className="text-xs text-muted font-mono">{row.codigo_producto}</div>}
          {row.numero_op && (
            <div className="text-xs text-purple-700 flex items-center gap-1"><Factory size={11} /> {row.numero_op}</div>
          )}
          {row.numero_ov && (
            <div className="text-xs text-blue-700 flex items-center gap-1"><ShoppingCart size={11} /> {row.numero_ov}</div>
          )}
        </div>
      )
    },
    {
      header: 'Severidad',
      accessor: 'severidad',
      align: 'center',
      width: '100px',
      render: (value) => <span className={`badge ${getSeveridadBadge(value)}`}>{value}</span>
    },
    {
      header: 'Fase',
      accessor: 'fase_deteccion',
      width: '120px',
      render: (value) => <span className="text-xs text-gray-600">{value}</span>
    },
    {
      header: 'Descripción',
      accessor: 'descripcion',
      width: '220px',
      render: (value) => (
        <div className="text-xs text-gray-700 truncate max-w-[210px]" title={value}>{value}</div>
      )
    },
    {
      header: 'Estado',
      accessor: 'estado',
      align: 'center',
      width: '140px',
      render: (value) => {
        const cfg = getEstadoBadge(value);
        const Icono = cfg.icono;
        return <span className={`badge ${cfg.bg} flex items-center justify-center gap-1 px-3 py-1`}><Icono size={13} /> {value}</span>;
      }
    },
    {
      header: 'Adj.',
      accessor: 'total_adjuntos',
      width: '60px',
      align: 'center',
      render: (value) => value > 0
        ? <span className="flex items-center justify-center gap-1 text-primary text-sm font-medium"><Paperclip size={13} />{value}</span>
        : <span className="text-gray-300"><Paperclip size={13} /></span>
    },
    {
      header: 'Acciones',
      accessor: 'id_incidencia',
      width: '80px',
      align: 'center',
      render: (value) => (
        <button className="btn btn-sm btn-primary p-2" onClick={(e) => { e.stopPropagation(); navigate(`/calidad/incidencias/${value}`); }} title="Ver detalle">
          <Eye size={16} />
        </button>
      )
    }
  ];

  if (loading) return <Loading message="Cargando incidencias..." />;

  return (
    <div className="container py-6">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-primary-dark">
            <ShieldAlert className="text-danger" /> Incidencias de Calidad
          </h1>
          <p className="text-muted text-sm mt-1">Registro y seguimiento de no conformidades</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalNueva(true)}>
          <Plus size={18} /> Nueva Incidencia
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted">Total</p><h3 className="text-2xl font-bold">{stats.total}</h3></div>
              <div className="p-3 bg-blue-100 rounded-lg"><ShieldAlert size={24} className="text-primary" /></div>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-warning">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted">Abiertas</p><h3 className="text-2xl font-bold text-warning">{stats.abiertas}</h3></div>
              <div className="p-3 bg-yellow-100 rounded-lg"><Clock size={24} className="text-warning" /></div>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-danger">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted">Críticas activas</p><h3 className="text-2xl font-bold text-danger">{stats.criticas}</h3></div>
              <div className="p-3 bg-red-100 rounded-lg"><AlertTriangle size={24} className="text-danger" /></div>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-success">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted">Cerradas</p><h3 className="text-2xl font-bold text-success">{stats.cerradas}</h3></div>
              <div className="p-3 bg-green-100 rounded-lg"><CheckCircle size={24} className="text-success" /></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header flex justify-between items-center">
          <h3 className="card-title text-lg flex items-center gap-2"><Filter size={18} /> Filtros</h3>
          {(filtroEstado || filtroSeveridad || busqueda) && (
            <button className="btn btn-sm btn-outline text-danger border-danger" onClick={limpiarFiltros}>
              <XCircle size={14} /> Limpiar
            </button>
          )}
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 gap-4">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="form-input search-input"
                placeholder="Buscar código, producto, OP, OV, descripción..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted">Estado:</span>
              {ESTADOS.map(est => (
                <button key={est} className={`btn btn-sm ${filtroEstado === est ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado(filtroEstado === est ? '' : est)}>{est}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted">Severidad:</span>
              {SEVERIDADES.map(sev => (
                <button key={sev} className={`btn btn-sm ${filtroSeveridad === sev ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFiltroSeveridad(filtroSeveridad === sev ? '' : sev)}>{sev}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="card-title">Listado ({incidenciasFiltradas.length})</h2>
          <button className="btn btn-sm btn-outline" onClick={() => cargarDatos({ silencioso: true })} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="card-body table-container">
          <Table
            columns={columns}
            data={incidenciasFiltradas}
            emptyMessage="No hay incidencias registradas"
            onRowClick={(row) => navigate(`/calidad/incidencias/${row.id_incidencia}`)}
            mobileCards={true}
          />
        </div>
      </div>

      <ModalNuevaIncidencia
        isOpen={modalNueva}
        onClose={() => setModalNueva(false)}
        onCreated={() => { setSuccess('Incidencia registrada correctamente.'); cargarDatos({ silencioso: true }); }}
      />
    </div>
  );
}

export default Incidencias;
