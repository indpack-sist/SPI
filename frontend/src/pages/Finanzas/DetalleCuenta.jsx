import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Building2, Wallet, CreditCard, 
  ArrowUpCircle, ArrowDownCircle, Filter, 
  FileText, User, ShoppingBag, ExternalLink, Calendar,
  Receipt, RefreshCw, Package
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { cuentasPagoAPI } from '../../config/api';

function DetalleCuenta() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [cuenta, setCuenta] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filtros, setFiltros] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    tipo_movimiento: '',
    moneda: ''
  });

  useEffect(() => {
    cargarDatosCuenta();
  }, [id]);

  useEffect(() => {
    if (cuenta) {
      cargarMovimientos();
    }
  }, [cuenta, filtros]);

  const cargarDatosCuenta = async () => {
    try {
      setLoading(true);
      const response = await cuentasPagoAPI.getById(id);
      if (response.data.success) {
        setCuenta(response.data.data);
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar datos de la cuenta');
    } finally {
      setLoading(false);
    }
  };

  const cargarMovimientos = async () => {
    try {
      const response = await cuentasPagoAPI.getMovimientos(id, filtros);
      if (response.data.success) {
        setMovimientos(response.data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatearMoneda = (valor, moneda) => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  };

  const getTipoIcon = (tipo) => {
    const icons = {
      'Banco': Building2,
      'Caja': Wallet,
      'Tarjeta': CreditCard
    };
    return icons[tipo] || Wallet;
  };

  const getTipoOperacionBadge = (tipoOperacion) => {
    const configs = {
      'Reembolso': { clase: 'badge-purple', icono: RefreshCw },
      'Pago Letra': { clase: 'badge-warning', icono: Receipt },
      'Pago Cuota': { clase: 'badge-info', icono: Receipt },
      'Pago Compra': { clase: 'badge-danger', icono: ShoppingBag },
      'Cobro Venta': { clase: 'badge-success', icono: Package },
      'Otro': { clase: 'badge-secondary', icono: FileText }
    };
    return configs[tipoOperacion] || configs['Otro'];
  };

  const columns = [
    {
      header: 'Fecha / Hora',
      accessor: 'fecha_movimiento',
      width: '130px',
      render: (value) => (
        <div className="text-sm">
            <div className="font-medium text-gray-700">{new Date(value).toLocaleDateString('es-PE')}</div>
            <div className="text-xs text-muted flex items-center gap-1">
                <Calendar size={10}/>
                {new Date(value).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
        </div>
      )
    },
    {
      header: 'Tipo',
      accessor: 'tipo_movimiento',
      width: '100px',
      render: (value) => (
        <span className={`badge ${value === 'Ingreso' ? 'badge-success' : 'badge-danger'} flex w-fit items-center gap-1`}>
          {value === 'Ingreso' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
          {value}
        </span>
      )
    },
    {
      header: 'Moneda',
      accessor: 'moneda',
      width: '80px',
      align: 'center',
      render: (value) => (
        <span className={`badge ${value === 'USD' ? 'badge-success' : 'badge-info'} font-mono`}>
          {value}
        </span>
      )
    },
    {
      header: 'Operación',
      accessor: 'tipo_operacion',
      width: '140px',
      render: (value, row) => {
        const config = getTipoOperacionBadge(value);
        const IconoOp = config.icono;
        return (
          <div className="flex flex-col gap-1">
            <span className={`badge ${config.clase} flex w-fit items-center gap-1 text-xs`}>
              <IconoOp size={12} />
              {value}
            </span>
            {row.es_reembolso === 1 && row.empleado_beneficiario && (
              <span className="text-[10px] text-purple-600 font-medium">
                A: {row.empleado_beneficiario}
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Detalle de Trazabilidad',
      accessor: 'concepto',
      render: (value, row) => {
        if (row.es_reembolso === 1) {
          return (
            <div className="flex flex-col">
              <span className="font-bold text-purple-700 flex items-center gap-1">
                Reembolso a Empleado
                {row.id_orden_compra && (
                  <button 
                    className="text-primary hover:text-blue-700"
                    onClick={() => navigate(`/compras/${row.id_orden_compra}`)}
                    title="Ver compra relacionada"
                  >
                    <ExternalLink size={12} />
                  </button>
                )}
              </span>
              <span className="text-xs text-muted flex items-center gap-1">
                <User size={10} /> {row.empleado_beneficiario || 'Empleado no especificado'}
              </span>
              {row.cargo_empleado_beneficiario && (
                <span className="text-[10px] text-gray-400">{row.cargo_empleado_beneficiario}</span>
              )}
              {row.numero_orden_compra && (
                <span className="text-[10px] text-gray-400">OC: {row.numero_orden_compra}</span>
              )}
            </div>
          );
        }

        if (row.numero_letra) {
          return (
            <div className="flex flex-col">
              <span className="font-bold text-orange-700 flex items-center gap-1">
                Pago Letra {row.numero_letra}
                {row.id_orden_compra && (
                  <button 
                    className="text-primary hover:text-blue-700"
                    onClick={() => navigate(`/compras/${row.id_orden_compra}`)}
                    title="Ver compra relacionada"
                  >
                    <ExternalLink size={12} />
                  </button>
                )}
              </span>
              <span className="text-xs text-muted flex items-center gap-1">
                <ShoppingBag size={10} /> {row.proveedor || 'Proveedor no especificado'}
              </span>
              {row.fecha_vencimiento_letra && (
                <span className="text-[10px] text-gray-400">
                  Venc: {new Date(row.fecha_vencimiento_letra).toLocaleDateString('es-PE')}
                </span>
              )}
            </div>
          );
        }

        if (row.numero_pago_venta) {
          return (
            <div className="flex flex-col">
              <span className="font-bold text-gray-800 flex items-center gap-1">
                Cobro Venta #{row.numero_orden_venta}
                <button 
                  className="text-primary hover:text-blue-700"
                  onClick={() => navigate(`/ventas/ordenes/${row.id_orden_venta}`)}
                  title="Ir a la Venta"
                >
                  <ExternalLink size={12} />
                </button>
              </span>
              <span className="text-xs text-muted flex items-center gap-1">
                <User size={10} /> Cliente: {row.cliente || 'Desconocido'}
              </span>
              <span className="text-[10px] text-gray-400">Recibo: {row.numero_pago_venta}</span>
            </div>
          );
        }

        if (row.numero_orden_compra) {
          return (
            <div className="flex flex-col">
              <span className="font-bold text-gray-800 flex items-center gap-1">
                {row.forma_pago_detalle === 'Letras' ? 'Pago Compra (Letras)' : 'Pago Compra'} #{row.numero_orden_compra}
                <button 
                  className="text-primary hover:text-blue-700"
                  onClick={() => navigate(`/compras/${row.id_orden_compra}`)}
                  title="Ir a la Compra"
                >
                  <ExternalLink size={12} />
                </button>
              </span>
              <span className="text-xs text-muted flex items-center gap-1">
                <ShoppingBag size={10} /> Prov: {row.proveedor || 'Desconocido'}
              </span>
              {row.numero_cuota && (
                <span className="text-[10px] text-gray-400">Cuota: {row.numero_cuota}</span>
              )}
              {row.codigo_letra_cuota && (
                <span className="text-[10px] text-gray-400">Letra: {row.codigo_letra_cuota}</span>
              )}
            </div>
          );
        }

        return (
          <div>
            <div className="font-medium text-gray-700">{value || 'Sin concepto'}</div>
            {row.referencia && (
              <div className="text-xs text-muted italic">Ref: {row.referencia}</div>
            )}
            <div className="text-[10px] text-gray-400 mt-1">
              Reg. por: {row.registrado_por_nombre || 'Sistema'}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Importe',
      accessor: 'monto',
      align: 'right',
      width: '120px',
      render: (value, row) => (
        <span className={`font-bold text-base ${row.tipo_movimiento === 'Ingreso' ? 'text-success' : 'text-danger'}`}>
          {row.tipo_movimiento === 'Ingreso' ? '+' : '-'} {parseFloat(value).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
        </span>
      )
    }
  ];

  if (loading && !cuenta) return <Loading message="Cargando historial..." />;
  if (!cuenta) return <Alert type="error" message="Cuenta no encontrada" />;

  const Icon = getTipoIcon(cuenta.tipo);

  const totalReembolsos = movimientos.filter(m => m.es_reembolso === 1).reduce((sum, m) => sum + parseFloat(m.monto), 0);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button 
          className="btn btn-outline hover:bg-gray-100 border-gray-300" 
          onClick={() => navigate('/finanzas/cuentas-pago')}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${cuenta.tipo === 'Caja' ? 'bg-orange-100 text-orange-600' : cuenta.tipo === 'Tarjeta' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
              <Icon size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                {cuenta.nombre}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted">
                <span>{cuenta.tipo}</span>
                {cuenta.banco && <span>• {cuenta.banco}</span>}
                {cuenta.numero_cuenta && <span>• {cuenta.numero_cuenta}</span>}
                <span className={`px-2 py-0.5 rounded text-xs ${cuenta.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {cuenta.estado}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card bg-gradient-to-br from-white to-blue-50 border-l-4 border-blue-600 shadow-sm">
          <div className="card-body">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Saldo Soles (PEN)</p>
            <div className="flex items-center justify-between mt-2">
              <h2 className={`text-3xl font-bold ${parseFloat(cuenta.saldo_pen) < 0 ? 'text-danger' : 'text-gray-800'}`}>
                {formatearMoneda(cuenta.saldo_pen, 'PEN')}
              </h2>
              <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                <span className="font-bold text-xl">S/</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Calculado al momento</p>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-white to-green-50 border-l-4 border-green-600 shadow-sm">
          <div className="card-body">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Saldo Dólares (USD)</p>
            <div className="flex items-center justify-between mt-2">
              <h2 className={`text-3xl font-bold ${parseFloat(cuenta.saldo_usd) < 0 ? 'text-danger' : 'text-gray-800'}`}>
                {formatearMoneda(cuenta.saldo_usd, 'USD')}
              </h2>
              <div className="p-3 bg-green-50 rounded-full text-green-600">
                <span className="font-bold text-xl">$</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Calculado al momento</p>
          </div>
        </div>

        <div className="card bg-white border-l-4 border-purple-500 shadow-sm">
          <div className="card-body">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Reembolsos</p>
            <div className="flex items-center justify-between mt-2">
              <h2 className="text-2xl font-bold text-purple-600">
                {totalReembolsos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </h2>
              <div className="p-2 bg-purple-50 rounded-full text-purple-600">
                <RefreshCw size={22} />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">A empleados</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card bg-white border-l-4 border-green-500 shadow-sm">
          <div className="card-body">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Total Ingresos</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">PEN:</span>
                <span className="text-xl font-bold text-green-600">
                  S/ {parseFloat(cuenta.total_ingresos_pen || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">USD:</span>
                <span className="text-xl font-bold text-green-600">
                  $ {parseFloat(cuenta.total_ingresos_usd || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Entradas acumuladas</p>
          </div>
        </div>

        <div className="card bg-white border-l-4 border-red-500 shadow-sm">
          <div className="card-body">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Total Egresos</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">PEN:</span>
                <span className="text-xl font-bold text-red-600">
                  S/ {parseFloat(cuenta.total_egresos_pen || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">USD:</span>
                <span className="text-xl font-bold text-red-600">
                  $ {parseFloat(cuenta.total_egresos_usd || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Salidas acumuladas</p>
          </div>
        </div>
      </div>

      <div className="card shadow-md border-0">
        <div className="card-header bg-white border-b py-4 px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h3 className="font-bold text-lg flex items-center gap-2 text-gray-800">
            <FileText size={20} className="text-primary"/>
            Historial de Movimientos
            <span className="badge badge-primary ml-2">{movimientos.length}</span>
          </h3>

          <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-lg border">
            <div className="flex items-center gap-2 text-sm text-gray-600 font-medium px-2">
              <Filter size={16} /> Filtros:
            </div>
            
            <input 
              type="date" 
              className="form-input py-1.5 px-3 text-sm w-36 bg-white"
              value={filtros.fecha_inicio}
              onChange={(e) => setFiltros({...filtros, fecha_inicio: e.target.value})}
              title="Fecha Inicio"
            />
            <span className="text-gray-400">-</span>
            <input 
              type="date" 
              className="form-input py-1.5 px-3 text-sm w-36 bg-white"
              value={filtros.fecha_fin}
              onChange={(e) => setFiltros({...filtros, fecha_fin: e.target.value})}
              title="Fecha Fin"
            />
            
            <select 
              className="form-select py-1.5 px-3 text-sm w-32 bg-white"
              value={filtros.tipo_movimiento}
              onChange={(e) => setFiltros({...filtros, tipo_movimiento: e.target.value})}
            >
              <option value="">Todos</option>
              <option value="Ingreso">Ingresos</option>
              <option value="Egreso">Egresos</option>
            </select>

            <select 
              className="form-select py-1.5 px-3 text-sm w-24 bg-white"
              value={filtros.moneda}
              onChange={(e) => setFiltros({...filtros, moneda: e.target.value})}
            >
              <option value="">Ambas</option>
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </select>

            {(filtros.fecha_inicio || filtros.fecha_fin || filtros.tipo_movimiento || filtros.moneda) && (
              <button 
                className="btn btn-xs btn-ghost text-muted hover:text-danger"
                onClick={() => setFiltros({fecha_inicio: '', fecha_fin: '', tipo_movimiento: '', moneda: ''})}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
        
        <div className="card-body p-0">
          <Table 
            columns={columns}
            data={movimientos}
            emptyMessage={
              <div className="text-center py-12">
                <div className="bg-gray-100 rounded-full p-4 w-fit mx-auto mb-3">
                  <FileText size={32} className="text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No hay movimientos registrados en este periodo.</p>
                <p className="text-sm text-gray-400">Intenta cambiar los filtros de fecha.</p>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

export default DetalleCuenta;