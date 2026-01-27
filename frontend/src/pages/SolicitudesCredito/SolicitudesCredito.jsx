import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  Filter, 
  TrendingUp,
  User,
  FileText
} from 'lucide-react';
import { solicitudesCreditoAPI, archivosAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

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
    return { dif, porcentaje };
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return isNaN(date.getTime()) ? '-' : date.toLocaleString('es-PE');
  };

  const solicitudesFiltradas = solicitudes.filter(s => 
    filtroEstado === 'Todas' ? true : s.estado === filtroEstado
  );

  const columns = [
    {
      header: 'Estado',
      accessor: 'estado',
      width: '100px',
      align: 'center',
      render: (value) => {
        const badges = {
          'Pendiente': { class: 'badge-warning', icon: Clock },
          'Aprobada': { class: 'badge-success', icon: CheckCircle },
          'Rechazada': { class: 'badge-danger', icon: XCircle }
        };
        const config = badges[value] || badges['Pendiente'];
        const Icon = config.icon;
        
        return (
          <span className={`badge ${config.class} flex items-center gap-1`}>
            <Icon size={14} />
            {value}
          </span>
        );
      }
    },
    {
      header: 'Cliente',
      render: (_, row) => (
        <div>
          <div className="font-medium">{row.cliente_razon_social || row.razon_social}</div>
          <div className="text-xs text-muted">{row.cliente_ruc || row.ruc}</div>
        </div>
      )
    },
    {
      header: 'Solicitante',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <div className="bg-gray-100 p-1 rounded-full">
            <User size={14} className="text-gray-600"/>
          </div>
          <div>
            <div className="font-medium text-sm">{row.solicitante || 'Desconocido'}</div>
            <div className="text-xs text-muted">{row.cargo_solicitante || 'Comercial'}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Límites Solicitados',
      width: '180px',
      render: (_, row) => {
        const cambioPEN = calcularCambio(row.limite_credito_pen_anterior, row.limite_credito_pen_solicitado);
        const cambioUSD = calcularCambio(row.limite_credito_usd_anterior, row.limite_credito_usd_solicitado);
        
        return (
          <div className="text-sm">
            <div className="flex justify-between items-center gap-2">
              <span className="font-medium text-xs text-muted">S/</span>
              <span className="font-bold"> {parseFloat(row.limite_credito_pen_solicitado).toFixed(2)}</span>
              {cambioPEN.dif !== 0 && (
                <span className={`text-xs font-bold ${cambioPEN.dif > 0 ? 'text-success' : 'text-danger'}`}>
                  {cambioPEN.dif > 0 ? <TrendingUp size={12} className="inline"/> : ''} {cambioPEN.porcentaje}%
                </span>
              )}
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="font-medium text-xs text-muted">$</span>
              <span className="font-bold"> {parseFloat(row.limite_credito_usd_solicitado).toFixed(2)}</span>
              {cambioUSD.dif !== 0 && (
                <span className={`text-xs font-bold ${cambioUSD.dif > 0 ? 'text-success' : 'text-danger'}`}>
                  {cambioUSD.dif > 0 ? <TrendingUp size={12} className="inline"/> : ''} {cambioUSD.porcentaje}%
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Adjunto',
      width: '80px',
      align: 'center',
      render: (_, row) => (
        row.archivo_sustento_url ? (
          <div className="flex justify-center" title="Contiene archivo adjunto">
            <FileText size={16} className="text-primary" />
          </div>
        ) : null
      )
    },
    {
      header: 'Fecha',
      accessor: 'fecha_solicitud',
      width: '100px',
      render: (value) => formatearFecha(value).split(',')[0]
    },
    {
      header: 'Acciones',
      width: '140px',
      align: 'center',
      render: (_, row) => (
        <div className="flex gap-2 justify-center">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => abrirDetalles(row)}
            title="Ver detalles"
          >
            <Eye size={14} />
          </button>
          {row.estado === 'Pendiente' && (
            <>
              <button
                className="btn btn-sm btn-success"
                onClick={() => abrirModalAccion(row, 'aprobar')}
                title="Aprobar"
              >
                <CheckCircle size={14} />
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => abrirModalAccion(row, 'rechazar')}
                title="Rechazar"
              >
                <XCircle size={14} />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  if (loading) {
    return <Loading message="Cargando solicitudes..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="card-title">Solicitudes de Crédito</h1>
          <p className="text-muted">Gestión de aprobaciones de límite de crédito</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card bg-warning-light border-l-4 border-warning">
          <div className="flex items-center gap-3">
            <Clock size={32} className="text-warning" />
            <div>
              <div className="text-2xl font-bold">
                {solicitudes.filter(s => s.estado === 'Pendiente').length}
              </div>
              <div className="text-sm text-muted">Pendientes</div>
            </div>
          </div>
        </div>
        
        <div className="card bg-success-light border-l-4 border-success">
          <div className="flex items-center gap-3">
            <CheckCircle size={32} className="text-success" />
            <div>
              <div className="text-2xl font-bold">
                {solicitudes.filter(s => s.estado === 'Aprobada').length}
              </div>
              <div className="text-sm text-muted">Aprobadas</div>
            </div>
          </div>
        </div>
        
        <div className="card bg-danger-light border-l-4 border-danger">
          <div className="flex items-center gap-3">
            <XCircle size={32} className="text-danger" />
            <div>
              <div className="text-2xl font-bold">
                {solicitudes.filter(s => s.estado === 'Rechazada').length}
              </div>
              <div className="text-sm text-muted">Rechazadas</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="flex items-center gap-3">
          <Filter size={20} className="text-muted" />
          <div className="flex gap-2">
            {['Todas', 'Pendiente', 'Aprobada', 'Rechazada'].map(estado => (
              <button
                key={estado}
                className={`btn btn-sm ${filtroEstado === estado ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFiltroEstado(estado)}
              >
                {estado}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Table
        columns={columns}
        data={solicitudesFiltradas}
        emptyMessage="No se encontraron solicitudes"
      />

      <Modal
        isOpen={modalAccionOpen}
        onClose={cerrarModalAccion}
        title={accion === 'aprobar' ? 'Aprobar Solicitud' : 'Rechazar Solicitud'}
      >
        {solicitudSeleccionada && (
          <form onSubmit={handleAccion}>
            <div className="mb-4">
              <div className="card bg-gray-50">
                <h3 className="font-medium mb-1">{solicitudSeleccionada.cliente_razon_social || solicitudSeleccionada.razon_social}</h3>
                <p className="text-sm text-muted mb-3">RUC: {solicitudSeleccionada.cliente_ruc || solicitudSeleccionada.ruc}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted mb-1">Límite Anterior (S/)</p>
                    <p className="font-medium">S/ {parseFloat(solicitudSeleccionada.limite_credito_pen_anterior).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Solicitado (S/)</p>
                    <p className="font-bold text-primary">S/ {parseFloat(solicitudSeleccionada.limite_credito_pen_solicitado).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Límite Anterior ($)</p>
                    <p className="font-medium">$ {parseFloat(solicitudSeleccionada.limite_credito_usd_anterior).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Solicitado ($)</p>
                    <p className="font-bold text-primary">$ {parseFloat(solicitudSeleccionada.limite_credito_usd_solicitado).toFixed(2)}</p>
                  </div>
                </div>

                {solicitudSeleccionada.justificacion && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted mb-1">Justificación:</p>
                    <div className="bg-white p-2 rounded border text-sm italic">
                      "{solicitudSeleccionada.justificacion}"
                    </div>
                  </div>
                )}
                
                {solicitudSeleccionada.archivo_sustento_url && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-2">
                        <FileText size={16} className="text-primary"/>
                        <span className="text-xs font-medium text-primary">Esta solicitud contiene un archivo adjunto que puedes ver en los detalles.</span>
                    </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Comentario del Aprobador {accion === 'rechazar' && '*'}
              </label>
              <textarea
                className="form-textarea"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                placeholder={accion === 'aprobar' ? 'Comentario opcional...' : 'Explique el motivo del rechazo...'}
                required={accion === 'rechazar'}
              />
            </div>

            <div className="flex gap-2 justify-end mt-4">
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
                {procesando ? 'Procesando...' : (accion === 'aprobar' ? 'Aprobar Solicitud' : 'Rechazar Solicitud')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={modalDetalleOpen}
        onClose={() => setModalDetalleOpen(false)}
        title="Detalles de Solicitud"
        size="lg"
      >
        {solicitudSeleccionada && (
          <div>
            <div className="card bg-gray-50 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium">{solicitudSeleccionada.cliente_razon_social || solicitudSeleccionada.razon_social}</h3>
                  <p className="text-sm text-muted">RUC: {solicitudSeleccionada.cliente_ruc || solicitudSeleccionada.ruc}</p>
                </div>
                <div className="text-right">
                  <span className={`badge ${
                    solicitudSeleccionada.estado === 'Pendiente' ? 'badge-warning' :
                    solicitudSeleccionada.estado === 'Aprobada' ? 'badge-success' :
                    'badge-danger'
                  }`}>
                    {solicitudSeleccionada.estado}
                  </span>
                  <div className="text-xs text-muted mt-1">ID Solicitud: #{solicitudSeleccionada.id_solicitud}</div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-medium mb-2 flex items-center gap-2"><TrendingUp size={16}/> Comparativa de Límites</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="card">
                  <p className="text-sm font-bold text-muted mb-2 border-b pb-1">Soles (S/)</p>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted">Anterior:</span>
                    <span className="font-medium">S/ {parseFloat(solicitudSeleccionada.limite_credito_pen_anterior).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted">Solicitado:</span>
                    <span className="font-bold text-primary">S/ {parseFloat(solicitudSeleccionada.limite_credito_pen_solicitado).toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="card">
                  <p className="text-sm font-bold text-muted mb-2 border-b pb-1">Dólares ($)</p>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted">Anterior:</span>
                    <span className="font-medium">$ {parseFloat(solicitudSeleccionada.limite_credito_usd_anterior).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted">Solicitado:</span>
                    <span className="font-bold text-primary">$ {parseFloat(solicitudSeleccionada.limite_credito_usd_solicitado).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4">
              {solicitudSeleccionada.justificacion && (
                <div>
                  <h4 className="font-medium mb-2">Justificación del Comercial</h4>
                  <div className="card bg-blue-50 h-full">
                    <p className="text-sm italic">"{solicitudSeleccionada.justificacion}"</p>
                  </div>
                </div>
              )}
              
              <div>
                <h4 className="font-medium mb-2">Historial</h4>
                <div className="card bg-gray-50 text-sm space-y-2 h-full">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted">Solicitado por:</span>
                    <span className="font-medium">{solicitudSeleccionada.solicitante}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted">Fecha:</span>
                    <span>{formatearFecha(solicitudSeleccionada.fecha_solicitud)}</span>
                  </div>
                  {solicitudSeleccionada.estado !== 'Pendiente' && (
                    <>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-muted">Resuelto por:</span>
                        <span className="font-medium">{solicitudSeleccionada.aprobador || 'Administrador'}</span>
                      </div>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-muted">Fecha Resolución:</span>
                        <span>{formatearFecha(solicitudSeleccionada.fecha_respuesta)}</span>
                      </div>
                      {solicitudSeleccionada.comentario_aprobador && (
                        <div className="pt-2">
                          <span className="text-muted block mb-1">Comentario Resolución:</span>
                          <p className="text-gray-800 bg-white p-2 rounded border">{solicitudSeleccionada.comentario_aprobador}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {solicitudSeleccionada.archivo_sustento_url && (
              <div className="mb-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileText size={16} /> Documento de Sustento
                </h4>
                <div className="card p-0 overflow-hidden border bg-gray-100">
                  {solicitudSeleccionada.archivo_sustento_url.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={`${import.meta.env.VITE_API_URL}/archivos/pdf-proxy?url=${encodeURIComponent(solicitudSeleccionada.archivo_sustento_url)}&token=${localStorage.getItem('token')}`}
                      className="w-full h-[600px] border-0"
                      title="PDF Viewer"
                    />
                  ) : (
                    <div className="flex justify-center p-4">
                        <img 
                        src={solicitudSeleccionada.archivo_sustento_url} 
                        alt="Sustento" 
                        className="w-full h-auto max-h-[600px] object-contain shadow-sm rounded"
                        />
                    </div>
                  )}
                </div>
                <div className="text-right mt-1">
                  <a 
                    href={solicitudSeleccionada.archivo_sustento_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center justify-end gap-1"
                  >
                    <Eye size={12}/> Descargar archivo original
                  </a>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button 
                className="btn btn-outline" 
                onClick={() => setModalDetalleOpen(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default SolicitudesCredito;