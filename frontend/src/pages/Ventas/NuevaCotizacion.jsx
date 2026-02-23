import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash2, Save, Search,
  Calculator, FileText, Building,
  Calendar, RefreshCw, AlertCircle, Info, Lock, ExternalLink,
  Building2, User, Loader, CheckCircle, CreditCard, DollarSign, MapPin, 
  Package, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { cotizacionesAPI, clientesAPI, productosAPI, empleadosAPI, dashboard, listasPreciosAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const TIPOS_IMPUESTO = [
  { codigo: 'IGV', nombre: 'IGV 18%', porcentaje: 18.00 },
  { codigo: 'EXO', nombre: 'Exonerado 0%', porcentaje: 0.00 },
  { codigo: 'INA', nombre: 'Inafecto 0%', porcentaje: 0.00 }
];

const PLAZOS_PAGO = [
  'Contado',
  'Credito 7 Dias',
  'Credito 15 Dias',
  'Credito 30 Dias',
  'Credito 45 Dias',
  'Credito 60 Dias',
  'Credito 90 Dias'
];

const FORMAS_PAGO = [
  'Transferencia Bancaria',
  'Efectivo',
  'Yape'
];

const PLAZOS_ENTREGA = [
  'Inmediata (Stock)',
  '2 a 3 Dias Habiles',
  '5 a 7 Dias Habiles',
  '7 a 10 Dias Habiles',
  '10 a 15 Dias Habiles',
  '15 a 20 Dias Habiles',
  '25 a 30 Dias Habiles'
];

function NuevaCotizacion() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
    
  const modoEdicion = !!id;
  const modoDuplicar = location.state?.duplicar === true;
    
  const [loading, setLoading] = useState(false);
  const [loadingTC, setLoadingTC] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [cotizacionConvertida, setCotizacionConvertida] = useState(false);
  const [idOrdenVenta, setIdOrdenVenta] = useState(null);
  const [esMuestra, setEsMuestra] = useState(false);
    
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [comerciales, setComerciales] = useState([]);
    
  const [tipoCambio, setTipoCambio] = useState(null);
  const [tipoCambioFecha, setTipoCambioFecha] = useState(null);
    
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [modalProductoOpen, setModalProductoOpen] = useState(false);
    
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
    
  const [tabCliente, setTabCliente] = useState('lista');
  const [nuevoClienteDoc, setNuevoClienteDoc] = useState({ tipo: 'RUC', numero: '' });
  const [clienteApiData, setClienteApiData] = useState(null);
  const [loadingApi, setLoadingApi] = useState(false);
  const [errorApi, setErrorApi] = useState(null);

  const [modalDireccionOpen, setModalDireccionOpen] = useState(false);
  const [nuevaDireccion, setNuevaDireccion] = useState({ direccion: '', referencia: '' });
  const [savingDireccion, setSavingDireccion] = useState(false);

  const [listasPreciosCliente, setListasPreciosCliente] = useState([]);
  const [loadingListas, setLoadingListas] = useState(false);
  const [detallesListas, setDetallesListas] = useState({});
  const [listasDesplegadas, setListasDesplegadas] = useState({});
  const [busquedaLista, setBusquedaLista] = useState('');

  const handleWheelDisable = (e) => {
    e.target.blur();
  };

  const getFechaPeru = () => {
    const now = new Date();
    const peruDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const year = peruDate.getFullYear();
    const month = String(peruDate.getMonth() + 1).padStart(2, '0');
    const day = String(peruDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
    
  const [formCabecera, setFormCabecera] = useState({
    id_cliente: '',
    id_comercial: user?.id_empleado || '',
    fecha_emision: getFechaPeru(),
    moneda: 'PEN',
    tipo_impuesto: 'IGV',
    porcentaje_impuesto: 18.00,
    tipo_cambio: 1.0000,
    plazo_pago: 'Contado',
    forma_pago: '',
    direccion_entrega: '',
    observaciones: 'OBSERVACIONES\nPlazo de entrega: 1-2 DIAS CONFIRMADO EL ABONO\nLugar de entrega: RECOJO\nValidez de la oferta: 7 DIAS / DE ACUERDO AL PRECIO DE LA MATERIA PRIMA',
    validez_dias: 7,
    plazo_entrega: '',
    lugar_entrega: ''
  });
    
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [direccionesCliente, setDireccionesCliente] = useState([]);
  const [estadoCredito, setEstadoCredito] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [totales, setTotales] = useState({ subtotal: 0, impuesto: 0, total: 0 });
    
  const [fechaVencimientoCalculada, setFechaVencimientoCalculada] = useState('');

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 3 
    }).format(valor);
  };

  const formatearMonedaGral = (valor) => {
    const simbolo = formCabecera.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    if (modoEdicion || modoDuplicar) {
      cargarCotizacion();
    }
  }, [id, modoEdicion, modoDuplicar]);

  useEffect(() => {
    if (location.state?.productosPreseleccionados && location.state?.clientePreseleccionado) {
      const cliente = location.state.clientePreseleccionado;
      setClienteSeleccionado(cliente);
      setFormCabecera(prev => ({
          ...prev,
          id_cliente: cliente.id_cliente,
          moneda: location.state.productosPreseleccionados[0].moneda || 'PEN'
      }));
      setDetalle(location.state.productosPreseleccionados);
      
      clientesAPI.getById(cliente.id_cliente).then(res => {
          if (res.data.success) {
              const data = res.data.data;
              setDireccionesCliente(data.direcciones || []);
              setFormCabecera(prev => ({ ...prev, lugar_entrega: data.direccion_despacho || '' }));
          }
      });
      clientesAPI.getEstadoCredito(cliente.id_cliente).then(res => {
          if (res.data.success) setEstadoCredito(res.data.data);
      });
      cargarListasPrecios(cliente.id_cliente);
    }
  }, [location.state]);

  useEffect(() => {
    calcularTotales();
  }, [detalle, formCabecera.porcentaje_impuesto]);

  useEffect(() => {
    if (formCabecera.validez_dias && formCabecera.fecha_emision) {
      const fechaEmision = new Date(formCabecera.fecha_emision + 'T12:00:00');
      fechaEmision.setDate(fechaEmision.getDate() + parseInt(formCabecera.validez_dias));
      setFechaVencimientoCalculada(fechaEmision.toISOString().split('T')[0]);
    }
  }, [formCabecera.fecha_emision, formCabecera.validez_dias]);

  useEffect(() => {
    if (formCabecera.moneda === 'USD') {
      obtenerTipoCambio();
    } else {
      setFormCabecera(prev => ({ ...prev, tipo_cambio: 1.0000 }));
      setTipoCambio(null);
      setTipoCambioFecha(null);
    }
  }, [formCabecera.moneda]);

  const cargarCatalogos = async () => {
    try {
      setLoading(true);
      const resClientes = await clientesAPI.getAll({ estado: 'Activo' });
      if (resClientes.data.success) {
        setClientes(resClientes.data.data || []);
      }
      const resProductos = await productosAPI.getAll({ 
        id_tipo_inventario: 3,
        estado: 'Activo'
      });
      if (resProductos.data.success) {
        setProductos(resProductos.data.data || []);
      }
      const resComerciales = await empleadosAPI.getAll({ estado: 'Activo' });
      if (resComerciales.data.success) {
        const vendedores = (resComerciales.data.data || []).filter(
          emp => ['ventas', 'comercial'].includes(emp.rol?.toLowerCase())
        );
        setComerciales(vendedores);
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar catalogos');
    } finally {
      setLoading(false);
    }
  };

  const cargarCotizacion = async () => {
    try {
      setLoading(true);
      const response = await cotizacionesAPI.getById(id);
      if (response.data.success) {
        const cotizacion = response.data.data;
        if (modoEdicion && cotizacion.convertida_venta) {
          setCotizacionConvertida(true);
          setIdOrdenVenta(cotizacion.id_orden_venta);
        }
        const fechaEmision = modoDuplicar ? getFechaPeru() : cotizacion.fecha_emision.split('T')[0];
        setEsMuestra(cotizacion.es_muestra === 1);
        setFormCabecera({
          id_cliente: cotizacion.id_cliente,
          id_comercial: cotizacion.id_comercial || user?.id_empleado || '',
          fecha_emision: fechaEmision,
          moneda: cotizacion.moneda,
          tipo_impuesto: cotizacion.tipo_impuesto,
          porcentaje_impuesto: cotizacion.porcentaje_impuesto,
          tipo_cambio: cotizacion.tipo_cambio,
          plazo_pago: cotizacion.plazo_pago || 'Contado',
          forma_pago: cotizacion.forma_pago || '',
          direccion_entrega: cotizacion.direccion_entrega || '',
          observaciones: cotizacion.observaciones || '',
          validez_dias: cotizacion.validez_dias || 7,
          plazo_entrega: cotizacion.plazo_entrega || '',
          lugar_entrega: cotizacion.lugar_entrega || ''
        });
        
        const resCli = await clientesAPI.getById(cotizacion.id_cliente);
        if (resCli.data.success) {
          const clienteData = resCli.data.data;
          setClienteSeleccionado(clienteData);
          cargarListasPrecios(clienteData.id_cliente);
          
          if (clienteData.direcciones && clienteData.direcciones.length > 0) {
            setDireccionesCliente(clienteData.direcciones);
          } else if (clienteData.direccion_despacho) {
            setDireccionesCliente([{ id_direccion: 'principal', direccion: clienteData.direccion_despacho, es_principal: 1 }]);
          }

          try {
            const resCredito = await clientesAPI.getEstadoCredito(cotizacion.id_cliente);
            if (resCredito.data.success) {
              setEstadoCredito(resCredito.data.data);
            }
          } catch (err) {
            console.error('Error al cargar estado de credito:', err);
          }
        }

        if (cotizacion.detalle && cotizacion.detalle.length > 0) {
          setDetalle(cotizacion.detalle.map(item => ({
            id_producto: item.id_producto || null,
            codigo_producto: item.codigo_producto || item.codigo_producto_libre || '',
            producto: item.producto || item.nombre_producto_libre || '',
            unidad_medida: item.unidad_medida || '',
            cantidad: parseFloat(item.cantidad),
            precio_base: parseFloat(item.precio_base || item.precio_unitario || 0),
            precio_venta: parseFloat(item.precio_unitario || 0),
            descuento_porcentaje: parseFloat(item.descuento_porcentaje || 0),
            stock_actual: item.stock_disponible || null,
            es_producto_libre: item.es_producto_libre === 1,
            codigo_producto_libre: item.codigo_producto_libre || '',
            nombre_producto_libre: item.nombre_producto_libre || ''
          })));
        }
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar la cotizacion');
    } finally {
      setLoading(false);
    }
  };

  const cargarListasPrecios = async (idCliente) => {
    try {
      setLoadingListas(true);
      const res = await listasPreciosAPI.getByCliente(idCliente);
      if (res.data.success) {
        setListasPreciosCliente(res.data.data);
        
        const detalles = {};
        for (const lista of res.data.data) {
          const resDetalle = await listasPreciosAPI.getDetalle(lista.id_lista);
          if (resDetalle.data.success) {
            detalles[lista.id_lista] = resDetalle.data.data;
          }
        }
        setDetallesListas(detalles);
      }
    } catch (err) {
      console.error('Error cargando listas de precios', err);
    } finally {
      setLoadingListas(false);
    }
  };

  const toggleListaDesplegada = (idLista) => {
    setListasDesplegadas(prev => ({
      ...prev,
      [idLista]: !prev[idLista]
    }));
  };

  const obtenerTipoCambio = async () => {
    try {
      setLoadingTC(true);
      const response = await dashboard.actualizarTipoCambio({
        currency: 'USD',
        date: formCabecera.fecha_emision
      });
      if (response.data.success && response.data.data) {
        const tc = response.data.data;
        const valorTC = tc.venta || tc.compra || tc.tipo_cambio || 3.80;
        setTipoCambio(valorTC);
        setTipoCambioFecha(tc.fecha || formCabecera.fecha_emision);
        setFormCabecera(prev => ({
          ...prev,
          tipo_cambio: parseFloat(valorTC).toFixed(4)
        }));
      }
    } catch (err) {
      console.error(err);
      setFormCabecera(prev => ({ ...prev, tipo_cambio: 3.80 }));
    } finally {
      setLoadingTC(false);
    }
  };

  const handleSelectCliente = async (cliente) => {
    try {
      const resFullCliente = await clientesAPI.getById(cliente.id_cliente);
      const clienteCompleto = resFullCliente.data.data;
      
      setClienteSeleccionado(clienteCompleto);
      cargarListasPrecios(clienteCompleto.id_cliente);
      
      let direcciones = [];
      if (clienteCompleto.direcciones && clienteCompleto.direcciones.length > 0) {
        direcciones = clienteCompleto.direcciones;
      } else if (clienteCompleto.direccion_despacho) {
        direcciones = [{ id_direccion: 'principal', direccion: clienteCompleto.direccion_despacho, es_principal: 1 }];
      }
      setDireccionesCliente(direcciones);

      const direccionPrincipal = direcciones.find(d => d.es_principal) || direcciones[0];

      const condicion = clienteCompleto.condicion_pago || 'Contado';
const diasCredito = parseInt(clienteCompleto.dias_credito || 0);

let plazoPago = 'Contado';
if (condicion === 'Credito' && clienteCompleto.usar_limite_credito && diasCredito > 0) {
  plazoPago = `Credito ${diasCredito} Dias`;
  if (!PLAZOS_PAGO.includes(plazoPago)) {
    plazoPago = `Credito ${diasCredito} Dias`;
  }
}

setFormCabecera(prev => ({
  ...prev,
  id_cliente: clienteCompleto.id_cliente,
  lugar_entrega: direccionPrincipal ? direccionPrincipal.direccion : '',
  plazo_pago: plazoPago
}));
      const resCredito = await clientesAPI.getEstadoCredito(clienteCompleto.id_cliente);
      if (resCredito.data.success) {
        setEstadoCredito(resCredito.data.data);
      }
    } catch (err) {
      console.error('Error al cargar datos completos del cliente:', err);
      setClienteSeleccionado(cliente);
      const condicionFallback = cliente.condicion_pago || 'Contado';
const diasFallback = parseInt(cliente.dias_credito || 0);
const plazoPagoFallback = (condicionFallback === 'Credito' && cliente.usar_limite_credito && diasFallback > 0)
  ? `Credito ${diasFallback} Dias`
  : 'Contado';

setFormCabecera(prev => ({
  ...prev,
  id_cliente: cliente.id_cliente,
  lugar_entrega: cliente.direccion_despacho || '',
  plazo_pago: plazoPagoFallback
}));
    }
    
    setModalClienteOpen(false);
    setBusquedaCliente('');
  };

  const validarClienteExterno = async () => {
    const documento = nuevoClienteDoc.numero.trim();
    const tipo = nuevoClienteDoc.tipo;
    if (!documento) {
      setErrorApi(`Ingrese un ${tipo} para validar`);
      return;
    }
    if (tipo === 'RUC' && !/^\d{11}$/.test(documento)) {
      setErrorApi('El RUC debe tener 11 digitos');
      return;
    }
    if (tipo === 'DNI' && !/^\d{8}$/.test(documento)) {
      setErrorApi('El DNI debe tener 8 digitos');
      return;
    }
    try {
      setLoadingApi(true);
      setErrorApi(null);
      setClienteApiData(null);
      const response = tipo === 'RUC' 
        ? await clientesAPI.validarRUC(documento)
        : await clientesAPI.validarDNI(documento);
      if (response.data.valido) {
        setClienteApiData({
          ...response.data.datos,
          tipo_documento: tipo,
          documento: documento
        });
        if (response.data.ya_registrado) {
          setErrorApi(`Este ${tipo} ya esta registrado en el sistema`);
        }
      } else {
        setErrorApi(response.data.error || `${tipo} no valido`);
      }
    } catch (err) {
      setErrorApi(err.error || `Error al validar ${tipo}`);
    } finally {
      setLoadingApi(false);
    }
  };

  const crearYSeleccionarCliente = async () => {
    if (!clienteApiData) return;
    try {
      setLoadingApi(true);
      const direccionCompleta = clienteApiData.direccion 
        ? [clienteApiData.direccion, clienteApiData.distrito, clienteApiData.provincia, clienteApiData.departamento].filter(Boolean).join(', ')
        : '';
      const nuevoCliente = {
        tipo_documento: nuevoClienteDoc.tipo,
        ruc: nuevoClienteDoc.numero,
        razon_social: clienteApiData.razon_social || clienteApiData.nombre_completo,
        direccion_despacho: direccionCompleta,
        estado: 'Activo',
        validar_documento: false
      };
      const response = await clientesAPI.create(nuevoCliente);
      if (response.data.success) {
        const clienteCreado = response.data.data;
        setClientes(prev => [...prev, clienteCreado]);
        handleSelectCliente(clienteCreado);
        setSuccess('Cliente creado y seleccionado automaticamente');
        setModalClienteOpen(false);
        setTabCliente('lista');
        setNuevoClienteDoc({ tipo: 'RUC', numero: '' });
        setClienteApiData(null);
      }
    } catch (err) {
      console.error(err);
      setErrorApi('Error al crear el cliente automaticamente');
    } finally {
      setLoadingApi(false);
    }
  };

  const handleAgregarProducto = (producto) => {
    const existe = detalle.find(d => d.id_producto === producto.id_producto);
    if (existe) {
      setError('El producto ya esta en el detalle');
      return;
    }
    const precioVenta = parseFloat(producto.precio_venta || 0);
    const nuevoItem = {
      id_producto: producto.id_producto,
      codigo_producto: producto.codigo,
      producto: producto.nombre,
      unidad_medida: producto.unidad_medida,
      cantidad: 1,
      precio_base: precioVenta,
      precio_venta: precioVenta,
      descuento_porcentaje: 0,
      stock_actual: producto.stock_actual,
      es_producto_libre: false,
      codigo_producto_libre: null,
      nombre_producto_libre: null
    };
    setDetalle([...detalle, nuevoItem]);
    setModalProductoOpen(false);
    setBusquedaProducto('');
  };

  const handleAgregarProductoLibre = () => {
    const nuevoItem = {
      id_producto: null,
      codigo_producto: '',
      producto: '',
      unidad_medida: '',
      cantidad: 1,
      precio_base: 0,
      precio_venta: 0,
      descuento_porcentaje: 0,
      stock_actual: null,
      es_producto_libre: true,
      codigo_producto_libre: '',
      nombre_producto_libre: ''
    };
    setDetalle([...detalle, nuevoItem]);
  };

  const handleProductoLibreChange = (index, campo, valor) => {
    const newDetalle = [...detalle];
    newDetalle[index][campo] = valor;
    if (campo === 'codigo_producto_libre') newDetalle[index].codigo_producto = valor;
    if (campo === 'nombre_producto_libre') newDetalle[index].producto = valor;
    setDetalle(newDetalle);
  };

  const toggleProductoDesdeLista = (prod, monedaLista) => {
    const existeIndex = detalle.findIndex(d => d.id_producto === prod.id_producto);
    
    if (existeIndex >= 0) {
      const newDetalle = detalle.filter((_, i) => i !== existeIndex);
      setDetalle(newDetalle);
    } else {
      const precioLista = parseFloat(prod.precio_especial);
      const nuevoItem = {
        id_producto: prod.id_producto,
        codigo_producto: prod.codigo,
        producto: prod.producto,
        unidad_medida: prod.unidad_medida,
        cantidad: 1,
        precio_base: precioLista,
        precio_venta: precioLista,
        descuento_porcentaje: 0,
        stock_actual: 0,
        es_producto_libre: false,
        codigo_producto_libre: null,
        nombre_producto_libre: null
      };
      setDetalle([...detalle, nuevoItem]);
    }
  };

  const handlePrecioVentaChange = (index, valor) => {
    const newDetalle = [...detalle];
    const precioVenta = parseFloat(valor) || 0;
    newDetalle[index].precio_venta = precioVenta;
    
    const precioBase = parseFloat(newDetalle[index].precio_base) || 0;
    
    if (precioBase > 0) {
      const margen = ((precioVenta - precioBase) / precioBase) * 100;
      newDetalle[index].descuento_porcentaje = margen;
    } else {
      newDetalle[index].descuento_porcentaje = 0;
    }
    
    setDetalle(newDetalle);
  };

  const handleCantidadChange = (index, valor) => {
    const newDetalle = [...detalle];
    newDetalle[index].cantidad = parseFloat(valor) || 0;
    setDetalle(newDetalle);
  };

  const handleDescuentoChange = (index, valor) => {
    const newDetalle = [...detalle];
    const porcentaje = parseFloat(valor) || 0;
    newDetalle[index].descuento_porcentaje = porcentaje;
    
    const precioBase = parseFloat(newDetalle[index].precio_base) || 0;
    
    if (precioBase > 0) {
      const nuevoPrecioVenta = precioBase * (1 + (porcentaje / 100));
      newDetalle[index].precio_venta = parseFloat(nuevoPrecioVenta.toFixed(4));
    }
    
    setDetalle(newDetalle);
  };

  const handleEliminarItem = (index) => {
    const newDetalle = detalle.filter((_, i) => i !== index);
    setDetalle(newDetalle);
  };

  const calcularTotales = () => {
    let subtotal = 0;
    detalle.forEach(item => {
      const precioVenta = parseFloat(item.precio_venta) || 0;
      const valorVenta = item.cantidad * precioVenta;
      subtotal += valorVenta;
    });
    const porcentaje = parseFloat(formCabecera.porcentaje_impuesto) || 0;
    const impuesto = subtotal * (porcentaje / 100);
    const total = subtotal + impuesto;
    setTotales({ subtotal, impuesto, total });
  };

  const handleTipoImpuestoChange = (codigo) => {
    const tipoImpuesto = TIPOS_IMPUESTO.find(t => t.codigo === codigo);
    if (tipoImpuesto) {
      setFormCabecera(prev => ({
        ...prev,
        tipo_impuesto: codigo,
        porcentaje_impuesto: tipoImpuesto.porcentaje
      }));
    }
  };

  const handleGuardarDireccion = async () => {
    if (!nuevaDireccion.direccion.trim()) return;
    try {
      setSavingDireccion(true);
      const payload = {
        id_cliente: formCabecera.id_cliente,
        direccion: nuevaDireccion.direccion,
        referencia: nuevaDireccion.referencia
      };
      const response = await cotizacionesAPI.addDireccion(payload);
      if (response.data.success) {
        const nuevaDir = {
          id_direccion: response.data.data.id_direccion,
          direccion: response.data.data.direccion,
          es_principal: 0
        };
        setDireccionesCliente([...direccionesCliente, nuevaDir]);
        setFormCabecera(prev => ({ ...prev, lugar_entrega: nuevaDir.direccion }));
        setModalDireccionOpen(false);
        setNuevaDireccion({ direccion: '', referencia: '' });
        setSuccess('Direccion agregada correctamente');
      }
    } catch (err) {
      console.error(err);
      setError('Error al guardar la direccion');
    } finally {
      setSavingDireccion(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (cotizacionConvertida) {
      setError('No se puede editar una cotizacion que ya ha sido convertida a Orden de Venta');
      return;
    }
    if (!formCabecera.id_cliente) {
      setError('Debe seleccionar un cliente');
      return;
    }
    if (detalle.length === 0) {
      setError('Debe agregar al menos un producto');
      return;
    }

    if (esMuestra) {
      const itemsLibresSinCodigo = detalle.some(item => item.es_producto_libre && !item.codigo_producto_libre?.trim());
      if (itemsLibresSinCodigo) {
        setError('Todos los productos muestra deben tener un codigo');
        return;
      }
      const itemsLibresSinNombre = detalle.some(item => item.es_producto_libre && !item.nombre_producto_libre?.trim());
      if (itemsLibresSinNombre) {
        setError('Todos los productos muestra deben tener un nombre');
        return;
      }
    } else {
      const productosSinPrecio = detalle.some(item => !item.precio_venta || parseFloat(item.precio_venta) <= 0);
      if (productosSinPrecio) {
        setError('Todos los productos deben tener un precio de venta valido');
        return;
      }
    }

    if (!formCabecera.plazo_pago || formCabecera.plazo_pago.trim() === '') {
      setError('Plazo de pago es obligatorio (define el riesgo de la venta)');
      return;
    }
    try {
      setLoading(true);
      const payload = {
        id_cliente: parseInt(formCabecera.id_cliente),
        id_comercial: formCabecera.id_comercial ? parseInt(formCabecera.id_comercial) : null,
        fecha_emision: formCabecera.fecha_emision,
        moneda: formCabecera.moneda,
        tipo_impuesto: formCabecera.tipo_impuesto,
        porcentaje_impuesto: parseFloat(formCabecera.porcentaje_impuesto),
        tipo_cambio: parseFloat(formCabecera.tipo_cambio),
        plazo_pago: formCabecera.plazo_pago,
        forma_pago: formCabecera.forma_pago || null,
        direccion_entrega: formCabecera.direccion_entrega || null,
        lugar_entrega: formCabecera.lugar_entrega || null,
        plazo_entrega: formCabecera.plazo_entrega || null,
        validez_dias: parseInt(formCabecera.validez_dias) || 7,
        observaciones: formCabecera.observaciones || null,
        es_muestra: esMuestra,
        detalle: detalle.map((item, index) => {
          const precioVenta = parseFloat(item.precio_venta) || 0;
          const precioBase = parseFloat(item.precio_base) || precioVenta;

          return {
  id_producto: item.es_producto_libre ? null : item.id_producto,
  es_producto_libre: item.es_producto_libre || false,
  codigo_producto_libre: item.es_producto_libre ? item.codigo_producto_libre?.trim() : null,
  nombre_producto_libre: item.es_producto_libre ? item.nombre_producto_libre?.trim() : null,
  unidad_medida: item.unidad_medida || null,   // <- agregar esto
  cantidad: parseFloat(item.cantidad),
  precio_base: precioBase,
  precio_venta: precioVenta,
  descuento_porcentaje: parseFloat(item.descuento_porcentaje) || 0,
  orden: index + 1
};
        })
      };
      let response;
      if (modoEdicion) {
        response = await cotizacionesAPI.update(id, payload);
        if (response.data.success) {
          setSuccess('Cotizacion actualizada exitosamente');
          setTimeout(() => navigate(`/ventas/cotizaciones/${id}`), 1500);
        }
      } else {
        response = await cotizacionesAPI.create(payload);
        if (response.data.success) {
          setSuccess(`Cotizacion creada: ${response.data.data.numero_cotizacion}`);
          setTimeout(() => navigate(`/ventas/cotizaciones/${response.data.data.id_cotizacion}`), 1500);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || `Error al ${modoEdicion ? 'actualizar' : 'crear'} cotizacion`);
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

  if (loading && clientes.length === 0) {
    return <Loading message="Cargando formulario..." />;
  }

  const tituloFormulario = modoEdicion ? 'Editar Cotizacion' : modoDuplicar ? 'Duplicar Cotizacion' : 'Nueva Cotizacion';
  const subtituloFormulario = modoEdicion ? 'Modificar cotizacion existente' : modoDuplicar ? 'Crear nueva cotizacion basada en una existente' : 'Emitir cotizacion de venta al cliente';

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button className="btn btn-outline" onClick={() => navigate('/ventas/cotizaciones')}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText size={32} />
            {tituloFormulario}
            {esMuestra && (
              <span className="badge badge-warning ml-2 text-xs font-bold uppercase tracking-wide">
                Muestra
              </span>
            )}
            {cotizacionConvertida && (
              <span className="badge badge-primary ml-2">
                <Lock size={14} className="inline mr-1" />
                Convertida
              </span>
            )}
          </h1>
          <p className="text-muted">{subtituloFormulario}</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {cotizacionConvertida && (
        <Alert 
          type="info" 
          message={
            <div className="flex items-center justify-between">
              <span>Esta cotizacion ya fue convertida a Orden de Venta y no puede ser editada.</span>
              {idOrdenVenta && (
                <button
                  className="btn btn-sm btn-primary ml-4"
                  onClick={() => navigate(`/ventas/ordenes/${idOrdenVenta}`)}
                >
                  Ver Orden de Venta <ExternalLink size={14} className="inline ml-1" />
                </button>
              )}
            </div>
          }
        />
      )}

      <form onSubmit={handleSubmit}>
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <Building size={20} />
              Cliente *
            </h2>
          </div>
          <div className="card-body">
            {clienteSeleccionado ? (
              <div className="flex flex-col gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted">Cliente:</label>
                        <p className="font-bold text-lg">{clienteSeleccionado.razon_social}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted">
                            {clienteSeleccionado.tipo_documento || (clienteSeleccionado.ruc && clienteSeleccionado.ruc.length === 8 ? 'DNI' : 'RUC')}:
                        </label>
                        <p className="font-bold">{clienteSeleccionado.ruc}</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline" 
                      onClick={() => {
                        setClienteSeleccionado(null);
                        setEstadoCredito(null);
                        setDireccionesCliente([]);
                        setListasPreciosCliente([]);
                        setDetallesListas({});
                      }}
                      disabled={cotizacionConvertida}
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
                
                {estadoCredito && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded-lg bg-white shadow-sm">
                      <div className="flex items-center gap-2 mb-2 text-primary font-bold text-sm">
                        <CreditCard size={16}/> LINEA DE CREDITO PEN
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <span className="text-muted">Limite:</span> <span className="font-bold text-right">S/ {formatearNumero(estadoCredito.credito_pen.limite)}</span>
                        <span className="text-muted">Utilizado:</span> <span className="font-bold text-right text-red-600">S/ {formatearNumero(estadoCredito.credito_pen.utilizado)}</span>
                        <div className="col-span-2 border-t my-1"></div>
                        <span className="text-muted font-bold">Disponible:</span> <span className="font-bold text-right text-green-600 text-sm">S/ {formatearNumero(estadoCredito.credito_pen.disponible)}</span>
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg bg-white shadow-sm">
                      <div className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm">
                        <DollarSign size={16}/> LINEA DE CREDITO USD
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <span className="text-muted">Limite:</span> <span className="font-bold text-right">$ {formatearNumero(estadoCredito.credito_usd.limite)}</span>
                        <span className="text-muted">Utilizado:</span> <span className="font-bold text-right text-red-600">$ {formatearNumero(estadoCredito.credito_usd.utilizado)}</span>
                        <div className="col-span-2 border-t my-1"></div>
                        <span className="text-muted font-bold">Disponible:</span> <span className="font-bold text-right text-green-600 text-sm">$ {formatearNumero(estadoCredito.credito_usd.disponible)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button 
                type="button" 
                className="btn btn-primary btn-lg w-full" 
                onClick={() => {
                  setModalClienteOpen(true);
                  setTabCliente('lista');
                  setNuevoClienteDoc({ tipo: 'RUC', numero: '' });
                  setClienteApiData(null);
                  setErrorApi(null);
                }}
                disabled={cotizacionConvertida}
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
              Datos de la Cotizacion
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">Fecha de Emision *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formCabecera.fecha_emision}
                  onChange={(e) => setFormCabecera({ ...formCabecera, fecha_emision: e.target.value })}
                  disabled={cotizacionConvertida}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Validez (dias) *</label>
                <input
                  type="number"
                  className="form-input"
                  value={formCabecera.validez_dias}
                  onChange={(e) => setFormCabecera({ ...formCabecera, validez_dias: e.target.value })}
                  min="1"
                  disabled={cotizacionConvertida}
                  required
                  onWheel={handleWheelDisable}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha de Vencimiento (calculada)</label>
                <input
                  type="date"
                  className="form-input"
                  value={fechaVencimientoCalculada}
                  readOnly
                  style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                />
                <small className="text-muted block mt-1">
                  <Info size={12} className="inline" /> Se calcula automaticamente
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Moneda *</label>
                <select
                  className="form-select"
                  value={formCabecera.moneda}
                  onChange={(e) => setFormCabecera({ ...formCabecera, moneda: e.target.value })}
                  disabled={cotizacionConvertida}
                  required
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dolares (USD)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de Impuesto *</label>
                <select
                  className="form-select"
                  value={formCabecera.tipo_impuesto}
                  onChange={(e) => handleTipoImpuestoChange(e.target.value)}
                  disabled={cotizacionConvertida}
                  required
                >
                  {TIPOS_IMPUESTO.map(tipo => (
                    <option key={tipo.codigo} value={tipo.codigo}>{tipo.nombre}</option>
                  ))}
                </select>
              </div>
              {formCabecera.moneda === 'USD' && (
                <div className="form-group">
                  <label className="form-label">Tipo de Cambio</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="form-input"
                      value={formCabecera.tipo_cambio}
                      onChange={(e) => setFormCabecera({ ...formCabecera, tipo_cambio: e.target.value })}
                      step="0.0001"
                      min="0"
                      disabled={cotizacionConvertida}
                      onWheel={handleWheelDisable}
                    />
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={obtenerTipoCambio} 
                      disabled={loadingTC || cotizacionConvertida}
                    >
                      {loadingTC ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                    </button>
                  </div>
                  {tipoCambioFecha && (
                    <small className="text-success block mt-1">
                      API: {new Date(tipoCambioFecha).toLocaleDateString()}
                    </small>
                  )}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Condicion de Pago *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`btn flex-1 ${formCabecera.plazo_pago === 'Contado' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setFormCabecera(prev => ({ ...prev, plazo_pago: 'Contado' }))}
                    disabled={cotizacionConvertida}
                  >
                    Contado
                  </button>
                  <button
                    type="button"
                    className={`btn flex-1 ${formCabecera.plazo_pago !== 'Contado' && formCabecera.plazo_pago !== '' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => {
                      if (estadoCredito?.usar_limite_credito) {
                        setFormCabecera(prev => ({ ...prev, plazo_pago: '' }));
                      }
                    }}
                    disabled={cotizacionConvertida || !estadoCredito?.usar_limite_credito}
                    title={!estadoCredito?.usar_limite_credito ? 'Este cliente no tiene credito habilitado' : ''}
                  >
                    {!estadoCredito?.usar_limite_credito && <Lock size={14} className="mr-1" />}
                    Credito
                  </button>
                </div>
              </div>
              {formCabecera.plazo_pago !== 'Contado' && (
                <div className="form-group animate-fadeIn">
                  <label className="form-label">Dias de Credito *</label>
                  <select
                    className="form-select border-primary"
                    value={formCabecera.plazo_pago === 'Contado' ? '' : formCabecera.plazo_pago}
                    onChange={(e) => setFormCabecera({ ...formCabecera, plazo_pago: e.target.value })}
                    disabled={cotizacionConvertida}
                    required={formCabecera.plazo_pago !== 'Contado'}
                  >
                    <option value="">Seleccione los dias...</option>
                    {PLAZOS_PAGO.filter(p => p !== 'Contado').map(plazo => (
                      <option key={plazo} value={plazo}>{plazo}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Forma de Pago</label>
                <select
                  className="form-select"
                  value={formCabecera.forma_pago}
                  onChange={(e) => setFormCabecera({ ...formCabecera, forma_pago: e.target.value })}
                  disabled={cotizacionConvertida}
                >
                  <option value="">Seleccione...</option>
                  {FORMAS_PAGO.map(forma => (
                    <option key={forma} value={forma}>{forma}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Plazo de Entrega</label>
                <select
                  className="form-select"
                  value={formCabecera.plazo_entrega}
                  onChange={(e) => setFormCabecera({ ...formCabecera, plazo_entrega: e.target.value })}
                  disabled={cotizacionConvertida}
                >
                  <option value="">Seleccione...</option>
                  {PLAZOS_ENTREGA.map(plazo => (
                    <option key={plazo} value={plazo}>{plazo}</option>
                  ))}
                </select>
              </div>
              <div className="form-group col-span-3">
                <label className="form-label">Vendedor/Comercial</label>
                <select
                  className="form-select"
                  value={formCabecera.id_comercial}
                  onChange={(e) => setFormCabecera({ ...formCabecera, id_comercial: e.target.value })}
                  disabled={cotizacionConvertida}
                >
                  <option value="">Seleccione...</option>
                  {comerciales.map(c => (
                    <option key={c.id_empleado} value={c.id_empleado}>
                      {c.nombre_completo} ({c.rol})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group mt-4">
              <label className="form-label">Lugar de Entrega</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  {direccionesCliente.length > 0 ? (
                    <>
                      <select
                        className="form-select pl-10"
                        value={formCabecera.lugar_entrega}
                        onChange={(e) => setFormCabecera({ ...formCabecera, lugar_entrega: e.target.value })}
                        disabled={cotizacionConvertida}
                      >
                        <option value="">Seleccione una direccion...</option>
                        {direccionesCliente.map((dir, idx) => (
                          <option key={idx} value={dir.direccion}>
                            {dir.direccion} {dir.es_principal ? '(Principal)' : ''}
                          </option>
                        ))}
                      </select>
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    </>
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      value={formCabecera.lugar_entrega}
                      onChange={(e) => setFormCabecera({ ...formCabecera, lugar_entrega: e.target.value })}
                      placeholder="Direccion de entrega"
                      disabled={cotizacionConvertida}
                    />
                  )}
                </div>
                {clienteSeleccionado && !cotizacionConvertida && (
                  <button 
                    type="button" 
                    className="btn btn-outline px-3" 
                    onClick={() => setModalDireccionOpen(true)}
                    title="Guardar nueva direccion"
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea
                className="form-textarea"
                value={formCabecera.observaciones}
                onChange={(e) => setFormCabecera({ ...formCabecera, observaciones: e.target.value })}
                rows={3}
                placeholder="Observaciones adicionales..."
                disabled={cotizacionConvertida}
              />
            </div>

            <div className="form-group mt-2">
              <label
                className={`flex items-center gap-3 cursor-pointer w-fit select-none px-4 py-3 rounded-lg border-2 transition-all ${
                  esMuestra
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${cotizacionConvertida ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={esMuestra}
                    onChange={(e) => {
                      setEsMuestra(e.target.checked);
                      if (e.target.checked) setDetalle([]);
                    }}
                    disabled={cotizacionConvertida}
                  />
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      esMuestra ? 'bg-amber-500 border-amber-500' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {esMuestra && <Check size={12} className="text-white" />}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className={`font-semibold text-sm ${esMuestra ? 'text-amber-800' : 'text-gray-700'}`}>
                    Cotizacion de Muestra
                  </span>
                  <span className="text-xs text-muted">
                    Numeracion MUE-YYYY-XXXX. Permite ingresar productos sin codigo de inventario.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {listasPreciosCliente.length > 0 && !cotizacionConvertida && (
          <div className="card mb-4 animate-fadeIn">
            <div className="card-header flex justify-between items-center">
              <h2 className="card-title text-primary">
                <Package size={20} /> Listas de Precios
              </h2>
              <div className="relative w-64">
                <input 
                  type="text" 
                  className="form-input form-input-sm pl-8" 
                  placeholder="Buscar lista..." 
                  value={busquedaLista}
                  onChange={(e) => setBusquedaLista(e.target.value)}
                />
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-b-lg">
              <div className="flex gap-4 overflow-x-auto pb-2">
                {listasPreciosCliente
                  .filter(l => l.nombre_lista.toLowerCase().includes(busquedaLista.toLowerCase()))
                  .map(lista => (
                  <div key={lista.id_lista} className="border rounded-lg min-w-[280px] bg-white shadow-sm flex flex-col transition-all duration-200">
                    <div 
                      className="p-3 border-b bg-white flex justify-between items-center rounded-t-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleListaDesplegada(lista.id_lista)}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-gray-800">{lista.nombre_lista}</span>
                        <span className="text-xs text-muted">{lista.total_productos} productos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="badge badge-sm badge-outline">{lista.moneda}</span>
                        {listasDesplegadas[lista.id_lista] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                    
                    {listasDesplegadas[lista.id_lista] && (
                      <div className="p-0 flex-1 max-h-60 overflow-y-auto animate-fadeIn border-t">
                        {detallesListas[lista.id_lista] ? (
                          <table className="table w-full text-xs">
                            <tbody>
                              {detallesListas[lista.id_lista].map(prod => {
                                const isSelected = detalle.some(d => d.id_producto === prod.id_producto);
                                return (
                                  <tr
                                    key={prod.id_producto}
                                    className={isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                                    onClick={() => toggleProductoDesdeLista(prod, lista.moneda)}
                                  >
                                    <td className="p-2 cursor-pointer border-b border-gray-100 last:border-0">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                                          {isSelected && <Check size={10} className="text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium truncate text-gray-700" title={prod.producto}>{prod.producto}</p>
                                          <div className="flex justify-between items-center mt-1">
                                            <span className="text-gray-400 font-mono text-[10px]">{prod.codigo}</span>
                                            <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">{lista.moneda} {parseFloat(prod.precio_especial).toFixed(2)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <div className="p-4 text-center text-muted text-xs flex items-center justify-center gap-2">
                            <Loader size={14} className="animate-spin" /> Cargando...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {listasPreciosCliente.length === 0 && (
                  <div className="w-full text-center py-4 text-muted text-sm italic">
                    No se encontraron listas de precios para este cliente.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="card mb-4">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h2 className="card-title">
                <Calculator size={20} />
                Productos *
                {esMuestra && (
                  <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                    Modo Muestra — MUE-YYYY-XXXX
                  </span>
                )}
              </h2>
              <div className="flex gap-2">
                {esMuestra ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ borderColor: '#f59e0b', color: '#b45309' }}
                      onClick={handleAgregarProductoLibre}
                      disabled={cotizacionConvertida}
                    >
                      <Plus size={18} /> Producto Muestra
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setModalProductoOpen(true)}
                      disabled={cotizacionConvertida}
                    >
                      <Plus size={18} /> Desde Inventario
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setModalProductoOpen(true)}
                    disabled={cotizacionConvertida}
                  >
                    <Plus size={20} /> Agregar Producto
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="card-body">
            {detalle.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Descripcion</th>
                      <th className="text-right">Cantidad</th>
                      <th>UM</th>
                      <th className="text-right">P. Base</th>
                      <th className="text-right">P. Venta</th>
                      <th className="text-right">Margen %</th>
                      <th className="text-right">Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((item, index) => {
                      const precioVenta = parseFloat(item.precio_venta) || 0;
                      const valorVenta = item.cantidad * precioVenta;
                      return (
                        <tr key={index} className={item.es_producto_libre ? 'bg-amber-50' : ''}>
                          <td className="font-mono text-sm">
                            {item.es_producto_libre ? (
                              <input
                                type="text"
                                className="form-input font-mono text-sm"
                                style={{ borderColor: '#fcd34d', backgroundColor: '#fffbeb' }}
                                value={item.codigo_producto_libre || ''}
                                onChange={(e) => handleProductoLibreChange(index, 'codigo_producto_libre', e.target.value)}
                                placeholder="Cod. muestra"
                                disabled={cotizacionConvertida}
                                required
                              />
                            ) : (
                              item.codigo_producto
                            )}
                          </td>
                          <td>
                            {item.es_producto_libre ? (
                              <input
                                type="text"
                                className="form-input"
                                style={{ borderColor: '#fcd34d', backgroundColor: '#fffbeb', minWidth: '220px' }}
                                value={item.nombre_producto_libre || ''}
                                onChange={(e) => handleProductoLibreChange(index, 'nombre_producto_libre', e.target.value)}
                                placeholder="Nombre del producto muestra"
                                disabled={cotizacionConvertida}
                                required
                              />
                            ) : (
                              item.producto
                            )}
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input text-right"
                              value={item.cantidad}
                              onChange={(e) => handleCantidadChange(index, e.target.value)}
                              min="0.001"
                              step="0.001"
                              disabled={cotizacionConvertida}
                              required
                              onWheel={handleWheelDisable}
                            />
                          </td>
                          <td className="text-sm text-muted">
                            {item.es_producto_libre ? (
                              <input
                                type="text"
                                className="form-input text-sm"
                                style={{ borderColor: '#fcd34d', backgroundColor: '#fffbeb', width: '80px' }}
                                value={item.unidad_medida || ''}
                                onChange={(e) => handleProductoLibreChange(index, 'unidad_medida', e.target.value)}
                                placeholder="UM"
                                disabled={cotizacionConvertida}
                              />
                            ) : (
                              item.unidad_medida
                            )}
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input text-right bg-gray-100"
                              value={item.precio_base}
                              readOnly={!item.es_producto_libre}
                              onChange={item.es_producto_libre ? (e) => handleProductoLibreChange(index, 'precio_base', parseFloat(e.target.value) || 0) : undefined}
                              min="0"
                              step="0.001"
                              disabled={cotizacionConvertida}
                              style={item.es_producto_libre ? { backgroundColor: '#fffbeb', borderColor: '#fcd34d' } : {}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input text-right bg-blue-50"
                              value={item.precio_venta}
                              onChange={(e) => handlePrecioVentaChange(index, e.target.value)}
                              min="0"
                              step="0.001"
                              placeholder="0.000"
                              disabled={cotizacionConvertida}
                              required={!esMuestra}
                              onWheel={handleWheelDisable}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input text-right"
                              value={parseFloat(item.descuento_porcentaje).toFixed(2)}
                              onChange={(e) => handleDescuentoChange(index, e.target.value)}
                              step="0.01"
                              disabled={cotizacionConvertida}
                              onWheel={handleWheelDisable}
                            />
                          </td>
                          <td className="text-right font-bold">{formatearMonedaGral(valorVenta)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => handleEliminarItem(index)}
                              disabled={cotizacionConvertida}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <Calculator size={64} className="mx-auto text-muted mb-4" style={{ opacity: 0.3 }} />
                <p className="text-muted font-bold mb-2">No hay productos agregados</p>
                <div className="flex gap-2 justify-center">
                  {esMuestra ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ borderColor: '#f59e0b', color: '#b45309' }}
                        onClick={handleAgregarProductoLibre}
                        disabled={cotizacionConvertida}
                      >
                        <Plus size={20} /> Producto Muestra
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setModalProductoOpen(true)}
                        disabled={cotizacionConvertida}
                      >
                        <Plus size={20} /> Desde Inventario
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setModalProductoOpen(true)}
                      disabled={cotizacionConvertida}
                    >
                      <Plus size={20} /> Agregar Primer Producto
                    </button>
                  )}
                </div>
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
                    <span className="font-bold">{formatearMonedaGral(totales.subtotal)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">
                      {TIPOS_IMPUESTO.find(t => t.codigo === formCabecera.tipo_impuesto)?.nombre}:
                    </span>
                    <span className="font-bold">{formatearMonedaGral(totales.impuesto)}</span>
                  </div>
                  <div className="flex justify-between py-3 bg-gray-100 text-black px-4 rounded-lg mt-2 shadow-sm border border-gray-200">
                    <span className="font-bold text-lg">TOTAL:</span>
                    <span className="font-bold text-2xl text-primary">{formatearMonedaGral(totales.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button type="button" className="btn btn-outline" onClick={() => navigate('/ventas/cotizaciones')}>
            Cancelar
          </button>
          {!cotizacionConvertida && (
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || !clienteSeleccionado || detalle.length === 0}
            >
              <Save size={20} />
              {loading ? 'Guardando...' : modoEdicion ? 'Actualizar Cotizacion' : 'Guardar Cotizacion'}
            </button>
          )}
        </div>
      </form>

      <Modal isOpen={modalClienteOpen} onClose={() => setModalClienteOpen(false)} title="Seleccionar Cliente" size="lg">
        <div className="flex gap-2 mb-4 border-b">
          <button
            className={`px-4 py-2 font-medium ${tabCliente === 'lista' ? 'text-primary border-b-2 border-primary' : 'text-muted'}`}
            onClick={() => setTabCliente('lista')}
          >
            Buscar en Lista
          </button>
          <button
            className={`px-4 py-2 font-medium ${tabCliente === 'nuevo' ? 'text-primary border-b-2 border-primary' : 'text-muted'}`}
            onClick={() => setTabCliente('nuevo')}
          >
            Nuevo / Validar
          </button>
        </div>
        {tabCliente === 'lista' ? (
          <>
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                className="form-input pl-10"
                placeholder="Buscar por razon social o RUC..."
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-96 overflow-y-auto">
              {clientesFiltrados.length > 0 ? (
                <div className="space-y-2 pr-2">
                  {clientesFiltrados.map(cliente => (
                    <div
                      key={cliente.id_cliente}
                      className="p-4 border rounded-lg hover:border-primary hover:bg-blue-50 cursor-pointer transition flex justify-between items-center group"
                      onClick={() => handleSelectCliente(cliente)}
                    >
                      <div>
                        <div className="font-bold text-gray-800 group-hover:text-primary transition-colors">{cliente.razon_social}</div>
                        <div className="text-sm text-muted font-mono">{cliente.ruc}</div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        {cliente.usar_limite_credito === 1 ? (
                          <>
                            <div className="flex items-center gap-1 badge badge-success text-[10px] uppercase font-bold py-0.5">
                              <CheckCircle size={10}/> Credito Activo
                            </div>
                            <div className="text-[10px] font-bold text-muted">
                              S/ {formatearNumero(parseFloat(cliente.limite_credito_pen))} | $ {formatearNumero(parseFloat(cliente.limite_credito_usd))}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 badge badge-secondary text-[10px] uppercase font-bold py-0.5">
                            <Lock size={10}/> Solo Contado
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted py-8">No se encontraron clientes</p>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn flex-1 ${nuevoClienteDoc.tipo === 'RUC' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setNuevoClienteDoc({ ...nuevoClienteDoc, tipo: 'RUC', numero: '' })}
              >
                <Building2 size={18} className="mr-2" /> Empresa (RUC)
              </button>
              <button
                type="button"
                className={`btn flex-1 ${nuevoClienteDoc.tipo === 'DNI' ? 'btn-info' : 'btn-outline'}`}
                onClick={() => setNuevoClienteDoc({ ...nuevoClienteDoc, tipo: 'DNI', numero: '' })}
              >
                <User size={18} className="mr-2" /> Persona (DNI)
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">{nuevoClienteDoc.tipo}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-input"
                  value={nuevoClienteDoc.numero}
                  onChange={(e) => {
                    setNuevoClienteDoc({ ...nuevoClienteDoc, numero: e.target.value });
                    setClienteApiData(null);
                    setErrorApi(null);
                  }}
                  placeholder={nuevoClienteDoc.tipo === 'RUC' ? '20...' : '70...'}
                  maxLength={nuevoClienteDoc.tipo === 'RUC' ? 11 : 8}
                />
                <button
                  type="button"
                  className="btn btn-outline min-w-[120px]"
                  onClick={validarClienteExterno}
                  disabled={loadingApi || !nuevoClienteDoc.numero}
                >
                  {loadingApi ? <Loader size={18} className="animate-spin" /> : 'Validar'}
                </button>
              </div>
              {errorApi && <p className="text-danger text-sm mt-1">{errorApi}</p>}
            </div>
            {clienteApiData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-fadeIn">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-success mt-1" size={20} />
                  <div className="flex-1">
                    <h4 className="font-bold text-success mb-1">Datos Encontrados</h4>
                    <p className="text-sm"><strong>Razon Social:</strong> {clienteApiData.razon_social || clienteApiData.nombre_completo}</p>
                    <p className="text-sm"><strong>Direccion:</strong> {clienteApiData.direccion || '-'}</p>
                    <button
                      type="button"
                      className="btn btn-success w-full mt-3"
                      onClick={crearYSeleccionarCliente}
                      disabled={loadingApi}
                    >
                      Registrar y Seleccionar Cliente
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={modalProductoOpen} onClose={() => setModalProductoOpen(false)} title="Agregar Producto" size="lg">
        <div className="mb-4">
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por codigo o nombre..."
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
                  className="p-4 border rounded-lg hover:border-primary hover:bg-blue-50 cursor-pointer transition flex justify-between items-start group"
                  onClick={() => handleAgregarProducto(producto)}
                >
                  <div className="flex-1">
                    <div className="font-bold text-gray-800 group-hover:text-primary transition-colors">{producto.nombre}</div>
                    <div className="text-sm text-muted font-mono">{producto.codigo}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary text-lg">{formatearMonedaGral(producto.precio_venta)}</div>
                    <div className="text-xs text-muted font-bold uppercase">{producto.unidad_medida}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted py-8">No se encontraron productos</p>
          )}
        </div>
      </Modal>

      <Modal isOpen={modalDireccionOpen} onClose={() => setModalDireccionOpen(false)} title="Nueva Direccion de Entrega" size="md">
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Direccion *</label>
            <textarea
              className="form-textarea"
              value={nuevaDireccion.direccion}
              onChange={(e) => setNuevaDireccion({ ...nuevaDireccion, direccion: e.target.value })}
              placeholder="Ingresa la direccion completa..."
              rows={3}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Referencia</label>
            <input
              type="text"
              className="form-input"
              value={nuevaDireccion.referencia}
              onChange={(e) => setNuevaDireccion({ ...nuevaDireccion, referencia: e.target.value })}
              placeholder="Ej. Frente al parque, esquina con..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setModalDireccionOpen(false)}
              disabled={savingDireccion}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGuardarDireccion}
              disabled={savingDireccion || !nuevaDireccion.direccion.trim()}
            >
              {savingDireccion ? 'Guardando...' : 'Guardar Direccion'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default NuevaCotizacion;