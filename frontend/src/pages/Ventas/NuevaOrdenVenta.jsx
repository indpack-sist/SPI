import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash2, Save, Search,
  ShoppingCart, Calendar, Building, Calculator,
  User, MapPin, DollarSign, CreditCard, Info
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { ordenesVentaAPI, clientesAPI, productosAPI, empleadosAPI, cotizacionesAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const TIPOS_IMPUESTO = [
  { codigo: 'IGV', nombre: 'IGV 18%', porcentaje: 18.00 },
  { codigo: 'EXO', nombre: 'Exonerado 0%', porcentaje: 0.00 },
  { codigo: 'INA', nombre: 'Inafecto 0%', porcentaje: 0.00 }
];

function NuevaOrdenVenta() {
  const navigate = useNavigate();
  const { id } = useParams(); 
  const { user } = useAuth();
  
  const modoEdicion = !!id;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [comerciales, setComerciales] = useState([]);
  const [cotizacionesPendientes, setCotizacionesPendientes] = useState([]);
  
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [modalProductoOpen, setModalProductoOpen] = useState(false);
  
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [totales, setTotales] = useState({ subtotal: 0, impuesto: 0, total: 0, totalComisiones: 0 });
  
  const [formCabecera, setFormCabecera] = useState({
    id_cliente: '',
    id_cotizacion: '',
    id_comercial: user?.id_empleado || '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_entrega_estimada: '',
    moneda: 'PEN',
    tipo_cambio: 1.0000,
    tipo_impuesto: 'IGV',
    porcentaje_impuesto: 18.00,
    prioridad: 'Media',
    plazo_pago: '',
    forma_pago: '',
    orden_compra_cliente: '',
    direccion_entrega: '',
    lugar_entrega: '',
    ciudad_entrega: 'Lima',
    contacto_entrega: '',
    telefono_entrega: '',
    observaciones: ''
  });

  // 1. Cargar catálogos al inicio
  useEffect(() => {
    cargarCatalogos();
  }, []);

  // 2. Si es edición, cargar la orden existente (ESTO FALTABA EN TU CÓDIGO)
  useEffect(() => {
    if (modoEdicion) {
      cargarOrden();
    }
  }, [id]);

  // 3. Recalcular totales cuando cambie el detalle
  useEffect(() => {
    calcularTotales();
  }, [detalle, formCabecera.porcentaje_impuesto]);

  const cargarCatalogos = async () => {
    try {
      // Cargamos catálogos en paralelo para mayor velocidad
      const [resClientes, resProductos, resEmpleados, resCotizaciones] = await Promise.all([
        clientesAPI.getAll({ estado: 'Activo' }),
        productosAPI.getAll({ estado: 'Activo', id_tipo_inventario: 3 }),
        empleadosAPI.getAll({ estado: 'Activo' }),
        !modoEdicion ? cotizacionesAPI.getAll({ estado: 'Aprobada' }) : { data: { success: true, data: [] } }
      ]);

      if (resClientes.data.success) setClientes(resClientes.data.data || []);
      if (resProductos.data.success) setProductos(resProductos.data.data || []);
      
      if (resEmpleados.data.success) {
        // Filtramos solo empleados que pueden vender
        const vendedores = (resEmpleados.data.data || []).filter(e => 
          ['ventas', 'comercial', 'gerencia', 'administrador'].includes(e.rol?.toLowerCase())
        );
        setComerciales(vendedores);
      }

      if (resCotizaciones.data.success) {
        setCotizacionesPendientes(resCotizaciones.data.data || []);
      }

    } catch (err) {
      console.error(err);
      setError('Error al cargar catálogos iniciales');
    }
  };

  const cargarOrden = async () => {
    try {
      setLoading(true);
      const response = await ordenesVentaAPI.getById(id);
      
      if (response.data.success) {
        const orden = response.data.data;
        
        // Llenar cabecera
        setFormCabecera({
          id_cliente: orden.id_cliente,
          id_cotizacion: orden.id_cotizacion || '',
          id_comercial: orden.id_comercial || '',
          fecha_emision: orden.fecha_emision ? orden.fecha_emision.split('T')[0] : '',
          fecha_entrega_estimada: orden.fecha_entrega_estimada ? orden.fecha_entrega_estimada.split('T')[0] : '',
          moneda: orden.moneda,
          tipo_cambio: orden.tipo_cambio,
          tipo_impuesto: orden.tipo_impuesto,
          porcentaje_impuesto: orden.porcentaje_impuesto,
          prioridad: orden.prioridad,
          plazo_pago: orden.plazo_pago || '',
          forma_pago: orden.forma_pago || '',
          orden_compra_cliente: orden.orden_compra_cliente || '',
          direccion_entrega: orden.direccion_entrega || '',
          lugar_entrega: orden.lugar_entrega || '',
          ciudad_entrega: orden.ciudad_entrega || '',
          contacto_entrega: orden.contacto_entrega || '',
          telefono_entrega: orden.telefono_entrega || '',
          observaciones: orden.observaciones || ''
        });

        // Establecer cliente seleccionado
        // Buscamos en el array de clientes cargado, si no está (ej. inactivo), creamos el objeto con los datos de la orden
        const clienteEncontrado = clientes.find(c => c.id_cliente === orden.id_cliente);
        if (clienteEncontrado) {
          setClienteSeleccionado(clienteEncontrado);
        } else {
          setClienteSeleccionado({
            id_cliente: orden.id_cliente,
            razon_social: orden.cliente,
            ruc: orden.ruc_cliente,
            direccion_despacho: orden.direccion_entrega
          });
        }

        // Llenar detalle (Mapeo importante para comisiones y 3 decimales)
        if (orden.detalle && orden.detalle.length > 0) {
          setDetalle(orden.detalle.map(item => ({
            id_producto: item.id_producto,
            codigo_producto: item.codigo_producto,
            producto: item.producto,
            unidad_medida: item.unidad_medida,
            cantidad: parseFloat(item.cantidad),
            // Si precio_base viene 0 (orden antigua), usamos precio_unitario como fallback
            precio_base: parseFloat(item.precio_base) > 0 ? parseFloat(item.precio_base) : parseFloat(item.precio_unitario),
            porcentaje_comision: parseFloat(item.porcentaje_comision || 0),
            monto_comision: parseFloat(item.monto_comision || 0),
            precio_unitario: parseFloat(item.precio_unitario), // Este es el precio final
            descuento_porcentaje: parseFloat(item.descuento_porcentaje || 0),
            stock_actual: item.stock_disponible
          })));
        }
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar los datos de la orden para editar');
    } finally {
      setLoading(false);
    }
  };

  const handleImportarCotizacion = async (idCotizacion) => {
    if (!idCotizacion) {
      setFormCabecera(prev => ({ ...prev, id_cotizacion: '' }));
      return;
    }

    try {
      setLoading(true);
      const response = await cotizacionesAPI.getById(idCotizacion);
      
      if (response.data.success) {
        const cot = response.data.data;
        
        setFormCabecera(prev => ({
          ...prev,
          id_cotizacion: cot.id_cotizacion,
          id_cliente: cot.id_cliente,
          id_comercial: cot.id_comercial || prev.id_comercial,
          moneda: cot.moneda,
          tipo_impuesto: cot.tipo_impuesto,
          porcentaje_impuesto: cot.porcentaje_impuesto,
          tipo_cambio: cot.tipo_cambio,
          plazo_pago: cot.plazo_pago || '',
          forma_pago: cot.forma_pago || '',
          direccion_entrega: cot.direccion_entrega || '',
          lugar_entrega: cot.lugar_entrega || '',
          observaciones: cot.observaciones || ''
        }));

        const cliente = clientes.find(c => c.id_cliente === cot.id_cliente);
        if (cliente) setClienteSeleccionado(cliente);

        if (cot.detalle) {
          setDetalle(cot.detalle.map(item => ({
            id_producto: item.id_producto,
            codigo_producto: item.codigo_producto,
            producto: item.producto,
            unidad_medida: item.unidad_medida,
            cantidad: parseFloat(item.cantidad),
            precio_base: parseFloat(item.precio_base || item.precio_unitario),
            porcentaje_comision: parseFloat(item.porcentaje_comision || 0),
            monto_comision: parseFloat(item.monto_comision || 0),
            precio_unitario: parseFloat(item.precio_unitario),
            descuento_porcentaje: parseFloat(item.descuento_porcentaje || 0),
            stock_actual: item.stock_disponible
          })));
        }
      }
    } catch (err) {
      console.error(err);
      setError('Error al importar la cotización');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCliente = (cliente) => {
    setClienteSeleccionado(cliente);
    setFormCabecera(prev => ({
      ...prev,
      id_cliente: cliente.id_cliente,
      direccion_entrega: cliente.direccion_despacho || '',
      lugar_entrega: cliente.direccion_despacho || ''
    }));
    setModalClienteOpen(false);
    setBusquedaCliente('');
  };

  const handleAgregarProducto = (producto) => {
    const existe = detalle.find(d => d.id_producto === producto.id_producto);
    if (existe) {
      setError('El producto ya está en el detalle');
      return;
    }
    
    const precioBase = producto.precio_venta || 0;
    
    const nuevoItem = {
      id_producto: producto.id_producto,
      codigo_producto: producto.codigo,
      producto: producto.nombre,
      unidad_medida: producto.unidad_medida,
      cantidad: 1,
      precio_base: precioBase,
      porcentaje_comision: 0,
      monto_comision: 0,
      precio_unitario: precioBase, // Inicialmente igual al base
      descuento_porcentaje: 0,
      stock_actual: producto.stock_actual
    };
    
    setDetalle([...detalle, nuevoItem]);
    setModalProductoOpen(false);
    setBusquedaProducto('');
  };

  const handleCantidadChange = (index, valor) => {
    const newDetalle = [...detalle];
    newDetalle[index].cantidad = parseFloat(valor) || 0;
    setDetalle(newDetalle);
  };

  const handlePrecioBaseChange = (index, precioBase) => {
    const newDetalle = [...detalle];
    const item = newDetalle[index];
    const nuevoPrecioBase = parseFloat(precioBase) || 0;
    const porcentajeComision = parseFloat(item.porcentaje_comision || 0);
    
    // Recalcular monto y precio final
    const montoComision = nuevoPrecioBase * (porcentajeComision / 100);
    const precioFinal = nuevoPrecioBase + montoComision;
    
    newDetalle[index].precio_base = nuevoPrecioBase;
    newDetalle[index].monto_comision = montoComision;
    newDetalle[index].precio_unitario = precioFinal;
    
    setDetalle(newDetalle);
  };

  const handleComisionChange = (index, porcentaje) => {
    const newDetalle = [...detalle];
    const item = newDetalle[index];
    const precioBase = parseFloat(item.precio_base);
    const porcentajeComision = parseFloat(porcentaje) || 0;
    
    // Recalcular monto y precio final
    const montoComision = precioBase * (porcentajeComision / 100);
    const precioFinal = precioBase + montoComision;
    
    newDetalle[index].porcentaje_comision = porcentajeComision;
    newDetalle[index].monto_comision = montoComision;
    newDetalle[index].precio_unitario = precioFinal;
    
    setDetalle(newDetalle);
  };

  const handleDescuentoChange = (index, valor) => {
    const newDetalle = [...detalle];
    newDetalle[index].descuento_porcentaje = parseFloat(valor) || 0;
    setDetalle(newDetalle);
  };

  const handleEliminarItem = (index) => {
    const newDetalle = detalle.filter((_, i) => i !== index);
    setDetalle(newDetalle);
  };

  const calcularTotales = () => {
    let subtotal = 0;
    let totalComisiones = 0;
    
    detalle.forEach(item => {
      const valorVenta = (item.cantidad * item.precio_unitario) * (1 - item.descuento_porcentaje / 100);
      subtotal += valorVenta;
      totalComisiones += (item.monto_comision || 0) * item.cantidad;
    });
    
    const porcentaje = parseFloat(formCabecera.porcentaje_impuesto) || 0;
    const impuesto = subtotal * (porcentaje / 100);
    const total = subtotal + impuesto;
    
    setTotales({ subtotal, impuesto, total, totalComisiones });
  };

  const formatearMoneda = (valor) => {
    const simbolo = formCabecera.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toFixed(3)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!clienteSeleccionado) {
      setError('Debe seleccionar un cliente');
      return;
    }
    
    if (detalle.length === 0) {
      setError('Debe agregar al menos un producto');
      return;
    }

    if (!formCabecera.plazo_pago) {
      setError('El plazo de pago es obligatorio');
      return;
    }
    
    try {
      setLoading(true);
      
      const payload = {
        ...formCabecera,
        id_cliente: clienteSeleccionado.id_cliente,
        detalle: detalle.map((item, index) => ({
          id_producto: item.id_producto,
          cantidad: parseFloat(item.cantidad),
          precio_base: parseFloat(item.precio_base),
          porcentaje_comision: parseFloat(item.porcentaje_comision || 0),
          precio_unitario: parseFloat(item.precio_unitario),
          descuento_porcentaje: parseFloat(item.descuento_porcentaje || 0),
          orden: index + 1
        }))
      };

      let response;
      if (modoEdicion) {
        response = await ordenesVentaAPI.update(id, payload);
      } else {
        response = await ordenesVentaAPI.create(payload);
      }
      
      if (response.data.success) {
        setSuccess(modoEdicion ? 'Orden actualizada exitosamente' : `Orden creada: ${response.data.data.numero_orden}`);
        setTimeout(() => navigate('/ventas/ordenes'), 1500);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al guardar la orden de venta');
    } finally {
      setLoading(false);
    }
  };

  const clientesFiltrados = clientes.filter(c =>
    c.razon_social.toLowerCase().includes(busquedaCliente.toLowerCase()) ||
    c.ruc.includes(busquedaCliente)
  );

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
    p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
  );

  if (loading && clientes.length === 0) return <Loading message="Cargando..." />;

  const tituloFormulario = modoEdicion ? 'Editar Orden de Venta' : 'Nueva Orden de Venta';

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button className="btn btn-outline" onClick={() => navigate('/ventas/ordenes')}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart size={32} />
            {tituloFormulario}
          </h1>
          <p className="text-muted">{modoEdicion ? 'Modificar orden existente' : 'Crear orden manual o desde cotización'}</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-2 space-y-6">
            
            <div className="card">
              <div className="card-header bg-gradient-to-r from-blue-50 to-white">
                <h2 className="card-title text-blue-900"><Building size={20} /> Cliente</h2>
              </div>
              <div className="card-body">
                {clienteSeleccionado ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-lg">{clienteSeleccionado.razon_social}</p>
                        <p className="text-muted text-sm">RUC: {clienteSeleccionado.ruc}</p>
                        {clienteSeleccionado.direccion_despacho && (
                          <p className="text-xs text-muted mt-1"><MapPin size={12} className="inline"/> {clienteSeleccionado.direccion_despacho}</p>
                        )}
                      </div>
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => setClienteSeleccionado(null)}>
                        Cambiar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn btn-primary w-full py-4" onClick={() => setModalClienteOpen(true)}>
                    <Search size={20} /> Seleccionar Cliente
                  </button>
                )}
                
                {!modoEdicion && (
                  <div className="mt-4">
                    <label className="form-label">Importar desde Cotización</label>
                    <select 
                      className="form-select"
                      value={formCabecera.id_cotizacion}
                      onChange={(e) => handleImportarCotizacion(e.target.value)}
                    >
                      <option value="">Seleccionar cotización aprobada...</option>
                      {cotizacionesPendientes.map(cot => (
                        <option key={cot.id_cotizacion} value={cot.id_cotizacion}>
                          {cot.numero_cotizacion} - {cot.cliente} ({new Date(cot.fecha_emision).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
                <h2 className="card-title"><Calculator size={20} /> Productos</h2>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => setModalProductoOpen(true)}>
                  <Plus size={16} /> Agregar
                </button>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="text-right w-24">Cant.</th>
                      <th className="text-right w-28">P. Base</th>
                      <th className="text-right w-28">Comisión</th>
                      <th className="text-right w-28">P. Final</th>
                      <th className="text-center w-20">Desc%</th>
                      <th className="text-right w-28">Subtotal</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.length === 0 ? (
                      <tr><td colSpan="8" className="text-center py-8 text-muted">No hay productos agregados</td></tr>
                    ) : (
                      detalle.map((item, index) => {
                        const valorVenta = (item.cantidad * item.precio_unitario) * (1 - item.descuento_porcentaje / 100);
                        return (
                          <tr key={index}>
                            <td>
                              <div className="font-medium">{item.producto}</div>
                              <div className="text-xs text-muted font-mono">{item.codigo_producto}</div>
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input text-right p-1 h-8"
                                value={item.cantidad}
                                onChange={(e) => handleCantidadChange(index, e.target.value)}
                                min="0.01" step="0.01"
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input text-right p-1 h-8 bg-blue-50"
                                value={item.precio_base}
                                onChange={(e) => handlePrecioBaseChange(index, e.target.value)}
                                min="0" step="0.001"
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input text-right p-1 h-8 bg-yellow-50"
                                value={item.porcentaje_comision}
                                onChange={(e) => handleComisionChange(index, e.target.value)}
                                min="0" max="100" step="0.01"
                                placeholder="%"
                              />
                              <div className="text-[10px] text-right text-success">+{formatearMoneda(item.monto_comision)}</div>
                            </td>
                            <td className="text-right">
                              <div className="font-bold text-primary">{formatearMoneda(item.precio_unitario)}</div>
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input text-center p-1 h-8"
                                value={item.descuento_porcentaje}
                                onChange={(e) => handleDescuentoChange(index, e.target.value)}
                                min="0" max="100" step="0.01"
                              />
                            </td>
                            <td className="text-right font-bold">{formatearMoneda(valorVenta)}</td>
                            <td>
                              <button type="button" className="text-danger hover:bg-red-50 p-1 rounded" onClick={() => handleEliminarItem(index)}>
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <label className="form-label">Observaciones</label>
                <textarea 
                  className="form-textarea" 
                  rows="2"
                  value={formCabecera.observaciones}
                  onChange={(e) => setFormCabecera({...formCabecera, observaciones: e.target.value})}
                ></textarea>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card">
              <div className="card-header bg-gradient-to-r from-purple-50 to-white">
                <h2 className="card-title text-purple-900"><Info size={20} /> Datos Generales</h2>
              </div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Fecha Emisión</label>
                    <input 
                      type="date" 
                      className="form-input"
                      value={formCabecera.fecha_emision}
                      onChange={(e) => setFormCabecera({...formCabecera, fecha_emision: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="form-label">Fecha Entrega</label>
                    <input 
                      type="date" 
                      className="form-input"
                      value={formCabecera.fecha_entrega_estimada}
                      onChange={(e) => setFormCabecera({...formCabecera, fecha_entrega_estimada: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Moneda</label>
                    <select 
                      className="form-select"
                      value={formCabecera.moneda}
                      onChange={(e) => setFormCabecera({...formCabecera, moneda: e.target.value})}
                    >
                      <option value="PEN">Soles</option>
                      <option value="USD">Dólares</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Tipo Cambio</label>
                    <input 
                      type="number" 
                      className="form-input"
                      value={formCabecera.tipo_cambio}
                      onChange={(e) => setFormCabecera({...formCabecera, tipo_cambio: e.target.value})}
                      disabled={formCabecera.moneda === 'PEN'}
                      step="0.001"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Comercial</label>
                  <select 
                    className="form-select"
                    value={formCabecera.id_comercial}
                    onChange={(e) => setFormCabecera({...formCabecera, id_comercial: e.target.value})}
                  >
                    <option value="">Seleccionar...</option>
                    {comerciales.map(c => (
                      <option key={c.id_empleado} value={c.id_empleado}>{c.nombre_completo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Prioridad</label>
                  <div className="flex gap-2">
                    {['Baja', 'Media', 'Alta', 'Urgente'].map(p => (
                      <button
                        key={p}
                        type="button"
                        className={`btn btn-xs flex-1 ${formCabecera.prioridad === p ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setFormCabecera({...formCabecera, prioridad: p})}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title"><CreditCard size={20} /> Pago y Entrega</h2>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="form-label">Plazo de Pago *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: Contado, 30 días"
                    value={formCabecera.plazo_pago}
                    onChange={(e) => setFormCabecera({...formCabecera, plazo_pago: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Forma de Pago</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: Transferencia"
                    value={formCabecera.forma_pago}
                    onChange={(e) => setFormCabecera({...formCabecera, forma_pago: e.target.value})}
                  />
                </div>
                <div>
                  <label className="form-label">Dirección Entrega</label>
                  <textarea 
                    className="form-textarea" 
                    rows="2"
                    value={formCabecera.direccion_entrega}
                    onChange={(e) => setFormCabecera({...formCabecera, direccion_entrega: e.target.value})}
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="card bg-gray-50 border-t-4 border-primary">
              <div className="card-body space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sub Total:</span>
                  <span className="font-bold">{formatearMoneda(totales.subtotal)}</span>
                </div>
                {totales.totalComisiones > 0 && (
                  <div className="flex justify-between text-sm text-yellow-700">
                    <span>Comisiones:</span>
                    <span className="font-bold">{formatearMoneda(totales.totalComisiones)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>
                    {TIPOS_IMPUESTO.find(t => t.codigo === formCabecera.tipo_impuesto)?.nombre} ({formCabecera.porcentaje_impuesto}%):
                  </span>
                  <span className="font-bold">{formatearMoneda(totales.impuesto)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-2 border-t mt-2 text-primary">
                  <span>TOTAL:</span>
                  <span>{formatearMoneda(totales.total)}</span>
                </div>
                <button 
                  type="submit" 
                  className="btn btn-primary w-full py-3 mt-4 text-lg shadow-lg shadow-primary/20"
                  disabled={loading || !clienteSeleccionado || detalle.length === 0}
                >
                  <Save size={20} /> {modoEdicion ? 'Actualizar Orden' : 'Guardar Orden'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Modales */}
      <Modal isOpen={modalClienteOpen} onClose={() => setModalClienteOpen(false)} title="Seleccionar Cliente" size="lg">
        <div className="mb-4">
          <input
            type="text"
            className="form-input"
            placeholder="Buscar cliente..."
            value={busquedaCliente}
            onChange={(e) => setBusquedaCliente(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {clientesFiltrados.map(c => (
            <div key={c.id_cliente} className="p-3 border rounded hover:bg-gray-50 cursor-pointer" onClick={() => handleSelectCliente(c)}>
              <div className="font-bold">{c.razon_social}</div>
              <div className="text-sm text-muted">{c.ruc}</div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal isOpen={modalProductoOpen} onClose={() => setModalProductoOpen(false)} title="Agregar Producto" size="lg">
        <div className="mb-4">
          <input
            type="text"
            className="form-input"
            placeholder="Buscar producto..."
            value={busquedaProducto}
            onChange={(e) => setBusquedaProducto(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {productosFiltrados.map(p => (
            <div key={p.id_producto} className="p-3 border rounded hover:bg-gray-50 cursor-pointer flex justify-between" onClick={() => handleAgregarProducto(p)}>
              <div>
                <div className="font-bold">{p.nombre}</div>
                <div className="text-sm text-muted">{p.codigo}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-primary">{formatearMoneda(p.precio_venta)}</div>
                <div className="text-xs text-muted">Stock: {parseFloat(p.stock_actual).toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default NuevaOrdenVenta;