import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Eye, ShoppingCart, Filter, Clock, CheckCircle,
  XCircle, AlertCircle, TrendingUp, Wallet, CreditCard
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
      console.error('Error al cargar compras:', err);
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
    return `${simbolo} ${parseFloat(valor).toFixed(2)}`;
  };

  const getNivelAlertaClase = (nivel) => {
    const clases = {
      'success': 'badge-success',
      'info': 'badge-info',
      'warning': 'badge-warning',
      'danger': 'badge-danger'
    };
    return clases[nivel] || 'badge-info';
  };

  const getEstadoPagoConfig = (estado) => {
    const configs = {
      'Pendiente': { clase: 'badge-warning', texto: 'Pendiente' },
      'Parcial': { clase: 'badge-info', texto: 'Parcial' },
      'Pagado': { clase: 'badge-success', texto: 'Pagado' }
    };
    return configs[estado] || configs['Pendiente'];
  };

  const getTipoCompraConfig = (tipo) => {
    const configs = {
      'Contado': { clase: 'badge-success', icono: Wallet },
      'Credito': { clase: 'badge-warning', icono: CreditCard }
    };
    return configs[tipo] || configs['Contado'];
  };

  const columns = [
    {
      header: 'N° Compra',
      accessor: 'numero_orden',
      width: '140px',
      render: (value, row) => (
        <div>
          <span className="font-mono font-bold text-sm">{value}</span>
          <div className="text-xs text-muted">
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
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted">RUC: {row.ruc_proveedor}</div>
        </div>
      )
    },
    {
      header: 'Cuenta de Pago',
      accessor: 'cuenta_pago',
      width: '150px',
      render: (value, row) => (
        <div>
          <div className="font-medium text-sm">{value}</div>
          <div className="text-xs text-muted">{row.tipo_cuenta_pago}</div>
        </div>
      )
    },
    {
      header: 'Tipo',
      accessor: 'tipo_compra',
      width: '100px',
      align: 'center',
      render: (value, row) => {
        const config = getTipoCompraConfig(value);
        const Icono = config.icono;
        return (
          <div>
            <span className={`badge ${config.clase}`}>
              <Icono size={12} />
              {value}
            </span>
            {value === 'Credito' && row.numero_cuotas > 0 && (
              <div className="text-xs text-muted mt-1">
                {row.numero_cuotas} cuotas
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Total',
      accessor: 'total',
      width: '120px',
      align: 'right',
      render: (value, row) => (
        <div>
          <div className="font-bold text-primary">
            {formatearMoneda(value, row.moneda)}
          </div>
          {row.tipo_compra === 'Credito' && (
            <div className="text-xs text-muted">
              Pagado: {formatearMoneda(row.monto_pagado || 0, row.moneda)}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Estado Pago',
      accessor: 'estado_pago',
      width: '110px',
      align: 'center',
      render: (value, row) => {
        const config = getEstadoPagoConfig(value);
        return (
          <div>
            <span className={`badge ${config.clase}`}>
              {config.texto}
            </span>
            {row.dias_para_vencer !== null && row.estado_pago !== 'Pagado' && (
              <div className={`text-xs mt-1 ${row.dias_para_vencer < 0 ? 'text-danger' : row.dias_para_vencer <= 7 ? 'text-warning' : 'text-muted'}`}>
                {row.dias_para_vencer < 0 ? `Vencido` : `${row.dias_para_vencer}d`}
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Alerta',
      accessor: 'nivel_alerta',
      width: '80px',
      align: 'center',
      render: (value) => {
        if (value === 'success') return null;
        return (
          <span className={`badge ${getNivelAlertaClase(value)}`}>
            <AlertCircle size={14} />
          </span>
        );
      }
    },
    {
      header: 'Acciones',
      accessor: 'id_orden_compra',
      width: '100px',
      align: 'center',
      render: (value) => (
        <button
          className="btn btn-sm btn-primary"
          onClick={() => navigate(`/compras/${value}`)}
          title="Ver detalle"
        >
          <Eye size={14} />
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
      alertas: ''
    });
  };

  if (loading) return <Loading message="Cargando compras..." />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart size={32} />
            Compras
          </h1>
          <p className="text-muted">Gestión de compras a proveedores</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => navigate('/compras/nueva')}
        >
          <Plus size={20} />
          Nueva Compra
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {estadisticas && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Total Compras</p>
                  <h3 className="text-2xl font-bold">{estadisticas.total_compras || 0}</h3>
                  <p className="text-xs text-muted">
                    {estadisticas.proveedores_unicos || 0} proveedores
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ShoppingCart size={24} className="text-primary" />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-warning">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Pendiente Pago</p>
                  <h3 className="text-2xl font-bold text-warning">{estadisticas.pendientes_pago || 0}</h3>
                  <p className="text-xs text-muted">Sin pagar</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock size={24} className="text-warning" />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-info">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Pago Parcial</p>
                  <h3 className="text-2xl font-bold text-info">{estadisticas.pagos_parciales || 0}</h3>
                  <p className="text-xs text-muted">En proceso</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <CreditCard size={24} className="text-info" />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-success">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Monto Total</p>
                  <h3 className="text-xl font-bold text-success">
                    {formatearMoneda(estadisticas.monto_total || 0, 'PEN')}
                  </h3>
                  <p className="text-xs text-muted">{estadisticas.pagadas || 0} pagadas</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp size={24} className="text-success" />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-danger">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Saldo Pendiente</p>
                  <h3 className="text-xl font-bold text-danger">
                    {formatearMoneda(estadisticas.saldo_pendiente || 0, 'PEN')}
                  </h3>
                  <p className="text-xs text-muted">Por pagar</p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertCircle size={24} className="text-danger" />
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
              className="card border-l-4 border-danger cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => actualizarFiltro('alertas', 'vencidas')}
            >
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-danger font-medium">Cuotas Vencidas</p>
                    <h3 className="text-2xl font-bold text-danger">{alertas.cuotas_vencidas.cantidad}</h3>
                    <p className="text-xs text-muted">
                      {formatearMoneda(alertas.cuotas_vencidas.monto_total, 'PEN')}
                    </p>
                  </div>
                  <XCircle size={24} className="text-danger" />
                </div>
              </div>
            </div>
          )}

          {alertas.cuotas_proximas_vencer?.cantidad > 0 && (
            <div 
              className="card border-l-4 border-warning cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => actualizarFiltro('alertas', 'proximas_vencer')}
            >
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-warning font-medium">Próximas a Vencer</p>
                    <h3 className="text-2xl font-bold text-warning">{alertas.cuotas_proximas_vencer.cantidad}</h3>
                    <p className="text-xs text-muted">
                      {formatearMoneda(alertas.cuotas_proximas_vencer.monto_total, 'PEN')}
                    </p>
                  </div>
                  <Clock size={24} className="text-warning" />
                </div>
              </div>
            </div>
          )}

          {alertas.compras_vencidas?.cantidad > 0 && (
            <div className="card border-l-4 border-danger">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-danger font-medium">Compras Vencidas</p>
                    <h3 className="text-2xl font-bold text-danger">{alertas.compras_vencidas.cantidad}</h3>
                    <p className="text-xs text-muted">
                      {formatearMoneda(alertas.compras_vencidas.monto_total, 'PEN')}
                    </p>
                  </div>
                  <XCircle size={24} className="text-danger" />
                </div>
              </div>
            </div>
          )}

          {alertas.pagos_pendientes?.cantidad > 0 && (
            <div 
              className="card border-l-4 border-info cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => actualizarFiltro('alertas', 'pendiente_pago')}
            >
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-info font-medium">Pagos Pendientes</p>
                    <h3 className="text-2xl font-bold text-info">{alertas.pagos_pendientes.cantidad}</h3>
                    <p className="text-xs text-muted">
                      {formatearMoneda(alertas.pagos_pendientes.monto_total, 'PEN')}
                    </p>
                  </div>
                  <Clock size={24} className="text-info" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card mb-4">
        <div className="card-body">
          <div className="flex items-start gap-3 flex-wrap">
            <Filter size={20} className="text-muted mt-2" />
            <div className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Tipo de Compra</label>
                  <select
                    className="form-select"
                    value={filtros.tipo_compra}
                    onChange={(e) => actualizarFiltro('tipo_compra', e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="Contado">Contado</option>
                    <option value="Credito">Crédito</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Tipo de Cuenta</label>
                  <select
                    className="form-select"
                    value={filtros.tipo_cuenta}
                    onChange={(e) => actualizarFiltro('tipo_cuenta', e.target.value)}
                  >
                    <option value="">Todas</option>
                    <option value="Banco">Banco</option>
                    <option value="Caja">Caja</option>
                    <option value="Tarjeta">Tarjeta</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Cuenta de Pago</label>
                  <select
                    className="form-select"
                    value={filtros.id_cuenta_pago}
                    onChange={(e) => actualizarFiltro('id_cuenta_pago', e.target.value)}
                  >
                    <option value="">Todas las cuentas</option>
                    {cuentas.map(cuenta => (
                      <option key={cuenta.id_cuenta} value={cuenta.id_cuenta}>
                        {cuenta.nombre} ({cuenta.tipo} - {cuenta.moneda})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  className={`btn btn-sm ${filtros.alertas === '' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => actualizarFiltro('alertas', '')}
                >
                  Todas
                </button>
                <button
                  className={`btn btn-sm ${filtros.alertas === 'vencidas' ? 'btn-danger' : 'btn-outline'}`}
                  onClick={() => actualizarFiltro('alertas', 'vencidas')}
                >
                  <XCircle size={14} />
                  Vencidas
                </button>
                <button
                  className={`btn btn-sm ${filtros.alertas === 'proximas_vencer' ? 'btn-warning' : 'btn-outline'}`}
                  onClick={() => actualizarFiltro('alertas', 'proximas_vencer')}
                >
                  <Clock size={14} />
                  Próximas a Vencer
                </button>
                <button
                  className={`btn btn-sm ${filtros.alertas === 'pendiente_pago' ? 'btn-info' : 'btn-outline'}`}
                  onClick={() => actualizarFiltro('alertas', 'pendiente_pago')}
                >
                  <AlertCircle size={14} />
                  Pendiente Pago
                </button>
                {Object.values(filtros).some(v => v !== '') && (
                  <button
                    className="btn btn-sm btn-outline ml-auto"
                    onClick={limpiarFiltros}
                  >
                    Limpiar Filtros
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            Lista de Compras
            <span className="badge badge-primary ml-2">{compras.length}</span>
          </h2>
        </div>
        <div className="card-body">
          <Table
            columns={columns}
            data={compras}
            emptyMessage="No hay compras registradas"
          />
        </div>
      </div>
    </div>
  );
}

export default Compras;