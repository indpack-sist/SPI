import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, CheckCircle, AlertCircle, Loader, Building2 } from 'lucide-react';
import { proveedoresAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
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
    terminos_pago: '',
    validar_ruc: true,
    estado: 'Activo'
  });

  useEffect(() => {
    cargarProveedores();
  }, []);

  const cargarProveedores = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await proveedoresAPI.getAll();
      setProveedores(response.data.data);
    } catch (err) {
      setError(err.error || 'Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (proveedor = null) => {
    if (proveedor) {
      setEditando(proveedor);
      setFormData({
        ruc: proveedor.ruc,
        razon_social: proveedor.razon_social,
        contacto: proveedor.contacto || '',
        telefono: proveedor.telefono || '',
        email: proveedor.email || '',
        terminos_pago: proveedor.terminos_pago || '',
        validar_ruc: false,
        estado: proveedor.estado
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
        terminos_pago: '',
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
      
      const response = await proveedoresAPI.validarRUC(ruc);
      
      if (response.data.valido) {
        setRucValidado(true);
        setDatosSUNAT(response.data.datos);
        
        if (!formData.razon_social) {
          setFormData({
            ...formData,
            razon_social: response.data.datos.razon_social
          });
        }
        
        if (response.data.ya_registrado) {
          setError(`Este RUC ya está registrado: ${response.data.proveedor_existente.razon_social}`);
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
        await proveedoresAPI.update(editando.id_proveedor, formData);
        setSuccess('Proveedor actualizado exitosamente');
      } else {
        await proveedoresAPI.create(formData);
        setSuccess('Proveedor creado exitosamente');
      }
      cerrarModal();
      cargarProveedores();
    } catch (err) {
      setError(err.error || 'Error al guardar proveedor');
    }
  };
  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de desactivar este proveedor?')) return;

    try {
      setError(null);
      await proveedoresAPI.delete(id);
      setSuccess('Proveedor desactivado exitosamente');
      cargarProveedores();
    } catch (err) {
      setError(err.error || 'Error al desactivar proveedor');
    }
  };
  const proveedoresFiltrados = proveedores.filter(p =>
    p.razon_social.toLowerCase().includes(filtro.toLowerCase()) ||
    p.ruc.includes(filtro)
  );

  const columns = [
    { header: 'RUC', accessor: 'ruc', width: '120px' },
    { header: 'Razón Social', accessor: 'razon_social' },
    { header: 'Contacto', accessor: 'contacto' },
    { header: 'Teléfono', accessor: 'telefono' },
    { header: 'Términos de Pago', accessor: 'terminos_pago' },
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
      accessor: 'id_proveedor',
      width: '120px',
      align: 'center',
      render: (value, row) => (
        <div className="flex gap-2 justify-center">
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
    return <Loading message="Cargando proveedores..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="card-title">Proveedores</h1>
          <p className="text-muted">Gestión de proveedores</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirModal()}>
          <Plus size={20} />
          Nuevo Proveedor
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
        data={proveedoresFiltrados}
        emptyMessage="No se encontraron proveedores"
      />

      <Modal
        isOpen={modalOpen}
        onClose={cerrarModal}
        title={editando ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          {/* Campo RUC con validación */}
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
                placeholder="20512345678"
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
            
            {/* Indicador de validación */}
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

          {/* Mostrar datos de SUNAT si están disponibles */}
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
              placeholder="Empresa S.A.C."
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
              placeholder="contacto@empresa.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Términos de Pago</label>
              <input
                type="text"
                className="form-input"
                value={formData.terminos_pago}
                onChange={(e) => setFormData({ ...formData, terminos_pago: e.target.value })}
                placeholder="Ej: 30 días"
              />
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
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editando ? 'Actualizar' : 'Crear'} Proveedor
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Proveedores;