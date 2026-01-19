import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Wallet, CreditCard, Building2, Calendar, 
  DollarSign, ArrowUpCircle, ArrowDownCircle, RefreshCw, 
  FileText, ShoppingBag, AlertTriangle, CheckCircle, Filter
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { cuentasPagoAPI } from '../../config/api';

function DetalleCuenta() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [cuenta, setCuenta] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [activeTab, setActiveTab] = useState('movimientos');
  const [modalRenovarOpen, setModalRenovarOpen] = useState(false);
  const [nuevaFechaRenovacion, setNuevaFechaRenovacion] = useState('');

  const [filtrosMovimientos, setFiltrosMovimientos] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    tipo_movimiento: ''
  });

  useEffect(() => {
    cargarDatos();
  }, [id]);

  useEffect(() => {
    if (cuenta) {
      cargarMovimientos();
    }
  }, [cuenta, filtrosMovimientos]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const response = await cuentasPagoAPI.getById(id);
      if (response.data.success) {
        setCuenta(response.data.data);
        if (response.data.data.fecha_renovacion) {
            const fecha = new Date(response.data.data.fecha_renovacion);
            fecha.setMonth(fecha.getMonth() + 1);
            setNuevaFechaRenovacion(fecha.toISOString().split('T')[0]);
        } else {
            const hoy = new Date();
            hoy.setMonth(hoy.getMonth() + 1);
            setNuevaFechaRenovacion(hoy.toISOString().split('T')[0]);
        }
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
      const response = await cuentasPagoAPI.getMovimientos(id, filtrosMovimientos);
      if (response.data.success) {
        setMovimientos(response.data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenovarCredito = async (e) => {
    e.preventDefault();
    try {
        const response = await cuentasPagoAPI.renovarCredito(id, {
            nueva_fecha_renovacion: nuevaFechaRenovacion
        });

        if (response.data.success) {
            setSuccess('Crédito renovado exitosamente');
            setModalRenovarOpen(false);
            cargarDatos();
            cargarMovimientos();
        }
    } catch (err) {
        setError(err.response?.data?.error || 'Error al renovar crédito');
    }
  };

  const formatearMoneda = (valor) => {
    if (!cuenta) return '0.00';
    const simbolo = cuenta.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toFixed(2)}`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE');
  };

  const getTipoIcon = (tipo) => {
    const icons = {
      'Banco': Building2,
      'Caja': Wallet,
      'Tarjeta': CreditCard
    };
    return icons[tipo] || Wallet;
  };

  const columnsMovimientos = [
    {
      header: 'Fecha',
      accessor: 'fecha_movimiento',
      width: '120px',
      render: (value) => (
        <div className="text-sm">
            <div>{new Date(value).toLocaleDateString()}</div>
            <div className="text-xs text-muted">{new Date(value).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        </div>
      )
    },
    {
      header: 'Tipo',
      accessor: 'tipo_movimiento',
      width: '100px',
      render: (value) => (
        <span className={`badge ${value === 'Ingreso' ? 'badge-success' : 'badge-danger'}`}>
          {value === 'Ingreso' ? <ArrowUpCircle size={14} className="mr-1"/> : <ArrowDownCircle size={14} className="mr-1"/>}
          {value}
        </span>
      )
    },
    {
      header: 'Concepto / Referencia',
      accessor: 'concepto',
      render: (value, row) => (
        <div>
            <div className="font-medium">{value}</div>
            <div className="text-xs text-muted flex flex-col">
                {row.numero_orden && (
                    <span className="text-primary cursor-pointer hover:underline" onClick={() => navigate(`/compras/${row.id_orden_compra}`)}>
                        Ref: {row.numero_orden}
                    </span>
                )}
                {row.numero_cuota && <span>Cuota: {row.numero_cuota}</span>}
                {row.registrado_por_nombre && <span>Por: {row.registrado_por_nombre}</span>}
            </div>
        </div>
      )
    },
    {
      header: 'Monto',
      accessor: 'monto',
      align: 'right',
      render: (value, row) => (
        <span className={`font-bold ${row.tipo_movimiento === 'Ingreso' ? 'text-success' : 'text-danger'}`}>
            {row.tipo_movimiento === 'Ingreso' ? '+' : '-'} {formatearMoneda(value)}
        </span>
      )
    },
    {
      header: 'Saldo Post.',
      accessor: 'saldo_nuevo',
      align: 'right',
      render: (value) => (
        <span className="font-mono text-gray-600 font-medium">
            {formatearMoneda(value)}
        </span>
      )
    }
  ];

  const columnsCompras = [
    {
      header: 'Orden',
      accessor: 'numero_orden',
      render: (value, row) => (
        <div className="font-bold text-primary cursor-pointer" onClick={() => navigate(`/compras/${row.id_orden_compra}`)}>
            {value}
        </div>
      )
    },
    {
      header: 'Fecha Emisión',
      accessor: 'fecha_emision',
      render: (value) => formatearFecha(value)
    },
    {
      header: 'Proveedor',
      accessor: 'proveedor'
    },
    {
      header: 'Total Orden',
      accessor: 'total',
      align: 'right',
      render: (value) => formatearMoneda(value)
    },
    {
      header: 'Estado Pago',
      accessor: 'estado_pago',
      align: 'center',
      render: (value) => (
        <span className={`badge ${value === 'Pagado' ? 'badge-success' : value === 'Parcial' ? 'badge-info' : 'badge-warning'}`}>
            {value}
        </span>
      )
    }
  ];

  if (loading && !cuenta) return <Loading message="Cargando información de la cuenta..." />;
  if (!cuenta) return <Alert type="error" message="No se encontró la cuenta" />;

  const Icon = getTipoIcon(cuenta.tipo);
  const porcentajeUso = cuenta.limite_credito > 0 
    ? ((parseFloat(cuenta.limite_credito) - parseFloat(cuenta.saldo_actual)) / parseFloat(cuenta.limite_credito)) * 100 
    : 0;

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button className="btn btn-outline" onClick={() => navigate('/finanzas/cuentas')}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <Icon size={32} />
                {cuenta.nombre}
            </h1>
            <span className={`badge ${cuenta.estado === 'Activo' ? 'badge-success' : 'badge-secondary'}`}>
                {cuenta.estado}
            </span>
          </div>
          <p className="text-muted">{cuenta.tipo} • {cuenta.banco || 'Efectivo'} • {cuenta.moneda}</p>
        </div>
        
        {cuenta.tipo === 'Tarjeta' && (
            <button 
                className="btn btn-primary"
                onClick={() => setModalRenovarOpen(true)}
            >
                <RefreshCw size={20} />
                Renovar Crédito / Cierre
            </button>
        )}
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card bg-gradient-to-br from-blue-50 to-white border-blue-100">
            <div className="card-body">
                <p className="text-sm text-blue-800 font-medium mb-1">
                    {cuenta.tipo === 'Tarjeta' ? 'Cupo Disponible' : 'Saldo Actual'}
                </p>
                <h2 className={`text-3xl font-bold ${parseFloat(cuenta.saldo_actual) < 0 ? 'text-danger' : 'text-blue-900'}`}>
                    {formatearMoneda(cuenta.saldo_actual)}
                </h2>
                {cuenta.tipo === 'Tarjeta' && (
                    <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted mb-1">
                            <span>Uso: {porcentajeUso.toFixed(1)}%</span>
                            <span>Límite: {formatearMoneda(cuenta.limite_credito)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                                className={`h-2 rounded-full ${porcentajeUso > 90 ? 'bg-danger' : 'bg-primary'}`}
                                style={{ width: `${Math.min(porcentajeUso, 100)}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-right mt-1 font-bold text-gray-700">
                            Deuda actual: {formatearMoneda(cuenta.credito_utilizado)}
                        </p>
                    </div>
                )}
            </div>
        </div>

        <div className="card">
            <div className="card-body space-y-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-green-100 rounded-lg text-green-600">
                            <ArrowUpCircle size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-muted">Total Ingresos</p>
                            <p className="font-bold text-success">{formatearMoneda(cuenta.total_ingresos)}</p>
                        </div>
                    </div>
                </div>
                <div className="border-t border-gray-100"></div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-red-100 rounded-lg text-red-600">
                            <ArrowDownCircle size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-muted">Total Egresos</p>
                            <p className="font-bold text-danger">{formatearMoneda(cuenta.total_gastado)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="card">
            <div className="card-body">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                    <FileText size={18} /> Detalles
                </h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted">Número:</span>
                        <span className="font-mono">{cuenta.numero_cuenta || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted">Creación:</span>
                        <span>{formatearFecha(cuenta.fecha_creacion)}</span>
                    </div>
                    {cuenta.tipo === 'Tarjeta' && (
                        <>
                            <div className="flex justify-between items-center pt-2 border-t mt-2">
                                <span className="text-muted">Cierre/Renovación:</span>
                                <span className={`font-bold ${cuenta.estado_credito === 'Renovación Pendiente' ? 'text-danger' : 'text-success'}`}>
                                    {formatearFecha(cuenta.fecha_renovacion)}
                                </span>
                            </div>
                            {cuenta.estado_credito === 'Renovación Pendiente' && (
                                <div className="text-xs text-danger flex items-center gap-1 mt-1 justify-end font-medium">
                                    <AlertTriangle size={12} /> Requiere atención
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header p-0">
            <div className="flex border-b">
                <button
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                        activeTab === 'movimientos' 
                        ? 'border-primary text-primary bg-blue-50/50' 
                        : 'border-transparent text-muted hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab('movimientos')}
                >
                    <div className="flex items-center gap-2">
                        <FileText size={16} />
                        Movimientos
                        <span className="badge badge-sm badge-outline ml-1">{cuenta.total_movimientos}</span>
                    </div>
                </button>
                <button
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                        activeTab === 'compras' 
                        ? 'border-primary text-primary bg-blue-50/50' 
                        : 'border-transparent text-muted hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab('compras')}
                >
                    <div className="flex items-center gap-2">
                        <ShoppingBag size={16} />
                        Compras Asociadas
                        <span className="badge badge-sm badge-outline ml-1">{cuenta.total_compras}</span>
                    </div>
                </button>
            </div>
        </div>
        
        <div className="card-body">
            {activeTab === 'movimientos' && (
                <>
                    <div className="flex flex-wrap items-end gap-4 mb-4 p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-2">
                            <Filter size={18} className="text-muted" />
                            <span className="text-sm font-medium text-gray-700">Filtros:</span>
                        </div>
                        <div className="form-group mb-0">
                            <label className="text-xs text-muted block mb-1">Desde</label>
                            <input 
                                type="date" 
                                className="form-input py-1 text-sm w-36"
                                value={filtrosMovimientos.fecha_inicio}
                                onChange={(e) => setFiltrosMovimientos({...filtrosMovimientos, fecha_inicio: e.target.value})}
                            />
                        </div>
                        <div className="form-group mb-0">
                            <label className="text-xs text-muted block mb-1">Hasta</label>
                            <input 
                                type="date" 
                                className="form-input py-1 text-sm w-36"
                                value={filtrosMovimientos.fecha_fin}
                                onChange={(e) => setFiltrosMovimientos({...filtrosMovimientos, fecha_fin: e.target.value})}
                            />
                        </div>
                        <div className="form-group mb-0">
                            <label className="text-xs text-muted block mb-1">Tipo</label>
                            <select 
                                className="form-select py-1 text-sm w-32"
                                value={filtrosMovimientos.tipo_movimiento}
                                onChange={(e) => setFiltrosMovimientos({...filtrosMovimientos, tipo_movimiento: e.target.value})}
                            >
                                <option value="">Todos</option>
                                <option value="Ingreso">Ingresos</option>
                                <option value="Egreso">Egresos</option>
                            </select>
                        </div>
                        {(filtrosMovimientos.fecha_inicio || filtrosMovimientos.fecha_fin || filtrosMovimientos.tipo_movimiento) && (
                            <button 
                                className="btn btn-sm btn-ghost text-muted ml-auto"
                                onClick={() => setFiltrosMovimientos({fecha_inicio: '', fecha_fin: '', tipo_movimiento: ''})}
                            >
                                Limpiar Filtros
                            </button>
                        )}
                    </div>
                    <Table 
                        columns={columnsMovimientos}
                        data={movimientos}
                        emptyMessage="No hay movimientos registrados en este periodo"
                    />
                </>
            )}

            {activeTab === 'compras' && (
                <Table 
                    columns={columnsCompras}
                    data={cuenta.compras_asociadas || []}
                    emptyMessage="No hay compras asociadas a esta cuenta"
                />
            )}
        </div>
      </div>

      <Modal
        isOpen={modalRenovarOpen}
        onClose={() => setModalRenovarOpen(false)}
        title="Renovar Crédito / Pagar Tarjeta"
      >
        <form onSubmit={handleRenovarCredito}>
            <div className="p-4 bg-blue-50 rounded-lg mb-4 text-sm text-blue-900 border border-blue-100">
                <p className="font-bold mb-2 flex items-center gap-2">
                    <CheckCircle size={16} className="text-blue-600" /> Confirmación de Cierre
                </p>
                <p className="mb-2">
                    Esta acción reiniciará el ciclo de facturación de la tarjeta:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                    <li>El saldo se restaurará a <strong>{formatearMoneda(cuenta.limite_credito)}</strong>.</li>
                    <li>Se generará un ingreso de ajuste por <strong>{formatearMoneda(cuenta.credito_utilizado)}</strong>.</li>
                </ul>
            </div>

            <div className="form-group mb-4">
                <label className="form-label">Nueva Fecha de Corte/Renovación</label>
                <input 
                    type="date"
                    className="form-input"
                    value={nuevaFechaRenovacion}
                    onChange={(e) => setNuevaFechaRenovacion(e.target.value)}
                    required
                />
                <small className="text-muted">La próxima fecha en la que se deberá realizar el pago.</small>
            </div>

            <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="btn btn-outline" onClick={() => setModalRenovarOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Confirmar Renovación</button>
            </div>
        </form>
      </Modal>
    </div>
  );
}

export default DetalleCuenta;