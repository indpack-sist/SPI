import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, TrendingUp, TrendingDown, Calendar, 
  Filter, Download, ArrowUpCircle, ArrowDownCircle,
  CreditCard, Building2, User, FileText, AlertTriangle,
  Clock, CheckCircle, XCircle, LayoutList, AlertCircle
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { pagosCobranzasAPI, cuentasPagoAPI } from '../../config/api';

function PagosCobranzas() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados de datos
  const [movimientos, setMovimientos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState([]);
  
  // Control de interfaz
  const [activeTab, setActiveTab] = useState('movimientos'); // 'movimientos' | 'cobranzas'

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
      
      setResumen(resumenRes.data.data);
      setMovimientos(movimientosRes.data.data);
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
      // Filtros específicos para deudas si es necesario
      const response = await pagosCobranzasAPI.getCuentasPorCobrar(filtros);
      setCuentasPorCobrar(response.data.data || []);
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
    alert('Función de exportar a Excel - Implementar según necesidad');
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE', {timeZone: 'UTC'});
  };

  const formatearMoneda = (valor, moneda = 'PEN') => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toFixed(2)}`;
  };

  // --- COLUMNAS PARA MOVIMIENTOS (HISTORIAL) ---
  const columnsMovimientos = [
    {
      header: 'Tipo',
      accessor: 'tipo',
      width: '120px',
      align: 'center',
      render: (value) => {
        const isPago = value === 'pago';
        return (
          <div className={`flex items-center gap-2 justify-center ${isPago ? 'text-red-600' : 'text-green-600'}`}>
            {isPago ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
            <span className="font-medium">{isPago ? 'Egreso' : 'Ingreso'}</span>
          </div>
        );
      }
    },
    {
      header: 'Referencia',
      accessor: 'numero_pago',
      width: '140px',
      render: (value, row) => (
        <div>
          <div className="font-mono font-bold">{value}</div>
          <div className="text-xs text-muted">{row.documento_referencia}</div>
        </div>
      )
    },
    {
      header: 'Fecha',
      accessor: 'fecha_pago',
      width: '110px',
      render: (value) => formatearFecha(value)
    },
    {
      header: 'Entidad / Cliente',
      accessor: 'tercero',
      render: (value) => <span className="font-medium">{value || 'Sin especificar'}</span>
    },
    {
      header: 'Monto',
      accessor: 'monto_pagado',
      width: '130px',
      align: 'right',
      render: (value, row) => (
        <span className={`font-bold text-lg ${row.tipo === 'pago' ? 'text-red-600' : 'text-green-600'}`}>
          {row.tipo === 'pago' ? '-' : '+'}{formatearMoneda(value, row.moneda)}
        </span>
      )
    },
    {
      header: 'Método',
      accessor: 'metodo_pago',
      width: '120px',
      align: 'center',
      render: (value) => <span className="badge badge-secondary">{value}</span>
    }
  ];

  // --- COLUMNAS PARA CUENTAS POR COBRAR (DEUDA) ---
  const columnsCobranzas = [
    {
      header: 'Estado',
      accessor: 'estado_deuda', // Viene de la Vista SQL
      width: '160px',
      align: 'center',
      render: (value, row) => {
        let config = { color: 'badge-secondary', icon: Clock, text: value };
        
        switch(value) {
          case 'Vencido':
            config = { color: 'badge-danger', icon: XCircle, text: 'Vencido' };
            break;
          case 'Proximo a Vencer':
            config = { color: 'badge-warning', icon: AlertTriangle, text: 'Próx. Vencer' };
            break;
          case 'Al Dia':
            config = { color: 'badge-success', icon: CheckCircle, text: 'Al Día' };
            break;
          default:
            config = { color: 'badge-secondary', icon: Clock, text: value };
        }
        
        const Icon = config.icon;
        
        return (
          <div className="flex flex-col items-center gap-1">
            <span className={`badge ${config.color} flex items-center gap-1`}>
              <Icon size={14} /> {config.text}
            </span>
            <span className={`text-[10px] font-bold ${row.dias_restantes < 0 ? 'text-danger' : 'text-muted'}`}>
              {row.dias_restantes < 0 
                ? `${Math.abs(row.dias_restantes)} días atraso` 
                : `${row.dias_restantes} días restantes`}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Orden Venta',
      accessor: 'numero_orden',
      width: '120px',
      render: (value, row) => (
        <button 
          className="font-mono font-bold text-primary hover:underline"
          onClick={() => navigate(`/ventas/ordenes/${row.id_orden_venta}`)}
        >
          {value}
        </button>
      )
    },
    {
      header: 'Cliente',
      accessor: 'cliente',
      render: (value, row) => (
        <div>
          <div className="font-bold">{value}</div>
          <div className="text-xs text-muted flex gap-2">
            <span>RUC: {row.ruc}</span>
            {row.telefono && <span>📞 {row.telefono}</span>}
          </div>
        </div>
      )
    },
    {
      header: 'Vencimiento',
      accessor: 'fecha_vencimiento',
      width: '110px',
      render: (value) => (
        <div className="font-medium text-gray-700">
          {formatearFecha(value)}
        </div>
      )
    },
    {
      header: 'Total',
      accessor: 'total',
      width: '120px',
      align: 'right',
      render: (value, row) => formatearMoneda(value, row.moneda)
    },
    {
      header: 'A Cuenta',
      accessor: 'monto_pagado',
      width: '120px',
      align: 'right',
      render: (value, row) => (
        <span className="text-success">{formatearMoneda(value, row.moneda)}</span>
      )
    },
    {
      header: 'Saldo Pendiente',
      accessor: 'saldo_pendiente',
      width: '130px',
      align: 'right',
      render: (value, row) => (
        <span className="font-bold text-lg text-danger">
          {formatearMoneda(value, row.moneda)}
        </span>
      )
    },
    {
      header: 'Días Crédito',
      accessor: 'dias_credito',
      width: '90px',
      align: 'center',
      render: (value) => <span className="badge badge-outline">{value} días</span>
    }
  ];

  if (loading && !resumen && activeTab === 'movimientos') {
    return <Loading message="Cargando información financiera..." />;
  }

  return (
    <div className="p-6">
      {/* Header */}
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
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'movimientos' 
                ? 'bg-white text-primary shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('movimientos')}
          >
            <div className="flex items-center gap-2">
              <LayoutList size={16} /> Movimientos
            </div>
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'cobranzas' 
                ? 'bg-white text-danger shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('cobranzas')}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} /> Cuentas por Cobrar
            </div>
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* DASHBOARD SOLO VISIBLE EN MOVIMIENTOS */}
      {activeTab === 'movimientos' && resumen && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card border-l-4 border-danger">
            <div className="card-body">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted">Egresos (Pagos)</p>
                  <h3 className="text-2xl font-bold text-danger">{resumen.pagos.cantidad}</h3>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <ArrowDownCircle size={24} className="text-danger" />
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>PEN:</span> <span className="font-bold">{formatearMoneda(resumen.pagos.pen, 'PEN')}</span></div>
                <div className="flex justify-between"><span>USD:</span> <span className="font-bold">{formatearMoneda(resumen.pagos.usd, 'USD')}</span></div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-success">
            <div className="card-body">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted">Ingresos (Cobros)</p>
                  <h3 className="text-2xl font-bold text-success">{resumen.cobranzas.cantidad}</h3>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <ArrowUpCircle size={24} className="text-success" />
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>PEN:</span> <span className="font-bold">{formatearMoneda(resumen.cobranzas.pen, 'PEN')}</span></div>
                <div className="flex justify-between"><span>USD:</span> <span className="font-bold">{formatearMoneda(resumen.cobranzas.usd, 'USD')}</span></div>
              </div>
            </div>
          </div>

          {/* Flujo Neto */}
          {['pen', 'usd'].map((moneda) => (
            <div key={moneda} className={`card border-l-4 ${resumen.flujo_neto[moneda] >= 0 ? 'border-primary' : 'border-warning'}`}>
              <div className="card-body">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-muted">Flujo Neto {moneda.toUpperCase()}</p>
                    <h3 className={`text-2xl font-bold ${resumen.flujo_neto[moneda] >= 0 ? 'text-primary' : 'text-warning'}`}>
                      {formatearMoneda(resumen.flujo_neto[moneda], moneda.toUpperCase())}
                    </h3>
                  </div>
                  <div className={`p-3 rounded-lg ${resumen.flujo_neto[moneda] >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                    <TrendingUp size={24} className={resumen.flujo_neto[moneda] >= 0 ? 'text-primary' : 'text-warning'} />
                  </div>
                </div>
                <p className="text-xs text-muted">Balance del periodo seleccionado</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FILTROS GENERALES */}
      <div className="card mb-4">
        <div className="card-body p-4">
          <div className="flex flex-wrap items-end gap-4">
            {activeTab === 'movimientos' && (
              <div className="w-40">
                <label className="form-label text-xs">Tipo Movimiento</label>
                <select className="form-select form-select-sm" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}>
                  <option value="">Todos</option>
                  <option value="pago">Egresos</option>
                  <option value="cobranza">Ingresos</option>
                </select>
              </div>
            )}
            
            <div className="w-40">
              <label className="form-label text-xs">Fecha Inicio</label>
              <input type="date" className="form-input form-input-sm" value={filtros.fecha_inicio} onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })} />
            </div>

            <div className="w-40">
              <label className="form-label text-xs">Fecha Fin</label>
              <input type="date" className="form-input form-input-sm" value={filtros.fecha_fin} onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })} />
            </div>

            {activeTab === 'movimientos' && (
              <div className="w-40">
                <label className="form-label text-xs">Cuenta</label>
                <select className="form-select form-select-sm" value={filtros.id_cuenta} onChange={(e) => setFiltros({ ...filtros, id_cuenta: e.target.value })}>
                  <option value="">Todas</option>
                  {cuentas.map(c => <option key={c.id_cuenta} value={c.id_cuenta}>{c.nombre}</option>)}
                </select>
              </div>
            )}

            <div className="flex gap-2 ml-auto">
              <button className="btn btn-outline btn-sm" onClick={limpiarFiltros}>
                <Filter size={14} className="mr-1"/> Limpiar
              </button>
              <button className="btn btn-success btn-sm" onClick={exportarExcel}>
                <Download size={14} className="mr-1"/> Exportar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="card">
        <div className="card-header border-b-0">
          <h2 className="card-title">
            {activeTab === 'movimientos' ? 'Historial de Transacciones' : 'Cartera de Clientes (Crédito)'}
            <span className="badge badge-primary ml-2">
              {activeTab === 'movimientos' ? movimientos.length : cuentasPorCobrar.length}
            </span>
          </h2>
        </div>
        <div className="card-body p-0">
          {activeTab === 'movimientos' ? (
            <Table
              columns={columnsMovimientos}
              data={movimientos}
              emptyMessage="No hay movimientos en el período seleccionado"
            />
          ) : (
            <Table
              columns={columnsCobranzas}
              data={cuentasPorCobrar}
              emptyMessage="No hay cuentas por cobrar pendientes (¡Todo al día!)"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default PagosCobranzas;