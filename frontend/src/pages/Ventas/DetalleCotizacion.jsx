import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Edit, Download, FileText, Calendar,
  Building, AlertCircle,
  CheckCircle, XCircle, Calculator, Percent,
  AlertTriangle, User, CreditCard, Package, MapPin, Copy, ExternalLink, Lock,
  ChevronLeft, ChevronRight, Save, FlaskConical, Flag,
  DollarSign, ArrowRightLeft, RefreshCcw, Clock
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { cotizacionesAPI, clientesAPI, tipoCambioAPI } from '../../config/api';
import { usePermisos } from '../../context/PermisosContext';
import { BadgeEstadoCotizacion, configEstadoCotizacion } from './estadosVentas';
import './Ventas.css';

const TC_SESSION_KEY = 'indpack_tipo_cambio';

function DetalleCotizacion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { rol } = usePermisos();
  const esAdmin = rol === 'Administrador';
  
  const [cotizacion, setCotizacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalPrioridadOpen, setModalPrioridadOpen] = useState(false);
  const [estadoCredito, setEstadoCredito] = useState(null);
  const [navInfo, setNavInfo] = useState({ prev: null, next: null, current: 0, total: 0 });
  
  const [modalRectificarOpen, setModalRectificarOpen] = useState(false);
  const [productoRectificar, setProductoRectificar] = useState(null);
  const [rectificarForm, setRectificarForm] = useState({ nueva_cantidad: '', motivo: '' });
  const [procesando, setProcesando] = useState(false);

  const [tipoCambio, setTipoCambio] = useState(null);
  const [loadingTC, setLoadingTC] = useState(false);

  const handleWheelDisable = (e) => {
    e.target.blur();
  };

  useEffect(() => {
    cargarDatos();
    cargarNavegacion();
    cargarTCDesdeSession();
  }, [id]);

  const cargarTCDesdeSession = () => {
    try {
      const cached = localStorage.getItem(TC_SESSION_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
        const fechaCache = new Date(new Date(data.timestamp).toLocaleString('en-US', { timeZone: 'America/Lima' }));
        if (
          ahora.getFullYear() === fechaCache.getFullYear() &&
          ahora.getMonth() === fechaCache.getMonth() &&
          ahora.getDate() === fechaCache.getDate()
        ) {
          setTipoCambio(data);
        } else {
          localStorage.removeItem(TC_SESSION_KEY);
        }
      }
    } catch (e) {
      console.error('Error leyendo TC de sesión:', e);
    }
  };

  const actualizarTipoCambio = async () => {
    setLoadingTC(true);
    setError(null);
    try {
      const response = await tipoCambioAPI.actualizar();
      if (response.data.valido) {
        const tcData = {
          compra: response.data.compra,
          venta: response.data.venta,
          promedio: response.data.promedio,
          fecha: response.data.fecha,
          timestamp: Date.now()
        };
        localStorage.setItem(TC_SESSION_KEY, JSON.stringify(tcData));
        setTipoCambio(tcData);
        setSuccess(`TC actualizado: S/ ${tcData.venta} (venta) — SUNAT: ${formatearFecha(tcData.fecha)}`);
      } else {
        localStorage.removeItem(TC_SESSION_KEY);
        setTipoCambio(null);
        setError(response.data.error || 'No se pudo obtener el tipo de cambio');
      }
    } catch (err) {
      console.error('Error actualizando TC:', err);
      setError('Error al consultar tipo de cambio. Intente más tarde.');
    } finally {
      setLoadingTC(false);
    }
  };

  const obtenerEdadTC = () => {
    if (!tipoCambio?.timestamp) return null;
    const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const finDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
    const restanteMs = finDia - ahora;
    const horasRestantes = Math.floor(restanteMs / 3600000);
    const minutosRestantes = Math.floor((restanteMs % 3600000) / 60000);
    if (horasRestantes > 0) return `Válido por ${horasRestantes}h ${minutosRestantes}min`;
    if (minutosRestantes > 0) return `Válido por ${minutosRestantes} min`;
    return 'Expira pronto';
  };

  const cargarNavegacion = async () => {
    try {
      const params = new URLSearchParams(location.search);
      const estado = params.get('estado');
      const busqueda = params.get('busqueda');
      
      const filtros = {};
      if (estado) filtros.estado = estado;
      
      const response = await cotizacionesAPI.getAll(filtros);
      if (response.data.success) {
        let lista = response.data.data;
        
        if (busqueda) {
          const term = busqueda.toLowerCase();
          lista = lista.filter(c => 
            c.numero_cotizacion?.toLowerCase().includes(term) ||
            c.cliente?.toLowerCase().includes(term) ||
            c.ruc_cliente?.toLowerCase().includes(term) ||
            c.comercial?.toLowerCase().includes(term)
          );
        }
        
        const currentIndex = lista.findIndex(c => String(c.id_cotizacion) === String(id));
        if (currentIndex !== -1) {
          setNavInfo({
            prev: currentIndex > 0 ? lista[currentIndex - 1].id_cotizacion : null,
            next: currentIndex < lista.length - 1 ? lista[currentIndex + 1].id_cotizacion : null,
            current: currentIndex + 1,
            total: lista.length
          });
        }
      }
    } catch (err) {
      console.error('Error cargando navegacion', err);
    }
  };

  const handleNavegar = (nuevoId) => {
    if (nuevoId) {
      const queryString = location.search;
      navigate(`/ventas/cotizaciones/${nuevoId}${queryString}`);
    }
  };

  const handleVolverListado = () => {
    navigate(-1);
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await cotizacionesAPI.getById(id);
      
      if (response.data.success) {
        setCotizacion(response.data.data);
        
        const creditoRes = await clientesAPI.getEstadoCredito(response.data.data.id_cliente);
        if (creditoRes.data.success) {
          setEstadoCredito(creditoRes.data.data);
        }
      } else {
        setError('Cotizacion no encontrada');
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar la cotizacion');
    } finally {
      setLoading(false);
    }
  };

  const handleRectificarCantidad = async (e) => {
    e.preventDefault();
    if (!productoRectificar) return;

    try {
      setProcesando(true);
      setError(null);

      const response = await cotizacionesAPI.rectificarCantidad(id, {
        id_producto: productoRectificar.id_producto,
        nueva_cantidad: parseFloat(rectificarForm.nueva_cantidad),
        motivo: rectificarForm.motivo
      });

      if (response.data.success) {
        setSuccess(`Cantidad rectificada: ${productoRectificar.producto}`);
        setModalRectificarOpen(false);
        setProductoRectificar(null);
        setRectificarForm({ nueva_cantidad: '', motivo: '' });
        await cargarDatos();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al rectificar cantidad');
    } finally {
      setProcesando(false);
    }
  };

  const handleDescargarPDF = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await cotizacionesAPI.descargarPDF(id);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      
      const clienteSanitizado = (cotizacion.cliente || 'CLIENTE')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .toUpperCase();

      const nroCot = cotizacion.numero_cotizacion || id;
      const fileName = `${clienteSanitizado}_${nroCot}.pdf`;
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess('PDF descargado exitosamente');

      if (cotizacion.estado === 'Borrador' || cotizacion.estado === 'Pendiente') {
        await cargarDatos();
      }

    } catch (err) {
      console.error("Error original:", err);

      if (err.response && err.response.data instanceof Blob) {
        try {
          const errorText = await err.response.data.text();
          const errorJson = JSON.parse(errorText);
          const mensajeError = errorJson.error || 'Error al generar el PDF';
          setError(mensajeError);
        } catch (e) {
          setError('Ocurrio un error inesperado al descargar el archivo.');
        }
      } else {
        setError(err.message || 'Error de conexion al descargar el PDF');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicar = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await cotizacionesAPI.duplicar(id);
      
      if (response.data.success) {
        setSuccess(`Cotizacion duplicada: ${response.data.data.numero_cotizacion}`);
        
        setTimeout(() => {
          const queryString = location.search;
          navigate(`/ventas/cotizaciones/${response.data.data.id_cotizacion}${queryString}`);
        }, 1500);
      }
      
    } catch (err) {
      console.error('Error al duplicar cotizacion:', err);
      setError(err.response?.data?.error || 'Error al duplicar cotizacion');
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarPrioridad = async (prioridad) => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await cotizacionesAPI.actualizarPrioridad(id, prioridad);
      
      if (response.data.success) {
        setCotizacion({ ...cotizacion, prioridad });
        setSuccess(`Prioridad actualizada a ${prioridad}`);
        setModalPrioridadOpen(false);
      }
      
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar prioridad');
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstado = async (estado) => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await cotizacionesAPI.actualizarEstado(id, estado);
      
      if (response.data.success) {
        if (estado === 'Aprobada') {
          setSuccess('Cotizacion aprobada. Redirigiendo a crear Orden de Venta...');
          
          setTimeout(() => {
            navigate(`/ventas/ordenes/nueva?cotizacion=${id}`);
          }, 1500);
        } else {
          await cargarDatos();
          setSuccess(`Estado actualizado a ${estado}`);
        }
      }
      
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar estado');
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

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor);
  };

  const formatearMoneda = (valor) => {
    const simbolo = cotizacion?.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  const formatearNumeroPrecio = (valor) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(valor);
  };

  const formatearMonedaPrecio = (valor) => {
    const simbolo = cotizacion?.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumeroPrecio(parseFloat(valor || 0))}`;
  };
  const formatearPeso = (pesoKg) => {
    if (!pesoKg || pesoKg === 0) return '—';
    if (pesoKg < 1) return `${(pesoKg * 1000).toFixed(0)} g`;
    return `${pesoKg.toFixed(3)} kg`;
  };
  const getTipoImpuestoNombre = (valor) => {
    if (!valor) return 'IGV 18%';

    const codigo = String(valor).toUpperCase().trim();

    const tipos = {
      'IGV': 'IGV 18%',
      'EXO': 'Exonerado 0%',
      'INA': 'Inafecto 0%'
    };

    if (tipos[codigo]) return tipos[codigo];
    
    return valor;
  };

  const esUSD = cotizacion?.moneda === 'USD';
  const tcVenta = tipoCambio?.venta || null;

  if (loading && !cotizacion) {
    return <Loading variant="detail" />;
  }

  if (!cotizacion) {
    return (
      <div className="pg-page vt-page">
        <div className="pg-stack">
          <Alert type="error" message="Cotizacion no encontrada" />
          <div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleVolverListado}
            >
              <ArrowLeft size={16} />
              Volver a Cotizaciones
            </button>
          </div>
        </div>
      </div>
    );
  }

  const calcularTotalesReales = () => {
    if (!cotizacion.detalle) return { sub: 0, tax: 0, tot: 0, pesoTotal: 0 };

    const tipoImp = (cotizacion.tipo_impuesto || 'IGV').toUpperCase();
    const esExonerado = ['EXO', 'INA', 'EXONERADO', 'INAFECTO'].includes(tipoImp);
    const pct = parseFloat(cotizacion.porcentaje_impuesto || 18);

    const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
    let pesoTotal = 0;
    let sub = 0;
    let tax = 0;
    cotizacion.detalle.forEach((item) => {
      const val = parseFloat(item.cantidad) * parseFloat(item.precio_unitario);
      const peso = parseFloat(item.peso_unitario || 0);
      if (peso > 0) pesoTotal += parseFloat(item.cantidad) * peso;
      if (isNaN(val)) return;
      const lineBase = round2(val);
      sub += lineBase;
      if (!esExonerado) tax += round2(lineBase * (pct / 100));
    });
    sub = round2(sub);
    tax = round2(tax);
    return { sub, tax, tot: round2(sub + tax), pesoTotal };
  };

  const { sub: subtotalReal, tax: igvReal, tot: totalReal, pesoTotal } = calcularTotalesReales();

  const estadoConfig = configEstadoCotizacion(cotizacion.estado);
  const IconoEstado = estadoConfig.icon;
  const diasVencimiento = cotizacion.fecha_vencimiento 
    ? Math.ceil((new Date(cotizacion.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const estaConvertida = cotizacion.convertida_venta || cotizacion.estado === 'Convertida';
  const esMuestra = cotizacion.es_muestra === 1;

  const disponible = estadoCredito ? (cotizacion.moneda === 'USD' ? estadoCredito.credito_usd.disponible : estadoCredito.credito_pen.disponible) : 0;
  const creditoInsuficiente = estadoCredito?.usar_limite_credito && cotizacion.plazo_pago !== 'Contado' && totalReal > parseFloat(disponible);

  const clasePrioridad = cotizacion.prioridad === 'Urgente' ? 'badge-danger' : cotizacion.prioridad === 'Alta' ? 'badge-warning' : 'badge-info';
  const columnasTabla = esAdmin ? 8 : 7;

  return (
    <div className="pg-page vt-page">
      <header className="pg-header">
        <div>
          <div className="vt-detail-nav">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleVolverListado}
            >
              <ArrowLeft size={15} /> Volver
            </button>
            <div className="vt-pager-mini">
              <button
                type="button"
                className="pg-iconbtn"
                disabled={!navInfo.prev}
                onClick={() => handleNavegar(navInfo.prev)}
                title="Cotizacion anterior"
                aria-label="Cotizacion anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span>{navInfo.current} / {navInfo.total}</span>
              <button
                type="button"
                className="pg-iconbtn"
                disabled={!navInfo.next}
                onClick={() => handleNavegar(navInfo.next)}
                title="Cotizacion siguiente"
                aria-label="Cotizacion siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <span className="pg-eyebrow"><FileText size={13} /> Cotización</span>
          <h1 className="pg-title">{cotizacion.numero_cotizacion}</h1>
          <div className="pg-drawer-badges">
            <BadgeEstadoCotizacion estado={cotizacion.estado} />
            {esMuestra && (
              <span className="badge badge-warning"><FlaskConical size={11} />Muestra</span>
            )}
            {estaConvertida && (
              <span className="badge badge-primary"><Lock size={11} />Convertida</span>
            )}
          </div>
          <p className="pg-subtitle">
            <b>{cotizacion.cliente}</b> · Emitida el {formatearFecha(cotizacion.fecha_emision)}
            {diasVencimiento !== null && diasVencimiento > 0 && !estaConvertida && (
              <span className="vt-text-warning"> · Vence en {diasVencimiento} dia(s)</span>
            )}
          </p>
        </div>

        <div className="pg-actions">
          <button type="button" className="btn btn-outline" onClick={handleDescargarPDF}>
            <Download size={16} /> PDF
          </button>

          <button type="button" className="btn btn-outline" onClick={handleDuplicar}>
            <Copy size={16} /> Duplicar
          </button>

          {!estaConvertida && cotizacion.estado !== 'Vencida' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/ventas/cotizaciones/${id}/editar`)}
            >
              <Edit size={16} /> Editar
            </button>
          )}
        </div>
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        {esUSD && (
          <section className={`pg-panel vt-tc-panel ${tipoCambio ? 'is-on' : ''}`}>
            <div className="vt-tc">
              <span className="vt-tc-label"><DollarSign size={14} /> Tipo de cambio SUNAT — conversión referencial</span>
              {tipoCambio ? (
                <>
                  <span>Compra <b>S/ {tipoCambio.compra.toFixed(3)}</b></span>
                  <span>Venta <b className="is-accent">S/ {tipoCambio.venta.toFixed(3)}</b></span>
                  <span className="vt-tc-meta"><Calendar size={12} /> SUNAT: {formatearFecha(tipoCambio.fecha)}</span>
                  <span className="vt-tc-meta"><Clock size={12} /> {obtenerEdadTC()}</span>
                </>
              ) : (
                <span className="vt-tc-meta"><AlertTriangle size={14} /> No disponible — Presione "Actualizar TC" para ver conversión a soles</span>
              )}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={actualizarTipoCambio}
              disabled={loadingTC}
              title="Consultar TC actual desde SUNAT"
            >
              <RefreshCcw size={14} className={loadingTC ? 'animate-spin' : ''} />
              {loadingTC ? 'Consultando...' : 'Actualizar TC'}
            </button>
          </section>
        )}

        {esMuestra && (
          <div className="vt-note is-warning">
            <FlaskConical size={18} />
            <div>
              <strong>Cotizacion de Muestra</strong>
              <p>
                Esta cotizacion es de tipo muestra y no puede ser convertida en Orden de Venta.
                Puede editarla, descargar el PDF o duplicarla para generar una cotizacion regular.
              </p>
            </div>
          </div>
        )}

        {estaConvertida && cotizacion.id_orden_venta && (
          <div className="vt-note is-info">
            <CheckCircle size={18} />
            <div>
              <strong>Esta cotizacion fue convertida a Orden de Venta</strong>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => navigate(`/ventas/ordenes/${cotizacion.id_orden_venta}`)}
            >
              Ver Orden de Venta <ExternalLink size={14} />
            </button>
          </div>
        )}

        <section className="pg-panel cotizacion-status-panel">
          <div className="pg-panel-head">
            <div className="vt-status">
              <span className="vt-status-icon" style={{ '--status-c': estadoConfig.color }}><IconoEstado size={22} /></span>
              <div>
                <span className="pg-field-label cotizacion-status-label">Estado actual</span>
                <strong>{cotizacion.estado}</strong>
                {cotizacion.fecha_vencimiento && cotizacion.estado === 'Pendiente' && (
                  <small>Valida hasta: {formatearFecha(cotizacion.fecha_vencimiento)}</small>
                )}
              </div>
            </div>
            <div className="vt-status-prio">
              <span className="pg-field-label cotizacion-status-label">Prioridad</span>
              <button
                type="button"
                className={`badge cotizacion-priority vt-prio-btn ${clasePrioridad}`}
                onClick={() => !estaConvertida && cotizacion.estado !== 'Vencida' && setModalPrioridadOpen(true)}
                disabled={estaConvertida || cotizacion.estado === 'Vencida'}
                title={estaConvertida || cotizacion.estado === 'Vencida' ? undefined : 'Cambiar prioridad'}
              >
                <Flag size={12} />{cotizacion.prioridad}
              </button>
            </div>
          </div>

          {!estaConvertida && cotizacion.estado !== 'Vencida' && (
            <div className="pg-panel-body">
              <span className="pg-field-label cotizacion-status-label">Cambiar estado</span>
              <div className="vt-estado-actions">
                <button
                  type="button"
                  className={`btn btn-sm ${cotizacion.estado === 'Pendiente' ? 'btn-warning' : 'btn-outline btn-warning'}`}
                  onClick={() => handleCambiarEstado('Pendiente')}
                  disabled={cotizacion.estado === 'Pendiente' || loading}
                >
                  <Calculator size={15} />
                  Pendiente
                </button>

                <button
                  type="button"
                  className={`btn btn-sm ${cotizacion.estado === 'Enviada' ? 'btn-info' : 'btn-outline btn-info'}`}
                  onClick={() => handleCambiarEstado('Enviada')}
                  disabled={cotizacion.estado === 'Enviada' || loading}
                >
                  <FileText size={15} />
                  Enviada
                </button>

                {esMuestra ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    disabled
                    title="Las cotizaciones de muestra no pueden convertirse en Orden de Venta"
                  >
                    <Lock size={15} />
                    Aprobar (Nueva OV)
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`btn btn-sm ${cotizacion.estado === 'Aprobada' || creditoInsuficiente ? 'btn-success' : 'btn-outline btn-success'}`}
                    onClick={() => !creditoInsuficiente && handleCambiarEstado('Aprobada')}
                    disabled={cotizacion.estado === 'Aprobada' || loading || creditoInsuficiente}
                    title={creditoInsuficiente ? "Credito insuficiente para aprobar" : ""}
                  >
                    {creditoInsuficiente ? <Lock size={15} /> : <CheckCircle size={15} />}
                    Aprobar (Nueva OV)
                  </button>
                )}

                <button
                  type="button"
                  className={`btn btn-sm ${cotizacion.estado === 'Rechazada' ? 'btn-danger' : 'btn-outline btn-danger'}`}
                  onClick={() => handleCambiarEstado('Rechazada')}
                  disabled={cotizacion.estado === 'Rechazada' || loading}
                >
                  <XCircle size={15} />
                  Rechazar
                </button>
              </div>

              {esMuestra ? (
                <div className="vt-note is-warning is-compact">
                  <FlaskConical size={14} />
                  <span>Las cotizaciones de tipo muestra no pueden convertirse en Orden de Venta.</span>
                </div>
              ) : creditoInsuficiente ? (
                <div className="vt-note is-danger is-compact">
                  <AlertTriangle size={14} />
                  <span><strong>Bloqueado:</strong> El total de la cotizacion excede el credito disponible del cliente. No se puede aprobar.</span>
                </div>
              ) : (
                <div className="vt-note is-info is-compact">
                  <AlertCircle size={14} />
                  <span><strong>Nota:</strong> Al aprobar, se abrira el formulario de Nueva Orden de Venta con los datos de esta cotizacion precargados.</span>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="vt-cards-3">
          <section className="pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><Building size={16} /> Cliente</h2>
            </div>
            <div className="pg-panel-body">
              <div className="pg-kv">
                <div className="wide"><span>Razon social</span><strong>{cotizacion.cliente}</strong></div>
                <div><span>RUC</span><strong className="pg-code">{cotizacion.ruc_cliente}</strong></div>
                {cotizacion.telefono_cliente && (
                  <div><span>Telefono</span><strong>{cotizacion.telefono_cliente}</strong></div>
                )}
                {cotizacion.direccion_cliente && (
                  <div className="wide"><span>Direccion</span><strong>{cotizacion.direccion_cliente}</strong></div>
                )}
              </div>
            </div>
          </section>

          <section className="pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><CreditCard size={16} /> Condiciones comerciales</h2>
            </div>
            <div className="pg-panel-body">
              <div className="pg-kv">
                <div>
                  <span>Moneda</span>
                  <strong><span className={`badge ${cotizacion.moneda === 'USD' ? 'badge-success' : 'badge-primary'}`}>{cotizacion.moneda === 'USD' ? '$ USD' : 'S/ PEN'}</span></strong>
                </div>
                {cotizacion.moneda === 'USD' && (
                  <div>
                    <span>T.C. cotización</span>
                    <strong>S/ {parseFloat(cotizacion.tipo_cambio || 1).toFixed(4)}</strong>
                  </div>
                )}
                <div><span>Impuesto</span><strong><Percent size={12} className="pg-muted" /> {getTipoImpuestoNombre(cotizacion.tipo_impuesto)}</strong></div>
                <div>
                  <span>Plazo pago</span>
                  <strong>
                    {cotizacion.plazo_pago && cotizacion.plazo_pago !== 'Contado' ? (
                      <span className="badge badge-warning">{cotizacion.plazo_pago}</span>
                    ) : (
                      <span className="badge badge-success">Contado</span>
                    )}
                  </strong>
                </div>
                <div><span>Forma pago</span><strong>{cotizacion.forma_pago || '-'}</strong></div>
              </div>
            </div>
          </section>

          <section className="pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><User size={16} /> Información adicional</h2>
            </div>
            <div className="pg-panel-body">
              <div className="pg-kv">
                <div className="wide"><span>Comercial responsable</span><strong>{cotizacion.comercial || 'Sin asignar'}</strong></div>
                {cotizacion.fecha_vencimiento && (
                  <div><span>Valida hasta</span><strong>{formatearFecha(cotizacion.fecha_vencimiento)}</strong></div>
                )}
                {cotizacion.plazo_entrega && (
                  <div><span>Plazo de entrega</span><strong>{cotizacion.plazo_entrega}</strong></div>
                )}
                {cotizacion.lugar_entrega && (
                  <div className="wide"><span>Lugar de entrega</span><strong><MapPin size={12} className="pg-muted" /> {cotizacion.lugar_entrega}</strong></div>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="pg-panel">
          <div className="pg-panel-head">
            <h2 className="pg-panel-title">
              <Package size={16} /> Productos cotizados <span className="pg-count">{cotizacion.detalle?.length || 0}</span>
            </h2>
            {esMuestra && <span className="badge badge-warning"><FlaskConical size={11} />Muestra</span>}
          </div>
          <div className="pg-table-wrap">
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Cantidad</th>
                  <th className="num">Peso</th>
                  <th className="num">P. Base</th>
                  <th className="num">P. Venta</th>
                  {esAdmin && <th className="center">Margen %</th>}
                  <th className="num">Subtotal</th>
                  <th className="center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(cotizacion.detalle || []).length > 0 ? cotizacion.detalle.map((row, idx) => {
                  const peso = parseFloat(row.peso_unitario || 0);
                  const pesoTotalLinea = parseFloat(row.cantidad) * peso;
                  const porcentaje = parseFloat(row.descuento_porcentaje || 0);
                  const subtotalCalculado = parseFloat(row.cantidad) * parseFloat(row.precio_unitario);
                  return (
                    <tr key={row.id_detalle || idx}>
                      <td>
                        <span className="pg-cell-main">{row.producto}</span>
                        <span className="pg-cell-sub">{row.codigo_producto || row.codigo_producto_libre}</span>
                        {row.es_producto_libre ? (
                          <span className="pg-tags"><span className="pg-tag is-warning"><FlaskConical size={10} />Producto muestra</span></span>
                        ) : (
                          parseFloat(row.cantidad) > parseFloat(row.stock_disponible || 0) && (
                            <span className="pg-tags">
                              <span className="pg-tag is-warning">
                                <AlertTriangle size={11} />
                                Stock insuficiente ({parseFloat(parseFloat(row.stock_disponible || 0).toFixed(4))} {row.unidad_medida})
                              </span>
                            </span>
                          )
                        )}
                      </td>
                      <td className="num">
                        <b>{parseFloat(parseFloat(row.cantidad).toFixed(4))}</b>
                        <span className="pg-cell-sub">{row.unidad_medida}</span>
                      </td>
                      <td className="num">
                        {peso === 0 ? <span className="pg-muted">—</span> : (
                          <>
                            <b>{formatearPeso(pesoTotalLinea)}</b>
                            <span className="pg-cell-sub">{formatearPeso(peso)}/u</span>
                          </>
                        )}
                      </td>
                      <td className="num pg-muted">{formatearMoneda(row.precio_base)}</td>
                      <td className="num">
                        <span className="vt-lp-price">{formatearMonedaPrecio(row.precio_unitario)}</span>
                        {esUSD && tcVenta && (
                          <span className="pg-cell-sub vt-text-accent">S/ {formatearNumeroPrecio(parseFloat(row.precio_unitario) * tcVenta)}</span>
                        )}
                      </td>
                      {esAdmin && (
                        <td className="center">
                          <span className={porcentaje < 0 ? 'vt-delta-down' : 'vt-delta-up'}>
                            {porcentaje > 0 ? '+' : ''}{porcentaje.toFixed(2)}%
                          </span>
                        </td>
                      )}
                      <td className="num">
                        <span className="vt-amount">{formatearMoneda(subtotalCalculado)}</span>
                        {esUSD && tcVenta && (
                          <span className="pg-tags">
                            <span className="pg-tag is-accent"><ArrowRightLeft size={10} />S/ {formatearNumero(subtotalCalculado * tcVenta)}</span>
                          </span>
                        )}
                      </td>
                      <td className="center">
                        {!row.es_producto_libre && (
                          <button
                            type="button"
                            className="pg-iconbtn"
                            onClick={() => {
                              setProductoRectificar(row);
                              setRectificarForm({
                                nueva_cantidad: row.cantidad,
                                motivo: ''
                              });
                              setModalRectificarOpen(true);
                            }}
                            disabled={procesando}
                            title="Rectificar Cantidad"
                            aria-label={`Rectificar cantidad de ${row.producto}`}
                          >
                            <Edit size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={columnasTabla}>
                      <div className="pg-empty">
                        <Package size={28} />
                        <strong>No hay productos en esta cotizacion</strong>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className={`vt-detail-bottom ${cotizacion.observaciones ? '' : 'is-solo'}`}>
          {cotizacion.observaciones && (
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h3 className="pg-panel-title"><FileText size={16} /> Observaciones</h3>
              </div>
              <div className="pg-panel-body">
                <p className="vt-pre">{cotizacion.observaciones}</p>
              </div>
            </section>
          )}

          <section className="pg-panel">
            <div className="pg-panel-head">
              <h3 className="pg-panel-title"><Calculator size={16} /> Resumen</h3>
            </div>
            <div className="pg-panel-body">
              <dl className="vt-sum">
                {pesoTotal > 0 && (
                  <div>
                    <dt><Package size={13} /> Peso total</dt>
                    <dd className="vt-text-accent">{formatearPeso(pesoTotal)}</dd>
                  </div>
                )}
                <div>
                  <dt>Sub total</dt>
                  <dd>{formatearMoneda(subtotalReal)}</dd>
                </div>
                <div>
                  <dt>
                    {['EXO', 'INA', 'EXONERADO', 'INAFECTO'].includes((cotizacion.tipo_impuesto || 'IGV').toUpperCase())
                      ? (String(cotizacion.tipo_impuesto).toUpperCase().startsWith('EXO') ? 'Exonerado (0%)' : 'Inafecto (0%)')
                      : `IGV (${parseFloat(cotizacion.porcentaje_impuesto || 18)}%)`}
                  </dt>
                  <dd>{formatearMoneda(igvReal)}</dd>
                </div>
                <div className="vt-sum-total">
                  <dt>Total</dt>
                  <dd>{formatearMoneda(totalReal)}</dd>
                </div>
              </dl>

              {esUSD && tcVenta && (
                <div className="vt-note is-accent">
                  <ArrowRightLeft size={16} />
                  <div>
                    <div className="vt-note-line">
                      <span>Equivalente en Soles (TC SUNAT)</span>
                      <b>S/ {formatearNumero(totalReal * tcVenta)}</b>
                    </div>
                    <p>TC Venta: S/ {tcVenta.toFixed(3)} — SUNAT: {formatearFecha(tipoCambio.fecha)}</p>
                    {parseFloat(cotizacion.tipo_cambio || 0) > 1 && (
                      <div className="vt-note-line is-sub">
                        <span>Equiv. con TC de cotización (S/ {parseFloat(cotizacion.tipo_cambio).toFixed(4)})</span>
                        <b>S/ {formatearNumero(totalReal * parseFloat(cotizacion.tipo_cambio))}</b>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {esUSD && !tcVenta && parseFloat(cotizacion.tipo_cambio || 0) > 1 && (
                <div className="vt-note is-info">
                  <ArrowRightLeft size={16} />
                  <div>
                    <div className="vt-note-line">
                      <span>Equiv. con TC de cotización</span>
                      <b>S/ {formatearNumero(totalReal * parseFloat(cotizacion.tipo_cambio))}</b>
                    </div>
                    <p>TC: S/ {parseFloat(cotizacion.tipo_cambio).toFixed(4)}</p>
                  </div>
                </div>
              )}

              {estadoCredito && estadoCredito.usar_limite_credito && !esMuestra && (
                <div className="vt-credito">
                  <h4 className="pg-section-title"><CreditCard size={14} /> Saldo de credito del cliente</h4>
                  <div className={`vt-credito-row ${parseFloat(estadoCredito.credito_pen.disponible) < totalReal && cotizacion.moneda === 'PEN' ? 'is-danger' : ''}`}>
                    <span>PEN disponible</span>
                    <b>S/ {formatearNumero(parseFloat(estadoCredito.credito_pen.disponible))}</b>
                  </div>
                  <div className={`vt-credito-row ${parseFloat(estadoCredito.credito_usd.disponible) < totalReal && cotizacion.moneda === 'USD' ? 'is-danger' : ''}`}>
                    <span>USD disponible</span>
                    <b>$ {formatearNumero(parseFloat(estadoCredito.credito_usd.disponible))}</b>
                  </div>
                  {creditoInsuficiente && (
                    <p className="vt-error"><AlertTriangle size={12} /> No podra convertirse a OV: saldo insuficiente.</p>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <Modal
        isOpen={modalPrioridadOpen}
        onClose={() => setModalPrioridadOpen(false)}
        title="Cambiar Prioridad"
        size="md"
      >
        <div className="pg-stack">
          <div className="pg-kv">
            <div><span>Prioridad actual</span><strong>{cotizacion.prioridad}</strong></div>
          </div>

          <div className="vt-prio-list">
            {['Baja', 'Media', 'Alta', 'Urgente'].map(prioridad => (
              <button
                key={prioridad}
                type="button"
                className="btn btn-outline"
                onClick={() => handleCambiarPrioridad(prioridad)}
                disabled={cotizacion.prioridad === prioridad}
              >
                <Flag size={14} />
                {prioridad}
                {cotizacion.prioridad === prioridad && <span className="pg-muted"> · actual</span>}
              </button>
            ))}
          </div>

          <div className="vt-lp-modal-foot">
            <button type="button" className="btn btn-outline" onClick={() => setModalPrioridadOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalRectificarOpen}
        onClose={() => setModalRectificarOpen(false)}
        title="Rectificar Cantidad de Producto"
        size="sm"
      >
        {productoRectificar && (
          <form onSubmit={handleRectificarCantidad}>
            <div className="vt-note is-warning">
              <AlertTriangle size={18} />
              <div>
                <strong>{productoRectificar.producto}</strong>
                <p>Cantidad actual: <b>{formatearNumero(productoRectificar.cantidad)}</b></p>
                <p>Si esta cotizacion ya fue convertida, se actualizara tambien la Orden de Venta.</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="vt-rect-cantidad">Nueva Cantidad *</label>
              <input
                id="vt-rect-cantidad"
                type="number"
                step="0.001"
                min="0"
                className="form-input"
                value={rectificarForm.nueva_cantidad}
                onChange={(e) => setRectificarForm({ ...rectificarForm, nueva_cantidad: e.target.value })}
                required
                autoFocus
                onWheel={handleWheelDisable}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="vt-rect-motivo">Motivo del Cambio *</label>
              <textarea
                id="vt-rect-motivo"
                className="form-textarea"
                rows={2}
                value={rectificarForm.motivo}
                onChange={(e) => setRectificarForm({ ...rectificarForm, motivo: e.target.value })}
                placeholder="Ej: Error de digitacion, cambio de requerimiento, etc."
                required
              ></textarea>
            </div>

            <div className="vt-lp-modal-foot">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setModalRectificarOpen(false)}
                disabled={procesando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-warning"
                disabled={procesando}
              >
                <Save size={16} /> Confirmar Rectificacion
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default DetalleCotizacion;
