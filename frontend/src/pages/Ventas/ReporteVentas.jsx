import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Calendar, Search, Filter, Download, 
  DollarSign, TrendingUp, PieChart as PieIcon, 
  FileText, CheckCircle, AlertCircle, Clock 
} from 'lucide-react';
import { reportesAPI, clientesAPI } from '../../config/api';
import Loading from '../../components/UI/Loading';
import Alert from '../../components/UI/Alert';

// Colores para los gráficos
const COLORS_PIE = {
  'Pagado': '#10B981',   // Verde Esmeralda
  'Parcial': '#F59E0B',  // Ambar
  'Pendiente': '#EF4444' // Rojo
};

const ReporteVentas = () => {
  // --- Estados ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [clientes, setClientes] = useState([]);
  
  // Fechas por defecto: Primer día del mes actual hasta hoy
  const fechaHoy = new Date();
  const primerDiaMes = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), 1);

  const [filtros, setFiltros] = useState({
    fechaInicio: primerDiaMes.toISOString().split('T')[0],
    fechaFin: fechaHoy.toISOString().split('T')[0],
    idCliente: ''
  });

  const [dataReporte, setDataReporte] = useState({
    resumen: {
      total_ventas_pen: 0,
      total_pagado_pen: 0,
      total_pendiente_pen: 0,
      cantidad_ordenes: 0
    },
    graficos: {
      estado_pago: [],
      ventas_dia: []
    },
    detalle: []
  });

  // --- Efectos ---
  useEffect(() => {
    cargarClientes();
    generarReporte(); // Cargar reporte inicial al montar
  }, []);

  // --- Funciones de Carga ---
  const cargarClientes = async () => {
    try {
      const response = await clientesAPI.getAll({ estado: 'Activo' });
      if (response.data.success) {
        setClientes(response.data.data);
      }
    } catch (err) {
      console.error("Error cargando clientes", err);
    }
  };

  const generarReporte = async (e) => {
    if(e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Llamada al endpoint que definimos anteriormente
      const response = await reportesAPI.getVentas({
        fechaInicio: filtros.fechaInicio,
        fechaFin: filtros.fechaFin,
        idCliente: filtros.idCliente
      });

      if (response.data.success) {
        setDataReporte(response.data.data);
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo generar el reporte. Verifique su conexión.');
    } finally {
      setLoading(false);
    }
  };

  // --- Formateadores ---
  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2
    }).format(valor || 0);
  };

  const obtenerBadgeEstadoPago = (estado) => {
    const estilos = {
      'Pagado': 'bg-green-100 text-green-800 border-green-200',
      'Parcial': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Pendiente': 'bg-red-100 text-red-800 border-red-200'
    };
    const iconos = {
        'Pagado': <CheckCircle size={12}/>,
        'Parcial': <AlertCircle size={12}/>,
        'Pendiente': <Clock size={12}/>
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 w-fit ${estilos[estado] || 'bg-gray-100'}`}>
        {iconos[estado]} {estado}
      </span>
    );
  };

  // --- Render ---
  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      
      {/* 1. Encabezado */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="text-blue-600" /> Reporte de Ventas
          </h1>
          <p className="text-gray-500 text-sm">Analítica financiera y operativa de ventas</p>
        </div>
      </div>

      {/* 2. Filtros */}
      <div className="card bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <form onSubmit={generarReporte} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Fecha Inicio</label>
            <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input 
                    type="date" 
                    className="form-input pl-10 w-full"
                    value={filtros.fechaInicio}
                    onChange={(e) => setFiltros({...filtros, fechaInicio: e.target.value})}
                />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Fecha Fin</label>
            <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input 
                    type="date" 
                    className="form-input pl-10 w-full"
                    value={filtros.fechaFin}
                    onChange={(e) => setFiltros({...filtros, fechaFin: e.target.value})}
                />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Cliente (Opcional)</label>
            <select 
                className="form-select w-full"
                value={filtros.idCliente}
                onChange={(e) => setFiltros({...filtros, idCliente: e.target.value})}
            >
                <option value="">Todos los clientes</option>
                {clientes.map(c => (
                    <option key={c.id_cliente} value={c.id_cliente}>{c.razon_social}</option>
                ))}
            </select>
          </div>
          <div>
            <button type="submit" className="btn btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
                {loading ? <Loading size="sm" color="white" /> : <><Search size={18} /> Generar Reporte</>}
            </button>
          </div>
        </form>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* 3. Tarjetas de Resumen (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-white p-4 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-blue-500">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Ventas Totales (Est.)</p>
                    <h3 className="text-2xl font-bold text-blue-700 mt-1">{formatearMoneda(dataReporte.resumen.total_ventas_pen)}</h3>
                </div>
                <div className="p-2 bg-blue-50 rounded-full text-blue-600"><DollarSign size={20}/></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Convertido a Soles</p>
        </div>

        <div className="card bg-white p-4 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-green-500">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Total Cobrado</p>
                    <h3 className="text-2xl font-bold text-green-700 mt-1">{formatearMoneda(dataReporte.resumen.total_pagado_pen)}</h3>
                </div>
                <div className="p-2 bg-green-50 rounded-full text-green-600"><CheckCircle size={20}/></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Liquidez real ingresada</p>
        </div>

        <div className="card bg-white p-4 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-red-500">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Por Cobrar</p>
                    <h3 className="text-2xl font-bold text-red-700 mt-1">{formatearMoneda(dataReporte.resumen.total_pendiente_pen)}</h3>
                </div>
                <div className="p-2 bg-red-50 rounded-full text-red-600"><AlertCircle size={20}/></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Créditos pendientes</p>
        </div>

        <div className="card bg-white p-4 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-purple-500">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Ordenes</p>
                    <h3 className="text-2xl font-bold text-purple-700 mt-1">{dataReporte.resumen.cantidad_ordenes}</h3>
                </div>
                <div className="p-2 bg-purple-50 rounded-full text-purple-600"><FileText size={20}/></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Transacciones en el periodo</p>
        </div>
      </div>

      {/* 4. Sección de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico Circular: Estado de Pagos */}
        <div className="card bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <PieIcon size={18} className="text-gray-500"/> Composición de Pagos
            </h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={dataReporte.graficos.estado_pago}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {dataReporte.graficos.estado_pago.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <RechartsTooltip 
                            formatter={(value) => formatearMoneda(value)}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">Distribución del dinero facturado según estado de cobro.</p>
        </div>

        {/* Gráfico de Barras: Evolución de Ventas */}
        <div className="card bg-white p-6 rounded-lg shadow-sm border border-gray-200 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-gray-500"/> Evolución Diaria de Ventas (S/)
            </h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={dataReporte.graficos.ventas_dia}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis 
                            dataKey="fecha" 
                            tick={{fontSize: 12, fill: '#6B7280'}} 
                            axisLine={false} 
                            tickLine={false} 
                        />
                        <YAxis 
                            tick={{fontSize: 12, fill: '#6B7280'}} 
                            axisLine={false} 
                            tickLine={false}
                            tickFormatter={(value) => `S/ ${value/1000}k`}
                        />
                        <RechartsTooltip 
                            cursor={{fill: '#F3F4F6'}}
                            formatter={(value) => [formatearMoneda(value), "Venta Total"]}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar 
                            dataKey="total" 
                            fill="#3B82F6" 
                            radius={[4, 4, 0, 0]} 
                            barSize={30}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* 5. Tabla Detallada */}
      <div className="card bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Detalle de Operaciones</h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {dataReporte.detalle.length} registros encontrados
            </span>
        </div>
        <div className="overflow-x-auto">
            <table className="table w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                    <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Nº Orden</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3 text-right">Total Orig.</th>
                        <th className="px-4 py-3 text-right">Pagado Orig.</th>
                        <th className="px-4 py-3 text-center">Estado Pago</th>
                        <th className="px-4 py-3 text-center">Estado Orden</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {dataReporte.detalle.length > 0 ? (
                        dataReporte.detalle.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                    {new Date(item.fecha).toLocaleDateString('es-PE')}
                                </td>
                                <td className="px-4 py-3 font-mono font-medium text-blue-600">
                                    {item.numero}
                                </td>
                                <td className="px-4 py-3 text-gray-800 font-medium">
                                    {item.cliente}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-700">
                                    {item.moneda === 'USD' ? '$' : 'S/'} {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(item.total)}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600">
                                    {item.moneda === 'USD' ? '$' : 'S/'} {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(item.pagado)}
                                </td>
                                <td className="px-4 py-3 flex justify-center">
                                    {obtenerBadgeEstadoPago(item.estado_pago)}
                                </td>
                                <td className="px-4 py-3 text-center text-xs text-gray-500">
                                    {item.estado}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="7" className="px-4 py-8 text-center text-gray-400">
                                No se encontraron ventas en este rango de fechas.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

    </div>
  );
};

export default ReporteVentas;