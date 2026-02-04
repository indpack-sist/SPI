import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Eye, 
  Edit,
  ShoppingCart, 
  Filter, 
  TrendingUp, 
  Clock,
  Package, 
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
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { ordenesVentaAPI } from '../../config/api';

function OrdenesVenta() {
  const navigate = useNavigate();
  
  const [ordenes, setOrdenes] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [descargandoPDF, setDescargandoPDF] = useState(null);

  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [filtroEstadoPago, setFiltroEstadoPago] = useState('');
  const [filtroVerificacion, setFiltroVerificacion] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    cargarDatos();
  }, [filtroEstado, filtroPrioridad, filtroVerificacion]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroEstado, filtroPrioridad, filtroEstadoPago, filtroVerificacion, busqueda]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filtros = {};
      if (filtroEstado) filtros.estado = filtroEstado;
      if (filtroPrioridad) filtros.prioridad = filtroPrioridad;
      if (filtroVerificacion) filtros.estado_verificacion = filtroVerificacion;
      
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
    }
  };

  const ordenesFiltradas = ordenes.filter(orden => {
    if (filtroEstadoPago && orden.estado_pago !== filtroEstadoPago) return false;
    
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

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = ordenesFiltradas.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(ordenesFiltradas.length / itemsPerPage);

  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

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
          const mensajeError = errorJson.error || 'Error al generar el PDF';
          setError(mensajeError);
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
    const cleanFecha = fechaStr.split('T')[0];
    const partes = cleanFecha.split('-');
    if (partes.length !== 3) return cleanFecha;
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
      'Pendiente': {
        icono: Clock,
        clase: 'badge-warning',
        texto: 'Pend. Verif.',
        color: '#f59e0b'
      },
      'Aprobada': {
        icono: CheckCircle,
        clase: 'badge-success',
        texto: 'Aprobada',
        color: '#10b981'
      },
      'Rechazada': {
        icono: XCircle,
        clase: 'badge-danger',
        texto: 'Rechazada',
        color: '#ef4444'
      }
    };
    return configs[estadoVerif] || configs['Pendiente'];
  };

  const getEstadoConfig = (estado) => {
    const configs = {
      'En Espera': { 
        icono: Clock, 
        clase: 'badge-warning',
        texto: 'En Espera'
      },
      'En Proceso': {
        icono: PlayCircle,
        clase: 'badge-info',
        texto: 'En Proceso'
      },
      'Atendido por Producción': { 
        icono: Factory, 
        clase: 'badge-primary',
        texto: 'Atendido'
      },
      'Despacho Parcial': {
        icono: Truck,
        clase: 'badge-warning',
        texto: 'Desp. Parcial'
      },
      'Despachada': { 
        icono: Truck, 
        clase: 'badge-primary',
        texto: 'Despachada'
      },
      'Entregada': { 
        icono: CheckCircle, 
        clase: 'badge-success',
        texto: 'Entregada'
      },
      'Cancelada': { 
        icono: XCircle, 
        clase: 'badge-danger',
        texto: 'Cancelada'
      }
    };
    return configs[estado] || configs['En Espera'];
  };

  const getPrioridadConfig = (prioridad) => {
    const configs = {
      'Baja': { clase: 'badge-secondary', color: '#6b7280' },
      'Media': { clase: 'badge-info', color: '#3b82f6' },
      'Alta': { clase: 'badge-warning', color: '#f59e0b' },
      'Urgente': { clase: 'badge-danger', color: '#ef4444' }
    };
    return configs[prioridad] || configs['Media'];
  };

  const getEstadoPagoConfig = (estadoPago) => {
    const configs = {
      'Pendiente': { clase: 'badge-warning', icono: Clock, color: '#f59e0b' },
      'Parcial': { clase: 'badge-info', icono: CreditCard, color: '#3b82f6' },
      'Pagado': { clase: 'badge-success', icono: CheckCircle, color: '#10b981' }
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
              <div className="text-[10px] text-muted mt-1">
                {row.verificado_por}
              </div>
            )}
            {value === 'Rechazada' && (
              <div className="text-[10px] text-danger mt-1 font-semibold">
                Corregir
              </div>
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
      width: '140px',
      render: (value, row) => {
        const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(String(row.tipo_impuesto || '').toUpperCase());
        const total = esSinImpuesto ? parseFloat(row.subtotal || 0) : parseFloat(value || 0);
        const pagado = parseFloat(row.monto_pagado || 0);
        const porcentaje = total > 0 ? (pagado / total) * 100 : 0;
        
        return (
          <div>
            <div className="font-bold text-gray-800">{formatearMoneda(total, row.moneda)}</div>
            <div className="text-xs text-muted">
              Pagado: {formatearMoneda(pagado, row.moneda)}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div 
                className={`h-1.5 rounded-full ${
                  porcentaje >= 99.9 ? 'bg-success' : 
                  porcentaje > 0 ? 'bg-info' : 'bg-warning'
                }`}
                style={{ width: `${porcentaje}%` }}
              ></div>
            </div>
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
      header: 'Prioridad',
      accessor: 'prioridad',
      width: '100px',
      align: 'center',
      render: (value) => {
        const config = getPrioridadConfig(value);
        return (
          <span className={`badge ${config.clase}`}>
            {value}
          </span>
        );
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
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/ventas/ordenes/${value}`);
            }}
            title="Ver detalle"
          >
            <Eye size={14} />
          </button>
          
          <button
            className="btn btn-sm btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/ventas/ordenes/${value}/editar`);
            }}
            title="Editar orden"
            disabled={row.estado_verificacion === 'Pendiente'}
          >
            <Edit size={14} />
          </button>

          <button
            className="btn btn-sm btn-outline"
            onClick={(e) => {
              e.stopPropagation();
              handleDescargarPDF(value, row.numero_orden, row.cliente);
            }}
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

  if (loading) return <Loading message="Cargando órdenes de venta..." />;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
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

      {estadisticas && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-label">Total Órdenes</p>
              <p className="stat-value">{estadisticas.total_ordenes || 0}</p>
              <p className="stat-sublabel">{estadisticas.clientes_unicos || 0} clientes</p>
            </div>
            <div className="stat-icon">
              <ShoppingCart size={24} />
            </div>
          </div>

          <div className="stat-card border-l-4 border-warning">
            <div className="stat-content">
              <p className="stat-label">En Espera</p>
              <p className="stat-value text-warning">{estadisticas.en_espera || 0}</p>
              <p className="stat-sublabel">Por producir</p>
            </div>
            <div className="stat-icon">
              <Clock size={24} className="text-warning" />
            </div>
          </div>

          <div className="stat-card border-l-4 border-info">
            <div className="stat-content">
              <p className="stat-label">En Proceso</p>
              <p className="stat-value text-info">{estadisticas.en_proceso || 0}</p>
              {estadisticas.urgentes > 0 && (
                <p className="text-xs text-danger flex items-center gap-1 font-bold mt-1">
                  <AlertTriangle size={12} />
                  {estadisticas.urgentes} urgentes
                </p>
              )}
            </div>
            <div className="stat-icon">
              <PlayCircle size={24} className="text-info" />
            </div>
          </div>

          <div className="stat-card border-l-4 border-orange-400">
            <div className="stat-content">
              <p className="stat-label">Desp. Parcial</p>
              <p className="stat-value text-orange-600">{estadisticas.despacho_parcial || 0}</p>
              <p className="stat-sublabel">Pendientes</p>
            </div>
            <div className="stat-icon">
              <Truck size={24} className="text-orange-600" />
            </div>
          </div>

          <div className="stat-card border-l-4 border-success">
            <div className="stat-content">
              <p className="stat-label">Monto Total</p>
              <p className="stat-value text-success">
                {formatearMoneda(estadisticas.monto_total || 0, 'PEN')}
              </p>
              <p className="stat-sublabel">{estadisticas.entregadas || 0} entregadas</p>
            </div>
            <div className="stat-icon">
              <TrendingUp size={24} className="text-success" />
            </div>
          </div>
        </div>
      )}

      <div className="card mb-4 shadow-sm">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            
            <div className="search-input-wrapper flex-1">
              <Search 
                size={20} 
                className="search-icon" 
              />
              <input
                type="text"
                className="form-input search-input"
                placeholder="Buscar por N°, cliente, RUC..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              <Filter size={20} className="text-muted shrink-0" />
              
              <div className="flex gap-2">
                <button
                  className={`btn btn-sm ${!filtroVerificacion ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFiltroVerificacion('')}
                >
                  Todas
                </button>
                <button
                  className={`btn btn-sm ${filtroVerificacion === 'Pendiente' ? 'btn-warning' : 'btn-outline'}`}
                  onClick={() => setFiltroVerificacion('Pendiente')}
                >
                  <Clock size={14} />
                  Pendientes
                </button>
                <button
                  className={`btn btn-sm ${filtroVerificacion === 'Rechazada' ? 'btn-danger' : 'btn-outline'}`}
                  onClick={() => setFiltroVerificacion('Rechazada')}
                >
                  <XCircle size={14} />
                  Rechazadas
                </button>
              </div>

              <div className="border-l h-6 mx-2 hidden md:block"></div>

              <div className="flex gap-2">
                <button
                  className={`btn btn-sm ${!filtroEstado ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado('')}
                >
                  Todos
                </button>
                <button
                  className={`btn btn-sm ${filtroEstado === 'En Espera' ? 'btn-warning' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado('En Espera')}
                >
                  <Clock size={14} />
                  En Espera
                </button>
                <button
                  className={`btn btn-sm ${filtroEstado === 'En Proceso' ? 'btn-info' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado('En Proceso')}
                >
                  <PlayCircle size={14} />
                  En Proceso
                </button>
                <button
                  className={`btn btn-sm ${filtroEstado === 'Atendido por Producción' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado('Atendido por Producción')}
                >
                  <Factory size={14} />
                  Atendido
                </button>
                <button
                  className={`btn btn-sm ${filtroEstado === 'Despacho Parcial' ? 'btn-warning' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado('Despacho Parcial')}
                >
                  <Truck size={14} />
                  Desp. Parcial
                </button>
                <button
                  className={`btn btn-sm ${filtroEstado === 'Despachada' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado('Despachada')}
                >
                  <Truck size={14} />
                  Despachada
                </button>
                <button
                  className={`btn btn-sm ${filtroEstado === 'Entregada' ? 'btn-success' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado('Entregada')}
                >
                  <CheckCircle size={14} />
                  Entregada
                </button>
              </div>

              <div className="border-l h-6 mx-2 hidden md:block"></div>

              <div className="flex gap-2">
                <button
                  className={`btn btn-sm ${filtroPrioridad === 'Urgente' ? 'btn-danger' : 'btn-outline'}`}
                  onClick={() => setFiltroPrioridad(filtroPrioridad === 'Urgente' ? '' : 'Urgente')}
                >
                  Urgente
                </button>
                <button
                  className={`btn btn-sm ${filtroPrioridad === 'Alta' ? 'btn-warning' : 'btn-outline'}`}
                  onClick={() => setFiltroPrioridad(filtroPrioridad === 'Alta' ? '' : 'Alta')}
                >
                  Alta
                </button>
              </div>

              <div className="border-l h-6 mx-2 hidden md:block"></div>

              <div className="flex gap-2">
                <button
                  className={`btn btn-sm ${filtroEstadoPago === 'Pendiente' ? 'btn-warning' : 'btn-outline'}`}
                  onClick={() => setFiltroEstadoPago(filtroEstadoPago === 'Pendiente' ? '' : 'Pendiente')}
                >
                  <DollarSign size={14} />
                  Sin Pagar
                </button>
                <button
                  className={`btn btn-sm ${filtroEstadoPago === 'Parcial' ? 'btn-info' : 'btn-outline'}`}
                  onClick={() => setFiltroEstadoPago(filtroEstadoPago === 'Parcial' ? '' : 'Parcial')}
                >
                  <CreditCard size={14} />
                  Pago Parcial
                </button>
                <button
                  className={`btn btn-sm ${filtroEstadoPago === 'Pagado' ? 'btn-success' : 'btn-outline'}`}
                  onClick={() => setFiltroEstadoPago(filtroEstadoPago === 'Pagado' ? '' : 'Pagado')}
                >
                  <CheckCircle size={14} />
                  Pagado
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
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
        
        <div className="card-body p-0">
          <div className="table-container">
            <Table
              columns={columns}
              data={currentItems}
              emptyMessage="No hay órdenes de venta registradas"
              onRowClick={(row) => navigate(`/ventas/ordenes/${row.id_orden_venta}`)}
            />
          </div>
        </div>

        {ordenesFiltradas.length > itemsPerPage && (
          <div className="card-footer flex-wrap gap-2">
            <button 
                className="btn btn-sm btn-outline flex items-center gap-1"
                onClick={goToPrevPage}
                disabled={currentPage === 1}
            >
                <ChevronLeft size={16} /> <span className="hidden sm:inline">Anterior</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                Página {currentPage} de {totalPages}
              </span>
            </div>

            <button 
                className="btn btn-sm btn-outline flex items-center gap-1"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
            >
                <span className="hidden sm:inline">Siguiente</span> <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrdenesVenta;