import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash2, Save, Search, Calculator,
  ShoppingCart, Building, Calendar, DollarSign, MapPin,
  AlertCircle, Package, FileText, AlertTriangle
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { 
  ordenesVentaAPI, clientesAPI, 
  productosAPI, empleadosAPI 
} from '../../config/api';

function NuevaOrdenVenta() {
  const navigate = useNavigate();
  const { id } = useParams();
  const modoEdicion = !!id;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [comerciales, setComerciales] = useState([]);
  
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [modalProductoOpen, setModalProductoOpen] = useState(false);
  
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  
  const [formCabecera, setFormCabecera] = useState({
    id_cliente: '',
    id_comercial: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_entrega_estimada: '',
    moneda: 'PEN',
    tipo_cambio: 1.0000,
    tipo_impuesto: 'IGV',
    porcentaje_impuesto: 18.00,
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
  
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [totales, setTotales] = useState({ subtotal: 0, impuesto: 0, total: 0 });

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    calcularTotales();
  }, [detalle, formCabecera.porcentaje_impuesto, formCabecera.tipo_impuesto]);

  const cargarCatalogos = async () => {
    try {
      setLoading(true);
      
      const [resClientes, resProductos, resComerciales] = await Promise.all([
        clientesAPI.getAll({ estado: 'Activo' }),
        productosAPI.getAll({ estado: 'Activo', id_tipo_inventario: 3 }),
        empleadosAPI.getAll({ rol: 'Ventas,Comercial', estado: 'Activo' })
      ]);
      
      if (resClientes.data.success) {
        setClientes(resClientes.data.data || []);
      }
      
      if (resProductos.data.success) {
        setProductos(resProductos.data.data || []);
      }
      
      if (resComerciales.data.success) {
        setComerciales(resComerciales.data.data || []);
      }
      
    } catch (err) {
      console.error('Error al cargar catálogos:', err);
      setError('Error al cargar catálogos: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCliente = (cliente) => {
    setClienteSeleccionado(cliente);
    setFormCabecera({
      ...formCabecera,
      id_cliente: cliente.id_cliente,
      direccion_entrega: cliente.direccion_despacho || '',
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
      precio_unitario: producto.precio_venta || 0,
      descuento_porcentaje: 0,
      stock_actual: producto.stock_actual,
      requiere_produccion: producto.stock_actual < 1,
      subtotal: producto.precio_venta || 0
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
    const subtotal = detalle.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    
    const tipoImpuesto = formCabecera.tipo_impuesto || 'IGV';
    let porcentaje = parseFloat(formCabecera.porcentaje_impuesto) || 18;
    
    if (tipoImpuesto === 'EXO' || tipoImpuesto === 'INA' || tipoImpuesto === 'GRA' || tipoImpuesto === 'EXP') {
      porcentaje = 0;
    }
    
    const impuesto = subtotal * (porcentaje / 100);
    const total = subtotal + impuesto;
    setTotales({ subtotal, impuesto, total });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
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
        id_cliente: parseInt(formCabecera.id_cliente),
        id_comercial: formCabecera.id_comercial ? parseInt(formCabecera.id_comercial) : null,
        fecha_emision: formCabecera.fecha_emision,
        fecha_entrega_estimada: formCabecera.fecha_entrega_estimada || null,
        moneda: formCabecera.moneda,
        tipo_cambio: parseFloat(formCabecera.tipo_cambio) || 1.0000,
        tipo_impuesto: formCabecera.tipo_impuesto || 'IGV',
        porcentaje_impuesto: parseFloat(formCabecera.porcentaje_impuesto) || 18.00,
        plazo_pago: formCabecera.plazo_pago,
        forma_pago: formCabecera.forma_pago,
        orden_compra_cliente: formCabecera.orden_compra_cliente,
        direccion_entrega: formCabecera.direccion_entrega,
        lugar_entrega: formCabecera.lugar_entrega,
        ciudad_entrega: formCabecera.ciudad_entrega,
        contacto_entrega: formCabecera.contacto_entrega,
        telefono_entrega: formCabecera.telefono_entrega,
        prioridad: formCabecera.prioridad,
        observaciones: formCabecera.observaciones,
        detalle: detalle.map((item, index) => ({
          id_producto: item.id_producto,
          cantidad: parseFloat(item.cantidad),
          precio_unitario: parseFloat(item.precio_unitario),
          descuento_porcentaje: parseFloat(item.descuento_porcentaje) || 0,
          orden: index + 1
        }))
      };
      
      const response = await ordenesVentaAPI.create(payload);
      
      if (response.data.success) {
        setSuccess('Orden de venta creada exitosamente');
        setTimeout(() => {
          navigate('/ventas/ordenes');
        }, 1500);
      } else {
        setError(response.data.error || 'Error al crear orden de venta');
      }
      
    } catch (err) {
      console.error('Error al crear orden de venta:', err);
      setError(err.response?.data?.error || 'Error al crear orden de venta');
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

  const TIPOS_IMPUESTO = [
    { codigo: 'IGV', nombre: 'IGV', porcentaje: 18.00 },
    { codigo: 'IGV3', nombre: 'IGV 3ra Cat.', porcentaje: 3.00 },
    { codigo: 'IGV4', nombre: 'IGV 4ta Cat.', porcentaje: 4.00 },
    { codigo: 'GRA', nombre: 'Gratuito', porcentaje: 0.00 },
    { codigo: '6%', nombre: 'Impuesto 6%', porcentaje: 6.00 },
    { codigo: 'EXO', nombre: 'Exonerado', porcentaje: 0.00 },
    { codigo: 'INA', nombre: 'Inafecto', porcentaje: 0.00 },
    { codigo: 'EXP', nombre: 'Exportación', porcentaje: 0.00 }
  ];

  if (loading && clientes.length === 0) {
    return <Loading message="Cargando formulario..." />;
  }

  return (
    <div className="p-6">
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
          <p className="text-muted">Crear orden de venta manual</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <form onSubmit={handleSubmit}>
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
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted">Cliente:</label>
                      <p className="font-bold text-lg">{clienteSeleccionado.razon_social}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted">RUC:</label>
                      <p className="font-bold">{clienteSeleccionado.ruc}</p>
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
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Impuesto *</label>
                <select
                  className="form-select"
                  value={formCabecera.tipo_impuesto}
                  onChange={(e) => {
                    const tipoSeleccionado = TIPOS_IMPUESTO.find(t => t.codigo === e.target.value);
                    setFormCabecera({ 
                      ...formCabecera, 
                      tipo_impuesto: e.target.value,
                      porcentaje_impuesto: tipoSeleccionado?.porcentaje || 18
                    });
                  }}
                >
                  {TIPOS_IMPUESTO.map(tipo => (
                    <option key={tipo.codigo} value={tipo.codigo}>
                      {tipo.nombre} ({tipo.porcentaje}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">% Impuesto *</label>
                <input
                  type="number"
                  className="form-input"
                  value={formCabecera.porcentaje_impuesto}
                  onChange={(e) => setFormCabecera({ ...formCabecera, porcentaje_impuesto: e.target.value })}
                  min="0"
                  max="100"
                  step="0.01"
                  readOnly={['EXO', 'INA', 'GRA', 'EXP'].includes(formCabecera.tipo_impuesto)}
                />
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

        <div className="card mb-4">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h2 className="card-title">
                <Package size={20} />
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
                      <th>Código</th>
                      <th>Descripción</th>
                      <th>Cantidad</th>
                      <th>Unidad</th>
                      <th>P. Unitario</th>
                      <th>Desc. %</th>
                      <th>Subtotal</th>
                      <th></th>
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
                              <AlertTriangle size={12} />
                              Requerirá producción (disponible: {parseFloat(item.stock_actual).toFixed(2)})
                            </div>
                          )}
                        </td>
                        <td style={{ width: '120px' }}>
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
                        <td style={{ width: '120px' }}>
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
                        <td style={{ width: '100px' }}>
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
                <Package size={64} className="mx-auto text-muted mb-4" style={{ opacity: 0.3 }} />
                <p className="text-muted font-bold mb-2">No hay productos agregados</p>
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
                    <span className="font-medium">
                      {TIPOS_IMPUESTO.find(t => t.codigo === formCabecera.tipo_impuesto)?.nombre || 'Impuesto'} 
                      ({formCabecera.porcentaje_impuesto}%):
                    </span>
                    <span className="font-bold">{formatearMoneda(totales.impuesto)}</span>
                  </div>
                  <div className="flex justify-between py-3 bg-primary text-white px-4 rounded-lg mt-2">
                    <span className="font-bold text-lg">TOTAL:</span>
                    <span className="font-bold text-2xl">{formatearMoneda(totales.total)}</span>
                  </div>

                  {formCabecera.moneda === 'USD' && parseFloat(formCabecera.tipo_cambio) > 1 && (
                    <div className="flex justify-between py-2 mt-2 bg-blue-50 px-4 rounded-lg border border-blue-200">
                      <span className="text-sm font-medium text-blue-900">
                        Equivalente en Soles (TC: {parseFloat(formCabecera.tipo_cambio).toFixed(4)}):
                      </span>
                      <span className="font-bold text-blue-900">
                        S/ {(totales.total * parseFloat(formCabecera.tipo_cambio)).toFixed(2)}
                      </span>
                    </div>
                  )}
                  
                  {formCabecera.moneda === 'PEN' && parseFloat(formCabecera.tipo_cambio) > 1 && (
                    <div className="flex justify-between py-2 mt-2 bg-green-50 px-4 rounded-lg border border-green-200">
                      <span className="text-sm font-medium text-green-900">
                        Equivalente en Dólares (TC: {parseFloat(formCabecera.tipo_cambio).toFixed(4)}):
                      </span>
                      <span className="font-bold text-green-900">
                        $ {(totales.total / parseFloat(formCabecera.tipo_cambio)).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
            {loading ? 'Guardando...' : 'Crear Orden de Venta'}
          </button>
        </div>
      </form>

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
                  <div className="text-sm text-muted">{cliente.direccion_despacho || 'Sin dirección'}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted py-8">No se encontraron clientes</p>
          )}
        </div>
      </Modal>

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

export default NuevaOrdenVenta;