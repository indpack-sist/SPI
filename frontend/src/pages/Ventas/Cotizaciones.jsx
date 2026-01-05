import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Eye, 
  Download, 
  Filter, 
  FileText, 
  DollarSign, 
  Percent, 
  Search,
  // IMPORTES PARA PAGINACIÓN
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { cotizacionesAPI } from '../../config/api';

function Cotizaciones() {
  const navigate = useNavigate();
  
  const [cotizaciones, setCotizaciones] = useState([]);
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
      
      const response = await cotizacionesAPI.getAll(filtros);
      
      if (response.data.success) {
        setCotizaciones(response.data.data || []);
      } else {
        setError('Error al cargar cotizaciones');
      }
      
    } catch (err) {
      console.error('Error al cargar cotizaciones:', err);
      setError(err.response?.data?.error || 'Error al cargar cotizaciones');
    } finally {
      setLoading(false);
    }
  };

  // 1. LÓGICA DE FILTRADO (Texto)
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

  // 2. LÓGICA DE PAGINACIÓN
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = cotizacionesFiltradas.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(cotizacionesFiltradas.length / itemsPerPage);

  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  const formatearMoneda = (valor, moneda) => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toFixed(2)}`;
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      'Pendiente': 'badge-warning',
      'Aprobada': 'badge-success',
      'Rechazada': 'badge-danger',
      'Convertida': 'badge-primary'
    };
    return badges[estado] || 'badge-secondary';
  };

  const getTipoImpuestoNombre = (codigo) => {
    const tipos = {
      'IGV': '18% IGV',
      'IGV3': '6% IGV',
      'IGV4': '18%',
      'GRA': '0% Gratis',
      '6%': '6%',
      'EXO': '0% Exonerado',
      'INA': 'Inafecto',
      'EXP': 'Exportación'
    };
    return tipos[codigo] || codigo || 'IGV';
  };

  const columns = [
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
      render: (value) => new Date(value).toLocaleDateString('es-PE')
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
      header: 'Moneda',
      accessor: 'moneda',
      width: '80px',
      align: 'center',
      render: (value) => (
        <span className="badge badge-info">{value}</span>
      )
    },
    {
      header: 'T.C.',
      accessor: 'tipo_cambio',
      width: '90px',
      align: 'right',
      render: (value, row) => {
        if (row.moneda === 'USD' || (value && parseFloat(value) !== 1.0000)) {
          return (
            <div className="text-xs">
              <DollarSign size={12} className="inline" />
              {parseFloat(value || 1).toFixed(4)}
            </div>
          );
        }
        return '-';
      }
    },
    {
      header: 'Impuesto',
      accessor: 'tipo_impuesto',
      width: '110px',
      align: 'center',
      render: (value, row) => (
        <div className="text-xs">
          <Percent size={12} className="inline" />
          {getTipoImpuestoNombre(value)}
        </div>
      )
    },
    {
      header: 'Total',
      accessor: 'total',
      align: 'right',
      width: '150px',
      render: (value, row) => (
        <div className="text-right">
          <div className="font-bold">{formatearMoneda(value, row.moneda)}</div>
          {row.tipo_cambio && parseFloat(row.tipo_cambio) > 1 && (
            <div className="text-xs text-muted">
              {row.moneda === 'USD' 
                ? `≈ S/ ${(parseFloat(value) * parseFloat(row.tipo_cambio)).toFixed(2)}`
                : `≈ $ ${(parseFloat(value) / parseFloat(row.tipo_cambio)).toFixed(2)}`
              }
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
      width: '140px',
      render: (value) => value || '-'
    },
    {
      header: 'Acciones',
      accessor: 'id_cotizacion',
      width: '120px',
      align: 'center',
      render: (value) => (
        <div className="flex gap-1 justify-center">
          <button
            className="btn btn-sm btn-primary"
            onClick={() => navigate(`/ventas/cotizaciones/${value}`)}
            title="Ver detalle"
          >
            <Eye size={14} />
          </button>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => handleDescargarPDF(value)}
            title="Descargar PDF"
          >
            <Download size={14} />
          </button>
        </div>
      )
    }
  ];

  const handleDescargarPDF = async (id) => {
    try {
      await cotizacionesAPI.descargarPDF(id);
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      setError('Error al descargar el PDF');
    }
  };

  if (loading) return <Loading message="Cargando cotizaciones..." />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText size={32} />
            Cotizaciones
          </h1>
          <p className="text-muted">Gestión de cotizaciones de venta</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => navigate('/ventas/cotizaciones/nueva')}
        >
          <Plus size={20} />
          Nueva Cotización
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Tarjeta de Filtros y Búsqueda */}
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
                placeholder="Buscar por N°, cliente, RUC..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            {/* Botones de Estado */}
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

      {/* Tabla con Paginación */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="card-title">
            Lista de Cotizaciones
            <span className="badge badge-primary ml-2">{cotizacionesFiltradas.length}</span>
          </h2>
          <div className="text-sm text-muted">
             Mostrando {currentItems.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, cotizacionesFiltradas.length)} de {cotizacionesFiltradas.length}
          </div>
        </div>
        
        <div className="card-body">
          <Table
            columns={columns}
            data={currentItems}
            emptyMessage="No hay cotizaciones registradas"
          />
        </div>

        {/* Footer de Paginación */}
        {cotizacionesFiltradas.length > itemsPerPage && (
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

export default Cotizaciones;