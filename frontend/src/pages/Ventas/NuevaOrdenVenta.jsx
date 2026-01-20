import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash2, Save, Search,
  ShoppingCart, Building, Calculator,
  MapPin, DollarSign, CreditCard, Info, Clock,
  FileText, Lock, CheckCircle, Truck, User, Box
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

const FORMAS_PAGO = [
  'Transferencia Bancaria',
  'Depósito en Cuenta',
  'Cheque',
  'Efectivo',
  'Letra de Cambio',
  'Yape',
  'Plin',
  'Tarjeta de Crédito',
  'Tarjeta de Débito'
];

const DIAS_CREDITO_OPCIONES = [7, 15, 30, 45, 60, 90];

function NuevaOrdenVenta() {
  const navigate = useNavigate();
  const { id } = useParams(); 
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const idCotizacionParam = searchParams.get('cotizacion');
  
  const modoEdicion = !!id;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [comerciales, setComerciales] = useState([]);
  const [cotizacionesPendientes, setCotizacionesPendientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [conductores, setConductores] = useState([]);
  
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [modalProductoOpen, setModalProductoOpen] = useState(false);
  
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [direccionesCliente, setDireccionesCliente] = useState([]);
  const [estadoCredito, setEstadoCredito] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [totales, setTotales] = useState({ subtotal: 0, impuesto: 0, total: 0, totalComisiones: 0 });

  const [modalDireccionOpen, setModalDireccionOpen] = useState(false);
  const [nuevaDireccion, setNuevaDireccion] = useState({ direccion: '', referencia: '' });
  const [savingDireccion, setSavingDireccion] = useState(false);
  
  const [formCabecera, setFormCabecera] = useState({
    tipo_comprobante: 'Factura',
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
    orden_compra_cliente: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_entrega_estimada: '',
    fecha_vencimiento: new Date().toISOString().split('T')[0], 
    moneda: 'PEN',
    tipo_cambio: 1.0000,
    tipo_impuesto: 'IGV',
    porcentaje_impuesto: 18.00,
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

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 4
    }).format(valor);
  };

  const formatearMoneda = (valor) => {
    const simbolo = formCabecera.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    if (modoEdicion) {
      cargarOrden();
    }
  }, [id]);

  useEffect(() => {
    calcularTotales();
  }, [detalle, formCabecera.porcentaje_impuesto]);

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
    if (idCotizacionParam && !modoEdicion && clientes.length > 0) {
      handleImportarCotizacion(idCotizacionParam);
    }
  }, [idCotizacionParam, clientes.length]);

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
        );
        setComerciales(vendedores);
      }

      if (resCotizaciones.data.success) {
        setCotizacionesPendientes(resCotizaciones.data.data || []);
      }

      if (resVehiculos.data.success) {
        setVehiculos(resVehiculos.data.data || []);
      }

      if (resConductores.data.success) {
        setConductores(resConductores.data.data || []);
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
        const configImpuesto = obtenerConfiguracionImpuesto(orden.tipo_impuesto);

        setFormCabecera({
          tipo_comprobante: orden.tipo_comprobante || 'Factura',
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
          orden_compra_cliente: orden.orden_compra_cliente || '',
          fecha_emision: orden.fecha_emision ? orden.fecha_emision.split('T')[0] : '',
          fecha_entrega_estimada: orden.fecha_entrega_estimada ? orden.fecha_entrega_estimada.split('T')[0] : '',
          fecha_vencimiento: orden.fecha_vencimiento ? orden.fecha_vencimiento.split('T')[0] : '',
          moneda: orden.moneda,
          tipo_cambio: orden.tipo_cambio,
          tipo_impuesto: configImpuesto.codigo,
          porcentaje_impuesto: configImpuesto.porcentaje,
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

        const resCli = await clientesAPI.getById(orden.id_cliente);
        if (resCli.data.success) {
          const clienteData = resCli.data.data;
          setClienteSeleccionado(clienteData);
          if (clienteData.direcciones && clienteData.direcciones.length > 0) {
            setDireccionesCliente(clienteData.direcciones);
          } else if (clienteData.direccion_despacho) {
            setDireccionesCliente([{ id_direccion: 'principal', direccion: clienteData.direccion_despacho, es_principal: 1 }]);
          }
        }

        if (orden.detalle && orden.detalle.length > 0) {
          setDetalle(orden.detalle.map(item => ({
            id_producto: item.id_producto,
            codigo_producto: item.codigo_producto,
            producto: item.producto,
            unidad_medida: item.unidad_medida,
            cantidad: parseFloat(item.cantidad),
            precio_base: parseFloat(item.precio_base) > 0 ? parseFloat(item.precio_base) : parseFloat(item.precio_unitario),
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

  const handleSelectCliente = async (cliente) => {
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
  
        setFormCabecera(prev => ({
          ...prev,
          id_cliente: clienteCompleto.id_cliente,
          direccion_entrega: direccionPrincipal ? direccionPrincipal.direccion : '',
          tipo_venta: 'Contado'
        }));
  
        const resCredito = await clientesAPI.getEstadoCredito(clienteCompleto.id_cliente);
        if (resCredito.data.success) {
          setEstadoCredito(resCredito.data.data);
        }
      } catch (err) {
        console.error('Error al cargar datos completos del cliente:', err);
        setClienteSeleccionado(cliente);
        setFormCabecera(prev => ({
          ...prev,
          id_cliente: cliente.id_cliente,
          direccion_entrega: cliente.direccion_despacho || '',
          tipo_venta: 'Contado'
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
    
    const precioBase = producto.precio_venta_soles || producto.precio_venta || 0;
    
    const nuevoItem = {
      id_producto: producto.id_producto,
      codigo_producto: producto.codigo,
      producto: producto.nombre,
      unidad_medida: producto.unidad_medida,
      cantidad: 1,
      precio_base: precioBase,
      porcentaje_comision: 0,
      monto_comision: 0,
      precio_unitario: '',
      descuento_porcentaje: 0,
      stock_actual: producto.stock_actual
    };
    
    setDetalle([...detalle, nuevoItem]);
    setModalProductoOpen(false);
    setBusquedaProducto('');
  };

  const handlePrecioVentaChange = (index, valor) => {
    const newDetalle = [...detalle];
    newDetalle[index].precio_unitario = valor;
    
    const precioVenta = parseFloat(valor);
    const precioBase = parseFloat(newDetalle[index].precio_base);
    
    if (!isNaN(precioVenta) && precioBase > 0) {
      const ganancia = precioVenta - precioBase;
      const porcentaje = (ganancia / precioBase) * 100;
      
      newDetalle[index].porcentaje_comision = porcentaje;
      newDetalle[index].monto_comision = ganancia;
    } else {
      newDetalle[index].porcentaje_comision = 0;
      newDetalle[index].monto_comision = 0;
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
      const precioVenta = parseFloat(item.precio_unitario) || 0;
      const valorVenta = (item.cantidad * precioVenta) * (1 - item.descuento_porcentaje / 100);
      subtotal += valorVenta;
      totalComisiones += (item.monto_comision || 0) * item.cantidad;
    });
    
    const porcentaje = parseFloat(formCabecera.porcentaje_impuesto) || 0;
    const impuesto = subtotal * (porcentaje / 100);
    const total = subtotal + impuesto;
    
    setTotales({ subtotal, impuesto, total, totalComisiones });
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
      const response = await ordenesVentaAPI.addDireccion(payload);
      if (response.data.success) {
        const nuevaDir = {
          id_direccion: response.data.data.id_direccion,
          direccion: response.data.data.direccion,
          es_principal: 0
        };
        setDireccionesCliente([...direccionesCliente, nuevaDir]);
        setFormCabecera(prev => ({ ...prev, direccion_entrega: nuevaDir.direccion }));
        setModalDireccionOpen(false);
        setNuevaDireccion({ direccion: '', referencia: '' });
        setSuccess('Dirección agregada correctamente');
      }
    } catch (err) {
      console.error(err);
      setError('Error al guardar la dirección');
    } finally {
      setSavingDireccion(false);
    }
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

    const productosSinPrecio = detalle.some(item => !item.precio_unitario || parseFloat(item.precio_unitario) <= 0);
    if (productosSinPrecio) {
      setError('Todos los productos deben tener un precio de venta válido');
      return;
    }

    if (estadoCredito?.usar_limite_credito && formCabecera.tipo_venta === 'Crédito') {
      const disponible = formCabecera.moneda === 'USD' ? estadoCredito.credito_usd.disponible : estadoCredito.credito_pen.disponible;
      if (totales.total > disponible) {
        setError(`Límite de crédito excedido. Disponible: ${formatearMoneda(disponible)}. Total de Orden: ${formatearMoneda(totales.total)}`);
        return;
      }
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
        if (response.data.success) {
          setSuccess('Orden actualizada exitosamente');
          setTimeout(() => navigate(`/ventas/ordenes/${id}`), 1500);
        }
      } else {
        response = await ordenesVentaAPI.create(payload);
        if (response.data.success) {
          setSuccess(`Orden creada: ${response.data.data.numero_orden}`);
          setTimeout(() => navigate(`/ventas/ordenes/${response.data.data.id_orden_venta}`), 1500);
        }
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
                  <div className="space-y-4">
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
                          <p className="text-[10px] text-muted uppercase font-bold mb-1 flex items-center gap-1">
                            <CreditCard size={12} /> Disponible PEN
                          </p>
                          <p className={`text-lg font-bold ${estadoCredito.credito_pen.disponible < totales.total && formCabecera.moneda === 'PEN' ? 'text-red-600' : 'text-green-600'}`}>
                            S/ {formatearNumero(estadoCredito.credito_pen.disponible)}
                          </p>
                        </div>
                        <div className="p-3 border rounded-lg bg-white shadow-sm">
                          <p className="text-[10px] text-muted uppercase font-bold mb-1 flex items-center gap-1">
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
            </div>

            <div className="card">
              <div className="card-header bg-gradient-to-r from-orange-50 to-white">
                <h2 className="card-title text-orange-900">
                  <FileText size={20} /> Orden de Compra del Cliente
                </h2>
              </div>
              <div className="card-body">
                <label className="form-label text-sm font-semibold text-gray-700">
                  Nº Orden de Compra (Opcional)
                </label>
                <input
                  type="text"
                  className="form-input text-lg font-mono"
                  placeholder="Ej: OC-2025-001234"
                  value={formCabecera.orden_compra_cliente}
                  onChange={(e) => setFormCabecera({...formCabecera, orden_compra_cliente: e.target.value})}
                  maxLength={100}
                />
                <p className="text-xs text-muted mt-2">
                  <Info size={12} className="inline mr-1" />
                  Número de orden de compra proporcionado por el cliente (si aplica)
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-header bg-gradient-to-r from-green-50 to-white">
                <h2 className="card-title text-green-900">
                  <FileText size={20} /> Tipo de Comprobante
                </h2>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    className={`btn py-6 text-lg ${
                      formCabecera.tipo_comprobante === 'Factura' 
                        ? 'btn-success text-white shadow-lg' 
                        : 'btn-outline hover:bg-green-50'
                    }`}
                    onClick={() => setFormCabecera({...formCabecera, tipo_comprobante: 'Factura'})}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={32} />
                      <div>
                        <div className="font-bold">FACTURA</div>
                        <div className="text-xs opacity-80">F001-00000001</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    className={`btn py-6 text-lg ${
                      formCabecera.tipo_comprobante === 'Nota de Venta' 
                        ? 'btn-info text-white shadow-lg' 
                        : 'btn-outline hover:bg-blue-50'
                    }`}
                    onClick={() => setFormCabecera({...formCabecera, tipo_comprobante: 'Nota de Venta'})}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={32} />
                      <div>
                        <div className="font-bold">NOTA DE VENTA</div>
                        <div className="text-xs opacity-80">NV001-00000001</div>
                      </div>
                    </div>
                  </button>
                </div>
                
                <div className="mt-3 text-sm text-muted bg-blue-50 border border-blue-200 rounded p-3">
                  <Info size={14} className="inline mr-1" />
                  {formCabecera.tipo_comprobante === 'Factura' 
                    ? 'Comprobante fiscal para clientes con RUC. Válido para sustentar gastos.'
                    : 'Comprobante simple para ventas menores. No válido para sustentar gastos.'}
                </div>
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
                      <th className="text-right w-28">P. Venta</th>
                      <th className="text-right w-28">Comisión</th>
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
                        const precioVenta = parseFloat(item.precio_unitario) || 0;
                        const valorVenta = (item.cantidad * precioVenta) * (1 - item.descuento_porcentaje / 100);
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
                              <div className="form-input text-right bg-gray-100 border-none p-1 h-8 flex items-center justify-end">
                                {formatearMoneda(item.precio_base)}
                              </div>
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input text-right p-1 h-8 bg-blue-50"
                                value={item.precio_unitario}
                                onChange={(e) => handlePrecioVentaChange(index, e.target.value)}
                                min="0" step="0.001"
                                placeholder="0.000"
                              />
                            </td>
                            <td>
                              <div className="form-input text-right bg-gray-100 border-none p-1 h-8 flex flex-col justify-center items-end">
                                <span className="text-xs font-bold">{parseFloat(item.porcentaje_comision).toFixed(2)}%</span>
                                <span className="text-[10px] text-success">+{formatearMoneda(item.monto_comision)}</span>
                              </div>
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
              <div className="card-header bg-gradient-to-r from-indigo-50 to-white">
                <h2 className="card-title text-indigo-900"><Truck size={20} /> Logística y Transporte</h2>
              </div>
              <div className="card-body space-y-4">
                
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
                  <div className="space-y-3 bg-gray-50 p-3 rounded-md border border-gray-200">
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
                                onChange={(e) => setFormCabecera({...formCabecera, transporte_dni: e.target.value})}
                            />
                        </div>
                    </div>
                  </div>
                )}

                {formCabecera.tipo_entrega === 'Recojo Tienda' && (
                    <div className="bg-blue-50 p-3 rounded-md border border-blue-100 text-sm text-blue-800 flex items-center gap-2">
                        <Box size={16} />
                        El cliente recogerá los productos en las instalaciones de la empresa.
                    </div>
                )}

              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title"><CreditCard size={20} /> Pago y Crédito</h2>
              </div>
              <div className="card-body space-y-4">
                
                <div>
                  <label className="form-label">Condición de Pago</label>
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
                      className={`btn flex-1 py-2 ${formCabecera.tipo_venta === 'Crédito' ? 'btn-warning' : 'btn-outline'} ${!estadoCredito?.usar_limite_credito ? 'opacity-50' : ''}`}
                      onClick={() => estadoCredito?.usar_limite_credito && setFormCabecera({...formCabecera, tipo_venta: 'Crédito'})}
                      disabled={!estadoCredito?.usar_limite_credito}
                    >
                      {!estadoCredito?.usar_limite_credito ? <Lock size={18} className="inline mr-1" /> : <Clock size={18} className="inline mr-1" />} Crédito
                    </button>
                  </div>
                </div>

                {formCabecera.tipo_venta === 'Crédito' && (
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 animated fade-in">
                    <label className="form-label text-orange-800">Días de Crédito</label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {DIAS_CREDITO_OPCIONES.map(dias => (
                        <button
                          key={dias}
                          type="button"
                          className={`btn btn-xs ${parseInt(formCabecera.dias_credito) === dias ? 'btn-warning' : 'bg-white hover:bg-orange-100 border-orange-200'}`}
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
                      />
                      <span className="text-xs font-bold text-orange-700 ml-auto">
                        Vence: {new Date(formCabecera.fecha_vencimiento).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

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
                    <div>
                      <label className="form-label">Tipo de Impuesto</label>
                      <select
                        className="form-select"
                        value={formCabecera.tipo_impuesto}
                        onChange={(e) => handleTipoImpuestoChange(e.target.value)}
                      >
                        {TIPOS_IMPUESTO.map(tipo => (
                          <option key={tipo.codigo} value={tipo.codigo}>
                            {tipo.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
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
            <div key={c.id_cliente} className="p-3 border rounded hover:bg-gray-50 cursor-pointer flex justify-between items-center" onClick={() => handleSelectCliente(c)}>
              <div>
                <div className="font-bold">{c.razon_social}</div>
                <div className="text-sm text-muted">{c.ruc}</div>
              </div>
              <div className="text-right">
                {c.usar_limite_credito === 1 ? (
                    <span className="badge badge-success flex items-center gap-1 text-[10px]">
                      <CheckCircle size={10} /> Crédito Habilitado
                    </span>
                ) : (
                    <span className="badge badge-secondary flex items-center gap-1 text-[10px]">
                      <Lock size={10} /> Solo Contado
                    </span>
                )}
              </div>
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
                <div className="font-bold text-primary">{formatearMoneda(p.precio_venta_soles || p.precio_venta)}</div>
                <div className="text-xs text-muted">Stock: {parseFloat(p.stock_actual).toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal isOpen={modalDireccionOpen} onClose={() => setModalDireccionOpen(false)} title="Nueva Dirección de Entrega" size="md">
        <div className="space-y-4">
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
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-outline" onClick={() => setModalDireccionOpen(false)} disabled={savingDireccion}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleGuardarDireccion} disabled={savingDireccion || !nuevaDireccion.direccion.trim()}>
              {savingDireccion ? 'Guardando...' : 'Guardar Dirección'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default NuevaOrdenVenta;