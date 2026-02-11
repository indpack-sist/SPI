import { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';
import { 
  Calendar, Search, Filter, Download, 
  DollarSign, TrendingUp, PieChart as PieIcon, 
  FileText, CheckCircle, AlertCircle, Clock, Truck, User, X,
  Eye, Package, MapPin, Phone, Mail, CreditCard, FileCheck,
  ChevronDown, ChevronUp, ShoppingCart, Percent, Building2
} from 'lucide-react';
import { reportesAPI, clientesAPI, empleadosAPI } from '../../config/api';
import Loading from '../../components/UI/Loading';
import Alert from '../../components/UI/Alert';

const COLORS_PIE = {
  'Pagado': '#10B981',
  'Parcial': '#F59E0B',
  'Pendiente': '#EF4444'
};

const ReporteVentas = () => {
  const [loading, setLoading] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [error, setError] = useState(null);
  
  const [vendedores, setVendedores] = useState([]);
  
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clientesSugeridos, setClientesSugeridos] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const wrapperRef = useRef(null);

  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [mostrarDetalleOrden, setMostrarDetalleOrden] = useState(false);

  const fechaHoy = new Date();
  const primerDiaMes = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), 1);

  const [filtros, setFiltros] = useState({
    fechaInicio: primerDiaMes.toISOString().split('T')[0],
    fechaFin: fechaHoy.toISOString().split('T')[0],
    idCliente: '',
    idVendedor: ''
  });

  const [dataReporte, setDataReporte] = useState({
    resumen: {
      total_ventas_pen: 0,
      total_pagado_pen: 0,
      total_pendiente_pen: 0,
      total_comisiones_pen: 0,
      contado_pen: 0,
      credito_pen: 0,
      pedidos_retrasados: 0,
      cantidad_ordenes: 0
    },
    graficos: {
      estado_pago: [],
      ventas_dia: [],
      top_vendedores: [],
      ventas_por_estado: []
    },
    detalle: []
  });

  useEffect(() => {
    cargarDatosIniciales();
    generarReporte();
    
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setMostrarSugerencias(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const buscarClientes = async () => {
        if (busquedaCliente.length > 1 && !filtros.idCliente) {
            try {
                const response = await clientesAPI.search(busquedaCliente);
                if (response.data.success) {
                    setClientesSugeridos(response.data.data);
                    setMostrarSugerencias(true);
                }
            } catch (error) {
                console.error("Error buscando clientes", error);
            }
        } else {
            setClientesSugeridos([]);
        }
    };

    const timeoutId = setTimeout(() => {
        buscarClientes();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [busquedaCliente, filtros.idCliente]);

  const cargarDatosIniciales = async () => {
    try {
      const resVendedores = await empleadosAPI.getAll({ area: 'Comercial' }); 
      if (resVendedores.data.success) setVendedores(resVendedores.data.data);
    } catch (err) {
      console.error("Error cargando listas", err);
    }
  };

  const seleccionarCliente = (cliente) => {
    setFiltros({ ...filtros, idCliente: cliente.id_cliente });
    setBusquedaCliente(cliente.razon_social);
    setMostrarSugerencias(false);
  };

  const limpiarCliente = () => {
    setFiltros({ ...filtros, idCliente: '' });
    setBusquedaCliente('');
    setClientesSugeridos([]);
  };

  const generarReporte = async (e) => {
    if(e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await reportesAPI.getVentas({
        fechaInicio: filtros.fechaInicio,
        fechaFin: filtros.fechaFin,
        idCliente: filtros.idCliente,
        idVendedor: filtros.idVendedor
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

  const descargarPDF = async () => {
    setLoadingPdf(true);
    try {
        const response = await reportesAPI.getVentas({
            ...filtros,
            format: 'pdf'
        }, { responseType: 'blob' });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Reporte_Ventas_${Date.now()}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (err) {
        setError('Error al descargar el PDF');
    } finally {
        setLoadingPdf(false);
    }
  };

  const verDetalleOrden = (orden) => {
    setOrdenSeleccionada(orden);
    setMostrarDetalleOrden(true);
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2
    }).format(valor || 0);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatearFechaHora = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const obtenerBadgeEstadoPago = (estado) => {
    const estilos = {
      'Pagado': 'bg-green-100 text-green-800 border-green-200',
      'Parcial': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Pendiente': 'bg-red-100 text-red-800 border-red-200'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border w-fit ${estilos[estado] || 'bg-gray-100'}`}>
        {estado}
      </span>
    );
  };

  const obtenerBadgeEstado = (estado) => {
    const estilos = {
      'En Espera': 'bg-gray-100 text-gray-800',
      'En Proceso': 'bg-blue-100 text-blue-800',
      'Atendido por Producción': 'bg-purple-100 text-purple-800',
      'Despacho Parcial': 'bg-yellow-100 text-yellow-800',
      'Despachada': 'bg-green-100 text-green-800',
      'Entregada': 'bg-emerald-100 text-emerald-800',
      'Cancelada': 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${estilos[estado] || 'bg-gray-100'}`}>
        {estado}
      </span>
    );
  };

  const obtenerBadgeVerificacion = (estado) => {
    const estilos = {
      'Pendiente': 'bg-yellow-100 text-yellow-800',
      'Aprobada': 'bg-green-100 text-green-800',
      'Rechazada': 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${estilos[estado] || 'bg-gray-100'}`}>
        {estado}
      </span>
    );
  };

  const obtenerBadgeLogistica = (estado) => {
    const estilos = {
        'A tiempo': 'bg-blue-100 text-blue-800',
        'En plazo': 'bg-blue-50 text-blue-600',
        'Retrasado': 'bg-red-100 text-red-800 font-bold',
        'Vencido': 'bg-red-200 text-red-900 font-bold'
    };
    return (
        <span className={`px-2 py-0.5 rounded text-xs ${estilos[estado] || 'bg-gray-100'}`}>
            {estado}
        </span>
    );
  };

  const obtenerIconoTipoEntrega = (tipo) => {
    if (tipo === 'Vehiculo Empresa') return <Truck size={16} className="text-blue-600" />;
    if (tipo === 'Transporte Privado') return <Package size={16} className="text-orange-600" />;
    return <ShoppingCart size={16} className="text-green-600" />;
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen font-sans">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="text-blue-600" /> Dashboard de Ventas
          </h1>
          <p className="text-gray-500 text-sm">Monitor de rendimiento comercial y logístico</p>
        </div>
        <button 
            onClick={descargarPDF}
            disabled={loadingPdf}
            className="btn bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
            {loadingPdf ? <Loading size="sm" color="white"/> : <Download size={18} />}
            Exportar PDF
        </button>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <form onSubmit={generarReporte} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Desde</label>
            <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input 
                    type="date" 
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={filtros.fechaInicio}
                    onChange={(e) => setFiltros({...filtros, fechaInicio: e.target.value})}
                />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Hasta</label>
            <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input 
                    type="date" 
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={filtros.fechaFin}
                    onChange={(e) => setFiltros({...filtros, fechaFin: e.target.value})}
                />
            </div>
          </div>
          
          <div className="md:col-span-4 relative" ref={wrapperRef}>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Cliente</label>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input 
                    type="text"
                    placeholder="Buscar cliente por nombre o RUC..."
                    className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={busquedaCliente}
                    onChange={(e) => {
                        setBusquedaCliente(e.target.value);
                        if(filtros.idCliente) setFiltros({...filtros, idCliente: ''});
                    }}
                    onFocus={() => busquedaCliente && setMostrarSugerencias(true)}
                />
                {filtros.idCliente && (
                    <button 
                        type="button"
                        onClick={limpiarCliente}
                        className="absolute right-2 top-2 text-gray-400 hover:text-red-500"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
            
            {mostrarSugerencias && clientesSugeridos.length > 0 && (
                <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                    {clientesSugeridos.map(cliente => (
                        <li 
                            key={cliente.id_cliente}
                            onClick={() => seleccionarCliente(cliente)}
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 border-b border-gray-100 last:border-0"
                        >
                            <div className="font-medium">{cliente.razon_social}</div>
                            <div className="text-xs text-gray-500">RUC: {cliente.ruc}</div>
                        </li>
                    ))}
                </ul>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Vendedor</label>
            <div className="relative">
                <User className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <select 
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white"
                    value={filtros.idVendedor}
                    onChange={(e) => setFiltros({...filtros, idVendedor: e.target.value})}
                >
                    <option value="">Todos</option>
                    {vendedores.map(v => (
                        <option key={v.id_empleado} value={v.id_empleado}>{v.nombres}</option>
                    ))}
                </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow transition-colors flex items-center justify-center gap-2" disabled={loading}>
                {loading ? <Loading size="sm" color="white" /> : <Filter size={18} />}
                Filtrar
            </button>
          </div>
        </form>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Ventas Totales</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatearMoneda(dataReporte.resumen.total_ventas_pen)}</h3>
                    <div className="flex gap-2 mt-2 text-xs">
                        <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Ct: {formatearMoneda(dataReporte.resumen.contado_pen)}</span>
                        <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded">Cr: {formatearMoneda(dataReporte.resumen.credito_pen)}</span>
                    </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><DollarSign size={24}/></div>
            </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Cobrado</p>
                    <h3 className="text-2xl font-bold text-green-600 mt-1">{formatearMoneda(dataReporte.resumen.total_pagado_pen)}</h3>
                    <p className="text-xs text-gray-400 mt-2">Liquidez ingresada</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-green-600"><CheckCircle size={24}/></div>
            </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Por Cobrar</p>
                    <h3 className="text-2xl font-bold text-red-500 mt-1">{formatearMoneda(dataReporte.resumen.total_pendiente_pen)}</h3>
                    <p className="text-xs text-gray-400 mt-2">Crédito pendiente</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-red-500"><AlertCircle size={24}/></div>
            </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Operaciones</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{dataReporte.resumen.cantidad_ordenes}</h3>
                    <div className="mt-2 text-xs flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-medium ${dataReporte.resumen.pedidos_retrasados > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {dataReporte.resumen.pedidos_retrasados} Retrasos
                        </span>
                    </div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg text-orange-600"><Truck size={24}/></div>
            </div>
        </div>
      </div>

      {dataReporte.resumen.total_comisiones_pen > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-xl border border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Percent size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-purple-600 uppercase">Total Comisiones</p>
                <p className="text-lg font-bold text-purple-900">{formatearMoneda(dataReporte.resumen.total_comisiones_pen)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-2">
            <h3 className="text-base font-bold text-gray-800 mb-6 flex items-center gap-2">
                <TrendingUp size={18} className="text-gray-500"/> Evolución de Ventas Diarias
            </h3>
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dataReporte.graficos.ventas_dia} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="fecha" tick={{fontSize: 12, fill: '#9CA3AF'}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{fontSize: 12, fill: '#9CA3AF'}} axisLine={false} tickLine={false} tickFormatter={(value) => `S/ ${value/1000}k`} />
                        <RechartsTooltip 
                            cursor={{fill: '#F9FAFB'}}
                            formatter={(value) => [formatearMoneda(value), "Total"]}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Area type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} fill="url(#colorVentas)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-base font-bold text-gray-800 mb-6 flex items-center gap-2">
                <PieIcon size={18} className="text-gray-500"/> Estado de Cartera
            </h3>
            <div className="h-72 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={dataReporte.graficos.estado_pago}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {dataReporte.graficos.estado_pago.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                            ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => formatearMoneda(value)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-gray-400">Total Facturado</span>
                    <span className="text-lg font-bold text-gray-800">{formatearMoneda(dataReporte.resumen.total_ventas_pen)}</span>
                </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-2">
             <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                <User size={18} className="text-gray-500"/> Ranking de Vendedores
            </h3>
            <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={dataReporte.graficos.top_vendedores} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6"/>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 12, fill: '#4B5563'}} axisLine={false} tickLine={false}/>
                        <RechartsTooltip formatter={(value) => formatearMoneda(value)} cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px' }}/>
                        <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={20} background={{ fill: '#F9FAFB' }} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {dataReporte.graficos.ventas_por_estado && dataReporte.graficos.ventas_por_estado.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Package size={18} className="text-gray-500"/> Ventas por Estado
              </h3>
              <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={dataReporte.graficos.ventas_por_estado}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                              {dataReporte.graficos.ventas_por_estado.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'][index % 6]} />
                              ))}
                          </Pie>
                          <RechartsTooltip formatter={(value) => formatearMoneda(value)} />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-gray-800 text-sm">Detalle de Transacciones</h3>
            <span className="text-xs font-medium text-gray-500 bg-white border px-2 py-1 rounded shadow-sm">
                {dataReporte.detalle.length} Registros
            </span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                    <tr>
                        <th className="px-4 py-3 font-semibold">Acciones</th>
                        <th className="px-4 py-3 font-semibold">Orden</th>
                        <th className="px-4 py-3 font-semibold">Cliente</th>
                        <th className="px-4 py-3 font-semibold">Vendedor</th>
                        <th className="px-4 py-3 font-semibold">Emisión</th>
                        <th className="px-4 py-3 font-semibold">Despacho</th>
                        <th className="px-4 py-3 font-semibold text-right">Total</th>
                        <th className="px-4 py-3 font-semibold text-center">Estado Pago</th>
                        <th className="px-4 py-3 font-semibold text-center">Estado</th>
                        <th className="px-4 py-3 font-semibold text-center">Logística</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {dataReporte.detalle.length > 0 ? (
                        dataReporte.detalle.map((item) => (
                            <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => verDetalleOrden(item)}
                                        className="btn-ghost btn-xs flex items-center gap-1 text-blue-600 hover:text-blue-700"
                                        title="Ver detalles"
                                    >
                                        <Eye size={14} />
                                        Ver
                                    </button>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-mono font-medium text-blue-600 group-hover:text-blue-700">
                                        {item.numero}
                                    </div>
                                    {item.numero_comprobante && (
                                        <div className="text-xs text-gray-400">{item.tipo_comprobante}: {item.numero_comprobante}</div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-gray-800">
                                    <div className="font-medium truncate max-w-[200px]" title={item.cliente}>{item.cliente}</div>
                                    <div className="text-xs text-gray-400">{item.ruc}</div>
                                </td>
                                <td className="px-4 py-3 text-gray-600 text-xs truncate max-w-[120px]">
                                    {item.vendedor}
                                </td>
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                                    {formatearFecha(item.fecha_emision)}
                                </td>
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                                    {item.fecha_entrega_real ? formatearFecha(item.fecha_entrega_real) : 
                                     <span className="text-gray-400 italic">Pendiente</span>}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-700">
                                    <span className="text-xs text-gray-400 mr-1">{item.moneda}</span>
                                    {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(item.total)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {obtenerBadgeEstadoPago(item.estado_pago)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {obtenerBadgeEstado(item.estado)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {obtenerBadgeLogistica(item.estado_logistico)}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="10" className="px-4 py-12 text-center text-gray-400">
                                <div className="flex flex-col items-center justify-center">
                                    <Search size={32} className="mb-2 opacity-20"/>
                                    No se encontraron ventas con los filtros seleccionados.
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {mostrarDetalleOrden && ordenSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-overlay">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto modal-content">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-start z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="text-blue-600" />
                  Detalle de Orden: {ordenSeleccionada.numero}
                </h2>
                <p className="text-sm text-gray-500 mt-1">Información completa de la orden de venta</p>
              </div>
              <button
                onClick={() => setMostrarDetalleOrden(false)}
                className="btn-ghost p-2 rounded-lg hover:bg-gray-100"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Estado General</p>
                  <div className="flex flex-col gap-2">
                    {obtenerBadgeEstado(ordenSeleccionada.estado)}
                    {obtenerBadgeVerificacion(ordenSeleccionada.estado_verificacion)}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-xs text-green-600 font-semibold uppercase mb-1">Estado de Pago</p>
                  <div className="flex flex-col gap-2">
                    {obtenerBadgeEstadoPago(ordenSeleccionada.estado_pago)}
                    <p className="text-xs text-gray-600 mt-1">
                      Pagado: {ordenSeleccionada.moneda} {ordenSeleccionada.monto_pagado}
                    </p>
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-600 font-semibold uppercase mb-1">Tipo de Venta</p>
                  <p className="text-lg font-bold text-purple-900">{ordenSeleccionada.tipo_venta}</p>
                  {ordenSeleccionada.dias_credito > 0 && (
                    <p className="text-xs text-gray-600">{ordenSeleccionada.dias_credito} días de crédito</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Building2 size={18} className="text-blue-600" />
                    Información del Cliente
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Razón Social:</span>
                      <p className="font-medium text-gray-800">{ordenSeleccionada.cliente}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">RUC:</span>
                      <p className="font-medium text-gray-800">{ordenSeleccionada.ruc}</p>
                    </div>
                    {ordenSeleccionada.direccion_cliente && (
                      <div>
                        <span className="text-gray-500 flex items-center gap-1">
                          <MapPin size={14} /> Dirección:
                        </span>
                        <p className="font-medium text-gray-800">{ordenSeleccionada.direccion_cliente}</p>
                      </div>
                    )}
                    {ordenSeleccionada.telefono_cliente && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-gray-400" />
                        <span className="text-gray-800">{ordenSeleccionada.telefono_cliente}</span>
                      </div>
                    )}
                    {ordenSeleccionada.email_cliente && (
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-gray-400" />
                        <span className="text-gray-800">{ordenSeleccionada.email_cliente}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Calendar size={18} className="text-green-600" />
                    Fechas Importantes
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Creación:</span>
                      <span className="font-medium text-gray-800">{formatearFechaHora(ordenSeleccionada.fecha_creacion)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Emisión:</span>
                      <span className="font-medium text-gray-800">{formatearFecha(ordenSeleccionada.fecha_emision)}</span>
                    </div>
                    {ordenSeleccionada.fecha_vencimiento && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Vencimiento:</span>
                        <span className="font-medium text-gray-800">{formatearFecha(ordenSeleccionada.fecha_vencimiento)}</span>
                      </div>
                    )}
                    {ordenSeleccionada.fecha_entrega_programada && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Entrega Programada:</span>
                        <span className="font-medium text-gray-800">{formatearFecha(ordenSeleccionada.fecha_entrega_programada)}</span>
                      </div>
                    )}
                    {ordenSeleccionada.fecha_entrega_real && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Entrega Real:</span>
                        <span className="font-medium text-green-700">{formatearFecha(ordenSeleccionada.fecha_entrega_real)}</span>
                      </div>
                    )}
                    {ordenSeleccionada.fecha_verificacion && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Verificación:</span>
                        <span className="font-medium text-gray-800">{formatearFechaHora(ordenSeleccionada.fecha_verificacion)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  {obtenerIconoTipoEntrega(ordenSeleccionada.tipo_entrega)}
                  Información de Entrega
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Tipo de Entrega:</span>
                    <p className="font-medium text-gray-800">{ordenSeleccionada.tipo_entrega}</p>
                  </div>
                  {ordenSeleccionada.tipo_entrega === 'Vehiculo Empresa' && (
                    <>
                      {ordenSeleccionada.vehiculo_placa && (
                        <div>
                          <span className="text-gray-500">Vehículo:</span>
                          <p className="font-medium text-gray-800">
                            {ordenSeleccionada.vehiculo_placa} - {ordenSeleccionada.vehiculo_marca} {ordenSeleccionada.vehiculo_modelo}
                          </p>
                        </div>
                      )}
                      {ordenSeleccionada.conductor_nombre && (
                        <div>
                          <span className="text-gray-500">Conductor:</span>
                          <p className="font-medium text-gray-800">{ordenSeleccionada.conductor_nombre}</p>
                          {ordenSeleccionada.conductor_dni && (
                            <p className="text-xs text-gray-500">DNI: {ordenSeleccionada.conductor_dni}</p>
                          )}
                          {ordenSeleccionada.conductor_licencia && (
                            <p className="text-xs text-gray-500">Licencia: {ordenSeleccionada.conductor_licencia}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {ordenSeleccionada.tipo_entrega === 'Transporte Privado' && (
                    <>
                      {ordenSeleccionada.transporte_nombre && (
                        <div>
                          <span className="text-gray-500">Empresa de Transporte:</span>
                          <p className="font-medium text-gray-800">{ordenSeleccionada.transporte_nombre}</p>
                        </div>
                      )}
                      {ordenSeleccionada.transporte_placa && (
                        <div>
                          <span className="text-gray-500">Placa:</span>
                          <p className="font-medium text-gray-800">{ordenSeleccionada.transporte_placa}</p>
                        </div>
                      )}
                      {ordenSeleccionada.transporte_conductor && (
                        <div>
                          <span className="text-gray-500">Conductor:</span>
                          <p className="font-medium text-gray-800">{ordenSeleccionada.transporte_conductor}</p>
                          {ordenSeleccionada.transporte_dni && (
                            <p className="text-xs text-gray-500">DNI: {ordenSeleccionada.transporte_dni}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {ordenSeleccionada.direccion_entrega && (
                    <div className="md:col-span-2">
                      <span className="text-gray-500 flex items-center gap-1">
                        <MapPin size={14} /> Dirección de Entrega:
                      </span>
                      <p className="font-medium text-gray-800">{ordenSeleccionada.direccion_entrega}</p>
                      {ordenSeleccionada.ciudad_entrega && (
                        <p className="text-xs text-gray-500">{ordenSeleccionada.ciudad_entrega}</p>
                      )}
                    </div>
                  )}
                  {ordenSeleccionada.contacto_entrega && (
                    <div>
                      <span className="text-gray-500">Contacto:</span>
                      <p className="font-medium text-gray-800">{ordenSeleccionada.contacto_entrega}</p>
                      {ordenSeleccionada.telefono_entrega && (
                        <p className="text-xs text-gray-500">{ordenSeleccionada.telefono_entrega}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {ordenSeleccionada.detalles && ordenSeleccionada.detalles.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Package size={18} className="text-purple-600" />
                    Productos ({ordenSeleccionada.detalles.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Producto</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600">Código</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600">Cantidad</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">P. Unitario</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Descuento</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Subtotal</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600">Despachado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ordenSeleccionada.detalles.map((det, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-800">{det.producto_nombre}</div>
                              {det.descripcion && (
                                <div className="text-xs text-gray-500">{det.descripcion}</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-600 font-mono text-xs">
                              {det.codigo_producto}
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-gray-800">
                              {det.cantidad} {det.unidad_medida}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {ordenSeleccionada.moneda} {det.precio_unitario}
                            </td>
                            <td className="px-3 py-2 text-right text-red-600">
                              {parseFloat(det.descuento) > 0 ? `-${ordenSeleccionada.moneda} ${det.descuento}` : '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-gray-800">
                              {ordenSeleccionada.moneda} {det.subtotal}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                det.cantidad_despachada >= det.cantidad 
                                  ? 'bg-green-100 text-green-800' 
                                  : det.cantidad_despachada > 0 
                                    ? 'bg-yellow-100 text-yellow-800' 
                                    : 'bg-gray-100 text-gray-600'
                              }`}>
                                {det.cantidad_despachada}/{det.cantidad}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-5">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <CreditCard size={18} className="text-blue-600" />
                  Resumen Financiero
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold text-gray-800">{ordenSeleccionada.moneda} {ordenSeleccionada.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{ordenSeleccionada.tipo_impuesto} ({ordenSeleccionada.porcentaje_impuesto}%):</span>
                      <span className="font-semibold text-gray-800">{ordenSeleccionada.moneda} {ordenSeleccionada.igv}</span>
                    </div>
                    <div className="flex justify-between text-lg border-t border-gray-300 pt-2">
                      <span className="font-bold text-gray-800">Total:</span>
                      <span className="font-bold text-blue-600">{ordenSeleccionada.moneda} {ordenSeleccionada.total}</span>
                    </div>
                    {ordenSeleccionada.moneda === 'USD' && (
                      <div className="flex justify-between text-xs text-gray-500 border-t border-gray-200 pt-2">
                        <span>Equivalente en PEN (TC: {ordenSeleccionada.tipo_cambio}):</span>
                        <span className="font-semibold">{ordenSeleccionada.total_pen}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Monto Pagado:</span>
                      <span className="font-semibold text-green-600">{ordenSeleccionada.moneda} {ordenSeleccionada.monto_pagado}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Pendiente de Cobro:</span>
                      <span className="font-semibold text-red-600">{ordenSeleccionada.moneda} {ordenSeleccionada.pendiente_cobro}</span>
                    </div>
                    {parseFloat(ordenSeleccionada.total_comision) > 0 && (
                      <div className="flex justify-between text-sm border-t border-gray-300 pt-2">
                        <span className="text-gray-600">Comisión ({ordenSeleccionada.porcentaje_comision_promedio}%):</span>
                        <span className="font-semibold text-purple-600">{ordenSeleccionada.moneda} {ordenSeleccionada.total_comision}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-2 text-sm">Personal Involucrado</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Vendedor:</span>
                      <span className="font-medium text-gray-800">{ordenSeleccionada.vendedor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Registrado por:</span>
                      <span className="font-medium text-gray-800">{ordenSeleccionada.registrador}</span>
                    </div>
                    {ordenSeleccionada.verificador !== 'No asignado' && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Verificador:</span>
                        <span className="font-medium text-gray-800">{ordenSeleccionada.verificador}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-2 text-sm">Documentos Asociados</h4>
                  <div className="space-y-1 text-sm">
                    {ordenSeleccionada.numero_cotizacion && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Cotización:</span>
                        <span className="font-medium text-gray-800">{ordenSeleccionada.numero_cotizacion}</span>
                      </div>
                    )}
                    {ordenSeleccionada.numero_guia_interna && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Guía Interna:</span>
                        <span className="font-medium text-gray-800">{ordenSeleccionada.numero_guia_interna}</span>
                      </div>
                    )}
                    {ordenSeleccionada.orden_compra_cliente && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">OC Cliente:</span>
                        <span className="font-medium text-gray-800">{ordenSeleccionada.orden_compra_cliente}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(ordenSeleccionada.observaciones || ordenSeleccionada.observaciones_verificador || ordenSeleccionada.motivo_rechazo) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <FileCheck size={16} className="text-yellow-600" />
                    Observaciones
                  </h4>
                  <div className="space-y-2 text-sm">
                    {ordenSeleccionada.observaciones && (
                      <div>
                        <span className="font-medium text-gray-700">Observaciones generales:</span>
                        <p className="text-gray-600 mt-1">{ordenSeleccionada.observaciones}</p>
                      </div>
                    )}
                    {ordenSeleccionada.observaciones_verificador && (
                      <div>
                        <span className="font-medium text-gray-700">Observaciones del verificador:</span>
                        <p className="text-gray-600 mt-1">{ordenSeleccionada.observaciones_verificador}</p>
                      </div>
                    )}
                    {ordenSeleccionada.motivo_rechazo && (
                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <span className="font-medium text-red-700">Motivo de rechazo:</span>
                        <p className="text-red-600 mt-1">{ordenSeleccionada.motivo_rechazo}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end">
              <button
                onClick={() => setMostrarDetalleOrden(false)}
                className="btn btn-secondary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReporteVentas;