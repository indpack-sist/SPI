// frontend/src/pages/Ventas/NuevaOrdenVenta.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Search,
  Calculator,
  ShoppingCart,
  Building,
  Calendar,
  DollarSign,
  MapPin,
  AlertCircle,
  Package,
  FileText
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';

function NuevaOrdenVenta() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idCotizacion = searchParams.get('cotizacion');
  
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
    id_cotizacion: idCotizacion || '',
    id_cliente: '',
    id_comercial: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_entrega_estimada: '',
    moneda: 'PEN',
    plazo_pago: '',
    forma_pago: '',
    orden_compra_cliente: '',
    direccion_entrega: '',
    lugar_entrega: '',
    ciudad_entrega: '',
    contacto_entrega: '',
    telefono_entrega: '',
    prioridad: 'Media',
    observaciones: ''
  });
  
  // Cliente seleccionado
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  
  // Cotización origen (si aplica)
  const [cotizacionOrigen, setCotizacionOrigen] = useState(null);
  
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
    if (idCotizacion) {
      cargarCotizacion(idCotizacion);
    }
  }, [idCotizacion]);

  useEffect(() => {
    calcularTotales();
  }, [detalle]);

  const cargarCatalogos = async () => {
    try {
      setLoading(true);
      
      // TODO: Reemplazar con llamadas API reales
      // const [clientesRes, productosRes, comercialesRes] = await Promise.all([
      //   clientesAPI.getAll({ estado: 'Activo' }),
      //   productosAPI.getAll({ estado: 'Activo', id_tipo_inventario: 3 }),
      //   empleadosAPI.getAll({ departamento: 'Ventas' })
      // ]);
      
      setClientes([
        {
          id_cliente: 1,
          razon_social: 'EMPRESA DEMO SAC',
          ruc: '20123456789',
          direccion: 'Av. Principal 123',
          ciudad: 'Lima',
          telefono: '(01) 234-5678',
          contacto: 'Juan Pérez'
        },
        {
          id_cliente: 2,
          razon_social: 'CORPORACIÓN ABC EIRL',
          ruc: '20987654321',
          direccion: 'Jr. Comercio 456',
          ciudad: 'Lima',
          telefono: '(01) 987-6543',
          contacto: 'María García'
        }
      ]);
      
      setProductos([
        {
          id_producto: 1,
          codigo: 'PROD-001',
          nombre: 'Producto Terminado 1',
          unidad_medida: 'unidad',
          precio_venta: 100.00,
          stock_actual: 50,
          requiere_receta: true
        },
        {
          id_producto: 2,
          codigo: 'PROD-002',
          nombre: 'Producto Terminado 2',
          unidad_medida: 'unidad',
          precio_venta: 150.00,
          stock_actual: 30,
          requiere_receta: true
        }
      ]);
      
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

  const cargarCotizacion = async (id) => {
    try {
      setLoading(true);
      
      // TODO: API real
      // const response = await cotizacionesAPI.getById(id);
      // const cotizacion = response.data.data;
      
      const mockCotizacion = {
        id_cotizacion: id,
        numero_cotizacion: 'C-2025-0001',
        id_cliente: 1,
        cliente: 'EMPRESA DEMO SAC',
        ruc_cliente: '20123456789',
        direccion_cliente: 'Av. Principal 123',
        ciudad_cliente: 'Lima',
        moneda: 'PEN',
        plazo_pago: '30 días',
        forma_pago: 'Transferencia',
        lugar_entrega: 'Av. Principal 123',
        observaciones: 'Cotización aprobada',
        detalle: [
          {
            id_producto: 1,
            codigo_producto: 'PROD-001',
            producto: 'Producto Terminado 1',
            unidad_medida: 'unidad',
            cantidad: 10,
            precio_unitario: 100.00,
            descuento_porcentaje: 0
          }
        ]
      };
      
      setCotizacionOrigen(mockCotizacion);
      
      // Auto-llenar formulario
      const clienteMock = clientes.find(c => c.id_cliente === mockCotizacion.id_cliente);
      if (clienteMock) {
        setClienteSeleccionado(clienteMock);
      }
      
      setFormCabecera({
        ...formCabecera,
        id_cotizacion: id,
        id_cliente: mockCotizacion.id_cliente,
        moneda: mockCotizacion.moneda,
        plazo_pago: mockCotizacion.plazo_pago,
        forma_pago: mockCotizacion.forma_pago,
        lugar_entrega: mockCotizacion.lugar_entrega,
        direccion_entrega: mockCotizacion.direccion_cliente,
        ciudad_entrega: mockCotizacion.ciudad_cliente,
        observaciones: mockCotizacion.observaciones
      });
      
      // Cargar detalle
      const detalleConvertido = mockCotizacion.detalle.map(item => ({
        ...item,
        cantidad_producida: 0,
        cantidad_despachada: 0,
        requiere_produccion: item.stock_actual < item.cantidad,
        subtotal: item.cantidad * item.precio_unitario
      }));
      
      setDetalle(detalleConvertido);
      
    } catch (err) {
      setError('Error al cargar cotización: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCliente = (cliente) => {
    setClienteSeleccionado(cliente);
    setFormCabecera({
      ...formCabecera,
      id_cliente: cliente.id_cliente,
      direccion_entrega: cliente.direccion || '',
      ciudad_entrega: cliente.ciudad || '',
      contacto_entrega: cliente.contacto || '',
      telefono_entrega: cliente.telefono || ''
    });
    setModalClienteOpen(false);
    setBusquedaCliente('');
  };

  const handleAgregarProducto = (producto) => {
    const existe = detalle.find(d => d.id_producto === producto.id_producto);
    if (existe) {
      setError('El producto ya está en el detalle');
      return;
    }
    
    const nuevoItem = {
      id_producto: producto.id_producto,
      codigo_producto: producto.codigo,
      producto: producto.nombre,
      unidad_medida: producto.unidad_medida,
      cantidad: 1,
      precio_unitario: producto.precio_venta,
      descuento_porcentaje: 0,
      stock_actual: producto.stock_actual,
      requiere_produccion: producto.requiere_receta && producto.stock_actual < 1,
      cantidad_producida: 0,
      cantidad_despachada: 0,
      subtotal: producto.precio_venta
    };
    
    setDetalle([...detalle, nuevoItem]);
    setModalProductoOpen(false);
    setBusquedaProducto('');
  };

  const handleCantidadChange = (index, cantidad) => {
    const newDetalle = [...detalle];
    const cantidadNum = parseFloat(cantidad) || 0;
    
    newDetalle[index].cantidad = cantidadNum;
    newDetalle[index].requiere_produccion = cantidadNum > newDetalle[index].stock_actual;
    newDetalle[index].subtotal = 
      cantidadNum * 
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
    
    if (!formCabecera.direccion_entrega) {
      setError('Debe especificar la dirección de entrega');
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
          descuento_porcentaje: item.descuento_porcentaje,
          requiere_produccion: item.requiere_produccion
        }))
      };
      
      // TODO: Llamar API real
      // const response = await ordenesVentaAPI.create(payload);
      
      console.log('Payload:', payload);
      
      setSuccess('Orden de venta creada exitosamente');
      
      setTimeout(() => {
        navigate('/ventas/ordenes');
      }, 1500);
      
    } catch (err) {
      setError('Error al crear orden de venta: ' + err.message);
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

  const getPrioridadColor = (prioridad) => {
    const colors = {
      'Baja': 'bg-gray-100 text-gray-800',
      'Media': 'bg-blue-100 text-blue-800',
      'Alta': 'bg-yellow-100 text-yellow-800',
      'Urgente': 'bg-red-100 text-red-800'
    };
    return colors[prioridad] || colors['Media'];
  };

  if (loading && clientes.length === 0) {
    return <Loading message="Cargando formulario..." />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          className="btn btn-outline"
          onClick={() => navigate('/ventas/ordenes')}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart size={32} />
            Nueva Orden de Venta
          </h1>
          <p className="text-muted">
            {cotizacionOrigen 
              ? `Desde cotización ${cotizacionOrigen.numero_cotizacion}` 
              : 'Crear orden de venta manual'}
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Alerta de Cotización */}
      {cotizacionOrigen && (
        <div className="card border-l-4 border-primary bg-blue-50 mb-4">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <FileText size={24} className="text-primary" />
              <div>
                <p className="font-medium text-blue-900">
                  Orden generada desde cotización {cotizacionOrigen.numero_cotizacion}
                </p>
                <p className="text-sm text-blue-700">
                  Los datos de la cotización se han precargado automáticamente
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  {!cotizacionOrigen && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => setClienteSeleccionado(null)}
                    >
                      Cambiar
                    </button>
                  )}
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

        {/* Sección Datos de la Orden */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <Calendar size={20} />
              Datos de la Orden
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
                <label className="form-label">Fecha Entrega Estimada</label>
                <input
                  type="date"
                  className="form-input"
                  value={formCabecera.fecha_entrega_estimada}
                  onChange={(e) => setFormCabecera({ ...formCabecera, fecha_entrega_estimada: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Prioridad *</label>
                <select
                  className="form-select"
                  value={formCabecera.prioridad}
                  onChange={(e) => setFormCabecera({ ...formCabecera, prioridad: e.target.value })}
                  required
                >
                  <option value="Baja">Baja</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                </select>
                <div className="mt-2">
                  <span className={`badge ${getPrioridadColor(formCabecera.prioridad)}`}>
                    {formCabecera.prioridad}
                  </span>
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Moneda *</label>
                <select
                  className="form-select"
                  value={formCabecera.moneda}
                  onChange={(e) => setFormCabecera({ ...formCabecera, moneda: e.target.value })}
                  required
                  disabled={!!cotizacionOrigen}
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
          </div>
        </div>

        {/* Sección Datos de Entrega */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <MapPin size={20} />
              Datos de Entrega
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group col-span-2">
                <label className="form-label">Dirección de Entrega *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formCabecera.direccion_entrega}
                  onChange={(e) => setFormCabecera({ ...formCabecera, direccion_entrega: e.target.value })}
                  placeholder="Dirección completa"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Lugar de Entrega</label>
                <input
                  type="text"
                  className="form-input"
                  value={formCabecera.lugar_entrega}
                  onChange={(e) => setFormCabecera({ ...formCabecera, lugar_entrega: e.target.value })}
                  placeholder="Referencia del lugar"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Ciudad</label>
                <input
                  type="text"
                  className="form-input"
                  value={formCabecera.ciudad_entrega}
                  onChange={(e) => setFormCabecera({ ...formCabecera, ciudad_entrega: e.target.value })}
                  placeholder="Ciudad"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Contacto de Entrega</label>
                <input
                  type="text"
                  className="form-input"
                  value={formCabecera.contacto_entrega}
                  onChange={(e) => setFormCabecera({ ...formCabecera, contacto_entrega: e.target.value })}
                  placeholder="Nombre del contacto"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Teléfono de Contacto</label>
                <input
                  type="text"
                  className="form-input"
                  value={formCabecera.telefono_entrega}
                  onChange={(e) => setFormCabecera({ ...formCabecera, telefono_entrega: e.target.value })}
                  placeholder="Teléfono"
                />
              </div>
            </div>
            
            <div className="form-group mt-4">
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
                <Package size={20} />
                Detalle de Productos
              </h2>
              {!cotizacionOrigen && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setModalProductoOpen(true)}
                >
                  <Plus size={20} />
                  Agregar Producto
                </button>
              )}
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
                      {!cotizacionOrigen && <th style={{ width: '60px' }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((item, index) => (
                      <tr key={index}>
                        <td className="font-mono text-sm">{item.codigo_producto}</td>
                        <td>
                          <div className="font-medium">{item.producto}</div>
                          {item.requiere_produccion && (
                            <div className="text-xs text-warning flex items-center gap-1">
                              <AlertCircle size={12} />
                              Requiere producción ({item.stock_actual} en stock)
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
                            disabled={!!cotizacionOrigen}
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
                            disabled={!!cotizacionOrigen}
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
                            disabled={!!cotizacionOrigen}
                          />
                        </td>
                        <td className="text-right font-bold">
                          {formatearMoneda(item.subtotal)}
                        </td>
                        {!cotizacionOrigen && (
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => handleEliminarItem(index)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <Package size={64} className="mx-auto text-muted mb-4" style={{ opacity: 0.3 }} />
                <p className="text-muted font-bold mb-2">No hay productos agregados</p>
                <p className="text-muted text-sm mb-4">Agregue productos para continuar</p>
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
            onClick={() => navigate('/ventas/ordenes')}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || !clienteSeleccionado || detalle.length === 0}
          >
            <Save size={20} />
            Crear Orden de Venta
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
                        {producto.requiere_receta && (
                          <span className="badge badge-info ml-2">
                            Requiere producción
                          </span>
                        )}
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

export default NuevaOrdenVenta;