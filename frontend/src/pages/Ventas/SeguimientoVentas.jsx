import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Search, X, Eye, Package, CalendarDays, FileCheck, ClipboardList, AlertTriangle
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import PgPager from '../../components/UI/PgPager';
import { ordenesVentaAPI } from '../../config/api';
import { ESTADOS_ORDEN, BadgeEstadoOrden, BadgeSee, configTipoEntrega } from './estadosVentas';
import { diasDesde } from '../Maestros/formatoMaestros';
import './Ventas.css';

const ESTADOS_KPI = ['En Espera', 'En Proceso', 'Atendido por Producción', 'Despacho Parcial', 'Despachada', 'Entregada'];
const ESTADOS_CERRADOS = ['Despachada', 'Entregada', 'Cancelada'];

const numeroGuia = (g) => (g.serie_sunat && g.numero_sunat ? `${g.serie_sunat}-${g.numero_sunat}` : g.numero_guia);

function SeguimientoVentas() {
  const navigate = useNavigate();

  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [busqueda, setBusqueda] = useState(() => sessionStorage.getItem('seg_busqueda') || '');
  const [fechaInicio, setFechaInicio] = useState(() => sessionStorage.getItem('seg_fecha_inicio') || '');
  const [fechaFin, setFechaFin] = useState(() => sessionStorage.getItem('seg_fecha_fin') || '');
  const [filtroEstado, setFiltroEstado] = useState(() => sessionStorage.getItem('seg_estado') || '');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    sessionStorage.setItem('seg_busqueda', busqueda);
    sessionStorage.setItem('seg_fecha_inicio', fechaInicio);
    sessionStorage.setItem('seg_fecha_fin', fechaFin);
    sessionStorage.setItem('seg_estado', filtroEstado);
  }, [busqueda, fechaInicio, fechaFin, filtroEstado]);

  useEffect(() => {
    cargarDatos();
  }, [fechaInicio, fechaFin, filtroEstado]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const filtros = {};
      if (filtroEstado) filtros.estado = [filtroEstado];
      if (fechaInicio) filtros.fecha_inicio = fechaInicio;
      if (fechaFin) filtros.fecha_fin = fechaFin;

      const response = await ordenesVentaAPI.getAll(filtros);
      if (response.data.success) {
        setOrdenes(response.data.data || []);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar el seguimiento de órdenes');
    } finally {
      setLoading(false);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setFechaInicio('');
    setFechaFin('');
    setFiltroEstado('');
    setCurrentPage(1);
  };

  const formatearFechaVisual = (fechaStr) => {
    if (!fechaStr) return '-';
    const partes = fechaStr.split('T')[0].split('-');
    if (partes.length !== 3) return fechaStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const ordenesFiltradas = ordenes.filter(orden => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return (
      orden.numero_orden?.toLowerCase().includes(term) ||
      orden.cliente?.toLowerCase().includes(term) ||
      orden.ruc_cliente?.toLowerCase().includes(term) ||
      orden.comercial?.toLowerCase().includes(term)
    );
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = ordenesFiltradas.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(ordenesFiltradas.length / itemsPerPage);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const conteoEstados = ordenes.reduce((acc, o) => ({ ...acc, [o.estado]: (acc[o.estado] || 0) + 1 }), {});
  const conDespacho = ordenes.filter(o => Number(o.total_despachos || 0) > 0).length;
  const hayFiltros = !!(busqueda || fechaInicio || fechaFin || filtroEstado);

  const renderEntrega = (orden) => {
    const tipo = configTipoEntrega(orden.tipo_entrega);
    const TipoIcono = tipo?.icon;
    const estimadaSuperada = !orden.fecha_entrega_real && orden.fecha_entrega_estimada
      && diasDesde(orden.fecha_entrega_estimada) > 0 && !ESTADOS_CERRADOS.includes(orden.estado);
    return (
      <>
        {orden.fecha_entrega_real ? (
          <span className="pg-cell-main"><CalendarDays size={12} className="pg-muted" />Entregada {formatearFechaVisual(orden.fecha_entrega_real)}</span>
        ) : orden.fecha_entrega_estimada ? (
          <span className="pg-cell-main"><CalendarDays size={12} className="pg-muted" />Estimada {formatearFechaVisual(orden.fecha_entrega_estimada)}</span>
        ) : (
          <span className="pg-muted">Sin fecha estimada</span>
        )}
        {tipo && <span className="pg-cell-sub"><TipoIcono size={11} />{tipo.label}</span>}
        {estimadaSuperada && (
          <span className="pg-tags"><span className="pg-tag is-warning"><AlertTriangle size={11} />Fecha estimada superada</span></span>
        )}
      </>
    );
  };

  return (
    <div className="pg-page vt-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Truck size={13} /> Ventas</span>
          <h1 className="pg-title">Seguimiento de despachos</h1>
          <p className="pg-subtitle">
            Pedido, despachado y pendiente por orden de venta · <b>{ordenes.length}</b> órdenes · <b>{conDespacho}</b> con despachos registrados
          </p>
        </div>
      </header>

      {loading && <Loading variant="table" />}

      <div className={`pg-stack vt-fade ${loading ? 'is-hidden' : ''}`}>
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        <div className="pg-kpis">
          {ESTADOS_KPI.map(estado => {
            const cfg = ESTADOS_ORDEN[estado];
            const Icono = cfg.icon;
            const activo = filtroEstado === estado;
            const visible = !filtroEstado || activo;
            return (
              <button key={estado} type="button" className={`pg-kpi ${cfg.tono} ${activo ? 'on' : ''}`} aria-pressed={activo}
                onClick={() => setFiltroEstado(activo ? '' : estado)}>
                <div className="pg-kpi-top">
                  <span className="pg-kpi-label">{cfg.label}</span>
                  <span className="pg-kpi-icon"><Icono size={16} /></span>
                </div>
                <span className="pg-kpi-value">{visible ? (conteoEstados[estado] || 0) : '—'}</span>
                <span className="pg-kpi-foot">{activo ? 'Filtro activo · pulsa para quitar' : 'Pulsa para filtrar'}</span>
              </button>
            );
          })}
        </div>

        <section className="pg-panel">
          <div className="pg-filters">
            <div className="pg-filters-row">
              <div className="pg-field pg-field-grow pg-search">
                <label className="pg-field-label" htmlFor="vt-seg-busqueda">Buscar</label>
                <Search size={14} />
                <input
                  id="vt-seg-busqueda"
                  type="search"
                  className="form-input"
                  placeholder="N° orden, cliente, RUC o vendedor"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              <div className="pg-field">
                <label className="pg-field-label" htmlFor="vt-seg-estado">Estado</label>
                <select
                  id="vt-seg-estado"
                  className="form-select"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  <option value="En Espera">En Espera</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="Atendido por Producción">Atendido por Producción</option>
                  <option value="Despacho Parcial">Despacho Parcial</option>
                  <option value="Despachada">Despachada</option>
                  <option value="Entregada">Entregada</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
              <div className="pg-field">
                <label className="pg-field-label" htmlFor="vt-seg-desde">Desde</label>
                <input id="vt-seg-desde" type="date" className="form-input vt-date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              </div>
              <div className="pg-field">
                <label className="pg-field-label" htmlFor="vt-seg-hasta">Hasta</label>
                <input id="vt-seg-hasta" type="date" className="form-input vt-date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
              </div>
              {hayFiltros && (
                <button type="button" onClick={limpiarFiltros} className="btn btn-ghost" style={{ height: 38 }}>
                  <X size={15} /> Limpiar filtros
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="pg-panel">
          <div className="pg-panel-head">
            <h2 className="pg-panel-title"><ClipboardList size={16} /> Órdenes <span className="pg-count">{ordenesFiltradas.length}</span></h2>
            <span className="pg-panel-meta">Pulsa una fila para ver el seguimiento</span>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Entrega</th>
                  <th className="center">Ítems</th>
                  <th className="center">Despachos</th>
                  <th>Guías de remisión</th>
                  <th className="center">Estado</th>
                  <th className="center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? currentItems.map(orden => {
                  const despachos = Number(orden.total_despachos || 0);
                  const guias = orden.guias || [];
                  return (
                    <tr key={orden.id_orden_venta} className="is-clickable" onClick={() => navigate(`/ventas/seguimiento/${orden.id_orden_venta}`)}>
                      <td className="nowrap">
                        <span className="pg-code">{orden.numero_orden}</span>
                        <span className="pg-cell-sub">{formatearFechaVisual(orden.fecha_emision)}</span>
                      </td>
                      <td>
                        <span className="pg-cell-main pg-truncate" title={orden.cliente}>{orden.cliente}</span>
                        <span className="pg-cell-sub">RUC {orden.ruc_cliente || '—'}</span>
                      </td>
                      <td>{orden.comercial || <span className="pg-muted">Sin asignar</span>}</td>
                      <td className="nowrap">{renderEntrega(orden)}</td>
                      <td className="center nowrap"><span className="pg-cell-main"><Package size={13} className="pg-muted" />{orden.total_items || 0}</span></td>
                      <td className="center nowrap">
                        <span className={`pg-cell-main ${despachos > 0 ? '' : 'pg-muted'}`}><Truck size={13} className="pg-muted" />{despachos}</span>
                      </td>
                      <td>
                        {guias.length > 0 ? (
                          <div className="vt-guias">
                            {guias.map((g, i) => (
                              <span key={`${numeroGuia(g)}-${i}`} className="vt-guia">
                                <span className="pg-code">{numeroGuia(g)}</span>
                                <BadgeSee estado={g.sunat_estado} />
                              </span>
                            ))}
                          </div>
                        ) : <span className="pg-muted">Sin guías</span>}
                      </td>
                      <td className="center"><BadgeEstadoOrden estado={orden.estado} /></td>
                      <td className="center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="pg-iconbtn"
                          onClick={(e) => { e.stopPropagation(); navigate(`/ventas/seguimiento/${orden.id_orden_venta}`); }}
                          title="Ver seguimiento"
                          aria-label={`Ver seguimiento de ${orden.numero_orden}`}
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={9}>
                      <div className="pg-empty">
                        <FileCheck size={28} />
                        <strong>{hayFiltros ? 'Ninguna orden coincide con los filtros' : 'Aún no hay órdenes de venta'}</strong>
                        <span>{hayFiltros ? 'Quita algún filtro o cambia la búsqueda.' : 'Las órdenes aparecerán aquí con su avance de despacho.'}</span>
                        {hayFiltros && <button type="button" className="btn btn-outline btn-sm" onClick={limpiarFiltros}><X size={14} /> Limpiar filtros</button>}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PgPager
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={ordenesFiltradas.length}
            itemsPerPage={itemsPerPage}
            setCurrentPage={setCurrentPage}
            sustantivo="órdenes"
          />
        </section>
      </div>
    </div>
  );
}

export default SeguimientoVentas;
