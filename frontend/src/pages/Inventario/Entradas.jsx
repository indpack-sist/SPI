import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, X, FileText, Loader } from 'lucide-react';
import { entradasAPI, productosAPI, proveedoresAPI, empleadosAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function Entradas() {
  const [entradas, setEntradas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [tiposInventario, setTiposInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [generandoPDF, setGenerandoPDF] = useState({});

  const [detalles, setDetalles] = useState([{
    id_producto: '',
    cantidad: '',
    costo_unitario: '',
    producto_nombre: ''
  }]);

  const [formData, setFormData] = useState({
    id_tipo_inventario: '',
    id_proveedor: '',
    documento_soporte: '',
    id_registrado_por: '',
    moneda: 'PEN',
    observaciones: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [entradasRes, productosRes, proveedoresRes, empRes, tiposInvRes] = await Promise.all([
        entradasAPI.getAll(),
        productosAPI.getAll(),
        proveedoresAPI.getAll({ estado: 'Activo' }),
        empleadosAPI.getAll({ estado: 'Activo' }),
        entradasAPI.getTiposInventario()
      ]);
      
      const entradasData = Array.isArray(entradasRes.data?.data) ? entradasRes.data.data : 
                          Array.isArray(entradasRes.data) ? entradasRes.data : [];
      
      const productosData = Array.isArray(productosRes.data?.data) ? productosRes.data.data : 
                           Array.isArray(productosRes.data) ? productosRes.data : [];
      
      const proveedoresData = Array.isArray(proveedoresRes.data?.data) ? proveedoresRes.data.data : 
                             Array.isArray(proveedoresRes.data) ? proveedoresRes.data : [];
      
      const empData = Array.isArray(empRes.data?.data) ? empRes.data.data : 
                     Array.isArray(empRes.data) ? empRes.data : [];
      
      const tiposInvData = Array.isArray(tiposInvRes.data?.data) ? tiposInvRes.data.data : 
                          Array.isArray(tiposInvRes.data) ? tiposInvRes.data : [];

      setEntradas(entradasData);
      setProductos(productosData);
      setProveedores(proveedoresData);
      setEmpleados(empData);
      setTiposInventario(tiposInvData);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError(err.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = async (entrada = null) => {
    setError(null);
    
    if (entrada) {
      if (entrada.num_productos > 1) {
        setError(`Esta entrada contiene ${entrada.num_productos} productos. La edición está limitada. Anule y registre una nueva si necesita cambiar los productos.`);
      }
      
      try {
        const entradaCompletaRes = await entradasAPI.getById(entrada.id_entrada);
        const entradaCompleta = entradaCompletaRes.data?.data || entradaCompletaRes.data;
        
        setEditando(entradaCompleta);
        
        setFormData({
          id_tipo_inventario: entradaCompleta.id_tipo_inventario,
          id_proveedor: entradaCompleta.id_proveedor || '',
          documento_soporte: entradaCompleta.documento_soporte || '',
          id_registrado_por: entradaCompleta.id_registrado_por,
          moneda: entradaCompleta.moneda || 'PEN',
          observaciones: entradaCompleta.observaciones || ''
        });
        
        if (entradaCompleta.detalles && entradaCompleta.detalles.length > 0) {
          setDetalles(entradaCompleta.detalles.map(d => ({
            id_producto: d.id_producto,
            cantidad: d.cantidad,
            costo_unitario: d.costo_unitario,
            producto_nombre: d.producto
          })));
        }
      } catch (err) {
        console.error('Error al cargar entrada:', err);
        setError(err.error || 'Error al cargar detalles de la entrada.');
        return;
      }
    } else {
      setEditando(null);
      setFormData({
        id_tipo_inventario: '',
        id_proveedor: '',
        documento_soporte: '',
        id_registrado_por: '',
        moneda: 'PEN',
        observaciones: ''
      });
      setDetalles([{
        id_producto: '',
        cantidad: '',
        costo_unitario: '',
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
      costo_unitario: '',
      producto_nombre: ''
    }]);
  };

  const eliminarDetalle = (index) => {
    if (detalles.length === 1) {
      setError('Debe haber al menos un producto en la entrada');
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
        nuevosDetalles[index].producto_nombre = producto.nombre;
      }
    }

    setDetalles(nuevosDetalles);
  };

  const handleGenerarPDF = async (id) => {
    try {
      setGenerandoPDF({ ...generandoPDF, [id]: true });
      setError(null);
      
      const response = await entradasAPI.generarPDF(id);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `entrada_${id}_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
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
          costo_unitario: detalles[0].costo_unitario,
        };

        await entradasAPI.update(editando.id_entrada, payload);
        setSuccess('Entrada actualizada exitosamente');
      } else {
        const detallesValidos = detalles
          .filter(d => d.id_producto && d.cantidad)
          .map(d => ({
            id_producto: parseInt(d.id_producto),
            cantidad: parseFloat(d.cantidad),
            costo_unitario: parseFloat(d.costo_unitario)
          }));
        
        if (detallesValidos.length === 0) {
          setError('Debe agregar al menos un producto con cantidad válida.');
          return;
        }

        const payload = {
          ...formData,
          detalles: detallesValidos
        };
        
        await entradasAPI.create(payload);
        setSuccess(`${detallesValidos.length} producto(s) registrado(s) en la entrada exitosamente.`);
      }

      cerrarModal();
      cargarDatos();
    } catch (err) {
      console.error('Error al guardar entrada:', err);
      setError(err.error || 'Error al guardar entrada');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de anular esta entrada? Esta acción revertirá el stock de todos los productos asociados.')) return;

    try {
      setError(null);
      await entradasAPI.delete(id);
      setSuccess('Entrada anulada exitosamente');
      cargarDatos();
    } catch (err) {
      console.error('Error al anular entrada:', err);
      setError(err.error || 'Error al anular entrada');
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

  const calcularCostoTotal = () => {
    return detalles.reduce((total, detalle) => {
      const cantidad = parseFloat(detalle.cantidad) || 0;
      const costo = parseFloat(detalle.costo_unitario) || 0;
      return total + (cantidad * costo);
    }, 0);
  };

  const entradasFiltradas = entradas.filter(e =>
    (e.productos_resumen && e.productos_resumen.toLowerCase().includes(filtro.toLowerCase())) ||
    (e.tipo_inventario && e.tipo_inventario.toLowerCase().includes(filtro.toLowerCase())) ||
    (e.proveedor && e.proveedor.toLowerCase().includes(filtro.toLowerCase())) ||
    (e.documento_soporte && e.documento_soporte.toLowerCase().includes(filtro.toLowerCase()))
  );

  const productosDisponibles = productos.filter(p => 
    p.estado === 'Activo' && 
    (!formData.id_tipo_inventario || p.id_tipo_inventario == formData.id_tipo_inventario)
  );

  const columns = [
    { header: 'ID', accessor: 'id_entrada', width: '80px' },
    { 
      header: 'Fecha', 
      accessor: 'fecha_movimiento',
      render: (value) => formatearFecha(value)
    },
    { header: 'Tipo Inventario', accessor: 'tipo_inventario' },
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
      header: 'Proveedor', 
      accessor: 'proveedor',
      render: (value) => value || '-'
    },
    {
      header: 'Doc. Soporte',
      accessor: 'documento_soporte',
      render: (value) => value || '-'
    },
    {
      header: 'Costo Total',
      accessor: 'total_costo',
      align: 'right',
      render: (value, row) => formatearMoneda(value, row.moneda)
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
      accessor: 'id_entrada',
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
      accessor: 'id_entrada',
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
    return <Loading message="Cargando entradas..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="card-title">Entradas de Inventario</h1>
          <p className="text-muted">Registro de compras y entradas de materiales</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirModal()}>
          <Plus size={20} />
          Nueva Entrada
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
              placeholder="Buscar por productos, tipo, proveedor o documento..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>
      </div>

      <Table
        columns={columns}
        data={entradasFiltradas}
        emptyMessage="No se encontraron entradas"
      />

      <Modal
        isOpen={modalOpen}
        onClose={cerrarModal}
        title={editando ? 'Editar Entrada' : 'Nueva Entrada de Inventario'}
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
                disabled={editando}
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
              <label className="form-label">Proveedor</label>
              <select
                className="form-select"
                value={formData.id_proveedor}
                onChange={(e) => setFormData({ ...formData, id_proveedor: e.target.value })}
              >
                <option value="">Sin proveedor</option>
                {proveedores.map(prov => (
                  <option key={prov.id_proveedor} value={prov.id_proveedor}>
                    {prov.razon_social}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Documento Soporte</label>
              <input
                type="text"
                className="form-input"
                value={formData.documento_soporte}
                onChange={(e) => setFormData({ ...formData, documento_soporte: e.target.value })}
                placeholder="Ej: FACT-001, GR-2024-001"
              />
            </div>

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
                  {emp.nombre_completo} - {emp.cargo || emp.rol}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <div className="flex justify-between items-center mb-2">
              <label className="form-label" style={{ marginBottom: 0 }}>
                Productos * {editando ? `(${editando.detalles?.length || 0})` : `(${detalles.length})`}
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
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Producto</label>
                        <select
                          className="form-select"
                          value={detalle.id_producto}
                          onChange={(e) => actualizarDetalle(index, 'id_producto', e.target.value)}
                          required
                          disabled={editando && editando.num_productos > 1}
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
                          step="0.0001"
                          className="form-input"
                          value={detalle.cantidad}
                          onChange={(e) => actualizarDetalle(index, 'cantidad', e.target.value)}
                          required
                          placeholder="0.00"
                          disabled={editando && editando.num_productos > 1}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Costo Unitario</label>
                        <input
                          type="number"
                          step="0.0001"
                          className="form-input"
                          value={detalle.costo_unitario}
                          onChange={(e) => actualizarDetalle(index, 'costo_unitario', e.target.value)}
                          required
                          placeholder="0.00"
                          disabled={editando && editando.num_productos > 1}
                        />
                      </div>
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

                    {editando && editando.num_productos > 1 && index === 0 && (
                      <div className="alert alert-warning text-xs mt-2 p-2" style={{ marginTop: '1.5rem' }}>
                        Solo se muestra el primer producto para referencia.
                      </div>
                    )}
                  </div>

                  {detalle.cantidad && detalle.costo_unitario && (
                    <div className="mt-2 text-sm text-muted">
                      Subtotal: <strong>{formatearMoneda(parseFloat(detalle.cantidad) * parseFloat(detalle.costo_unitario), formData.moneda)}</strong>
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
              placeholder="Notas adicionales sobre la entrada"
              rows={3}
            />
          </div>

          {detalles.some(d => d.cantidad && d.costo_unitario) && (
            <div className="alert alert-info">
              <strong>Costo Total de la Entrada:</strong> {formatearMoneda(calcularCostoTotal(), formData.moneda)}
            </div>
          )}

          <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editando ? 'Actualizar' : 'Registrar'} Entrada
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Entradas;