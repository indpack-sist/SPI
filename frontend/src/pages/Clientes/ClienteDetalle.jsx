import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ShoppingCart, Eye, Download, Building2 } from 'lucide-react';
import { clientesAPI, cotizacionesAPI, ordenesVentaAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [cliente, setCliente] = useState(null);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [ordenesVenta, setOrdenesVenta] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabActiva, setTabActiva] = useState('cotizaciones');

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [clienteRes, cotizacionesRes, ordenesRes] = await Promise.all([
        clientesAPI.getById(id),
        clientesAPI.getHistorialCotizaciones(id),
        clientesAPI.getHistorialOrdenesVenta(id)
      ]);
      
      setCliente(clienteRes.data.data);
      setCotizaciones(cotizacionesRes.data.data);
      setOrdenesVenta(ordenesRes.data.data);
    } catch (err) {
      setError(err.error || 'Error al cargar datos del cliente');
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE');
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(valor || 0);
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      'Pendiente': 'badge-warning',
      'Enviada': 'badge-info',
      'Aprobada': 'badge-success',
      'Rechazada': 'badge-danger',
      'Convertida': 'badge-primary',
      'Vencida': 'badge-secondary',
      'Confirmada': 'badge-success',
      'En Preparación': 'badge-warning',
      'Despachada': 'badge-info',
      'Entregada': 'badge-success',
      'Cancelada': 'badge-danger'
    };
    return badges[estado] || 'badge-secondary';
  };

  const columnsCotizaciones = [
    {
      header: 'N° Cotización',
      accessor: 'numero_cotizacion',
      width: '140px',
      render: (value) => <span className="font-mono font-bold">{value}</span>
    },
    {
      header: 'Fecha',
      accessor: 'fecha_emision',
      width: '110px',
      render: (value) => formatearFecha(value)
    },
    {
      header: 'Vencimiento',
      accessor: 'fecha_vencimiento',
      width: '110px',
      render: (value) => formatearFecha(value)
    },
    {
      header: 'Total',
      accessor: 'total',
      width: '120px',
      align: 'right',
      render: (value, row) => (
        <span className="font-bold">{formatearMoneda(value)}</span>
      )
    },
    {
      header: 'Items',
      accessor: 'total_items',
      width: '80px',
      align: 'center'
    },
    {
      header: 'Estado',
      accessor: 'estado',
      width: '120px',
      align: 'center',
      render: (value) => (
        <span className={`badge ${getEstadoBadge(value)}`}>{value}</span>
      )
    },
    {
      header: 'Comercial',
      accessor: 'comercial',
      width: '150px'
    },
    {
      header: 'Acciones',
      accessor: 'id_cotizacion',
      width: '100px',
      align: 'center',
      render: (value) => (
        <div className="flex gap-2 justify-center">
          <button
            className="btn btn-sm btn-primary"
            onClick={() => navigate(`/ventas/cotizaciones/${value}`)}
            title="Ver detalle"
          >
            <Eye size={14} />
          </button>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => cotizacionesAPI.descargarPDF(value)}
            title="Descargar PDF"
          >
            <Download size={14} />
          </button>
        </div>
      )
    }
  ];

  const columnsOrdenes = [
    {
      header: 'N° Orden',
      accessor: 'numero_orden',
      width: '140px',
      render: (value) => <span className="font-mono font-bold">{value}</span>
    },
    {
      header: 'Fecha',
      accessor: 'fecha_emision',
      width: '110px',
      render: (value) => formatearFecha(value)
    },
    {
      header: 'Entrega Est.',
      accessor: 'fecha_entrega_estimada',
      width: '110px',
      render: (value) => formatearFecha(value)
    },
    {
      header: 'Total',
      accessor: 'total',
      width: '120px',
      align: 'right',
      render: (value) => (
        <span className="font-bold">{formatearMoneda(value)}</span>
      )
    },
    {
      header: 'Items',
      accessor: 'total_items',
      width: '80px',
      align: 'center'
    },
    {
      header: 'Estado',
      accessor: 'estado',
      width: '130px',
      align: 'center',
      render: (value) => (
        <span className={`badge ${getEstadoBadge(value)}`}>{value}</span>
      )
    },
    {
      header: 'O.C. Cliente',
      accessor: 'orden_compra_cliente',
      width: '130px'
    },
    {
      header: 'Acciones',
      accessor: 'id_orden_venta',
      width: '100px',
      align: 'center',
      render: (value) => (
        <div className="flex gap-2 justify-center">
          <button
            className="btn btn-sm btn-primary"
            onClick={() => navigate(`/ventas/ordenes/${value}`)}
            title="Ver detalle"
          >
            <Eye size={14} />
          </button>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => ordenesVentaAPI.descargarPDF(value)}
            title="Descargar PDF"
          >
            <Download size={14} />
          </button>
        </div>
      )
    }
  ];

  if (loading) {
    return <Loading message="Cargando información del cliente..." />;
  }

  if (!cliente) {
    return (
      <div>
        <Alert type="error" message="Cliente no encontrado" />
        <button className="btn btn-outline mt-3" onClick={() => navigate('/clientes')}>
          <ArrowLeft size={18} />
          Volver a Clientes
        </button>
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-outline mb-4" onClick={() => navigate('/clientes')}>
        <ArrowLeft size={20} />
        Volver a Clientes
      </button>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <div className="card mb-4">
        <div className="card-header flex items-center gap-2">
          <Building2 size={20} className="text-primary" />
          <h2 className="card-title">Información del Cliente</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted uppercase font-semibold">RUC</p>
              <p className="font-mono font-bold text-lg">{cliente.ruc}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted uppercase font-semibold">Razón Social</p>
              <p className="font-bold text-lg">{cliente.razon_social}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Contacto</p>
              <p>{cliente.contacto || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Teléfono</p>
              <p>{cliente.telefono || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Email</p>
              <p>{cliente.email || '-'}</p>
            </div>
            <div className="col-span-3">
              <p className="text-xs text-muted uppercase font-semibold">Dirección de Despacho</p>
              <p>{cliente.direccion_despacho || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Estado</p>
              <span className={`badge ${cliente.estado === 'Activo' ? 'badge-success' : 'badge-secondary'}`}>
                {cliente.estado}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="stats-grid mb-4">
        <div className="stat-card">
          <div className="stat-icon">
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Cotizaciones</p>
            <h2 className="stat-value">{cotizaciones.length}</h2>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <ShoppingCart size={24} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Órdenes de Venta</p>
            <h2 className="stat-value">{ordenesVenta.length}</h2>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Total Cotizado</p>
            <h2 className="stat-value text-lg">
              {formatearMoneda(cotizaciones.reduce((sum, c) => sum + parseFloat(c.total || 0), 0))}
            </h2>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <ShoppingCart size={24} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Total Facturado</p>
            <h2 className="stat-value text-lg">
              {formatearMoneda(ordenesVenta.reduce((sum, o) => sum + parseFloat(o.total || 0), 0))}
            </h2>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          <button
            className={`tab ${tabActiva === 'cotizaciones' ? 'active' : ''}`}
            onClick={() => setTabActiva('cotizaciones')}
          >
            <FileText size={18} />
            Cotizaciones ({cotizaciones.length})
          </button>
          <button
            className={`tab ${tabActiva === 'ordenes' ? 'active' : ''}`}
            onClick={() => setTabActiva('ordenes')}
          >
            <ShoppingCart size={18} />
            Órdenes de Venta ({ordenesVenta.length})
          </button>
        </div>

        <div className="tab-content">
          {tabActiva === 'cotizaciones' && (
            <Table
              columns={columnsCotizaciones}
              data={cotizaciones}
              emptyMessage="No hay cotizaciones registradas para este cliente"
            />
          )}

          {tabActiva === 'ordenes' && (
            <Table
              columns={columnsOrdenes}
              data={ordenesVenta}
              emptyMessage="No hay órdenes de venta registradas para este cliente"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ClienteDetalle;