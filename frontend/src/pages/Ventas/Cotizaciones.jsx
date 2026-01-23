import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Plus, Eye, Download, Filter, FileText, Search,
  ChevronLeft, ChevronRight, RefreshCw, Calendar,
  TrendingUp, DollarSign, Edit, Copy, ExternalLink, CheckCircle2
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { cotizacionesAPI } from '../../config/api';

function Cotizaciones() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const estado = params.get('estado');
    const search = params.get('busqueda');
    
    if (estado) setFiltroEstado(estado);
    if (search) setBusqueda(search);
  }, [location.search]);

  const cargarDatos = async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);
      setRefreshing(silencioso);
      setError(null);
      
      const filtros = {};
      if (filtroEstado) {
        filtros.estado = filtroEstado;
      }
      
      const response = await cotizacionesAPI.getAll(filtros);
      
      if (response.data.success) {
        setCotizaciones(response.data.data || []);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar cotizaciones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const cotizacionesFiltradas = cotizaciones.filter(item => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return (
      item.numero_cotizacion?.toLowerCase().includes(term) ||
      item.cliente?.toLowerCase().includes(term) ||
      item.ruc_cliente?.toLowerCase().includes(term) ||
      item.comercial?.toLowerCase().includes(term)
    );
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = cotizacionesFiltradas.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(cotizacionesFiltradas.length / itemsPerPage);

  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  const estadisticas = {
    total: cotizaciones.length,
    pendientes: cotizaciones.filter(c => c.estado === 'Pendiente').length,
    aprobadas: cotizaciones.filter(c => c.estado === 'Aprobada').length,
    convertidas: cotizaciones.filter(c => c.estado === 'Convertida').length,
    montoTotal: cotizaciones.reduce((sum, c) => {
      const monto = c.moneda === 'PEN' ? parseFloat(c.total || 0) : 0;
      return sum + monto;
    }, 0)
  };

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 3 
    }).format(valor);
  };

  const formatearMoneda = (valor, moneda) => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      'Pendiente': 'badge-warning',
      'Enviada': 'badge-info',
      'Aprobada': 'badge-success',
      'Rechazada': 'badge-danger',
      'Convertida': 'badge-primary',
      'Vencida': 'badge-secondary'
    };
    return badges[estado] || 'badge-secondary';
  };

  const formatearFechaVisual = (fechaStr) => {
    if (!fechaStr) return '-';
    const partes = fechaStr.split('T')[0].split('-');
    if (partes.length !== 3) return fechaStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const handleDescargarPDF = async (id_cotizacion, numero, cliente) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await cotizacionesAPI.descargarPDF(id_cotizacion);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      
      const clienteSanitizado = (cliente || 'CLIENTE')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-zA-Z0-9]/g, "_")   
        .replace(/_+/g, "_")            
        .toUpperCase();

      const nroCot = numero || id_cotizacion;
      const fileName = `${clienteSanitizado}_${nroCot}.pdf`;
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage('PDF descargado exitosamente');

    } catch (err) {
      console.error("Error original:", err);

      if (err.response && err.response.data instanceof Blob) {
        try {
          const errorText = await err.response.data.text();
          const errorJson = JSON.parse(errorText);
          const mensajeError = errorJson.error || 'Error al generar el PDF';
          setError(mensajeError);
        } catch (e) {
          setError('Ocurrió un error inesperado al descargar el archivo.');
        }
      } else {
        setError(err.message || 'Error de conexión al descargar el PDF');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicar = async (id, e) => {
    e.stopPropagation();
    
    try {
      setError(null);
      
      const response = await cotizacionesAPI.duplicar(id);
      
      if (response.data.success) {
        setSuccessMessage(`Cotización duplicada: ${response.data.data.numero_cotizacion}`);
        
        await cargarDatos(true);
        
        setTimeout(() => {
          navigate(`/ventas/cotizaciones/${response.data.data.id_cotizacion}`);
        }, 1500);
      }
      
    } catch (err) {
      console.error('Error al duplicar cotización:', err);
      setError(err.response?.data?.error || 'Error al duplicar cotización');
    }
  };

  const handleVerDetalle = (id) => {
    const params = new URLSearchParams();
    if (filtroEstado) params.set('estado', filtroEstado);
    if (busqueda) params.set('busqueda', busqueda);
    
    const queryString = params.toString();
    navigate(`/ventas/cotizaciones/${id}${queryString ? `?${queryString}` : ''}`);
  };

  const columns = [
    {
      header: 'N° Cotización',
      accessor: 'numero_cotizacion',
      width: '160px',
      render: (value, row) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary">{value}</span>
            {!!row.convertida_venta && (
              <CheckCircle2 size={16} className="text-success" title="Convertida a Orden de Venta" />
            )}
          </div>
          <div className="text-xs text-muted font-medium">
            {formatearFechaVisual(row.fecha_emision)}
          </div>
          {!!row.convertida_venta && !!row.id_orden_venta && (
            <button
              className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/ventas/ordenes/${row.id_orden_venta}`);
              }}
            >
              Ver Orden de Venta <ExternalLink size={12} />
            </button>
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
      header: 'Total',
      accessor: 'total',
      align: 'right',
      width: '140px',
      render: (value, row) => (
        <div className="text-right">
          <div className="font-bold text-lg text-gray-800">{formatearMoneda(value, row.moneda)}</div>
          {row.moneda === 'USD' && parseFloat(row.tipo_cambio || 0) > 1 && (
            <div className="text-xs text-muted">
              TC: S/ {formatearNumero(parseFloat(row.tipo_cambio))}
            </div>
          )}
        </div>
      )
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
      width: '160px',
      render: (value) => (
        <div className="text-sm">
          {value || <span className="text-muted italic">Sin asignar</span>}
        </div>
      )
    },
    {
      header: 'Acciones',
      accessor: 'id_cotizacion',
      width: '180px',
      align: 'center',
      render: (value, row) => (
        <div className="flex gap-1 justify-center">
          <button
            className="btn btn-sm btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              handleVerDetalle(value);
            }}
            title="Ver detalle"
          >
            <Eye size={14} />
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/ventas/cotizaciones/${value}/editar`);
            }}
            title="Editar"
          >
            <Edit size={14} />
          </button>
          <button
            className="btn btn-sm btn-info"
            onClick={(e) => handleDuplicar(value, e)}
            title="Duplicar cotización"
          >
            <Copy size={14} />
          </button>
          <button
            className="btn btn-sm btn-outline"
            onClick={(e) => {
              e.stopPropagation();
              handleDescargarPDF(value, row.numero_cotizacion, row.cliente);
            }}
            title="Descargar PDF"
          >
            <Download size={14} />
          </button>
        </div>
      )
    }
  ];

  if (loading) return <Loading message="Cargando cotizaciones..." />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText size={32} className="text-primary" />
            Cotizaciones
          </h1>
          <p className="text-muted">Gestión de cotizaciones de venta</p>
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
            onClick={() => navigate('/ventas/cotizaciones/nueva')}
          >
            <Plus size={20} />
            Nueva Cotización
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {successMessage && <Alert type="success" message={successMessage} onClose={() => setSuccessMessage(null)} />}

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted uppercase font-semibold">Total</p>
                <p className="text-2xl font-bold">{estadisticas.total}</p>
              </div>
              <FileText size={32} className="text-muted opacity-20" />
            </div>
          </div>
        </div>

        <div className="card shadow-sm border-l-4 border-warning">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted uppercase font-semibold">Pendientes</p>
                <p className="text-2xl font-bold text-warning">{estadisticas.pendientes}</p>
              </div>
              <Calendar size={32} className="text-warning opacity-20" />
            </div>
          </div>
        </div>

        <div className="card shadow-sm border-l-4 border-success">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted uppercase font-semibold">Aprobadas</p>
                <p className="text-2xl font-bold text-success">{estadisticas.aprobadas}</p>
              </div>
              <TrendingUp size={32} className="text-success opacity-20" />
            </div>
          </div>
        </div>

        <div className="card shadow-sm border-l-4 border-primary">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted uppercase font-semibold">Convertidas</p>
                <p className="text-2xl font-bold text-primary">{estadisticas.convertidas}</p>
              </div>
              <CheckCircle2 size={32} className="text-primary opacity-20" />
            </div>
          </div>
        </div>

        <div className="card shadow-sm bg-gradient-to-br from-primary to-blue-600 text-white">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-semibold opacity-90">Monto Total (PEN)</p>
                <p className="text-2xl font-bold">S/ {formatearNumero(estadisticas.montoTotal)}</p>
              </div>
              <DollarSign size={32} className="opacity-20" />
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4 shadow-sm">
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
                placeholder="Buscar por N°, cliente, RUC o comercial..."
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
                  className={`btn btn-sm ${filtroEstado === 'Aprobada' ? 'btn-success' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado('Aprobada')}
                >
                  Aprobada
                </button>
                <button
                  className={`btn btn-sm ${filtroEstado === 'Convertida' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFiltroEstado('Convertida')}
                >
                  Convertida
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header flex justify-between items-center bg-gray-50/50">
          <h2 className="card-title">
            Lista de Cotizaciones
            {cotizacionesFiltradas.length !== cotizaciones.length && (
              <span className="badge badge-info ml-2">
                {cotizacionesFiltradas.length} de {cotizaciones.length}
              </span>
            )}
          </h2>
          <div className="text-sm text-muted">
            Mostrando {currentItems.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, cotizacionesFiltradas.length)} de {cotizacionesFiltradas.length}
          </div>
        </div>
        
        <div className="card-body p-0">
          <Table
            columns={columns}
            data={currentItems}
            emptyMessage="No hay cotizaciones registradas"
            onRowClick={(row) => handleVerDetalle(row.id_cotizacion)}
          />
        </div>

        {cotizacionesFiltradas.length > itemsPerPage && (
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

export default Cotizaciones;