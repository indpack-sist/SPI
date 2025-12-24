// frontend/src/pages/Ventas/NuevaCotizacion.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Search,
  Calculator,
  FileText,
  User,
  Building,
  Calendar,
  DollarSign
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';

function NuevaCotizacion() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Catálogos
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [comerciales, setComerciales] = useState([]);
  
  // Modales
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [modalProductoOpen, setModalProductoOpen] = useState(false);
  
  // Búsqueda
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  
  // Formulario - Cabecera
  const [formCabecera, setFormCabecera] = useState({
    id_cliente: '',
    id_comercial: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_validez: '',
    moneda: 'PEN',
    plazo_pago: '',
    forma_pago: '',
    orden_compra_cliente: '',
    lugar_entrega: '',
    plazo_entrega: '',
    validez_dias: '7',
    observaciones: ''
  });
  
  // Cliente seleccionado
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  
  // Detalle
  const [detalle, setDetalle] = useState([]);
  
  // Totales
  const [totales, setTotales] = useState({
    subtotal: 0,
    igv: 0,
    total: 0
  });

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    calcularTotales();
  }, [detalle]);

  useEffect(() => {
    if (formCabecera.validez_dias && formCabecera.fecha_emision) {
      const fechaEmision = new Date(formCabecera.fecha_emision);
      fechaEmision.setDate(fechaEmision.getDate() + parseInt(formCabecera.validez_dias));
      setFormCabecera({
        ...formCabecera,
        fecha_validez: fechaEmision.toISOString().split('T')[0]
      });
    }
  }, [formCabecera.fecha_emision, formCabecera.validez_dias]);

  const cargarCatalogos = async () => {
    try {
      setLoading(true);
      
      // TODO: Reemplazar con llamadas API reales
      
      // Mock clientes
      setClientes([
        {
          id_cliente: 1,
          razon_social: 'EMPRESA DEMO SAC',
          ruc: '20123456789',
          direccion: 'Av. Principal 123',
          ciudad: 'Lima'
        },
        {
          id_cliente: 2,
          razon_social: 'CORPORACIÓN ABC EIRL',
          ruc: '20987654321',
          direccion: 'Jr. Comercio 456',
          ciudad: 'Lima'
        }
      ]);
      
      // Mock productos
      setProductos([
        {
          id_producto: 1,
          codigo: 'PROD-001',
          nombre: 'Producto Terminado 1',
          unidad_medida: 'unidad',
          precio_venta: 100.00,
          stock_actual: 50
        },
        {
          id_producto: 2,
          codigo: 'PROD-002',
          nombre: 'Producto Terminado 2',
          unidad_medida: 'unidad',
          precio_venta: 150.00,
          stock_actual: 30
        }
      ]);
      
      // Mock comerciales
      setComerciales([
        { id_empleado: 1, nombre_completo: 'Juan Pérez', email: 'jperez@indpack.com' },
        { id_empleado: 2, nombre_completo: 'María García', email: 'mgarcia@indpack.com' }
      ]);
      
    } catch (err) {
      setError('Error al cargar catálogos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCliente = (cliente) => {
    setClienteSeleccionado(cliente);
    setFormCabecera({
      ...formCabecera,
      id_cliente: cliente.id_cliente,
      lugar_entrega: cliente.direccion || ''
    });
    setModalClienteOpen(false);
    setBusquedaCliente('');
  };

  const handleAgregarProducto = (producto) => {
    // Verificar si ya existe
    const existe = detalle.find(d => d.id_producto === producto.id_producto);
    if (existe) {
      setError('El producto ya está en el detalle');
      return;
    }
    
    const nuevoItem = {
      id_producto: producto.id_producto,
      codigo: producto.codigo,
      producto: producto.nombre,
      unidad_medida: producto.unidad_medida,
      cantidad: 1,
      precio_unitario: producto.precio_venta,
      descuento_porcentaje: 0,
      subtotal: producto.precio_venta,
      stock_actual: producto.stock_actual
    };
    
    setDetalle([...detalle, nuevoItem]);
    setModalProductoOpen(false);
    setBusquedaProducto('');
  };

  const handleCantidadChange = (index, cantidad) => {
    const newDetalle = [...detalle];
    newDetalle[index].cantidad = parseFloat(cantidad) || 0;
    newDetalle[index].subtotal = 
      newDetalle[index].cantidad * 
      newDetalle[index].precio_unitario * 
      (1 - newDetalle[index].descuento_porcentaje / 100);
    setDetalle(newDetalle);
  };

  const handlePrecioChange = (index, precio) => {
    const newDetalle = [...detalle];
    newDetalle[index].precio_unitario = parseFloat(precio) || 0;
    newDetalle[index].subtotal = 
      newDetalle[index].cantidad * 
      newDetalle[index].precio_unitario * 
      (1 - newDetalle[index].descuento_porcentaje / 100);
    setDetalle(newDetalle);
  };

  const handleDescuentoChange = (index, descuento) => {
    const newDetalle = [...detalle];
    newDetalle[index].descuento_porcentaje = parseFloat(descuento) || 0;
    newDetalle[index].subtotal = 
      newDetalle[index].cantidad * 
      newDetalle[index].precio_unitario * 
      (1 - newDetalle[index].descuento_porcentaje / 100);
    setDetalle(newDetalle);
  };

  const handleEliminarItem = (index) => {
    const newDetalle = detalle.filter((_, i) => i !== index);
    setDetalle(newDetalle);
  };

  const calcularTotales = () => {
    const subtotal = detalle.reduce((sum, item) => sum + item.subtotal, 0);
    const igv = subtotal * 0.18;
    const total = subtotal + igv;
    
    setTotales({ subtotal, igv, total });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    // Validaciones
    if (!formCabecera.id_cliente) {
      setError('Debe seleccionar un cliente');
      return;
    }
    
    if (detalle.length === 0) {
      setError('Debe agregar al menos un producto');
      return;
    }
    
    try {
      setLoading(true);
      
      const payload = {
        ...formCabecera,
        detalle: detalle.map(item => ({
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          descuento: item.descuento_porcentaje
        }))
      };
      
      // TODO: Llamar API real
      console.log('Payload:', payload);
      
      setSuccess('Cotización creada exitosamente');
      
      setTimeout(() => {
        navigate('/ventas/cotizaciones');
      }, 1500);
      
    } catch (err) {
      setError('Error al crear cotización: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatearMoneda = (valor) => {
    const simbolo = formCabecera.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toFixed(2)}`;
  };

  const clientesFiltrados = clientes.filter(c =>
    c.razon_social.toLowerCase().includes(busquedaCliente.toLowerCase()) ||
    c.ruc.includes(busquedaCliente)
  );

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
    p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
  );

  if (loading && clientes.length === 0) {
    return <Loading message="Cargando formulario..." />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          className="btn btn-outline"
          onClick={() => navigate('/ventas/cotizaciones')}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText size={32} />
            Nueva Cotización
          </h1>
          <p className="text-muted">Registre una nueva cotización de venta</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <form onSubmit={handleSubmit}>
        {/* Sección Cliente */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <Building size={20} />
              Información del Cliente
            </h2>
          </div>
          <div className="card-body">
            {clienteSeleccionado ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted">Cliente:</label>
                        <p className="font-bold text-lg">{clienteSeleccionado.razon_social}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted">RUC:</label>
                        <p className="font-bold">{clienteSeleccionado.ruc}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted">Dirección:</label>
                        <p>{clienteSeleccionado.direccion}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted">Ciudad:</label>
                        <p>{clienteSeleccionado.ciudad}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setClienteSeleccionado(null)}
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-lg w-full"
                onClick={() => setModalClienteOpen(true)}
              >
                <Search size={20} />
                Seleccionar Cliente
              </button>
            )}
          </div>
        </div>

        {/* Sección Datos Generales */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <Calendar size={20} />
              Datos de la Cotización
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">Fecha de Emisión *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formCabecera.fecha_emision}
                  onChange={(e) => setFormCabecera({ ...formCabecera, fecha_emision: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Validez (días)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formCabecera.validez_dias}
                  onChange={(e) => setFormCabecera({ ...formCabecera, validez_dias: e.target.value })}
                  min="1"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Fecha de Vencimiento</label>
                <input
                  type="date"
                  className="form-input"
                  value={formCabecera.fecha_validez}
                  readOnly
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Moneda *</label>
                <select
                  className="form-select"
                  value={formCabecera.moneda}
                  onChange={(e) => setFormCabecera({ ...formCabecera, moneda: e.target.value })}
                  required
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Plazo de Pago</label>
                <input
                  type="text"
                  className="form-input"
                  value={formCabecera.plazo_pago}
                  onChange={(e) => setFormCabecera({ ...formCabecera, plazo_pago: e.target.value })}
                  placeholder="Ej: 30 días"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Forma de Pago</label>
                <input
                  type="text"
                  className="form-input"
                  value={formCabecera.forma_pago}
                  onChange={(e) => setFormCabecera({ ...formCabecera, forma_pago: e.target.value })}
                  placeholder="Ej: Transferencia"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">O/C Cliente</label>
                <input
                  type="text"
                  className="form-input"
                  value={formCabecera.orden_compra_cliente}
                  onChange={(e) => setFormCabecera({ ...formCabecera, orden_compra_cliente: e.target.value })}
                  placeholder="Número de O/C"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Plazo de Entrega</label>
                <input
                  type="text"
                  className="form-input"
                  value={formCabecera.plazo_entrega}
                  onChange={(e) => setFormCabecera({ ...formCabecera, plazo_entrega: e.target.value })}
                  placeholder="Ej: 15 días"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Comercial</label>
                <select
                  className="form-select"
                  value={formCabecera.id_comercial}
                  onChange={(e) => setFormCabecera({ ...formCabecera, id_comercial: e.target.value })}
                >
                  <option value="">Seleccione...</option>
                  {comerciales.map(c => (
                    <option key={c.id_empleado} value={c.id_empleado}>
                      {c.nombre_completo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="form-group mt-4">
              <label className="form-label">Lugar de Entrega</label>
              <input
                type="text"
                className="form-input"
                value={formCabecera.lugar_entrega}
                onChange={(e) => setFormCabecera({ ...formCabecera, lugar_entrega: e.target.value })}
                placeholder="Dirección de entrega"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea
                className="form-textarea"
                value={formCabecera.observaciones}
                onChange={(e) => setFormCabecera({ ...formCabecera, observaciones: e.target.value })}
                rows={3}
                placeholder="Observaciones adicionales..."
              />
            </div>
          </div>
        </div>

        {/* Sección Detalle */}
        <div className="card mb-4">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h2 className="card-title">
                <Calculator size={20} />
                Detalle de Productos
              </h2>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModalProductoOpen(true)}
              >
                <Plus size={20} />
                Agregar Producto
              </button>
            </div>
          </div>
          <div className="card-body">
            {detalle.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Código</th>
                      <th>Descripción</th>
                      <th style={{ width: '100px' }}>Cantidad</th>
                      <th style={{ width: '80px' }}>Unidad</th>
                      <th style={{ width: '120px' }}>P. Unitario</th>
                      <th style={{ width: '100px' }}>Desc. %</th>
                      <th style={{ width: '120px' }}>Subtotal</th>
                      <th style={{ width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((item, index) => (
                      <tr key={index}>
                        <td className="font-mono text-sm">{item.codigo}</td>
                        <td>
                          <div className="font-medium">{item.producto}</div>
                          {item.stock_actual < item.cantidad && (
                            <div className="text-xs text-danger">
                              Stock insuficiente ({item.stock_actual} disponibles)
                            </div>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input text-right"
                            value={item.cantidad}
                            onChange={(e) => handleCantidadChange(index, e.target.value)}
                            min="0.00001"
                            step="0.00001"
                            required
                          />
                        </td>
                        <td className="text-sm text-muted">{item.unidad_medida}</td>
                        <td>
                          <input
                            type="number"
                            className="form-input text-right"
                            value={item.precio_unitario}
                            onChange={(e) => handlePrecioChange(index, e.target.value)}
                            min="0"
                            step="0.01"
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input text-right"
                            value={item.descuento_porcentaje}
                            onChange={(e) => handleDescuentoChange(index, e.target.value)}
                            min="0"
                            max="100"
                            step="0.01"
                          />
                        </td>
                        <td className="text-right font-bold">
                          {formatearMoneda(item.subtotal)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleEliminarItem(index)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <Calculator size={64} className="mx-auto text-muted mb-4" style={{ opacity: 0.3 }} />
                <p className="text-muted font-bold mb-2">No hay productos agregados</p>
                <p className="text-muted text-sm mb-4">Agregue productos para continuar con la cotización</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setModalProductoOpen(true)}
                >
                  <Plus size={20} />
                  Agregar Primer Producto
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sección Totales */}
        {detalle.length > 0 && (
          <div className="card mb-4">
            <div className="card-body">
              <div className="flex justify-end">
                <div className="w-80">
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">Sub Total:</span>
                    <span className="font-bold">{formatearMoneda(totales.subtotal)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">IGV (18%):</span>
                    <span className="font-bold">{formatearMoneda(totales.igv)}</span>
                  </div>
                  <div className="flex justify-between py-3 bg-primary text-white px-4 rounded-lg mt-2">
                    <span className="font-bold text-lg">TOTAL:</span>
                    <span className="font-bold text-2xl">{formatearMoneda(totales.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/ventas/cotizaciones')}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || !clienteSeleccionado || detalle.length === 0}
          >
            <Save size={20} />
            Guardar Cotización
          </button>
        </div>
      </form>

      {/* Modal Seleccionar Cliente */}
      <Modal
        isOpen={modalClienteOpen}
        onClose={() => setModalClienteOpen(false)}
        title="Seleccionar Cliente"
        size="lg"
      >
        <div className="mb-4">
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por razón social o RUC..."
            value={busquedaCliente}
            onChange={(e) => setBusquedaCliente(e.target.value)}
            autoFocus
          />
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {clientesFiltrados.length > 0 ? (
            <div className="space-y-2">
              {clientesFiltrados.map(cliente => (
                <div
                  key={cliente.id_cliente}
                  className="p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition"
                  onClick={() => handleSelectCliente(cliente)}
                >
                  <div className="font-bold">{cliente.razon_social}</div>
                  <div className="text-sm text-muted">RUC: {cliente.ruc}</div>
                  <div className="text-sm text-muted">{cliente.direccion}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted py-8">No se encontraron clientes</p>
          )}
        </div>
      </Modal>

      {/* Modal Agregar Producto */}
      <Modal
        isOpen={modalProductoOpen}
        onClose={() => setModalProductoOpen(false)}
        title="Agregar Producto"
        size="lg"
      >
        <div className="mb-4">
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por código o nombre..."
            value={busquedaProducto}
            onChange={(e) => setBusquedaProducto(e.target.value)}
            autoFocus
          />
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {productosFiltrados.length > 0 ? (
            <div className="space-y-2">
              {productosFiltrados.map(producto => (
                <div
                  key={producto.id_producto}
                  className="p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition"
                  onClick={() => handleAgregarProducto(producto)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-bold">{producto.nombre}</div>
                      <div className="text-sm text-muted">Código: {producto.codigo}</div>
                      <div className="text-sm">
                        Stock: <span className={producto.stock_actual > 0 ? 'text-success' : 'text-danger'}>
                          {producto.stock_actual} {producto.unidad_medida}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary text-lg">
                        {formatearMoneda(producto.precio_venta)}
                      </div>
                      <div className="text-sm text-muted">por {producto.unidad_medida}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted py-8">No se encontraron productos</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default NuevaCotizacion;