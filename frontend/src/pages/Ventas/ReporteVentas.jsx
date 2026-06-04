import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import XLSX from 'xlsx-js-style';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';
import { 
  Calendar, Search, Filter, Download, FileSpreadsheet,
  DollarSign, TrendingUp, PieChart as PieIcon, 
  FileText, CheckCircle, AlertCircle, Truck, User, X,
  Eye, Package, MapPin, Phone, Mail, CreditCard, FileCheck,
  ShoppingCart, Percent, Building2, RefreshCw, ArrowRightLeft,
  RefreshCcw, AlertTriangle, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { reportesAPI, clientesAPI, tipoCambioAPI, empleadosAPI } from '../../config/api';
import Loading from '../../components/UI/Loading';
import Alert from '../../components/UI/Alert';
import ModalValidacionSunat from '../../components/Ventas/ModalValidacionSunat';
import { generarReporteVentasPDF } from './reporteVentasPDF'; 

const COLORS_PIE = {
  'Pagado': '#10B981',
  'Parcial': '#F59E0B',
  'Pendiente': '#EF4444',
  'Pagado USD': '#059669',
  'Parcial USD': '#D97706',
  'Pendiente USD': '#DC2626'
};

const TC_SESSION_KEY = 'indpack_tipo_cambio';

const FilterCheckboxGroup = ({ label, options, selectedValues, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (e, value) => {
    e.preventDefault();
    e.stopPropagation();
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  return (
    <div className="form-group mb-0 flex flex-col justify-end" ref={containerRef} style={{ zIndex: isOpen ? 100 : 10 }}>
      <label className="form-label uppercase text-[10px] text-muted font-bold tracking-wider mb-1 block">{label}</label>
      <div className="relative w-full">
        <div 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }}
          className="form-input flex justify-between items-center transition-all bg-carbon-mid"
style={{ cursor: 'pointer', borderColor: selectedValues.length > 0 ? 'var(--accent)' : 'var(--steel)', color: '#fff', height: '38px', width: '100%', backgroundColor: 'var(--carbon-mid)' }}
        >
          <span className="text-xs font-bold truncate pr-2" style={{ color: '#fff' }}>
            {selectedValues.length === 0 ? 'Todos' : 
             selectedValues.length === 1 ? selectedValues[0] : 
             `${selectedValues.length} seleccionados`}
          </span>
          <Filter size={14} className={selectedValues.length > 0 ? 'text-primary' : 'text-gray-300'} />
        </div>

        {isOpen && (
          <div className="absolute left-0 right-0 w-full border border-steel/30 rounded-lg shadow-2xl py-2 animate-in fade-in zoom-in duration-200" 
               style={{ top: '100%', marginTop: '4px', backgroundColor: '#111', zIndex: 1000 }}>
            <div className="max-h-60 overflow-y-auto custom-scrollbar px-1">
              {options.map((opt) => (
                <div 
                  key={opt.value} 
                  className="flex items-center px-3 py-2 hover:bg-white/5 rounded-md transition-colors"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => handleToggle(e, opt.value)}
                >
                  <div className="relative flex items-center pointer-events-none">
                    <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                      selectedValues.includes(opt.value) 
                      ? 'bg-primary border-primary' 
                      : 'bg-transparent border-steel group-hover:border-wire'
                    }`}>
                      {selectedValues.includes(opt.value) && <CheckCircle size={10} className="text-carbon font-bold" />}
                    </div>
                  </div>
                  <span className={`ml-3 text-xs font-medium transition-colors pointer-events-none ${
                    selectedValues.includes(opt.value) ? 'text-primary' : 'text-mist'
                  }`}>
                    {opt.label}
                  </span>
                </div>
              ))}
            </div>
            {selectedValues.length > 0 && (
              <div className="border-t border-steel/20 mt-2 pt-2 px-3">
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange([]); }}
                  className="text-[10px] uppercase font-black text-danger hover:text-danger/80 tracking-widest flex items-center gap-1 w-full"
                  style={{ cursor: 'pointer' }}
                >
                  <X size={10} /> Limpiar Selección
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ModalTC = ({ mostrarModalTC, tcVenta, setMostrarModalTC, aplicarModoUnificacion }) => {
  if (!mostrarModalTC) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setMostrarModalTC(false); }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '420px',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          backgroundColor: 'var(--bg-card, #1a1f2e)',
          border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        }}
      >
        <div
          style={{
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary, #12161f)',
          }}
        >
          <h3
            style={{
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '15px',
              margin: 0,
              color: 'var(--text-primary, #f1f5f9)',
            }}
          >
            <ArrowRightLeft size={18} style={{ color: 'var(--primary)' }} />
            Opciones de Unificación
          </h3>
          <button
            onClick={() => setMostrarModalTC(false)}
            style={{
              padding: '4px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-muted, #94a3b8)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary, #cbd5e1)', margin: '0 0 10px 0' }}>
            ¿Cómo deseas calcular el equivalente en Soles (PEN) para las órdenes en Dólares?
          </p>

          <div
            onClick={() => aplicarModoUnificacion('sunat')}
            style={{
              padding: '14px',
              borderRadius: '10px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              backgroundColor: 'var(--bg-secondary, #12161f)',
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'var(--primary-dim, rgba(99,102,241,0.08))'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color, rgba(255,255,255,0.1))'; e.currentTarget.style.backgroundColor = 'var(--bg-secondary, #12161f)'; }}
          >
            <DollarSign size={18} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--text-muted, #94a3b8)' }} />
            <div>
              <h4 style={{ fontWeight: 600, fontSize: '13px', margin: '0 0 4px 0', color: 'var(--text-primary, #f1f5f9)' }}>
                Forzar TC SUNAT Global
              </h4>
              <p style={{ fontSize: '11px', margin: 0, color: 'var(--text-muted, #94a3b8)' }}>
                Multiplica todas las órdenes USD por S/ {tcVenta?.toFixed(3)}
              </p>
            </div>
          </div>

          <div
            onClick={() => aplicarModoUnificacion('mixto')}
            style={{
              padding: '14px',
              borderRadius: '10px',
              border: '2px solid var(--primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              backgroundColor: 'var(--primary-dim, rgba(99,102,241,0.1))',
              position: 'relative',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                backgroundColor: 'var(--primary)',
                color: '#fff',
                fontSize: '9px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '0 8px 0 8px',
                letterSpacing: '0.05em',
              }}
            >
              RECOMENDADO
            </div>
            <TrendingUp size={18} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--primary)' }} />
            <div>
              <h4 style={{ fontWeight: 700, fontSize: '13px', margin: '0 0 4px 0', color: 'var(--primary)' }}>
                Híbrido / Inteligente
              </h4>
              <p style={{ fontSize: '11px', margin: 0, color: 'var(--text-secondary, #cbd5e1)' }}>
                Respeta TC real ({'>'} 3). Usa SUNAT para el resto.
              </p>
            </div>
          </div>

          <div
            onClick={() => aplicarModoUnificacion('historico')}
            style={{
              padding: '14px',
              borderRadius: '10px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              backgroundColor: 'var(--bg-secondary, #12161f)',
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'var(--primary-dim, rgba(99,102,241,0.08))'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color, rgba(255,255,255,0.1))'; e.currentTarget.style.backgroundColor = 'var(--bg-secondary, #12161f)'; }}
          >
            <Clock size={18} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--text-muted, #94a3b8)' }} />
            <div>
              <h4 style={{ fontWeight: 600, fontSize: '13px', margin: '0 0 4px 0', color: 'var(--text-primary, #f1f5f9)' }}>
                Estricto Histórico
              </h4>
              <p style={{ fontSize: '11px', margin: 0, color: 'var(--text-muted, #94a3b8)' }}>
                Usa solo el TC guardado en la base de datos.
              </p>
            </div>
          </div>
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
    // El modal espera campos específicos que ahora el backend ya provee:
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
          'Vendedor': item.vendedor,
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
      
      // Solo crear resumen unificado si hay datos en ambas monedas en el resultado
      // o si la orden fue explícita y se involucran ambas (por si acaso).
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

          datosAOA.push([cat.titulo]);
          datosAOA.push([
            'Codigo', 'Producto', 'Unidad', 'Moneda',
            'Orden', 'Comprobante (Guía)', 'Fecha Emisión', 'Fecha Despacho', 'Cliente', 'Cant. Orden', 'P. Unitario', 'Subtotal Orden',
            'Cant. Total', 'Cant. Despachada', 'Cant. Pendiente', 'Subtotal General', 'N Ordenes'
          ]);

          productosEnCategoria.forEach(prod => {
            const startRowIndex = datosAOA.length;
            const nOrdenes = prod.ordenes.length;

            prod.ordenes.forEach((o, idx) => {
              const guia = o.guia_interna ? `(Guía: ${o.guia_interna})` : '';
              const compText = o.numero_comprobante ? `${o.numero_comprobante} ${guia}` : (o.guia_interna ? `Guía: ${o.guia_interna}` : '-');
              const fEmision = o.fecha_emision ? formatearFecha(o.fecha_emision) : '-';
              const fDespacho = o.fecha_despacho ? formatearFecha(o.fecha_despacho) : 'Pendiente';

              if (idx === 0) {
                datosAOA.push([
                  prod.codigo, prod.nombre, prod.unidad_medida, prod.moneda,
                  o.numero, compText.trim(), fEmision, fDespacho, o.cliente, parseFloat(o.cantidad.toFixed(3)), parseFloat(o.precio_unitario.toFixed(3)), parseFloat(o.subtotal.toFixed(3)),
                  parseFloat(prod.cantidad_total.toFixed(3)), parseFloat(prod.cantidad_despachada_total.toFixed(3)),
                  parseFloat(prod.cantidad_pendiente_total.toFixed(3)), parseFloat(prod.subtotal.toFixed(3)), nOrdenes
                ]);
              } else {
                datosAOA.push([
                  '', '', '', '',
                  o.numero, compText.trim(), fEmision, fDespacho, o.cliente, parseFloat(o.cantidad.toFixed(3)), parseFloat(o.precio_unitario.toFixed(3)), parseFloat(o.subtotal.toFixed(3)),
                  '', '', '', '', ''
                ]);
              }
            });

            if (nOrdenes > 1) {
              const endRowIndex = startRowIndex + nOrdenes - 1;
              [0, 1, 2, 3, 12, 13, 14, 15, 16].forEach(c => {
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
          { wch: 16 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 35 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
          { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 10 }
        ];

        const borderStyle = {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        };

        for (let R = 0; R < datosAOA.length; R++) {
          if (datosAOA[R].length === 1 && datosAOA[R][0] && datosAOA[R][0].toString().startsWith('===')) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: 0 });
            if (wsProductos[cellRef]) {
              if (!wsProductos[cellRef].s) wsProductos[cellRef].s = {};
              wsProductos[cellRef].s.font = { bold: true, color: { rgb: "FFFFFF" } };
              wsProductos[cellRef].s.fill = { fgColor: { rgb: "333333" } };
            }
          } else if (datosAOA[R].length > 1 && datosAOA[R][0] === 'Codigo') {
            for (let C = 0; C < 17; C++) {
              const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
              if (wsProductos[cellRef]) {
                if (!wsProductos[cellRef].s) wsProductos[cellRef].s = {};
                wsProductos[cellRef].s.font = { bold: true };
                wsProductos[cellRef].s.fill = { fgColor: { rgb: "E0E0E0" } };
                wsProductos[cellRef].s.alignment = { horizontal: "center", vertical: "center" };
                wsProductos[cellRef].s.border = borderStyle;
              }
            }
          } else if (datosAOA[R].length > 1 && datosAOA[R][0] !== 'Codigo') {
            for (let C = 0; C < 17; C++) {
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

  const verDetalleOrden = (orden) => { setOrdenSeleccionada(orden); setMostrarDetalleOrden(true); };

  const obtenerBadgeEstadoPago = (estado) => {
    const estilos = { 'Pagado': 'badge badge-success', 'Parcial': 'badge badge-warning', 'Pendiente': 'badge badge-danger' };
    return <span className={estilos[estado] || 'badge badge-secondary'}>{estado}</span>;
  };

  const obtenerBadgeEstado = (estado) => {
    const estilos = {
      'En Espera': 'badge badge-secondary', 'En Proceso': 'badge badge-info',
      'Atendido por Produccion': 'badge badge-purple-100 text-purple-900 border-purple-200',
      'Despacho Parcial': 'badge badge-warning', 'Despachada': 'badge badge-success',
      'Entregada': 'badge badge-success', 'Cancelada': 'badge badge-danger'
    };
    const claseExtra = estado === 'Atendido por Produccion' ? 'bg-purple-100 text-purple-900 border border-purple-200' : (estilos[estado] || 'badge badge-secondary');
    return <span className={claseExtra.startsWith('badge') ? claseExtra : `badge ${claseExtra}`}>{estado}</span>;
  };

  const obtenerBadgeVerificacion = (estado) => {
    const estilos = { 'Pendiente': 'badge badge-warning', 'Aprobada': 'badge badge-success', 'Rechazada': 'badge badge-danger' };
    return <span className={estilos[estado] || 'badge badge-secondary'}>{estado}</span>;
  };

  const obtenerBadgeLogistica = (estado) => {
    const estilos = { 'A tiempo': 'badge badge-info', 'En plazo': 'badge badge-info badge-outline', 'Retrasado': 'badge badge-danger', 'Vencido': 'badge badge-danger badge-outline' };
    return <span className={estilos[estado] || 'badge badge-secondary'}>{estado}</span>;
  };

  const obtenerIconoTipoEntrega = (tipo) => {
    if (tipo === 'Vehiculo Empresa') return <Truck size={16} className="text-blue-600" />;
    if (tipo === 'Transporte Privado') return <Package size={16} className="text-orange-600" />;
    return <ShoppingCart size={16} className="text-green-600" />;
  };

  const renderDesgloseUnificacion = () => {
    const ordenesUSD = dataFiltrada.filter(item => item.moneda === 'USD');
    if (ordenesUSD.length === 0) return null;

    let grupoSunat = [];
    let grupoHistorico = [];

    ordenesUSD.forEach(orden => {
      const tcOrden = parseFloat(orden.tipo_cambio || 1);
      const totalOrden = parseFloat(orden.total || 0);
      const montoOriginalPEN = totalOrden * tcOrden;

      if (modoUnificacion === 'sunat') {
        grupoSunat.push({ ...orden, tcUsado: tcVenta, valorPen: totalOrden * tcVenta, tcOriginal: tcOrden, montoOriginalPEN, tipo: 'Global SUNAT' });
      } else if (modoUnificacion === 'historico') {
        const tcHist = orden.tc_historico ? parseFloat(orden.tc_historico) : tcVenta;
        grupoHistorico.push({ ...orden, tcUsado: tcHist, valorPen: totalOrden * tcHist, tcOriginal: tcOrden, montoOriginalPEN, tipo: orden.tc_historico ? 'Estricto Histórico' : 'SUNAT Rescate' });
      } else if (modoUnificacion === 'mixto') {
        if (tcOrden > 3) {
          grupoHistorico.push({ ...orden, tcUsado: tcOrden, valorPen: totalOrden * tcOrden, tcOriginal: tcOrden, montoOriginalPEN, tipo: 'Histórico Válido' });
        } else {
          grupoSunat.push({ ...orden, tcUsado: tcVenta, valorPen: totalOrden * tcVenta, tcOriginal: tcOrden, montoOriginalPEN, tipo: 'SUNAT Rescate' });
        }
      }
    });

    const FilaOrden = ({ o, esGrupoSunat }) => {
      const tcCambio = o.tcUsado !== o.tcOriginal;
      const diferencia = o.valorPen - o.montoOriginalPEN;

      return (
        <div style={{
          borderRadius: '2px',
          border: esGrupoSunat
            ? '1px solid rgba(232,184,75,0.2)'
            : '1px solid var(--steel)',
          backgroundColor: esGrupoSunat
            ? 'rgba(232,184,75,0.05)'
            : 'var(--carbon-mid)',
          padding: '10px 12px',
          marginBottom: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              fontWeight: 700,
              color: esGrupoSunat ? 'var(--accent)' : 'var(--mist)',
            }}>
              {o.numero}
            </span>
            <span style={{
              fontSize: '9px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '2px 7px',
              borderRadius: '2px',
              backgroundColor: esGrupoSunat ? 'rgba(232,184,75,0.12)' : 'var(--carbon-light)',
              border: esGrupoSunat ? '1px solid rgba(232,184,75,0.3)' : '1px solid var(--steel)',
              color: esGrupoSunat ? 'var(--accent)' : 'var(--wire)',
            }}>
              {o.tipo}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px' }}>
            <div style={{
              backgroundColor: 'var(--carbon-light)',
              borderRadius: '2px',
              padding: '8px 10px',
              border: '1px solid var(--steel)',
            }}>
              <div style={{
                fontSize: '9px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--wire)',
                marginBottom: '4px',
              }}>
                Original
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--white)' }}>
                USD {formatearNumero(parseFloat(o.total))}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--wire)', marginTop: '3px' }}>
                TC: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--mist)' }}>{o.tcOriginal.toFixed(3)}</span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--steel-light)', marginTop: '2px' }}>
                = S/ {formatearNumero(o.montoOriginalPEN)}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: tcCambio
                  ? (esGrupoSunat ? 'rgba(232,184,75,0.12)' : 'var(--carbon-light)')
                  : 'rgba(46,204,113,0.1)',
                border: tcCambio
                  ? (esGrupoSunat ? '1px solid rgba(232,184,75,0.3)' : '1px solid var(--steel)')
                  : '1px solid rgba(46,204,113,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <ArrowRightLeft size={12} style={{
                  color: tcCambio
                    ? (esGrupoSunat ? 'var(--accent)' : 'var(--wire)')
                    : '#2ecc71',
                }} />
              </div>
              {tcCambio && (
                <span style={{
                  fontSize: '8px',
                  fontWeight: 800,
                  color: esGrupoSunat ? 'var(--accent)' : 'var(--wire)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Ajuste
                </span>
              )}
            </div>

            <div style={{
              borderRadius: '2px',
              padding: '8px 10px',
              border: esGrupoSunat
                ? '1px solid rgba(232,184,75,0.35)'
                : '1px solid var(--steel)',
              backgroundColor: esGrupoSunat
                ? 'rgba(232,184,75,0.08)'
                : 'var(--carbon)',
            }}>
              <div style={{
                fontSize: '9px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: esGrupoSunat ? 'var(--accent)' : 'var(--wire)',
                marginBottom: '4px',
              }}>
                Convertido
              </div>
              <div style={{
                fontSize: '13px',
                fontWeight: 800,
                color: esGrupoSunat ? 'var(--accent)' : 'var(--mist)',
              }}>
                S/ {formatearNumero(o.valorPen)}
              </div>
              <div style={{
                fontSize: '10px',
                marginTop: '3px',
                color: esGrupoSunat ? 'rgba(232,184,75,0.7)' : 'var(--wire)',
              }}>
                TC: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{o.tcUsado.toFixed(3)}</span>
              </div>
              {tcCambio && (
                <div style={{
                  fontSize: '10px',
                  marginTop: '3px',
                  fontWeight: 700,
                  color: diferencia >= 0 ? '#2ecc71' : '#e74c3c',
                }}>
                  {diferencia >= 0 ? '+' : ''}S/ {formatearNumero(diferencia)}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div style={{ marginTop: '16px', borderTop: '1px solid var(--steel)', paddingTop: '16px' }}>
        <h4 style={{
          fontSize: '10px',
          fontWeight: 800,
          color: 'var(--wire)',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <FileText size={13} style={{ color: 'var(--accent)' }} />
          Desglose de Ordenes en USD ({ordenesUSD.length})
        </h4>

        <div style={{
          display: 'grid',
          gridTemplateColumns: grupoHistorico.length > 0 && grupoSunat.length > 0 ? '1fr 1fr' : '1fr',
          gap: '16px',
        }}>
          {grupoHistorico.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--wire)',
                }}>
                  Respetando TC de la Orden
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 8px',
                  borderRadius: '2px',
                  backgroundColor: 'var(--carbon-light)',
                  border: '1px solid var(--steel)',
                  color: 'var(--wire)',
                }}>
                  {grupoHistorico.length}
                </span>
              </div>
              <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {grupoHistorico.map(o => <FilaOrden key={o.numero} o={o} esGrupoSunat={false} />)}
              </div>
            </div>
          )}

          {grupoSunat.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--accent)',
                }}>
                  Aplicando TC SUNAT
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 8px',
                  borderRadius: '2px',
                  backgroundColor: 'rgba(232,184,75,0.1)',
                  border: '1px solid rgba(232,184,75,0.25)',
                  color: 'var(--accent)',
                }}>
                  {grupoSunat.length}
                </span>
              </div>
              <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {grupoSunat.map(o => <FilaOrden key={o.numero} o={o} esGrupoSunat={true} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const resumen = calcularResumenFiltrado();
  const hayUSDenData = resumen.total_ventas_usd > 0;

  return (
    <>
      <ModalTC
        mostrarModalTC={mostrarModalTC}
        tcVenta={tcVenta}
        setMostrarModalTC={setMostrarModalTC}
        aplicarModoUnificacion={aplicarModoUnificacion}
      />

      <div className="w-full px-6 py-8 font-sans">
        <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="text-primary" /> Dashboard de Ventas
          </h1>
          <p className="text-muted text-sm">Monitor de rendimiento comercial y logistico</p>
        </div>
        <div className="flex gap-2">
          <button onClick={descargarExcel} disabled={loadingExcel || dataFiltrada.length === 0} className="btn btn-success">
            {loadingExcel ? <Loading size="sm" color="white" /> : <FileSpreadsheet size={18} />}
            Excel {convertirUSD && tcVenta ? '(TC)' : ''}
          </button>
          <button onClick={descargarPDF} disabled={loadingPdf} className="btn btn-danger">
            {loadingPdf ? <Loading size="sm" color="white" /> : <Download size={18} />}
            PDF
          </button>
        </div>
      </div>

      <div className="card mb-4" style={{ borderLeft: tipoCambio ? '4px solid var(--accent, #ca8a04)' : '4px solid var(--border-color, #374151)' }}>
        <div className="card-body p-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: tipoCambio ? 'var(--accent-dim, rgba(234,179,8,0.1))' : 'var(--bg-tertiary, #1f2937)' }}>
                <DollarSign size={20} style={{ color: tipoCambio ? 'var(--accent, #ca8a04)' : 'var(--text-muted)' }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tipo de Cambio SUNAT</p>
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
                      <Calendar size={12} /><span>SUNAT: {formatearFecha(tipoCambio.fecha)}</span>
                      <span className="mx-1">&middot;</span>
                      <Clock size={12} /><span>{obtenerEdadTC()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    <AlertTriangle size={14} /><span>No disponible — Presione "Actualizar TC" para consultar</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tipoCambio && hayUSDenData && (
                <button className={`btn btn-sm ${convertirUSD ? 'btn-warning' : 'btn-outline'}`} onClick={handleToggleConvertirUSD}
                  title={convertirUSD ? 'Mostrando totales unificados en PEN' : 'Convertir USD a PEN con TC SUNAT'}>
                  <ArrowRightLeft size={14} />{convertirUSD ? 'Viendo en PEN' : 'Unificar a PEN'}
                </button>
              )}
              <button className="btn btn-sm btn-outline" onClick={actualizarTipoCambio} disabled={loadingTC} title="Consultar TC actual desde SUNAT">
                {loadingTC ? <RefreshCcw size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                {loadingTC ? 'Consultando...' : 'Actualizar TC'}
              </button>
            </div>
          </div>
          {tipoCambio && (
            <div className="flex md:hidden items-center gap-2 text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              <Calendar size={12} /><span>SUNAT: {formatearFecha(tipoCambio.fecha)}</span>
              <span className="mx-1">&middot;</span><Clock size={12} /><span>{obtenerEdadTC()}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-body">
          <form onSubmit={generarReporte} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="form-group mb-0">
                <label className="form-label uppercase text-[10px] text-muted font-bold tracking-[0.2em] mb-2 block">Filtrar por:</label>
                <div className="flex gap-3 p-2 bg-carbon-light rounded-lg border border-steel/20 h-[42px] items-center">
                  {[
                    { id: 'fecha_emision', label: 'Emisión' },
                    { id: 'fecha_despacho', label: 'Despacho' },
                    { id: 'fecha_sunat', label: 'SUNAT' }
                  ].map(opcion => (
                    <label key={opcion.id} className="flex items-center gap-1.5 cursor-pointer select-none group">
                      <div className="relative">
                        <input
                          type="radio"
                          className="hidden"
                          checked={filtros.filtroFecha === opcion.id}
                          onChange={() => setFiltros({ ...filtros, filtroFecha: opcion.id })}
                        />
                        <div className={`w-3.5 h-3.5 rounded-full border transition-all flex items-center justify-center ${
                          filtros.filtroFecha === opcion.id
                            ? 'bg-primary border-primary shadow-sm shadow-primary/20'
                            : 'bg-transparent border-steel group-hover:border-wire'
                        }`}>
                          {filtros.filtroFecha === opcion.id && <div className="w-1 h-1 bg-carbon rounded-full" />}
                        </div>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-wider transition-colors ${
                        filtros.filtroFecha === opcion.id ? 'text-primary' : 'text-wire group-hover:text-mist'
                      }`}>
                        {opcion.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group mb-0">
                <label className="form-label uppercase text-[10px] text-muted font-bold tracking-widest mb-1 block">Desde</label>
                <div className="input-with-icon">
                  <Calendar className="icon text-primary" size={14} />
                  <input
                    type="date"
                    className={`form-input text-xs font-bold bg-carbon-mid ${errorFecha ? 'border-red-500/70 !border-red-500/70' : ''}`}
                    style={{ cursor: 'text', color: '#fff' }}
                    value={filtros.fechaInicio}
                    max={filtros.fechaFin || undefined}
                    onChange={handleChangeFechaInicio}
                  />
                </div>
              </div>

              <div className="form-group mb-0">
                <label className="form-label uppercase text-[10px] text-muted font-bold tracking-widest mb-1 block">Hasta</label>
                <div className="input-with-icon">
                  <Calendar className="icon text-primary" size={14} />
                  <input
                    type="date"
                    className={`form-input text-xs font-bold bg-carbon-mid ${errorFecha ? 'border-red-500/70 !border-red-500/70' : ''}`}
                    style={{ cursor: 'text', color: '#fff' }}
                    value={filtros.fechaFin}
                    min={filtros.fechaInicio || undefined}
                    onChange={handleChangeFechaFin}
                  />
                </div>
              </div>

              <div className="form-group mb-0 relative md:col-span-2" ref={wrapperRef} style={{ zIndex: 50 }}>
                <label className="form-label uppercase text-[10px] text-muted font-bold tracking-widest mb-1 block">Cliente</label>
                <div className="search-input-wrapper relative">
                  <Search className="search-icon text-primary" size={14} />
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre o RUC..."
                    className="form-input search-input text-xs font-bold bg-carbon-mid"
                    style={{ cursor: 'text', color: '#fff' }}
                    value={busquedaCliente}
                    onChange={(e) => { setBusquedaCliente(e.target.value); if (filtros.idCliente) setFiltros({ ...filtros, idCliente: '' }); }}
                    onFocus={() => busquedaCliente && setMostrarSugerencias(true)}
                  />
                  {filtros.idCliente && (
                    <button type="button" onClick={limpiarCliente} className="absolute right-2 top-2.5 text-gray-400 hover:text-red-500"><X size={14} /></button>
                  )}
                </div>
                {mostrarSugerencias && clientesSugeridos.length > 0 && (
                  <ul className="absolute z-[9999] w-full border border-steel/30 rounded-lg shadow-2xl mt-1 max-h-96 overflow-y-auto" style={{ backgroundColor: '#1a1a1a', top: '100%' }}>
                    {clientesSugeridos.map(cliente => (
                      <li key={cliente.id_cliente} onClick={() => seleccionarCliente(cliente)} className="px-4 py-2 cursor-pointer text-xs border-b border-steel/20 last:border-0 hover:bg-white/10 transition-colors relative z-[10000]">
                        <div className="font-bold text-mist">{cliente.razon_social}</div>
                        <div className="text-[10px] text-wire font-mono">RUC: {cliente.ruc}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {errorFecha && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <span className="text-[11px] font-black text-red-400 uppercase tracking-widest">{errorFecha}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end border-t border-steel/20 pt-6">
              <FilterCheckboxGroup
                label="Estado Orden"
                selectedValues={filtros.estadosOrden}
                onChange={(vals) => setFiltros({ ...filtros, estadosOrden: vals })}
                options={[
                  { label: 'En Espera', value: 'En Espera' },
                  { label: 'En Proceso', value: 'En Proceso' },
                  { label: 'Atendido por Produccion', value: 'Atendido por Produccion' },
                  { label: 'Despacho Parcial', value: 'Despacho Parcial' },
                  { label: 'Despachada', value: 'Despachada' },
                  { label: 'Entregada', value: 'Entregada' }
                ]}
              />
              <FilterCheckboxGroup
                label="Estado Pago"
                selectedValues={filtros.estadosPago}
                onChange={(vals) => setFiltros({ ...filtros, estadosPago: vals })}
                options={[
                  { label: 'Pendiente', value: 'Pendiente' },
                  { label: 'Parcial', value: 'Parcial' },
                  { label: 'Pagado', value: 'Pagado' }
                ]}
              />
              <FilterCheckboxGroup
                label="Vendedor"
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
                label="Tipo de Documento"
                selectedValues={filtros.tiposDocumento}
                onChange={(vals) => setFiltros({ ...filtros, tiposDocumento: vals })}
                options={[
                  { label: 'Factura', value: 'Factura' },
                  { label: 'Nota de Venta', value: 'Nota de Venta' },
                  { label: 'Sin Comprobante', value: 'Sin Comprobante' }
                ]}
              />

              <div className="form-group mb-0">
                <label className="form-label uppercase text-[10px] text-muted font-bold tracking-widest mb-2 block">Opciones Exportación:</label>
                <div className="flex gap-4 p-2 bg-carbon-light rounded-lg border border-steel/20 h-[42px] items-center">
                  <label className="flex items-center gap-2 cursor-pointer group select-none">
                    <input type="checkbox" checked={incluirDetalleExcel} onChange={(e) => setIncluirDetalleExcel(e.target.checked)} className="hidden" />
                    <div className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${incluirDetalleExcel ? 'bg-success border-success' : 'bg-transparent border-steel group-hover:border-wire'}`}>
                      {incluirDetalleExcel && <CheckCircle size={10} className="text-carbon font-bold" />}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-wider ${incluirDetalleExcel ? 'text-success' : 'text-wire'}`}>Hojas Excel</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group select-none">
                    <input type="checkbox" checked={incluirDetallePDF} onChange={(e) => setIncluirDetallePDF(e.target.checked)} className="hidden" />
                    <div className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${incluirDetallePDF ? 'bg-danger border-danger' : 'bg-transparent border-steel group-hover:border-wire'}`}>
                      {incluirDetallePDF && <CheckCircle size={10} className="text-carbon font-bold" />}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-wider ${incluirDetallePDF ? 'text-danger' : 'text-wire'}`}>Detalle PDF</span>
                  </label>
                </div>
              </div>

              <div className="lg:col-span-2 flex gap-2">
                <button type="button" onClick={limpiarFiltros} className="btn btn-outline flex-1 border-steel/30 text-wire hover:bg-carbon-light" title="Limpiar filtros">
                  <RefreshCw size={16} /> Reiniciar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1 shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={loading || !!errorFecha}
                >
                  {loading ? <Loading size="sm" color="white" /> : <Filter size={18} />} Buscar
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {convertirUSD && tcVenta && hayUSDenData && (
        <div className="card mb-4 p-4 rounded-lg" style={{ background: 'var(--accent-dim, rgba(234,179,8,0.08))', border: '1px solid var(--accent-border, rgba(234,179,8,0.3))' }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ArrowRightLeft size={20} style={{ color: 'var(--accent, #ca8a04)' }} className="mt-1" />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--accent, #ca8a04)' }}>
                  {modoUnificacion === 'sunat' ? `Totales unificados en Soles (TC Global SUNAT: S/ ${tcVenta.toFixed(3)})` : 
                   modoUnificacion === 'mixto' ? `Totales unificados en Soles (TC Híbrido: SUNAT S/ ${tcVenta.toFixed(3)} + Históricos)` : 
                   'Totales unificados en Soles (Respetando TC Histórico de cada orden estricto)'}
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
                  <span className="text-sm">Ventas: <strong className="text-base">S/ {formatearNumero(totalUnificadoPEN(resumen.total_ventas_pen, resumen.total_ventas_usd, 'total'))}</strong></span>
                  <span className="text-sm text-green-700">Cobrado: <strong>S/ {formatearNumero(totalUnificadoPEN(resumen.total_pagado_pen, resumen.total_pagado_usd, 'monto_pagado'))}</strong></span>
                  <span className="text-sm text-red-700">Por Cobrar: <strong>S/ {formatearNumero(totalUnificadoPEN(resumen.total_pendiente_pen, resumen.total_pendiente_usd, 'pendiente_cobro'))}</strong></span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setMostrarDesgloseUSD(!mostrarDesgloseUSD)}
              className="btn btn-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-none whitespace-nowrap"
            >
              {mostrarDesgloseUSD ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {mostrarDesgloseUSD ? 'Ocultar desglose' : 'Ver desglose de órdenes afectadas'}
            </button>
          </div>
          
          {mostrarDesgloseUSD && renderDesgloseUnificacion()}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card border-l-4 border-primary">
          <div className="stat-content">
            <p className="text-[10px] text-wire font-black uppercase tracking-widest mb-1">Facturas (PEN)</p>
            <h3 className="stat-value text-white">{formatearMoneda(resumen.factura_pen || 0, 'PEN')}</h3>
          </div>
          <div className="stat-icon bg-primary/10 text-primary"><FileCheck size={20} /></div>
        </div>
        <div className="stat-card border-l-4 border-primary">
          <div className="stat-content">
            <p className="text-[10px] text-wire font-black uppercase tracking-widest mb-1">Facturas (USD)</p>
            <h3 className="stat-value text-primary">{formatearMoneda(resumen.factura_usd || 0, 'USD')}</h3>
          </div>
          <div className="stat-icon bg-primary/10 text-primary"><DollarSign size={20} /></div>
        </div>
        <div className="stat-card border-l-4 border-info">
          <div className="stat-content">
            <p className="text-[10px] text-wire font-black uppercase tracking-widest mb-1">Notas de Venta (PEN)</p>
            <h3 className="stat-value text-white">{formatearMoneda(resumen.nota_venta_pen || 0, 'PEN')}</h3>
          </div>
          <div className="stat-icon bg-info/10 text-info"><FileText size={20} /></div>
        </div>
        <div className="stat-card border-l-4 border-info">
          <div className="stat-content">
            <p className="text-[10px] text-wire font-black uppercase tracking-widest mb-1">Notas de Venta (USD)</p>
            <h3 className="stat-value text-info">{formatearMoneda(resumen.nota_venta_usd || 0, 'USD')}</h3>
          </div>
          <div className="stat-icon bg-info/10 text-info"><DollarSign size={20} /></div>
        </div>
        <div className="stat-card border-l-4 border-steel">
          <div className="stat-content">
            <p className="text-[10px] text-wire font-black uppercase tracking-widest mb-1">Sin Comprobante (PEN)</p>
            <h3 className="stat-value text-white">{formatearMoneda(resumen.sin_comprobante_pen || 0, 'PEN')}</h3>
          </div>
          <div className="stat-icon bg-steel/10 text-wire"><ShoppingCart size={20} /></div>
        </div>
        <div className="stat-card border-l-4 border-steel">
          <div className="stat-content">
            <p className="text-[10px] text-wire font-black uppercase tracking-widest mb-1">Sin Comprobante (USD)</p>
            <h3 className="stat-value text-wire">{formatearMoneda(resumen.sin_comprobante_usd || 0, 'USD')}</h3>
          </div>
          <div className="stat-icon bg-steel/10 text-wire"><DollarSign size={20} /></div>
        </div>
        <div className="stat-card border-l-4 border-success col-span-1 lg:col-span-2">
          <div className="stat-content flex justify-between items-center w-full">
            <div>
              <p className="text-[10px] text-wire font-black uppercase tracking-widest mb-1">Total Operaciones</p>
              <h3 className="stat-value text-success">{resumen.cantidad_ordenes || 0} Ordenes</h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-wire font-black uppercase tracking-widest mb-1">Ventas Totales (PEN Unif.)</p>
              <h3 className="text-lg font-black text-white">
                {formatearMoneda(totalUnificadoPEN(resumen.total_ventas_pen, resumen.total_ventas_usd, 'total'), 'PEN')}
              </h3>
            </div>
          </div>
          <div className="stat-icon bg-success/10 text-success ml-4"><TrendingUp size={24} /></div>
        </div>
      </div>

      {(resumen.total_comisiones_pen > 0 || resumen.total_comisiones_usd > 0) && (
        <div className="card mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <div className="card-body p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg"><Percent size={20} className="text-purple-600" /></div>
                <div>
                  <p className="text-xs font-semibold text-purple-600 uppercase">Total Comisiones</p>
                  <p className="text-lg font-bold text-purple-900">{formatearMoneda(resumen.total_comisiones_pen, 'PEN')}</p>
                  {resumen.total_comisiones_usd > 0 && (
                    <p className="text-sm font-semibold text-purple-700">
                      {formatearMoneda(resumen.total_comisiones_usd, 'USD')}
                      {convertirUSD && tcVenta && (<span className="text-xs ml-2" style={{ color: 'var(--accent, #ca8a04)' }}>= S/ {formatearNumero(resumen.total_comisiones_usd * tcVenta)}</span>)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header bg-gray-50 flex justify-between items-center">
          <h3 className="card-title text-sm text-gray-800">Detalle de Transacciones</h3>
          <span className="badge badge-secondary badge-outline">{dataFiltrada.length} Registros</span>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th className="px-4 py-3">Acciones</th>
                <th className="px-4 py-3">Orden</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3 text-center" style={filtros.filtroFecha === 'fecha_emision' ? { backgroundColor: 'rgba(232, 184, 75, 0.15)', color: '#e8b84b', borderBottomColor: '#e8b84b' } : {}}>Emision</th>
                <th className="px-4 py-3 text-center" style={filtros.filtroFecha === 'fecha_sunat' ? { backgroundColor: 'rgba(232, 184, 75, 0.15)', color: '#e8b84b', borderBottomColor: '#e8b84b' } : {}}>SUNAT</th>
                <th className="px-4 py-3 text-center" style={filtros.filtroFecha === 'fecha_despacho' ? { backgroundColor: 'rgba(232, 184, 75, 0.15)', color: '#e8b84b', borderBottomColor: '#e8b84b' } : {}}>Despacho</th>
                <th className="px-4 py-3 text-right">Total</th>
                {convertirUSD && tcVenta && <th className="px-4 py-3 text-right">Total (PEN)</th>}
                <th className="px-4 py-3 text-center">Estado Pago</th>
                <th className="px-4 py-3 text-center">Estado Orden</th>
              </tr>
            </thead>
            <tbody>
              {dataFiltrada.length > 0 ? (
                dataFiltrada.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => verDetalleOrden(item)}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => verDetalleOrden(item)} className="btn btn-ghost btn-xs text-primary" title="Ver detalles"><Eye size={14} /> Ver</button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-medium text-primary">{item.numero}</div>
                      {(item.numero_comprobante || item.numero_comprobante_sunat) && (
                        <div className="text-xs text-muted flex items-center gap-1">
                          {item.tipo_comprobante}: {(item.tipo_comprobante === 'Factura' && item.facturado_sunat && item.numero_comprobante_sunat)
                            ? (
                              <button 
  type="button"
  onClick={(e) => { e.stopPropagation(); abrirVisorSunat(item); }}
  className="btn btn-ghost btn-xs text-green-600"
  title="Ver comprobante SUNAT"
>
  <FileCheck size={14} /> {item.numero_comprobante_sunat}
</button>
                            )
                            : (item.tipo_comprobante === 'Factura' && !item.facturado_sunat) ? '' : item.numero_comprobante}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      <div className="font-medium truncate w-32" title={item.cliente}>{item.cliente}</div>
                      <div className="text-xs text-muted">{item.ruc}</div>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs truncate w-24">{item.vendedor}</td>
                    <td className="px-4 py-3 text-center text-xs" style={filtros.filtroFecha === 'fecha_emision' ? { backgroundColor: 'rgba(232, 184, 75, 0.05)', color: '#e8b84b', fontWeight: 'bold' } : {}}>{formatearFecha(item.fecha_emision)}</td>
                    <td className="px-4 py-3 text-center text-xs" style={filtros.filtroFecha === 'fecha_sunat' ? { backgroundColor: 'rgba(232, 184, 75, 0.05)', color: '#e8b84b', fontWeight: 'bold' } : {}}>
                      {item.fecha_facturacion_sunat ? formatearFecha(item.fecha_facturacion_sunat) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs" style={filtros.filtroFecha === 'fecha_despacho' ? { backgroundColor: 'rgba(232, 184, 75, 0.05)', color: '#e8b84b', fontWeight: 'bold' } : {}}>
                      {item.fecha_despacho ? formatearFecha(item.fecha_despacho) : <span className="text-gray-400 italic">Pendiente</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.moneda === 'USD' && parseFloat(item.tipo_cambio || 1) !== 1 ? (
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-gray-700">
                            <span className="text-xs text-muted mr-1">USD</span>
                            {formatearNumero(item.total)}
                          </span>
                          <span className={`text-[10px] font-semibold mt-0.5 ${convertirUSD && modoUnificacion === 'historico' && item.tc_historico ? 'text-accent' : 'text-primary'}`}>
                            TC: {
                              (convertirUSD && modoUnificacion === 'historico' && item.tc_historico)
                                ? parseFloat(item.tc_historico).toFixed(3)
                                : parseFloat(item.tipo_cambio).toFixed(3)
                            }
                          </span>
                          <span className="text-xs font-bold mt-0.5" style={{ color: 'var(--accent, #ca8a04)' }}>
                            <span className="text-[10px] mr-1">S/</span>
                            {formatearNumero(
                              parseFloat(item.total) * (
                                (convertirUSD && modoUnificacion === 'historico' && item.tc_historico)
                                  ? parseFloat(item.tc_historico)
                                  : (convertirUSD && modoUnificacion === 'sunat' ? tcVenta : 
                                     convertirUSD && modoUnificacion === 'mixto' ? (parseFloat(item.tipo_cambio) > 3 ? parseFloat(item.tipo_cambio) : tcVenta) :
                                     parseFloat(item.tipo_cambio))
                              )
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="font-bold text-gray-700">
                          <span className="text-xs text-muted mr-1">{item.moneda}</span>
                          {formatearNumero(item.total)}
                        </span>
                      )}
                    </td>
                    {convertirUSD && (
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--accent, #ca8a04)' }}>
                        S/ {formatearNumero(
                          item.moneda === 'USD'
                            ? (modoUnificacion === 'sunat' ? parseFloat(item.total) * tcVenta : 
                               modoUnificacion === 'mixto' ? parseFloat(item.total) * (parseFloat(item.tipo_cambio || 1) > 3 ? parseFloat(item.tipo_cambio || 1) : tcVenta) : 
                               parseFloat(item.total) * (item.tc_historico ? parseFloat(item.tc_historico) : tcVenta))
                            : parseFloat(item.total)
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">{obtenerBadgeEstadoPago(item.estado_pago)}</td>
                    <td className="px-4 py-3 text-center">{obtenerBadgeEstado(item.estado)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={convertirUSD && tcVenta ? 11 : 10} className="px-4 py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center">
                      <Search size={32} className="mb-2 opacity-20" />No se encontraron ventas con los filtros seleccionados.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>



      {mostrarDetalleOrden && ordenSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-content bg-white rounded-xl shadow-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto m-4 flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-start z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="text-primary" /> Detalle de Orden: {ordenSeleccionada.numero}
                </h2>
                <p className="text-sm text-muted mt-1">Informacion completa de la orden de venta</p>
              </div>
              <button onClick={() => setMostrarDetalleOrden(false)} className="btn btn-ghost"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Estado General</p>
                  <div className="flex flex-col gap-2">{obtenerBadgeEstado(ordenSeleccionada.estado)}{obtenerBadgeVerificacion(ordenSeleccionada.estado_verificacion)}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-xs text-green-600 font-semibold uppercase mb-1">Estado de Pago</p>
                  <div className="flex flex-col gap-2">
                    {obtenerBadgeEstadoPago(ordenSeleccionada.estado_pago)}
                    <p className="text-xs text-gray-600 mt-1">Pagado: {ordenSeleccionada.moneda} {ordenSeleccionada.monto_pagado}</p>
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-600 font-semibold uppercase mb-1">Tipo de Venta</p>
                  <p className="text-lg font-bold text-purple-900">{ordenSeleccionada.tipo_venta}</p>
                  {ordenSeleccionada.tipo_venta === 'Credito' && (
                    <div className="mt-1">
                      <p className="text-sm font-semibold text-purple-800">Forma Pago: Credito {ordenSeleccionada.dias_credito} Dias</p>
                      <p className="text-xs text-gray-600">Vence: {formatearFecha(ordenSeleccionada.fecha_vencimiento)}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card shadow-none">
                  <div className="card-body p-5">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Building2 size={18} className="text-primary" /> Informacion del Cliente</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-muted">Razon Social:</span><p className="font-medium text-gray-800">{ordenSeleccionada.cliente}</p></div>
                      <div><span className="text-muted">RUC:</span><p className="font-medium text-gray-800">{ordenSeleccionada.ruc}</p></div>
                      {ordenSeleccionada.direccion_cliente && (<div><span className="text-muted flex items-center gap-1"><MapPin size={14} /> Direccion:</span><p className="font-medium text-gray-800">{ordenSeleccionada.direccion_cliente}</p></div>)}
                      {ordenSeleccionada.telefono_cliente && (<div className="flex items-center gap-2"><Phone size={14} className="text-muted" /><span className="text-gray-800">{ordenSeleccionada.telefono_cliente}</span></div>)}
                      {ordenSeleccionada.email_cliente && (<div className="flex items-center gap-2"><Mail size={14} className="text-muted" /><span className="text-gray-800">{ordenSeleccionada.email_cliente}</span></div>)}
                    </div>
                  </div>
                </div>
                <div className="card shadow-none">
                  <div className="card-body p-5">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Calendar size={18} className="text-success" /> Fechas Importantes</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted">Creacion:</span><span className="font-medium text-gray-800">{formatearFechaHora(ordenSeleccionada.fecha_creacion)}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Emision:</span><span className="font-medium text-gray-800">{formatearFecha(ordenSeleccionada.fecha_emision)}</span></div>
                      {ordenSeleccionada.fecha_vencimiento && (<div className="flex justify-between"><span className="text-muted">Vencimiento:</span><span className="font-medium text-gray-800">{formatearFecha(ordenSeleccionada.fecha_vencimiento)}</span></div>)}
                      {ordenSeleccionada.fecha_entrega_programada && (<div className="flex justify-between"><span className="text-muted">Entrega Programada:</span><span className="font-medium text-gray-800">{formatearFecha(ordenSeleccionada.fecha_entrega_programada)}</span></div>)}
                      {ordenSeleccionada.fecha_entrega_real && (<div className="flex justify-between"><span className="text-muted">Entrega Real:</span><span className="font-medium text-green-700">{formatearFecha(ordenSeleccionada.fecha_entrega_real)}</span></div>)}
                      {ordenSeleccionada.fecha_verificacion && (<div className="flex justify-between"><span className="text-muted">Verificacion:</span><span className="font-medium text-gray-800">{formatearFechaHora(ordenSeleccionada.fecha_verificacion)}</span></div>)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card shadow-none">
                <div className="card-body p-5">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">{obtenerIconoTipoEntrega(ordenSeleccionada.tipo_entrega)} Informacion de Entrega</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted">Tipo de Entrega:</span><p className="font-medium text-gray-800">{ordenSeleccionada.tipo_entrega}</p></div>
                    {ordenSeleccionada.tipo_entrega === 'Vehiculo Empresa' && (<>
                      {ordenSeleccionada.vehiculo_placa && (<div><span className="text-muted">Vehiculo:</span><p className="font-medium text-gray-800">{ordenSeleccionada.vehiculo_placa} - {ordenSeleccionada.vehiculo_marca}</p></div>)}
                      {ordenSeleccionada.conductor_nombre && (<div><span className="text-muted">Conductor:</span><p className="font-medium text-gray-800">{ordenSeleccionada.conductor_nombre}</p>{ordenSeleccionada.conductor_dni && (<p className="text-xs text-muted">DNI: {ordenSeleccionada.conductor_dni}</p>)}{ordenSeleccionada.conductor_licencia && (<p className="text-xs text-muted">Licencia: {ordenSeleccionada.conductor_licencia}</p>)}</div>)}
                    </>)}
                    {ordenSeleccionada.tipo_entrega === 'Transporte Privado' && (<>
                      {ordenSeleccionada.transporte_nombre && (<div><span className="text-muted">Empresa de Transporte:</span><p className="font-medium text-gray-800">{ordenSeleccionada.transporte_nombre}</p></div>)}
                      {ordenSeleccionada.transporte_placa && (<div><span className="text-muted">Placa:</span><p className="font-medium text-gray-800">{ordenSeleccionada.transporte_placa}</p></div>)}
                      {ordenSeleccionada.transporte_conductor && (<div><span className="text-muted">Conductor:</span><p className="font-medium text-gray-800">{ordenSeleccionada.transporte_conductor}</p>{ordenSeleccionada.transporte_dni && (<p className="text-xs text-muted">DNI: {ordenSeleccionada.transporte_dni}</p>)}</div>)}
                    </>)}
                    {ordenSeleccionada.direccion_entrega && (<div className="md:col-span-2"><span className="text-muted flex items-center gap-1"><MapPin size={14} /> Direccion de Entrega:</span><p className="font-medium text-gray-800">{ordenSeleccionada.direccion_entrega}</p>{ordenSeleccionada.ciudad_entrega && (<p className="text-xs text-muted">{ordenSeleccionada.ciudad_entrega}</p>)}</div>)}
                    {ordenSeleccionada.contacto_entrega && (<div><span className="text-muted">Contacto:</span><p className="font-medium text-gray-800">{ordenSeleccionada.contacto_entrega}</p>{ordenSeleccionada.telefono_entrega && (<p className="text-xs text-muted">{ordenSeleccionada.telefono_entrega}</p>)}</div>)}
                  </div>
                </div>
              </div>

              {ordenSeleccionada.detalles && ordenSeleccionada.detalles.length > 0 && (
                <div className="card shadow-none">
                  <div className="card-body p-5">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Package size={18} className="text-purple-600" /> Productos ({ordenSeleccionada.detalles.length})</h3>
                    <div className="table-container">
                      <table className="table">
                        <thead><tr>
                          <th className="px-3 py-2 text-left">Producto</th><th className="px-3 py-2 text-center">Codigo</th>
                          <th className="px-3 py-2 text-center">Cantidad</th><th className="px-3 py-2 text-right">P. Unitario</th>
                          <th className="px-3 py-2 text-right">Descuento</th><th className="px-3 py-2 text-right">Subtotal</th>
                          <th className="px-3 py-2 text-center">Despachado</th>
                        </tr></thead>
                        <tbody>
                          {ordenSeleccionada.detalles.map((det, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2"><div className="font-medium text-gray-800">{det.producto_nombre}</div>{det.descripcion && (<div className="text-xs text-muted">{det.descripcion}</div>)}</td>
                              <td className="px-3 py-2 text-center text-muted font-mono text-xs">{det.codigo_producto}</td>
                              <td className="px-3 py-2 text-center font-semibold text-gray-800">{det.cantidad} {det.unidad_medida}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{ordenSeleccionada.moneda} {det.precio_unitario}</td>
                              <td className="px-3 py-2 text-right text-red-600">{parseFloat(det.descuento) > 0 ? `-${ordenSeleccionada.moneda} ${det.descuento}` : '-'}</td>
                              <td className="px-3 py-2 text-right font-bold text-gray-800">{ordenSeleccionada.moneda} {det.subtotal}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`badge ${det.cantidad_despachada >= det.cantidad ? 'badge-success' : det.cantidad_despachada > 0 ? 'badge-warning' : 'badge-secondary'}`}>
                                  {det.cantidad_despachada}/{det.cantidad}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-5">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CreditCard size={18} className="text-primary" /> Resumen Financiero</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal:</span><span className="font-semibold text-gray-800">{ordenSeleccionada.moneda} {ordenSeleccionada.subtotal}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">{ordenSeleccionada.tipo_impuesto} ({ordenSeleccionada.porcentaje_impuesto}%):</span><span className="font-semibold text-gray-800">{ordenSeleccionada.moneda} {ordenSeleccionada.igv}</span></div>
                    <div className="flex justify-between text-lg border-t border-gray-300 pt-2"><span className="font-bold text-gray-800">Total:</span><span className="font-bold text-primary">{ordenSeleccionada.moneda} {ordenSeleccionada.total}</span></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Monto Pagado:</span><span className="font-semibold text-green-600">{ordenSeleccionada.moneda} {ordenSeleccionada.monto_pagado}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Pendiente de Cobro:</span><span className="font-semibold text-red-600">{ordenSeleccionada.moneda} {ordenSeleccionada.pendiente_cobro}</span></div>
                    {parseFloat(ordenSeleccionada.total_comision) > 0 && (
                      <div className="flex justify-between text-sm border-t border-gray-300 pt-2"><span className="text-gray-600">Comision ({ordenSeleccionada.porcentaje_comision_promedio}%):</span><span className="font-semibold text-purple-600">{ordenSeleccionada.moneda} {ordenSeleccionada.total_comision}</span></div>
                    )}
                  </div>
                </div>
                {convertirUSD && ordenSeleccionada.moneda === 'USD' && (
                  <div className="mt-4 pt-3 rounded-lg p-3" style={{ background: 'var(--accent-dim, rgba(234,179,8,0.08))', border: '1px solid var(--accent-border, rgba(234,179,8,0.3))' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--accent, #ca8a04)' }}>
                      <ArrowRightLeft size={12} className="inline mr-1" />Equivalente en Soles 
                      (TC Aplicado: S/ {
                        (modoUnificacion === 'sunat' ? tcVenta : 
                         modoUnificacion === 'mixto' ? (parseFloat(ordenSeleccionada.tipo_cambio || 1) > 3 ? parseFloat(ordenSeleccionada.tipo_cambio || 1) : tcVenta) : 
                         (ordenSeleccionada.tc_historico ? parseFloat(ordenSeleccionada.tc_historico) : tcVenta)).toFixed(3)
                      })
                    </p>
                    <div className="flex justify-between text-sm"><span>Total:</span><span className="font-bold" style={{ color: 'var(--accent, #ca8a04)' }}>S/ {formatearNumero(parseFloat(ordenSeleccionada.total) * (modoUnificacion === 'sunat' ? tcVenta : modoUnificacion === 'mixto' ? (parseFloat(ordenSeleccionada.tipo_cambio || 1) > 3 ? parseFloat(ordenSeleccionada.tipo_cambio || 1) : tcVenta) : (ordenSeleccionada.tc_historico ? parseFloat(ordenSeleccionada.tc_historico) : tcVenta)))}</span></div>
                    <div className="flex justify-between text-sm"><span>Pagado:</span><span className="font-semibold text-green-700">S/ {formatearNumero(parseFloat(ordenSeleccionada.monto_pagado) * (modoUnificacion === 'sunat' ? tcVenta : modoUnificacion === 'mixto' ? (parseFloat(ordenSeleccionada.tipo_cambio || 1) > 3 ? parseFloat(ordenSeleccionada.tipo_cambio || 1) : tcVenta) : (ordenSeleccionada.tc_historico ? parseFloat(ordenSeleccionada.tc_historico) : tcVenta)))}</span></div>
                    <div className="flex justify-between text-sm"><span>Pendiente:</span><span className="font-semibold text-red-700">S/ {formatearNumero(parseFloat(ordenSeleccionada.pendiente_cobro) * (modoUnificacion === 'sunat' ? tcVenta : modoUnificacion === 'mixto' ? (parseFloat(ordenSeleccionada.tipo_cambio || 1) > 3 ? parseFloat(ordenSeleccionada.tipo_cambio || 1) : tcVenta) : (ordenSeleccionada.tc_historico ? parseFloat(ordenSeleccionada.tc_historico) : tcVenta)))}</span></div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card shadow-none">
                  <div className="card-body p-4">
                    <h4 className="font-semibold text-gray-700 mb-2 text-sm">Personal Involucrado</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted">Vendedor:</span><span className="font-medium text-gray-800">{ordenSeleccionada.vendedor}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Registrado por:</span><span className="font-medium text-gray-800">{ordenSeleccionada.registrador}</span></div>
                      {ordenSeleccionada.verificador !== 'No asignado' && (<div className="flex justify-between"><span className="text-muted">Verificador:</span><span className="font-medium text-gray-800">{ordenSeleccionada.verificador}</span></div>)}
                    </div>
                  </div>
                </div>
                <div className="card shadow-none">
                  <div className="card-body p-4">
                    <h4 className="font-semibold text-gray-700 mb-2 text-sm">Documentos Asociados</h4>
                    <div className="space-y-1 text-sm">
                      {ordenSeleccionada.numero_cotizacion && (<div className="flex justify-between"><span className="text-muted">Cotizacion:</span><span className="font-medium text-gray-800">{ordenSeleccionada.numero_cotizacion}</span></div>)}
                      {ordenSeleccionada.numero_guia_interna && (<div className="flex justify-between"><span className="text-muted">Guia Interna:</span><span className="font-medium text-gray-800">{ordenSeleccionada.numero_guia_interna}</span></div>)}
                      {ordenSeleccionada.orden_compra_cliente && (<div className="flex justify-between"><span className="text-muted">OC Cliente:</span><span className="font-medium text-gray-800">{ordenSeleccionada.orden_compra_cliente}</span></div>)}
                    </div>
                  </div>
                </div>
              </div>

              {(ordenSeleccionada.observaciones || ordenSeleccionada.observaciones_verificador || ordenSeleccionada.motivo_rechazo) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><FileCheck size={16} className="text-yellow-600" /> Observaciones</h4>
                  <div className="space-y-2 text-sm">
                    {ordenSeleccionada.observaciones && (<div><span className="font-medium text-gray-700">Observaciones generales:</span><p className="text-gray-600 mt-1">{ordenSeleccionada.observaciones}</p></div>)}
                    {ordenSeleccionada.observaciones_verificador && (<div><span className="font-medium text-gray-700">Observaciones del verificador:</span><p className="text-gray-600 mt-1">{ordenSeleccionada.observaciones_verificador}</p></div>)}
                    {ordenSeleccionada.motivo_rechazo && (<div className="bg-red-50 border border-red-200 rounded p-2"><span className="font-medium text-red-700">Motivo de rechazo:</span><p className="text-red-600 mt-1">{ordenSeleccionada.motivo_rechazo}</p></div>)}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end rounded-b-xl">
              <button onClick={() => setMostrarDetalleOrden(false)} className="btn btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      )}
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