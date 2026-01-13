import { useState, useEffect } from 'react';
import { Search, Package, AlertCircle } from 'lucide-react';
import { productosAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
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
      // Llamamos al endpoint getAllProductos que mostraste en tu controller
      // Enviamos estado 'Activo' por defecto para no llenar la lista de inactivos
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

  // Filtrado del lado del cliente (por Código o Nombre)
  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigo.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (loading) return <Loading message="Cargando inventario..." />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
          <Package className="text-blue-600" size={28} />
          Consulta de Stock
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Visualización rápida de existencias
        </p>
      </div>

      {/* Barra de Búsqueda */}
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={20} className="text-gray-400" />
        </div>
        <input
          type="text"
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
          placeholder="Buscar por nombre o código del producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          autoFocus
        />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Listado Simplificado */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-600 text-sm uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-sm uppercase tracking-wider text-right">
                  Stock Disponible
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {productosFiltrados.length > 0 ? (
                productosFiltrados.map((producto) => (
                  <tr key={producto.id_producto} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 text-base">
                          {producto.nombre}
                        </span>
                        <span className="text-sm text-gray-500 font-mono mt-0.5">
                          {producto.codigo}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`text-lg font-bold font-mono ${
                          parseFloat(producto.stock_actual) <= parseFloat(producto.stock_minimo) 
                            ? 'text-red-600' 
                            : 'text-gray-800'
                        }`}>
                          {parseFloat(producto.stock_actual).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500 uppercase">
                          {producto.unidad_medida}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package size={40} className="text-gray-300" />
                      <p>No se encontraron productos que coincidan con la búsqueda.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer con contador */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
          <span>Mostrando {productosFiltrados.length} resultados</span>
          <span>Total en catálogo: {productos.length}</span>
        </div>
      </div>
    </div>
  );
}

export default ListaProductosSimple;