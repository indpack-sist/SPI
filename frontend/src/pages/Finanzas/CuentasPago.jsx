import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Edit, Trash2, Wallet, CreditCard, Building2, 
  DollarSign, ArrowUpRight, ArrowDownRight, Eye,
  Receipt
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
          setSuccess('Cuenta actualizada correctamente');
        }
      } else {
        const response = await cuentasPagoAPI.create(formData);
        if (response.data.success) {
          setSuccess('Cuenta creada correctamente');
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
            <div className={`p-2 rounded-lg ${row.tipo === 'Caja' ? 'bg-orange-100 text-orange-600' : row.tipo === 'Tarjeta' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
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
      render: (value) => (
        <div className="text-sm">
          {value ? (
             <span className="font-mono bg-gray-50 px-2 py-1 rounded border">{value}</span>
          ) : (
            <span className="text-muted italic">Sin número</span>
          )}
        </div>
      )
    },
    {
      header: 'Actividad',
      accessor: 'total_movimientos',
      width: '180px',
      render: (_, row) => (
        <div className="space-y-2">
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-success flex items-center gap-1">
                <ArrowUpRight size={12}/> Ingresos PEN:
              </span>
              <span className="font-medium">{parseFloat(row.total_ingresos_pen || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-danger flex items-center gap-1">
                <ArrowDownRight size={12}/> Egresos PEN:
              </span>
              <span className="font-medium">{parseFloat(row.total_egresos_pen || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center border-t pt-1 mt-1">
              <span className="text-success flex items-center gap-1">
                <ArrowUpRight size={12}/> Ingresos USD:
              </span>
              <span className="font-medium">{parseFloat(row.total_ingresos_usd || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-danger flex items-center gap-1">
                <ArrowDownRight size={12}/> Egresos USD:
              </span>
              <span className="font-medium">{parseFloat(row.total_egresos_usd || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})}</span>
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'Saldos',
      accessor: 'saldo_pen',
      width: '160px',
      align: 'right',
      render: (_, row) => (
        <div className="text-right space-y-1">
            <div className={`text-base font-bold ${parseFloat(row.saldo_pen) < 0 ? 'text-danger' : 'text-gray-800'}`}>
              {formatearMoneda(row.saldo_pen, 'PEN')}
            </div>
            <div className={`text-base font-bold ${parseFloat(row.saldo_usd) < 0 ? 'text-danger' : 'text-gray-800'}`}>
              {formatearMoneda(row.saldo_usd, 'USD')}
            </div>
            <div className="text-xs text-muted mt-1">
              {row.total_movimientos || 0} movimientos
            </div>
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
            title="Ver Movimientos"
          >
            <Eye size={18} />
          </button>
          <button
            className="btn btn-sm btn-ghost text-gray-600 hover:bg-gray-100"
            onClick={() => handleEditar(row)}
            title="Editar"
          >
            <Edit size={18} />
          </button>
          <button
            className="btn btn-sm btn-ghost text-danger hover:bg-danger/10"
            onClick={() => handleEliminar(value)}
            title="Desactivar"
          >
            <Trash2 size={18} />
          </button>
        </div>
      )
    }
  ];

  if (loading && cuentas.length === 0) {
    return <Loading message="Cargando cuentas..." />;
  }

  const totalPEN = cuentas.reduce((sum, c) => sum + parseFloat(c.saldo_pen || 0), 0);
  const totalUSD = cuentas.reduce((sum, c) => sum + parseFloat(c.saldo_usd || 0), 0);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
            <Wallet className="text-primary" size={32} />
            Cuentas de Pago
          </h1>
          <p className="text-muted mt-1">Gestión de cajas, bancos y movimientos de efectivo</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card bg-gradient-to-br from-white to-blue-50 border-l-4 border-primary shadow-sm">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted uppercase tracking-wider">Saldo Total Soles</p>
                <h3 className={`text-2xl font-bold mt-2 ${totalPEN < 0 ? 'text-danger' : 'text-gray-800'}`}>
                    S/ {totalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-3 bg-white rounded-full shadow-sm">
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
                <h3 className={`text-2xl font-bold mt-2 ${totalUSD < 0 ? 'text-danger' : 'text-gray-800'}`}>
                    $ {totalUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-3 bg-white rounded-full shadow-sm">
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
                    <p className="text-gray-500">No hay cuentas configuradas</p>
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
        title={modoEdicion ? 'Editar Cuenta' : 'Nueva Cuenta'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            
            <div className="form-group">
              <label className="form-label font-medium">Nombre de la Cuenta</label>
              <input
                type="text"
                className="form-input"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
                placeholder="Ej: BCP Cuenta Corriente, Caja Chica..."
              />
            </div>

            <div className="form-group">
              <label className="form-label font-medium">Tipo de Cuenta</label>
              <select
                className="form-select"
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                required
              >
                <option value="Banco">Banco</option>
                <option value="Caja">Caja</option>
                <option value="Tarjeta">Tarjeta</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-5">
                <div className="form-group">
                  <label className="form-label font-medium">Banco</label>
                  <input
                      type="text"
                      className="form-input"
                      value={formData.banco}
                      onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                      placeholder="Opcional"
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

            {modoEdicion && (
              <div className="form-group">
                <label className="form-label font-medium">Estado</label>
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
                {loading ? 'Procesando...' : modoEdicion ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default CuentasPago;