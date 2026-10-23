import { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  Edit,
  ShoppingCart,
  Filter,
  TrendingUp,
  Clock,
  Truck,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Shield,
  BadgeCheck,
  RefreshCcw,
  Calendar,
  FileText,
  X,
  ChevronDown,
  Check
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import ModalValidacionSunat from '../../components/Ventas/ModalValidacionSunat';
import { ordenesVentaAPI, tipoCambioAPI } from '../../config/api';
import { usePermisos } from '../../context/PermisosContext';
import { BadgeEstadoOrden, BadgeEstadoPago, BadgeVerificacion, BadgeSee } from './estadosVentas';
import './Ventas.css';

const TC_SESSION_KEY = 'indpack_tipo_cambio';

const FilterCheckboxGroup = memo(({ label, options, selectedValues, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (e, value) => {
    e.stopPropagation();
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  const getLabelText = () => {
    if (selectedValues.length === 0) return 'Todos';
    if (selectedValues.length === 1) {
      const option = options.find(o => o.value === selectedValues[0]);
      return option ? option.label : selectedValues[0];
    }
    return `${selectedValues.length} seleccionados`;
  };

  const active = selectedValues.length > 0;

  return (
    <div className="pg-field vt-ms" ref={dropdownRef}>
      <span className="pg-field-label">{label}</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`vt-ms-trigger ${active ? 'has-value' : ''}`}
        aria-expanded={isOpen}
      >
        <span>{getLabelText()}</span>
        <ChevronDown size={15} className={isOpen ? 'is-open' : ''} />
      </button>

      {isOpen && (
        <div className="vt-ms-menu">
          <div className="vt-ms-list">
            {options.map((opt) => {
              const isSelected = selectedValues.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={(e) => handleToggle(e, opt.value)}
                  className={`vt-ms-option ${isSelected ? 'on' : ''}`}
                  role="checkbox"
                  aria-checked={isSelected}
                >
                  <span className="vt-ms-box">{isSelected && <Check size={12} />}</span>
                  <span>{opt.label}</span>
                </div>
              );
            })}
          </div>
          {selectedValues.length > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="vt-ms-clear"
            >
              <RefreshCcw size={12} />
              Limpiar selección
            </button>
          )}
        </div>
      )}
    </div>
  );
});

function OrdenesVenta() {
  const navigate = useNavigate();
  const { tienePermiso } = usePermisos();
  const verFinanzas = tienePermiso('verFinanzasVentas');
  const soloLectura = !verFinanzas;

  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [descargandoPDF, setDescargandoPDF] = useState(null);
  const [mostrarEstadisticas, setMostrarEstadisticas] = useState(false);

  const [visorArchivo, setVisorArchivo] = useState({
    isOpen: false,
    url: null,
    titulo: ''
  });

  const [modalSunat, setModalSunat] = useState({
    isOpen: false,
    orden: null,
    facturas: null,
    resumen: null
  });

  const abrirVisor = (url, titulo) => {
    try {
      if (url && typeof url === 'string' && url.startsWith('[')) {
        const parsed = JSON.parse(url);
        if (parsed.length > 0) {
          setVisorArchivo({ isOpen: true, url: parsed[0], titulo });
          return;
        }
      }
    } catch (e) { }
    setVisorArchivo({ isOpen: true, url, titulo });
  };

  const abrirVisorSunat = (row) => {
    setModalSunat({
      isOpen: true,
      orden: row,
      facturas: null,
      resumen: null
    });
  };

  const abrirListaFacturas = async (row) => {
    try {
      const res = await ordenesVentaAPI.getFacturas(row.id_orden_venta);
      const data = res.data?.data || {};
      const emitidas = (data.facturas || []).filter(f => f.estado === 'Emitida');
      setModalSunat({ isOpen: true, orden: row, facturas: emitidas, resumen: data.resumen || null });
    } catch (e) {
      setModalSunat({ isOpen: true, orden: row, facturas: null, resumen: null });
    }
  };

  const fetchSalidaValorizada = async (idSalida) => {
    if (!idSalida || !modalSunat.orden) return null;
    const res = await ordenesVentaAPI.descargarPDFDespacho(modalSunat.orden.id_orden_venta, idSalida, true);
    const blob = new Blob([res.data], { type: 'application/pdf' });
    return window.URL.createObjectURL(blob);
  };

  const getSessionArray = (key) => {
    try {
      const val = sessionStorage.getItem(key);
      return val ? JSON.parse(val) : [];
    } catch (e) {
      return [];
    }
  };

  const [filtroEstado, setFiltroEstado] = useState(() => getSessionArray('ordenes_filtros_estado'));
  const [filtroEstadoPago, setFiltroEstadoPago] = useState(() => getSessionArray('ordenes_filtros_estado_pago'));
  const [filtroVerificacion, setFiltroVerificacion] = useState(() => getSessionArray('ordenes_filtros_verificacion'));
  const [filtroTipoComprobante, setFiltroTipoComprobante] = useState(() => getSessionArray('ordenes_filtros_tipo_comprobante'));
  const [filtroEstadoSunat, setFiltroEstadoSunat] = useState(() => getSessionArray('ordenes_filtros_estado_sunat'));
  const [filtroVendedor, setFiltroVendedor] = useState(() => getSessionArray('ordenes_filtros_vendedor'));
  const [filtroMoneda, setFiltroMoneda] = useState(() => getSessionArray('ordenes_filtros_moneda'));
  
  const [fechaInicio, setFechaInicio] = useState(() => sessionStorage.getItem('ordenes_fecha_inicio') || '');
  const [fechaFin, setFechaFin] = useState(() => sessionStorage.getItem('ordenes_fecha_fin') || '');
  const [busqueda, setBusqueda] = useState(() => sessionStorage.getItem('ordenes_busqueda') || '');
  const [busquedaAplicada, setBusquedaAplicada] = useState(busqueda);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [resumen, setResumen] = useState(null);
  
  const initPage = parseInt(sessionStorage.getItem('ordenes_pagina') || '1');
  const [currentPage, setCurrentPage] = useState(initPage);
  const [inputPage, setInputPage] = useState(initPage.toString());
  const itemsPerPage = 50;
  const tablaRef = useRef(null);
  const requestIdRef = useRef(0);
  const firmaFiltrosRef = useRef(null);

  const [tipoCambio, setTipoCambio] = useState(null);
  const [loadingTC, setLoadingTC] = useState(false);
  const [mostrarConversion, setMostrarConversion] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('ordenes_filtros_estado', JSON.stringify(filtroEstado));
    sessionStorage.setItem('ordenes_filtros_estado_pago', JSON.stringify(filtroEstadoPago));
    sessionStorage.setItem('ordenes_filtros_verificacion', JSON.stringify(filtroVerificacion));
    sessionStorage.setItem('ordenes_filtros_tipo_comprobante', JSON.stringify(filtroTipoComprobante));
    sessionStorage.setItem('ordenes_filtros_estado_sunat', JSON.stringify(filtroEstadoSunat));
    sessionStorage.setItem('ordenes_filtros_vendedor', JSON.stringify(filtroVendedor));
    sessionStorage.setItem('ordenes_filtros_moneda', JSON.stringify(filtroMoneda));
    sessionStorage.setItem('ordenes_fecha_inicio', fechaInicio);
    sessionStorage.setItem('ordenes_fecha_fin', fechaFin);
    sessionStorage.setItem('ordenes_busqueda', busqueda);
  }, [filtroEstado, filtroEstadoPago, filtroVerificacion, filtroTipoComprobante, filtroEstadoSunat, filtroVendedor, filtroMoneda, fechaInicio, fechaFin, busqueda]);

  useEffect(() => {
    setInputPage(currentPage.toString());
    sessionStorage.setItem('ordenes_pagina', currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    const timeout = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300);
    return () => clearTimeout(timeout);
  }, [busqueda]);

  useEffect(() => {
    const firma = JSON.stringify([filtroEstado, filtroVerificacion, filtroEstadoPago, filtroTipoComprobante, filtroEstadoSunat, filtroVendedor, filtroMoneda, fechaInicio, fechaFin, busquedaAplicada]);
    const soloPagina = firmaFiltrosRef.current !== null && firma === firmaFiltrosRef.current;
    firmaFiltrosRef.current = firma;
    cargarDatos(ordenes.length === 0, soloPagina);
    cargarTCDesdeSession();
  }, [filtroEstado, filtroVerificacion, filtroEstadoPago, filtroTipoComprobante, filtroEstadoSunat, filtroVendedor, filtroMoneda, fechaInicio, fechaFin, busquedaAplicada, currentPage]);

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
        setSuccess(`TC actualizado: S/ ${tcData.venta} (venta) — Fecha SBS: ${formatearFechaVisual(tcData.fecha)}`);
        setTimeout(() => setSuccess(null), 4000);
      } else {
        setError(response.data.error || 'No se pudo obtener el tipo de cambio');
      }
    } catch (err) {
      console.error('Error actualizando TC:', err);
      setError('Error al consultar tipo de cambio. Intente más tarde.');
    } finally {
      setLoadingTC(false);
    }
  };

  const cargarDatos = async (isInitial = false, soloDatos = false) => {
    const requestId = ++requestIdRef.current;
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setIsFiltering(true);
      }
      setError(null);

      const filtros = {};
      if (filtroEstado.length > 0) filtros.estado = filtroEstado;
      if (filtroEstadoPago.length > 0) filtros.estado_pago = filtroEstadoPago;
      if (filtroVerificacion.length > 0) filtros.estado_verificacion = filtroVerificacion;
      if (filtroTipoComprobante.length > 0) filtros.tipo_comprobante = filtroTipoComprobante;
      if (filtroEstadoSunat.length > 0) filtros.estado_sunat = filtroEstadoSunat;
      if (filtroVendedor.length > 0) filtros.vendedor = filtroVendedor;
      if (filtroMoneda.length > 0) filtros.moneda = filtroMoneda;
      if (fechaInicio) filtros.fecha_inicio = fechaInicio;
      if (fechaFin) filtros.fecha_fin = fechaFin;
      if (busquedaAplicada) filtros.search = busquedaAplicada;
      filtros.page = currentPage;
      filtros.limit = itemsPerPage;
      if (soloDatos) filtros.solo_datos = true;

      const response = await ordenesVentaAPI.getAll(filtros);

      if (response.data.success && requestId === requestIdRef.current) {
        setOrdenes(response.data.data || []);
        if (soloDatos) {
          setPagination(prev => ({ ...prev, page: response.data.pagination?.page ?? prev.page }));
        } else {
          setPagination(response.data.pagination || { total: response.data.data?.length || 0, totalPages: 1 });
          setResumen(response.data.summary || null);
        }
      }
      
    } catch (err) {
      console.error(err);
      if (requestId === requestIdRef.current) setError(err.response?.data?.error || 'Error al cargar órdenes de venta');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setIsFiltering(false);
      }
    }
  };

  const handleFechaInicioChange = (e) => {
    setFechaInicio(e.target.value);
  };

  const handleFechaFinChange = (e) => {
    setFechaFin(e.target.value);
  };

  const [textoFechaPeriodo, setTextoFechaPeriodo] = useState('');

  useEffect(() => {
    if (fechaInicio && fechaFin) {
      setTextoFechaPeriodo(`${formatearFechaVisual(fechaInicio)} — ${formatearFechaVisual(fechaFin)}`);
    } else if (resumen?.fecha_minima) {
      setTextoFechaPeriodo(`${formatearFechaVisual(resumen.fecha_minima)} — ${formatearFechaVisual(resumen.fecha_maxima || resumen.fecha_minima)}`);
    } else if (ordenes.length > 0) {
      const ordenesValidas = ordenes.filter(o => o.estado !== 'Cancelada' && o.fecha_emision);

      if (ordenesValidas.length > 0) {
        const fechasOrdenadas = [...ordenesValidas].sort((a, b) => {
          return new Date(a.fecha_emision.split('T')[0]) - new Date(b.fecha_emision.split('T')[0]);
        });

        const fechaMasAntigua = fechasOrdenadas[0].fecha_emision;

        const hoy = new Date();
        const strHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

        setTextoFechaPeriodo(`${formatearFechaVisual(fechaMasAntigua)} — ${formatearFechaVisual(strHoy)}`);
      } else {
        setTextoFechaPeriodo('SIN REGISTROS VÁLIDOS');
      }
    } else {
       setTextoFechaPeriodo('CARGANDO...');
    }
  }, [ordenes, resumen, fechaInicio, fechaFin]);

  const limpiarFiltros = () => {
    setFiltroEstado([]);
    setFiltroEstadoPago([]);
    setFiltroVerificacion([]);
    setFiltroTipoComprobante([]);
    setFiltroEstadoSunat([]);
    setFiltroVendedor([]);
    setFiltroMoneda([]);
    setFechaInicio('');
    setFechaFin('');
    setBusqueda('');
    setCurrentPage(1);
  };

  const ordenesFiltradas = ordenes;

  const estadisticasPagina = ordenesFiltradas.reduce((acc, orden) => {
    if (
      orden.estado === 'Cancelada' || 
      orden.estado_verificacion === 'Pendiente' || 
      orden.estado_verificacion === 'Rechazada'
    ) {
      return acc;
    }

    const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(String(orden.tipo_impuesto || '').toUpperCase().trim())
      || Number(orden.es_exportacion) === 1;
    const monto = esSinImpuesto ? parseFloat(orden.subtotal || 0) : parseFloat(orden.total || 0);
    const tipo = String(orden.tipo_comprobante || '').trim();
    
    const facturasExportacion = ['OV-2026-0380', 'OV-2026-0277', 'OV-2026-0162', 'OV-2026-0093'];

    if (tipo.includes('Factura')) {
      if (!esSinImpuesto || facturasExportacion.includes(orden.numero_orden)) {
        if (orden.moneda === 'PEN') acc.facturas_pen += monto;
        if (orden.moneda === 'USD') acc.facturas_usd += monto;
      } else {
        if (orden.moneda === 'PEN') acc.notas_venta_pen += monto;
        if (orden.moneda === 'USD') acc.notas_venta_usd += monto;
      }
    } else if (tipo.includes('Nota de Venta')) {
      if (orden.moneda === 'PEN') acc.notas_venta_pen += monto;
      if (orden.moneda === 'USD') acc.notas_venta_usd += monto;
    } else if (tipo === 'Sin Comprobante' || tipo === '') {
      if (orden.moneda === 'PEN') acc.sin_comprobante_pen += monto;
      if (orden.moneda === 'USD') acc.sin_comprobante_usd += monto;
    }
    
    return acc;
  }, { 
    facturas_pen: 0, facturas_usd: 0, 
    notas_venta_pen: 0, notas_venta_usd: 0,
    sin_comprobante_pen: 0, sin_comprobante_usd: 0 
  });
  const estadisticas = resumen || estadisticasPagina;

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = ordenesFiltradas;
  const totalPages = Math.max(1, pagination.totalPages || 1);

  useEffect(() => {
    const idsFiltrados = ordenesFiltradas.map(o => o.id_orden_venta);
    sessionStorage.setItem('ordenes_filtradas_ids', JSON.stringify(idsFiltrados));
  }, [ordenesFiltradas]);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const handlePageJump = (e) => {
    if (e.key === 'Enter') {
      const page = parseInt(inputPage);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      } else {
        setInputPage(currentPage.toString());
      }
    }
  };

  const handleNavegaDetalle = (id) => {
    sessionStorage.setItem('ordenes_pagina', currentPage);
    navigate(`/ventas/ordenes/${id}`);
  };

  const handleDescargarPDF = async (idOrden, numeroOrden, cliente) => {
    try {
      setDescargandoPDF(idOrden);
      setError(null);
      const response = await ordenesVentaAPI.descargarPDF(idOrden);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const clienteSanitizado = (cliente || 'CLIENTE')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-zA-Z0-9]/g, "_")   
        .replace(/_+/g, "_")            
        .toUpperCase();
      const nroOrden = numeroOrden || idOrden;
      const nombreArchivo = `${clienteSanitizado}_${nroOrden}.pdf`;
      link.setAttribute('download', nombreArchivo);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSuccess('PDF descargado exitosamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError('Error al descargar el PDF');
    } finally {
      setDescargandoPDF(null);
    }
  };

  const formatearFechaVisual = (fechaStr) => {
    if (!fechaStr) return '-';
    const partes = fechaStr.split('T')[0].split('-');
    if (partes.length !== 3) return fechaStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
  };

  const formatearMoneda = (valor, moneda) => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  const getPrioridadConfig = (prioridad) => {
    const configs = {
      'Baja': { clase: 'badge-secondary' },
      'Media': { clase: 'badge-info' },
      'Alta': { clase: 'badge-warning' },
      'Urgente': { clase: 'badge-danger' }
    };
    return configs[prioridad] || configs['Media'];
  };

  const renderSunat = (row) => {
    const value = row.facturado_sunat;
    const tipo = String(row.tipo_comprobante || '').trim();

    if (tipo === 'Nota de Venta' || tipo === 'Sin Comprobante' || tipo === '') {
      return <span className="badge badge-secondary"><FileText size={11} />No amerita</span>;
    }

    if (value === 1) {
      const numFacturas = Number(row.total_facturas || 0);
      const totalFacturado = Number(row.total_facturado || 0);
      const esSinImpuestoSunat = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(String(row.tipo_impuesto || '').toUpperCase())
        || Number(row.es_exportacion) === 1;
      const totalParaCmp = esSinImpuestoSunat ? parseFloat(row.subtotal || 0) : parseFloat(row.total || 0);
      const esParcial = totalFacturado > 0 && (totalParaCmp - totalFacturado) > 1;
      return (
        <div className="vt-sunat">
          <span className={`badge ${esParcial ? 'badge-warning' : 'badge-success'}`}>
            <BadgeCheck size={11} />
            {esParcial ? 'Parcial' : 'Facturado'}
          </span>
          {row.factura_see && (
            <span className="vt-see-line" title={`Último comprobante electrónico ${row.factura_see.documento || ''}`}>
              <BadgeSee estado={row.factura_see.sunat_estado} />
            </span>
          )}
          {numFacturas > 1 ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); abrirListaFacturas(row); }}
              className="vt-link-chip"
              title="Ver todas las facturas de esta orden"
            >
              <FileText size={10} /> {numFacturas} facturas
            </button>
          ) : (
            row.numero_comprobante_sunat && (
              <span className="pg-code vt-sunat-num">{row.numero_comprobante_sunat}</span>
            )
          )}
          {(numFacturas > 1 || row.comprobante_sunat_url) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); abrirListaFacturas(row); }}
              className="vt-link-chip"
              title={numFacturas > 1 ? 'Ver todas las facturas de esta orden' : 'Ver Detalle Factura SUNAT'}
            >
              <Eye size={10} /> {numFacturas > 1 ? 'Ver facturas' : 'Ver PDF'}
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="vt-sunat">
        <span className="badge badge-warning">
          <Clock size={11} />
          Pendiente
        </span>
        {row.factura_see && (
          <span className="vt-see-line" title="Último comprobante electrónico">
            <BadgeSee estado={row.factura_see.sunat_estado} />
            {row.factura_see.documento && <span className="pg-code vt-sunat-num">{row.factura_see.documento}</span>}
          </span>
        )}
      </div>
    );
  };

  const correlativosGuia = (row) => {
    const esFactura = String(row.tipo_comprobante || '').toLowerCase().includes('factura');
    return esFactura
      ? (row.guias || [])
          .map((g) => (
            String(g.sunat_estado || '').toUpperCase() === 'ACEPTADO' && g.serie_sunat && g.numero_sunat
              ? `${g.serie_sunat}-${g.numero_sunat}`
              : null
          ))
          .filter(Boolean)
      : (row.salidas_guia || [])
          .map((s) => s.guia_interna || null)
          .filter(Boolean);
  };

  const totalColumnas = verFinanzas ? 10 : 7;

  return (
    <div className="pg-page vt-page">
      {loading && <Loading variant="table" />}

      <div className={`vt-fade ${loading ? 'is-hidden' : ''}`}>
        <header className="pg-header">
          <div>
            <span className="pg-eyebrow"><ShoppingCart size={13} /> Ventas</span>
            <h1 className="pg-title">Órdenes de venta</h1>
            <p className="pg-subtitle">
              Gestión de operaciones comerciales · <Calendar size={12} className="vt-inline-icon" /> Período: <b>{textoFechaPeriodo}</b>
            </p>
          </div>
          {!soloLectura && (
            <div className="pg-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate('/ventas/ordenes/verificacion')}
              >
                <Shield size={16} /> Verificación
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/ventas/ordenes/nueva')}
              >
                <Plus size={16} /> Nueva orden
              </button>
            </div>
          )}
        </header>

        <div className="pg-stack">
          {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
          {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

          {verFinanzas && estadisticas && (
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><TrendingUp size={16} /> Resumen general</h2>
                <button
                  type="button"
                  onClick={() => setMostrarEstadisticas(!mostrarEstadisticas)}
                  className="btn btn-outline btn-sm"
                  aria-expanded={mostrarEstadisticas}
                >
                  {mostrarEstadisticas ? 'Ocultar resumen' : 'Ver resumen general'}
                  <ChevronDown size={14} className={`vt-chevron ${mostrarEstadisticas ? 'is-open' : ''}`} />
                </button>
              </div>

              {mostrarEstadisticas && (
                <div className="pg-panel-body">
                  <div className="pg-kpis">
                    {[
                      { label: 'Facturas · PEN', valor: estadisticas.facturas_pen, moneda: 'PEN', tono: 'is-accent', icon: FileText },
                      { label: 'Facturas · USD', valor: estadisticas.facturas_usd, moneda: 'USD', tono: 'is-accent', icon: FileText },
                      { label: 'N. venta · PEN', valor: estadisticas.notas_venta_pen, moneda: 'PEN', tono: 'is-info', icon: FileText },
                      { label: 'N. venta · USD', valor: estadisticas.notas_venta_usd, moneda: 'USD', tono: 'is-info', icon: FileText },
                      { label: 'Sin compr. · PEN', valor: estadisticas.sin_comprobante_pen, moneda: 'PEN', tono: 'is-warning', icon: DollarSign },
                      { label: 'Sin compr. · USD', valor: estadisticas.sin_comprobante_usd, moneda: 'USD', tono: 'is-warning', icon: DollarSign }
                    ].map(k => (
                      <div key={k.label} className={`pg-kpi ${k.tono}`}>
                        <div className="pg-kpi-top">
                          <span className="pg-kpi-label">{k.label}</span>
                          <span className="pg-kpi-icon"><k.icon size={16} /></span>
                        </div>
                        <span className="pg-kpi-value">{formatearMoneda(k.valor || 0, k.moneda)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="pg-panel">
            <div className="pg-filters">
              <div className="pg-filters-row">
                <div className="pg-field pg-field-grow pg-search">
                  <label className="pg-field-label" htmlFor="vt-ov-busqueda">Buscar</label>
                  <Search size={14} />
                  <input id="vt-ov-busqueda" type="search" className="form-input" placeholder="N°, cliente, RUC" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>
                <div className="pg-field">
                  <label className="pg-field-label" htmlFor="vt-ov-desde">Desde</label>
                  <input
                    id="vt-ov-desde"
                    type="date"
                    className="form-input vt-date"
                    value={fechaInicio}
                    onChange={handleFechaInicioChange}
                  />
                </div>
                <div className="pg-field">
                  <label className="pg-field-label" htmlFor="vt-ov-hasta">Hasta</label>
                  <input
                    id="vt-ov-hasta"
                    type="date"
                    className="form-input vt-date"
                    value={fechaFin}
                    onChange={handleFechaFinChange}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarFiltrosAvanzados(!mostrarFiltrosAvanzados)}
                  className={`btn ${mostrarFiltrosAvanzados ? 'btn-secondary' : 'btn-outline'}`}
                  style={{ height: 38 }}
                  aria-expanded={mostrarFiltrosAvanzados}
                >
                  <Filter size={15} /> {mostrarFiltrosAvanzados ? 'Cerrar filtros' : 'Más filtros'}
                </button>
                <button type="button" onClick={limpiarFiltros} className="btn btn-ghost" style={{ height: 38 }} title="Limpiar todos los filtros">
                  <X size={15} /> Limpiar
                </button>
              </div>

              {mostrarFiltrosAvanzados && (
                <div className="vt-filters-grid vt-filters-more">
                  <FilterCheckboxGroup label="Estado Logístico" selectedValues={filtroEstado} onChange={setFiltroEstado} options={[
                    { label: 'En Espera', value: 'En Espera' }, { label: 'En Proceso', value: 'En Proceso' }, { label: 'Atendido por Producción', value: 'Atendido por Producción' }, { label: 'Despacho Parcial', value: 'Despacho Parcial' }, { label: 'Despachada', value: 'Despachada' }, { label: 'Entregada', value: 'Entregada' }, { label: 'Cancelada', value: 'Cancelada' }
                  ]} />
                  {verFinanzas && (
                    <FilterCheckboxGroup label="Estado Pago" selectedValues={filtroEstadoPago} onChange={setFiltroEstadoPago} options={[
                      { label: 'Sin Pagar', value: 'Pendiente' }, { label: 'Pago Parcial', value: 'Parcial' }, { label: 'Pagado', value: 'Pagado' }
                    ]} />
                  )}
                  <FilterCheckboxGroup label="Verificación" selectedValues={filtroVerificacion} onChange={setFiltroVerificacion} options={[
                    { label: 'Aprobadas', value: 'Aprobada' }, { label: 'Pendientes', value: 'Pendiente' }, { label: 'Rechazadas', value: 'Rechazada' }
                  ]} />
                  <FilterCheckboxGroup label="Documento" selectedValues={filtroTipoComprobante} onChange={setFiltroTipoComprobante} options={[
                    { label: 'Facturas', value: 'Factura' }, { label: 'Notas de Venta', value: 'Nota de Venta' }, { label: 'Sin Comprobante', value: 'Sin Comprobante' }
                  ]} />
                  {verFinanzas && (
                    <FilterCheckboxGroup label="Estado SUNAT" selectedValues={filtroEstadoSunat} onChange={setFiltroEstadoSunat} options={[
                      { label: 'Facturado', value: 'Facturado' }, { label: 'Pendiente', value: 'Pendiente' }, { label: 'No amerita', value: 'No Amerita' }
                    ]} />
                  )}
                  <FilterCheckboxGroup label="Vendedor" selectedValues={filtroVendedor} onChange={setFiltroVendedor} options={[
                    { label: 'JOHANNA VALLE TORRES', value: '12' }, { label: 'YESSICA GABY ORDOÑEZ PEREZ', value: '13' }, { label: 'VALESHKA BETSABETH LAZARO COLMENARES', value: '20' }
                  ]} />
                  <FilterCheckboxGroup label="Moneda" selectedValues={filtroMoneda} onChange={setFiltroMoneda} options={[
                    { label: 'Soles (PEN)', value: 'PEN' }, { label: 'Dólares (USD)', value: 'USD' }
                  ]} />
                </div>
              )}
            </div>
          </section>

          <section className="pg-panel vt-busy-host" ref={tablaRef}>
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><ShoppingCart size={16} /> Lista de órdenes <span className="pg-count">{pagination.total}</span></h2>
              <span className="pg-panel-meta">Mostrando {currentItems.length} registros · pulsa una fila para ver el detalle</span>
            </div>

            {isFiltering && (
              <div className="vt-busy" role="status">
                <RefreshCcw size={24} className="animate-spin" />
                <span>Procesando</span>
              </div>
            )}

            <div className="pg-table-wrap">
              <table className="pg-table">
                <thead>
                  <tr>
                    <th className="center">Verificación</th>
                    <th>Comprobante / Orden</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Vendedor</th>
                    {verFinanzas && <th className="num">Total / Pagado</th>}
                    {verFinanzas && <th className="center">Pago</th>}
                    {verFinanzas && <th className="center">SUNAT</th>}
                    <th className="center">Logística</th>
                    <th className="center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length > 0 ? currentItems.map(row => {
                    const value = row.id_orden_venta;
                    const tipoRaw = row.tipo_comprobante || '';
                    const esFactura = tipoRaw.toLowerCase().includes('factura');
                    const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(String(row.tipo_impuesto || '').toUpperCase())
                      || Number(row.es_exportacion) === 1;
                    const total = esSinImpuesto ? parseFloat(row.subtotal || 0) : parseFloat(row.total || 0);
                    const pagado = parseFloat(row.monto_pagado || 0);
                    const porcentaje = total > 0 ? (pagado / total) * 100 : 0;
                    const correlativos = correlativosGuia(row);
                    return (
                      <tr key={value} className="is-clickable" onClick={() => handleNavegaDetalle(value)}>
                        <td className="center">
                          <BadgeVerificacion estado={row.estado_verificacion} />
                          {row.estado_verificacion === 'Aprobada' && row.verificado_por && (
                            <span className="pg-cell-sub">{row.verificado_por}</span>
                          )}
                          {row.estado_verificacion === 'Rechazada' && (
                            <span className="pg-cell-sub vt-text-danger">Corregir</span>
                          )}
                        </td>
                        <td className="nowrap">
                          <span className="pg-cell-main">
                            <span className={`badge badge-sm ${esFactura ? 'badge-success' : 'badge-info'}`}>
                              {tipoRaw || 'Sin Tipo'}
                            </span>
                            {!esFactura && row.numero_comprobante && (
                              <span className="pg-tag vt-ml">{row.numero_comprobante}</span>
                            )}
                          </span>
                          <span className="pg-cell-sub">Ord: <span className="pg-code">{row.numero_orden}</span></span>
                        </td>
                        <td className="nowrap">{formatearFechaVisual(row.fecha_emision)}</td>
                        <td>
                          <span className="pg-cell-main pg-truncate" title={row.cliente}>{row.cliente}</span>
                          <span className="pg-cell-sub">RUC {row.ruc_cliente}</span>
                        </td>
                        <td>{row.comercial || <span className="pg-muted">Sin asignar</span>}</td>
                        {verFinanzas && (
                          <td className="num">
                            <span className="vt-amount">{formatearMoneda(total, row.moneda)}</span>
                            <span className="pg-cell-sub">Pagado {formatearMoneda(pagado, row.moneda)}</span>
                            <div className="pg-meter" style={{ '--meter-c': porcentaje >= 99 ? 'var(--success)' : 'var(--accent)' }} title={`${porcentaje.toFixed(0)}% pagado`}>
                              <span style={{ width: `${Math.min(100, porcentaje)}%` }} />
                            </div>
                          </td>
                        )}
                        {verFinanzas && (
                          <td className="center"><BadgeEstadoPago estado={row.estado_pago} /></td>
                        )}
                        {verFinanzas && (
                          <td className="center" onClick={(e) => e.stopPropagation()}>{renderSunat(row)}</td>
                        )}
                        <td className="center">
                          <BadgeEstadoOrden estado={row.estado} />
                          {correlativos.length > 0 && (
                            <div className="vt-guias vt-guias-center">
                              {correlativos.map((c, i) => (
                                <span key={i} className="vt-guia" title="Guía de remisión">
                                  <Truck size={10} className="pg-muted" />
                                  <span className="pg-code">{c}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="center" onClick={(e) => e.stopPropagation()}>
                          <div className="pg-rowactions">
                            <button type="button" className="pg-iconbtn" onClick={(e) => { e.stopPropagation(); handleNavegaDetalle(value); }} title="Ver" aria-label={`Ver ${row.numero_orden}`}><Eye size={15} /></button>
                            {verFinanzas && (
                              <>
                                <button type="button" className="pg-iconbtn" onClick={(e) => { e.stopPropagation(); navigate(`/ventas/ordenes/${value}/editar`); }} title="Editar" aria-label={`Editar ${row.numero_orden}`} disabled={row.estado_verificacion === 'Pendiente'}><Edit size={15} /></button>
                                <button type="button" className="pg-iconbtn" onClick={(e) => { e.stopPropagation(); handleDescargarPDF(value, row.numero_orden, row.cliente); }} disabled={descargandoPDF === value} title="PDF" aria-label={`Descargar PDF de ${row.numero_orden}`}>
                                  {descargandoPDF === value ? <RefreshCcw size={15} className="animate-spin" /> : <Download size={15} />}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={totalColumnas}>
                        <div className="pg-empty">
                          <ShoppingCart size={28} />
                          <strong>No hay registros con los filtros aplicados</strong>
                          <span>Cambia la búsqueda, las fechas o los filtros avanzados.</span>
                          <button type="button" className="btn btn-outline btn-sm" onClick={limpiarFiltros}><X size={14} /> Limpiar filtros</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {pagination.total > itemsPerPage && (
              <div className="pg-pager">
                <span>
                  <b>{(currentPage - 1) * itemsPerPage + 1}</b>–<b>{(currentPage - 1) * itemsPerPage + currentItems.length}</b> de <b>{pagination.total}</b> órdenes
                </span>

                <div className="pg-pager-nav">
                  <button
                    type="button"
                    className="pagination-nav-btn"
                    onClick={goToPrevPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={15} /> Anterior
                  </button>
                  {getPageNumbers().map((num, idx) => (
                    num === '...'
                      ? <span key={`ell-${idx}`} className="pg-muted">…</span>
                      : (
                        <button
                          type="button"
                          key={`pg-${num}`}
                          onClick={() => setCurrentPage(num)}
                          className={`pagination-page-btn ${currentPage === num ? 'active' : ''}`}
                          aria-current={currentPage === num ? 'page' : undefined}
                        >
                          {num}
                        </button>
                      )
                  ))}
                  <button
                    type="button"
                    className="pagination-nav-btn"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente <ChevronRight size={15} />
                  </button>
                </div>

                <label className="vt-page-jump">
                  Ir a
                  <input
                    type="number" min="1" max={totalPages} value={inputPage}
                    onChange={(e) => setInputPage(e.target.value)}
                    onKeyDown={handlePageJump}
                    onBlur={() => { const p = parseInt(inputPage); if (p >= 1 && p <= totalPages) setCurrentPage(p); else setInputPage(currentPage.toString()); }}
                    className="form-input"
                  />
                  / {totalPages}
                </label>
              </div>
            )}
          </section>
        </div>
      </div>

      <Modal isOpen={visorArchivo.isOpen} onClose={() => setVisorArchivo({ isOpen: false, url: null, titulo: '' })} title={visorArchivo.titulo}>
        <div className="vt-visor">
          {visorArchivo.url ? (
            <iframe
              src={visorArchivo.url}
              title={visorArchivo.titulo}
            />
          ) : (
            <div className="pg-empty">Documento no disponible</div>
          )}
        </div>
      </Modal>

      <ModalValidacionSunat
        isOpen={modalSunat.isOpen}
        onClose={() => setModalSunat({ isOpen: false, orden: null, facturas: null, resumen: null })}
        orden={modalSunat.orden}
        facturas={modalSunat.facturas}
        resumen={modalSunat.resumen}
        fetchSalidaPDF={fetchSalidaValorizada}
        file={null}
        readOnly={true}
        existingData={modalSunat.orden}
        onConfirm={() => {}}
      />
    </div>
  );
}

export default OrdenesVenta;
