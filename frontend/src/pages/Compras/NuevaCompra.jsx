import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, ShoppingCart, Building, Calendar,
  MapPin, Plus, Trash2, Search, AlertCircle, Wallet, CreditCard, Clock,
  Calculator, DollarSign, ArrowRightLeft, XCircle, PackageCheck, FileText, Hash
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
  const [modalHistorialOpen, setModalHistorialOpen] = useState(false);
  
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  const [productoHistorial, setProductoHistorial] = useState(null);
  const [historialCompras, setHistorialCompras] = useState(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
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
    fecha_emision_documento: new Date().toISOString().split('T')[0]
  });
  
  const [detalle, setDetalle] = useState([]);
  const [totales, setTotales] = useState({ subtotal: 0, igv: 0, total: 0 });
  const [cronograma, setCronograma] = useState([]);

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    calcularTotales();
  }, [detalle, formData.porcentaje_impuesto, formData.tipo_impuesto]);

  useEffect(() => {
    if (formData.tipo_compra === 'Credito') {
      calcularCronograma();
    }
  }, [
    formData.tipo_compra, 
    formData.numero_cuotas, 
    formData.dias_entre_cuotas, 
    formData.fecha_emision,
    formData.fecha_primera_cuota,
    totales.total
  ]);

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
      const [resProveedores, resProductos, resCuentas] = await Promise.all([
        proveedoresAPI.getAll({ estado: 'Activo' }),
        productosAPI.getAll({ 
          estado: 'Activo',
          id_tipo_inventario: '1,2,4,5,6'
        }),
        cuentasPagoAPI.getAll({ estado: 'Activo' })
      ]);
      
      if (resProveedores.data.success) setProveedores(resProveedores.data.data || []);
      if (resProductos.data.success) setProductos(resProductos.data.data || []);
      if (resCuentas.data.success) setCuentasPago(resCuentas.data.data || []);
      
    } catch (err) {
      console.error(err);
      setError('Error al cargar catálogos: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleVerHistorial = async (producto) => {
    try {
      setLoadingHistorial(true);
      setProductoHistorial(producto);
      setModalHistorialOpen(true);
      const response = await productosAPI.getHistorialCompras(producto.id_producto, { limite: 20 });
      if (response.data.success) {
        setHistorialCompras(response.data.data);
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar el historial de compras');
    } finally {
      setLoadingHistorial(false);
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
      cantidad_a_recibir: 1.00,
      precio_unitario: 0.00,
      descuento_porcentaje: 0.00
    };
    setDetalle([...detalle, nuevoItem]);
    setModalProductoOpen(false);
  };

  const handleCantidadChange = (index, cantidad) => {
    const newDetalle = [...detalle];
    const val = parseFloat(cantidad) || 0;
    newDetalle[index].cantidad = val;
    newDetalle[index].cantidad_a_recibir = val;
    setDetalle(newDetalle);
  };

  const handleCantidadRecibirChange = (index, cantidad) => {
    const newDetalle = [...detalle];
    newDetalle[index].cantidad_a_recibir = parseFloat(cantidad) || 0;
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

  const calcularCronograma = () => {
    if (totales.total <= 0) return;

    const numCuotas = parseInt(formData.numero_cuotas) || 1;
    const diasEntre = parseInt(formData.dias_entre_cuotas) || 30;
    const montoPorCuota = totales.total / numCuotas;

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
        const emision = new Date(formData.fecha_emision);
        const diffTime = Math.abs(fechaFinal - emision);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        setFormData(prev => ({
            ...prev,
            fecha_vencimiento: fechaFinal.toISOString().split('T')[0],
            dias_credito: diffDays
        }));
    }
  };

  const handleTipoCompraChange = (tipo) => {
    setFormData({
      ...formData,
      tipo_compra: tipo,
      numero_cuotas: tipo === 'Credito' ? 1 : 0,
      dias_credito: tipo === 'Credito' ? 30 : 0,
      dias_entre_cuotas: tipo === 'Credito' ? 30 : 0,
      fecha_primera_cuota: ''
    });
  };

  const calcularMontoConversion = () => {
    if (!requiereConversion || !formData.tipo_cambio || !totales.total) return null;
    
    const tc = parseFloat(formData.tipo_cambio);
    const total = parseFloat(totales.total);
    
    if (cuentaSeleccionada.moneda === 'PEN' && formData.moneda === 'USD') {
      return total * tc;
    } else if (cuentaSeleccionada.moneda === 'USD' && formData.moneda === 'PEN') {
      return total / tc;
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!formData.id_proveedor) { setError('Debe seleccionar un proveedor'); return; }
    if (!formData.id_cuenta_pago) { setError('Debe seleccionar una cuenta de pago'); return; }
    if (!formData.moneda) { setError('Debe especificar la moneda de la compra'); return; }
    if (detalle.length === 0) { setError('Debe agregar al menos un producto'); return; }
    
    if (requiereConversion && (!formData.tipo_cambio || parseFloat(formData.tipo_cambio) <= 0)) {
      setError(`Debe especificar el tipo de cambio para convertir de ${formData.moneda} a ${cuentaSeleccionada.moneda}`);
      return;
    }
    
    if (formData.tipo_compra === 'Contado') {
        const montoRequerido = calcularMontoConversion() || totales.total;
        if (parseFloat(cuentaSeleccionada.saldo_actual) < montoRequerido) {
            setError(`Saldo insuficiente en ${cuentaSeleccionada.nombre}. Requerido: ${formatearMoneda(montoRequerido, cuentaSeleccionada.moneda)}`);
            return;
        }
    }

    const invalidos = detalle.filter(item => parseFloat(item.cantidad) <= 0 || parseFloat(item.precio_unitario) <= 0);
    if (invalidos.length > 0) { setError('Hay productos con cantidad o precio inválido'); return; }

    if (formData.tipo_recepcion === 'Parcial') {
      const recepcionInvalida = detalle.filter(item => {
        const cant = parseFloat(item.cantidad);
        const recep = parseFloat(item.cantidad_a_recibir);
        return recep < 0 || recep > cant;
      });
      if (recepcionInvalida.length > 0) {
        setError('La cantidad a recibir no puede ser negativa ni mayor a la cantidad de compra');
        return;
      }
    }

    if (formData.tipo_compra === 'Credito' && formData.numero_cuotas <= 0) {
      setError('Número de cuotas inválido'); return;
    }
    
    try {
      setLoading(true);
      const payload = {
        ...formData,
        id_proveedor: parseInt(formData.id_proveedor),
        id_cuenta_pago: parseInt(formData.id_cuenta_pago),
        numero_cuotas: parseInt(formData.numero_cuotas),
        dias_entre_cuotas: parseInt(formData.dias_entre_cuotas),
        dias_credito: parseInt(formData.dias_credito),
        porcentaje_impuesto: parseFloat(formData.porcentaje_impuesto),
        tipo_cambio: requiereConversion ? parseFloat(formData.tipo_cambio) : 1.0,
        contacto_proveedor: formData.contacto_proveedor || null,
        direccion_entrega: formData.direccion_entrega || null,
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
        setError(response.data.error || 'Error al crear compra');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al crear compra');
    } finally {
      setLoading(false);
    }
  };

  const formatearMoneda = (valor, moneda = null) => {
    const monedaUsar = moneda || formData.moneda;
    const simbolo = monedaUsar === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor).toFixed(2)}`;
  };

  const getCuotasProximasVencer = () => {
    const hoy = new Date();
    const proximas = cronograma.filter(c => {
      const diasDiff = Math.ceil((c.fecha - hoy) / (1000 * 60 * 60 * 24));
      return diasDiff >= 0 && diasDiff <= 7;
    });
    return proximas;
  };

  if (loading && proveedores.length === 0) return <Loading message="Cargando formulario..." />;

  const montoConvertido = calcularMontoConversion();
  const cuotasProximasVencer = getCuotasProximasVencer();

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button className="btn btn-outline" onClick={() => navigate('/compras')}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart size={32} />
            Nueva Compra
          </h1>
          <p className="text-muted">Ingreso de mercadería y cuenta por pagar</p>
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
                                    <p className="text-xs text-blue-600 mt-1">{proveedorSeleccionado.direccion}</p>
                                </div>
                                <button type="button" className="btn btn-sm btn-outline bg-white" 
                                    onClick={() => {
                                        setProveedorSeleccionado(null);
                                        setFormData({ ...formData, id_proveedor: '', contacto_proveedor: '' });
                                    }}>
                                    Cambiar
                                </button>
                            </div>
                        ) : (
                            <button type="button" className="btn btn-primary w-full py-3 border-dashed border-2" onClick={() => setModalProveedorOpen(true)}>
                                <Search size={20} /> Seleccionar Proveedor
                            </button>
                        )}
                        {proveedorSeleccionado && (
                            <div className="mt-4 grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label text-xs">Contacto</label>
                                    <input type="text" className="form-input form-input-sm" 
                                        value={formData.contacto_proveedor}
                                        onChange={(e) => setFormData({ ...formData, contacto_proveedor: e.target.value })}
                                        placeholder="Nombre del contacto"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label text-xs">Fecha Registro (Sistema)</label>
                                    <input type="date" className="form-input form-input-sm" 
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
                      <FileText size={18} /> Datos del Documento (Físico)
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
                          <option value="Guia Remision">Guía Remisión</option>
                          <option value="Nota de Venta">Nota de Venta</option>
                          <option value="Recibo por Honorarios">Recibo por Honorarios</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label text-xs">Serie</label>
                        <input 
                          type="text" 
                          className="form-input form-input-sm"
                          value={formData.serie_documento}
                          onChange={(e) => setFormData({ ...formData, serie_documento: e.target.value.toUpperCase() })}
                          placeholder="F001"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label text-xs">Número</label>
                        <input 
                          type="text" 
                          className="form-input form-input-sm"
                          value={formData.numero_documento}
                          onChange={(e) => setFormData({ ...formData, numero_documento: e.target.value })}
                          placeholder="00012345"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label text-xs">Fecha Emisión Doc.</label>
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
                                <DollarSign size={18} /> Moneda de la Factura
                            </h2>
                        </div>
                        <div className="card-body">
                            <div className="grid grid-cols-2 gap-3">
                                <button type="button"
                                    className={`p-4 border rounded-lg text-center transition ${formData.moneda === 'PEN' ? 'bg-green-50 border-green-500 text-green-700 ring-2 ring-green-500' : 'hover:bg-gray-50'}`}
                                    onClick={() => setFormData({...formData, moneda: 'PEN'})}>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="font-bold text-xl">S/</div>
                                        <span className="font-bold">Soles (PEN)</span>
                                    </div>
                                </button>
                                <button type="button"
                                    className={`p-4 border rounded-lg text-center transition ${formData.moneda === 'USD' ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}
                                    onClick={() => setFormData({...formData, moneda: 'USD'})}>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="font-bold text-xl">$</div>
                                        <span className="font-bold">Dólares (USD)</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {formData.moneda && (
                    <div className="card">
                        <div className="card-header bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <h2 className="card-title flex items-center gap-2">
                                <MapPin size={18} /> Detalle de Productos
                            </h2>
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <select className="form-select text-xs w-full md:w-48"
                                    value={formData.tipo_recepcion}
                                    onChange={(e) => setFormData({...formData, tipo_recepcion: e.target.value})}>
                                    <option value="Total">Recepción Total</option>
                                    <option value="Parcial">Recepción Parcial</option>
                                    <option value="Ninguna">Solo Orden (Sin Recepción)</option>
                                </select>
                                <button type="button" className="btn btn-sm btn-primary whitespace-nowrap" 
                                    onClick={() => setModalProductoOpen(true)}>
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
                                                    <th className="w-24 text-right bg-blue-50 text-blue-800">A Recibir</th>
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
                                                        <input type="number" className="form-input text-right h-8 text-sm"
                                                            value={item.cantidad} onChange={(e) => handleCantidadChange(index, e.target.value)}
                                                            min="0" step="0.01" />
                                                    </td>
                                                    {formData.tipo_recepcion === 'Parcial' && (
                                                        <td className="bg-blue-50/30">
                                                            <input type="number" className="form-input text-right h-8 text-sm border-blue-300 focus:ring-blue-200"
                                                                value={item.cantidad_a_recibir} onChange={(e) => handleCantidadRecibirChange(index, e.target.value)}
                                                                min="0" max={item.cantidad} step="0.01" />
                                                        </td>
                                                    )}
                                                    <td>
                                                        <input type="number" className="form-input text-right h-8 text-sm"
                                                            value={item.precio_unitario} onChange={(e) => handlePrecioChange(index, e.target.value)}
                                                            min="0" step="0.01" />
                                                    </td>
                                                    <td>
                                                        <input type="number" className="form-input text-center h-8 text-sm"
                                                            value={item.descuento_porcentaje} onChange={(e) => handleDescuentoChange(index, e.target.value)}
                                                            min="0" max="100" />
                                                    </td>
                                                    <td className="text-right font-bold text-gray-700">
                                                        {formatearMoneda(calcularSubtotalItem(item))}
                                                    </td>
                                                    <td className="text-center">
                                                        <button type="button" className="text-red-500 hover:bg-red-50 p-1 rounded" 
                                                            onClick={() => handleEliminarProducto(index)}>
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
                                        <span className="text-muted">
                                            <select className="bg-transparent border-none p-0 text-sm focus:ring-0 cursor-pointer text-muted font-medium"
                                                value={formData.tipo_impuesto} onChange={(e) => setFormData({...formData, tipo_impuesto: e.target.value})}>
                                                <option value="IGV">IGV (18%)</option>
                                                <option value="EXO">Exonerado</option>
                                                <option value="INA">Inafecto</option>
                                            </select>
                                        </span>
                                        <span>{formatearMoneda(totales.igv)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold text-primary pt-2 border-t border-gray-200">
                                        <span>Total:</span>
                                        <span>{formatearMoneda(totales.total)}</span>
                                    </div>
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
                            <div className="card-header bg-gray-50/50">
                                <h2 className="card-title flex items-center gap-2">
                                    <Wallet size={18} /> Método de Pago
                                </h2>
                            </div>
                            <div className="card-body space-y-4">
                                <div className="form-group">
                                    <label className="form-label text-xs">Cuenta de Origen</label>
                                    <select className="form-select" value={formData.id_cuenta_pago}
                                        onChange={(e) => setFormData({ ...formData, id_cuenta_pago: e.target.value })} required>
                                        <option value="">Seleccionar cuenta...</option>
                                        {cuentasPago.map(c => (
                                            <option key={c.id_cuenta} value={c.id_cuenta}>
                                                {c.nombre} ({c.moneda}) - {c.tipo}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {cuentaSeleccionada && (
                                    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-muted">Saldo/Cupo:</span>
                                            <span className="font-bold">{formatearMoneda(cuentaSeleccionada.saldo_actual, cuentaSeleccionada.moneda)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted">Moneda Cuenta:</span>
                                            <span className="font-bold">{cuentaSeleccionada.moneda}</span>
                                        </div>
                                    </div>
                                )}

                                {requiereConversion && (
                                    <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 space-y-3">
                                        <div className="flex items-center gap-2 text-orange-700">
                                            <ArrowRightLeft size={16} />
                                            <span className="font-bold text-sm">Conversión Requerida</span>
                                        </div>
                                        <div className="text-xs text-orange-600">
                                            <p>Factura: {formData.moneda} → Pago: {cuentaSeleccionada.moneda}</p>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label text-xs">Tipo de Cambio *</label>
                                            <input 
                                                type="number" 
                                                className="form-input text-center font-bold" 
                                                value={formData.tipo_cambio}
                                                onChange={(e) => setFormData({...formData, tipo_cambio: e.target.value})}
                                                placeholder="Ej: 3.75"
                                                step="0.0001"
                                                min="0"
                                                required
                                            />
                                        </div>
                                        {montoConvertido && (
                                            <div className="bg-white rounded p-2 text-center border border-orange-200">
                                                <p className="text-xs text-muted mb-1">Monto a descontar</p>
                                                <p className="font-bold text-orange-700">
                                                    {formatearMoneda(montoConvertido, cuentaSeleccionada.moneda)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" 
                                        className={`p-3 border rounded-lg text-center transition ${formData.tipo_compra === 'Contado' ? 'bg-green-50 border-green-500 text-green-700 ring-1 ring-green-500' : 'hover:bg-gray-50'}`}
                                        onClick={() => handleTipoCompraChange('Contado')}>
                                        <div className="flex flex-col items-center gap-1">
                                            <Wallet size={20} />
                                            <span className="font-bold text-sm">Contado</span>
                                        </div>
                                    </button>
                                    <button type="button" 
                                        className={`p-3 border rounded-lg text-center transition ${formData.tipo_compra === 'Credito' ? 'bg-orange-50 border-orange-500 text-orange-700 ring-1 ring-orange-500' : 'hover:bg-gray-50'}`}
                                        onClick={() => handleTipoCompraChange('Credito')}>
                                        <div className="flex flex-col items-center gap-1">
                                            <CreditCard size={20} />
                                            <span className="font-bold text-sm">Crédito</span>
                                        </div>
                                    </button>
                                </div>

                                {formData.tipo_compra === 'Contado' && cuentaSeleccionada && (
                                    <div className={`text-xs p-2 rounded border ${
                                        montoConvertido 
                                            ? (parseFloat(cuentaSeleccionada.saldo_actual) >= montoConvertido ? 'bg-green-100 border-green-200 text-green-800' : 'bg-red-100 border-red-200 text-red-800')
                                            : (parseFloat(cuentaSeleccionada.saldo_actual) >= totales.total ? 'bg-green-100 border-green-200 text-green-800' : 'bg-red-100 border-red-200 text-red-800')
                                    }`}>
                                            {(() => {
                                                const montoRequerido = montoConvertido || totales.total;
                                                const suficiente = parseFloat(cuentaSeleccionada.saldo_actual) >= montoRequerido;
                                                return suficiente 
                                                    ? 'Saldo disponible suficiente.' 
                                                    : `Saldo insuficiente. Faltan ${formatearMoneda(montoRequerido - parseFloat(cuentaSeleccionada.saldo_actual), cuentaSeleccionada.moneda)}`;
                                            })()}
                                    </div>
                                )}

                                {formData.tipo_compra === 'Credito' && (
                                    <div className="space-y-3 pt-2 border-t animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Calculator size={16} className="text-orange-600" />
                                            <span className="font-bold text-sm text-gray-800">Plan de Pagos</span>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="form-group">
                                                <label className="form-label text-[10px] uppercase text-gray-500">N° Cuotas</label>
                                                <input type="number" className="form-input text-center font-bold" min="1"
                                                    value={formData.numero_cuotas} 
                                                    onChange={(e) => setFormData({...formData, numero_cuotas: e.target.value})} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label text-[10px] uppercase text-gray-500">Frecuencia (Días)</label>
                                                <input type="number" className="form-input text-center" min="1"
                                                    value={formData.dias_entre_cuotas} 
                                                    onChange={(e) => setFormData({...formData, dias_entre_cuotas: e.target.value})} />
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label text-[10px] uppercase text-gray-500">1° Vencimiento</label>
                                            <input type="date" className="form-input" 
                                                value={formData.fecha_primera_cuota}
                                                onChange={(e) => setFormData({...formData, fecha_primera_cuota: e.target.value})} />
                                            <small className="text-[10px] text-muted block mt-1">
                                                Por defecto: {formData.dias_entre_cuotas} días después de emisión
                                            </small>
                                        </div>

                                        <div className="bg-white border rounded-lg overflow-hidden text-xs mt-3">
                                            <div className="bg-gray-100 p-2 font-bold text-center border-b flex justify-between items-center">
                                                <span>Simulación</span>
                                                <span className="text-orange-600">{formData.dias_credito} días total</span>
                                            </div>
                                            <div className="max-h-40 overflow-y-auto">
                                                <table className="w-full">
                                                    <tbody>
                                                        {cronograma.map((cuota, idx) => {
                                                            const hoy = new Date();
                                                            const diasDiff = Math.ceil((cuota.fecha - hoy) / (1000 * 60 * 60 * 24));
                                                            const esProximo = diasDiff >= 0 && diasDiff <= 7;
                                                            
                                                            return (
                                                                <tr key={idx} className={`border-b last:border-0 ${esProximo ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                                                                    <td className="p-2 text-center font-bold text-gray-500">#{cuota.numero}</td>
                                                                    <td className="p-2 text-center">
                                                                        <div>{cuota.fecha.toLocaleDateString('es-PE')}</div>
                                                                        {esProximo && <div className="text-[9px] text-yellow-600 font-bold">Próxima semana</div>}
                                                                    </td>
                                                                    <td className="p-2 text-right font-medium">{formatearMoneda(cuota.monto)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {cuotasProximasVencer.length > 0 && (
                                            <div className="bg-yellow-50 border border-yellow-300 rounded p-2 text-xs text-yellow-800">
                                                <div className="flex items-center gap-1 mb-1">
                                                    <AlertCircle size={12} />
                                                    <span className="font-bold">Alerta de vencimiento</span>
                                                </div>
                                                <p>{cuotasProximasVencer.length} cuota(s) vencen en los próximos 7 días</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-body">
                                <div className="form-group mb-3">
                                    <label className="form-label text-xs">Dirección Entrega</label>
                                    <textarea className="form-textarea text-sm" rows="2"
                                        value={formData.direccion_entrega}
                                        onChange={(e) => setFormData({...formData, direccion_entrega: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label text-xs">Notas / Observaciones</label>
                                    <textarea className="form-textarea text-sm" rows="2"
                                        value={formData.observaciones}
                                        onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                                        placeholder="Ej: Entregar por la mañana..." />
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary w-full py-3 shadow-lg shadow-blue-200" disabled={loading}>
                            {loading ? 'Procesando...' : (
                                <span className="flex items-center justify-center gap-2">
                                    <Save size={18} /> Guardar Compra
                                </span>
                            )}
                        </button>
                    </>
                )}
            </div>
        </div>
      </form>

      <Modal
        isOpen={modalProveedorOpen}
        onClose={() => setModalProveedorOpen(false)}
        title="Seleccionar Proveedor"
        size="lg"
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {proveedores.map((prov) => (
            <div
              key={prov.id_proveedor}
              className="p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition flex justify-between items-center"
              onClick={() => handleSelectProveedor(prov)}
            >
              <div>
                <div className="font-bold text-blue-900">{prov.razon_social}</div>
                <div className="text-xs text-muted mt-1">RUC: {prov.ruc}</div>
              </div>
              <div className="text-right text-xs text-muted">
                {prov.direccion}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={modalProductoOpen}
        onClose={() => setModalProductoOpen(false)}
        title="Seleccionar Producto"
        size="xl"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {productos.length === 0 ? (
                <div className="text-center py-8 text-muted">No hay productos disponibles</div>
            ) : (
                productos.map((prod) => (
                    <div key={prod.id_producto} className="p-3 border rounded-lg hover:bg-gray-50 transition flex justify-between items-center group">
                        <div className="cursor-pointer flex-1" onClick={() => handleSelectProducto(prod)}>
                            <div className="font-bold text-gray-800 text-sm">[{prod.codigo}] {prod.nombre}</div>
                            <div className="text-xs text-muted flex gap-2 mt-1">
                                <span className="bg-gray-100 px-2 py-0.5 rounded">{prod.unidad_medida}</span>
                                <span>Stock: {parseFloat(prod.stock_actual || 0).toFixed(2)}</span>
                            </div>
                        </div>
                        <button type="button" className="btn btn-xs btn-outline opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); handleVerHistorial(prod); }}>
                            <Clock size={14} /> Historial
                        </button>
                    </div>
                ))
            )}
        </div>
      </Modal>

      <Modal
        isOpen={modalHistorialOpen}
        onClose={() => { setModalHistorialOpen(false); setProductoHistorial(null); setHistorialCompras(null); }}
        title={productoHistorial ? `Historial: ${productoHistorial.nombre}` : 'Historial'}
        size="xl"
      >
        {loadingHistorial ? <Loading message="Cargando historial..." /> : historialCompras ? (
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-blue-50 p-2 rounded">
                        <span className="block text-muted">Promedio</span>
                        <span className="font-bold text-blue-700">S/ {historialCompras.estadisticas.precio_promedio.toFixed(2)}</span>
                    </div>
                    <div className="bg-green-50 p-2 rounded">
                        <span className="block text-muted">Mínimo</span>
                        <span className="font-bold text-green-700">S/ {historialCompras.estadisticas.precio_minimo.toFixed(2)}</span>
                    </div>
                    <div className="bg-red-50 p-2 rounded">
                        <span className="block text-muted">Máximo</span>
                        <span className="font-bold text-red-700">S/ {historialCompras.estadisticas.precio_maximo.toFixed(2)}</span>
                    </div>
                </div>
                
                <table className="table text-xs">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Proveedor</th>
                            <th className="text-right">Precio</th>
                            <th className="text-right">Cant.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {historialCompras.historial.map((h, i) => (
                            <tr key={i}>
                                <td>{new Date(h.fecha_emision).toLocaleDateString()}</td>
                                <td>{h.proveedor}</td>
                                <td className="text-right font-bold">S/ {parseFloat(h.precio_unitario).toFixed(2)}</td>
                                <td className="text-right">{parseFloat(h.cantidad).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : <div className="text-center py-4 text-muted">No hay historial disponible</div>}
      </Modal>
    </div>
  );
}

export default NuevaCompra;