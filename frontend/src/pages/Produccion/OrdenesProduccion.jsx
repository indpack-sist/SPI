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
  ClipboardList,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  List,
  ShoppingCart,
  UserCog
} from 'lucide-react';
import { ordenesProduccionAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function OrdenesProduccion() {
  const navigate = useNavigate();
  
  const [ordenes, setOrdenes] = useState([]);
  const [registrosParciales, setRegistrosParciales] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroOrigen, setFiltroOrigen] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    cargarDatos();
  }, [filtroEstado, filtroOrigen, fechaInicio, fechaFin]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroEstado, filtroOrigen, busqueda, fechaInicio, fechaFin]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (filtroEstado) params.estado = filtroEstado;
      if (filtroOrigen) params.origen_tipo = filtroOrigen;
      if (fechaInicio) params.fecha_inicio = fechaInicio;
      if (fechaFin) params.fecha_fin = fechaFin;
      
      const response = await ordenesProduccionAPI.getAll(params);
      const ordenesData = response.data.data || [];
      setOrdenes(ordenesData);
      
      const registrosMap = {};
      await Promise.all(
        ordenesData
          .filter(orden => orden.estado === 'Finalizada' || orden.estado === 'En Curso' || orden.estado === 'En Pausa')
          .map(async (orden) => {
            try {
              const res = await ordenesProduccionAPI.getRegistrosParciales(orden.id_orden);
              registrosMap[orden.id_orden] = res.data.data?.length || 0;
            } catch (err) {
              registrosMap[orden.id_orden] = 0;
            }
          })
      );
      setRegistrosParciales(registrosMap);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError(err.error || 'Error al cargar órdenes de producción');
    } finally {
      setLoading(false);
    }
  };

  const calcularEstadisticas = () => {
    const total = ordenes.length;
    const pendientes = ordenes.filter(o => o.estado === 'Pendiente').length;
    const pendientesAsignacion = ordenes.filter(o => o.estado === 'Pendiente Asignación').length;
    const enCurso = ordenes.filter(o => o.estado === 'En Curso').length;
    const finalizadas = ordenes.filter(o => o.estado === 'Finalizada').length;
    const canceladas = ordenes.filter(o => o.estado === 'Cancelada').length;
    
    const desdeVentas = ordenes.filter(o => o.origen_tipo === 'Orden de Venta').length;
    const desdeSupervisor = ordenes.filter(o => o.origen_tipo === 'Supervisor' || !o.origen_tipo).length;
    
    const costoTotal = ordenes.reduce((sum, o) => sum + parseFloat(o.costo_materiales || 0), 0);
    const cantidadTotal = ordenes.reduce((sum, o) => sum + parseFloat(o.cantidad_planificada || 0), 0);
    const productosDiferentes = new Set(ordenes.map(o => o.id_producto_terminado)).size;
    
    return {
      total, pendientes, pendientesAsignacion, enCurso, finalizadas, canceladas,
      desdeVentas, desdeSupervisor,
      costoTotal, cantidadTotal, productosDiferentes,
      porcentajeCompletado: total > 0 ? ((finalizadas / total) * 100).toFixed(1) : 0
    };
  };

  const ordenesFiltradas = ordenes.filter(orden => {
    if (!busqueda) return true;
    const searchTerm = busqueda.toLowerCase();
    return (
      orden.numero_orden?.toLowerCase().includes(searchTerm) ||
      orden.producto?.toLowerCase().includes(searchTerm) ||
      orden.codigo_producto?.toLowerCase().includes(searchTerm) ||
      orden.supervisor?.toLowerCase().includes(searchTerm) ||
      orden.numero_orden_venta?.toLowerCase().includes(searchTerm)
    );
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = ordenesFiltradas.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(ordenesFiltradas.length / itemsPerPage);
  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(valor || 0);
  };

  const getEstadoConfig = (estado) => {
    const configs = {
      'Pendiente Asignación': { icono: AlertCircle, color: 'text-warning', bg: 'badge-warning', texto: 'Pend. Asignación' },
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
      await ordenesProduccionAPI.generarPDF(id);
      setSuccess('PDF descargado exitosamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Error al descargar PDF');
    }
  };

  const limpiarFiltros = () => {
    setFiltroEstado(''); 
    setFiltroOrigen('');
    setBusqueda(''); 
    setFechaInicio(''); 
    setFechaFin('');
  };

  const columns = [
    {
      header: 'N° Orden',
      accessor: 'numero_orden',
      width: '140px',
      render: (value, row) => (
        <div>
          <span className="font-mono font-bold text-primary">{value}</span>
          {row.numero_orden_venta && (
            <div className="text-xs text-muted mt-1 flex items-center gap-1">
              <ShoppingCart size={10} />
              De: {row.numero_orden_venta}
            </div>
          )}
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
          {row.nombre_receta && (
            <div className="flex items-center gap-1 text-xs text-info bg-info-light px-2 py-0.5 rounded w-fit">
              <ClipboardList size={12} />
              <span className="font-medium">{row.nombre_receta}</span>
            </div>
          )}
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
      header: 'Origen',
      accessor: 'origen_tipo',
      width: '120px',
      align: 'center',
      render: (value) => {
        if (value === 'Orden de Venta') {
          return (
            <span className="badge badge-info flex items-center gap-1 justify-center">
              <ShoppingCart size={12} />
              Orden Venta
            </span>
          );
        }
        return (
          <span className="badge badge-secondary flex items-center gap-1 justify-center">
            <UserCog size={12} />
            Supervisor
          </span>
        );
      }
    },
    {
      header: 'Progreso',
      accessor: 'cantidad_planificada',
      align: 'left',
      width: '200px',
      render: (value, row) => {
        const planificada = parseFloat(value);
        const producida = parseFloat(row.cantidad_producida || 0);
        const porcentaje = planificada > 0 ? (producida / planificada * 100).toFixed(0) : 0;
        const numRegistros = registrosParciales[row.id_orden] || 0;
        
        return (
          <div className="w-full">
            <div className="flex justify-between items-end mb-1">
              <span className="font-bold text-sm">
                {planificada.toFixed(2)} <span className="text-xs text-muted">{row.unidad_medida}</span>
              </span>
              {producida > 0 && (
                <span className="text-xs text-success font-bold flex items-center gap-1">
                   <CheckCircle size={10} />
                   {porcentaje}%
                </span>
              )}
            </div>
            <div className="progress-bar" style={{ height: '6px' }}>
              <div 
                className="progress-fill bg-success" 
                style={{ width: `${Math.min(porcentaje, 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              <div className="text-xs text-muted">
                Prod: {producida.toFixed(2)}
              </div>
              {numRegistros > 0 && (
                <div className="flex items-center gap-1 text-xs text-primary font-medium">
                  <List size={12} />
                  {numRegistros} registro{numRegistros !== 1 ? 's' : ''}
                </div>
              )}
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
          <span className="text-sm truncate">{value || '-'}</span>
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
      width: '140px',
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

  return (
    <div className="container py-6">
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Total</p>
                <h3 className="text-2xl font-bold">{stats.total}</h3>
                <p className="text-xs text-muted">{stats.productosDiferentes} productos</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Factory size={24} className="text-primary" />
              </div>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-warning">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Pendientes</p>
                <h3 className="text-2xl font-bold text-warning">{stats.pendientes}</h3>
                {stats.pendientesAsignacion > 0 && (
                  <p className="text-xs text-danger flex items-center gap-1">
                    <AlertCircle size={12} />
                    {stats.pendientesAsignacion} por asignar
                  </p>
                )}
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock size={24} className="text-warning" />
              </div>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-primary">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">En Curso</p>
                <h3 className="text-2xl font-bold text-primary">{stats.enCurso}</h3>
                <p className="text-xs text-muted">En proceso</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp size={24} className="text-primary" />
              </div>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-success">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Finalizadas</p>
                <h3 className="text-2xl font-bold text-success">{stats.finalizadas}</h3>
                <p className="text-xs text-success">{stats.porcentajeCompletado}%</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle size={24} className="text-success" />
              </div>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-info">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Por Origen</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1">
                    <ShoppingCart size={12} className="text-info" />
                    <span className="text-sm font-bold">{stats.desdeVentas}</span>
                  </div>
                  <div className="border-l h-4"></div>
                  <div className="flex items-center gap-1">
                    <UserCog size={12} className="text-muted" />
                    <span className="text-sm font-bold">{stats.desdeSupervisor}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Package size={24} className="text-info" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header flex justify-between items-center">
          <h3 className="card-title text-lg flex items-center gap-2">
            <Filter size={18} /> Filtros
          </h3>
          {(filtroEstado || filtroOrigen || busqueda || fechaInicio || fechaFin) && (
            <button className="btn btn-sm btn-outline text-danger border-danger" onClick={limpiarFiltros}>
              <XCircle size={14} /> Limpiar
            </button>
          )}
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 gap-4">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="form-input search-input"
                placeholder="Buscar orden, producto, supervisor..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted">Estado:</span>
              {['Pendiente Asignación', 'Pendiente', 'En Curso', 'Finalizada', 'Cancelada'].map(est => (
                <button
                  key={est}
                  className={`btn btn-sm ${filtroEstado === est ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado(filtroEstado === est ? '' : est)}
                >
                  {est}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted">Origen:</span>
              <button
                className={`btn btn-sm ${filtroOrigen === 'Orden de Venta' ? 'btn-info' : 'btn-outline'}`}
                onClick={() => setFiltroOrigen(filtroOrigen === 'Orden de Venta' ? '' : 'Orden de Venta')}
              >
                <ShoppingCart size={14} />
                Desde Órdenes Venta
              </button>
              <button
                className={`btn btn-sm ${filtroOrigen === 'Supervisor' ? 'btn-secondary' : 'btn-outline'}`}
                onClick={() => setFiltroOrigen(filtroOrigen === 'Supervisor' ? '' : 'Supervisor')}
              >
                <UserCog size={14} />
                Creadas por Supervisor
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="card-title">Listado</h2>
          <div className="flex gap-2 items-center text-sm text-muted">
             <span>
                Mostrando {currentItems.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, ordenesFiltradas.length)} de {ordenesFiltradas.length}
             </span>
             <button className="btn btn-sm btn-outline ml-2" onClick={cargarDatos}><RefreshCw size={16}/></button>
          </div>
        </div>
        <div className="card-body table-container">
            <Table columns={columns} data={currentItems} emptyMessage="No hay órdenes registradas" />
        </div>
        
        {ordenesFiltradas.length > itemsPerPage && (
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

export default OrdenesProduccion;