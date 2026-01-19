import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Edit, Trash2, Wallet, CreditCard, Building2, 
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, Eye
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { cuentasPagoAPI } from '../../config/api';

function CuentasPago() {
  const navigate = useNavigate();
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'Banco',
    numero_cuenta: '',
    banco: '',
    moneda: 'PEN',
    saldo_inicial: 0,
    limite_credito: 0,
    fecha_renovacion: '',
    estado: 'Activo'
  });

  useEffect(() => {
    cargarCuentas();
  }, []);

  const cargarCuentas = async () => {
    try {
      setLoading(true);
      const response = await cuentasPagoAPI.getAll({ estado: 'Activo' });
      
      if (response.data.success) {
        setCuentas(response.data.data || []);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar cuentas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      if (modoEdicion) {
        const response = await cuentasPagoAPI.update(cuentaSeleccionada.id_cuenta, formData);
        if (response.data.success) {
          setSuccess('Cuenta actualizada exitosamente');
        }
      } else {
        const response = await cuentasPagoAPI.create(formData);
        if (response.data.success) {
          setSuccess('Cuenta creada exitosamente');
        }
      }
      
      setModalOpen(false);
      resetForm();
      await cargarCuentas();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al guardar cuenta');
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (cuenta) => {
    setCuentaSeleccionada(cuenta);
    setFormData({
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      numero_cuenta: cuenta.numero_cuenta || '',
      banco: cuenta.banco || '',
      moneda: cuenta.moneda,
      saldo_inicial: 0,
      limite_credito: cuenta.limite_credito || 0,
      fecha_renovacion: cuenta.fecha_renovacion ? cuenta.fecha_renovacion.split('T')[0] : '',
      estado: cuenta.estado
    });
    setModoEdicion(true);
    setModalOpen(true);
  };

  const handleVerDetalle = (id) => {
    navigate(`/finanzas/cuentas/${id}`);
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Está seguro de desactivar esta cuenta?')) return;
    
    try {
      setLoading(true);
      const response = await cuentasPagoAPI.delete(id);
      
      if (response.data.success) {
        setSuccess('Cuenta desactivada exitosamente');
        await cargarCuentas();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al desactivar cuenta');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      tipo: 'Banco',
      numero_cuenta: '',
      banco: '',
      moneda: 'PEN',
      saldo_inicial: 0,
      limite_credito: 0,
      fecha_renovacion: '',
      estado: 'Activo'
    });
    setCuentaSeleccionada(null);
    setModoEdicion(false);
  };

  const formatearMoneda = (valor, moneda) => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toFixed(2)}`;
  };

  const getTipoIcon = (tipo) => {
    const icons = {
      'Banco': Building2,
      'Caja': Wallet,
      'Tarjeta': CreditCard
    };
    return icons[tipo] || Wallet;
  };

  const columns = [
    {
      header: 'Nombre',
      accessor: 'nombre',
      render: (value, row) => {
        const Icon = getTipoIcon(row.tipo);
        return (
          <div className="flex items-center gap-2">
            <Icon size={18} className="text-primary" />
            <div>
              <div className="font-medium">{value}</div>
              <div className="text-xs text-muted flex gap-1">
                {row.tipo}
                {row.tipo === 'Tarjeta' && row.requiere_renovacion === 1 && (
                    <span className="text-danger font-bold ml-1">• Renovación Pendiente</span>
                )}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Banco / Número',
      accessor: 'banco',
      render: (value, row) => (
        <div>
          {value && <div className="font-medium">{value}</div>}
          {row.numero_cuenta && (
            <div className="text-xs font-mono text-muted">{row.numero_cuenta}</div>
          )}
          {!value && !row.numero_cuenta && (
            <div className="text-xs text-muted">-</div>
          )}
        </div>
      )
    },
    {
      header: 'Moneda',
      accessor: 'moneda',
      width: '100px',
      align: 'center',
      render: (value) => (
        <span className={`badge ${value === 'USD' ? 'badge-success' : 'badge-info'}`}>
          {value === 'USD' ? 'USD $' : 'PEN S/'}
        </span>
      )
    },
    {
      header: 'Saldo Actual',
      accessor: 'saldo_actual',
      width: '140px',
      align: 'right',
      render: (value, row) => (
        <div>
            <span className={`font-bold ${parseFloat(value) < 0 ? 'text-danger' : 'text-success'}`}>
            {formatearMoneda(value, row.moneda)}
            </span>
            {row.tipo === 'Tarjeta' && (
                <div className="text-[10px] text-muted">
                    Límite: {formatearMoneda(row.limite_credito, row.moneda)}
                </div>
            )}
        </div>
      )
    },
    {
      header: 'Movimientos',
      accessor: 'total_movimientos',
      width: '100px',
      align: 'center',
      render: (value) => (
        <span className="badge badge-outline">{value || 0}</span>
      )
    },
    {
      header: 'Acciones',
      accessor: 'id_cuenta',
      width: '140px',
      align: 'center',
      render: (value, row) => (
        <div className="flex gap-1 justify-center">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => handleVerDetalle(value)}
            title="Ver Trazabilidad Detallada"
          >
            <Eye size={14} />
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => handleEditar(row)}
            title="Editar"
          >
            <Edit size={14} />
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => handleEliminar(value)}
            title="Desactivar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  if (loading && cuentas.length === 0) {
    return <Loading message="Cargando cuentas..." />;
  }

  const totalPEN = cuentas
    .filter(c => c.moneda === 'PEN')
    .reduce((sum, c) => sum + parseFloat(c.saldo_actual || 0), 0);
  
  const totalUSD = cuentas
    .filter(c => c.moneda === 'USD')
    .reduce((sum, c) => sum + parseFloat(c.saldo_actual || 0), 0);

  const totalIngresosPEN = cuentas
    .filter(c => c.moneda === 'PEN')
    .reduce((sum, c) => sum + parseFloat(c.total_ingresos || 0), 0);

  const totalEgresosPEN = cuentas
    .filter(c => c.moneda === 'PEN')
    .reduce((sum, c) => sum + parseFloat(c.total_egresos || 0), 0);

  const totalIngresosUSD = cuentas
    .filter(c => c.moneda === 'USD')
    .reduce((sum, c) => sum + parseFloat(c.total_ingresos || 0), 0);

  const totalEgresosUSD = cuentas
    .filter(c => c.moneda === 'USD')
    .reduce((sum, c) => sum + parseFloat(c.total_egresos || 0), 0);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet size={32} />
            Cuentas de Pago
          </h1>
          <p className="text-muted">Control de flujos, cajas y bancos</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
        >
          <Plus size={20} />
          Nueva Cuenta
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card border-l-4 border-info">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Saldo Neto Soles</p>
                <h3 className={`text-2xl font-bold ${totalPEN < 0 ? 'text-danger' : 'text-primary'}`}>
                    S/ {totalPEN.toFixed(2)}
                </h3>
                <p className="text-xs text-muted mt-1">
                  {cuentas.filter(c => c.moneda === 'PEN').length} cuentas
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign size={32} className="text-info" />
              </div>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-success">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Saldo Neto Dólares</p>
                <h3 className={`text-2xl font-bold ${totalUSD < 0 ? 'text-danger' : 'text-success'}`}>
                    $ {totalUSD.toFixed(2)}
                </h3>
                <p className="text-xs text-muted mt-1">
                  {cuentas.filter(c => c.moneda === 'USD').length} cuentas
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign size={32} className="text-success" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Ingresos Históricos</p>
                <h3 className="text-lg font-bold text-success">S/ {totalIngresosPEN.toFixed(2)}</h3>
                <p className="text-sm font-bold text-success">$ {totalIngresosUSD.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <ArrowUpRight size={24} className="text-success" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Egresos Históricos</p>
                <h3 className="text-lg font-bold text-danger">S/ {totalEgresosPEN.toFixed(2)}</h3>
                <p className="text-sm font-bold text-danger">$ {totalEgresosUSD.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <ArrowDownRight size={24} className="text-danger" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            Listado de Cuentas
            <span className="badge badge-primary ml-2">{cuentas.length}</span>
          </h2>
        </div>
        <div className="card-body">
          <Table
            columns={columns}
            data={cuentas}
            emptyMessage="No hay cuentas registradas"
          />
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={modoEdicion ? 'Editar Cuenta' : 'Nueva Cuenta'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label">Nombre de la Cuenta *</label>
              <input
                type="text"
                className="form-input"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
                placeholder="Ej: Cuenta BCP Principal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Tipo *</label>
                <select
                  className="form-select"
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  required
                >
                  <option value="Banco">Banco</option>
                  <option value="Caja">Caja</option>
                  <option value="Tarjeta">Tarjeta de Crédito</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Moneda *</label>
                <select
                  className="form-select"
                  value={formData.moneda}
                  onChange={(e) => setFormData({ ...formData, moneda: e.target.value })}
                  required
                  disabled={modoEdicion}
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
                {modoEdicion && (
                  <small className="text-muted">No editable</small>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Banco / Entidad</label>
              <input
                type="text"
                className="form-input"
                value={formData.banco}
                onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                placeholder="Nombre del banco"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Número de Cuenta</label>
              <input
                type="text"
                className="form-input"
                value={formData.numero_cuenta}
                onChange={(e) => setFormData({ ...formData, numero_cuenta: e.target.value })}
                placeholder="Número de cuenta"
              />
            </div>

            {formData.tipo === 'Tarjeta' && (
                <div className="p-3 bg-gray-50 border rounded-lg space-y-3">
                    <h4 className="font-bold text-sm text-gray-700">Datos de Crédito</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-group">
                            <label className="form-label">Límite de Crédito</label>
                            <input
                                type="number"
                                className="form-input"
                                value={formData.limite_credito}
                                onChange={(e) => setFormData({ ...formData, limite_credito: e.target.value })}
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Fecha Corte / Renovación</label>
                            <input
                                type="date"
                                className="form-input"
                                value={formData.fecha_renovacion}
                                onChange={(e) => setFormData({ ...formData, fecha_renovacion: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            )}

            {!modoEdicion && (
              <div className="form-group">
                <label className="form-label">
                    {formData.tipo === 'Tarjeta' ? 'Cupo Disponible Inicial' : 'Saldo Inicial'}
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.saldo_inicial}
                  onChange={(e) => setFormData({ ...formData, saldo_inicial: e.target.value })}
                  step="0.01"
                />
                <small className="text-muted">
                    {formData.tipo === 'Tarjeta' 
                        ? 'Debe ser menor o igual al límite.' 
                        : 'Se registrará como saldo de apertura.'}
                </small>
              </div>
            )}

            {modoEdicion && (
              <div className="form-group">
                <label className="form-label">Estado</label>
                <select
                  className="form-select"
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Guardando...' : modoEdicion ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default CuentasPago;