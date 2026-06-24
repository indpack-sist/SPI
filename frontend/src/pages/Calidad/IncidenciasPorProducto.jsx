import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PackageSearch, Search, Eye, Factory, ShoppingCart, Package,
  Calendar, User, AlertTriangle, ShieldAlert
} from 'lucide-react';
import { incidenciasAPI, productosAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { getEstadoBadge, getSeveridadBadge, formatearFecha } from './Incidencias';

function IncidenciasPorProducto() {
  const navigate = useNavigate();

  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [productoSel, setProductoSel] = useState(null);
  const [incidencias, setIncidencias] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [loadingInc, setLoadingInc] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Solo productos que requieren receta (BOM)
    productosAPI.getAll({ estado: 'Activo', requiere_receta: 'true' })
      .then(res => setProductos(res.data.data || []))
      .catch(() => setError('Error al cargar productos'))
      .finally(() => setLoadingProductos(false));
  }, []);

  const seleccionarProducto = async (producto) => {
    setProductoSel(producto);
    try {
      setLoadingInc(true);
      setError(null);
      const res = await incidenciasAPI.getPorProducto(producto.id_producto);
      setIncidencias(res.data.data || []);
    } catch (err) {
      setError(err.error || 'Error al cargar incidencias del producto');
      setIncidencias([]);
    } finally {
      setLoadingInc(false);
    }
  };

  const terminoBusqueda = busqueda.trim().toLowerCase();
  const productosFiltrados = terminoBusqueda
    ? productos.filter(p =>
        p.nombre?.toLowerCase().includes(terminoBusqueda) ||
        p.codigo?.toLowerCase().includes(terminoBusqueda)
      )
    : [];

  const columns = [
    {
      header: 'Código',
      accessor: 'codigo',
      width: '120px',
      render: (value, row) => (
        <div>
          <span className="font-mono font-bold text-primary">{value}</span>
          <div className="text-xs text-muted mt-1">{formatearFecha(row.fecha_deteccion)}</div>
        </div>
      )
    },
    {
      header: 'Origen (OP / OV)',
      accessor: 'numero_op',
      width: '180px',
      render: (value, row) => (
        <div className="flex flex-col gap-1 text-xs">
          {row.numero_op && <span className="text-purple-700 flex items-center gap-1"><Factory size={11} /> {row.numero_op}</span>}
          {row.numero_ov && <span className="text-blue-700 flex items-center gap-1"><ShoppingCart size={11} /> {row.numero_ov}</span>}
          {row.cliente && <span className="text-gray-600 flex items-center gap-1"><User size={11} /> {row.cliente}</span>}
          {row.numero_ov && row.cantidad_ov_producto != null && <span className="text-gray-500">Cant. OV: {row.cantidad_ov_producto}</span>}
          {row.fecha_despacho && <span className="text-gray-500 flex items-center gap-1"><Calendar size={11} /> Desp: {formatearFecha(row.fecha_despacho)}</span>}
          {!row.numero_op && !row.numero_ov && <span className="text-muted">Sin origen</span>}
        </div>
      )
    },
    {
      header: 'Severidad',
      accessor: 'severidad',
      align: 'center',
      width: '100px',
      render: (value) => <span className={`badge ${getSeveridadBadge(value)}`}>{value}</span>
    },
    {
      header: 'Descripción',
      accessor: 'descripcion',
      render: (value) => <div className="text-xs text-gray-700 truncate max-w-[200px]" title={value}>{value}</div>
    },
    {
      header: 'Estado',
      accessor: 'estado',
      align: 'center',
      width: '140px',
      render: (value) => {
        const cfg = getEstadoBadge(value);
        const Ic = cfg.icono;
        return <span className={`badge ${cfg.bg} flex items-center justify-center gap-1 px-3 py-1`}><Ic size={13} /> {value}</span>;
      }
    },
    {
      header: '',
      accessor: 'id_incidencia',
      width: '60px',
      align: 'center',
      render: (value) => (
        <button className="btn btn-sm btn-primary p-2" onClick={(e) => { e.stopPropagation(); navigate(`/calidad/incidencias/${value}`); }} title="Ver detalle">
          <Eye size={16} />
        </button>
      )
    }
  ];

  if (loadingProductos) return <Loading message="Cargando productos..." />;

  return (
    <div className="container py-6">
      <div className="page-header mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-primary-dark">
          <PackageSearch className="text-primary" /> Incidencias por Producto
        </h1>
        <p className="text-muted text-sm mt-1">Selecciona un producto para ver su historial de incidencias y trazabilidad</p>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Listado de productos */}
        <div className="card">
          <div className="card-header"><h2 className="card-title flex items-center gap-2"><Package size={18} /> Productos</h2></div>
          <div className="card-body">
            <div className="search-input-wrapper mb-3">
              <Search size={18} className="search-icon" />
              <input type="text" className="form-input search-input" placeholder="Buscar producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
              {!terminoBusqueda ? (
                <p className="text-muted text-sm text-center py-4">Escribe el nombre o código para buscar un producto.</p>
              ) : productosFiltrados.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">Sin resultados para "{busqueda}".</p>
              ) : (
                productosFiltrados.slice(0, 50).map(p => (
                  <button
                    key={p.id_producto}
                    className={`text-left p-2 rounded-lg border transition-colors ${productoSel?.id_producto === p.id_producto ? 'border-primary bg-blue-50' : 'border-transparent hover:bg-gray-50'}`}
                    onClick={() => seleccionarProducto(p)}
                  >
                    <div className="text-sm font-medium truncate">{p.nombre}</div>
                    <div className="text-xs text-muted font-mono">{p.codigo}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Incidencias del producto */}
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <h2 className="card-title flex items-center gap-2">
              <ShieldAlert size={18} className="text-danger" />
              {productoSel ? `Incidencias de: ${productoSel.nombre}` : 'Incidencias'}
            </h2>
          </div>
          <div className="card-body table-container">
            {!productoSel ? (
              <div className="text-center text-muted py-12">
                <PackageSearch size={40} className="mx-auto mb-3 opacity-40" />
                <p>Selecciona un producto de la lista para ver sus incidencias.</p>
              </div>
            ) : loadingInc ? (
              <Loading message="Cargando incidencias..." />
            ) : (
              <>
                <div className="flex gap-3 mb-3 text-sm flex-wrap">
                  <span className="badge badge-secondary">Total: {incidencias.length}</span>
                  <span className="badge badge-danger flex items-center gap-1">
                    <AlertTriangle size={12} /> Críticas: {incidencias.filter(i => i.severidad === 'Crítica').length}
                  </span>
                  <span className="badge badge-success">Cerradas: {incidencias.filter(i => i.estado === 'Cerrada').length}</span>
                </div>
                <Table
                  columns={columns}
                  data={incidencias}
                  emptyMessage="Este producto no tiene incidencias registradas"
                  onRowClick={(row) => navigate(`/calidad/incidencias/${row.id_incidencia}`)}
                  mobileCards={true}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IncidenciasPorProducto;
