// frontend/src/pages/Ventas/GuiasTransportista.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Eye, 
  Truck, 
  Filter,
  CheckCircle,
  XCircle,
  TrendingUp,
  Users,
  Car
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function GuiasTransportista() {
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
      
      // TODO: API real
      const mockGuias = [
        {
          id_guia_transportista: 1,
          numero_guia: 'GT-2025-0001',
          fecha_emision: '2025-12-24',
          estado: 'Activa',
          numero_guia_remision: 'T001-2025-00000001',
          id_guia_remision: 1,
          numero_orden: 'OV-2025-0001',
          id_orden_venta: 1,
          cliente: 'EMPRESA DEMO SAC',
          ruc_cliente: '20123456789',
          razon_social_transportista: 'TRANSPORTES RÁPIDOS SAC',
          ruc_transportista: '20555666777',
          nombre_conductor: 'Carlos Rodríguez',
          licencia_conducir: 'Q12345678',
          placa_vehiculo: 'ABC-123',
          marca_vehiculo: 'Volvo',
          direccion_llegada: 'Av. Principal 123, Lima',
          ciudad_llegada: 'Lima',
          peso_bruto_kg: 103.00
        },
        {
          id_guia_transportista: 2,
          numero_guia: 'GT-2025-0002',
          fecha_emision: '2025-12-23',
          estado: 'Finalizada',
          numero_guia_remision: 'T001-2025-00000002',
          id_guia_remision: 2,
          numero_orden: 'OV-2025-0002',
          id_orden_venta: 2,
          cliente: 'CORPORACIÓN ABC EIRL',
          ruc_cliente: '20987654321',
          razon_social_transportista: 'LOGÍSTICA EXPRESS SAC',
          ruc_transportista: '20444555666',
          nombre_conductor: 'Juan Pérez',
          licencia_conducir: 'Q87654321',
          placa_vehiculo: 'XYZ-789',
          marca_vehiculo: 'Mercedes',
          direccion_llegada: 'Jr. Comercio 456, Lima',
          ciudad_llegada: 'Lima',
          peso_bruto_kg: 320.00
        }
      ];
      
      const mockEstadisticas = {
        total_guias: 25,
        activas: 8,
        finalizadas: 15,
        canceladas: 2,
        transportistas_unicos: 6,
        conductores_unicos: 12,
        vehiculos_unicos: 10
      };
      
      setGuias(mockGuias);
      setEstadisticas(mockEstadisticas);
    } catch (err) {
      setError('Error al cargar guías de transportista: ' + err.message);
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
      'Activa': { 
        icono: Truck, 
        clase: 'badge-info',
        texto: 'Activa'
      },
      'Finalizada': { 
        icono: CheckCircle, 
        clase: 'badge-success',
        texto: 'Finalizada'
      },
      'Cancelada': { 
        icono: XCircle, 
        clase: 'badge-danger',
        texto: 'Cancelada'
      }
    };
    return configs[estado] || configs['Activa'];
  };

  const columns = [
    {
      header: 'N° Guía',
      accessor: 'numero_guia',
      width: '140px',
      render: (value, row) => (
        <div>
          <span className="font-mono font-bold text-sm">{value}</span>
          <div className="text-xs text-muted">
            Remisión: {row.numero_guia_remision}
          </div>
        </div>
      )
    },
    {
      header: 'Fecha',
      accessor: 'fecha_emision',
      width: '110px',
      render: (value) => formatearFecha(value)
    },
    {
      header: 'Transportista',
      accessor: 'razon_social_transportista',
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted">RUC: {row.ruc_transportista}</div>
        </div>
      )
    },
    {
      header: 'Conductor',
      accessor: 'nombre_conductor',
      width: '150px',
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted">Lic: {row.licencia_conducir}</div>
        </div>
      )
    },
    {
      header: 'Vehículo',
      accessor: 'placa_vehiculo',
      width: '120px',
      render: (value, row) => (
        <div>
          <div className="font-bold font-mono">{value}</div>
          <div className="text-xs text-muted">{row.marca_vehiculo}</div>
        </div>
      )
    },
    {
      header: 'Destino',
      accessor: 'ciudad_llegada',
      width: '100px',
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted">
            {parseFloat(row.peso_bruto_kg).toFixed(0)} kg
          </div>
        </div>
      )
    },
    {
      header: 'Estado',
      accessor: 'estado',
      width: '120px',
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
      accessor: 'id_guia_transportista',
      width: '100px',
      align: 'center',
      render: (value) => (
        <button
          className="btn btn-sm btn-primary"
          onClick={() => navigate(`/ventas/guias-transportista/${value}`)}
          title="Ver detalle"
        >
          <Eye size={14} />
        </button>
      )
    }
  ];

  if (loading) return <Loading message="Cargando guías de transportista..." />;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck size={32} />
            Guías de Transportista
          </h1>
          <p className="text-muted">Gestión de transportes y conductores</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => navigate('/ventas/guias-transportista/nueva')}
        >
          <Plus size={20} />
          Nueva Guía de Transportista
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
                  <p className="text-xs text-muted">
                    {estadisticas.transportistas_unicos} transportistas
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Truck size={24} className="text-primary" />
                </div>
              </div>
            </div>
          </div>

          {/* Activas */}
          <div className="card border-l-4 border-info">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">En Tránsito</p>
                  <h3 className="text-2xl font-bold text-info">{estadisticas.activas}</h3>
                  <p className="text-xs text-muted">Activas</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Truck size={24} className="text-info" />
                </div>
              </div>
            </div>
          </div>

          {/* Conductores */}
          <div className="card border-l-4 border-warning">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Conductores</p>
                  <h3 className="text-2xl font-bold text-warning">
                    {estadisticas.conductores_unicos}
                  </h3>
                  <p className="text-xs text-muted">Registrados</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Users size={24} className="text-warning" />
                </div>
              </div>
            </div>
          </div>

          {/* Vehículos */}
          <div className="card border-l-4 border-success">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Vehículos</p>
                  <h3 className="text-2xl font-bold text-success">
                    {estadisticas.vehiculos_unicos}
                  </h3>
                  <p className="text-xs text-muted">Registrados</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Car size={24} className="text-success" />
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
                className={`btn btn-sm ${filtroEstado === 'Activa' ? 'btn-info' : 'btn-outline'}`}
                onClick={() => setFiltroEstado('Activa')}
              >
                <Truck size={14} />
                Activa
              </button>
              <button
                className={`btn btn-sm ${filtroEstado === 'Finalizada' ? 'btn-success' : 'btn-outline'}`}
                onClick={() => setFiltroEstado('Finalizada')}
              >
                <CheckCircle size={14} />
                Finalizada
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            Lista de Guías de Transportista
            <span className="badge badge-primary ml-2">{guias.length}</span>
          </h2>
        </div>
        <div className="card-body">
          <Table
            columns={columns}
            data={guias}
            emptyMessage="No hay guías de transportista registradas"
          />
        </div>
      </div>
    </div>
  );
}

export default GuiasTransportista;