import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, ShoppingCart, CheckCircle,
  XCircle, Clock, Truck, Package, Building, Calendar,
  MapPin, CreditCard, AlertCircle
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { ordenesCompraAPI } from '../../config/api';

function DetalleOrdenCompra() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [modalEstadoOpen, setModalEstadoOpen] = useState(false);
  const [modalRecibirOpen, setModalRecibirOpen] = useState(false);
  
  const [datosRecepcion, setDatosRecepcion] = useState({
    fecha_recepcion: new Date().toISOString().split('T')[0],
    observaciones: ''
  });

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await ordenesCompraAPI.getById(id);
      
      if (response.data.success) {
        setOrden(response.data.data);
      } else {
        setError('Orden no encontrada');
      }
      
    } catch (err) {
      console.error('Error al cargar la orden de compra:', err);
      setError(err.response?.data?.error || 'Error al cargar la orden de compra');
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstado = async (nuevoEstado) => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await ordenesCompraAPI.actualizarEstado(id, nuevoEstado);
      
      if (response.data.success) {
        setOrden({ ...orden, estado: nuevoEstado });
        setSuccess(`Estado actualizado a ${nuevoEstado}`);
        setModalEstadoOpen(false);
      } else {
        setError(response.data.error || 'Error al cambiar estado');
      }
      
    } catch (err) {
      console.error('Error al cambiar estado:', err);
      setError(err.response?.data?.error || 'Error al cambiar estado');
    } finally {
      setLoading(false);
    }
  };

  const handleRecibirOrden = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await ordenesCompraAPI.recibirOrden(id, {
        fecha_recepcion: datosRecepcion.fecha_recepcion,
        observaciones: datosRecepcion.observaciones
      });
      
      if (response.data.success) {
        setOrden({ 
          ...orden, 
          estado: 'Recibida',
          fecha_recepcion: datosRecepcion.fecha_recepcion
        });
        
        setSuccess(
          'Orden recibida exitosamente. ' +
          'Se han generado las entradas de inventario y actualizado el stock.'
        );
        setModalRecibirOpen(false);
      } else {
        setError(response.data.error || 'Error al recibir orden');
      }
      
    } catch (err) {
      console.error('Error al recibir orden:', err);
      setError(err.response?.data?.error || 'Error al recibir orden');
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarPDF = async () => {
    try {
      setLoading(true);
      await ordenesCompraAPI.descargarPDF(id);
      setSuccess('PDF descargado exitosamente');
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      setError('Error al descargar el PDF');
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatearMoneda = (valor) => {
    if (!orden) return '-';
    const simbolo = orden.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor).toFixed(2)}`;
  };

  const getEstadoConfig = (estado) => {
    const configs = {
      'Pendiente': { 
        icono: Clock, 
        clase: 'badge-warning',
        color: 'border-warning',
        siguientes: ['Confirmada', 'Cancelada']
      },
      'Confirmada': { 
        icono: CheckCircle, 
        clase: 'badge-info',
        color: 'border-info',
        siguientes: ['En Tránsito', 'Cancelada']
      },
      'En Tránsito': { 
        icono: Truck, 
        clase: 'badge-primary',
        color: 'border-primary',
        siguientes: ['Recibida', 'Cancelada']
      },
      'Recibida': { 
        icono: Package, 
        clase: 'badge-success',
        color: 'border-success',
        siguientes: []
      },
      'Cancelada': { 
        icono: XCircle, 
        clase: 'badge-danger',
        color: 'border-danger',
        siguientes: []
      }
    };
    return configs[estado] || configs['Pendiente'];
  };

  if (loading && !orden) return <Loading message="Cargando orden de compra..." />;
  
  if (!orden) {
    return (
      <div className="p-6">
        <Alert type="error" message="Orden de compra no encontrada" />
        <button className="btn btn-outline mt-4" onClick={() => navigate('/compras/ordenes')}>
          <ArrowLeft size={20} /> Volver
        </button>
      </div>
    );
  }

  const estadoConfig = getEstadoConfig(orden.estado);
  const IconoEstado = estadoConfig.icono;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button className="btn btn-outline" onClick={() => navigate('/compras/ordenes')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart size={32} />
              Orden de Compra {orden.numero_orden}
            </h1>
            <p className="text-muted">
              Emitida el {formatearFecha(orden.fecha_pedido)}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleDescargarPDF}>
            <Download size={20} /> PDF
          </button>
          
          {orden.estado !== 'Cancelada' && orden.estado !== 'Recibida' && (
            <>
              <button className="btn btn-outline" onClick={() => setModalEstadoOpen(true)}>
                <Edit size={20} /> Estado
              </button>
              
              {(orden.estado === 'Confirmada' || orden.estado === 'En Tránsito') && (
                <button className="btn btn-success" onClick={() => setModalRecibirOpen(true)}>
                  <Package size={20} /> Recibir Orden
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Estado y Timeline */}
      <div className={`card border-l-4 ${estadoConfig.color} mb-4`}>
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${estadoConfig.clase} bg-opacity-10`}>
                <IconoEstado size={32} />
              </div>
              <div>
                <p className="text-sm text-muted">Estado de la Orden</p>
                <h3 className="text-xl font-bold">{orden.estado}</h3>
              </div>
            </div>
            
            {/* Timeline */}
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <p className="text-muted">Pedido</p>
                <p className="font-bold">{formatearFecha(orden.fecha_pedido)}</p>
              </div>
              {orden.fecha_confirmacion && (
                <>
                  <div className="text-muted">→</div>
                  <div className="text-center">
                    <p className="text-muted">Confirmada</p>
                    <p className="font-bold text-success">{formatearFecha(orden.fecha_confirmacion)}</p>
                  </div>
                </>
              )}
              {orden.fecha_recepcion && (
                <>
                  <div className="text-muted">→</div>
                  <div className="text-center">
                    <p className="text-muted">Recibida</p>
                    <p className="font-bold text-success">{formatearFecha(orden.fecha_recepcion)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid 3 Columnas - Info General */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Proveedor */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Building size={20} />
              Proveedor
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Razón Social:</label>
              <p className="font-bold">{orden.proveedor}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">RUC:</label>
              <p className="font-medium">{orden.ruc_proveedor}</p>
            </div>
            {orden.direccion_proveedor && (
              <div>
                <label className="text-sm font-medium text-muted">Dirección:</label>
                <p className="text-sm">{orden.direccion_proveedor}</p>
              </div>
            )}
          </div>
        </div>

        {/* Condiciones de Pago */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <CreditCard size={20} />
              Condiciones de Pago
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Condición:</label>
              <p className="font-medium">{orden.condicion_pago}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Forma de Pago:</label>
              <p className="font-medium">{orden.forma_pago}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Moneda:</label>
              <p className="font-medium">{orden.moneda === 'USD' ? 'Dólares (USD)' : 'Soles (PEN)'}</p>
            </div>
          </div>
        </div>

        {/* Fechas */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Calendar size={20} />
              Fechas
            </h2>
          </div>
          <div className="card-body space-y-2">
            {orden.entrega_esperada && (
              <div>
                <label className="text-sm font-medium text-muted">Entrega Esperada:</label>
                <p className="font-medium">{formatearFecha(orden.entrega_esperada)}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted">Elaborado por:</label>
              <p className="font-medium">{orden.elaborado_por || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Fecha Creación:</label>
              <p className="text-sm">{formatearFecha(orden.fecha_creacion)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lugar de Entrega */}
      {orden.lugar_entrega && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <MapPin size={20} />
              Lugar de Entrega
            </h2>
          </div>
          <div className="card-body">
            <p className="font-medium">{orden.lugar_entrega}</p>
          </div>
        </div>
      )}

      {/* Tabla de Productos */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">
            <Package size={20} />
            Detalle de Productos
          </h2>
        </div>
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Código</th>
                  <th>Descripción</th>
                  <th style={{ width: '120px' }} className="text-right">Cantidad</th>
                  <th style={{ width: '60px' }} className="text-center">Unidad</th>
                  <th style={{ width: '120px' }} className="text-right">V. Unit.</th>
                  <th style={{ width: '120px' }} className="text-right">V. COMPRA</th>
                </tr>
              </thead>
              <tbody>
                {orden.detalle && orden.detalle.map((item, index) => (
                  <tr key={index}>
                    <td className="font-mono text-sm">{item.codigo_producto}</td>
                    <td>
                      <div className="font-medium">{item.producto}</div>
                    </td>
                    <td className="text-right font-mono">
                      {parseFloat(item.cantidad).toFixed(5)}
                    </td>
                    <td className="text-center text-sm text-muted">{item.unidad_medida}</td>
                    <td className="text-right font-mono">
                      {parseFloat(item.valor_unitario).toFixed(3)}
                    </td>
                    <td className="text-right font-bold text-primary">
                      {formatearMoneda(item.valor_compra)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan="5" className="text-right">
                    Total Items: {orden.detalle?.length || 0}
                  </td>
                  <td className="text-right text-primary">
                    {formatearMoneda(orden.subtotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Totales */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="flex justify-end">
            <div className="w-80">
              <div className="flex justify-between py-2">
                <span className="font-medium">Subtotal:</span>
                <span className="font-bold">{formatearMoneda(orden.subtotal)}</span>
              </div>
              <div className="flex justify-between py-2 border-t">
                <span className="font-medium">IGV (18%):</span>
                <span className="font-bold">{formatearMoneda(orden.igv)}</span>
              </div>
              <div className="flex justify-between py-3 border-t bg-primary text-white px-3 rounded">
                <span className="font-bold text-lg">TOTAL:</span>
                <span className="font-bold text-xl">{formatearMoneda(orden.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Observaciones */}
      {orden.observaciones && (
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">Observaciones</h3>
          </div>
          <div className="card-body">
            <p className="whitespace-pre-wrap">{orden.observaciones}</p>
          </div>
        </div>
      )}

      {/* Modal Cambiar Estado */}
      <Modal
        isOpen={modalEstadoOpen}
        onClose={() => setModalEstadoOpen(false)}
        title="Cambiar Estado"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-muted">Estado actual: <strong>{orden.estado}</strong></p>
          
          <div className="space-y-2">
            {estadoConfig.siguientes.map(estado => {
              const config = getEstadoConfig(estado);
              const Icono = config.icono;
              return (
                <button
                  key={estado}
                  className="btn btn-outline w-full justify-start"
                  onClick={() => handleCambiarEstado(estado)}
                >
                  <Icono size={20} /> {estado}
                </button>
              );
            })}
          </div>
          
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button className="btn btn-outline" onClick={() => setModalEstadoOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Recibir Orden */}
      <Modal
        isOpen={modalRecibirOpen}
        onClose={() => setModalRecibirOpen(false)}
        title="Recibir Orden de Compra"
        size="md"
      >
        <div className="space-y-4">
          {/* Alerta */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-info mt-1" />
              <div>
                <p className="font-bold text-blue-900">¿Qué sucederá?</p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1">
                  <li>• Se generarán entradas de inventario automáticamente</li>
                  <li>• Se actualizará el stock de cada producto</li>
                  <li>• Se recalculará el CUP (Costo Unitario Promedio)</li>
                  <li>• La orden cambiará a estado "Recibida"</li>
                  <li>• Esta acción no se puede deshacer</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="border rounded-lg p-4">
            <h4 className="font-bold mb-3">Resumen de la Orden</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Orden:</span>
                <span className="font-bold">{orden.numero_orden}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Proveedor:</span>
                <span>{orden.proveedor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total Items:</span>
                <span className="font-bold">{orden.detalle?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Monto Total:</span>
                <span className="font-bold text-primary">{formatearMoneda(orden.total)}</span>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <div className="form-group">
            <label className="form-label">Fecha de Recepción *</label>
            <input
              type="date"
              className="form-input"
              value={datosRecepcion.fecha_recepcion}
              onChange={(e) => setDatosRecepcion({ ...datosRecepcion, fecha_recepcion: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea
              className="form-textarea"
              value={datosRecepcion.observaciones}
              onChange={(e) => setDatosRecepcion({ ...datosRecepcion, observaciones: e.target.value })}
              rows={3}
              placeholder="Observaciones sobre la recepción..."
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <button 
              className="btn btn-outline" 
              onClick={() => setModalRecibirOpen(false)}
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              className="btn btn-success" 
              onClick={handleRecibirOrden}
              disabled={loading}
            >
              <Package size={20} />
              {loading ? 'Procesando...' : 'Confirmar Recepción'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DetalleOrdenCompra;