import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import XLSX from 'xlsx-js-style';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import {
  Calendar, Search, Filter, Download, FileSpreadsheet,
  DollarSign, TrendingUp, FileText, AlertCircle, Truck, X,
  Eye, Package, MapPin, Phone, Mail, CreditCard, FileCheck,
  ShoppingCart, Percent, Building2, RefreshCw, ArrowRightLeft,
  RefreshCcw, AlertTriangle, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  ShieldCheck, ShieldAlert, ShieldOff, Trash2, Ban, Receipt, FileCode,
  FileArchive, Users, Wallet, ExternalLink, ClipboardList, BarChart3
} from 'lucide-react';
import { reportesAPI, clientesAPI, tipoCambioAPI, empleadosAPI, ordenesVentaAPI, archivosAPI, sunatAPI } from '../../config/api';
import { usePermisos } from '../../context/PermisosContext';
import Loading from '../../components/UI/Loading';
import Alert from '../../components/UI/Alert';
import Modal from '../../components/UI/Modal';
import ModalValidacionSunat from '../../components/Ventas/ModalValidacionSunat';
import { generarReporteVentasPDF } from './reporteVentasPDF';
import { ESTADOS_SEE, BadgeSee, BadgeEstadoOrden } from './estadosVentas';
import './ReporteVentas.css';

const TC_SESSION_KEY = 'indpack_tipo_cambio';

const TILES_SEE = ['ACEPTADO', 'OBSERVADO', 'EN_PROCESO', 'RECHAZADO', 'SIN_EMITIR', 'ANULADA'];

const CLASE_COMPROBANTE = { FACTURA: 'Factura', NOTA_CREDITO: 'Nota de crédito', NOTA_DEBITO: 'Nota de débito' };

const ESTADOS_PAGO = [
  { id: 'Pagado', badge: 'badge-success', color: 'var(--success)' },
  { id: 'Parcial', badge: 'badge-warning', color: 'var(--warning)' },
  { id: 'Pendiente', badge: 'badge-danger', color: 'var(--danger)' }
];

const FILAS_POR_PAGINA = 25;

const FilterCheckboxGroup = ({ label, options, selectedValues, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    const handleEscape = (event) => { if (event.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const toggle = (value) => {
    onChange(selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value]);
  };

  const resumen = selectedValues.length === 0
    ? 'Todos'
    : selectedValues.length === 1
      ? (options.find(o => o.value === selectedValues[0])?.label || selectedValues[0])
      : `${selectedValues.length} seleccionados`;

  return (
    <div className="pg-field rv-ms" ref={containerRef}>
      <span className="pg-field-label">{label}</span>
      <button
        type="button"
        className={`rv-ms-trigger ${selectedValues.length > 0 ? 'has-value' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{resumen}</span>
        <ChevronDown size={14} />
      </button>
      {isOpen && (
        <div className="rv-ms-menu" role="listbox" aria-multiselectable="true">
          <div className="rv-ms-list">
            {options.map(opt => (
              <label key={opt.value} className="rv-ms-option">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={selectedValues.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {selectedValues.length > 0 && (
            <button type="button" className="rv-ms-clear" onClick={() => onChange([])}>
              <X size={12} /> Limpiar selección
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const ModalTC = ({ mostrarModalTC, tcVenta, setMostrarModalTC, aplicarModoUnificacion }) => {
  useEffect(() => {
    if (!mostrarModalTC) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMostrarModalTC(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mostrarModalTC, setMostrarModalTC]);

  if (!mostrarModalTC) return null;

  return createPortal(
    <div className="rv-tc-modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) setMostrarModalTC(false); }}>
      <div className="rv-tc-modal" role="dialog" aria-modal="true" aria-labelledby="rv-tc-modal-title">
        <div className="pg-panel-head">
          <h3 id="rv-tc-modal-title" className="pg-panel-title"><ArrowRightLeft size={16} /> Unificar a soles</h3>
          <button type="button" className="pg-iconbtn" onClick={() => setMostrarModalTC(false)} aria-label="Cerrar" autoFocus><X size={16} /></button>
        </div>
        <div className="rv-tc-modal-body">
          <p>¿Cómo calcular el equivalente en soles de las órdenes en dólares?</p>
          <button type="button" className="rv-tc-option is-recommended" onClick={() => aplicarModoUnificacion('mixto')}>
            <TrendingUp size={18} />
            <span>
              <strong>Híbrido <span className="rv-tag">Recomendado</span></strong>
              <small>Respeta el TC de la orden cuando es real (mayor a 3); usa el TC SUNAT para el resto.</small>
            </span>
          </button>
          <button type="button" className="rv-tc-option" onClick={() => aplicarModoUnificacion('sunat')}>
            <DollarSign size={18} />
            <span>
              <strong>TC SUNAT para todo</strong>
              <small>Multiplica todas las órdenes USD por S/ {tcVenta?.toFixed(3)}.</small>
            </span>
          </button>
          <button type="button" className="rv-tc-option" onClick={() => aplicarModoUnificacion('historico')}>
            <Clock size={18} />
            <span>
              <strong>Histórico estricto</strong>
              <small>Usa el TC SUNAT del día en que se facturó cada orden.</small>
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ReporteVentas = () => {
  const [loading, setLoading] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [errorFecha, setErrorFecha] = useState('');

  const [incluirDetalleExcel, setIncluirDetalleExcel] = useState(true);
  const [incluirDetallePDF, setIncluirDetallePDF] = useState(true);

  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clientesSugeridos, setClientesSugeridos] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const wrapperRef = useRef(null);

  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [mostrarDetalleOrden, setMostrarDetalleOrden] = useState(false);
  const [historialDespachos, setHistorialDespachos] = useState([]);
  const [historialFacturasAnuladas, setHistorialFacturasAnuladas] = useState([]);
  const [documentosAdicionales, setDocumentosAdicionales] = useState([]);
  const [visorArchivo, setVisorArchivo] = useState({ open: false, url: '', tipo: '', titulo: '' });

  useEffect(() => {
    const fetchDatosDetalle = async () => {
      if (ordenSeleccionada && mostrarDetalleOrden) {
        const idOV = ordenSeleccionada.id_orden_venta || ordenSeleccionada.id;
        try {
          const [despachoRes, facturasRes, docsRes] = await Promise.allSettled([
            ordenesVentaAPI.getSalidas(idOV),
            ordenesVentaAPI.getHistorialFacturasAnuladas(idOV),
            ordenesVentaAPI.getDocumentosAdicionales(idOV)
          ]);
          setHistorialDespachos(despachoRes.status === 'fulfilled' && despachoRes.value.data.success ? despachoRes.value.data.data || [] : []);
          setHistorialFacturasAnuladas(facturasRes.status === 'fulfilled' && facturasRes.value.data.success ? facturasRes.value.data.data || [] : []);
          setDocumentosAdicionales(docsRes.status === 'fulfilled' && docsRes.value.data.success ? docsRes.value.data.data || [] : []);
        } catch (e) {
          console.error('Error fetching detalle orden', e);
        }
      } else {
        setHistorialDespachos([]);
        setHistorialFacturasAnuladas([]);
        setDocumentosAdicionales([]);
      }
    };
    fetchDatosDetalle();
  }, [ordenSeleccionada, mostrarDetalleOrden]);

  const abrirVisor = (url, titulo) => {
    if (!url) return;
    let cleanUrl = Array.isArray(url) ? url[0] : url;
    if (typeof cleanUrl !== 'string') return;
    const ext = cleanUrl.split('?')[0].split('.').pop().toLowerCase();
    setVisorArchivo({ open: true, url: archivosAPI.getProxyUrl(cleanUrl), tipo: ext === 'pdf' ? 'pdf' : 'img', titulo });
  };

  const cerrarVisor = () => setVisorArchivo({ open: false, url: '', tipo: '', titulo: '' });

  const [tipoCambio, setTipoCambio] = useState(null);
  const [loadingTC, setLoadingTC] = useState(false);
  const [convertirUSD, setConvertirUSD] = useState(false);
  const [mostrarModalTC, setMostrarModalTC] = useState(false);
  const [modoUnificacion, setModoUnificacion] = useState('mixto');
  const [mostrarDesgloseUSD, setMostrarDesgloseUSD] = useState(false);

  const [modalSunat, setModalSunat] = useState({
    isOpen: false,
    orden: null
  });

  const abrirVisorSunat = (item) => {
    const ordenMapeada = {
      ...item,
      id_orden_venta: item.id,
      ruc_cliente: item.ruc,
      comprobante_sunat_url: item.comprobante_sunat_url
    };
    
    setModalSunat({
      isOpen: true,
      orden: ordenMapeada
    });
  };

  const fechaHoy = new Date();
  const primerDiaMes = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), 1);

  const [filtros, setFiltros] = useState({
    fechaInicio: primerDiaMes.toISOString().split('T')[0],
    fechaFin: fechaHoy.toISOString().split('T')[0],
    idCliente: '',
    idVendedor: [],
    estadosOrden: [],
    estadosPago: [],
    monedas: [],
    tiposDocumento: [],
    filtroFecha: 'fecha_emision'
  });

  const [vendedoresList, setVendedoresList] = useState([]);

  useEffect(() => {
    const fetchVendedores = async () => {
      try {
        const response = await empleadosAPI.getByRol('Vendedor');
        if (response.data.success) {
          const opciones = (response.data.data || [])
            .filter(e => e.estado === 'Activo')
            .map(e => ({ label: e.nombre_completo, value: e.id_empleado.toString() }));
          setVendedoresList(opciones);
        }
      } catch (error) {
        console.error("Error al cargar vendedores", error);
      }
    };
    fetchVendedores();
  }, []);

  const [dataReporte, setDataReporte] = useState({
    resumen: {
      total_ventas_pen: 0, total_ventas_usd: 0,
      total_pagado_pen: 0, total_pagado_usd: 0,
      total_pendiente_pen: 0, total_pendiente_usd: 0,
      total_comisiones_pen: 0, total_comisiones_usd: 0,
      contado_pen: 0, contado_usd: 0,
      credito_pen: 0, credito_usd: 0,
      pedidos_retrasados: 0, cantidad_ordenes: 0
    },
    graficos: { estado_pago: [], ventas_dia: [], top_vendedores: [], ventas_por_estado: [] },
    detalle: []
  });

  const [dataFiltrada, setDataFiltrada] = useState([]);

  const tcVenta = tipoCambio?.venta || null;

  const validarFechas = (inicio, fin) => {
    if (inicio && fin) {
      if (inicio > fin) {
        setErrorFecha('La fecha "Desde" no puede ser posterior a la fecha "Hasta".');
      } else {
        setErrorFecha('');
      }
    } else {
      setErrorFecha('');
    }
  };

  const handleChangeFechaInicio = (e) => {
    const value = e.target.value;
    setFiltros({ ...filtros, fechaInicio: value });
    validarFechas(value, filtros.fechaFin);
  };

  const handleChangeFechaFin = (e) => {
    const value = e.target.value;
    setFiltros({ ...filtros, fechaFin: value });
    validarFechas(filtros.fechaInicio, value);
  };

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
      console.error('Error leyendo TC:', e);
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
        setError(response.data.error || 'No se pudo obtener el tipo de cambio');
      }
    } catch (err) {
      console.error('Error actualizando TC:', err);
      setError('Error al consultar tipo de cambio. Intente mas tarde.');
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
    if (horasRestantes > 0) return `Valido por ${horasRestantes}h ${minutosRestantes}min`;
    if (minutosRestantes > 0) return `Valido por ${minutosRestantes} min`;
    return 'Expira pronto';
  };

  const handleToggleConvertirUSD = () => {
    if (!convertirUSD) {
      setMostrarModalTC(true);
    } else {
      setConvertirUSD(false);
      setModoUnificacion('mixto');
    }
  };

  const aplicarModoUnificacion = (modo) => {
    setModoUnificacion(modo);
    setConvertirUSD(true);
    setMostrarModalTC(false);
  };

  const calcularTotalUnificadoPorModo = (propItem) => {
    return dataFiltrada.reduce((sum, item) => {
      const val = parseFloat(item[propItem] || 0);
      if (item.moneda === 'USD') {
        const tcOrden = parseFloat(item.tipo_cambio || 1);
        if (modoUnificacion === 'sunat') {
          return sum + (val * tcVenta);
        } else if (modoUnificacion === 'mixto') {
          return sum + (val * (tcOrden > 3 ? tcOrden : tcVenta));
        } else if (modoUnificacion === 'historico') {
          const tcHist = item.tc_historico ? parseFloat(item.tc_historico) : tcVenta;
          return sum + (val * tcHist);
        }
      }
      return sum + val;
    }, 0);
  };

  const calcularResumenFiltrado = () => {
    const inicial = {
      factura_pen: 0, factura_usd: 0,
      nota_venta_pen: 0, nota_venta_usd: 0,
      sin_comprobante_pen: 0, sin_comprobante_usd: 0,
      total_ventas_pen: 0, total_ventas_usd: 0,
      total_pagado_pen: 0, total_pagado_usd: 0,
      total_pendiente_pen: 0, total_pendiente_usd: 0,
      total_comisiones_pen: 0, total_comisiones_usd: 0,
      cantidad_ordenes: dataFiltrada.length
    };

    return dataFiltrada.reduce((acc, item) => {
      const total = parseFloat(item.total || 0);
      const pagado = parseFloat(item.monto_pagado || 0);
      const pendiente = parseFloat(item.pendiente_cobro || 0);
      const comision = parseFloat(item.total_comision || 0);
      const tipo = (item.tipo_comprobante || '').trim();

      if (item.moneda === 'PEN') {
        acc.total_ventas_pen += total;
        acc.total_pagado_pen += pagado;
        acc.total_pendiente_pen += pendiente;
        acc.total_comisiones_pen += comision;
        if (tipo === 'Factura') acc.factura_pen += total;
        else if (tipo === 'Nota de Venta') acc.nota_venta_pen += total;
        else acc.sin_comprobante_pen += total;
      } else {
        acc.total_ventas_usd += total;
        acc.total_pagado_usd += pagado;
        acc.total_pendiente_usd += pendiente;
        acc.total_comisiones_usd += comision;
        if (tipo === 'Factura') acc.factura_usd += total;
        else if (tipo === 'Nota de Venta') acc.nota_venta_usd += total;
        else acc.sin_comprobante_usd += total;
      }
      return acc;
    }, inicial);
  };

  const totalUnificadoPEN = (pen, usd, propItem) => {
    if (!convertirUSD) return calcularTotalUnificadoPorModo(propItem);
    return calcularTotalUnificadoPorModo(propItem);
  };

  const formatearMoneda = (valor, moneda = 'PEN') => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(valor || 0)}`;
  };

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(valor || 0);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'N/A';
    const partes = fecha.toString().split('T')[0].split('-');
    if (partes.length !== 3) return fecha;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const formatearFechaHora = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    generarReporte();
    cargarTCDesdeSession();
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setMostrarSugerencias(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const buscarClientes = async () => {
      if (busquedaCliente.length > 1 && !filtros.idCliente) {
        try {
          const response = await clientesAPI.search(busquedaCliente);
          if (response.data.success) {
            setClientesSugeridos(response.data.data);
            setMostrarSugerencias(true);
          }
        } catch (error) {
          console.error("Error buscando clientes", error);
        }
      } else {
        setClientesSugeridos([]);
      }
    };
    const timeoutId = setTimeout(() => { buscarClientes(); }, 300);
    return () => clearTimeout(timeoutId);
  }, [busquedaCliente, filtros.idCliente]);

  useEffect(() => {
    aplicarFiltrosLocales();
  }, [filtros.estadosOrden, filtros.estadosPago, dataReporte.detalle]);
const obtenerNombreCorto = (nombreCompleto) => {
  if (!nombreCompleto || typeof nombreCompleto !== 'string') return '';
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0];
  if (partes.length === 2) return `${partes[0]} ${partes[1]}`;
  const primerNombre = partes[0];
  const apellidoPaterno = partes[partes.length - 2];
  return `${primerNombre} ${apellidoPaterno}`;
};
  const seleccionarCliente = (cliente) => {
    setFiltros({ ...filtros, idCliente: cliente.id_cliente });
    setBusquedaCliente(cliente.razon_social);
    setClienteSeleccionado(cliente);
    setMostrarSugerencias(false);
  };

  const limpiarCliente = () => {
    setFiltros({ ...filtros, idCliente: '' });
    setBusquedaCliente('');
    setClienteSeleccionado(null);
    setClientesSugeridos([]);
  };

  const aplicarFiltrosLocales = () => {
    let filtrada = [...dataReporte.detalle];
    if (filtros.estadosOrden && filtros.estadosOrden.length > 0) {
      filtrada = filtrada.filter(item => filtros.estadosOrden.includes(item.estado));
    }
    if (filtros.estadosPago && filtros.estadosPago.length > 0) {
      filtrada = filtrada.filter(item => filtros.estadosPago.includes(item.estado_pago));
    }
    if (filtros.idVendedor && filtros.idVendedor.length > 0) {
      const selectedNames = vendedoresList
        .filter(v => filtros.idVendedor.includes(v.value))
        .map(v => v.label);
      filtrada = filtrada.filter(item => selectedNames.includes(item.vendedor));
    }
    if (filtros.tiposDocumento && filtros.tiposDocumento.length > 0) {
      filtrada = filtrada.filter(item => {
        const tipo = item.tipo_comprobante || '';
        if (filtros.tiposDocumento.includes('Sin Comprobante') && (tipo === '' || tipo === null)) {
          return true;
        }
        return filtros.tiposDocumento.includes(tipo);
      });
    }
    setDataFiltrada(filtrada);
  };

  const generarReporte = async (e) => {
    if (e) e.preventDefault();
    if (errorFecha) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        fechaInicio: filtros.fechaInicio,
        fechaFin: filtros.fechaFin,
        idCliente: filtros.idCliente,
        filtro_fecha: filtros.filtroFecha
      };

      if (filtros.estadosOrden.length > 0) params.estadoOrden = filtros.estadosOrden.join(',');
      if (filtros.estadosPago.length > 0) params.estadoPago = filtros.estadosPago.join(',');
      if (filtros.monedas.length > 0) params.moneda = filtros.monedas.join(',');
      if (filtros.idVendedor && filtros.idVendedor.length > 0) params.idVendedor = filtros.idVendedor.join(',');

      if (convertirUSD) {
          params.tipo_unificacion = modoUnificacion === 'sunat' ? 'global' : modoUnificacion;
          params.tc_dia = tcVenta;
      }

      const response = await reportesAPI.getVentas(params);
      if (response.data.success) {
        setDataReporte(response.data.data);
        setDataFiltrada(response.data.data.detalle);
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo generar el reporte. Verifique su conexion.');
    } finally {
      setLoading(false);
    }
  };

  const limpiarFiltros = () => {
    setFiltros({
      fechaInicio: primerDiaMes.toISOString().split('T')[0],
      fechaFin: fechaHoy.toISOString().split('T')[0],
      idCliente: '',
      idVendedor: [],
      estadosOrden: [],
      estadosPago: [],
      monedas: [],
      tiposDocumento: [],
      filtroFecha: 'fecha_emision'
    });
    setErrorFecha('');
    limpiarCliente();
  };

  const descargarPDF = async () => {
    setLoadingPdf(true);
    try {
      await generarReporteVentasPDF(dataReporte, incluirDetallePDF);
    } catch (err) {
      console.error(err);
      setError('Error al descargar el PDF');
    } finally {
      setLoadingPdf(false);
    }
  };

  const descargarExcel = () => {
    setLoadingExcel(true);
    try {
      const wb = XLSX.utils.book_new();

      const mapBaseItem = (item, incluirPEN) => {
        const tcOrdenOriginal = parseFloat(item.tipo_cambio || 1);
        let tcAplicado = tcOrdenOriginal;
        
        if (convertirUSD && item.moneda === 'USD') {
          if (modoUnificacion === 'sunat') tcAplicado = tcVenta;
          else if (modoUnificacion === 'mixto') tcAplicado = tcOrdenOriginal > 3 ? tcOrdenOriginal : tcVenta;
          else if (modoUnificacion === 'historico') tcAplicado = item.tc_historico ? parseFloat(item.tc_historico) : tcVenta;
        }
        const base = {
          'Orden': item.numero,
          'Tipo Comprobante': item.tipo_comprobante || '',
          'Comprobante': (item.tipo_comprobante === 'Factura' && item.facturado_sunat && item.numero_comprobante_sunat)
              ? item.numero_comprobante_sunat
              : (item.tipo_comprobante === 'Factura' && !item.facturado_sunat)
                ? ''
                : (item.numero_comprobante || ''),
          'Facturado SUNAT': item.tipo_comprobante === 'Nota de Venta' ? 'No amerita' : (item.facturado_sunat ? 'Si' : 'No'),
          'Cliente': item.cliente,
          'RUC': item.ruc,
          'Vendedor': obtenerNombreCorto(item.vendedor),
          'Fecha Emision': formatearFecha(item.fecha_emision),
          'Fecha Fact. SUNAT': item.tipo_comprobante === 'Nota de Venta' ? 'No amerita' : ((item.facturado_sunat && item.fecha_facturacion_sunat) ? formatearFecha(item.fecha_facturacion_sunat) : ''),
          'Fecha Despacho': item.fecha_despacho ? formatearFecha(item.fecha_despacho) : 'Pendiente',
          'Moneda': item.moneda
        };

        if (incluirPEN) {
          base['TC Orden'] = item.moneda === 'USD' ? tcAplicado : '-';
        }

        base['Subtotal Orig.'] = parseFloat(parseFloat(item.subtotal).toFixed(3));
        base['IGV Orig.'] = parseFloat(parseFloat(item.igv).toFixed(3));
        base['Total Orig.'] = parseFloat(parseFloat(item.total).toFixed(3));
        base['Pagado Orig.'] = parseFloat(parseFloat(item.monto_pagado).toFixed(3));
        base['Por Cobrar Orig.'] = parseFloat(parseFloat(item.pendiente_cobro).toFixed(3));

        if (incluirPEN) {
          if (item.moneda === 'USD') {
            base['Subtotal (PEN)'] = parseFloat((parseFloat(item.subtotal) * tcAplicado).toFixed(3));
            base['IGV (PEN)'] = parseFloat((parseFloat(item.igv) * tcAplicado).toFixed(3));
            base['Total (PEN)'] = parseFloat((parseFloat(item.total) * tcAplicado).toFixed(3));
            base['Pagado (PEN)'] = parseFloat((parseFloat(item.monto_pagado) * tcAplicado).toFixed(3));
            base['Por Cobrar (PEN)'] = parseFloat((parseFloat(item.pendiente_cobro) * tcAplicado).toFixed(3));
          } else {
            base['Subtotal (PEN)'] = parseFloat(parseFloat(item.subtotal).toFixed(3));
            base['IGV (PEN)'] = parseFloat(parseFloat(item.igv).toFixed(3));
            base['Total (PEN)'] = parseFloat(parseFloat(item.total).toFixed(3));
            base['Pagado (PEN)'] = parseFloat(parseFloat(item.monto_pagado).toFixed(3));
            base['Por Cobrar (PEN)'] = parseFloat(parseFloat(item.pendiente_cobro).toFixed(3));
          }
        }

        base['Estado Pago'] = item.estado_pago;
        base['Estado'] = item.estado;
        base['Tipo Venta'] = item.tipo_venta;
        base['Condición Pago'] = item.tipo_venta === 'Crédito' ? `${item.dias_credito} días (Vence: ${formatearFecha(item.fecha_vencimiento)})` : '-';

        return base;
      };

      const crearHojaResumen = (datos, nombreHoja, tieneColumnasPEN) => {
        if (datos.length === 0) return;

        const ws = XLSX.utils.json_to_sheet(datos);

        const colsBase = [
          { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
          { wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 12 },
          { wch: 8 }
        ];

        if (tieneColumnasPEN) {
          colsBase.push({ wch: 10 });
        }

        colsBase.push({ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 });

        if (tieneColumnasPEN) {
          colsBase.push({ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 });
        }
        colsBase.push({ wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 25 });
        ws['!cols'] = colsBase;

        const totalRows = datos.length + 1;
        const totalCols = Object.keys(datos[0]).length;

        for (let C = 0; C < totalCols; C++) {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
          if (ws[cellRef]) {
            if (!ws[cellRef].s) ws[cellRef].s = {};
            ws[cellRef].s = {
              ...ws[cellRef].s,
              font: { bold: true, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "4B5563" } },
              border: {
                left: { style: "thin", color: { rgb: "D1D5DB" } },
                right: { style: "thin", color: { rgb: "D1D5DB" } }
              }
            };
          }
        }

        if (tieneColumnasPEN) {
          const penColsStart = 11 + 5;
          const penColsEnd = penColsStart + 4;
          for (let R = 1; R < totalRows; R++) {
            for (let C = penColsStart; C <= penColsEnd; C++) {
              const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
              if (ws[cellRef]) {
                if (!ws[cellRef].s) ws[cellRef].s = {};
                ws[cellRef].s = {
                  ...ws[cellRef].s,
                  fill: { fgColor: { rgb: "E6F4EA" } },
                  numFmt: '#,##0.000'
                };
              }
            }
          }
        }

        let colFiltroIndex = -1;
        if (filtros.filtroFecha === 'fecha_emision') colFiltroIndex = 7;
        else if (filtros.filtroFecha === 'fecha_sunat') colFiltroIndex = 8;
        else if (filtros.filtroFecha === 'fecha_despacho') colFiltroIndex = 9;

        if (colFiltroIndex !== -1) {
          for (let R = 1; R < totalRows; R++) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: colFiltroIndex });
            if (ws[cellRef]) {
              if (!ws[cellRef].s) ws[cellRef].s = {};
              ws[cellRef].s = {
                ...ws[cellRef].s,
                fill: { fgColor: { rgb: "FFF2CC" } }
              };
            }
          }
        }

        XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
      };

      const dataSoles = dataFiltrada.filter(item => item.moneda === 'PEN');
      const dataUSD = dataFiltrada.filter(item => item.moneda === 'USD');

      const datosSoles = dataSoles.map(item => mapBaseItem(item, false));
      const datosUSD = dataUSD.map(item => mapBaseItem(item, true));
      const datosUnificados = dataFiltrada.map(item => mapBaseItem(item, true));

      crearHojaResumen(datosSoles, 'Resumen Soles', false);
      crearHojaResumen(datosUSD, 'Resumen USD', true);

      if (dataSoles.length > 0 && dataUSD.length > 0) {
        crearHojaResumen(datosUnificados, 'Resumen Unificado', true);
      }

      const productosAgrupados = {
        'Factura PEN': {}, 'Factura USD': {},
        'Nota de Venta PEN': {}, 'Nota de Venta USD': {},
        'Sin Comprobante PEN': {}, 'Sin Comprobante USD': {}
      };

      dataFiltrada.forEach((orden) => {
        if (orden.detalles && orden.detalles.length > 0) {
          const tcOrden = parseFloat(orden.tipo_cambio || 1);
          const tipoDoc = String(orden.tipo_comprobante || '').trim();
          const esFactura = tipoDoc.includes('Factura');
          const esNotaVenta = tipoDoc.includes('Nota de Venta');
          const tipoImpuesto = String(orden.tipo_impuesto || '').toUpperCase().trim();
          const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(tipoImpuesto);
          const facturasExportacion = ['OV-2026-0380', 'OV-2026-0277', 'OV-2026-0162', 'OV-2026-0093'];

          let categoriaBase = 'Sin Comprobante';
          if (esFactura) {
            if (!esSinImpuesto || facturasExportacion.includes(orden.numero)) {
              categoriaBase = 'Factura';
            } else {
              categoriaBase = 'Nota de Venta';
            }
          } else if (esNotaVenta) {
            categoriaBase = 'Nota de Venta';
          }

          const grupoKey = `${categoriaBase} ${orden.moneda}`;

          orden.detalles.forEach(det => {
            const key = det.codigo_producto;
            if (!productosAgrupados[grupoKey][key]) {
              productosAgrupados[grupoKey][key] = {
                codigo: det.codigo_producto, nombre: det.producto_nombre,
                unidad_medida: det.unidad_medida, moneda: orden.moneda,
                cantidad_total: 0, cantidad_despachada_total: 0, cantidad_pendiente_total: 0,
                subtotal: 0, descuento: 0, ordenes: []
              };
            }
            productosAgrupados[grupoKey][key].cantidad_total += parseFloat(det.cantidad);
            productosAgrupados[grupoKey][key].cantidad_despachada_total += parseFloat(det.cantidad_despachada || 0);
            productosAgrupados[grupoKey][key].cantidad_pendiente_total += parseFloat(det.cantidad) - parseFloat(det.cantidad_despachada || 0);
            productosAgrupados[grupoKey][key].subtotal += parseFloat(det.subtotal);
            productosAgrupados[grupoKey][key].descuento += parseFloat(det.descuento || 0);
            productosAgrupados[grupoKey][key].ordenes.push({
              numero: orden.numero,
              cliente: orden.cliente,
              guia_interna: orden.numero_guia_interna || null,
              numero_comprobante: (orden.tipo_comprobante === 'Factura' && orden.facturado_sunat && orden.numero_comprobante_sunat) ? orden.numero_comprobante_sunat : orden.numero_comprobante,
              fecha_emision: orden.fecha_emision,
              fecha_despacho: orden.fecha_despacho,
              cantidad: parseFloat(det.cantidad),
              precio_unitario: parseFloat(det.precio_unitario),
              subtotal: parseFloat(det.subtotal),
              tc: tcOrden
            });
          });
        }
      });

      const datosAOA = [];
      const merges = [];
      const categorias = [
        { key: 'Factura PEN', titulo: '=== FACTURAS (PEN) ===' },
        { key: 'Factura USD', titulo: '=== FACTURAS (USD) ===' },
        { key: 'Nota de Venta PEN', titulo: '=== NOTAS DE VENTA (PEN) ===' },
        { key: 'Nota de Venta USD', titulo: '=== NOTAS DE VENTA (USD) ===' },
        { key: 'Sin Comprobante PEN', titulo: '=== SIN COMPROBANTE (PEN) ===' },
        { key: 'Sin Comprobante USD', titulo: '=== SIN COMPROBANTE (USD) ===' }
      ];

      categorias.forEach(cat => {
        const productosEnCategoria = Object.values(productosAgrupados[cat.key]);
        if (productosEnCategoria.length > 0) {
          productosEnCategoria.sort((a, b) => b.subtotal - a.subtotal);

          const isUSD = cat.key.includes('USD');
          
          datosAOA.push([cat.titulo]);
          
          const headers = [
            'Codigo', 'Producto', 'Unidad', 'Moneda',
            'Orden', 'Comprobante (Guía)', 'Fecha Emisión', 'Fecha Despacho', 'Cliente'
          ];
          
          if (isUSD) {
            headers.push('Vendedor', 'Cant. Orden', 'P. Unitario', 'Subtotal Orden', 'TC', 'Subtotal (PEN)');
          } else {
            headers.push('Cant. Orden', 'P. Unitario', 'Subtotal Orden');
          }
          
          headers.push('Cant. Total', 'Cant. Despachada', 'Cant. Pendiente', 'Subtotal General', 'N Ordenes');
          datosAOA.push(headers);

          productosEnCategoria.forEach(prod => {
            const startRowIndex = datosAOA.length;
            const nOrdenes = prod.ordenes.length;

            prod.ordenes.forEach((o, idx) => {
              const guia = o.guia_interna ? `(Guía: ${o.guia_interna})` : '';
              const compText = o.numero_comprobante ? `${o.numero_comprobante} ${guia}` : (o.guia_interna ? `Guía: ${o.guia_interna}` : '-');
              const fEmision = o.fecha_emision ? formatearFecha(o.fecha_emision) : '-';
              const fDespacho = o.fecha_despacho ? formatearFecha(o.fecha_despacho) : 'Pendiente';

              let rowData = [];
              if (idx === 0) {
                rowData = [
                  prod.codigo, prod.nombre, prod.unidad_medida, prod.moneda,
                  o.numero, compText.trim(), fEmision, fDespacho, o.cliente
                ];
                if (isUSD) {
                  rowData.push(o.vendedor || '-', parseFloat(o.cantidad.toFixed(3)), parseFloat(o.precio_unitario.toFixed(3)), parseFloat(o.subtotal.toFixed(3)), parseFloat(o.tc.toFixed(3)), parseFloat((o.subtotal * o.tc).toFixed(3)));
                } else {
                  rowData.push(parseFloat(o.cantidad.toFixed(3)), parseFloat(o.precio_unitario.toFixed(3)), parseFloat(o.subtotal.toFixed(3)));
                }
                rowData.push(
                  parseFloat(prod.cantidad_total.toFixed(3)), parseFloat(prod.cantidad_despachada_total.toFixed(3)),
                  parseFloat(prod.cantidad_pendiente_total.toFixed(3)), parseFloat(prod.subtotal.toFixed(3)), nOrdenes
                );
              } else {
                rowData = [
                  '', '', '', '',
                  o.numero, compText.trim(), fEmision, fDespacho, o.cliente
                ];
                if (isUSD) {
                   rowData.push(o.vendedor || '-', parseFloat(o.cantidad.toFixed(3)), parseFloat(o.precio_unitario.toFixed(3)), parseFloat(o.subtotal.toFixed(3)), parseFloat(o.tc.toFixed(3)), parseFloat((o.subtotal * o.tc).toFixed(3)));
                } else {
                   rowData.push(parseFloat(o.cantidad.toFixed(3)), parseFloat(o.precio_unitario.toFixed(3)), parseFloat(o.subtotal.toFixed(3)));
                }
                rowData.push('', '', '', '', '');
              }
              datosAOA.push(rowData);
            });

            if (nOrdenes > 1) {
              const endRowIndex = startRowIndex + nOrdenes - 1;
              const mergeCols = [0, 1, 2, 3];
              const totalCols = headers.length;
              mergeCols.push(totalCols - 5, totalCols - 4, totalCols - 3, totalCols - 2, totalCols - 1);
              
              mergeCols.forEach(c => {
                merges.push({ s: { r: startRowIndex, c: c }, e: { r: endRowIndex, c: c } });
              });
            }
          });
          datosAOA.push([]);
          datosAOA.push([]);
        }
      });

      if (datosAOA.length > 0) {
        const wsProductos = XLSX.utils.aoa_to_sheet(datosAOA);
        wsProductos['!merges'] = merges;

        wsProductos['!cols'] = [
          { wch: 15 }, { wch: 40 }, { wch: 10 }, { wch: 10 },
          { wch: 16 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 35 },
          { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 16 },
          { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 10 }
        ];

        const borderStyle = {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        };

        for (let R = 0; R < datosAOA.length; R++) {
          const rowLength = datosAOA[R].length;
          if (rowLength === 1 && datosAOA[R][0] && datosAOA[R][0].toString().startsWith('===')) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: 0 });
            if (wsProductos[cellRef]) {
              if (!wsProductos[cellRef].s) wsProductos[cellRef].s = {};
              wsProductos[cellRef].s.font = { bold: true, color: { rgb: "FFFFFF" } };
              wsProductos[cellRef].s.fill = { fgColor: { rgb: "333333" } };
            }
          } else if (rowLength > 1 && datosAOA[R][0] === 'Codigo') {
            for (let C = 0; C < rowLength; C++) {
              const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
              if (wsProductos[cellRef]) {
                if (!wsProductos[cellRef].s) wsProductos[cellRef].s = {};
                wsProductos[cellRef].s.font = { bold: true };
                wsProductos[cellRef].s.fill = { fgColor: { rgb: "E0E0E0" } };
                wsProductos[cellRef].s.alignment = { horizontal: "center", vertical: "center" };
                wsProductos[cellRef].s.border = borderStyle;
              }
            }
          } else if (rowLength > 1 && datosAOA[R][0] !== 'Codigo') {
            for (let C = 0; C < rowLength; C++) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (wsProductos[cellRef]) {
                  if (!wsProductos[cellRef].s) wsProductos[cellRef].s = {};
                  wsProductos[cellRef].s.alignment = { vertical: "center" };
                  wsProductos[cellRef].s.border = borderStyle;
                }
            }
          }
        }

        XLSX.utils.book_append_sheet(wb, wsProductos, 'Resumen Productos');
      }

      const fechasAgrupadas = {};
      
      let tituloResumen = 'FECHA';
      if (filtros.filtroFecha === 'fecha_emision') tituloResumen = 'FECHA DE EMISION';
      else if (filtros.filtroFecha === 'fecha_sunat') tituloResumen = 'FECHA FACTURACION SUNAT';
      else if (filtros.filtroFecha === 'fecha_despacho') tituloResumen = 'FECHA DE DESPACHO';

      dataFiltrada.forEach(orden => {
        let fechaAgrupacion = 'Pendiente';
        let rawDateValue = 0;

        if (filtros.filtroFecha === 'fecha_emision') {
          fechaAgrupacion = orden.fecha_emision ? formatearFecha(orden.fecha_emision) : 'Pendiente';
          rawDateValue = orden.fecha_emision ? new Date(orden.fecha_emision).getTime() : 0;
        } else if (filtros.filtroFecha === 'fecha_sunat') {
          fechaAgrupacion = orden.fecha_facturacion_sunat ? formatearFecha(orden.fecha_facturacion_sunat) : 'Pendiente';
          rawDateValue = orden.fecha_facturacion_sunat ? new Date(orden.fecha_facturacion_sunat).getTime() : 0;
        } else {
          fechaAgrupacion = orden.fecha_despacho ? formatearFecha(orden.fecha_despacho) : 'Pendiente';
          rawDateValue = orden.fecha_despacho ? new Date(orden.fecha_despacho).getTime() : 0;
        }

        if (!fechasAgrupadas[fechaAgrupacion]) {
          fechasAgrupadas[fechaAgrupacion] = {
            fecha: fechaAgrupacion,
            items: [],
            rawDate: rawDateValue 
          };
        }
        if (orden.detalles && orden.detalles.length > 0) {
          orden.detalles.forEach(det => {
            const guia = orden.numero_guia_interna ? `(Guía: ${orden.numero_guia_interna})` : '';
            const numComp = (orden.tipo_comprobante === 'Factura' && orden.facturado_sunat && orden.numero_comprobante_sunat) ? orden.numero_comprobante_sunat : orden.numero_comprobante;
            const compText = numComp ? `${numComp} ${guia}` : (orden.numero_guia_interna ? `Guía: ${orden.numero_guia_interna}` : '-');
            
            fechasAgrupadas[fechaAgrupacion].items.push({
              orden: orden.numero,
              comprobante: compText.trim(),
              fecha_emision: orden.fecha_emision ? formatearFecha(orden.fecha_emision) : '-',
              fecha_sunat: (orden.tipo_comprobante === 'Nota de Venta') ? 'No amerita' : (orden.fecha_facturacion_sunat ? formatearFecha(orden.fecha_facturacion_sunat) : '-'),
              fecha_despacho: orden.fecha_despacho ? formatearFecha(orden.fecha_despacho) : 'Pendiente',
              cliente: orden.cliente,
              moneda: orden.moneda,
              codigo: det.codigo_producto,
              producto: det.producto_nombre,
              unidad: det.unidad_medida,
              cantidad: parseFloat(det.cantidad),
              precio_unitario: parseFloat(det.precio_unitario),
              subtotal: parseFloat(det.subtotal),
              tc: parseFloat(orden.tipo_cambio || 1),
              vendedor: obtenerNombreCorto(orden.vendedor),
              total_orden: parseFloat(orden.total)
            });
          });
        }
      });

      const fechasArray = Object.values(fechasAgrupadas).sort((a, b) => {
        if (a.fecha === 'Pendiente') return 1;
        if (b.fecha === 'Pendiente') return -1;
        return a.rawDate - b.rawDate;
      });

      const datosFechasAOA = [];
      const mergesFechas = [];

      if (fechasArray.length > 0) {
        datosFechasAOA.push([`=== RESUMEN POR ${tituloResumen} ===`]);
        datosFechasAOA.push([
          'Fecha Agrupación', 'Orden', 'Comprobante (Guía)', 'Fecha Emisión', 'Fecha Despacho', 'Fecha SUNAT', 'Cliente',
          'Codigo', 'Producto', 'Unidad', 'Moneda', 'Cant. Orden', 'P. Unitario', 'Subtotal Orden',
          'TC', 'Subtotal (PEN)', 'Vendedor', 'Total OV'
        ]);

        fechasArray.forEach(fechaData => {
          const startRowIndexDate = datosFechasAOA.length;
          const nItems = fechaData.items.length;

          if (nItems === 0) return;

          let currentOrden = null;
          let ordenStartRow = -1;
          let ordenItemCount = 0;

          fechaData.items.forEach((item, idx) => {
            const isNewOrden = item.orden !== currentOrden;
            const isUSD = item.moneda === 'USD';

            if (isNewOrden && ordenStartRow !== -1 && ordenItemCount > 1) {
              const ordenEndRow = datosFechasAOA.length - 1;
              [1, 2, 3, 4, 5, 6, 17].forEach(c => {
                mergesFechas.push({ s: { r: ordenStartRow, c: c }, e: { r: ordenEndRow, c: c } });
              });
            }

            if (isNewOrden) {
              currentOrden = item.orden;
              ordenStartRow = datosFechasAOA.length;
              ordenItemCount = 1;
            } else {
              ordenItemCount++;
            }

            const isFirstInDate = idx === 0;

            let rowData = [
              isFirstInDate ? fechaData.fecha : '',
              isNewOrden ? item.orden : '',
              isNewOrden ? item.comprobante : '',
              isNewOrden ? item.fecha_emision : '',
              isNewOrden ? item.fecha_despacho : '',
              isNewOrden ? item.fecha_sunat : '',
              isNewOrden ? item.cliente : '',
              item.codigo, item.producto, item.unidad, item.moneda,
              parseFloat(item.cantidad.toFixed(3)), parseFloat(item.precio_unitario.toFixed(3)), parseFloat(item.subtotal.toFixed(3))
            ];

            if (isUSD) {
               rowData.push(item.tc ? parseFloat(item.tc.toFixed(3)) : '-', parseFloat((item.subtotal * (item.tc || 1)).toFixed(3)), item.vendedor || '-');
            } else {
               rowData.push('-', '-', item.vendedor || '-');
            }
            rowData.push(isNewOrden ? item.total_orden : '');
            datosFechasAOA.push(rowData);
          });

          if (ordenStartRow !== -1 && ordenItemCount > 1) {
            const ordenEndRow = datosFechasAOA.length - 1;
            [1, 2, 3, 4, 5, 6, 17].forEach(c => {
              mergesFechas.push({ s: { r: ordenStartRow, c: c }, e: { r: ordenEndRow, c: c } });
            });
          }

          if (nItems > 1) {
            const endRowIndexDate = startRowIndexDate + nItems - 1;
            mergesFechas.push({ s: { r: startRowIndexDate, c: 0 }, e: { r: endRowIndexDate, c: 0 } });
          }
        });

        if (datosFechasAOA.length > 1) {
          const wsFechas = XLSX.utils.aoa_to_sheet(datosFechasAOA);
          wsFechas['!merges'] = mergesFechas;
          wsFechas['!cols'] = [
            { wch: 16 }, { wch: 16 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 35 }, 
            { wch: 15 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, 
            { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 25 },
            { wch: 15 }
          ];

          const borderStyle = {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          };

          let colFiltroIndex = -1;
if (filtros.filtroFecha === 'fecha_emision') colFiltroIndex = 3;
else if (filtros.filtroFecha === 'fecha_despacho') colFiltroIndex = 4;
else if (filtros.filtroFecha === 'fecha_sunat') colFiltroIndex = 5;

          for (let R = 0; R < datosFechasAOA.length; R++) {
            if (datosFechasAOA[R].length === 1 && datosFechasAOA[R][0] && datosFechasAOA[R][0].toString().startsWith('===')) {
              const cellRef = XLSX.utils.encode_cell({ r: R, c: 0 });
              if (wsFechas[cellRef]) {
                if (!wsFechas[cellRef].s) wsFechas[cellRef].s = {};
                wsFechas[cellRef].s.font = { bold: true, color: { rgb: "FFFFFF" } };
                wsFechas[cellRef].s.fill = { fgColor: { rgb: "333333" } };
              }
            } else if (datosFechasAOA[R].length > 1 && datosFechasAOA[R][0] === 'Fecha Agrupación') {
              for (let C = 0; C < 18; C++) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (wsFechas[cellRef]) {
                  if (!wsFechas[cellRef].s) wsFechas[cellRef].s = {};
                  wsFechas[cellRef].s.font = { bold: true };
                  wsFechas[cellRef].s.fill = { fgColor: { rgb: "E0E0E0" } };
                  wsFechas[cellRef].s.alignment = { horizontal: "center", vertical: "center" };
                  wsFechas[cellRef].s.border = borderStyle;
                }
              }
            } else if (datosFechasAOA[R].length > 1 && datosFechasAOA[R][0] !== 'Fecha Agrupación') {
              const isUSD = datosFechasAOA[R][10] === 'USD'; 
              for (let C = 0; C < 18; C++) {
                  const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                  if (wsFechas[cellRef]) {
                    if (!wsFechas[cellRef].s) wsFechas[cellRef].s = {};
                    wsFechas[cellRef].s.alignment = { vertical: "center" };
                    wsFechas[cellRef].s.border = borderStyle;

                    if (isUSD && (C === 10 || (C >= 14 && C <= 15))) {
                      wsFechas[cellRef].s.fill = { fgColor: { rgb: "E6F4EA" } };
                    }

                    if (C === colFiltroIndex) {
                       wsFechas[cellRef].s.fill = { fgColor: { rgb: "FFF2CC" } };
                    }
                  }
              }
            }
          }
          XLSX.utils.book_append_sheet(wb, wsFechas, 'Resumen por Fecha');
        }
      }

      if (incluirDetalleExcel) {
        dataFiltrada.forEach((orden) => {
          const tcOrdenOriginal = parseFloat(orden.tipo_cambio || 1);
          let tcAplicado = tcOrdenOriginal;
          
          if (convertirUSD && orden.moneda === 'USD') {
            if (modoUnificacion === 'sunat') tcAplicado = tcVenta;
            else if (modoUnificacion === 'mixto') tcAplicado = tcOrdenOriginal > 3 ? tcOrdenOriginal : tcVenta;
          }

          const nombreHoja = orden.numero.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 31);
          const formaPagoTexto = orden.tipo_venta === 'Credito' ? `Credito ${orden.dias_credito} Dias` : 'Contado';
          const fechaVencimientoTexto = orden.tipo_venta === 'Credito' ? formatearFecha(orden.fecha_vencimiento) : '-';

          const datosOrden = [
            ['INFORMACION DE LA ORDEN'],
            ['Numero de Orden', orden.numero],
            ['Tipo Comprobante', orden.tipo_comprobante],
            ['Numero Comprobante', (orden.tipo_comprobante === 'Factura' && orden.facturado_sunat && orden.numero_comprobante_sunat) ? `${orden.numero_comprobante_sunat} (SUNAT)` : (orden.tipo_comprobante === 'Factura' && !orden.facturado_sunat) ? '' : (orden.numero_comprobante || '')],
            ...(orden.facturado_sunat ? [['Comprobante SUNAT', orden.numero_comprobante_sunat || ''], ['Fecha Facturacion SUNAT', formatearFecha(orden.fecha_facturacion_sunat)]] : []),
            ['Estado', orden.estado], ['Estado Verificacion', orden.estado_verificacion], ['Estado Pago', orden.estado_pago],
            ['Tipo de Venta', orden.tipo_venta], ['Forma de Pago', formaPagoTexto], ['Fecha Vencimiento', fechaVencimientoTexto],
            ['Moneda', orden.moneda], ['Tipo de Cambio Orden', orden.moneda === 'USD' ? tcOrdenOriginal : '1.000'],
            [''], ['INFORMACION DEL CLIENTE'],
            ['Razon Social', orden.cliente], ['RUC', orden.ruc], ['Direccion', orden.direccion_cliente || ''],
            ['Telefono', orden.telefono_cliente || ''], ['Email', orden.email_cliente || ''],
            [''], ['FECHAS'],
            ['Creacion', formatearFechaHora(orden.fecha_creacion)], ['Emision', formatearFecha(orden.fecha_emision)],
            ['Vencimiento', formatearFecha(orden.fecha_vencimiento)],
            ['Despacho', orden.fecha_despacho ? formatearFecha(orden.fecha_despacho) : 'Pendiente'],
            ['Verificacion', orden.fecha_verificacion ? formatearFechaHora(orden.fecha_verificacion) : ''],
            [''], ['INFORMACION DE ENTREGA'],
            ['Tipo de Entrega', orden.tipo_entrega],
            ['Vehiculo', orden.vehiculo_placa ? `${orden.vehiculo_placa} - ${orden.vehiculo_marca}` : ''],
            ['Conductor', orden.conductor_nombre || ''], ['DNI Conductor', orden.conductor_dni || ''],
            ['Transporte', orden.transporte_nombre || ''], ['Placa Transporte', orden.transporte_placa || ''],
            ['Direccion Entrega', orden.direccion_entrega || ''], ['Ciudad', orden.ciudad_entrega || ''],
            [''], ['PRODUCTOS'],
            ['Producto', 'Codigo', 'Cantidad', 'Unidad', 'P. Unitario', 'Subtotal', 'Despachado']
          ];

          if (orden.detalles && orden.detalles.length > 0) {
            orden.detalles.forEach(det => {
              datosOrden.push([det.producto_nombre, det.codigo_producto, det.cantidad, det.unidad_medida,
                `${orden.moneda} ${det.precio_unitario}`,
                `${orden.moneda} ${det.subtotal}`, `${det.cantidad_despachada}/${det.cantidad}`]);
            });
          }

          datosOrden.push([''], ['RESUMEN FINANCIERO (ORIGINAL)'],
            ['Subtotal', `${orden.moneda} ${orden.subtotal}`],
            ['IGV (' + orden.porcentaje_impuesto + '%)', `${orden.moneda} ${orden.igv}`],
            ['Total', `${orden.moneda} ${orden.total}`],
            ['Monto Pagado', `${orden.moneda} ${orden.monto_pagado}`],
            ['Pendiente de Cobro', `${orden.moneda} ${orden.pendiente_cobro}`]);

          if (orden.moneda === 'USD') {
            datosOrden.push([''], ['CONVERSION A SOLES (TC Aplicado: S/ ' + tcAplicado.toFixed(3) + ')'],
              ['Subtotal (PEN)', `S/ ${parseFloat((parseFloat(orden.subtotal) * tcAplicado).toFixed(3))}`],
              ['IGV (PEN)', `S/ ${parseFloat((parseFloat(orden.igv) * tcAplicado).toFixed(3))}`],
              ['Total (PEN)', `S/ ${parseFloat((parseFloat(orden.total) * tcAplicado).toFixed(3))}`],
              ['Pagado (PEN)', `S/ ${parseFloat((parseFloat(orden.monto_pagado) * tcAplicado).toFixed(3))}`],
              ['Pendiente (PEN)', `S/ ${parseFloat((parseFloat(orden.pendiente_cobro) * tcAplicado).toFixed(3))}`]);
          }

          if (parseFloat(orden.total_comision) > 0) {
            datosOrden.push(['Comision (' + orden.porcentaje_comision_promedio + '%)', `${orden.moneda} ${orden.total_comision}`]);
          }

          const docsAsociados = [
            [''], ['DOCUMENTOS ASOCIADOS'],
            ['Cotizacion', orden.numero_cotizacion || '']
          ];

          if (orden.tipo_comprobante && String(orden.tipo_comprobante).includes('Nota de Venta')) {
            docsAsociados.push(['Guia Interna', orden.numero_guia_interna || '']);
          }
          docsAsociados.push(['OC Cliente', orden.orden_compra_cliente || '']);

          datosOrden.push([''], ['PERSONAL'], ['Vendedor', orden.vendedor], ['Registrado por', orden.registrador], ['Verificador', orden.verificador]);
          datosOrden.push(...docsAsociados);

          const wsOrden = XLSX.utils.aoa_to_sheet(datosOrden);
          wsOrden['!cols'] = [{ wch: 30 }, { wch: 50 }];
          XLSX.utils.book_append_sheet(wb, wsOrden, nombreHoja);
        });
      }

      const nombreCliente = clienteSeleccionado ? clienteSeleccionado.razon_social.replace(/[^a-zA-Z0-9]/g, '_') : 'Todos';
      const fechaActual = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Reporte_Ventas_${nombreCliente}_${fechaActual}.xlsx`);
    } catch (err) {
      console.error(err);
      setError('Error al generar el archivo Excel');
    } finally {
      setLoadingExcel(false);
    }
  };

  const navigate = useNavigate();
  const { tienePermiso } = usePermisos();
  const puedeVerArchivosSee = tienePermiso('facturacion') || tienePermiso('facturacionConsulta');
  const puedeAbrirTrazabilidad = tienePermiso('facturacion');

  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [busquedaTabla, setBusquedaTabla] = useState('');
  const [filtroSee, setFiltroSee] = useState('');
  const [monedaGrafico, setMonedaGrafico] = useState('PEN');
  const [pagina, setPagina] = useState(1);

  useEffect(() => { setPagina(1); }, [busquedaTabla, filtroSee, dataFiltrada]);

  useEffect(() => {
    if (!mostrarDetalleOrden) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !visorArchivo.open && !modalSunat.isOpen) setMostrarDetalleOrden(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mostrarDetalleOrden, visorArchivo.open, modalSunat.isOpen]);

  const verDetalleOrden = (orden) => { setOrdenSeleccionada(orden); setMostrarDetalleOrden(true); };
  const cerrarDetalle = () => setMostrarDetalleOrden(false);

  const unificado = convertirUSD && !!tcVenta;

  const tcAplicadoOrden = (item) => {
    if (item.moneda !== 'USD') return 1;
    const tcOrden = parseFloat(item.tipo_cambio || 1);
    if (!unificado) return tcOrden;
    if (modoUnificacion === 'sunat') return tcVenta;
    if (modoUnificacion === 'mixto') return tcOrden > 3 ? tcOrden : tcVenta;
    return item.tc_historico ? parseFloat(item.tc_historico) : tcVenta;
  };

  const enSoles = (item, prop) => parseFloat(item[prop] || 0) * tcAplicadoOrden(item);

  const fmt2 = (valor) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor || 0);
  const simbolo = (moneda) => (moneda === 'USD' ? '$' : 'S/');
  const porcentaje = (parte, total) => (total > 0 ? (parte / total) * 100 : 0);
  const esCredito = (item) => String(item.tipo_venta || '').toLowerCase().includes('dito');

  const ejecutarDescarga = async (accion, etiqueta) => {
    try {
      await accion();
    } catch (err) {
      setError(err.message || `No se pudo descargar ${etiqueta}`);
    }
  };

  const comprobantePrincipal = (item) => {
    const facturas = (item.see?.comprobantes || []).filter(c => c.clase === 'FACTURA');
    const vigentes = facturas.filter(c => ['ACEPTADO', 'OBSERVADO'].includes(c.estado_final));
    if (vigentes.length > 0) return vigentes[vigentes.length - 1];
    return facturas.length > 0 ? facturas[facturas.length - 1] : null;
  };

  const numeroDocumento = (item) => {
    const principal = comprobantePrincipal(item);
    if (principal?.documento) return principal.documento;
    if (item.tipo_comprobante === 'Factura') return item.facturado_sunat ? (item.numero_comprobante_sunat || '') : '';
    return item.numero_comprobante || '';
  };

  const renderArchivosComprobante = (comprobante) => {
    if (!puedeVerArchivosSee || !comprobante?.es_electronico) return null;
    return (
      <span className="rv-files" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pg-iconbtn" title={`PDF ${comprobante.documento}`} aria-label={`Descargar PDF ${comprobante.documento}`}
          onClick={() => ejecutarDescarga(() => sunatAPI.verPdfComprobante(comprobante.id_factura), 'el PDF')}>
          <FileText size={13} />
        </button>
        <button type="button" className="pg-iconbtn" title="XML" aria-label={`Descargar XML ${comprobante.documento}`} disabled={!comprobante.xml_url}
          onClick={() => ejecutarDescarga(() => sunatAPI.descargarArchivoUrl(comprobante.xml_url, `${comprobante.documento}.xml`), 'el XML')}>
          <FileCode size={13} />
        </button>
        <button type="button" className="pg-iconbtn" title="CDR" aria-label={`Descargar CDR ${comprobante.documento}`} disabled={!comprobante.cdr_url}
          onClick={() => ejecutarDescarga(() => sunatAPI.descargarArchivoUrl(comprobante.cdr_url, `R-${comprobante.documento}.zip`), 'el CDR')}>
          <FileArchive size={13} />
        </button>
      </span>
    );
  };

  const resumen = calcularResumenFiltrado();
  const hayUSDenData = resumen.total_ventas_usd > 0;
  const hayPENenData = resumen.total_ventas_pen > 0;

  const ventasPrincipal = unificado ? calcularTotalUnificadoPorModo('total') : resumen.total_ventas_pen;
  const cobradoPrincipal = unificado ? calcularTotalUnificadoPorModo('monto_pagado') : resumen.total_pagado_pen;
  const porCobrarPrincipal = unificado ? calcularTotalUnificadoPorModo('pendiente_cobro') : resumen.total_pendiente_pen;
  const ordenesConSaldo = dataFiltrada.filter(o => parseFloat(o.pendiente_cobro || 0) > 0.01).length;
  const ordenesFueraPlazo = dataFiltrada.filter(o => ['Retrasado', 'Vencido'].includes(o.estado_logistico)).length;
  const ordenesConPlazo = dataFiltrada.filter(o => o.fecha_entrega_programada).length;

  const monedaVista = unificado ? 'PEN' : (!hayPENenData && hayUSDenData ? 'USD' : monedaGrafico);
  const ordenesVista = unificado ? dataFiltrada : dataFiltrada.filter(o => o.moneda === monedaVista);
  const valorVista = (item, prop = 'total') => (unificado ? enSoles(item, prop) : parseFloat(item[prop] || 0));
  const totalVista = ordenesVista.reduce((s, o) => s + valorVista(o), 0);

  const campoFechaActivo = {
    fecha_emision: 'fecha_emision',
    fecha_despacho: 'fecha_despacho',
    fecha_sunat: 'fecha_facturacion_sunat'
  }[filtros.filtroFecha] || 'fecha_emision';

  const etiquetaFechaActiva = { fecha_emision: 'emisión', fecha_despacho: 'despacho', fecha_sunat: 'facturación SUNAT' }[filtros.filtroFecha] || 'emisión';

  const serieDiaria = (() => {
    const mapa = {};
    ordenesVista.forEach(o => {
      const fecha = o[campoFechaActivo];
      if (!fecha) return;
      const clave = String(fecha).split('T')[0];
      mapa[clave] = (mapa[clave] || 0) + valorVista(o);
    });
    return Object.keys(mapa).sort().map(clave => ({
      fecha: clave,
      etiqueta: `${clave.slice(8, 10)}/${clave.slice(5, 7)}`,
      total: parseFloat(mapa[clave].toFixed(2))
    }));
  })();
  const mejorDia = serieDiaria.reduce((mejor, d) => (!mejor || d.total > mejor.total ? d : mejor), null);
  const promedioDiario = serieDiaria.length > 0 ? serieDiaria.reduce((s, d) => s + d.total, 0) / serieDiaria.length : 0;

  const composicionDocumento = [
    { id: 'Factura', label: 'Factura', color: 'var(--rv-s1)' },
    { id: 'Nota de Venta', label: 'Nota de venta', color: 'var(--rv-s2)' },
    { id: 'Sin Comprobante', label: 'Sin comprobante', color: 'var(--rv-s3)' }
  ].map(cat => {
    const items = ordenesVista.filter(o => {
      const tipo = String(o.tipo_comprobante || '').trim();
      if (cat.id === 'Sin Comprobante') return tipo !== 'Factura' && tipo !== 'Nota de Venta';
      return tipo === cat.id;
    });
    return { ...cat, total: items.reduce((s, o) => s + valorVista(o), 0), cantidad: items.length };
  });

  const totalCredito = ordenesVista.filter(esCredito).reduce((s, o) => s + valorVista(o), 0);
  const totalContado = totalVista - totalCredito;

  const composicionPago = ESTADOS_PAGO.map(est => {
    const items = ordenesVista.filter(o => o.estado_pago === est.id);
    return { ...est, total: items.reduce((s, o) => s + valorVista(o), 0), cantidad: items.length };
  });

  const vendedores = (() => {
    const mapa = {};
    ordenesVista.forEach(o => {
      const nombre = o.vendedor || 'Sin asignar';
      if (!mapa[nombre]) mapa[nombre] = { nombre, total: 0, cantidad: 0, comision: 0 };
      mapa[nombre].total += valorVista(o);
      mapa[nombre].comision += valorVista(o, 'total_comision');
      mapa[nombre].cantidad += 1;
    });
    const lista = Object.values(mapa).sort((a, b) => b.total - a.total);
    if (lista.length <= 8) return lista;
    const resto = lista.slice(7).reduce((acc, v) => ({
      nombre: `Otros (${lista.length - 7})`,
      total: acc.total + v.total,
      cantidad: acc.cantidad + v.cantidad,
      comision: acc.comision + v.comision
    }), { total: 0, cantidad: 0, comision: 0 });
    return [...lista.slice(0, 7), resto];
  })();
  const maxVendedor = vendedores.reduce((m, v) => Math.max(m, v.total), 0);

  const seeConteo = TILES_SEE.reduce((acc, k) => ({ ...acc, [k]: { cantidad: 0, PEN: 0, USD: 0 } }), {});
  let ordenesConFactura = 0;
  let notasCredito = 0;
  const montoNotasCredito = { PEN: 0, USD: 0 };
  let guiasAceptadas = 0;
  let despachadas = 0;
  let despachadasConGuia = 0;
  dataFiltrada.forEach(o => {
    const estado = o.see?.estado || 'NO_APLICA';
    if (estado !== 'NO_APLICA') {
      ordenesConFactura += 1;
      if (seeConteo[estado]) {
        seeConteo[estado].cantidad += 1;
        seeConteo[estado][o.moneda === 'USD' ? 'USD' : 'PEN'] += parseFloat(o.total || 0);
      }
    }
    notasCredito += o.see?.cantidad_nc || 0;
    montoNotasCredito[o.moneda === 'USD' ? 'USD' : 'PEN'] += o.see?.monto_nc || 0;
    guiasAceptadas += o.see?.guias_aceptadas || 0;
    if (['Despacho Parcial', 'Despachada', 'Entregada'].includes(o.estado)) {
      despachadas += 1;
      if ((o.see?.guias_vigentes || 0) > 0) despachadasConGuia += 1;
    }
  });
  const facturasAceptadas = seeConteo.ACEPTADO.cantidad + seeConteo.OBSERVADO.cantidad;
  const facturasPorEmitir = seeConteo.SIN_EMITIR.cantidad + seeConteo.RECHAZADO.cantidad;

  const textoBusqueda = busquedaTabla.trim().toLowerCase();
  const filasTabla = dataFiltrada.filter(o => {
    if (filtroSee && (o.see?.estado || 'NO_APLICA') !== filtroSee) return false;
    if (!textoBusqueda) return true;
    return [
      o.numero, o.cliente, o.ruc, o.vendedor, o.numero_comprobante, o.numero_comprobante_sunat,
      o.numero_cotizacion, o.orden_compra_cliente, ...(o.see?.comprobantes || []).map(c => c.documento)
    ].some(v => String(v || '').toLowerCase().includes(textoBusqueda));
  });
  const totalPaginas = Math.max(1, Math.ceil(filasTabla.length / FILAS_POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const filasPagina = filasTabla.slice((paginaActual - 1) * FILAS_POR_PAGINA, paginaActual * FILAS_POR_PAGINA);

  const numerosPagina = (() => {
    if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    const nums = new Set([1, totalPaginas, paginaActual - 1, paginaActual, paginaActual + 1]);
    const ordenados = [...nums].filter(n => n >= 1 && n <= totalPaginas).sort((a, b) => a - b);
    return ordenados.reduce((acc, n, i) => {
      if (i > 0 && n - ordenados[i - 1] > 1) acc.push('…');
      acc.push(n);
      return acc;
    }, []);
  })();

  const filtrosAvanzadosActivos = [filtros.estadosOrden, filtros.estadosPago, filtros.idVendedor, filtros.monedas, filtros.tiposDocumento]
    .reduce((n, lista) => n + (lista.length > 0 ? 1 : 0), 0);

  const renderTooltipGrafico = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const punto = payload[0].payload;
    return (
      <div className="rv-tooltip">
        {formatearFecha(punto.fecha)}
        <strong>{simbolo(monedaVista)} {fmt2(punto.total)}</strong>
      </div>
    );
  };

  const renderDesgloseUnificacion = () => {
    const ordenesUSD = dataFiltrada.filter(item => item.moneda === 'USD');
    if (ordenesUSD.length === 0) return null;

    const grupoSunat = [];
    const grupoHistorico = [];

    ordenesUSD.forEach(orden => {
      const tcOrden = parseFloat(orden.tipo_cambio || 1);
      const totalOrden = parseFloat(orden.total || 0);
      const montoOriginalPEN = totalOrden * tcOrden;

      if (modoUnificacion === 'sunat') {
        grupoSunat.push({ ...orden, tcUsado: tcVenta, valorPen: totalOrden * tcVenta, tcOriginal: tcOrden, montoOriginalPEN, tipo: 'Global SUNAT' });
      } else if (modoUnificacion === 'historico') {
        const tcHist = orden.tc_historico ? parseFloat(orden.tc_historico) : tcVenta;
        grupoHistorico.push({ ...orden, tcUsado: tcHist, valorPen: totalOrden * tcHist, tcOriginal: tcOrden, montoOriginalPEN, tipo: orden.tc_historico ? 'Estricto histórico' : 'SUNAT rescate' });
      } else if (tcOrden > 3) {
        grupoHistorico.push({ ...orden, tcUsado: tcOrden, valorPen: totalOrden * tcOrden, tcOriginal: tcOrden, montoOriginalPEN, tipo: 'Histórico válido' });
      } else {
        grupoSunat.push({ ...orden, tcUsado: tcVenta, valorPen: totalOrden * tcVenta, tcOriginal: tcOrden, montoOriginalPEN, tipo: 'SUNAT rescate' });
      }
    });

    const renderFila = (o) => {
      const diferencia = o.valorPen - o.montoOriginalPEN;
      const cambio = o.tcUsado !== o.tcOriginal;
      return (
        <div key={o.numero} className="rv-desglose-item">
          <header>
            <span className="pg-code">{o.numero}</span>
            <span>{o.tipo}</span>
          </header>
          <div>
            <small>Original · TC {o.tcOriginal.toFixed(3)}</small>
            <strong>$ {formatearNumero(parseFloat(o.total))}</strong>
            <small>= S/ {formatearNumero(o.montoOriginalPEN)}</small>
          </div>
          <ArrowRightLeft size={14} />
          <div>
            <small>Convertido · TC {o.tcUsado.toFixed(3)}</small>
            <strong>S/ {formatearNumero(o.valorPen)}</strong>
            {cambio && (
              <small className={diferencia >= 0 ? 'rv-delta-up' : 'rv-delta-down'}>
                {diferencia >= 0 ? '+' : '−'} S/ {formatearNumero(Math.abs(diferencia))}
              </small>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="rv-desglose">
        <div className="rv-desglose-cols">
          {grupoHistorico.length > 0 && (
            <div>
              <div className="rv-desglose-head">Respetando el TC de la orden <span className="pg-count">{grupoHistorico.length}</span></div>
              <div className="rv-desglose-list">{grupoHistorico.map(renderFila)}</div>
            </div>
          )}
          {grupoSunat.length > 0 && (
            <div>
              <div className="rv-desglose-head">Aplicando TC SUNAT <span className="pg-count">{grupoSunat.length}</span></div>
              <div className="rv-desglose-list">{grupoSunat.map(renderFila)}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMonto = (item) => {
    const esUSD = item.moneda === 'USD';
    const tc = tcAplicadoOrden(item);
    return (
      <>
        <span className="rv-amount"><small>{simbolo(item.moneda)}</small>{formatearNumero(item.total)}</span>
        {esUSD && tc !== 1 && (
          <span className="rv-amount-sub">TC {tc.toFixed(3)} · <b>S/ {formatearNumero(parseFloat(item.total) * tc)}</b></span>
        )}
      </>
    );
  };

  const urlsOrdenCompra = (orden) => {
    if (!orden?.orden_compra_url) return [];
    try {
      const raw = orden.orden_compra_url;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [raw];
    } catch {
      return [orden.orden_compra_url];
    }
  };

  const urlsDocumento = (doc) => {
    try {
      const parsed = typeof doc.archivos_url === 'string' ? JSON.parse(doc.archivos_url) : doc.archivos_url;
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  };

  const renderBadgeVerificacionOC = (orden) => {
    if (orden.estado_verificacion_oc === 'Verificado') {
      return (
        <span className="badge badge-success"><ShieldCheck size={11} /> Verificada
          {orden.fecha_verificacion_oc && ` · ${new Date(orden.fecha_verificacion_oc).toLocaleDateString('es-PE')}`}
        </span>
      );
    }
    if (orden.estado_verificacion_oc === 'Omitida') return <span className="badge badge-secondary"><ShieldOff size={11} /> Omitida</span>;
    if (orden.orden_compra_url) return <span className="badge badge-warning"><ShieldAlert size={11} /> Sin verificar</span>;
    return <span className="pg-muted">—</span>;
  };

  const renderDrawer = () => {
    const o = ordenSeleccionada;
    const tc = tcAplicadoOrden(o);
    const see = o.see || { comprobantes: [], guias: [], estado: 'NO_APLICA' };
    const urlsOC = urlsOrdenCompra(o);
    const docsActivos = documentosAdicionales.filter(d => !d.deleted_at);
    const docsEliminados = documentosAdicionales.filter(d => d.deleted_at);

    return createPortal(
      <div className="pg-drawer-scrim" onClick={(e) => { if (e.target === e.currentTarget) cerrarDetalle(); }}>
        <aside className="pg-drawer" role="dialog" aria-modal="true" aria-labelledby="rv-drawer-title">
          <div className="pg-drawer-head">
            <div>
              <span className="pg-eyebrow"><ClipboardList size={12} /> Orden de venta</span>
              <h2 id="rv-drawer-title">{o.numero}</h2>
              <div className="pg-drawer-badges">
                <BadgeEstadoOrden estado={o.estado} />
                <span className={`badge ${ESTADOS_PAGO.find(e => e.id === o.estado_pago)?.badge || 'badge-secondary'}`}><Wallet size={11} />{o.estado_pago}</span>
                {see.estado !== 'NO_APLICA' && <BadgeSee estado={see.estado} />}
                {['Retrasado', 'Vencido'].includes(o.estado_logistico) && (
                  <span className="badge badge-danger"><AlertTriangle size={11} />{o.estado_logistico}</span>
                )}
              </div>
            </div>
            <button type="button" className="pg-iconbtn" onClick={cerrarDetalle} aria-label="Cerrar detalle" autoFocus><X size={16} /></button>
          </div>

          <div className="pg-drawer-body">
            <section>
              <h3 className="pg-section-title"><CreditCard size={14} /> Resumen financiero</h3>
              <div className="pg-kv">
                <div><span>Subtotal</span><strong>{simbolo(o.moneda)} {formatearNumero(o.subtotal)}</strong></div>
                <div><span>{o.tipo_impuesto || 'IGV'} ({o.porcentaje_impuesto}%)</span><strong>{simbolo(o.moneda)} {formatearNumero(o.igv)}</strong></div>
                <div><span>Total</span><strong className="text-primary">{simbolo(o.moneda)} {formatearNumero(o.total)}</strong></div>
                <div><span>Pagado</span><strong className="text-success">{simbolo(o.moneda)} {formatearNumero(o.monto_pagado)}</strong></div>
                <div><span>Por cobrar</span><strong className={parseFloat(o.pendiente_cobro) > 0.01 ? 'text-danger' : ''}>{simbolo(o.moneda)} {formatearNumero(o.pendiente_cobro)}</strong></div>
                <div><span>Condición</span><strong>{o.tipo_venta}{esCredito(o) && o.dias_credito ? ` · ${o.dias_credito} días` : ''}</strong></div>
                {esCredito(o) && o.fecha_vencimiento && <div><span>Vence</span><strong>{formatearFecha(o.fecha_vencimiento)}</strong></div>}
                {parseFloat(o.total_comision) > 0 && (
                  <div><span>Comisión ({o.porcentaje_comision_promedio}%)</span><strong>{simbolo(o.moneda)} {formatearNumero(o.total_comision)}</strong></div>
                )}
                {o.moneda === 'USD' && tc !== 1 && (
                  <div className="wide"><span>Equivalente en soles · TC {tc.toFixed(3)}</span>
                    <strong>Total S/ {formatearNumero(parseFloat(o.total) * tc)} · Pagado S/ {formatearNumero(parseFloat(o.monto_pagado) * tc)} · Pendiente S/ {formatearNumero(parseFloat(o.pendiente_cobro) * tc)}</strong>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="pg-section-title"><FileCheck size={14} /> Facturación electrónica</h3>
              {see.comprobantes.length === 0 && see.guias.length === 0 ? (
                <div className="pg-kv"><div className="wide"><strong className="pg-muted">
                  {o.tipo_comprobante === 'Factura'
                    ? (o.facturado_sunat ? `Facturada fuera del sistema: ${o.numero_comprobante_sunat || 'sin número'}` : 'Aún no se emitió la factura de esta orden.')
                    : `${o.tipo_comprobante || 'Sin comprobante'}: no requiere comprobante electrónico.`}
                </strong></div></div>
              ) : (
                <ul className="pg-list">
                  {see.comprobantes.map(c => (
                    <li key={`c-${c.id_factura}`} className={['ANULADA', 'RECHAZADO'].includes(c.estado_final) ? 'is-void' : ''}>
                      <Receipt size={14} className="text-primary" />
                      <span>
                        <span className="pg-cell-main">{c.documento}</span>
                        <span className="pg-cell-sub">{CLASE_COMPROBANTE[c.clase]} · {formatearFecha(c.fecha_emision)} · {simbolo(c.moneda)} {fmt2(c.total)}</span>
                      </span>
                      <span className="pg-list-push">
                        <BadgeSee estado={c.estado_final} />
                        {renderArchivosComprobante(c)}
                      </span>
                    </li>
                  ))}
                  {see.guias.map(g => (
                    <li key={`g-${g.id_guia}`} className={['ANULADA', 'BAJA', 'RECHAZADO'].includes(g.estado_final) ? 'is-void' : ''}>
                      <Truck size={14} className="text-primary" />
                      <span>
                        <span className="pg-cell-main">{g.documento}</span>
                        <span className="pg-cell-sub">Guía de remisión · {formatearFecha(g.fecha_emision)}</span>
                      </span>
                      <span className="pg-list-push">
                        <BadgeSee estado={g.estado_final} />
                        {puedeVerArchivosSee && g.es_electronica && g.estado_final === 'ACEPTADO' && (
                          <button type="button" className="pg-iconbtn" title="PDF de la guía" aria-label={`Descargar PDF ${g.documento}`}
                            onClick={() => ejecutarDescarga(() => sunatAPI.verPdfGuia(g.id_guia), 'el PDF de la guía')}>
                            <FileText size={13} />
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {o.comprobante_sunat_url && (
                <button type="button" className="btn btn-outline btn-sm mt-1" onClick={() => abrirVisorSunat(o)}>
                  <Eye size={14} /> Ver comprobante adjunto
                </button>
              )}
            </section>

            <section>
              <h3 className="pg-section-title"><Building2 size={14} /> Cliente</h3>
              <div className="pg-kv">
                <div className="wide"><span>Razón social</span><strong>{o.cliente}</strong></div>
                <div><span>RUC</span><strong>{o.ruc}</strong></div>
                {o.telefono_cliente && <div><span><Phone size={10} /> Teléfono</span><strong>{o.telefono_cliente}</strong></div>}
                {o.email_cliente && <div><span><Mail size={10} /> Correo</span><strong>{o.email_cliente}</strong></div>}
                {o.direccion_cliente && <div className="wide"><span><MapPin size={10} /> Dirección</span><strong>{o.direccion_cliente}</strong></div>}
              </div>
            </section>

            <section>
              <h3 className="pg-section-title"><Calendar size={14} /> Fechas</h3>
              <div className="pg-kv">
                <div><span>Creación</span><strong>{formatearFechaHora(o.fecha_creacion)}</strong></div>
                <div><span>Emisión</span><strong>{formatearFecha(o.fecha_emision)}</strong></div>
                <div><span>Facturación SUNAT</span><strong>{o.fecha_facturacion_sunat ? formatearFecha(o.fecha_facturacion_sunat) : '—'}</strong></div>
                <div><span>Despacho</span><strong>{o.fecha_despacho ? formatearFecha(o.fecha_despacho) : 'Pendiente'}</strong></div>
                {o.fecha_entrega_programada && <div><span>Entrega programada</span><strong>{formatearFecha(o.fecha_entrega_programada)}</strong></div>}
                {o.fecha_entrega_real && <div><span>Entrega real</span><strong className="text-success">{formatearFecha(o.fecha_entrega_real)}</strong></div>}
                {o.fecha_verificacion && <div><span>Verificación</span><strong>{formatearFechaHora(o.fecha_verificacion)}</strong></div>}
              </div>
            </section>

            <section>
              <h3 className="pg-section-title"><Truck size={14} /> Entrega</h3>
              <div className="pg-kv">
                <div><span>Tipo</span><strong>{o.tipo_entrega || '—'}</strong></div>
                {o.tipo_entrega === 'Vehiculo Empresa' && o.vehiculo_placa && (
                  <div><span>Vehículo</span><strong>{o.vehiculo_placa}{o.vehiculo_marca ? ` · ${o.vehiculo_marca}` : ''}</strong></div>
                )}
                {o.tipo_entrega === 'Vehiculo Empresa' && o.conductor_nombre && (
                  <div><span>Conductor</span><strong>{o.conductor_nombre}{o.conductor_dni ? ` · DNI ${o.conductor_dni}` : ''}</strong></div>
                )}
                {o.tipo_entrega === 'Transporte Privado' && o.transporte_nombre && (
                  <div><span>Transportista</span><strong>{o.transporte_nombre}</strong></div>
                )}
                {o.tipo_entrega === 'Transporte Privado' && o.transporte_placa && (
                  <div><span>Placa</span><strong>{o.transporte_placa}</strong></div>
                )}
                {o.tipo_entrega === 'Transporte Privado' && o.transporte_conductor && (
                  <div><span>Conductor</span><strong>{o.transporte_conductor}{o.transporte_dni ? ` · DNI ${o.transporte_dni}` : ''}</strong></div>
                )}
                {o.contacto_entrega && (
                  <div><span>Contacto</span><strong>{o.contacto_entrega}{o.telefono_entrega ? ` · ${o.telefono_entrega}` : ''}</strong></div>
                )}
                {o.direccion_entrega && (
                  <div className="wide"><span><MapPin size={10} /> Dirección de entrega</span><strong>{o.direccion_entrega}{o.ciudad_entrega ? ` · ${o.ciudad_entrega}` : ''}</strong></div>
                )}
              </div>
            </section>

            {o.detalles && o.detalles.length > 0 && (
              <section>
                <h3 className="pg-section-title"><Package size={14} /> Productos <span className="pg-count">{o.detalles.length}</span></h3>
                <div className="pg-table-wrap pg-panel">
                  <table className="pg-table rv-prod-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th className="num">Cantidad</th>
                        <th className="num">P. unit.</th>
                        <th className="num">Subtotal</th>
                        <th>Despacho</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.detalles.map((det, idx) => {
                        const avance = porcentaje(det.cantidad_despachada, det.cantidad);
                        return (
                          <tr key={det.id || idx}>
                            <td>
                              <span className="pg-cell-main">{det.producto_nombre}</span>
                              <span className="pg-cell-sub">{det.codigo_producto}</span>
                            </td>
                            <td className="num">{det.cantidad} {det.unidad_medida}</td>
                            <td className="num">{det.precio_unitario}</td>
                            <td className="num">
                              {det.subtotal}
                              {parseFloat(det.descuento) > 0 && <span className="pg-cell-sub text-danger">−{det.descuento}</span>}
                            </td>
                            <td style={{ minWidth: 110 }}>
                              <span className="pg-cell-sub">{det.cantidad_despachada} / {det.cantidad}</span>
                              <div className="pg-meter" style={{ '--meter-c': avance >= 100 ? 'var(--success)' : 'var(--warning)' }}>
                                <span style={{ width: `${Math.min(avance, 100)}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section>
              <h3 className="pg-section-title"><FileText size={14} /> Documentos y personal</h3>
              <div className="pg-kv">
                <div><span>Comercial</span><strong>{o.vendedor}</strong></div>
                <div><span>Registrado por</span><strong>{o.registrador}</strong></div>
                {o.verificador !== 'No asignado' && <div><span>Verificador</span><strong>{o.verificador}</strong></div>}
                {o.numero_cotizacion && <div><span>Cotización</span><strong>{o.numero_cotizacion}</strong></div>}
                {o.numero_guia_interna && <div><span>Guía interna</span><strong>{o.numero_guia_interna}</strong></div>}
                {o.tipo_comprobante !== 'Factura' && o.numero_comprobante && (
                  <div><span>{o.tipo_comprobante}</span><strong>{o.numero_comprobante}</strong></div>
                )}
                {(o.orden_compra_cliente || o.orden_compra_url) && (
                  <div className="wide">
                    <span>OC del cliente</span>
                    <strong className="flex items-center gap-2 flex-wrap">
                      {o.orden_compra_cliente || '—'} {renderBadgeVerificacionOC(o)}
                      {urlsOC.map((url, i) => (
                        <button key={i} type="button" className="btn btn-outline btn-xs" onClick={() => abrirVisor(url, urlsOC.length > 1 ? `OC Cliente ${i + 1}` : 'OC Cliente')}>
                          <Eye size={11} /> {urlsOC.length > 1 ? `OC ${i + 1}` : 'Ver OC'}
                        </button>
                      ))}
                    </strong>
                  </div>
                )}
              </div>
              {documentosAdicionales.length > 0 && (
                <ul className="pg-list mt-1">
                  {docsActivos.map(doc => (
                    <li key={doc.id_documento}>
                      <span className="badge badge-primary">{doc.tipo_documento}</span>
                      {doc.correlativo && <span className="pg-code">{doc.correlativo}</span>}
                      <span className="pg-cell-sub">{doc.registrado_por} · {new Date(doc.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <span className="pg-list-push">
                        {urlsDocumento(doc).map((url, i, arr) => (
                          <button key={i} type="button" className="pg-iconbtn" aria-label={`Ver ${doc.tipo_documento}`}
                            onClick={() => abrirVisor(url, `${doc.tipo_documento}${doc.correlativo ? ' ' + doc.correlativo : ''}${arr.length > 1 ? ` (${i + 1})` : ''}`)}>
                            <Eye size={13} />
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                  {docsEliminados.map(doc => (
                    <li key={doc.id_documento} className="is-void">
                      <Trash2 size={13} className="text-danger" />
                      <span className="badge badge-secondary">{doc.tipo_documento}</span>
                      {doc.correlativo && <span className="pg-muted">{doc.correlativo}</span>}
                      <span className="pg-cell-sub">Eliminado por {doc.eliminado_por || 'Sistema'} · {new Date(doc.deleted_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <span className="pg-list-push">
                        {urlsDocumento(doc).map((url, i) => (
                          <button key={i} type="button" className="pg-iconbtn" aria-label={`Ver ${doc.tipo_documento} eliminado`} onClick={() => abrirVisor(url, doc.tipo_documento)}>
                            <Eye size={13} />
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {historialDespachos.length > 0 && (
              <section>
                <h3 className="pg-section-title"><Truck size={14} /> Despachos <span className="pg-count">{historialDespachos.length}</span></h3>
                <ul className="pg-list">
                  {historialDespachos.map((d, i) => (
                    <li key={d.id_salida || i} className={d.estado === 'Activo' ? '' : 'is-void'}>
                      <span className="pg-cell-main">Salida #{d.id_salida}</span>
                      <span className={`badge ${d.estado === 'Activo' ? 'badge-success' : 'badge-danger'}`}>{d.estado}</span>
                      {d.observaciones && <span className="pg-cell-sub">Ref.: {d.observaciones}</span>}
                      <span className="pg-list-push pg-muted">{d.total_items || 0} ítems</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {historialFacturasAnuladas.length > 0 && (
              <section>
                <h3 className="pg-section-title"><Ban size={14} /> Facturas anuladas <span className="pg-count">{historialFacturasAnuladas.length}</span></h3>
                <ul className="pg-list">
                  {historialFacturasAnuladas.map((f, i) => (
                    <li key={f.id_factura_anulada || i}>
                      <span>
                        <span className="pg-cell-main">{f.numero_comprobante_sunat || f.numero_comprobante || `Factura ${i + 1}`}</span>
                        <span className="pg-cell-sub">
                          {f.fecha_anulacion ? new Date(f.fecha_anulacion).toLocaleDateString('es-PE') : '—'}
                          {f.anulado_por ? ` · ${f.anulado_por}` : ''}
                          {f.motivo_anulacion ? ` · ${f.motivo_anulacion}` : ''}
                        </span>
                      </span>
                      {f.comprobante_sunat_url && (
                        <span className="pg-list-push">
                          <button type="button" className="pg-iconbtn" aria-label="Ver factura anulada"
                            onClick={() => abrirVisor(f.comprobante_sunat_url, `Factura anulada: ${f.numero_comprobante_sunat || ''}`)}>
                            <Eye size={13} />
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(o.observaciones || o.observaciones_verificador || o.motivo_rechazo) && (
              <section>
                <h3 className="pg-section-title"><AlertCircle size={14} /> Observaciones</h3>
                <div className="pg-kv rv-obs">
                  {o.observaciones && <div className="wide"><span>Generales</span><p>{o.observaciones}</p></div>}
                  {o.observaciones_verificador && <div className="wide"><span>Del verificador</span><p>{o.observaciones_verificador}</p></div>}
                  {o.motivo_rechazo && <div className="wide is-danger"><span>Motivo de rechazo</span><p>{o.motivo_rechazo}</p></div>}
                </div>
              </section>
            )}
          </div>

          <div className="pg-drawer-foot">
            <button type="button" className="btn btn-outline" onClick={cerrarDetalle}>Cerrar</button>
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/ventas/ordenes/${o.id_orden_venta || o.id}`)}>
              <ExternalLink size={16} /> Abrir orden
            </button>
          </div>
        </aside>
      </div>,
      document.body
    );
  };

  return (
    <>
      <ModalTC
        mostrarModalTC={mostrarModalTC}
        tcVenta={tcVenta}
        setMostrarModalTC={setMostrarModalTC}
        aplicarModoUnificacion={aplicarModoUnificacion}
      />

      <div className="pg-page rv-page">
        <header className="pg-header">
          <div>
            <span className="pg-eyebrow"><BarChart3 size={13} /> Reportes · Ventas</span>
            <h1 className="pg-title">Reporte de ventas</h1>
            <p className="pg-subtitle">
              Del <b>{formatearFecha(filtros.fechaInicio)}</b> al <b>{formatearFecha(filtros.fechaFin)}</b> por fecha de {etiquetaFechaActiva}
              {clienteSeleccionado && <> · <b>{clienteSeleccionado.razon_social}</b></>}
              {' '}· órdenes aprobadas, sin canceladas
            </p>
          </div>
          <div className="pg-actions">
            <button onClick={descargarExcel} disabled={loadingExcel || dataFiltrada.length === 0} className="btn btn-outline">
              {loadingExcel ? <Loading size="sm" /> : <FileSpreadsheet size={16} />}
              Excel{unificado ? ' (TC)' : ''}
            </button>
            <button onClick={descargarPDF} disabled={loadingPdf || dataFiltrada.length === 0} className="btn btn-outline">
              {loadingPdf ? <Loading size="sm" /> : <Download size={16} />}
              PDF
            </button>
          </div>
        </header>

        <div className="pg-stack">
          <form className="pg-panel" onSubmit={generarReporte}>
            <div className="rv-filters">
              <div className="rv-filters-row">
                <div className="pg-field">
                  <span className="pg-field-label">Filtrar por fecha de</span>
                  <div className="pg-segmented" role="radiogroup" aria-label="Campo de fecha">
                    {[
                      { id: 'fecha_emision', label: 'Emisión' },
                      { id: 'fecha_despacho', label: 'Despacho' },
                      { id: 'fecha_sunat', label: 'SUNAT' }
                    ].map(op => (
                      <button
                        key={op.id}
                        type="button"
                        role="radio"
                        aria-checked={filtros.filtroFecha === op.id}
                        className={filtros.filtroFecha === op.id ? 'active' : ''}
                        onClick={() => setFiltros({ ...filtros, filtroFecha: op.id })}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pg-field rv-date">
                  <label className="pg-field-label" htmlFor="rv-desde">Desde</label>
                  <input id="rv-desde" type="date" className={`form-input ${errorFecha ? 'is-invalid' : ''}`}
                    value={filtros.fechaInicio} max={filtros.fechaFin || undefined} onChange={handleChangeFechaInicio} />
                </div>
                <div className="pg-field rv-date">
                  <label className="pg-field-label" htmlFor="rv-hasta">Hasta</label>
                  <input id="rv-hasta" type="date" className={`form-input ${errorFecha ? 'is-invalid' : ''}`}
                    value={filtros.fechaFin} min={filtros.fechaInicio || undefined} onChange={handleChangeFechaFin} />
                </div>
                <div className="pg-field rv-cliente" ref={wrapperRef}>
                  <label className="pg-field-label" htmlFor="rv-cliente">Cliente</label>
                  <Search size={14} className="rv-cliente-icon" />
                  <input
                    id="rv-cliente"
                    type="text"
                    autoComplete="off"
                    placeholder="Nombre o RUC"
                    className="form-input"
                    value={busquedaCliente}
                    onChange={(e) => { setBusquedaCliente(e.target.value); if (filtros.idCliente) setFiltros({ ...filtros, idCliente: '' }); }}
                    onFocus={() => busquedaCliente && setMostrarSugerencias(true)}
                  />
                  {(filtros.idCliente || busquedaCliente) && (
                    <button type="button" className="rv-cliente-clear" onClick={limpiarCliente} aria-label="Quitar cliente"><X size={14} /></button>
                  )}
                  {mostrarSugerencias && clientesSugeridos.length > 0 && (
                    <ul className="rv-suggest">
                      {clientesSugeridos.map(cliente => (
                        <li key={cliente.id_cliente}>
                          <button type="button" onClick={() => seleccionarCliente(cliente)}>
                            {cliente.razon_social}
                            <small>RUC {cliente.ruc}</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  className={`btn ${mostrarFiltros || filtrosAvanzadosActivos > 0 ? 'btn-secondary' : 'btn-outline'}`}
                  style={{ height: 38 }}
                  aria-expanded={mostrarFiltros}
                  onClick={() => setMostrarFiltros(!mostrarFiltros)}
                >
                  <Filter size={15} /> Filtros{filtrosAvanzadosActivos > 0 ? ` (${filtrosAvanzadosActivos})` : ''}
                  {mostrarFiltros ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button type="submit" className="btn btn-primary" style={{ height: 38 }} disabled={loading || !!errorFecha}>
                  {loading ? <Loading size="sm" /> : <Search size={15} />} Buscar
                </button>
              </div>

              {errorFecha && (
                <div className="rv-error-fecha" role="alert"><AlertCircle size={14} /> {errorFecha}</div>
              )}

              {mostrarFiltros && (
                <div className="rv-filters-more">
                  <FilterCheckboxGroup
                    label="Estado de la orden"
                    selectedValues={filtros.estadosOrden}
                    onChange={(vals) => setFiltros({ ...filtros, estadosOrden: vals })}
                    options={[
                      { label: 'En Espera', value: 'En Espera' },
                      { label: 'En Proceso', value: 'En Proceso' },
                      { label: 'Atendido por Producción', value: 'Atendido por Produccion' },
                      { label: 'Despacho Parcial', value: 'Despacho Parcial' },
                      { label: 'Despachada', value: 'Despachada' },
                      { label: 'Entregada', value: 'Entregada' }
                    ]}
                  />
                  <FilterCheckboxGroup
                    label="Estado de pago"
                    selectedValues={filtros.estadosPago}
                    onChange={(vals) => setFiltros({ ...filtros, estadosPago: vals })}
                    options={[
                      { label: 'Pendiente', value: 'Pendiente' },
                      { label: 'Parcial', value: 'Parcial' },
                      { label: 'Pagado', value: 'Pagado' }
                    ]}
                  />
                  <FilterCheckboxGroup
                    label="Comercial"
                    selectedValues={filtros.idVendedor}
                    onChange={(vals) => setFiltros({ ...filtros, idVendedor: vals })}
                    options={vendedoresList}
                  />
                  <FilterCheckboxGroup
                    label="Moneda"
                    selectedValues={filtros.monedas}
                    onChange={(vals) => setFiltros({ ...filtros, monedas: vals })}
                    options={[
                      { label: 'Soles (PEN)', value: 'PEN' },
                      { label: 'Dólares (USD)', value: 'USD' }
                    ]}
                  />
                  <FilterCheckboxGroup
                    label="Tipo de documento"
                    selectedValues={filtros.tiposDocumento}
                    onChange={(vals) => setFiltros({ ...filtros, tiposDocumento: vals })}
                    options={[
                      { label: 'Factura', value: 'Factura' },
                      { label: 'Nota de Venta', value: 'Nota de Venta' },
                      { label: 'Sin Comprobante', value: 'Sin Comprobante' }
                    ]}
                  />
                  <div className="pg-field">
                    <span className="pg-field-label">Exportación</span>
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="rv-check">
                        <input type="checkbox" className="checkbox" checked={incluirDetalleExcel} onChange={(e) => setIncluirDetalleExcel(e.target.checked)} />
                        Hojas por orden (Excel)
                      </label>
                      <label className="rv-check">
                        <input type="checkbox" className="checkbox" checked={incluirDetallePDF} onChange={(e) => setIncluirDetallePDF(e.target.checked)} />
                        Detalle (PDF)
                      </label>
                    </div>
                  </div>
                  <div className="pg-field" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" style={{ height: 38 }} onClick={limpiarFiltros}>
                      <RefreshCw size={15} /> Reiniciar filtros
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rv-filters-foot">
              <div className="rv-tc">
                <span className="rv-tc-label"><DollarSign size={13} /> TC SUNAT</span>
                {tipoCambio ? (
                  <>
                    <span>Compra <b>{tipoCambio.compra.toFixed(3)}</b></span>
                    <span>Venta <b className="is-accent">{tipoCambio.venta.toFixed(3)}</b></span>
                    <span className="rv-tc-meta"><Calendar size={12} /> {formatearFecha(tipoCambio.fecha)}</span>
                    <span className="rv-tc-meta"><Clock size={12} /> {obtenerEdadTC()}</span>
                  </>
                ) : (
                  <span className="rv-tc-meta"><AlertTriangle size={12} /> Sin consultar hoy</span>
                )}
              </div>
              <div className="pg-actions">
                {tipoCambio && hayUSDenData && (
                  <button type="button" className={`btn btn-sm ${convertirUSD ? 'btn-secondary' : 'btn-outline'}`} onClick={handleToggleConvertirUSD}>
                    <ArrowRightLeft size={14} /> {convertirUSD ? 'Quitar unificación' : 'Unificar a soles'}
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-outline" onClick={actualizarTipoCambio} disabled={loadingTC}>
                  <RefreshCcw size={14} className={loadingTC ? 'animate-spin' : ''} />
                  {loadingTC ? 'Consultando…' : 'Actualizar TC'}
                </button>
              </div>
            </div>
          </form>

          {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
          {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

          {unificado && hayUSDenData && (
            <div className="rv-unif">
              <div className="rv-unif-head">
                <div>
                  <p className="rv-unif-title">
                    <ArrowRightLeft size={16} />
                    {modoUnificacion === 'sunat' && `Totales en soles con TC SUNAT ${tcVenta.toFixed(3)} para todas las órdenes USD`}
                    {modoUnificacion === 'mixto' && `Totales en soles · híbrido: TC de la orden o SUNAT ${tcVenta.toFixed(3)}`}
                    {modoUnificacion === 'historico' && 'Totales en soles · TC SUNAT del día de facturación de cada orden'}
                  </p>
                  <div className="rv-unif-values">
                    <span>Ventas <b>S/ {fmt2(ventasPrincipal)}</b></span>
                    <span>Cobrado <b>S/ {fmt2(cobradoPrincipal)}</b></span>
                    <span>Por cobrar <b>S/ {fmt2(porCobrarPrincipal)}</b></span>
                  </div>
                </div>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setMostrarDesgloseUSD(!mostrarDesgloseUSD)} aria-expanded={mostrarDesgloseUSD}>
                  {mostrarDesgloseUSD ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {mostrarDesgloseUSD ? 'Ocultar desglose' : 'Ver órdenes convertidas'}
                </button>
              </div>
              {mostrarDesgloseUSD && renderDesgloseUnificacion()}
            </div>
          )}

          <div className="pg-kpis" aria-busy={loading}>
            <div className="pg-kpi is-accent">
              <div className="pg-kpi-top">
                <span className="pg-kpi-label">Ventas{unificado ? ' (soles unificados)' : ''}</span>
                <span className="pg-kpi-icon"><TrendingUp size={16} /></span>
              </div>
              <span className="pg-kpi-value"><small>S/</small>{fmt2(ventasPrincipal)}</span>
              <span className="pg-kpi-foot">
                {!unificado && hayUSDenData && <><b>$ {fmt2(resumen.total_ventas_usd)}</b> en dólares ·</>}
                <b>{resumen.cantidad_ordenes}</b> órdenes
              </span>
            </div>

            <div className="pg-kpi is-success">
              <div className="pg-kpi-top">
                <span className="pg-kpi-label">Cobrado</span>
                <span className="pg-kpi-icon"><Wallet size={16} /></span>
              </div>
              <span className="pg-kpi-value"><small>S/</small>{fmt2(cobradoPrincipal)}</span>
              <span className="pg-kpi-foot">
                <b>{porcentaje(cobradoPrincipal, ventasPrincipal).toFixed(1)}%</b> del total
                {!unificado && hayUSDenData && <> · <b>$ {fmt2(resumen.total_pagado_usd)}</b></>}
              </span>
              <div className="pg-meter" style={{ '--meter-c': 'var(--success)' }}>
                <span style={{ width: `${Math.min(porcentaje(cobradoPrincipal, ventasPrincipal), 100)}%` }} />
              </div>
            </div>

            <div className={`pg-kpi ${porCobrarPrincipal > 0.01 ? 'is-warning' : 'is-success'}`}>
              <div className="pg-kpi-top">
                <span className="pg-kpi-label">Por cobrar</span>
                <span className="pg-kpi-icon"><Clock size={16} /></span>
              </div>
              <span className="pg-kpi-value"><small>S/</small>{fmt2(porCobrarPrincipal)}</span>
              <span className="pg-kpi-foot">
                <b>{ordenesConSaldo}</b> órdenes con saldo
                {!unificado && resumen.total_pendiente_usd > 0 && <> · <b>$ {fmt2(resumen.total_pendiente_usd)}</b></>}
              </span>
            </div>

            <div className={`pg-kpi ${facturasPorEmitir > 0 ? 'is-warning' : 'is-info'}`}>
              <div className="pg-kpi-top">
                <span className="pg-kpi-label">Facturas electrónicas</span>
                <span className="pg-kpi-icon"><FileCheck size={16} /></span>
              </div>
              <span className="pg-kpi-value">{facturasAceptadas}<small style={{ marginLeft: '0.3rem' }}>/ {ordenesConFactura}</small></span>
              <span className="pg-kpi-foot">
                aceptadas · <b>{facturasPorEmitir}</b> por emitir
              </span>
              <div className="pg-meter" style={{ '--meter-c': 'var(--info)' }}>
                <span style={{ width: `${Math.min(porcentaje(facturasAceptadas, ordenesConFactura), 100)}%` }} />
              </div>
            </div>

            <div className={`pg-kpi ${ordenesFueraPlazo > 0 ? 'is-danger' : 'is-success'}`}>
              <div className="pg-kpi-top">
                <span className="pg-kpi-label">Entregas fuera de plazo</span>
                <span className="pg-kpi-icon"><AlertTriangle size={16} /></span>
              </div>
              <span className="pg-kpi-value">{ordenesFueraPlazo}</span>
              <span className="pg-kpi-foot">de <b>{ordenesConPlazo}</b> órdenes con fecha programada</span>
            </div>
          </div>

          <div className="pg-grid pg-grid-2">
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><TrendingUp size={16} /> Ventas por día</h2>
                {unificado ? (
                  <span className="pg-panel-meta">Soles unificados · fecha de {etiquetaFechaActiva}</span>
                ) : (hayPENenData && hayUSDenData) ? (
                  <div className="pg-segmented" role="radiogroup" aria-label="Moneda del gráfico">
                    {['PEN', 'USD'].map(m => (
                      <button key={m} type="button" role="radio" aria-checked={monedaVista === m}
                        className={monedaVista === m ? 'active' : ''} onClick={() => setMonedaGrafico(m)}>
                        {m === 'PEN' ? 'Soles' : 'Dólares'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="pg-panel-meta">{monedaVista === 'USD' ? 'Dólares' : 'Soles'} · fecha de {etiquetaFechaActiva}</span>
                )}
              </div>
              {serieDiaria.length === 0 ? (
                <div className="pg-empty rv-chart-empty">
                  <BarChart3 size={28} />
                  <strong>Sin ventas para graficar</strong>
                  <span>Ajusta el rango de fechas o los filtros y vuelve a buscar.</span>
                </div>
              ) : (
                <>
                  <div className="rv-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={serieDiaria} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--rv-grid)" />
                        <XAxis dataKey="etiqueta" tickLine={false} axisLine={{ stroke: 'var(--steel)' }}
                          tick={{ fill: 'var(--rv-axis)', fontSize: 11 }} minTickGap={16} />
                        <YAxis tickLine={false} axisLine={false} width={64}
                          tick={{ fill: 'var(--rv-axis)', fontSize: 11 }}
                          tickFormatter={(v) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)} />
                        <RechartsTooltip content={renderTooltipGrafico} cursor={{ stroke: 'var(--steel-light)', strokeWidth: 1 }} />
                        <Area type="monotone" dataKey="total" stroke="var(--rv-s1)" strokeWidth={2}
                          fill="var(--rv-s1)" fillOpacity={0.12}
                          activeDot={{ r: 5, stroke: 'var(--bg-primary)', strokeWidth: 2, fill: 'var(--rv-s1)' }}
                          dot={serieDiaria.length <= 31 ? { r: 3, strokeWidth: 0, fill: 'var(--rv-s1)' } : false}
                          isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rv-chart-foot">
                    <span>Total <b>{simbolo(monedaVista)} {fmt2(totalVista)}</b></span>
                    <span>Promedio por día con venta <b>{simbolo(monedaVista)} {fmt2(promedioDiario)}</b></span>
                    {mejorDia && <span>Mejor día <b>{formatearFecha(mejorDia.fecha)} · {simbolo(monedaVista)} {fmt2(mejorDia.total)}</b></span>}
                  </div>
                </>
              )}
            </section>

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Receipt size={16} /> Composición</h2>
                <span className="pg-panel-meta">{monedaVista === 'USD' ? 'Dólares' : 'Soles'}{unificado ? ' unificados' : ''}</span>
              </div>
              <div className="pg-panel-body rv-mix">
                <div className="rv-mix-block">
                  <h4>Por tipo de documento</h4>
                  <div className="rv-stack" role="img" aria-label="Distribución por tipo de documento">
                    {composicionDocumento.filter(c => c.total > 0).map(c => (
                      <span key={c.id} style={{ width: `${porcentaje(c.total, totalVista)}%`, backgroundColor: c.color }} />
                    ))}
                  </div>
                  <ul className="rv-legend">
                    {composicionDocumento.map(c => (
                      <li key={c.id}>
                        <i style={{ backgroundColor: c.color }} />
                        <span>{c.label} <span className="pg-muted">· {c.cantidad}</span></span>
                        <span className="val">{simbolo(monedaVista)} {fmt2(c.total)}</span>
                        <span className="pct">{porcentaje(c.total, totalVista).toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rv-mix-block">
                  <h4>Estado de pago</h4>
                  <div className="rv-status-rows">
                    {composicionPago.map(p => (
                      <div key={p.id} className="rv-status-row">
                        <span className={`badge ${p.badge}`}>{p.id} · {p.cantidad}</span>
                        <div className="pg-meter" style={{ '--meter-c': p.color }}>
                          <span style={{ width: `${porcentaje(p.total, totalVista)}%` }} />
                        </div>
                        <span className="val">{simbolo(monedaVista)} {fmt2(p.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rv-mix-block">
                  <h4>Condición de venta</h4>
                  <div className="rv-stack" role="img" aria-label="Contado frente a crédito">
                    {totalContado > 0 && <span style={{ width: `${porcentaje(totalContado, totalVista)}%`, backgroundColor: 'var(--rv-s1)' }} />}
                    {totalCredito > 0 && <span style={{ width: `${porcentaje(totalCredito, totalVista)}%`, backgroundColor: 'var(--rv-s2)' }} />}
                  </div>
                  <ul className="rv-legend">
                    <li>
                      <i style={{ backgroundColor: 'var(--rv-s1)' }} /><span>Contado</span>
                      <span className="val">{simbolo(monedaVista)} {fmt2(totalContado)}</span>
                      <span className="pct">{porcentaje(totalContado, totalVista).toFixed(1)}%</span>
                    </li>
                    <li>
                      <i style={{ backgroundColor: 'var(--rv-s2)' }} /><span>Crédito</span>
                      <span className="val">{simbolo(monedaVista)} {fmt2(totalCredito)}</span>
                      <span className="pct">{porcentaje(totalCredito, totalVista).toFixed(1)}%</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>

          <div className="pg-grid pg-grid-even">
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Users size={16} /> Ventas por comercial</h2>
                <span className="pg-panel-meta">{monedaVista === 'USD' ? 'Dólares' : 'Soles'}{unificado ? ' unificados' : ''}</span>
              </div>
              <div className="pg-panel-body">
                {vendedores.length === 0 ? (
                  <div className="pg-empty"><Users size={24} /><strong>Sin ventas en el período</strong></div>
                ) : (
                  <ul className="rv-bars">
                    {vendedores.map(v => (
                      <li key={v.nombre}>
                        <div className="rv-bars-top">
                          <span title={v.nombre}>{obtenerNombreCorto(v.nombre) || v.nombre}</span>
                          <b>{simbolo(monedaVista)} {fmt2(v.total)}</b>
                        </div>
                        <div className="pg-meter"><span style={{ width: `${porcentaje(v.total, maxVendedor)}%` }} /></div>
                        <span className="rv-bars-meta">
                          {v.cantidad} órdenes · {porcentaje(v.total, totalVista).toFixed(1)}% del total
                          {v.comision > 0 && ` · comisión ${simbolo(monedaVista)} ${fmt2(v.comision)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {(resumen.total_comisiones_pen > 0 || resumen.total_comisiones_usd > 0) && (
                  <div className="rv-comision">
                    <Percent size={15} />
                    Comisiones del período
                    <b>S/ {fmt2(resumen.total_comisiones_pen)}</b>
                    {resumen.total_comisiones_usd > 0 && <b>$ {fmt2(resumen.total_comisiones_usd)}</b>}
                  </div>
                )}
              </div>
            </section>

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><FileCheck size={16} /> Facturación electrónica (SEE)</h2>
                {puedeAbrirTrazabilidad && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/facturacion/trazabilidad')}>
                    Trazabilidad <ExternalLink size={13} />
                  </button>
                )}
              </div>
              <div className="pg-panel-body">
                <div className="rv-see-grid">
                  {TILES_SEE.map(clave => {
                    const cfg = ESTADOS_SEE[clave];
                    const Icono = cfg.icon;
                    const datos = seeConteo[clave];
                    return (
                      <button
                        key={clave}
                        type="button"
                        className={`rv-see-tile ${filtroSee === clave ? 'on' : ''}`}
                        style={{ '--tile-c': cfg.color }}
                        disabled={datos.cantidad === 0 && filtroSee !== clave}
                        aria-pressed={filtroSee === clave}
                        onClick={() => setFiltroSee(filtroSee === clave ? '' : clave)}
                      >
                        <span><Icono size={12} /> {cfg.label}</span>
                        <strong>{datos.cantidad}</strong>
                        <small>
                          {datos.PEN > 0 || datos.USD === 0 ? `S/ ${fmt2(datos.PEN)}` : ''}
                          {datos.PEN > 0 && datos.USD > 0 ? ' · ' : ''}
                          {datos.USD > 0 ? `$ ${fmt2(datos.USD)}` : ''}
                        </small>
                      </button>
                    );
                  })}
                </div>
                <div className="rv-see-extra">
                  <div>
                    <Receipt size={16} />
                    <span>
                      Notas de crédito aceptadas
                      <b>{notasCredito}{notasCredito > 0 && ` · S/ ${fmt2(montoNotasCredito.PEN)}${montoNotasCredito.USD > 0 ? ` · $ ${fmt2(montoNotasCredito.USD)}` : ''}`}</b>
                    </span>
                  </div>
                  <div>
                    <Truck size={16} />
                    <span>
                      Despachos con guía GRE
                      <b>{despachadasConGuia} de {despachadas}{guiasAceptadas > 0 && ` · ${guiasAceptadas} aceptadas`}</b>
                    </span>
                  </div>
                </div>
                <p className="rv-see-note">Pulsa un estado para filtrar la tabla. Solo cuentan las órdenes con tipo de comprobante Factura.</p>
              </div>
            </section>
          </div>

          <section className="pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><ShoppingCart size={16} /> Detalle de órdenes <span className="pg-count">{filasTabla.length}</span></h2>
              <div className="rv-table-tools">
                {filtroSee && (
                  <span className="rv-active-filter">
                    SEE: {ESTADOS_SEE[filtroSee].label}
                    <button type="button" onClick={() => setFiltroSee('')} aria-label="Quitar filtro SEE"><X size={13} /></button>
                  </span>
                )}
                <div className="rv-search">
                  <Search size={14} />
                  <input type="search" className="form-input" placeholder="Orden, cliente, RUC, comprobante…"
                    value={busquedaTabla} onChange={(e) => setBusquedaTabla(e.target.value)} aria-label="Buscar en la tabla" />
                </div>
              </div>
            </div>
            <div className="pg-table-wrap">
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Cliente</th>
                    <th>Comercial</th>
                    <th className={`center ${filtros.filtroFecha === 'fecha_emision' ? 'is-focus' : ''}`}>Emisión</th>
                    <th className={`center ${filtros.filtroFecha === 'fecha_sunat' ? 'is-focus' : ''}`}>SUNAT</th>
                    <th className={`center ${filtros.filtroFecha === 'fecha_despacho' ? 'is-focus' : ''}`}>Despacho</th>
                    <th>Comprobante</th>
                    <th className="num">Total</th>
                    <th className="center">Pago</th>
                    <th className="center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filasPagina.length > 0 ? filasPagina.map(item => {
                    const principal = comprobantePrincipal(item);
                    const documento = numeroDocumento(item);
                    return (
                      <tr key={item.id} className="is-clickable" onClick={() => verDetalleOrden(item)}>
                        <td className="nowrap">
                          <span className="pg-code">{item.numero}</span>
                          {item.numero_cotizacion && <span className="pg-cell-sub">{item.numero_cotizacion}</span>}
                        </td>
                        <td>
                          <span className="pg-cell-main pg-truncate" title={item.cliente}>{item.cliente}</span>
                          <span className="pg-cell-sub">{item.ruc}</span>
                        </td>
                        <td className="nowrap pg-muted">{obtenerNombreCorto(item.vendedor)}</td>
                        <td className={`center nowrap ${filtros.filtroFecha === 'fecha_emision' ? 'is-focus' : ''}`}>{formatearFecha(item.fecha_emision)}</td>
                        <td className={`center nowrap ${filtros.filtroFecha === 'fecha_sunat' ? 'is-focus' : ''}`}>
                          {item.fecha_facturacion_sunat ? formatearFecha(item.fecha_facturacion_sunat) : <span className="pg-muted">—</span>}
                        </td>
                        <td className={`center nowrap ${filtros.filtroFecha === 'fecha_despacho' ? 'is-focus' : ''}`}>
                          {item.fecha_despacho ? formatearFecha(item.fecha_despacho) : <span className="pg-muted">Pendiente</span>}
                        </td>
                        <td>
                          <div className="rv-doc">
                            <div className="rv-doc-line">
                              {documento ? <span className="rv-doc-num">{documento}</span> : <span className="pg-muted">—</span>}
                              <span className="rv-doc-tipo">{item.tipo_comprobante || 'Sin comprobante'}</span>
                            </div>
                            {item.see && item.see.estado !== 'NO_APLICA' && (
                              <div className="rv-doc-line">
                                <BadgeSee estado={item.see.estado} />
                                {renderArchivosComprobante(principal)}
                                {item.comprobante_sunat_url && !principal?.es_electronico && (
                                  <button type="button" className="pg-iconbtn" title="Ver comprobante adjunto" aria-label="Ver comprobante adjunto"
                                    onClick={(e) => { e.stopPropagation(); abrirVisorSunat(item); }}>
                                    <Eye size={13} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="num">{renderMonto(item)}</td>
                        <td className="center">
                          <span className={`badge ${ESTADOS_PAGO.find(e => e.id === item.estado_pago)?.badge || 'badge-secondary'}`}>{item.estado_pago}</span>
                          {parseFloat(item.pendiente_cobro) > 0.01 && item.estado_pago !== 'Pendiente' && (
                            <span className="pg-cell-sub">Saldo {simbolo(item.moneda)} {formatearNumero(item.pendiente_cobro)}</span>
                          )}
                        </td>
                        <td className="center">
                          <BadgeEstadoOrden estado={item.estado} />
                          {['Retrasado', 'Vencido'].includes(item.estado_logistico) && (
                            <span className="pg-cell-sub text-danger">{item.estado_logistico}</span>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={10}>
                        <div className="pg-empty">
                          <Search size={28} />
                          <strong>{loading ? 'Cargando reporte…' : 'No hay órdenes con estos filtros'}</strong>
                          {!loading && <span>Cambia el rango de fechas, quita filtros o limpia la búsqueda.</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filasTabla.length > FILAS_POR_PAGINA && (
              <div className="pg-pager">
                <span>
                  <b>{(paginaActual - 1) * FILAS_POR_PAGINA + 1}</b>–<b>{Math.min(paginaActual * FILAS_POR_PAGINA, filasTabla.length)}</b> de <b>{filasTabla.length}</b> órdenes
                </span>
                <div className="pg-pager-nav">
                  <button type="button" className="pagination-nav-btn" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>
                    <ChevronLeft size={15} /> Anterior
                  </button>
                  {numerosPagina.map((n, i) => (
                    n === '…'
                      ? <span key={`e-${i}`} className="pg-muted">…</span>
                      : <button key={n} type="button" className={`pagination-page-btn ${n === paginaActual ? 'active' : ''}`} onClick={() => setPagina(n)}>{n}</button>
                  ))}
                  <button type="button" className="pagination-nav-btn" disabled={paginaActual === totalPaginas} onClick={() => setPagina(paginaActual + 1)}>
                    Siguiente <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {mostrarDetalleOrden && ordenSeleccionada && renderDrawer()}

        <Modal isOpen={visorArchivo.open} onClose={cerrarVisor} title={visorArchivo.titulo} size="2xl">
          <div className="flex justify-center items-center p-4 min-h-[50vh]" style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 2 }}>
            {visorArchivo.tipo === 'pdf' ? (
              <iframe src={visorArchivo.url} className="w-full h-[70vh]" style={{ border: 0 }} title="Visor de archivo" />
            ) : (
              <img src={visorArchivo.url} alt={visorArchivo.titulo || 'Archivo adjunto'} className="rv-visor-img" />
            )}
          </div>
          <div className="flex justify-end mt-2">
            <button className="btn btn-primary" onClick={cerrarVisor}>Cerrar</button>
          </div>
        </Modal>

        {modalSunat.isOpen && (
          <ModalValidacionSunat
            isOpen={modalSunat.isOpen}
            onClose={() => setModalSunat({ isOpen: false, orden: null })}
            orden={modalSunat.orden}
            file={null}
            readOnly={true}
            existingData={modalSunat.orden}
            onConfirm={() => {}}
          />
        )}
      </div>
    </>
  );
};

export default ReporteVentas;
