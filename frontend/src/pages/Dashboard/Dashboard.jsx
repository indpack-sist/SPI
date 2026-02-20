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
  ArrowLeftRight
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
import { dashboard } from "../../config/api"; 
import Loading from "../../components/UI/Loading";
import Alert from "../../components/UI/Alert";
import './Dashboard.css';

// Colores industriales para gráficos
const CHART_COLORS = {
  'Materia Prima':         '#5dade2',
  'Insumos':               '#2ecc71',
  'Productos Terminados':  '#e8b84b',
  'Productos de Reventa':  '#9b59b6',
};

const CHART_STYLE = {
  background: '#1a1a1a',
  text: '#888888',
  grid: '#2a2a2a',
  tooltip: { bg: '#1a1a1a', border: '#3a3a3a', color: '#f5f5f0' },
};

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [estadisticas, setEstadisticas] = useState(null);
  const [moneda, setMoneda] = useState('PEN');
  const [tipoCambio, setTipoCambio] = useState(null);
  const [loadingTC, setLoadingTC] = useState(false);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const [resumenResponse, estadisticasResponse] = await Promise.all([
        dashboard.getResumen(),
        dashboard.getEstadisticasMovimientos()
      ]);
      setResumen(resumenResponse.data);
      setEstadisticas(estadisticasResponse.data);
      if (resumenResponse.data.tipo_cambio) {
        setTipoCambio(resumenResponse.data.tipo_cambio);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  const actualizarTipoCambioManual = async () => {
    try {
      setLoadingTC(true);
      setError(null);
      const response = await dashboard.actualizarTipoCambio({ currency: 'USD' });
      if (response.data.success) {
        setTipoCambio(response.data.data);
        alert('✅ Tipo de cambio actualizado correctamente');
        await cargarDatos();
      }
    } catch (err) {
      const errorMsg = err.error || 'Error al actualizar tipo de cambio';
      setError(errorMsg);
      alert('❌ ' + errorMsg);
    } finally {
      setLoadingTC(false);
    }
  };

  const toggleMoneda = () => setMoneda(moneda === 'PEN' ? 'USD' : 'PEN');

  const formatearMoneda = (valor, monedaOverride = null) => {
    const m = monedaOverride || moneda;
    if (m === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(valor || 0);
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'PEN' }).format(valor || 0);
  };

  const getValorSegunMoneda = (valorPEN, valorUSD) => moneda === 'PEN' ? valorPEN : valorUSD;

  const getColorTipo = (nombreTipo) => {
    const colores = {
      'Materia Prima':         { color: '#5dade2', icon: Factory },
      'Insumos':               { color: '#2ecc71', icon: Box },
      'Productos Terminados':  { color: '#e8b84b', icon: CheckCircle },
      'Productos de Reventa':  { color: '#9b59b6', icon: ShoppingCart }
    };
    return colores[nombreTipo] || { color: '#888', icon: Layers };
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', padding: '10px 14px', borderRadius: '2px' }}>
        {label && <p style={{ color: '#888', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</p>}
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, fontSize: '0.85rem', fontWeight: 700, margin: '2px 0' }}>
            {p.name}: {formatearMoneda(p.value)}
          </p>
        ))}
      </div>
    );
  };

  if (loading) return <Loading message="Cargando dashboard..." />;

  return (
    <div className="dashboard-container">

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Dashboard de Control</h1>
          <p className="subtitle">Vista general del sistema de inventario y producción</p>
        </div>
        <div className="dashboard-actions">
          <button onClick={toggleMoneda} className="btn btn-currency" title={`Cambiar a ${moneda === 'PEN' ? 'USD' : 'PEN'}`}>
            <ArrowLeftRight size={16} />
            <span className="currency-label">{moneda}</span>
          </button>

          {tipoCambio && (
            <div className="tipo-cambio-badge">
              <DollarSign size={15} />
              <div className="tipo-cambio-info">
                <span className="tipo-cambio-value">{tipoCambio.promedio.toFixed(3)}</span>
                <span className="tipo-cambio-label">USD/PEN</span>
              </div>
              {tipoCambio.desde_cache && (
                <span className="cache-indicator" title="Desde caché"><RefreshCw size={11} /></span>
              )}
              {tipoCambio.es_default && (
                <span className="default-indicator" title="Valor predeterminado">⚠️</span>
              )}
            </div>
          )}

          <button
            onClick={actualizarTipoCambioManual}
            className={`btn ${tipoCambio?.es_default ? 'btn-primary' : 'btn-outline'}`}
            disabled={loadingTC}
          >
            {loadingTC ? (
              <><RefreshCw size={16} className="spinner" /> Actualizando...</>
            ) : (
              <><DollarSign size={16} /> {tipoCambio?.es_default ? 'Actualizar TC' : 'Refrescar TC'}</>
            )}
          </button>

          <button onClick={cargarDatos} className="btn btn-outline" disabled={loading}>
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {tipoCambio?.advertencia && <Alert type="warning" message={tipoCambio.advertencia} />}

      {/* Stat cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon products"><Package size={26} /></div>
          <div className="stat-content">
            <p className="stat-label">Productos Activos</p>
            <h2 className="stat-value">{resumen?.total_productos || 0}</h2>
            <p className="stat-sublabel">{resumen?.productos_con_stock || 0} con stock</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon employees"><Users size={26} /></div>
          <div className="stat-content">
            <p className="stat-label">Empleados Activos</p>
            <h2 className="stat-value">{resumen?.total_empleados || 0}</h2>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon production"><Factory size={26} /></div>
          <div className="stat-content">
            <p className="stat-label">Órdenes de Producción</p>
            <h2 className="stat-value">{resumen?.ordenes_activas || 0}</h2>
            <p className="stat-sublabel">en proceso</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning"><AlertTriangle size={26} /></div>
          <div className="stat-content">
            <p className="stat-label">Stock Bajo</p>
            <h2 className="stat-value text-danger">{resumen?.productos_stock_bajo || 0}</h2>
            <p className="stat-sublabel">productos críticos</p>
          </div>
        </div>
      </div>

      {/* Movimientos desglose */}
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title">Movimientos — Desglose por Moneda</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: '#2ecc71', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                <ArrowDownRight size={16} /> Entradas de Inventario
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-100 rounded">
                  <span className="text-sm">En Soles (PEN):</span>
                  <span className="font-bold">{formatearMoneda(estadisticas?.entradas?.valor_pen || 0, 'PEN')}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-100 rounded">
                  <span className="text-sm">En Dólares (USD):</span>
                  <span className="font-bold">{formatearMoneda(estadisticas?.entradas?.valor_usd || 0, 'USD')}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded border-l-4 border-success" style={{ background: 'rgba(46,204,113,0.08)' }}>
                  <span className="font-semibold text-sm">Total ({moneda}):</span>
                  <span className="font-bold text-success">
                    {formatearMoneda(moneda === 'PEN' ? estadisticas?.entradas?.valor_total_pen : estadisticas?.entradas?.valor_total_usd)}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: '#e74c3c', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                <ArrowUpRight size={16} /> Salidas de Inventario
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-100 rounded">
                  <span className="text-sm">En Soles (PEN):</span>
                  <span className="font-bold">{formatearMoneda(estadisticas?.salidas?.valor_pen || 0, 'PEN')}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-100 rounded">
                  <span className="text-sm">En Dólares (USD):</span>
                  <span className="font-bold">{formatearMoneda(estadisticas?.salidas?.valor_usd || 0, 'USD')}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded border-l-4 border-danger" style={{ background: 'rgba(231,76,60,0.08)' }}>
                  <span className="font-semibold text-sm">Total ({moneda}):</span>
                  <span className="font-bold text-danger">
                    {formatearMoneda(moneda === 'PEN' ? estadisticas?.salidas?.valor_total_pen : estadisticas?.salidas?.valor_total_usd)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 p-3 rounded" style={{ background: 'rgba(93,173,226,0.06)', border: '1px solid rgba(93,173,226,0.2)', marginTop: '1rem' }}>
            <p className="text-xs" style={{ color: '#5dade2', margin: 0 }}>
              <strong>Nota:</strong> Los totales incluyen conversión automática al tipo de cambio actual
              ({tipoCambio?.venta?.toFixed(3) || '3.800'} PEN/USD).
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="charts-grid">
        <div className="card chart-card">
          <div className="card-header">
            <h3 className="card-title">Distribución por Tipo</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={prepararDatosPieChart()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name.split(' ')[0]}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {prepararDatosPieChart().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card chart-card">
          <div className="card-header">
            <h3 className="card-title">Movimientos Mensuales</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={prepararDatosMovimientos()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="mes" stroke="#555" tick={{ fill: '#666', fontSize: 11 }} />
                <YAxis stroke="#555" tick={{ fill: '#666', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#888', fontSize: '0.75rem' }} />
                <Bar dataKey="entradas" fill="#2ecc71" name="Entradas" radius={[1,1,0,0]} />
                <Bar dataKey="salidas"  fill="#e74c3c" name="Salidas"  radius={[1,1,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Inventario por tipo */}
      <div className="inventario-grid">
        {resumen?.valoracion_por_tipo?.map((tipo) => {
          const config = getColorTipo(tipo.tipo_inventario);
          const IconComponent = config.icon;
          const valorProduccion = getValorSegunMoneda(tipo.valor_produccion_pen, tipo.valor_produccion_usd);
          const valorVenta = getValorSegunMoneda(tipo.valor_venta_pen, tipo.valor_venta_usd);
          const margen = valorVenta - valorProduccion;

          return (
            <div key={tipo.tipo_inventario} className="inventario-card">
              <div className="inventario-header" style={{ backgroundColor: config.color + '22', borderBottom: `2px solid ${config.color}` }}>
                <IconComponent size={20} color={config.color} />
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
                    <span className="valor-label-tiny">V. Producción</span>
                    <span className="valor-amount">{formatearMoneda(valorProduccion)}</span>
                  </div>
                  {valorVenta > 0 && (
                    <>
                      <div className="valor-item venta-item">
                        <span className="valor-label-tiny">V. Venta</span>
                        <span className="valor-amount">{formatearMoneda(valorVenta)}</span>
                      </div>
                      {margen > 0 && (
                        <div className="valor-item margen-item">
                          <span className="valor-label-tiny">Margen</span>
                          <span className="valor-amount">{formatearMoneda(margen)}</span>
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

      {/* Tabla + Accesos rápidos */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Desglose por Tipo de Inventario</h3>
              <p className="text-muted">Valores en {moneda}</p>
            </div>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th className="text-right">Prod.</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">V. Producción</th>
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
                        <div className="tipo-badge" style={{ borderLeft: `3px solid ${config.color}` }}>
                          <IconComponent size={14} color={config.color} />
                          {tipo.tipo_inventario}
                        </div>
                      </td>
                      <td className="text-right font-bold">{tipo.total_productos}</td>
                      <td className="text-right">{parseFloat(tipo.stock_total || 0).toFixed(0)}</td>
                      <td className="text-right">{formatearMoneda(valorProd)}</td>
                      <td className="text-right">{valorVenta > 0 ? formatearMoneda(valorVenta) : '—'}</td>
                      <td className="text-right text-success">{margen > 0 ? formatearMoneda(margen) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>TOTAL</strong></td>
                  <td className="text-right"><strong>{resumen?.valoracion_por_tipo?.reduce((s, t) => s + parseInt(t.total_productos || 0), 0) || 0}</strong></td>
                  <td className="text-right"><strong>{resumen?.valoracion_por_tipo?.reduce((s, t) => s + parseFloat(t.stock_total || 0), 0).toFixed(0) || 0}</strong></td>
                  <td className="text-right"><strong>{formatearMoneda(getValorSegunMoneda(resumen?.valor_total_produccion_pen, resumen?.valor_total_produccion_usd))}</strong></td>
                  <td className="text-right"><strong>{formatearMoneda(getValorSegunMoneda(resumen?.valor_total_venta_pen, resumen?.valor_total_venta_usd))}</strong></td>
                  <td className="text-right text-success"><strong>{formatearMoneda(getValorSegunMoneda((resumen?.valor_total_venta_pen || 0) - (resumen?.valor_total_produccion_pen || 0), (resumen?.valor_total_venta_usd || 0) - (resumen?.valor_total_produccion_usd || 0)))}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Accesos Rápidos</h3>
              <p className="text-muted">Operaciones frecuentes</p>
            </div>
          </div>
          <div className="card-body">
            <div className="actions-grid">
              <Link to="/inventario/entradas"         className="action-btn primary">
                <div className="action-icon"><ArrowDownRight size={18} /></div>
                <div className="action-content">
                  <span className="action-title">Registrar Entrada</span>
                  <span className="action-subtitle">Ingreso de inventario</span>
                </div>
              </Link>
              <Link to="/inventario/salidas"          className="action-btn danger">
                <div className="action-icon"><ArrowUpRight size={18} /></div>
                <div className="action-content">
                  <span className="action-title">Registrar Salida</span>
                  <span className="action-subtitle">Venta o consumo</span>
                </div>
              </Link>
              <Link to="/inventario/transferencias"   className="action-btn warning">
                <div className="action-icon"><TrendingUp size={18} /></div>
                <div className="action-content">
                  <span className="action-title">Transferir Inventarios</span>
                  <span className="action-subtitle">Movimiento interno</span>
                </div>
              </Link>
              <Link to="/produccion/ordenes/nueva"    className="action-btn success">
                <div className="action-icon"><Factory size={18} /></div>
                <div className="action-content">
                  <span className="action-title">Nueva Orden de Producción</span>
                  <span className="action-subtitle">Fabricar productos</span>
                </div>
              </Link>
              <Link to="/productos"                   className="action-btn info">
                <div className="action-icon"><Package size={18} /></div>
                <div className="action-content">
                  <span className="action-title">Catálogo de Productos</span>
                  <span className="action-subtitle">Ver y gestionar</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Dashboard;