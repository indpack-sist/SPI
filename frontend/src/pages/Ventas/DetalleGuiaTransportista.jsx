import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, Truck, CheckCircle,
  XCircle, FileText, Building, User, Car, MapPin,
  Calendar, Package, ShoppingCart, RefreshCw, Clock
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { guiasTransportistaAPI } from '../../config/api';

function DetalleGuiaTransportista() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [guia, setGuia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [modalEstadoOpen, setModalEstadoOpen] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);
      setRefreshing(silencioso);
      setError(null);
      
      const response = await guiasTransportistaAPI.getById(id);
      
      if (response.data.success) {
        setGuia(response.data.data);
      } else {
        setError('Guía no encontrada');
      }
      
    } catch (err) {
      console.error('Error al cargar la guía de transportista:', err);
      setError(err.response?.data?.error || 'Error al cargar la guía de transportista');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCambiarEstado = async (estado) => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await guiasTransportistaAPI.actualizarEstado(id, estado);
      
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

  const handleDescargarPDF = async () => {
    try {
      setLoading(true);
      await guiasTransportistaAPI.descargarPDF(id);
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
      'Pendiente': { 
        icono: Clock, 
        clase: 'badge-warning',
        color: 'border-warning',
        bgColor: 'bg-yellow-50',
        siguientes: ['En Tránsito', 'Cancelada']
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
      'Cancelada': { 
        icono: XCircle, 
        clase: 'badge-danger',
        color: 'border-danger',
        bgColor: 'bg-red-50',
        siguientes: []
      }
    };
    return configs[estado] || configs['Pendiente'];
  };

  if (loading && !guia) return <Loading message="Cargando guía de transportista..." />;
  
  if (!guia) {
    return (
      <div className="p-6">
        <Alert type="error" message="Guía de transportista no encontrada" />
        <button className="btn btn-outline mt-4" onClick={() => navigate('/ventas/guias-transportista')}>
          <ArrowLeft size={20} /> Volver
        </button>
      </div>
    );
  }

  const estadoConfig = getEstadoConfig(guia.estado);
  const IconoEstado = estadoConfig.icono;
  const puedeEditar = guia.estado !== 'Cancelada' && guia.estado !== 'Entregada';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 pb-4 border-b">
        <div className="flex items-center gap-4">
          <button className="btn btn-outline" onClick={() => navigate('/ventas/guias-transportista')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck size={32} className="text-primary" />
              {guia.numero_guia}
            </h1>
            <p className="text-muted">
              Emitida el {formatearFecha(guia.fecha_emision)}
              {guia.numero_guia_remision && (
                <>
                  {' • GR: '}
                  <button 
                    className="text-primary hover:underline font-medium"
                    onClick={() => navigate(`/ventas/guias-remision/${guia.id_guia}`)}
                  >
                    {guia.numero_guia_remision}
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
            <button className="btn btn-outline" onClick={() => setModalEstadoOpen(true)}>
              <Edit size={20} /> Estado
            </button>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className={`card border-2 ${estadoConfig.color} ${estadoConfig.bgColor} mb-4`}>
        <div className="card-body">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-xl bg-white shadow-sm`}>
              <IconoEstado size={40} className={estadoConfig.clase.replace('badge-', 'text-')} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted mb-1">Estado del Transporte</p>
              <h3 className="text-3xl font-bold">{guia.estado}</h3>
              {guia.fecha_inicio_traslado && (
                <p className="text-sm text-muted mt-1">
                  Inicio: {formatearFecha(guia.fecha_inicio_traslado)}
                  {guia.fecha_estimada_llegada && ` • Llegada estimada: ${formatearFecha(guia.fecha_estimada_llegada)}`}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card">
          <div className="card-header bg-gradient-to-r from-blue-50 to-white">
            <h2 className="card-title text-blue-900">
              <Truck size={20} />
              Transportista
            </h2>
          </div>
          <div className="card-body space-y-3">
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Razón Social</label>
              <p className="font-bold text-lg">{guia.razon_social_transportista}</p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase font-semibold">RUC</label>
              <p className="font-mono font-medium">{guia.ruc_transportista}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-gradient-to-r from-green-50 to-white">
            <h2 className="card-title text-green-900">
              <User size={20} />
              Conductor
            </h2>
          </div>
          <div className="card-body space-y-3">
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Nombre</label>
              <p className="font-bold text-lg">{guia.nombre_conductor}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Licencia</label>
                <p className="font-medium">{guia.licencia_conducir}</p>
              </div>
              {guia.dni_conductor && (
                <div>
                  <label className="text-xs text-muted uppercase font-semibold">DNI</label>
                  <p className="font-mono">{guia.dni_conductor}</p>
                </div>
              )}
            </div>
            {guia.telefono_conductor && (
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Teléfono</label>
                <p>{guia.telefono_conductor}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card bg-gradient-to-br from-yellow-50 to-white">
          <div className="card-header border-yellow-200">
            <h2 className="card-title text-yellow-900">
              <Car size={20} />
              Vehículo
            </h2>
          </div>
          <div className="card-body space-y-3">
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Placa</label>
              <p className="font-bold text-2xl font-mono">{guia.placa_vehiculo}</p>
            </div>
            {(guia.marca_vehiculo || guia.modelo_vehiculo) && (
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Vehículo</label>
                <p className="font-medium">
                  {guia.marca_vehiculo} {guia.modelo_vehiculo}
                </p>
              </div>
            )}
            {guia.certificado_habilitacion && (
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Certificado</label>
                <p className="font-mono text-sm">{guia.certificado_habilitacion}</p>
              </div>
            )}
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
              <p className="font-medium">{guia.punto_partida || guia.direccion_partida || '-'}</p>
            </div>
            {guia.ubigeo_partida && (
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Ubigeo</label>
                <p className="font-mono">{guia.ubigeo_partida}</p>
              </div>
            )}
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
              <p className="font-medium">{guia.punto_llegada || guia.direccion_llegada || '-'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {guia.ciudad_llegada && (
                <div>
                  <label className="text-xs text-muted uppercase font-semibold">Ciudad</label>
                  <p>{guia.ciudad_llegada}</p>
                </div>
              )}
              {guia.ubigeo_llegada && (
                <div>
                  <label className="text-xs text-muted uppercase font-semibold">Ubigeo</label>
                  <p className="font-mono">{guia.ubigeo_llegada}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header bg-gradient-to-r from-gray-50 to-white">
          <h2 className="card-title">
            <Package size={20} />
            Información de la Carga
          </h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-6">
            {guia.tipo_traslado && (
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Tipo de Traslado</label>
                <p className="font-medium text-lg">{guia.tipo_traslado}</p>
              </div>
            )}
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Peso Bruto</label>
              <p className="font-bold text-2xl text-primary">
                {parseFloat(guia.peso_bruto_kg || 0).toFixed(2)} <span className="text-lg">kg</span>
              </p>
            </div>
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Bultos</label>
              <p className="font-bold text-2xl">{guia.numero_bultos || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header bg-gradient-to-r from-purple-50 to-white">
          <h2 className="card-title text-purple-900">
            <FileText size={20} />
            Documentos Relacionados
          </h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-6">
            {guia.numero_guia_remision && (
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Guía de Remisión</label>
                <button
                  className="text-primary hover:underline font-bold text-lg flex items-center gap-1"
                  onClick={() => navigate(`/ventas/guias-remision/${guia.id_guia}`)}
                >
                  <FileText size={16} />
                  {guia.numero_guia_remision}
                </button>
              </div>
            )}
            {guia.numero_orden && (
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Orden de Venta</label>
                <button
                  className="text-primary hover:underline font-bold text-lg flex items-center gap-1"
                  onClick={() => navigate(`/ventas/ordenes/${guia.id_orden_venta}`)}
                >
                  <ShoppingCart size={16} />
                  {guia.numero_orden}
                </button>
              </div>
            )}
            {guia.cliente && (
              <div>
                <label className="text-xs text-muted uppercase font-semibold">Cliente</label>
                <p className="font-bold text-lg">{guia.cliente}</p>
                {guia.ruc_cliente && (
                  <p className="text-sm text-muted">RUC: {guia.ruc_cliente}</p>
                )}
              </div>
            )}
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
        title="Cambiar Estado"
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
            <button 
              className="btn btn-outline" 
              onClick={() => setModalEstadoOpen(false)}
              disabled={loading}
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DetalleGuiaTransportista;