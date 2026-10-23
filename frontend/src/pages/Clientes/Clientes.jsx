import { useState, useEffect, useRef } from 'react';
import {
  Plus, Pencil, Trash2, Search, CheckCircle, AlertCircle, AlertTriangle, Loader, Building2, User, CreditCard,
  FilePlus, Eye, Clock, RefreshCw, X, Users, Wallet, Hourglass, Phone, Mail, MapPin, ExternalLink, Activity,
  Info, Ban, Megaphone, CalendarDays
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clientesAPI, solicitudesCreditoAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { usePermisos } from '../../context/PermisosContext';
import { usePagination } from '../../hooks/usePagination';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import AtencionesBadge from '../../components/UI/AtencionesBadge';
import PgDrawer from '../../components/UI/PgDrawer';
import PgPager from '../../components/UI/PgPager';
import UbigeoSelector from '../../components/common/UbigeoSelector';
import {
  BadgeEstadoRegistro, BadgeTipoDocumento, BadgeCondicionPago, BadgeCreditoCliente, usaLimiteCredito
} from '../Maestros/estadosMaestros';
import { fmtFecha, fmtMonto, haceTexto, incluye } from '../Maestros/formatoMaestros';
import { useResetPagina } from '../Maestros/useResetPagina';
import '../Maestros/Maestros.css';

const FORM_VACIO = {
  tipo_documento: 'RUC',
  ruc: '',
  razon_social: '',
  contacto: '',
  telefono: '',
  email: '',
  direccion_despacho: '',
  ubigeo: '',
  limite_credito_pen: 0,
  limite_credito_usd: 0,
  usar_limite_credito: false,
  condicion_pago: 'Contado',
  dias_credito: 0,
  validar_documento: true,
  estado: 'Activo'
};

const OPCIONES_ATENCION = [
  { id: 'todos', label: 'Todos' },
  { id: 'con', label: 'Con atención' },
  { id: 'sin', label: 'Sin atención' }
];

const OPCIONES_TIPO = [
  { id: '', label: 'Todos' },
  { id: 'RUC', label: 'Empresas', icon: Building2 },
  { id: 'DNI', label: 'Personas', icon: User }
];

const tieneSolicitud = (c) => Number(c.tiene_solicitud_pendiente) === 1 || c.tiene_solicitud_pendiente === true;
const tieneDeuda = (c) => parseFloat(c.saldo_pen || 0) > 0.009 || parseFloat(c.saldo_usd || 0) > 0.009;

const FILTROS_KPI = {
  activos: (c) => c.estado === 'Activo',
  inactivos: (c) => c.estado !== 'Activo',
  deuda: tieneDeuda,
  vencidos: (c) => Number(c.ordenes_vencidas) > 0,
  credito: usaLimiteCredito,
  solicitud: tieneSolicitud
};

const desgloseOrdenes = (texto) => (texto ? texto.split('|').map(p => {
  const idx = p.lastIndexOf(':');
  return { estado: p.slice(0, idx), cantidad: p.slice(idx + 1) };
}) : []);

const colorUso = (pct) => {
  if (pct >= 90) return 'var(--danger)';
  if (pct >= 70) return 'var(--warning)';
  return 'var(--success)';
};

function MedidorCredito({ titulo, linea, moneda }) {
  const limite = parseFloat(linea?.limite || 0);
  const usado = parseFloat(linea?.utilizado || 0);
  const pct = limite > 0 ? (usado / limite) * 100 : 0;
  return (
    <div className="pg-measure">
      <div className="pg-measure-top">
        <span>{titulo}</span>
        <b>{fmtMonto(usado, moneda)} <small>/ {fmtMonto(limite, moneda)}</small></b>
      </div>
      <div className="pg-meter" title={`${pct.toFixed(1)}% utilizado`} style={{ '--meter-c': colorUso(pct) }}>
        <span style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`pg-measure-note ${pct > 100 ? 'is-danger' : ''}`}>
        {pct.toFixed(0)}% utilizado · disponible {fmtMonto(parseFloat(linea?.disponible || 0), moneda)}
      </span>
    </div>
  );
}

function Clientes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tienePermiso } = usePermisos();
  const verFinanzas = tienePermiso('verFinanzasVentas');
  const inputArchivoRef = useRef(null);

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [credito, setCredito] = useState({ loading: false, data: null });

  const [busqueda, setBusqueda] = useState('');
  const [filtroAtencion, setFiltroAtencion] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroKpi, setFiltroKpi] = useState('');

  const [validandoDocumento, setValidandoDocumento] = useState(false);
  const [documentoValidado, setDocumentoValidado] = useState(null);
  const [datosAPI, setDatosAPI] = useState(null);
  const [creacionManual, setCreacionManual] = useState(false);

  const [modalSolicitudOpen, setModalSolicitudOpen] = useState(false);
  const [clienteParaSolicitud, setClienteParaSolicitud] = useState(null);
  const [archivoSustento, setArchivoSustento] = useState(null);
  const [solicitudData, setSolicitudData] = useState({
    limite_credito_pen_solicitado: 0,
    limite_credito_usd_solicitado: 0,
    limite_credito_pen_actual: 0,
    limite_credito_usd_actual: 0,
    justificacion: ''
  });

  const [condicionOriginal, setCondicionOriginal] = useState({ condicion_pago: 'Contado', dias_credito: 0 });
  const [observacionCambio, setObservacionCambio] = useState('');
  const [condicionCambioDetectado, setCondicionCambioDetectado] = useState(false);

  const [formData, setFormData] = useState(FORM_VACIO);

  useEffect(() => {
    cargarClientes({ silencioso: clientes.length > 0 });
  }, [filtroAtencion]);

  useEffect(() => {
    if (editando) {
      const cambio =
        formData.condicion_pago !== condicionOriginal.condicion_pago ||
        parseInt(formData.dias_credito || 0) !== parseInt(condicionOriginal.dias_credito || 0);
      setCondicionCambioDetectado(cambio);
    }
  }, [formData.condicion_pago, formData.dias_credito]);

  useEffect(() => {
    if (!detalle || !usaLimiteCredito(detalle)) {
      setCredito({ loading: false, data: null });
      return undefined;
    }
    let vigente = true;
    setCredito({ loading: true, data: null });
    clientesAPI.getEstadoCredito(detalle.id_cliente)
      .then(res => { if (vigente) setCredito({ loading: false, data: res.data.data }); })
      .catch(() => { if (vigente) setCredito({ loading: false, data: null }); });
    return () => { vigente = false; };
  }, [detalle?.id_cliente]);

  const cargarClientes = async ({ silencioso = false } = {}) => {
    try {
      if (silencioso) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const params = { resumen: 1 };
      if (filtroAtencion === 'con') params.atencion = 'con';
      else if (filtroAtencion === 'sin') params.atencion = 'sin';
      const response = await clientesAPI.getAll(params);
      setClientes(response.data.data || []);
    } catch (err) {
      setError(err.error || 'Error al cargar clientes');
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        ubigeo: cliente.ubigeo || '',
        limite_credito_pen: parseFloat(cliente.limite_credito_pen || 0),
        limite_credito_usd: parseFloat(cliente.limite_credito_usd || 0),
        usar_limite_credito: usaLimiteCredito(cliente),
        condicion_pago: cliente.condicion_pago || 'Contado',
        dias_credito: parseInt(cliente.dias_credito || 0),
        validar_documento: false,
        estado: cliente.estado
      });
      setCondicionOriginal({
        condicion_pago: cliente.condicion_pago || 'Contado',
        dias_credito: parseInt(cliente.dias_credito || 0)
      });
    } else {
      setEditando(null);
      setFormData(FORM_VACIO);
      setCondicionOriginal({ condicion_pago: 'Contado', dias_credito: 0 });
    }
    setObservacionCambio('');
    setCondicionCambioDetectado(false);
    setDocumentoValidado(null);
    setDatosAPI(null);
    setCreacionManual(false);
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
    setDocumentoValidado(null);
    setDatosAPI(null);
    setCreacionManual(false);
    setObservacionCambio('');
    setCondicionCambioDetectado(false);
  };

  const abrirModalSolicitudCredito = (cliente) => {
    if (tieneSolicitud(cliente)) {
      setError(`El cliente ${cliente.razon_social} ya tiene una solicitud en proceso.`);
      return;
    }
    setClienteParaSolicitud(cliente);
    setArchivoSustento(null);
    setSolicitudData({
      limite_credito_pen_solicitado: parseFloat(cliente.limite_credito_pen || 0),
      limite_credito_usd_solicitado: parseFloat(cliente.limite_credito_usd || 0),
      limite_credito_pen_actual: parseFloat(cliente.limite_credito_pen || 0),
      limite_credito_usd_actual: parseFloat(cliente.limite_credito_usd || 0),
      justificacion: ''
    });
    setModalSolicitudOpen(true);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const fecha = new Date().toISOString().replace(/[:.]/g, '-');
        const file = new File([blob], `sustento_${fecha}.png`, { type: blob.type });
        setArchivoSustento(file);
        e.preventDefault();
        return;
      }
    }
  };

  const handleSubmitSolicitud = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('id_cliente', clienteParaSolicitud.id_cliente);
      formDataToSend.append('limite_credito_pen_solicitado', solicitudData.limite_credito_pen_solicitado);
      formDataToSend.append('limite_credito_usd_solicitado', solicitudData.limite_credito_usd_solicitado);
      formDataToSend.append('usar_limite_credito', true);
      formDataToSend.append('justificacion', solicitudData.justificacion);
      if (archivoSustento) {
        formDataToSend.append('archivo_sustento', archivoSustento);
      }
      await solicitudesCreditoAPI.create(formDataToSend);
      setSuccess('Solicitud de crédito enviada exitosamente. Pendiente de aprobación.');
      setModalSolicitudOpen(false);
      setClienteParaSolicitud(null);
      setArchivoSustento(null);
      cerrarModal();
      setDetalle(null);
      cargarClientes({ silencioso: true });
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
          nuevosValores.ubigeo = response.data.datos.ubigeo || '';
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

  const activarModoManual = () => {
    setCreacionManual(true);
    setFormData({ ...formData, validar_documento: false });
    setDocumentoValidado(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (formData.condicion_pago === 'Credito' && (!formData.dias_credito || parseInt(formData.dias_credito) <= 0)) {
      setError('Debe indicar los días de crédito');
      return;
    }

    const dataToSend = {
      ...formData,
      tipo_documento: formData.tipo_documento || 'RUC',
      usar_limite_credito: formData.usar_limite_credito ? 1 : 0,
      creacion_manual: creacionManual,
      condicion_pago: formData.condicion_pago,
      dias_credito: formData.condicion_pago === 'Credito' ? parseInt(formData.dias_credito || 0) : 0,
      limite_credito_pen: editando ? parseFloat(formData.limite_credito_pen || 0) : 0,
      limite_credito_usd: editando ? parseFloat(formData.limite_credito_usd || 0) : 0
    };

    if (editando && condicionCambioDetectado) {
      dataToSend.id_empleado = user?.id;
      dataToSend.observacion_condicion = observacionCambio || null;
    }

    try {
      if (editando) {
        await clientesAPI.update(editando.id_cliente, dataToSend);
        setSuccess('Cliente actualizado exitosamente');
      } else {
        const response = await clientesAPI.create(dataToSend);
        const nuevoClienteId = response.data.data.id_cliente;
        if (formData.usar_limite_credito && (parseFloat(formData.limite_credito_pen) > 0 || parseFloat(formData.limite_credito_usd) > 0)) {
          const solicitudFormData = new FormData();
          solicitudFormData.append('id_cliente', nuevoClienteId);
          solicitudFormData.append('limite_credito_pen_solicitado', parseFloat(formData.limite_credito_pen || 0));
          solicitudFormData.append('limite_credito_usd_solicitado', parseFloat(formData.limite_credito_usd || 0));
          solicitudFormData.append('usar_limite_credito', true);
          solicitudFormData.append('justificacion', 'Solicitud inicial al crear cliente');
          await solicitudesCreditoAPI.create(solicitudFormData);
          setSuccess('Cliente creado y solicitud de crédito enviada exitosamente');
        } else {
          setSuccess('Cliente creado exitosamente');
        }
      }
      cerrarModal();
      setDetalle(null);
      cargarClientes({ silencioso: true });
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
      setDetalle(null);
      cargarClientes({ silencioso: true });
    } catch (err) {
      setError(err.error || 'Error al desactivar cliente');
    }
  };

  const handleTipoDocumentoChange = (nuevoTipo) => {
    setFormData({ ...formData, tipo_documento: nuevoTipo, ruc: '' });
    setDocumentoValidado(null);
    setDatosAPI(null);
  };

  const termino = busqueda.trim().toLowerCase();
  const clientesFiltrados = clientes.filter(c => {
    if (filtroKpi && !FILTROS_KPI[filtroKpi](c)) return false;
    if (filtroTipo && (c.tipo_documento || 'RUC') !== filtroTipo) return false;
    if (!termino) return true;
    return incluye(c.razon_social, termino) || incluye(c.ruc, termino) || incluye(c.contacto, termino)
      || incluye(c.email, termino) || incluye(c.telefono, termino) || incluye(c.comerciales_asignados, termino);
  });

  const { currentItems, setCurrentPage, ...paginacion } = usePagination(clientesFiltrados, { storageKey: 'clientes_pagina' });
  useResetPagina(setCurrentPage, [busqueda, filtroKpi, filtroTipo, filtroAtencion]);

  const hayFiltros = !!(busqueda || filtroKpi || filtroTipo || filtroAtencion !== 'todos');
  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroKpi('');
    setFiltroTipo('');
    setFiltroAtencion('todos');
  };

  if (loading) return <Loading variant="table" />;

  const activos = clientes.filter(FILTROS_KPI.activos).length;
  const conDeuda = clientes.filter(tieneDeuda);
  const saldoPen = conDeuda.reduce((s, c) => s + parseFloat(c.saldo_pen || 0), 0);
  const saldoUsd = conDeuda.reduce((s, c) => s + parseFloat(c.saldo_usd || 0), 0);
  const conVencidos = clientes.filter(FILTROS_KPI.vencidos);
  const ordenesVencidas = conVencidos.reduce((s, c) => s + Number(c.ordenes_vencidas || 0), 0);
  const conLinea = clientes.filter(usaLimiteCredito).length;
  const solicitudes = clientes.filter(tieneSolicitud).length;

  const kpis = verFinanzas ? [
    { id: 'activos', label: 'Activos', tono: 'is-success', icon: CheckCircle, valor: activos, foot: `de ${clientes.length} clientes` },
    { id: 'deuda', label: 'Por cobrar', tono: 'is-warning', icon: Wallet, valor: fmtMonto(saldoPen), foot: `${fmtMonto(saldoUsd, 'USD')} · ${conDeuda.length} clientes` },
    { id: 'vencidos', label: 'Con vencidos', tono: 'is-danger', icon: AlertTriangle, valor: conVencidos.length, foot: `${ordenesVencidas} órdenes vencidas` },
    { id: 'credito', label: 'Línea de crédito', tono: 'is-info', icon: CreditCard, valor: conLinea, foot: `${solicitudes} solicitudes pendientes` }
  ] : [
    { id: 'activos', label: 'Activos', tono: 'is-success', icon: CheckCircle, valor: activos, foot: `de ${clientes.length} clientes` },
    { id: 'inactivos', label: 'Inactivos', tono: '', icon: Ban, valor: clientes.length - activos },
    { id: 'credito', label: 'Línea de crédito', tono: 'is-info', icon: CreditCard, valor: conLinea },
    { id: 'solicitud', label: 'Solicitudes pendientes', tono: 'is-warning', icon: Hourglass, valor: solicitudes }
  ];
  const chipsExtra = verFinanzas ? [
    { id: 'solicitud', label: 'Solicitud pendiente', icon: Hourglass, valor: solicitudes },
    { id: 'inactivos', label: 'Inactivos', icon: Ban, valor: clientes.length - activos }
  ] : [];
  const etiquetaFiltro = (id) => kpis.find(k => k.id === id)?.label || chipsExtra.find(k => k.id === id)?.label;

  const columnas = 7 + (verFinanzas ? 1 : 0);

  const renderDrawer = () => {
    const c = detalle;
    const desglose = desgloseOrdenes(c.ordenes_desglose);
    const linea = usaLimiteCredito(c);
    return (
      <PgDrawer
        eyebrow={<><Users size={12} /> Cliente</>}
        title={c.razon_social}
        badges={(
          <>
            <BadgeTipoDocumento tipo={c.tipo_documento || 'RUC'} />
            <BadgeEstadoRegistro estado={c.estado} />
            <BadgeCreditoCliente cliente={c} />
          </>
        )}
        onClose={() => setDetalle(null)}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={() => abrirModal(c)}>
              <Pencil size={16} /> Editar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/clientes/${c.id_cliente}`)}>
              <ExternalLink size={16} /> Abrir ficha
            </button>
          </>
        )}
      >
        <section>
          <h3 className="pg-section-title"><User size={14} /> Datos de contacto</h3>
          <div className="pg-kv">
            <div><span>{c.tipo_documento || 'RUC'}</span><strong className="pg-code">{c.ruc}</strong></div>
            <div><span>Contacto</span><strong>{c.contacto || '—'}</strong></div>
            <div><span>Teléfono</span><strong>{c.telefono || '—'}</strong></div>
            <div><span>Email</span><strong>{c.email || '—'}</strong></div>
            <div className="wide"><span>Dirección principal</span><strong>{c.direccion_despacho || '—'}{c.ubigeo ? ` · Ubigeo ${c.ubigeo}` : ''}</strong></div>
            <div className="wide"><span>Comercial asignado</span><strong>{c.comerciales_asignados || 'Sin cartera asignada'}</strong></div>
          </div>
        </section>

        <section>
          <h3 className="pg-section-title"><CreditCard size={14} /> Condición y crédito</h3>
          <div className="pg-kv">
            <div><span>Condición de pago</span><strong><BadgeCondicionPago condicion={c.condicion_pago} dias={c.dias_credito} /></strong></div>
            <div><span>Línea de crédito</span><strong>{linea ? 'Habilitada' : 'Sin línea'}</strong></div>
          </div>
          {linea && (
            credito.loading ? (
              <div className="pg-loading"><Loader size={20} className="animate-spin" /></div>
            ) : credito.data ? (
              <div className="pg-measures">
                <MedidorCredito titulo="Soles" linea={credito.data.credito_pen} moneda="PEN" />
                <MedidorCredito titulo="Dólares" linea={credito.data.credito_usd} moneda="USD" />
              </div>
            ) : null
          )}
          {tieneSolicitud(c) ? (
            <p className="ms-status is-warning"><Hourglass size={15} /> Hay una solicitud de crédito pendiente de aprobación.</p>
          ) : (
            <div className="ms-actions-end">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => abrirModalSolicitudCredito(c)}>
                <CreditCard size={14} /> {linea ? 'Solicitar cambio de límite' : 'Solicitar activación de crédito'}
              </button>
            </div>
          )}
        </section>

        {verFinanzas && (
          <section>
            <h3 className="pg-section-title"><Wallet size={14} /> Cobranza</h3>
            <div className="pg-kv">
              <div><span>Saldo en soles</span><strong>{fmtMonto(c.saldo_pen)}</strong></div>
              <div><span>Saldo en dólares</span><strong>{fmtMonto(c.saldo_usd, 'USD')}</strong></div>
              <div><span>Órdenes por cobrar</span><strong>{c.ordenes_por_cobrar || 0}</strong></div>
              <div>
                <span>Vencidas</span>
                <strong>
                  {Number(c.ordenes_vencidas) > 0
                    ? <span className="badge badge-danger"><AlertTriangle size={11} />{c.ordenes_vencidas} vencidas</span>
                    : 'Ninguna'}
                </strong>
              </div>
            </div>
          </section>
        )}

        <section>
          <h3 className="pg-section-title"><Activity size={14} /> Actividad comercial</h3>
          <div className="pg-kv">
            <div><span>Órdenes de venta</span><strong>{c.total_ordenes || 0}</strong></div>
            <div><span>Atenciones</span><strong>{c.atenciones || 0}</strong></div>
            <div><span>Última venta</span><strong>{fmtFecha(c.ultima_venta)}{c.ultima_venta ? ` · ${haceTexto(c.ultima_venta)}` : ''}</strong></div>
          </div>
          {desglose.length > 0 && (
            <div className="pg-tags">
              {desglose.map(d => <span key={d.estado} className="pg-tag">{d.estado} <b>{d.cantidad}</b></span>)}
            </div>
          )}
        </section>
      </PgDrawer>
    );
  };

  return (
    <div className="pg-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Users size={13} /> Maestros</span>
          <h1 className="pg-title">Clientes</h1>
          <p className="pg-subtitle">
            <b>{clientes.length}</b> clientes · <b>{clientes.filter(c => (c.tipo_documento || 'RUC') === 'RUC').length}</b> empresas ·
            {' '}<b>{clientes.filter(c => c.tipo_documento === 'DNI').length}</b> personas naturales
          </p>
        </div>
        <div className="pg-actions">
          <button type="button" className="btn btn-outline" onClick={() => cargarClientes({ silencioso: true })} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => abrirModal()}>
            <Plus size={16} /> Nuevo cliente
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
                <span className="pg-kpi-foot">{activo ? 'Filtro activo · pulsa para quitar' : (k.foot || 'Pulsa para filtrar')}</span>
              </button>
            );
          })}
        </div>

        <section className="pg-panel">
          <div className="pg-filters">
            <div className="pg-filters-row">
              <div className="pg-field pg-field-grow pg-search">
                <label className="pg-field-label" htmlFor="ms-cli-busqueda">Buscar</label>
                <Search size={14} />
                <input id="ms-cli-busqueda" type="search" className="form-input" placeholder="Razón social, documento, contacto o comercial"
                  value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </div>
              <div className="pg-field">
                <span className="pg-field-label">Tipo</span>
                <div className="pg-segmented" role="radiogroup" aria-label="Tipo de cliente">
                  {OPCIONES_TIPO.map(op => {
                    const Icono = op.icon;
                    return (
                      <button key={op.label} type="button" role="radio" aria-checked={filtroTipo === op.id}
                        className={filtroTipo === op.id ? 'active' : ''} onClick={() => setFiltroTipo(op.id)}>
                        {Icono && <Icono size={13} />}{op.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="pg-field">
                <span className="pg-field-label">Atención</span>
                <div className="pg-segmented" role="radiogroup" aria-label="Atención" title="Con atención: órdenes despachadas, en despacho parcial o entregadas">
                  {OPCIONES_ATENCION.map(op => (
                    <button key={op.id} type="button" role="radio" aria-checked={filtroAtencion === op.id}
                      className={filtroAtencion === op.id ? 'active' : ''} onClick={() => setFiltroAtencion(op.id)}>
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {(chipsExtra.length > 0 || hayFiltros) && (
              <div className="pg-chips">
                {chipsExtra.map(ch => {
                  const Icono = ch.icon;
                  const on = filtroKpi === ch.id;
                  return (
                    <button key={ch.id} type="button" className={`pg-chip ${on ? 'on' : ''}`} aria-pressed={on}
                      onClick={() => setFiltroKpi(on ? '' : ch.id)}>
                      <Icono size={14} /> {ch.label} <b>{ch.valor}</b>
                    </button>
                  );
                })}
                {filtroKpi && !chipsExtra.some(ch => ch.id === filtroKpi) && (
                  <button type="button" className="pg-chip on" onClick={() => setFiltroKpi('')}>
                    {etiquetaFiltro(filtroKpi)} <X size={13} />
                  </button>
                )}
                {hayFiltros && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={limpiarFiltros}>
                    <X size={14} /> Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="pg-panel">
          <div className="pg-panel-head">
            <h2 className="pg-panel-title"><Users size={16} /> Clientes <span className="pg-count">{clientesFiltrados.length}</span></h2>
            <span className="pg-panel-meta">Pulsa una fila para ver el detalle rápido</span>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Comercial</th>
                  <th>Condición y crédito</th>
                  {verFinanzas && <th className="num">Por cobrar</th>}
                  <th>Actividad</th>
                  <th className="center">Estado</th>
                  <th className="center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? currentItems.map(c => {
                  const linea = usaLimiteCredito(c);
                  return (
                    <tr key={c.id_cliente} className="is-clickable" onClick={() => setDetalle(c)}>
                      <td style={{ minWidth: 230 }}>
                        <span className="pg-cell-main">{c.razon_social}</span>
                        <div className="pg-tags">
                          <BadgeTipoDocumento tipo={c.tipo_documento || 'RUC'} />
                          <span className="pg-code">{c.ruc}</span>
                        </div>
                      </td>
                      <td>
                        {c.contacto || c.telefono || c.email ? (
                          <div className="ms-lines">
                            {c.contacto && <span><User size={12} /><b>{c.contacto}</b></span>}
                            {c.telefono && <span><Phone size={12} />{c.telefono}</span>}
                            {c.email && <span><Mail size={12} /><span className="pg-truncate">{c.email}</span></span>}
                          </div>
                        ) : <span className="pg-muted">Sin datos</span>}
                      </td>
                      <td>
                        {c.comerciales_asignados
                          ? <span className="pg-cell-main"><Megaphone size={12} className="pg-muted" />{c.comerciales_asignados}</span>
                          : <span className="pg-muted">Sin asignar</span>}
                      </td>
                      <td className="nowrap">
                        <BadgeCondicionPago condicion={c.condicion_pago} dias={c.dias_credito} />
                        {linea
                          ? <span className="pg-cell-sub">Límite {fmtMonto(c.limite_credito_pen)} · {fmtMonto(c.limite_credito_usd, 'USD')}</span>
                          : <span className="pg-cell-sub">Sin línea de crédito</span>}
                        {tieneSolicitud(c) && (
                          <div className="pg-tags"><span className="pg-tag is-warning"><Hourglass size={11} />Solicitud pendiente</span></div>
                        )}
                      </td>
                      {verFinanzas && (
                        <td className="num">
                          {tieneDeuda(c) ? (
                            <>
                              {parseFloat(c.saldo_pen) > 0.009 && <span className="pg-money">{fmtMonto(c.saldo_pen)}</span>}
                              {parseFloat(c.saldo_usd) > 0.009 && <span className="pg-money">{fmtMonto(c.saldo_usd, 'USD')}</span>}
                              {Number(c.ordenes_vencidas) > 0 && (
                                <div className="pg-tags">
                                  <span className="pg-tag is-danger"><AlertTriangle size={11} />{c.ordenes_vencidas} vencidas</span>
                                </div>
                              )}
                            </>
                          ) : <span className="pg-muted">Al día</span>}
                        </td>
                      )}
                      <td className="nowrap">
                        <AtencionesBadge atenciones={c.atenciones} totalOrdenes={c.total_ordenes} desglose={c.ordenes_desglose} />
                        <span className="pg-cell-sub">
                          {c.ultima_venta
                            ? <><CalendarDays size={11} />Última venta {haceTexto(c.ultima_venta)}</>
                            : 'Sin ventas'}
                        </span>
                      </td>
                      <td className="center"><BadgeEstadoRegistro estado={c.estado} /></td>
                      <td className="center" onClick={(e) => e.stopPropagation()}>
                        <div className="pg-rowactions">
                          <button type="button" className="pg-iconbtn" title="Abrir ficha e historial" aria-label={`Abrir ficha de ${c.razon_social}`}
                            onClick={() => navigate(`/clientes/${c.id_cliente}`)}>
                            <Eye size={15} />
                          </button>
                          <button type="button" className="pg-iconbtn" title="Editar" aria-label={`Editar ${c.razon_social}`} onClick={() => abrirModal(c)}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" className="pg-iconbtn is-danger" title="Desactivar" aria-label={`Desactivar ${c.razon_social}`}
                            disabled={c.estado === 'Inactivo'} onClick={() => handleDelete(c.id_cliente)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={columnas}>
                      <div className="pg-empty">
                        <Users size={28} />
                        <strong>{hayFiltros ? 'Ningún cliente coincide con los filtros' : 'Aún no hay clientes registrados'}</strong>
                        <span>{hayFiltros ? 'Quita algún filtro o cambia la búsqueda.' : 'Registra un cliente validando su RUC o DNI.'}</span>
                        {hayFiltros
                          ? <button type="button" className="btn btn-outline btn-sm" onClick={limpiarFiltros}><X size={14} /> Limpiar filtros</button>
                          : <button type="button" className="btn btn-primary btn-sm" onClick={() => abrirModal()}><Plus size={14} /> Nuevo cliente</button>}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PgPager {...paginacion} setCurrentPage={setCurrentPage} sustantivo="clientes" />
        </section>
      </div>

      {detalle && renderDrawer()}

      <Modal isOpen={modalOpen} onClose={cerrarModal} title={editando ? 'Editar cliente' : 'Nuevo cliente'} size="lg">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <span className="form-label">Tipo de documento *</span>
            <div className="ms-choice" role="radiogroup" aria-label="Tipo de documento">
              <button type="button" role="radio" aria-checked={formData.tipo_documento === 'RUC'}
                className={`btn ${formData.tipo_documento === 'RUC' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => handleTipoDocumentoChange('RUC')} disabled={!!editando}>
                <Building2 size={18} /> Empresa (RUC)
              </button>
              <button type="button" role="radio" aria-checked={formData.tipo_documento === 'DNI'}
                className={`btn ${formData.tipo_documento === 'DNI' ? 'btn-info' : 'btn-outline'}`}
                onClick={() => handleTipoDocumentoChange('DNI')} disabled={!!editando}>
                <User size={18} /> Persona natural (DNI)
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ms-cli-doc">{formData.tipo_documento === 'RUC' ? 'RUC' : 'DNI'} *</label>
            <div className="ms-inline">
              <input id="ms-cli-doc" type="text" className="form-input" value={formData.ruc}
                onChange={(e) => { setFormData({ ...formData, ruc: e.target.value }); setDocumentoValidado(null); }}
                required maxLength={formData.tipo_documento === 'RUC' ? 11 : 8} />
              {!creacionManual && (
                <button type="button" className="btn btn-outline" onClick={validarDocumento} disabled={validandoDocumento || !formData.ruc}>
                  {validandoDocumento
                    ? <><Loader size={16} className="animate-spin" /> Validando...</>
                    : <>{formData.tipo_documento === 'RUC' ? <Building2 size={16} /> : <User size={16} />} Validar {formData.tipo_documento}</>}
                </button>
              )}
            </div>
            {!editando && !creacionManual && (
              <button type="button" className="ms-link" onClick={activarModoManual}>
                <Pencil size={12} /> Ingresar manualmente (sin validación API)
              </button>
            )}
            {documentoValidado === true && <div className="ms-status is-ok"><CheckCircle size={16} /> Validado correctamente</div>}
            {documentoValidado === false && <div className="ms-status is-error"><AlertCircle size={16} /> No válido</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ms-cli-razon">{formData.tipo_documento === 'RUC' ? 'Razón social' : 'Nombre completo'} *</label>
            <input id="ms-cli-razon" type="text" className="form-input" value={formData.razon_social}
              onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })} required />
          </div>

          <div className="pg-form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="ms-cli-contacto">Contacto</label>
              <input id="ms-cli-contacto" type="text" className="form-input" value={formData.contacto}
                onChange={(e) => setFormData({ ...formData, contacto: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ms-cli-telefono">Teléfono</label>
              <input id="ms-cli-telefono" type="text" className="form-input" value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ms-cli-email">Email</label>
            <input id="ms-cli-email" type="email" className="form-input" value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ms-cli-direccion">Dirección principal</label>
            <textarea id="ms-cli-direccion" className="form-textarea" value={formData.direccion_despacho}
              onChange={(e) => setFormData({ ...formData, direccion_despacho: e.target.value })}
              rows={3} placeholder="Dirección principal de entrega" />
            <small className="pg-hint"><MapPin size={11} />Las direcciones adicionales se gestionan desde la ficha del cliente.</small>
          </div>

          {formData.direccion_despacho && (
            <div className="form-group">
              <span className="form-label">Ubigeo de la dirección principal *</span>
              <UbigeoSelector value={formData.ubigeo} onChange={(codigo) => setFormData({ ...formData, ubigeo: codigo })} required />
              <small className="pg-hint">Este código se reutilizará como ubigeo de llegada al emitir la guía.</small>
            </div>
          )}

          <div className="ms-box">
            <h3 className="pg-section-title"><Clock size={14} /> Condición de pago predeterminada</h3>
            <div className="ms-choice" role="radiogroup" aria-label="Condición de pago">
              <button type="button" role="radio" aria-checked={formData.condicion_pago === 'Contado'}
                className={`btn ${formData.condicion_pago === 'Contado' ? 'btn-success' : 'btn-outline'}`}
                onClick={() => setFormData({ ...formData, condicion_pago: 'Contado', dias_credito: 0 })}>
                Contado
              </button>
              <button type="button" role="radio" aria-checked={formData.condicion_pago === 'Credito'}
                className={`btn ${formData.condicion_pago === 'Credito' ? 'btn-warning' : 'btn-outline'}`}
                onClick={() => setFormData({ ...formData, condicion_pago: 'Credito' })}
                disabled={!formData.usar_limite_credito}
                title={!formData.usar_limite_credito ? 'El cliente debe tener límite de crédito habilitado' : ''}>
                Crédito
              </button>
            </div>

            {!formData.usar_limite_credito && (
              <small className="pg-hint">La opción Crédito solo está disponible para clientes con límite de crédito habilitado.</small>
            )}

            {formData.condicion_pago === 'Credito' && (
              <div className="ms-box-sep">
                <label className="form-label" htmlFor="ms-cli-dias">Días de crédito *</label>
                <div className="ms-days">
                  {[7, 15, 30, 45, 60, 90].map(dias => (
                    <button key={dias} type="button" aria-pressed={formData.dias_credito === dias}
                      className={`btn btn-xs ${formData.dias_credito === dias ? 'btn-warning' : 'btn-outline'}`}
                      onClick={() => setFormData({ ...formData, dias_credito: dias })}>
                      {dias} días
                    </button>
                  ))}
                </div>
                <input id="ms-cli-dias" type="number" className="form-input" placeholder="Otro valor en días..."
                  value={formData.dias_credito || ''} min="1"
                  onChange={(e) => setFormData({ ...formData, dias_credito: parseInt(e.target.value) || 0 })} />
              </div>
            )}

            {editando && condicionCambioDetectado && (
              <div className="ms-box-sep">
                <p className="ms-status is-warning"><AlertCircle size={14} /> Se detectó un cambio en la condición comercial</p>
                <div className="ms-change">
                  <span>Antes: <b>{condicionOriginal.condicion_pago === 'Credito' ? `Crédito ${condicionOriginal.dias_credito} días` : 'Contado'}</b></span>
                  <span aria-hidden="true">→</span>
                  <span>Ahora: <b>{formData.condicion_pago === 'Credito' ? `Crédito ${formData.dias_credito} días` : 'Contado'}</b></span>
                </div>
                <label className="form-label" htmlFor="ms-cli-motivo">Motivo del cambio (opcional)</label>
                <textarea id="ms-cli-motivo" className="form-textarea" rows={2}
                  placeholder="Ej. Acuerdo comercial, ampliación de línea, renegociación..."
                  value={observacionCambio} onChange={(e) => setObservacionCambio(e.target.value)} />
              </div>
            )}
          </div>

          <div className="ms-box">
            <label className="pg-check">
              <input type="checkbox" checked={formData.usar_limite_credito} disabled={!!editando}
                onChange={(e) => {
                  const nuevoValor = e.target.checked;
                  setFormData({
                    ...formData,
                    usar_limite_credito: nuevoValor,
                    condicion_pago: !nuevoValor ? 'Contado' : formData.condicion_pago,
                    dias_credito: !nuevoValor ? 0 : formData.dias_credito
                  });
                }} />
              <div>
                <span><CreditCard size={15} />Usar límite de crédito</span>
                <small>{formData.usar_limite_credito ? 'El cliente tendrá límites de crédito (requiere aprobación).' : 'El cliente puede realizar compras sin límite de crédito.'}</small>
              </div>
            </label>

            {editando ? (
              <div className="ms-box-sep">
                <div className="ms-note is-info">
                  <Info size={16} />
                  <div>
                    <strong>Límites actuales (solo lectura)</strong>
                    <div className="ms-figures">
                      <div className="ms-figure"><span>Soles</span><b>{fmtMonto(formData.limite_credito_pen)}</b></div>
                      <div className="ms-figure"><span>Dólares</span><b>{fmtMonto(formData.limite_credito_usd, 'USD')}</b></div>
                    </div>
                  </div>
                </div>
                <button type="button" className="btn btn-outline ms-block" onClick={() => abrirModalSolicitudCredito(editando)}
                  disabled={tieneSolicitud(editando)}>
                  {tieneSolicitud(editando) ? <Hourglass size={16} /> : <CreditCard size={16} />}
                  {tieneSolicitud(editando)
                    ? 'Solicitud en proceso'
                    : !formData.usar_limite_credito
                      ? 'Solicitar activación de crédito'
                      : 'Solicitar cambio de límite'}
                </button>
              </div>
            ) : (
              formData.usar_limite_credito && (
                <div className="ms-box-sep">
                  <div className="ms-note is-info">
                    <Info size={16} />
                    <p>Estos límites se enviarán como una solicitud de crédito automática para aprobación.</p>
                  </div>
                  <div className="pg-form-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor="ms-cli-lim-pen">Límite en soles (S/)</label>
                      <input id="ms-cli-lim-pen" type="number" className="form-input" value={formData.limite_credito_pen}
                        onChange={(e) => setFormData({ ...formData, limite_credito_pen: e.target.value })} min="0" step="0.01" placeholder="0.00" />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="ms-cli-lim-usd">Límite en dólares ($)</label>
                      <input id="ms-cli-lim-usd" type="number" className="form-input" value={formData.limite_credito_usd}
                        onChange={(e) => setFormData({ ...formData, limite_credito_usd: e.target.value })} min="0" step="0.01" placeholder="0.00" />
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ms-cli-estado">Estado *</label>
            <select id="ms-cli-estado" className="form-select" value={formData.estado}
              onChange={(e) => setFormData({ ...formData, estado: e.target.value })} required>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
          </div>

          <div className="ms-actions-end">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{editando ? 'Actualizar' : 'Crear'} cliente</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={modalSolicitudOpen}
        onClose={() => setModalSolicitudOpen(false)}
        title={!usaLimiteCredito(clienteParaSolicitud) ? 'Solicitar activación de crédito' : 'Solicitar cambio de límite'}
      >
        {clienteParaSolicitud && (
          <form onSubmit={handleSubmitSolicitud}>
            <div className="ms-box">
              <span className="pg-cell-main">{clienteParaSolicitud.razon_social}</span>
              <span className="pg-cell-sub">{clienteParaSolicitud.tipo_documento || 'RUC'}: {clienteParaSolicitud.ruc}</span>
            </div>

            <div className="ms-box">
              <h3 className="pg-section-title"><CreditCard size={14} /> Límites actuales</h3>
              <div className="ms-figures">
                <div className="ms-figure"><span>Soles</span><b>{fmtMonto(clienteParaSolicitud.limite_credito_pen)}</b></div>
                <div className="ms-figure"><span>Dólares</span><b>{fmtMonto(clienteParaSolicitud.limite_credito_usd, 'USD')}</b></div>
              </div>
            </div>

            <h3 className="pg-section-title">Nuevos límites solicitados</h3>
            <div className="pg-form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="ms-sol-pen">Límite en soles (S/) *</label>
                <input id="ms-sol-pen" type="number" className="form-input" value={solicitudData.limite_credito_pen_solicitado}
                  onChange={(e) => setSolicitudData({ ...solicitudData, limite_credito_pen_solicitado: e.target.value })} min="0" step="0.01" required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ms-sol-usd">Límite en dólares ($) *</label>
                <input id="ms-sol-usd" type="number" className="form-input" value={solicitudData.limite_credito_usd_solicitado}
                  onChange={(e) => setSolicitudData({ ...solicitudData, limite_credito_usd_solicitado: e.target.value })} min="0" step="0.01" required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="ms-sol-just">Justificación *</label>
              <textarea id="ms-sol-just" className="form-textarea" value={solicitudData.justificacion}
                onChange={(e) => setSolicitudData({ ...solicitudData, justificacion: e.target.value })}
                rows={4} placeholder="Explique por qué se necesita este crédito..." required />
            </div>

            <div className="form-group">
              <span className="form-label">Archivo de sustento (opcional)</span>
              <div className="ms-inline">
                <div className={`ms-drop ${archivoSustento ? 'is-ok' : ''}`} tabIndex="0" onPaste={handlePaste}
                  title="Haz clic aquí y presiona Ctrl+V para pegar una captura">
                  {archivoSustento
                    ? <><CheckCircle size={16} /><span>{archivoSustento.name}</span></>
                    : <span>Haz clic aquí y pulsa <b>Ctrl+V</b> para pegar una imagen</span>}
                </div>
                <button type="button" className="btn btn-outline ms-upload" onClick={() => inputArchivoRef.current?.click()}
                  title="Abrir explorador de archivos">
                  <FilePlus size={20} />
                  <small>Subir</small>
                </button>
                <input ref={inputArchivoRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setArchivoSustento(e.target.files[0])} />
              </div>
            </div>

            <div className="ms-actions-end">
              <button type="button" className="btn btn-outline" onClick={() => setModalSolicitudOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Enviar solicitud</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default Clientes;
