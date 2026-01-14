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
  PlayCircle
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
  const [busqueda, setBusqueda] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    cargarDatos();
  }, [filtroEstado, filtroPrioridad]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroEstado, filtroPrioridad, filtroEstadoPago, busqueda]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filtros = {};
      if (filtroEstado) filtros.estado = filtroEstado;
      if (filtroPrioridad) filtros.prioridad = filtroPrioridad;
      
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
      console.error('Error al cargar órdenes de venta:', err);
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
      orden.serie_correlativo?.toLowerCase().includes(term) ||
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

  const handleDescargarPDF = async (idOrden, numeroOrden) => {
    try {
      setDescargandoPDF(idOrden);
      setError(null);
      
      await ordenesVentaAPI.descargarPDF(idOrden);
      
      setSuccess('PDF descargado exitosamente');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      setError(err.message || 'Error al descargar PDF');
    } finally {
      setDescargandoPDF(null);
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

  const formatearMoneda = (valor, moneda) => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
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
        icono: Package, 
        clase: 'badge-primary',
        texto: 'Atendido'
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
      header: 'Comprobante / Orden',
      accessor: 'numero_orden',
      width: '180px',
      render: (value, row) => (
        <div>
          <div className="flex items-center gap-1 mb-1">
            {row.tipo_comprobante ? (
              <>
                <span className={`badge badge-xs ${row.tipo_comprobante === 'Factura' ? 'badge-success' : 'badge-info'}`}>
                  {row.tipo_comprobante === 'Factura' ? 'FAC' : 'NV'}
                </span>
                <span className="font-mono font-bold text-sm">
                  {row.serie_correlativo || row.numero_comprobante || '-'}
                </span>
              </>
            ) : (
              <span className="badge badge-xs badge-secondary">Sin Emitir</span>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-xs text-muted">
              Ord: <span className="font-mono text-gray-700">{value}</span>
            </div>
            {row.numero_cotizacion && (
              <div className="text-[10px] text-muted">
                Ref: {row.numero_cotizacion}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      header: 'Fecha',
      accessor: 'fecha_emision',
      width: '110px',
      render: (value, row) => (
        <div>
          <div>{formatearFecha(value)}</div>
          {row.fecha_entrega_estimada && (
            <div className="text-xs text-muted">
              Entrega: {formatearFecha(row.fecha_entrega_estimada)}
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
        const total = parseFloat(value);
        const pagado = parseFloat(row.monto_pagado || 0);
        const porcentaje = total > 0 ? (pagado / total) * 100 : 0;
        
        return (
          <div>
            <div className="font-bold">{formatearMoneda(total, row.moneda)}</div>
            <div className="text-xs text-muted">
              Pagado: {formatearMoneda(pagado, row.moneda)}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div 
                className={`h-1.5 rounded-full ${
                  porcentaje === 100 ? 'bg-success' : 
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
            onClick={() => navigate(`/ventas/ordenes/${value}`)}
            title="Ver detalle"
          >
            <Eye size={14} />
          </button>
          
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => navigate(`/ventas/ordenes/${value}/editar`)}
            title="Editar orden"
            disabled={row.estado !== 'En Espera'}
          >
            <Edit size={14} />
          </button>

          <button
            className="btn btn-sm btn-outline"
            onClick={() => handleDescargarPDF(value, row.numero_orden)}
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart size={32} />
            Órdenes de Venta
          </h1>
          <p className="text-muted">Gestión de órdenes de venta y despachos</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => navigate('/ventas/ordenes/nueva')}
        >
          <Plus size={20} />
          Nueva Orden de Venta
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {estadisticas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Total Órdenes</p>
                  <h3 className="text-2xl font-bold">{estadisticas.total_ordenes || 0}</h3>
                  <p className="text-xs text-muted">{estadisticas.clientes_unicos || 0} clientes</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ShoppingCart size={24} className="text-primary" />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-warning">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">En Espera</p>
                  <h3 className="text-2xl font-bold text-warning">{estadisticas.en_espera || 0}</h3>
                  <p className="text-xs text-muted">Por producir</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock size={24} className="text-warning" />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-info">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">En Proceso</p>
                  <h3 className="text-2xl font-bold text-info">{estadisticas.en_proceso || 0}</h3>
                  {estadisticas.urgentes > 0 && (
                    <p className="text-xs text-danger flex items-center gap-1">
                      <AlertTriangle size={12} />
                      {estadisticas.urgentes} urgentes
                    </p>
                  )}
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <PlayCircle size={24} className="text-info" />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-success">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Monto Total</p>
                  <h3 className="text-2xl font-bold text-success">
                    {formatearMoneda(estadisticas.monto_total || 0, 'PEN')}
                  </h3>
                  <p className="text-xs text-muted">{estadisticas.entregadas || 0} entregadas</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp size={24} className="text-success" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="card-body">
          <div className="flex flex-col gap-4">
            
            <div className="relative w-full md:w-80">
              <Search 
                size={20} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
              />
              <input
                type="text"
                className="form-input pl-10 w-full"
                placeholder="Buscar por N°, cliente, RUC..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full overflow-x-auto pb-2">
              <Filter size={20} className="text-muted shrink-0" />
              
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
                  <Package size={14} />
                  Atendido
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

              <div className="border-l h-6 mx-2"></div>

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

              <div className="border-l h-6 mx-2"></div>

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

      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="card-title">
            Lista de Órdenes de Venta
            <span className="badge badge-primary ml-2">{ordenesFiltradas.length}</span>
          </h2>
          <div className="text-sm text-muted">
             Mostrando {currentItems.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, ordenesFiltradas.length)} de {ordenesFiltradas.length}
          </div>
        </div>
        
        <div className="card-body">
          <Table
            columns={columns}
            data={currentItems}
            emptyMessage="No hay órdenes de venta registradas"
          />
        </div>

        {ordenesFiltradas.length > itemsPerPage && (
          <div className="card-footer border-t border-border p-4 flex justify-between items-center bg-gray-50/50">
            <button 
                className="btn btn-sm btn-outline flex items-center gap-1"
                onClick={goToPrevPage}
                disabled={currentPage === 1}
            >
                <ChevronLeft size={16} /> Anterior
            </button>

            <span className="text-sm font-medium">
                Página {currentPage} de {totalPages}
            </span>

            <button 
                className="btn btn-sm btn-outline flex items-center gap-1"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
            >
                Siguiente <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrdenesVenta;