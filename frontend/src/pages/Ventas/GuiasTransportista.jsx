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
  Car,
  Search,
  // IMPORTES PARA PAGINACIÓN
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { guiasTransportistaAPI } from '../../config/api';

function GuiasTransportista() {
  const navigate = useNavigate();
  
  const [guias, setGuias] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados de filtros y paginación
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    cargarDatos();
  }, [filtroEstado]);

  // Resetear a página 1 cuando cambian los filtros o la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [filtroEstado, busqueda]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filtros = {};
      if (filtroEstado) {
        filtros.estado = filtroEstado;
      }
      
      const [guiasRes, statsRes] = await Promise.all([
        guiasTransportistaAPI.getAll(filtros),
        guiasTransportistaAPI.getEstadisticas()
      ]);
      
      if (guiasRes.data.success) {
        setGuias(guiasRes.data.data || []);
      }
      
      if (statsRes.data.success) {
        setEstadisticas(statsRes.data.data || null);
      }
      
    } catch (err) {
      console.error('Error al cargar guías de transportista:', err);
      setError(err.response?.data?.error || 'Error al cargar guías de transportista');
    } finally {
      setLoading(false);
    }
  };

  // 1. LÓGICA DE FILTRADO (Texto)
  const guiasFiltradas = guias.filter(guia => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return (
      guia.numero_guia?.toLowerCase().includes(term) ||
      guia.numero_guia_remision?.toLowerCase().includes(term) ||
      guia.razon_social_transportista?.toLowerCase().includes(term) ||
      guia.nombre_conductor?.toLowerCase().includes(term) ||
      guia.placa_vehiculo?.toLowerCase().includes(term)
    );
  });

  // 2. LÓGICA DE PAGINACIÓN
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = guiasFiltradas.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(guiasFiltradas.length / itemsPerPage);

  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

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
            {parseFloat(row.peso_bruto_kg || 0).toFixed(0)} kg
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
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Total Guías</p>
                  <h3 className="text-2xl font-bold">{estadisticas.total_guias || 0}</h3>
                  <p className="text-xs text-muted">
                    {estadisticas.transportistas_unicos || 0} transportistas
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Truck size={24} className="text-primary" />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-info">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">En Tránsito</p>
                  <h3 className="text-2xl font-bold text-info">{estadisticas.activas || 0}</h3>
                  <p className="text-xs text-muted">Activas</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Truck size={24} className="text-info" />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-warning">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Conductores</p>
                  <h3 className="text-2xl font-bold text-warning">
                    {estadisticas.conductores_unicos || 0}
                  </h3>
                  <p className="text-xs text-muted">Registrados</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Users size={24} className="text-warning" />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-success">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Vehículos</p>
                  <h3 className="text-2xl font-bold text-success">
                    {estadisticas.vehiculos_unicos || 0}
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

      {/* Filtros y Búsqueda */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            
            {/* Buscador */}
            <div className="relative w-full md:w-96">
              <Search 
                size={20} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
              />
              <input
                type="text"
                className="form-input pl-10 w-full"
                placeholder="Buscar por N°, transportista, conductor..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            {/* Filtros de Estado */}
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              <Filter size={20} className="text-muted shrink-0" />
              <span className="font-medium shrink-0">Filtrar por estado:</span>
              
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
      </div>

      {/* Tabla con Paginación */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="card-title">
            Lista de Guías de Transportista
            <span className="badge badge-primary ml-2">{guiasFiltradas.length}</span>
          </h2>
          <div className="text-sm text-muted">
             Mostrando {currentItems.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, guiasFiltradas.length)} de {guiasFiltradas.length}
          </div>
        </div>
        
        <div className="card-body">
          <Table
            columns={columns}
            data={currentItems}
            emptyMessage="No hay guías de transportista registradas"
          />
        </div>

        {/* Footer de Paginación */}
        {guiasFiltradas.length > itemsPerPage && (
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

export default GuiasTransportista;