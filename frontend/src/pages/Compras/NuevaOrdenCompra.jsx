import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, ShoppingCart, Building, Calendar,
  MapPin, Truck, Plus, Trash2, Search, AlertCircle
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { 
  ordenesCompraAPI, proveedoresAPI, productosAPI, empleadosAPI 
} from '../../config/api';

function NuevaOrdenCompra() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  
  const [modalProveedorOpen, setModalProveedorOpen] = useState(false);
  const [modalProductoOpen, setModalProductoOpen] = useState(false);
  
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [productosProveedor, setProductosProveedor] = useState([]);
  
  const [formData, setFormData] = useState({
    id_proveedor: '',
    fecha_pedido: new Date().toISOString().split('T')[0],
    fecha_confirmacion: '',
    entrega_esperada: '',
    condicion_pago: 'Pago inmediato',
    forma_pago: 'Efectivo',
    lugar_entrega: 'AV. EL SOL LT. 4 B MZ. LL-1 COO. LAS VERTIENTES',
    moneda: 'PEN',
    observaciones: '',
    id_elaborado_por: ''
  });
  
  const [detalle, setDetalle] = useState([]);
  const [totales, setTotales] = useState({ subtotal: 0, igv: 0, total: 0 });

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    calcularTotales();
  }, [detalle]);

  const cargarCatalogos = async () => {
    try {
      setLoading(true);
      
      const [resProveedores, resProductos, resEmpleados] = await Promise.all([
        proveedoresAPI.getAll({ estado: 'Activo' }),
        productosAPI.getAll({ 
          estado: 'Activo',
          id_tipo_inventario: '1,2,4'
        }),
        empleadosAPI.getAll({ 
          rol: 'Compras,Administrador',
          estado: 'Activo' 
        })
      ]);
      
      if (resProveedores.data.success) {
        setProveedores(resProveedores.data.data || []);
      }
      
      if (resProductos.data.success) {
        setProductos(resProductos.data.data || []);
      }
      
      if (resEmpleados.data.success) {
        setEmpleados(resEmpleados.data.data || []);
      }
      
    } catch (err) {
      console.error('Error al cargar catálogos:', err);
      setError('Error al cargar catálogos: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProveedor = async (proveedor) => {
    setProveedorSeleccionado(proveedor);
    setFormData({
      ...formData,
      id_proveedor: proveedor.id_proveedor
    });
    setModalProveedorOpen(false);
    
    try {
      const response = await ordenesCompraAPI.getProductosPorProveedor(proveedor.id_proveedor);
      
      if (response.data.success) {
        setProductosProveedor(response.data.data || []);
      }
    } catch (err) {
      console.error('Error al cargar historial:', err);
      setProductosProveedor([]);
    }
  };

  const handleSelectProducto = (producto) => {
    const existe = detalle.find(d => d.id_producto === producto.id_producto);
    if (existe) {
      setError('Este producto ya está en la lista');
      return;
    }
    
    const historial = productosProveedor.find(p => p.id_producto === producto.id_producto);
    
    const nuevoItem = {
      id_producto: producto.id_producto,
      codigo_producto: producto.codigo,
      producto: producto.nombre,
      unidad_medida: producto.unidad_medida,
      cantidad: 1.00000,
      valor_unitario: historial ? parseFloat(historial.precio_promedio) : 0.000,
      valor_compra: 0.00
    };
    
    setDetalle([...detalle, nuevoItem]);
    setModalProductoOpen(false);
  };

  const handleCantidadChange = (index, cantidad) => {
    const newDetalle = [...detalle];
    newDetalle[index].cantidad = parseFloat(cantidad) || 0;
    newDetalle[index].valor_compra = newDetalle[index].cantidad * newDetalle[index].valor_unitario;
    setDetalle(newDetalle);
  };

  const handleValorUnitarioChange = (index, valor) => {
    const newDetalle = [...detalle];
    newDetalle[index].valor_unitario = parseFloat(valor) || 0;
    newDetalle[index].valor_compra = newDetalle[index].cantidad * newDetalle[index].valor_unitario;
    setDetalle(newDetalle);
  };

  const handleEliminarProducto = (index) => {
    const newDetalle = detalle.filter((_, i) => i !== index);
    setDetalle(newDetalle);
  };

  const calcularTotales = () => {
    const subtotal = detalle.reduce((sum, item) => sum + parseFloat(item.valor_compra || 0), 0);
    const igv = subtotal * 0.18;
    const total = subtotal + igv;
    setTotales({ subtotal, igv, total });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!formData.id_proveedor) {
      setError('Debe seleccionar un proveedor');
      return;
    }
    
    if (detalle.length === 0) {
      setError('Debe agregar al menos un producto');
      return;
    }
    
    const invalidos = detalle.filter(item => 
      parseFloat(item.cantidad) <= 0 || parseFloat(item.valor_unitario) <= 0
    );
    
    if (invalidos.length > 0) {
      setError('Todos los productos deben tener cantidad y precio mayores a 0');
      return;
    }
    
    try {
      setLoading(true);
      
      const payload = {
        id_proveedor: parseInt(formData.id_proveedor),
        fecha_pedido: formData.fecha_pedido,
        fecha_confirmacion: formData.fecha_confirmacion || null,
        entrega_esperada: formData.entrega_esperada || null,
        condicion_pago: formData.condicion_pago,
        forma_pago: formData.forma_pago,
        lugar_entrega: formData.lugar_entrega,
        moneda: formData.moneda,
        observaciones: formData.observaciones,
        id_elaborado_por: formData.id_elaborado_por ? parseInt(formData.id_elaborado_por) : null,
        detalle: detalle.map((item, index) => ({
          id_producto: item.id_producto,
          cantidad: parseFloat(item.cantidad),
          valor_unitario: parseFloat(item.valor_unitario),
          orden: index + 1
        }))
      };
      
      const response = await ordenesCompraAPI.create(payload);
      
      if (response.data.success) {
        setSuccess('Orden de compra creada exitosamente');
        setTimeout(() => {
          navigate('/compras/ordenes');
        }, 1500);
      } else {
        setError(response.data.error || 'Error al crear orden de compra');
      }
      
    } catch (err) {
      console.error('Error al crear orden de compra:', err);
      setError(err.response?.data?.error || 'Error al crear orden de compra');
    } finally {
      setLoading(false);
    }
  };

  const formatearMoneda = (valor) => {
    const simbolo = formData.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor).toFixed(2)}`;
  };

  if (loading && proveedores.length === 0) {
    return <Loading message="Cargando formulario..." />;
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button 
          className="btn btn-outline"
          onClick={() => navigate('/compras/ordenes')}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart size={32} />
            Nueva Orden de Compra
          </h1>
          <p className="text-muted">Crear orden de compra a proveedor</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <form onSubmit={handleSubmit}>
        {/* Proveedor */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <Building size={20} />
              Datos del Proveedor
            </h2>
          </div>
          <div className="card-body">
            {proveedorSeleccionado ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-lg">{proveedorSeleccionado.razon_social}</p>
                    <p className="text-sm text-muted">RUC: {proveedorSeleccionado.ruc}</p>
                    <p className="text-sm text-muted">{proveedorSeleccionado.direccion}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      setProveedorSeleccionado(null);
                      setFormData({ ...formData, id_proveedor: '' });
                      setProductosProveedor([]);
                    }}
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={() => setModalProveedorOpen(true)}
              >
                <Search size={20} />
                Seleccionar Proveedor
              </button>
            )}
            
            {proveedorSeleccionado && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="form-group">
                  <label className="form-label">Condición de Pago *</label>
                  <select
                    className="form-select"
                    value={formData.condicion_pago}
                    onChange={(e) => setFormData({ ...formData, condicion_pago: e.target.value })}
                    required
                  >
                    <option value="Pago inmediato">Pago inmediato</option>
                    <option value="15 días">15 días</option>
                    <option value="30 días">30 días</option>
                    <option value="45 días">45 días</option>
                    <option value="60 días">60 días</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fechas y Datos */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <Calendar size={20} />
              Fechas y Datos de la Orden
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">Fecha de Pedido *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.fecha_pedido}
                  onChange={(e) => setFormData({ ...formData, fecha_pedido: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Fecha de Confirmación</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.fecha_confirmacion}
                  onChange={(e) => setFormData({ ...formData, fecha_confirmacion: e.target.value })}
                />
                <small className="text-muted">Dejar vacío si aún no está confirmada</small>
              </div>
              
              <div className="form-group">
                <label className="form-label">Entrega Esperada</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.entrega_esperada}
                  onChange={(e) => setFormData({ ...formData, entrega_esperada: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Forma de Pago *</label>
                <select
                  className="form-select"
                  value={formData.forma_pago}
                  onChange={(e) => setFormData({ ...formData, forma_pago: e.target.value })}
                  required
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Crédito">Crédito</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Moneda *</label>
                <select
                  className="form-select"
                  value={formData.moneda}
                  onChange={(e) => setFormData({ ...formData, moneda: e.target.value })}
                  required
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Elaborado por</label>
                <select
                  className="form-select"
                  value={formData.id_elaborado_por}
                  onChange={(e) => setFormData({ ...formData, id_elaborado_por: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {empleados.map(emp => (
                    <option key={emp.id_empleado} value={emp.id_empleado}>
                      {emp.nombre_completo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Logística */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <MapPin size={20} />
              Datos Logísticos
            </h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Lugar de Entrega</label>
              <textarea
                className="form-textarea"
                value={formData.lugar_entrega}
                onChange={(e) => setFormData({ ...formData, lugar_entrega: e.target.value })}
                rows={2}
                placeholder="Dirección de entrega..."
              />
            </div>
          </div>
        </div>

        {/* Detalle */}
        <div className="card mb-4">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h2 className="card-title">
                <Truck size={20} />
                Detalle de Productos
              </h2>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setModalProductoOpen(true)}
                disabled={!proveedorSeleccionado}
              >
                <Plus size={16} />
                Agregar Producto
              </button>
            </div>
          </div>
          <div className="card-body">
            {!proveedorSeleccionado && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle size={20} className="text-warning" />
                  <p className="text-sm text-yellow-900">
                    Primero debe seleccionar un proveedor para agregar productos
                  </p>
                </div>
              </div>
            )}
            
            {detalle.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Código</th>
                      <th>Descripción</th>
                      <th style={{ width: '120px' }}>Cantidad *</th>
                      <th style={{ width: '60px' }}>Unidad</th>
                      <th style={{ width: '120px' }}>V. Unit. *</th>
                      <th style={{ width: '120px' }}>V. COMPRA</th>
                      <th style={{ width: '60px' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((item, index) => (
                      <tr key={index}>
                        <td className="font-mono text-sm">{item.codigo_producto}</td>
                        <td>
                          <div className="font-medium">{item.producto}</div>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input text-right"
                            value={item.cantidad}
                            onChange={(e) => handleCantidadChange(index, e.target.value)}
                            min="0"
                            step="0.00001"
                            required
                          />
                        </td>
                        <td className="text-sm text-muted text-center">{item.unidad_medida}</td>
                        <td>
                          <input
                            type="number"
                            className="form-input text-right"
                            value={item.valor_unitario}
                            onChange={(e) => handleValorUnitarioChange(index, e.target.value)}
                            min="0"
                            step="0.001"
                            required
                          />
                        </td>
                        <td className="text-right font-bold text-primary">
                          {parseFloat(item.valor_compra).toFixed(2)}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleEliminarProducto(index)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan="5" className="text-right font-bold">SUBTOTAL:</td>
                      <td className="text-right font-bold text-primary">
                        {formatearMoneda(totales.subtotal)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted py-4">
                No hay productos agregados
              </p>
            )}
          </div>
        </div>

        {/* Observaciones */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea
                className="form-textarea"
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                rows={3}
                placeholder="Observaciones adicionales..."
              />
            </div>
          </div>
        </div>

        {/* Totales */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="flex justify-end">
              <div className="w-80">
                <div className="flex justify-between py-2">
                  <span className="font-medium">Subtotal:</span>
                  <span className="font-bold">{formatearMoneda(totales.subtotal)}</span>
                </div>
                <div className="flex justify-between py-2 border-t">
                  <span className="font-medium">IGV (18%):</span>
                  <span className="font-bold">{formatearMoneda(totales.igv)}</span>
                </div>
                <div className="flex justify-between py-3 border-t bg-primary text-white px-3 rounded">
                  <span className="font-bold text-lg">TOTAL:</span>
                  <span className="font-bold text-xl">{formatearMoneda(totales.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/compras/ordenes')}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            <Save size={20} />
            {loading ? 'Guardando...' : 'Crear Orden de Compra'}
          </button>
        </div>
      </form>

      {/* Modal Proveedores */}
      <Modal
        isOpen={modalProveedorOpen}
        onClose={() => setModalProveedorOpen(false)}
        title="Seleccionar Proveedor"
        size="lg"
      >
        <div className="space-y-2">
          {proveedores.map((prov) => (
            <div
              key={prov.id_proveedor}
              className="p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition"
              onClick={() => handleSelectProveedor(prov)}
            >
              <div className="font-bold">{prov.razon_social}</div>
              <div className="text-sm text-muted">RUC: {prov.ruc}</div>
              <div className="text-sm text-muted">{prov.direccion} - {prov.ciudad}</div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Modal Productos */}
      <Modal
        isOpen={modalProductoOpen}
        onClose={() => setModalProductoOpen(false)}
        title="Seleccionar Producto"
        size="lg"
      >
        <div className="space-y-3">
          {productosProveedor.length > 0 && (
            <>
              <h3 className="font-bold text-success">Productos comprados anteriormente:</h3>
              {productosProveedor.map((prod) => (
                <div
                  key={prod.id_producto}
                  className="p-4 border border-success rounded-lg hover:bg-green-50 cursor-pointer transition"
                  onClick={() => handleSelectProducto(prod)}
                >
                  <div className="flex justify-between">
                    <div>
                      <div className="font-bold">[{prod.codigo}] {prod.nombre}</div>
                      <div className="text-sm text-muted">Unidad: {prod.unidad_medida}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-success">
                        {formData.moneda === 'USD' ? '$' : 'S/'} {parseFloat(prod.precio_promedio).toFixed(3)}
                      </div>
                      <div className="text-xs text-muted">Precio promedio</div>
                    </div>
                  </div>
                </div>
              ))}
              <hr className="my-4" />
            </>
          )}
          
          <h3 className="font-bold">Todos los productos:</h3>
          {productos.map((prod) => (
            <div
              key={prod.id_producto}
              className="p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition"
              onClick={() => handleSelectProducto(prod)}
            >
              <div className="font-bold">[{prod.codigo}] {prod.nombre}</div>
              <div className="text-sm text-muted">
                Unidad: {prod.unidad_medida} • Tipo: {prod.tipo_inventario_nombre || 'N/A'}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default NuevaOrdenCompra;