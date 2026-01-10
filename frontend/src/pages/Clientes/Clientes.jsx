import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, CheckCircle, AlertCircle, Loader, Building2, Eye } from 'lucide-react';
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

  const [validandoRUC, setValidandoRUC] = useState(false);
  const [rucValidado, setRucValidado] = useState(null);
  const [datosSUNAT, setDatosSUNAT] = useState(null);

  const [formData, setFormData] = useState({
    ruc: '',
    razon_social: '',
    contacto: '',
    telefono: '',
    email: '',
    direccion_despacho: '',
    validar_ruc: true,
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
        ruc: cliente.ruc,
        razon_social: cliente.razon_social,
        contacto: cliente.contacto || '',
        telefono: cliente.telefono || '',
        email: cliente.email || '',
        direccion_despacho: cliente.direccion_despacho || '',
        validar_ruc: false,
        estado: cliente.estado
      });
      setRucValidado(null);
      setDatosSUNAT(null);
    } else {
      setEditando(null);
      setFormData({
        ruc: '',
        razon_social: '',
        contacto: '',
        telefono: '',
        email: '',
        direccion_despacho: '',
        validar_ruc: true,
        estado: 'Activo'
      });
      setRucValidado(null);
      setDatosSUNAT(null);
    }
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
    setRucValidado(null);
    setDatosSUNAT(null);
  };

  const validarRUC = async () => {
    const ruc = formData.ruc.trim();
    
    if (!ruc) {
      setError('Ingrese un RUC para validar');
      return;
    }

    if (!/^\d{11}$/.test(ruc)) {
      setError('El RUC debe tener 11 dígitos');
      return;
    }

    try {
      setValidandoRUC(true);
      setError(null);
      
      const response = await clientesAPI.validarRUC(ruc);
      
      if (response.data.valido) {
        setRucValidado(true);
        setDatosSUNAT(response.data.datos);
        
        const nuevosValores = { ...formData };
        
        if (!formData.razon_social) {
          nuevosValores.razon_social = response.data.datos.razon_social;
        }
        
        if (!formData.direccion_despacho && response.data.datos.direccion) {
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
          setError(`Este RUC ya está registrado: ${response.data.cliente_existente.razon_social}`);
        } else {
          setSuccess('RUC validado correctamente con SUNAT');
        }
        
        if (response.data.datos.estado !== 'ACTIVO') {
          setError(`Advertencia: Este RUC está en estado ${response.data.datos.estado} en SUNAT`);
        }
      } else {
        setRucValidado(false);
        setDatosSUNAT(null);
        setError(response.data.error || 'RUC no válido');
      }
    } catch (err) {
      setRucValidado(false);
      setDatosSUNAT(null);
      setError(err.error || 'Error al validar RUC');
    } finally {
      setValidandoRUC(false);
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

  const clientesFiltrados = clientes.filter(c =>
    c.razon_social.toLowerCase().includes(filtro.toLowerCase()) ||
    c.ruc.includes(filtro)
  );

  const columns = [
    { header: 'RUC', accessor: 'ruc', width: '120px' },
    { header: 'Razón Social', accessor: 'razon_social' },
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
          <p className="text-muted">Gestión de clientes</p>
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
              placeholder="Buscar por razón social o RUC..."
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
          <div className="form-group">
            <label className="form-label">RUC *</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="form-input"
                value={formData.ruc}
                onChange={(e) => {
                  setFormData({ ...formData, ruc: e.target.value });
                  setRucValidado(null);
                  setDatosSUNAT(null);
                }}
                required
                maxLength={11}
                placeholder="20612345678"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-outline"
                onClick={validarRUC}
                disabled={validandoRUC || !formData.ruc}
                style={{ minWidth: '120px' }}
              >
                {validandoRUC ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <Building2 size={16} />
                    Validar RUC
                  </>
                )}
              </button>
            </div>
            
            {rucValidado === true && (
              <div className="mt-2 flex items-center gap-2 text-sm text-success">
                <CheckCircle size={16} />
                RUC validado con SUNAT
              </div>
            )}
            
            {rucValidado === false && (
              <div className="mt-2 flex items-center gap-2 text-sm text-danger">
                <AlertCircle size={16} />
                RUC no válido
              </div>
            )}
          </div>

          {datosSUNAT && (
            <div className="alert alert-info mb-3">
              <strong>Datos de SUNAT:</strong>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><strong>Razón Social:</strong> {datosSUNAT.razon_social}</div>
                <div><strong>Estado:</strong> <span className={`badge ${datosSUNAT.estado === 'ACTIVO' ? 'badge-success' : 'badge-warning'}`}>{datosSUNAT.estado}</span></div>
                <div><strong>Condición:</strong> {datosSUNAT.condicion}</div>
                {datosSUNAT.direccion && <div className="col-span-2"><strong>Dirección:</strong> {datosSUNAT.direccion}</div>}
                {datosSUNAT.actividad_economica && <div className="col-span-2"><strong>Actividad:</strong> {datosSUNAT.actividad_economica}</div>}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Razón Social *</label>
            <input
              type="text"
              className="form-input"
              value={formData.razon_social}
              onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
              required
              placeholder="Cliente S.A."
            />
            {datosSUNAT && (
              <small className="text-muted">
                Autocompletado desde SUNAT. Puede modificarlo si es necesario.
              </small>
            )}
          </div>

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
                placeholder="01-1234567"
              />
            </div>
          </div>

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

          <div className="form-group">
            <label className="form-label">Dirección de Despacho</label>
            <textarea
              className="form-textarea"
              value={formData.direccion_despacho}
              onChange={(e) => setFormData({ ...formData, direccion_despacho: e.target.value })}
              placeholder="Av. Principal 123, Lima"
              rows={3}
            />
            {datosSUNAT && datosSUNAT.direccion && (
              <small className="text-muted">
                Dirección fiscal de SUNAT autocompletada. Puede modificarla para el despacho.
              </small>
            )}
          </div>

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