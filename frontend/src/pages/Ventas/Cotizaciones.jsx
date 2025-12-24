// frontend/src/pages/Ventas/Cotizaciones.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Download, Filter, FileText } from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function Cotizaciones() {
  const navigate = useNavigate();
  
  const [cotizaciones, setCotizaciones] = useState([]);
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
      const mockData = [
        {
          id_cotizacion: 1,
          numero_cotizacion: 'C-2025-0001',
          fecha_emision: '2025-12-24',
          cliente: 'EMPRESA DEMO SAC',
          ruc_cliente: '20123456789',
          total: 5000,
          moneda: 'PEN',
          estado: 'Pendiente',
          comercial: 'Juan Pérez'
        }
      ];
      setCotizaciones(mockData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatearMoneda = (valor, moneda) => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor).toFixed(2)}`;
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
      header: 'Total',
      accessor: 'total',
      align: 'right',
      width: '120px',
      render: (value, row) => (
        <span className="font-bold">{formatearMoneda(value, row.moneda)}</span>
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
      width: '140px'
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

  const handleDescargarPDF = (id) => {
    console.log('Descargar PDF:', id);
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

      <div className="card mb-4">
        <div className="card-body">
          <div className="flex items-center gap-3">
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

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            Lista de Cotizaciones
            <span className="badge badge-primary ml-2">{cotizaciones.length}</span>
          </h2>
        </div>
        <div className="card-body">
          <Table
            columns={columns}
            data={cotizaciones}
            emptyMessage="No hay cotizaciones registradas"
          />
        </div>
      </div>
    </div>
  );
}

export default Cotizaciones;