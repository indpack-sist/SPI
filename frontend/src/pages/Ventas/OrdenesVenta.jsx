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
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Download, 
  User, 
  UserCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  CreditCard,
  PlayCircle,
  Factory,
  Shield,
  BadgeCheck,
  RefreshCcw,
  Calendar,
  ArrowRightLeft,
  FileText,
  X,
  ChevronDown,
  Check
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { ordenesVentaAPI, tipoCambioAPI } from '../../config/api';

const TC_SESSION_KEY = 'indpack_tipo_cambio';

// Componente para el grupo de checkboxes de filtro
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

  return (
    <div className="form-group mb-0" ref={dropdownRef}>
      <label className="form-label mb-1.5" style={{ fontSize: '0.65rem', color: 'var(--wire)' }}>{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between w-full h-10 px-3 text-sm transition-all border rounded shadow-inner ${
            selectedValues.length > 0 
              ? 'border-primary bg-primary/10 text-primary font-bold' 
              : 'border-steel bg-carbon-mid text-mist hover:border-wire'
          }`}
          style={{ 
            backgroundColor: selectedValues.length > 0 ? 'rgba(232, 184, 75, 0.1)' : 'var(--carbon-mid)',
            borderColor: selectedValues.length > 0 ? 'var(--primary)' : 'var(--steel)',
            color: selectedValues.length > 0 ? 'var(--primary)' : 'var(--mist)'
          }}
        >
          <span className="truncate mr-2 font-medium">{getLabelText()}</span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${selectedValues.length > 0 ? 'text-primary' : 'text-wire'}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-carbon-light border border-steel rounded shadow-xl overflow-hidden min-w-[220px]"
               style={{ backgroundColor: 'var(--carbon-light)', borderColor: 'var(--steel)' }}>
            <div className="max-h-64 overflow-y-auto p-1 space-y-0.5 scrollbar-thin">
              {options.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={(e) => handleToggle(e, opt.value)}
                    className={`flex items-center px-3 py-2.5 rounded cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-steel/30 text-mist'
                    }`}
                  >
                    <div className="flex items-center justify-center mr-3">
                      <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${
                        isSelected 
                          ? 'bg-primary border-primary shadow-[0_0_10px_rgba(232,184,75,0.3)]' 
                          : 'bg-carbon border-steel'
                      }`}>
                        {isSelected && <Check size={14} className="text-carbon stroke-[4px]" />}
                      </div>
                    </div>
                    <span className={`text-sm select-none ${isSelected ? 'font-bold' : 'font-medium'}`}>
                      {opt.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {selectedValues.length > 0 && (
              <div className="p-1 bg-carbon border-t border-steel">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChange([]); }}
                  className="w-full py-2 text-[0.7rem] uppercase tracking-wider text-danger hover:bg-danger/10 rounded font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={12} />
                  Limpiar selección
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

function OrdenesVenta() {
  const navigate = useNavigate();
  
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [descargandoPDF, setDescargandoPDF] = useState(null);

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
  
  const [fechaInicio, setFechaInicio] = useState(() => sessionStorage.getItem('ordenes_fecha_inicio') || '');
  const [fechaFin, setFechaFin] = useState(() => sessionStorage.getItem('ordenes_fecha_fin') || '');
  const [busqueda, setBusqueda] = useState(() => sessionStorage.getItem('ordenes_busqueda') || '');
  
  const initPage = parseInt(sessionStorage.getItem('ordenes_pagina') || '1');
  const [currentPage, setCurrentPage] = useState(initPage);
  const [inputPage, setInputPage] = useState(initPage.toString());
  const itemsPerPage = 20;
  const tablaRef = useRef(null);

  const [tipoCambio, setTipoCambio] = useState(null);
  const [loadingTC, setLoadingTC] = useState(false);
  const [mostrarConversion, setMostrarConversion] = useState(false);

  // Guardar en session storage cada que cambian los filtros
  useEffect(() => {
    sessionStorage.setItem('ordenes_filtros_estado', JSON.stringify(filtroEstado));
    sessionStorage.setItem('ordenes_filtros_estado_pago', JSON.stringify(filtroEstadoPago));
    sessionStorage.setItem('ordenes_filtros_verificacion', JSON.stringify(filtroVerificacion));
    sessionStorage.setItem('ordenes_filtros_tipo_comprobante', JSON.stringify(filtroTipoComprobante));
    sessionStorage.setItem('ordenes_fecha_inicio', fechaInicio);
    sessionStorage.setItem('ordenes_fecha_fin', fechaFin);
    sessionStorage.setItem('ordenes_busqueda', busqueda);
  }, [filtroEstado, filtroEstadoPago, filtroVerificacion, filtroTipoComprobante, fechaInicio, fechaFin, busqueda]);

  useEffect(() => {
    setInputPage(currentPage.toString());
    sessionStorage.setItem('ordenes_pagina', currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    cargarDatos(false);
    cargarTCDesdeSession();
  }, [filtroEstado, filtroVerificacion, filtroEstadoPago, filtroTipoComprobante, fechaInicio, fechaFin]);

  useEffect(() => {
    cargarDatos(true);
  }, []);

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

  const cargarDatos = async (isInitial = false) => {
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
      if (fechaInicio) filtros.fecha_inicio = fechaInicio;
      if (fechaFin) filtros.fecha_fin = fechaFin;
      
      const response = await ordenesVentaAPI.getAll(filtros);
      
      if (response.data.success) {
        setOrdenes(response.data.data || []);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar órdenes de venta');
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  };

  const limpiarFiltros = () => {
    setFiltroEstado([]);
    setFiltroEstadoPago([]);
    setFiltroVerificacion([]);
    setFiltroTipoComprobante([]);
    setFechaInicio('');
    setFechaFin('');
    setBusqueda('');
    setCurrentPage(1);
  };

  const ordenesFiltradas = ordenes.filter(orden => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return (
      orden.numero_orden?.toLowerCase().includes(term) ||
      orden.numero_comprobante?.toLowerCase().includes(term) ||
      orden.numero_cotizacion?.toLowerCase().includes(term) ||
      orden.cliente?.toLowerCase().includes(term) ||
      orden.ruc_cliente?.toLowerCase().includes(term) ||
      orden.comercial?.toLowerCase().includes(term) ||
      orden.registrado_por?.toLowerCase().includes(term)
    );
  });

  // Calcular estadísticas dinámicamente basadas en los filtros actuales
  const estadisticas = ordenesFiltradas.reduce((acc, orden) => {
    // Regla de Exclusión Global: No sumar Canceladas, Pendientes de Verificación ni Rechazadas
    if (
      orden.estado === 'Cancelada' || 
      orden.estado_verificacion === 'Pendiente' || 
      orden.estado_verificacion === 'Rechazada'
    ) {
      return acc;
    }

    const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(String(orden.tipo_impuesto || '').toUpperCase().trim());
    const monto = esSinImpuesto ? parseFloat(orden.subtotal || 0) : parseFloat(orden.total || 0);
    const tipo = String(orden.tipo_comprobante || '').trim();

    if (tipo.includes('Factura')) {
      if (orden.moneda === 'PEN') acc.facturas_pen += monto;
      if (orden.moneda === 'USD') acc.facturas_usd += monto;
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

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = ordenesFiltradas.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(ordenesFiltradas.length / itemsPerPage);

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
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(valor);
  };

  const formatearMoneda = (valor, moneda) => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  const getEstadoVerificacionConfig = (estadoVerif) => {
    const configs = {
      'Pendiente': { icono: Clock, clase: 'badge-warning', texto: 'Pend. Verif.' },
      'Aprobada': { icono: CheckCircle, clase: 'badge-success', texto: 'Aprobada' },
      'Rechazada': { icono: XCircle, clase: 'badge-danger', texto: 'Rechazada' }
    };
    return configs[estadoVerif] || configs['Pendiente'];
  };

  const getEstadoConfig = (estado) => {
    const configs = {
      'En Espera': { icono: Clock, clase: 'badge-warning', texto: 'En Espera' },
      'En Proceso': { icono: PlayCircle, clase: 'badge-info', texto: 'En Proceso' },
      'Atendido por Producción': { icono: Factory, clase: 'badge-primary', texto: 'Atendido' },
      'Despacho Parcial': { icono: Truck, clase: 'badge-warning', texto: 'Desp. Parcial' },
      'Despachada': { icono: Truck, clase: 'badge-primary', texto: 'Despachada' },
      'Entregada': { icono: CheckCircle, clase: 'badge-success', texto: 'Entregada' },
      'Cancelada': { icono: XCircle, clase: 'badge-danger', texto: 'Cancelada' }
    };
    return configs[estado] || configs['En Espera'];
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

  const getEstadoPagoConfig = (estadoPago) => {
    const configs = {
      'Pendiente': { clase: 'badge-warning', icono: Clock },
      'Parcial': { clase: 'badge-info', icono: CreditCard },
      'Pagado': { clase: 'badge-success', icono: CheckCircle }
    };
    return configs[estadoPago] || configs['Pendiente'];
  };

  const columns = [
    {
      header: 'Verificación',
      accessor: 'estado_verificacion',
      width: '120px',
      align: 'center',
      render: (value, row) => {
        const config = getEstadoVerificacionConfig(value);
        const Icono = config.icono;
        return (
          <div>
            <span className={`badge ${config.clase} text-xs`}>
              <Icono size={12} />
              {config.texto}
            </span>
            {value === 'Aprobada' && row.verificado_por && (
              <div className="text-[10px] text-muted mt-1">{row.verificado_por}</div>
            )}
            {value === 'Rechazada' && (
              <div className="text-[10px] text-danger mt-1 font-semibold">Corregir</div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Comprobante / Orden',
      accessor: 'numero_orden',
      width: '200px',
      render: (value, row) => {
        const tipoRaw = row.tipo_comprobante || '';
        const esFactura = tipoRaw.toLowerCase().includes('factura');
        return (
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <span className={`badge badge-xs ${esFactura ? 'badge-success' : 'badge-info'}`}>
                {tipoRaw || 'Sin Tipo'}
              </span>
              {!esFactura && row.numero_comprobante && (
                <span className="font-mono text-xs text-mist bg-carbon-mid px-1.5 py-0.5 rounded border border-steel">
                  {row.numero_comprobante}
                </span>
              )}
            </div>
            <div className="text-xs text-muted">Ord: <span className="font-mono text-mist font-medium">{value}</span></div>
          </div>
        );
      }
    },
    {
      header: 'Fecha',
      accessor: 'fecha_emision',
      width: '110px',
      render: (value) => <div className="font-medium text-mist">{formatearFechaVisual(value)}</div>
    },
    {
      header: 'Cliente',
      accessor: 'cliente',
      render: (value, row) => (
        <div>
          <div className="font-medium text-mist">{value}</div>
          <div className="text-xs text-wire">RUC: {row.ruc_cliente}</div>
        </div>
      )
    },
    {
      header: 'Vendedor',
      accessor: 'comercial',
      width: '150px',
      render: (value) => <div className="text-xs text-mist">{value || 'Sin asignar'}</div>
    },
    {
      header: 'Total / Pagado',
      accessor: 'total',
      align: 'right',
      width: '170px',
      render: (value, row) => {
        const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(String(row.tipo_impuesto || '').toUpperCase());
        const total = esSinImpuesto ? parseFloat(row.subtotal || 0) : parseFloat(value || 0);
        const pagado = parseFloat(row.monto_pagado || 0);
        const porcentaje = total > 0 ? (pagado / total) * 100 : 0;

        return (
          <div>
            <div className="font-bold text-mist">{formatearMoneda(total, row.moneda)}</div>
            <div className="text-[10px] text-wire">PAGADO: {formatearMoneda(pagado, row.moneda)}</div>
            <div className="w-full bg-carbon-mid rounded-full h-1 mt-1 overflow-hidden">
              <div 
                className={`h-full ${porcentaje >= 99 ? 'bg-success' : porcentaje > 0 ? 'bg-primary' : 'bg-steel'}`}
                style={{ width: `${porcentaje}%` }}
              ></div>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Pago',
      accessor: 'estado_pago',
      width: '100px',
      align: 'center',
      render: (value) => {
        const config = getEstadoPagoConfig(value);
        return <span className={`badge ${config.clase} text-[10px]`}>{value}</span>;
      }
    },
    {
      header: 'Logística',
      accessor: 'estado',
      width: '120px',
      align: 'center',
      render: (value) => {
        const config = getEstadoConfig(value);
        return <span className={`badge ${config.clase} text-[10px]`}>{config.texto}</span>;
      }
    },
    {
      header: 'Acciones',
      accessor: 'id_orden_venta',
      width: '120px',
      align: 'center',
      render: (value, row) => (
        <div className="flex gap-1 justify-center">
          <button className="btn btn-xs btn-primary p-1.5" onClick={(e) => { e.stopPropagation(); handleNavegaDetalle(value); }} title="Ver"><Eye size={14} /></button>
          <button className="btn btn-xs btn-outline p-1.5 border-steel" onClick={(e) => { e.stopPropagation(); navigate(`/ventas/ordenes/${value}/editar`); }} title="Editar" disabled={row.estado_verificacion === 'Pendiente'}><Edit size={14} /></button>
          <button className="btn btn-xs btn-outline p-1.5 border-steel" onClick={(e) => { e.stopPropagation(); handleDescargarPDF(value, row.numero_orden, row.cliente); }} disabled={descargandoPDF === value} title="PDF">
            {descargandoPDF === value ? <RefreshCcw size={14} className="animate-spin" /> : <Download size={14} />}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-4 md:p-6 page-ordenes-venta">
      <style dangerouslySetInnerHTML={{__html: `
        .page-ordenes-venta, .page-ordenes-venta .card { background-color: var(--carbon) !important; color: var(--mist) !important; }
        .page-ordenes-venta .search-input, .page-ordenes-venta .form-input, .page-ordenes-venta input {
          background-color: var(--carbon-mid) !important; border: 1px solid var(--steel) !important; color: var(--white) !important; font-family: inherit !important;
        }
        .page-ordenes-venta button.pagination-btn {
          background-color: var(--carbon-mid) !important; border: 2px solid var(--steel) !important; color: var(--mist) !important;
          width: 48px !important; height: 48px !important; min-width: 48px !important; display: flex !important;
          align-items: center !important; justify-content: center !important; border-radius: 8px !important;
          font-weight: 800 !important; font-size: 1rem !important; cursor: pointer !important; transition: all 0.2s !important;
        }
        .page-ordenes-venta button.pagination-btn-active {
          background-color: var(--primary) !important; border-color: var(--primary) !important; color: #000 !important;
          box-shadow: 0 0 20px rgba(232, 184, 75, 0.4) !important; transform: scale(1.1) !important; z-index: 20 !important;
        }
        .page-ordenes-venta button.pagination-btn:hover:not(.pagination-btn-active) {
          border-color: var(--primary) !important; color: var(--primary) !important; background-color: var(--carbon-light) !important;
        }
        .page-ordenes-venta .table-container { background-color: var(--carbon) !important; border: 1px solid var(--border) !important; border-radius: 6px !important; overflow: hidden !important; }
        .page-ordenes-venta .stat-card { min-height: 85px !important; padding: 1rem !important; border-radius: 8px !important; }
      `}} />

      {loading && <Loading message="Cargando órdenes de venta..." />}
      
      <div className={`transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3 tracking-tight">
              <div className="p-2 bg-primary/10 rounded-lg"><ShoppingCart size={28} className="text-primary" /></div>
              <span className="uppercase font-barlow text-white">Órdenes de Venta</span>
            </h1>
            <p className="text-[0.7rem] text-wire uppercase tracking-[0.2em] mt-1">Gestión de operaciones comerciales</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              className="btn btn-outline border-steel text-mist font-black text-sm tracking-widest h-12 px-6 shadow-xl" 
              onClick={() => navigate('/ventas/ordenes/verificacion')}
            >
              <Shield size={20} /> VERIFICACIÓN
            </button>
            <button 
              className="btn btn-primary font-black text-sm tracking-widest h-12 px-8 shadow-2xl shadow-primary/30 active:scale-95 transition-all" 
              onClick={() => navigate('/ventas/ordenes/nueva')}
            >
              <Plus size={22} /> NUEVA ORDEN
            </button>
          </div>
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        {estadisticas && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <div className="card stat-card bg-carbon-mid border-l-4 border-success/50 shadow-lg !py-3">
              <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">FACTURAS (PEN)</p>
              <p className="text-lg font-black text-white">{formatearMoneda(estadisticas.facturas_pen || 0, 'PEN')}</p>
            </div>
            <div className="card stat-card bg-carbon-mid border-l-4 border-primary/50 shadow-lg !py-3">
              <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">FACTURAS (USD)</p>
              <p className="text-lg font-black text-primary">{formatearMoneda(estadisticas.facturas_usd || 0, 'USD')}</p>
            </div>
            <div className="card stat-card bg-carbon-mid border-l-4 border-info/50 shadow-lg !py-3">
              <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">N. VENTA (PEN)</p>
              <p className="text-lg font-black text-white">{formatearMoneda(estadisticas.notas_venta_pen || 0, 'PEN')}</p>
            </div>
            <div className="card stat-card bg-carbon-mid border-l-4 border-info/50 shadow-lg !py-3">
              <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">N. VENTA (USD)</p>
              <p className="text-xl font-black text-white">{formatearMoneda(estadisticas.notas_venta_usd || 0, 'USD')}</p>
            </div>
            <div className="card stat-card bg-carbon-mid border-l-4 border-warning/50 shadow-lg !py-3">
              <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">SIN COMPR. (PEN)</p>
              <p className="text-lg font-black text-warning">{formatearMoneda(estadisticas.sin_comprobante_pen || 0, 'PEN')}</p>
            </div>
            <div className="card stat-card bg-carbon-mid border-l-4 border-warning/50 shadow-lg !py-3">
              <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">SIN COMPR. (USD)</p>
              <p className="text-lg font-black text-warning">{formatearMoneda(estadisticas.sin_comprobante_usd || 0, 'USD')}</p>
            </div>
          </div>
        )}

        <div className="card mb-4 bg-carbon-mid border border-steel/30 shadow-xl">
          <div className="card-body p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-wire" />
                <input type="text" className="form-input w-full pl-10 h-11" placeholder="Buscar por N°, cliente, RUC..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <input type="date" className="form-input text-xs h-11 w-36" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                <input type="date" className="form-input text-xs h-11 w-36" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                <button onClick={() => setMostrarFiltrosAvanzados(!mostrarFiltrosAvanzados)} className={`btn h-11 px-4 flex items-center gap-2 text-[0.7rem] font-black tracking-widest transition-all ${mostrarFiltrosAvanzados ? 'btn-primary' : 'btn-outline border-steel'}`}>
                  <Filter size={16} /> {mostrarFiltrosAvanzados ? 'CERRAR' : 'MÁS FILTROS'}
                </button>
                <button onClick={limpiarFiltros} className="btn btn-outline border-steel text-danger hover:bg-danger/10 h-11 px-3"><X size={18} /></button>
              </div>
            </div>

            {mostrarFiltrosAvanzados && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-steel/20 animate-in slide-in-from-top-2 duration-300">
                <FilterCheckboxGroup label="Estado Logístico" selectedValues={filtroEstado} onChange={setFiltroEstado} options={[
                  { label: 'En Espera', value: 'En Espera' }, { label: 'En Proceso', value: 'En Proceso' }, { label: 'Atendido por Producción', value: 'Atendido por Producción' }, { label: 'Despacho Parcial', value: 'Despacho Parcial' }, { label: 'Despachada', value: 'Despachada' }, { label: 'Entregada', value: 'Entregada' }, { label: 'Cancelada', value: 'Cancelada' }
                ]} />
                <FilterCheckboxGroup label="Estado Pago" selectedValues={filtroEstadoPago} onChange={setFiltroEstadoPago} options={[
                  { label: 'Sin Pagar', value: 'Pendiente' }, { label: 'Pago Parcial', value: 'Parcial' }, { label: 'Pagado', value: 'Pagado' }
                ]} />
                <FilterCheckboxGroup label="Verificación" selectedValues={filtroVerificacion} onChange={setFiltroVerificacion} options={[
                  { label: 'Aprobadas', value: 'Aprobada' }, { label: 'Pendientes', value: 'Pendiente' }, { label: 'Rechazadas', value: 'Rechazada' }
                ]} />
                <FilterCheckboxGroup label="Documento" selectedValues={filtroTipoComprobante} onChange={setFiltroTipoComprobante} options={[
                  { label: 'Facturas', value: 'Factura' }, { label: 'Notas de Venta', value: 'Nota de Venta' }, { label: 'Sin Comprobante', value: 'Sin Comprobante' }
                ]} />
              </div>
            )}
          </div>
        </div>

        <div className="card shadow-2xl relative" ref={tablaRef}>
          <div className="card-header flex items-center justify-between border-b border-steel/20">
            <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">Lista de Órdenes <span className="text-primary bg-primary/10 px-2 py-0.5 rounded text-xs">{ordenesFiltradas.length}</span></h2>
            <div className="text-[0.6rem] font-bold text-wire uppercase tracking-widest">Mostrando {currentItems.length} registros</div>
          </div>
          
          <div className="card-body p-0 relative">
            {isFiltering && (
              <div className="absolute inset-0 z-30 bg-carbon/80 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300">
                <div className="flex flex-col items-center gap-3 p-8 bg-carbon-light shadow-2xl rounded-xl border border-steel">
                  <RefreshCcw size={32} className="animate-spin text-primary" />
                  <span className="text-[0.6rem] font-black text-wire uppercase tracking-[0.3em]">Procesando</span>
                </div>
              </div>
            )}
            <div className="table-container">
              <Table columns={columns} data={currentItems} emptyMessage="No hay registros con los filtros aplicados" onRowClick={(row) => handleNavegaDetalle(row.id_orden_venta)} />
            </div>
          </div>

          {ordenesFiltradas.length > itemsPerPage && (
            <div className="mt-20 px-6 py-10 bg-carbon-mid border-t border-steel/30 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-[0_-10px_40px_rgba(0,0,0,0.4)] relative z-20">
              <div className="flex items-center gap-3">
                <button className="btn btn-outline border-steel h-12 px-5 flex items-center gap-2 font-black text-[0.7rem] tracking-widest hover:border-primary hover:text-primary transition-all" onClick={goToPrevPage} disabled={currentPage === 1}><ChevronLeft size={20} /> ANTERIOR</button>
                <div className="flex items-center gap-2 mx-2">
                  {getPageNumbers().map((num, idx) => (
                    num === '...' ? <span key={`ell-${idx}`} className="w-10 h-10 flex items-center justify-center text-steel font-black">...</span> :
                    <button key={`pg-${num}`} onClick={() => setCurrentPage(num)} className={`pagination-btn ${currentPage === num ? 'pagination-btn-active' : ''}`}>{num}</button>
                  ))}
                </div>
                <button className="btn btn-outline border-steel h-12 px-5 flex items-center gap-2 font-black text-[0.7rem] tracking-widest hover:border-primary hover:text-primary transition-all" onClick={goToNextPage} disabled={currentPage === totalPages}>SIGUIENTE <ChevronRight size={20} /></button>
              </div>
              <div className="flex items-center gap-4 px-6 py-2.5 bg-carbon border border-steel rounded-lg shadow-inner">
                <span className="text-[0.6rem] font-black text-wire uppercase tracking-[0.2em]">Página</span>
                <input type="number" min="1" max={totalPages} value={inputPage} onChange={(e) => setInputPage(e.target.value)} onKeyDown={handlePageJump} onBlur={() => { const p = parseInt(inputPage); if (p >= 1 && p <= totalPages) setCurrentPage(p); else setInputPage(currentPage.toString()); }} className="w-16 h-10 text-center text-base font-black text-primary bg-carbon-mid border-2 border-steel rounded focus:border-primary outline-none transition-all" />
                <span className="text-[0.6rem] font-black text-wire uppercase tracking-[0.2em]">de {totalPages}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrdenesVenta;