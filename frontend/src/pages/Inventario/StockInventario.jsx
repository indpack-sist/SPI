import { useState, useEffect } from 'react';
import { Package, TrendingUp, AlertTriangle, Filter, ChevronDown, ChevronUp } from 'lucide-react';
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
    } finally {
      setLoading(false);
    }
  };

  const toggleSeccion = (idTipo) => {
    setSeccionesExpandidas({
      ...seccionesExpandidas,
      [idTipo]: !seccionesExpandidas[idTipo]
    });
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
    return nombreTipo === 'Productos Terminados' || nombreTipo === 'Productos de Reventa';
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

  const getColorTipo = (nombreTipo) => {
    const colores = {
      'Materia Prima': { bg: '#dbeafe', color: '#2563eb', nombre: 'Materia Prima' },
      'Insumos': { bg: '#d1fae5', color: '#10b981', nombre: 'Insumos' },
      'Productos Terminados': { bg: '#fef3c7', color: '#f59e0b', nombre: 'Prod. Terminado' },
      'Productos de Reventa': { bg: '#e0e7ff', color: '#6366f1', nombre: 'Reventa' }
    };
    return colores[nombreTipo] || { bg: '#f3f4f6', color: '#6b7280', nombre: nombreTipo };
  };

  const columns = [
    { header: 'Código', accessor: 'codigo', width: '110px' },
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
      header: 'Stock Actual',
      accessor: 'stock_actual',
      align: 'right',
      width: '120px',
      render: (value, row) => {
        const stock = parseFloat(value);
        const estadoStock = getEstadoStock(stock, row.stock_minimo, row.stock_maximo);
        const color = estadoStock === 'bajo' ? 'text-danger' : estadoStock === 'alto' ? 'text-warning' : '';
        
        return (
          <div className={`text-right ${color}`}>
            <div className="font-bold">{stock.toFixed(2)}</div>
            <div className="text-xs text-muted">{row.unidad_medida}</div>
          </div>
        );
      }
    },
    {
      header: 'Mín / Máx',
      accessor: 'stock_minimo',
      align: 'center',
      width: '100px',
      render: (value, row) => (
        <div className="text-xs">
          <div>{parseFloat(value).toFixed(0)} / {parseFloat(row.stock_maximo).toFixed(0)}</div>
          <div className="text-muted">{row.unidad_medida}</div>
        </div>
      )
    },
    {
      header: 'CUP',
      accessor: 'costo_unitario_promedio',
      align: 'right',
      width: '100px',
      render: (value) => <span className="text-sm">{formatearMoneda(value)}</span>
    },
    {
      header: 'Valor Stock',
      accessor: 'stock_actual',
      align: 'right',
      width: '110px',
      render: (value, row) => (
        <span className="font-bold">{formatearMoneda(parseFloat(value) * parseFloat(row.costo_unitario_promedio))}</span>
      )
    },
    {
      header: 'Estado',
      accessor: 'stock_actual',
      align: 'center',
      width: '90px',
      render: (value, row) => {
        const estadoStock = getEstadoStock(value, row.stock_minimo, row.stock_maximo);
        const badges = {
          'bajo': { clase: 'badge-danger', texto: 'Bajo' },
          'alto': { clase: 'badge-warning', texto: 'Alto' },
          'normal': { clase: 'badge-success', texto: 'Normal' }
        };
        const badge = badges[estadoStock];
        return <span className={`badge ${badge.clase}`}>{badge.texto}</span>;
      }
    }
  ];

  if (loading) {
    return <Loading message="Cargando inventario..." />;
  }

  // 🔧 CÁLCULO CORRECTO DEL VALOR TOTAL
  const valorTotalInventario = resumenStock.reduce((sum, item) => {
    // Usar valor_produccion en lugar de valor_total
    return sum + parseFloat(item.valor_produccion || item.valor_total || 0);
  }, 0);
  
  const totalProductos = resumenStock.reduce((sum, item) => sum + parseInt(item.total_productos || 0), 0);

  return (
    <div>
      <div className="mb-4">
        <h1 className="card-title">Stock por Inventario</h1>
        <p className="text-muted">Trazabilidad completa de inventarios por tipo</p>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* TARJETAS DE RESUMEN */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="card">
          <div className="text-center">
            <p className="text-xs text-muted mb-1">Total Productos</p>
            <p className="text-2xl font-bold text-primary">{totalProductos}</p>
          </div>
        </div>

        <div className="card">
          <div className="text-center">
            <p className="text-xs text-muted mb-1">Valor Total</p>
            <p className="text-xl font-bold text-success">{formatearMoneda(valorTotalInventario)}</p>
          </div>
        </div>

        <div className="card">
          <div className="text-center">
            <p className="text-xs text-muted mb-1">Stock Bajo</p>
            <p className="text-2xl font-bold text-danger">{productosStockBajo.length}</p>
          </div>
        </div>

        <div className="card">
          <div className="text-center">
            <p className="text-xs text-muted mb-1">Tipos Inventario</p>
            <p className="text-2xl font-bold">{resumenStock.length}</p>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="card mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group" style={{ marginBottom: 0 }}>
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

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs">Filtrar por Estado de Stock</label>
            <select
              className="form-select"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="todos">Todos los estados</option>
              <option value="bajo">Stock Bajo</option>
              <option value="normal">Stock Normal</option>
              <option value="alto">Stock Alto</option>
            </select>
          </div>
        </div>
      </div>

      {/* RESUMEN POR TIPO */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">Resumen por Tipo de Inventario</h2>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          {resumenStock.map((item) => {
            const config = getColorTipo(item.tipo_inventario);
            const esTerminado = esProductoTerminado(item.tipo_inventario);
            
            return (
              <div 
                key={item.id_tipo_inventario} 
                className="card"
                style={{ 
                  borderLeft: `4px solid ${config.color}`,
                  backgroundColor: filtroTipo && filtroTipo != item.id_tipo_inventario ? 'var(--bg-secondary)' : 'var(--bg-primary)'
                }}
              >
                <div className="mb-2">
                  <span 
                    className="badge text-xs" 
                    style={{ backgroundColor: config.bg, color: config.color }}
                  >
                    {config.nombre}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted">Productos</p>
                    <p className="font-bold">{item.total_productos}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Stock Total</p>
                    <p className="font-bold">{parseFloat(item.stock_total).toFixed(0)}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                  {esTerminado ? (
                    <>
                      <div className="mb-2">
                        <p className="text-xs text-muted">
                          {item.tipo_inventario === 'Productos de Reventa' ? 'Valor Compra' : 'Valor Producción'}
                        </p>
                        <p className="font-medium text-sm">{formatearMoneda(item.valor_produccion || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">Valor Venta</p>
                        <p className="font-bold text-success">{formatearMoneda(item.valor_venta || 0)}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted">Valor Total</p>
                      <p className="font-bold">{formatearMoneda(item.valor_produccion || item.valor_total || 0)}</p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ALERTAS DE STOCK BAJO */}
      {productosStockBajo.length > 0 && (
        <div className="alert alert-warning mb-4" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
              Atención: {productosStockBajo.length} producto(s) con stock bajo
            </strong>
            <p className="text-sm" style={{ margin: 0, lineHeight: '1.5' }}>
              {productosStockBajo.slice(0, 3).map(p => p.nombre).join(', ')}
              {productosStockBajo.length > 3 && ` y ${productosStockBajo.length - 3} más`}
            </p>
          </div>
        </div>
      )}

      {/* DETALLE POR TIPO DE INVENTARIO */}
      {resumenStock
        .filter(item => !filtroTipo || item.id_tipo_inventario == filtroTipo)
        .map((tipoInventario) => {
          const productosDelTipo = productosPorTipo(tipoInventario.id_tipo_inventario);
          const productosFiltradosDelTipo = productosFiltrados(productosDelTipo);
          const config = getColorTipo(tipoInventario.tipo_inventario);
          const expandida = seccionesExpandidas[tipoInventario.id_tipo_inventario];
          const esTerminado = esProductoTerminado(tipoInventario.tipo_inventario);
          
          if (productosFiltradosDelTipo.length === 0) return null;

          return (
            <div key={tipoInventario.id_tipo_inventario} className="card mb-4">
              <div 
                className="card-header cursor-pointer"
                onClick={() => toggleSeccion(tipoInventario.id_tipo_inventario)}
                style={{ 
                  borderLeft: `4px solid ${config.color}`,
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {expandida ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    <div>
                      <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>
                        {tipoInventario.tipo_inventario}
                      </h2>
                      <div className="flex gap-4 text-xs text-muted">
                        <span>{productosFiltradosDelTipo.length} productos</span>
                        <span>Stock: {parseFloat(tipoInventario.stock_total).toFixed(0)}</span>
                        {esTerminado ? (
                          <>
                            <span>
                              {tipoInventario.tipo_inventario === 'Productos de Reventa' ? 'Compra' : 'Costo'}: {formatearMoneda(tipoInventario.valor_produccion || 0)}
                            </span>
                            <span className="text-success font-medium">Venta: {formatearMoneda(tipoInventario.valor_venta || 0)}</span>
                          </>
                        ) : (
                          <span>Valor: {formatearMoneda(tipoInventario.valor_produccion || tipoInventario.valor_total || 0)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <span 
                      className="badge" 
                      style={{ backgroundColor: config.bg, color: config.color }}
                    >
                      {productosFiltradosDelTipo.length} / {productosDelTipo.length}
                    </span>
                    {productosFiltrados(productosDelTipo).filter(p => 
                      getEstadoStock(p.stock_actual, p.stock_minimo, p.stock_maximo) === 'bajo'
                    ).length > 0 && (
                      <span className="badge badge-danger">
                        {productosFiltrados(productosDelTipo).filter(p => 
                          getEstadoStock(p.stock_actual, p.stock_minimo, p.stock_maximo) === 'bajo'
                        ).length} bajo stock
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {expandida && (
                <Table
                  columns={columns}
                  data={productosFiltradosDelTipo}
                  emptyMessage="No hay productos que cumplan con los filtros"
                />
              )}
            </div>
          );
        })}
    </div>
  );
}

export default StockInventario;