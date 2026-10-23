import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  Filter, 
  TrendingUp,
  User,
  FileText,
  TrendingDown,
  CreditCard,
  Paperclip,
  MessageSquare,
  ExternalLink,
  Sparkles,
  Loader,
  Wallet
} from 'lucide-react';
import { solicitudesCreditoAPI, archivosAPI, clientesAPI } from '../../config/api';
import { usePagination } from '../../hooks/usePagination';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import PgDrawer from '../../components/UI/PgDrawer';
import PgPager from '../../components/UI/PgPager';
import { BadgeSolicitudCredito, configEstadoSolicitudCredito } from '../Finanzas/estadosFinanzas';
import { fmtMonto, haceTexto } from '../Maestros/formatoMaestros';
import '../Finanzas/Finanzas.css';

const colorUso = (pct) => {
  if (pct >= 90) return 'var(--danger)';
  if (pct >= 70) return 'var(--warning)';
  return 'var(--success)';
};

function MedidorDeuda({ titulo, linea, moneda, solicitado }) {
  const limite = parseFloat(linea?.limite || 0);
  const usado = parseFloat(linea?.utilizado || 0);
  const pct = limite > 0 ? (usado / limite) * 100 : 0;
  const disponibleSolicitado = solicitado === null ? null : parseFloat(solicitado || 0) - usado;
  return (
    <div className="pg-measure">
      <div className="pg-measure-top">
        <span>{titulo}</span>
        <b>{fmtMonto(usado, moneda)} <small>/ {fmtMonto(limite, moneda)}</small></b>
      </div>
      <div className="pg-meter" title={`${pct.toFixed(1)}% del límite vigente utilizado`} style={{ '--meter-c': colorUso(pct) }}>
        <span style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`pg-measure-note ${pct > 100 ? 'is-danger' : ''}`}>
        {limite > 0
          ? `${pct.toFixed(0)}% del límite vigente · disponible ${fmtMonto(linea?.disponible, moneda)}`
          : 'Sin límite vigente en esta moneda'}
      </span>
      {disponibleSolicitado !== null && (
        <span className={`pg-measure-note ${disponibleSolicitado < 0 ? 'is-danger' : ''}`}>
          Con el límite solicitado quedaría disponible {fmtMonto(disponibleSolicitado, moneda)}
        </span>
      )}
    </div>
  );
}

function SolicitudesCredito() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('Todas');
  
  const [modalAccionOpen, setModalAccionOpen] = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [accion, setAccion] = useState(null);
  const [comentario, setComentario] = useState('');
  const [procesando, setProcesando] = useState(false);

  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  const cargarSolicitudes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await solicitudesCreditoAPI.getAll();
      setSolicitudes(response.data.data || response.data);
    } catch (err) {
      setError(err.error || 'Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalAccion = (solicitud, tipoAccion) => {
    setSolicitudSeleccionada(solicitud);
    setAccion(tipoAccion);
    setComentario('');
    setModalAccionOpen(true);
  };

  const cerrarModalAccion = () => {
    setModalAccionOpen(false);
    setSolicitudSeleccionada(null);
    setAccion(null);
    setComentario('');
  };

  const handleAccion = async (e) => {
    e.preventDefault();
    
    if (accion === 'rechazar' && !comentario.trim()) {
      setError('Debe proporcionar un comentario al rechazar');
      return;
    }

    try {
      setProcesando(true);
      setError(null);

      const dataToSend = { comentario_aprobador: comentario };

      if (accion === 'aprobar') {
        await solicitudesCreditoAPI.aprobar(solicitudSeleccionada.id_solicitud, dataToSend);
        setSuccess('Solicitud aprobada exitosamente');
      } else {
        await solicitudesCreditoAPI.rechazar(solicitudSeleccionada.id_solicitud, dataToSend);
        setSuccess('Solicitud rechazada');
      }

      cerrarModalAccion();
      cargarSolicitudes();
    } catch (err) {
      setError(err.error || `Error al ${accion} solicitud`);
    } finally {
      setProcesando(false);
    }
  };

  const abrirDetalles = (solicitud) => {
    setSolicitudSeleccionada(solicitud);
    setModalDetalleOpen(true);
  };

  const calcularCambio = (anterior, solicitado) => {
    const valAnterior = parseFloat(anterior || 0);
    const valSolicitado = parseFloat(solicitado || 0);
    const dif = valSolicitado - valAnterior;
    const porcentaje = valAnterior > 0 ? ((dif / valAnterior) * 100).toFixed(1) : 100;
    const lineaNueva = valAnterior <= 0 && valSolicitado > 0;
    return { dif, porcentaje, lineaNueva };
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return isNaN(date.getTime()) ? '-' : date.toLocaleString('es-PE');
  };

  const solicitudesFiltradas = solicitudes.filter(s =>
    filtroEstado === 'Todas' ? true : s.estado === filtroEstado
  );

  const { currentItems, setCurrentPage, ...paginacion } = usePagination(solicitudesFiltradas, { storageKey: 'solicitudes_credito_pagina' });
  useEffect(() => { setCurrentPage(1); }, [filtroEstado]);

  const [creditoCliente, setCreditoCliente] = useState({ loading: false, data: null });
  const idClienteCredito = (modalDetalleOpen || modalAccionOpen) ? solicitudSeleccionada?.id_cliente : null;

  useEffect(() => {
    if (!idClienteCredito) {
      setCreditoCliente({ loading: false, data: null });
      return undefined;
    }
    let vigente = true;
    setCreditoCliente({ loading: true, data: null });
    clientesAPI.getEstadoCredito(idClienteCredito)
      .then(res => { if (vigente) setCreditoCliente({ loading: false, data: res.data.data }); })
      .catch(() => { if (vigente) setCreditoCliente({ loading: false, data: null }); });
    return () => { vigente = false; };
  }, [idClienteCredito]);

  const ESTADOS_FILTRO = ['Todas', 'Pendiente', 'Aprobada', 'Rechazada'];
  const esPdf = (url) => String(url || '').toLowerCase().includes('.pdf');
  const razonSocial = (s) => s.cliente_razon_social || s.razon_social;
  const rucCliente = (s) => s.cliente_ruc || s.ruc;

  const conteo = (estado) => solicitudes.filter(s => s.estado === estado).length;
  const pendientes = solicitudes.filter(s => s.estado === 'Pendiente');
  const pendienteMasAntigua = pendientes.reduce((m, s) => (!m || new Date(s.fecha_solicitud) < new Date(m.fecha_solicitud) ? s : m), null);
  const ultimaResuelta = (estado) => solicitudes
    .filter(s => s.estado === estado && s.fecha_respuesta)
    .reduce((m, s) => (!m || new Date(s.fecha_respuesta) > new Date(m.fecha_respuesta) ? s : m), null);
  const aprobadaReciente = ultimaResuelta('Aprobada');
  const rechazadaReciente = ultimaResuelta('Rechazada');

  const kpis = [
    {
      id: 'Pendiente', label: 'Pendientes', valor: pendientes.length,
      foot: pendienteMasAntigua ? `La más antigua ${haceTexto(pendienteMasAntigua.fecha_solicitud)}` : 'Nada por resolver'
    },
    {
      id: 'Aprobada', label: 'Aprobadas', valor: conteo('Aprobada'),
      foot: aprobadaReciente ? `Última ${haceTexto(aprobadaReciente.fecha_respuesta)}` : 'Pulsa para filtrar'
    },
    {
      id: 'Rechazada', label: 'Rechazadas', valor: conteo('Rechazada'),
      foot: rechazadaReciente ? `Última ${haceTexto(rechazadaReciente.fecha_respuesta)}` : 'Pulsa para filtrar'
    }
  ];

  const renderCambio = (anterior, solicitado) => {
    const cambio = calcularCambio(anterior, solicitado);
    if (cambio.dif === 0) return <span className="pg-tag">Sin cambio</span>;
    if (cambio.lineaNueva) return <span className="pg-tag is-info"><Sparkles size={11} />Línea nueva</span>;
    const Icono = cambio.dif > 0 ? TrendingUp : TrendingDown;
    return (
      <span className={`pg-tag ${cambio.dif > 0 ? 'is-success' : 'is-danger'}`}>
        <Icono size={11} />{cambio.dif > 0 ? '+' : ''}{cambio.porcentaje}%
      </span>
    );
  };

  const renderLimiteCelda = (anterior, solicitado, moneda) => (
    <>
      <span className="pg-money pg-cell-main">{fmtMonto(solicitado, moneda)}</span>
      <span className="pg-cell-sub">antes {fmtMonto(anterior, moneda)}</span>
      <div className="pg-tags">{renderCambio(anterior, solicitado)}</div>
    </>
  );

  const renderComparativa = (s, titulo, moneda, anterior, solicitado) => {
    const valAnterior = parseFloat(anterior || 0);
    const valSolicitado = parseFloat(solicitado || 0);
    const escala = Math.max(valAnterior, valSolicitado, 0);
    const ancho = (v) => (escala > 0 ? `${(v / escala) * 100}%` : '0%');
    const resultado = s.estado === 'Aprobada'
      ? { label: 'Aprobado', valor: fmtMonto(valSolicitado, moneda) }
      : s.estado === 'Rechazada'
        ? { label: 'Se mantiene', valor: fmtMonto(valAnterior, moneda) }
        : { label: 'Por resolver', valor: '—' };
    return (
      <div className="fn-compare">
        <div className="fn-compare-head">
          <span>{titulo}</span>
          {renderCambio(anterior, solicitado)}
        </div>
        <div className="fn-compare-row">
          <span>Anterior</span>
          <div className="pg-meter" style={{ '--meter-c': 'var(--steel-light)' }}><span style={{ width: ancho(valAnterior) }} /></div>
          <b>{fmtMonto(valAnterior, moneda)}</b>
        </div>
        <div className="fn-compare-row">
          <span>Solicitado</span>
          <div className="pg-meter"><span style={{ width: ancho(valSolicitado) }} /></div>
          <b>{fmtMonto(valSolicitado, moneda)}</b>
        </div>
        <div className="fn-compare-result">
          <span>{resultado.label}</span>
          <b>{resultado.valor}</b>
        </div>
      </div>
    );
  };

  const renderDeudaCliente = (sol) => {
    if (creditoCliente.loading) {
      return <div className="pg-loading"><Loader size={20} className="animate-spin" /></div>;
    }
    if (!creditoCliente.data) {
      return <p className="pg-empty-line">No se pudo obtener la deuda actual del cliente.</p>;
    }
    const pendiente = sol.estado === 'Pendiente';
    return (
      <div className="pg-measures">
        <MedidorDeuda titulo="Soles" linea={creditoCliente.data.credito_pen} moneda="PEN"
          solicitado={pendiente ? sol.limite_credito_pen_solicitado : null} />
        <MedidorDeuda titulo="Dólares" linea={creditoCliente.data.credito_usd} moneda="USD"
          solicitado={pendiente ? sol.limite_credito_usd_solicitado : null} />
      </div>
    );
  };

  if (loading) {
    return <Loading variant="table" />;
  }

  const detalle = solicitudSeleccionada;

  return (
    <div className="pg-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><CreditCard size={13} /> Finanzas</span>
          <h1 className="pg-title">Solicitudes de Crédito</h1>
          <p className="pg-subtitle">Gestión de aprobaciones de límite de crédito · <b>{solicitudes.length}</b> solicitudes</p>
        </div>
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        <div className="pg-kpis">
          {kpis.map(k => {
            const cfg = configEstadoSolicitudCredito(k.id);
            const Icono = cfg.icon;
            const activo = filtroEstado === k.id;
            return (
              <button key={k.id} type="button" className={`pg-kpi ${cfg.tono} ${activo ? 'on' : ''}`} aria-pressed={activo}
                onClick={() => setFiltroEstado(activo ? 'Todas' : k.id)}>
                <div className="pg-kpi-top">
                  <span className="pg-kpi-label">{k.label}</span>
                  <span className="pg-kpi-icon"><Icono size={16} /></span>
                </div>
                <span className="pg-kpi-value">{k.valor}</span>
                <span className="pg-kpi-foot">{activo ? 'Filtro activo · pulsa para quitar' : k.foot}</span>
              </button>
            );
          })}
        </div>

        <section className="pg-panel">
          <div className="pg-panel-head">
            <h2 className="pg-panel-title"><CreditCard size={16} /> Solicitudes <span className="pg-count">{solicitudesFiltradas.length}</span></h2>
            <div className="pg-segmented" role="radiogroup" aria-label="Filtrar por estado">
              {ESTADOS_FILTRO.map(estado => {
                const Icono = estado === 'Todas' ? Filter : configEstadoSolicitudCredito(estado).icon;
                return (
                  <button
                    key={estado}
                    type="button"
                    role="radio"
                    aria-checked={filtroEstado === estado}
                    className={filtroEstado === estado ? 'active' : ''}
                    onClick={() => setFiltroEstado(estado)}
                  >
                    <Icono size={13} />{estado}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-table">
              <thead>
                <tr>
                  <th className="center">Estado</th>
                  <th>Cliente</th>
                  <th>Solicitante</th>
                  <th className="num">Límite soles</th>
                  <th className="num">Límite dólares</th>
                  <th className="center">Adjunto</th>
                  <th>Fecha</th>
                  <th className="center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? currentItems.map(row => (
                  <tr key={row.id_solicitud} className="is-clickable" onClick={() => abrirDetalles(row)}>
                    <td className="center"><BadgeSolicitudCredito estado={row.estado} /></td>
                    <td style={{ minWidth: 220 }}>
                      <span className="pg-cell-main">{razonSocial(row)}</span>
                      <span className="pg-cell-sub pg-code">{rucCliente(row)}</span>
                    </td>
                    <td>
                      <span className="pg-cell-main"><User size={12} className="pg-muted" />{row.solicitante || 'Desconocido'}</span>
                      <span className="pg-cell-sub">{row.cargo_solicitante || 'Comercial'}</span>
                    </td>
                    <td className="num">{renderLimiteCelda(row.limite_credito_pen_anterior, row.limite_credito_pen_solicitado, 'PEN')}</td>
                    <td className="num">{renderLimiteCelda(row.limite_credito_usd_anterior, row.limite_credito_usd_solicitado, 'USD')}</td>
                    <td className="center">
                      {row.archivo_sustento_url
                        ? <span className="pg-tag is-info" title="Contiene archivo adjunto"><Paperclip size={11} />{esPdf(row.archivo_sustento_url) ? 'PDF' : 'Imagen'}</span>
                        : <span className="pg-muted">—</span>}
                    </td>
                    <td className="nowrap">
                      <span className="pg-cell-main">{formatearFecha(row.fecha_solicitud).split(',')[0]}</span>
                      <span className="pg-cell-sub">{haceTexto(row.fecha_solicitud)}</span>
                    </td>
                    <td className="center" onClick={(e) => e.stopPropagation()}>
                      <div className="pg-rowactions">
                        <button
                          type="button"
                          className="pg-iconbtn"
                          onClick={() => abrirDetalles(row)}
                          title="Ver detalles"
                          aria-label={`Ver detalles de la solicitud de ${razonSocial(row)}`}
                        >
                          <Eye size={15} />
                        </button>
                        {row.estado === 'Pendiente' && (
                          <>
                            <button
                              type="button"
                              className="pg-iconbtn is-success"
                              onClick={() => abrirModalAccion(row, 'aprobar')}
                              title="Aprobar"
                              aria-label={`Aprobar solicitud de ${razonSocial(row)}`}
                            >
                              <CheckCircle size={15} />
                            </button>
                            <button
                              type="button"
                              className="pg-iconbtn is-danger"
                              onClick={() => abrirModalAccion(row, 'rechazar')}
                              title="Rechazar"
                              aria-label={`Rechazar solicitud de ${razonSocial(row)}`}
                            >
                              <XCircle size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8}>
                      <div className="pg-empty">
                        <CreditCard size={28} />
                        <strong>{filtroEstado === 'Todas' ? 'No se encontraron solicitudes' : `No hay solicitudes en estado ${filtroEstado.toLowerCase()}`}</strong>
                        <span>{filtroEstado === 'Todas'
                          ? 'Las solicitudes de crédito se crean desde la ficha de cada cliente.'
                          : 'Cambia el filtro de estado para ver el resto de solicitudes.'}</span>
                        {filtroEstado !== 'Todas' && (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => setFiltroEstado('Todas')}>
                            <Filter size={14} /> Ver todas
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PgPager {...paginacion} setCurrentPage={setCurrentPage} sustantivo="solicitudes" />
        </section>
      </div>

      <Modal
        isOpen={modalAccionOpen}
        onClose={cerrarModalAccion}
        title={accion === 'aprobar' ? 'Aprobar Solicitud' : 'Rechazar Solicitud'}
      >
        {solicitudSeleccionada && (
          <form onSubmit={handleAccion} className="fn-form">
            {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
            <div className="fn-box">
              <span className="pg-cell-main">{razonSocial(solicitudSeleccionada)}</span>
              <span className="pg-cell-sub">RUC: <span className="pg-code">{rucCliente(solicitudSeleccionada)}</span></span>
            </div>

            <div className="fn-compare-grid">
              {renderComparativa(solicitudSeleccionada, 'Soles (S/)', 'PEN', solicitudSeleccionada.limite_credito_pen_anterior, solicitudSeleccionada.limite_credito_pen_solicitado)}
              {renderComparativa(solicitudSeleccionada, 'Dólares ($)', 'USD', solicitudSeleccionada.limite_credito_usd_anterior, solicitudSeleccionada.limite_credito_usd_solicitado)}
            </div>

            <div>
              <h3 className="pg-section-title"><Wallet size={14} /> Deuda actual vs límite vigente</h3>
              {renderDeudaCliente(solicitudSeleccionada)}
            </div>

            {solicitudSeleccionada.justificacion && (
              <div>
                <h3 className="pg-section-title"><MessageSquare size={14} /> Justificación</h3>
                <blockquote className="fn-quote">"{solicitudSeleccionada.justificacion}"</blockquote>
              </div>
            )}

            {solicitudSeleccionada.archivo_sustento_url && (
              <p className="fn-note is-info">
                <Paperclip size={16} />
                <span>Esta solicitud contiene un archivo adjunto que puedes ver en los detalles.</span>
              </p>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="sc-comentario">
                Comentario del Aprobador {accion === 'rechazar' && '*'}
              </label>
              <textarea
                id="sc-comentario"
                className="form-textarea"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                placeholder={accion === 'aprobar' ? 'Comentario opcional...' : 'Explique el motivo del rechazo...'}
                required={accion === 'rechazar'}
              />
            </div>

            <div className="pg-modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={cerrarModalAccion}
                disabled={procesando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`btn ${accion === 'aprobar' ? 'btn-success' : 'btn-danger'}`}
                disabled={procesando}
              >
                {accion === 'aprobar' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {procesando ? 'Procesando...' : (accion === 'aprobar' ? 'Aprobar Solicitud' : 'Rechazar Solicitud')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {modalDetalleOpen && detalle && (
        <PgDrawer
          eyebrow={<><CreditCard size={12} /> Solicitud de crédito #{detalle.id_solicitud}</>}
          title={razonSocial(detalle)}
          badges={(
            <>
              <BadgeSolicitudCredito estado={detalle.estado} />
              <span className="pg-tag">RUC <span className="pg-code">{rucCliente(detalle)}</span></span>
              {detalle.archivo_sustento_url && <span className="pg-tag is-info"><Paperclip size={11} />Con sustento</span>}
            </>
          )}
          onClose={() => setModalDetalleOpen(false)}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setModalDetalleOpen(false)}>
                Cerrar
              </button>
              {detalle.estado === 'Pendiente' && (
                <>
                  <button type="button" className="btn btn-danger" onClick={() => { setModalDetalleOpen(false); abrirModalAccion(detalle, 'rechazar'); }}>
                    <XCircle size={16} /> Rechazar
                  </button>
                  <button type="button" className="btn btn-success" onClick={() => { setModalDetalleOpen(false); abrirModalAccion(detalle, 'aprobar'); }}>
                    <CheckCircle size={16} /> Aprobar
                  </button>
                </>
              )}
            </>
          )}
        >
          <section>
            <h3 className="pg-section-title"><TrendingUp size={14} /> Comparativa de Límites</h3>
            <div className="fn-compare-grid">
              {renderComparativa(detalle, 'Soles (S/)', 'PEN', detalle.limite_credito_pen_anterior, detalle.limite_credito_pen_solicitado)}
              {renderComparativa(detalle, 'Dólares ($)', 'USD', detalle.limite_credito_usd_anterior, detalle.limite_credito_usd_solicitado)}
            </div>
          </section>

          <section>
            <h3 className="pg-section-title"><Wallet size={14} /> Deuda actual vs límite vigente</h3>
            {renderDeudaCliente(detalle)}
            <small className="pg-hint">Deuda de órdenes a crédito no canceladas ni pagadas, frente al límite que el cliente tiene hoy.</small>
          </section>

          {detalle.justificacion && (
            <section>
              <h3 className="pg-section-title"><MessageSquare size={14} /> Justificación del Comercial</h3>
              <blockquote className="fn-quote">"{detalle.justificacion}"</blockquote>
            </section>
          )}

          <section>
            <h3 className="pg-section-title"><Clock size={14} /> Historial</h3>
            <div className="pg-kv">
              <div><span>Solicitado por</span><strong>{detalle.solicitante}</strong></div>
              <div><span>Fecha</span><strong>{formatearFecha(detalle.fecha_solicitud)}</strong></div>
              {detalle.estado !== 'Pendiente' && (
                <>
                  <div><span>Resuelto por</span><strong>{detalle.aprobador || 'Administrador'}</strong></div>
                  <div><span>Fecha resolución</span><strong>{formatearFecha(detalle.fecha_respuesta)}</strong></div>
                  {detalle.comentario_aprobador && (
                    <div className="wide"><span>Comentario resolución</span><strong>{detalle.comentario_aprobador}</strong></div>
                  )}
                </>
              )}
            </div>
          </section>

          {detalle.archivo_sustento_url && (
            <section>
              <h3 className="pg-section-title"><FileText size={14} /> Documento de Sustento</h3>
              <div className="fn-sustento">
                {esPdf(detalle.archivo_sustento_url) ? (
                  <iframe
                    src={archivosAPI.getProxyUrl(detalle.archivo_sustento_url)}
                    title="Visor PDF"
                  />
                ) : (
                  <img
                    src={archivosAPI.getProxyUrl(detalle.archivo_sustento_url)}
                    alt="Sustento"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
              </div>
              <div className="fn-sustento-foot">
                <a
                  href={archivosAPI.getProxyUrl(detalle.archivo_sustento_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  <ExternalLink size={14} /> Descargar archivo original
                </a>
              </div>
            </section>
          )}
        </PgDrawer>
      )}
    </div>
  );
}

export default SolicitudesCredito;
