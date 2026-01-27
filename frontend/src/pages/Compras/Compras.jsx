import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Eye, ShoppingCart, Filter, Clock, CheckCircle,
  XCircle, AlertCircle, TrendingUp, Wallet, CreditCard,
  Calendar, PackageCheck, Truck, Package, Receipt, User,
  RefreshCw
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { comprasAPI, cuentasPagoAPI } from '../../config/api';

function Compras() {
  const navigate = useNavigate();
  
  const [compras, setCompras] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [alertas, setAlertas] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [filtros, setFiltros] = useState({
    estado: '',
    tipo_compra: '',
    tipo_cuenta: '',
    id_cuenta_pago: '',
    fecha_inicio: '',
    fecha_fin: '',
    alertas: ''
  });

  useEffect(() => {
    cargarDatos();
  }, [filtros]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filtrosActivos = Object.fromEntries(
        Object.entries(filtros).filter(([_, value]) => value !== '')
      );
      
      const [comprasRes, statsRes, alertasRes, cuentasRes] = await Promise.all([
        comprasAPI.getAll(filtrosActivos),
        comprasAPI.getEstadisticas(filtrosActivos),
        comprasAPI.getAlertas(filtrosActivos),
        cuentasPagoAPI.getAll({ estado: 'Activo' })
      ]);
      
      if (comprasRes.data.success) {
        setCompras(comprasRes.data.data || []);
      }
      
      if (statsRes.data.success) {
        setEstadisticas(statsRes.data.data || null);
      }

      if (alertasRes.data.success) {
        setAlertas(alertasRes.data.data || null);
      }

      if (cuentasRes.data.success) {
        setCuentas(cuentasRes.data.data || []);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar compras');
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatearMoneda = (valor, moneda) => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  };

  const getEstadoPagoConfig = (estado) => {
    const configs = {
      'Pendiente': { clase: 'badge-warning', texto: 'Pendiente' },
      'Parcial': { clase: 'badge-info', texto: 'Parcial' },
      'Pagado': { clase: 'badge-success', texto: 'Pagado' }
    };
    return configs[estado] || configs['Pendiente'];
  };

  const getEstadoRecepcionConfig = (estado) => {
    const configs = {
      'Recibida': { clase: 'bg-green-100 text-green-800 border-green-200', icono: PackageCheck, texto: 'Recibido' },
      'Confirmada': { clase: 'bg-blue-100 text-blue-800 border-blue-200', icono: Clock, texto: 'Por Recibir' },
      'En Tránsito': { clase: 'bg-yellow-100 text-yellow-800 border-yellow-200', icono: Truck, texto: 'En Tránsito' },
      'Cancelada': { clase: 'bg-red-100 text-red-800 border-red-200', icono: XCircle, texto: 'Cancelada' }
    };
    return configs[estado] || { clase: 'bg-gray-100 text-gray-800 border-gray-200', icono: Package, texto: estado };
  };

  const getFormaPagoConfig = (forma) => {
    const configs = {
      'Contado': { clase: 'text-green-700', icono: Wallet, texto: 'Contado' },
      'Credito': { clase: 'text-orange-700', icono: CreditCard, texto: 'Crédito' },
      'Letras': { clase: 'text-purple-700', icono: Receipt, texto: 'Letras' }
    };
    return configs[forma] || configs['Contado'];
  };

  const columns = [
    {
      header: 'N° Compra',
      accessor: 'numero_orden',
      width: '140px',
      render: (value, row) => (
        <div>
          <span className="font-mono font-bold text-sm text-primary cursor-pointer hover:underline" onClick={() => navigate(`/compras/${row.id_orden_compra}`)}>
            {value}
          </span>
          <div className="text-xs text-muted flex items-center gap-1">
            <Calendar size={10} />
            {formatearFecha(row.fecha_emision)}
          </div>
        </div>
      )
    },
    {
      header: 'Proveedor',
      accessor: 'proveedor',
      render: (value, row) => (
        <div>
          <div className="font-medium truncate max-w-[200px]" title={value}>{value}</div>
          <div className="text-xs text-muted">RUC: {row.ruc_proveedor}</div>
        </div>
      )
    },
    {
      header: 'Recepción',
      accessor: 'estado',
      width: '120px',
      align: 'center',
      render: (value) => {
        const config = getEstadoRecepcionConfig(value);
        const Icono = config.icono;
        return (
            <span className={`px-2 py-1 rounded text-xs font-semibold flex items-center justify-center gap-1 border ${config.clase}`}>
                <Icono size={12} /> {config.texto}
            </span>
        );
      }
    },
    {
      header: 'Forma Pago',
      accessor: 'forma_pago_detalle',
      width: '110px',
      align: 'center',
      render: (value, row) => {
        const formaPago = row.forma_pago_detalle || row.tipo_compra;
        const config = getFormaPagoConfig(formaPago);
        const Icono = config.icono;
        return (
          <div className="flex flex-col items-center gap-1">
            <span className={`text-xs font-bold flex gap-1 items-center ${config.clase}`}>
              <Icono size={12} />
              {config.texto}
            </span>
            {formaPago === 'Credito' && row.cronograma_definido === 0 && (
                <span className="text-[9px] text-danger font-bold animate-pulse">Sin Cronograma</span>
            )}
            {formaPago === 'Letras' && row.letras_registradas === 0 && (
                <span className="text-[9px] text-purple-600 font-bold animate-pulse">Pendiente Registro</span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Indicadores',
      accessor: 'usa_fondos_propios',
      width: '100px',
      align: 'center',
      render: (value, row) => (
        <div className="flex flex-col items-center gap-1">
          {value === 1 && (
            <span className="badge badge-purple text-[10px] flex items-center gap-1">
              <User size={10} /> F.Propios
            </span>
          )}
          {row.estado_reembolso === 'Pendiente' && (
            <span className="badge badge-warning text-[10px] flex items-center gap-1">
              <RefreshCw size={10} /> Reembolso
            </span>
          )}
          {row.estado_reembolso === 'Parcial' && (
            <span className="badge badge-info text-[10px] flex items-center gap-1">
              <RefreshCw size={10} /> Reem.Parcial
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Total',
      accessor: 'total',
      width: '130px',
      align: 'right',
      render: (value, row) => (
        <div>
          <div className="font-bold text-gray-800">
            {formatearMoneda(value, row.moneda)}
          </div>
          {parseFloat(row.saldo_pendiente) > 0 && (
            <div className="text-xs text-danger font-medium">
              Debe: {formatearMoneda(row.saldo_pendiente, row.moneda)}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Pago',
      accessor: 'estado_pago',
      width: '120px',
      align: 'center',
      render: (value, row) => {
        const config = getEstadoPagoConfig(value);
        return (
          <div className="flex flex-col items-center">
            <span className={`badge ${config.clase}`}>
              {config.texto}
            </span>
            {row.dias_para_vencer !== null && row.estado_pago !== 'Pagado' && (
              <div className={`text-[10px] font-bold mt-1 ${row.dias_para_vencer < 0 ? 'text-danger' : row.dias_para_vencer <= 7 ? 'text-warning' : 'text-success'}`}>
                {row.dias_para_vencer < 0 ? `Vencido (${Math.abs(row.dias_para_vencer)}d)` : `${row.dias_para_vencer} días rest.`}
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Acciones',
      accessor: 'id_orden_compra',
      width: '80px',
      align: 'center',
      render: (value) => (
        <button
          className="btn btn-sm btn-ghost text-primary hover:bg-blue-50"
          onClick={() => navigate(`/compras/${value}`)}
          title="Ver detalle completo"
        >
          <Eye size={18} />
        </button>
      )
    }
  ];

  const actualizarFiltro = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      estado: '',
      tipo_compra: '',
      tipo_cuenta: '',
      id_cuenta_pago: '',
      fecha_inicio: '',
      fecha_fin: '',
      alertas: ''
    });
  };

  if (loading && !estadisticas) return <Loading message="Cargando módulo de compras..." />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart size={32} className="text-primary" />
            Gestión de Compras
          </h1>
          <p className="text-muted">Registro, control de pagos y trazabilidad</p>
        </div>
        <button 
          className="btn btn-primary shadow-lg hover:shadow-xl transition-all"
          onClick={() => navigate('/compras/nueva')}
        >
          <Plus size={20} />
          Registrar Compra
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {estadisticas && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="card hover:border-blue-300 transition-colors">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Total Operaciones</p>
                  <h3 className="text-2xl font-bold">{estadisticas.total_compras || 0}</h3>
                  <p className="text-xs text-muted">
                    {estadisticas.proveedores_unicos || 0} proveedores
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                  <ShoppingCart size={24} />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-warning">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Pendiente de Pago</p>
                  <h3 className="text-2xl font-bold text-warning">{estadisticas.pendientes_pago || 0}</h3>
                  <p className="text-xs text-muted">Órdenes abiertas</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg text-warning">
                  <Clock size={24} />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-info">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Pagos Parciales</p>
                  <h3 className="text-2xl font-bold text-info">{estadisticas.pagos_parciales || 0}</h3>
                  <p className="text-xs text-muted">En amortización</p>
                </div>
                <div className="p-3 bg-cyan-50 rounded-lg text-info">
                  <CreditCard size={24} />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-success">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Total Comprado</p>
                  <h3 className="text-lg font-bold text-success truncate" title={formatearMoneda(estadisticas.monto_total || 0, 'PEN')}>
                    {formatearMoneda(estadisticas.monto_total || 0, 'PEN')}
                  </h3>
                  <p className="text-xs text-muted">{estadisticas.pagadas || 0} liquidadas</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-success">
                  <TrendingUp size={24} />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-danger">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Deuda Total</p>
                  <h3 className="text-lg font-bold text-danger truncate" title={formatearMoneda(estadisticas.saldo_pendiente || 0, 'PEN')}>
                    {formatearMoneda(estadisticas.saldo_pendiente || 0, 'PEN')}
                  </h3>
                  <p className="text-xs text-muted">Saldo exigible</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-danger">
                  <AlertCircle size={24} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {alertas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {alertas.cuotas_vencidas?.cantidad > 0 && (
            <div 
              className={`card border-l-4 border-danger cursor-pointer hover:shadow-md transition-all ${filtros.alertas === 'vencidas' ? 'ring-2 ring-danger' : ''}`}
              onClick={() => actualizarFiltro('alertas', filtros.alertas === 'vencidas' ? '' : 'vencidas')}
            >
              <div className="card-body py-3">
                <div className="flex items-center gap-3">
                  <XCircle size={24} className="text-danger" />
                  <div>
                    <p className="text-sm font-bold text-danger">Cuotas Vencidas</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold">{alertas.cuotas_vencidas.cantidad}</span>
                        <span className="text-xs text-muted">({formatearMoneda(alertas.cuotas_vencidas.monto_total, 'PEN')})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {alertas.cuotas_proximas_vencer?.cantidad > 0 && (
            <div 
              className={`card border-l-4 border-warning cursor-pointer hover:shadow-md transition-all ${filtros.alertas === 'proximas_vencer' ? 'ring-2 ring-warning' : ''}`}
              onClick={() => actualizarFiltro('alertas', filtros.alertas === 'proximas_vencer' ? '' : 'proximas_vencer')}
            >
              <div className="card-body py-3">
                <div className="flex items-center gap-3">
                  <Clock size={24} className="text-warning" />
                  <div>
                    <p className="text-sm font-bold text-warning">Vencen pronto</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold">{alertas.cuotas_proximas_vencer.cantidad}</span>
                        <span className="text-xs text-muted">({formatearMoneda(alertas.cuotas_proximas_vencer.monto_total, 'PEN')})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {alertas.compras_vencidas?.cantidad > 0 && (
            <div 
                className={`card border-l-4 border-red-600 cursor-pointer hover:shadow-md transition-all ${filtros.alertas === 'compras_vencidas' ? 'ring-2 ring-red-600' : ''}`}
                onClick={() => actualizarFiltro('alertas', filtros.alertas === 'compras_vencidas' ? '' : 'compras_vencidas')}
            >
              <div className="card-body py-3">
                <div className="flex items-center gap-3">
                  <AlertCircle size={24} className="text-red-600" />
                  <div>
                    <p className="text-sm font-bold text-red-600">Facturas Vencidas</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold">{alertas.compras_vencidas.cantidad}</span>
                        <span className="text-xs text-muted">({formatearMoneda(alertas.compras_vencidas.monto_total, 'PEN')})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {alertas.pagos_pendientes?.cantidad > 0 && (
            <div 
              className={`card border-l-4 border-blue-400 cursor-pointer hover:shadow-md transition-all ${filtros.alertas === 'pendiente_pago' ? 'ring-2 ring-blue-400' : ''}`}
              onClick={() => actualizarFiltro('alertas', filtros.alertas === 'pendiente_pago' ? '' : 'pendiente_pago')}
            >
              <div className="card-body py-3">
                <div className="flex items-center gap-3">
                  <Wallet size={24} className="text-blue-400" />
                  <div>
                    <p className="text-sm font-bold text-blue-600">Total Pendiente</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold">{alertas.pagos_pendientes.cantidad}</span>
                        <span className="text-xs text-muted">({formatearMoneda(alertas.pagos_pendientes.monto_total, 'PEN')})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card mb-4 bg-gray-50 border border-gray-200">
        <div className="card-body p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 mr-2">
                <Filter size={20} className="text-muted" />
                <span className="font-medium text-sm text-gray-700">Filtros:</span>
            </div>

            <div className="w-36">
                <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Desde</label>
                <input 
                    type="date" 
                    className="form-input form-input-sm bg-white"
                    value={filtros.fecha_inicio}
                    onChange={(e) => actualizarFiltro('fecha_inicio', e.target.value)}
                />
            </div>

            <div className="w-36">
                <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Hasta</label>
                <input 
                    type="date" 
                    className="form-input form-input-sm bg-white"
                    value={filtros.fecha_fin}
                    onChange={(e) => actualizarFiltro('fecha_fin', e.target.value)}
                />
            </div>

            <div className="w-40">
              <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Tipo de Compra</label>
              <select
                className="form-select form-select-sm bg-white"
                value={filtros.tipo_compra}
                onChange={(e) => actualizarFiltro('tipo_compra', e.target.value)}
              >
                <option value="">Todos</option>
                <option value="Contado">Contado</option>
                <option value="Credito">Crédito</option>
              </select>
            </div>

            <div className="w-48">
              <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Cuenta de Pago</label>
              <select
                className="form-select form-select-sm bg-white"
                value={filtros.id_cuenta_pago}
                onChange={(e) => actualizarFiltro('id_cuenta_pago', e.target.value)}
              >
                <option value="">Todas las cuentas</option>
                {cuentas.map(cuenta => (
                  <option key={cuenta.id_cuenta} value={cuenta.id_cuenta}>
                    {cuenta.nombre} ({cuenta.moneda})
                  </option>
                ))}
              </select>
            </div>

            {Object.values(filtros).some(v => v !== '') && (
              <button
                className="btn btn-sm btn-outline bg-white hover:bg-gray-100 text-gray-700 ml-auto"
                onClick={limpiarFiltros}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card shadow-md">
        <div className="card-header border-b-0 flex justify-between items-center">
          <h2 className="card-title">
            Listado de Compras
            <span className="badge badge-primary ml-2">{compras.length}</span>
          </h2>
        </div>
        <div className="card-body p-0">
          <Table
            columns={columns}
            data={compras}
            emptyMessage="No se encontraron compras con los filtros aplicados"
          />
        </div>
      </div>
    </div>
  );
}

export default Compras;