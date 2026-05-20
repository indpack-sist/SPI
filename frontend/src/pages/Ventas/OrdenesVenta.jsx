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
    e.stopPropagation(); // Evitar que el dropdown se cierre o haga cosas raras
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
      <label className="text-[10px] font-bold text-gray-500 uppercase mb-1.5 block tracking-wider">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between w-full h-10 px-3 text-sm transition-all border rounded-lg focus:outline-none ${
            selectedValues.length > 0 
              ? 'border-primary bg-blue-50/20 text-primary font-bold shadow-sm' 
              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 shadow-sm'
          }`}
        >
          <span className="truncate mr-2">{getLabelText()}</span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${selectedValues.length > 0 ? 'text-primary' : 'text-gray-400'}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[200px]">
            <div className="max-h-64 overflow-y-auto p-2 space-y-1">
              {options.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={(e) => handleToggle(e, opt.value)}
                    className={`flex items-center px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                      isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Manejado por el div superior
                        className="w-5 h-5 rounded border-2 border-gray-300 text-primary focus:ring-primary cursor-pointer transition-all checked:bg-primary checked:border-primary"
                        style={{ appearance: 'checkbox', WebkitAppearance: 'checkbox' }}
                      />
                    </div>
                    <span className={`ml-3 text-sm select-none ${isSelected ? 'font-bold' : 'font-medium'}`}>
                      {opt.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {selectedValues.length > 0 && (
              <div className="p-2 bg-gray-50 border-t border-gray-100">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChange([]); }}
                  className="w-full py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={14} />
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
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false); // Nuevo estado para carga parcial
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
    cargarDatos(false); // false indica que no es la carga inicial
    cargarTCDesdeSession();
  }, [filtroEstado, filtroVerificacion, filtroEstadoPago, filtroTipoComprobante, fechaInicio, fechaFin]);

  // Carga inicial
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
      
      const [ordenesRes, statsRes] = await Promise.all([
        ordenesVentaAPI.getAll(filtros),
        ordenesVentaAPI.getEstadisticas()
      ]);
      
      if (ordenesRes.data.success) {
        setOrdenes(ordenesRes.data.data || []);
      }
      
      if (statsRes.data.success) {
        setEstadisticas(statsRes.data.data || null);
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

  const montoTotalUSD = ordenes.reduce((sum, o) => {
    if (o.moneda === 'USD') {
      const esSinImpuesto = ['INAFECTO', 'EXONERADO'].includes(String(o.tipo_impuesto || '').toUpperCase().trim());
      return sum + (esSinImpuesto ? parseFloat(o.subtotal || 0) : parseFloat(o.total || 0));
    }
    return sum;
  }, 0);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = ordenesFiltradas.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(ordenesFiltradas.length / itemsPerPage);

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
      console.error("Error original:", err);
      if (err.response && err.response.data instanceof Blob) {
        try {
          const errorText = await err.response.data.text();
          const errorJson = JSON.parse(errorText);
          setError(errorJson.error || 'Error al generar el PDF');
        } catch (e) {
          setError('Ocurrió un error inesperado al descargar el archivo.');
        }
      } else {
        setError(err.message || 'Error de conexión al descargar el PDF');
      }
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
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 3
    }).format(valor);
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
        const textoMostrar = tipoRaw || 'Sin Tipo';
        return (
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <span className={`badge badge-xs ${esFactura ? 'badge-success' : 'badge-info'}`}>
                {textoMostrar}
              </span>
              {!esFactura && row.numero_comprobante && (
                <span className="font-mono text-xs text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                  {row.numero_comprobante}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="text-xs text-muted">
                Ord: <span className="font-mono text-gray-700 font-medium">{value}</span>
              </div>
              {row.numero_cotizacion && (
                <div className="text-[10px] text-muted">
                  Ref: <span className="font-mono">{row.numero_cotizacion}</span>
                </div>
              )}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Fecha',
      accessor: 'fecha_emision',
      width: '110px',
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-800">{formatearFechaVisual(value)}</div>
          {row.fecha_entrega_estimada && (
            <div className="text-[10px] text-muted mt-1 uppercase font-semibold">
              Entrega: {formatearFechaVisual(row.fecha_entrega_estimada)}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Cliente',
      accessor: 'cliente',
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted">RUC: {row.ruc_cliente}</div>
        </div>
      )
    },
    {
      header: 'Vendedores',
      accessor: 'comercial',
      width: '180px',
      render: (value, row) => (
        <div className="text-xs">
          {row.comercial && (
            <div className="flex items-center gap-1 mb-1">
              <UserCheck size={12} className="text-primary" />
              <span className="font-medium">Asignado:</span>
              <span className="text-muted">{row.comercial}</span>
            </div>
          )}
          {row.registrado_por && (
            <div className="flex items-center gap-1">
              <User size={12} className="text-muted" />
              <span className="font-medium">Registró:</span>
              <span className="text-muted">{row.registrado_por}</span>
            </div>
          )}
          {!row.comercial && !row.registrado_por && (
            <span className="text-muted">Sin asignar</span>
          )}
        </div>
      )
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
        const esUSD = row.moneda === 'USD';
        const tcOrden = parseFloat(row.tipo_cambio || 1);
        const conversionPEN = esUSD && mostrarConversion && tcOrden > 1 ? total * tcOrden : null;

        return (
          <div>
            <div className="font-bold text-gray-800">{formatearMoneda(total, row.moneda)}</div>
            <div className="text-xs text-muted">Pagado: {formatearMoneda(pagado, row.moneda)}</div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div 
                className={`h-1.5 rounded-full ${porcentaje >= 99.9 ? 'bg-success' : porcentaje > 0 ? 'bg-info' : 'bg-warning'}`}
                style={{ width: `${porcentaje}%` }}
              ></div>
            </div>
            {conversionPEN !== null && (
              <div className="mt-1 px-2 py-0.5 rounded text-xs font-bold inline-block"
                style={{ 
                  background: 'rgba(59, 130, 246, 0.1)', 
                  color: '#1e40af',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                <ArrowRightLeft size={10} className="inline mr-1" />
                S/ {formatearNumero(conversionPEN, 3)}
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Estado Pago',
      accessor: 'estado_pago',
      width: '120px',
      align: 'center',
      render: (value) => {
        const config = getEstadoPagoConfig(value);
        const Icono = config.icono;
        return (
          <span className={`badge ${config.clase}`}>
            <Icono size={14} />
            {value}
          </span>
        );
      }
    },
    {
      header: 'SUNAT',
      accessor: 'facturado_sunat',
      width: '90px',
      align: 'center',
      render: (value, row) => {
        if (value === 1) {
          return (
            <div className="flex flex-col items-center gap-0.5">
              <span className="flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                <BadgeCheck size={15} className="text-emerald-600" />
                Enviado
              </span>
              {row.numero_comprobante_sunat && (
                <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {row.numero_comprobante_sunat}
                </span>
              )}
            </div>
          );
        }
        return (
          <span className="flex items-center justify-center gap-1 text-amber-500 text-xs font-medium">
            <Clock size={13} />
            Pendiente
          </span>
        );
      }
    },
    {
      header: 'Prioridad',
      accessor: 'prioridad',
      width: '100px',
      align: 'center',
      render: (value) => {
        const config = getPrioridadConfig(value);
        return <span className={`badge ${config.clase}`}>{value}</span>;
      }
    },
    {
      header: 'Estado',
      accessor: 'estado',
      width: '130px',
      align: 'center',
      render: (value) => {
        const config = getEstadoConfig(value);
        const Icono = config.icono;
        return (
          <span className={`badge ${config.clase}`}>
            <Icono size={14} />
            {config.texto}
          </span>
        );
      }
    },
    {
      header: 'Acciones',
      accessor: 'id_orden_venta',
      width: '140px',
      align: 'center',
      render: (value, row) => (
        <div className="flex gap-1 justify-center">
          <button
            className="btn btn-sm btn-primary"
            onClick={(e) => { e.stopPropagation(); handleNavegaDetalle(value); }}
            title="Ver detalle"
          >
            <Eye size={14} />
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={(e) => { e.stopPropagation(); navigate(`/ventas/ordenes/${value}/editar`); }}
            title="Editar orden"
            disabled={row.estado_verificacion === 'Pendiente'}
          >
            <Edit size={14} />
          </button>
          <button
            className="btn btn-sm btn-outline"
            onClick={(e) => { e.stopPropagation(); handleDescargarPDF(value, row.numero_orden, row.cliente); }}
            disabled={descargandoPDF === value}
            title="Descargar PDF"
          >
            {descargandoPDF === value ? (
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-primary border-t-transparent"></div>
            ) : (
              <Download size={14} />
            )}
          </button>
        </div>
      )
    }
  ];

  // if (loading) return <Loading message="Cargando órdenes de venta..." />; // <--- ELIMINADO PARA EVITAR F5

  return (
    <div className="p-4 md:p-6">
      {loading && <Loading message="Cargando órdenes de venta..." />}
      
      <div className={`transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          {/* ... resto del header ... */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart size={32} className="text-primary" />
            Órdenes de Venta
          </h1>
          <p className="text-muted">Gestión de órdenes de venta y despachos</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            className="btn btn-outline"
            onClick={() => navigate('/ventas/ordenes/verificacion')}
          >
            <Shield size={20} />
            Verificar Órdenes
          </button>
          <button 
            className="btn btn-primary flex-1 md:flex-none justify-center"
            onClick={() => navigate('/ventas/ordenes/nueva')}
          >
            <Plus size={20} />
            Nueva Orden
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="card mb-4 shadow-sm" style={{ 
        borderLeft: tipoCambio ? '4px solid var(--accent, #ca8a04)' : '4px solid var(--border-color, #374151)'
      }}>
        <div className="card-body p-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ 
                background: tipoCambio ? 'var(--accent-dim, rgba(234,179,8,0.1))' : 'var(--bg-tertiary, #1f2937)'
              }}>
                <DollarSign size={20} style={{ color: tipoCambio ? 'var(--accent, #ca8a04)' : 'var(--text-muted)' }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Tipo de Cambio SBS (USD → PEN)
                </p>
                {tipoCambio ? (
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Compra: <strong className="text-base" style={{ color: 'var(--text-primary)' }}>S/ {tipoCambio.compra.toFixed(3)}</strong>
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Venta: <strong className="text-base" style={{ color: 'var(--accent, #ca8a04)' }}>S/ {tipoCambio.venta.toFixed(3)}</strong>
                      </span>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Calendar size={12} />
                      <span>SBS: {formatearFechaVisual(tipoCambio.fecha)}</span>
                      <span className="mx-1">·</span>
                      <Clock size={12} />
                      <span>{obtenerEdadTC()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    <AlertTriangle size={14} />
                    <span>No disponible — Presione "Actualizar TC" para consultar</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tipoCambio && (
                <button
                  className={`btn btn-sm ${mostrarConversion ? 'btn-warning' : 'btn-outline'}`}
                  onClick={() => setMostrarConversion(!mostrarConversion)}
                  title={mostrarConversion ? 'Ocultar conversiones USD → PEN' : 'Mostrar conversiones USD → PEN'}
                >
                  <ArrowRightLeft size={14} />
                  {mostrarConversion ? 'Ocultar PEN' : 'Ver en PEN'}
                </button>
              )}
              <button
                className="btn btn-sm btn-outline"
                onClick={actualizarTipoCambio}
                disabled={loadingTC}
                title="Consulta el TC actual desde la SBS (consume 1 token)"
              >
                {loadingTC ? (
                  <RefreshCcw size={14} className="animate-spin" />
                ) : (
                  <RefreshCcw size={14} />
                )}
                {loadingTC ? 'Consultando...' : 'Actualizar TC'}
              </button>
            </div>
          </div>
          {tipoCambio && (
            <div className="flex md:hidden items-center gap-2 text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              <Calendar size={12} />
              <span>SBS: {formatearFechaVisual(tipoCambio.fecha)}</span>
              <span className="mx-1">·</span>
              <Clock size={12} />
              <span>{obtenerEdadTC()}</span>
            </div>
          )}
        </div>
      </div>

      {estadisticas && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* FACTURAS PEN */}
          <div className="card bg-green-50 border-l-4 border-green-500">
            <div className="card-body p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-green-800 uppercase tracking-wider mb-1">
                  Facturas Emitidas (PEN)
                </p>
                <p className="text-2xl font-bold text-green-900">
                  {formatearMoneda(estadisticas.facturas_pen || 0, 'PEN')}
                </p>
              </div>
              <div className="bg-green-100 p-2 rounded-lg text-green-600">
                <TrendingUp size={24} />
              </div>
            </div>
          </div>

          {/* FACTURAS USD */}
          <div className="card border-l-4" style={{ backgroundColor: 'var(--accent-dim, rgba(234,179,8,0.05))', borderColor: 'var(--accent, #ca8a04)' }}>
            <div className="card-body p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--accent, #ca8a04)' }}>
                  Facturas Emitidas (USD)
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent, #ca8a04)' }}>
                  {formatearMoneda(estadisticas.facturas_usd || 0, 'USD')}
                </p>
              </div>
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--accent-dim, rgba(234,179,8,0.1))', color: 'var(--accent, #ca8a04)' }}>
                <DollarSign size={24} />
              </div>
            </div>
          </div>

          {/* NOTAS VENTA PEN */}
          <div className="card bg-blue-50 border-l-4 border-blue-500">
            <div className="card-body p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">
                  Notas de Venta (PEN)
                </p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatearMoneda(estadisticas.notas_venta_pen || 0, 'PEN')}
                </p>
              </div>
              <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                <FileText size={24} />
              </div>
            </div>
          </div>

          {/* NOTAS VENTA USD */}
          <div className="card border-l-4" style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', borderColor: '#3b82f6' }}>
            <div className="card-body p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#3b82f6' }}>
                  Notas de Venta (USD)
                </p>
                <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                  {formatearMoneda(estadisticas.notas_venta_usd || 0, 'USD')}
                </p>
              </div>
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                <DollarSign size={24} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-4 shadow-sm">
        <div className="card-body">
          {/* NIVEL 1: Búsqueda rápida y Fechas */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="search-input-wrapper flex-1">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                className="form-input search-input"
                placeholder="Buscar por N°, cliente, RUC..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className="flex gap-4 items-center">
              <div className="form-group mb-0 w-36">
                <input 
                  type="date" 
                  className="form-input text-sm h-10" 
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  placeholder="Desde"
                  title="Fecha Emisión (Desde)"
                />
              </div>
              <div className="form-group mb-0 w-36">
                <input 
                  type="date" 
                  className="form-input text-sm h-10" 
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  placeholder="Hasta"
                  title="Fecha Emisión (Hasta)"
                />
              </div>
              <button 
                onClick={limpiarFiltros}
                className="btn btn-outline text-red-500 border-red-200 hover:bg-red-50 hover:text-red-700 h-10 flex items-center gap-1 px-3"
                title="Limpiar todos los filtros"
              >
                <X size={16} />
                <span className="hidden sm:inline text-sm font-medium">Limpiar</span>
              </button>
            </div>
          </div>

          {/* NIVEL 2: Filtros Avanzados (Multi-select) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <FilterCheckboxGroup
              label="Estado Logístico"
              selectedValues={filtroEstado}
              onChange={setFiltroEstado}
              options={[
                { label: 'En Espera', value: 'En Espera' },
                { label: 'En Proceso', value: 'En Proceso' },
                { label: 'Atendido por Producción', value: 'Atendido por Producción' },
                { label: 'Despacho Parcial', value: 'Despacho Parcial' },
                { label: 'Despachada', value: 'Despachada' },
                { label: 'Entregada', value: 'Entregada' },
                { label: 'Cancelada', value: 'Cancelada' }
              ]}
            />

            <FilterCheckboxGroup
              label="Estado Pago"
              selectedValues={filtroEstadoPago}
              onChange={setFiltroEstadoPago}
              options={[
                { label: 'Sin Pagar', value: 'Pendiente' },
                { label: 'Pago Parcial', value: 'Parcial' },
                { label: 'Pagado', value: 'Pagado' }
              ]}
            />

            <FilterCheckboxGroup
              label="Verificación"
              selectedValues={filtroVerificacion}
              onChange={setFiltroVerificacion}
              options={[
                { label: 'Aprobadas', value: 'Aprobada' },
                { label: 'Pendientes', value: 'Pendiente' },
                { label: 'Rechazadas', value: 'Rechazada' }
              ]}
            />

            <FilterCheckboxGroup
              label="Documento"
              selectedValues={filtroTipoComprobante}
              onChange={setFiltroTipoComprobante}
              options={[
                { label: 'Facturas', value: 'Factura' },
                { label: 'Notas de Venta', value: 'Nota de Venta' },
                { label: 'Sin Comprobante', value: 'Sin Comprobante' }
              ]}
            />
          </div>
        </div>
      </div>

      <div className="card shadow-sm" ref={tablaRef}>
        <div className="card-header">
          <div className="flex items-center gap-2">
            <h2 className="card-title">
              Lista de Órdenes de Venta
              <span className="badge badge-primary ml-2">{ordenesFiltradas.length}</span>
            </h2>
          </div>
          <div className="text-sm text-muted">
            Mostrando {currentItems.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, ordenesFiltradas.length)} de {ordenesFiltradas.length}
          </div>
        </div>
        
        <div className="card-body p-0 relative">
          {/* Overlay de carga para filtros */}
          {isFiltering && (
            <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex items-center justify-center transition-all duration-300">
              <div className="flex flex-col items-center gap-3 p-5 bg-white shadow-xl rounded-2xl border border-gray-100">
                <RefreshCcw size={24} className="animate-spin text-primary" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Actualizando lista...</span>
              </div>
            </div>
          )}
          
          <div className="table-container">
            <Table
              columns={columns}
              data={currentItems}
              emptyMessage="No hay órdenes de venta registradas"
              onRowClick={(row) => handleNavegaDetalle(row.id_orden_venta)}
            />
          </div>
        </div>

        {ordenesFiltradas.length > itemsPerPage && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <button 
                className="h-9 px-3 flex items-center gap-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-primary hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-600 disabled:hover:border-gray-300 transition-all duration-200 shadow-sm"
                onClick={goToPrevPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
                <span>Anterior</span>
              </button>
              
              <div className="flex items-center gap-1 mx-2">
                {getPageNumbers().map((num, idx) => (
                  num === '...' ? (
                    <span key={`ellipsis-${idx}`} className="w-9 h-9 flex items-center justify-center text-gray-400 font-bold">...</span>
                  ) : (
                    <button
                      key={`page-${num}`}
                      onClick={() => setCurrentPage(num)}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all duration-200 ${
                        currentPage === num 
                          ? 'bg-primary text-white shadow-md shadow-primary/20 scale-105' 
                          : 'bg-white border border-gray-300 text-gray-600 hover:border-primary/50 hover:text-primary hover:bg-blue-50/30'
                      }`}
                    >
                      {num}
                    </button>
                  )
                ))}
              </div>

              <button 
                className="h-9 px-3 flex items-center gap-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-primary hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-600 disabled:hover:border-gray-300 transition-all duration-200 shadow-sm"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
              >
                <span>Siguiente</span>
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex items-center gap-3 px-4 py-1.5 bg-white border border-gray-200 rounded-xl shadow-sm">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ir a la página</span>
              <div className="relative flex items-center">
                <input 
                  type="number" 
                  min="1" 
                  max={totalPages}
                  value={inputPage}
                  onChange={(e) => setInputPage(e.target.value)}
                  onKeyDown={handlePageJump}
                  onBlur={() => {
                    const page = parseInt(inputPage);
                    if (!isNaN(page) && page >= 1 && page <= totalPages) {
                      setCurrentPage(page);
                    } else {
                      setInputPage(currentPage.toString());
                    }
                  }}
                  className="w-14 h-8 pl-2 pr-1 text-center text-sm font-bold text-primary bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                  style={{ MozAppearance: 'textfield' }}
                />
                <style dangerouslySetInnerHTML={{__html: `
                  input::-webkit-outer-spin-button,
                  input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                  }
                `}} />
              </div>
              <span className="text-xs font-bold text-gray-400">de {totalPages}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrdenesVenta;