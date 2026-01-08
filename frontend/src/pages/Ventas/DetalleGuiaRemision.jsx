import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, FileText, Truck, CheckCircle,
  XCircle, Clock, Building, MapPin, Package, Calendar,
  ShoppingCart, Plus, AlertCircle, RefreshCw
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { guiasRemisionAPI } from '../../config/api';

function DetalleGuiaRemision() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [guia, setGuia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [modalEstadoOpen, setModalEstadoOpen] = useState(false);
  const [modalDespacharOpen, setModalDespacharOpen] = useState(false);
  const [modalEntregaOpen, setModalEntregaOpen] = useState(false);
  
  const [fechaDespacho, setFechaDespacho] = useState(new Date().toISOString().split('T')[0]);
  const [fechaEntrega, setFechaEntrega] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);
      setRefreshing(silencioso);
      setError(null);
      
      const response = await guiasRemisionAPI.getById(id);
      
      if (response.data.success) {
        setGuia(response.data.data);
      } else {
        setError('Guía no encontrada');
      }
      
    } catch (err) {
      console.error('Error al cargar la guía de remisión:', err);
      setError(err.response?.data?.error || 'Error al cargar la guía de remisión');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCambiarEstado = async (estado) => {
    try {
      setError(null);
      
      if (estado === 'En Tránsito') {
        setModalEstadoOpen(false);
        setModalDespacharOpen(true);
        return;
      }
      
      if (estado === 'Entregada') {
        setModalEstadoOpen(false);
        setModalEntregaOpen(true);
        return;
      }
      
      setLoading(true);
      
      const response = await guiasRemisionAPI.actualizarEstado(id, estado);
      
      if (response.data.success) {
        setGuia({ ...guia, estado });
        setSuccess(`Estado actualizado a ${estado}`);
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

  const handleDespachar = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await guiasRemisionAPI.despachar(id, {
        fecha_despacho: fechaDespacho
      });
      
      if (response.data.success) {
        await cargarDatos(true);
        
        const mensaje = response.data.message || 'Guía despachada exitosamente';
        const detalles = response.data.data 
          ? ` Stock actualizado para ${response.data.data.productos_despachados} productos.`
          : '';
        
        setSuccess(mensaje + detalles);
        setModalDespacharOpen(false);
      } else {
        setError(response.data.error || 'Error al despachar guía');
      }
      
    } catch (err) {
      console.error('Error al despachar guía:', err);
      setError(err.response?.data?.error || 'Error al despachar guía');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarEntrega = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await guiasRemisionAPI.marcarEntregada(id, {
        fecha_entrega: fechaEntrega
      });
      
      if (response.data.success) {
        await cargarDatos(true);
        
        setSuccess('Guía marcada como entregada exitosamente');
        setModalEntregaOpen(false);
      } else {
        setError(response.data.error || 'Error al confirmar entrega');
      }
      
    } catch (err) {
      console.error('Error al confirmar entrega:', err);
      setError(err.response?.data?.error || 'Error al confirmar entrega');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarGuiaTransportista = () => {
    navigate(`/ventas/guias-transportista/nueva?guia=${id}`);
  };

  const handleDescargarPDF = async () => {
    try {
      setLoading(true);
      await guiasRemisionAPI.descargarPDF(id);
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

  const getEstadoConfig = (estado) => {
    const configs = {
      'Emitida': { 
        icono: FileText, 
        clase: 'badge-warning',
        color: 'border-warning',
        bgColor: 'bg-yellow-50',
        siguientes: ['En Tránsito', 'Anulada']
      },
      'En Tránsito': { 
        icono: Truck, 
        clase: 'badge-info',
        color: 'border-info',
        bgColor: 'bg-blue-50',
        siguientes: ['Entregada']
      },
      'Entregada': { 
        icono: CheckCircle, 
        clase: 'badge-success',
        color: 'border-success',
        bgColor: 'bg-green-50',
        siguientes: []
      },
      'Anulada': { 
        icono: XCircle, 
        clase: 'badge-danger',
        color: 'border-danger',
        bgColor: 'bg-red-50',
        siguientes: []
      }
    };
    return configs[estado] || configs['Emitida'];
  };

  const columns = [
    {
      header: 'Código',
      accessor: 'codigo_producto',
      width: '120px',
      render: (value) => <span className="font-mono text-sm font-medium">{value}</span>
    },
    {
      header: 'Producto',
      accessor: 'producto',
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          {row.descripcion && row.descripcion !== value && (
            <div className="text-sm text-muted">{row.descripcion}</div>
          )}
        </div>
      )
    },
    {
      header: 'Cantidad',
      accessor: 'cantidad',
      width: '140px',
      align: 'right',
      render: (value, row) => (
        <div className="text-right">
          <div className="font-bold text-lg">{parseFloat(value).toFixed(2)}</div>
          <div className="text-xs text-muted">{row.unidad_medida}</div>
        </div>
      )
    },
    {
      header: 'Peso Unit.',
      accessor: 'peso_unitario_kg',
      width: '100px',
      align: 'right',
      render: (value) => (
        <span className="text-sm">{parseFloat(value || 0).toFixed(2)} kg</span>
      )
    },
    {
      header: 'Peso Total',
      accessor: 'peso_total_kg',
      width: '120px',
      align: 'right',
      render: (value) => (
        <span className="font-bold text-primary">{parseFloat(value || 0).toFixed(2)} kg</span>
      )
    }
  ];

  if (loading && !guia) return <Loading message="Cargando guía de remisión..." />;
  
  if (!guia) {
    return (
      <div className="p-6">
        <Alert type="error" message="Guía de remisión no encontrada" />
        <button className="btn btn-outline mt-4" onClick={() => navigate('/ventas/guias-remision')}>
          <ArrowLeft size={20} /> Volver
        </button>
      </div>
    );
  }

  const estadoConfig = getEstadoConfig(guia.estado);
  const IconoEstado = estadoConfig.icono;
  const puedeEditar = guia.estado !== 'Anulada' && guia.estado !== 'Entregada';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 pb-4 border-b">
        <div className="flex items-center gap-4">
          <button className="btn btn-outline" onClick={() => navigate('/ventas/guias-remision')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText size={32} className="text-primary" />
              {guia.numero_guia}
            </h1>
            <p className="text-muted">
              Emitida el {formatearFecha(guia.fecha_emision)}
              {guia.numero_orden && (
                <>
                  {' • Orden: '}
                  <button 
                    className="text-primary hover:underline font-medium"
                    onClick={() => navigate(`/ventas/ordenes/${guia.id_orden_venta}`)}
                  >
                    {guia.numero_orden}
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            className="btn btn-outline"
            onClick={() => cargarDatos(true)}
            disabled={refreshing}
            title="Actualizar"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>

          <button className="btn btn-outline" onClick={handleDescargarPDF}>
            <Download size={20} /> PDF
          </button>
          
          {puedeEditar && (
            <>
              <button className="btn btn-outline" onClick={() => setModalEstadoOpen(true)}>
                <Edit size={20} /> Estado
              </button>
              
              {guia.estado === 'En Tránsito' && !guia.guia_transportista && (
                <button className="btn btn-primary" onClick={handleGenerarGuiaTransportista}>
                  <Plus size={20} /> Guía Transportista
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className={`card border-2 ${estadoConfig.color} ${estadoConfig.bgColor} mb-4`}>
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-xl bg-white shadow-sm`}>
                <IconoEstado size={40} className={estadoConfig.clase.replace('badge-', 'text-')} />
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Estado de la Guía</p>
                <h3 className="text-3xl font-bold">{guia.estado}</h3>
                {guia.fecha_traslado && guia.estado === 'En Tránsito' && (
                  <p className="text-sm text-info mt-1">
                    En tránsito desde {formatearFecha(guia.fecha_traslado)}
                  </p>
                )}
              </div>
            </div>
            
            {guia.guia_transportista && (
              <div className="text-right bg-white rounded-lg p-4 shadow-sm">
                <p className="text-xs text-muted uppercase font-semibold mb-2">Guía de Transportista</p>
                <p className="font-mono font-bold text-lg mb-2">{guia.guia_transportista.numero_guia}</p>
                <button
                  className="btn btn-sm btn-info"
                  onClick={() => navigate(`/ventas/guias-transportista/${guia.guia_transportista.id_guia_transportista}`)}
                >
                  Ver Detalle
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card">
          <div className="card-header bg-gradient-to-r from-blue-50 to-white">
            <h2 className="card-title text-blue-900">
              <Building size={20} />
              Cliente
            </h2>
          </div>
          <div className="card-body space-y-3">
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Razón Social</label>
              <p className="font-bold text-lg">{guia.cliente}</p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase font-semibold">RUC</label>
              <p className="font-mono">{guia.ruc_cliente}</p>
            </div>
            {guia.numero_orden && (
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Orden de Venta</label>
                <button
                  className="text-primary hover:underline font-bold flex items-center gap-1"
                  onClick={() => navigate(`/ventas/ordenes/${guia.id_orden_venta}`)}
                >
                  <ShoppingCart size={14} />
                  {guia.numero_orden}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-gradient-to-r from-purple-50 to-white">
            <h2 className="card-title text-purple-900">
              <Truck size={20} />
              Traslado
            </h2>
          </div>
          <div className="card-body space-y-3">
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Motivo</label>
              <p className="font-medium">{guia.motivo_traslado}</p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Tipo</label>
              <p>{guia.tipo_traslado}</p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Modalidad</label>
              <span className={`badge ${guia.modalidad_transporte?.includes('Privado') ? 'badge-primary' : 'badge-info'}`}>
                {guia.modalidad_transporte}
              </span>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-primary to-blue-600 text-white">
          <div className="card-header border-white/20">
            <h2 className="card-title text-white">
              <Package size={20} />
              Carga
            </h2>
          </div>
          <div className="card-body space-y-3">
            <div>
              <label className="text-xs text-white/80 uppercase font-semibold">Peso Bruto</label>
              <p className="font-bold text-3xl">
                {parseFloat(guia.peso_bruto_kg || 0).toFixed(2)} <span className="text-lg">kg</span>
              </p>
            </div>
            <div>
              <label className="text-xs text-white/80 uppercase font-semibold">Bultos</label>
              <p className="font-bold text-2xl">{guia.numero_bultos || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="card border-l-4 border-green-500">
          <div className="card-header bg-gradient-to-r from-green-50 to-white">
            <h2 className="card-title text-green-900">
              <MapPin size={20} />
              Punto de Partida
            </h2>
          </div>
          <div className="card-body space-y-3">
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Dirección</label>
              <p className="font-medium">{guia.direccion_partida || guia.punto_partida || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Ubigeo</label>
              <p className="font-mono">{guia.ubigeo_partida || '-'}</p>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-blue-500">
          <div className="card-header bg-gradient-to-r from-blue-50 to-white">
            <h2 className="card-title text-blue-900">
              <MapPin size={20} />
              Punto de Llegada
            </h2>
          </div>
          <div className="card-body space-y-3">
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Dirección</label>
              <p className="font-medium">{guia.direccion_llegada || guia.punto_llegada}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Ciudad</label>
                <p>{guia.ciudad_llegada || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Ubigeo</label>
                <p className="font-mono">{guia.ubigeo_llegada || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {guia.guia_transportista && (
        <div className="card mb-4 border-l-4 border-info">
          <div className="card-header bg-gradient-to-r from-blue-50 to-white">
            <h2 className="card-title text-blue-900">
              <Truck size={20} />
              Datos del Transporte
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Transportista</label>
                <p className="font-bold text-lg">{guia.guia_transportista.razon_social_transportista}</p>
                <p className="text-sm text-muted">RUC: {guia.guia_transportista.ruc_transportista}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Conductor</label>
                <p className="font-medium text-lg">{guia.guia_transportista.nombre_conductor}</p>
                <p className="text-sm text-muted">Lic: {guia.guia_transportista.licencia_conducir}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Vehículo</label>
                <p className="font-medium text-lg">{guia.guia_transportista.placa_vehiculo}</p>
                <p className="text-sm text-muted">{guia.guia_transportista.marca_vehiculo}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="card-header bg-gradient-to-r from-gray-50 to-white">
          <h2 className="card-title">
            <Package size={20} />
            Productos Despachados
            <span className="badge badge-primary ml-2">{guia.detalle?.length || 0}</span>
          </h2>
        </div>
        <div className="card-body p-0">
          <Table columns={columns} data={guia.detalle || []} />
          
          <div className="bg-gray-50 border-t p-6">
            <div className="flex justify-end">
              <div className="w-96">
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium">Total Items:</span>
                  <span className="font-bold">{guia.detalle?.length || 0}</span>
                </div>
                <div className="flex justify-between py-3 bg-primary text-white px-4 rounded-lg mt-2">
                  <span className="font-bold text-lg">PESO TOTAL:</span>
                  <span className="font-bold text-2xl">
                    {parseFloat(guia.peso_bruto_kg || 0).toFixed(2)} kg
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {guia.observaciones && (
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">Observaciones</h3>
          </div>
          <div className="card-body">
            <p className="whitespace-pre-wrap text-muted">{guia.observaciones}</p>
          </div>
        </div>
      )}

      <Modal
        isOpen={modalEstadoOpen}
        onClose={() => setModalEstadoOpen(false)}
        title="Cambiar Estado de Guía"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-muted">Estado actual:</p>
            <p className="font-bold text-lg">{guia.estado}</p>
          </div>
          
          <div className="space-y-2">
            {estadoConfig.siguientes.length > 0 ? (
              estadoConfig.siguientes.map(estado => {
                const config = getEstadoConfig(estado);
                const Icono = config.icono;
                return (
                  <button
                    key={estado}
                    className={`btn w-full justify-start ${config.clase.replace('badge-', 'btn-')}`}
                    onClick={() => handleCambiarEstado(estado)}
                  >
                    <Icono size={20} /> Cambiar a {estado}
                  </button>
                );
              })
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  No hay estados disponibles desde el estado actual
                </p>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button className="btn btn-outline" onClick={() => setModalEstadoOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalDespacharOpen}
        onClose={() => setModalDespacharOpen(false)}
        title="Despachar Guía de Remisión"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Truck size={24} className="text-info flex-shrink-0 mt-1" />
              <div>
                <p className="font-medium text-blue-900">¿Qué sucederá al despachar?</p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1">
                  <li>✓ Se generará salida de inventario automática</li>
                  <li>✓ Se descontará el stock de cada producto</li>
                  <li>✓ La guía cambiará a estado "En Tránsito"</li>
                  <li>✓ La orden de venta se marcará como "Despachada"</li>
                  <li>⚠️ Esta acción no se puede deshacer</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Fecha de Despacho *</label>
            <input
              type="date"
              className="form-input"
              value={fechaDespacho}
              onChange={(e) => setFechaDespacho(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-3">Resumen del Despacho:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Guía:</span>
                <span className="font-mono font-bold">{guia.numero_guia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Cliente:</span>
                <span className="font-medium">{guia.cliente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Productos:</span>
                <span>{guia.detalle?.length || 0} items</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted">Peso Total:</span>
                <span className="font-bold text-primary">{parseFloat(guia.peso_bruto_kg || 0).toFixed(2)} kg</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button 
              className="btn btn-outline" 
              onClick={() => setModalDespacharOpen(false)}
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              className="btn btn-info" 
              onClick={handleDespachar}
              disabled={loading}
            >
              <Truck size={20} />
              {loading ? 'Procesando...' : 'Confirmar Despacho'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalEntregaOpen}
        onClose={() => setModalEntregaOpen(false)}
        title="Confirmar Entrega"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle size={24} className="text-success flex-shrink-0 mt-1" />
              <div>
                <p className="font-medium text-green-900">Confirmar entrega de la guía</p>
                <p className="text-sm text-green-700 mt-2">
                  La guía se marcará como entregada. Si es la última guía pendiente, la orden de venta también se marcará como entregada.
                </p>
              </div>
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Fecha de Entrega *</label>
            <input
              type="date"
              className="form-input"
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-3">Resumen:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Guía:</span>
                <span className="font-mono font-bold">{guia.numero_guia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Cliente:</span>
                <span className="font-medium">{guia.cliente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Productos:</span>
                <span>{guia.detalle?.length || 0} items</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted">Peso:</span>
                <span className="font-bold">{parseFloat(guia.peso_bruto_kg || 0).toFixed(2)} kg</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button 
              className="btn btn-outline" 
              onClick={() => setModalEntregaOpen(false)}
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              className="btn btn-success" 
              onClick={handleConfirmarEntrega}
              disabled={loading}
            >
              <CheckCircle size={20} />
              {loading ? 'Procesando...' : 'Confirmar Entrega'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DetalleGuiaRemision;