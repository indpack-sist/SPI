// frontend/src/pages/Ventas/NuevaGuiaTransportista.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Save, Truck, FileText, User,
  Car, Search, AlertCircle
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
  
  // Catálogos de datos frecuentes
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
    fecha_inicio_traslado: new Date().toISOString().split('T')[0],
    observaciones: ''
  });

  useEffect(() => {
    if (idGuia) {
      cargarGuiaRemision(idGuia);
    }
    cargarCatalogos();
  }, [idGuia]);

  // ✅ CARGAR GUÍA DE REMISIÓN
  const cargarGuiaRemision = async (id) => {
    try {
      setLoading(true);
      
      const response = await guiasRemisionAPI.getById(id);
      
      if (response.data.success) {
        const guia = response.data.data;
        setGuiaRemision(guia);
        setFormData(prev => ({
          ...prev,
          id_guia_remision: id,
          fecha_inicio_traslado: guia.fecha_inicio_traslado || prev.fecha_inicio_traslado
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

  // ✅ CARGAR CATÁLOGOS DE DATOS FRECUENTES
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
      // No mostrar error, los catálogos son opcionales
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

  // ✅ GUARDAR EN API REAL
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!formData.id_guia_remision) {
      setError('Debe especificar una guía de remisión');
      return;
    }
    
    if (!formData.razon_social_transportista || !formData.ruc_transportista) {
      setError('Debe especificar el transportista');
      return;
    }
    
    if (!formData.nombre_conductor || !formData.licencia_conducir) {
      setError('Debe especificar el conductor');
      return;
    }
    
    if (!formData.placa_vehiculo) {
      setError('Debe especificar el vehículo');
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
        placa_vehiculo: formData.placa_vehiculo,
        marca_vehiculo: formData.marca_vehiculo || null,
        modelo_vehiculo: formData.modelo_vehiculo || null,
        certificado_habilitacion: formData.certificado_habilitacion || null,
        fecha_inicio_traslado: formData.fecha_inicio_traslado,
        observaciones: formData.observaciones
      };
      
      const response = await guiasTransportistaAPI.create(payload);
      
      if (response.data.success) {
        setSuccess('Guía de transportista creada exitosamente');
        setTimeout(() => {
          navigate('/ventas/guias-transportista');
        }, 1500);
      } else {
        setError(response.data.error || 'Error al crear guía de transportista');
      }
      
    } catch (err) {
      console.error('Error al crear guía de transportista:', err);
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
            <Truck size={32} />
            Nueva Guía de Transportista
          </h1>
          <p className="text-muted">
            Para guía de remisión {guiaRemision?.numero_guia}
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Info Guía de Remisión */}
      {guiaRemision && (
        <div className="card border-l-4 border-primary bg-blue-50 mb-4">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <FileText size={24} className="text-primary" />
              <div className="flex-1">
                <p className="font-medium text-blue-900">
                  Guía de Remisión: {guiaRemision.numero_guia}
                </p>
                <p className="text-sm text-blue-700">
                  Orden: {guiaRemision.numero_orden} • Cliente: {guiaRemision.cliente}
                </p>
                <p className="text-sm text-blue-700">
                  Destino: {guiaRemision.ciudad_llegada} • 
                  Peso: {parseFloat(guiaRemision.peso_bruto_kg || 0).toFixed(2)} kg • 
                  Bultos: {guiaRemision.numero_bultos || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Fecha */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4">
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
            </div>
          </div>
        </div>

        {/* Transportista */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <Truck size={20} />
              Datos del Transportista
            </h2>
          </div>
          <div className="card-body">
            {formData.razon_social_transportista ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-lg">{formData.razon_social_transportista}</p>
                    <p className="text-sm text-muted">RUC: {formData.ruc_transportista}</p>
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
                  Seleccionar Transportista Frecuente
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
                <label className="form-label">RUC *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.ruc_transportista}
                  onChange={(e) => setFormData({ ...formData, ruc_transportista: e.target.value })}
                  placeholder="RUC (11 dígitos)"
                  maxLength="11"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Conductor */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <User size={20} />
              Datos del Conductor
            </h2>
          </div>
          <div className="card-body">
            {formData.nombre_conductor ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-lg">{formData.nombre_conductor}</p>
                    <p className="text-sm text-muted">
                      Licencia: {formData.licencia_conducir}
                      {formData.dni_conductor && ` • DNI: ${formData.dni_conductor}`}
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
                  Seleccionar Conductor Frecuente
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
                  placeholder="Nombre del conductor"
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
                <label className="form-label">DNI</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.dni_conductor}
                  onChange={(e) => setFormData({ ...formData, dni_conductor: e.target.value })}
                  placeholder="DNI del conductor"
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
                  placeholder="Teléfono de contacto"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Vehículo */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <Car size={20} />
              Datos del Vehículo
            </h2>
          </div>
          <div className="card-body">
            {formData.placa_vehiculo ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-lg font-mono">{formData.placa_vehiculo}</p>
                    <p className="text-sm text-muted">
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
                  Seleccionar Vehículo Frecuente
                </button>
              )
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Placa *</label>
                <input
                  type="text"
                  className="form-input font-mono"
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
                  placeholder="Ej: Volvo, Mercedes"
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

        {/* Observaciones */}
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

        {/* Botones */}
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

      {/* Modal Transportistas */}
      <Modal
        isOpen={modalTransportistaOpen}
        onClose={() => setModalTransportistaOpen(false)}
        title="Seleccionar Transportista Frecuente"
        size="md"
      >
        <div className="space-y-2">
          {transportistas.map((t, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition"
              onClick={() => handleSelectTransportista(t)}
            >
              <div className="font-bold">{t.razon_social_transportista}</div>
              <div className="text-sm text-muted">
                RUC: {t.ruc_transportista} • {t.total_guias || 0} guías previas
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Modal Conductores */}
      <Modal
        isOpen={modalConductorOpen}
        onClose={() => setModalConductorOpen(false)}
        title="Seleccionar Conductor Frecuente"
        size="md"
      >
        <div className="space-y-2">
          {conductores.map((c, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg hover:bg-green-50 cursor-pointer transition"
              onClick={() => handleSelectConductor(c)}
            >
              <div className="font-bold">{c.nombre_conductor}</div>
              <div className="text-sm text-muted">
                Licencia: {c.licencia_conducir}
                {c.dni_conductor && ` • DNI: ${c.dni_conductor}`}
                {c.total_viajes && ` • ${c.total_viajes} viajes previos`}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Modal Vehículos */}
      <Modal
        isOpen={modalVehiculoOpen}
        onClose={() => setModalVehiculoOpen(false)}
        title="Seleccionar Vehículo Frecuente"
        size="md"
      >
        <div className="space-y-2">
          {vehiculos.map((v, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg hover:bg-yellow-50 cursor-pointer transition"
              onClick={() => handleSelectVehiculo(v)}
            >
              <div className="font-bold font-mono text-lg">{v.placa_vehiculo}</div>
              <div className="text-sm text-muted">
                {v.marca_vehiculo} {v.modelo_vehiculo}
                {v.certificado_habilitacion && ` • Cert: ${v.certificado_habilitacion}`}
                {v.total_viajes && ` • ${v.total_viajes} viajes previos`}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default NuevaGuiaTransportista;