import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Save, Search,
  ShoppingCart, Building, Calculator,
  MapPin, DollarSign, CreditCard, Info, Clock,
  FileText, Lock, CheckCircle, Truck, User, Box, Eye, FilePlus, Package, ShieldCheck, GripVertical
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import ModalVerificacionOC from '../../components/Ventas/ModalVerificacionOC';
import ModalTipoCambio from '../../components/Ventas/ModalTipoCambio';
import UbigeoSelector from '../../components/common/UbigeoSelector';
import EstadoConsulta from '../../components/common/EstadoConsulta';
import { ordenesVentaAPI, clientesAPI, productosAPI, empleadosAPI, cotizacionesAPI, archivosAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import useReordenarFilas from '../../hooks/useReordenarFilas';
import useConsultaDocumento from '../../hooks/useConsultaDocumento';
import './Ventas.css';

const TIPOS_IMPUESTO = [
  { codigo: 'IGV', nombre: 'IGV 18%', porcentaje: 18.00 },
  { codigo: 'EXONERADO', nombre: 'Exonerado 0%', porcentaje: 0.00 },
  { codigo: 'INAFECTO', nombre: 'Inafecto 0%', porcentaje: 0.00 }
];

const FORMAS_PAGO = [
  'Transferencia Bancaria', 'Depósito en Cuenta', 'Cheque', 'Efectivo', 
  'Letra de Cambio', 'Yape', 'Plin', 'Tarjeta de Crédito', 'Tarjeta de Débito'
];

const DIAS_CREDITO_OPCIONES = [7, 15, 30, 45, 60, 90];

function NuevaOrdenVenta() {
  const navigate = useNavigate();
  const { id } = useParams(); 
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const idCotizacionParam = searchParams.get('cotizacion');
  const esAdmin = user?.rol === 'Administrador';

  const modoEdicion = !!id;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const submitCooldown = useRef(false);
  const [cooldownActivo, setCooldownActivo] = useState(false);
  
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [comerciales, setComerciales] = useState([]);
  const [cotizacionesPendientes, setCotizacionesPendientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [conductores, setConductores] = useState([]);
  const consultaDocumento = useConsultaDocumento();

  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [modalProductoOpen, setModalProductoOpen] = useState(false);
  
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');

  const [restringidoCartera, setRestringidoCartera] = useState(false);
  const [idsAsignados, setIdsAsignados] = useState([]);
  const [vistaCartera, setVistaCartera] = useState('asignados');
  
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [direccionesCliente, setDireccionesCliente] = useState([]);
  const [estadoCredito, setEstadoCredito] = useState(null);
  const [cargandoCredito, setCargandoCredito] = useState(false);
  const [detalle, setDetalle] = useState([]);
  const {
    indiceArrastrado,
    iniciarArrastre,
    moverDuranteArrastre,
    finalizarArrastre,
    cancelarArrastre
  } = useReordenarFilas(setDetalle);
  const [totales, setTotales] = useState({ subtotal: 0, impuesto: 0, total: 0 });

  const [modalDireccionOpen, setModalDireccionOpen] = useState(false);
  const [nuevaDireccion, setNuevaDireccion] = useState({ direccion: '', ubigeo: '', referencia: '' });
  const [savingDireccion, setSavingDireccion] = useState(false);
  
  const [archivos, setArchivos] = useState({ orden_compra: [], comprobante: [] });
  const [archivosPrevios, setArchivosPrevios] = useState({ orden_compra_url: [], comprobante_url: [] });
  const [tieneOC, setTieneOC] = useState(false);
  const [modalVerificacionOCOpen, setModalVerificacionOCOpen] = useState(false);
  const [modalTCAbierto, setModalTCAbierto] = useState(false);
  const [monedaPendiente, setMonedaPendiente] = useState(null);
  const pendingVerifOC = useRef('Sin verificar');

  const [formCabecera, setFormCabecera] = useState({
    id_cliente: '',
    id_cotizacion: '',
    id_comercial: user?.id_empleado || '',
    tipo_entrega: 'Vehiculo Empresa',
    id_vehiculo: '',
    id_conductor: '',
    transporte_nombre: '',
    transporte_placa: '',
    transporte_conductor: '',
    transporte_dni: '',
    transporte_licencia: '',
    orden_compra_cliente: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_entrega_estimada: '',
    fecha_vencimiento: new Date().toISOString().split('T')[0], 
    moneda: 'PEN',
    tipo_cambio: 1.0000,
    tipo_impuesto: 'IGV',
    porcentaje_impuesto: 18.00,
    es_exportacion: 0,
    es_muestra: 0,
    prioridad: 'Media',
    tipo_venta: 'Contado', 
    dias_credito: 0,       
    plazo_pago: 'Contado',
    forma_pago: '',
    direccion_entrega: '',
    lugar_entrega: '',
    ciudad_entrega: 'Lima',
    contacto_entrega: '',
    telefono_entrega: '',
    observaciones: ''
  });

  const handleWheelDisable = (e) => { e.target.blur(); };

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
  };

  const formatearMoneda = (valor) => {
    const simbolo = formCabecera.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };
  const formatearPeso = (pesoKg) => {
    if (!pesoKg || pesoKg === 0) return '—';
    if (pesoKg < 1) return `${(pesoKg * 1000).toFixed(0)} g`;
    return `${pesoKg.toFixed(3)} kg`;
  };
  const verArchivo = (url) => {
    if (!url) return;
    const proxyUrl = archivosAPI.getProxyUrl(url);
    window.open(proxyUrl, '_blank');
  };

  const getArrayFromUrls = (urlData) => {
    if (!urlData) return [];
    if (Array.isArray(urlData)) return urlData;
    if (typeof urlData === 'string') {
        if (urlData.startsWith('[')) {
            try {
                return JSON.parse(urlData);
            } catch(e) {
                return [urlData];
            }
        }
        return [urlData];
    }
    return [];
  };

  const handleEliminarArchivoPrevio = (campo, indexStr) => {
      const urlsArray = getArrayFromUrls(archivosPrevios[campo]);
      const newUrlsArray = urlsArray.filter((_, idx) => idx !== indexStr);
      setArchivosPrevios({
          ...archivosPrevios,
          [campo]: newUrlsArray.length > 0 ? JSON.stringify(newUrlsArray) : null
      });
  };

  const handlePaste = (e, campo) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const fecha = new Date().toISOString().replace(/[:.]/g, '-');
        const file = new File([blob], `imagen_pegada_${fecha}.png`, { type: blob.type });
        
        setArchivos(prev => {
          if (campo === 'comprobante') {
            return { ...prev, comprobante: [...(prev.comprobante || []), file] };
          } else {
            return { ...prev, orden_compra: [...(prev.orden_compra || []), file] };
          }
        });
        
        e.preventDefault();
        setSuccess(`Imagen pegada correctamente en ${campo === 'orden_compra' ? 'Orden de Compra' : 'Comprobante'}`);
        setTimeout(() => setSuccess(null), 2000);
        return; 
      }
    }
  };

  useEffect(() => { cargarCatalogos(); }, []);
  useEffect(() => { if (modoEdicion) { cargarOrden(); } }, [id]);
  useEffect(() => { calcularTotales(); }, [detalle, formCabecera.porcentaje_impuesto, formCabecera.es_exportacion]);

  useEffect(() => {
    if (formCabecera.tipo_venta === 'Contado') {
      setFormCabecera(prev => ({
        ...prev,
        dias_credito: 0,
        fecha_vencimiento: prev.fecha_emision,
        plazo_pago: 'Contado'
      }));
    } else {
      const fechaEmision = new Date(formCabecera.fecha_emision);
      const fechaBase = new Date(fechaEmision.valueOf() + fechaEmision.getTimezoneOffset() * 60000);
      fechaBase.setDate(fechaBase.getDate() + parseInt(formCabecera.dias_credito || 0));
      const fechaVencimiento = fechaBase.toISOString().split('T')[0];
      setFormCabecera(prev => ({
        ...prev,
        fecha_vencimiento: fechaVencimiento,
        plazo_pago: `Crédito ${prev.dias_credito} Días`
      }));
    }
  }, [formCabecera.tipo_venta, formCabecera.dias_credito, formCabecera.fecha_emision]);

useEffect(() => {
    if (idCotizacionParam && !modoEdicion && clientes.length > 0 && productos.length > 0) {
      handleImportarCotizacion(idCotizacionParam);
    }
  }, [idCotizacionParam, clientes.length, productos.length]);

  const obtenerConfiguracionImpuesto = (codigoOTexto) => {
    let config = TIPOS_IMPUESTO.find(t => t.codigo === codigoOTexto);
    if (!config) {
        if (codigoOTexto === 'Exonerado') config = TIPOS_IMPUESTO.find(t => t.codigo === 'EXO');
        else if (codigoOTexto === 'Inafecto') config = TIPOS_IMPUESTO.find(t => t.codigo === 'INA');
        else config = TIPOS_IMPUESTO[0]; 
    }
    return config;
  };

  const cargarCatalogos = async () => {
    try {
      const [resClientes, resProductos, resEmpleados, resCotizaciones, resVehiculos, resConductores] = await Promise.all([
        clientesAPI.getAll({ estado: 'Activo' }),
        productosAPI.getAll({ estado: 'Activo', id_tipo_inventario: 3 }),
        empleadosAPI.getAll({ estado: 'Activo' }),
        !modoEdicion ? cotizacionesAPI.getAll({ estado: 'Aprobada' }) : { data: { success: true, data: [] } },
        ordenesVentaAPI.getVehiculos(),
        ordenesVentaAPI.getConductores()
      ]);

      if (resClientes.data.success) setClientes(resClientes.data.data || []);
      if (resProductos.data.success) setProductos(resProductos.data.data || []);
      
      if (resEmpleados.data.success) {
        const vendedores = (resEmpleados.data.data || []).filter(e =>
          ['ventas', 'comercial', 'gerencia', 'administrador'].includes(e.rol?.toLowerCase())
          && ![2, 21].includes(e.id_empleado)
        );
        setComerciales(vendedores);
      }

      if (resCotizaciones.data.success) setCotizacionesPendientes(resCotizaciones.data.data || []);
      if (resVehiculos.data.success) setVehiculos(resVehiculos.data.data || []);
      if (resConductores.data.success) setConductores(resConductores.data.data || []);

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
        const configImpuesto = obtenerConfiguracionImpuesto(orden.tipo_impuesto);

        setFormCabecera({
          id_cliente: orden.id_cliente,
          id_cotizacion: orden.id_cotizacion || '',
          id_comercial: orden.id_comercial || '',
          tipo_entrega: orden.tipo_entrega || 'Vehiculo Empresa',
          id_vehiculo: orden.id_vehiculo || '',
          id_conductor: orden.id_conductor || '',
          transporte_nombre: orden.transporte_nombre || '',
          transporte_placa: orden.transporte_placa || '',
          transporte_conductor: orden.transporte_conductor || '',
          transporte_dni: orden.transporte_dni || '',
          transporte_licencia: orden.transporte_licencia || '',
          orden_compra_cliente: orden.orden_compra_cliente || '',
          fecha_emision: orden.fecha_emision ? orden.fecha_emision.split('T')[0] : '',
          fecha_entrega_estimada: orden.fecha_entrega_estimada ? orden.fecha_entrega_estimada.split('T')[0] : '',
          fecha_vencimiento: orden.fecha_vencimiento ? orden.fecha_vencimiento.split('T')[0] : '',
          moneda: orden.moneda,
          tipo_cambio: orden.tipo_cambio,
          tipo_impuesto: configImpuesto.codigo,
          porcentaje_impuesto: orden.es_exportacion ? 0 : configImpuesto.porcentaje,
          es_exportacion: orden.es_exportacion ? 1 : 0,
          es_muestra: orden.es_muestra ? 1 : 0,
          prioridad: orden.prioridad,
          tipo_venta: orden.tipo_venta || 'Contado',
          dias_credito: orden.dias_credito || 0,
          plazo_pago: orden.plazo_pago || '',
          forma_pago: orden.forma_pago || '',
          direccion_entrega: orden.direccion_entrega || '',
          lugar_entrega: orden.lugar_entrega || '',
          ciudad_entrega: orden.ciudad_entrega || '',
          contacto_entrega: orden.contacto_entrega || '',
          telefono_entrega: orden.telefono_entrega || '',
          observaciones: orden.observaciones || ''
        });

        if (orden.orden_compra_cliente || orden.orden_compra_url) {
            setTieneOC(true);
        }

        setArchivosPrevios({
            orden_compra_url: orden.orden_compra_url,
            comprobante_url: orden.comprobante_url
        });

        setCargandoCredito(true);
        const resCli = await clientesAPI.getById(orden.id_cliente);
        if (resCli.data.success) {
          const clienteData = resCli.data.data;
          setClienteSeleccionado(clienteData);
          if (clienteData.direcciones && clienteData.direcciones.length > 0) {
            setDireccionesCliente(clienteData.direcciones);
          } else if (clienteData.direccion_despacho) {
            setDireccionesCliente([{ id_direccion: 'principal', direccion: clienteData.direccion_despacho, es_principal: 1 }]);
          }

          const condicion = clienteData.condicion_pago || 'Contado';
          const diasCredito = parseInt(clienteData.dias_credito || 0);
          const tipoVentaCliente = (condicion === 'Credito' && clienteData.usar_limite_credito && diasCredito > 0)
            ? 'Crédito'
            : 'Contado';

          setFormCabecera(prev => ({
            ...prev,
            tipo_venta: tipoVentaCliente,
            dias_credito: tipoVentaCliente === 'Crédito' ? diasCredito : prev.dias_credito
          }));
        }

        try {
          const resCredito = await clientesAPI.getEstadoCredito(orden.id_cliente, id);
          if (resCredito.data.success) {
            setEstadoCredito(resCredito.data.data);
          }
        } catch (err) {
          console.error('Error al cargar estado de crédito:', err);
        } finally {
          setCargandoCredito(false);
        }

        if (orden.detalle && orden.detalle.length > 0) {
          setDetalle(orden.detalle.map(item => {
            const prodCatalogo = productos.find(p => p.id_producto === item.id_producto);
            return {
              id_detalle: item.id_detalle,
              id_producto: item.id_producto,
              es_producto_libre: item.es_producto_libre ? true : false,
              descripcion_libre: item.descripcion_libre || '',
              unidad_medida_libre: item.unidad_medida_libre || '',
              codigo_bien: item.codigo_bien || '',
              codigo_producto: item.codigo_producto,
              producto: item.producto,
              unidad_medida: item.unidad_medida,
              cantidad: parseFloat(item.cantidad),
              precio_base: parseFloat(item.precio_base || item.precio_unitario),
              precio_venta: parseFloat(item.precio_unitario),
              id_lista_origen: item.id_lista_origen || null,
              precio_lista_snapshot: item.precio_lista_snapshot != null ? parseFloat(item.precio_lista_snapshot) : null,
              descuento_porcentaje: parseFloat(item.descuento_porcentaje || 0),
              stock_actual: item.stock_disponible,
              peso_unitario: parseFloat(prodCatalogo?.peso_unitario || 0)
            };
          }));
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
        const plazoTexto = (cot.plazo_pago || 'Contado').toLowerCase();
        let tipoVentaCalculado = 'Contado';
        let diasCreditoCalculado = 0;

        const esCredito = (plazoTexto.includes('credito') || plazoTexto.includes('crédito') || /\d/.test(plazoTexto)) && !plazoTexto.includes('contado');

        if (esCredito) {
          tipoVentaCalculado = 'Crédito';
          const match = cot.plazo_pago.match(/\d+/);
          diasCreditoCalculado = match ? parseInt(match[0]) : 0;
        }

        const fechaEmision = new Date();
        const fechaVencimientoCalc = new Date(fechaEmision);
        fechaVencimientoCalc.setDate(fechaVencimientoCalc.getDate() + diasCreditoCalculado);

        const cliente = clientes.find(c => c.id_cliente === cot.id_cliente);
        
        if (cliente) {
          setClienteSeleccionado(cliente);
          try {
            const resCredito = await clientesAPI.getEstadoCredito(cliente.id_cliente);
            if (resCredito.data.success) {
              setEstadoCredito(resCredito.data.data);
            }
            
            const resFullCliente = await clientesAPI.getById(cliente.id_cliente);
            if (resFullCliente.data.success) {
                const fullClient = resFullCliente.data.data;
                if (fullClient.direcciones && fullClient.direcciones.length > 0) {
                    setDireccionesCliente(fullClient.direcciones);
                } else if (fullClient.direccion_despacho) {
                    setDireccionesCliente([{ id_direccion: 'principal', direccion: fullClient.direccion_despacho, es_principal: 1 }]);
                }
            }
          } catch (error) {
            console.error("Error cargando datos del cliente", error);
          }
        }

        const configImpuesto = obtenerConfiguracionImpuesto(cot.tipo_impuesto);

        setFormCabecera(prev => ({
          ...prev,
          id_cotizacion: cot.id_cotizacion,
          id_cliente: cot.id_cliente,
          id_comercial: cot.id_comercial || prev.id_comercial,
          moneda: cot.moneda,
          tipo_impuesto: configImpuesto.codigo,
          porcentaje_impuesto: configImpuesto.porcentaje,
          tipo_cambio: cot.tipo_cambio,
          tipo_venta: tipoVentaCalculado, 
          dias_credito: diasCreditoCalculado,
          plazo_pago: cot.plazo_pago || 'Contado',
          forma_pago: cot.forma_pago || '',
          fecha_vencimiento: fechaVencimientoCalc.toISOString().split('T')[0],
          direccion_entrega: cot.lugar_entrega || cot.direccion_entrega || (cliente ? cliente.direccion_despacho : ''),
          lugar_entrega: cot.lugar_entrega || '',
          observaciones: cot.observaciones || ''
        }));

        if (cot.detalle) {
          setDetalle(cot.detalle.map(item => {
            const prodCatalogo = productos.find(p => p.id_producto === item.id_producto);
            return {
              id_producto: item.id_producto,
              codigo_producto: item.codigo_producto,
              producto: item.producto,
              unidad_medida: item.unidad_medida,
              cantidad: parseFloat(item.cantidad),
              precio_base: parseFloat(item.precio_base || item.precio_unitario),
              precio_venta: parseFloat(item.precio_unitario),
              id_lista_origen: item.id_lista_origen || null,
              precio_lista_snapshot: item.precio_lista_snapshot != null ? parseFloat(item.precio_lista_snapshot) : null,
              descuento_porcentaje: parseFloat(item.descuento_porcentaje || 0),
              stock_actual: item.stock_disponible,
              peso_unitario: parseFloat(prodCatalogo?.peso_unitario || 0)
            };
          }));
        }
      }
    } catch (err) {
      console.error(err);
      setError('Error al importar la cotización');
    } finally {
      setLoading(false);
    }
  };

  const cargarCartera = async () => {
    if (!user?.id || !['Comercial', 'Ventas'].includes(user.rol)) return;
    try {
      const res = await empleadosAPI.getClientesAsignados(user.id);
      const data = res.data.data;
      setRestringidoCartera(!!data.restringir_clientes);
      setIdsAsignados(data.ids || []);
      setVistaCartera(data.restringir_clientes ? 'asignados' : 'todos');
    } catch (err) {
      console.error('Error al cargar cartera de clientes:', err);
    }
  };

  useEffect(() => {
    cargarCartera();
  }, [user?.id]);

  const esClienteAsignado = (idCliente) => !restringidoCartera || idsAsignados.includes(idCliente);

  const handleSelectCliente = async (cliente) => {
    if (!esClienteAsignado(cliente.id_cliente)) {
      setError('Este cliente no forma parte de tu cartera asignada. Solo puedes crear órdenes para tus clientes asignados.');
      return;
    }
    try {
        const resFullCliente = await clientesAPI.getById(cliente.id_cliente);
        const clienteCompleto = resFullCliente.data.data;
        
        setClienteSeleccionado(clienteCompleto);
        
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
        const tipoVenta = (condicion === 'Credito' && clienteCompleto.usar_limite_credito && diasCredito > 0)
          ? 'Crédito'
          : 'Contado';

        setFormCabecera(prev => ({
          ...prev,
          id_cliente: clienteCompleto.id_cliente,
          direccion_entrega: direccionPrincipal ? direccionPrincipal.direccion : '',
          tipo_venta: tipoVenta,
          dias_credito: tipoVenta === 'Crédito' ? diasCredito : 0
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
        const tipoVentaFallback = (condicionFallback === 'Credito' && cliente.usar_limite_credito && diasFallback > 0)
          ? 'Crédito'
          : 'Contado';

        setFormCabecera(prev => ({
          ...prev,
          id_cliente: cliente.id_cliente,
          direccion_entrega: cliente.direccion_despacho || '',
          tipo_venta: tipoVentaFallback,
          dias_credito: tipoVentaFallback === 'Crédito' ? diasFallback : 0
        }));
      }

    setModalClienteOpen(false);
    setBusquedaCliente('');
  };

  const handleAgregarProducto = (producto) => {
    const existe = detalle.find(d => d.id_producto === producto.id_producto);
    if (existe) {
      setError('El producto ya está en el detalle');
      return;
    }
    
    const precioVenta = producto.precio_venta_soles || producto.precio_venta || 0;
    
    const nuevoItem = {
      id_producto: producto.id_producto,
      es_producto_libre: false,
      codigo_producto: producto.codigo,
      producto: producto.nombre,
      unidad_medida: producto.unidad_medida,
      codigo_bien: '',
      cantidad: 1,
      precio_base: precioVenta,
      precio_venta: precioVenta,
      descuento_porcentaje: 0,
      stock_actual: producto.stock_actual,
      peso_unitario: parseFloat(producto.peso_unitario || 0)
    };

    setDetalle([...detalle, nuevoItem]);
    setModalProductoOpen(false);
    setBusquedaProducto('');
  };

  const handleAgregarItemLibre = () => {
    setDetalle([...detalle, {
      id_producto: null,
      es_producto_libre: true,
      codigo_producto: '',
      producto: '',
      descripcion_libre: '',
      unidad_medida: 'NIU',
      unidad_medida_libre: 'NIU',
      codigo_bien: '',
      cantidad: 1,
      precio_base: 0,
      precio_venta: 0,
      descuento_porcentaje: 0,
      stock_actual: null,
      peso_unitario: 0
    }]);
  };

  const handleItemCampoChange = (index, campo, valor) => {
    const nd = [...detalle];
    nd[index][campo] = valor;
    setDetalle(nd);
  };

  const handlePrecioBaseChange = (index, valor) => {
    const newDetalle = [...detalle];
    const precioBase = parseFloat(valor) || 0;
    newDetalle[index].precio_base = precioBase;
    const precioVenta = parseFloat(newDetalle[index].precio_venta) || 0;
    if (precioBase > 0) {
      const margen = ((precioVenta - precioBase) / precioBase) * 100;
      newDetalle[index].descuento_porcentaje = margen;
    } else {
      newDetalle[index].descuento_porcentaje = 0;
    }
    setDetalle(newDetalle);
  };

  const handlePrecioVentaChange = (index, valor) => {
    const newDetalle = [...detalle];
    newDetalle[index].precio_venta = valor;
    const precioVentaNum = parseFloat(valor) || 0;
    const precioBaseNum = parseFloat(newDetalle[index].precio_base) || 0;
    if (precioBaseNum > 0) {
      const margen = ((precioVentaNum - precioBaseNum) / precioBaseNum) * 100;
      newDetalle[index].descuento_porcentaje = margen;
    } else {
      newDetalle[index].descuento_porcentaje = 0;
    }
    setDetalle(newDetalle);
  };

  const handleCantidadChange = (index, valor) => {
    const newDetalle = [...detalle];
    newDetalle[index].cantidad = valor;
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
    const esExport = Number(formCabecera.es_exportacion) === 1;
    const porcentaje = esExport ? 0 : (parseFloat(formCabecera.porcentaje_impuesto) || 0);
    const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
    let subtotal = 0;
    let impuesto = 0;
    let pesoTotal = 0;
    detalle.forEach(item => {
      const precioVenta = parseFloat(item.precio_venta) || 0;
      const lineBase = round2(item.cantidad * precioVenta);
      subtotal += lineBase;
      impuesto += round2(lineBase * (porcentaje / 100));
      const peso = parseFloat(item.peso_unitario || 0);
      if (peso > 0) pesoTotal += item.cantidad * peso;
    });
    subtotal = round2(subtotal);
    impuesto = round2(impuesto);
    const total = round2(subtotal + impuesto);
    setTotales({ subtotal, impuesto, total, pesoTotal });
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

  const handleExportacionChange = (checked) => {
    setFormCabecera(prev => {
      const cfg = TIPOS_IMPUESTO.find(t => t.codigo === prev.tipo_impuesto);
      return {
        ...prev,
        es_exportacion: checked ? 1 : 0,
        porcentaje_impuesto: checked ? 0 : (cfg?.porcentaje ?? 18)
      };
    });
  };

  const handleGuardarDireccion = async () => {
    if (!nuevaDireccion.direccion.trim() || !/^\d{6}$/.test(nuevaDireccion.ubigeo)) return;
    try {
      setSavingDireccion(true);
      const payload = {
        id_cliente: formCabecera.id_cliente,
        direccion: nuevaDireccion.direccion,
        ubigeo: nuevaDireccion.ubigeo,
        referencia: nuevaDireccion.referencia
      };
      const response = await ordenesVentaAPI.addDireccion(payload);
      if (response.data.success) {
        const nuevaDir = {
          id_direccion: response.data.data.id_direccion,
          direccion: response.data.data.direccion,
          ubigeo: response.data.data.ubigeo,
          es_principal: 0
        };
        setDireccionesCliente([...direccionesCliente, nuevaDir]);
        setFormCabecera(prev => ({ ...prev, direccion_entrega: nuevaDir.direccion }));
        setModalDireccionOpen(false);
        setNuevaDireccion({ direccion: '', ubigeo: '', referencia: '' });
        setSuccess('Dirección agregada correctamente');
      }
    } catch (err) {
      console.error(err);
      setError('Error al guardar la dirección');
    } finally {
      setSavingDireccion(false);
    }
  };

  const tieneArchivosOC = tieneOC && (
    (archivos.orden_compra && archivos.orden_compra.length > 0) ||
    (archivosPrevios.orden_compra_url && archivosPrevios.orden_compra_url.length > 0)
  );

  const getArchivosOCParaModal = () => {
    const locales = archivos.orden_compra || [];
    const previos = archivosPrevios.orden_compra_url || [];
    return [...locales, ...previos];
  };

  const handleCambioMoneda = (nuevaMoneda) => {
    if (nuevaMoneda === formCabecera.moneda) return;
    const hayPrecios = detalle.some(it => parseFloat(it.precio_venta) > 0 || parseFloat(it.precio_base) > 0);
    if (!hayPrecios) {
      setFormCabecera(prev => ({ ...prev, moneda: nuevaMoneda, tipo_cambio: nuevaMoneda === 'PEN' ? 1.0000 : prev.tipo_cambio }));
      return;
    }
    setMonedaPendiente(nuevaMoneda);
    setModalTCAbierto(true);
  };

  const convertirDetalleMoneda = (tc, destino) => {
    const convertir = (valor) => {
      const n = parseFloat(valor);
      if (isNaN(n) || n === 0) return valor;
      const r = destino === 'USD' ? n / tc : n * tc;
      return parseFloat(r.toFixed(4));
    };
    setDetalle(prev => prev.map(it => ({
      ...it,
      precio_base: convertir(it.precio_base),
      precio_venta: convertir(it.precio_venta),
      precio_lista_snapshot: it.precio_lista_snapshot != null ? convertir(it.precio_lista_snapshot) : it.precio_lista_snapshot
    })));
  };

  const confirmarTipoCambio = (tc, convertir) => {
    const destino = monedaPendiente;
    if (!destino) return;
    if (convertir && tc) convertirDetalleMoneda(tc, destino);
    setFormCabecera(prev => ({
      ...prev,
      moneda: destino,
      tipo_cambio: destino === 'PEN' ? 1.0000 : (tc && tc > 0 ? parseFloat(tc).toFixed(4) : prev.tipo_cambio)
    }));
    setModalTCAbierto(false);
    setMonedaPendiente(null);
  };

  const cancelarTipoCambio = () => {
    setModalTCAbierto(false);
    setMonedaPendiente(null);
  };

  const validarFormulario = () => {
    const esMuestra = Number(formCabecera.es_muestra) === 1;
    if (!clienteSeleccionado) return 'Debe seleccionar un cliente';
    if (detalle.length === 0) return esMuestra ? 'Debe agregar al menos un ítem de muestra' : 'Debe agregar al menos un producto';
    if (esMuestra) {
      const sinDesc = detalle.some(item => item.es_producto_libre && !String(item.producto || '').trim());
      if (sinDesc) return 'Cada ítem libre de muestra debe tener una descripción';
    } else {
      const sinPrecio = detalle.some(item => !item.precio_venta || parseFloat(item.precio_venta) <= 0);
      if (sinPrecio) return 'Todos los productos deben tener un precio de venta válido';
    }
    if (tieneOC && (!formCabecera.orden_compra_cliente || (!archivos.orden_compra?.length && !archivosPrevios.orden_compra_url?.length))) {
      return 'Si seleccionó "Con Orden de Compra", debe ingresar el correlativo y subir el archivo.';
    }
    if (!esMuestra && estadoCredito?.usar_limite_credito && formCabecera.tipo_venta === 'Crédito') {
      const disponible = formCabecera.moneda === 'USD' ? estadoCredito.credito_usd.disponible : estadoCredito.credito_pen.disponible;
      if (totales.total > disponible) {
        return `Límite de crédito excedido. Disponible: ${formatearMoneda(disponible)}. Total de Orden: ${formatearMoneda(totales.total)}`;
      }
    }
    return null;
  };

  const submitActual = async () => {
    if (loading || submitCooldown.current) return;

    submitCooldown.current = true;
    setCooldownActivo(true);

    try {
      setLoading(true);

      const formData = new FormData();
      Object.keys(formCabecera).forEach(key => {
        if (!tieneOC && key === 'orden_compra_cliente') {
          formData.append(key, '');
        } else {
          formData.append(key, formCabecera[key]);
        }
      });

      formData.append('estado_verificacion_oc', pendingVerifOC.current || 'Sin verificar');

      const esMuestraSubmit = Number(formCabecera.es_muestra) === 1;
      formData.append('detalle', JSON.stringify(detalle.map((item, index) => ({
        id_producto: item.es_producto_libre ? null : item.id_producto,
        es_producto_libre: item.es_producto_libre ? 1 : 0,
        descripcion_libre: item.es_producto_libre ? (String(item.producto || item.descripcion_libre || '').trim()) : null,
        unidad_medida_libre: item.es_producto_libre ? (item.unidad_medida || 'NIU') : null,
        codigo_bien: item.codigo_bien ? String(item.codigo_bien).trim() : null,
        cantidad: parseFloat(item.cantidad),
        precio_base: esMuestraSubmit ? 0 : parseFloat(item.precio_base),
        precio_unitario: esMuestraSubmit ? 0 : parseFloat(item.precio_venta),
        id_lista_origen: item.es_producto_libre ? null : (item.id_lista_origen || null),
        precio_lista_snapshot: item.precio_lista_snapshot != null ? parseFloat(item.precio_lista_snapshot) : null,
        porcentaje_comision: 0,
        descuento_porcentaje: 0,
        orden: index + 1
      }))));

      const ocRestantes = getArrayFromUrls(archivosPrevios.orden_compra_url);
      if (archivosPrevios.orden_compra_url === null || ocRestantes.length === 0) {
        formData.append('limpiar_oc', 'true');
      } else {
        formData.append('orden_compra_url', JSON.stringify(ocRestantes));
      }

      const comprobantesRestantes = getArrayFromUrls(archivosPrevios.comprobante_url);
      if (archivosPrevios.comprobante_url === null || comprobantesRestantes.length === 0) {
        formData.append('limpiar_comprobante', 'true');
      } else {
        formData.append('comprobante_url', JSON.stringify(comprobantesRestantes));
      }

      if (tieneOC && archivos.orden_compra) {
        if (Array.isArray(archivos.orden_compra)) {
          archivos.orden_compra.forEach(file => formData.append('orden_compra', file));
        } else {
          formData.append('orden_compra', archivos.orden_compra);
        }
      }
      if (archivos.comprobante) {
        if (Array.isArray(archivos.comprobante)) {
          archivos.comprobante.forEach(file => formData.append('comprobante', file));
        } else {
          formData.append('comprobante', archivos.comprobante);
        }
      }

      let response;
      if (modoEdicion) {
        response = await ordenesVentaAPI.update(id, formData);
      } else {
        response = await ordenesVentaAPI.create(formData);
      }

      if (response.data.success) {
        if (modoEdicion) {
          setSuccess('Orden actualizada exitosamente');
          setTimeout(() => navigate(`/ventas/ordenes/${id}`), 1500);
        } else {
          setSuccess(`Orden creada: ${response.data.data.numero_orden}`);
          setTimeout(() => navigate(`/ventas/ordenes/${response.data.data.id_orden_venta}`), 1500);
        }
      } else {
        submitCooldown.current = false;
        setCooldownActivo(false);
      }

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al guardar la orden de venta');
      submitCooldown.current = false;
      setCooldownActivo(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirVerificacion = () => {
    setError(null);
    const err = validarFormulario();
    if (err) { setError(err); return; }
    setModalVerificacionOCOpen(true);
  };

  const handleGuardarVerificado = () => {
    pendingVerifOC.current = 'Verificado';
    setModalVerificacionOCOpen(false);
    submitActual();
  };

  const handleGuardarOmitido = () => {
    pendingVerifOC.current = 'Omitida';
    setModalVerificacionOCOpen(false);
    submitActual();
  };

  const handleGuardarDirecto = () => {
    setError(null);
    const err = validarFormulario();
    if (err) { setError(err); return; }
    pendingVerifOC.current = tieneArchivosOC ? 'Omitida' : 'Sin verificar';
    submitActual();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
  };

  const clientesFiltrados = clientes.filter(c => {
    const coincideBusqueda =
      c.razon_social.toLowerCase().includes(busquedaCliente.toLowerCase()) ||
      c.ruc.includes(busquedaCliente);
    if (!coincideBusqueda) return false;
    if (restringidoCartera && vistaCartera === 'asignados') {
      return idsAsignados.includes(c.id_cliente);
    }
    return true;
  });

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
    p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
  );

  if (loading && clientes.length === 0) return <Loading variant="form" />;

  const esMuestra = Number(formCabecera.es_muestra) === 1;
  const tituloFormulario = modoEdicion
    ? (esMuestra ? 'Editar Orden de Muestra' : 'Editar Orden de Venta')
    : (esMuestra ? 'Nueva Orden de Muestra' : 'Nueva Orden de Venta');
  const colCountItems = 4 + (modoEdicion ? 1 : 0) + (esMuestra ? 1 : (3 + (esAdmin ? 1 : 0)));

  return (
    <div className="pg-page vt-page">
      <header className="pg-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm vt-back" onClick={() => navigate('/ventas/ordenes')}>
            <ArrowLeft size={15} /> Volver a órdenes
          </button>
          <span className="pg-eyebrow"><ShoppingCart size={13} /> Órdenes de venta</span>
          <h1 className="pg-title">{tituloFormulario}</h1>
          <p className="pg-subtitle">{modoEdicion ? 'Modificar orden existente' : 'Crear orden manual o desde cotización'}</p>
        </div>
      </header>

      <div className="pg-stack">
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <form onSubmit={handleSubmit}>
        <div className="vt-form-layout">
          <div className="pg-stack">

            <section className={`pg-panel vt-toggle-panel ${esMuestra ? 'is-on is-warning' : ''}`}>
              <div className="vt-toggle-row">
                <div className="vt-toggle-info">
                  <span className="vt-toggle-icon">
                    <Package size={20} />
                  </span>
                  <div>
                    <h2 className="pg-panel-title">Orden de Muestra</h2>
                    <p className="pg-cell-sub">Sin valor comercial · no se factura · solo Guía de Remisión (correlativo MUE-YYYY-XXXX)</p>
                  </div>
                </div>
                <label className="vt-switch is-warning" title={modoEdicion ? 'No se puede cambiar el tipo de una orden existente' : ''}>
                  <input
                    type="checkbox"
                    className="vt-switch-input"
                    checked={esMuestra}
                    disabled={modoEdicion}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setFormCabecera(prev => ({ ...prev, es_muestra: on ? 1 : 0, es_exportacion: on ? 0 : prev.es_exportacion }));
                    }}
                  />
                  <span className="vt-switch-track" aria-hidden="true"></span>
                  <span className="vt-switch-label">
                    {esMuestra ? 'MUESTRA' : 'VENTA'}
                  </span>
                </label>
              </div>
            </section>

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Building size={16} /> Cliente</h2>
              </div>
              <div className="pg-panel-body">
                {clienteSeleccionado ? (
                  <div className="pg-stack">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-lg">{clienteSeleccionado.razon_social}</p>
                          <p className="text-muted text-sm">RUC: {clienteSeleccionado.ruc}</p>
                        </div>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => { setClienteSeleccionado(null); setEstadoCredito(null); setDireccionesCliente([]); }}>
                          Cambiar
                        </button>
                      </div>
                    </div>

                    {estadoCredito && estadoCredito.usar_limite_credito && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 border rounded-lg bg-white shadow-sm">
                          <p className="pg-field-label vt-label-icon">
                            <CreditCard size={12} /> Disponible PEN
                          </p>
                          <p className={`text-lg font-bold ${estadoCredito.credito_pen.disponible < totales.total && formCabecera.moneda === 'PEN' ? 'text-red-600' : 'text-green-600'}`}>
                            S/ {formatearNumero(estadoCredito.credito_pen.disponible)}
                          </p>
                        </div>
                        <div className="p-3 border rounded-lg bg-white shadow-sm">
                          <p className="pg-field-label vt-label-icon">
                            <DollarSign size={12} /> Disponible USD
                          </p>
                          <p className={`text-lg font-bold ${estadoCredito.credito_usd.disponible < totales.total && formCabecera.moneda === 'USD' ? 'text-red-600' : 'text-blue-600'}`}>
                            $ {formatearNumero(estadoCredito.credito_usd.disponible)}
                          </p>
                        </div>
                      </div>
                    )}
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
            </section>

            <section className={`pg-panel vt-toggle-panel ${tieneOC ? 'is-on is-accent' : ''}`}>
              <div className="vt-toggle-row">
                <div className="vt-toggle-info">
                  <span className="vt-toggle-icon">
                    <FileText size={20} />
                  </span>
                  <div>
                    <h2 className="pg-panel-title">Orden de Compra</h2>
                    <p className="pg-cell-sub">Documento del Cliente</p>
                  </div>
                </div>

                <label className="vt-switch is-accent">
                  <input
                    type="checkbox"
                    className="vt-switch-input"
                    checked={tieneOC}
                    onChange={(e) => setTieneOC(e.target.checked)}
                  />
                  <span className="vt-switch-track" aria-hidden="true"></span>
                  <span className="vt-switch-label">
                    {tieneOC ? 'CON O.C.' : 'SIN O.C.'}
                  </span>
                </label>
              </div>

              {tieneOC && (
                  <div className="pg-panel-body pg-stack vt-oc-body">
                    <div className="form-group">
                        <label className="form-label vt-label-icon" htmlFor="vt-ov-oc">
                          <Info size={14} /> N° Orden de Compra (Correlativo) *
                        </label>
                        <div className="vt-input-icon">
                          <Lock size={16} />
                          <input
                            id="vt-ov-oc"
                            type="text"
                            className="form-input font-mono"
                            placeholder="Ej: OC-2025-001234"
                            value={formCabecera.orden_compra_cliente}
                            onChange={(e) => setFormCabecera({...formCabecera, orden_compra_cliente: e.target.value})}
                            maxLength={100}
                            required={tieneOC}
                          />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label vt-label-icon">
                            <Box size={14} /> Archivo Adjunto (PDF o Imagen) *
                        </label>
                        <div className="vt-drop-row">
                            <div
                                className={`vt-dropzone ${archivos.orden_compra && archivos.orden_compra.length > 0 ? 'is-ready' : ''}`}
                                tabIndex="0"
                                onPaste={(e) => handlePaste(e, 'orden_compra')}
                                title="Haz clic aquí y presiona Ctrl+V para pegar una captura"
                            >
                                {archivos.orden_compra && archivos.orden_compra.length > 0 ? (
                                    <div className="vt-dropzone-msg">
                                        <CheckCircle size={22} className="vt-ok-icon" />
                                        <strong>{archivos.orden_compra.length} archivo(s)</strong>
                                        <span>Listos para enviar</span>
                                    </div>
                                ) : (
                                    <div className="vt-dropzone-msg">
                                        <FilePlus size={26} />
                                        <strong>Haz click y pulsa <kbd className="vt-kbd">Ctrl+V</kbd></strong>
                                        <span>para pegar una captura de pantalla</span>
                                    </div>
                                )}
                            </div>

                            <div className="vt-drop-actions">
                              <button
                                  type="button"
                                  className="btn btn-outline vt-drop-btn"
                                  onClick={() => document.getElementById('file-upload-oc').click()}
                                  title="Abrir explorador de archivos"
                              >
                                  <FileText size={18} />
                                  <span>Explorar</span>
                              </button>

                              {archivosPrevios.orden_compra_url && (
                                  <div className="vt-stack-sm">
                                      {getArrayFromUrls(archivosPrevios.orden_compra_url).map((url, idx) => (
                                          <div key={idx} className="pg-rowactions">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-primary"
                                                onClick={() => verArchivo(url)}
                                                title={`Ver archivo ${idx + 1}`}
                                            >
                                                <Eye size={16} /> Ver {idx + 1}
                                            </button>
                                            <button
                                                type="button"
                                                className="pg-iconbtn is-danger"
                                                aria-label={`Eliminar archivo ${idx + 1}`}
                                                onClick={() => handleEliminarArchivoPrevio('orden_compra_url', idx)}
                                                title={`Eliminar archivo ${idx + 1}`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                          </div>
                                      ))}
                                  </div>
                              )}
                            </div>

                            <input 
                                id="file-upload-oc"
                                type="file" 
                                multiple
                                className="hidden" 
                                accept=".pdf,image/*"
                                onChange={(e) => setArchivos({...archivos, orden_compra: [...(archivos.orden_compra || []), ...Array.from(e.target.files)]})}
                            />
                        </div>
                        {archivosPrevios.orden_compra_url && !archivos.orden_compra && (
                            <div className="vt-note is-info is-compact">
                                <Info size={14} />
                                <span className="vt-grow">
                                  Documentos guardados previamente.
                                </span>
                                <button
                                    type="button"
                                    className="pg-iconbtn is-danger"
                                    aria-label="Eliminar documentos adjuntos previamente"
                                    onClick={() => setArchivosPrevios({...archivosPrevios, orden_compra_url: null})}
                                    title="Eliminar documentos adjuntos previamente"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        )}
                    </div>
                  </div>
              )}
            </section>

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Calculator size={16} /> {esMuestra ? 'Ítems de Muestra' : 'Productos'} <span className="pg-count">{detalle.length}</span></h2>
                <div className="pg-rowactions">
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => setModalProductoOpen(true)}>
                    <Plus size={16} /> {esMuestra ? 'Del catálogo' : 'Agregar'}
                  </button>
                  {esMuestra && (
                    <button type="button" className="btn btn-sm btn-outline btn-warning" onClick={handleAgregarItemLibre}>
                      <Plus size={16} /> Ítem libre
                    </button>
                  )}
                </div>
              </div>
              {modoEdicion && detalle.length > 1 && (
                <div className={`product-reorder-help vt-reorder-help flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${indiceArrastrado !== null ? 'is-active' : ''}`}>
                  <GripVertical size={17} />
                  {indiceArrastrado !== null
                    ? <>Moviendo <strong>{detalle[indiceArrastrado]?.producto || 'producto'}</strong> · Posición {indiceArrastrado + 1} de {detalle.length}</>
                    : <>Arrastra cada producto desde el asa para cambiar el orden que tendrá en el PDF.</>}
                </div>
              )}
              <div className="pg-table-wrap">
                <table className="table">
                  <thead>
  <tr>
    {modoEdicion && <th aria-label="Reordenar"></th>}
    <th>{esMuestra ? 'Ítem / Descripción' : 'Producto'}</th>
    {esMuestra && <th className="vt-col-md">Cód. Bien</th>}
    <th className="text-right w-24">Cant.</th>
    <th className="text-right w-24">Peso</th>
    {!esMuestra && <th className="text-right w-28">P. Base</th>}
    {!esMuestra && <th className="text-right w-28">P. Venta</th>}
    {!esMuestra && esAdmin && <th className="text-center w-20">Margen %</th>}
    {!esMuestra && <th className="text-right w-28">Subtotal</th>}
    <th aria-label="Acciones"></th>
  </tr>
</thead>
                  <tbody>
                    {detalle.length === 0 ? (
                      <tr><td colSpan={colCountItems}><div className="pg-empty"><Calculator size={28} /><strong>{esMuestra ? 'No hay ítems de muestra agregados' : 'No hay productos agregados'}</strong><span>Usa el botón Agregar para incluirlos en la orden.</span></div></td></tr>
                    ) : (
                      detalle.map((item, index) => {
                        const precioVenta = parseFloat(item.precio_venta) || 0;
                        const valorVenta = item.cantidad * precioVenta;
                        const margen = parseFloat(item.descuento_porcentaje || 0);
                        const margenColor = margen < 0 ? 'text-red-600 font-bold' : '';
                        
                        return (
                          <tr
                            key={item.id_detalle || item.id_producto || index}
                            className={`product-row-draggable ${indiceArrastrado === index ? 'is-dragging' : ''}`}
                            onDragOver={modoEdicion ? (event) => moverDuranteArrastre(event, index) : undefined}
                            onDrop={modoEdicion ? finalizarArrastre : undefined}
                          >
                            {modoEdicion && (
                              <td>
                                <span
                                  draggable
                                  role="button"
                                  tabIndex={0}
                                  title="Arrastrar para reordenar"
                                  aria-label={`Mover ${item.producto || 'producto'}`}
                                  className="pg-iconbtn vt-drag"
                                  onDragStart={(event) => iniciarArrastre(event, index)}
                                  onDragEnd={cancelarArrastre}
                                >
                                  <GripVertical size={19} />
                                </span>
                              </td>
                            )}
                            <td>
                              {item.es_producto_libre ? (
                                <div className="vt-stack-sm">
                                  <input
                                    type="text"
                                    className="form-input vt-input-sm"
                                    placeholder="Descripción del bien (ej. test muestra)"
                                    value={item.producto}
                                    onChange={(e) => handleItemCampoChange(index, 'producto', e.target.value)}
                                  />
                                  <input
                                    type="text"
                                    className="form-input vt-input-sm vt-input-um"
                                    placeholder="Unid. (NIU)"
                                    value={item.unidad_medida}
                                    onChange={(e) => handleItemCampoChange(index, 'unidad_medida', e.target.value.toUpperCase())}
                                    maxLength={5}
                                    title="Código de unidad SUNAT (NIU por defecto)"
                                  />
                                </div>
                              ) : (
                                <>
                                  <div className="font-medium">{item.producto}</div>
                                  <div className="text-xs text-muted font-mono">{item.codigo_producto}</div>
                                </>
                              )}
                            </td>
                            {esMuestra && (
                              <td>
                                <input
                                  type="text"
                                  className="form-input vt-input-sm font-mono"
                                  placeholder="Opcional (13 díg.)"
                                  value={item.codigo_bien || ''}
                                  onChange={(e) => handleItemCampoChange(index, 'codigo_bien', e.target.value.replace(/[^0-9]/g, ''))}
                                  maxLength={14}
                                />
                              </td>
                            )}
                            <td>
                              <input
  type="text"
  inputMode="decimal"
  className="form-input text-right vt-input-sm"
  value={item.cantidad}
  onChange={(e) => {
    const val = e.target.value.replace(',', '.');
    if (val === '' || /^\d*\.?\d*$/.test(val)) handleCantidadChange(index, val);
  }}
/>
                            </td>
                            <td className="text-right text-sm">
  {(() => {
    const peso = parseFloat(item.peso_unitario || 0);
    if (peso === 0) return <span className="text-muted">—</span>;
    const pesoTotalItem = item.cantidad * peso;
    return (
      <div>
        <span className="font-bold">{formatearPeso(pesoTotalItem)}</span>
        <div className="pg-cell-sub">{formatearPeso(peso)}/u</div>
      </div>
    );
  })()}
</td>
                            {!esMuestra && (
                            <td>
                              <input
  type="text"
  className="form-input text-right vt-input-sm bg-gray-100"
  value={item.precio_base}
  readOnly
  tabIndex={-1}
  style={{ cursor: 'default' }}
/>
                            </td>
                            )}
                            {!esMuestra && (
                            <td>
                              <input
  type="text"
  inputMode="decimal"
  className="form-input text-right vt-input-sm bg-blue-50"
  value={item.precio_venta}
  onChange={(e) => {
    const val = e.target.value.replace(',', '.');
    if (val === '' || /^\d*\.?\d*$/.test(val)) handlePrecioVentaChange(index, val);
  }}
  placeholder="0.000"
/>
                            </td>
                            )}
                            {!esMuestra && esAdmin && (
                            <td>
                              <input
  type="text"
  className={`form-input text-center vt-input-sm bg-gray-100 ${margenColor}`}
  value={parseFloat(item.descuento_porcentaje).toFixed(2)}
  readOnly
  tabIndex={-1}
  style={{ cursor: 'default' }}
/>
                            </td>
                            )}
                            {!esMuestra && <td className="text-right font-bold">{formatearMoneda(valorVenta)}</td>}
                            <td>
                              <button type="button" className="pg-iconbtn is-danger" aria-label="Quitar ítem" onClick={() => handleEliminarItem(index)}>
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
            </section>

            <section className="pg-panel">
              <div className="pg-panel-body">
                <label className="form-label" htmlFor="vt-ov-observaciones">Observaciones</label>
                <textarea
                  id="vt-ov-observaciones" 
                  className="form-textarea" 
                  rows="2"
                  value={formCabecera.observaciones}
                  onChange={(e) => setFormCabecera({...formCabecera, observaciones: e.target.value})}
                ></textarea>
              </div>
            </section>
          </div>

          <div className="pg-stack">
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Info size={16} /> Datos Generales</h2>
              </div>
              <div className="pg-panel-body pg-stack">
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
                      onChange={(e) => handleCambioMoneda(e.target.value)}
                    >
                      <option value="PEN">Soles</option>
                      <option value="USD">Dólares</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Tipo Cambio</label>
                    <input
                      type="number"
                      className={`form-input ${formCabecera.moneda === 'USD' ? 'vt-input-warning' : ''}`}
                      value={formCabecera.tipo_cambio}
                      onChange={(e) => setFormCabecera({...formCabecera, tipo_cambio: e.target.value})}
                      disabled={formCabecera.moneda === 'PEN'}
                      step="0.001"
                      onWheel={handleWheelDisable}
                    />
                    
                  </div>
                </div>

                {formCabecera.moneda === 'USD' && (
                  <div className="vt-note is-warning is-compact vt-tc-alert" role="alert">
                    <Info size={14} />
                    <strong>¡ASIGNAR T.C. UTILIZADO!</strong>
                  </div>
                )}

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
            </section>

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Truck size={16} /> Logística y Transporte</h2>
              </div>
              <div className="pg-panel-body pg-stack">
                <div>
                  <label className="form-label">Tipo de Entrega</label>
                  <select 
                    className="form-select"
                    value={formCabecera.tipo_entrega}
                    onChange={(e) => setFormCabecera({...formCabecera, tipo_entrega: e.target.value})}
                  >
                    <option value="Vehiculo Empresa">Vehículo de Empresa</option>
                    <option value="Transporte Privado">Transporte Privado</option>
                    <option value="Recojo Tienda">Recojo en Tienda</option>
                  </select>
                </div>

                {formCabecera.tipo_entrega === 'Vehiculo Empresa' && (
                  <>
                    <div>
                      <label className="form-label flex items-center gap-2">
                        <Truck size={16} /> Vehículo Asignado
                      </label>
                      <select 
                        className="form-select"
                        value={formCabecera.id_vehiculo}
                        onChange={(e) => setFormCabecera({...formCabecera, id_vehiculo: e.target.value})}
                      >
                        <option value="">Sin asignar</option>
                        {vehiculos.map(v => (
                          <option key={v.id_vehiculo} value={v.id_vehiculo}>
                            {v.placa} - {v.marca_modelo}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label flex items-center gap-2">
                        <User size={16} /> Conductor Asignado
                      </label>
                      <select 
                        className="form-select"
                        value={formCabecera.id_conductor}
                        onChange={(e) => setFormCabecera({...formCabecera, id_conductor: e.target.value})}
                      >
                        <option value="">Sin asignar</option>
                        {conductores.map(c => (
                          <option key={c.id_empleado} value={c.id_empleado}>
                            {c.nombre_completo} {c.dni ? `- DNI: ${c.dni}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {formCabecera.tipo_entrega === 'Transporte Privado' && (
                  <div className="vt-subbox vt-stack-sm">
                    <div>
                        <label className="form-label text-xs">Empresa de Transporte</label>
                        <input 
                            type="text"
                            className="form-input form-input-sm"
                            placeholder="Nombre de la empresa"
                            value={formCabecera.transporte_nombre}
                            onChange={(e) => setFormCabecera({...formCabecera, transporte_nombre: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="form-label text-xs">Placa del Vehículo</label>
                        <input 
                            type="text"
                            className="form-input form-input-sm"
                            placeholder="ABC-123"
                            value={formCabecera.transporte_placa}
                            onChange={(e) => setFormCabecera({...formCabecera, transporte_placa: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="form-label text-xs">Conductor</label>
                            <input 
                                type="text"
                                className="form-input form-input-sm"
                                placeholder="Nombre completo"
                                value={formCabecera.transporte_conductor}
                                onChange={(e) => setFormCabecera({...formCabecera, transporte_conductor: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="form-label text-xs">DNI Conductor</label>
                            <input 
                                type="text"
                                className="form-input form-input-sm"
                                placeholder="DNI"
                                maxLength={8}
                                value={formCabecera.transporte_dni}
                                onChange={(e) => {
                                  const dni = e.target.value.replace(/\D/g, '').slice(0, 8);
                                  setFormCabecera({...formCabecera, transporte_dni: dni});
                                  consultaDocumento.dni('transporte_dni', dni, (datos) => {
                                    setFormCabecera(prev => ({...prev, transporte_conductor: datos.nombre_completo}));
                                  });
                                }}
                            />
                            <EstadoConsulta estado={consultaDocumento.estados.transporte_dni} />
                        </div>
                    </div>
                    <div>
                        <label className="form-label text-xs">Licencia de Conducir</label>
                        <input 
                            type="text"
                            className="form-input form-input-sm"
                            placeholder="N° Licencia"
                            maxLength={20}
                            value={formCabecera.transporte_licencia}
                            onChange={(e) => setFormCabecera({...formCabecera, transporte_licencia: e.target.value})}
                        />
                    </div>
                  </div>
                )}

                {formCabecera.tipo_entrega === 'Recojo Tienda' && (
                    <div className="vt-note is-info is-compact">
                        <Box size={14} />
                        <span>El cliente recogerá los productos en las instalaciones de la empresa.</span>
                    </div>
                )}
              </div>
            </section>

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><CreditCard size={16} /> Pago y Crédito</h2>
              </div>
              <div className="pg-panel-body pg-stack">
                <div>
                  <label className="form-label">Condición de Pago</label>
                  {clienteSeleccionado?.condicion_pago ? (
                    <div className="flex items-center gap-2 p-2 bg-gray-100 border rounded-lg">
                      <Lock size={14} className="text-muted" />
                      <span className="font-medium">
                        {clienteSeleccionado.condicion_pago === 'Credito'
                          ? `Crédito ${clienteSeleccionado.dias_credito} Días`
                          : 'Contado'}
                      </span>
                      <span className="text-xs text-muted ml-auto">Definido en ficha del cliente</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={`btn flex-1 py-2 ${formCabecera.tipo_venta === 'Contado' ? 'btn-success' : 'btn-outline'}`}
                          onClick={() => setFormCabecera({...formCabecera, tipo_venta: 'Contado'})}
                        >
                          <DollarSign size={18} className="inline mr-1" /> Contado
                        </button>
                        <button
                          type="button"
                          className={`btn flex-1 py-2 ${formCabecera.tipo_venta === 'Crédito' ? 'btn-warning' : 'btn-outline'} ${!cargandoCredito && !estadoCredito?.usar_limite_credito ? 'opacity-50' : ''}`}
                          onClick={() => estadoCredito?.usar_limite_credito && setFormCabecera({...formCabecera, tipo_venta: 'Crédito'})}
                          disabled={cargandoCredito || !estadoCredito?.usar_limite_credito}
                        >
                          {cargandoCredito
                            ? <Clock size={18} className="inline mr-1 animate-spin" />
                            : !estadoCredito?.usar_limite_credito
                              ? <Lock size={18} className="inline mr-1" />
                              : <Clock size={18} className="inline mr-1" />
                          } Crédito
                        </button>
                      </div>

                      {formCabecera.tipo_venta === 'Crédito' && (
                        <div className="vt-subbox vt-mt">
                          <label className="form-label">Días de Crédito</label>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {DIAS_CREDITO_OPCIONES.map(dias => (
                              <button
                                key={dias}
                                type="button"
                                className={`btn btn-xs ${parseInt(formCabecera.dias_credito) === dias ? 'btn-warning' : 'btn-outline'}`}
                                onClick={() => setFormCabecera({...formCabecera, dias_credito: dias})}
                              >
                                {dias} días
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted">Otro:</span>
                            <input 
                              type="number" 
                              className="form-input form-input-sm w-20 text-center"
                              value={formCabecera.dias_credito}
                              onChange={(e) => setFormCabecera({...formCabecera, dias_credito: e.target.value})}
                              onWheel={handleWheelDisable}
                            />
                            <span className="text-xs font-bold vt-text-warning ml-auto">
                              Vence: {new Date(formCabecera.fecha_vencimiento).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="form-label">Medio de Pago</label>
                  <select 
                    className="form-select"
                    value={formCabecera.forma_pago}
                    onChange={(e) => setFormCabecera({...formCabecera, forma_pago: e.target.value})}
                  >
                    <option value="">Seleccione...</option>
                    {FORMAS_PAGO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                  </select>
                </div>

                <div>
                  <label className="form-label">Dirección Entrega</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      {direccionesCliente.length > 0 ? (
                        <>
                          <select
                            className="form-select pl-10"
                            value={formCabecera.direccion_entrega}
                            onChange={(e) => setFormCabecera({...formCabecera, direccion_entrega: e.target.value})}
                          >
                            <option value="">Seleccione una dirección...</option>
                            {direccionesCliente.map((dir, idx) => (
                              <option key={idx} value={dir.direccion}>
                                {dir.direccion} {dir.es_principal ? '(Principal)' : ''}
                              </option>
                            ))}
                          </select>
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        </>
                      ) : (
                        <textarea 
                          className="form-textarea" 
                          rows="2"
                          value={formCabecera.direccion_entrega}
                          onChange={(e) => setFormCabecera({...formCabecera, direccion_entrega: e.target.value})}
                        ></textarea>
                      )}
                    </div>
                    {clienteSeleccionado && (
                      <button 
                        type="button" 
                        className="btn btn-outline px-3" 
                        onClick={() => setModalDireccionOpen(true)}
                        title="Guardar nueva dirección"
                      >
                        <Plus size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="pg-panel vt-resumen-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Calculator size={16} /> Resumen</h2>
              </div>
              <div className="pg-panel-body">
                <dl className="vt-sum">
                {totales.pesoTotal > 0 && (
                  <div>
                    <dt><Package size={13} /> Peso total</dt>
                    <dd className="vt-text-accent">{formatearPeso(totales.pesoTotal)}</dd>
                  </div>
                )}
                <div>
                  <dt>Sub total</dt>
                  <dd>{formatearMoneda(totales.subtotal)}</dd>
                </div>

                <div className="vt-sum-impuesto">
                  <dt>
                    <div>
                      <label className="form-label" htmlFor="vt-ov-impuesto">Tipo de Impuesto</label>
                      <select
                        id="vt-ov-impuesto"
                        className="form-select"
                        value={formCabecera.tipo_impuesto}
                        onChange={(e) => handleTipoImpuestoChange(e.target.value)}
                        disabled={Number(formCabecera.es_exportacion) === 1}
                      >
                        {TIPOS_IMPUESTO.map(tipo => (
                          <option key={tipo.codigo} value={tipo.codigo}>
                            {tipo.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </dt>
                  <dd>{formatearMoneda(totales.impuesto)}</dd>
                </div>
                </dl>

                {!esMuestra && (
                <label className="pg-check vt-mt">
                  <input
                    type="checkbox"
                    checked={Number(formCabecera.es_exportacion) === 1}
                    onChange={(e) => handleExportacionChange(e.target.checked)}
                  />
                  <div><span>Factura de exportación</span><small>IGV 0%</small></div>
                </label>
                )}
                <dl className="vt-sum">
                  <div className="vt-sum-total">
                    <dt>Total</dt>
                    <dd>{formatearMoneda(totales.total)}</dd>
                  </div>
                </dl>

                <div className="vt-subbox vt-mt-lg">
                    <h3 className="pg-section-title"><FileText size={14} /> Comprobante / Voucher <small className="pg-muted">(Opcional)</small></h3>

                    <div className="vt-drop-row">
                        <div
                            className={`vt-dropzone is-compact ${archivos.comprobante && archivos.comprobante.length > 0 ? 'is-ready' : ''}`}
                            tabIndex="0"
                            onPaste={(e) => handlePaste(e, 'comprobante')}
                            title="Haz clic aquí y presiona Ctrl+V para pegar una captura"
                            onClick={() => document.getElementById('file-upload-comp').click()}
                        >
                            {archivos.comprobante && archivos.comprobante.length > 0 ? (
                                <div className="vt-dropzone-msg">
                                    <CheckCircle size={18} className="vt-ok-icon" />
                                    <strong>{archivos.comprobante.length} archivo(s)</strong>
                                </div>
                            ) : (
                                <div className="vt-dropzone-msg">
                                    <strong>Click y <kbd className="vt-kbd">Ctrl+V</kbd></strong>
                                    <span>para pegar voucher</span>
                                </div>
                            )}
                        </div>

                        <div className="vt-drop-actions">
                          <button
                              type="button"
                              className="btn btn-sm btn-outline vt-drop-btn"
                              onClick={() => document.getElementById('file-upload-comp').click()}
                              title="Subir archivo"
                          >
                              <FilePlus size={16} />
                              <span>Subir</span>
                          </button>

                          {archivosPrevios.comprobante_url && (
                              <div className="vt-stack-sm">
                                  {getArrayFromUrls(archivosPrevios.comprobante_url).map((url, idx) => (
                                      <div key={idx} className="pg-rowactions">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-primary"
                                            onClick={() => verArchivo(url)}
                                            title={`Ver comprobante ${idx + 1}`}
                                        >
                                            <Eye size={16} /> Ver {idx + 1}
                                        </button>
                                        <button
                                            type="button"
                                            className="pg-iconbtn is-danger"
                                            aria-label={`Eliminar comprobante ${idx + 1}`}
                                            onClick={() => handleEliminarArchivoPrevio('comprobante_url', idx)}
                                            title={`Eliminar comprobante ${idx + 1}`}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                      </div>
                                  ))}
                              </div>
                          )}
                        </div>

                        <input 
                            id="file-upload-comp"
                            type="file" 
                            multiple
                            className="hidden" 
                            accept=".pdf,image/*"
                            onChange={(e) => setArchivos({...archivos, comprobante: [...(archivos.comprobante || []), ...Array.from(e.target.files)]})}
                        />
                    </div>
                </div>

                {tieneArchivosOC ? (
                  <div className="vt-save-row">
                    <button
                      type="button"
                      onClick={handleAbrirVerificacion}
                      className="btn btn-warning vt-save-btn"
                      disabled={loading || cooldownActivo}
                    >
                      <ShieldCheck size={20} className={loading ? 'animate-spin' : ''} />
                      {loading ? 'PROCESANDO...' : 'VERIFICAR OC'}
                    </button>
                    <button
                      type="button"
                      onClick={handleGuardarDirecto}
                      className="btn btn-primary vt-save-btn"
                      disabled={loading || cooldownActivo}
                    >
                      <Save size={20} className={loading ? 'animate-spin' : ''} />
                      {loading ? 'PROCESANDO...' : cooldownActivo ? 'ESPERE...' : modoEdicion ? 'ACTUALIZAR' : 'GUARDAR'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGuardarDirecto}
                    className="btn btn-primary vt-save-btn is-full"
                    disabled={loading || !clienteSeleccionado || detalle.length === 0 || cooldownActivo}
                  >
                    <Save size={24} className={loading ? 'animate-spin' : ''} />
                    {loading ? 'PROCESANDO...' : cooldownActivo ? 'ESPERE POR FAVOR...' : modoEdicion ? 'ACTUALIZAR ORDEN DE VENTA' : 'GUARDAR ORDEN DE VENTA'}
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      </form>
      </div>

      <ModalVerificacionOC
        isOpen={modalVerificacionOCOpen}
        onVerificado={handleGuardarVerificado}
        onOmitir={handleGuardarOmitido}
        onCancelar={() => setModalVerificacionOCOpen(false)}
        archivosOC={getArchivosOCParaModal()}
        detalle={detalle}
        totales={totales}
        moneda={formCabecera.moneda}
        guardando={loading || cooldownActivo}
      />

      <ModalTipoCambio
        isOpen={modalTCAbierto}
        monedaOrigen={formCabecera.moneda}
        monedaDestino={monedaPendiente || formCabecera.moneda}
        montoReferencia={totales.total}
        onConfirmar={confirmarTipoCambio}
        onCancelar={cancelarTipoCambio}
      />

      <Modal isOpen={modalClienteOpen} onClose={() => setModalClienteOpen(false)} title="Seleccionar Cliente" size="lg">
        {restringidoCartera && (
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              className={`btn btn-sm flex-1 ${vistaCartera === 'asignados' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setVistaCartera('asignados')}
            >
              Mis clientes asignados ({idsAsignados.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm flex-1 ${vistaCartera === 'todos' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setVistaCartera('todos')}
            >
              Ver todos
            </button>
          </div>
        )}
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
        <div className="max-h-96 overflow-y-auto vt-stack-sm">
          {clientesFiltrados.map(c => {
            const asignado = esClienteAsignado(c.id_cliente);
            return (
            <div
              key={c.id_cliente}
              className={`p-3 border rounded flex justify-between items-center ${asignado ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-60 vt-cursor-na bg-gray-50'}`}
              onClick={() => asignado ? handleSelectCliente(c) : setError('Este cliente no forma parte de tu cartera asignada.')}
              title={asignado ? '' : 'Cliente no asignado a tu cartera'}
            >
              <div>
                <div className="font-bold">{c.razon_social}</div>
                <div className="text-sm text-muted">{c.ruc}</div>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                {!asignado && (
                  <span className="badge badge-secondary">
                    <Lock size={10} /> No asignado
                  </span>
                )}
                {c.usar_limite_credito === 1 ? (
                    <span className="badge badge-success">
                      <CheckCircle size={10} /> Crédito Habilitado
                    </span>
                ) : (
                    <span className="badge badge-secondary">
                      <Lock size={10} /> Solo Contado
                    </span>
                )}
              </div>
            </div>
            );
          })}
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
        <div className="max-h-96 overflow-y-auto vt-stack-sm">
          {productosFiltrados.map(p => (
            <div key={p.id_producto} className="p-3 border rounded hover:bg-gray-50 cursor-pointer flex justify-between" onClick={() => handleAgregarProducto(p)}>
              <div>
                <div className="font-bold">{p.nombre}</div>
                <div className="text-sm text-muted">{p.codigo}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-primary">{formatearMoneda(p.precio_venta_soles || p.precio_venta)}</div>
                <div className="text-xs text-muted">Stock: {parseFloat(parseFloat(p.stock_actual).toFixed(4))}</div>
              </div>
            </div>
          ))}
        </div>
      </Modal>
      <Modal isOpen={modalDireccionOpen} onClose={() => setModalDireccionOpen(false)} title="Nueva Dirección de Entrega" size="md">
        <div className="pg-stack">
          <div className="form-group">
            <label className="form-label">Dirección *</label>
            <textarea
              className="form-textarea"
              value={nuevaDireccion.direccion}
              onChange={(e) => setNuevaDireccion({ ...nuevaDireccion, direccion: e.target.value })}
              placeholder="Ingresa la dirección completa..."
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
          <div className="form-group">
            <label className="form-label">Ubigeo *</label>
            <UbigeoSelector
              value={nuevaDireccion.ubigeo}
              onChange={(codigo) => setNuevaDireccion({ ...nuevaDireccion, ubigeo: codigo })}
              required
            />
            <p className="text-xs text-muted mt-1">Quedará guardado para las próximas órdenes y guías.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-outline" onClick={() => setModalDireccionOpen(false)} disabled={savingDireccion}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleGuardarDireccion} disabled={savingDireccion || !nuevaDireccion.direccion.trim() || !/^\d{6}$/.test(nuevaDireccion.ubigeo)}>
              {savingDireccion ? 'Guardando...' : 'Guardar Dirección'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default NuevaOrdenVenta;
