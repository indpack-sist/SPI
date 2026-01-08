import { useState, useEffect } from 'react';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Factory, 
  Box, 
  CheckCircle, 
  ShoppingCart, 
  Layers,
  DollarSign
} from 'lucide-react';
import { inventarioAPI, productosAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function StockInventario() {
  const [resumenStock, setResumenStock] = useState([]);
  const [productos, setProductos] = useState([]);
  const [tiposInventario, setTiposInventario] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [seccionesExpandidas, setSeccionesExpandidas] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [resumenRes, productosRes, tiposRes] = await Promise.all([
        inventarioAPI.getResumenStock(),
        productosAPI.getAll({ estado: 'Activo' }),
        productosAPI.getTiposInventario()
      ]);
      
      setResumenStock(resumenRes.data.data);
      setProductos(productosRes.data.data);
      setTiposInventario(tiposRes.data.data);
      
      const expandidas = {};
      resumenRes.data.data.forEach(item => {
        expandidas[item.id_tipo_inventario] = true;
      });
      setSeccionesExpandidas(expandidas);

    } catch (err) {
      setError(err.error || 'Error al cargar datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSeccion = (idTipo) => {
    setSeccionesExpandidas(prev => ({
      ...prev,
      [idTipo]: !prev[idTipo]
    }));
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(valor || 0);
  };

  const getEstadoStock = (stock, minimo, maximo) => {
    stock = parseFloat(stock);
    minimo = parseFloat(minimo);
    maximo = parseFloat(maximo);
    
    if (minimo > 0 && stock <= minimo) return 'bajo';
    if (maximo > 0 && stock >= maximo) return 'alto';
    return 'normal';
  };

  const esProductoTerminado = (nombreTipo) => {
    const tipo = nombreTipo.toLowerCase();
    return tipo.includes('terminado') || tipo.includes('reventa') || tipo.includes('venta');
  };

  const productosPorTipo = (idTipo) => {
    return productos.filter(p => p.id_tipo_inventario == idTipo);
  };

  const productosFiltrados = (productosLista) => {
    return productosLista.filter(p => {
      const estadoStock = getEstadoStock(p.stock_actual, p.stock_minimo, p.stock_maximo);
      if (filtroEstado === 'bajo' && estadoStock !== 'bajo') return false;
      if (filtroEstado === 'normal' && estadoStock !== 'normal') return false;
      if (filtroEstado === 'alto' && estadoStock !== 'alto') return false;
      return true;
    });
  };

  const productosStockBajo = productos.filter(p => 
    getEstadoStock(p.stock_actual, p.stock_minimo, p.stock_maximo) === 'bajo'
  );

  const getConfigTipo = (nombreTipo) => {
    const colores = {
      'Materia Prima': { 
        bg: '#dbeafe', color: '#2563eb', icon: Factory,
        gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
      },
      'Insumos': { 
        bg: '#d1fae5', color: '#10b981', icon: Box,
        gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      },
      'Productos Terminados': { 
        bg: '#fef3c7', color: '#f59e0b', icon: CheckCircle,
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
      },
      'Productos de Reventa': { 
        bg: '#e0e7ff', color: '#6366f1', icon: ShoppingCart,
        gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
      }
    };
    return colores[nombreTipo] || { 
      bg: '#f3f4f6', color: '#6b7280', icon: Layers,
      gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
    };
  };

  const columns = [
    { header: 'Código', accessor: 'codigo', width: '100px' },
    { 
      header: 'Producto', 
      accessor: 'nombre',
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          {row.categoria && <div className="text-xs text-muted">{row.categoria}</div>}
        </div>
      )
    },
    {
      header: 'Stock',
      accessor: 'stock_actual',
      align: 'right',
      width: '100px',
      render: (value, row) => {
        const stock = parseFloat(value);
        const estado = getEstadoStock(stock, row.stock_minimo, row.stock_maximo);
        const colorClass = estado === 'bajo' ? 'text-danger fw-bold' : estado === 'alto' ? 'text-warning' : '';
        
        return (
          <div className={`text-right ${colorClass}`}>
            <div>{stock.toFixed(2)}</div>
            <div className="text-xs text-muted">{row.unidad_medida}</div>
          </div>
        );
      }
    },
    {
      header: 'Costo Unit.',
      accessor: 'costo_unitario_promedio',
      align: 'right',
      width: '110px',
      render: (value) => <span className="text-sm text-muted">{formatearMoneda(value)}</span>
    },
    {
      header: 'P. Venta',
      accessor: 'precio_venta',
      align: 'right',
      width: '110px',
      render: (value) => {
          const precio = parseFloat(value || 0);
          return precio > 0 
            ? <span className="text-sm font-medium text-success">{formatearMoneda(precio)}</span> 
            : <span className="text-xs text-muted">-</span>;
      }
    },
    {
      header: 'Valor Costo',
      accessor: 'stock_actual', 
      align: 'right',
      width: '130px',
      render: (value, row) => (
        <span className="font-bold">
            {formatearMoneda(parseFloat(value) * parseFloat(row.costo_unitario_promedio))}
        </span>
      )
    },
    {
      header: 'Estado',
      accessor: 'stock_actual', 
      align: 'center',
      width: '100px',
      render: (value, row) => {
        const estado = getEstadoStock(value, row.stock_minimo, row.stock_maximo);
        const badges = {
          'bajo': { clase: 'badge-danger', texto: 'Bajo' },
          'alto': { clase: 'badge-warning', texto: 'Excedido' },
          'normal': { clase: 'badge-success', texto: 'Normal' }
        };
        const badge = badges[estado];
        return <span className={`badge ${badge.clase}`}>{badge.texto}</span>;
      }
    }
  ];

  if (loading) return <Loading message="Calculando valorizaciones..." />;

  const valorTotalCosto = resumenStock.reduce((sum, item) => sum + parseFloat(item.valor_costo || 0), 0);
  const valorTotalVenta = resumenStock.reduce((sum, item) => sum + parseFloat(item.valor_venta || 0), 0);
  const totalProductos = resumenStock.reduce((sum, item) => sum + parseInt(item.total_productos || 0), 0);

  return (
    <div className="fade-in">
      <div className="mb-4">
        <h1 className="card-title text-xl flex items-center gap-2">
          <DollarSign size={24} />
          Valorización de Inventario
        </h1>
        <p className="text-muted">Análisis detallado de stock, costos de producción y precios de venta.</p>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* TARJETAS DE RESUMEN GLOBAL */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4 flex flex-col items-center justify-center">
          <p className="text-xs text-muted mb-1 uppercase tracking-wider">Productos Totales</p>
          <p className="text-2xl font-bold text-primary">{totalProductos}</p>
          <p className="text-xs text-muted mt-1">{productos.length} items registrados</p>
        </div>

        <div className="card p-4 flex flex-col items-center justify-center bg-blue-50">
          <p className="text-xs text-blue-600 mb-1 uppercase tracking-wider font-semibold">Valor Total (Costo)</p>
          <p className="text-xl font-bold text-blue-700">{formatearMoneda(valorTotalCosto)}</p>
          <p className="text-xs text-blue-500 mt-1">Capital Invertido</p>
        </div>

        <div className="card p-4 flex flex-col items-center justify-center bg-green-50">
          <p className="text-xs text-green-600 mb-1 uppercase tracking-wider font-semibold">Valor Venta Potencial</p>
          <p className="text-xl font-bold text-green-700">{formatearMoneda(valorTotalVenta)}</p>
          <p className="text-xs text-green-500 mt-1">
             Margen Est.: {formatearMoneda(valorTotalVenta - valorTotalCosto)}
          </p>
        </div>

        <div className="card p-4 flex flex-col items-center justify-center">
          <p className="text-xs text-muted mb-1 uppercase tracking-wider">Stock Crítico</p>
          <p className="text-2xl font-bold text-danger">{productosStockBajo.length}</p>
          <p className="text-xs text-muted mt-1">Productos bajo mínimo</p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="card mb-6 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label text-xs">Filtrar por Tipo</label>
            <select
              className="form-select"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="">Todos los tipos</option>
              {tiposInventario.map(tipo => (
                <option key={tipo.id_tipo_inventario} value={tipo.id_tipo_inventario}>
                  {tipo.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Filtrar por Estado de Stock</label>
            <select
              className="form-select"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="todos">Todos los estados</option>
              <option value="bajo">Stock Bajo</option>
              <option value="normal">Stock Normal</option>
              <option value="alto">Stock Excedido</option>
            </select>
          </div>
        </div>
      </div>

      {/* ALERTAS */}
      {productosStockBajo.length > 0 && (
        <div className="alert alert-warning mb-4 flex items-start gap-3">
          <AlertTriangle size={24} className="mt-1 flex-shrink-0" />
          <div>
            <strong>Atención: {productosStockBajo.length} producto(s) con stock bajo</strong>
            <p className="text-sm mt-1">
              Se recomienda revisar: {productosStockBajo.slice(0, 3).map(p => p.nombre).join(', ')}
              {productosStockBajo.length > 3 && '...'}
            </p>
          </div>
        </div>
      )}

      {/* LISTADO POR TIPO DE INVENTARIO */}
      <div className="space-y-6">
        {resumenStock
          .filter(item => !filtroTipo || item.id_tipo_inventario == filtroTipo)
          .map((tipoInventario) => {
            const productosDelTipo = productosPorTipo(tipoInventario.id_tipo_inventario);
            const productosFiltradosDelTipo = productosFiltrados(productosDelTipo);
            const config = getConfigTipo(tipoInventario.tipo_inventario);
            const Icon = config.icon;
            const isExpanded = seccionesExpandidas[tipoInventario.id_tipo_inventario];
            const esTerminado = esProductoTerminado(tipoInventario.tipo_inventario);
            
            if (productosFiltradosDelTipo.length === 0 && filtroEstado !== 'todos') return null;

            return (
              <div key={tipoInventario.id_tipo_inventario} className="card overflow-hidden border-0 shadow-sm">
                
                {/* CABECERA DE SECCIÓN (ACORDEÓN) */}
                <div 
                  className="p-4 cursor-pointer transition-colors hover:bg-gray-50"
                  style={{ borderLeft: `4px solid ${config.color}` }}
                  onClick={() => toggleSeccion(tipoInventario.id_tipo_inventario)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Icono */}
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm"
                        style={{ background: config.gradient }}
                      >
                        <Icon size={20} />
                      </div>
                      
                      {/* Títulos y Valores Resumidos */}
                      <div>
                        <h2 className="text-lg font-bold text-gray-800 m-0">{tipoInventario.tipo_inventario}</h2>
                        <div className="flex gap-4 text-xs text-muted mt-1">
                          <span className="flex items-center gap-1">
                            <Package size={12} /> {productosFiltradosDelTipo.length} items
                          </span>
                          
                          {/* VALOR COSTO */}
                          <span className="font-medium text-gray-600">
                             Costo: {formatearMoneda(tipoInventario.valor_costo)}
                          </span>

                          {/* VALOR VENTA (Solo si aplica) */}
                          {esTerminado && tipoInventario.valor_venta > 0 && (
                            <span className="font-medium text-green-600">
                               Venta: {formatearMoneda(tipoInventario.valor_venta)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Badges de estado */}
                      {productosFiltrados(productosDelTipo).filter(p => 
                        getEstadoStock(p.stock_actual, p.stock_minimo, p.stock_maximo) === 'bajo'
                      ).length > 0 && (
                        <span className="badge badge-danger">
                          {productosFiltrados(productosDelTipo).filter(p => 
                            getEstadoStock(p.stock_actual, p.stock_minimo, p.stock_maximo) === 'bajo'
                          ).length} Bajo Stock
                        </span>
                      )}
                      
                      {isExpanded ? <ChevronUp size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
                    </div>
                  </div>
                </div>

                {/* TABLA DE PRODUCTOS */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <Table
                      columns={columns}
                      data={productosFiltradosDelTipo}
                      emptyMessage="No hay productos con los filtros seleccionados."
                    />
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default StockInventario;