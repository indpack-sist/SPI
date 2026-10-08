import { useState, useEffect } from 'react';
import { Search, Package, AlertCircle, Filter } from 'lucide-react';
import { productosAPI } from '../../config/api';
import Loading from '../../components/UI/Loading';

function ListaProductosSimple() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloConStock, setSoloConStock] = useState(false);

  useEffect(() => {
    cargarProductos();
  }, []);

  const cargarProductos = async () => {
    try {
      setLoading(true);
      const response = await productosAPI.getAll({ estado: 'Activo' });
      
      if (response.data.success) {
        const terminados = (response.data.data || []).filter(p =>
          Number(p.id_tipo_inventario) === 3 || 
          p.tipo_inventario === 'Productos Terminados'
        );
        setProductos(terminados);
      } else {
        setError('No se pudieron cargar los productos');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const productosFiltrados = productos.filter(p => {
    const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                             p.codigo.toLowerCase().includes(busqueda.toLowerCase());

    const cumpleStock = soloConStock ? parseFloat(p.stock_actual) >= 1 : true;

    return coincideBusqueda && cumpleStock;
  });

  if (loading) return <Loading message="Cargando inventario..." />;

  return (
    <div className="container py-8">
      
      <div className="card">
        <div className="card-header border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="card-title text-primary flex items-center gap-2">
              <Package size={24} />
              Consulta de Stock
            </h1>
            <p className="text-sm text-muted mt-1">
              Visualización rápida de existencias en almacén
            </p>
          </div>
          
          <span className="badge badge-info self-start md:self-center">
            Total: {productos.length} items
          </span>
        </div>

        <div className="card-body">

          <div className="mb-4 flex flex-col md:flex-row gap-3">
            <div className="search-input-wrapper flex-1">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                className="form-input search-input w-full"
                placeholder="Buscar por nombre o código..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                autoFocus
              />
            </div>

            <button
              onClick={() => setSoloConStock(!soloConStock)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md border transition-all text-sm font-medium whitespace-nowrap
                ${soloConStock
                  ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              <Filter size={18} className={soloConStock ? 'fill-current' : ''} />
              {soloConStock ? 'Con Stock (>1)' : 'Filtrar Stock'}
            </button>

          </div>

          {error && (
            <div className="alert alert-error mb-4">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '60%' }}>Producto</th>
                  <th className="text-right">Stock Disponible</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.length > 0 ? (
                  productosFiltrados.map((producto) => {
                    const stock = parseFloat(producto.stock_actual);
                    const minimo = parseFloat(producto.stock_minimo);
                    const esCritico = stock <= minimo;

                    return (
                      <tr key={producto.id_producto}>
                        <td>
                          <div className="flex flex-col">
                            <span className="font-bold text-text-primary">
                              {producto.nombre}
                            </span>
                            <span className="text-xs text-muted font-mono">
                              {producto.codigo}
                            </span>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex flex-col items-end">
                            <span className={`text-lg font-bold font-mono ${esCritico ? 'text-danger' : 'text-primary'}`}>
                              {stock.toFixed(2)}
                            </span>
                            <span className="text-xs text-muted uppercase">
                              {producto.unidad_medida}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="2" className="text-center py-8 text-muted">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Package size={40} className="opacity-20" />
                        <p>No se encontraron productos {soloConStock && 'con stock disponible'}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-xs text-muted text-right">
            Mostrando {productosFiltrados.length} resultados
          </div>
        </div>
      </div>
    </div>
  );
}

export default ListaProductosSimple;