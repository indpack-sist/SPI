// frontend/src/pages/Ventas/OrdenesVenta.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Eye, ShoppingCart, Filter, TrendingUp, Clock,
  Package, Truck, CheckCircle, XCircle, AlertTriangle
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
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');

  useEffect(() => {
    cargarDatos();
  }, [filtroEstado, filtroPrioridad]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // ✅ Cargar órdenes con filtros
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

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatearMoneda = (valor, moneda) => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor).toFixed(2)}`;
  };

  const getEstadoConfig = (estado) => {
    const configs = {
      'Pendiente': { 
        icono: Clock, 
        clase: 'badge-warning',
        texto: 'Pendiente'
      },
      'En Proceso': { 
        icono: Package, 
        clase: 'badge-info',
        texto: 'En Proceso'
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
    return configs[estado] || configs['Pendiente'];
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

  const columns = [
    {
      header: 'N° Orden',
      accessor: 'numero_orden',
      width: '140px',
      render: (value, row) => (
        <div>
          <span className="font-mono font-bold">{value}</span>
          {row.numero_cotizacion && (
            <div className="text-xs text-muted">De: {row.numero_cotizacion}</div>
          )}
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
      header: 'Items',
      accessor: 'total_items',
      width: '80px',
      align: 'center',
      render: (value) => (
        <span className="badge badge-outline">{value || 0}</span>
      )
    },
    {
      header: 'Total',
      accessor: 'total',
      align: 'right',
      width: '120px',
      render: (value, row) => (
        <span className="font-bold">{formatearMoneda(value, row.moneda)}</span>
      )
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
      width: '100px',
      align: 'center',
      render: (value) => (
        <button
          className="btn btn-sm btn-primary"
          onClick={() => navigate(`/ventas/ordenes/${value}`)}
          title="Ver detalle"
        >
          <Eye size={14} />
        </button>
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

      {/* Estadísticas */}
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
                  <p className="text-sm text-muted">Pendientes</p>
                  <h3 className="text-2xl font-bold text-warning">{estadisticas.pendientes || 0}</h3>
                  <p className="text-xs text-muted">Por iniciar</p>
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
                  <Package size={24} className="text-info" />
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

      {/* Filtros */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter size={20} className="text-muted" />
            <span className="font-medium">Filtrar por:</span>
            
            <div className="flex gap-2">
              <button
                className={`btn btn-sm ${!filtroEstado ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFiltroEstado('')}
              >
                Todos
              </button>
              <button
                className={`btn btn-sm ${filtroEstado === 'Pendiente' ? 'btn-warning' : 'btn-outline'}`}
                onClick={() => setFiltroEstado('Pendiente')}
              >
                <Clock size={14} />
                Pendiente
              </button>
              <button
                className={`btn btn-sm ${filtroEstado === 'En Proceso' ? 'btn-info' : 'btn-outline'}`}
                onClick={() => setFiltroEstado('En Proceso')}
              >
                <Package size={14} />
                En Proceso
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

            <span className="text-sm text-muted">Prioridad:</span>
            <div className="flex gap-2">
              <button
                className={`btn btn-sm ${!filtroPrioridad ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFiltroPrioridad('')}
              >
                Todas
              </button>
              <button
                className={`btn btn-sm ${filtroPrioridad === 'Urgente' ? 'btn-danger' : 'btn-outline'}`}
                onClick={() => setFiltroPrioridad('Urgente')}
              >
                Urgente
              </button>
              <button
                className={`btn btn-sm ${filtroPrioridad === 'Alta' ? 'btn-warning' : 'btn-outline'}`}
                onClick={() => setFiltroPrioridad('Alta')}
              >
                Alta
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            Lista de Órdenes de Venta
            <span className="badge badge-primary ml-2">{ordenes.length}</span>
          </h2>
        </div>
        <div className="card-body">
          <Table
            columns={columns}
            data={ordenes}
            emptyMessage="No hay órdenes de venta registradas"
          />
        </div>
      </div>
    </div>
  );
}

export default OrdenesVenta;