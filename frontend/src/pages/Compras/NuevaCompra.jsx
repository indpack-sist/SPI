import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, ShoppingCart, Building, Calendar,
  MapPin, Plus, Trash2, Search, AlertCircle, Wallet, CreditCard
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { 
  comprasAPI, proveedoresAPI, productosAPI, cuentasPagoAPI 
} from '../../config/api';

function NuevaCompra() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cuentasPago, setCuentasPago] = useState([]);
  
  const [modalProveedorOpen, setModalProveedorOpen] = useState(false);
  const [modalProductoOpen, setModalProductoOpen] = useState(false);
  
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  
  const [formData, setFormData] = useState({
    id_proveedor: '',
    id_cuenta_pago: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_entrega_estimada: '',
    prioridad: 'Media',
    moneda: 'PEN',
    tipo_compra: 'Contado',
    numero_cuotas: 0,
    dias_entre_cuotas: 30,
    dias_credito: 0,
    fecha_primera_cuota: '',
    tipo_impuesto: 'IGV',
    porcentaje_impuesto: 18.00,
    observaciones: '',
    contacto_proveedor: '',
    direccion_entrega: 'AV. EL SOL LT. 4 B MZ. LL-1 COO. LAS VERTIENTES'
  });
  
  const [detalle, setDetalle] = useState([]);
  const [totales, setTotales] = useState({ subtotal: 0, igv: 0, total: 0 });

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    calcularTotales();
  }, [detalle, formData.porcentaje_impuesto, formData.tipo_impuesto]);

  useEffect(() => {
    if (formData.id_cuenta_pago) {
      const cuenta = cuentasPago.find(c => c.id_cuenta === parseInt(formData.id_cuenta_pago));
      setCuentaSeleccionada(cuenta);
    } else {
      setCuentaSeleccionada(null);
    }
  }, [formData.id_cuenta_pago, cuentasPago]);

  const cargarCatalogos = async () => {
    try {
      setLoading(true);
      
      const [resProveedores, resProductos, resCuentas] = await Promise.all([
        proveedoresAPI.getAll({ estado: 'Activo' }),
        productosAPI.getAll({ 
          estado: 'Activo',
          id_tipo_inventario: '1,2,4'
        }),
        cuentasPagoAPI.getAll({ estado: 'Activo' })
      ]);
      
      if (resProveedores.data.success) {
        setProveedores(resProveedores.data.data || []);
      }
      
      if (resProductos.data.success) {
        setProductos(resProductos.data.data || []);
      }

      if (resCuentas.data.success) {
        setCuentasPago(resCuentas.data.data || []);
      }
      
    } catch (err) {
      console.error('Error al cargar catálogos:', err);
      setError('Error al cargar catálogos: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProveedor = (proveedor) => {
    setProveedorSeleccionado(proveedor);
    setFormData({
      ...formData,
      id_proveedor: proveedor.id_proveedor,
      contacto_proveedor: proveedor.contacto || ''
    });
    setModalProveedorOpen(false);
  };

  const handleSelectProducto = (producto) => {
    const existe = detalle.find(d => d.id_producto === producto.id_producto);
    if (existe) {
      setError('Este producto ya está en la lista');
      return;
    }
    
    const nuevoItem = {
      id_producto: producto.id_producto,
      codigo_producto: producto.codigo,
      producto: producto.nombre,
      unidad_medida: producto.unidad_medida,
      cantidad: 1.00,
      precio_unitario: 0.00,
      descuento_porcentaje: 0.00
    };
    
    setDetalle([...detalle, nuevoItem]);
    setModalProductoOpen(false);
  };

  const handleCantidadChange = (index, cantidad) => {
    const newDetalle = [...detalle];
    newDetalle[index].cantidad = parseFloat(cantidad) || 0;
    setDetalle(newDetalle);
  };

  const handlePrecioChange = (index, precio) => {
    const newDetalle = [...detalle];
    newDetalle[index].precio_unitario = parseFloat(precio) || 0;
    setDetalle(newDetalle);
  };

  const handleDescuentoChange = (index, descuento) => {
    const newDetalle = [...detalle];
    newDetalle[index].descuento_porcentaje = parseFloat(descuento) || 0;
    setDetalle(newDetalle);
  };

  const handleEliminarProducto = (index) => {
    const newDetalle = detalle.filter((_, i) => i !== index);
    setDetalle(newDetalle);
  };

  const calcularSubtotalItem = (item) => {
    const base = item.cantidad * item.precio_unitario;
    const descuento = base * (item.descuento_porcentaje / 100);
    return base - descuento;
  };

  const calcularTotales = () => {
    const subtotal = detalle.reduce((sum, item) => sum + calcularSubtotalItem(item), 0);
    let porcentaje = 18.00;
    
    if (formData.tipo_impuesto === 'EXO' || formData.tipo_impuesto === 'INA') {
      porcentaje = 0.00;
    } else if (formData.porcentaje_impuesto) {
      porcentaje = parseFloat(formData.porcentaje_impuesto);
    }
    
    const igv = subtotal * (porcentaje / 100);
    const total = subtotal + igv;
    setTotales({ subtotal, igv, total });
  };

  const handleTipoCompraChange = (tipo) => {
    setFormData({
      ...formData,
      tipo_compra: tipo,
      numero_cuotas: tipo === 'Credito' ? 1 : 0,
      dias_credito: tipo === 'Credito' ? 30 : 0,
      dias_entre_cuotas: tipo === 'Credito' ? 30 : 0,
      fecha_primera_cuota: tipo === 'Credito' ? '' : ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!formData.id_proveedor) {
      setError('Debe seleccionar un proveedor');
      return;
    }

    if (!formData.id_cuenta_pago) {
      setError('Debe seleccionar una cuenta de pago');
      return;
    }
    
    if (detalle.length === 0) {
      setError('Debe agregar al menos un producto');
      return;
    }
    
    const invalidos = detalle.filter(item => 
      parseFloat(item.cantidad) <= 0 || parseFloat(item.precio_unitario) <= 0
    );
    
    if (invalidos.length > 0) {
      setError('Todos los productos deben tener cantidad y precio mayores a 0');
      return;
    }

    if (formData.tipo_compra === 'Credito' && formData.numero_cuotas <= 0) {
      setError('El número de cuotas debe ser mayor a 0 para compras a crédito');
      return;
    }
    
    try {
      setLoading(true);
      
      const payload = {
        id_proveedor: parseInt(formData.id_proveedor),
        id_cuenta_pago: parseInt(formData.id_cuenta_pago),
        fecha_emision: formData.fecha_emision,
        fecha_entrega_estimada: formData.fecha_entrega_estimada || null,
        prioridad: formData.prioridad,
        moneda: formData.moneda,
        tipo_compra: formData.tipo_compra,
        numero_cuotas: formData.tipo_compra === 'Credito' ? parseInt(formData.numero_cuotas) : 0,
        dias_entre_cuotas: formData.tipo_compra === 'Credito' ? parseInt(formData.dias_entre_cuotas) : 0,
        dias_credito: formData.tipo_compra === 'Credito' ? parseInt(formData.dias_credito) : 0,
        fecha_primera_cuota: formData.tipo_compra === 'Credito' && formData.fecha_primera_cuota ? formData.fecha_primera_cuota : null,
        tipo_impuesto: formData.tipo_impuesto,
        porcentaje_impuesto: parseFloat(formData.porcentaje_impuesto),
        observaciones: formData.observaciones,
        contacto_proveedor: formData.contacto_proveedor || null,
        direccion_entrega: formData.direccion_entrega || null,
        detalle: detalle.map(item => ({
          id_producto: item.id_producto,
          cantidad: parseFloat(item.cantidad),
          precio_unitario: parseFloat(item.precio_unitario),
          descuento_porcentaje: parseFloat(item.descuento_porcentaje)
        }))
      };
      
      const response = await comprasAPI.create(payload);
      
      if (response.data.success) {
        setSuccess(`Compra ${response.data.data.numero_orden} creada exitosamente`);
        setTimeout(() => {
          navigate('/compras');
        }, 1500);
      } else {
        setError(response.data.error || 'Error al crear compra');
      }
      
    } catch (err) {
      console.error('Error al crear compra:', err);
      setError(err.response?.data?.error || 'Error al crear compra');
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
          onClick={() => navigate('/compras')}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart size={32} />
            Nueva Compra
          </h1>
          <p className="text-muted">Crear compra a proveedor</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <form onSubmit={handleSubmit}>
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
                      setFormData({ ...formData, id_proveedor: '', contacto_proveedor: '' });
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
              <div className="form-group">
                <label className="form-label">Contacto del Proveedor</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.contacto_proveedor}
                  onChange={(e) => setFormData({ ...formData, contacto_proveedor: e.target.value })}
                  placeholder="Nombre del contacto"
                />
              </div>
            )}
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <Wallet size={20} />
              Cuenta de Pago
            </h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Seleccionar Cuenta de Pago *</label>
              <select
                className="form-select"
                value={formData.id_cuenta_pago}
                onChange={(e) => setFormData({ ...formData, id_cuenta_pago: e.target.value })}
                required
              >
                <option value="">Seleccionar cuenta...</option>
                {cuentasPago.filter(c => c.moneda === formData.moneda).map(cuenta => (
                  <option key={cuenta.id_cuenta} value={cuenta.id_cuenta}>
                    {cuenta.nombre} - {cuenta.tipo} ({cuenta.moneda}) - Saldo: {formatearMoneda(cuenta.saldo_actual)}
                  </option>
                ))}
              </select>
              <small className="text-muted">
                Solo se muestran cuentas activas con la moneda seleccionada
              </small>
            </div>

            {cuentaSeleccionada && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{cuentaSeleccionada.nombre}</p>
                    <p className="text-sm text-muted">{cuentaSeleccionada.tipo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted">Saldo disponible:</p>
                    <p className="font-bold text-lg text-success">
                      {formatearMoneda(cuentaSeleccionada.saldo_actual)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <Calendar size={20} />
              Datos de la Compra
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="form-group">
                <label className="form-label">Fecha de Emisión *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.fecha_emision}
                  onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Fecha Entrega Estimada</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.fecha_entrega_estimada}
                  onChange={(e) => setFormData({ ...formData, fecha_entrega_estimada: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Prioridad *</label>
                <select
                  className="form-select"
                  value={formData.prioridad}
                  onChange={(e) => setFormData({ ...formData, prioridad: e.target.value })}
                  required
                >
                  <option value="Baja">Baja</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Moneda *</label>
                <select
                  className="form-select"
                  value={formData.moneda}
                  onChange={(e) => setFormData({ ...formData, moneda: e.target.value, id_cuenta_pago: '' })}
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
                  value={formData.tipo_impuesto}
                  onChange={(e) => setFormData({ ...formData, tipo_impuesto: e.target.value })}
                  required
                >
                  <option value="IGV">IGV (18%)</option>
                  <option value="EXO">Exonerado</option>
                  <option value="INA">Inafecto</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <CreditCard size={20} />
              Forma de Pago
            </h2>
          </div>
          <div className="card-body">
            <div className="flex gap-4 mb-4">
              <button
                type="button"
                className={`flex-1 p-4 border-2 rounded-lg transition ${
                  formData.tipo_compra === 'Contado'
                    ? 'border-success bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleTipoCompraChange('Contado')}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Wallet size={24} className={formData.tipo_compra === 'Contado' ? 'text-success' : 'text-muted'} />
                  <span className="font-bold">Contado</span>
                </div>
                <p className="text-sm text-muted">Pago inmediato al crear la compra</p>
              </button>

              <button
                type="button"
                className={`flex-1 p-4 border-2 rounded-lg transition ${
                  formData.tipo_compra === 'Credito'
                    ? 'border-warning bg-yellow-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleTipoCompraChange('Credito')}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CreditCard size={24} className={formData.tipo_compra === 'Credito' ? 'text-warning' : 'text-muted'} />
                  <span className="font-bold">Crédito</span>
                </div>
                <p className="text-sm text-muted">Pago en cuotas</p>
              </button>
            </div>

            {formData.tipo_compra === 'Credito' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-bold mb-3">Configuración de Cuotas</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Número de Cuotas *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.numero_cuotas}
                      onChange={(e) => setFormData({ ...formData, numero_cuotas: e.target.value })}
                      min="1"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Días entre Cuotas *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.dias_entre_cuotas}
                      onChange={(e) => setFormData({ ...formData, dias_entre_cuotas: e.target.value })}
                      min="1"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Días de Crédito Total</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.dias_credito}
                      onChange={(e) => setFormData({ ...formData, dias_credito: e.target.value })}
                      min="0"
                    />
                    <small className="text-muted">Opcional: Plazo total del crédito</small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fecha Primera Cuota</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.fecha_primera_cuota}
                      onChange={(e) => setFormData({ ...formData, fecha_primera_cuota: e.target.value })}
                    />
                    <small className="text-muted">Opcional: Si no se indica, se calcula automáticamente</small>
                  </div>
                </div>
              </div>
            )}

            {formData.tipo_compra === 'Contado' && cuentaSeleccionada && totales.total > 0 && (
              <div className={`p-3 rounded-lg border ${
                cuentaSeleccionada.saldo_actual >= totales.total
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {cuentaSeleccionada.saldo_actual >= totales.total ? (
                    <>
                      <AlertCircle className="text-success" size={20} />
                      <p className="text-success font-medium">
                        Saldo suficiente para realizar la compra
                      </p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="text-danger" size={20} />
                      <p className="text-danger font-medium">
                        Saldo insuficiente. Falta: {formatearMoneda(totales.total - cuentaSeleccionada.saldo_actual)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h2 className="card-title">
                <MapPin size={20} />
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
                      <th style={{ width: '120px' }}>Precio *</th>
                      <th style={{ width: '100px' }}>Desc. %</th>
                      <th style={{ width: '120px' }}>Subtotal</th>
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
                            step="0.01"
                            required
                          />
                        </td>
                        <td className="text-sm text-muted text-center">{item.unidad_medida}</td>
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
                        <td className="text-right font-bold text-primary">
                          {formatearMoneda(calcularSubtotalItem(item))}
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
                </table>
              </div>
            ) : (
              <p className="text-center text-muted py-4">
                No hay productos agregados
              </p>
            )}
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Dirección de Entrega</label>
              <textarea
                className="form-textarea"
                value={formData.direccion_entrega}
                onChange={(e) => setFormData({ ...formData, direccion_entrega: e.target.value })}
                rows={2}
                placeholder="Dirección de entrega..."
              />
            </div>
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

        <div className="card mb-4">
          <div className="card-body">
            <div className="flex justify-end">
              <div className="w-80">
                <div className="flex justify-between py-2">
                  <span className="font-medium">Subtotal:</span>
                  <span className="font-bold">{formatearMoneda(totales.subtotal)}</span>
                </div>
                <div className="flex justify-between py-2 border-t">
                  <span className="font-medium">{formData.tipo_impuesto} ({formData.porcentaje_impuesto}%):</span>
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

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/compras')}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            <Save size={20} />
            {loading ? 'Guardando...' : 'Crear Compra'}
          </button>
        </div>
      </form>

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
              <div className="text-sm text-muted">{prov.direccion}</div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={modalProductoOpen}
        onClose={() => setModalProductoOpen(false)}
        title="Seleccionar Producto"
        size="lg"
      >
        <div className="space-y-3">
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

export default NuevaCompra;