// frontend/src/pages/Ventas/OrdenesVenta.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Eye, 
  ShoppingCart, 
  Filter,
  TrendingUp,
  Clock,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

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
      
      // TODO: Reemplazar con API real
      // const [ordenesRes, statsRes] = await Promise.all([
      //   ordenesVentaAPI.getAll({ estado: filtroEstado, prioridad: filtroPrioridad }),
      //   ordenesVentaAPI.getEstadisticas()
      // ]);
      
      const mockOrdenes = [
        {
          id_orden_venta: 1,
          numero_orden: 'OV-2025-0001',
          fecha_emision: '2025-12-24',
          fecha_entrega_estimada: '2025-12-31',
          cliente: 'EMPRESA DEMO SAC',
          ruc_cliente: '20123456789',
          total: 5900.00,
          moneda: 'PEN',
          estado: 'Pendiente',
          prioridad: 'Alta',
          numero_cotizacion: 'C-2025-0001',
          total_items: 2
        },
        {
          id_orden_venta: 2,
          numero_orden: 'OV-2025-0002',
          fecha_emision: '2025-12-23',
          fecha_entrega_estimada: '2025-12-30',
          cliente: 'CORPORACIÓN ABC EIRL',
          ruc_cliente: '20987654321',
          total: 8500.00,
          moneda: 'PEN',
          estado: 'En Proceso',
          prioridad: 'Media',
          numero_cotizacion: null,
          total_items: 5
        }
      ];
      
      const mockEstadisticas = {
        total_ordenes: 25,
        pendientes: 8,
        en_proceso: 10,
        despachadas: 4,
        entregadas: 2,
        canceladas: 1,
        monto_total: 125000.00,
        clientes_unicos: 15,
        urgentes: 3
      };
      
      setOrdenes(mockOrdenes);
      setEstadisticas(mockEstadisticas);
    } catch (err) {
      setError('Error al cargar órdenes de venta: ' + err.message);
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
        <span className="badge badge-outline">{value}</span>
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
      {/* Header */}
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
          {/* Total Órdenes */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Total Órdenes</p>
                  <h3 className="text-2xl font-bold">{estadisticas.total_ordenes}</h3>
                  <p className="text-xs text-muted">{estadisticas.clientes_unicos} clientes</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ShoppingCart size={24} className="text-primary" />
                </div>
              </div>
            </div>
          </div>

          {/* Pendientes */}
          <div className="card border-l-4 border-warning">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Pendientes</p>
                  <h3 className="text-2xl font-bold text-warning">{estadisticas.pendientes}</h3>
                  <p className="text-xs text-muted">Por iniciar</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock size={24} className="text-warning" />
                </div>
              </div>
            </div>
          </div>

          {/* En Proceso */}
          <div className="card border-l-4 border-info">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">En Proceso</p>
                  <h3 className="text-2xl font-bold text-info">{estadisticas.en_proceso}</h3>
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

          {/* Monto Total */}
          <div className="card border-l-4 border-success">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Monto Total</p>
                  <h3 className="text-2xl font-bold text-success">
                    {formatearMoneda(estadisticas.monto_total, 'PEN')}
                  </h3>
                  <p className="text-xs text-muted">{estadisticas.entregadas} entregadas</p>
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
            
            {/* Filtro Estado */}
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

            {/* Filtro Prioridad */}
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