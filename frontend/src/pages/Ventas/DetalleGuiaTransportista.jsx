// frontend/src/pages/Ventas/DetalleGuiaTransportista.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, Truck, CheckCircle,
  XCircle, FileText, Building, User, Car, MapPin,
  Calendar, Package, ShoppingCart
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
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [modalEstadoOpen, setModalEstadoOpen] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
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
      'Activa': { 
        icono: Truck, 
        clase: 'badge-info',
        color: 'border-info',
        siguientes: ['Finalizada', 'Cancelada']
      },
      'Finalizada': { 
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
      }
    };
    return configs[estado] || configs['Activa'];
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button className="btn btn-outline" onClick={() => navigate('/ventas/guias-transportista')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck size={32} />
              Guía de Transportista {guia.numero_guia}
            </h1>
            <p className="text-muted">
              Emitida el {formatearFecha(guia.fecha_emision)}
              {guia.numero_guia_remision && (
                <>
                  {' • Guía Remisión: '}
                  <button 
                    className="text-primary hover:underline"
                    onClick={() => navigate(`/ventas/guias-remision/${guia.id_guia_remision}`)}
                  >
                    {guia.numero_guia_remision}
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
          
          {guia.estado !== 'Cancelada' && guia.estado !== 'Finalizada' && (
            <button className="btn btn-outline" onClick={() => setModalEstadoOpen(true)}>
              <Edit size={20} /> Estado
            </button>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Estado */}
      <div className={`card border-l-4 ${estadoConfig.color} mb-4`}>
        <div className="card-body">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${estadoConfig.clase} bg-opacity-10`}>
              <IconoEstado size={32} />
            </div>
            <div>
              <p className="text-sm text-muted">Estado del Transporte</p>
              <h3 className="text-xl font-bold">{guia.estado}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Fecha de Traslado */}
      {guia.fecha_inicio_traslado && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <Calendar size={20} className="text-muted" />
              <div>
                <p className="text-sm text-muted">Fecha de Inicio de Traslado</p>
                <p className="font-medium">{formatearFecha(guia.fecha_inicio_traslado)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Información del Transportista */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">
            <Truck size={20} />
            Datos del Transportista
          </h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted">Razón Social:</label>
              <p className="font-bold text-lg">{guia.razon_social_transportista}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">RUC:</label>
              <p className="font-medium">{guia.ruc_transportista}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Información del Conductor y Vehículo */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Conductor */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <User size={20} />
              Conductor
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Nombre:</label>
              <p className="font-bold text-lg">{guia.nombre_conductor}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Licencia:</label>
              <p className="font-medium">{guia.licencia_conducir}</p>
            </div>
            {guia.dni_conductor && (
              <div>
                <label className="text-sm font-medium text-muted">DNI:</label>
                <p>{guia.dni_conductor}</p>
              </div>
            )}
            {guia.telefono_conductor && (
              <div>
                <label className="text-sm font-medium text-muted">Teléfono:</label>
                <p>{guia.telefono_conductor}</p>
              </div>
            )}
          </div>
        </div>

        {/* Vehículo */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Car size={20} />
              Vehículo
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Placa:</label>
              <p className="font-bold text-lg font-mono">{guia.placa_vehiculo}</p>
            </div>
            {guia.marca_vehiculo && (
              <div>
                <label className="text-sm font-medium text-muted">Marca:</label>
                <p className="font-medium">{guia.marca_vehiculo}</p>
              </div>
            )}
            {guia.modelo_vehiculo && (
              <div>
                <label className="text-sm font-medium text-muted">Modelo:</label>
                <p>{guia.modelo_vehiculo}</p>
              </div>
            )}
            {guia.certificado_habilitacion && (
              <div>
                <label className="text-sm font-medium text-muted">Certificado:</label>
                <p className="font-mono text-sm">{guia.certificado_habilitacion}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Información de la Carga */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">
            <Package size={20} />
            Información de la Carga
          </h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted">Tipo de Traslado:</label>
              <p className="font-medium">{guia.tipo_traslado || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Peso Bruto:</label>
              <p className="font-bold text-lg text-primary">
                {parseFloat(guia.peso_bruto_kg || 0).toFixed(2)} kg
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Número de Bultos:</label>
              <p className="font-bold text-lg">{guia.numero_bultos || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ruta de Traslado */}
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
              <p className="font-medium">{guia.direccion_llegada || '-'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-muted">Ciudad:</label>
                <p>{guia.ciudad_llegada || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted">Ubigeo:</label>
                <p className="font-mono">{guia.ubigeo_llegada || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documentos Relacionados */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">
            <FileText size={20} />
            Documentos Relacionados
          </h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-4">
            {guia.numero_guia_remision && (
              <div>
                <label className="text-sm font-medium text-muted">Guía de Remisión:</label>
                <button
                  className="text-primary hover:underline font-medium"
                  onClick={() => navigate(`/ventas/guias-remision/${guia.id_guia_remision}`)}
                >
                  {guia.numero_guia_remision}
                </button>
              </div>
            )}
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
            {guia.cliente && (
              <div>
                <label className="text-sm font-medium text-muted">Cliente:</label>
                <p className="font-medium">{guia.cliente}</p>
                {guia.ruc_cliente && (
                  <p className="text-sm text-muted">RUC: {guia.ruc_cliente}</p>
                )}
              </div>
            )}
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
        title="Cambiar Estado"
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