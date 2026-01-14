import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, TrendingUp, Calendar, Filter, Download, 
  ArrowUpCircle, ArrowDownCircle, AlertCircle, LayoutList,
  FileText, CheckCircle, XCircle, AlertTriangle, FileBadge, Clock,
  Truck, Package
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { pagosCobranzasAPI, cuentasPagoAPI } from '../../config/api';

function PagosCobranzas() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [movimientos, setMovimientos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState([]);
  
  const [activeTab, setActiveTab] = useState('movimientos');

  const [filtros, setFiltros] = useState({
    tipo: '',
    fecha_inicio: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0],
    metodo_pago: '',
    id_cuenta: ''
  });

  useEffect(() => {
    cargarCuentas();
  }, []);

  useEffect(() => {
    if (activeTab === 'movimientos') {
      cargarMovimientos();
    } else {
      cargarDeudas();
    }
  }, [filtros, activeTab]);

  const cargarCuentas = async () => {
    try {
      const response = await cuentasPagoAPI.getAll({ estado: 'Activo' });
      setCuentas(response.data.data || []);
    } catch (err) {
      console.error('Error al cargar cuentas:', err);
    }
  };

  const cargarMovimientos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [resumenRes, movimientosRes] = await Promise.all([
        pagosCobranzasAPI.getResumen(filtros),
        pagosCobranzasAPI.getAll(filtros)
      ]);
      
      if (resumenRes.data.success) setResumen(resumenRes.data.data);
      if (movimientosRes.data.success) setMovimientos(movimientosRes.data.data);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar movimientos');
    } finally {
      setLoading(false);
    }
  };

  const cargarDeudas = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await pagosCobranzasAPI.getCuentasPorCobrar(filtros);
      
      if (response.data.success) {
        setCuentasPorCobrar(response.data.data || []);
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar cuentas por cobrar');
    } finally {
      setLoading(false);
    }
  };

  const limpiarFiltros = () => {
    setFiltros({
      tipo: '',
      fecha_inicio: new Date(new Date().setDate(1)).toISOString().split('T')[0],
      fecha_fin: new Date().toISOString().split('T')[0],
      metodo_pago: '',
      id_cuenta: ''
    });
  };

  const exportarExcel = () => {
    alert('Función de exportar a Excel');
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    const parts = fecha.split('T')[0].split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`; 
  };

  const formatearMoneda = (valor, moneda = 'PEN') => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toFixed(2)}`;
  };

  // Helper para el color y estilo del estado de la orden
  const getOrderStateConfig = (estado) => {
    switch (estado) {
      case 'En Espera': return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock };
      case 'En Proceso': return { bg: 'bg-blue-100', text: 'text-blue-800', icon: Package };
      case 'Atendido por Producción': return { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: CheckCircle };
      case 'Despachada': return { bg: 'bg-purple-100', text: 'text-purple-800', icon: Truck };
      case 'Entregada': return { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle };
      case 'Cancelada': return { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle };
      default: return { bg: 'bg-gray-100', text: 'text-gray-800', icon: FileText };
    }
  };

  const columnsMovimientos = [
    {
      header: 'Tipo',
      accessor: 'tipo',
      width: '110px',
      align: 'center',
      render: (value) => {
        const isPago = value === 'pago';
        return (
          <div className={`flex items-center gap-2 justify-center ${isPago ? 'text-red-600' : 'text-green-600'}`}>
            {isPago ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
            <span className="font-medium text-xs uppercase">{isPago ? 'Egreso' : 'Ingreso'}</span>
          </div>
        );
      }
    },
    {
      header: 'Referencia',
      accessor: 'numero_pago',
      width: '180px',
      render: (value, row) => (
        <div>
          <div className="font-mono font-bold text-gray-800">{value}</div>
          {row.tipo === 'cobranza' ? (
            <button 
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline hover:text-blue-800 mt-0.5 cursor-pointer bg-transparent border-0 p-0"
              onClick={() => navigate(`/ventas/ordenes/${row.id_orden}`)}
            >
              <FileBadge size={12} />
              <span className="font-semibold">
                Ref: {row.documento_referencia}
              </span>
            </button>
          ) : (
            <div className="text-xs text-muted">Doc: {row.documento_referencia}</div>
          )}
        </div>
      )
    },
    {
      header: 'Fecha',
      accessor: 'fecha_pago',
      width: '100px',
      render: (value) => <span className="text-sm">{formatearFecha(value)}</span>
    },
    {
      header: 'Entidad / Cliente',
      accessor: 'tercero',
      render: (value) => <span className="font-medium text-sm">{value || 'Sin especificar'}</span>
    },
    {
      header: 'Monto',
      accessor: 'monto_pagado',
      width: '130px',
      align: 'right',
      render: (value, row) => (
        <span className={`font-bold text-sm ${row.tipo === 'pago' ? 'text-red-600' : 'text-green-600'}`}>
          {row.tipo === 'pago' ? '-' : '+'}{formatearMoneda(value, row.moneda)}
        </span>
      )
    },
    {
      header: 'Método',
      accessor: 'metodo_pago',
      width: '120px',
      align: 'center',
      render: (value) => <span className="badge badge-secondary badge-sm">{value}</span>
    }
  ];

  const columnsCobranzas = [
    {
      header: 'Estado Deuda',
      accessor: 'estado_deuda',
      width: '150px',
      align: 'center',
      render: (estadoBackend, row) => {
        let estadoConfig = {};
        const dias = row.dias_restantes;
        
        if (row.tipo_venta === 'Contado') {
          estadoConfig = {
            color: 'badge-danger',
            texto: 'Pago Pendiente',
            icono: AlertCircle,
            mensaje: 'Saldo por regularizar'
          };
        } else {
          switch(estadoBackend) {
            case 'Vencido': 
              estadoConfig = {
                color: 'badge-danger',
                texto: 'Vencido',
                icono: XCircle,
                mensaje: `${Math.abs(dias)} días de atraso`
              };
              break;
            case 'Proximo a Vencer': 
              estadoConfig = {
                color: 'badge-warning',
                texto: 'Por Vencer',
                icono: AlertTriangle,
                mensaje: `Vence en ${dias} días`
              };
              break;
            default:
              estadoConfig = {
                color: 'badge-success',
                texto: 'Al Día',
                icono: CheckCircle,
                mensaje: `Quedan ${dias} días`
              };
          }
        }

        const Icon = estadoConfig.icono;

        return (
          <div className="flex flex-col items-center gap-1">
            <span className={`badge ${estadoConfig.color} flex items-center gap-1 w-full justify-center`}>
              <Icon size={12} /> {estadoConfig.texto}
            </span>
            <span className={`text-[10px] font-bold ${estadoConfig.color === 'badge-success' ? 'text-green-600' : 'text-red-600'}`}>
              {estadoConfig.mensaje}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Documento',
      accessor: 'numero_orden',
      width: '160px',
      render: (value, row) => (
        <div className="flex flex-col">
          <button 
            className="font-mono font-bold text-blue-600 hover:underline text-sm text-left flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
            onClick={() => navigate(`/ventas/ordenes/${row.id_orden_venta}`)}
          >
            <FileText size={14} />
            {value}
          </button>
          
          <div className="text-[10px] text-muted mt-1">
            Emisión: {formatearFecha(row.fecha_emision)}
          </div>
        </div>
      )
    },
    {
      header: 'Cliente',
      accessor: 'cliente',
      render: (value, row) => (
        <div>
          <div className="font-bold text-sm truncate max-w-[200px]" title={value}>{value}</div>
          <div className="text-xs text-muted flex gap-2">
            <span>RUC: {row.ruc}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Vencimiento',
      accessor: 'fecha_vencimiento',
      width: '140px', // Aumentado para dar espacio al estado
      align: 'center',
      render: (value, row) => {
        const orderState = getOrderStateConfig(row.estado); // Usamos el helper
        
        return (
          <div 
            className="flex flex-col items-center cursor-pointer group relative"
            title={`Estado de la Orden: ${row.estado}`} // Tooltip nativo
          >
            <div className="font-medium text-gray-700 text-sm">
              {formatearFecha(value)}
            </div>
            
            {/* Estado de la Orden Notorio */}
            <div className={`mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${orderState.bg} ${orderState.text} border-transparent group-hover:border-current transition-all`}>
              {row.estado}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Importe Total',
      accessor: 'total',
      width: '110px',
      align: 'right',
      render: (value, row) => (
        <span className="text-gray-600 font-medium text-sm">
          {formatearMoneda(value, row.moneda)}
        </span>
      )
    },
    {
      header: 'A Cuenta',
      accessor: 'monto_pagado',
      width: '110px',
      align: 'right',
      render: (value, row) => (
        <div className="flex flex-col items-end">
          <span className="text-success text-sm font-medium">{formatearMoneda(value, row.moneda)}</span>
          <div className="w-16 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-success transition-all duration-500" 
              style={{ width: `${Math.min(100, (parseFloat(value)/parseFloat(row.total))*100)}%` }}
            ></div>
          </div>
        </div>
      )
    },
    {
      header: 'Saldo Pendiente',
      accessor: 'saldo_pendiente',
      width: '120px',
      align: 'right',
      render: (value, row) => (
        <span className="font-bold text-base text-red-600">
          {formatearMoneda(value, row.moneda)}
        </span>
      )
    }
  ];

  if (loading && !resumen && activeTab === 'movimientos') {
    return <Loading message="Cargando información financiera..." />;
  }

  const cuentasContado = cuentasPorCobrar.filter(c => c.tipo_venta === 'Contado');
  const cuentasCredito = cuentasPorCobrar.filter(c => c.tipo_venta !== 'Contado');

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign size={32} className="text-primary" />
            Finanzas y Cobranzas
          </h1>
          <p className="text-muted">Gestión de flujo de caja y cuentas por cobrar</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'movimientos' 
                ? 'bg-white text-primary shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('movimientos')}
          >
            <LayoutList size={16} /> Movimientos
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'cobranzas' 
                ? 'bg-white text-danger shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('cobranzas')}
          >
            <AlertCircle size={16} /> Cuentas por Cobrar
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {activeTab === 'movimientos' && resumen && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card border-l-4 border-danger hover:shadow-md transition-shadow">
            <div className="card-body">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted font-medium uppercase">Egresos (Pagos)</p>
                  <h3 className="text-2xl font-bold text-danger">{resumen.pagos.cantidad}</h3>
                </div>
                <div className="p-3 bg-red-50 rounded-full">
                  <ArrowDownCircle size={24} className="text-danger" />
                </div>
              </div>
              <div className="space-y-1 text-sm border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">PEN:</span> 
                  <span className="font-bold text-gray-800">{formatearMoneda(resumen.pagos.pen, 'PEN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">USD:</span> 
                  <span className="font-bold text-gray-800">{formatearMoneda(resumen.pagos.usd, 'USD')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-success hover:shadow-md transition-shadow">
            <div className="card-body">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted font-medium uppercase">Ingresos (Cobros)</p>
                  <h3 className="text-2xl font-bold text-success">{resumen.cobranzas.cantidad}</h3>
                </div>
                <div className="p-3 bg-green-50 rounded-full">
                  <ArrowUpCircle size={24} className="text-success" />
                </div>
              </div>
              <div className="space-y-1 text-sm border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">PEN:</span> 
                  <span className="font-bold text-gray-800">{formatearMoneda(resumen.cobranzas.pen, 'PEN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">USD:</span> 
                  <span className="font-bold text-gray-800">{formatearMoneda(resumen.cobranzas.usd, 'USD')}</span>
                </div>
              </div>
            </div>
          </div>

          {['pen', 'usd'].map((moneda) => (
            <div key={moneda} className={`card border-l-4 ${resumen.flujo_neto[moneda] >= 0 ? 'border-primary' : 'border-warning'} hover:shadow-md transition-shadow`}>
              <div className="card-body">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-muted font-medium uppercase">Flujo Neto {moneda.toUpperCase()}</p>
                    <h3 className={`text-2xl font-bold ${resumen.flujo_neto[moneda] >= 0 ? 'text-primary' : 'text-warning'}`}>
                      {formatearMoneda(resumen.flujo_neto[moneda], moneda.toUpperCase())}
                    </h3>
                  </div>
                  <div className={`p-3 rounded-full ${resumen.flujo_neto[moneda] >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                    <TrendingUp size={24} className={resumen.flujo_neto[moneda] >= 0 ? 'text-primary' : 'text-warning'} />
                  </div>
                </div>
                <p className="text-xs text-muted mt-4">Balance del periodo seleccionado</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card mb-4 bg-gray-50 border border-gray-200">
        <div className="card-body p-4">
          <div className="flex flex-wrap items-end gap-4">
            {activeTab === 'movimientos' && (
              <div className="w-40">
                <label className="form-label text-xs font-semibold uppercase text-gray-500 mb-1">Tipo Movimiento</label>
                <select className="form-select form-select-sm" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}>
                  <option value="">Todos</option>
                  <option value="pago">Egresos (Pagos)</option>
                  <option value="cobranza">Ingresos (Cobros)</option>
                </select>
              </div>
            )}
            
            <div className="w-36">
              <label className="form-label text-xs font-semibold uppercase text-gray-500 mb-1">
                {activeTab === 'movimientos' ? 'Fecha Inicio' : 'Vencimiento Desde'}
              </label>
              <input type="date" className="form-input form-input-sm" value={filtros.fecha_inicio} onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })} />
            </div>

            <div className="w-36">
              <label className="form-label text-xs font-semibold uppercase text-gray-500 mb-1">
                {activeTab === 'movimientos' ? 'Fecha Fin' : 'Vencimiento Hasta'}
              </label>
              <input type="date" className="form-input form-input-sm" value={filtros.fecha_fin} onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })} />
            </div>

            {activeTab === 'movimientos' && (
              <div className="w-40">
                <label className="form-label text-xs font-semibold uppercase text-gray-500 mb-1">Cuenta</label>
                <select className="form-select form-select-sm" value={filtros.id_cuenta} onChange={(e) => setFiltros({ ...filtros, id_cuenta: e.target.value })}>
                  <option value="">Todas</option>
                  {cuentas.map(c => <option key={c.id_cuenta} value={c.id_cuenta}>{c.nombre}</option>)}
                </select>
              </div>
            )}

            <div className="flex gap-2 ml-auto">
              <button className="btn btn-outline btn-sm bg-white hover:bg-gray-100 text-gray-700 border-gray-300" onClick={limpiarFiltros}>
                <Filter size={14} className="mr-1"/> Limpiar
              </button>
              <button className="btn btn-success btn-sm text-white shadow-sm" onClick={exportarExcel}>
                <Download size={14} className="mr-1"/> Exportar
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'movimientos' ? (
        <div className="card">
          <div className="card-header border-b-0">
            <h2 className="card-title">
              Historial de Transacciones
              <span className="badge badge-primary ml-2">
                {movimientos.length}
              </span>
            </h2>
          </div>
          <div className="card-body p-0">
            <Table
              columns={columnsMovimientos}
              data={movimientos}
              emptyMessage="No hay movimientos en el período seleccionado"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card border-l-4 border-red-500">
            <div className="card-header border-b-0">
              <h2 className="card-title text-red-700">
                <AlertCircle size={20} />
                Pendientes de Pago (Contado)
                <span className="badge badge-danger ml-2">
                  {cuentasContado.length}
                </span>
              </h2>
            </div>
            <div className="card-body p-0">
              <Table
                columns={columnsCobranzas}
                data={cuentasContado}
                emptyMessage="No hay órdenes al contado pendientes de pago"
              />
            </div>
          </div>

          <div className="card border-l-4 border-blue-500">
            <div className="card-header border-b-0">
              <h2 className="card-title text-blue-700">
                <Clock size={20} />
                Cartera de Crédito
                <span className="badge badge-info ml-2">
                  {cuentasCredito.length}
                </span>
              </h2>
            </div>
            <div className="card-body p-0">
              <Table
                columns={columnsCobranzas}
                data={cuentasCredito}
                emptyMessage="No hay créditos pendientes de cobro"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PagosCobranzas;