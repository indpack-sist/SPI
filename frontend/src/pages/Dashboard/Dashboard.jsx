import { useEffect, useState, useCallback } from 'react';
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
  Calendar,
  ChevronRight,
  BarChart3,
  UserCheck
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
  ResponsiveContainer,
  AreaChart,
  Area
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

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [estadisticas, setEstadisticas] = useState(null);
  const [moneda, setMoneda] = useState('PEN');
  const [tipoCambio, setTipoCambio] = useState(null);
  const [loadingTC, setLoadingTC] = useState(false);

  // Estados de Filtro
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes'); // 'hoy', 'mes', '30dias', 'anio', 'custom'
  const [fechas, setFechas] = useState({
    inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fin: new Date().toISOString().split('T')[0]
  });

  const cargarDatos = useCallback(async (fInicio = fechas.inicio, fFin = fechas.fin) => {
    try {
      setLoading(true);
      setError(null);
      const [resumenResponse, estadisticasResponse] = await Promise.all([
        dashboard.getResumen({ fecha_inicio: fInicio, fecha_fin: fFin }),
        dashboard.getEstadisticasMovimientos({ fecha_inicio: fInicio, fecha_fin: fFin })
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
  }, [fechas]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // Manejadores de Filtros
  const aplicarFiltroPredefinido = (periodo) => {
    setFiltroPeriodo(periodo);
    const hoy = new Date();
    let inicio = new Date();
    let fin = new Date();

    if (periodo === 'hoy') {
      inicio = hoy;
    } else if (periodo === 'mes') {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    } else if (periodo === '30dias') {
      inicio = new Date();
      inicio.setDate(hoy.getDate() - 30);
    } else if (periodo === 'anio') {
      inicio = new Date(hoy.getFullYear(), 0, 1);
    }

    const fInicio = inicio.toISOString().split('T')[0];
    const fFin = fin.toISOString().split('T')[0];
    
    setFechas({ inicio: fInicio, fin: fFin });
    cargarDatos(fInicio, fFin);
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

  // Preparación de datos para gráficos
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

  if (loading && !resumen) return <Loading message="Cargando analítica..." />;

  return (
    <div className="dashboard-container">

      {/* Header BI */}
      <div className="dashboard-header">
        <div>
          <h1>Centro de Inteligencia SPI</h1>
          <p className="subtitle">Análisis dinámico de inventario, ventas y producción</p>
        </div>
        <div className="dashboard-actions">
          <button onClick={toggleMoneda} className="btn-currency" title={`Cambiar a ${moneda === 'PEN' ? 'USD' : 'PEN'}`}>
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
            </div>
          )}

          <button onClick={() => cargarDatos()} className="btn btn-outline" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />
            Refrescar
          </button>
        </div>
      </div>

      {/* Barra de Filtros de Fecha */}
      <div className="date-filters">
        <div className="flex gap-2">
          <button onClick={() => aplicarFiltroPredefinido('hoy')} className={`filter-btn ${filtroPeriodo === 'hoy' ? 'active' : ''}`}>Hoy</button>
          <button onClick={() => aplicarFiltroPredefinido('mes')} className={`filter-btn ${filtroPeriodo === 'mes' ? 'active' : ''}`}>Este Mes</button>
          <button onClick={() => aplicarFiltroPredefinido('30dias')} className={`filter-btn ${filtroPeriodo === '30dias' ? 'active' : ''}`}>30 Días</button>
          <button onClick={() => aplicarFiltroPredefinido('anio')} className={`filter-btn ${filtroPeriodo === 'anio' ? 'active' : ''}`}>Este Año</button>
        </div>
        <div className="custom-date-picker">
          <Calendar size={14} className="text-muted" />
          <input 
            type="date" 
            className="date-input" 
            value={fechas.inicio} 
            onChange={(e) => {
              setFechas({...fechas, inicio: e.target.value});
              setFiltroPeriodo('custom');
            }}
          />
          <span className="text-muted">al</span>
          <input 
            type="date" 
            className="date-input" 
            value={fechas.fin} 
            onChange={(e) => {
              setFechas({...fechas, fin: e.target.value});
              setFiltroPeriodo('custom');
            }}
          />
          <button onClick={() => cargarDatos()} className="btn btn-primary btn-sm ml-2">Aplicar</button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Fila de KPIs Principales */}
      <div className="kpi-row">
        <div className="kpi-stat info">
          <p className="kpi-label">Ventas Totales</p>
          <h2 className="kpi-value">{formatearMoneda(getValorSegunMoneda(resumen?.valor_total_venta_pen, resumen?.valor_total_venta_usd))}</h2>
          <div className="kpi-trend text-success"><ArrowUpRight size={12} /> Facturación bruta</div>
        </div>
        <div className="kpi-stat danger">
          <p className="kpi-label">Costo Producción</p>
          <h2 className="kpi-value">{formatearMoneda(getValorSegunMoneda(resumen?.valor_total_produccion_pen, resumen?.valor_total_produccion_usd))}</h2>
          <div className="kpi-trend text-danger"><Box size={12} /> Valor en almacén</div>
        </div>
        <div className="kpi-stat success">
          <p className="kpi-label">Margen Bruto</p>
          <h2 className="kpi-value">{formatearMoneda(getValorSegunMoneda(resumen?.valor_total_venta_pen - resumen?.valor_total_produccion_pen, resumen?.valor_total_venta_usd - resumen?.valor_total_produccion_usd))}</h2>
          <div className="kpi-trend text-success"><TrendingUp size={12} /> Utilidad proyectada</div>
        </div>
        <div className="kpi-stat">
          <p className="kpi-label">Órdenes Activas</p>
          <h2 className="kpi-value">{resumen?.ordenes_activas || 0}</h2>
          <div className="kpi-trend"><RefreshCw size={12} /> En flujo de trabajo</div>
        </div>
      </div>

      {/* Secciones de Análisis Top Rankings */}
      <div className="analytics-grid">
        
        {/* Top Productos */}
        <div className="analytics-card">
          <div className="card-header">
            <h3 className="card-title"><BarChart3 size={18} className="mr-2" /> Top 10 Productos Más Vendidos</h3>
            <span className="text-xs text-muted">Por volumen de salida</span>
          </div>
          <div className="card-body">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-right">Cant.</th>
                    <th className="text-right">Total ({moneda})</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen?.top_productos?.map((p, i) => {
                    const maxCant = resumen.top_productos[0].total_cantidad;
                    const pct = (p.total_cantidad / maxCant) * 100;
                    return (
                      <tr key={p.id_producto}>
                        <td className="rank-cell">
                          <span className="rank-name">{p.nombre}</span>
                          <span className="rank-sub">{p.codigo} — {p.tipo_inventario}</span>
                          <div className="progress-container">
                            <div className="progress-bar" style={{ width: `${pct}%`, background: '#5dade2' }}></div>
                          </div>
                        </td>
                        <td className="text-right font-bold">{p.total_cantidad}</td>
                        <td className="text-right">{formatearMoneda(getValorSegunMoneda(p.total_valor_pen, p.total_valor_usd))}</td>
                      </tr>
                    );
                  })}
                  {(!resumen?.top_productos || resumen.top_productos.length === 0) && (
                    <tr><td colSpan="3" className="text-center p-4 text-muted">No hay movimientos en este periodo</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Top Clientes */}
        <div className="analytics-card">
          <div className="card-header">
            <h3 className="card-title"><UserCheck size={18} className="mr-2" /> Clientes con Mayor Facturación</h3>
            <span className="text-xs text-muted">Basado en Órdenes de Venta</span>
          </div>
          <div className="card-body">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="text-right">Órdenes</th>
                    <th className="text-right">Monto ({moneda})</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen?.top_clientes?.map((c, i) => {
                    const maxMonto = getValorSegunMoneda(resumen.top_clientes[0].monto_total_pen, resumen.top_clientes[0].monto_total_usd);
                    const montoActual = getValorSegunMoneda(c.monto_total_pen, c.monto_total_usd);
                    const pct = (montoActual / maxMonto) * 100;
                    return (
                      <tr key={c.id_cliente}>
                        <td className="rank-cell">
                          <span className="rank-name">{c.razon_social}</span>
                          <div className="progress-container">
                            <div className="progress-bar" style={{ width: `${pct}%`, background: '#2ecc71' }}></div>
                          </div>
                        </td>
                        <td className="text-right font-bold">{c.total_ordenes}</td>
                        <td className="text-right">{formatearMoneda(montoActual)}</td>
                      </tr>
                    );
                  })}
                  {(!resumen?.top_clientes || resumen.top_clientes.length === 0) && (
                    <tr><td colSpan="3" className="text-center p-4 text-muted">No hay ventas en este periodo</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Gráficos de Tendencia */}
      <div className="charts-grid">
        <div className="card chart-card">
          <div className="card-header">
            <h3 className="card-title">Distribución del Valor del Inventario</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={prepararDatosPieChart()}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {prepararDatosPieChart().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card chart-card">
          <div className="card-header">
            <h3 className="card-title">Movimientos Mensuales (Histórico 6 Meses)</h3>
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

      {/* Accesos Rápidos */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Panel de Operaciones Rápidas</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Link to="/inventario/entradas" className="action-btn primary">
              <div className="action-icon"><ArrowDownRight size={18} /></div>
              <div className="action-content"><span className="action-title">Entrada</span></div>
            </Link>
            <Link to="/inventario/salidas" className="action-btn danger">
              <div className="action-icon"><ArrowUpRight size={18} /></div>
              <div className="action-content"><span className="action-title">Salida</span></div>
            </Link>
            <Link to="/produccion/ordenes/nueva" className="action-btn success">
              <div className="action-icon"><Factory size={18} /></div>
              <div className="action-content"><span className="action-title">Nueva OP</span></div>
            </Link>
            <Link to="/ventas/nueva-orden" className="action-btn warning">
              <div className="action-icon"><DollarSign size={18} /></div>
              <div className="action-content"><span className="action-title">Venta</span></div>
            </Link>
            <Link to="/productos" className="action-btn info">
              <div className="action-icon"><Package size={18} /></div>
              <div className="action-content"><span className="action-title">Catálogo</span></div>
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Dashboard;