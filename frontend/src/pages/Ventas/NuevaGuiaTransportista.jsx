import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Save, Truck, FileText, User,
  Car, Search, AlertCircle, MapPin, Calendar
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { guiasTransportistaAPI, guiasRemisionAPI } from '../../config/api';

function NuevaGuiaTransportista() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idGuia = searchParams.get('guia');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [guiaRemision, setGuiaRemision] = useState(null);
  
  const [transportistas, setTransportistas] = useState([]);
  const [conductores, setConductores] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  
  const [modalTransportistaOpen, setModalTransportistaOpen] = useState(false);
  const [modalConductorOpen, setModalConductorOpen] = useState(false);
  const [modalVehiculoOpen, setModalVehiculoOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    id_guia_remision: idGuia || '',
    fecha_emision: new Date().toISOString().split('T')[0],
    razon_social_transportista: '',
    ruc_transportista: '',
    nombre_conductor: '',
    licencia_conducir: '',
    dni_conductor: '',
    telefono_conductor: '',
    placa_vehiculo: '',
    marca_vehiculo: '',
    modelo_vehiculo: '',
    certificado_habilitacion: '',
    punto_partida: '',
    punto_llegada: '',
    fecha_inicio_traslado: new Date().toISOString().split('T')[0],
    fecha_estimada_llegada: '',
    observaciones: ''
  });

  useEffect(() => {
    if (idGuia) {
      cargarGuiaRemision(idGuia);
    }
    cargarCatalogos();
  }, [idGuia]);

  const cargarGuiaRemision = async (id) => {
    try {
      setLoading(true);
      
      const response = await guiasRemisionAPI.getById(id);
      
      if (response.data.success) {
        const guia = response.data.data;
        setGuiaRemision(guia);
        
        if (guia.estado !== 'En Tránsito') {
          setError(`Solo se pueden crear guías de transportista para guías en estado "En Tránsito". Estado actual: ${guia.estado}`);
          return;
        }
        
        if (guia.guia_transportista) {
          setError('Esta guía de remisión ya tiene una guía de transportista asociada');
          return;
        }
        
        setFormData(prev => ({
          ...prev,
          id_guia_remision: id,
          punto_partida: guia.direccion_partida || guia.punto_partida || 'Almacén Central',
          punto_llegada: guia.direccion_llegada || guia.punto_llegada || '',
          fecha_inicio_traslado: guia.fecha_traslado || prev.fecha_inicio_traslado
        }));
      } else {
        setError('Guía de remisión no encontrada');
      }
      
    } catch (err) {
      console.error('Error al cargar guía de remisión:', err);
      setError(err.response?.data?.error || 'Error al cargar guía de remisión');
    } finally {
      setLoading(false);
    }
  };

  const cargarCatalogos = async () => {
    try {
      const [transpRes, condRes, vehRes] = await Promise.all([
        guiasTransportistaAPI.getTransportistasFrecuentes(),
        guiasTransportistaAPI.getConductoresFrecuentes(),
        guiasTransportistaAPI.getVehiculosFrecuentes()
      ]);
      
      if (transpRes.data.success) {
        setTransportistas(transpRes.data.data || []);
      }
      
      if (condRes.data.success) {
        setConductores(condRes.data.data || []);
      }
      
      if (vehRes.data.success) {
        setVehiculos(vehRes.data.data || []);
      }
      
    } catch (err) {
      console.error('Error al cargar catálogos:', err);
    }
  };

  const handleSelectTransportista = (transportista) => {
    setFormData({
      ...formData,
      razon_social_transportista: transportista.razon_social_transportista,
      ruc_transportista: transportista.ruc_transportista
    });
    setModalTransportistaOpen(false);
  };

  const handleSelectConductor = (conductor) => {
    setFormData({
      ...formData,
      nombre_conductor: conductor.nombre_conductor,
      licencia_conducir: conductor.licencia_conducir,
      dni_conductor: conductor.dni_conductor || '',
      telefono_conductor: conductor.telefono_conductor || ''
    });
    setModalConductorOpen(false);
  };

  const handleSelectVehiculo = (vehiculo) => {
    setFormData({
      ...formData,
      placa_vehiculo: vehiculo.placa_vehiculo,
      marca_vehiculo: vehiculo.marca_vehiculo || '',
      modelo_vehiculo: vehiculo.modelo_vehiculo || '',
      certificado_habilitacion: vehiculo.certificado_habilitacion || ''
    });
    setModalVehiculoOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!formData.id_guia_remision) {
      setError('Debe especificar una guía de remisión');
      return;
    }
    
    if (!formData.razon_social_transportista || !formData.ruc_transportista) {
      setError('Los datos del transportista son obligatorios');
      return;
    }
    
    if (formData.ruc_transportista.length !== 11) {
      setError('El RUC debe tener 11 dígitos');
      return;
    }
    
    if (!formData.nombre_conductor || !formData.licencia_conducir) {
      setError('Los datos del conductor son obligatorios');
      return;
    }
    
    if (!formData.placa_vehiculo) {
      setError('La placa del vehículo es obligatoria');
      return;
    }
    
    if (!formData.punto_partida || !formData.punto_llegada) {
      setError('Los puntos de partida y llegada son obligatorios');
      return;
    }
    
    try {
      setLoading(true);
      
      const payload = {
        id_guia_remision: parseInt(formData.id_guia_remision),
        fecha_emision: formData.fecha_emision,
        razon_social_transportista: formData.razon_social_transportista,
        ruc_transportista: formData.ruc_transportista,
        nombre_conductor: formData.nombre_conductor,
        licencia_conducir: formData.licencia_conducir,
        dni_conductor: formData.dni_conductor || null,
        telefono_conductor: formData.telefono_conductor || null,
        placa_vehiculo: formData.placa_vehiculo.toUpperCase(),
        marca_vehiculo: formData.marca_vehiculo || null,
        modelo_vehiculo: formData.modelo_vehiculo || null,
        certificado_habilitacion: formData.certificado_habilitacion || null,
        punto_partida: formData.punto_partida,
        punto_llegada: formData.punto_llegada,
        fecha_inicio_traslado: formData.fecha_inicio_traslado,
        fecha_estimada_llegada: formData.fecha_estimada_llegada || null,
        observaciones: formData.observaciones || null
      };
      
      const response = await guiasTransportistaAPI.create(payload);
      
      if (response.data.success) {
        setSuccess(`Guía creada: ${response.data.data.numero_guia}`);
        setTimeout(() => {
          navigate(`/ventas/guias-transportista/${response.data.data.id_guia_transportista}`);
        }, 1500);
      } else {
        setError(response.data.error || 'Error al crear guía de transportista');
      }
      
    } catch (err) {
      console.error('Error al crear guía:', err);
      setError(err.response?.data?.error || 'Error al crear guía de transportista');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !guiaRemision) {
    return <Loading message="Cargando guía de remisión..." />;
  }

  if (!idGuia) {
    return (
      <div className="p-6">
        <Alert type="error" message="Debe especificar una guía de remisión" />
        <button 
          className="btn btn-outline mt-4"
          onClick={() => navigate('/ventas/guias-remision')}
        >
          <ArrowLeft size={20} />
          Ir a Guías de Remisión
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button 
          className="btn btn-outline"
          onClick={() => navigate('/ventas/guias-transportista')}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck size={32} className="text-primary" />
            Nueva Guía de Transportista
          </h1>
          <p className="text-muted">
            {guiaRemision ? `Para guía ${guiaRemision.numero_guia}` : 'Preparando formulario...'}
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {guiaRemision && (
        <div className="card border-l-4 border-primary bg-blue-50 mb-4">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <FileText size={24} className="text-primary" />
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-blue-700 font-semibold">GUÍA DE REMISIÓN</p>
                  <p className="font-bold text-blue-900">{guiaRemision.numero_guia}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-semibold">ORDEN</p>
                  <p className="font-bold text-blue-900">{guiaRemision.numero_orden}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-semibold">CLIENTE</p>
                  <p className="font-medium text-blue-900">{guiaRemision.cliente}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-semibold">CARGA</p>
                  <p className="font-medium text-blue-900">
                    {parseFloat(guiaRemision.peso_bruto_kg || 0).toFixed(2)} kg • {guiaRemision.numero_bultos || 0} bultos
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card mb-4">
          <div className="card-header bg-gradient-to-r from-gray-50 to-white">
            <h2 className="card-title">
              <Calendar size={20} />
              Fechas
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">Fecha de Emisión *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.fecha_emision}
                  onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Fecha Inicio Traslado *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.fecha_inicio_traslado}
                  onChange={(e) => setFormData({ ...formData, fecha_inicio_traslado: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Fecha Estimada Llegada</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.fecha_estimada_llegada}
                  onChange={(e) => setFormData({ ...formData, fecha_estimada_llegada: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header bg-gradient-to-r from-blue-50 to-white">
            <h2 className="card-title text-blue-900">
              <Truck size={20} />
              Datos del Transportista
            </h2>
          </div>
          <div className="card-body">
            {formData.razon_social_transportista ? (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-xl text-blue-900">{formData.razon_social_transportista}</p>
                    <p className="text-sm text-blue-700 mt-1">RUC: {formData.ruc_transportista}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setFormData({ 
                      ...formData, 
                      razon_social_transportista: '', 
                      ruc_transportista: '' 
                    })}
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            ) : (
              transportistas.length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary w-full mb-4"
                  onClick={() => setModalTransportistaOpen(true)}
                >
                  <Search size={20} />
                  Seleccionar Transportista Frecuente ({transportistas.length})
                </button>
              )
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Razón Social *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.razon_social_transportista}
                  onChange={(e) => setFormData({ ...formData, razon_social_transportista: e.target.value })}
                  placeholder="Razón social del transportista"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">RUC * (11 dígitos)</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  value={formData.ruc_transportista}
                  onChange={(e) => setFormData({ ...formData, ruc_transportista: e.target.value })}
                  placeholder="20123456789"
                  maxLength="11"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header bg-gradient-to-r from-green-50 to-white">
            <h2 className="card-title text-green-900">
              <User size={20} />
              Datos del Conductor
            </h2>
          </div>
          <div className="card-body">
            {formData.nombre_conductor ? (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-xl text-green-900">{formData.nombre_conductor}</p>
                    <p className="text-sm text-green-700 mt-1">
                      Licencia: {formData.licencia_conducir}
                      {formData.dni_conductor && ` • DNI: ${formData.dni_conductor}`}
                      {formData.telefono_conductor && ` • Tel: ${formData.telefono_conductor}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setFormData({ 
                      ...formData, 
                      nombre_conductor: '', 
                      licencia_conducir: '',
                      dni_conductor: '',
                      telefono_conductor: ''
                    })}
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            ) : (
              conductores.length > 0 && (
                <button
                  type="button"
                  className="btn btn-success w-full mb-4"
                  onClick={() => setModalConductorOpen(true)}
                >
                  <Search size={20} />
                  Seleccionar Conductor Frecuente ({conductores.length})
                </button>
              )
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Nombre Completo *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre_conductor}
                  onChange={(e) => setFormData({ ...formData, nombre_conductor: e.target.value })}
                  placeholder="Nombre completo del conductor"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Licencia de Conducir *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.licencia_conducir}
                  onChange={(e) => setFormData({ ...formData, licencia_conducir: e.target.value })}
                  placeholder="Número de licencia"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">DNI (8 dígitos)</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  value={formData.dni_conductor}
                  onChange={(e) => setFormData({ ...formData, dni_conductor: e.target.value })}
                  placeholder="12345678"
                  maxLength="8"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.telefono_conductor}
                  onChange={(e) => setFormData({ ...formData, telefono_conductor: e.target.value })}
                  placeholder="999 999 999"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header bg-gradient-to-r from-yellow-50 to-white">
            <h2 className="card-title text-yellow-900">
              <Car size={20} />
              Datos del Vehículo
            </h2>
          </div>
          <div className="card-body">
            {formData.placa_vehiculo ? (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-2xl font-mono text-yellow-900">{formData.placa_vehiculo}</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      {formData.marca_vehiculo} {formData.modelo_vehiculo}
                      {formData.certificado_habilitacion && ` • Cert: ${formData.certificado_habilitacion}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setFormData({ 
                      ...formData, 
                      placa_vehiculo: '', 
                      marca_vehiculo: '',
                      modelo_vehiculo: '',
                      certificado_habilitacion: ''
                    })}
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            ) : (
              vehiculos.length > 0 && (
                <button
                  type="button"
                  className="btn btn-warning w-full mb-4"
                  onClick={() => setModalVehiculoOpen(true)}
                >
                  <Search size={20} />
                  Seleccionar Vehículo Frecuente ({vehiculos.length})
                </button>
              )
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Placa *</label>
                <input
                  type="text"
                  className="form-input font-mono text-lg"
                  value={formData.placa_vehiculo}
                  onChange={(e) => setFormData({ ...formData, placa_vehiculo: e.target.value.toUpperCase() })}
                  placeholder="ABC-123"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Certificado Habilitación</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.certificado_habilitacion}
                  onChange={(e) => setFormData({ ...formData, certificado_habilitacion: e.target.value })}
                  placeholder="Número de certificado"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Marca</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.marca_vehiculo}
                  onChange={(e) => setFormData({ ...formData, marca_vehiculo: e.target.value })}
                  placeholder="Volvo, Mercedes, etc."
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Modelo</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.modelo_vehiculo}
                  onChange={(e) => setFormData({ ...formData, modelo_vehiculo: e.target.value })}
                  placeholder="Modelo del vehículo"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header bg-gradient-to-r from-purple-50 to-white">
            <h2 className="card-title text-purple-900">
              <MapPin size={20} />
              Puntos de Traslado
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Punto de Partida *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.punto_partida}
                  onChange={(e) => setFormData({ ...formData, punto_partida: e.target.value })}
                  placeholder="Dirección completa de partida"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Punto de Llegada *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.punto_llegada}
                  onChange={(e) => setFormData({ ...formData, punto_llegada: e.target.value })}
                  placeholder="Dirección completa de llegada"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea
                className="form-textarea"
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                rows={3}
                placeholder="Observaciones adicionales sobre el transporte..."
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/ventas/guias-transportista')}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            <Save size={20} />
            {loading ? 'Guardando...' : 'Crear Guía de Transportista'}
          </button>
        </div>
      </form>

      <Modal
        isOpen={modalTransportistaOpen}
        onClose={() => setModalTransportistaOpen(false)}
        title="Seleccionar Transportista Frecuente"
        size="md"
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {transportistas.map((t, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition"
              onClick={() => handleSelectTransportista(t)}
            >
              <div className="font-bold text-lg">{t.razon_social_transportista}</div>
              <div className="text-sm text-muted">
                RUC: {t.ruc_transportista}
                {t.total_guias && ` • ${t.total_guias} guías previas`}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={modalConductorOpen}
        onClose={() => setModalConductorOpen(false)}
        title="Seleccionar Conductor Frecuente"
        size="md"
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {conductores.map((c, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg hover:bg-green-50 cursor-pointer transition"
              onClick={() => handleSelectConductor(c)}
            >
              <div className="font-bold text-lg">{c.nombre_conductor}</div>
              <div className="text-sm text-muted">
                Licencia: {c.licencia_conducir}
                {c.dni_conductor && ` • DNI: ${c.dni_conductor}`}
                {c.total_viajes && ` • ${c.total_viajes} viajes`}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={modalVehiculoOpen}
        onClose={() => setModalVehiculoOpen(false)}
        title="Seleccionar Vehículo Frecuente"
        size="md"
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {vehiculos.map((v, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg hover:bg-yellow-50 cursor-pointer transition"
              onClick={() => handleSelectVehiculo(v)}
            >
              <div className="font-bold font-mono text-xl">{v.placa_vehiculo}</div>
              <div className="text-sm text-muted">
                {v.marca_vehiculo} {v.modelo_vehiculo}
                {v.certificado_habilitacion && ` • Cert: ${v.certificado_habilitacion}`}
                {v.total_viajes && ` • ${v.total_viajes} viajes`}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default NuevaGuiaTransportista;