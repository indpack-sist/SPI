import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  X, 
  FileText, 
  Loader,
  // IMPORTES PARA PAGINACIÓN
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { salidasAPI, productosAPI, clientesAPI, flotaAPI, empleadosAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function Salidas() {
  const [salidas, setSalidas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [tiposInventario, setTiposInventario] = useState([]);
  const [tiposMovimiento, setTiposMovimiento] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [generandoPDF, setGenerandoPDF] = useState({});

  // ESTADOS DE PAGINACIÓN
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [detalles, setDetalles] = useState([{
    id_producto: '',
    cantidad: '',
    precio_unitario: '',
    producto_nombre: ''
  }]);

  const [formData, setFormData] = useState({
    id_tipo_inventario: '',
    tipo_movimiento: 'Venta',
    id_cliente: '',
    departamento: '',
    moneda: 'PEN',
    id_vehiculo: '',
    id_registrado_por: '',
    observaciones: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  // RESETEAR A PÁGINA 1 AL FILTRAR
  useEffect(() => {
    setCurrentPage(1);
  }, [filtro]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [salidasRes, productosRes, clientesRes, vehiculosRes, empRes, tiposInvRes, tiposMovRes] = await Promise.all([
        salidasAPI.getAll(),
        productosAPI.getAll(),
        clientesAPI.getAll({ estado: 'Activo' }),
        flotaAPI.getDisponibles(),
        empleadosAPI.getAll({ estado: 'Activo' }),
        productosAPI.getTiposInventario(),
        salidasAPI.getTiposMovimiento()
      ]);
      
      setSalidas(salidasRes.data.data || []); // Asegurar array
      setProductos(productosRes.data.data || []);
      setClientes(clientesRes.data.data || []);
      setVehiculos(vehiculosRes.data.data || []);
      setEmpleados(empRes.data.data || []);
      setTiposInventario(tiposInvRes.data.data || []);
      setTiposMovimiento(tiposMovRes.data.data || []);
    } catch (err) {
      setError(err.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = async (salida = null) => {
    setError(null);
    
    if (salida) {
      if (salida.num_productos > 1) {
        setError(`Esta salida contiene ${salida.num_productos} productos. La edición está limitada a campos de cabecera y no es recomendada. Anule y registre una nueva si necesita cambiar los productos.`);
      }
      
      try {
        const salidaCompletaRes = await salidasAPI.getById(salida.id_salida);
        const salidaCompleta = salidaCompletaRes.data.data;
        
        setEditando(salidaCompleta);
        
        setFormData({
          id_tipo_inventario: salidaCompleta.id_tipo_inventario,
          tipo_movimiento: salidaCompleta.tipo_movimiento,
          id_cliente: salidaCompleta.id_cliente || '',
          departamento: salidaCompleta.departamento || '',
          moneda: salidaCompleta.moneda || 'PEN',
          id_vehiculo: salidaCompleta.id_vehiculo || '',
          id_registrado_por: salidaCompleta.id_registrado_por,
          observaciones: salidaCompleta.observaciones || ''
        });
        
        if (salidaCompleta.detalles && salidaCompleta.detalles.length > 0) {
          setDetalles(salidaCompleta.detalles.map(d => ({
            id_producto: d.id_producto,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario || '',
            producto_nombre: d.producto
          })));
        }
      } catch (err) {
        setError(err.error || 'Error al cargar detalles de la salida.');
        return;
      }

    } else {
      setEditando(null);
      setFormData({
        id_tipo_inventario: '',
        tipo_movimiento: 'Venta',
        id_cliente: '',
        departamento: '',
        moneda: 'PEN',
        id_vehiculo: '',
        id_registrado_por: '',
        observaciones: ''
      });
      setDetalles([{
        id_producto: '',
        cantidad: '',
        precio_unitario: '',
        producto_nombre: ''
      }]);
    }
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
  };

  const agregarDetalle = () => {
    setDetalles([...detalles, {
      id_producto: '',
      cantidad: '',
      precio_unitario: '',
      producto_nombre: ''
    }]);
  };

  const eliminarDetalle = (index) => {
    if (detalles.length === 1) {
      setError('Debe haber al menos un producto en la salida');
      return;
    }
    const nuevosDetalles = detalles.filter((_, i) => i !== index);
    setDetalles(nuevosDetalles);
  };

  const actualizarDetalle = (index, campo, valor) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index][campo] = valor;

    if (campo === 'id_producto') {
      const producto = productos.find(p => p.id_producto == valor);
      if (producto) {
        if (formData.tipo_movimiento === 'Venta') {
          nuevosDetalles[index].precio_unitario = producto.precio_venta || '';
        }
        nuevosDetalles[index].producto_nombre = producto.nombre;
      }
    }

    setDetalles(nuevosDetalles);
  };

  const handleGenerarPDF = async (id) => {
    try {
      setGenerandoPDF({ ...generandoPDF, [id]: true });
      setError(null);
      
      const response = await salidasAPI.generarPDF(id);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      window.open(url, '_blank');
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
      
      setSuccess('PDF generado exitosamente');
    } catch (err) {
      console.error('Error al generar PDF:', err);
      setError(err.error || 'Error al generar PDF');
    } finally {
      setGenerandoPDF({ ...generandoPDF, [id]: false });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editando) {
        
        const payload = {
          ...formData,
          id_producto: editando.detalles[0]?.id_producto,
          cantidad: detalles[0].cantidad,
          precio_unitario: detalles[0].precio_unitario || null,
        };

        await salidasAPI.update(editando.id_salida, payload);
        setSuccess('Salida actualizada exitosamente');

      } else {
        
        const detallesValidos = detalles
          .filter(d => d.id_producto && d.cantidad)
          .map(d => ({
            id_producto: d.id_producto,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario || null
          }));
        
        if (detallesValidos.length === 0) {
          setError('Debe agregar al menos un producto con cantidad válida.');
          return;
        }

        const payload = {
          ...formData,
          detalles: detallesValidos
        };
        
        await salidasAPI.create(payload);
        setSuccess(`${detallesValidos.length} producto(s) registrado(s) en la salida exitosamente.`);
      }

      cerrarModal();
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al guardar salida');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de anular esta salida? Esta acción revertirá el stock de todos los productos asociados.')) return;

    try {
      setError(null);
      await salidasAPI.delete(id);
      setSuccess('Salida anulada exitosamente');
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al anular salida');
    }
  };

  const formatearMoneda = (valor, moneda = 'PEN') => {
    const simbolos = { 'PEN': 'S/', 'USD': '$', 'EUR': '€' };
    return `${simbolos[moneda] || moneda} ${parseFloat(valor || 0).toFixed(2)}`;
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calcularPrecioTotal = () => {
    return detalles.reduce((total, detalle) => {
      const cantidad = parseFloat(detalle.cantidad) || 0;
      const precio = parseFloat(detalle.precio_unitario) || 0;
      return total + (cantidad * precio);
    }, 0);
  };

  // 1. FILTRADO
  const salidasFiltradas = salidas.filter(s =>
    (s.productos_resumen && s.productos_resumen.toLowerCase().includes(filtro.toLowerCase())) ||
    s.tipo_movimiento.toLowerCase().includes(filtro.toLowerCase()) ||
    (s.cliente && s.cliente.toLowerCase().includes(filtro.toLowerCase())) ||
    (s.departamento && s.departamento.toLowerCase().includes(filtro.toLowerCase()))
  );

  // 2. PAGINACIÓN
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = salidasFiltradas.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(salidasFiltradas.length / itemsPerPage);

  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  const productosDisponibles = productos.filter(p => 
    p.estado === 'Activo' && 
    (!formData.id_tipo_inventario || p.id_tipo_inventario == formData.id_tipo_inventario)
  );

  const requiereCliente = formData.tipo_movimiento === 'Venta';
  const requiereDepartamento = formData.tipo_movimiento === 'Consumo Interno';
  const esVenta = formData.tipo_movimiento === 'Venta';

  const columns = [
    { header: 'ID', accessor: 'id_salida', width: '80px' }, 
    { 
      header: 'Fecha', 
      accessor: 'fecha_movimiento',
      render: (value) => formatearFecha(value)
    },
    { header: 'Tipo', accessor: 'tipo_movimiento' },
    { 
      header: 'Productos', 
      accessor: 'productos_resumen', 
      render: (value, row) => (
        <div className="tooltip" data-tip={value}>
          <strong>{row.num_productos}</strong> {row.num_productos === 1 ? row.productos_resumen : 'productos'}
        </div>
      )
    },
    { 
      header: 'Cliente/Destino', 
      accessor: 'destino_final',
      render: (value, row) => value || row.departamento || '-'
    },
    {
      header: 'Precio Total',
      accessor: 'total_precio', 
      align: 'right',
      render: (value, row) => value ? formatearMoneda(value, row.moneda) : '-'
    },
    {
      header: 'Estado',
      accessor: 'estado',
      render: (value) => (
        <span className={`badge ${value === 'Activo' ? 'badge-success' : 'badge-danger'}`}>
          {value}
        </span>
      )
    },
    {
      header: 'PDF',
      accessor: 'id_salida', 
      width: '80px',
      align: 'center',
      render: (value, row) => (
        <button
          className="btn btn-sm btn-outline"
          onClick={() => handleGenerarPDF(value)}
          title="Generar PDF"
          disabled={row.estado === 'Anulado' || generandoPDF[value]}
        >
          {generandoPDF[value] ? (
            <Loader size={14} className="animate-spin" />
          ) : (
            <FileText size={14} />
          )}
        </button>
      )
    },
    {
      header: 'Acciones',
      accessor: 'id_salida', 
      width: '120px',
      align: 'center',
      render: (value, row) => (
        <div className="flex gap-2 justify-center">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => abrirModal(row)}
            title="Editar"
            disabled={row.estado === 'Anulado'}
          >
            <Edit size={14} />
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => handleDelete(value)}
            title="Anular"
            disabled={row.estado === 'Anulado'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  if (loading) {
    return <Loading message="Cargando salidas..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="card-title">Salidas de Inventario</h1>
          <p className="text-muted">Registro de ventas y salidas de materiales</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirModal()}>
          <Plus size={20} />
          Nueva Salida
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
              placeholder="Buscar por productos, tipo o cliente..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>
      </div>

      {/* TABLA CON PAGINACIÓN */}
      <div className="card">
         {/* Info superior */}
         <div className="p-3 border-b border-border text-sm text-muted">
             Mostrando {currentItems.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, salidasFiltradas.length)} de {salidasFiltradas.length} salidas
         </div>

        {/* Tabla usa currentItems */}
        <Table
          columns={columns}
          data={currentItems}
          emptyMessage="No se encontraron salidas"
        />

        {/* Footer de Paginación */}
        {salidasFiltradas.length > itemsPerPage && (
          <div className="card-footer border-t border-border p-4 flex justify-between items-center bg-gray-50/50">
            <button 
                className="btn btn-sm btn-outline flex items-center gap-1"
                onClick={goToPrevPage}
                disabled={currentPage === 1}
            >
                <ChevronLeft size={16} /> Anterior
            </button>

            <span className="text-sm font-medium">
                Página {currentPage} de {totalPages}
            </span>

            <button 
                className="btn btn-sm btn-outline flex items-center gap-1"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
            >
                Siguiente <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={cerrarModal}
        title={editando ? 'Editar Salida' : 'Nueva Salida de Inventario'}
        size="xl"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Tipo de Inventario *</label>
              <select
                className="form-select"
                value={formData.id_tipo_inventario}
                onChange={(e) => setFormData({ ...formData, id_tipo_inventario: e.target.value })}
                required
              >
                <option value="">Seleccione...</option>
                {tiposInventario.map(tipo => (
                  <option key={tipo.id_tipo_inventario} value={tipo.id_tipo_inventario}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de Movimiento *</label>
              <select
                className="form-select"
                value={formData.tipo_movimiento}
                onChange={(e) => setFormData({ ...formData, tipo_movimiento: e.target.value })}
                required
              >
                {tiposMovimiento.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>
          </div>

          {requiereCliente && (
            <div className="form-group">
              <label className="form-label">Cliente *</label>
              <select
                className="form-select"
                value={formData.id_cliente}
                onChange={(e) => setFormData({ ...formData, id_cliente: e.target.value })}
                required
              >
                <option value="">Seleccione un cliente...</option>
                {clientes.map(c => (
                  <option key={c.id_cliente} value={c.id_cliente}>
                    {c.razon_social}
                  </option>
                ))}
              </select>
            </div>
          )}

          {requiereDepartamento && (
            <div className="form-group">
              <label className="form-label">Departamento/Área *</label>
              <input
                type="text"
                className="form-input"
                value={formData.departamento}
                onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                required
                placeholder="Ej: Producción, Almacén, etc."
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {esVenta && (
              <div className="form-group">
                <label className="form-label">Moneda *</label>
                <select
                  className="form-select"
                  value={formData.moneda}
                  onChange={(e) => setFormData({ ...formData, moneda: e.target.value })}
                  required
                >
                  <option value="PEN">Soles (S/)</option>
                  <option value="USD">Dólares ($)</option>
                  <option value="EUR">Euros (€)</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Vehículo Asignado</label>
              <select
                className="form-select"
                value={formData.id_vehiculo}
                onChange={(e) => setFormData({ ...formData, id_vehiculo: e.target.value })}
              >
                <option value="">Sin vehículo</option>
                {vehiculos.map(v => (
                  <option key={v.id_vehiculo} value={v.id_vehiculo}>
                    {v.placa} - {v.marca} {v.modelo}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Registrado Por *</label>
              <select
                className="form-select"
                value={formData.id_registrado_por}
                onChange={(e) => setFormData({ ...formData, id_registrado_por: e.target.value })}
                required
              >
                <option value="">Seleccione un empleado...</option>
                {empleados.map(emp => (
                  <option key={emp.id_empleado} value={emp.id_empleado}>
                    {emp.nombre_completo} - {emp.rol}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <div className="flex justify-between items-center mb-2">
              <label className="form-label" style={{ marginBottom: 0 }}>
                Productos * {editando ? `(${editando.detalles.length})` : `(${detalles.length})`}
              </label>
              {!editando && ( 
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={agregarDetalle}
                >
                  <Plus size={16} />
                  Agregar Producto
                </button>
              )}
            </div>

            <div className="space-y-3">
              {detalles.map((detalle, index) => (
                <div key={index} className="card p-3" style={{ background: 'var(--bg-secondary)' }}>
                  <div className="flex items-start gap-3">
                    <div className={`flex-1 grid ${esVenta ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Producto</label>
                        <select
                          className="form-select"
                          value={detalle.id_producto}
                          onChange={(e) => actualizarDetalle(index, 'id_producto', e.target.value)}
                          required
                          disabled={editando && editando.detalles.length > 1}
                        >
                          <option value="">Seleccione...</option>
                          {productosDisponibles.map(prod => (
                            <option key={prod.id_producto} value={prod.id_producto}>
                              {prod.codigo} - {prod.nombre} (Stock: {prod.stock_actual} {prod.unidad_medida})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Cantidad</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input"
                          value={detalle.cantidad}
                          onChange={(e) => actualizarDetalle(index, 'cantidad', e.target.value)}
                          required
                          placeholder="0.00"
                          disabled={editando && editando.detalles.length > 1}
                        />
                      </div>

                      {esVenta && (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Precio Unitario</label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            value={detalle.precio_unitario}
                            onChange={(e) => actualizarDetalle(index, 'precio_unitario', e.target.value)}
                            placeholder="0.00"
                            disabled={editando && editando.detalles.length > 1}
                          />
                        </div>
                      )}
                    </div>

                    {!editando && detalles.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => eliminarDetalle(index)}
                        style={{ marginTop: '1.5rem' }}
                      >
                        <X size={16} />
                      </button>
                    )}

                      {/* Mensaje de advertencia en edición si es múltiple */}
                      {editando && editando.detalles.length > 1 && index === 0 && (
                          <div className="alert alert-warning text-xs mt-2 p-2" style={{ marginTop: '1.5rem' }}>
                            Solo se muestra el primer producto para referencia. La edición del detalle no está permitida en salidas con múltiples productos.
                          </div>
                      )}
                  </div>

                  {esVenta && detalle.cantidad && detalle.precio_unitario && (
                    <div className="mt-2 text-sm text-muted">
                      Subtotal: <strong>{formatearMoneda(parseFloat(detalle.cantidad) * parseFloat(detalle.precio_unitario), formData.moneda)}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea
              className="form-textarea"
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              placeholder="Notas adicionales sobre la salida"
              rows={3}
            />
          </div>

          {esVenta && detalles.some(d => d.cantidad && d.precio_unitario) && (
            <div className="alert alert-info">
              <strong>Precio Total de la Venta:</strong> {formatearMoneda(calcularPrecioTotal(), formData.moneda)}
            </div>
          )}

          <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editando ? 'Actualizar' : 'Registrar'} Salida
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Salidas;