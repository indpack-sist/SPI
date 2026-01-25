import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Building2, Wallet, CreditCard, 
  ArrowUpCircle, ArrowDownCircle, Filter, 
  FileText, User, ShoppingBag, ExternalLink, Calendar
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
    tipo_movimiento: ''
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

  const formatearMoneda = (valor) => {
    if (!cuenta) return '0.00';
    const simbolo = cuenta.moneda === 'USD' ? '$' : 'S/';
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

  // --- COLUMNAS CON TRAZABILIDAD INTELIGENTE ---
  const columns = [
    {
      header: 'Fecha / Hora',
      accessor: 'fecha_movimiento',
      width: '130px',
      render: (value) => (
        <div className="text-sm">
            <div className="font-medium text-gray-700">{new Date(value).toLocaleDateString()}</div>
            <div className="text-xs text-muted flex items-center gap-1">
                <Calendar size={10}/>
                {new Date(value).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
        </div>
      )
    },
    {
      header: 'Movimiento',
      accessor: 'tipo_movimiento',
      width: '110px',
      render: (value) => (
        <span className={`badge ${value === 'Ingreso' ? 'badge-success' : 'badge-danger'} flex w-fit items-center gap-1`}>
          {value === 'Ingreso' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
          {value}
        </span>
      )
    },
    {
      header: 'Detalle de Trazabilidad', // AQUÍ ESTÁ LA MAGIA
      accessor: 'concepto',
      render: (value, row) => {
        // CASO 1: Es un Cobro de Venta (Ingreso)
        if (row.numero_pago_venta) {
            return (
                <div className="flex flex-col">
                    <span className="font-bold text-gray-800 flex items-center gap-1">
                        Cobro Venta #{row.numero_orden_venta}
                        <button 
                            className="text-primary hover:text-blue-700"
                            onClick={() => navigate(`/ventas/detalle/${row.numero_orden_venta}`)} // Ajusta tu ruta de ventas
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

        // CASO 2: Es un Pago de Compra (Egreso)
        if (row.numero_orden_compra) {
            return (
                <div className="flex flex-col">
                    <span className="font-bold text-gray-800 flex items-center gap-1">
                        Pago Compra #{row.numero_orden_compra}
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
                    {row.numero_cuota && <span className="text-[10px] text-gray-400">Cuota: {row.numero_cuota}</span>}
                </div>
            );
        }

        // CASO 3: Movimiento Manual / Transferencia / Ajuste
        return (
            <div>
                <div className="font-medium text-gray-700">{value}</div>
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
    },
    {
      header: 'Saldo',
      accessor: 'saldo_nuevo',
      align: 'right',
      width: '120px',
      render: (value) => (
        <span className="font-mono font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded">
            {parseFloat(value).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
        </span>
      )
    }
  ];

  if (loading && !cuenta) return <Loading message="Cargando historial..." />;
  if (!cuenta) return <Alert type="error" message="Cuenta no encontrada" />;

  const Icon = getTipoIcon(cuenta.tipo);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6">
        <button 
            className="btn btn-outline hover:bg-gray-100 border-gray-300" 
            onClick={() => navigate('/finanzas/cuentas-pago')}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${cuenta.tipo === 'Caja' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
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

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Card Saldo Actual */}
        <div className="card bg-white border-l-4 border-blue-600 shadow-sm">
            <div className="card-body">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Saldo Disponible</p>
                <div className="flex items-center justify-between mt-2">
                    <h2 className={`text-4xl font-bold ${parseFloat(cuenta.saldo_actual) < 0 ? 'text-danger' : 'text-gray-800'}`}>
                        {formatearMoneda(cuenta.saldo_actual)}
                    </h2>
                    <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                        <Wallet size={28} />
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">Calculado al momento</p>
            </div>
        </div>

        {/* Card Ingresos */}
        <div className="card bg-white border-l-4 border-green-500 shadow-sm">
            <div className="card-body">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Histórico Ingresos</p>
                <div className="flex items-center justify-between mt-2">
                    <h2 className="text-3xl font-bold text-green-600">
                        {formatearMoneda(cuenta.total_ingresos)}
                    </h2>
                    <div className="p-2 bg-green-50 rounded-full text-green-600">
                        <ArrowUpCircle size={24} />
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">Entradas de dinero acumuladas</p>
            </div>
        </div>

        {/* Card Egresos */}
        <div className="card bg-white border-l-4 border-red-500 shadow-sm">
            <div className="card-body">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Histórico Egresos</p>
                <div className="flex items-center justify-between mt-2">
                    <h2 className="text-3xl font-bold text-red-600">
                        {formatearMoneda(cuenta.total_gastado)}
                    </h2>
                    <div className="p-2 bg-red-50 rounded-full text-red-600">
                        <ArrowDownCircle size={24} />
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">Salidas de dinero acumuladas</p>
            </div>
        </div>
      </div>

      {/* SECCIÓN PRINCIPAL: FILTROS Y TABLA */}
      <div className="card shadow-md border-0">
        <div className="card-header bg-white border-b py-4 px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="font-bold text-lg flex items-center gap-2 text-gray-800">
                <FileText size={20} className="text-primary"/>
                Historial de Movimientos
                <span className="badge badge-primary ml-2">{movimientos.length}</span>
            </h3>

            {/* BARRA DE FILTROS */}
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

                {(filtros.fecha_inicio || filtros.fecha_fin || filtros.tipo_movimiento) && (
                    <button 
                        className="btn btn-xs btn-ghost text-muted hover:text-danger"
                        onClick={() => setFiltros({fecha_inicio: '', fecha_fin: '', tipo_movimiento: ''})}
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