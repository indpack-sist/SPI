import { useState, useEffect } from 'react';
import { Search, Package, AlertCircle } from 'lucide-react';
import { productosAPI } from '../../config/api';
// Eliminamos los imports de UI components si no los vas a usar
// OJO: Si tus componentes UI (Table, Modal) ya usan internamente estas clases, úsalos.
// Aquí asumo que quieres usar HTML puro con tus clases CSS del index.css.
import Loading from '../../components/UI/Loading';

function ListaProductosSimple() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    cargarProductos();
  }, []);

  const cargarProductos = async () => {
    try {
      setLoading(true);
      const response = await productosAPI.getAll({ estado: 'Activo' });
      
      if (response.data.success) {
        setProductos(response.data.data || []);
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

  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigo.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (loading) return <Loading message="Cargando inventario..." />;

  return (
    <div className="container py-8"> {/* Usamos .container y padding vertical */}
      
      <div className="card">
        {/* Encabezado de la Tarjeta */}
        <div className="card-header border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="card-title text-primary">
              <Package size={24} />
              Consulta de Stock
            </h1>
            <p className="text-sm text-muted mt-1">
              Visualización rápida de existencias en almacén
            </p>
          </div>
          
          {/* Contador simple (Badge) */}
          <span className="badge badge-info self-start md:self-center">
            Total: {productos.length} items
          </span>
        </div>

        <div className="card-body">
          {/* Barra de Búsqueda usando tus clases .search-input-wrapper */}
          <div className="mb-4 search-input-wrapper">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              className="form-input search-input" // Usamos tus clases de formulario
              placeholder="Buscar por nombre o código del producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoFocus
            />
          </div>

          {error && (
            <div className="alert alert-error mb-4">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Tabla usando tus clases .table y .table-container */}
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
                        <p>No se encontraron productos</p>
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