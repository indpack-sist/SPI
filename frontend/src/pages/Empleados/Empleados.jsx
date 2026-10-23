import { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Search, CheckCircle, AlertCircle, AlertTriangle, Loader, Eye, EyeOff, Mail, Users, Lock,
  Unlock, UserPlus, RefreshCw, X, Ban, Truck, Megaphone, Contact, CalendarDays, KeyRound, Info, ShieldCheck
} from 'lucide-react';
import { empleadosAPI, clientesAPI } from '../../config/api';
import { usePagination } from '../../hooks/usePagination';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import AtencionesBadge from '../../components/UI/AtencionesBadge';
import PgDrawer from '../../components/UI/PgDrawer';
import PgPager from '../../components/UI/PgPager';
import { BadgeEstadoRegistro, BadgeRol, OpcionesRol, configRol } from '../Maestros/estadosMaestros';
import { fmtFecha, iniciales, incluye } from '../Maestros/formatoMaestros';
import { useResetPagina } from '../Maestros/useResetPagina';
import '../Maestros/Maestros.css';

const ROLES_CARTERA = ['Comercial', 'Ventas'];
const LICENCIA_REGEX = /^[A-Z]\d{8}$/;

const FORM_VACIO = {
  dni: '',
  nombre_completo: '',
  email: '',
  password: '',
  cargo: '',
  rol: 'Operario',
  licencia_conducir: '',
  validar_dni: true,
  estado: 'Activo'
};

const esRestringido = (e) => Number(e.restringir_clientes) === 1;
const sinLicencia = (e) => e.rol === 'Conductor' && !LICENCIA_REGEX.test(e.licencia_conducir || '');

const FILTROS_KPI = {
  activos: (e) => e.estado === 'Activo',
  inactivos: (e) => e.estado !== 'Activo',
  conductores: (e) => e.rol === 'Conductor' && e.estado === 'Activo',
  comercial: (e) => ROLES_CARTERA.includes(e.rol) && e.estado === 'Activo'
};

function Empleados() {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [detalle, setDetalle] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroKpi, setFiltroKpi] = useState('');
  const [filtroRol, setFiltroRol] = useState('');

  const [validandoDNI, setValidandoDNI] = useState(false);
  const [validandoEmail, setValidandoEmail] = useState(false);
  const [dniValidado, setDniValidado] = useState(null);
  const [emailValidado, setEmailValidado] = useState(null);
  const [datosRENIEC, setDatosRENIEC] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [reemplazoOpen, setReemplazoOpen] = useState(false);
  const [saliente, setSaliente] = useState(null);
  const [reemplazoSaving, setReemplazoSaving] = useState(false);
  const [showReemplazoPass, setShowReemplazoPass] = useState(false);
  const [reemplazoData, setReemplazoData] = useState({
    dni: '',
    nombre_completo: '',
    email: '',
    password: '',
    cargo: '',
    rol: 'Operario',
    transferir_cartera: false
  });

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

  const [formData, setFormData] = useState(FORM_VACIO);

  useEffect(() => {
    cargarEmpleados();
  }, []);

  const cargarEmpleados = async ({ silencioso = false } = {}) => {
    try {
      if (silencioso) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const response = await empleadosAPI.getAll({ resumen: 1 });
      setEmpleados(response.data.data || []);
    } catch (err) {
      setError(err.error || 'Error al cargar empleados');
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        licencia_conducir: empleado.licencia_conducir || '',
        validar_dni: false,
        estado: empleado.estado
      });
    } else {
      setEditando(null);
      setFormData(FORM_VACIO);
    }
    setDniValidado(null);
    setEmailValidado(null);
    setDatosRENIEC(null);
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
    setFormData(FORM_VACIO);
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
          setFormData({ ...formData, nombre_completo: response.data.datos.nombre_completo });
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

    if (formData.rol === 'Conductor' && formData.licencia_conducir && !LICENCIA_REGEX.test(formData.licencia_conducir)) {
      setError('La licencia de conducir debe ser una letra seguida de 8 dígitos (Ej: Q12345678)');
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
      setDetalle(null);
      cargarEmpleados({ silencioso: true });
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
      setDetalle(null);
      cargarEmpleados({ silencioso: true });
    } catch (err) {
      setError(err.error || 'Error al desactivar empleado');
    }
  };

  const abrirReemplazo = (empleado) => {
    setSaliente(empleado);
    setReemplazoData({
      dni: '',
      nombre_completo: '',
      email: empleado.email || '',
      password: '',
      cargo: '',
      rol: empleado.rol,
      transferir_cartera: ROLES_CARTERA.includes(empleado.rol)
    });
    setError(null);
    setSuccess(null);
    setShowReemplazoPass(false);
    setReemplazoOpen(true);
  };

  const cerrarReemplazo = () => {
    setReemplazoOpen(false);
    setSaliente(null);
    setShowReemplazoPass(false);
  };

  const handleReemplazar = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!reemplazoData.nombre_completo.trim()) {
      setError('El nombre del nuevo empleado es requerido');
      return;
    }
    if (!reemplazoData.password || reemplazoData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setReemplazoSaving(true);
    try {
      await empleadosAPI.reemplazar(saliente.id_empleado, reemplazoData);
      setSuccess(
        `Reemplazo registrado: "${saliente.nombre_completo}" quedó inactivo (su historial se conserva) ` +
        `y se creó a "${reemplazoData.nombre_completo}" con el mismo correo de acceso.`
      );
      cerrarReemplazo();
      setDetalle(null);
      cargarEmpleados({ silencioso: true });
    } catch (err) {
      setError(err.error || 'Error al reemplazar empleado');
    } finally {
      setReemplazoSaving(false);
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
        ids: carteraIds
      });
      setSuccess(`Cartera de ${carteraEmpleado.nombre_completo} actualizada exitosamente`);
      cerrarCartera();
      setDetalle(null);
      cargarEmpleados({ silencioso: true });
    } catch (err) {
      setError(err.error || 'Error al guardar la cartera');
    } finally {
      setCarteraSaving(false);
    }
  };

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

  const termino = busqueda.trim().toLowerCase();
  const empleadosFiltrados = empleados.filter(emp => {
    if (filtroKpi && !FILTROS_KPI[filtroKpi](emp)) return false;
    if (filtroRol && emp.rol !== filtroRol) return false;
    if (!termino) return true;
    return incluye(emp.nombre_completo, termino) || incluye(emp.rol, termino) || incluye(emp.dni, termino)
      || incluye(emp.email, termino) || incluye(emp.cargo, termino) || incluye(configRol(emp.rol).label, termino);
  });

  const { currentItems, setCurrentPage, ...paginacion } = usePagination(empleadosFiltrados, { storageKey: 'empleados_pagina' });
  useResetPagina(setCurrentPage, [busqueda, filtroKpi, filtroRol]);

  const hayFiltros = !!(busqueda || filtroKpi || filtroRol);
  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroKpi('');
    setFiltroRol('');
  };

  if (loading) return <Loading variant="table" />;

  const activos = empleados.filter(FILTROS_KPI.activos);
  const conductores = empleados.filter(FILTROS_KPI.conductores);
  const comerciales = empleados.filter(FILTROS_KPI.comercial);
  const baseRoles = filtroKpi ? empleados.filter(FILTROS_KPI[filtroKpi]) : empleados;
  const conteoRoles = Object.entries(baseRoles.reduce((acc, e) => {
    acc[e.rol] = (acc[e.rol] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const kpis = [
    { id: 'activos', label: 'Activos', tono: 'is-success', icon: CheckCircle, valor: activos.length, foot: `de ${empleados.length} registrados` },
    { id: 'inactivos', label: 'Inactivos', tono: '', icon: Ban, valor: empleados.length - activos.length, foot: 'Historial conservado' },
    { id: 'conductores', label: 'Conductores', tono: 'is-info', icon: Truck, valor: conductores.length, foot: `${conductores.filter(sinLicencia).length} sin licencia válida` },
    { id: 'comercial', label: 'Comercial y ventas', tono: 'is-accent', icon: Megaphone, valor: comerciales.length, foot: `${comerciales.filter(esRestringido).length} con cartera restringida` }
  ];

  const renderCartera = (emp) => {
    if (!ROLES_CARTERA.includes(emp.rol)) return <span className="pg-muted">—</span>;
    const restringida = esRestringido(emp);
    return (
      <>
        <span className="pg-cell-main">{Number(emp.clientes_asignados || 0)} clientes</span>
        <div className="pg-tags">
          {restringida
            ? <span className="pg-tag is-warning"><Lock size={11} />Restringida</span>
            : <span className="pg-tag"><Unlock size={11} />Sin restricción</span>}
        </div>
      </>
    );
  };

  const renderDrawer = () => {
    const emp = detalle;
    const cfg = configRol(emp.rol);
    const activo = emp.estado === 'Activo';
    return (
      <PgDrawer
        eyebrow={<><Users size={12} /> Empleado</>}
        title={emp.nombre_completo}
        badges={<><BadgeRol rol={emp.rol} /><BadgeEstadoRegistro estado={emp.estado} /></>}
        onClose={() => setDetalle(null)}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={() => setDetalle(null)}>Cerrar</button>
            {activo && (
              <button type="button" className="btn btn-outline" onClick={() => abrirReemplazo(emp)}>
                <UserPlus size={16} /> Reemplazar
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => abrirModal(emp)}>
              <Pencil size={16} /> Editar empleado
            </button>
          </>
        )}
      >
        <section>
          <h3 className="pg-section-title"><Contact size={14} /> Identificación</h3>
          <div className="pg-kv">
            <div><span>DNI</span><strong>{emp.dni || '—'}</strong></div>
            <div><span>Cargo</span><strong>{emp.cargo || cfg.label}</strong></div>
            <div><span>Área</span><strong>{cfg.grupo}</strong></div>
            <div><span>Registrado</span><strong>{fmtFecha(emp.fecha_registro)}</strong></div>
          </div>
        </section>

        <section>
          <h3 className="pg-section-title"><KeyRound size={14} /> Acceso al sistema</h3>
          <div className="pg-kv">
            <div className="wide"><span>Correo de inicio de sesión</span><strong>{emp.email || '—'}</strong></div>
            <div><span>Rol</span><strong>{cfg.label}</strong></div>
            <div><span>Estado</span><strong>{activo ? 'Puede iniciar sesión' : 'Acceso bloqueado'}</strong></div>
          </div>
        </section>

        {emp.rol === 'Conductor' && (
          <section>
            <h3 className="pg-section-title"><Truck size={14} /> Conductor</h3>
            <div className="pg-kv">
              <div><span>Licencia de conducir</span><strong>{emp.licencia_conducir || 'Sin registrar'}</strong></div>
              <div>
                <span>Guías de remisión</span>
                <strong>
                  {sinLicencia(emp)
                    ? <span className="badge badge-warning"><AlertTriangle size={11} />No apto</span>
                    : <span className="badge badge-success"><CheckCircle size={11} />Apto</span>}
                </strong>
              </div>
            </div>
            {sinLicencia(emp) && (
              <p className="pg-hint">La emisión de GRE exige licencia con formato letra + 8 dígitos (Ej: Q12345678).</p>
            )}
          </section>
        )}

        {ROLES_CARTERA.includes(emp.rol) && (
          <section>
            <h3 className="pg-section-title"><Users size={14} /> Cartera de clientes</h3>
            <div className="pg-kv">
              <div><span>Clientes asignados</span><strong>{Number(emp.clientes_asignados || 0)}</strong></div>
              <div><span>Restricción</span><strong>{esRestringido(emp) ? 'Solo clientes asignados' : 'Atiende a todos'}</strong></div>
            </div>
            <div className="ms-actions-end">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => abrirCartera(emp)}>
                <Users size={14} /> Gestionar cartera
              </button>
            </div>
          </section>
        )}
      </PgDrawer>
    );
  };

  return (
    <div className="pg-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Users size={13} /> Maestros</span>
          <h1 className="pg-title">Empleados</h1>
          <p className="pg-subtitle">
            <b>{empleados.length}</b> empleados · <b>{activos.length}</b> con acceso activo · <b>{new Set(activos.map(e => e.rol)).size}</b> roles en uso
          </p>
        </div>
        <div className="pg-actions">
          <button type="button" className="btn btn-outline" onClick={() => cargarEmpleados({ silencioso: true })} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => abrirModal()}>
            <Plus size={16} /> Nuevo empleado
          </button>
        </div>
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        <div className="pg-kpis">
          {kpis.map(k => {
            const Icono = k.icon;
            const activo = filtroKpi === k.id;
            return (
              <button key={k.id} type="button" className={`pg-kpi ${k.tono} ${activo ? 'on' : ''}`} aria-pressed={activo}
                onClick={() => setFiltroKpi(activo ? '' : k.id)}>
                <div className="pg-kpi-top">
                  <span className="pg-kpi-label">{k.label}</span>
                  <span className="pg-kpi-icon"><Icono size={16} /></span>
                </div>
                <span className="pg-kpi-value">{k.valor}</span>
                <span className="pg-kpi-foot">{activo ? 'Filtro activo · pulsa para quitar' : k.foot}</span>
              </button>
            );
          })}
        </div>

        <section className="pg-panel">
          <div className="pg-filters">
            <div className="pg-filters-row">
              <div className="pg-field pg-field-grow pg-search">
                <label className="pg-field-label" htmlFor="ms-emp-busqueda">Buscar</label>
                <Search size={14} />
                <input id="ms-emp-busqueda" type="search" className="form-input" placeholder="Nombre, DNI, email, cargo o rol"
                  value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </div>
            </div>
            <div className="pg-chips" role="group" aria-label="Filtrar por rol">
              {conteoRoles.map(([rol, n]) => {
                const Icono = configRol(rol).icon;
                const on = filtroRol === rol;
                return (
                  <button key={rol} type="button" className={`pg-chip ${on ? 'on' : ''}`} aria-pressed={on}
                    onClick={() => setFiltroRol(on ? '' : rol)}>
                    <Icono size={14} /> {rol} <b>{n}</b>
                  </button>
                );
              })}
              {hayFiltros && (
                <>
                  <span className="pg-chip-sep" />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={limpiarFiltros}>
                    <X size={14} /> Limpiar filtros
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="pg-panel">
          <div className="pg-panel-head">
            <h2 className="pg-panel-title"><Users size={16} /> Empleados <span className="pg-count">{empleadosFiltrados.length}</span></h2>
            <span className="pg-panel-meta">
              {filtroKpi ? `${kpis.find(k => k.id === filtroKpi).label}${filtroRol ? ` · ${filtroRol}` : ''}` : (filtroRol || 'Todos los estados')}
            </span>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Rol</th>
                  <th>Documento</th>
                  <th>Cartera</th>
                  <th>Registro</th>
                  <th className="center">Estado</th>
                  <th className="center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? currentItems.map(emp => {
                  const activo = emp.estado === 'Activo';
                  const cartera = ROLES_CARTERA.includes(emp.rol);
                  return (
                    <tr key={emp.id_empleado} className="is-clickable" onClick={() => setDetalle(emp)}>
                      <td style={{ minWidth: 240 }}>
                        <div className="ms-person">
                          <span className={`ms-avatar ${activo ? '' : 'is-off'}`} aria-hidden="true">{iniciales(emp.nombre_completo)}</span>
                          <div>
                            <span className="pg-cell-main">{emp.nombre_completo}</span>
                            <span className="pg-cell-sub pg-truncate">{emp.email || 'Sin correo'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <BadgeRol rol={emp.rol} />
                        <span className="pg-cell-sub">{emp.cargo || configRol(emp.rol).label}</span>
                      </td>
                      <td className="nowrap">
                        <span className="pg-cell-main">{emp.dni || <span className="pg-muted">Sin DNI</span>}</span>
                        {emp.rol === 'Conductor' && (
                          sinLicencia(emp)
                            ? <div className="pg-tags"><span className="pg-tag is-warning"><AlertTriangle size={11} />Sin licencia válida</span></div>
                            : <span className="pg-cell-sub">Licencia {emp.licencia_conducir}</span>
                        )}
                      </td>
                      <td className="nowrap">{renderCartera(emp)}</td>
                      <td className="nowrap">
                        <span className="pg-cell-main"><CalendarDays size={12} className="pg-muted" />{fmtFecha(emp.fecha_registro)}</span>
                      </td>
                      <td className="center"><BadgeEstadoRegistro estado={emp.estado} /></td>
                      <td className="center" onClick={(e) => e.stopPropagation()}>
                        <div className="pg-rowactions">
                          {cartera && (
                            <button type="button" className={`pg-iconbtn ${esRestringido(emp) ? 'is-on' : ''}`}
                              title={esRestringido(emp) ? 'Cartera restringida' : 'Gestionar cartera de clientes'}
                              aria-label={`Cartera de ${emp.nombre_completo}`} onClick={() => abrirCartera(emp)}>
                              {esRestringido(emp) ? <Lock size={15} /> : <Users size={15} />}
                            </button>
                          )}
                          <button type="button" className="pg-iconbtn" title="Editar" aria-label={`Editar ${emp.nombre_completo}`} onClick={() => abrirModal(emp)}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" className="pg-iconbtn" title="Reemplazar (ingresa otra persona con este correo, conservando el historial)"
                            aria-label={`Reemplazar a ${emp.nombre_completo}`} disabled={!activo} onClick={() => abrirReemplazo(emp)}>
                            <UserPlus size={15} />
                          </button>
                          <button type="button" className="pg-iconbtn is-danger" title="Desactivar" aria-label={`Desactivar a ${emp.nombre_completo}`}
                            disabled={!activo} onClick={() => handleDelete(emp.id_empleado)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="pg-empty">
                        <Users size={28} />
                        <strong>{hayFiltros ? 'Ningún empleado coincide con los filtros' : 'Aún no hay empleados registrados'}</strong>
                        <span>{hayFiltros ? 'Quita algún filtro o cambia la búsqueda.' : 'Crea un empleado para darle acceso al sistema.'}</span>
                        {hayFiltros
                          ? <button type="button" className="btn btn-outline btn-sm" onClick={limpiarFiltros}><X size={14} /> Limpiar filtros</button>
                          : <button type="button" className="btn btn-primary btn-sm" onClick={() => abrirModal()}><Plus size={14} /> Nuevo empleado</button>}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PgPager {...paginacion} setCurrentPage={setCurrentPage} sustantivo="empleados" />
        </section>
      </div>

      {detalle && renderDrawer()}

      <Modal isOpen={modalOpen} onClose={cerrarModal} title={editando ? 'Editar empleado' : 'Nuevo empleado'} size="lg">
        <form onSubmit={handleSubmit}>
          <div className="pg-form-grid">
            <div>
              <div className="form-group">
                <label className="form-label" htmlFor="ms-emp-dni">DNI</label>
                <div className="ms-inline">
                  <input id="ms-emp-dni" type="text" className="form-input" value={formData.dni}
                    onChange={(e) => {
                      setFormData({ ...formData, dni: e.target.value, validar_dni: true });
                      setDniValidado(null);
                      setDatosRENIEC(null);
                    }}
                    placeholder="12345678" maxLength={8} />
                  <button type="button" className="btn btn-outline" onClick={validarDNI} disabled={validandoDNI || !formData.dni}>
                    {validandoDNI
                      ? <><Loader size={16} className="animate-spin" /> Validando...</>
                      : <><CheckCircle size={16} /> Validar DNI</>}
                  </button>
                </div>

                {dniValidado === true && <div className="ms-status is-ok"><CheckCircle size={16} /> DNI validado con RENIEC</div>}

                {dniValidado === false && (
                  <>
                    <div className="ms-status is-error"><AlertCircle size={16} /> No se pudo validar el DNI con RENIEC (sin resultados)</div>
                    <div className="ms-box is-tight">
                      <label className="pg-check">
                        <input type="checkbox" checked={!formData.validar_dni}
                          onChange={(e) => setFormData({ ...formData, validar_dni: !e.target.checked })} />
                        <div><span>Registrar de todas formas</span><small>El empleado se guardará sin validar el DNI.</small></div>
                      </label>
                    </div>
                  </>
                )}

                <small className="pg-hint">Opcional. Si ingresa un DNI, puede validarlo con RENIEC.</small>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ms-emp-nombre">Nombre completo *</label>
                <input id="ms-emp-nombre" type="text" className="form-input" value={formData.nombre_completo}
                  onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })} required placeholder="Ej: Juan Pérez García" />
                {datosRENIEC && <small className="pg-hint">Autocompletado desde RENIEC</small>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ms-emp-cargo">Cargo</label>
                <input id="ms-emp-cargo" type="text" className="form-input" value={formData.cargo}
                  onChange={(e) => setFormData({ ...formData, cargo: e.target.value })} placeholder="Ej: Jefe de Producción" />
                <small className="pg-hint">Opcional. Si no se especifica, se usa el rol como cargo.</small>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ms-emp-rol">Rol *</label>
                <select id="ms-emp-rol" className="form-select" value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })} required>
                  <OpcionesRol />
                </select>
                <small className="pg-hint">El rol determina los permisos y accesos en el sistema.</small>
              </div>

              {formData.rol === 'Conductor' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="ms-emp-licencia">Licencia de conducir</label>
                  <input id="ms-emp-licencia" type="text" className="form-input" value={formData.licencia_conducir}
                    onChange={(e) => setFormData({ ...formData, licencia_conducir: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                    placeholder="Ej: Q12345678" maxLength={9} />
                  {formData.licencia_conducir && !LICENCIA_REGEX.test(formData.licencia_conducir) && (
                    <div className="ms-status is-error"><AlertCircle size={16} /> Formato inválido: una letra seguida de 8 dígitos (Ej: Q12345678)</div>
                  )}
                  {formData.licencia_conducir && LICENCIA_REGEX.test(formData.licencia_conducir) && (
                    <div className="ms-status is-ok"><CheckCircle size={16} /> Formato válido</div>
                  )}
                  <small className="pg-hint">Una letra seguida de los 8 dígitos del DNI. Usado en las guías de remisión.</small>
                </div>
              )}
            </div>

            <div>
              <div className="ms-note is-info">
                <Info size={16} />
                <div><strong>Datos de acceso al sistema</strong><p>Estos datos se usarán para iniciar sesión.</p></div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ms-emp-email">Email *</label>
                <div className="ms-inline">
                  <div className="ms-field-icon">
                    <Mail size={16} />
                    <input id="ms-emp-email" type="email" className="form-input" value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        setEmailValidado(null);
                      }}
                      required placeholder="correo@empresa.com" />
                  </div>
                  <button type="button" className="btn btn-outline" onClick={validarEmail} disabled={validandoEmail || !formData.email}>
                    {validandoEmail
                      ? <><Loader size={16} className="animate-spin" /> Validando...</>
                      : <><CheckCircle size={16} /> Verificar</>}
                  </button>
                </div>
                {emailValidado === true && <div className="ms-status is-ok"><CheckCircle size={16} /> Email disponible</div>}
                {emailValidado === false && <div className="ms-status is-error"><AlertCircle size={16} /> Email ya registrado</div>}
                <small className="pg-hint">Este correo se usará para iniciar sesión en el sistema.</small>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ms-emp-pass">Contraseña {!editando && '*'}</label>
                <div className="ms-field-icon">
                  <input id="ms-emp-pass" type={showPassword ? 'text' : 'password'} className="form-input has-toggle" value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editando} placeholder={editando ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'} />
                  <button type="button" className="ms-toggle" onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <small className="pg-hint">
                  {editando
                    ? 'Dejar vacío si no desea cambiar la contraseña.'
                    : 'Mínimo 6 caracteres. El empleado usará esta contraseña para iniciar sesión.'}
                </small>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ms-emp-estado">Estado *</label>
                <select id="ms-emp-estado" className="form-select" value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value })} required>
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
            </div>
          </div>

          {datosRENIEC && (
            <div className="ms-box">
              <h3 className="pg-section-title"><ShieldCheck size={14} /> Datos de RENIEC</h3>
              <div className="pg-kv">
                <div><span>Nombres</span><strong>{datosRENIEC.nombres}</strong></div>
                <div><span>Apellido paterno</span><strong>{datosRENIEC.apellido_paterno}</strong></div>
                <div><span>Apellido materno</span><strong>{datosRENIEC.apellido_materno}</strong></div>
              </div>
            </div>
          )}

          <div className="ms-actions-end">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{editando ? 'Actualizar' : 'Crear'} empleado</button>
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
          <div className="pg-loading"><Loader size={28} className="animate-spin" /></div>
        ) : (
          <div>
            <div className="ms-box">
              <label className="pg-check">
                <input type="checkbox" checked={carteraRestringir} onChange={(e) => setCarteraRestringir(e.target.checked)} />
                <div>
                  <span>
                    {carteraRestringir
                      ? <Lock size={14} className="text-warning" />
                      : <Unlock size={14} className="text-success" />}
                    Restringir a clientes asignados
                  </span>
                  <small>
                    {carteraRestringir
                      ? 'Solo podrá crear cotizaciones/órdenes de los clientes marcados abajo. Los clientes nuevos que registre se le asignarán automáticamente.'
                      : 'Actualmente puede atender a todos los clientes (sin restricción).'}
                  </small>
                </div>
              </label>
            </div>

            {carteraRestringir && (
              <>
                <div className="pg-filters-row ms-cartera-filters">
                  <div className="pg-field pg-field-grow pg-search">
                    <label className="pg-field-label" htmlFor="ms-cartera-busqueda">Buscar cliente</label>
                    <Search size={14} />
                    <input id="ms-cartera-busqueda" type="search" className="form-input" placeholder="Razón social o documento"
                      value={carteraSearch} onChange={(e) => setCarteraSearch(e.target.value)} />
                  </div>
                  <div className="pg-field">
                    <span className="pg-field-label">Atención</span>
                    <div className="pg-segmented" role="radiogroup" aria-label="Atención">
                      {[
                        { id: 'todos', label: 'Todos' },
                        { id: 'con', label: 'Con atención' },
                        { id: 'sin', label: 'Sin atención' }
                      ].map(op => (
                        <button key={op.id} type="button" role="radio" aria-checked={carteraAtencion === op.id}
                          className={carteraAtencion === op.id ? 'active' : ''} onClick={() => setCarteraAtencion(op.id)}>
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="ms-cartera-count"><b>{carteraIds.length}</b> cliente(s) asignado(s)</p>

                <div className="ms-cartera-list">
                  {carteraListaMostrada.length === 0 ? (
                    <p className="ms-cartera-empty">No se encontraron clientes</p>
                  ) : (
                    carteraListaMostrada.map(c => {
                      const marcado = carteraIds.includes(c.id_cliente);
                      return (
                        <label key={c.id_cliente} className={`ms-cartera-item ${marcado ? 'is-on' : ''}`}>
                          <input type="checkbox" checked={marcado} onChange={() => toggleClienteCartera(c.id_cliente)} />
                          <div>
                            <span className="pg-cell-main">{c.razon_social}</span>
                            <span className="pg-cell-sub">{c.tipo_documento || 'RUC'} {c.ruc}</span>
                          </div>
                          {marcado && <span className="badge badge-primary badge-sm"><CheckCircle size={10} />Asignado</span>}
                          <AtencionesBadge atenciones={c.atenciones} totalOrdenes={c.total_ordenes} desglose={c.ordenes_desglose} />
                        </label>
                      );
                    })
                  )}
                </div>
              </>
            )}

            <div className="ms-actions-end">
              <button type="button" className="btn btn-outline" onClick={cerrarCartera}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={guardarCartera} disabled={carteraSaving}>
                {carteraSaving ? <><Loader size={16} className="animate-spin" /> Guardando...</> : 'Guardar cartera'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={reemplazoOpen}
        onClose={cerrarReemplazo}
        title={`Reemplazar empleado${saliente ? ' — ' + saliente.nombre_completo : ''}`}
        size="lg"
      >
        <form onSubmit={handleReemplazar}>
          <div className="ms-note is-warning">
            <AlertTriangle size={16} />
            <div>
              <strong>El empleado saliente se conserva.</strong>
              <p>
                {saliente?.nombre_completo} quedará <b>Inactivo</b> y todo su historial
                (órdenes, cotizaciones, movimientos) seguirá mostrando su nombre. Se creará una
                persona nueva que iniciará sesión con el mismo correo.
              </p>
            </div>
          </div>

          <div className="pg-form-grid">
            <div>
              <div className="form-group">
                <label className="form-label" htmlFor="ms-rem-dni">DNI</label>
                <input id="ms-rem-dni" type="text" className="form-input" value={reemplazoData.dni}
                  onChange={(e) => setReemplazoData({ ...reemplazoData, dni: e.target.value })} placeholder="12345678" maxLength={8} />
                <small className="pg-hint">Opcional. DNI de la persona que ingresa.</small>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ms-rem-nombre">Nombre completo *</label>
                <input id="ms-rem-nombre" type="text" className="form-input" value={reemplazoData.nombre_completo}
                  onChange={(e) => setReemplazoData({ ...reemplazoData, nombre_completo: e.target.value })} required placeholder="Ej: María López García" />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ms-rem-cargo">Cargo</label>
                <input id="ms-rem-cargo" type="text" className="form-input" value={reemplazoData.cargo}
                  onChange={(e) => setReemplazoData({ ...reemplazoData, cargo: e.target.value })} placeholder="Ej: Ejecutivo Comercial" />
                <small className="pg-hint">Opcional. Si se deja vacío se usa el rol.</small>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ms-rem-rol">Rol *</label>
                <select id="ms-rem-rol" className="form-select" value={reemplazoData.rol}
                  onChange={(e) => setReemplazoData({ ...reemplazoData, rol: e.target.value })} required>
                  <OpcionesRol />
                </select>
              </div>
            </div>

            <div>
              <div className="ms-note is-info">
                <Info size={16} />
                <div><strong>Datos de acceso al sistema</strong><p>El correo se hereda del empleado saliente (puede cambiarlo).</p></div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ms-rem-email">Email *</label>
                <div className="ms-field-icon">
                  <Mail size={16} />
                  <input id="ms-rem-email" type="email" className="form-input" value={reemplazoData.email}
                    onChange={(e) => setReemplazoData({ ...reemplazoData, email: e.target.value })} required placeholder="correo@empresa.com" />
                </div>
                <small className="pg-hint">Con este correo iniciará sesión la persona nueva.</small>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ms-rem-pass">Contraseña *</label>
                <div className="ms-field-icon">
                  <input id="ms-rem-pass" type={showReemplazoPass ? 'text' : 'password'} className="form-input has-toggle"
                    value={reemplazoData.password} onChange={(e) => setReemplazoData({ ...reemplazoData, password: e.target.value })}
                    required placeholder="Mínimo 6 caracteres" />
                  <button type="button" className="ms-toggle" onClick={() => setShowReemplazoPass(!showReemplazoPass)}
                    aria-label={showReemplazoPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    {showReemplazoPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {ROLES_CARTERA.includes(saliente?.rol) && (
                <div className="form-group">
                  <label className="pg-check">
                    <input type="checkbox" checked={reemplazoData.transferir_cartera}
                      onChange={(e) => setReemplazoData({ ...reemplazoData, transferir_cartera: e.target.checked })} />
                    <div>
                      <span>Transferir la cartera de clientes del saliente</span>
                      <small>Copia los clientes asignados y la restricción del empleado que se retira.</small>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="ms-actions-end">
            <button type="button" className="btn btn-outline" onClick={cerrarReemplazo}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={reemplazoSaving}>
              {reemplazoSaving ? <><Loader size={16} className="animate-spin" /> Procesando...</> : 'Registrar reemplazo'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Empleados;
