import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Factory,
  Calendar,
  Search,
  RefreshCw,
  ClipboardList,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  UserCog,
  CalendarCheck,
  CalendarDays,
  Moon,
  Sun,
  ShieldCheck,
  Paperclip,
  PauseCircle,
  Users,
  X
} from 'lucide-react';
import { ordenesProduccionAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { BadgeEstadoProduccion, BadgePrioridad } from './estadosProduccion';
import './Produccion.css';

const fmtUnid = (valor) => String(parseFloat(parseFloat(valor || 0).toFixed(2)));

const KPIS_ESTADO = [
  { estado: 'Pendiente Asignación', label: 'Por asignar', tono: 'is-warning', icon: AlertCircle },
  { estado: 'Pendiente', label: 'Pendientes', tono: '', icon: Clock },
  { estado: 'En Curso', label: 'En curso', tono: 'is-accent', icon: Factory },
  { estado: 'En Pausa', label: 'En pausa', tono: 'is-info', icon: PauseCircle },
  { estado: 'Finalizada', label: 'Finalizadas', tono: 'is-success', icon: CheckCircle }
];

function OrdenesProduccion() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroOrigen, setFiltroOrigen] = useState('');
  const [filtroProgramadasHoy, setFiltroProgramadasHoy] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const userRole = user?.rol || '';
  const esComercial = ['comercial', 'ventas', 'vendedor'].includes(userRole.toLowerCase());

  useEffect(() => {
    cargarDatos({ silencioso: ordenes.length > 0 });
  }, [filtroOrigen, fechaInicio, fechaFin]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroEstado, filtroOrigen, busqueda, fechaInicio, fechaFin, filtroProgramadasHoy]);

  const cargarDatos = async ({ silencioso = false } = {}) => {
    try {
      if (silencioso) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = {};
      if (filtroOrigen) params.origen_tipo = filtroOrigen;
      if (fechaInicio) params.fecha_inicio = fechaInicio;
      if (fechaFin) params.fecha_fin = fechaFin;

      const response = await ordenesProduccionAPI.getAll(params);
      setOrdenes(response.data.data || []);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError(err.error || 'Error al cargar órdenes de producción');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const esProgramadaParaHoy = (orden) => {
    if (!orden.fecha_programada) return false;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inicio = new Date(orden.fecha_programada);
    inicio.setHours(0, 0, 0, 0);

    const fin = orden.fecha_programada_fin ? new Date(orden.fecha_programada_fin) : new Date(orden.fecha_programada);
    fin.setHours(0, 0, 0, 0);

    return hoy >= inicio && hoy <= fin;
  };

  const calcularEstadisticas = () => {
    const porEstado = KPIS_ESTADO.reduce((acc, k) => ({ ...acc, [k.estado]: 0 }), {});
    ordenes.forEach(o => {
      if (porEstado[o.estado] !== undefined) porEstado[o.estado] += 1;
    });
    const total = ordenes.length;
    return {
      total,
      porEstado,
      programadasHoy: ordenes.filter(esProgramadaParaHoy).length,
      desdeVentas: ordenes.filter(o => o.origen_tipo === 'Orden de Venta').length,
      desdeSupervisor: ordenes.filter(o => o.origen_tipo === 'Supervisor' || !o.origen_tipo).length,
      productosDiferentes: new Set(ordenes.map(o => o.id_producto_terminado)).size,
      porcentajeCompletado: total > 0 ? ((porEstado.Finalizada / total) * 100).toFixed(1) : '0.0'
    };
  };

  const ordenesFiltradas = ordenes.filter(orden => {
    if (filtroEstado && orden.estado !== filtroEstado) return false;
    if (filtroProgramadasHoy && !esProgramadaParaHoy(orden)) return false;

    if (!busqueda) return true;
    const searchTerm = busqueda.toLowerCase();
    return (
      orden.numero_orden?.toLowerCase().includes(searchTerm) ||
      orden.producto?.toLowerCase().includes(searchTerm) ||
      orden.codigo_producto?.toLowerCase().includes(searchTerm) ||
      orden.supervisor?.toLowerCase().includes(searchTerm) ||
      orden.maquinista?.toLowerCase().includes(searchTerm) ||
      orden.numero_orden_venta?.toLowerCase().includes(searchTerm)
    );
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = ordenesFiltradas.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.max(1, Math.ceil(ordenesFiltradas.length / itemsPerPage));

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';

    if (fecha.includes('T') || (fecha.includes(' ') && fecha.includes(':'))) {
      return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    const partes = fecha.split(' ')[0].split('-');
    if (partes.length === 3) {
      const [year, month, day] = partes;
      return `${day}/${month}/${year}`;
    }

    return fecha;
  };

  const parseVerificacionCalidad = (observaciones) => {
    if (!observaciones || !observaciones.includes('[VERIFICACIÓN CALIDAD]')) return null;

    try {
      const match = observaciones.match(/Verificado por:\s*(.*?)\s*el\s*(.*)/i);
      if (match && match[1]) {
        return { nombre: match[1].trim(), fecha: match[2] ? match[2].trim() : '' };
      }
      return { nombre: 'Verificado', fecha: '' };
    } catch (e) {
      return { nombre: 'Verificado', fecha: '' };
    }
  };

  const limpiarObservaciones = (valor) => (
    valor ? valor.replace(/\[VERIFICACIÓN CALIDAD\].*?(?:\n|$)/gi, '').trim() : ''
  );

  const handleDescargarPDF = async (id) => {
    try {
      await ordenesProduccionAPI.generarPDF(id);
      setSuccess('PDF descargado exitosamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Error al descargar PDF');
    }
  };

  const hayFiltros = filtroEstado || filtroOrigen || filtroProgramadasHoy || busqueda || fechaInicio || fechaFin;

  const limpiarFiltros = () => {
    setFiltroEstado('');
    setFiltroOrigen('');
    setFiltroProgramadasHoy(false);
    setBusqueda('');
    setFechaInicio('');
    setFechaFin('');
  };

  const renderProgreso = (row) => {
    const metaKg = parseFloat(row.cantidad_planificada || 0);
    const realKg = parseFloat(row.cantidad_producida || 0);
    const pctKg = metaKg > 0 ? (realKg / metaKg) * 100 : (realKg > 0 ? 100 : 0);

    const metaUnd = parseFloat(row.cantidad_unidades || 0);
    const realUnd = parseFloat(row.cantidad_unidades_producida || 0);
    const pctUnd = metaUnd > 0 ? (realUnd / metaUnd) * 100 : (realUnd > 0 ? 100 : 0);

    const unidadLabel = row.unidad_medida || 'Und';

    return (
      <div className="pd-progress">
        <div className="pd-progress-row">
          <div className="pd-progress-top">
            <span>Kilos</span>
            <b className={pctKg > 100 ? 'pd-over' : ''}>{realKg.toFixed(2)} <small>/ {metaKg.toFixed(2)}</small></b>
          </div>
          <div className="pg-meter" title={`Avance en kilos: ${pctKg.toFixed(1)}%`}
            style={{ '--meter-c': pctKg > 100 ? 'var(--warning)' : 'var(--success)' }}>
            <span style={{ width: `${Math.min(pctKg, 100)}%` }} />
          </div>
        </div>
        <div className="pd-progress-row">
          <div className="pd-progress-top">
            <span title={unidadLabel}>{unidadLabel}</span>
            <b className={pctUnd > 100 ? 'pd-over' : ''}>{fmtUnid(realUnd)} <small>/ {fmtUnid(metaUnd)}</small></b>
          </div>
          <div className="pg-meter" title={`Avance en ${unidadLabel}: ${pctUnd.toFixed(1)}%`}
            style={{ '--meter-c': pctUnd > 100 ? 'var(--warning)' : 'var(--info)' }}>
            <span style={{ width: `${Math.min(pctUnd, 100)}%` }} />
          </div>
        </div>
      </div>
    );
  };

  const numerosPagina = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const nums = [...new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])]
      .filter(n => n >= 1 && n <= totalPages)
      .sort((a, b) => a - b);
    return nums.reduce((acc, n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) acc.push('…');
      acc.push(n);
      return acc;
    }, []);
  })();

  if (loading) return <Loading variant="table" />;

  const stats = calcularEstadisticas();

  return (
    <div className="pg-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Factory size={13} /> Producción</span>
          <h1 className="pg-title">Órdenes de producción</h1>
          <p className="pg-subtitle">
            <b>{stats.total}</b> órdenes · <b>{stats.productosDiferentes}</b> productos ·
            {' '}<ShoppingCart size={12} style={{ verticalAlign: '-1px' }} /> <b>{stats.desdeVentas}</b> desde ventas ·
            {' '}<UserCog size={12} style={{ verticalAlign: '-1px' }} /> <b>{stats.desdeSupervisor}</b> internas
          </p>
        </div>
        <div className="pg-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate('/produccion/calendario')}>
            <CalendarDays size={16} /> Calendario
          </button>
          <button type="button" className="btn btn-outline" onClick={() => cargarDatos({ silencioso: true })} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Actualizar
          </button>
          {!esComercial && (
            <button type="button" className="btn btn-primary" onClick={() => navigate('/produccion/ordenes/nueva')}>
              <Plus size={16} /> Nueva orden
            </button>
          )}
        </div>
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        <div className="pg-kpis">
          {KPIS_ESTADO.map(k => {
            const Icono = k.icon;
            const activo = filtroEstado === k.estado;
            return (
              <button
                key={k.estado}
                type="button"
                className={`pg-kpi ${k.tono} ${activo ? 'on' : ''}`}
                aria-pressed={activo}
                onClick={() => setFiltroEstado(activo ? '' : k.estado)}
              >
                <div className="pg-kpi-top">
                  <span className="pg-kpi-label">{k.label}</span>
                  <span className="pg-kpi-icon"><Icono size={16} /></span>
                </div>
                <span className="pg-kpi-value">{stats.porEstado[k.estado]}</span>
                <span className="pg-kpi-foot">
                  {k.estado === 'Finalizada'
                    ? <><b>{stats.porcentajeCompletado}%</b> del total</>
                    : <>{activo ? 'Filtro activo · pulsa para quitar' : 'Pulsa para filtrar'}</>}
                </span>
              </button>
            );
          })}
        </div>

        <section className="pg-panel">
          <div className="pd-filters">
            <div className="pd-filters-row">
              <div className="pg-field pg-field-grow pd-search">
                <label className="pg-field-label" htmlFor="pd-busqueda">Buscar</label>
                <Search size={14} />
                <input
                  id="pd-busqueda"
                  type="search"
                  className="form-input"
                  placeholder="Orden, producto, código, supervisor, maquinista u OV"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              <div className="pg-field pd-date">
                <label className="pg-field-label" htmlFor="pd-desde">Desde</label>
                <input id="pd-desde" type="date" className="form-input" value={fechaInicio}
                  max={fechaFin || undefined} onChange={(e) => setFechaInicio(e.target.value)} />
              </div>
              <div className="pg-field pd-date">
                <label className="pg-field-label" htmlFor="pd-hasta">Hasta</label>
                <input id="pd-hasta" type="date" className="form-input" value={fechaFin}
                  min={fechaInicio || undefined} onChange={(e) => setFechaFin(e.target.value)} />
              </div>
              <div className="pg-field">
                <span className="pg-field-label">Origen</span>
                <div className="pg-segmented" role="radiogroup" aria-label="Origen">
                  {[
                    { id: '', label: 'Todas' },
                    { id: 'Orden de Venta', label: 'Ventas', icon: ShoppingCart },
                    { id: 'Supervisor', label: 'Internas', icon: UserCog }
                  ].map(op => {
                    const Icono = op.icon;
                    return (
                      <button key={op.label} type="button" role="radio" aria-checked={filtroOrigen === op.id}
                        className={filtroOrigen === op.id ? 'active' : ''} onClick={() => setFiltroOrigen(op.id)}>
                        {Icono && <Icono size={13} />}{op.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="pg-chips">
              <button type="button" className={`pg-chip ${filtroProgramadasHoy ? 'on' : ''}`} aria-pressed={filtroProgramadasHoy}
                onClick={() => setFiltroProgramadasHoy(!filtroProgramadasHoy)}>
                <CalendarCheck size={14} /> Programadas para hoy <b>{stats.programadasHoy}</b>
              </button>
              {filtroEstado && (
                <button type="button" className="pg-chip on" onClick={() => setFiltroEstado('')}>
                  Estado: {filtroEstado} <X size={13} />
                </button>
              )}
              {hayFiltros && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={limpiarFiltros}>
                  <X size={14} /> Limpiar filtros
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="pg-panel">
          <div className="pg-panel-head">
            <h2 className="pg-panel-title"><ClipboardList size={16} /> Listado <span className="pg-count">{ordenesFiltradas.length}</span></h2>
            <span className="pg-panel-meta">
              {ordenesFiltradas.length > 0
                ? `Mostrando ${indexOfFirstItem + 1}–${Math.min(indexOfLastItem, ordenesFiltradas.length)} de ${ordenesFiltradas.length}`
                : 'Sin resultados'}
            </span>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-table">
              <thead>
                <tr>
                  <th>N° orden</th>
                  <th>Producto</th>
                  <th>Progreso</th>
                  <th>Responsable</th>
                  <th>Fechas</th>
                  <th className="center">Estado</th>
                  <th className="center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? currentItems.map(row => {
                  const verificacion = parseVerificacionCalidad(row.observaciones);
                  const observaciones = limpiarObservaciones(row.observaciones);
                  return (
                    <tr key={row.id_orden} className="is-clickable" onClick={() => navigate(`/produccion/ordenes/${row.id_orden}`)}>
                      <td className="nowrap">
                        <span className="pg-code">{row.numero_orden}</span>
                        <div className="pd-tags">
                          {row.origen_tipo === 'Orden de Venta' ? (
                            <span className="pd-tag is-info"><ShoppingCart size={11} />{row.numero_orden_venta || 'Venta'}</span>
                          ) : (
                            <span className="pd-tag"><UserCog size={11} />Interna</span>
                          )}
                          {row.es_manual === 1 && <span className="pd-tag is-warning">Manual</span>}
                        </div>
                        {row.prioridad_venta && <div className="pd-tags"><BadgePrioridad prioridad={row.prioridad_venta} /></div>}
                      </td>
                      <td style={{ minWidth: 220 }}>
                        <span className="pg-cell-main">{row.producto}</span>
                        <span className="pg-cell-sub">{row.codigo_producto}</span>
                        <div className="pd-tags">
                          {row.nombre_receta && <span className="pd-tag is-info"><ClipboardList size={11} />{row.nombre_receta}</span>}
                          {row.producto_eliminado === 1 && <span className="pd-tag is-danger"><AlertTriangle size={11} />Producto eliminado</span>}
                        </div>
                        {observaciones && <span className="pg-cell-sub pg-truncate" title={observaciones}>{observaciones}</span>}
                      </td>
                      <td>{renderProgreso(row)}</td>
                      <td className="nowrap">
                        <span className="pg-cell-main"><Users size={12} className="pg-muted" style={{ marginRight: 4, verticalAlign: '-1px' }} />{row.supervisor || 'Sin asignar'}</span>
                        {row.maquinista && <span className="pg-cell-sub">Maquinista: {row.maquinista}</span>}
                        {row.turno && (
                          <span className="pg-cell-sub">
                            {row.turno === 'Noche' ? <Moon size={11} style={{ verticalAlign: '-1px' }} /> : <Sun size={11} style={{ verticalAlign: '-1px' }} />} {row.turno}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="pd-dates">
                          <span><Calendar size={11} /> Creada {formatearFecha(row.fecha_creacion)}</span>
                          {row.fecha_programada && <span className="is-info"><CalendarCheck size={11} /> Prog. {formatearFecha(row.fecha_programada)}</span>}
                          {row.fecha_estimada_venta && <span className="is-warning"><AlertCircle size={11} /> Entrega {formatearFecha(row.fecha_estimada_venta)}</span>}
                          {row.fecha_fin && <span className="is-success"><CheckCircle size={11} /> Fin {formatearFecha(row.fecha_fin)}</span>}
                        </div>
                      </td>
                      <td className="center">
                        <BadgeEstadoProduccion estado={row.estado} />
                        {verificacion && (
                          <span className="pg-cell-sub" title={verificacion.fecha}>
                            <ShieldCheck size={11} className="text-success" style={{ verticalAlign: '-1px' }} /> {verificacion.nombre}
                          </span>
                        )}
                      </td>
                      <td className="center" onClick={(e) => e.stopPropagation()}>
                        <div className="pd-actions">
                          <button type="button" className="pg-iconbtn" title="Ver detalle" aria-label={`Ver ${row.numero_orden}`}
                            onClick={() => navigate(`/produccion/ordenes/${row.id_orden}`)}>
                            <Eye size={15} />
                          </button>
                          <button type="button" className="pg-iconbtn" title="Descargar PDF" aria-label={`PDF ${row.numero_orden}`}
                            onClick={() => handleDescargarPDF(row.id_orden)}>
                            <Download size={15} />
                          </button>
                        </div>
                        {row.total_adjuntos > 0 && (
                          <span className="pg-cell-sub"><Paperclip size={11} style={{ verticalAlign: '-1px' }} /> {row.total_adjuntos} adjuntos</span>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="pg-empty">
                        <Factory size={28} />
                        <strong>{hayFiltros ? 'No hay órdenes con estos filtros' : 'No hay órdenes registradas'}</strong>
                        {hayFiltros && <span>Quita algún filtro o limpia la búsqueda.</span>}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {ordenesFiltradas.length > itemsPerPage && (
            <div className="pg-pager">
              <span>
                <b>{indexOfFirstItem + 1}</b>–<b>{Math.min(indexOfLastItem, ordenesFiltradas.length)}</b> de <b>{ordenesFiltradas.length}</b> órdenes
              </span>
              <div className="pg-pager-nav">
                <button type="button" className="pagination-nav-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                  <ChevronLeft size={15} /> Anterior
                </button>
                {numerosPagina.map((n, i) => (
                  n === '…'
                    ? <span key={`e-${i}`} className="pg-muted">…</span>
                    : <button key={n} type="button" className={`pagination-page-btn ${n === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(n)}>{n}</button>
                ))}
                <button type="button" className="pagination-nav-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                  Siguiente <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default OrdenesProduccion;
