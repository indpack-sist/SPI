import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Edit, Trash2, Wallet, CreditCard, Building2, 
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, Eye, AlertCircle
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
  
  // Estado simplificado: Sin límites de crédito ni fechas de renovación
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'Banco',
    numero_cuenta: '',
    banco: '',
    moneda: 'PEN',
    saldo_inicial: 0,
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
        // En edición no enviamos saldo inicial
        const { saldo_inicial, ...dataToUpdate } = formData;
        const response = await cuentasPagoAPI.update(cuentaSeleccionada.id_cuenta, dataToUpdate);
        if (response.data.success) {
          setSuccess('Cuenta actualizada correctamente');
        }
      } else {
        const response = await cuentasPagoAPI.create(formData);
        if (response.data.success) {
          setSuccess('Cuenta creada e inicializada correctamente');
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
      saldo_inicial: 0, // No se edita el saldo inicial, se hacen ajustes por movimientos
      estado: cuenta.estado
    });
    setModoEdicion(true);
    setModalOpen(true);
  };

  const handleVerDetalle = (id) => {
    // Esta ruta debe llevar al componente de detalle (próximo paso)
    navigate(`/finanzas/cuentas/${id}`);
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Está seguro de desactivar esta cuenta? Solo se puede si el saldo es 0.')) return;
    
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
      estado: 'Activo'
    });
    setCuentaSeleccionada(null);
    setModoEdicion(false);
  };

  const formatearMoneda = (valor, moneda) => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      header: 'Cuenta / Tipo',
      accessor: 'nombre',
      render: (value, row) => {
        const Icon = getTipoIcon(row.tipo);
        return (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${row.tipo === 'Caja' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                <Icon size={20} />
            </div>
            <div>
              <div className="font-bold text-gray-800">{value}</div>
              <div className="text-xs text-muted flex items-center gap-1">
                {row.banco ? `${row.banco} - ` : ''} {row.tipo}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Datos',
      accessor: 'numero_cuenta',
      render: (value, row) => (
        <div className="text-sm">
          {value ? (
             <span className="font-mono bg-gray-50 px-2 py-1 rounded border">{value}</span>
          ) : (
            <span className="text-muted italic">Sin número</span>
          )}
          <div className="mt-1">
            <span className={`badge badge-sm ${row.moneda === 'USD' ? 'badge-success' : 'badge-info'}`}>
                {row.moneda === 'USD' ? 'Dólares USD' : 'Soles PEN'}
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'Flujo Histórico',
      accessor: 'total_ingresos', // Usamos un accessor dummy
      render: (_, row) => (
        <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between items-center w-32">
                <span className="text-success flex items-center gap-1"><ArrowUpRight size={12}/> Ingresos:</span>
                <span className="font-medium">{parseFloat(row.total_ingresos).toLocaleString('es-PE', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center w-32">
                <span className="text-danger flex items-center gap-1"><ArrowDownRight size={12}/> Egresos:</span>
                <span className="font-medium">{parseFloat(row.total_egresos).toLocaleString('es-PE', {minimumFractionDigits: 2})}</span>
            </div>
        </div>
      )
    },
    {
      header: 'Saldo Disponible',
      accessor: 'saldo_actual',
      width: '160px',
      align: 'right',
      render: (value, row) => (
        <div className="text-right">
            <div className={`text-lg font-bold ${parseFloat(value) < 0 ? 'text-danger' : 'text-gray-800'}`}>
            {formatearMoneda(value, row.moneda)}
            </div>
            {row.compras_pendientes > 0 && (
                <div className="flex items-center justify-end gap-1 text-[11px] text-warning font-medium mt-1">
                    <AlertCircle size={12} />
                    {row.compras_pendientes} compras por pagar
                </div>
            )}
        </div>
      )
    },
    {
      header: 'Acciones',
      accessor: 'id_cuenta',
      width: '120px',
      align: 'center',
      render: (value, row) => (
        <div className="flex gap-1 justify-center">
          <button
            className="btn btn-sm btn-ghost text-primary hover:bg-primary/10"
            onClick={() => handleVerDetalle(value)}
            title="Ver Trazabilidad y Movimientos"
          >
            <Eye size={18} />
          </button>
          <button
            className="btn btn-sm btn-ghost text-gray-600 hover:bg-gray-100"
            onClick={() => handleEditar(row)}
            title="Editar Información"
          >
            <Edit size={18} />
          </button>
          <button
            className="btn btn-sm btn-ghost text-danger hover:bg-danger/10"
            onClick={() => handleEliminar(value)}
            title={parseFloat(row.saldo_actual) !== 0 ? "El saldo debe ser 0 para desactivar" : "Desactivar"}
            disabled={parseFloat(row.saldo_actual) !== 0}
          >
            <Trash2 size={18} />
          </button>
        </div>
      )
    }
  ];

  if (loading && cuentas.length === 0) {
    return <Loading message="Sincronizando cuentas y saldos..." />;
  }

  // Cálculos para las tarjetas superiores usando datos reales
  const totalPEN = cuentas.filter(c => c.moneda === 'PEN').reduce((sum, c) => sum + parseFloat(c.saldo_actual || 0), 0);
  const totalUSD = cuentas.filter(c => c.moneda === 'USD').reduce((sum, c) => sum + parseFloat(c.saldo_actual || 0), 0);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
            <Wallet className="text-primary" size={32} />
            Tesorería y Cuentas
          </h1>
          <p className="text-muted mt-1">Gestión centralizada de cajas, bancos y flujo de dinero.</p>
        </div>
        <button 
          className="btn btn-primary shadow-lg hover:shadow-xl transition-all"
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

      {/* Tarjetas de Resumen Global */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-white to-blue-50 border-l-4 border-primary shadow-sm">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted uppercase tracking-wider">Saldo Total Soles</p>
                <h3 className={`text-3xl font-bold mt-2 ${totalPEN < 0 ? 'text-danger' : 'text-gray-800'}`}>
                    S/ {totalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-4 bg-white rounded-full shadow-sm">
                <span className="font-bold text-xl text-primary">S/</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-white to-green-50 border-l-4 border-success shadow-sm">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted uppercase tracking-wider">Saldo Total Dólares</p>
                <h3 className={`text-3xl font-bold mt-2 ${totalUSD < 0 ? 'text-danger' : 'text-gray-800'}`}>
                    $ {totalUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-4 bg-white rounded-full shadow-sm">
                <span className="font-bold text-xl text-success">$</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-md border-0">
        <div className="card-header bg-white border-b py-4">
          <h2 className="card-title flex items-center gap-2">
            Listado de Cuentas Activas
            <span className="badge badge-primary ml-2 rounded-full px-3">{cuentas.length}</span>
          </h2>
        </div>
        <div className="card-body p-0">
          <Table
            columns={columns}
            data={cuentas}
            emptyMessage={
                <div className="text-center py-12">
                    <Wallet size={48} className="mx-auto text-gray-300 mb-3"/>
                    <p className="text-gray-500">No hay cuentas configuradas aún.</p>
                </div>
            }
          />
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={modoEdicion ? 'Editar Información de Cuenta' : 'Apertura de Nueva Cuenta'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-800 flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>Las cuentas creadas funcionarán como registro de activos. No establezca límites de crédito aquí; el sistema permitirá saldos negativos si es necesario para registrar deudas.</p>
            </div>

            <div className="form-group">
              <label className="form-label font-medium">Nombre Identificativo *</label>
              <input
                type="text"
                className="form-input"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
                placeholder="Ej: BCP Principal Soles, Caja Chica Oficina..."
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="form-group">
                <label className="form-label font-medium">Tipo de Cuenta *</label>
                <select
                  className="form-select"
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  required
                >
                  <option value="Banco">Banco</option>
                  <option value="Caja">Caja Efectivo</option>
                  <option value="Tarjeta">Tarjeta (Crédito/Débito)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label font-medium">Moneda *</label>
                <select
                  className="form-select"
                  value={formData.moneda}
                  onChange={(e) => setFormData({ ...formData, moneda: e.target.value })}
                  required
                  disabled={modoEdicion} // Bloqueamos moneda en edición para evitar inconsistencias
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
                {modoEdicion && <small className="text-muted text-xs">La moneda no se puede cambiar.</small>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
                <div className="form-group">
                <label className="form-label font-medium">Entidad Bancaria</label>
                <input
                    type="text"
                    className="form-input"
                    value={formData.banco}
                    onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                    placeholder="Ej: BCP, Interbank..."
                />
                </div>

                <div className="form-group">
                <label className="form-label font-medium">Número de Cuenta</label>
                <input
                    type="text"
                    className="form-input"
                    value={formData.numero_cuenta}
                    onChange={(e) => setFormData({ ...formData, numero_cuenta: e.target.value })}
                    placeholder="Opcional"
                />
                </div>
            </div>

            {!modoEdicion && (
              <div className="form-group border-t pt-4 mt-2">
                <label className="form-label font-medium flex items-center gap-2">
                    <TrendingUp size={16} />
                    Saldo Inicial de Apertura
                </label>
                <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500 font-bold">
                        {formData.moneda === 'USD' ? '$' : 'S/'}
                    </span>
                    <input
                    type="number"
                    className="form-input pl-10 font-bold text-lg"
                    value={formData.saldo_inicial}
                    onChange={(e) => setFormData({ ...formData, saldo_inicial: e.target.value })}
                    step="0.01"
                    placeholder="0.00"
                    />
                </div>
                <small className="text-muted mt-1 block">
                  Se creará un movimiento automático de "Saldo inicial" con este monto.
                </small>
              </div>
            )}

            {modoEdicion && (
              <div className="form-group bg-gray-50 p-3 rounded-lg">
                <label className="form-label font-medium">Estado</label>
                <select
                  className="form-select"
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo (Solo si saldo es 0)</option>
                </select>
              </div>
            )}

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t">
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary px-6" disabled={loading}>
                {loading ? 'Procesando...' : modoEdicion ? 'Guardar Cambios' : 'Crear Cuenta'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default CuentasPago;