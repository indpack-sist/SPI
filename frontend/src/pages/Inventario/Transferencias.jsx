import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  X, 
  ArrowRight, 
  FileText, 
  Loader, 
  AlertCircle, 
  Package,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { transferenciasAPI, empleadosAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function Transferencias() {
  const [transferencias, setTransferencias] = useState([]);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [tiposInventario, setTiposInventario] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [generandoPDF, setGenerandoPDF] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [detalles, setDetalles] = useState([{
    id_producto_origen: '',
    cantidad: '',
    producto_nombre: '',
    stock_disponible: 0,
    unidad_medida: ''
  }]);

  const [formData, setFormData] = useState({
    id_tipo_inventario_origen: '',
    id_tipo_inventario_destino: '',
    id_registrado_por: '',
    observaciones: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (formData.id_tipo_inventario_origen) {
      cargarProductosDisponibles();
    } else {
      setProductosDisponibles([]);
    }
  }, [formData.id_tipo_inventario_origen]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtro]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [transferenciasRes, empRes, tiposRes] = await Promise.all([
        transferenciasAPI.getAll(),
        empleadosAPI.getAll({ estado: 'Activo' }),
        transferenciasAPI.getTiposInventario()
      ]);
      
      const transData = Array.isArray(transferenciasRes.data?.data) ? transferenciasRes.data.data : 
                        Array.isArray(transferenciasRes.data) ? transferenciasRes.data : [];
      
      const empData = Array.isArray(empRes.data?.data) ? empRes.data.data : 
                      Array.isArray(empRes.data) ? empRes.data : [];
      
      const tiposData = Array.isArray(tiposRes.data?.data) ? tiposRes.data.data : 
                        Array.isArray(tiposRes.data) ? tiposRes.data : [];
      
      setTransferencias(transData);
      setEmpleados(empData);
      setTiposInventario(tiposData);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError(err.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const cargarProductosDisponibles = async () => {
    try {
      setLoadingProductos(true);
      const response = await transferenciasAPI.getProductosDisponibles({
        id_tipo_inventario_origen: formData.id_tipo_inventario_origen
      });
      
      const prodData = Array.isArray(response.data?.data) ? response.data.data : 
                       Array.isArray(response.data) ? response.data : [];
      
      setProductosDisponibles(prodData);
    } catch (err) {
      console.error('Error al cargar productos:', err);
      setProductosDisponibles([]);
    } finally {
      setLoadingProductos(false);
    }
  };

  const abrirModal = () => {
    setFormData({
      id_tipo_inventario_origen: '',
      id_tipo_inventario_destino: '',
      id_registrado_por: '',
      observaciones: ''
    });
    setDetalles([{
      id_producto_origen: '',
      cantidad: '',
      producto_nombre: '',
      stock_disponible: 0,
      unidad_medida: ''
    }]);
    setProductosDisponibles([]);
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
  };

  const agregarDetalle = () => {
    setDetalles([...detalles, {
      id_producto_origen: '',
      cantidad: '',
      producto_nombre: '',
      stock_disponible: 0,
      unidad_medida: ''
    }]);
  };

  const eliminarDetalle = (index) => {
    if (detalles.length === 1) {
      setError('Debe haber al menos un producto en la transferencia');
      return;
    }
    const nuevosDetalles = detalles.filter((_, i) => i !== index);
    setDetalles(nuevosDetalles);
  };

  const actualizarDetalle = (index, campo, valor) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index][campo] = valor;

    if (campo === 'id_producto_origen') {
      const producto = productosDisponibles.find(p => p.id_producto == valor);
      if (producto) {
        nuevosDetalles[index].producto_nombre = producto.nombre;
        nuevosDetalles[index].stock_disponible = parseFloat(producto.stock_actual);
        nuevosDetalles[index].unidad_medida = producto.unidad_medida;
      }
    }

    setDetalles(nuevosDetalles);
  };

  const handleGenerarPDF = async (id) => {
    try {
      setGenerandoPDF({ ...generandoPDF, [id]: true });
      setError(null);
      
      const response = await transferenciasAPI.generarPDF(id);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transferencia_${id}_${Date.now()}.pdf`;
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

    if (formData.id_tipo_inventario_origen === formData.id_tipo_inventario_destino) {
      setError('El inventario de origen y destino deben ser diferentes');
      return;
    }

    const detallesValidos = detalles.filter(d => d.id_producto_origen && d.cantidad);
    
    if (detallesValidos.length === 0) {
      setError('Debe agregar al menos un producto con cantidad válida');
      return;
    }

    for (let i = 0; i < detallesValidos.length; i++) {
      const det = detallesValidos[i];
      if (parseFloat(det.cantidad) > det.stock_disponible) {
        setError(`Producto ${i + 1}: Stock insuficiente. Disponible: ${det.stock_disponible} ${det.unidad_medida}`);
        return;
      }
    }

    try {
      const payload = {
        ...formData,
        detalles: detallesValidos.map(d => ({
          id_producto_origen: parseInt(d.id_producto_origen),
          cantidad: parseFloat(d.cantidad)
        }))
      };
      
      const response = await transferenciasAPI.create(payload);
      
      const codigosGenerados = response.data?.data?.codigos_generados || [];
      const mensaje = `Transferencia registrada exitosamente. ${codigosGenerados.length} producto(s) creados en destino con códigos: ${codigosGenerados.join(', ')}`;
      
      setSuccess(mensaje);
      cerrarModal();
      cargarDatos();
    } catch (err) {
      console.error('Error al guardar:', err);
      setError(err.error || err.message || 'Error al guardar transferencia');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de anular esta transferencia? Los productos del destino serán marcados como inactivos y el stock se devolverá al origen.')) return;

    try {
      setError(null);
      await transferenciasAPI.delete(id);
      setSuccess('Transferencia anulada exitosamente');
      cargarDatos();
    } catch (err) {
      console.error('Error al anular:', err);
      setError(err.error || 'Error al anular transferencia');
    }
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'PEN'
    }).format(valor || 0);
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

  // 1. FILTRADO
  const transferenciasFiltradas = transferencias.filter(t =>
    (t.tipo_inventario_origen && t.tipo_inventario_origen.toLowerCase().includes(filtro.toLowerCase())) ||
    (t.tipo_inventario_destino && t.tipo_inventario_destino.toLowerCase().includes(filtro.toLowerCase())) ||
    (t.registrado_por && t.registrado_por.toLowerCase().includes(filtro.toLowerCase()))
  );

  // 2. PAGINACIÓN
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = transferenciasFiltradas.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(transferenciasFiltradas.length / itemsPerPage);

  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));


  const tiposOrigenDisponibles = tiposInventario.filter(t => 
    t.id_tipo_inventario != formData.id_tipo_inventario_destino
  );

  const tiposDestinoDisponibles = tiposInventario.filter(t => 
    t.id_tipo_inventario != formData.id_tipo_inventario_origen
  );

  const columns = [
    { header: 'ID', accessor: 'id_transferencia_cabecera', width: '80px' },
    { 
      header: 'Fecha', 
      accessor: 'fecha_transferencia',
      width: '140px',
      render: (value) => formatearFecha(value)
    },
    { 
      header: 'Origen → Destino', 
      accessor: 'tipo_inventario_origen',
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <span className="badge badge-secondary text-xs">{value}</span>
          <ArrowRight size={14} />
          <span className="badge badge-primary text-xs">{row.tipo_inventario_destino}</span>
        </div>
      )
    },
    { 
      header: 'Productos',
      accessor: 'num_productos',
      align: 'center',
      width: '100px',
      render: (value) => (
        <span className="badge badge-info">{value} prod.</span>
      )
    },
    {
      header: 'Costo Total',
      accessor: 'costo_total',
      align: 'right',
      width: '120px',
      render: (value) => <span className="font-bold">{formatearMoneda(value)}</span>
    },
    { 
      header: 'Registrado Por',
      accessor: 'registrado_por',
      width: '150px'
    },
    {
      header: 'Estado',
      accessor: 'estado',
      width: '100px',
      render: (value) => (
        <span className={`badge ${value === 'Activo' ? 'badge-success' : 'badge-danger'}`}>
          {value}
        </span>
      )
    },
    {
      header: 'PDF',
      accessor: 'id_transferencia_cabecera',
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
      accessor: 'id_transferencia_cabecera',
      width: '100px',
      align: 'center',
      render: (value, row) => (
        <button
          className="btn btn-sm btn-danger"
          onClick={() => handleDelete(value)}
          title="Anular"
          disabled={row.estado === 'Anulado'}
        >
          <Trash2 size={14} />
        </button>
      )
    }
  ];

  if (loading) {
    return <Loading message="Cargando transferencias..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="card-title">Transferencias entre Inventarios</h1>
          <p className="text-muted">Movimientos de productos entre tipos de inventario</p>
        </div>
        <button className="btn btn-primary" onClick={abrirModal}>
          <Plus size={20} />
          Nueva Transferencia
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
              placeholder="Buscar por tipo de inventario o responsable..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>
      </div>

      {/* TABLA CON PAGINACIÓN */}
      <div className="card">
        {/* Info Superior */}
        <div className="p-3 border-b border-border text-sm text-muted">
             Mostrando {currentItems.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, transferenciasFiltradas.length)} de {transferenciasFiltradas.length} transferencias
        </div>

        <Table
          columns={columns}
          data={currentItems}
          emptyMessage="No se encontraron transferencias"
        />

        {/* Footer de Paginación */}
        {transferenciasFiltradas.length > itemsPerPage && (
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
        title="Nueva Transferencia entre Inventarios"
        size="xl"
      >
        <form onSubmit={handleSubmit}>
          <div className="alert alert-info mb-4">
            <Package size={18} />
            <div>
              <strong>Nueva Funcionalidad:</strong> Seleccione productos del inventario origen y el sistema creará automáticamente 
              los productos en el destino con códigos únicos (Ej: INS-001, MP-001, PT-001, REV-001).
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Inventario Origen *</label>
              <select
                className="form-select"
                value={formData.id_tipo_inventario_origen}
                onChange={(e) => setFormData({ ...formData, id_tipo_inventario_origen: e.target.value })}
                required
              >
                <option value="">Seleccione origen...</option>
                {tiposOrigenDisponibles.map(tipo => (
                  <option key={tipo.id_tipo_inventario} value={tipo.id_tipo_inventario}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Inventario Destino *</label>
              <select
                className="form-select"
                value={formData.id_tipo_inventario_destino}
                onChange={(e) => setFormData({ ...formData, id_tipo_inventario_destino: e.target.value })}
                required
              >
                <option value="">Seleccione destino...</option>
                {tiposDestinoDisponibles.map(tipo => (
                  <option key={tipo.id_tipo_inventario} value={tipo.id_tipo_inventario}>
                    {tipo.nombre}
                  </option>
                ))}
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

          {loadingProductos && (
            <div className="alert alert-info">
              <Loader size={18} className="animate-spin" />
              Cargando productos disponibles...
            </div>
          )}

          {!loadingProductos && formData.id_tipo_inventario_origen && (
            <>
              {productosDisponibles.length === 0 ? (
                <div className="alert alert-warning">
                  <AlertCircle size={18} />
                  <div>
                    <strong>Sin productos con stock</strong>
                    <p className="text-xs mt-1">
                      No hay productos disponibles en el inventario origen con stock mayor a 0.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <div className="flex justify-between items-center mb-2">
                    <label className="form-label" style={{ marginBottom: 0 }}>
                      Productos a Transferir ({detalles.length})
                    </label>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={agregarDetalle}
                    >
                      <Plus size={16} />
                      Agregar Producto
                    </button>
                  </div>

                  <div className="space-y-3">
                    {detalles.map((detalle, index) => (
                      <div key={index} className="card p-3" style={{ background: 'var(--bg-secondary)' }}>
                        <div className="flex items-start gap-3">
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Producto</label>
                              <select
                                className="form-select"
                                value={detalle.id_producto_origen}
                                onChange={(e) => actualizarDetalle(index, 'id_producto_origen', e.target.value)}
                                required
                              >
                                <option value="">Seleccione...</option>
                                {productosDisponibles.map(prod => (
                                  <option key={prod.id_producto} value={prod.id_producto}>
                                    {prod.codigo} - {prod.nombre} (Stock: {parseFloat(prod.stock_actual).toFixed(2)} {prod.unidad_medida})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">
                                Cantidad a Transferir
                                {detalle.stock_disponible > 0 && (
                                  <span className="text-primary ml-2 text-xs">
                                    (Máx: {detalle.stock_disponible} {detalle.unidad_medida})
                                  </span>
                                )}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-input"
                                value={detalle.cantidad}
                                onChange={(e) => actualizarDetalle(index, 'cantidad', e.target.value)}
                                required
                                placeholder="0.00"
                                max={detalle.stock_disponible}
                              />
                            </div>
                          </div>

                          {detalles.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => eliminarDetalle(index)}
                              style={{ marginTop: '1.5rem' }}
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>

                        {detalle.stock_disponible > 0 && parseFloat(detalle.cantidad) > detalle.stock_disponible && (
                          <div className="mt-2 text-sm text-danger">
                            La cantidad excede el stock disponible ({detalle.stock_disponible} {detalle.unidad_medida})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea
              className="form-textarea"
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              placeholder="Notas adicionales sobre la transferencia"
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={productosDisponibles.length === 0}
            >
              Registrar Transferencia
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Transferencias;