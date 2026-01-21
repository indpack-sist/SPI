import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Eye, BookOpen, ClipboardCheck, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productosAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import ModalConteoFisico from '../../components/Productos/ModalConteoFisico';

function Productos() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [tiposInventario, setTiposInventario] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  
  const [filtroStock, setFiltroStock] = useState(false);

  const [modalConteoOpen, setModalConteoOpen] = useState(false);
  const [productoConteo, setProductoConteo] = useState(null);

  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    id_categoria: '',
    id_tipo_inventario: '',
    unidad_medida: 'unidad',
    precio_venta: '0',
    stock_minimo: '0',
    stock_maximo: '0',
    requiere_receta: false,
    estado: 'Activo'
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [prodRes, tiposRes, categRes] = await Promise.all([
        productosAPI.getAllConCosto(), 
        productosAPI.getTiposInventario(),
        productosAPI.getCategorias()
      ]);
      
      setProductos(prodRes.data.data);
      setTiposInventario(tiposRes.data.data);
      setCategorias(categRes.data.data);
    } catch (err) {
      setError(err.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (producto = null) => {
    if (producto) {
      setEditando(producto);
      setFormData({
        codigo: producto.codigo,
        nombre: producto.nombre,
        descripcion: producto.descripcion || '',
        id_categoria: producto.id_categoria || '',
        id_tipo_inventario: producto.id_tipo_inventario,
        unidad_medida: producto.unidad_medida,
        precio_venta: producto.precio_venta || '0',
        stock_minimo: producto.stock_minimo,
        stock_maximo: producto.stock_maximo,
        requiere_receta: producto.requiere_receta,
        estado: producto.estado
      });
    } else {
      setEditando(null);
      setFormData({
        codigo: '',
        nombre: '',
        descripcion: '',
        id_categoria: '',
        id_tipo_inventario: '',
        unidad_medida: 'unidad',
        precio_venta: '0',
        stock_minimo: '0',
        stock_maximo: '0',
        requiere_receta: false,
        estado: 'Activo'
      });
    }
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
  };

  const abrirModalConteo = (producto) => {
    setProductoConteo(producto);
    setModalConteoOpen(true);
  };

  const handleConteoSuccess = (data) => {
    setSuccess(
      `${data.tipo_ajuste === 'Positivo' ? '✓' : '⚠'} Ajuste ${data.tipo_ajuste.toLowerCase()} realizado: ${data.diferencia > 0 ? '+' : ''}${data.diferencia} ${productoConteo.unidad_medida}`
    );
    cargarDatos(); 
    setProductoConteo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editando) {
        await productosAPI.update(editando.id_producto, formData);
        setSuccess('Producto actualizado exitosamente');
      } else {
        await productosAPI.create(formData);
        setSuccess('Producto creado exitosamente');
      }
      cerrarModal();
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al guardar producto');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de desactivar este producto?')) return;

    try {
      setError(null);
      await productosAPI.delete(id);
      setSuccess('Producto desactivado exitosamente');
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al desactivar producto');
    }
  };

  const formatearMoneda = (valor, moneda = 'PEN') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: moneda
    }).format(valor || 0);
  };

  const productosFiltrados = productos.filter(p => {
    const matchTexto = p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
                       p.codigo.toLowerCase().includes(filtro.toLowerCase());
    const matchTipo = !filtroTipo || p.id_tipo_inventario == filtroTipo;
    const matchStock = !filtroStock || parseFloat(p.stock_actual) >= 1;
    
    return matchTexto && matchTipo && matchStock;
  });

  const esProductoVendible = (tipoId) => {
    const tipo = tiposInventario.find(t => t.id_tipo_inventario == tipoId);
    return tipo && (tipo.nombre === 'Productos Terminados' || tipo.nombre === 'Productos de Reventa');
  };

  const columns = [
    { header: 'Código', accessor: 'codigo', width: '120px' },
    { header: 'Nombre', accessor: 'nombre' },
    { header: 'Tipo Inventario', accessor: 'tipo_inventario' },
    { header: 'Categoría', accessor: 'categoria' },
    { 
      header: 'Stock Actual', 
      accessor: 'stock_actual',
      align: 'right',
      render: (value, row) => `${parseFloat(value).toFixed(2)} ${row.unidad_medida}`
    },
    {
      header: 'CUP (S/)',
      accessor: 'costo_unitario_promedio',
      align: 'right',
      render: (value) => formatearMoneda(value, 'PEN')
    },
    {
      header: 'CUP ($)',
      accessor: 'costo_unitario_promedio_usd',
      align: 'right',
      render: (value) => formatearMoneda(value, 'USD')
    },
    {
      header: 'Precio Venta',
      accessor: 'precio_venta',
      align: 'right',
      render: (value) => formatearMoneda(value, 'PEN')
    },
    {
      header: 'Recetas',
      accessor: 'requiere_receta',
      align: 'center',
      width: '100px',
      render: (value, row) => (
        <div className="flex items-center justify-center gap-2">
          <span className={`badge ${value ? 'badge-primary' : 'badge-secondary'}`}>
            {value ? 'Sí' : 'No'}
          </span>
          {!!value && row.total_recetas > 0 && (
            <span className="badge badge-info" title={`${row.total_recetas} receta(s) configurada(s)`}>
              {row.total_recetas}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Estado',
      accessor: 'estado',
      render: (value) => (
        <span className={`badge ${value === 'Activo' ? 'badge-success' : 'badge-secondary'}`}>
          {value}
        </span>
      )
    },
    {
      header: 'Acciones',
      accessor: 'id_producto',
      width: '200px',
      align: 'center',
      render: (value, row) => (
        <div className="flex gap-2 justify-center">
          <button
            className="btn btn-sm btn-warning"
            onClick={(e) => {
              e.stopPropagation();
              abrirModalConteo(row);
            }}
            title="Conteo Físico"
            disabled={row.estado === 'Inactivo'}
          >
            <ClipboardCheck size={14} />
          </button>
          
          <button
            className="btn btn-sm btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/productos/${value}`);
            }}
            title="Ver Detalle y Recetas"
          >
            <Eye size={14} />
          </button>
          
          <button
            className="btn btn-sm btn-outline"
            onClick={(e) => {
              e.stopPropagation();
              abrirModal(row);
            }}
            title="Editar"
          >
            <Edit size={14} />
          </button>
          
          <button
            className="btn btn-sm btn-danger"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(value);
            }}
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
    return <Loading message="Cargando productos..." />;
  }

  const mostrarPrecioVenta = esProductoVendible(formData.id_tipo_inventario);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="card-title">Catálogo de Productos</h1>
          <p className="text-muted">Gestión de productos, materias primas e insumos</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirModal()}>
          <Plus size={20} />
          Nuevo Producto
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="card mb-3">
        <div className="grid grid-cols-3 gap-4">
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
                placeholder="Buscar por nombre o código..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
          </div>

          <div className="form-group flex gap-2" style={{ marginBottom: 0 }}>
            <select
              className="form-select flex-1"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="">Todos los inventarios</option>
              {tiposInventario.map(tipo => (
                <option key={tipo.id_tipo_inventario} value={tipo.id_tipo_inventario}>
                  {tipo.nombre}
                </option>
              ))}
            </select>
            
            <button 
              className={`btn ${filtroStock ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFiltroStock(!filtroStock)}
              title="Mostrar solo productos con stock >= 1"
            >
              <Filter size={20} />
              Stock ≥ 1
            </button>
          </div>

          <div className="text-right">
            <p className="text-sm text-muted">
              Total: {productosFiltrados.length} producto(s)
            </p>
          </div>
        </div>
      </div>

      <Table
        columns={columns}
        data={productosFiltrados}
        emptyMessage="No se encontraron productos"
        onRowClick={(row) => navigate(`/productos/${row.id_producto}`)}
      />

      <Modal
        isOpen={modalOpen}
        onClose={cerrarModal}
        title={editando ? 'Editar Producto' : 'Nuevo Producto'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Código *</label>
              <input
                type="text"
                className="form-input"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                required
                placeholder="MP-001"
              />
            </div>

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
          </div>

          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input
              type="text"
              className="form-input"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
              placeholder="Nombre del producto"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea
              className="form-textarea"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Descripción detallada del producto"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select
                className="form-select"
                value={formData.id_categoria}
                onChange={(e) => setFormData({ ...formData, id_categoria: e.target.value })}
              >
                <option value="">Sin categoría</option>
                {categorias.map(cat => (
                  <option key={cat.id_categoria} value={cat.id_categoria}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Unidad de Medida *</label>
              <select
                className="form-select"
                value={formData.unidad_medida}
                onChange={(e) => setFormData({ ...formData, unidad_medida: e.target.value })}
                required
              >
                <option value="unidad">Unidad</option>
                <option value="kg">Kilogramo (kg)</option>
                <option value="g">Gramo (g)</option>
                <option value="L">Litro (L)</option>
                <option value="m">Metro (m)</option>
                <option value="m2">Metro cuadrado (m²)</option>
                <option value="m3">Metro cúbico (m³)</option>
                <option value="mill">Millar (mill)</option>
                <option value="bol">Bolsas (bol)</option>
              </select>
            </div>
          </div>

          {mostrarPrecioVenta && (
            <div className="form-group">
              <label className="form-label">Precio de Venta (PEN)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={formData.precio_venta}
                onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                placeholder="0.00"
              />
              <small className="text-muted">
                Precio al que se vende el producto al cliente final
              </small>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Stock Mínimo</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={formData.stock_minimo}
                onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Stock Máximo</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={formData.stock_maximo}
                onChange={(e) => setFormData({ ...formData, stock_maximo: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.requiere_receta}
                  onChange={(e) => setFormData({ ...formData, requiere_receta: e.target.checked })}
                />
                <span className="form-label" style={{ marginBottom: 0 }}>Requiere Receta (BOM)</span>
              </label>
              <small className="text-muted">Marcar si es un producto fabricado con múltiples recetas</small>
            </div>

            <div className="form-group">
              <label className="form-label">Estado *</label>
              <select
                className="form-select"
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                required
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editando ? 'Actualizar' : 'Crear'} Producto
            </button>
          </div>
        </form>
      </Modal>

      <ModalConteoFisico
        isOpen={modalConteoOpen}
        onClose={() => {
          setModalConteoOpen(false);
          setProductoConteo(null);
        }}
        producto={productoConteo}
        onSuccess={handleConteoSuccess}
      />
    </div>
  );
}

export default Productos;