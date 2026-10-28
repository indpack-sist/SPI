import { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Search, RefreshCw, Truck, X, Weight, Box, User, ClipboardList,
  FileCheck, CalendarDays, Activity
} from 'lucide-react';
import { flotaAPI } from '../../config/api';
import { usePagination } from '../../hooks/usePagination';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import PgDrawer from '../../components/UI/PgDrawer';
import PgPager from '../../components/UI/PgPager';
import { ESTADOS_VEHICULO, BadgeEstadoVehiculo } from '../Maestros/estadosMaestros';
import { fmtFecha, fmtNumero, haceTexto, incluye } from '../Maestros/formatoMaestros';
import { useResetPagina } from '../Maestros/useResetPagina';
import '../Maestros/Maestros.css';

const FORM_VACIO = { placa: '', marca_modelo: '', capacidad_kg: '', capacidad_m3: '', estado: 'Disponible' };

const ultimaActividad = (v) => {
  const fechas = [v.ultima_orden, v.ultima_guia].filter(Boolean).map(f => String(f));
  if (!fechas.length) return null;
  return fechas.sort().pop();
};

const sinUso = (v) => Number(v.ordenes_asignadas) === 0 && Number(v.guias_total) === 0;

function Flota() {
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState(FORM_VACIO);
  const [detalle, setDetalle] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroSinUso, setFiltroSinUso] = useState(false);

  useEffect(() => {
    cargarVehiculos();
  }, []);

  const cargarVehiculos = async ({ silencioso = false } = {}) => {
    try {
      if (silencioso) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const response = await flotaAPI.getAll({ resumen: 1 });
      setVehiculos(response.data.data || []);
    } catch (err) {
      setError(err.error || 'Error al cargar vehículos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const abrirModal = (vehiculo = null) => {
    if (vehiculo) {
      setEditando(vehiculo);
      setFormData({
        placa: vehiculo.placa,
        marca_modelo: vehiculo.marca_modelo || '',
        capacidad_kg: vehiculo.capacidad_kg || '',
        capacidad_m3: vehiculo.capacidad_m3 || '',
        estado: vehiculo.estado
      });
    } else {
      setEditando(null);
      setFormData(FORM_VACIO);
    }
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editando) {
        await flotaAPI.update(editando.id_vehiculo, formData);
        setSuccess('Vehículo actualizado exitosamente');
      } else {
        await flotaAPI.create(formData);
        setSuccess('Vehículo registrado exitosamente');
      }
      cerrarModal();
      setDetalle(null);
      cargarVehiculos({ silencioso: true });
    } catch (err) {
      setError(err.error || 'Error al guardar vehículo');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de desactivar este vehículo?')) return;

    try {
      setError(null);
      await flotaAPI.delete(id);
      setSuccess('Vehículo desactivado exitosamente');
      setDetalle(null);
      cargarVehiculos({ silencioso: true });
    } catch (err) {
      setError(err.error || 'Error al desactivar vehículo');
    }
  };

  const termino = busqueda.trim().toLowerCase();
  const vehiculosFiltrados = vehiculos.filter(v => {
    if (filtroEstado && v.estado !== filtroEstado) return false;
    if (filtroSinUso && !sinUso(v)) return false;
    if (!termino) return true;
    return incluye(v.placa, termino) || incluye(v.marca_modelo, termino) || incluye(v.ultimo_conductor, termino);
  });

  const { currentItems, setCurrentPage, ...paginacion } = usePagination(vehiculosFiltrados, { storageKey: 'flota_pagina' });
  useResetPagina(setCurrentPage, [busqueda, filtroEstado, filtroSinUso]);

  const hayFiltros = !!(busqueda || filtroEstado || filtroSinUso);
  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroEstado('');
    setFiltroSinUso(false);
  };

  if (loading) return <Loading variant="table" />;

  const porEstado = Object.keys(ESTADOS_VEHICULO).reduce((acc, k) => ({ ...acc, [k]: 0 }), {});
  vehiculos.forEach(v => { if (porEstado[v.estado] !== undefined) porEstado[v.estado] += 1; });
  const operativos = vehiculos.filter(v => v.estado !== 'Inactivo');
  const capacidadOperativa = operativos.reduce((s, v) => s + parseFloat(v.capacidad_kg || 0), 0);
  const guiasAceptadas = vehiculos.reduce((s, v) => s + Number(v.guias_aceptadas || 0), 0);
  const totalSinUso = vehiculos.filter(sinUso).length;

  const renderDrawer = () => {
    const v = detalle;
    const guias = Number(v.guias_total || 0);
    const aceptadas = Number(v.guias_aceptadas || 0);
    const pctAceptadas = guias > 0 ? (aceptadas / guias) * 100 : 0;
    return (
      <PgDrawer
        eyebrow={<><Truck size={12} /> Vehículo</>}
        title={v.placa}
        badges={<BadgeEstadoVehiculo estado={v.estado} />}
        onClose={() => setDetalle(null)}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={() => setDetalle(null)}>Cerrar</button>
            <button type="button" className="btn btn-primary" onClick={() => abrirModal(v)}>
              <Pencil size={16} /> Editar vehículo
            </button>
          </>
        )}
      >
        <section>
          <h3 className="pg-section-title"><Truck size={14} /> Datos del vehículo</h3>
          <div className="pg-kv">
            <div><span>Placa</span><strong className="pg-code">{v.placa}</strong></div>
            <div><span>Marca / modelo</span><strong>{v.marca_modelo || '—'}</strong></div>
            <div><span>Capacidad de carga</span><strong>{v.capacidad_kg ? `${fmtNumero(v.capacidad_kg, 2)} kg` : '—'}</strong></div>
            <div><span>Volumen</span><strong>{v.capacidad_m3 ? `${fmtNumero(v.capacidad_m3, 2)} m³` : '—'}</strong></div>
           <div><span>Fecha de registro</span><strong>{v.fecha_registro ? fmtFecha(v.fecha_registro) : '—'}</strong></div>
         </div>
       </section>
        <section>
          <h3 className="pg-section-title"><Activity size={14} /> Uso operativo</h3>
          <div className="pg-kv">
            <div><span>Último conductor</span><strong>{v.ultimo_conductor || 'Sin registro'}</strong></div>
            <div><span>Órdenes de venta</span><strong>{v.ordenes_asignadas || 0} asignadas · {v.despachos || 0} despachadas</strong></div>
            <div><span>Última orden</span><strong>{fmtFecha(v.ultima_orden)}</strong></div>
            <div><span>Última guía</span><strong>{fmtFecha(v.ultima_guia)}</strong></div>
          </div>
        </section>

        <section>
          <h3 className="pg-section-title"><FileCheck size={14} /> Guías de remisión</h3>
          {guias > 0 ? (
            <div className="pg-measure">
              <div className="pg-measure-top">
                <span>Aceptadas por SUNAT</span>
                <b>{aceptadas} <small>/ {guias} guías</small></b>
              </div>
              <div className="pg-meter" title={`${pctAceptadas.toFixed(0)}% aceptadas`} style={{ '--meter-c': 'var(--success)' }}>
                <span style={{ width: `${pctAceptadas}%` }} />
              </div>
              {guias - aceptadas > 0 && (
                <span className="pg-measure-note">{guias - aceptadas} sin aceptar (pendientes, rechazadas o manuales)</span>
              )}
            </div>
          ) : (
            <p className="pg-empty-line">Este vehículo aún no figura en ninguna guía de remisión.</p>
          )}
        </section>
      </PgDrawer>
    );
  };

  return (
    <div className="pg-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Truck size={13} /> Maestros</span>
          <h1 className="pg-title">Flota de vehículos</h1>
          <p className="pg-subtitle">
            <b>{vehiculos.length}</b> vehículos · <b>{operativos.length}</b> operativos ·
            {' '}<b>{fmtNumero(capacidadOperativa)}</b> kg de capacidad · <b>{guiasAceptadas}</b> guías aceptadas
          </p>
        </div>
        <div className="pg-actions">
          <button type="button" className="btn btn-outline" onClick={() => cargarVehiculos({ silencioso: true })} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => abrirModal()}>
            <Plus size={16} /> Nuevo vehículo
          </button>
        </div>
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        <div className="pg-kpis">
          {Object.entries(ESTADOS_VEHICULO).map(([estado, cfg]) => {
            const Icono = cfg.icon;
            const activo = filtroEstado === estado;
            return (
              <button key={estado} type="button" className={`pg-kpi ${cfg.tono} ${activo ? 'on' : ''}`} aria-pressed={activo}
                onClick={() => setFiltroEstado(activo ? '' : estado)}>
                <div className="pg-kpi-top">
                  <span className="pg-kpi-label">{cfg.label}</span>
                  <span className="pg-kpi-icon"><Icono size={16} /></span>
                </div>
                <span className="pg-kpi-value">{porEstado[estado]}</span>
                <span className="pg-kpi-foot">{activo ? 'Filtro activo · pulsa para quitar' : 'Pulsa para filtrar'}</span>
              </button>
            );
          })}
        </div>

        <section className="pg-panel">
          <div className="pg-filters">
            <div className="pg-filters-row">
              <div className="pg-field pg-field-grow pg-search">
                <label className="pg-field-label" htmlFor="ms-flota-busqueda">Buscar</label>
                <Search size={14} />
                <input id="ms-flota-busqueda" type="search" className="form-input" placeholder="Placa, marca o conductor"
                  value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </div>
            </div>
            <div className="pg-chips">
              <button type="button" className={`pg-chip ${filtroSinUso ? 'on' : ''}`} aria-pressed={filtroSinUso}
                onClick={() => setFiltroSinUso(!filtroSinUso)}>
                <ClipboardList size={14} /> Sin uso registrado <b>{totalSinUso}</b>
              </button>
              {filtroEstado && (
                <button type="button" className="pg-chip on" onClick={() => setFiltroEstado('')}>
                  Estado: {ESTADOS_VEHICULO[filtroEstado].label} <X size={13} />
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
            <h2 className="pg-panel-title"><Truck size={16} /> Vehículos <span className="pg-count">{vehiculosFiltrados.length}</span></h2>
            <span className="pg-panel-meta">Pulsa una fila para ver el detalle</span>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Vehículo</th>
                  <th>Capacidad</th>
                  <th>Último conductor</th>
                  <th>Uso</th>
                  <th>Fecha de registro</th>
                  <th>Última actividad</th>
                  <th className="center">Estado</th>
                  <th className="center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? currentItems.map(v => {
                  const actividad = ultimaActividad(v);
                  return (
                    <tr key={v.id_vehiculo} className="is-clickable" onClick={() => setDetalle(v)}>
                      <td className="nowrap">
                        <span className="pg-code">{v.placa}</span>
                        <span className="pg-cell-sub">{v.marca_modelo || 'Sin marca registrada'}</span>
                      </td>
                      <td className="nowrap">
                        <div className="ms-lines">
                          <span><Weight size={12} /><b>{v.capacidad_kg ? `${fmtNumero(v.capacidad_kg, 2)} kg` : '—'}</b></span>
                          <span><Box size={12} />{v.capacidad_m3 ? `${fmtNumero(v.capacidad_m3, 2)} m³` : '—'}</span>
                        </div>
                      </td>
                      <td>
                        {v.ultimo_conductor
                          ? <span className="pg-cell-main"><User size={13} className="pg-muted" />{v.ultimo_conductor}</span>
                          : <span className="pg-muted">Sin registro</span>}
                      </td>
                      <td className="nowrap">
                        {v.fecha_registro ? (
                          <>
                            <span className="pg-cell-main">
                              <CalendarDays size={12} className="pg-muted" /> {fmtFecha(v.fecha_registro)}
                            </span>
                            <span className="pg-cell-sub">{haceTexto(v.fecha_registro)}</span>
                          </>
                        ) : (
                          <span className="pg-muted">—</span>
                        )}
                      </td>
                      <td className="nowrap">
                        {sinUso(v) ? (
                          <span className="pg-muted">Sin uso registrado</span>
                        ) : (
                          <div className="ms-lines">
                            <span><ClipboardList size={12} /><b>{v.ordenes_asignadas}</b> OV · {v.despachos} despachadas</span>
                            <span><FileCheck size={12} /><b>{v.guias_total}</b> GRE · {v.guias_aceptadas} aceptadas</span>
                          </div>
                        )}
                      </td>
                      <td className="nowrap">
                        {actividad ? (
                          <>
                            <span className="pg-cell-main"><CalendarDays size={12} className="pg-muted" />{fmtFecha(actividad)}</span>
                            <span className="pg-cell-sub">{haceTexto(actividad)}</span>
                          </>
                        ) : <span className="pg-muted">—</span>}
                      </td>
                      <td className="center"><BadgeEstadoVehiculo estado={v.estado} /></td>
                      <td className="center" onClick={(e) => e.stopPropagation()}>
                        <div className="pg-rowactions">
                          <button type="button" className="pg-iconbtn" title="Editar" aria-label={`Editar ${v.placa}`} onClick={() => abrirModal(v)}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" className="pg-iconbtn is-danger" title="Desactivar" aria-label={`Desactivar ${v.placa}`}
                            disabled={v.estado === 'Inactivo'} onClick={() => handleDelete(v.id_vehiculo)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={8}>
                      <div className="pg-empty">
                        <Truck size={28} />
                        <strong>{hayFiltros ? 'Ningún vehículo coincide con los filtros' : 'Aún no hay vehículos registrados'}</strong>
                        <span>{hayFiltros ? 'Quita algún filtro o cambia la búsqueda.' : 'Registra el primero para asignarlo a despachos y guías de remisión.'}</span>
                        {hayFiltros
                          ? <button type="button" className="btn btn-outline btn-sm" onClick={limpiarFiltros}><X size={14} /> Limpiar filtros</button>
                          : <button type="button" className="btn btn-primary btn-sm" onClick={() => abrirModal()}><Plus size={14} /> Nuevo vehículo</button>}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PgPager {...paginacion} setCurrentPage={setCurrentPage} sustantivo="vehículos" />
        </section>
      </div>

      {detalle && renderDrawer()}

      <Modal isOpen={modalOpen} onClose={cerrarModal} title={editando ? 'Editar vehículo' : 'Nuevo vehículo'} size="md">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="ms-flota-placa">Placa *</label>
            <input id="ms-flota-placa" type="text" className="form-input" value={formData.placa}
              onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
              required placeholder="Ej: ABC-123" maxLength={10} />
            <small className="pg-hint">Formato: ABC-123 o ABC-1234</small>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ms-flota-marca">Marca / modelo</label>
            <input id="ms-flota-marca" type="text" className="form-input" value={formData.marca_modelo}
              onChange={(e) => setFormData({ ...formData, marca_modelo: e.target.value })} placeholder="Ej: Toyota Hilux 2020" />
          </div>

          <div className="pg-form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="ms-flota-kg">Capacidad (kg)</label>
              <input id="ms-flota-kg" type="number" step="0.01" className="form-input" value={formData.capacidad_kg}
                onChange={(e) => setFormData({ ...formData, capacidad_kg: e.target.value })} placeholder="1000" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ms-flota-m3">Capacidad (m³)</label>
              <input id="ms-flota-m3" type="number" step="0.01" className="form-input" value={formData.capacidad_m3}
                onChange={(e) => setFormData({ ...formData, capacidad_m3: e.target.value })} placeholder="5.0" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ms-flota-estado">Estado *</label>
            <select id="ms-flota-estado" className="form-select" value={formData.estado}
              onChange={(e) => setFormData({ ...formData, estado: e.target.value })} required>
              {Object.keys(ESTADOS_VEHICULO).map(estado => <option key={estado} value={estado}>{estado}</option>)}
            </select>
          </div>

          <div className="ms-actions-end">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{editando ? 'Actualizar' : 'Registrar'} vehículo</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Flota;
