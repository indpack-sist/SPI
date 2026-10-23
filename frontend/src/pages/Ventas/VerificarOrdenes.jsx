import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  User,
  Building,
  Calendar,
  CreditCard,
  FileText,
  Eye,
  ArrowLeft,
  Flag,
  ShieldCheck,
  ShieldAlert,
  ShieldOff
} from 'lucide-react';
import PgPager from '../../components/UI/PgPager';
import { usePagination } from '../../hooks/usePagination';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import ModalVerificacionOC from '../../components/Ventas/ModalVerificacionOC';
import { ordenesVentaAPI, archivosAPI } from '../../config/api';
import { BadgeEstadoOrden, BadgeEstadoPago } from './estadosVentas';
import './Ventas.css';

function VerificarOrdenes() {
  const navigate = useNavigate();
  
  const [ordenesPendientes, setOrdenesPendientes] = useState([]);
  const [historialReciente, setHistorialReciente] = useState([]);
  const [activeTab, setActiveTab] = useState('pendientes');
  const [datosVerificacion, setDatosVerificacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [modalVerificar, setModalVerificar] = useState(false);
  const [modalRechazar, setModalRechazar] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  
  const [visorArchivo, setVisorArchivo] = useState({
    open: false,
    url: '',
    tipo: '',
    titulo: ''
  });

  const [modalVerifOCOpen, setModalVerifOCOpen] = useState(false);
  const [guardandoVerifOC, setGuardandoVerifOC] = useState(false);

  const [formRechazo, setFormRechazo] = useState({
    motivo_rechazo: '',
    observaciones_verificador: ''
  });

  const [observacionesAprobacion, setObservacionesAprobacion] = useState('');

  useEffect(() => {
    if (activeTab === 'pendientes') {
      cargarOrdenesPendientes();
    } else {
      cargarHistorialReciente();
    }
  }, [activeTab]);

  const cargarOrdenesPendientes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await ordenesVentaAPI.getOrdenesPendientesVerificacion();
      
      if (response.data.success) {
        setOrdenesPendientes(response.data.data || []);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar órdenes pendientes');
    } finally {
      setLoading(false);
    }
  };

  const cargarHistorialReciente = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await ordenesVentaAPI.getAll({
        limit: 50,
        verificadas: true 
      });
      
      if (response.data.success) {
        setHistorialReciente(response.data.data || []);
      }
      
    } catch (err) {
      console.error(err);
      setError('Error al cargar historial de verificaciones');
    } finally {
      setLoading(false);
    }
  };

  const abrirVerificacion = async (orden) => {
    try {
      setProcesando(true);
      setError(null);
      setOrdenSeleccionada(orden);
      
      const response = await ordenesVentaAPI.getDatosVerificacion(orden.id_orden_venta);
      
      if (response.data.success) {
        setDatosVerificacion(response.data.data);
        setModalVerificar(true);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar datos de verificación');
    } finally {
      setProcesando(false);
    }
  };

  const abrirVisor = (url, titulo) => {
    if (!url) return;

    let cleanUrl = url;
    if (Array.isArray(cleanUrl)) cleanUrl = cleanUrl[0];
    if (typeof cleanUrl !== 'string') {
        try {
            cleanUrl = String(cleanUrl);
        } catch {
            return;
        }
    }
    
    const extension = cleanUrl.split('.').pop().toLowerCase();
    const esPdf = extension === 'pdf';
    const proxyUrl = archivosAPI.getProxyUrl(cleanUrl);

    setVisorArchivo({
      open: true,
      url: proxyUrl,
      tipo: esPdf ? 'pdf' : 'img',
      titulo: titulo
    });
  };

  const cerrarVisor = () => {
    setVisorArchivo({ open: false, url: '', tipo: '', titulo: '' });
  };

  const getArchivosOCParaModal = () => {
    const raw = datosVerificacion?.orden?.orden_compra_url;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [raw];
    } catch {
      return [raw];
    }
  };

  const handleVerificarOCDesdeVerif = async () => {
    if (!datosVerificacion?.orden?.id_orden_venta) return;
    try {
      setGuardandoVerifOC(true);
      await ordenesVentaAPI.verificarOC(datosVerificacion.orden.id_orden_venta, true);
      const res = await ordenesVentaAPI.getDatosVerificacion(datosVerificacion.orden.id_orden_venta);
      if (res.data.success) setDatosVerificacion(res.data.data);
      setModalVerifOCOpen(false);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al verificar OC');
    } finally {
      setGuardandoVerifOC(false);
    }
  };

  const handleAprobar = async () => {
    if (!ordenSeleccionada) return;
    
    if (!confirm(`¿Está seguro de APROBAR la orden ${ordenSeleccionada.numero_orden}?`)) {
      return;
    }
    
    try {
      setProcesando(true);
      setError(null);
      
      const response = await ordenesVentaAPI.aprobarVerificacion(
        ordenSeleccionada.id_orden_venta,
        { observaciones_verificador: observacionesAprobacion || null }
      );
      
      if (response.data.success) {
        setSuccess(`Orden ${ordenSeleccionada.numero_orden} aprobada exitosamente`);
        setModalVerificar(false);
        setDatosVerificacion(null);
        setOrdenSeleccionada(null);
        setObservacionesAprobacion('');
        await cargarOrdenesPendientes();
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al aprobar orden');
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = async (e) => {
    e.preventDefault();
    
    if (!ordenSeleccionada) return;
    
    if (!formRechazo.motivo_rechazo.trim()) {
      setError('El motivo del rechazo es obligatorio');
      return;
    }
    
    try {
      setProcesando(true);
      setError(null);
      
      const response = await ordenesVentaAPI.rechazarVerificacion(
        ordenSeleccionada.id_orden_venta,
        formRechazo
      );
      
      if (response.data.success) {
        setSuccess(`Orden ${ordenSeleccionada.numero_orden} rechazada exitosamente`);
        setModalRechazar(false);
        setModalVerificar(false);
        setDatosVerificacion(null);
        setOrdenSeleccionada(null);
        setFormRechazo({ motivo_rechazo: '', observaciones_verificador: '' });
        await cargarOrdenesPendientes();
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al rechazar orden');
    } finally {
      setProcesando(false);
    }
  };

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return '-';
    const cleanFecha = fechaStr.split('T')[0];
    const partes = cleanFecha.split('-');
    if (partes.length !== 3) return cleanFecha;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 3
    }).format(valor);
  };

  const formatearMoneda = (valor, moneda = 'PEN') => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  const getPrioridadConfig = (prioridad) => {
    const configs = {
      'Baja': { clase: 'badge-secondary', color: 'var(--text-secondary)' },
      'Media': { clase: 'badge-info', color: 'var(--info)' },
      'Alta': { clase: 'badge-warning', color: 'var(--warning)' },
      'Urgente': { clase: 'badge-danger', color: 'var(--danger)' }
    };
    return configs[prioridad] || configs['Media'];
  };

  const listaActiva = activeTab === 'pendientes' ? ordenesPendientes : historialReciente;
  const { currentItems, setCurrentPage, ...paginacion } = usePagination(listaActiva);
  useEffect(() => { setCurrentPage(1); }, [activeTab]);

  const renderVistaDocumento = (url, titulo, key) => {
    const esPdf = String(url).split('.').pop().toLowerCase() === 'pdf';
    const proxyUrl = archivosAPI.getProxyUrl(url);
    return (
      <div key={key} className="vt-doc">
        <span className="pg-field-label">{titulo}</span>
        <div className="vt-doc-frame">
          {esPdf ? (
            <iframe src={proxyUrl} title={titulo} />
          ) : (
            <img src={proxyUrl} alt={titulo} />
          )}
          <button
            type="button"
            className="btn btn-sm btn-secondary vt-doc-zoom"
            onClick={() => abrirVisor(url, titulo)}
            title="Abrir en pantalla completa"
          >
            <Eye size={12} /> Ampliar
          </button>
        </div>
      </div>
    );
  };

  const esPendientes = activeTab === 'pendientes';

  if (loading) return <Loading variant="table" />;

  const montoPendientePorMoneda = ordenesPendientes.reduce((acc, orden) => {
    const moneda = orden.moneda === 'USD' ? 'USD' : 'PEN';
    acc[moneda] += parseFloat(orden.total || 0);
    return acc;
  }, { PEN: 0, USD: 0 });
  const ordenesUrgentes = ordenesPendientes.filter(
    orden => orden.prioridad === 'Urgente'
  ).length;

  return (
    <div className="pg-page vt-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Shield size={13} /> Ventas</span>
          <h1 className="pg-title">Verificación de órdenes</h1>
          <p className="pg-subtitle">Aprobar o rechazar órdenes pendientes de verificación</p>
        </div>
        <div className="pg-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/ventas/ordenes')}
          >
            <ArrowLeft size={16} /> Volver a Órdenes
          </button>
        </div>
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        <div className="pg-segmented vt-tabs" role="tablist" aria-label="Vista de verificación">
          <button
            type="button"
            role="tab"
            aria-selected={esPendientes}
            className={esPendientes ? 'active' : ''}
            onClick={() => setActiveTab('pendientes')}
          >
            <Clock size={14} />
            Pendientes ({ordenesPendientes.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!esPendientes}
            className={!esPendientes ? 'active' : ''}
            onClick={() => setActiveTab('historial')}
          >
            <Calendar size={14} />
            Historial reciente ({historialReciente.length})
          </button>
        </div>

        {esPendientes && (
          <div className="pg-kpis" aria-label="Resumen de órdenes pendientes">
            <div className="pg-kpi is-warning">
              <div className="pg-kpi-top">
                <span className="pg-kpi-label">Pendientes</span>
                <span className="pg-kpi-icon"><Clock size={16} /></span>
              </div>
              <span className="pg-kpi-value">{ordenesPendientes.length}</span>
              <span className="pg-kpi-foot">Esperan verificación</span>
            </div>
            <div className="pg-kpi is-info">
              <div className="pg-kpi-top">
                <span className="pg-kpi-label">Monto pendiente</span>
                <span className="pg-kpi-icon"><DollarSign size={16} /></span>
              </div>
              <span className="pg-kpi-value">{formatearMoneda(montoPendientePorMoneda.PEN, 'PEN')}</span>
              <span className="pg-kpi-foot">
                {montoPendientePorMoneda.USD > 0
                  ? <>Además <b>{formatearMoneda(montoPendientePorMoneda.USD, 'USD')}</b> en dólares</>
                  : 'Órdenes en soles'}
              </span>
            </div>
            <div className="pg-kpi is-danger">
              <div className="pg-kpi-top">
                <span className="pg-kpi-label">Urgentes</span>
                <span className="pg-kpi-icon"><AlertTriangle size={16} /></span>
              </div>
              <span className="pg-kpi-value">{ordenesUrgentes}</span>
              <span className="pg-kpi-foot">Prioridad urgente</span>
            </div>
          </div>
        )}

        {(esPendientes && ordenesPendientes.length === 0) ? (
          <section className="pg-panel">
            <div className="pg-empty">
              <CheckCircle size={32} />
              <strong>¡Excelente! No hay órdenes pendientes de verificación</strong>
              <span>Todas las órdenes han sido revisadas y aprobadas</span>
            </div>
          </section>
        ) : (
          <section className="pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title">
                {esPendientes ? <><ShieldAlert size={16} /> Órdenes pendientes de verificación</> : <><Calendar size={16} /> Historial de verificaciones recientes</>}
                <span className="pg-count">{listaActiva.length}</span>
              </h2>
            </div>

            <div className="pg-table-wrap">
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>N° Orden</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Comercial</th>
                    <th className="center">Tipo venta</th>
                    <th className="center">Impuesto</th>
                    {esPendientes ? (
                      <>
                        <th className="num">Total</th>
                        <th className="center">Prioridad</th>
                        <th className="center">Ítems</th>
                        <th className="center">Acciones</th>
                      </>
                    ) : (
                      <th className="center">Estado</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length > 0 ? currentItems.map((row) => {
                    const esSinImpuesto = ['INAFECTO', 'EXONERADO'].includes(String(row.tipo_impuesto || '').toUpperCase().trim());
                    const totalAMostrar = esSinImpuesto ? parseFloat(row.subtotal || 0) : parseFloat(row.total || 0);
                    const tc = parseFloat(row.tipo_cambio || 0);
                    const mostrarConversion = row.moneda === 'USD' && tc > 1;
                    return (
                      <tr key={row.id_orden_venta}>
                        <td className="nowrap">
                          <span className="pg-code">{row.numero_orden}</span>
                          {row.numero_comprobante && (
                            <span className="pg-cell-sub">{row.tipo_comprobante}: {row.numero_comprobante}</span>
                          )}
                        </td>
                        <td className="nowrap">{formatearFecha(row.fecha_emision)}</td>
                        <td>
                          <span className="pg-cell-main pg-truncate" title={row.cliente}>{row.cliente}</span>
                          <span className="pg-cell-sub">RUC {row.ruc_cliente}</span>
                        </td>
                        <td><span className="pg-cell-main"><User size={13} className="pg-muted" />{row.comercial || 'Sin asignar'}</span></td>
                        <td className="center">
                          <span className={`badge ${row.tipo_venta === 'Contado' ? 'badge-success' : 'badge-warning'}`}>
                            {row.tipo_venta || 'Contado'}
                          </span>
                          {row.tipo_venta === 'Crédito' && row.dias_credito && (
                            <span className="pg-cell-sub">{row.dias_credito} días</span>
                          )}
                        </td>
                        <td className="center">
                          <span className={`badge badge-sm ${esSinImpuesto ? 'badge-info' : 'badge-primary'}`}>
                            {row.tipo_impuesto || 'IGV'}
                          </span>
                          <span className="pg-cell-sub">({esSinImpuesto ? 0 : (row.porcentaje_impuesto || 0)}%)</span>
                        </td>
                        {esPendientes ? (
                          <>
                            <td className="num">
                              <span className="vt-amount">{formatearMoneda(totalAMostrar, row.moneda)}</span>
                              {mostrarConversion && (
                                <span className="pg-cell-sub">≈ {formatearMoneda(totalAMostrar * tc, 'PEN')}</span>
                              )}
                            </td>
                            <td className="center">
                              <span className={`badge ${getPrioridadConfig(row.prioridad).clase}`}><Flag size={11} />{row.prioridad}</span>
                            </td>
                            <td className="center"><span className="pg-count">{row.total_items || 0}</span></td>
                            <td className="center">
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => abrirVerificacion(row)}
                                disabled={procesando}
                              >
                                <Eye size={14} />
                                Verificar
                              </button>
                            </td>
                          </>
                        ) : (
                          <td className="center"><BadgeEstadoOrden estado={row.estado} /></td>
                        )}
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={esPendientes ? 10 : 7}>
                        <div className="pg-empty">
                          <Calendar size={28} />
                          <strong>{esPendientes ? 'No hay órdenes pendientes' : 'No hay historial reciente'}</strong>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PgPager {...paginacion} setCurrentPage={setCurrentPage} sustantivo="órdenes" />
          </section>
        )}
      </div>

      <Modal
        isOpen={modalVerificar}
        onClose={() => {
          setModalVerificar(false);
          setDatosVerificacion(null);
          setOrdenSeleccionada(null);
          setObservacionesAprobacion('');
        }}
        title={`Verificación de Orden ${ordenSeleccionada?.numero_orden || ''}`}
        size="xl"
      >
        {datosVerificacion && (
          <div className="pg-stack">
            <div className="pg-grid pg-grid-even vt-align-start">
              <section className="pg-panel">
                <div className="pg-panel-head">
                  <h3 className="pg-panel-title"><FileText size={16} /> Datos de la orden</h3>
                </div>
                <div className="pg-panel-body">
                  <div className="pg-kv">
                    <div className="wide"><span>Cliente</span><strong>{datosVerificacion.orden.cliente}</strong></div>
                    <div><span>RUC</span><strong className="pg-code">{datosVerificacion.orden.ruc_cliente}</strong></div>
                    <div>
                      <span>Tipo venta</span>
                      <strong>
                        <span className={`badge ${datosVerificacion.orden.tipo_venta === 'Contado' ? 'badge-success' : 'badge-warning'}`}>
                          {datosVerificacion.orden.tipo_venta || 'Contado'}
                        </span>
                      </strong>
                    </div>
                    {datosVerificacion.orden.dias_credito > 0 && (
                      <div><span>Plazo</span><strong>{datosVerificacion.orden.dias_credito} días</strong></div>
                    )}
                    <div>
                      <span>Total orden</span>
                      <strong className="vt-amount">{formatearMoneda(datosVerificacion.orden.total, datosVerificacion.orden.moneda)}</strong>
                    </div>
                    <div><span>Comercial</span><strong>{datosVerificacion.orden.comercial || 'Sin asignar'}</strong></div>
                    <div><span>Productos</span><strong>{datosVerificacion.orden.detalle?.length || 0} items</strong></div>
                  </div>

                  {(datosVerificacion.orden.orden_compra_url || datosVerificacion.orden.comprobante_url) && (
                    <div className="vt-docs">
                      <h4 className="pg-section-title"><FileText size={14} /> Documentos adjuntos</h4>

                      {datosVerificacion.orden.orden_compra_url && (
                        <div>
                          {datosVerificacion.orden.estado_verificacion_oc === 'Verificado' ? (
                            <span className="badge badge-success">
                              <ShieldCheck size={11} /> OC Verificada
                              {datosVerificacion.orden.fecha_verificacion_oc && (
                                <> · {new Date(datosVerificacion.orden.fecha_verificacion_oc).toLocaleDateString('es-PE')}</>
                              )}
                            </span>
                          ) : datosVerificacion.orden.estado_verificacion_oc === 'Omitida' ? (
                            <span className="badge badge-secondary">
                              <ShieldOff size={11} /> Verificación omitida
                            </span>
                          ) : (
                            <span className="badge badge-warning">
                              <ShieldAlert size={11} /> Sin verificar
                            </span>
                          )}
                        </div>
                      )}

                      {datosVerificacion.orden.orden_compra_url && (() => {
                          let urls = [];
                          try {
                              if (Array.isArray(datosVerificacion.orden.orden_compra_url)) {
                                  urls = datosVerificacion.orden.orden_compra_url;
                              } else if (typeof datosVerificacion.orden.orden_compra_url === 'string') {
                                  if (datosVerificacion.orden.orden_compra_url.startsWith('[')) {
                                      urls = JSON.parse(datosVerificacion.orden.orden_compra_url);
                                      if (!Array.isArray(urls)) urls = [datosVerificacion.orden.orden_compra_url];
                                  } else {
                                      urls = [datosVerificacion.orden.orden_compra_url];
                                  }
                              }
                          } catch {
                              urls = [datosVerificacion.orden.orden_compra_url];
                          }
                          return (
                              <div className="vt-docs-list">
                                  {urls.map((url, i) => renderVistaDocumento(url, urls.length > 1 ? `Orden de Compra Cliente ${i + 1}` : 'Orden de Compra Cliente', `oc-${i}`))}
                              </div>
                          );
                      })()}

                      {datosVerificacion.orden.orden_compra_url && (
                        <div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline btn-warning"
                            onClick={() => setModalVerifOCOpen(true)}
                          >
                            <ShieldCheck size={13} />
                            {datosVerificacion.orden.estado_verificacion_oc === 'Verificado'
                              ? 'Ver/Re-verificar OC'
                              : 'Verificar OC'}
                          </button>
                        </div>
                      )}

                      {datosVerificacion.orden.comprobante_url && (() => {
                          let urls = [];
                          try {
                              if (Array.isArray(datosVerificacion.orden.comprobante_url)) {
                                  urls = datosVerificacion.orden.comprobante_url;
                              } else if (typeof datosVerificacion.orden.comprobante_url === 'string') {
                                  if (datosVerificacion.orden.comprobante_url.startsWith('[')) {
                                      urls = JSON.parse(datosVerificacion.orden.comprobante_url);
                                      if (!Array.isArray(urls)) urls = [datosVerificacion.orden.comprobante_url];
                                  } else {
                                      urls = [datosVerificacion.orden.comprobante_url];
                                  }
                              }
                          } catch {
                              urls = [datosVerificacion.orden.comprobante_url];
                          }
                          return (
                              <div className="vt-docs-list">
                                  {urls.map((url, i) => renderVistaDocumento(url, urls.length > 1 ? `Comprobante de Pago ${i + 1}` : 'Comprobante de Pago', `comp-${i}`))}
                              </div>
                          );
                      })()}
                    </div>
                  )}
                </div>
              </section>

              <section className="pg-panel">
                <div className="pg-panel-head">
                  <h3 className="pg-panel-title"><Building size={16} /> Información del cliente</h3>
                </div>
                <div className="pg-panel-body">
                  <div className="pg-kv">
                    {datosVerificacion.orden.direccion_cliente && (
                      <div className="wide"><span>Dirección</span><strong>{datosVerificacion.orden.direccion_cliente}</strong></div>
                    )}
                    {datosVerificacion.orden.telefono_cliente && (
                      <div><span>Teléfono</span><strong>{datosVerificacion.orden.telefono_cliente}</strong></div>
                    )}
                    {datosVerificacion.orden.email_cliente && (
                      <div className="wide"><span>Email</span><strong>{datosVerificacion.orden.email_cliente}</strong></div>
                    )}
                  </div>
                  <div className="vt-figures vt-figures-block">
                    <div className="vt-figure"><span>Total órdenes (6m)</span><b>{datosVerificacion.estadisticas_pago.total_ordenes || 0}</b></div>
                    <div className="vt-figure"><span>Órdenes pagadas</span><b className="is-success">{datosVerificacion.estadisticas_pago.ordenes_pagadas || 0}</b></div>
                    <div className="vt-figure"><span>Pendientes pago</span><b className="is-warning">{datosVerificacion.estadisticas_pago.ordenes_pendientes || 0}</b></div>
                  </div>
                </div>
              </section>
            </div>

            {datosVerificacion.analisis_credito && (
              <section className={`pg-panel vt-credito-panel ${datosVerificacion.alertas.excede_limite_credito ? 'is-danger' : ''}`}>
                <div className="pg-panel-head">
                  <h3 className="pg-panel-title">
                    <CreditCard size={16} />
                    Análisis de crédito
                    {datosVerificacion.alertas.excede_limite_credito && (
                      <span className="badge badge-danger"><AlertTriangle size={11} />¡EXCEDE LÍMITE!</span>
                    )}
                  </h3>
                </div>
                <div className="pg-panel-body">
                  <div className="vt-figures">
                    <div className="vt-figure"><span>Límite asignado</span><b>{formatearMoneda(datosVerificacion.analisis_credito.limite_asignado, datosVerificacion.orden.moneda)}</b></div>
                    <div className="vt-figure"><span>Deuda actual</span><b className="is-warning">{formatearMoneda(datosVerificacion.analisis_credito.deuda_actual, datosVerificacion.orden.moneda)}</b></div>
                    <div className="vt-figure"><span>Disponible antes</span><b>{formatearMoneda(datosVerificacion.analisis_credito.disponible, datosVerificacion.orden.moneda)}</b></div>
                    <div className="vt-figure">
                      <span>Disponible después</span>
                      <b className={datosVerificacion.analisis_credito.disponible_despues_orden < 0 ? 'is-danger' : 'is-success'}>
                        {formatearMoneda(datosVerificacion.analisis_credito.disponible_despues_orden, datosVerificacion.orden.moneda)}
                      </b>
                    </div>
                  </div>

                  <div className="pg-measures vt-mt">
                    <div className="pg-measure">
                      <div className="pg-measure-top">
                        <span>Uso actual</span>
                        <b>{datosVerificacion.analisis_credito.porcentaje_uso_actual}%</b>
                      </div>
                      <div className="pg-meter" style={{ '--meter-c': parseFloat(datosVerificacion.analisis_credito.porcentaje_uso_actual) > 90 ? 'var(--danger)' : parseFloat(datosVerificacion.analisis_credito.porcentaje_uso_actual) > 70 ? 'var(--warning)' : 'var(--success)' }}>
                        <span style={{ width: `${Math.min(100, datosVerificacion.analisis_credito.porcentaje_uso_actual)}%` }} />
                      </div>
                    </div>
                    <div className="pg-measure">
                      <div className="pg-measure-top">
                        <span>Uso después de aprobar</span>
                        <b>{datosVerificacion.analisis_credito.porcentaje_uso_despues}%</b>
                      </div>
                      <div className="pg-meter" style={{ '--meter-c': parseFloat(datosVerificacion.analisis_credito.porcentaje_uso_despues) > 100 ? 'var(--danger)' : parseFloat(datosVerificacion.analisis_credito.porcentaje_uso_despues) > 90 ? 'var(--warning)' : 'var(--success)' }}>
                        <span style={{ width: `${Math.min(100, datosVerificacion.analisis_credito.porcentaje_uso_despues)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {datosVerificacion.alertas && (
              <div className="vt-alertas">
                {datosVerificacion.alertas.excede_limite_credito && (
                  <div className="vt-note is-danger">
                    <AlertTriangle size={18} />
                    <div>
                      <strong>¡ALERTA CRÍTICA! Esta orden excede el límite de crédito disponible del cliente.</strong>
                      <p>
                        Déficit: {formatearMoneda(
                          Math.abs(datosVerificacion.analisis_credito.disponible_despues_orden),
                          datosVerificacion.orden.moneda
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {datosVerificacion.alertas.tiene_ordenes_vencidas && (
                  <div className="vt-note is-warning">
                    <Clock size={18} />
                    <div>
                      <strong>Atención:</strong> El cliente tiene {datosVerificacion.ordenes_vencidas.length} orden(es) vencida(s) sin pagar.
                    </div>
                  </div>
                )}

                {datosVerificacion.alertas.promedio_retraso_alto && (
                  <div className="vt-note is-warning">
                    <TrendingUp size={18} />
                    <div>
                      <strong>Historial de Retrasos:</strong> El cliente tiene un promedio de {Math.round(datosVerificacion.estadisticas_pago.promedio_dias_retraso || 0)} días de retraso en sus pagos.
                    </div>
                  </div>
                )}

                {datosVerificacion.alertas.tasa_pago_baja && (
                  <div className="vt-note is-info">
                    <AlertTriangle size={18} />
                    <div>
                      <strong>Tasa de Cumplimiento:</strong> El cliente ha pagado {datosVerificacion.estadisticas_pago.ordenes_pagadas} de {datosVerificacion.estadisticas_pago.total_ordenes} órdenes (
                      {datosVerificacion.estadisticas_pago.total_ordenes > 0
                        ? ((datosVerificacion.estadisticas_pago.ordenes_pagadas / datosVerificacion.estadisticas_pago.total_ordenes) * 100).toFixed(0)
                        : 0}%).
                    </div>
                  </div>
                )}
              </div>
            )}

            {datosVerificacion.ordenes_vencidas && datosVerificacion.ordenes_vencidas.length > 0 && (
              <section className="pg-panel">
                <div className="pg-panel-head">
                  <h3 className="pg-panel-title vt-title-danger">
                    <XCircle size={16} />
                    Órdenes vencidas <span className="pg-count">{datosVerificacion.ordenes_vencidas.length}</span>
                  </h3>
                </div>
                <div className="pg-panel-body">
                  <ul className="pg-list">
                    {datosVerificacion.ordenes_vencidas.map((vencida, idx) => (
                      <li key={idx}>
                        <div>
                          <span className="pg-code">{vencida.numero_orden}</span>
                          <span className="pg-cell-sub">
                            Vencida: {formatearFecha(vencida.fecha_vencimiento)} · <b className="vt-text-danger">{vencida.dias_vencido} días</b>
                          </span>
                        </div>
                        <span className="pg-list-push">
                          <span className="pg-money is-danger"><b>{formatearMoneda(vencida.saldo_pendiente, vencida.moneda)}</b></span>
                          <span className="pg-cell-sub">Saldo pendiente</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {datosVerificacion.historial_cliente && datosVerificacion.historial_cliente.length > 0 && (
              <section className="pg-panel">
                <div className="pg-panel-head">
                  <h3 className="pg-panel-title">
                    <Calendar size={16} />
                    Historial de órdenes (últimas 10)
                  </h3>
                </div>
                <div className="pg-table-wrap">
                  <table className="pg-table">
                    <thead>
                      <tr>
                        <th>N° Orden</th>
                        <th>Fecha</th>
                        <th className="num">Total</th>
                        <th className="num">Pagado</th>
                        <th className="center">Estado pago</th>
                        <th className="center">Estado</th>
                        <th className="center">Retraso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datosVerificacion.historial_cliente.map((hist, idx) => {
                        const diasRetraso = hist.dias_retraso || 0;
                        const tieneRetraso = diasRetraso > 0 && hist.estado_pago !== 'Pagado';

                        return (
                          <tr key={idx} className={tieneRetraso ? 'vt-row-danger' : ''}>
                            <td className="nowrap"><span className="pg-code">{hist.numero_orden}</span></td>
                            <td className="nowrap">{formatearFecha(hist.fecha_emision)}</td>
                            <td className="num"><b>{formatearMoneda(hist.total, hist.moneda)}</b></td>
                            <td className="num">{formatearMoneda(hist.monto_pagado, hist.moneda)}</td>
                            <td className="center"><BadgeEstadoPago estado={hist.estado_pago} /></td>
                            <td className="center"><BadgeEstadoOrden estado={hist.estado} /></td>
                            <td className="center">
                              {tieneRetraso ? (
                                <b className="vt-text-danger">{diasRetraso} días</b>
                              ) : hist.estado_pago === 'Pagado' ? (
                                <CheckCircle size={14} className="vt-ok-icon" aria-label="Pagado a tiempo" />
                              ) : (
                                <span className="pg-muted">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h3 className="pg-panel-title">
                  <FileText size={16} />
                  Detalle de productos <span className="pg-count">{datosVerificacion.orden.detalle?.length || 0}</span>
                </h3>
              </div>
              <div className="pg-table-wrap">
                <table className="pg-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Producto</th>
                      <th className="num">Cantidad</th>
                      <th className="num">Precio unit.</th>
                      <th className="num">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datosVerificacion.orden.detalle?.map((item, idx) => {
                      const subtotalCalculado = parseFloat(item.cantidad) * parseFloat(item.precio_unitario);
                      return (
                        <tr key={idx}>
                          <td className="nowrap"><span className="pg-code">{item.codigo_producto}</span></td>
                          <td>
                            <span className="pg-cell-main">{item.producto}</span>
                            <span className="pg-cell-sub">{item.unidad_medida}</span>
                          </td>
                          <td className="num"><b>{formatearNumero(item.cantidad)}</b></td>
                          <td className="num">{formatearMoneda(item.precio_unitario, datosVerificacion.orden.moneda)}</td>
                          <td className="num"><span className="vt-lp-price">{formatearMoneda(subtotalCalculado, datosVerificacion.orden.moneda)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="vt-tfoot">
                    {(() => {
                      const subtotalReal = datosVerificacion.orden.detalle?.reduce((acc, item) => {
                        const val = parseFloat(item.cantidad) * parseFloat(item.precio_unitario);
                        return acc + (isNaN(val) ? 0 : val);
                      }, 0) || 0;

                      const esSinImpuesto = ['INAFECTO', 'EXONERADO'].includes(String(datosVerificacion.orden.tipo_impuesto || '').toUpperCase().trim());
                      const pctImpuesto = parseFloat(datosVerificacion.orden.porcentaje_impuesto || 0);
                      const impuestoReal = esSinImpuesto ? 0 : subtotalReal * (pctImpuesto / 100);
                      const totalReal = subtotalReal + impuestoReal;

                      const tc = parseFloat(datosVerificacion.orden.tipo_cambio || 1);
                      const mostrarConversion = datosVerificacion.orden.moneda === 'USD' && tc > 1;

                      return (
                        <>
                          <tr>
                            <td colSpan="4" className="num pg-muted" data-label="Subtotal">Subtotal:</td>
                            <td className="num">
                              <b>{formatearMoneda(subtotalReal, datosVerificacion.orden.moneda)}</b>
                              {mostrarConversion && (
                                <span className="pg-cell-sub">≈ {formatearMoneda(subtotalReal * tc, 'PEN')}</span>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan="4" className="num pg-muted" data-label="Impuesto">
                              {esSinImpuesto
                                ? `${datosVerificacion.orden.tipo_impuesto || 'Inafecto/Exonerado'}:`
                                : `IGV (${pctImpuesto}%):`}
                            </td>
                            <td className="num">
                              <b>{formatearMoneda(impuestoReal, datosVerificacion.orden.moneda)}</b>
                              {mostrarConversion && (
                                <span className="pg-cell-sub">≈ {formatearMoneda(impuestoReal * tc, 'PEN')}</span>
                              )}
                            </td>
                          </tr>
                          <tr className="vt-tfoot-total">
                            <td colSpan="4" className="num" data-label="Total">TOTAL:</td>
                            <td className="num">
                              <span className="vt-amount">{formatearMoneda(totalReal, datosVerificacion.orden.moneda)}</span>
                              {mostrarConversion && (
                                <span className="pg-cell-sub">≈ {formatearMoneda(totalReal * tc, 'PEN')}</span>
                              )}
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </section>

            <div className="form-group">
              <label className="form-label" htmlFor="vt-verif-obs">Observaciones del verificador (opcional)</label>
              <textarea
                id="vt-verif-obs"
                className="form-textarea"
                rows={3}
                placeholder="Agregue observaciones o comentarios sobre esta verificación (opcional)..."
                value={observacionesAprobacion}
                onChange={(e) => setObservacionesAprobacion(e.target.value)}
              ></textarea>
              <small className="pg-hint">
                Estas observaciones quedarán registradas en el historial de la orden.
              </small>
            </div>

            <div className="vt-lp-modal-foot">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setModalVerificar(false);
                  setDatosVerificacion(null);
                  setOrdenSeleccionada(null);
                  setObservacionesAprobacion('');
                }}
                disabled={procesando}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setModalRechazar(true);
                }}
                disabled={procesando}
              >
                <XCircle size={16} />
                Rechazar Orden
              </button>

              <button
                type="button"
                className="btn btn-success"
                onClick={handleAprobar}
                disabled={procesando}
              >
                <CheckCircle size={16} />
                {procesando ? 'Aprobando...' : 'Aprobar Orden'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={modalRechazar}
        onClose={() => {
          setModalRechazar(false);
          setFormRechazo({ motivo_rechazo: '', observaciones_verificador: '' });
        }}
        title={`Rechazar Orden ${ordenSeleccionada?.numero_orden || ''}`}
        size="md"
      >
        <form onSubmit={handleRechazar}>
          <div className="vt-note is-warning">
            <AlertTriangle size={18} />
            <div>
              <strong>¡Atención! Esta acción rechazará la orden y notificará al comercial.</strong>
              <p>El comercial podrá corregir la orden y reenviarla para una nueva verificación.</p>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="vt-rech-motivo">
              Motivo del Rechazo *
            </label>
            <select
              id="vt-rech-motivo"
              className="form-select"
              value={formRechazo.motivo_rechazo}
              onChange={(e) => setFormRechazo({ ...formRechazo, motivo_rechazo: e.target.value })}
              required
            >
              <option value="">Seleccione un motivo...</option>
              <option value="Cliente excede límite de crédito">Cliente excede límite de crédito</option>
              <option value="Cliente tiene órdenes vencidas sin pagar">Cliente tiene órdenes vencidas sin pagar</option>
              <option value="Historial de pagos deficiente">Historial de pagos deficiente</option>
              <option value="Información incompleta del cliente">Información incompleta del cliente</option>
              <option value="Productos o cantidades incorrectas">Productos o cantidades incorrectas</option>
              <option value="Precios no autorizados">Precios no autorizados</option>
              <option value="Condiciones de pago no aprobadas">Condiciones de pago no aprobadas</option>
              <option value="Requiere autorización de gerencia">Requiere autorización de gerencia</option>
              <option value="Otro motivo">Otro motivo</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="vt-rech-obs">
              Observaciones Adicionales
            </label>
            <textarea
              id="vt-rech-obs"
              className="form-textarea"
              rows={4}
              placeholder="Agregue detalles específicos sobre el rechazo, instrucciones para corrección, o cualquier información adicional..."
              value={formRechazo.observaciones_verificador}
              onChange={(e) => setFormRechazo({ ...formRechazo, observaciones_verificador: e.target.value })}
            ></textarea>
            <small className="pg-hint">
              Ejemplo: "Solicitar pago adelantado del 50% antes de procesar", "Actualizar precio según lista vigente", etc.
            </small>
          </div>

          <div className="vt-lp-modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setModalRechazar(false);
                setFormRechazo({ motivo_rechazo: '', observaciones_verificador: '' });
              }}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={procesando || !formRechazo.motivo_rechazo.trim()}
            >
              <XCircle size={16} />
              {procesando ? 'Rechazando...' : 'Confirmar Rechazo'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={visorArchivo.open}
        onClose={cerrarVisor}
        title={visorArchivo.titulo}
        size="2xl"
      >
        <div className="vt-visor-full">
          {visorArchivo.tipo === 'pdf' ? (
            <iframe
              src={visorArchivo.url}
              title="Visor de PDF"
            />
          ) : (
            <img
              src={visorArchivo.url}
              alt="Visualización de archivo"
            />
          )}
        </div>
        <div className="vt-lp-modal-foot vt-mt-lg">
          <button type="button" className="btn btn-primary" onClick={cerrarVisor}>
            Cerrar Visor
          </button>
        </div>
      </Modal>

      {datosVerificacion && (
        <ModalVerificacionOC
          isOpen={modalVerifOCOpen}
          onCancelar={() => setModalVerifOCOpen(false)}
          onVerificado={handleVerificarOCDesdeVerif}
          onOmitir={null}
          guardando={guardandoVerifOC}
          archivosOC={getArchivosOCParaModal()}
          detalle={datosVerificacion.orden.detalle || []}
          totales={{
            subtotal: datosVerificacion.orden.subtotal,
            impuesto: datosVerificacion.orden.impuesto,
            total: datosVerificacion.orden.total
          }}
          moneda={datosVerificacion.orden.moneda}
        />
      )}

    </div>
  );
}

export default VerificarOrdenes;
