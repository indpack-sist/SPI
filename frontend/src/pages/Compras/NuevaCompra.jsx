import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, ShoppingCart, Building, Calendar,
  MapPin, Plus, Trash2, Search, AlertCircle, Wallet, CreditCard, Clock,
  Calculator, DollarSign, ArrowRightLeft, PackagePlus, UserPlus, Loader, FileText,
  Receipt, User, CheckCircle
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { 
  comprasAPI, proveedoresAPI, productosAPI, cuentasPagoAPI, empleadosAPI
} from '../../config/api';

function NuevaCompra() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cuentasPago, setCuentasPago] = useState([]);
  const [tiposInventario, setTiposInventario] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  
  const [modalProveedorOpen, setModalProveedorOpen] = useState(false);
  const [modalProductoOpen, setModalProductoOpen] = useState(false);
  const [modalCrearProveedorOpen, setModalCrearProveedorOpen] = useState(false);
  const [modalCrearProductoOpen, setModalCrearProductoOpen] = useState(false);
  const [buscandoRuc, setBuscandoRuc] = useState(false);

  const [busquedaProveedor, setBusquedaProveedor] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  const [requiereConversion, setRequiereConversion] = useState(false);
  
  const [formData, setFormData] = useState({
    id_proveedor: '',
    id_cuenta_pago: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_entrega_estimada: '',
    fecha_vencimiento: '', 
    prioridad: 'Media',
    moneda: 'PEN',
    tipo_cambio: '',
    tipo_compra: 'Contado',
    forma_pago_detalle: 'Contado',
    numero_cuotas: 1,
    dias_entre_cuotas: 30,
    dias_credito: 0,
    fecha_primera_cuota: '',
    tipo_impuesto: 'IGV',
    porcentaje_impuesto: 18.00,
    observaciones: '',
    contacto_proveedor: '',
    direccion_entrega: '',
    tipo_recepcion: 'Total',
    tipo_documento: 'Factura',
    serie_documento: '',
    numero_documento: '',
    fecha_emision_documento: new Date().toISOString().split('T')[0],
    monto_pagado_inicial: 0,
    usa_fondos_propios: false,
    id_comprador: '',
    letras_pendientes_registro: false
  });

  const [formNuevoProveedor, setFormNuevoProveedor] = useState({
    ruc: '', razon_social: '', direccion: '', contacto: '', telefono: '', email: '', terminos_pago: 'Contado'
  });

  const [formNuevoProducto, setFormNuevoProducto] = useState({
    codigo: '', nombre: '', descripcion: '', id_tipo_inventario: '', id_categoria: '', unidad_medida: 'UND', stock_minimo: 0, requiere_receta: false
  });
  
  const [detalle, setDetalle] = useState([]);
  const [totales, setTotales] = useState({ subtotal: 0, igv: 0, total: 0 });
  const [cronograma, setCronograma] = useState([]);

  const proveedoresFiltrados = proveedores.filter(p => 
    p.razon_social.toLowerCase().includes(busquedaProveedor.toLowerCase()) || 
    p.ruc.includes(busquedaProveedor)
  );

  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) || 
    p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
  );

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    calcularTotales();
  }, [detalle, formData.porcentaje_impuesto, formData.tipo_impuesto]);

  useEffect(() => {
    if (formData.forma_pago_detalle === 'Contado' && !formData.usa_fondos_propios) {
      setFormData(prev => ({ ...prev, monto_pagado_inicial: totales.total }));
    }
  }, [totales.total, formData.forma_pago_detalle, formData.usa_fondos_propios]);

  useEffect(() => {
    if (formData.tipo_compra === 'Credito' && formData.forma_pago_detalle === 'Credito') {
      calcularCronograma();
    }
  }, [formData.tipo_compra, formData.forma_pago_detalle, formData.numero_cuotas, formData.dias_entre_cuotas, formData.fecha_emision, formData.fecha_primera_cuota, totales.total]);

  useEffect(() => {
    if (formData.id_cuenta_pago) {
      const cuenta = cuentasPago.find(c => c.id_cuenta === parseInt(formData.id_cuenta_pago));
      setCuentaSeleccionada(cuenta);
      
      if (cuenta) {
        const necesitaConversion = cuenta.moneda !== formData.moneda && formData.moneda;
        setRequiereConversion(necesitaConversion);
        
        if (!necesitaConversion) {
          setFormData(prev => ({ ...prev, tipo_cambio: '' }));
        }
      }
    } else {
      setCuentaSeleccionada(null);
      setRequiereConversion(false);
    }
  }, [formData.id_cuenta_pago, formData.moneda, cuentasPago]);

  const cargarCatalogos = async () => {
    try {
      setLoading(true);
      const [resProveedores, resProductos, resCuentas, resTiposInv, resCategorias, resEmpleados] = await Promise.all([
        proveedoresAPI.getAll({ estado: 'Activo' }),
        productosAPI.getAll({ estado: 'Activo', id_tipo_inventario: '1,2,4,5,6' }),
        cuentasPagoAPI.getAll({ estado: 'Activo' }),
        productosAPI.getTiposInventario(),
        productosAPI.getCategorias(),
        empleadosAPI.getAll({ estado: 'Activo' })
      ]);
      
      if (resProveedores.data.success) setProveedores(resProveedores.data.data || []);
      if (resProductos.data.success) setProductos(resProductos.data.data || []);
      if (resCuentas.data.success) setCuentasPago(resCuentas.data.data || []);
      if (resTiposInv.data.success) setTiposInventario(resTiposInv.data.data || []);
      if (resCategorias.data.success) setCategorias(resCategorias.data.data || []);
      if (resEmpleados.data.success) setEmpleados(resEmpleados.data.data || []);
      
    } catch (err) {
      console.error(err);
      setError('Error al cargar catálogos: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarRUC = async () => {
    if (formNuevoProveedor.ruc.length !== 11) { setError('El RUC debe tener 11 dígitos'); return; }
    try {
      setBuscandoRuc(true); setError(null);
      const response = await proveedoresAPI.validarRUC(formNuevoProveedor.ruc);
      if (response.data.success) {
        if (response.data.ya_registrado) setError('ATENCIÓN: Este RUC ya está registrado.');
        const datos = response.data.datos;
        setFormNuevoProveedor(prev => ({ ...prev, razon_social: datos.razon_social || '', direccion: datos.direccion || prev.direccion, estado: datos.estado }));
        if (!response.data.ya_registrado) setSuccess('Datos encontrados en SUNAT');
      }
    } catch (err) { setError('Error al validar RUC: ' + (err.response?.data?.error || err.message)); } finally { setBuscandoRuc(false); }
  };

  const handleGuardarNuevoProveedor = async (e) => {
    e.preventDefault();
    try {
        setLoading(true);
        const response = await proveedoresAPI.create(formNuevoProveedor);
        if (response.data.success) {
            const nuevoProv = { id_proveedor: response.data.data.id_proveedor, ...formNuevoProveedor };
            setProveedores([...proveedores, nuevoProv]);
            handleSelectProveedor(nuevoProv);
            setModalCrearProveedorOpen(false);
            setFormNuevoProveedor({ ruc: '', razon_social: '', direccion: '', contacto: '', telefono: '', email: '', terminos_pago: 'Contado' });
            setSuccess('Proveedor creado y seleccionado');
        }
    } catch (err) { setError(err.response?.data?.error || 'Error al crear proveedor'); } finally { setLoading(false); }
  };

  const handleGuardarNuevoProducto = async (e) => {
    e.preventDefault();
    try {
        setLoading(true);
        const response = await productosAPI.create(formNuevoProducto);
        if (response.data.success) {
            const nuevoProd = { id_producto: response.data.data.id_producto, stock_actual: 0, ...formNuevoProducto };
            setProductos([...productos, nuevoProd]);
            handleSelectProducto(nuevoProd);
            setModalCrearProductoOpen(false);
            setFormNuevoProducto({ codigo: '', nombre: '', descripcion: '', id_tipo_inventario: '', id_categoria: '', unidad_medida: 'UND', stock_minimo: 0, requiere_receta: false });
            setSuccess('Producto creado y agregado');
        }
    } catch (err) { setError(err.response?.data?.error || 'Error al crear producto'); } finally { setLoading(false); }
  };

  const handleSelectProveedor = (proveedor) => {
    setProveedorSeleccionado(proveedor);
    setFormData({ ...formData, id_proveedor: proveedor.id_proveedor, contacto_proveedor: proveedor.contacto || '' });
    setModalProveedorOpen(false); setBusquedaProveedor('');
  };

  const handleSelectProducto = (producto) => {
    const existe = detalle.find(d => d.id_producto === producto.id_producto);
    if (existe) { setError('Producto ya en lista'); return; }
    const nuevoItem = {
      id_producto: producto.id_producto, codigo_producto: producto.codigo, producto: producto.nombre,
      unidad_medida: producto.unidad_medida, cantidad: 1.00, cantidad_a_recibir: 1.00, precio_unitario: 0.00, descuento_porcentaje: 0.00
    };
    setDetalle([...detalle, nuevoItem]); setModalProductoOpen(false); setBusquedaProducto('');
  };

  const handleCantidadChange = (index, cantidad) => {
    const newDetalle = [...detalle]; const val = parseFloat(cantidad) || 0;
    newDetalle[index].cantidad = val; newDetalle[index].cantidad_a_recibir = val;
    setDetalle(newDetalle);
  };

  const handleCantidadRecibirChange = (index, cantidad) => {
    const newDetalle = [...detalle]; newDetalle[index].cantidad_a_recibir = parseFloat(cantidad) || 0;
    setDetalle(newDetalle);
  };

  const handlePrecioChange = (index, precio) => {
    const newDetalle = [...detalle]; newDetalle[index].precio_unitario = parseFloat(precio) || 0;
    setDetalle(newDetalle);
  };

  const handleDescuentoChange = (index, descuento) => {
    const newDetalle = [...detalle]; newDetalle[index].descuento_porcentaje = parseFloat(descuento) || 0;
    setDetalle(newDetalle);
  };

  const handleEliminarProducto = (index) => {
    const newDetalle = detalle.filter((_, i) => i !== index);
    setDetalle(newDetalle);
  };

  const calcularSubtotalItem = (item) => {
    const base = item.cantidad * item.precio_unitario;
    return base - (base * (item.descuento_porcentaje / 100));
  };

  const calcularTotales = () => {
    const subtotal = detalle.reduce((sum, item) => sum + calcularSubtotalItem(item), 0);
    let porcentaje = 18.00;
    if (formData.tipo_impuesto === 'EXO' || formData.tipo_impuesto === 'INA') porcentaje = 0.00;
    else if (formData.porcentaje_impuesto) porcentaje = parseFloat(formData.porcentaje_impuesto);
    const igv = subtotal * (porcentaje / 100);
    const total = subtotal + igv;
    setTotales({ subtotal, igv, total });
  };

  const calcularCronograma = () => {
    if (totales.total <= 0) return;
    const numCuotas = parseInt(formData.numero_cuotas) || 1;
    const diasEntre = parseInt(formData.dias_entre_cuotas) || 30;
    const saldoCredito = totales.total - parseFloat(formData.monto_pagado_inicial || 0);
    const montoPorCuota = saldoCredito / numCuotas;
    let fechaBase = new Date(formData.fecha_primera_cuota || formData.fecha_emision);
    
    if (!formData.fecha_primera_cuota) {
        fechaBase = new Date(formData.fecha_emision);
        fechaBase.setDate(fechaBase.getDate() + diasEntre); 
    } else {
        fechaBase = new Date(formData.fecha_primera_cuota + 'T12:00:00');
    }

    const nuevoCronograma = [];
    let ultimaFecha = new Date(fechaBase);

    for (let i = 1; i <= numCuotas; i++) {
        nuevoCronograma.push({ numero: i, fecha: new Date(ultimaFecha), monto: montoPorCuota });
        ultimaFecha.setDate(ultimaFecha.getDate() + diasEntre);
    }
    setCronograma(nuevoCronograma);

    if (nuevoCronograma.length > 0) {
        const fechaFinal = nuevoCronograma[nuevoCronograma.length - 1].fecha;
        const emision = new Date(formData.fecha_emision);
        const diffTime = Math.abs(fechaFinal - emision);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        setFormData(prev => ({ ...prev, fecha_vencimiento: fechaFinal.toISOString().split('T')[0], dias_credito: diffDays }));
    }
  };

  const handleFormaPagoChange = (forma) => {
    const esContado = forma === 'Contado';
    const esCredito = forma === 'Credito';
    const esLetras = forma === 'Letras';

    setFormData(prev => ({
      ...prev,
      forma_pago_detalle: forma,
      tipo_compra: esLetras ? 'Credito' : (esCredito ? 'Credito' : 'Contado'),
      letras_pendientes_registro: esLetras,
      numero_cuotas: esCredito || esLetras ? 1 : 0,
      dias_credito: esCredito || esLetras ? 30 : 0,
      dias_entre_cuotas: esCredito || esLetras ? 30 : 0,
      fecha_primera_cuota: '',
      monto_pagado_inicial: esContado && !prev.usa_fondos_propios ? totales.total : 0,
      id_cuenta_pago: prev.usa_fondos_propios ? '' : prev.id_cuenta_pago
    }));
  };

  const calcularMontoConversion = () => {
    if (!requiereConversion || !formData.tipo_cambio || !totales.total) return null;
    const tc = parseFloat(formData.tipo_cambio);
    const montoAPagar = parseFloat(formData.monto_pagado_inicial || 0);
    if (cuentaSeleccionada.moneda === 'PEN' && formData.moneda === 'USD') return montoAPagar * tc;
    else if (cuentaSeleccionada.moneda === 'USD' && formData.moneda === 'PEN') return montoAPagar / tc;
    return null;
  };
  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setError(null); 
    setSuccess(null);
    
    if (!formData.id_proveedor) { 
      setError('Seleccione un proveedor'); 
      return; 
    }
    
    if (detalle.length === 0) { 
      setError('Agregue al menos un producto'); 
      return; 
    }
    
    if (!formData.moneda) { 
      setError('Especifique la moneda'); 
      return; 
    }

    if (formData.usa_fondos_propios && !formData.id_comprador) {
      setError('Debe seleccionar al comprador que usó fondos propios');
      return;
    }

    if (!formData.usa_fondos_propios && formData.forma_pago_detalle === 'Contado' && !formData.id_cuenta_pago) {
      setError('Debe seleccionar una cuenta de pago para compras al contado');
      return;
    }

    if (!formData.usa_fondos_propios && parseFloat(formData.monto_pagado_inicial) > 0 && !formData.id_cuenta_pago) {
      setError('Debe seleccionar una cuenta para el adelanto');
      return;
    }

    if (requiereConversion && (!formData.tipo_cambio || parseFloat(formData.tipo_cambio) <= 0)) { 
      setError('Debe especificar el tipo de cambio'); 
      return; 
    }
    
    if (!formData.usa_fondos_propios && parseFloat(formData.monto_pagado_inicial) > 0 && cuentaSeleccionada) {
      const montoRequerido = calcularMontoConversion() || parseFloat(formData.monto_pagado_inicial);
      if (parseFloat(cuentaSeleccionada.saldo_actual) < montoRequerido) {
        setError(`Saldo insuficiente en la cuenta. Disponible: ${formatearMoneda(cuentaSeleccionada.saldo_actual, cuentaSeleccionada.moneda)}`); 
        return;
      }
    }

    const invalidos = detalle.filter(item => parseFloat(item.cantidad) <= 0 || parseFloat(item.precio_unitario) <= 0);
    if (invalidos.length > 0) { 
      setError('Hay productos con cantidades o precios inválidos'); 
      return; 
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        id_proveedor: parseInt(formData.id_proveedor),
        id_cuenta_pago: formData.usa_fondos_propios ? null : (formData.id_cuenta_pago ? parseInt(formData.id_cuenta_pago) : null),
        id_comprador: formData.usa_fondos_propios ? parseInt(formData.id_comprador) : null,
        numero_cuotas: parseInt(formData.numero_cuotas),
        dias_entre_cuotas: parseInt(formData.dias_entre_cuotas),
        dias_credito: parseInt(formData.dias_credito),
        porcentaje_impuesto: parseFloat(formData.porcentaje_impuesto),
        tipo_cambio: requiereConversion ? parseFloat(formData.tipo_cambio) : 1.0,
        monto_pagado_inicial: formData.usa_fondos_propios ? 0 : parseFloat(formData.monto_pagado_inicial || 0),
        usa_fondos_propios: formData.usa_fondos_propios ? 1 : 0,
        detalle: detalle.map(item => ({
          id_producto: item.id_producto,
          cantidad: parseFloat(item.cantidad),
          cantidad_a_recibir: formData.tipo_recepcion === 'Parcial' ? parseFloat(item.cantidad_a_recibir) : parseFloat(item.cantidad),
          precio_unitario: parseFloat(item.precio_unitario),
          descuento_porcentaje: parseFloat(item.descuento_porcentaje)
        }))
      };
      
      const response = await comprasAPI.create(payload);
      if (response.data.success) {
        setSuccess(`Compra ${response.data.data.numero_orden} registrada exitosamente`);
        setTimeout(() => navigate('/compras'), 1500);
      } else {
        setError(response.data.error || 'Error al crear la orden de compra');
      }
    } catch (err) {
      console.error(err); 
      setError(err.response?.data?.error || 'Error al procesar la orden de compra');
    } finally { 
      setLoading(false); 
    }
  };

  const formatearMoneda = (valor, moneda = null) => {
    const monedaUsar = moneda || formData.moneda;
    const simbolo = monedaUsar === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  };

  if (loading && proveedores.length === 0) return <Loading message="Cargando catálogos..." />;
  
  const montoConvertido = calcularMontoConversion();
  const saldoCredito = totales.total - parseFloat(formData.monto_pagado_inicial || 0);

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button className="btn btn-outline" onClick={() => navigate('/compras')}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart size={32} className="text-primary" />
            Nueva Orden de Compra
          </h1>
          <p className="text-muted">Registro de compra y generación de cuenta por pagar</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <div className="card-header bg-gray-50/50">
                <h2 className="card-title flex items-center gap-2">
                  <Building size={18} /> Datos del Proveedor
                </h2>
              </div>
              <div className="card-body">
                {proveedorSeleccionado ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-lg text-blue-900">{proveedorSeleccionado.razon_social}</p>
                      <p className="text-sm text-blue-700">RUC: {proveedorSeleccionado.ruc}</p>
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline bg-white" 
                      onClick={() => { 
                        setProveedorSeleccionado(null); 
                        setFormData({ ...formData, id_proveedor: '', contacto_proveedor: '' }); 
                      }}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <button 
                    type="button" 
                    className="btn btn-primary w-full py-3 border-dashed border-2" 
                    onClick={() => setModalProveedorOpen(true)}
                  >
                    <Search size={20} /> Seleccionar Proveedor
                  </button>
                )}
                {proveedorSeleccionado && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label text-xs">Contacto</label>
                      <input 
                        type="text" 
                        className="form-input form-input-sm" 
                        value={formData.contacto_proveedor} 
                        onChange={(e) => setFormData({ ...formData, contacto_proveedor: e.target.value })} 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label text-xs">Fecha Emisión</label>
                      <input 
                        type="date" 
                        className="form-input form-input-sm" 
                        value={formData.fecha_emision} 
                        onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })} 
                        required 
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header bg-gray-50/50">
                <h2 className="card-title flex items-center gap-2">
                  <FileText size={18} /> Documento Físico
                </h2>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="form-group">
                    <label className="form-label text-xs">Tipo Documento</label>
                    <select 
                      className="form-select form-input-sm" 
                      value={formData.tipo_documento} 
                      onChange={(e) => setFormData({ ...formData, tipo_documento: e.target.value })}
                    >
                      <option value="Factura">Factura</option>
                      <option value="Boleta">Boleta</option>
                      <option value="Guia">Guía</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label text-xs">Serie</label>
                    <input 
                      type="text" 
                      className="form-input form-input-sm" 
                      value={formData.serie_documento} 
                      onChange={(e) => setFormData({ ...formData, serie_documento: e.target.value.toUpperCase() })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label text-xs">Número</label>
                    <input 
                      type="text" 
                      className="form-input form-input-sm" 
                      value={formData.numero_documento} 
                      onChange={(e) => setFormData({ ...formData, numero_documento: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label text-xs">Fecha Doc.</label>
                    <input 
                      type="date" 
                      className="form-input form-input-sm" 
                      value={formData.fecha_emision_documento} 
                      onChange={(e) => setFormData({ ...formData, fecha_emision_documento: e.target.value })} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {proveedorSeleccionado && (
              <div className="card">
                <div className="card-header bg-gray-50/50">
                  <h2 className="card-title flex items-center gap-2">
                    <DollarSign size={18} /> Moneda de la Operación
                  </h2>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button" 
                      className={`p-4 border rounded-lg text-center transition ${formData.moneda === 'PEN' ? 'bg-green-50 border-green-500 text-green-700 ring-2 ring-green-500' : 'hover:bg-gray-50'}`} 
                      onClick={() => setFormData({...formData, moneda: 'PEN'})}
                    >
                      <div className="font-bold text-xl">S/</div>
                      <span className="font-bold">Soles</span>
                    </button>
                    <button 
                      type="button" 
                      className={`p-4 border rounded-lg text-center transition ${formData.moneda === 'USD' ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500' : 'hover:bg-gray-50'}`} 
                      onClick={() => setFormData({...formData, moneda: 'USD'})}
                    >
                      <div className="font-bold text-xl">$</div>
                      <span className="font-bold">Dólares</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {formData.moneda && (
              <div className="card">
                <div className="card-header bg-gray-50/50 flex justify-between items-center">
                  <h2 className="card-title flex items-center gap-2">
                    <PackagePlus size={18} /> Detalle de Productos
                  </h2>
                  <div className="flex gap-2">
                    <select 
                      className="form-select text-xs w-32" 
                      value={formData.tipo_recepcion} 
                      onChange={(e) => setFormData({...formData, tipo_recepcion: e.target.value})}
                    >
                      <option value="Total">Recepción Total</option>
                      <option value="Parcial">Recepción Parcial</option>
                      <option value="Ninguna">Solo Orden</option>
                    </select>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-primary" 
                      onClick={() => setModalProductoOpen(true)}
                    >
                      <Plus size={16} /> Agregar
                    </button>
                  </div>
                </div>
                <div className="card-body p-0">
                  {detalle.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="w-12 text-center">#</th>
                            <th>Producto</th>
                            <th className="w-24 text-right">Cant.</th>
                            {formData.tipo_recepcion === 'Parcial' && (
                              <th className="w-24 text-right bg-blue-50 text-blue-800">Recibir</th>
                            )}
                            <th className="w-28 text-right">Precio</th>
                            <th className="w-20 text-center">Desc%</th>
                            <th className="w-28 text-right">Total</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalle.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="text-center text-muted text-xs">{index + 1}</td>
                              <td>
                                <div className="font-medium text-sm">{item.producto}</div>
                                <div className="text-[10px] text-muted">{item.codigo_producto}</div>
                              </td>
                              <td>
                                <input 
                                  type="number" 
                                  className="form-input text-right h-8 text-sm" 
                                  value={item.cantidad} 
                                  onChange={(e) => handleCantidadChange(index, e.target.value)} 
                                  min="0" 
                                  step="0.01" 
                                />
                              </td>
                              {formData.tipo_recepcion === 'Parcial' && (
                                <td className="bg-blue-50/30">
                                  <input 
                                    type="number" 
                                    className="form-input text-right h-8 text-sm border-blue-300" 
                                    value={item.cantidad_a_recibir} 
                                    onChange={(e) => handleCantidadRecibirChange(index, e.target.value)} 
                                    min="0" 
                                    max={item.cantidad} 
                                    step="0.01" 
                                  />
                                </td>
                              )}
                              <td>
                                <input 
                                  type="number" 
                                  className="form-input text-right h-8 text-sm" 
                                  value={item.precio_unitario} 
                                  onChange={(e) => handlePrecioChange(index, e.target.value)} 
                                  min="0" 
                                  step="0.01" 
                                />
                              </td>
                              <td>
                                <input 
                                  type="number" 
                                  className="form-input text-center h-8 text-sm" 
                                  value={item.descuento_porcentaje} 
                                  onChange={(e) => handleDescuentoChange(index, e.target.value)} 
                                  min="0" 
                                  max="100" 
                                />
                              </td>
                              <td className="text-right font-bold text-gray-700">
                                {formatearMoneda(calcularSubtotalItem(item))}
                              </td>
                              <td className="text-center">
                                <button 
                                  type="button" 
                                  className="text-red-500 hover:bg-red-50 p-1 rounded" 
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
                    <div className="p-8 text-center text-muted border-dashed border-2 m-4 rounded-lg">
                      <ShoppingCart size={40} className="mx-auto mb-2 opacity-20" />
                      <p>No hay productos agregados</p>
                    </div>
                  )}
                  
                  <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <div className="w-64 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Subtotal:</span>
                        <span>{formatearMoneda(totales.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <select 
                          className="bg-transparent border-none p-0 text-sm font-medium text-muted cursor-pointer" 
                          value={formData.tipo_impuesto} 
                          onChange={(e) => setFormData({...formData, tipo_impuesto: e.target.value})}
                        >
                          <option value="IGV">IGV (18%)</option>
                          <option value="EXO">Exonerado</option>
                          <option value="INA">Inafecto</option>
                        </select>
                        <span>{formatearMoneda(totales.igv)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold text-primary pt-2 border-t">
                        <span>Total:</span>
                        <span>{formatearMoneda(totales.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          const handleSubmit = async (e) => {
    e.preventDefault(); setError(null); setSuccess(null);
    
    if (!formData.id_proveedor) { setError('Seleccione proveedor'); return; }
    if (detalle.length === 0) { setError('Agregue productos'); return; }
    if (!formData.moneda) { setError('Especifique moneda'); return; }
    
    if (formData.usa_fondos_propios && !formData.id_comprador) {
      setError('Debe seleccionar al comprador que usó fondos propios');
      return;
    }

    if (!formData.usa_fondos_propios && formData.forma_pago_detalle === 'Contado' && !formData.id_cuenta_pago) {
      setError('Debe seleccionar una cuenta de pago para Contado');
      return;
    }

    if (!formData.usa_fondos_propios && parseFloat(formData.monto_pagado_inicial) > 0 && !formData.id_cuenta_pago) {
      setError('Debe seleccionar una cuenta para el adelanto');
      return;
    }
    
    if (requiereConversion && (!formData.tipo_cambio || parseFloat(formData.tipo_cambio) <= 0)) { 
      setError('Falta tipo de cambio'); 
      return; 
    }
    
    if (!formData.usa_fondos_propios && parseFloat(formData.monto_pagado_inicial) > 0 && cuentaSeleccionada && cuentaSeleccionada.tipo === 'Tarjeta') {
        const montoRequerido = calcularMontoConversion() || parseFloat(formData.monto_pagado_inicial);
        if (parseFloat(cuentaSeleccionada.saldo_actual) < montoRequerido) {
            setError(`Cupo insuficiente en tarjeta. Requerido: ${formatearMoneda(montoRequerido, cuentaSeleccionada.moneda)}`); 
            return;
        }
    }

    const invalidos = detalle.filter(item => parseFloat(item.cantidad) <= 0 || parseFloat(item.precio_unitario) <= 0);
    if (invalidos.length > 0) { setError('Cantidades o precios inválidos'); return; }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        id_proveedor: parseInt(formData.id_proveedor),
        id_cuenta_pago: formData.usa_fondos_propios ? null : (formData.id_cuenta_pago ? parseInt(formData.id_cuenta_pago) : null),
        id_comprador: formData.usa_fondos_propios ? parseInt(formData.id_comprador) : null,
        numero_cuotas: parseInt(formData.numero_cuotas),
        dias_entre_cuotas: parseInt(formData.dias_entre_cuotas),
        dias_credito: parseInt(formData.dias_credito),
        porcentaje_impuesto: parseFloat(formData.porcentaje_impuesto),
        tipo_cambio: requiereConversion ? parseFloat(formData.tipo_cambio) : 1.0,
        monto_pagado_inicial: formData.usa_fondos_propios ? 0 : parseFloat(formData.monto_pagado_inicial || 0),
        usa_fondos_propios: formData.usa_fondos_propios ? 1 : 0,
        detalle: detalle.map(item => ({
          id_producto: item.id_producto,
          cantidad: parseFloat(item.cantidad),
          cantidad_a_recibir: formData.tipo_recepcion === 'Parcial' ? parseFloat(item.cantidad_a_recibir) : parseFloat(item.cantidad),
          precio_unitario: parseFloat(item.precio_unitario),
          descuento_porcentaje: parseFloat(item.descuento_porcentaje)
        }))
      };
      
      const response = await comprasAPI.create(payload);
      if (response.data.success) {
        setSuccess(`Compra ${response.data.data.numero_orden} registrada`);
        setTimeout(() => navigate('/compras'), 1500);
      } else {
        setError(response.data.error || 'Error al crear compra');
      }
    } catch (err) {
      console.error(err); setError(err.response?.data?.error || 'Error al crear compra');
    } finally { setLoading(false); }
  };

  const formatearMoneda = (valor, moneda = null) => {
    const monedaUsar = moneda || formData.moneda;
    const simbolo = monedaUsar === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  };

  if (loading && proveedores.length === 0) return <Loading message="Cargando..." />;
  const montoConvertido = calcularMontoConversion();

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button className="btn btn-outline" onClick={() => navigate('/compras')}><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart size={32} /> Nueva Compra</h1>
          <p className="text-muted">Ingreso de mercadería y cuenta por pagar</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="card">
                    <div className="card-header bg-gray-50/50"><h2 className="card-title flex items-center gap-2"><Building size={18} /> Datos del Proveedor</h2></div>
                    <div className="card-body">
                        {proveedorSeleccionado ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-lg text-blue-900">{proveedorSeleccionado.razon_social}</p>
                                    <p className="text-sm text-blue-700">RUC: {proveedorSeleccionado.ruc}</p>
                                </div>
                                <button type="button" className="btn btn-sm btn-outline bg-white" onClick={() => { setProveedorSeleccionado(null); setFormData({ ...formData, id_proveedor: '', contacto_proveedor: '' }); }}>Cambiar</button>
                            </div>
                        ) : (
                            <button type="button" className="btn btn-primary w-full py-3 border-dashed border-2" onClick={() => setModalProveedorOpen(true)}><Search size={20} /> Seleccionar Proveedor</button>
                        )}
                        {proveedorSeleccionado && (
                            <div className="mt-4 grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label text-xs">Contacto</label>
                                    <input type="text" className="form-input form-input-sm" value={formData.contacto_proveedor} onChange={(e) => setFormData({ ...formData, contacto_proveedor: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label text-xs">Fecha Emisión</label>
                                    <input type="date" className="form-input form-input-sm" value={formData.fecha_emision} onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })} required />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                  <div className="card-header bg-gray-50/50"><h2 className="card-title flex items-center gap-2"><FileText size={18} /> Documento Físico</h2></div>
                  <div className="card-body">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="form-group">
                        <label className="form-label text-xs">Tipo Documento</label>
                        <select className="form-select form-input-sm" value={formData.tipo_documento} onChange={(e) => setFormData({ ...formData, tipo_documento: e.target.value })}>
                          <option value="Factura">Factura</option><option value="Boleta">Boleta</option><option value="Guia">Guía</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label text-xs">Serie</label>
                        <input type="text" className="form-input form-input-sm" value={formData.serie_documento} onChange={(e) => setFormData({ ...formData, serie_documento: e.target.value.toUpperCase() })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label text-xs">Número</label>
                        <input type="text" className="form-input form-input-sm" value={formData.numero_documento} onChange={(e) => setFormData({ ...formData, numero_documento: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label text-xs">Fecha Doc.</label>
                        <input type="date" className="form-input form-input-sm" value={formData.fecha_emision_documento} onChange={(e) => setFormData({ ...formData, fecha_emision_documento: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </div>

                {proveedorSeleccionado && (
                    <div className="card">
                        <div className="card-header bg-gray-50/50"><h2 className="card-title flex items-center gap-2"><DollarSign size={18} /> Moneda</h2></div>
                        <div className="card-body">
                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" className={`p-4 border rounded-lg text-center transition ${formData.moneda === 'PEN' ? 'bg-green-50 border-green-500 text-green-700 ring-2 ring-green-500' : 'hover:bg-gray-50'}`} onClick={() => setFormData({...formData, moneda: 'PEN'})}>
                                    <div className="font-bold text-xl">S/</div><span className="font-bold">Soles</span>
                                </button>
                                <button type="button" className={`p-4 border rounded-lg text-center transition ${formData.moneda === 'USD' ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500' : 'hover:bg-gray-50'}`} onClick={() => setFormData({...formData, moneda: 'USD'})}>
                                    <div className="font-bold text-xl">$</div><span className="font-bold">Dólares</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {formData.moneda && (
                    <div className="card">
                        <div className="card-header bg-gray-50/50 flex justify-between items-center">
                            <h2 className="card-title flex items-center gap-2"><MapPin size={18} /> Detalle Productos</h2>
                            <div className="flex gap-2">
                                <select className="form-select text-xs w-32" value={formData.tipo_recepcion} onChange={(e) => setFormData({...formData, tipo_recepcion: e.target.value})}>
                                    <option value="Total">Recepción Total</option><option value="Parcial">Recepción Parcial</option><option value="Ninguna">Solo Orden</option>
                                </select>
                                <button type="button" className="btn btn-sm btn-primary" onClick={() => setModalProductoOpen(true)}><Plus size={16} /> Agregar</button>
                            </div>
                        </div>
                        <div className="card-body p-0">
                            {detalle.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="table">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="w-12 text-center">#</th><th>Producto</th><th className="w-24 text-right">Cant.</th>
                                                {formData.tipo_recepcion === 'Parcial' && <th className="w-24 text-right bg-blue-50 text-blue-800">Recibir</th>}
                                                <th className="w-28 text-right">Precio</th><th className="w-20 text-center">Desc%</th><th className="w-28 text-right">Total</th><th className="w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detalle.map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="text-center text-muted text-xs">{index + 1}</td>
                                                    <td><div className="font-medium text-sm">{item.producto}</div><div className="text-[10px] text-muted">{item.codigo_producto}</div></td>
                                                    <td><input type="number" className="form-input text-right h-8 text-sm" value={item.cantidad} onChange={(e) => handleCantidadChange(index, e.target.value)} min="0" step="0.01" /></td>
                                                    {formData.tipo_recepcion === 'Parcial' && <td className="bg-blue-50/30"><input type="number" className="form-input text-right h-8 text-sm border-blue-300" value={item.cantidad_a_recibir} onChange={(e) => handleCantidadRecibirChange(index, e.target.value)} min="0" max={item.cantidad} step="0.01" /></td>}
                                                    <td><input type="number" className="form-input text-right h-8 text-sm" value={item.precio_unitario} onChange={(e) => handlePrecioChange(index, e.target.value)} min="0" step="0.01" /></td>
                                                    <td><input type="number" className="form-input text-center h-8 text-sm" value={item.descuento_porcentaje} onChange={(e) => handleDescuentoChange(index, e.target.value)} min="0" max="100" /></td>
                                                    <td className="text-right font-bold text-gray-700">{formatearMoneda(calcularSubtotalItem(item))}</td>
                                                    <td className="text-center"><button type="button" className="text-red-500 hover:bg-red-50 p-1 rounded" onClick={() => handleEliminarProducto(index)}><Trash2 size={14} /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <div className="p-8 text-center text-muted border-dashed border-2 m-4 rounded-lg"><ShoppingCart size={40} className="mx-auto mb-2 opacity-20" /><p>No hay productos</p></div>}
                            
                            <div className="p-4 bg-gray-50 border-t flex justify-end">
                                <div className="w-64 space-y-1">
                                    <div className="flex justify-between text-sm"><span className="text-muted">Subtotal:</span><span>{formatearMoneda(totales.subtotal)}</span></div>
                                    <div className="flex justify-between text-sm">
                                        <select className="bg-transparent border-none p-0 text-sm font-medium text-muted cursor-pointer" value={formData.tipo_impuesto} onChange={(e) => setFormData({...formData, tipo_impuesto: e.target.value})}>
                                            <option value="IGV">IGV (18%)</option><option value="EXO">Exonerado</option><option value="INA">Inafecto</option>
                                        </select>
                                        <span>{formatearMoneda(totales.igv)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold text-primary pt-2 border-t"><span>Total:</span><span>{formatearMoneda(totales.total)}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-6">
                {detalle.length > 0 && (
                    <>
                        <div className="card">
                            <div className="card-header bg-gray-50/50"><h2 className="card-title flex items-center gap-2"><Wallet size={18} /> Forma de Pago</h2></div>
                            <div className="card-body space-y-4">
                                <div className="grid grid-cols-3 gap-2">
                                    <button type="button" className={`p-3 border rounded-lg text-center transition ${formData.forma_pago_detalle === 'Contado' ? 'bg-green-50 border-green-500 text-green-700 ring-1 ring-green-500' : 'hover:bg-gray-50'}`} onClick={() => handleFormaPagoChange('Contado')}>
                                        <div className="flex flex-col items-center gap-1"><Wallet size={18} /><span className="font-bold text-xs">Contado</span></div>
                                    </button>
                                    <button type="button" className={`p-3 border rounded-lg text-center transition ${formData.forma_pago_detalle === 'Credito' ? 'bg-orange-50 border-orange-500 text-orange-700 ring-1 ring-orange-500' : 'hover:bg-gray-50'}`} onClick={() => handleFormaPagoChange('Credito')}>
                                        <div className="flex flex-col items-center gap-1"><CreditCard size={18} /><span className="font-bold text-xs">Crédito</span></div>
                                    </button>
                                    <button type="button" className={`p-3 border rounded-lg text-center transition ${formData.forma_pago_detalle === 'Letras' ? 'bg-purple-50 border-purple-500 text-purple-700 ring-1 ring-purple-500' : 'hover:bg-gray-50'}`} onClick={() => handleFormaPagoChange('Letras')}>
                                        <div className="flex flex-col items-center gap-1"><Receipt size={18} /><span className="font-bold text-xs">Letras</span></div>
                                    </button>
                                </div>

                                {formData.forma_pago_detalle === 'Contado' && !formData.usa_fondos_propios && (
                                    <>
                                      <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                                          <p className="font-bold mb-1 flex items-center gap-1"><CheckCircle size={16} /> Pago Total Inmediato</p>
                                          <p>Se descontará {formatearMoneda(totales.total)} de la cuenta seleccionada.</p>
                                      </div>
                                      
                                      <div className="form-group">
                                          <label className="form-label text-xs font-medium">Cuenta de Origen (Pago)</label>
                                          <select className="form-select" value={formData.id_cuenta_pago} onChange={(e) => setFormData({ ...formData, id_cuenta_pago: e.target.value })} required>
                                              <option value="">Seleccionar cuenta...</option>
                                              {cuentasPago.filter(c => c.moneda === formData.moneda).map(c => <option key={c.id_cuenta} value={c.id_cuenta}>{c.nombre} ({c.moneda})</option>)}
                                          </select>
                                      </div>
                                    </>
                                )}

                                {formData.forma_pago_detalle === 'Letras' && (
                                    <div className="p-3 bg-purple-50 border border-purple-200 rounded text-sm text-purple-800">
                                        <p className="font-bold mb-1">Pago con Letras</p>
                                        <p>Las letras se registrarán posteriormente (7-10 días después)</p>
                                        <div className="form-group mt-2">
                                            <label className="flex items-center gap-2 text-xs">
                                                <input type="checkbox" className="form-checkbox" checked={formData.letras_pendientes_registro} onChange={(e) => setFormData({...formData, letras_pendientes_registro: e.target.checked})} />
                                                <span>Registrar letras después</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {(formData.forma_pago_detalle === 'Credito' || formData.forma_pago_detalle === 'Letras') && (
                                    <div className="space-y-3 pt-2 border-t">
                                        {!formData.usa_fondos_propios && (
                                          <div className="form-group">
                                              <label className="form-label text-xs font-bold text-blue-700">Pago Inicial / Adelanto (Opcional)</label>
                                              <div className="relative">
                                                  <span className="absolute left-3 top-2 text-gray-500">{formData.moneda === 'USD' ? '$' : 'S/'}</span>
                                                  <input type="number" className="form-input pl-8 font-bold" value={formData.monto_pagado_inicial} onChange={(e) => setFormData({...formData, monto_pagado_inicial: e.target.value})} min="0" max={totales.total} step="0.01" />
                                              </div>
                                              <small className="text-xs text-muted">Saldo a crédito: {formatearMoneda(totales.total - parseFloat(formData.monto_pagado_inicial || 0))}</small>
                                          </div>
                                        )}
                                        
                                        {formData.forma_pago_detalle === 'Credito' && (
                                            <>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="form-group"><label className="form-label text-[10px] uppercase">Cuotas</label><input type="number" className="form-input text-center font-bold" min="1" value={formData.numero_cuotas} onChange={(e) => setFormData({...formData, numero_cuotas: e.target.value})} /></div>
                                                    <div className="form-group"><label className="form-label text-[10px] uppercase">Días</label><input type="number" className="form-input text-center" min="1" value={formData.dias_entre_cuotas} onChange={(e) => setFormData({...formData, dias_entre_cuotas: e.target.value})} /></div>
                                                </div>
                                                <div className="form-group"><label className="form-label text-[10px] uppercase">1° Vencimiento</label><input type="date" className="form-input" value={formData.fecha_primera_cuota} onChange={(e) => setFormData({...formData, fecha_primera_cuota: e.target.value})} /></div>
                                            </>
                                        )}

                                        {!formData.usa_fondos_propios && parseFloat(formData.monto_pagado_inicial) > 0 && (
                                            <div className="form-group pt-2 border-t">
                                                <label className="form-label text-xs">Cuenta de Origen (Adelanto)</label>
                                                <select className="form-select" value={formData.id_cuenta_pago} onChange={(e) => setFormData({ ...formData, id_cuenta_pago: e.target.value })} required>
                                                    <option value="">Seleccionar cuenta...</option>
                                                    {cuentasPago.filter(c => c.moneda === formData.moneda).map(c => <option key={c.id_cuenta} value={c.id_cuenta}>{c.nombre} ({c.moneda})</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {cuentaSeleccionada && (
                                    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs flex justify-between">
                                        <span className="text-muted">Saldo Disponible:</span>
                                        <span className={`font-bold ${parseFloat(cuentaSeleccionada.saldo_actual) < 0 ? 'text-red-600' : 'text-blue-900'}`}>{formatearMoneda(cuentaSeleccionada.saldo_actual, cuentaSeleccionada.moneda)}</span>
                                    </div>
                                )}

                                {requiereConversion && (
                                    <div className="bg-orange-50 border border-orange-200 rounded p-3 text-xs space-y-2">
                                        <div className="font-bold text-orange-800 flex items-center gap-1"><ArrowRightLeft size={12}/> Conversión Divisa</div>
                                        <div className="flex gap-2 items-center">
                                            <label>T.C.:</label>
                                            <input type="number" className="form-input py-1 text-center font-bold w-20" value={formData.tipo_cambio} onChange={(e) => setFormData({...formData, tipo_cambio: e.target.value})} step="0.001" />
                                        </div>
                                        {montoConvertido && <div className="text-right font-bold text-orange-700">Descargo: {formatearMoneda(montoConvertido, cuentaSeleccionada.moneda)}</div>}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header bg-gray-50/50"><h2 className="card-title flex items-center gap-2"><User size={18} /> Comprador</h2></div>
                            <div className="card-body space-y-3">
                                <div className="form-group">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" className="form-checkbox" checked={formData.usa_fondos_propios} onChange={(e) => {
                                          const usaFondos = e.target.checked;
                                          setFormData({
                                            ...formData, 
                                            usa_fondos_propios: usaFondos, 
                                            id_comprador: usaFondos ? formData.id_comprador : '',
                                            id_cuenta_pago: usaFondos ? '' : formData.id_cuenta_pago,
                                            monto_pagado_inicial: usaFondos ? 0 : (formData.forma_pago_detalle === 'Contado' ? totales.total : formData.monto_pagado_inicial)
                                          });
                                        }} />
                                        <span className="font-medium">Comprador usó fondos propios</span>
                                    </label>
                                    <small className="text-xs text-muted block mt-1">Marcar si un empleado realizó la compra con sus propios fondos</small>
                                </div>

                                {formData.usa_fondos_propios && (
                                    <div className="form-group animate-in fade-in">
                                        <label className="form-label text-xs">Seleccionar Comprador</label>
                                        <select className="form-select" value={formData.id_comprador} onChange={(e) => setFormData({...formData, id_comprador: e.target.value})} required={formData.usa_fondos_propios}>
                                            <option value="">Seleccione empleado...</option>
                                            {empleados.map(emp => (
                                                <option key={emp.id_empleado} value={emp.id_empleado}>{emp.nombre_completo} - {emp.cargo}</option>
                                            ))}
                                        </select>
                                        <small className="text-xs text-blue-600 block mt-1">Se generará un reembolso pendiente por {formatearMoneda(totales.total)}</small>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-body">
                                <div className="form-group mb-3"><label className="form-label text-xs">Dirección Entrega</label><textarea className="form-textarea text-sm" rows="2" value={formData.direccion_entrega} onChange={(e) => setFormData({...formData, direccion_entrega: e.target.value})} /></div>
                                <div className="form-group"><label className="form-label text-xs">Notas</label><textarea className="form-textarea text-sm" rows="2" value={formData.observaciones} onChange={(e) => setFormData({...formData, observaciones: e.target.value})} /></div>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary w-full py-3 shadow-lg" disabled={loading}>
                            {loading ? 'Procesando...' : <span className="flex items-center justify-center gap-2"><Save size={18} /> Guardar Compra</span>}
                        </button>
                    </>
                )}
            </div>
        </div>
      </form>

      <Modal isOpen={modalProveedorOpen} onClose={() => { setModalProveedorOpen(false); setBusquedaProveedor(''); }} title="Seleccionar Proveedor" size="lg">
        <div className="mb-4">
             <button type="button" className="btn btn-sm btn-success w-full mb-3" onClick={() => { setModalProveedorOpen(false); setModalCrearProveedorOpen(true); }}><UserPlus size={16} className="mr-2" /> Crear Nuevo</button>
            <div className="relative"><input type="text" className="form-input pl-10" placeholder="Buscar..." value={busquedaProveedor} onChange={(e) => setBusquedaProveedor(e.target.value)} autoFocus /><Search className="absolute left-3 top-2.5 text-gray-400" size={20} /></div>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {proveedoresFiltrados.map((prov) => (
            <div key={prov.id_proveedor} className="p-3 border rounded hover:bg-blue-50 cursor-pointer flex justify-between" onClick={() => handleSelectProveedor(prov)}>
              <div><div className="font-bold text-blue-900">{prov.razon_social}</div><div className="text-xs text-muted">{prov.ruc}</div></div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal isOpen={modalProductoOpen} onClose={() => { setModalProductoOpen(false); setBusquedaProducto(''); }} title="Seleccionar Producto" size="xl">
        <div className="mb-4">
             <button type="button" className="btn btn-sm btn-success w-full mb-3" onClick={() => { setModalProductoOpen(false); setModalCrearProductoOpen(true); }}><PackagePlus size={16} className="mr-2" /> Crear Nuevo</button>
            <div className="relative"><input type="text" className="form-input pl-10" placeholder="Buscar..." value={busquedaProducto} onChange={(e) => setBusquedaProducto(e.target.value)} autoFocus /><Search className="absolute left-3 top-2.5 text-gray-400" size={20} /></div>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {productosFiltrados.map((prod) => (
                <div key={prod.id_producto} className="p-2 border rounded hover:bg-gray-50 flex justify-between cursor-pointer" onClick={() => handleSelectProducto(prod)}>
                    <div><div className="font-bold text-sm">[{prod.codigo}] {prod.nombre}</div><div className="text-xs text-muted">Stock: {parseFloat(prod.stock_actual).toFixed(2)} {prod.unidad_medida}</div></div>
                </div>
            ))}
        </div>
      </Modal>

      <Modal isOpen={modalCrearProveedorOpen} onClose={() => setModalCrearProveedorOpen(false)} title="Nuevo Proveedor">
        <form onSubmit={handleGuardarNuevoProveedor} className="space-y-3">
            <div className="flex gap-2">
                <input className="form-input" placeholder="RUC" value={formNuevoProveedor.ruc} onChange={(e) => setFormNuevoProveedor({...formNuevoProveedor, ruc: e.target.value})} maxLength={11} required />
                <button type="button" className="btn btn-secondary" onClick={handleBuscarRUC} disabled={buscandoRuc}><Search size={18}/></button>
            </div>
            <input className="form-input" placeholder="Razón Social" value={formNuevoProveedor.razon_social} onChange={(e) => setFormNuevoProveedor({...formNuevoProveedor, razon_social: e.target.value})} required />
            <input className="form-input" placeholder="Dirección" value={formNuevoProveedor.direccion} onChange={(e) => setFormNuevoProveedor({...formNuevoProveedor, direccion: e.target.value})} />
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>Guardar</button>
        </form>
      </Modal>

      <Modal isOpen={modalCrearProductoOpen} onClose={() => setModalCrearProductoOpen(false)} title="Nuevo Producto">
        <form onSubmit={handleGuardarNuevoProducto} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <input className="form-input" placeholder="Código" value={formNuevoProducto.codigo} onChange={(e) => setFormNuevoProducto({...formNuevoProducto, codigo: e.target.value})} required />
                <select className="form-select" value={formNuevoProducto.unidad_medida} onChange={(e) => setFormNuevoProducto({...formNuevoProducto, unidad_medida: e.target.value})}><option value="UND">UND</option><option value="KG">KG</option></select>
            </div>
            <input className="form-input" placeholder="Nombre" value={formNuevoProducto.nombre} onChange={(e) => setFormNuevoProducto({...formNuevoProducto, nombre: e.target.value})} required />
            <select className="form-select" value={formNuevoProducto.id_tipo_inventario} onChange={(e) => setFormNuevoProducto({...formNuevoProducto, id_tipo_inventario: e.target.value})} required>
                <option value="">Tipo Inventario</option>{tiposInventario.map(t => <option key={t.id_tipo_inventario} value={t.id_tipo_inventario}>{t.nombre}</option>)}
            </select>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>Guardar</button>
        </form>
      </Modal>
    </div>
  );
}

export default NuevaCompra;