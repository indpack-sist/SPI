import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, FileText, Truck, CheckCircle,
  XCircle, Clock, Building, MapPin, Package, Calendar,
  ShoppingCart, Plus, AlertCircle
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

  const cargarDatos = async () => {
    try {
      setLoading(true);
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
    }
  };

  const handleCambiarEstado = async (estado) => {
    try {
      setError(null);
      
      // Si es "En Tránsito", abrir modal de despacho
      if (estado === 'En Tránsito') {
        setModalEstadoOpen(false);
        setModalDespacharOpen(true);
        return;
      }
      
      // Si es "Entregada", abrir modal de confirmación
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

  // DESPACHAR: GENERA SALIDA AUTOMÁTICA
  const handleDespachar = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await guiasRemisionAPI.despachar(id, {
        fecha_despacho: fechaDespacho
      });
      
      if (response.data.success) {
        setGuia({ 
          ...guia, 
          estado: 'En Tránsito',
          fecha_inicio_traslado: fechaDespacho
        });
        
        setSuccess(
          'Guía despachada exitosamente. ' +
          'Se han generado las salidas de inventario y actualizado el stock.'
        );
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
        setGuia({ 
          ...guia, 
          estado: 'Entregada',
          fecha_entrega: fechaEntrega
        });
        
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

  // ✅ CORRECCIÓN 1: getEstadoConfig CON ESTADOS CORRECTOS Y COMPLETOS
  const getEstadoConfig = (estado) => {
    const configs = {
      'Emitida': { 
        icono: FileText, 
        clase: 'badge-info',
        color: 'border-info',
        siguientes: ['En Tránsito', 'Anulada']
      },
      'Pendiente': { 
        icono: Clock, 
        clase: 'badge-warning',
        color: 'border-warning',
        siguientes: ['En Tránsito', 'Anulada']
      },
      'En Tránsito': { 
        icono: Truck, 
        clase: 'badge-info',
        color: 'border-info',
        siguientes: ['Entregada', 'Anulada']
      },
      'Entregada': { 
        icono: CheckCircle, 
        clase: 'badge-success',
        color: 'border-success',
        siguientes: []
      },
      'Cancelada': { 
        icono: XCircle, 
        clase: 'badge-danger',
        color: 'border-danger',
        siguientes: []
      },
      'Anulada': { 
        icono: XCircle, 
        clase: 'badge-danger',
        color: 'border-danger',
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
      render: (value) => <span className="font-mono text-sm">{value}</span>
    },
    {
      header: 'Descripción',
      accessor: 'descripcion',
      render: (value, row) => (
        <div>
          <div className="font-medium">{row.producto}</div>
          {value && value !== row.producto && (
            <div className="text-sm text-muted">{value}</div>
          )}
        </div>
      )
    },
    {
      header: 'Cantidad',
      accessor: 'cantidad',
      width: '120px',
      align: 'right',
      render: (value, row) => (
        <div className="text-right">
          <div className="font-bold">{parseFloat(value).toFixed(5)}</div>
          <div className="text-xs text-muted">{row.unidad_medida}</div>
        </div>
      )
    },
    {
      header: 'Peso Unitario',
      accessor: 'peso_unitario_kg',
      width: '120px',
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button className="btn btn-outline" onClick={() => navigate('/ventas/guias-remision')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText size={32} />
              Guía de Remisión {guia.numero_guia}
            </h1>
            <p className="text-muted">
              Emitida el {formatearFecha(guia.fecha_emision)}
              {guia.numero_orden && (
                <>
                  {' • Orden: '}
                  <button 
                    className="text-primary hover:underline"
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
          <button className="btn btn-outline" onClick={handleDescargarPDF}>
            <Download size={20} /> PDF
          </button>
          
          {/* ✅ CORRECCIÓN 2: CONDICIÓN CORRECTA PARA MOSTRAR BOTONES */}
          {guia.estado !== 'Anulada' && guia.estado !== 'Entregada' && (
            <>
              <button className="btn btn-outline" onClick={() => setModalEstadoOpen(true)}>
                <Edit size={20} /> Estado
              </button>
              
              {guia.estado === 'En Tránsito' && !guia.guia_transportista && (
                <button className="btn btn-primary" onClick={handleGenerarGuiaTransportista}>
                  <Plus size={20} /> Guía de Transportista
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Estado */}
      <div className={`card border-l-4 ${estadoConfig.color} mb-4`}>
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${estadoConfig.clase} bg-opacity-10`}>
                <IconoEstado size={32} />
              </div>
              <div>
                <p className="text-sm text-muted">Estado de la Guía</p>
                <h3 className="text-xl font-bold">{guia.estado}</h3>
                {guia.fecha_entrega && (
                  <p className="text-sm text-success">
                    Entregada el {formatearFecha(guia.fecha_entrega)}
                  </p>
                )}
              </div>
            </div>
            
            {guia.guia_transportista && (
              <div className="text-right">
                <p className="text-sm text-muted">Guía de Transportista</p>
                <button
                  className="btn btn-sm btn-info mt-2"
                  onClick={() => navigate(`/ventas/guias-transportista/${guia.guia_transportista.id_guia_transportista}`)}
                >
                  Ver {guia.guia_transportista.numero_guia}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fechas Importantes */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="flex items-center gap-6">
            <Calendar size={20} className="text-muted" />
            <div>
              <p className="text-sm text-muted">Fecha de Emisión</p>
              <p className="font-medium">{formatearFecha(guia.fecha_emision)}</p>
            </div>
            {guia.fecha_inicio_traslado && (
              <div>
                <p className="text-sm text-muted">Inicio de Traslado</p>
                <p className="font-medium">{formatearFecha(guia.fecha_inicio_traslado)}</p>
              </div>
            )}
            {guia.fecha_entrega && (
              <div>
                <p className="text-sm text-muted">Fecha de Entrega</p>
                <p className="font-medium text-success">{formatearFecha(guia.fecha_entrega)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Información General */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Cliente y Orden */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Building size={20} />
              Cliente y Orden
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Cliente:</label>
              <p className="font-bold">{guia.cliente}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">RUC:</label>
              <p>{guia.ruc_cliente}</p>
            </div>
            {guia.numero_orden && (
              <div>
                <label className="text-sm font-medium text-muted">Orden de Venta:</label>
                <button
                  className="text-primary hover:underline font-medium"
                  onClick={() => navigate(`/ventas/ordenes/${guia.id_orden_venta}`)}
                >
                  {guia.numero_orden}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Datos del Traslado */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Truck size={20} />
              Datos del Traslado
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Tipo de Traslado:</label>
              <p>{guia.tipo_traslado}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Motivo:</label>
              <p>{guia.motivo_traslado}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Modalidad:</label>
              <span className={`badge ${guia.modalidad_transporte === 'Privado' ? 'badge-primary' : 'badge-info'}`}>
                {guia.modalidad_transporte}
              </span>
            </div>
          </div>
        </div>

        {/* Peso y Bultos */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Package size={20} />
              Carga
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Peso Bruto:</label>
              <p className="font-bold text-lg text-primary">
                {parseFloat(guia.peso_bruto_kg || 0).toFixed(2)} kg
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Número de Bultos:</label>
              <p className="font-bold">{guia.numero_bultos || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Puntos de Traslado */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Punto de Partida */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <MapPin size={20} className="text-warning" />
              Punto de Partida
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Dirección:</label>
              <p>{guia.direccion_partida || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Ubigeo:</label>
              <p className="font-mono">{guia.ubigeo_partida || '-'}</p>
            </div>
          </div>
        </div>

        {/* Punto de Llegada */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <MapPin size={20} className="text-success" />
              Punto de Llegada
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Dirección:</label>
              <p className="font-medium">{guia.direccion_llegada}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-muted">Ciudad:</label>
                <p>{guia.ciudad_llegada}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted">Ubigeo:</label>
                <p className="font-mono">{guia.ubigeo_llegada || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Guía de Transportista (si existe) */}
      {guia.guia_transportista && (
        <div className="card mb-4 border-l-4 border-info">
          <div className="card-header">
            <h2 className="card-title">
              <Truck size={20} />
              Datos del Transporte
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted">Transportista:</label>
                <p className="font-bold">{guia.guia_transportista.razon_social_transportista}</p>
                <p className="text-sm text-muted">RUC: {guia.guia_transportista.ruc_transportista}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted">Conductor:</label>
                <p className="font-medium">{guia.guia_transportista.nombre_conductor}</p>
                <p className="text-sm text-muted">Licencia: {guia.guia_transportista.licencia_conducir}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted">Vehículo:</label>
                <p className="font-medium">{guia.guia_transportista.placa_vehiculo}</p>
                <p className="text-sm text-muted">{guia.guia_transportista.marca_vehiculo}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detalle de Productos */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">
            <Package size={20} />
            Detalle de Productos
          </h2>
        </div>
        <div className="card-body">
          <Table columns={columns} data={guia.detalle || []} />
          
          <div className="flex justify-end mt-4 pt-4 border-t">
            <div className="w-80">
              <div className="flex justify-between py-2">
                <span className="font-medium">Total Items:</span>
                <span className="font-bold">{guia.detalle?.length || 0}</span>
              </div>
              <div className="flex justify-between py-2 border-t">
                <span className="font-medium">Peso Total:</span>
                <span className="font-bold text-primary text-lg">
                  {parseFloat(guia.peso_bruto_kg || 0).toFixed(2)} kg
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Observaciones */}
      {guia.observaciones && (
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">Observaciones</h3>
          </div>
          <div className="card-body">
            <p className="whitespace-pre-wrap">{guia.observaciones}</p>
          </div>
        </div>
      )}

      {/* Modal Cambiar Estado */}
      <Modal
        isOpen={modalEstadoOpen}
        onClose={() => setModalEstadoOpen(false)}
        title="Cambiar Estado de Guía"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-muted">Estado actual: <strong>{guia.estado}</strong></p>
          
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

      {/* Modal Despachar */}
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
                <p className="font-medium text-blue-900">¿Qué sucederá?</p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1">
                  <li>• Se generarán salidas de inventario automáticamente</li>
                  <li>• Se descontará el stock de cada producto</li>
                  <li>• La guía cambiará a estado "En Tránsito"</li>
                  <li>• Esta acción no se puede deshacer</li>
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
            <h4 className="font-medium mb-2">Resumen:</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Guía:</span>
                <span className="font-medium">{guia.numero_guia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Cliente:</span>
                <span className="font-medium">{guia.cliente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Items:</span>
                <span>{guia.detalle?.length || 0} productos</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Peso:</span>
                <span className="font-bold">{parseFloat(guia.peso_bruto_kg || 0).toFixed(2)} kg</span>
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

      {/* Modal Confirmar Entrega */}
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
                <p className="font-medium text-green-900">¿Confirmar entrega de la guía?</p>
                <p className="text-sm text-green-700 mt-2">
                  Se marcará la guía como entregada y se actualizará el estado de la orden de venta.
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
            <h4 className="font-medium mb-2">Resumen:</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Guía:</span>
                <span className="font-medium">{guia.numero_guia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Cliente:</span>
                <span className="font-medium">{guia.cliente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Items:</span>
                <span>{guia.detalle?.length || 0} productos</span>
              </div>
              <div className="flex justify-between">
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