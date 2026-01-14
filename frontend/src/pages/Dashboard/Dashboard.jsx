import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  Users, 
  Factory, 
  AlertTriangle, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Box,
  Layers,
  ShoppingCart,
  CheckCircle,
  RefreshCw,
  ArrowLeftRight,
  TrendingDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { api } from "../../config/api";
import Loading from "../../components/UI/Loading";
import Alert from "../../components/UI/Alert";
import './Dashboard.css';

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [estadisticas, setEstadisticas] = useState(null);
  const [moneda, setMoneda] = useState('PEN');
  const [tipoCambio, setTipoCambio] = useState(null);
  const [loadingTC, setLoadingTC] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [resumenResponse, estadisticasResponse] = await Promise.all([
        api.dashboard.getResumen(),
        api.dashboard.getEstadisticasMovimientos()
      ]);
      
      setResumen(resumenResponse.data);
      setEstadisticas(estadisticasResponse.data);
      
      if (resumenResponse.data.tipo_cambio) {
        setTipoCambio(resumenResponse.data.tipo_cambio);
      }
      
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar el dashboard');
      console.error('Error al cargar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const actualizarTipoCambioManual = async () => {
    try {
      setLoadingTC(true);
      setError(null);
      
      console.log('🔴 Consumiendo API de tipo de cambio...');
      
      const response = await api.dashboard.actualizarTipoCambio({ 
        currency: 'USD' 
      });
      
      if (response.data.success) {
        setTipoCambio(response.data.data);
        
        alert('✅ Tipo de cambio actualizado correctamente');
        
        await cargarDatos();
      }
      
    } catch (err) {
      const errorMsg = err.error || 'Error al actualizar tipo de cambio';
      setError(errorMsg);
      console.error('Error al actualizar TC:', err);
      alert('❌ ' + errorMsg);
    } finally {
      setLoadingTC(false);
    }
  };

  const toggleMoneda = () => {
    setMoneda(moneda === 'PEN' ? 'USD' : 'PEN');
  };

  const formatearMoneda = (valor, monedaOverride = null) => {
    const monedaActual = monedaOverride || moneda;
    
    if (monedaActual === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(valor || 0);
    }
    
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'PEN'
    }).format(valor || 0);
  };

  const getValorSegunMoneda = (valorPEN, valorUSD) => {
    return moneda === 'PEN' ? valorPEN : valorUSD;
  };

  const getColorTipo = (nombreTipo) => {
    const colores = {
      'Materia Prima': { 
        gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
        icon: Factory,
        color: '#3b82f6'
      },
      'Insumos': { 
        gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
        icon: Box,
        color: '#10b981'
      },
      'Productos Terminados': { 
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
        icon: CheckCircle,
        color: '#f59e0b'
      },
      'Productos de Reventa': { 
        gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
        icon: ShoppingCart,
        color: '#6366f1'
      }
    };
    return colores[nombreTipo] || { 
      gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)', 
      icon: Layers,
      color: '#6b7280'
    };
  };

  const prepararDatosPieChart = () => {
    if (!resumen?.valoracion_por_tipo) return [];
    
    return resumen.valoracion_por_tipo.map(tipo => ({
      name: tipo.tipo_inventario,
      value: moneda === 'PEN' ? tipo.valor_produccion_pen : tipo.valor_produccion_usd,
      color: getColorTipo(tipo.tipo_inventario).color
    }));
  };

  const prepararDatosMovimientos = () => {
    if (!estadisticas?.movimientos_mensuales) return [];
    
    return estadisticas.movimientos_mensuales.map(m => ({
      mes: m.mes_nombre,
      entradas: moneda === 'PEN' ? m.entradas_pen_total : m.entradas_usd_total,
      salidas: moneda === 'PEN' ? m.salidas_pen_total : m.salidas_usd_total
    }));
  };

  if (loading) {
    return <Loading message="Cargando dashboard..." />;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard de Control</h1>
          <p className="subtitle">Vista general del sistema de inventario y producción</p>
        </div>
        
        <div className="dashboard-actions">
          <button 
            onClick={toggleMoneda} 
            className="btn btn-currency"
            title={`Cambiar a ${moneda === 'PEN' ? 'USD' : 'PEN'}`}
          >
            <ArrowLeftRight size={18} />
            <span className="currency-label">{moneda}</span>
          </button>

          {tipoCambio && (
            <div className="tipo-cambio-badge">
              <DollarSign size={16} />
              <div className="tipo-cambio-info">
                <span className="tipo-cambio-value">
                  {tipoCambio.promedio.toFixed(3)}
                </span>
                <span className="tipo-cambio-label">USD/PEN</span>
              </div>
              {tipoCambio.desde_cache && (
                <span className="cache-indicator" title="Desde caché">
                  <RefreshCw size={12} />
                </span>
              )}
              {tipoCambio.es_default && (
                <span className="default-indicator" title="Valor predeterminado">⚠️</span>
              )}
            </div>
          )}

          <button 
            onClick={actualizarTipoCambioManual} 
            className={`btn ${tipoCambio?.es_default ? 'btn-primary' : 'btn-secondary'}`}
            disabled={loadingTC}
            title="Actualizar tipo de cambio desde API (consume 1 token)"
          >
            {loadingTC ? (
              <>
                <RefreshCw size={18} className="spinner" />
                Actualizando...
              </>
            ) : (
              <>
                <DollarSign size={18} />
                {tipoCambio?.es_default ? 'Actualizar TC' : 'Refrescar TC'}
              </>
            )}
          </button>

          <button onClick={cargarDatos} className="btn btn-secondary" disabled={loading}>
            <RefreshCw size={18} />
            Actualizar Dashboard
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {tipoCambio?.advertencia && <Alert type="warning" message={tipoCambio.advertencia} />}

      {/* TARJETAS SUPERIORES */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon products">
            <Package size={28} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Productos Activos</p>
            <h2 className="stat-value">{resumen?.total_productos || 0}</h2>
            <p className="stat-sublabel">{resumen?.productos_con_stock || 0} con stock</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon employees">
            <Users size={28} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Empleados Activos</p>
            <h2 className="stat-value">{resumen?.total_empleados || 0}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon production">
            <Factory size={28} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Órdenes de Producción</p>
            <h2 className="stat-value">{resumen?.ordenes_activas || 0}</h2>
            <p className="stat-sublabel">en proceso</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <AlertTriangle size={28} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Stock Bajo</p>
            <h2 className="stat-value text-danger">{resumen?.productos_stock_bajo || 0}</h2>
            <p className="stat-sublabel">productos críticos</p>
          </div>
        </div>
      </div>



      {/* ESTADÍSTICAS DE MOVIMIENTOS - DESGLOSE POR MONEDA */}
      <div className="card">
        <div className="card-header">
          <h3>Movimientos de Inventario - Desglose por Moneda</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-6">
            {/* ENTRADAS */}
            <div>
              <h4 className="text-lg font-bold mb-3 flex items-center gap-2">
                <ArrowDownRight className="text-success" size={20} />
                Entradas de Inventario
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">En Soles (PEN):</span>
                  <span className="font-bold text-lg">{formatearMoneda(estadisticas?.entradas?.valor_pen || 0, 'PEN')}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">En Dólares (USD):</span>
                  <span className="font-bold text-lg">{formatearMoneda(estadisticas?.entradas?.valor_usd || 0, 'USD')}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-success/10 rounded border-l-4 border-success">
                  <span className="font-bold">Total ({moneda}):</span>
                  <span className="font-bold text-xl text-success">
                    {formatearMoneda(
                      moneda === 'PEN' 
                        ? estadisticas?.entradas?.valor_total_pen 
                        : estadisticas?.entradas?.valor_total_usd
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* SALIDAS */}
            <div>
              <h4 className="text-lg font-bold mb-3 flex items-center gap-2">
                <ArrowUpRight className="text-danger" size={20} />
                Salidas de Inventario
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">En Soles (PEN):</span>
                  <span className="font-bold text-lg">{formatearMoneda(estadisticas?.salidas?.valor_pen || 0, 'PEN')}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">En Dólares (USD):</span>
                  <span className="font-bold text-lg">{formatearMoneda(estadisticas?.salidas?.valor_usd || 0, 'USD')}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-danger/10 rounded border-l-4 border-danger">
                  <span className="font-bold">Total ({moneda}):</span>
                  <span className="font-bold text-xl text-danger">
                    {formatearMoneda(
                      moneda === 'PEN' 
                        ? estadisticas?.salidas?.valor_total_pen 
                        : estadisticas?.salidas?.valor_total_usd
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Nota:</strong> Los totales mostrados incluyen la conversión automática según el tipo de cambio actual 
              ({tipoCambio?.venta?.toFixed(3) || '3.800'} PEN/USD).
            </p>
          </div>
        </div>
      </div>

      {/* GRÁFICOS */}
      <div className="charts-grid">
        <div className="card chart-card">
          <div className="card-header">
            <h3>Distribución por Tipo de Inventario</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={prepararDatosPieChart()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {prepararDatosPieChart().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatearMoneda(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card chart-card">
          <div className="card-header">
            <h3>Movimientos Mensuales</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={prepararDatosMovimientos()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={(value) => formatearMoneda(value)} />
                <Legend />
                <Bar dataKey="entradas" fill="#10b981" name="Entradas" />
                <Bar dataKey="salidas" fill="#ef4444" name="Salidas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TARJETAS POR TIPO - CON DOS VALORES */}
      <div className="inventario-grid">
        {resumen?.valoracion_por_tipo?.map((tipo) => {
          const config = getColorTipo(tipo.tipo_inventario);
          const IconComponent = config.icon;
          const valorProduccion = getValorSegunMoneda(tipo.valor_produccion_pen, tipo.valor_produccion_usd);
          const valorVenta = getValorSegunMoneda(tipo.valor_venta_pen, tipo.valor_venta_usd);
          const margen = valorVenta - valorProduccion;
          
          return (
            <div key={tipo.tipo_inventario} className="inventario-card">
              <div className="inventario-header" style={{ background: config.gradient }}>
                <div className="inventario-icon">
                  <IconComponent size={24} color="white" />
                </div>
                <h3>{tipo.tipo_inventario}</h3>
              </div>
              <div className="inventario-body">
                <div className="inventario-stat">
                  <span className="stat-label-small">Productos</span>
                  <span className="stat-value-medium">{tipo.total_productos}</span>
                </div>
                <div className="inventario-stat">
                  <span className="stat-label-small">Stock Total</span>
                  <span className="stat-value-medium">{parseFloat(tipo.stock_total || 0).toFixed(0)}</span>
                </div>
                
                <div className="inventario-valores">
                  <div className="valor-item produccion-item">
                    <span className="valor-label-tiny">Valor Producción</span>
                    <span className="valor-amount">{formatearMoneda(valorProduccion)}</span>
                  </div>
                  {valorVenta > 0 && (
                    <>
                      <div className="valor-item venta-item">
                        <span className="valor-label-tiny">Valor Venta</span>
                        <span className="valor-amount">{formatearMoneda(valorVenta)}</span>
                      </div>
                      {margen > 0 && (
                        <div className="valor-item margen-item">
                          <span className="valor-label-tiny">Margen</span>
                          <span className="valor-amount text-success">{formatearMoneda(margen)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* TABLA DETALLADA - CON DOS VALORES */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Desglose por Tipo de Inventario</h3>
            <p className="text-muted">Valores de producción y venta en {moneda}</p>
          </div>
          
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th className="text-right">Productos</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">V. Entrada / Producción</th>
                  <th className="text-right">V. Venta</th>
                  <th className="text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {resumen?.valoracion_por_tipo?.map((tipo) => {
                  const config = getColorTipo(tipo.tipo_inventario);
                  const IconComponent = config.icon;
                  const valorProd = getValorSegunMoneda(tipo.valor_produccion_pen, tipo.valor_produccion_usd);
                  const valorVenta = getValorSegunMoneda(tipo.valor_venta_pen, tipo.valor_venta_usd);
                  const margen = valorVenta - valorProd;
                  
                  return (
                    <tr key={tipo.tipo_inventario}>
                      <td>
                        <div className="tipo-badge" style={{ borderLeft: `4px solid ${config.color}` }}>
                          <IconComponent size={16} color={config.color} style={{ marginRight: '8px' }} />
                          {tipo.tipo_inventario}
                        </div>
                      </td>
                      <td className="text-right font-bold">{tipo.total_productos}</td>
                      <td className="text-right">{parseFloat(tipo.stock_total || 0).toFixed(0)}</td>
                      <td className="text-right">{formatearMoneda(valorProd)}</td>
                      <td className="text-right">{valorVenta > 0 ? formatearMoneda(valorVenta) : '-'}</td>
                      <td className="text-right text-success">
                        {margen > 0 ? formatearMoneda(margen) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>TOTAL</strong></td>
                  <td className="text-right">
                    <strong>
                      {resumen?.valoracion_por_tipo?.reduce((sum, tipo) => 
                        sum + parseInt(tipo.total_productos || 0), 0
                      ) || 0}
                    </strong>
                  </td>
                  <td className="text-right">
                    <strong>
                      {resumen?.valoracion_por_tipo?.reduce((sum, tipo) => 
                        sum + parseFloat(tipo.stock_total || 0), 0
                      ).toFixed(0) || 0}
                    </strong>
                  </td>
                  <td className="text-right">
                    <strong>
                      {formatearMoneda(
                        getValorSegunMoneda(
                          resumen?.valor_total_produccion_pen,
                          resumen?.valor_total_produccion_usd
                        )
                      )}
                    </strong>
                  </td>
                  <td className="text-right">
                    <strong>
                      {formatearMoneda(
                        getValorSegunMoneda(
                          resumen?.valor_total_venta_pen,
                          resumen?.valor_total_venta_usd
                        )
                      )}
                    </strong>
                  </td>
                  <td className="text-right text-success">
                    <strong>
                      {formatearMoneda(
                        getValorSegunMoneda(
                          (resumen?.valor_total_venta_pen || 0) - (resumen?.valor_total_produccion_pen || 0),
                          (resumen?.valor_total_venta_usd || 0) - (resumen?.valor_total_produccion_usd || 0)
                        )
                      )}
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ACCESOS RÁPIDOS */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Accesos Rápidos</h3>
            <p className="text-muted">Operaciones frecuentes del sistema</p>
          </div>
          
          <div className="actions-grid">
            <Link to="/inventario/entradas" className="action-btn primary">
              <div className="action-icon">
                <ArrowDownRight size={20} />
              </div>
              <div className="action-content">
                <span className="action-title">Registrar Entrada</span>
                <span className="action-subtitle">Ingreso de inventario</span>
              </div>
            </Link>

            <Link to="/inventario/salidas" className="action-btn danger">
              <div className="action-icon">
                <ArrowUpRight size={20} />
              </div>
              <div className="action-content">
                <span className="action-title">Registrar Salida</span>
                <span className="action-subtitle">Venta o consumo</span>
              </div>
            </Link>

            <Link to="/inventario/transferencias" className="action-btn warning">
              <div className="action-icon">
                <TrendingUp size={20} />
              </div>
              <div className="action-content">
                <span className="action-title">Transferir entre Inventarios</span>
                <span className="action-subtitle">Movimiento interno</span>
              </div>
            </Link>

            <Link to="/produccion/ordenes/nueva" className="action-btn success">
              <div className="action-icon">
                <Factory size={20} />
              </div>
              <div className="action-content">
                <span className="action-title">Nueva Orden de Producción</span>
                <span className="action-subtitle">Fabricar productos</span>
              </div>
            </Link>

            <Link to="/productos" className="action-btn info">
              <div className="action-icon">
                <Package size={20} />
              </div>
              <div className="action-content">
                <span className="action-title">Catálogo de Productos</span>
                <span className="action-subtitle">Ver y gestionar</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;