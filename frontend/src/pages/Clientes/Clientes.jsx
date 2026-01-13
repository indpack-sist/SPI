import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, CheckCircle, AlertCircle, Loader, Building2, Eye, User, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clientesAPI } from '../../config/api';
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

  const [formData, setFormData] = useState({
    tipo_documento: 'RUC', // NUEVO: 'RUC' o 'DNI'
    ruc: '',
    razon_social: '',
    contacto: '',
    telefono: '',
    email: '',
    direccion_despacho: '',
    limite_credito_pen: 0,
    limite_credito_usd: 0,
    validar_documento: true, // NUEVO: reemplaza validar_ruc
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
        limite_credito_pen: cliente.limite_credito_pen || 0,
        limite_credito_usd: cliente.limite_credito_usd || 0,
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

  // ============================================
  // NUEVA FUNCIÓN: Validar documento (RUC o DNI)
  // ============================================
  const validarDocumento = async () => {
    const documento = formData.ruc.trim();
    const tipo = formData.tipo_documento;
    
    if (!documento) {
      setError(`Ingrese un ${tipo} para validar`);
      return;
    }

    // Validar formato según tipo
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
      
      // Llamar a la API correspondiente
      const response = tipo === 'RUC' 
        ? await clientesAPI.validarRUC(documento)
        : await clientesAPI.validarDNI(documento);
      
      if (response.data.valido) {
        setDocumentoValidado(true);
        setDatosAPI(response.data.datos);
        
        const nuevosValores = { ...formData };
        
        // Autocompletar razón social / nombre
        if (!formData.razon_social) {
          nuevosValores.razon_social = response.data.datos.razon_social;
        }
        
        // Autocompletar dirección (solo para RUC)
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
        
        // Advertencia de estado (solo para RUC)
        if (tipo === 'RUC' && response.data.datos.estado !== 'ACTIVO') {
          setError(`Advertencia: Este RUC está en estado ${response.data.datos.estado} en SUNAT`);
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

    try {
      if (editando) {
        await clientesAPI.update(editando.id_cliente, formData);
        setSuccess('Cliente actualizado exitosamente');
      } else {
        await clientesAPI.create(formData);
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

  // ============================================
  // NUEVA FUNCIÓN: Manejar cambio de tipo de documento
  // ============================================
  const handleTipoDocumentoChange = (nuevoTipo) => {
    setFormData({
      ...formData,
      tipo_documento: nuevoTipo,
      ruc: '' // Limpiar el campo al cambiar tipo
    });
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
      header: 'Dirección', 
      accessor: 'direccion_despacho',
      render: (value) => value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : '-'
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
          <button
            className="btn btn-sm btn-primary"
            onClick={() => navigate(`/clientes/${value}`)}
            title="Ver historial"
          >
            <Eye size={14} />
          </button>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => abrirModal(row)}
            title="Editar"
          >
            <Edit size={14} />
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => handleDelete(value)}
            title="Desactivar"
            disabled={row.estado === 'Inactivo'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  if (loading) {
    return <Loading message="Cargando clientes..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="card-title">Clientes</h1>
          <p className="text-muted">Gestión de clientes (Empresas y Personas Naturales)</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirModal()}>
          <Plus size={20} />
          Nuevo Cliente
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="card mb-3">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search 
              size={20} 
              style={{ 
                position: 'absolute', 
                left: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)'
              }} 
            />
            <input
              type="text"
              className="form-input"
              placeholder="Buscar por razón social, nombre o documento..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>
      </div>

      <Table
        columns={columns}
        data={clientesFiltrados}
        emptyMessage="No se encontraron clientes"
      />

      <Modal
        isOpen={modalOpen}
        onClose={cerrarModal}
        title={editando ? 'Editar Cliente' : 'Nuevo Cliente'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          
          {/* SELECTOR DE TIPO DE DOCUMENTO */}
          <div className="form-group">
            <label className="form-label">Tipo de Documento *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={`btn ${formData.tipo_documento === 'RUC' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => handleTipoDocumentoChange('RUC')}
                disabled={editando} // No permitir cambio en edición
              >
                <Building2 size={18} className="mr-2" />
                Empresa (RUC)
              </button>
              <button
                type="button"
                className={`btn ${formData.tipo_documento === 'DNI' ? 'btn-info' : 'btn-outline'}`}
                onClick={() => handleTipoDocumentoChange('DNI')}
                disabled={editando} // No permitir cambio en edición
              >
                <User size={18} className="mr-2" />
                Persona Natural (DNI)
              </button>
            </div>
          </div>

          {/* CAMPO DE DOCUMENTO */}
          <div className="form-group">
            <label className="form-label">
              {formData.tipo_documento === 'RUC' ? 'RUC' : 'DNI'} *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="form-input"
                value={formData.ruc}
                onChange={(e) => {
                  setFormData({ ...formData, ruc: e.target.value });
                  setDocumentoValidado(null);
                  setDatosAPI(null);
                }}
                required
                maxLength={formData.tipo_documento === 'RUC' ? 11 : 8}
                placeholder={formData.tipo_documento === 'RUC' ? '20612345678' : '12345678'}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-outline"
                onClick={validarDocumento}
                disabled={validandoDocumento || !formData.ruc}
                style={{ minWidth: '140px' }}
              >
                {validandoDocumento ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    {formData.tipo_documento === 'RUC' ? <Building2 size={16} /> : <User size={16} />}
                    Validar {formData.tipo_documento}
                  </>
                )}
              </button>
            </div>
            
            {documentoValidado === true && (
              <div className="mt-2 flex items-center gap-2 text-sm text-success">
                <CheckCircle size={16} />
                {formData.tipo_documento} validado con {formData.tipo_documento === 'RUC' ? 'SUNAT' : 'RENIEC'}
              </div>
            )}
            
            {documentoValidado === false && (
              <div className="mt-2 flex items-center gap-2 text-sm text-danger">
                <AlertCircle size={16} />
                {formData.tipo_documento} no válido
              </div>
            )}
          </div>

          {/* DATOS DE LA API */}
          {datosAPI && (
            <div className="alert alert-info mb-3">
              <strong>Datos de {formData.tipo_documento === 'RUC' ? 'SUNAT' : 'RENIEC'}:</strong>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                {formData.tipo_documento === 'RUC' ? (
                  <>
                    <div><strong>Razón Social:</strong> {datosAPI.razon_social}</div>
                    <div>
                      <strong>Estado:</strong>{' '}
                      <span className={`badge ${datosAPI.estado === 'ACTIVO' ? 'badge-success' : 'badge-warning'}`}>
                        {datosAPI.estado}
                      </span>
                    </div>
                    <div><strong>Condición:</strong> {datosAPI.condicion}</div>
                    {datosAPI.direccion && <div className="col-span-2"><strong>Dirección:</strong> {datosAPI.direccion}</div>}
                    {datosAPI.actividad_economica && (
                      <div className="col-span-2"><strong>Actividad:</strong> {datosAPI.actividad_economica}</div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="col-span-2"><strong>Nombre:</strong> {datosAPI.razon_social || datosAPI.nombre_completo}</div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* RAZÓN SOCIAL / NOMBRE */}
          <div className="form-group">
            <label className="form-label">
              {formData.tipo_documento === 'RUC' ? 'Razón Social' : 'Nombre Completo'} *
            </label>
            <input
              type="text"
              className="form-input"
              value={formData.razon_social}
              onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
              required
              placeholder={formData.tipo_documento === 'RUC' ? 'Cliente S.A.' : 'Juan Pérez García'}
            />
            {datosAPI && (
              <small className="text-muted">
                Autocompletado desde {formData.tipo_documento === 'RUC' ? 'SUNAT' : 'RENIEC'}. Puede modificarlo si es necesario.
              </small>
            )}
          </div>

          {/* CONTACTO Y TELÉFONO */}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Contacto</label>
              <input
                type="text"
                className="form-input"
                value={formData.contacto}
                onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                placeholder="Nombre del contacto"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                type="text"
                className="form-input"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                placeholder="987654321"
              />
            </div>
          </div>

          {/* EMAIL */}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contacto@cliente.com"
            />
          </div>

          {/* DIRECCIÓN */}
          <div className="form-group">
            <label className="form-label">Dirección de Despacho</label>
            <textarea
              className="form-textarea"
              value={formData.direccion_despacho}
              onChange={(e) => setFormData({ ...formData, direccion_despacho: e.target.value })}
              placeholder="Av. Principal 123, Lima"
              rows={3}
            />
            {datosAPI && formData.tipo_documento === 'RUC' && datosAPI.direccion && (
              <small className="text-muted">
                Dirección fiscal de SUNAT autocompletada. Puede modificarla para el despacho.
              </small>
            )}
          </div>

          {/* LÍMITES DE CRÉDITO */}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Límite Crédito (S/)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">S/</span>
                <input
                  type="number"
                  className="form-input pl-10"
                  value={formData.limite_credito_pen}
                  onChange={(e) => setFormData({ ...formData, limite_credito_pen: e.target.value })}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Límite Crédito ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                <input
                  type="number"
                  className="form-input pl-10"
                  value={formData.limite_credito_usd}
                  onChange={(e) => setFormData({ ...formData, limite_credito_usd: e.target.value })}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* ESTADO */}
          <div className="form-group">
            <label className="form-label">Estado *</label>
            <select
              className="form-select"
              value={formData.estado}
              onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
              required
            >
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
          </div>

          {/* BOTONES */}
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editando ? 'Actualizar' : 'Crear'} Cliente
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Clientes;