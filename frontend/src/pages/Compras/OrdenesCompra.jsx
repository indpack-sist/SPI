import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Eye, ShoppingCart, Filter, Clock, CheckCircle,
  XCircle, Truck, Package, TrendingUp
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { ordenesCompraAPI } from '../../config/api';

function OrdenesCompra() {
  const navigate = useNavigate();
  
  const [ordenes, setOrdenes] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('');

  useEffect(() => {
    cargarDatos();
  }, [filtroEstado]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filtros = {};
      if (filtroEstado) {
        filtros.estado = filtroEstado;
      }
      
      const [ordenesRes, statsRes] = await Promise.all([
        ordenesCompraAPI.getAll(filtros),
        ordenesCompraAPI.getEstadisticas()
      ]);
      
      if (ordenesRes.data.success) {
        setOrdenes(ordenesRes.data.data || []);
      }
      
      if (statsRes.data.success) {
        setEstadisticas(statsRes.data.data || null);
      }
      
    } catch (err) {
      console.error('Error al cargar órdenes de compra:', err);
      setError(err.response?.data?.error || 'Error al cargar órdenes de compra');
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
      'Confirmada': { 
        icono: CheckCircle, 
        clase: 'badge-info',
        texto: 'Confirmada'
      },
      'En Tránsito': { 
        icono: Truck, 
        clase: 'badge-primary',
        texto: 'En Tránsito'
      },
      'Recibida': { 
        icono: Package, 
        clase: 'badge-success',
        texto: 'Recibida'
      },
      'Cancelada': { 
        icono: XCircle, 
        clase: 'badge-danger',
        texto: 'Cancelada'
      }
    };
    return configs[estado] || configs['Pendiente'];
  };

  const columns = [
    {
      header: 'N° Orden',
      accessor: 'numero_orden',
      width: '140px',
      render: (value, row) => (
        <div>
          <span className="font-mono font-bold text-sm">{value}</span>
          <div className="text-xs text-muted">
            {formatearFecha(row.fecha_pedido)}
          </div>
        </div>
      )
    },
    {
      header: 'Proveedor',
      accessor: 'proveedor',
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted">RUC: {row.ruc_proveedor}</div>
        </div>
      )
    },
    {
      header: 'Fechas',
      accessor: 'fecha_confirmacion',
      width: '140px',
      render: (value, row) => (
        <div className="text-sm">
          {value ? (
            <>
              <div className="text-success">✓ Conf: {formatearFecha(value)}</div>
              <div className="text-muted">Entrega: {formatearFecha(row.entrega_esperada)}</div>
            </>
          ) : (
            <div className="text-warning">Pendiente confirmación</div>
          )}
        </div>
      )
    },
    {
      header: 'Items',
      accessor: 'total_items',
      width: '80px',
      align: 'center',
      render: (value) => (
        <span className="badge badge-primary">{value || 0}</span>
      )
    },
    {
      header: 'Total',
      accessor: 'total',
      width: '120px',
      align: 'right',
      render: (value, row) => (
        <span className="font-bold text-primary">
          {formatearMoneda(value, row.moneda)}
        </span>
      )
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
      accessor: 'id_orden_compra',
      width: '100px',
      align: 'center',
      render: (value) => (
        <button
          className="btn btn-sm btn-primary"
          onClick={() => navigate(`/compras/ordenes/${value}`)}
          title="Ver detalle"
        >
          <Eye size={14} />
        </button>
      )
    }
  ];

  if (loading) return <Loading message="Cargando órdenes de compra..." />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart size={32} />
            Órdenes de Compra
          </h1>
          <p className="text-muted">Gestión de compras a proveedores</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => navigate('/compras/ordenes/nueva')}
        >
          <Plus size={20} />
          Nueva Orden de Compra
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {estadisticas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Total Órdenes</p>
                  <h3 className="text-2xl font-bold">{estadisticas.total_ordenes || 0}</h3>
                  <p className="text-xs text-muted">
                    {estadisticas.proveedores_unicos || 0} proveedores
                  </p>
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
                  <p className="text-xs text-muted">Sin confirmar</p>
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
                  <p className="text-sm text-muted">Confirmadas</p>
                  <h3 className="text-2xl font-bold text-info">{estadisticas.confirmadas || 0}</h3>
                  <p className="text-xs text-muted">En proceso</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <CheckCircle size={24} className="text-info" />
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
                  <p className="text-xs text-muted">{estadisticas.recibidas || 0} recibidas</p>
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
          <div className="flex items-center gap-3 flex-wrap">
            <Filter size={20} className="text-muted" />
            <span className="font-medium">Filtrar por estado:</span>
            
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
                className={`btn btn-sm ${filtroEstado === 'Confirmada' ? 'btn-info' : 'btn-outline'}`}
                onClick={() => setFiltroEstado('Confirmada')}
              >
                <CheckCircle size={14} />
                Confirmada
              </button>
              <button
                className={`btn btn-sm ${filtroEstado === 'En Tránsito' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFiltroEstado('En Tránsito')}
              >
                <Truck size={14} />
                En Tránsito
              </button>
              <button
                className={`btn btn-sm ${filtroEstado === 'Recibida' ? 'btn-success' : 'btn-outline'}`}
                onClick={() => setFiltroEstado('Recibida')}
              >
                <Package size={14} />
                Recibida
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            Lista de Órdenes de Compra
            <span className="badge badge-primary ml-2">{ordenes.length}</span>
          </h2>
        </div>
        <div className="card-body">
          <Table
            columns={columns}
            data={ordenes}
            emptyMessage="No hay órdenes de compra registradas"
          />
        </div>
      </div>
    </div>
  );
}

export default OrdenesCompra;