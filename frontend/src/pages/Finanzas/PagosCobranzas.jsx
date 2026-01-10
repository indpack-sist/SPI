import { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Calendar, 
  Filter, Download, ArrowUpCircle, ArrowDownCircle,
  CreditCard, Building2, User, FileText
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { pagosCobranzasAPI, cuentasPagoAPI } from '../../config/api';

function PagosCobranzas() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [movimientos, setMovimientos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  
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
    cargarDatos();
  }, [filtros]);

  const cargarCuentas = async () => {
    try {
      const response = await cuentasPagoAPI.getAll({ estado: 'Activo' });
      setCuentas(response.data.data || []);
    } catch (err) {
      console.error('Error al cargar cuentas:', err);
    }
  };

  const cargarDatos = async () => {
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
      setError(err.error || 'Error al cargar datos');
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
    return new Date(fecha).toLocaleDateString('es-PE');
  };

  const formatearMoneda = (valor, moneda = 'PEN') => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toFixed(2)}`;
  };

  const getTipoIcon = (tipo) => {
    return tipo === 'pago' ? ArrowDownCircle : ArrowUpCircle;
  };

  const getTipoColor = (tipo) => {
    return tipo === 'pago' ? 'text-danger' : 'text-success';
  };

  const columns = [
    {
      header: 'Tipo',
      accessor: 'tipo',
      width: '100px',
      align: 'center',
      render: (value) => {
        const Icon = getTipoIcon(value);
        const color = getTipoColor(value);
        return (
          <div className="flex items-center gap-2 justify-center">
            <Icon size={20} className={color} />
            <span className={`font-medium ${color}`}>
              {value === 'pago' ? 'Pago' : 'Cobranza'}
            </span>
          </div>
        );
      }
    },
    {
      header: 'N° Operación',
      accessor: 'numero_pago',
      width: '140px',
      render: (value) => <span className="font-mono font-bold">{value}</span>
    },
    {
      header: 'Fecha',
      accessor: 'fecha_pago',
      width: '110px',
      render: (value) => formatearFecha(value)
    },
    {
      header: 'Documento',
      accessor: 'documento_referencia',
      width: '140px',
      render: (value) => <span className="font-mono text-sm">{value || '-'}</span>
    },
    {
      header: 'Tercero',
      accessor: 'tercero',
      render: (value) => <span className="font-medium">{value || 'Sin especificar'}</span>
    },
    {
      header: 'Monto',
      accessor: 'monto_pagado',
      width: '130px',
      align: 'right',
      render: (value, row) => {
        const color = row.tipo === 'pago' ? 'text-danger' : 'text-success';
        return (
          <span className={`font-bold text-lg ${color}`}>
            {formatearMoneda(value, row.moneda)}
          </span>
        );
      }
    },
    {
      header: 'Método',
      accessor: 'metodo_pago',
      width: '120px',
      align: 'center',
      render: (value) => (
        <span className="badge badge-info">{value}</span>
      )
    },
    {
      header: 'Cuenta',
      accessor: 'cuenta_destino',
      width: '150px',
      render: (value) => value || '-'
    },
    {
      header: 'Registrado por',
      accessor: 'registrado_por',
      width: '150px',
      render: (value) => (
        <div className="flex items-center gap-2">
          <User size={14} className="text-muted" />
          <span className="text-sm">{value}</span>
        </div>
      )
    }
  ];

  if (loading && !resumen) {
    return <Loading message="Cargando pagos y cobranzas..." />;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign size={32} />
            Pagos y Cobranzas
          </h1>
          <p className="text-muted">Control de flujo de efectivo</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {resumen && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card border-l-4 border-danger">
            <div className="card-body">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted">Pagos Realizados</p>
                  <h3 className="text-2xl font-bold text-danger">
                    {resumen.pagos.cantidad}
                  </h3>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <ArrowDownCircle size={32} className="text-danger" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="text-muted">PEN:</span>
                  <span className="font-bold ml-2">{formatearMoneda(resumen.pagos.pen, 'PEN')}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted">USD:</span>
                  <span className="font-bold ml-2">{formatearMoneda(resumen.pagos.usd, 'USD')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-success">
            <div className="card-body">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted">Cobranzas Recibidas</p>
                  <h3 className="text-2xl font-bold text-success">
                    {resumen.cobranzas.cantidad}
                  </h3>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <ArrowUpCircle size={32} className="text-success" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="text-muted">PEN:</span>
                  <span className="font-bold ml-2">{formatearMoneda(resumen.cobranzas.pen, 'PEN')}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted">USD:</span>
                  <span className="font-bold ml-2">{formatearMoneda(resumen.cobranzas.usd, 'USD')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`card border-l-4 ${resumen.flujo_neto.pen >= 0 ? 'border-success' : 'border-danger'}`}>
            <div className="card-body">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted">Flujo Neto PEN</p>
                  <h3 className={`text-2xl font-bold ${resumen.flujo_neto.pen >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatearMoneda(resumen.flujo_neto.pen, 'PEN')}
                  </h3>
                </div>
                <div className={`p-3 rounded-lg ${resumen.flujo_neto.pen >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  {resumen.flujo_neto.pen >= 0 ? (
                    <TrendingUp size={32} className="text-success" />
                  ) : (
                    <TrendingDown size={32} className="text-danger" />
                  )}
                </div>
              </div>
              <p className="text-xs text-muted">
                {resumen.flujo_neto.pen >= 0 ? 'Flujo positivo' : 'Flujo negativo'}
              </p>
            </div>
          </div>

          <div className={`card border-l-4 ${resumen.flujo_neto.usd >= 0 ? 'border-success' : 'border-danger'}`}>
            <div className="card-body">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted">Flujo Neto USD</p>
                  <h3 className={`text-2xl font-bold ${resumen.flujo_neto.usd >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatearMoneda(resumen.flujo_neto.usd, 'USD')}
                  </h3>
                </div>
                <div className={`p-3 rounded-lg ${resumen.flujo_neto.usd >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  {resumen.flujo_neto.usd >= 0 ? (
                    <TrendingUp size={32} className="text-success" />
                  ) : (
                    <TrendingDown size={32} className="text-danger" />
                  )}
                </div>
              </div>
              <p className="text-xs text-muted">
                {resumen.flujo_neto.usd >= 0 ? 'Flujo positivo' : 'Flujo negativo'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h2 className="card-title">
              <Filter size={20} />
              Filtros
            </h2>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" onClick={limpiarFiltros}>
                Limpiar
              </button>
              <button className="btn btn-primary btn-sm" onClick={exportarExcel}>
                <Download size={16} />
                Exportar
              </button>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-5 gap-4">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select
                className="form-select"
                value={filtros.tipo}
                onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
              >
                <option value="">Todos</option>
                <option value="pago">Pagos</option>
                <option value="cobranza">Cobranzas</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Fecha Inicio</label>
              <input
                type="date"
                className="form-input"
                value={filtros.fecha_inicio}
                onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Fecha Fin</label>
              <input
                type="date"
                className="form-input"
                value={filtros.fecha_fin}
                onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Método de Pago</label>
              <select
                className="form-select"
                value={filtros.metodo_pago}
                onChange={(e) => setFiltros({ ...filtros, metodo_pago: e.target.value })}
              >
                <option value="">Todos</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Cheque">Cheque</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Deposito">Depósito</option>
                <option value="Yape">Yape</option>
                <option value="Plin">Plin</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Cuenta</label>
              <select
                className="form-select"
                value={filtros.id_cuenta}
                onChange={(e) => setFiltros({ ...filtros, id_cuenta: e.target.value })}
              >
                <option value="">Todas</option>
                {cuentas.map(cuenta => (
                  <option key={cuenta.id_cuenta} value={cuenta.id_cuenta}>
                    {cuenta.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <FileText size={20} />
            Historial de Movimientos
            <span className="badge badge-primary ml-2">{movimientos.length}</span>
          </h2>
        </div>
        <div className="card-body">
          <Table
            columns={columns}
            data={movimientos}
            emptyMessage="No hay movimientos en el período seleccionado"
          />
        </div>
      </div>
    </div>
  );
}

export default PagosCobranzas;