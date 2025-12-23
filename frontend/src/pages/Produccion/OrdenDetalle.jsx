import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Play, Pause, Square, CheckCircle, XCircle, 
  Star, Package, Clock, Beaker, FileText, ClipboardList, 
  BarChart, DollarSign, Info 
} from 'lucide-react';
import { ordenesProduccionAPI } from '../../config/api';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function OrdenDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orden, setOrden] = useState(null);
  const [consumoMateriales, setConsumoMateriales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [cantidadProducida, setCantidadProducida] = useState('');
  const [observacionesFinal, setObservacionesFinal] = useState('');

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [ordenRes, consumoRes] = await Promise.all([
        ordenesProduccionAPI.getById(id),
        ordenesProduccionAPI.getConsumoMateriales(id)
      ]);
      
      setOrden(ordenRes.data.data);
      setConsumoMateriales(consumoRes.data.data);
    } catch (err) {
      setError(err.error || 'Error al cargar la orden');
    } finally {
      setLoading(false);
    }
  };

  const handleIniciar = async () => {
    if (!confirm('¿Está seguro de iniciar la producción? Esto consumirá los materiales del inventario.')) return;

    try {
      setProcesando(true);
      setError(null);
      await ordenesProduccionAPI.iniciar(id);
      setSuccess('Producción iniciada exitosamente. Los materiales han sido consumidos.');
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al iniciar producción');
    } finally {
      setProcesando(false);
    }
  };

  const handlePausar = async () => {
    try {
      setProcesando(true);
      setError(null);
      await ordenesProduccionAPI.pausar(id);
      setSuccess('Producción pausada');
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al pausar producción');
    } finally {
      setProcesando(false);
    }
  };

  const handleReanudar = async () => {
    try {
      setProcesando(true);
      setError(null);
      await ordenesProduccionAPI.reanudar(id);
      setSuccess('Producción reanudada');
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al reanudar producción');
    } finally {
      setProcesando(false);
    }
  };

  const handleFinalizar = async (e) => {
    e.preventDefault();
    
    try {
      setProcesando(true);
      setError(null);
      await ordenesProduccionAPI.finalizar(id, {
        cantidad_producida: cantidadProducida,
        observaciones: observacionesFinal
      });
      setSuccess('Producción finalizada exitosamente. Los productos han sido agregados al inventario.');
      setModalFinalizar(false);
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al finalizar producción');
    } finally {
      setProcesando(false);
    }
  };

  const handleCancelar = async () => {
    if (!confirm('¿Está seguro de cancelar esta orden? Los materiales consumidos serán devueltos al inventario.')) return;

    try {
      setProcesando(true);
      setError(null);
      await ordenesProduccionAPI.cancelar(id);
      setSuccess('Orden cancelada. Los materiales han sido devueltos al inventario.');
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al cancelar orden');
    } finally {
      setProcesando(false);
    }
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(valor || 0);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearTiempo = (minutos) => {
    if (!minutos || minutos === 0) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}m`;
  };

  const getBadgeEstado = (estado) => {
    const badges = {
      'Pendiente': 'badge-secondary',
      'En Curso': 'badge-primary',
      'En Pausa': 'badge-warning',
      'Finalizada': 'badge-success',
      'Cancelada': 'badge-danger'
    };
    return badges[estado] || 'badge-secondary';
  };

  const calcularLotesProducidos = () => {
    if (!orden || !orden.cantidad_producida || !orden.rendimiento_unidades) return 0;
    return Math.ceil(parseFloat(orden.cantidad_producida) / parseFloat(orden.rendimiento_unidades));
  };

  const calcularLotesPlanificados = () => {
    if (!orden || !orden.cantidad_planificada || !orden.rendimiento_unidades) return 0;
    return Math.ceil(parseFloat(orden.cantidad_planificada) / parseFloat(orden.rendimiento_unidades));
  };

  if (loading) {
    return <Loading message="Cargando orden..." />;
  }

  if (!orden) {
    return (
      <div>
        <Alert type="error" message="Orden no encontrada" />
        <button className="btn btn-outline mt-3" onClick={() => navigate('/produccion/ordenes')}>
          <ArrowLeft size={18} className="mr-2" />
          Volver a Órdenes
        </button>
      </div>
    );
  }

  const puedeIniciar = orden.estado === 'Pendiente';
  const puedePausar = orden.estado === 'En Curso';
  const puedeReanudar = orden.estado === 'En Pausa';
  const puedeFinalizar = orden.estado === 'En Curso' || orden.estado === 'En Pausa';
  const puedeCancelar = orden.estado === 'En Curso' || orden.estado === 'En Pausa';
  const esRecetaProvisional = !orden.id_receta_producto;
  const lotesPlanificados = calcularLotesPlanificados();
  const lotesProducidos = calcularLotesProducidos();

  return (
    <div>
      <button className="btn btn-outline mb-4" onClick={() => navigate('/produccion/ordenes')}>
        <ArrowLeft size={20} className="mr-2" />
        Volver a Órdenes
      </button>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="card-title text-2xl font-bold">Orden de Producción: {orden.numero_orden}</h1>
          <div className="flex gap-2 items-center mt-2">
            <span className={`badge ${getBadgeEstado(orden.estado)}`}>{orden.estado}</span>
            {esRecetaProvisional && (
              <span className="badge badge-info flex items-center gap-1">
                <FileText size={14} /> Receta Provisional
              </span>
            )}
            {orden.nombre_receta && (
              <span className="badge badge-secondary">
                {orden.nombre_receta}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {puedeIniciar && (
            <button className="btn btn-success" onClick={handleIniciar} disabled={procesando}>
              <Play size={18} className="mr-2" /> Iniciar Producción
            </button>
          )}
          {puedePausar && (
            <button className="btn btn-warning" onClick={handlePausar} disabled={procesando}>
              <Pause size={18} className="mr-2" /> Pausar
            </button>
          )}
          {puedeReanudar && (
            <button className="btn btn-primary" onClick={handleReanudar} disabled={procesando}>
              <Play size={18} className="mr-2" /> Reanudar
            </button>
          )}
          {puedeFinalizar && (
            <button 
              className="btn btn-success" 
              onClick={() => {
                setCantidadProducida(orden.cantidad_planificada);
                setObservacionesFinal('');
                setModalFinalizar(true);
              }}
              disabled={procesando}
            >
              <CheckCircle size={18} className="mr-2" /> Finalizar
            </button>
          )}
          {puedeCancelar && (
            <button className="btn btn-danger" onClick={handleCancelar} disabled={procesando}>
              <XCircle size={18} className="mr-2" /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* INFORMACIÓN DE LA RECETA UTILIZADA */}
      {(orden.nombre_receta || esRecetaProvisional) && (
        <div className="card mb-4" style={{ 
          background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
          border: '2px solid var(--border-color)'
        }}>
          <div className="card-header flex items-center gap-2" style={{ backgroundColor: 'transparent', borderBottom: '1px solid var(--border-color)' }}>
            <Beaker size={20} className="text-primary" />
            <h2 className="card-title">Receta Utilizada</h2>
          </div>

          <div className="grid grid-cols-4 gap-3 p-4">
            <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
              <div className="text-xs text-muted mb-1">Tipo de Receta</div>
              <div className="font-bold flex items-center gap-1">
                {esRecetaProvisional ? (
                  <span className="text-info flex items-center gap-1"><FileText size={14} /> Provisional</span>
                ) : (
                  <span className="text-primary">{orden.nombre_receta}</span>
                )}
              </div>
            </div>

            <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
              <div className="text-xs text-muted mb-1">Rendimiento</div>
              <div className="font-bold text-lg">
                {parseFloat(orden.rendimiento_unidades || 1).toFixed(2)} <span className="text-sm text-muted font-normal">{orden.unidad_medida}</span>
              </div>
              <div className="text-xs text-muted">por lote</div>
            </div>

            <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
              <div className="text-xs text-muted mb-1">Lotes Planificados</div>
              <div className="font-bold text-lg text-primary">
                {lotesPlanificados}
              </div>
              <div className="text-xs text-muted">
                para {parseFloat(orden.cantidad_planificada).toFixed(2)} {orden.unidad_medida}
              </div>
            </div>

            <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
              <div className="text-xs text-muted mb-1">Insumos</div>
              <div className="font-bold text-lg flex items-center gap-1">
                <Package size={18} className="text-gray-500" />
                {consumoMateriales.length}
              </div>
              <div className="text-xs text-muted">componente(s)</div>
            </div>
          </div>

          {orden.descripcion_receta && (
            <div className="mx-4 mb-4 bg-white p-3 rounded border border-gray-100">
              <div className="text-xs text-muted mb-1 font-semibold uppercase">Descripción de la Receta</div>
              <div className="text-sm text-gray-700">{orden.descripcion_receta}</div>
            </div>
          )}
        </div>
      )}

      {/* TARJETAS DE INFORMACIÓN */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <ClipboardList size={18} className="text-gray-500" />
            <h2 className="card-title">Información General</h2>
          </div>
          <div className="p-4 grid gap-3">
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Producto</p>
              <p className="font-bold">{orden.producto}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Código</p>
              <p>{orden.codigo_producto}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Supervisor</p>
              <p>{orden.supervisor}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Fecha de Creación</p>
              <p>{formatearFecha(orden.fecha_creacion)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center gap-2">
            <BarChart size={18} className="text-gray-500" />
            <h2 className="card-title">Producción</h2>
          </div>
          <div className="p-4 grid gap-3">
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Cantidad Planificada</p>
              <p className="font-bold text-lg">
                {parseFloat(orden.cantidad_planificada).toFixed(2)} {orden.unidad_medida}
              </p>
              <p className="text-xs text-muted italic">({lotesPlanificados} lote(s))</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Cantidad Producida</p>
              <p className="font-bold text-lg text-success">
                {parseFloat(orden.cantidad_producida).toFixed(2)} {orden.unidad_medida}
              </p>
              {orden.cantidad_producida > 0 && (
                <p className="text-xs text-muted italic">({lotesProducidos} lote(s))</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Eficiencia</p>
              <p className="font-bold">
                {orden.cantidad_producida > 0 
                  ? `${((parseFloat(orden.cantidad_producida) / parseFloat(orden.cantidad_planificada)) * 100).toFixed(1)}%`
                  : '-'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Clock size={18} className="text-gray-500" />
            <h2 className="card-title">Tiempos y Costos</h2>
          </div>
          <div className="p-4 grid gap-3">
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Fecha Inicio / Fin</p>
              <p className="text-sm">{formatearFecha(orden.fecha_inicio)}</p>
              <p className="text-sm">{formatearFecha(orden.fecha_fin)}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Tiempo Total</p>
              <p className="font-bold flex items-center gap-1">
                <Clock size={14} /> {formatearTiempo(orden.tiempo_total_minutos)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Costo de Materiales</p>
              <p className="font-bold text-lg text-primary flex items-center gap-1">
                {formatearMoneda(orden.costo_materiales)}
              </p>
              {orden.cantidad_producida > 0 && (
                <p className="text-xs text-muted italic">
                  {formatearMoneda(parseFloat(orden.costo_materiales) / parseFloat(orden.cantidad_producida))} por unidad
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* OBSERVACIONES */}
      {orden.observaciones && (
        <div className="card mb-4">
          <div className="card-header flex items-center gap-2">
            <FileText size={18} className="text-gray-500" />
            <h2 className="card-title">Observaciones</h2>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-700" style={{ whiteSpace: 'pre-line' }}>{orden.observaciones}</p>
          </div>
        </div>
      )}

      {/* MATERIALES CONSUMIDOS */}
      {consumoMateriales.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Package size={18} className="text-gray-500" />
            <h2 className="card-title">Materiales Consumidos ({consumoMateriales.length})</h2>
          </div>

          <div className="table-container p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Insumo</th>
                  <th className="text-right">Cant. por Lote</th>
                  <th className="text-right">Lotes</th>
                  <th className="text-right">Total Consumido</th>
                  <th className="text-right">Costo Unit.</th>
                  <th className="text-right">Costo Total</th>
                </tr>
              </thead>
              <tbody>
                {consumoMateriales.map(item => {
                  const cantidadTotal = parseFloat(item.cantidad_requerida);
                  const cantidadPorLote = cantidadTotal / lotesPlanificados;
                  
                  return (
                    <tr key={item.id_consumo}>
                      <td className="font-mono text-xs">{item.codigo_insumo}</td>
                      <td className="font-medium">{item.insumo}</td>
                      <td className="text-right">
                        {cantidadPorLote.toFixed(4)} <span className="text-xs text-muted">{item.unidad_medida}</span>
                      </td>
                      <td className="text-right">
                        <span className="badge badge-primary">{lotesPlanificados}</span>
                      </td>
                      <td className="text-right">
                        <strong className="text-primary">{cantidadTotal.toFixed(4)}</strong> <span className="text-xs text-muted">{item.unidad_medida}</span>
                      </td>
                      <td className="text-right">{formatearMoneda(item.costo_unitario)}</td>
                      <td className="text-right font-bold">{formatearMoneda(item.costo_total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={6} className="text-right">TOTAL MATERIALES:</td>
                  <td className="text-right text-lg text-primary">{formatearMoneda(orden.costo_materiales)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Finalizar Producción */}
      <Modal
        isOpen={modalFinalizar}
        onClose={() => setModalFinalizar(false)}
        title={
          <span className="flex items-center gap-2">
            <CheckCircle className="text-success" /> Finalizar Producción
          </span>
        }
        size="md"
      >
        <form onSubmit={handleFinalizar}>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 flex gap-3">
            <Info className="text-blue-500 shrink-0" size={20} />
            <p className="text-sm text-blue-700">
              <strong>Importante:</strong> Al finalizar, los productos terminados serán agregados automáticamente al inventario.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">
 Real *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="form-input"
              value={cantidadProducida}
              onChange={(e) => setCantidadProducida(e.target.value)}
              required
              placeholder="0.00"
            />
            <small className="text-muted block mt-1 italic">
              Planificado: {parseFloat(orden.cantidad_planificada).toFixed(2)} {orden.unidad_medida} ({lotesPlanificados} lote(s))
            </small>
          </div>

          {cantidadProducida && (
            <div className="bg-gray-50 p-3 rounded mb-3 border border-gray-200">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted">Lotes producidos:</span>
                  <strong className="ml-2">{Math.ceil(parseFloat(cantidadProducida) / parseFloat(orden.rendimiento_unidades || 1))}</strong>
                </div>
                <div>
                  <span className="text-muted">Costo unitario:</span>
                  <strong className="ml-2 text-primary">{formatearMoneda(parseFloat(orden.costo_materiales) / parseFloat(cantidadProducida))}</strong>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Observaciones Finales</label>
            <textarea
              className="form-textarea"
              value={observacionesFinal}
              onChange={(e) => setObservacionesFinal(e.target.value)}
              placeholder="Explique diferencias entre lo planificado y producido, si las hay"
              rows={4}
            />
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={() => setModalFinalizar(false)}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-success"
              disabled={procesando || !cantidadProducida}
            >
              {procesando ? 'Procesando...' : 'Finalizar Producción'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default OrdenDetalle;