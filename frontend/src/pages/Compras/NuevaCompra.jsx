import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, ShoppingCart, Building,
  Plus, Trash2, Search, Wallet, CreditCard,
  ArrowRightLeft, PackagePlus, UserPlus, FileText,
  Receipt, User, CheckCircle, Calendar, AlertCircle,
  Banknote, FileClock
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
  
  const [accionPago, setAccionPago] = useState('registro');
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
    fecha_primera_cuota: new Date().toISOString().split('T')[0],
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

  useEffect(() => { cargarCatalogos(); }, []);
  useEffect(() => { calcularTotales(); }, [detalle, formData.porcentaje_impuesto, formData.tipo_impuesto]);
  
  useEffect(() => {
    if (formData.forma_pago_detalle === 'Contado' && !formData.usa_fondos_propios) {
      if (accionPago === 'completo') {
        setFormData(prev => ({ ...prev, monto_pagado_inicial: totales.total }));
      } else if (accionPago === 'registro') {
        setFormData(prev => ({ ...prev, monto_pagado_inicial: 0 }));
      }
    }
  }, [totales.total, formData.forma_pago_detalle, formData.usa_fondos_propios, accionPago]);

  useEffect(() => {
    if ((formData.tipo_compra === 'Credito' || (formData.tipo_compra === 'Letras' && !formData.letras_pendientes_registro)) && totales.total > 0) {
      calcularCronograma();
    }
  }, [formData.tipo_compra, formData.letras_pendientes_registro, formData.numero_cuotas, formData.dias_entre_cuotas, formData.fecha_primera_cuota, totales.total, formData.monto_pagado_inicial]);

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
      setError('Error al cargar catálogos');
    } finally { setLoading(false); }
  };

  const handleBuscarRUC = async () => {
    if (formNuevoProveedor.ruc.length !== 11) { setError('El RUC debe tener 11 dígitos'); return; }
    try {
      setBuscandoRuc(true); setError(null);
      const response = await proveedoresAPI.validarRUC(formNuevoProveedor.ruc);
      if (response.data.success) {
        if (response.data.ya_registrado) setError('ATENCIÓN: Este RUC ya está registrado.');
        const datos = response.data.datos;
        setFormNuevoProveedor(prev => ({ ...prev, razon_social: datos.razon_social || '', direccion: datos.direccion || prev.direccion }));
        if (!response.data.ya_registrado) setSuccess('Datos encontrados en SUNAT');
      }
    } catch (err) { setError('Error al validar RUC'); } finally { setBuscandoRuc(false); }
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
            setSuccess('Proveedor creado');
        }
    } catch (err) { setError('Error al crear proveedor'); } finally { setLoading(false); }
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
            setSuccess('Producto creado');
        }
    } catch (err) { setError('Error al crear producto'); } finally { setLoading(false); }
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

  const handleCantidadChange = (index, val) => { 
    const newD = [...detalle]; 
    newD[index].cantidad = parseFloat(val)||0; 
    newD[index].cantidad_a_recibir = parseFloat(val)||0; 
    setDetalle(newD); 
  };
  
  const handleCantidadRecibirChange = (index, val) => { 
    const newD = [...detalle]; 
    newD[index].cantidad_a_recibir = parseFloat(val)||0; 
    setDetalle(newD); 
  };
  
  const handlePrecioChange = (index, val) => { 
    const newD = [...detalle]; 
    newD[index].precio_unitario = parseFloat(val)||0; 
    setDetalle(newD); 
  };
  
  const handleDescuentoChange = (index, val) => { 
    const newD = [...detalle]; 
    newD[index].descuento_porcentaje = parseFloat(val)||0; 
    setDetalle(newD); 
  };
  
  const handleEliminarProducto = (index) => { 
    setDetalle(detalle.filter((_, i) => i !== index)); 
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
    setTotales({ subtotal, igv, total: subtotal + igv });
  };

  const calcularCronograma = () => {
    if (totales.total <= 0) return;
    
    const numCuotas = parseInt(formData.numero_cuotas) || 1;
    const diasEntre = parseInt(formData.dias_entre_cuotas) || 30;
    const saldoCredito = totales.total - parseFloat(formData.monto_pagado_inicial || 0);
    
    if (saldoCredito <= 0) {
        setCronograma([]);
        return;
    }

    const montoPorCuota = saldoCredito / numCuotas;
    let fechaBase = new Date(formData.fecha_primera_cuota);
    
    if (isNaN(fechaBase.getTime())) {
       fechaBase = new Date(formData.fecha_emision);
       fechaBase.setDate(fechaBase.getDate() + diasEntre);
    }

    const nuevoCronograma = [];
    let ultimaFecha = new Date(fechaBase);

    for (let i = 1; i <= numCuotas; i++) {
        nuevoCronograma.push({ 
          numero: i, 
          fecha: new Date(ultimaFecha), 
          monto: montoPorCuota 
        });
        ultimaFecha.setDate(ultimaFecha.getDate() + diasEntre);
    }
    setCronograma(nuevoCronograma);

    if (nuevoCronograma.length > 0) {
        const fechaFinal = nuevoCronograma[nuevoCronograma.length - 1].fecha;
        setFormData(prev => ({ 
          ...prev, 
          fecha_vencimiento: fechaFinal.toISOString().split('T')[0] 
        }));
    }
  };

  const handleFormaPagoChange = (forma) => {
    const esContado = forma === 'Contado';
    const esCredito = forma === 'Credito';
    const esLetras = forma === 'Letras';

    setFormData(prev => ({
      ...prev,
      forma_pago_detalle: forma,
      tipo_compra: esLetras ? 'Letras' : (esCredito ? 'Credito' : 'Contado'),
      letras_pendientes_registro: esLetras, 
      numero_cuotas: esCredito || esLetras ? (prev.numero_cuotas || 1) : 0,
      dias_credito: esCredito || esLetras ? 30 : 0,
      dias_entre_cuotas: esCredito || esLetras ? 30 : 0,
      monto_pagado_inicial: 0,
    }));
    
    if (esContado) {
      setAccionPago('registro');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setError(null); 
    setSuccess(null);
    
    if (!formData.id_proveedor) { 
      setError('Seleccione proveedor'); 
      return; 
    }
    if (detalle.length === 0) { 
      setError('Agregue productos'); 
      return; 
    }
    if (!formData.moneda) { 
      setError('Especifique moneda'); 
      return; 
    }
    
    if (formData.usa_fondos_propios && !formData.id_comprador) { 
      setError('Debe seleccionar al comprador'); 
      return; 
    }
    
    if (!formData.usa_fondos_propios && accionPago !== 'registro') {
      if (!formData.id_cuenta_pago) {
        setError('Seleccione cuenta de pago para realizar el desembolso'); 
        return; 
      }
    }
    
    if ((formData.tipo_compra === 'Letras' && !formData.letras_pendientes_registro) && parseInt(formData.numero_cuotas) < 1) {
        setError('Debe indicar al menos 1 cuota/letra.'); 
        return;
    }

    try {
      setLoading(true);

      const debeEnviarCronograma = (
  (formData.tipo_compra === 'Credito' || (formData.tipo_compra === 'Letras' && !formData.letras_pendientes_registro))
  && cronograma.length > 0
);

const cronogramaPayload = debeEnviarCronograma
  ? cronograma.map(c => ({
      numero: c.numero,
      monto: parseFloat(c.monto.toFixed(2)),
      fecha_vencimiento: c.fecha.toISOString().split('T')[0]
  }))
  : [];

     const payload = {
        ...formData,
        id_proveedor: parseInt(formData.id_proveedor),
        id_cuenta_pago: (formData.usa_fondos_propios || accionPago === 'registro') 
          ? null 
          : (formData.id_cuenta_pago ? parseInt(formData.id_cuenta_pago) : null),
        id_comprador: formData.usa_fondos_propios ? parseInt(formData.id_comprador) : null,
        monto_reembolsar: formData.usa_fondos_propios ? totales.total : 0,
        numero_cuotas: parseInt(formData.numero_cuotas),
        dias_entre_cuotas: parseInt(formData.dias_entre_cuotas),
        dias_credito: parseInt(formData.dias_credito),
        porcentaje_impuesto: parseFloat(formData.porcentaje_impuesto),
        tipo_cambio: parseFloat(formData.tipo_cambio || 1.0),
        monto_pagado_inicial: formData.usa_fondos_propios ? 0 : parseFloat(formData.monto_pagado_inicial || 0),
        usa_fondos_propios: formData.usa_fondos_propios ? 1 : 0,
        accion_pago: accionPago,
        monto_adelanto: formData.usa_fondos_propios ? 0 : parseFloat(formData.monto_pagado_inicial || 0),
        cronograma: cronogramaPayload,
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
        setSuccess(`Compra ${response.data.data.numero} registrada`);
        setTimeout(() => navigate('/compras'), 1500);
      } else { 
        setError(response.data.error || 'Error al crear compra'); 
      }
    } catch (err) { 
      setError(err.response?.data?.error || 'Error al crear compra'); 
    } finally { 
      setLoading(false); 
    }
  };

  const formatearMoneda = (val, moneda = null) => {
    const m = moneda || formData.moneda;
    return `${m === 'USD' ? '$' : 'S/'} ${parseFloat(val).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  };

  if (loading && proveedores.length === 0) return <Loading message="Cargando configuración..." />;

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button className="btn btn-outline" onClick={() => navigate('/compras')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart size={28} className="text-primary" /> Nueva Compra
            </h1>
            <p className="text-sm text-muted">Ingreso de mercadería y provisión de gastos</p>
          </div>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <div className="card-header bg-gray-50">
                <h2 className="card-title text-base">
                  <Building size={18} className="text-primary"/> Datos del Proveedor
                </h2>
              </div>
              <div className="card-body">
                {proveedorSeleccionado ? (
                  <div className="bg-blue-50 border border-blue-200 rounded p-4 flex justify-between items-center transition-all">
                    <div>
                      <p className="font-bold text-lg text-blue-900">{proveedorSeleccionado.razon_social}</p>
                      <p className="text-sm text-blue-700 font-mono">RUC: {proveedorSeleccionado.ruc}</p>
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline bg-white hover:text-blue-700" 
                      onClick={() => { 
                        setProveedorSeleccionado(null); 
                        setFormData({ ...formData, id_proveedor: '' }); 
                      }}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <button 
                    type="button" 
                    className="w-full py-8 border-2 border-dashed border-gray-200 rounded text-muted hover:border-primary hover:text-primary transition-colors flex flex-col items-center gap-2" 
                    onClick={() => setModalProveedorOpen(true)}
                  >
                    <Search size={32} />
                    <span className="font-medium">Clic para buscar proveedor</span>
                  </button>
                )}

                {proveedorSeleccionado && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="form-group">
                      <label className="form-label text-xs uppercase text-muted">Fecha Emisión</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={formData.fecha_emision} 
                        onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })} 
                        required 
                      />
                    </div>
                    <div className="form-group md:col-span-2">
                      <label className="form-label text-xs uppercase text-muted">Contacto (Opcional)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Nombre del vendedor" 
                        value={formData.contacto_proveedor} 
                        onChange={(e) => setFormData({ ...formData, contacto_proveedor: e.target.value })} 
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header bg-gray-50">
                <h2 className="card-title text-base">
                  <FileText size={18} className="text-primary"/> Documento Físico
                </h2>
              </div>
              <div className="card-body grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="form-group">
                  <label className="form-label text-xs uppercase text-muted">Tipo</label>
                  <select 
                    className="form-select" 
                    value={formData.tipo_documento} 
                    onChange={(e) => setFormData({ ...formData, tipo_documento: e.target.value })}
                  >
                    <option value="Factura">Factura</option>
                    <option value="Boleta">Boleta</option>
                    <option value="Guia">Guía Remisión</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label text-xs uppercase text-muted">Serie</label>
                  <input 
                    type="text" 
                    className="form-input uppercase" 
                    placeholder="F001" 
                    value={formData.serie_documento} 
                    onChange={(e) => setFormData({ ...formData, serie_documento: e.target.value.toUpperCase() })} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label text-xs uppercase text-muted">Número</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="00001234" 
                    value={formData.numero_documento} 
                    onChange={(e) => setFormData({ ...formData, numero_documento: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label text-xs uppercase text-muted">Fecha Doc.</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={formData.fecha_emision_documento} 
                    onChange={(e) => setFormData({ ...formData, fecha_emision_documento: e.target.value })} 
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex gap-4">
                  <button 
                    type="button" 
                    className={`selection-card-btn ${formData.moneda === 'PEN' ? 'active' : ''}`} 
                    onClick={() => setFormData({...formData, moneda: 'PEN'})}
                  >
                    <div className="font-bold text-xl">S/</div>
                    <span className="text-xs font-bold uppercase">Soles</span>
                  </button>
                  <button 
                    type="button" 
                    className={`selection-card-btn ${formData.moneda === 'USD' ? 'active' : ''}`} 
                    onClick={() => setFormData({...formData, moneda: 'USD'})}
                  >
                    <div className="font-bold text-xl">$</div>
                    <span className="text-xs font-bold uppercase">Dólares</span>
                  </button>
                </div>
              </div>
            </div>

            {formData.moneda && (
              <div className="card">
                <div className="card-header bg-gray-50 flex justify-between items-center">
                  <h2 className="card-title text-base">
                    <ShoppingCart size={18} className="text-primary"/> Detalle de Productos
                  </h2>
                  <div className="flex gap-2">
                    <select 
                      className="form-select text-xs w-36" 
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
                
                <div className="card-body p-0 overflow-hidden">
                  <div className="table-container shadow-none rounded-none border-0">
                    <table className="table">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-12 text-center">#</th>
                          <th>Producto</th>
                          <th className="w-24 text-right">Cant.</th>
                          {formData.tipo_recepcion === 'Parcial' && (
                            <th className="w-24 text-right bg-blue-50 text-blue-800">Recibir</th>
                          )}
                          <th className="w-28 text-right">Precio Unit.</th>
                          <th className="w-20 text-center">% Desc.</th>
                          <th className="w-28 text-right">Total</th>
                          <th className="w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.length > 0 ? detalle.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="text-center text-muted text-xs">{index + 1}</td>
                            <td>
                              <div className="font-medium text-sm text-gray-800">{item.producto}</div>
                              <div className="text-xs text-muted font-mono">{item.codigo_producto}</div>
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input form-input-sm text-right" 
                                value={item.cantidad} 
                                onChange={(e) => handleCantidadChange(index, e.target.value)} 
                                min="0" 
                                step="0.01" 
                              />
                            </td>
                            {formData.tipo_recepcion === 'Parcial' && (
                              <td className="bg-blue-50">
                                <input 
                                  type="number" 
                                  className="form-input form-input-sm text-right border-blue-500" 
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
                                className="form-input form-input-sm text-right" 
                                value={item.precio_unitario} 
                                onChange={(e) => handlePrecioChange(index, e.target.value)} 
                                min="0" 
                                step="0.01" 
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input form-input-sm text-center" 
                                value={item.descuento_porcentaje} 
                                onChange={(e) => handleDescuentoChange(index, e.target.value)} 
                                min="0" 
                                max="100" 
                              />
                            </td>
                            <td className="text-right font-bold text-gray-800 text-sm">
                              {formatearMoneda(calcularSubtotalItem(item))}
                            </td>
                            <td className="text-center">
                              <button 
                                type="button" 
                                className="btn btn-xs btn-ghost text-red-600 hover:bg-red-50" 
                                onClick={() => handleEliminarProducto(index)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="8" className="p-8 text-center text-muted italic">
                              No hay productos agregados a la lista.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end">
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Subtotal:</span>
                      <span className="font-medium">{formatearMoneda(totales.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <div className="flex items-center gap-1">
                        <select 
                          className="form-select form-select-sm border-transparent bg-transparent p-0 pr-6 font-medium text-muted cursor-pointer hover:text-primary focus:ring-0" 
                          value={formData.tipo_impuesto} 
                          onChange={(e) => setFormData({...formData, tipo_impuesto: e.target.value})}
                        >
                          <option value="IGV">IGV (18%)</option>
                          <option value="EXO">Exonerado</option>
                          <option value="INA">Inafecto</option>
                        </select>
                      </div>
                      <span className="font-medium">{formatearMoneda(totales.igv)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-primary pt-3 border-t border-gray-200">
                      <span>Total:</span>
                      <span>{formatearMoneda(totales.total)}</span>
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
                  <div className="card-header bg-gray-50">
                    <h2 className="card-title text-base">
                      <Wallet size={18} className="text-primary"/> Forma de Pago
                    </h2>
                  </div>
                  <div className="card-body space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        type="button" 
                        className={`selection-card-btn p-2 ${formData.forma_pago_detalle === 'Contado' ? 'active' : ''}`} 
                        onClick={() => handleFormaPagoChange('Contado')}
                      >
                        <Wallet size={20} />
                        <span className="text-xs font-bold uppercase">Contado</span>
                      </button>
                      <button 
                        type="button" 
                        className={`selection-card-btn p-2 ${formData.forma_pago_detalle === 'Credito' ? 'active' : ''}`} 
                        onClick={() => handleFormaPagoChange('Credito')}
                      >
                        <CreditCard size={20} />
                        <span className="text-xs font-bold uppercase">Crédito</span>
                      </button>
                      <button 
                        type="button" 
                        className={`selection-card-btn p-2 ${formData.forma_pago_detalle === 'Letras' ? 'active' : ''}`} 
                        onClick={() => handleFormaPagoChange('Letras')}
                      >
                        <Receipt size={20} />
                        <span className="text-xs font-bold uppercase">Letras</span>
                      </button>
                    </div>

                    {formData.forma_pago_detalle === 'Contado' && !formData.usa_fondos_propios && (
                      <div className="slide-down space-y-3 pt-2 border-t border-dashed">
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <button 
                            type="button" 
                            className={`p-2 border rounded text-xs flex flex-col items-center gap-1 transition-all ${
                              accionPago === 'completo' 
                                ? 'bg-green-50 border-green-500 text-green-700 font-bold' 
                                : 'hover:bg-gray-50 text-muted'
                            }`}
                            onClick={() => setAccionPago('completo')}
                          >
                            <CheckCircle size={16}/> Completo
                          </button>
                          <button 
                            type="button" 
                            className={`p-2 border rounded text-xs flex flex-col items-center gap-1 transition-all ${
                              accionPago === 'adelanto' 
                                ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' 
                                : 'hover:bg-gray-50 text-muted'
                            }`}
                            onClick={() => setAccionPago('adelanto')}
                          >
                            <Banknote size={16}/> Adelanto
                          </button>
                          <button 
                            type="button" 
                            className={`p-2 border rounded text-xs flex flex-col items-center gap-1 transition-all ${
                              accionPago === 'registro' 
                                ? 'bg-orange-50 border-orange-500 text-orange-700 font-bold' 
                                : 'hover:bg-gray-50 text-muted'
                            }`}
                            onClick={() => setAccionPago('registro')}
                          >
                            <FileClock size={16}/> Solo Reg.
                          </button>
                        </div>

                        {accionPago === 'completo' && (
                          <div className="alert alert-success py-2 text-sm">
                            <CheckCircle size={14} /> Se registrará egreso de <strong>{formatearMoneda(totales.total)}</strong>
                          </div>
                        )}
                        
                        {accionPago === 'adelanto' && (
                          <div className="form-group">
                            <label className="form-label text-xs uppercase text-muted">Monto Adelanto</label>
                            <input 
                              type="number" 
                              className="form-input font-bold" 
                              value={formData.monto_pagado_inicial} 
                              onChange={(e) => setFormData({...formData, monto_pagado_inicial: e.target.value})} 
                              min="0.01" 
                              max={totales.total} 
                              step="0.01" 
                            />
                          </div>
                        )}
                        
                        {accionPago === 'registro' && (
                          <div className="alert alert-warning py-2 text-sm">
                            <AlertCircle size={14} /> Se generará cuenta por pagar. No se registran movimientos ahora.
                          </div>
                        )}

                        {accionPago !== 'registro' && (
                          <div className="form-group">
                            <label className="form-label text-xs uppercase text-muted">Cuenta de Origen</label>
                            <select 
                              className="form-select" 
                              value={formData.id_cuenta_pago} 
                              onChange={(e) => setFormData({ ...formData, id_cuenta_pago: e.target.value })} 
                              required
                            >
                              <option value="">Seleccionar cuenta...</option>
                              {cuentasPago.filter(c => c.estado === 'Activo').map(c => (
                                <option key={c.id_cuenta} value={c.id_cuenta}>
                                  {c.nombre} - {c.tipo} (PEN: S/ {parseFloat(c.saldo_pen || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})} | USD: $ {parseFloat(c.saldo_usd || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {formData.forma_pago_detalle === 'Letras' && (
                      <div className="slide-down">
                        <div className="p-3 bg-purple-50 border border-purple-500 rounded text-xs text-purple-900 mb-3 flex items-start gap-3">
                          <AlertCircle size={18} className="shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">Compra a Letras</p>
                            <p className="text-purple-900/80">
                              {formData.letras_pendientes_registro 
                                ? "Se registrará la deuda total. Podrás canjear las letras y definir fechas más adelante." 
                                : "Define el cronograma de cuotas ahora mismo."}
                            </p>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer mb-3 p-3 border rounded hover:bg-gray-50 transition-colors">
                          <input 
                            type="checkbox" 
                            className="form-checkbox h-4 w-4 text-purple-600 rounded" 
                            checked={formData.letras_pendientes_registro} 
                            onChange={(e) => setFormData({...formData, letras_pendientes_registro: e.target.checked})} 
                          />
                          <span className="font-medium text-sm">Registrar detalle de letras después</span>
                        </label>
                      </div>
                    )}

                    {(formData.forma_pago_detalle === 'Credito' || (formData.forma_pago_detalle === 'Letras' && !formData.letras_pendientes_registro)) && (
                      <div className="slide-down space-y-4 pt-2 border-t border-dashed">
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="form-group">
                            <label className="form-label text-xs uppercase text-muted">
                              {formData.forma_pago_detalle === 'Letras' ? 'N° Letras' : 'Cuotas'}
                            </label>
                            <input 
                              type="number" 
                              className="form-input text-center font-bold" 
                              min="1" 
                              value={formData.numero_cuotas} 
                              onChange={(e) => setFormData({...formData, numero_cuotas: e.target.value})} 
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label text-xs uppercase text-muted">Días/Intervalo</label>
                            <input 
                              type="number" 
                              className="form-input text-center" 
                              min="1" 
                              value={formData.dias_entre_cuotas} 
                              onChange={(e) => setFormData({...formData, dias_entre_cuotas: e.target.value})} 
                            />
                          </div>
                          <div className="form-group col-span-2">
                            <label className="form-label text-xs uppercase text-muted">
                              {formData.forma_pago_detalle === 'Letras' ? 'Vencimiento 1° Letra' : '1° Vencimiento'}
                            </label>
                            <input 
                              type="date" 
                              className="form-input" 
                              value={formData.fecha_primera_cuota} 
                              onChange={(e) => setFormData({...formData, fecha_primera_cuota: e.target.value})} 
                            />
                          </div>
                        </div>

                        {(formData.forma_pago_detalle === 'Letras' || formData.forma_pago_detalle === 'Credito') && cronograma.length > 0 && (
  <div className="bg-gray-50 rounded border overflow-hidden">
    <div className="px-3 py-2 bg-gray-100 text-xs font-bold text-gray-700 border-b flex justify-between items-center">
      <span>Cronograma Preliminar</span>
      <Calendar size={14}/>
    </div>
    <div className="max-h-48 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="text-gray-500 bg-gray-50">
          <tr>
            <th className="px-2 py-1 text-left">#</th>
            <th className="px-2 py-1 text-left">Vence</th>
            <th className="px-2 py-1 text-right">Monto</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {cronograma.map((cuota) => (
            <tr key={cuota.numero}>
              <td className="px-2 py-1 font-medium">{cuota.numero}</td>
              <td className="px-2 py-1">{cuota.fecha.toLocaleDateString()}</td>
              <td className="px-2 py-1 text-right">{formatearMoneda(cuota.monto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}

                        {!formData.usa_fondos_propios && (
                          <div className="bg-gray-50 p-3 rounded border">
                            <label className="form-label text-xs uppercase text-blue-700 font-bold mb-2">
                              Adelanto (Opcional)
                            </label>
                            <div className="flex gap-2 mb-2">
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-2 text-gray-500 text-sm">
                                  {formData.moneda === 'USD' ? '$' : 'S/'}
                                </span>
                                <input 
                                  type="number" 
                                  className="form-input pl-8 font-bold" 
                                  value={formData.monto_pagado_inicial} 
                                  onChange={(e) => setFormData({...formData, monto_pagado_inicial: e.target.value})} 
                                  min="0" 
                                  max={totales.total} 
                                  step="0.01" 
                                />
                              </div>
                            </div>
                            {parseFloat(formData.monto_pagado_inicial) > 0 && (
                              <select 
                                className="form-select text-xs" 
                                value={formData.id_cuenta_pago} 
                                onChange={(e) => setFormData({ ...formData, id_cuenta_pago: e.target.value })}
                              >
                                <option value="">Cuenta para adelanto...</option>
                                {cuentasPago.filter(c => c.estado === 'Activo').map(c => (
                                  <option key={c.id_cuenta} value={c.id_cuenta}>
                                    {c.nombre} - {c.tipo} (PEN: S/ {parseFloat(c.saldo_pen || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})} | USD: $ {parseFloat(c.saldo_usd || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})})
                                  </option>
                                ))}
                              </select>
                            )}
                            <div className="text-right mt-1 text-xs text-muted">
                              Saldo: {formatearMoneda(totales.total - parseFloat(formData.monto_pagado_inicial || 0))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header bg-gray-50">
                    <h2 className="card-title text-base">
                      <User size={18} className="text-primary"/> Comprador
                    </h2>
                  </div>
                  <div className="card-body">
                    <label className="flex items-start gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded transition-colors">
                      <input 
                        type="checkbox" 
                        className="mt-1" 
                        checked={formData.usa_fondos_propios} 
                        onChange={(e) => {
                          const usa = e.target.checked;
                          setFormData({ 
                            ...formData, 
                            usa_fondos_propios: usa, 
                            id_comprador: usa ? formData.id_comprador : '', 
                            id_cuenta_pago: usa ? '' : formData.id_cuenta_pago, 
                            monto_pagado_inicial: usa ? 0 : (formData.forma_pago_detalle === 'Contado' ? totales.total : formData.monto_pagado_inicial) 
                          });
                        }} 
                      />
                      <div>
                        <span className="font-medium text-sm block">Usar Fondos Propios</span>
                        <span className="text-xs text-muted">Empleado paga con su dinero (reembolso pendiente)</span>
                      </div>
                    </label>

                    {formData.usa_fondos_propios && (
                      <div className="mt-3 slide-down">
                        <select 
                          className="form-select" 
                          value={formData.id_comprador} 
                          onChange={(e) => setFormData({...formData, id_comprador: e.target.value})} 
                          required
                        >
                          <option value="">Seleccione empleado...</option>
                          {empleados.map(emp => (
                            <option key={emp.id_empleado} value={emp.id_empleado}>
                              {emp.nombre_completo}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-body space-y-3">
                    <div className="form-group m-0">
                      <label className="form-label text-xs uppercase text-muted">Dirección Entrega</label>
                      <textarea 
                        className="form-textarea text-sm min-h-[60px]" 
                        value={formData.direccion_entrega} 
                        onChange={(e) => setFormData({...formData, direccion_entrega: e.target.value})} 
                      />
                    </div>
                    <div className="form-group m-0">
                      <label className="form-label text-xs uppercase text-muted">Notas Internas</label>
                      <textarea 
                        className="form-textarea text-sm min-h-[60px]" 
                        value={formData.observaciones} 
                        onChange={(e) => setFormData({...formData, observaciones: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary w-full btn-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all" 
                  disabled={loading}
                >
                  {loading ? 'Procesando...' : (
                    <>
                      <Save size={20} /> Guardar Compra
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </form>
      <Modal 
        isOpen={modalProveedorOpen} 
        onClose={() => { setModalProveedorOpen(false); setBusquedaProveedor(''); }} 
        title="Buscar Proveedor"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input 
                type="text" 
                className="form-input pl-10" 
                placeholder="Buscar por Razón Social o RUC..." 
                value={busquedaProveedor} 
                onChange={(e) => setBusquedaProveedor(e.target.value)} 
                autoFocus 
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            </div>
            <button 
              type="button" 
              className="btn btn-success" 
              onClick={() => { setModalProveedorOpen(false); setModalCrearProveedorOpen(true); }}
            >
              <UserPlus size={18} />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto border rounded divide-y">
            {proveedoresFiltrados.length > 0 ? proveedoresFiltrados.map((prov) => (
              <div 
                key={prov.id_proveedor} 
                className="p-3 hover:bg-blue-50 cursor-pointer transition-colors" 
                onClick={() => handleSelectProveedor(prov)}
              >
                <div className="font-bold text-blue-900">{prov.razon_social}</div>
                <div className="text-xs text-muted flex gap-2">
                  <span>RUC: {prov.ruc}</span>
                  {prov.contacto && <span>| Contacto: {prov.contacto}</span>}
                </div>
              </div>
            )) : (
              <div className="p-4 text-center text-muted">No se encontraron proveedores.</div>
            )}
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={modalProductoOpen} 
        onClose={() => { setModalProductoOpen(false); setBusquedaProducto(''); }} 
        title="Agregar Producto" 
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input 
                type="text" 
                className="form-input pl-10" 
                placeholder="Buscar producto..." 
                value={busquedaProducto} 
                onChange={(e) => setBusquedaProducto(e.target.value)} 
                autoFocus 
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            </div>
            <button 
              type="button" 
              className="btn btn-success" 
              onClick={() => { setModalProductoOpen(false); setModalCrearProductoOpen(true); }}
            >
              <PackagePlus size={18} />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto border rounded divide-y">
            {productosFiltrados.length > 0 ? productosFiltrados.map((prod) => (
              <div 
                key={prod.id_producto} 
                className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center transition-colors" 
                onClick={() => handleSelectProducto(prod)}
              >
                <div>
                  <div className="font-bold text-sm text-gray-800">{prod.nombre}</div>
                  <div className="text-xs text-muted">Código: {prod.codigo}</div>
                </div>
                <div className="text-right text-xs">
                  <span className="block font-medium">
                    Stock: {parseFloat(prod.stock_actual).toFixed(2)} {prod.unidad_medida}
                  </span>
                  <span className="text-muted block">{prod.categoria}</span>
                </div>
              </div>
            )) : (
              <div className="p-4 text-center text-muted">No se encontraron productos.</div>
            )}
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={modalCrearProveedorOpen} 
        onClose={() => setModalCrearProveedorOpen(false)} 
        title="Nuevo Proveedor"
      >
        <form onSubmit={handleGuardarNuevoProveedor} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 input-with-icon">
              <Search size={18} className="icon"/>
              <input 
                className="form-input" 
                placeholder="RUC (11 dígitos)" 
                value={formNuevoProveedor.ruc} 
                onChange={(e) => setFormNuevoProveedor({...formNuevoProveedor, ruc: e.target.value})} 
                maxLength={11} 
                required 
              />
            </div>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleBuscarRUC} 
              disabled={buscandoRuc}
            >
              {buscandoRuc ? <Loading size="sm"/> : 'SUNAT'}
            </button>
          </div>
          <input 
            className="form-input" 
            placeholder="Razón Social" 
            value={formNuevoProveedor.razon_social} 
            onChange={(e) => setFormNuevoProveedor({...formNuevoProveedor, razon_social: e.target.value})} 
            required 
          />
          <input 
            className="form-input" 
            placeholder="Dirección Fiscal" 
            value={formNuevoProveedor.direccion} 
            onChange={(e) => setFormNuevoProveedor({...formNuevoProveedor, direccion: e.target.value})} 
          />
          <div className="grid grid-cols-2 gap-3">
            <input 
              className="form-input" 
              placeholder="Teléfono" 
              value={formNuevoProveedor.telefono} 
              onChange={(e) => setFormNuevoProveedor({...formNuevoProveedor, telefono: e.target.value})} 
            />
            <input 
              className="form-input" 
              placeholder="Email" 
              value={formNuevoProveedor.email} 
              onChange={(e) => setFormNuevoProveedor({...formNuevoProveedor, email: e.target.value})} 
            />
          </div>
          <div className="pt-2">
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              Guardar Proveedor
            </button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={modalCrearProductoOpen} 
        onClose={() => setModalCrearProductoOpen(false)} 
        title="Nuevo Producto"
      >
        <form onSubmit={handleGuardarNuevoProducto} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <input 
                className="form-input" 
                placeholder="Nombre del Producto" 
                value={formNuevoProducto.nombre} 
                onChange={(e) => setFormNuevoProducto({...formNuevoProducto, nombre: e.target.value})} 
                required 
              />
            </div>
            <div>
              <input 
                className="form-input" 
                placeholder="Código" 
                value={formNuevoProducto.codigo} 
                onChange={(e) => setFormNuevoProducto({...formNuevoProducto, codigo: e.target.value})} 
                required 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select 
              className="form-select" 
              value={formNuevoProducto.id_tipo_inventario} 
              onChange={(e) => setFormNuevoProducto({...formNuevoProducto, id_tipo_inventario: e.target.value})} 
              required
            >
              <option value="">Tipo Inventario...</option>
              {tiposInventario.map(t => (
                <option key={t.id_tipo_inventario} value={t.id_tipo_inventario}>
                  {t.nombre}
                </option>
              ))}
            </select>
            <select 
              className="form-select" 
              value={formNuevoProducto.unidad_medida} 
              onChange={(e) => setFormNuevoProducto({...formNuevoProducto, unidad_medida: e.target.value})}
            >
              <option value="UND">Unidad (UND)</option>
              <option value="KG">Kilos (KG)</option>
              <option value="MTR">Metros (MTR)</option>
            </select>
          </div>
          <textarea 
            className="form-textarea h-20" 
            placeholder="Descripción (Opcional)" 
            value={formNuevoProducto.descripcion} 
            onChange={(e) => setFormNuevoProducto({...formNuevoProducto, descripcion: e.target.value})} 
          />
          <div className="pt-2">
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              Guardar Producto
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default NuevaCompra;