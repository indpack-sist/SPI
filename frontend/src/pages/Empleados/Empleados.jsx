import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, CheckCircle, AlertCircle, Loader, Eye, EyeOff, Mail, Users, Lock, Unlock } from 'lucide-react';
import { empleadosAPI, clientesAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Pagination from '../../components/UI/Pagination';
import { usePagination } from '../../hooks/usePagination';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import AtencionesBadge from '../../components/UI/AtencionesBadge';

function Empleados() {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [validandoDNI, setValidandoDNI] = useState(false);
  const [validandoEmail, setValidandoEmail] = useState(false);
  const [dniValidado, setDniValidado] = useState(null);
  const [emailValidado, setEmailValidado] = useState(null);
  const [datosRENIEC, setDatosRENIEC] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Cartera de clientes asignados (roles Comercial / Ventas)
  const ROLES_CARTERA = ['Comercial', 'Ventas'];
  const [carteraModalOpen, setCarteraModalOpen] = useState(false);
  const [carteraEmpleado, setCarteraEmpleado] = useState(null);
  const [carteraRestringir, setCarteraRestringir] = useState(false);
  const [carteraIds, setCarteraIds] = useState([]);
  const [carteraAsignadosInfo, setCarteraAsignadosInfo] = useState([]);
  const [carteraClientes, setCarteraClientes] = useState([]);
  const [carteraSearch, setCarteraSearch] = useState('');
  const [carteraAtencion, setCarteraAtencion] = useState('todos');
  const [carteraLoading, setCarteraLoading] = useState(false);
  const [carteraSaving, setCarteraSaving] = useState(false);

  const [formData, setFormData] = useState({
    dni: '',
    nombre_completo: '',
    email: '',
    password: '',
    cargo: '',
    rol: 'Operario',
    validar_dni: true,
    estado: 'Activo'
  });

  useEffect(() => {
    cargarEmpleados();
  }, []);

  const cargarEmpleados = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await empleadosAPI.getAll();
      setEmpleados(response.data.data);
    } catch (err) {
      setError(err.error || 'Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (empleado = null) => {
    if (empleado) {
      setEditando(empleado);
      setFormData({
        dni: empleado.dni || '',
        nombre_completo: empleado.nombre_completo,
        email: empleado.email || '',
        password: '', 
        cargo: empleado.cargo || '',
        rol: empleado.rol,
        validar_dni: false,
        estado: empleado.estado
      });
      setDniValidado(null);
      setEmailValidado(null);
      setDatosRENIEC(null);
    } else {
      setEditando(null);
      setFormData({
        dni: '',
        nombre_completo: '',
        email: '',
        password: '',
        cargo: '',
        rol: 'Operario',
        validar_dni: true,
        estado: 'Activo'
      });
      setDniValidado(null);
      setEmailValidado(null);
      setDatosRENIEC(null);
    }
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
    setFormData({
      dni: '',
      nombre_completo: '',
      email: '',
      password: '',
      cargo: '',
      rol: 'Operario',
      validar_dni: true,
      estado: 'Activo'
    });
    setDniValidado(null);
    setEmailValidado(null);
    setDatosRENIEC(null);
    setShowPassword(false);
  };

  const validarDNI = async () => {
    const dni = formData.dni.trim();
    
    if (!dni) {
      setError('Ingrese un DNI para validar');
      return;
    }

    if (!/^\d{8}$/.test(dni)) {
      setError('El DNI debe tener 8 dígitos');
      return;
    }

    try {
      setValidandoDNI(true);
      setError(null);
      
      const response = await empleadosAPI.validarDNI(dni);
      
      if (response.data.valido) {
        setDniValidado(true);
        setDatosRENIEC(response.data.datos);
        
        if (!formData.nombre_completo) {
          setFormData({
            ...formData,
            nombre_completo: response.data.datos.nombre_completo
          });
        }
        
        if (response.data.ya_registrado) {
          setError(`Este DNI ya está registrado para: ${response.data.empleado_existente.nombre_completo}`);
        } else {
          setSuccess('DNI validado correctamente con RENIEC');
        }
      } else {
        setDniValidado(false);
        setDatosRENIEC(null);
        setError(response.data.error || 'DNI no válido');
      }
    } catch (err) {
      setDniValidado(false);
      setDatosRENIEC(null);
      setError(err.error || 'Error al validar DNI');
    } finally {
      setValidandoDNI(false);
    }
  };

  const validarEmail = async () => {
    const email = formData.email.trim();
    
    if (!email) {
      setError('Ingrese un email para validar');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Formato de email inválido');
      return;
    }

    try {
      setValidandoEmail(true);
      setError(null);
      
      const response = await empleadosAPI.validarEmail(email);
      
      if (response.data.disponible) {
        setEmailValidado(true);
        setSuccess('Email disponible');
      } else {
        setEmailValidado(false);
        setError(`Este email ya está registrado para: ${response.data.empleado_existente.nombre_completo}`);
      }
    } catch (err) {
      setEmailValidado(false);
      setError(err.error || 'Error al validar email');
    } finally {
      setValidandoEmail(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!editando && !formData.password) {
      setError('La contraseña es requerida para nuevos empleados');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      if (editando) {
        await empleadosAPI.update(editando.id_empleado, formData);
        setSuccess('Empleado actualizado exitosamente');
      } else {
        await empleadosAPI.create(formData);
        setSuccess('Empleado creado exitosamente');
      }
      cerrarModal();
      cargarEmpleados();
    } catch (err) {
      setError(err.error || 'Error al guardar empleado');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de desactivar este empleado?')) return;

    try {
      setError(null);
      await empleadosAPI.delete(id);
      setSuccess('Empleado desactivado exitosamente');
      cargarEmpleados();
    } catch (err) {
      setError(err.error || 'Error al desactivar empleado');
    }
  };

  const abrirCartera = async (empleado) => {
    setCarteraEmpleado(empleado);
    setCarteraModalOpen(true);
    setCarteraSearch('');
    setCarteraAtencion('todos');
    setError(null);
    setCarteraLoading(true);
    try {
      const res = await empleadosAPI.getClientesAsignados(empleado.id_empleado);
      const data = res.data.data;
      setCarteraRestringir(data.restringir_clientes);
      setCarteraIds(data.ids || []);
      setCarteraAsignadosInfo(data.clientes || []);
    } catch (err) {
      setError(err.error || 'Error al cargar la cartera');
      setCarteraRestringir(false);
      setCarteraIds([]);
      setCarteraAsignadosInfo([]);
    } finally {
      setCarteraLoading(false);
    }
  };

  const cerrarCartera = () => {
    setCarteraModalOpen(false);
    setCarteraEmpleado(null);
    setCarteraClientes([]);
    setCarteraIds([]);
    setCarteraAsignadosInfo([]);
  };

  const cargarClientesCartera = async () => {
    try {
      const params = {};
      if (carteraSearch.trim()) params.search = carteraSearch.trim();
      if (carteraAtencion === 'con') params.atencion = 'con';
      else if (carteraAtencion === 'sin') params.atencion = 'sin';
      const res = await clientesAPI.getAll(params);
      setCarteraClientes(res.data.data || []);
    } catch (err) {
      setError(err.error || 'Error al cargar clientes');
    }
  };

  useEffect(() => {
    if (!carteraModalOpen || !carteraRestringir) return;
    const t = setTimeout(cargarClientesCartera, 300);
    return () => clearTimeout(t);
  }, [carteraModalOpen, carteraRestringir, carteraSearch, carteraAtencion]);

  const toggleClienteCartera = (idCliente) => {
    setCarteraIds(prev =>
      prev.includes(idCliente) ? prev.filter(id => id !== idCliente) : [...prev, idCliente]
    );
  };

  const guardarCartera = async () => {
    if (!carteraEmpleado) return;
    setCarteraSaving(true);
    setError(null);
    try {
      await empleadosAPI.updateClientesAsignados(carteraEmpleado.id_empleado, {
        restringir_clientes: carteraRestringir,
        // Se conserva la cartera aunque el interruptor este apagado (solo desactiva el enforcement).
        ids: carteraIds
      });
      setSuccess(`Cartera de ${carteraEmpleado.nombre_completo} actualizada exitosamente`);
      cerrarCartera();
      cargarEmpleados();
    } catch (err) {
      setError(err.error || 'Error al guardar la cartera');
    } finally {
      setCarteraSaving(false);
    }
  };

  // Lista del modal de cartera: los clientes ya asignados siempre aparecen primero
  // (respetando la busqueda de texto, ignorando el filtro de atencion) para poder quitarlos.
  const carteraListaMostrada = (() => {
    const search = carteraSearch.trim();
    const searchLower = search.toLowerCase();
    const coincide = (c) => !search ||
      (c.razon_social || '').toLowerCase().includes(searchLower) ||
      (c.ruc || '').includes(search);
    const asignados = carteraAsignadosInfo.filter(coincide);
    const asignadosIds = new Set(carteraAsignadosInfo.map(c => c.id_cliente));
    const otros = carteraClientes.filter(c => !asignadosIds.has(c.id_cliente));
    return [...asignados, ...otros];
  })();

  const empleadosFiltrados = empleados.filter(emp =>
    emp.nombre_completo.toLowerCase().includes(filtro.toLowerCase()) ||
    emp.rol.toLowerCase().includes(filtro.toLowerCase()) ||
    (emp.dni && emp.dni.includes(filtro)) ||
    (emp.email && emp.email.toLowerCase().includes(filtro.toLowerCase()))
  );

  const { currentItems, setCurrentPage, ...paginacion } = usePagination(empleadosFiltrados, { storageKey: 'empleados_pagina' });

  const getRolBadgeClass = (rol) => {
    // CAMBIO: Se cambió 'Gerencia' por 'Calidad'
    if (rol === 'Administrador') return 'badge-danger';
    if (rol === 'Calidad') return 'badge-danger';
    if (rol === 'Supervisor' || rol === 'Produccion') return 'badge-primary';
    if (rol === 'Ventas' || rol === 'Comercial') return 'badge-success';
    if (rol === 'Conductor') return 'badge-info';
    if (rol === 'Logistica') return 'badge-warning';
    return 'badge-secondary';
  };

  const columns = [
    {
      header: 'ID',
      accessor: 'id_empleado',
      width: '80px'
    },
    {
      header: 'DNI',
      accessor: 'dni',
      width: '100px',
      render: (value) => value || '-'
    },
    {
      header: 'Nombre Completo',
      accessor: 'nombre_completo'
    },
    {
      header: 'Email',
      accessor: 'email',
      render: (value) => value || '-'
    },
    {
      header: 'Cargo',
      accessor: 'cargo',
      render: (value) => value || '-'
    },
    {
      header: 'Rol',
      accessor: 'rol',
      render: (value) => (
        <span className={`badge ${getRolBadgeClass(value)}`}>
          {value}
        </span>
      )
    },
    {
      header: 'Estado',
      accessor: 'estado',
      render: (value) => (
        <span className={`badge ${
          value === 'Activo' ? 'badge-success' : 'badge-secondary'
        }`}>
          {value}
        </span>
      )
    },
    {
      header: 'Acciones',
      accessor: 'id_empleado',
      width: '160px',
      align: 'center',
      render: (value, row) => (
        <div className="flex gap-2 justify-center">
          {ROLES_CARTERA.includes(row.rol) && (
            <button
              className={`btn btn-sm ${Number(row.restringir_clientes) === 1 ? 'btn-warning' : 'btn-outline'}`}
              onClick={() => abrirCartera(row)}
              title={Number(row.restringir_clientes) === 1 ? 'Cartera restringida' : 'Gestionar cartera de clientes'}
            >
              {Number(row.restringir_clientes) === 1 ? <Lock size={14} /> : <Users size={14} />}
            </button>
          )}
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
    return <Loading message="Cargando empleados..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="card-title">Empleados</h1>
          <p className="text-muted">Gestión de empleados y accesos al sistema</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirModal()}>
          <Plus size={20} />
          Nuevo Empleado
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
              placeholder="Buscar por DNI, nombre, email o rol..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>
      </div>

      <div className="card list-panel">
        <div className="card-body p-0">
          <Table
            columns={columns}
            data={currentItems}
            emptyMessage="No se encontraron empleados"
          />
        </div>
        <Pagination {...paginacion} setCurrentPage={setCurrentPage} />
      </div>
    
      <Modal
        isOpen={modalOpen}
        onClose={cerrarModal}
        title={editando ? 'Editar Empleado' : 'Nuevo Empleado'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            {/* Columna Izquierda */}
            <div>
              {/* DNI con validación */}
              <div className="form-group">
                <label className="form-label">DNI</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="form-input"
                    value={formData.dni}
                    onChange={(e) => {
                      setFormData({ ...formData, dni: e.target.value });
                      setDniValidado(null);
                      setDatosRENIEC(null);
                    }}
                    placeholder="12345678"
                    maxLength={8}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={validarDNI}
                    disabled={validandoDNI || !formData.dni}
                    style={{ minWidth: '120px' }}
                  >
                    {validandoDNI ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        Validar DNI
                      </>
                    )}
                  </button>
                </div>
                
                {dniValidado === true && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-success">
                    <CheckCircle size={16} />
                    DNI validado con RENIEC
                  </div>
                )}
                
                {dniValidado === false && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-danger">
                    <AlertCircle size={16} />
                    DNI no válido
                  </div>
                )}
                
                <small className="text-muted">
                  Opcional. Si ingresa un DNI, puede validarlo con RENIEC.
                </small>
              </div>

              {/* Nombre Completo */}
              <div className="form-group">
                <label className="form-label">Nombre Completo *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre_completo}
                  onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                  required
                  placeholder="Ej: Juan Pérez García"
                />
                {datosRENIEC && (
                  <small className="text-muted">
                    Autocompletado desde RENIEC
                  </small>
                )}
              </div>

              {/* Cargo */}
              <div className="form-group">
                <label className="form-label">Cargo</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.cargo}
                  onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                  placeholder="Ej: Jefe de Producción"
                />
                <small className="text-muted">
                  Opcional. Si no se especifica, se usa el rol como cargo.
                </small>
              </div>

              {/* ✅ ROL ACTUALIZADO CON CALIDAD */}
              <div className="form-group">
                <label className="form-label">Rol *</label>
                <select
                  className="form-select"
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                  required
                >
                  <optgroup label="Administración y Calidad">
                    <option value="Administrador">Administrador</option>
                    <option value="Calidad">Calidad</option>
                    <option value="Administrativo">Administrativo</option>
                  </optgroup>
                  
                  <optgroup label="Finanzas">
                    <option value="Cobranzas">Cobranzas</option>
                  </optgroup>

                  <optgroup label="Ventas y Comercial">
                    <option value="Ventas">Ventas</option>
                    <option value="Comercial">Comercial</option>
                  </optgroup>
                  
                  <optgroup label="Producción">
                    <option value="Supervisor">Supervisor de Producción</option>
                    <option value="Operario">Operario de Producción</option>
                    <option value="Produccion">Jefe de Producción</option>
                  </optgroup>
                  
                  <optgroup label="Almacén y Logística">
                    <option value="Almacenero">Almacenero</option>
                    <option value="Logistica">Coordinador de Logística</option>
                  </optgroup>
                  
                  <optgroup label="Transporte">
                    <option value="Conductor">Conductor</option>
                  </optgroup>
                </select>
                <small className="text-muted">
                  El rol determina los permisos y accesos en el sistema
                </small>
              </div>
            </div>

            {/* Columna Derecha - ACCESO AL SISTEMA */}
            <div>
              <div className="alert alert-info mb-3">
                <strong>Datos de Acceso al Sistema</strong>
                <p className="text-sm mt-1">Estos datos se usarán para iniciar sesión</p>
              </div>

              {/* Email con validación */}
              <div className="form-group">
                <label className="form-label">Email *</label>
                <div className="flex gap-2">
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Mail 
                      size={18} 
                      style={{ 
                        position: 'absolute', 
                        left: '0.75rem', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        color: 'var(--text-secondary)'
                      }} 
                    />
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        setEmailValidado(null);
                      }}
                      required
                      placeholder="correo@empresa.com"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={validarEmail}
                    disabled={validandoEmail || !formData.email}
                    style={{ minWidth: '120px' }}
                  >
                    {validandoEmail ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        Verificar
                      </>
                    )}
                  </button>
                </div>

                {emailValidado === true && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-success">
                    <CheckCircle size={16} />
                    Email disponible
                  </div>
                )}
                
                {emailValidado === false && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-danger">
                    <AlertCircle size={16} />
                    Email ya registrado
                  </div>
                )}

                <small className="text-muted">
                  Este correo se usará para iniciar sesión en el sistema.
                </small>
              </div>

              {/* Contraseña */}
              <div className="form-group">
                <label className="form-label">
                  Contraseña {!editando && '*'} 
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editando}
                    placeholder={editando ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <small className="text-muted">
                  {editando 
                    ? 'Dejar vacío si no desea cambiar la contraseña' 
                    : 'Mínimo 6 caracteres. El empleado usará esta contraseña para iniciar sesión.'}
                </small>
              </div>

              {/* Estado */}
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
          </div>

          {/* Datos de RENIEC si están disponibles */}
          {datosRENIEC && (
            <div className="alert alert-info mt-3">
              <strong>Datos de RENIEC:</strong>
              <div className="mt-2 text-sm">
                <div><strong>Nombres:</strong> {datosRENIEC.nombres}</div>
                <div><strong>Apellido Paterno:</strong> {datosRENIEC.apellido_paterno}</div>
                <div><strong>Apellido Materno:</strong> {datosRENIEC.apellido_materno}</div>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editando ? 'Actualizar' : 'Crear'} Empleado
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={carteraModalOpen}
        onClose={cerrarCartera}
        title={`Cartera de clientes${carteraEmpleado ? ' — ' + carteraEmpleado.nombre_completo : ''}`}
        size="lg"
      >
        {carteraLoading ? (
          <div className="text-center p-6"><Loader size={28} className="animate-spin" /></div>
        ) : (
          <div>
            <div className="card bg-gray-50 border p-4 mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={carteraRestringir}
                  onChange={(e) => setCarteraRestringir(e.target.checked)}
                  className="form-checkbox"
                  style={{ width: '18px', height: '18px' }}
                />
                {carteraRestringir ? <Lock size={18} className="text-warning" /> : <Unlock size={18} className="text-success" />}
                <div>
                  <span className="font-medium">Restringir a clientes asignados</span>
                  <p className="text-xs text-muted mt-1">
                    {carteraRestringir
                      ? 'Solo podrá crear cotizaciones/órdenes de los clientes marcados abajo. Los clientes nuevos que registre se le asignarán automáticamente.'
                      : 'Actualmente puede atender a todos los clientes (sin restricción).'}
                  </p>
                </div>
              </label>
            </div>

            {carteraRestringir && (
              <>
                <div className="flex gap-3 items-end mb-3" style={{ flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
                    <label className="form-label text-xs">Buscar cliente</label>
                    <div style={{ position: 'relative' }}>
                      <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Razón social o documento..."
                        value={carteraSearch}
                        onChange={(e) => setCarteraSearch(e.target.value)}
                        style={{ paddingLeft: '2.5rem' }}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: '190px' }}>
                    <label className="form-label text-xs">Atención</label>
                    <select className="form-select" value={carteraAtencion} onChange={(e) => setCarteraAtencion(e.target.value)}>
                      <option value="todos">Todos</option>
                      <option value="con">Con atención</option>
                      <option value="sin">Sin atención</option>
                    </select>
                  </div>
                </div>

                <p className="text-xs text-muted mb-2">{carteraIds.length} cliente(s) asignado(s)</p>

                <div style={{ maxHeight: '320px', overflowY: 'auto' }} className="border rounded">
                  {carteraListaMostrada.length === 0 ? (
                    <p className="text-center text-muted p-4 text-sm">No se encontraron clientes</p>
                  ) : (
                    carteraListaMostrada.map(c => {
                      const marcado = carteraIds.includes(c.id_cliente);
                      return (
                      <label
                        key={c.id_cliente}
                        className={`flex items-center gap-3 p-2 border-b cursor-pointer hover:bg-gray-50 ${marcado ? 'bg-blue-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => toggleClienteCartera(c.id_cliente)}
                          className="form-checkbox"
                          style={{ width: '16px', height: '16px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div className="text-sm font-medium">{c.razon_social}</div>
                          <div className="text-xs text-muted font-mono">{c.tipo_documento || 'RUC'} {c.ruc}</div>
                        </div>
                        {marcado && (
                          <span className="badge badge-primary text-xs">Asignado</span>
                        )}
                        <AtencionesBadge
                          atenciones={c.atenciones}
                          totalOrdenes={c.total_ordenes}
                          desglose={c.ordenes_desglose}
                        />
                      </label>
                      );
                    })
                  )}
                </div>
              </>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <button type="button" className="btn btn-outline" onClick={cerrarCartera}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={guardarCartera} disabled={carteraSaving}>
                {carteraSaving ? <><Loader size={16} className="animate-spin" /> Guardando...</> : 'Guardar cartera'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Empleados;