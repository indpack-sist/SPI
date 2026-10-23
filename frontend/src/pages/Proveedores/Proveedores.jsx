import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Search, CheckCircle, AlertCircle, Loader, Building2, RefreshCw, X, Ban,
  ShoppingBag, Wallet, Phone, Mail, User, CalendarDays, Receipt, Info, ChevronRight
} from 'lucide-react';
import { proveedoresAPI, comprasAPI } from '../../config/api';
import { usePermisos } from '../../context/PermisosContext';
import { usePagination } from '../../hooks/usePagination';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import PgDrawer from '../../components/UI/PgDrawer';
import PgPager from '../../components/UI/PgPager';
import { BadgeEstadoRegistro } from '../Maestros/estadosMaestros';
import { fmtFecha, fmtMonto, haceTexto, incluye } from '../Maestros/formatoMaestros';
import { useResetPagina } from '../Maestros/useResetPagina';
import '../Maestros/Maestros.css';

const FORM_VACIO = {
  ruc: '',
  razon_social: '',
  contacto: '',
  telefono: '',
  email: '',
  terminos_pago: '',
  validar_ruc: true,
  estado: 'Activo'
};

const tieneSaldo = (p) => parseFloat(p.saldo_pen || 0) > 0.009 || parseFloat(p.saldo_usd || 0) > 0.009;

function Proveedores() {
  const navigate = useNavigate();
  const { tienePermiso } = usePermisos();
  const verMontos = tienePermiso('verPrecios');
  const verCompras = tienePermiso('compras');

  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [comprasRecientes, setComprasRecientes] = useState({ loading: false, data: [] });

  const [busqueda, setBusqueda] = useState('');
  const [filtroKpi, setFiltroKpi] = useState('');

  const [validandoRUC, setValidandoRUC] = useState(false);
  const [rucValidado, setRucValidado] = useState(null);
  const [datosSUNAT, setDatosSUNAT] = useState(null);

  const [formData, setFormData] = useState(FORM_VACIO);

  useEffect(() => {
    cargarProveedores();
  }, []);

  useEffect(() => {
    if (!detalle || !verCompras) return undefined;
    let vigente = true;
    setComprasRecientes({ loading: true, data: [] });
    comprasAPI.getAll({ id_proveedor: detalle.id_proveedor })
      .then(res => { if (vigente) setComprasRecientes({ loading: false, data: (res.data.data || []).slice(0, 5) }); })
      .catch(() => { if (vigente) setComprasRecientes({ loading: false, data: [] }); });
    return () => { vigente = false; };
  }, [detalle?.id_proveedor, verCompras]);

  const cargarProveedores = async ({ silencioso = false } = {}) => {
    try {
      if (silencioso) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const response = await proveedoresAPI.getAll({ resumen: 1 });
      setProveedores(response.data.data || []);
    } catch (err) {
      setError(err.error || 'Error al cargar proveedores');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const abrirModal = (proveedor = null) => {
    if (proveedor) {
      setEditando(proveedor);
      setFormData({
        ruc: proveedor.ruc,
        razon_social: proveedor.razon_social,
        contacto: proveedor.contacto || '',
        telefono: proveedor.telefono || '',
        email: proveedor.email || '',
        terminos_pago: proveedor.terminos_pago || '',
        validar_ruc: false,
        estado: proveedor.estado
      });
    } else {
      setEditando(null);
      setFormData(FORM_VACIO);
    }
    setRucValidado(null);
    setDatosSUNAT(null);
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
    setRucValidado(null);
    setDatosSUNAT(null);
  };

  const validarRUC = async () => {
    const ruc = formData.ruc.trim();

    if (!ruc) {
      setError('Ingrese un RUC para validar');
      return;
    }

    if (!/^\d{11}$/.test(ruc)) {
      setError('El RUC debe tener 11 dígitos');
      return;
    }

    try {
      setValidandoRUC(true);
      setError(null);

      const response = await proveedoresAPI.validarRUC(ruc);

      if (response.data.valido) {
        setRucValidado(true);
        setDatosSUNAT(response.data.datos);

        if (!formData.razon_social) {
          setFormData({ ...formData, razon_social: response.data.datos.razon_social });
        }

        if (response.data.ya_registrado) {
          setError(`Este RUC ya está registrado: ${response.data.proveedor_existente.razon_social}`);
        } else {
          setSuccess('RUC validado correctamente con SUNAT');
        }

        if (response.data.datos.estado !== 'ACTIVO') {
          setError(`Advertencia: Este RUC está en estado ${response.data.datos.estado} en SUNAT`);
        }
      } else {
        setRucValidado(false);
        setDatosSUNAT(null);
        setError(response.data.error || 'RUC no válido');
      }
    } catch (err) {
      setRucValidado(false);
      setDatosSUNAT(null);
      setError(err.error || 'Error al validar RUC');
    } finally {
      setValidandoRUC(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editando) {
        await proveedoresAPI.update(editando.id_proveedor, formData);
        setSuccess('Proveedor actualizado exitosamente');
      } else {
        await proveedoresAPI.create(formData);
        setSuccess('Proveedor creado exitosamente');
      }
      cerrarModal();
      setDetalle(null);
      cargarProveedores({ silencioso: true });
    } catch (err) {
      setError(err.error || 'Error al guardar proveedor');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de desactivar este proveedor?')) return;

    try {
      setError(null);
      await proveedoresAPI.delete(id);
      setSuccess('Proveedor desactivado exitosamente');
      setDetalle(null);
      cargarProveedores({ silencioso: true });
    } catch (err) {
      setError(err.error || 'Error al desactivar proveedor');
    }
  };

  const FILTROS_KPI = {
    activos: (p) => p.estado === 'Activo',
    inactivos: (p) => p.estado !== 'Activo',
    recientes: (p) => Number(p.compras_12m) > 0,
    saldo: tieneSaldo,
    sinCompras: (p) => Number(p.total_compras) === 0
  };

  const termino = busqueda.trim().toLowerCase();
  const proveedoresFiltrados = proveedores.filter(p => {
    if (filtroKpi && !FILTROS_KPI[filtroKpi](p)) return false;
    if (!termino) return true;
    return incluye(p.razon_social, termino) || incluye(p.ruc, termino) || incluye(p.contacto, termino)
      || incluye(p.email, termino) || incluye(p.telefono, termino);
  });

  const { currentItems, setCurrentPage, ...paginacion } = usePagination(proveedoresFiltrados, { storageKey: 'proveedores_pagina' });
  useResetPagina(setCurrentPage, [busqueda, filtroKpi]);

  const hayFiltros = !!(busqueda || filtroKpi);
  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroKpi('');
  };

  if (loading) return <Loading variant="table" />;

  const activos = proveedores.filter(FILTROS_KPI.activos).length;
  const conCompras12m = proveedores.filter(FILTROS_KPI.recientes).length;
  const sinCompras = proveedores.filter(FILTROS_KPI.sinCompras).length;
  const conSaldo = proveedores.filter(tieneSaldo);
  const saldoPen = conSaldo.reduce((s, p) => s + parseFloat(p.saldo_pen || 0), 0);
  const saldoUsd = conSaldo.reduce((s, p) => s + parseFloat(p.saldo_usd || 0), 0);

  const kpis = [
    { id: 'activos', label: 'Activos', tono: 'is-success', icon: CheckCircle, valor: activos, foot: `de ${proveedores.length} registrados` },
    { id: 'inactivos', label: 'Inactivos', tono: '', icon: Ban, valor: proveedores.length - activos },
    { id: 'recientes', label: 'Con compras · 12 meses', tono: 'is-accent', icon: ShoppingBag, valor: conCompras12m },
    verMontos
      ? { id: 'saldo', label: 'Saldo por pagar', tono: 'is-warning', icon: Wallet, valor: fmtMonto(saldoPen), foot: `${fmtMonto(saldoUsd, 'USD')} · ${conSaldo.length} proveedores` }
      : { id: 'sinCompras', label: 'Sin compras', tono: 'is-info', icon: Info, valor: sinCompras }
  ];

  const columnas = 7 + (verMontos ? 2 : 0);

  const renderDrawer = () => {
    const p = detalle;
    return (
      <PgDrawer
        eyebrow={<><Building2 size={12} /> Proveedor</>}
        title={p.razon_social}
        badges={<><BadgeEstadoRegistro estado={p.estado} /><span className="badge badge-secondary">RUC {p.ruc}</span></>}
        onClose={() => setDetalle(null)}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={() => setDetalle(null)}>Cerrar</button>
            <button type="button" className="btn btn-primary" onClick={() => abrirModal(p)}>
              <Pencil size={16} /> Editar proveedor
            </button>
          </>
        )}
      >
        <section>
          <h3 className="pg-section-title"><User size={14} /> Contacto y condiciones</h3>
          <div className="pg-kv">
            <div><span>Contacto</span><strong>{p.contacto || '—'}</strong></div>
            <div><span>Teléfono</span><strong>{p.telefono || '—'}</strong></div>
            <div><span>Email</span><strong>{p.email || '—'}</strong></div>
            <div><span>Términos de pago</span><strong>{p.terminos_pago || '—'}</strong></div>
          </div>
        </section>

        <section>
          <h3 className="pg-section-title"><ShoppingBag size={14} /> Compras</h3>
          <div className="pg-kv">
            <div><span>Compras registradas</span><strong>{p.total_compras || 0}</strong></div>
            <div><span>Últimos 12 meses</span><strong>{p.compras_12m || 0}</strong></div>
            <div><span>Última compra</span><strong>{fmtFecha(p.ultima_compra)}{p.ultima_compra ? ` · ${haceTexto(p.ultima_compra)}` : ''}</strong></div>
            {verMontos && (
              <>
                <div><span>Comprado · 12 meses</span><strong>{fmtMonto(p.monto_12m_pen)}{parseFloat(p.monto_12m_usd) > 0 ? ` · ${fmtMonto(p.monto_12m_usd, 'USD')}` : ''}</strong></div>
                <div><span>Saldo por pagar</span><strong>{tieneSaldo(p) ? `${fmtMonto(p.saldo_pen)} · ${fmtMonto(p.saldo_usd, 'USD')}` : 'Sin saldo'}</strong></div>
              </>
            )}
          </div>
        </section>

        {verCompras && (
          <section>
            <h3 className="pg-section-title"><Receipt size={14} /> Compras recientes</h3>
            {comprasRecientes.loading ? (
              <div className="pg-loading"><Loader size={20} className="animate-spin" /></div>
            ) : comprasRecientes.data.length > 0 ? (
              <ul className="pg-list">
                {comprasRecientes.data.map(c => (
                  <li key={c.id_orden_compra} className={c.estado === 'Cancelada' ? 'is-void' : ''}>
                    <span className="pg-code">{c.numero_orden}</span>
                    <span className="pg-muted"><CalendarDays size={12} />{fmtFecha(c.fecha_emision)}</span>
                    <span className="pg-tag">{c.estado}</span>
                    <span className="pg-list-push">
                      {c.total != null && <b>{fmtMonto(c.total, c.moneda)}</b>}
                      <button type="button" className="pg-iconbtn" title="Abrir compra" aria-label={`Abrir ${c.numero_orden}`}
                        onClick={() => navigate(`/compras/${c.id_orden_compra}`)}>
                        <ChevronRight size={15} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pg-empty-line">No hay compras registradas con este proveedor.</p>
            )}
          </section>
        )}
      </PgDrawer>
    );
  };

  return (
    <div className="pg-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Building2 size={13} /> Maestros</span>
          <h1 className="pg-title">Proveedores</h1>
          <p className="pg-subtitle">
            <b>{proveedores.length}</b> proveedores · <b>{activos}</b> activos · <b>{conCompras12m}</b> con compras en los últimos 12 meses
          </p>
        </div>
        <div className="pg-actions">
          <button type="button" className="btn btn-outline" onClick={() => cargarProveedores({ silencioso: true })} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => abrirModal()}>
            <Plus size={16} /> Nuevo proveedor
          </button>
        </div>
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        <div className="pg-kpis">
          {kpis.map(k => {
            const Icono = k.icon;
            const activo = filtroKpi === k.id;
            return (
              <button key={k.id} type="button" className={`pg-kpi ${k.tono} ${activo ? 'on' : ''}`} aria-pressed={activo}
                onClick={() => setFiltroKpi(activo ? '' : k.id)}>
                <div className="pg-kpi-top">
                  <span className="pg-kpi-label">{k.label}</span>
                  <span className="pg-kpi-icon"><Icono size={16} /></span>
                </div>
                <span className="pg-kpi-value">{k.valor}</span>
                <span className="pg-kpi-foot">{activo ? 'Filtro activo · pulsa para quitar' : (k.foot || 'Pulsa para filtrar')}</span>
              </button>
            );
          })}
        </div>

        <section className="pg-panel">
          <div className="pg-filters">
            <div className="pg-filters-row">
              <div className="pg-field pg-field-grow pg-search">
                <label className="pg-field-label" htmlFor="ms-prov-busqueda">Buscar</label>
                <Search size={14} />
                <input id="ms-prov-busqueda" type="search" className="form-input" placeholder="Razón social, RUC, contacto, email o teléfono"
                  value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </div>
            </div>
            {hayFiltros && (
              <div className="pg-chips">
                {filtroKpi && (
                  <button type="button" className="pg-chip on" onClick={() => setFiltroKpi('')}>
                    {kpis.find(k => k.id === filtroKpi)?.label} <X size={13} />
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={limpiarFiltros}>
                  <X size={14} /> Limpiar filtros
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="pg-panel">
          <div className="pg-panel-head">
            <h2 className="pg-panel-title"><Building2 size={16} /> Proveedores <span className="pg-count">{proveedoresFiltrados.length}</span></h2>
            <span className="pg-panel-meta">Pulsa una fila para ver el detalle</span>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Contacto</th>
                  <th>Términos de pago</th>
                  <th className="num">Compras</th>
                  <th>Última compra</th>
                  {verMontos && <th className="num">Comprado · 12 m</th>}
                  {verMontos && <th className="num">Saldo por pagar</th>}
                  <th className="center">Estado</th>
                  <th className="center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? currentItems.map(p => (
                  <tr key={p.id_proveedor} className="is-clickable" onClick={() => setDetalle(p)}>
                    <td style={{ minWidth: 220 }}>
                      <span className="pg-cell-main">{p.razon_social}</span>
                      <span className="pg-cell-sub"><span className="pg-code">{p.ruc}</span></span>
                    </td>
                    <td>
                      {p.contacto || p.telefono || p.email ? (
                        <div className="ms-lines">
                          {p.contacto && <span><User size={12} /><b>{p.contacto}</b></span>}
                          {p.telefono && <span><Phone size={12} />{p.telefono}</span>}
                          {p.email && <span><Mail size={12} /><span className="pg-truncate">{p.email}</span></span>}
                        </div>
                      ) : <span className="pg-muted">Sin datos</span>}
                    </td>
                    <td>{p.terminos_pago || <span className="pg-muted">—</span>}</td>
                    <td className="num">
                      <span className="pg-cell-main">{p.total_compras || 0}</span>
                      <span className="pg-cell-sub">{p.compras_12m || 0} en 12 m</span>
                    </td>
                    <td className="nowrap">
                      {p.ultima_compra ? (
                        <>
                          <span className="pg-cell-main">{fmtFecha(p.ultima_compra)}</span>
                          <span className="pg-cell-sub">{haceTexto(p.ultima_compra)}</span>
                        </>
                      ) : <span className="pg-muted">Sin compras</span>}
                    </td>
                    {verMontos && (
                      <td className="num">
                        <span className="pg-money">{fmtMonto(p.monto_12m_pen)}</span>
                        {parseFloat(p.monto_12m_usd) > 0 && <span className="pg-money pg-muted">{fmtMonto(p.monto_12m_usd, 'USD')}</span>}
                      </td>
                    )}
                    {verMontos && (
                      <td className="num">
                        {tieneSaldo(p) ? (
                          <>
                            {parseFloat(p.saldo_pen) > 0.009 && <span className="pg-money">{fmtMonto(p.saldo_pen)}</span>}
                            {parseFloat(p.saldo_usd) > 0.009 && <span className="pg-money">{fmtMonto(p.saldo_usd, 'USD')}</span>}
                          </>
                        ) : <span className="pg-muted">—</span>}
                      </td>
                    )}
                    <td className="center"><BadgeEstadoRegistro estado={p.estado} /></td>
                    <td className="center" onClick={(e) => e.stopPropagation()}>
                      <div className="pg-rowactions">
                        <button type="button" className="pg-iconbtn" title="Editar" aria-label={`Editar ${p.razon_social}`} onClick={() => abrirModal(p)}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="pg-iconbtn is-danger" title="Desactivar" aria-label={`Desactivar ${p.razon_social}`}
                          disabled={p.estado === 'Inactivo'} onClick={() => handleDelete(p.id_proveedor)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={columnas}>
                      <div className="pg-empty">
                        <Building2 size={28} />
                        <strong>{hayFiltros ? 'Ningún proveedor coincide con los filtros' : 'Aún no hay proveedores registrados'}</strong>
                        <span>{hayFiltros ? 'Quita algún filtro o cambia la búsqueda.' : 'Registra un proveedor validando su RUC con SUNAT.'}</span>
                        {hayFiltros
                          ? <button type="button" className="btn btn-outline btn-sm" onClick={limpiarFiltros}><X size={14} /> Limpiar filtros</button>
                          : <button type="button" className="btn btn-primary btn-sm" onClick={() => abrirModal()}><Plus size={14} /> Nuevo proveedor</button>}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PgPager {...paginacion} setCurrentPage={setCurrentPage} sustantivo="proveedores" />
        </section>
      </div>

      {detalle && renderDrawer()}

      <Modal isOpen={modalOpen} onClose={cerrarModal} title={editando ? 'Editar proveedor' : 'Nuevo proveedor'} size="lg">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="ms-prov-ruc">RUC *</label>
            <div className="ms-inline">
              <input id="ms-prov-ruc" type="text" className="form-input" value={formData.ruc}
                onChange={(e) => {
                  setFormData({ ...formData, ruc: e.target.value });
                  setRucValidado(null);
                  setDatosSUNAT(null);
                }}
                required maxLength={11} placeholder="20512345678" />
              <button type="button" className="btn btn-outline" onClick={validarRUC} disabled={validandoRUC || !formData.ruc}>
                {validandoRUC
                  ? <><Loader size={16} className="animate-spin" /> Validando...</>
                  : <><Building2 size={16} /> Validar RUC</>}
              </button>
            </div>
            {rucValidado === true && <div className="ms-status is-ok"><CheckCircle size={16} /> RUC validado con SUNAT</div>}
            {rucValidado === false && <div className="ms-status is-error"><AlertCircle size={16} /> RUC no válido</div>}
          </div>

          {datosSUNAT && (
            <div className="ms-box">
              <h3 className="pg-section-title"><Info size={14} /> Datos de SUNAT</h3>
              <div className="pg-kv">
                <div><span>Razón social</span><strong>{datosSUNAT.razon_social}</strong></div>
                <div>
                  <span>Estado</span>
                  <strong>
                    <span className={`badge ${datosSUNAT.estado === 'ACTIVO' ? 'badge-success' : 'badge-warning'}`}>
                      {datosSUNAT.estado === 'ACTIVO' ? <CheckCircle size={11} /> : <AlertCircle size={11} />}{datosSUNAT.estado}
                    </span>
                  </strong>
                </div>
                <div><span>Condición</span><strong>{datosSUNAT.condicion}</strong></div>
                {datosSUNAT.direccion && <div className="wide"><span>Dirección</span><strong>{datosSUNAT.direccion}</strong></div>}
                {datosSUNAT.actividad_economica && <div className="wide"><span>Actividad</span><strong>{datosSUNAT.actividad_economica}</strong></div>}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="ms-prov-razon">Razón social *</label>
            <input id="ms-prov-razon" type="text" className="form-input" value={formData.razon_social}
              onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })} required placeholder="Empresa S.A.C." />
            {datosSUNAT && <small className="pg-hint">Autocompletado desde SUNAT. Puede modificarlo si es necesario.</small>}
          </div>

          <div className="pg-form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="ms-prov-contacto">Contacto</label>
              <input id="ms-prov-contacto" type="text" className="form-input" value={formData.contacto}
                onChange={(e) => setFormData({ ...formData, contacto: e.target.value })} placeholder="Nombre del contacto" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ms-prov-telefono">Teléfono</label>
              <input id="ms-prov-telefono" type="text" className="form-input" value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} placeholder="01-1234567" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ms-prov-email">Email</label>
            <input id="ms-prov-email" type="email" className="form-input" value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="contacto@empresa.com" />
          </div>

          <div className="pg-form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="ms-prov-terminos">Términos de pago</label>
              <input id="ms-prov-terminos" type="text" className="form-input" value={formData.terminos_pago}
                onChange={(e) => setFormData({ ...formData, terminos_pago: e.target.value })} placeholder="Ej: 30 días" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ms-prov-estado">Estado *</label>
              <select id="ms-prov-estado" className="form-select" value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })} required>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="ms-actions-end">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{editando ? 'Actualizar' : 'Crear'} proveedor</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Proveedores;
