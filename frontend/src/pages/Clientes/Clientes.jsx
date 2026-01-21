import { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Search, CheckCircle, AlertCircle, 
  Loader, Building2, Eye, User, CreditCard 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clientesAPI, solicitudesCreditoAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState('');

  const [validandoDocumento, setValidandoDocumento] = useState(false);
  const [documentoValidado, setDocumentoValidado] = useState(null);
  const [datosAPI, setDatosAPI] = useState(null);
  
  const [modalSolicitudOpen, setModalSolicitudOpen] = useState(false);
  const [clienteParaSolicitud, setClienteParaSolicitud] = useState(null);
  const [solicitudData, setSolicitudData] = useState({
    limite_credito_pen_solicitado: 0,
    limite_credito_usd_solicitado: 0,
    limite_credito_pen_actual: 0,
    limite_credito_usd_actual: 0,
    justificacion: ''
  });

  const [formData, setFormData] = useState({
    tipo_documento: 'RUC', 
    ruc: '',
    razon_social: '',
    contacto: '',
    telefono: '',
    email: '',
    direccion_despacho: '',
    limite_credito_pen: 0,
    limite_credito_usd: 0,
    usar_limite_credito: false,
    validar_documento: true, 
    estado: 'Activo'
  });

  useEffect(() => {
    cargarClientes();
  }, []);

  const cargarClientes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await clientesAPI.getAll();
      setClientes(response.data.data);
    } catch (err) {
      setError(err.error || 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (cliente = null) => {
    if (cliente) {
      setEditando(cliente);
      setFormData({
        tipo_documento: cliente.tipo_documento || 'RUC',
        ruc: cliente.ruc,
        razon_social: cliente.razon_social,
        contacto: cliente.contacto || '',
        telefono: cliente.telefono || '',
        email: cliente.email || '',
        direccion_despacho: cliente.direccion_despacho || '',
        limite_credito_pen: parseFloat(cliente.limite_credito_pen || 0),
        limite_credito_usd: parseFloat(cliente.limite_credito_usd || 0),
        usar_limite_credito: cliente.usar_limite_credito === 1 || cliente.usar_limite_credito === true,
        validar_documento: false,
        estado: cliente.estado
      });
      setDocumentoValidado(null);
      setDatosAPI(null);
    } else {
      setEditando(null);
      setFormData({
        tipo_documento: 'RUC',
        ruc: '',
        razon_social: '',
        contacto: '',
        telefono: '',
        email: '',
        direccion_despacho: '',
        limite_credito_pen: 0,
        limite_credito_usd: 0,
        usar_limite_credito: false,
        validar_documento: true,
        estado: 'Activo'
      });
      setDocumentoValidado(null);
      setDatosAPI(null);
    }
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
    setDocumentoValidado(null);
    setDatosAPI(null);
  };

  const abrirModalSolicitudCredito = (cliente) => {
    if (cliente.tiene_solicitud_pendiente) {
      setError(`El cliente ${cliente.razon_social} ya tiene una solicitud en proceso.`);
      return;
    }

    setClienteParaSolicitud(cliente);
    setSolicitudData({
      limite_credito_pen_solicitado: parseFloat(cliente.limite_credito_pen || 0),
      limite_credito_usd_solicitado: parseFloat(cliente.limite_credito_usd || 0),
      limite_credito_pen_actual: parseFloat(cliente.limite_credito_pen || 0),
      limite_credito_usd_actual: parseFloat(cliente.limite_credito_usd || 0),
      justificacion: ''
    });
    setModalSolicitudOpen(true);
  };

  const handleSubmitSolicitud = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const dataToSend = {
        id_cliente: clienteParaSolicitud.id_cliente,
        limite_credito_pen_solicitado: parseFloat(solicitudData.limite_credito_pen_solicitado),
        limite_credito_usd_solicitado: parseFloat(solicitudData.limite_credito_usd_solicitado),
        limite_credito_pen_actual: parseFloat(solicitudData.limite_credito_pen_actual),
        limite_credito_usd_actual: parseFloat(solicitudData.limite_credito_usd_actual),
        usar_limite_credito: true,
        justificacion: solicitudData.justificacion
      };
      await solicitudesCreditoAPI.create(dataToSend);
      setSuccess('Solicitud de crédito enviada exitosamente. Pendiente de aprobación.');
      setModalSolicitudOpen(false);
      setClienteParaSolicitud(null);
      cerrarModal();
      cargarClientes();
    } catch (err) {
      setError(err.error || 'Error al enviar solicitud de crédito');
    }
  };

  const validarDocumento = async () => {
    const documento = formData.ruc.trim();
    const tipo = formData.tipo_documento;
    if (!documento) {
      setError(`Ingrese un ${tipo} para validar`);
      return;
    }
    if (tipo === 'RUC' && !/^\d{11}$/.test(documento)) {
      setError('El RUC debe tener 11 dígitos');
      return;
    }
    if (tipo === 'DNI' && !/^\d{8}$/.test(documento)) {
      setError('El DNI debe tener 8 dígitos');
      return;
    }
    try {
      setValidandoDocumento(true);
      setError(null);
      const response = tipo === 'RUC' 
        ? await clientesAPI.validarRUC(documento)
        : await clientesAPI.validarDNI(documento);
      if (response.data.valido) {
        setDocumentoValidado(true);
        setDatosAPI(response.data.datos);
        const nuevosValores = { ...formData };
        if (!formData.razon_social) {
          nuevosValores.razon_social = response.data.datos.razon_social || response.data.datos.nombre_completo;
        }
        if (tipo === 'RUC' && !formData.direccion_despacho && response.data.datos.direccion) {
          const direccionCompleta = [
            response.data.datos.direccion,
            response.data.datos.distrito,
            response.data.datos.provincia,
            response.data.datos.departamento
          ].filter(Boolean).join(', ');
          nuevosValores.direccion_despacho = direccionCompleta;
        }
        setFormData(nuevosValores);
        if (response.data.ya_registrado) {
          setError(`Este ${tipo} ya está registrado: ${response.data.cliente_existente.razon_social}`);
        } else {
          setSuccess(`${tipo} validado correctamente con ${tipo === 'RUC' ? 'SUNAT' : 'RENIEC'}`);
        }
      } else {
        setDocumentoValidado(false);
        setDatosAPI(null);
        setError(response.data.error || `${tipo} no válido`);
      }
    } catch (err) {
      setDocumentoValidado(false);
      setDatosAPI(null);
      setError(err.error || `Error al validar ${tipo}`);
    } finally {
      setValidandoDocumento(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const dataToSend = {
      ...formData,
      usar_limite_credito: formData.usar_limite_credito ? 1 : 0
    };

    // ✅ CORRECCIÓN CRÍTICA PARA EL FLUJO DE SOLICITUDES:
    // Si estamos editando, NO usamos los valores del formulario para el crédito (porque están deshabilitados o podrían estar mal).
    // Usamos los valores ORIGINALES que tiene el objeto 'editando' (que viene de la BD).
    // Esto asegura que al guardar cambios de nombre/teléfono, el crédito NO se resetee a 0.
    if (editando) {
      dataToSend.limite_credito_pen = parseFloat(editando.limite_credito_pen || 0);
      dataToSend.limite_credito_usd = parseFloat(editando.limite_credito_usd || 0);
    } else {
      // Si es nuevo cliente, usamos lo del formulario
      dataToSend.limite_credito_pen = parseFloat(formData.limite_credito_pen || 0);
      dataToSend.limite_credito_usd = parseFloat(formData.limite_credito_usd || 0);
    }

    try {
      if (editando) {
        await clientesAPI.update(editando.id_cliente, dataToSend);
        setSuccess('Cliente actualizado exitosamente');
      } else {
        await clientesAPI.create(dataToSend);
        setSuccess('Cliente creado exitosamente');
      }
      cerrarModal();
      cargarClientes();
    } catch (err) {
      setError(err.error || 'Error al guardar cliente');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de desactivar este cliente?')) return;
    try {
      setError(null);
      await clientesAPI.delete(id);
      setSuccess('Cliente desactivado exitosamente');
      cargarClientes();
    } catch (err) {
      setError(err.error || 'Error al desactivar cliente');
    }
  };

  const handleTipoDocumentoChange = (nuevoTipo) => {
    setFormData({ ...formData, tipo_documento: nuevoTipo, ruc: '' });
    setDocumentoValidado(null);
    setDatosAPI(null);
  };

  const clientesFiltrados = clientes.filter(c =>
    c.razon_social.toLowerCase().includes(filtro.toLowerCase()) ||
    c.ruc.includes(filtro)
  );

  const columns = [
    { 
      header: 'Tipo',
      accessor: 'tipo_documento',
      width: '70px',
      align: 'center',
      render: (value) => (
        <span className={`badge ${value === 'DNI' ? 'badge-info' : 'badge-primary'}`}>
          {value || 'RUC'}
        </span>
      )
    },
    { 
      header: 'Documento', 
      accessor: 'ruc', 
      width: '120px',
      render: (value, row) => (
        <div>
          <div className="font-mono font-bold">{value}</div>
          <div className="text-xs text-muted">{row.tipo_documento || 'RUC'}</div>
        </div>
      )
    },
    { header: 'Razón Social / Nombre', accessor: 'razon_social' },
    { header: 'Contacto', accessor: 'contacto' },
    { header: 'Teléfono', accessor: 'telefono' },
    { 
      header: 'Límite Crédito', 
      width: '140px',
      render: (_, row) => (
        row.usar_limite_credito === 1 || row.usar_limite_credito === true ? (
          <div className="text-sm">
            <div className="text-success font-medium">S/ {parseFloat(row.limite_credito_pen).toFixed(2)}</div>
            <div className="text-primary font-medium">$ {parseFloat(row.limite_credito_usd).toFixed(2)}</div>
            {row.tiene_solicitud_pendiente && (
              <div className="mt-1 text-xs badge badge-warning w-full text-center">
                Solicitud Pendiente
              </div>
            )}
          </div>
        ) : (
          <span className="badge badge-secondary">Sin Límite</span>
        )
      )
    },
    {
      header: 'Estado',
      accessor: 'estado',
      width: '100px',
      align: 'center',
      render: (value) => (
        <span className={`badge ${value === 'Activo' ? 'badge-success' : 'badge-secondary'}`}>
          {value}
        </span>
      )
    },
    {
      header: 'Acciones',
      accessor: 'id_cliente',
      width: '160px',
      align: 'center',
      render: (value, row) => (
        <div className="flex gap-2 justify-center">
          <button className="btn btn-sm btn-primary" onClick={() => navigate(`/clientes/${value}`)} title="Ver historial">
            <Eye size={14} />
          </button>
          <button className="btn btn-sm btn-outline" onClick={() => abrirModal(row)} title="Editar">
            <Edit size={14} />
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(value)} title="Desactivar" disabled={row.estado === 'Inactivo'}>
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  if (loading) return <Loading message="Cargando clientes..." />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="card-title">Clientes</h1>
          <p className="text-muted">Gestión de clientes (Empresas y Personas Naturales)</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirModal()}>
          <Plus size={20} /> Nuevo Cliente
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="card mb-3">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input type="text" className="form-input" placeholder="Buscar por razón social, nombre o documento..." value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ paddingLeft: '2.5rem' }} />
          </div>
        </div>
      </div>

      <Table columns={columns} data={clientesFiltrados} emptyMessage="No se encontraron clientes" />

      <Modal isOpen={modalOpen} onClose={cerrarModal} title={editando ? 'Editar Cliente' : 'Nuevo Cliente'} size="lg">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tipo de Documento *</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className={`btn ${formData.tipo_documento === 'RUC' ? 'btn-primary' : 'btn-outline'}`} onClick={() => handleTipoDocumentoChange('RUC')} disabled={editando}>
                <Building2 size={18} className="mr-2" /> Empresa (RUC)
              </button>
              <button type="button" className={`btn ${formData.tipo_documento === 'DNI' ? 'btn-info' : 'btn-outline'}`} onClick={() => handleTipoDocumentoChange('DNI')} disabled={editando}>
                <User size={18} className="mr-2" /> Persona Natural (DNI)
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{formData.tipo_documento === 'RUC' ? 'RUC' : 'DNI'} *</label>
            <div className="flex gap-2">
              <input type="text" className="form-input" value={formData.ruc} onChange={(e) => { setFormData({ ...formData, ruc: e.target.value }); setDocumentoValidado(null); }} required maxLength={formData.tipo_documento === 'RUC' ? 11 : 8} style={{ flex: 1 }} />
              <button type="button" className="btn btn-outline" onClick={validarDocumento} disabled={validandoDocumento || !formData.ruc} style={{ minWidth: '140px' }}>
                {validandoDocumento ? <><Loader size={16} className="animate-spin" /> Validando...</> : <>{formData.tipo_documento === 'RUC' ? <Building2 size={16} /> : <User size={16} />} Validar {formData.tipo_documento}</>}
              </button>
            </div>
            {documentoValidado === true && <div className="mt-2 flex items-center gap-2 text-sm text-success"><CheckCircle size={16} /> Validado correctamente</div>}
            {documentoValidado === false && <div className="mt-2 flex items-center gap-2 text-sm text-danger"><AlertCircle size={16} /> No válido</div>}
          </div>

          <div className="form-group">
            <label className="form-label">{formData.tipo_documento === 'RUC' ? 'Razón Social' : 'Nombre Completo'} *</label>
            <input type="text" className="form-input" value={formData.razon_social} onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Contacto</label>
              <input type="text" className="form-input" value={formData.contacto} onChange={(e) => setFormData({ ...formData, contacto: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input type="text" className="form-input" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="form-label">Dirección Principal</label>
            <textarea 
              className="form-textarea" 
              value={formData.direccion_despacho} 
              onChange={(e) => setFormData({ ...formData, direccion_despacho: e.target.value })} 
              rows={3} 
              placeholder="Dirección principal de entrega"
            />
            <small className="text-muted">Las direcciones adicionales se pueden gestionar desde el detalle del cliente.</small>
          </div>

          <div className="card bg-gray-50 border p-4 mb-4">
            <div className="form-group mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.usar_limite_credito} 
                  onChange={(e) => setFormData({ ...formData, usar_limite_credito: e.target.checked })} 
                  className="form-checkbox" 
                  style={{ width: '18px', height: '18px' }}
                  // IMPORTANTE: Si estamos editando, NO permitimos cambiar el check para evitar inconsistencias
                  // El usuario debe usar "Solicitar Cambio de Límite" para activar/desactivar y cambiar montos.
                  disabled={!!editando} 
                />
                <CreditCard size={18} className="text-primary" />
                <span className="font-medium">Usar límite de crédito</span>
              </label>
              <p className="text-xs text-muted mt-1 ml-6">{formData.usar_limite_credito ? 'El cliente tiene límites de crédito definidos' : 'El cliente puede realizar compras sin límite de crédito'}</p>
            </div>

            {formData.usar_limite_credito && (
              <div className="pt-3 border-t">
                {editando ? (
                  <div className="space-y-3">
                    <div className="card bg-blue-50">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle size={16} className="text-info" />
                        <p className="text-sm font-medium text-info">Límites Actuales (Solo lectura)</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted">Límite en Soles</p>
                          <p className="text-lg font-bold text-success">S/ {parseFloat(formData.limite_credito_pen || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted">Límite en Dólares</p>
                          <p className="text-lg font-bold text-primary">$ {parseFloat(formData.limite_credito_usd || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      className={`btn btn-block ${editando.tiene_solicitud_pendiente ? 'btn-disabled opacity-50' : 'btn-outline'}`}
                      onClick={() => abrirModalSolicitudCredito(editando)}
                      disabled={editando.tiene_solicitud_pendiente}
                    >
                      <CreditCard size={16} /> {editando.tiene_solicitud_pendiente ? 'Solicitud en Proceso' : 'Solicitar Cambio de Límite'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group mb-0">
                      <label className="form-label">Límite en Soles (S/)</label>
                      <input type="number" className="form-input" value={formData.limite_credito_pen} onChange={(e) => setFormData({ ...formData, limite_credito_pen: e.target.value })} min="0" step="0.01" placeholder="0.00" />
                    </div>
                    <div className="form-group mb-0">
                      <label className="form-label">Límite en Dólares ($)</label>
                      <input type="number" className="form-input" value={formData.limite_credito_usd} onChange={(e) => setFormData({ ...formData, limite_credito_usd: e.target.value })} min="0" step="0.01" placeholder="0.00" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Estado *</label>
            <select className="form-select" value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value })} required>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{editando ? 'Actualizar' : 'Crear'} Cliente</button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={modalSolicitudOpen} 
        onClose={() => setModalSolicitudOpen(false)} 
        title="Solicitar Cambio de Límite de Crédito"
      >
        {clienteParaSolicitud && (
          <form onSubmit={handleSubmitSolicitud}>
            <div className="mb-4">
              <div className="card bg-gray-50">
                <h3 className="font-medium mb-2">{clienteParaSolicitud.razon_social}</h3>
                <p className="text-sm text-muted">RUC: {clienteParaSolicitud.ruc}</p>
              </div>
            </div>
            <div className="mb-4">
              <h4 className="font-medium mb-2">Límites Actuales</h4>
              <div className="grid grid-cols-2 gap-3 card bg-gray-50">
                <div>
                  <p className="text-xs text-muted">Soles</p>
                  <p className="font-bold">S/ {parseFloat(clienteParaSolicitud.limite_credito_pen || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Dólares</p>
                  <p className="font-bold">$ {parseFloat(clienteParaSolicitud.limite_credito_usd || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <h4 className="font-medium mb-2">Nuevos Límites Solicitados</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Límite en Soles (S/) *</label>
                  <input type="number" className="form-input" value={solicitudData.limite_credito_pen_solicitado} onChange={(e) => setSolicitudData({ ...solicitudData, limite_credito_pen_solicitado: e.target.value })} min="0" step="0.01" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Límite en Dólares ($) *</label>
                  <input type="number" className="form-input" value={solicitudData.limite_credito_usd_solicitado} onChange={(e) => setSolicitudData({ ...solicitudData, limite_credito_usd_solicitado: e.target.value })} min="0" step="0.01" required />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Justificación *</label>
              <textarea className="form-textarea" value={solicitudData.justificacion} onChange={(e) => setSolicitudData({ ...solicitudData, justificacion: e.target.value })} rows={4} placeholder="Explique por qué se necesita este cambio de límite..." required />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" className="btn btn-outline" onClick={() => setModalSolicitudOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Enviar Solicitud</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default Clientes;