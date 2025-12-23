import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { flotaAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function Flota() {
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState('');

  const [formData, setFormData] = useState({
    placa: '',
    marca_modelo: '',
    capacidad_kg: '',
    capacidad_m3: '',
    estado: 'Disponible'
  });

  useEffect(() => {
    cargarVehiculos();
  }, []);

  const cargarVehiculos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await flotaAPI.getAll();
      setVehiculos(response.data.data);
    } catch (err) {
      setError(err.error || 'Error al cargar vehículos');
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (vehiculo = null) => {
    if (vehiculo) {
      setEditando(vehiculo);
      setFormData({
        placa: vehiculo.placa,
        marca_modelo: vehiculo.marca_modelo || '',
        capacidad_kg: vehiculo.capacidad_kg || '',
        capacidad_m3: vehiculo.capacidad_m3 || '',
        estado: vehiculo.estado
      });
    } else {
      setEditando(null);
      setFormData({
        placa: '',
        marca_modelo: '',
        capacidad_kg: '',
        capacidad_m3: '',
        estado: 'Disponible'
      });
    }
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editando) {
        await flotaAPI.update(editando.id_vehiculo, formData);
        setSuccess('Vehículo actualizado exitosamente');
      } else {
        await flotaAPI.create(formData);
        setSuccess('Vehículo registrado exitosamente');
      }
      cerrarModal();
      cargarVehiculos();
    } catch (err) {
      setError(err.error || 'Error al guardar vehículo');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de desactivar este vehículo?')) return;

    try {
      setError(null);
      await flotaAPI.delete(id);
      setSuccess('Vehículo desactivado exitosamente');
      cargarVehiculos();
    } catch (err) {
      setError(err.error || 'Error al desactivar vehículo');
    }
  };

  const vehiculosFiltrados = vehiculos.filter(v =>
    v.placa.toLowerCase().includes(filtro.toLowerCase()) ||
    (v.marca_modelo && v.marca_modelo.toLowerCase().includes(filtro.toLowerCase()))
  );

  const columns = [
    { header: 'ID', accessor: 'id_vehiculo', width: '80px' },
    { header: 'Placa', accessor: 'placa' },
    { header: 'Marca/Modelo', accessor: 'marca_modelo' },
    {
      header: 'Capacidad (kg)',
      accessor: 'capacidad_kg',
      align: 'right',
      render: (value) => value ? `${parseFloat(value).toFixed(2)} kg` : '-'
    },
    {
      header: 'Capacidad (m³)',
      accessor: 'capacidad_m3',
      align: 'right',
      render: (value) => value ? `${parseFloat(value).toFixed(2)} m³` : '-'
    },
    {
      header: 'Estado',
      accessor: 'estado',
      render: (value) => {
        const badges = {
          'Disponible': 'badge-success',
          'En Uso': 'badge-warning',
          'Mantenimiento': 'badge-secondary',
          'Inactivo': 'badge-danger'
        };
        return <span className={`badge ${badges[value]}`}>{value}</span>;
      }
    },
    {
      header: 'Acciones',
      accessor: 'id_vehiculo',
      width: '120px',
      align: 'center',
      render: (value, row) => (
        <div className="flex gap-2 justify-center">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => abrirModal(row)}
            title="Editar"
          >
            <Edit size={14} />
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => handleDelete(value)}
            title="Desactivar"
            disabled={row.estado === 'Inactivo'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  if (loading) {
    return <Loading message="Cargando flota..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="card-title">Flota de Vehículos</h1>
          <p className="text-muted">Gestión de vehículos de transporte</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirModal()}>
          <Plus size={20} />
          Nuevo Vehículo
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="card mb-3">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search 
              size={20} 
              style={{ 
                position: 'absolute', 
                left: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)'
              }} 
            />
            <input
              type="text"
              className="form-input"
              placeholder="Buscar por placa o marca..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>
      </div>

      <Table
        columns={columns}
        data={vehiculosFiltrados}
        emptyMessage="No se encontraron vehículos"
      />

      <Modal
        isOpen={modalOpen}
        onClose={cerrarModal}
        title={editando ? 'Editar Vehículo' : 'Nuevo Vehículo'}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Placa *</label>
            <input
              type="text"
              className="form-input"
              value={formData.placa}
              onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
              required
              placeholder="Ej: ABC-123"
              maxLength={10}
            />
            <small className="text-muted">Formato: ABC-123 o ABC-1234</small>
          </div>

          <div className="form-group">
            <label className="form-label">Marca/Modelo</label>
            <input
              type="text"
              className="form-input"
              value={formData.marca_modelo}
              onChange={(e) => setFormData({ ...formData, marca_modelo: e.target.value })}
              placeholder="Ej: Toyota Hilux 2020"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Capacidad (kg)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={formData.capacidad_kg}
                onChange={(e) => setFormData({ ...formData, capacidad_kg: e.target.value })}
                placeholder="1000"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Capacidad (m³)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={formData.capacidad_m3}
                onChange={(e) => setFormData({ ...formData, capacidad_m3: e.target.value })}
                placeholder="5.0"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Estado *</label>
            <select
              className="form-select"
              value={formData.estado}
              onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
              required
            >
              <option value="Disponible">Disponible</option>
              <option value="En Uso">En Uso</option>
              <option value="Mantenimiento">Mantenimiento</option>
              <option value="Inactivo">Inactivo</option>
            </select>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editando ? 'Actualizar' : 'Registrar'} Vehículo
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Flota;