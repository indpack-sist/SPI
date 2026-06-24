import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShieldAlert, Paperclip, Image, FileText, Trash2, X, Save,
  Factory, ShoppingCart, Package, Calendar, User, History, ClipboardCheck,
  AlertTriangle
} from 'lucide-react';
import { incidenciasAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { getEstadoBadge, getSeveridadBadge, formatearFecha } from './Incidencias';

const ESTADOS = ['Abierta', 'En análisis', 'En tratamiento', 'Verificación', 'Cerrada', 'Anulada'];
const DISPOSICIONES = ['Pendiente', 'Reproceso', 'Descarte', 'Aceptar con desviación', 'Devolución'];

function IncidenciaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.rol || '';

  const [incidencia, setIncidencia] = useState(null);
  const [adjuntos, setAdjuntos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [subiendoAdjunto, setSubiendoAdjunto] = useState(false);
  const [adjuntoVisor, setAdjuntoVisor] = useState(null);

  const [guardandoTrat, setGuardandoTrat] = useState(false);
  const [tratamiento, setTratamiento] = useState({ disposicion: '', accion_correctiva: '', accion_preventiva: '', costo_estimado: '' });

  const [modalEstado, setModalEstado] = useState(null); // estado destino
  const [comentarioEstado, setComentarioEstado] = useState('');
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const terminada = incidencia && ['Cerrada', 'Anulada'].includes(incidencia.estado);

  useEffect(() => { cargarDatos(); }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const [incRes, adjRes, histRes] = await Promise.all([
        incidenciasAPI.getById(id),
        incidenciasAPI.getAdjuntos(id).catch(() => ({ data: { adjuntos: [] } })),
        incidenciasAPI.getHistorial(id).catch(() => ({ data: { data: [] } }))
      ]);
      const inc = incRes.data.data;
      setIncidencia(inc);
      setAdjuntos(adjRes.data.adjuntos || []);
      setHistorial(histRes.data.data || []);
      setTratamiento({
        disposicion: inc.disposicion || 'Pendiente',
        accion_correctiva: inc.accion_correctiva || '',
        accion_preventiva: inc.accion_preventiva || '',
        costo_estimado: inc.costo_estimado || ''
      });
    } catch (err) {
      setError(err.error || 'Error al cargar la incidencia');
    } finally {
      setLoading(false);
    }
  };

  const handleSubirAdjunto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setSubiendoAdjunto(true);
      const formData = new FormData();
      formData.append('archivo', file);
      const res = await incidenciasAPI.subirAdjunto(id, formData);
      if (res.data.success) {
        setAdjuntos(prev => [res.data.adjunto, ...prev]);
        setSuccess('Adjunto subido correctamente.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.error || 'Error al subir el adjunto.');
    } finally {
      setSubiendoAdjunto(false);
      e.target.value = '';
    }
  };

  const handleEliminarAdjunto = async (idAdjunto) => {
    if (!window.confirm('¿Eliminar este adjunto?')) return;
    try {
      await incidenciasAPI.eliminarAdjunto(idAdjunto);
      setAdjuntos(prev => prev.filter(a => a.id_adjunto !== idAdjunto));
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar el adjunto.');
    }
  };

  const handleGuardarTratamiento = async () => {
    try {
      setGuardandoTrat(true);
      setError(null);
      await incidenciasAPI.update(id, {
        ...tratamiento,
        costo_estimado: tratamiento.costo_estimado === '' ? null : parseFloat(tratamiento.costo_estimado)
      });
      setSuccess('Tratamiento actualizado.');
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al guardar el tratamiento.');
    } finally {
      setGuardandoTrat(false);
    }
  };

  const abrirCambioEstado = (estado) => { setModalEstado(estado); setComentarioEstado(''); };

  const handleCambiarEstado = async () => {
    if (modalEstado === 'Anulada' && !comentarioEstado.trim()) {
      setError('Debe indicar el motivo de anulación.');
      return;
    }
    try {
      setCambiandoEstado(true);
      await incidenciasAPI.cambiarEstado(id, { estado: modalEstado, comentario: comentarioEstado || null });
      setModalEstado(null);
      setSuccess(`Incidencia movida a "${modalEstado}".`);
      cargarDatos();
    } catch (err) {
      setError(err.error || err.response?.data?.error || 'Error al cambiar el estado.');
    } finally {
      setCambiandoEstado(false);
    }
  };

  if (loading) return <Loading message="Cargando incidencia..." />;
  if (!incidencia) return <div className="container py-6"><Alert type="error" message="Incidencia no encontrada" /></div>;

  const cfgEstado = getEstadoBadge(incidencia.estado);
  const IconoEstado = cfgEstado.icono;
  const estadosDisponibles = ESTADOS.filter(e => e !== incidencia.estado && !['Cerrada', 'Anulada'].includes(incidencia.estado));

  return (
    <div className="container py-6">
      <button className="btn btn-outline btn-sm mb-4 flex items-center gap-1" onClick={() => navigate('/calidad/incidencias')}>
        <ArrowLeft size={16} /> Volver
      </button>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Encabezado */}
      <div className="card mb-4">
        <div className="card-body flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-primary-dark">
              <ShieldAlert className="text-danger" /> {incidencia.codigo}
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`badge ${cfgEstado.bg} flex items-center gap-1 px-3 py-1`}><IconoEstado size={14} /> {incidencia.estado}</span>
              <span className={`badge ${getSeveridadBadge(incidencia.severidad)}`}>{incidencia.severidad}</span>
              <span className="badge badge-secondary">{incidencia.fase_deteccion}</span>
              {incidencia.tipo_nombre && <span className="text-xs text-muted">· {incidencia.tipo_nombre}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Columna izquierda: info + tratamiento + adjuntos */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Trazabilidad */}
          <div className="card">
            <div className="card-header"><h2 className="card-title flex items-center gap-2"><Package size={18} /> Trazabilidad</h2></div>
            <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted">Producto</p><p className="font-medium">{incidencia.producto || 'Sin producto'} {incidencia.codigo_producto && <span className="text-muted font-mono">({incidencia.codigo_producto})</span>}</p></div>
              <div><p className="text-xs text-muted">Cantidad afectada</p><p className="font-medium">{incidencia.cantidad_afectada ? `${incidencia.cantidad_afectada} ${incidencia.unidad_medida || ''}` : '-'}</p></div>
              <div><p className="text-xs text-muted flex items-center gap-1"><Factory size={12} /> Orden de Producción</p><p className="font-medium">{incidencia.numero_op || '-'}</p></div>
              <div><p className="text-xs text-muted flex items-center gap-1"><ShoppingCart size={12} /> Orden de Venta</p><p className="font-medium">{incidencia.numero_ov || '-'}</p></div>
              {/* Datos de OV permitidos (SIN precios) */}
              {incidencia.numero_ov && (
                <>
                  <div><p className="text-xs text-muted flex items-center gap-1"><User size={12} /> Cliente</p><p className="font-medium">{incidencia.cliente || '-'}</p></div>
                  <div><p className="text-xs text-muted">Cant. en O.V.</p><p className="font-medium">{incidencia.cantidad_ov_producto ?? '-'}</p></div>
                  <div><p className="text-xs text-muted flex items-center gap-1"><Calendar size={12} /> Fecha de despacho</p><p className="font-medium">{formatearFecha(incidencia.fecha_despacho)}</p></div>
                </>
              )}
            </div>
          </div>

          {/* Descripción */}
          <div className="card">
            <div className="card-header"><h2 className="card-title flex items-center gap-2"><AlertTriangle size={18} /> Descripción del problema</h2></div>
            <div className="card-body">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{incidencia.descripcion}</p>
              <div className="text-xs text-muted mt-3 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><User size={12} /> Detectado por: {incidencia.detectado_por || 'N/D'}</span>
                <span className="flex items-center gap-1"><Calendar size={12} /> {formatearFecha(incidencia.fecha_deteccion)}</span>
              </div>
            </div>
          </div>

          {/* Tratamiento */}
          <div className="card">
            <div className="card-header"><h2 className="card-title flex items-center gap-2"><ClipboardCheck size={18} /> Tratamiento y acciones</h2></div>
            <div className="card-body grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Disposición</label>
                  <select className="form-select" disabled={terminada} value={tratamiento.disposicion}
                    onChange={(e) => setTratamiento(p => ({ ...p, disposicion: e.target.value }))}>
                    {DISPOSICIONES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Costo estimado (S/)</label>
                  <input type="number" step="0.01" className="form-input" disabled={terminada} value={tratamiento.costo_estimado}
                    onChange={(e) => setTratamiento(p => ({ ...p, costo_estimado: e.target.value }))} placeholder="0.00" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Acción correctiva</label>
                <textarea className="form-input" rows={3} disabled={terminada} value={tratamiento.accion_correctiva}
                  onChange={(e) => setTratamiento(p => ({ ...p, accion_correctiva: e.target.value }))} placeholder="¿Qué se hizo para resolver el problema?" />
              </div>
              <div className="form-group">
                <label className="form-label">Acción preventiva</label>
                <textarea className="form-input" rows={3} disabled={terminada} value={tratamiento.accion_preventiva}
                  onChange={(e) => setTratamiento(p => ({ ...p, accion_preventiva: e.target.value }))} placeholder="¿Qué se hará para que no vuelva a ocurrir?" />
              </div>
              {!terminada && (
                <div className="flex justify-end">
                  <button className="btn btn-primary flex items-center gap-2" onClick={handleGuardarTratamiento} disabled={guardandoTrat}>
                    <Save size={16} /> {guardandoTrat ? 'Guardando...' : 'Guardar tratamiento'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Adjuntos (mismo patrón que OrdenDetalle) */}
          <div className="card">
            <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Paperclip size={18} className="text-primary" />
                <h2 className="card-title">Fotos y Adjuntos ({adjuntos.length})</h2>
              </div>
              <div className={`flex gap-2 ${subiendoAdjunto ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className="btn btn-primary btn-sm flex items-center gap-1 cursor-pointer flex-1 sm:flex-none justify-center">
                  <Image size={14} /> {subiendoAdjunto ? 'Subiendo...' : 'Tomar foto'}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleSubirAdjunto} disabled={subiendoAdjunto} />
                </label>
                <label className="btn btn-outline btn-sm flex items-center gap-1 cursor-pointer flex-1 sm:flex-none justify-center">
                  <Paperclip size={14} /> Adjuntar archivo
                  <input type="file" accept="image/*,application/pdf,.doc,.docx" className="hidden" onChange={handleSubirAdjunto} disabled={subiendoAdjunto} />
                </label>
              </div>
            </div>
            <div className="p-4">
              {adjuntos.length === 0 ? (
                <p className="text-muted text-sm text-center py-6">No hay fotos ni archivos adjuntos.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {adjuntos.map(adj => (
                    <div key={adj.id_adjunto} className="border rounded-lg overflow-hidden bg-gray-50 flex flex-col">
                      {adj.tipo_archivo === 'imagen' ? (
                        <button className="block w-full aspect-square" onClick={() => setAdjuntoVisor(adj)}>
                          <img src={adj.url} alt={adj.nombre_archivo} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                        </button>
                      ) : (
                        <a href={adj.url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center aspect-square gap-2 hover:bg-gray-100 transition-colors px-2">
                          <FileText size={28} className="text-gray-400 shrink-0" />
                          <span className="text-xs text-center text-gray-600 truncate w-full">{adj.nombre_archivo}</span>
                        </a>
                      )}
                      <div className="p-2 border-t border-gray-100 flex items-start justify-between gap-1 bg-white">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{adj.nombre_archivo}</p>
                          <p className="text-xs text-muted truncate">{adj.subido_por || 'Desconocido'}</p>
                        </div>
                        <button className="btn btn-sm btn-danger p-1 shrink-0" onClick={() => handleEliminarAdjunto(adj.id_adjunto)} title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Columna derecha: workflow + historial */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="card-header"><h2 className="card-title">Cambiar estado</h2></div>
            <div className="card-body flex flex-col gap-2">
              {terminada ? (
                <p className="text-sm text-muted">Esta incidencia está <strong>{incidencia.estado}</strong> y no admite más cambios.{incidencia.motivo_anulacion ? ` Motivo: ${incidencia.motivo_anulacion}` : ''}</p>
              ) : (
                estadosDisponibles.map(est => {
                  const cfg = getEstadoBadge(est);
                  const Ic = cfg.icono;
                  return (
                    <button key={est} className="btn btn-outline btn-sm flex items-center gap-2 justify-start" onClick={() => abrirCambioEstado(est)}>
                      <Ic size={14} /> Mover a "{est}"
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2 className="card-title flex items-center gap-2"><History size={18} /> Historial</h2></div>
            <div className="card-body">
              {historial.length === 0 ? (
                <p className="text-muted text-sm">Sin movimientos.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {historial.map(h => (
                    <div key={h.id_historial} className="border-l-2 border-primary pl-3 pb-1">
                      <p className="text-sm font-medium">{h.accion}{h.estado_nuevo && <span className="text-muted font-normal"> → {h.estado_nuevo}</span>}</p>
                      {h.comentario && <p className="text-xs text-gray-600 mt-0.5">{h.comentario}</p>}
                      <p className="text-xs text-muted mt-0.5">{h.usuario} · {formatearFecha(h.fecha)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal cambio de estado */}
      <Modal
        isOpen={!!modalEstado}
        onClose={() => setModalEstado(null)}
        title={`Mover a "${modalEstado}"`}
      >
        <div className="form-group">
          <label className="form-label">
            Comentario {modalEstado === 'Anulada' && <span className="text-danger">(motivo obligatorio)</span>}
          </label>
          <textarea className="form-input" rows={3} value={comentarioEstado} onChange={(e) => setComentarioEstado(e.target.value)}
            placeholder={modalEstado === 'Anulada' ? 'Motivo de anulación...' : 'Comentario opcional...'} />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-outline" onClick={() => setModalEstado(null)} disabled={cambiandoEstado}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleCambiarEstado} disabled={cambiandoEstado}>
            {cambiandoEstado ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
      </Modal>

      {/* Visor de imagen */}
      {adjuntoVisor && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setAdjuntoVisor(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button className="modal-close absolute top-2 right-2 bg-black/40 hover:bg-black/60 text-white z-10" onClick={() => setAdjuntoVisor(null)}>
              <X size={20} />
            </button>
            <img src={adjuntoVisor.url} alt={adjuntoVisor.nombre_archivo} className="w-full max-h-[85vh] object-contain rounded" />
            <p className="text-white text-sm mt-2 text-center">{adjuntoVisor.nombre_archivo}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default IncidenciaDetalle;
