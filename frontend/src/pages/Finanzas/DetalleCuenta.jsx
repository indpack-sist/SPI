import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Wallet, CreditCard, Building2, Calendar, 
  DollarSign, ArrowUpCircle, ArrowDownCircle, RefreshCw, 
  FileText, ShoppingBag, AlertTriangle, CheckCircle
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
    if (activeTab === 'movimientos') {
      cargarMovimientos();
    }
  }, [id, activeTab, filtrosMovimientos]);

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
      header: 'Concepto',
      accessor: 'concepto',
      render: (value, row) => (
        <div>
            <div className="font-medium">{value}</div>
            <div className="text-xs text-muted">
                {row.numero_orden && `Ref: ${row.numero_orden}`}
                {row.numero_cuota && ` - Cuota ${row.numero_cuota}`}
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
      header: 'Saldo',
      accessor: 'saldo_nuevo',
      align: 'right',
      render: (value) => (
        <span className="font-mono text-gray-600">
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
      header: 'Fecha',
      accessor: 'fecha_emision',
      render: (value) => formatearFecha(value)
    },
    {
      header: 'Proveedor',
      accessor: 'proveedor'
    },
    {
      header: 'Total',
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
          <p className="text-muted">{cuenta.tipo} • {cuenta.banco} • {cuenta.moneda}</p>
        </div>
        
        {cuenta.tipo === 'Tarjeta' && (
            <button 
                className="btn btn-primary"
                onClick={() => setModalRenovarOpen(true)}
            >
                <RefreshCw size={20} />
                Renovar Crédito / Pagar Tarjeta
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
                        <p className="text-xs text-right mt-1 text-muted">
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
                            <p className="font-bold">{formatearMoneda(cuenta.total_ingresos)}</p>
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
                            <p className="font-bold">{formatearMoneda(cuenta.total_gastado)}</p>
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
                                <span className="text-muted">Renovación:</span>
                                <span className={`font-bold ${cuenta.estado_credito === 'Renovación Pendiente' ? 'text-danger' : 'text-success'}`}>
                                    {formatearFecha(cuenta.fecha_renovacion)}
                                </span>
                            </div>
                            {cuenta.estado_credito === 'Renovación Pendiente' && (
                                <div className="text-xs text-danger flex items-center gap-1 mt-1 justify-end">
                                    <AlertTriangle size={12} /> Requiere pago/renovación
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
                    </div>
                </button>
            </div>
        </div>
        
        <div className="card-body">
            {activeTab === 'movimientos' && (
                <>
                    <div className="flex gap-4 mb-4 flex-wrap">
                        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border">
                            <Calendar size={16} className="text-muted" />
                            <input 
                                type="date" 
                                className="bg-transparent border-none text-sm focus:ring-0 p-0"
                                value={filtrosMovimientos.fecha_inicio}
                                onChange={(e) => setFiltrosMovimientos({...filtrosMovimientos, fecha_inicio: e.target.value})}
                            />
                            <span className="text-muted">-</span>
                            <input 
                                type="date" 
                                className="bg-transparent border-none text-sm focus:ring-0 p-0"
                                value={filtrosMovimientos.fecha_fin}
                                onChange={(e) => setFiltrosMovimientos({...filtrosMovimientos, fecha_fin: e.target.value})}
                            />
                        </div>
                        <select 
                            className="form-select text-sm w-40"
                            value={filtrosMovimientos.tipo_movimiento}
                            onChange={(e) => setFiltrosMovimientos({...filtrosMovimientos, tipo_movimiento: e.target.value})}
                        >
                            <option value="">Todos</option>
                            <option value="Ingreso">Ingresos</option>
                            <option value="Egreso">Egresos</option>
                        </select>
                    </div>
                    <Table 
                        columns={columnsMovimientos}
                        data={movimientos}
                        emptyMessage="No hay movimientos registrados"
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
            <div className="p-4 bg-blue-50 rounded-lg mb-4 text-sm text-blue-900">
                <p className="font-bold mb-1 flex items-center gap-1">
                    <CheckCircle size={16} /> Acción de Cierre
                </p>
                <p>
                    Esta acción simulará el pago total de la deuda de la tarjeta:
                </p>
                <ul className="list-disc list-inside mt-2 ml-1 space-y-1">
                    <li>El saldo (cupo) volverá a ser <strong>{formatearMoneda(cuenta.limite_credito)}</strong>.</li>
                    <li>Se registrará un ingreso de <strong>{formatearMoneda(cuenta.credito_utilizado)}</strong> para cuadrar.</li>
                </ul>
            </div>

            <div className="form-group mb-4">
                <label className="form-label">Próxima Fecha de Renovación/Cierre</label>
                <input 
                    type="date"
                    className="form-input"
                    value={nuevaFechaRenovacion}
                    onChange={(e) => setNuevaFechaRenovacion(e.target.value)}
                    required
                />
            </div>

            <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-outline" onClick={() => setModalRenovarOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Confirmar Renovación</button>
            </div>
        </form>
      </Modal>
    </div>
  );
}

export default DetalleCuenta;
