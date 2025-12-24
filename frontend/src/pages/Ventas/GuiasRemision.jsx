// frontend/src/pages/Ventas/GuiasRemision.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Eye, 
  FileText, 
  Filter,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  TrendingUp
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function GuiasRemision() {
  const navigate = useNavigate();
  
  const [guias, setGuias] = useState([]);
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
      
      // TODO: Reemplazar con API real
      const mockGuias = [
        {
          id_guia_remision: 1,
          numero_guia: 'T001-2025-00000001',
          fecha_emision: '2025-12-24',
          fecha_inicio_traslado: '2025-12-25',
          cliente: 'EMPRESA DEMO SAC',
          ruc_cliente: '20123456789',
          numero_orden: 'OV-2025-0001',
          id_orden_venta: 1,
          tipo_traslado: 'Venta',
          modalidad_transporte: 'Privado',
          estado: 'Pendiente',
          direccion_llegada: 'Av. Principal 123, Lima',
          ciudad_llegada: 'Lima',
          peso_bruto_kg: 150.50,
          numero_bultos: 5,
          total_items: 2
        },
        {
          id_guia_remision: 2,
          numero_guia: 'T001-2025-00000002',
          fecha_emision: '2025-12-23',
          fecha_inicio_traslado: '2025-12-24',
          cliente: 'CORPORACIÓN ABC EIRL',
          ruc_cliente: '20987654321',
          numero_orden: 'OV-2025-0002',
          id_orden_venta: 2,
          tipo_traslado: 'Venta',
          modalidad_transporte: 'Público',
          estado: 'En Tránsito',
          direccion_llegada: 'Jr. Comercio 456, Lima',
          ciudad_llegada: 'Lima',
          peso_bruto_kg: 320.00,
          numero_bultos: 10,
          total_items: 5
        }
      ];
      
      const mockEstadisticas = {
        total_guias: 15,
        pendientes: 5,
        en_transito: 6,
        entregadas: 3,
        canceladas: 1,
        peso_total: 2500.50,
        bultos_total: 75,
        ordenes_relacionadas: 12,
        transporte_privado: 8,
        transporte_publico: 7
      };
      
      setGuias(mockGuias);
      setEstadisticas(mockEstadisticas);
    } catch (err) {
      setError('Error al cargar guías de remisión: ' + err.message);
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

  const getEstadoConfig = (estado) => {
    const configs = {
      'Pendiente': { 
        icono: Clock, 
        clase: 'badge-warning',
        texto: 'Pendiente'
      },
      'En Tránsito': { 
        icono: Truck, 
        clase: 'badge-info',
        texto: 'En Tránsito'
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

  const columns = [
    {
      header: 'N° Guía',
      accessor: 'numero_guia',
      width: '180px',
      render: (value, row) => (
        <div>
          <span className="font-mono font-bold text-sm">{value}</span>
          <div className="text-xs text-muted">
            Orden: {row.numero_orden}
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
          {row.fecha_inicio_traslado && (
            <div className="text-xs text-muted">
              Traslado: {formatearFecha(row.fecha_inicio_traslado)}
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
      header: 'Destino',
      accessor: 'ciudad_llegada',
      width: '120px',
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted">{row.tipo_traslado}</div>
        </div>
      )
    },
    {
      header: 'Transporte',
      accessor: 'modalidad_transporte',
      width: '100px',
      align: 'center',
      render: (value) => (
        <span className={`badge ${value === 'Privado' ? 'badge-primary' : 'badge-info'}`}>
          {value}
        </span>
      )
    },
    {
      header: 'Items / Bultos',
      accessor: 'total_items',
      width: '120px',
      align: 'center',
      render: (value, row) => (
        <div>
          <div className="font-bold">{value} items</div>
          <div className="text-xs text-muted">{row.numero_bultos} bultos</div>
        </div>
      )
    },
    {
      header: 'Peso (kg)',
      accessor: 'peso_bruto_kg',
      width: '100px',
      align: 'right',
      render: (value) => (
        <span className="font-medium">{parseFloat(value).toFixed(2)}</span>
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
      accessor: 'id_guia_remision',
      width: '100px',
      align: 'center',
      render: (value) => (
        <button
          className="btn btn-sm btn-primary"
          onClick={() => navigate(`/ventas/guias-remision/${value}`)}
          title="Ver detalle"
        >
          <Eye size={14} />
        </button>
      )
    }
  ];

  if (loading) return <Loading message="Cargando guías de remisión..." />;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText size={32} />
            Guías de Remisión
          </h1>
          <p className="text-muted">Gestión de despachos y traslados</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => navigate('/ventas/guias-remision/nueva')}
        >
          <Plus size={20} />
          Nueva Guía de Remisión
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Total Guías */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Total Guías</p>
                  <h3 className="text-2xl font-bold">{estadisticas.total_guias}</h3>
                  <p className="text-xs text-muted">{estadisticas.ordenes_relacionadas} órdenes</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText size={24} className="text-primary" />
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
                  <p className="text-xs text-muted">Por despachar</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock size={24} className="text-warning" />
                </div>
              </div>
            </div>
          </div>

          {/* En Tránsito */}
          <div className="card border-l-4 border-info">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">En Tránsito</p>
                  <h3 className="text-2xl font-bold text-info">{estadisticas.en_transito}</h3>
                  <p className="text-xs text-muted">{estadisticas.bultos_total} bultos</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Truck size={24} className="text-info" />
                </div>
              </div>
            </div>
          </div>

          {/* Peso Total */}
          <div className="card border-l-4 border-success">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Peso Total</p>
                  <h3 className="text-2xl font-bold text-success">
                    {parseFloat(estadisticas.peso_total).toFixed(2)}
                  </h3>
                  <p className="text-xs text-muted">kilogramos</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Package size={24} className="text-success" />
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
                className={`btn btn-sm ${filtroEstado === 'En Tránsito' ? 'btn-info' : 'btn-outline'}`}
                onClick={() => setFiltroEstado('En Tránsito')}
              >
                <Truck size={14} />
                En Tránsito
              </button>
              <button
                className={`btn btn-sm ${filtroEstado === 'Entregada' ? 'btn-success' : 'btn-outline'}`}
                onClick={() => setFiltroEstado('Entregada')}
              >
                <CheckCircle size={14} />
                Entregada
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            Lista de Guías de Remisión
            <span className="badge badge-primary ml-2">{guias.length}</span>
          </h2>
        </div>
        <div className="card-body">
          <Table
            columns={columns}
            data={guias}
            emptyMessage="No hay guías de remisión registradas"
          />
        </div>
      </div>
    </div>
  );
}

export default GuiasRemision;