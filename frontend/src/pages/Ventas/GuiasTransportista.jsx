import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Eye, Truck, Filter, CheckCircle, XCircle, Clock,
  Users, Car, Search, ChevronLeft, ChevronRight, RefreshCw,
  MapPin, FileText
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    cargarDatos();
  }, [filtroEstado]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroEstado, busqueda]);

  const cargarDatos = async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);
      setRefreshing(silencioso);
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
      setRefreshing(false);
    }
  };

  const guiasFiltradas = guias.filter(guia => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return (
      guia.numero_guia?.toLowerCase().includes(term) ||
      guia.numero_guia_remision?.toLowerCase().includes(term) ||
      guia.razon_social_transportista?.toLowerCase().includes(term) ||
      guia.nombre_conductor?.toLowerCase().includes(term) ||
      guia.placa_vehiculo?.toLowerCase().includes(term) ||
      guia.cliente?.toLowerCase().includes(term)
    );
  });

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
      'Pendiente': { 
        icono: Clock, 
        clase: 'badge-warning',
        color: 'border-warning'
      },
      'En Tránsito': { 
        icono: Truck, 
        clase: 'badge-info',
        color: 'border-info'
      },
      'Entregada': { 
        icono: CheckCircle, 
        clase: 'badge-success',
        color: 'border-success'
      },
      'Cancelada': { 
        icono: XCircle, 
        clase: 'badge-danger',
        color: 'border-danger'
      }
    };
    return configs[estado] || configs['Pendiente'];
  };

  const columns = [
    {
      header: 'N° Guía',
      accessor: 'numero_guia',
      width: '160px',
      render: (value, row) => (
        <div>
          <span className="font-mono font-bold text-primary">{value}</span>
          <div className="text-xs text-muted">
            GR: {row.numero_guia_remision}
          </div>
        </div>
      )
    },
    {
      header: 'Fecha',
      accessor: 'fecha_emision',
      width: '110px',
      render: (value) => (
        <div className="font-medium">{formatearFecha(value)}</div>
      )
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
      width: '180px',
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
          <div className="font-bold font-mono text-lg">{value}</div>
          {row.marca_vehiculo && (
            <div className="text-xs text-muted">{row.marca_vehiculo}</div>
          )}
        </div>
      )
    },
    {
      header: 'Destino',
      accessor: 'punto_llegada',
      width: '150px',
      render: (value, row) => (
        <div>
          <div className="font-medium text-sm">{value || row.ciudad_llegada || '-'}</div>
          {row.peso_bruto_kg && (
            <div className="text-xs text-muted">
              {parseFloat(row.peso_bruto_kg).toFixed(2)} kg
            </div>
          )}
        </div>
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
          <span className={`badge ${config.clase} flex items-center gap-1`}>
            <Icono size={14} />
            {value}
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
            <Truck size={32} className="text-primary" />
            Guías de Transportista
          </h1>
          <p className="text-muted">Gestión de transportes y conductores</p>
        </div>
        <div className="flex gap-2">
          <button 
            className="btn btn-outline"
            onClick={() => cargarDatos(true)}
            disabled={refreshing}
            title="Actualizar datos"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/ventas/guias-transportista/nueva')}
          >
            <Plus size={20} />
            Nueva Guía
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {estadisticas && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted uppercase font-semibold">Total Guías</p>
                  <p className="text-2xl font-bold">{estadisticas.total_guias || 0}</p>
                </div>
                <Truck size={32} className="text-muted opacity-20" />
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-warning">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted uppercase font-semibold">Pendientes</p>
                  <p className="text-2xl font-bold text-warning">{estadisticas.pendientes || 0}</p>
                </div>
                <Clock size={32} className="text-warning opacity-20" />
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-info">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted uppercase font-semibold">En Tránsito</p>
                  <p className="text-2xl font-bold text-info">{estadisticas.en_transito || 0}</p>
                </div>
                <Truck size={32} className="text-info opacity-20" />
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-success">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted uppercase font-semibold">Entregadas</p>
                  <p className="text-2xl font-bold text-success">{estadisticas.entregadas || 0}</p>
                </div>
                <CheckCircle size={32} className="text-success opacity-20" />
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-primary to-blue-600 text-white">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase font-semibold opacity-90">Vehículos</p>
                  <p className="text-2xl font-bold">{estadisticas.vehiculos_unicos || 0}</p>
                </div>
                <Car size={32} className="opacity-20" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            
            <div className="relative flex-1">
              <Search 
                size={20} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
              />
              <input
                type="text"
                className="form-input pl-10 w-full"
                placeholder="Buscar por N°, transportista, conductor, placa..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter size={18} className="text-muted shrink-0" />
              <div className="flex gap-2 flex-wrap">
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
                  Pendiente
                </button>
                <button
                  className={`btn btn-sm ${filtroEstado === 'En Tránsito' ? 'btn-info' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado('En Tránsito')}
                >
                  En Tránsito
                </button>
                <button
                  className={`btn btn-sm ${filtroEstado === 'Entregada' ? 'btn-success' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado('Entregada')}
                >
                  Entregada
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="card-title">
            Lista de Guías de Transportista
            {guiasFiltradas.length !== guias.length && (
              <span className="badge badge-info ml-2">
                {guiasFiltradas.length} de {guias.length}
              </span>
            )}
          </h2>
          <div className="text-sm text-muted">
            Mostrando {currentItems.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, guiasFiltradas.length)} de {guiasFiltradas.length}
          </div>
        </div>
        
        <div className="card-body p-0">
          <Table
            columns={columns}
            data={currentItems}
            emptyMessage="No hay guías de transportista registradas"
            onRowClick={(row) => navigate(`/ventas/guias-transportista/${row.id_guia_transportista}`)}
          />
        </div>

        {guiasFiltradas.length > itemsPerPage && (
          <div className="card-footer border-t border-border p-4 flex justify-between items-center bg-gray-50/50">
            <button 
              className="btn btn-sm btn-outline flex items-center gap-1"
              onClick={goToPrevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} /> Anterior
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
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GuiasTransportista;