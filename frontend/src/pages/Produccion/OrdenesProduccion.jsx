import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Eye, 
  Download, 
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  AlertCircle,
  Factory,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Calendar,
  Search,
  RefreshCw,
  ClipboardList, // <--- IMPORTANTE: Nuevo icono para recetas
  AlertTriangle  // <--- IMPORTANTE: Nuevo icono para alertas
} from 'lucide-react';
import { ordenesProduccionAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function OrdenesProduccion() {
  const navigate = useNavigate();
  
  // ... (MANTÉN TUS ESTADOS Y USEEFFECT IGUAL QUE ANTES) ...
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  useEffect(() => {
    cargarDatos();
  }, [filtroEstado, fechaInicio, fechaFin]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (filtroEstado) params.estado = filtroEstado;
      if (fechaInicio) params.fecha_inicio = fechaInicio;
      if (fechaFin) params.fecha_fin = fechaFin;
      
      const response = await ordenesProduccionAPI.getAll(params);
      setOrdenes(response.data.data || []);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError(err.error || 'Error al cargar órdenes de producción');
    } finally {
      setLoading(false);
    }
  };

  // ... (MANTÉN LA FUNCIÓN calcularEstadisticas IGUAL) ...
  const calcularEstadisticas = () => {
    const total = ordenes.length;
    const pendientes = ordenes.filter(o => o.estado === 'Pendiente').length;
    const enCurso = ordenes.filter(o => o.estado === 'En Curso').length;
    const finalizadas = ordenes.filter(o => o.estado === 'Finalizada').length;
    const canceladas = ordenes.filter(o => o.estado === 'Cancelada').length;
    
    const costoTotal = ordenes.reduce((sum, o) => sum + parseFloat(o.costo_materiales || 0), 0);
    const cantidadTotal = ordenes.reduce((sum, o) => sum + parseFloat(o.cantidad_planificada || 0), 0);
    const productosDiferentes = new Set(ordenes.map(o => o.id_producto_terminado)).size;
    
    return {
      total, pendientes, enCurso, finalizadas, canceladas,
      costoTotal, cantidadTotal, productosDiferentes,
      porcentajeCompletado: total > 0 ? ((finalizadas / total) * 100).toFixed(1) : 0
    };
  };

  // ... (MANTÉN ordenesFiltradas, formatearFecha, etc. IGUAL) ...
  const ordenesFiltradas = ordenes.filter(orden => {
    if (!busqueda) return true;
    const searchTerm = busqueda.toLowerCase();
    return (
      orden.numero_orden?.toLowerCase().includes(searchTerm) ||
      orden.producto?.toLowerCase().includes(searchTerm) ||
      orden.codigo_producto?.toLowerCase().includes(searchTerm) ||
      orden.supervisor?.toLowerCase().includes(searchTerm)
    );
  });

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(valor || 0);
  };

  const getEstadoConfig = (estado) => {
    const configs = {
      'Pendiente': { icono: Clock, color: 'text-warning', bg: 'badge-warning', texto: 'Pendiente' },
      'En Curso': { icono: Factory, color: 'text-primary', bg: 'badge-primary', texto: 'En Curso' },
      'En Pausa': { icono: Pause, color: 'text-info', bg: 'badge-info', texto: 'En Pausa' },
      'Finalizada': { icono: CheckCircle, color: 'text-success', bg: 'badge-success', texto: 'Finalizada' },
      'Cancelada': { icono: XCircle, color: 'text-danger', bg: 'badge-danger', texto: 'Cancelada' }
    };
    return configs[estado] || configs['Pendiente'];
  };

  const handleNuevaOrden = () => navigate('/produccion/ordenes/nueva');
  const handleVerDetalle = (id) => navigate(`/produccion/ordenes/${id}`);
  
  const handleDescargarPDF = async (id) => {
    try {
      const response = await ordenesProduccionAPI.generarPDF(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `orden_produccion_${id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      setSuccess('PDF descargado exitosamente');
    } catch (err) {
      setError('Error al descargar PDF');
    }
  };

  const limpiarFiltros = () => {
    setFiltroEstado(''); setBusqueda(''); setFechaInicio(''); setFechaFin('');
  };

  // =================================================================
  // AQUÍ ESTÁ LA CORRECCIÓN DE COLUMNAS (NO EMOJIS, SI ICONOS)
  // =================================================================
  const columns = [
    {
      header: 'N° Orden',
      accessor: 'numero_orden',
      width: '120px',
      render: (value, row) => (
        <div>
          <span className="font-mono font-bold text-primary">{value}</span>
          {row.es_manual === 1 && (
            <div className="badge badge-warning text-xs mt-1">Manual</div>
          )}
        </div>
      )
    },
    {
      header: 'Producto',
      accessor: 'producto',
      render: (value, row) => (
        <div className="flex flex-col gap-1">
          <div className="font-medium text-sm">{value}</div>
          <div className="text-xs text-muted font-mono">{row.codigo_producto}</div>
          
          {/* CORRECCIÓN: Icono ClipboardList en lugar de emoji */}
          {row.nombre_receta && (
            <div className="flex items-center gap-1 text-xs text-info bg-info-light px-2 py-0.5 rounded w-fit">
              <ClipboardList size={12} />
              <span className="font-medium">{row.nombre_receta}</span>
            </div>
          )}
          
          {/* CORRECCIÓN: Icono AlertTriangle en lugar de emoji */}
          {row.producto_eliminado === 1 && (
            <div className="flex items-center gap-1 badge badge-danger text-xs w-fit">
              <AlertTriangle size={12} />
              <span>Producto Eliminado</span>
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Progreso',
      accessor: 'cantidad_planificada',
      align: 'left',
      width: '180px',
      render: (value, row) => {
        const planificada = parseFloat(value);
        const producida = parseFloat(row.cantidad_producida || 0);
        const porcentaje = planificada > 0 ? (producida / planificada * 100).toFixed(0) : 0;
        
        return (
          <div className="w-full">
            <div className="flex justify-between items-end mb-1">
              <span className="font-bold text-sm">
                {planificada.toFixed(2)} <span className="text-xs text-muted">{row.unidad_medida}</span>
              </span>
              {producida > 0 && (
                <span className="text-xs text-success font-bold flex items-center gap-1">
                   {/* Icono CheckCircle pequeño */}
                   <CheckCircle size={10} />
                   {porcentaje}%
                </span>
              )}
            </div>
            
            {/* Barra de progreso CSS pura */}
            <div className="progress-bar" style={{ height: '6px' }}>
              <div 
                className="progress-fill bg-success" 
                style={{ width: `${Math.min(porcentaje, 100)}%` }}
              />
            </div>
            
            <div className="text-xs text-muted mt-1 text-right">
              Prod: {producida.toFixed(2)}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Supervisor',
      accessor: 'supervisor',
      width: '140px',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Users size={14} className="text-muted" />
          <span className="text-sm truncate">{value}</span>
        </div>
      )
    },
    {
      header: 'Costo',
      accessor: 'costo_materiales',
      align: 'right',
      width: '120px',
      render: (value) => (
        <span className="font-bold text-primary text-sm">{formatearMoneda(value)}</span>
      )
    },
    {
      header: 'Estado',
      accessor: 'estado',
      align: 'center',
      width: '130px',
      render: (value) => {
        const config = getEstadoConfig(value);
        const Icono = config.icono;
        return (
          <span className={`badge ${config.bg} flex items-center justify-center gap-1 px-3 py-1`}>
            <Icono size={14} />
            {config.texto}
          </span>
        );
      }
    },
    {
      header: 'Fechas',
      accessor: 'fecha_creacion',
      width: '140px',
      render: (value, row) => (
        <div className="text-xs flex flex-col gap-1">
          <div className="flex items-center gap-1 text-muted">
            <Calendar size={12} />
            <span>Creación: {formatearFecha(value)}</span>
          </div>
          {row.fecha_fin && (
             <div className="text-success font-medium">
               Fin: {formatearFecha(row.fecha_fin)}
             </div>
          )}
        </div>
      )
    },
    {
      header: 'Acciones',
      accessor: 'id_orden',
      width: '100px',
      align: 'center',
      render: (value) => (
        <div className="flex gap-1 justify-center">
          <button className="btn btn-sm btn-primary p-2" onClick={() => handleVerDetalle(value)} title="Ver detalle">
            <Eye size={16} />
          </button>
          <button className="btn btn-sm btn-outline p-2" onClick={() => handleDescargarPDF(value)} title="Descargar PDF">
            <Download size={16} />
          </button>
        </div>
      )
    }
  ];

  if (loading) return <Loading message="Cargando órdenes..." />;

  const stats = calcularEstadisticas();

  // MANTÉN EL RETURN ORIGINAL (Tu JSX ya usa las clases que agregamos al CSS)
  return (
    <div className="container py-6">
      {/* Header */}
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-primary-dark">
            <Factory className="text-primary" />
            Órdenes de Producción
          </h1>
          <p className="text-muted text-sm mt-1">Gestión del ciclo de fabricación</p>
        </div>
        <button className="btn btn-primary" onClick={handleNuevaOrden}>
          <Plus size={18} />
          Nueva Orden
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Grid de Estadísticas (Ahora funciona con el CSS agregado) */}
      <div className="stats-grid mb-6">
        <div className="stat-card total">
          <div className="stat-icon"><Factory size={24} /></div>
          <div className="stat-content">
            <p className="stat-label">Total</p>
            <h2 className="stat-value">{stats.total}</h2>
            <p className="stat-sublabel">Órdenes generadas</p>
          </div>
        </div>
        <div className="stat-card pendientes">
          <div className="stat-icon"><Clock size={24} /></div>
          <div className="stat-content">
            <p className="stat-label">Pendientes</p>
            <h2 className="stat-value">{stats.pendientes}</h2>
            <p className="stat-sublabel">Por iniciar</p>
          </div>
        </div>
        <div className="stat-card en-curso">
          <div className="stat-icon"><TrendingUp size={24} /></div>
          <div className="stat-content">
            <p className="stat-label">En Curso</p>
            <h2 className="stat-value">{stats.enCurso}</h2>
            <p className="stat-sublabel">En proceso</p>
          </div>
        </div>
        <div className="stat-card finalizadas">
          <div className="stat-icon"><CheckCircle size={24} /></div>
          <div className="stat-content">
            <p className="stat-label">Finalizadas</p>
            <h2 className="stat-value">{stats.finalizadas}</h2>
            <p className="stat-sublabel">{stats.porcentajeCompletado}% completado</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="card-header flex justify-between items-center">
          <h3 className="card-title text-lg flex items-center gap-2">
            <Filter size={18} /> Filtros
          </h3>
          {(filtroEstado || busqueda || fechaInicio || fechaFin) && (
            <button className="btn btn-sm btn-outline text-danger border-danger" onClick={limpiarFiltros}>
              <XCircle size={14} /> Limpiar
            </button>
          )}
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="form-input search-input"
                placeholder="Buscar orden, producto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            
            {/* Botones de estado (Simplificado para el ejemplo) */}
            <div className="flex gap-2 flex-wrap lg:col-span-3 items-center">
               {['Pendiente', 'En Curso', 'Finalizada', 'Cancelada'].map(est => (
                 <button
                   key={est}
                   className={`btn btn-sm ${filtroEstado === est ? 'btn-primary' : 'btn-outline'}`}
                   onClick={() => setFiltroEstado(filtroEstado === est ? '' : est)}
                 >
                   {est}
                 </button>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="card-title">Listado</h2>
          <button className="btn btn-sm btn-outline" onClick={cargarDatos}><RefreshCw size={16}/></button>
        </div>
        <div className="card-body table-container">
            <Table columns={columns} data={ordenesFiltradas} emptyMessage="No hay órdenes registradas" />
        </div>
      </div>
    </div>
  );
}

export default OrdenesProduccion;