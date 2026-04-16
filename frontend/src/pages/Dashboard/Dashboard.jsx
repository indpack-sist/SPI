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
  ResponsiveContainer
} from 'recharts';
import { dashboard } from "../../config/api"; 
import Loading from "../../components/UI/Loading";
import Alert from "../../components/UI/Alert";
import './Dashboard.css';

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [estadisticas, setEstadisticas] = useState(null);
  const [tipoCambio, setTipoCambio] = useState(null);

  // Estados de Filtro
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes');
  const [fechas, setFechas] = useState({
    inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fin: new Date().toISOString().split('T')[0]
  });


  
  const cargarDatos = useCallback(async (fInicio, fFin) => {
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
  }, []);

  // Carga inicial
  useEffect(() => {
    cargarDatos(fechas.inicio, fechas.fin);
  }, []);

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

  const manejarAplicarCustom = () => {
    cargarDatos(fechas.inicio, fechas.fin);
  };

  const formatearPEN = (valor) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(valor || 0);
  const formatearUSD = (valor) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(valor || 0);

  const prepararDatosPieChart = () => {
    if (!resumen?.valoracion_stock) return [];
    const colores = ['#5dade2', '#2ecc71', '#e8b84b', '#9b59b6', '#e74c3c'];
    return resumen.valoracion_stock.map((tipo, i) => ({
      name: tipo.tipo_inventario,
      value: tipo.valor_pen,
      color: colores[i % colores.length]
    }));
  };

  if (loading && !resumen) return <Loading message="Cargando analítica..." />;

  return (
    <div className="dashboard-container">

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Centro de Inteligencia SPI</h1>
          <p className="subtitle">Análisis real de operaciones y finanzas</p>
        </div>
        <div className="dashboard-actions">
          {tipoCambio && (
            <div className="tipo-cambio-badge">
              <DollarSign size={15} />
              <div className="tipo-cambio-info">
                <span className="tipo-cambio-value">{tipoCambio.promedio.toFixed(3)}</span>
                <span className="tipo-cambio-label">TC SBS</span>
              </div>
            </div>
          )}
          <button onClick={() => cargarDatos(fechas.inicio, fechas.fin)} className="btn btn-outline" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filtros de Fecha */}
      <div className="date-filters">
        <div className="flex gap-2">
          <button onClick={() => aplicarFiltroPredefinido('hoy')} className={`filter-btn ${filtroPeriodo === 'hoy' ? 'active' : ''}`}>Hoy</button>
          <button onClick={() => aplicarFiltroPredefinido('mes')} className={`filter-btn ${filtroPeriodo === 'mes' ? 'active' : ''}`}>Este Mes</button>
          <button onClick={() => aplicarFiltroPredefinido('30dias')} className={`filter-btn ${filtroPeriodo === '30dias' ? 'active' : ''}`}>30 Días</button>
          <button onClick={() => aplicarFiltroPredefinido('anio')} className={`filter-btn ${filtroPeriodo === 'anio' ? 'active' : ''}`}>Este Año</button>
        </div>
        <div className="custom-date-picker">
          <Calendar size={14} className="text-muted" />
          <input type="date" className="date-input" value={fechas.inicio} onChange={(e) => setFechas({...fechas, inicio: e.target.value})} />
          <span className="text-muted">al</span>
          <input type="date" className="date-input" value={fechas.fin} onChange={(e) => setFechas({...fechas, fin: e.target.value})} />
          <button onClick={manejarAplicarCustom} className="btn btn-primary btn-sm ml-2">Aplicar</button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* KPIs Finanzas (Separados) */}
      <div className="kpi-row">
        <div className="kpi-stat info">
          <p className="kpi-label">Ventas del Periodo</p>
          <div className="kpi-dual-values">
            <span className="val-pen">{formatearPEN(resumen?.resumen_ventas?.pen)}</span>
            <span className="val-divider">|</span>
            <span className="val-usd">{formatearUSD(resumen?.resumen_ventas?.usd)}</span>
          </div>
          <div className="kpi-trend"><TrendingUp size={12} /> {resumen?.resumen_ventas?.cantidad} órdenes emitidas</div>
        </div>
        <div className="kpi-stat danger">
          <p className="kpi-label">Salidas (Valor Costo)</p>
          <div className="kpi-dual-values">
            <span className="val-pen">{formatearPEN(resumen?.resumen_costos?.pen)}</span>
            <span className="val-divider">|</span>
            <span className="val-usd">{formatearUSD(resumen?.resumen_costos?.usd)}</span>
          </div>
          <div className="kpi-trend"><ArrowUpRight size={12} /> Costo de lo despachado</div>
        </div>
        <div className="kpi-stat success">
          <p className="kpi-label">Valor Almacén (Actual)</p>
          <h2 className="kpi-value">{formatearPEN(resumen?.valoracion_stock?.reduce((s,t) => s + t.valor_pen, 0))}</h2>
          <div className="kpi-trend"><Box size={12} /> Valorización total en Soles</div>
        </div>
        <div className="kpi-stat">
          <p className="kpi-label">Operaciones Activas</p>
          <h2 className="kpi-value">{resumen?.ordenes_activas || 0}</h2>
          <div className="kpi-trend"><Factory size={12} /> Producción en curso</div>
        </div>
      </div>

      {/* Rankings */}
      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="card-header">
            <h3 className="card-title"><BarChart3 size={18} className="mr-2" /> Top 10 Productos</h3>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">Total PEN</th>
                  <th className="text-right">Total USD</th>
                </tr>
              </thead>
              <tbody>
                {resumen?.top_productos?.map((p) => (
                  <tr key={p.id_producto}>
                    <td>
                      <div className="rank-name">{p.nombre}</div>
                      <div className="rank-sub">{p.codigo}</div>
                    </td>
                    <td className="text-right font-bold">{p.total_cantidad}</td>
                    <td className="text-right">{formatearPEN(p.valor_pen)}</td>
                    <td className="text-right">{formatearUSD(p.valor_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="analytics-card">
          <div className="card-header">
            <h3 className="card-title"><UserCheck size={18} className="mr-2" /> Top 10 Clientes</h3>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="text-right">Órd.</th>
                  <th className="text-right">Monto PEN</th>
                  <th className="text-right">Monto USD</th>
                </tr>
              </thead>
              <tbody>
                {resumen?.top_clientes?.map((c) => (
                  <tr key={c.id_cliente}>
                    <td className="rank-name">{c.razon_social}</td>
                    <td className="text-right font-bold">{c.total_ordenes}</td>
                    <td className="text-right">{formatearPEN(c.monto_pen)}</td>
                    <td className="text-right">{formatearUSD(c.monto_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="charts-grid">
        <div className="card chart-card">
          <div className="card-header"><h3 className="card-title">Valorización de Almacén</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={prepararDatosPieChart()} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value">
                  {prepararDatosPieChart().map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card chart-card">
          <div className="card-header"><h3 className="card-title">Stock Crítico</h3></div>
          <div className="card-body flex items-center justify-center">
            <div className="text-center">
              <AlertTriangle size={48} className="text-danger mb-2 mx-auto" />
              <h2 className="text-3xl font-bold text-danger">{resumen?.productos_stock_bajo}</h2>
              <p className="text-muted">Productos requieren reposición</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Dashboard;