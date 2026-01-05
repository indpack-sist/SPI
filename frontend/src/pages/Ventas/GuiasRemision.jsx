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
  TrendingUp,
  Search,
  // IMPORTES PARA PAGINACIÓN
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { guiasRemisionAPI } from '../../config/api';

function GuiasRemision() {
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

  // Resetear a página 1 cuando cambian los filtros o búsqueda
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
        guiasRemisionAPI.getAll(filtros),
        guiasRemisionAPI.getEstadisticas()
      ]);
      
      if (guiasRes.data.success) {
        setGuias(guiasRes.data.data || []);
      }
      
      if (statsRes.data.success) {
        setEstadisticas(statsRes.data.data || null);
      }
      
    } catch (err) {
      console.error('Error al cargar guías de remisión:', err);
      setError(err.response?.data?.error || 'Error al cargar guías de remisión');
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
      guia.cliente?.toLowerCase().includes(term) ||
      guia.ruc_cliente?.toLowerCase().includes(term) ||
      guia.numero_orden?.toLowerCase().includes(term)
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
      'Emitida': { 
        icono: FileText, 
        clase: 'badge-info',
        texto: 'Emitida'
      },
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
      },
      'Anulada': { 
        icono: XCircle, 
        clase: 'badge-danger',
        texto: 'Anulada'
      }
    };
    return configs[estado] || configs['Emitida'];
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
          <div className="font-bold">{value || 0} items</div>
          <div className="text-xs text-muted">{row.numero_bultos || 0} bultos</div>
        </div>
      )
    },
    {
      header: 'Peso (kg)',
      accessor: 'peso_bruto_kg',
      width: '100px',
      align: 'right',
      render: (value) => (
        <span className="font-medium">{parseFloat(value || 0).toFixed(2)}</span>
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
      accessor: 'id_guia',
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
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Total Guías</p>
                  <h3 className="text-2xl font-bold">{estadisticas.total_guias || 0}</h3>
                  <p className="text-xs text-muted">{estadisticas.ordenes_relacionadas || 0} órdenes</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText size={24} className="text-primary" />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-warning">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Emitidas</p>
                  <h3 className="text-2xl font-bold text-warning">{estadisticas.emitidas || 0}</h3>
                  <p className="text-xs text-muted">Por despachar</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <FileText size={24} className="text-warning" />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-info">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">En Tránsito</p>
                  <h3 className="text-2xl font-bold text-info">{estadisticas.en_transito || 0}</h3>
                  <p className="text-xs text-muted">{estadisticas.bultos_total || 0} bultos</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Truck size={24} className="text-info" />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-success">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Peso Total</p>
                  <h3 className="text-2xl font-bold text-success">
                    {parseFloat(estadisticas.peso_total || 0).toFixed(2)}
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
                placeholder="Buscar por N° Guía, cliente, RUC..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            {/* Filtros de Estado */}
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              <Filter size={20} className="text-muted shrink-0" />
              <div className="flex gap-2">
                <button
                  className={`btn btn-sm ${!filtroEstado ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado('')}
                >
                  Todos
                </button>
                <button
                  className={`btn btn-sm ${filtroEstado === 'Emitida' ? 'btn-info' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado('Emitida')}
                >
                  <FileText size={14} />
                  Emitida
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
      </div>

      {/* Tabla con Paginación */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="card-title">
            Lista de Guías de Remisión
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
            emptyMessage="No hay guías de remisión registradas"
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

export default GuiasRemision;