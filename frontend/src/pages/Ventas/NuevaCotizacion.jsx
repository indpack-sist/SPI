import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash2, Save, Search,
  Calculator, FileText, Building,
  Calendar, RefreshCw, AlertCircle, Info, Lock, ExternalLink,
  Building2, User, Loader, CheckCircle
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { cotizacionesAPI, clientesAPI, productosAPI, empleadosAPI, dashboard } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const TIPOS_IMPUESTO = [
  { codigo: 'IGV', nombre: 'IGV 18%', porcentaje: 18.00 },
  { codigo: 'EXO', nombre: 'Exonerado 0%', porcentaje: 0.00 },
  { codigo: 'INA', nombre: 'Inafecto 0%', porcentaje: 0.00 }
];

const PLAZOS_PAGO = [
  'Contado',
  'Crédito 7 Días',
  'Crédito 15 Días',
  'Crédito 30 Días',
  'Crédito 45 Días',
  'Crédito 60 Días',
  'Crédito 90 Días'
];

const FORMAS_PAGO = [
  'Transferencia Bancaria',
  'Efectivo',
  'Yape'
];

const PLAZOS_ENTREGA = [
  'Inmediata (Stock)',
  '2 a 3 Días Hábiles',
  '5 a 7 Días Hábiles',
  '7 a 10 Días Hábiles',
  '10 a 15 Días Hábiles',
  '15 a 20 Días Hábiles',
  '25 a 30 Días Hábiles'
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
  
  const [formCabecera, setFormCabecera] = useState({
    id_cliente: '',
    id_comercial: user?.id_empleado || '',
    fecha_emision: new Date().toLocaleDateString('en-CA'),
    moneda: 'PEN',
    tipo_impuesto: 'IGV',
    porcentaje_impuesto: 18.00,
    tipo_cambio: 1.0000,
    plazo_pago: '',
    forma_pago: '',
    direccion_entrega: '',
    observaciones: '',
    validez_dias: 7,
    plazo_entrega: '',
    lugar_entrega: ''
  });
  
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [totales, setTotales] = useState({ subtotal: 0, impuesto: 0, total: 0 });
  
  const [fechaVencimientoCalculada, setFechaVencimientoCalculada] = useState('');

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    if (modoEdicion || modoDuplicar) {
      cargarCotizacion();
    }
  }, [id, modoEdicion, modoDuplicar]);

  useEffect(() => {
    calcularTotales();
  }, [detalle, formCabecera.porcentaje_impuesto]);

  useEffect(() => {
    if (formCabecera.validez_dias && formCabecera.fecha_emision) {
      const fechaEmision = new Date(formCabecera.fecha_emision);
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
      setError('Error al cargar catálogos');
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
        
        const fechaEmision = modoDuplicar ? new Date().toLocaleDateString('en-CA') : cotizacion.fecha_emision.split('T')[0];
        
        setFormCabecera({
          id_cliente: cotizacion.id_cliente,
          id_comercial: cotizacion.id_comercial || user?.id_empleado || '',
          fecha_emision: fechaEmision,
          moneda: cotizacion.moneda,
          tipo_impuesto: cotizacion.tipo_impuesto,
          porcentaje_impuesto: cotizacion.porcentaje_impuesto,
          tipo_cambio: cotizacion.tipo_cambio,
          plazo_pago: cotizacion.plazo_pago || '',
          forma_pago: cotizacion.forma_pago || '',
          direccion_entrega: cotizacion.direccion_entrega || '',
          observaciones: cotizacion.observaciones || '',
          validez_dias: cotizacion.validez_dias || 7,
          plazo_entrega: cotizacion.plazo_entrega || '',
          lugar_entrega: cotizacion.lugar_entrega || ''
        });
        
        const clienteEncontrado = clientes.find(c => c.id_cliente === cotizacion.id_cliente);
        if (clienteEncontrado) {
          setClienteSeleccionado(clienteEncontrado);
        } else {
          setClienteSeleccionado({
            id_cliente: cotizacion.id_cliente,
            razon_social: cotizacion.cliente,
            ruc: cotizacion.ruc_cliente
          });
        }
        
        if (cotizacion.detalle && cotizacion.detalle.length > 0) {
          setDetalle(cotizacion.detalle.map(item => ({
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
      setError('Error al cargar la cotización');
    } finally {
      setLoading(false);
    }
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

  const handleSelectCliente = (cliente) => {
    setClienteSeleccionado(cliente);
    setFormCabecera(prev => ({
      ...prev,
      id_cliente: cliente.id_cliente,
      lugar_entrega: cliente.direccion_despacho || ''
    }));
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
      setErrorApi('El RUC debe tener 11 dígitos');
      return;
    }

    if (tipo === 'DNI' && !/^\d{8}$/.test(documento)) {
      setErrorApi('El DNI debe tener 8 dígitos');
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
          setErrorApi(`Este ${tipo} ya está registrado en el sistema`);
        }
      } else {
        setErrorApi(response.data.error || `${tipo} no válido`);
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
        setSuccess('Cliente creado y seleccionado automáticamente');
        setModalClienteOpen(false);
        
        setTabCliente('lista');
        setNuevoClienteDoc({ tipo: 'RUC', numero: '' });
        setClienteApiData(null);
      }
    } catch (err) {
      console.error(err);
      setErrorApi('Error al crear el cliente automáticamente');
    } finally {
      setLoadingApi(false);
    }
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
      precio_unitario: precioBase,
      descuento_porcentaje: 0,
      stock_actual: producto.stock_actual
    };
    
    setDetalle([...detalle, nuevoItem]);
    setModalProductoOpen(false);
    setBusquedaProducto('');
  };

  const handlePrecioBaseChange = (index, precioBase) => {
    const newDetalle = [...detalle];
    const item = newDetalle[index];
    const nuevoPrecioBase = parseFloat(precioBase) || 0;
    const porcentajeComision = parseFloat(item.porcentaje_comision || 0);
    
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
    
    const montoComision = precioBase * (porcentajeComision / 100);
    const precioFinal = precioBase + montoComision;
    
    newDetalle[index].porcentaje_comision = porcentajeComision;
    newDetalle[index].monto_comision = montoComision;
    newDetalle[index].precio_unitario = precioFinal;
    
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
      const valorVenta = (item.cantidad * item.precio_unitario) * (1 - item.descuento_porcentaje / 100);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (cotizacionConvertida) {
      setError('No se puede editar una cotización que ya ha sido convertida a Orden de Venta');
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
        detalle: detalle.map((item, index) => ({
          id_producto: item.id_producto,
          cantidad: parseFloat(item.cantidad),
          precio_base: parseFloat(item.precio_base),
          porcentaje_comision: parseFloat(item.porcentaje_comision || 0),
          precio_unitario: parseFloat(item.precio_unitario),
          descuento_porcentaje: parseFloat(item.descuento_porcentaje) || 0,
          orden: index + 1
        }))
      };

      let response;
      if (modoEdicion) {
        response = await cotizacionesAPI.update(id, payload);
        if (response.data.success) {
          setSuccess('Cotización actualizada exitosamente');
          setTimeout(() => navigate(`/ventas/cotizaciones/${id}`), 1500);
        }
      } else {
        response = await cotizacionesAPI.create(payload);
        if (response.data.success) {
          setSuccess(`Cotización creada: ${response.data.data.numero_cotizacion}`);
          setTimeout(() => navigate('/ventas/cotizaciones'), 1500);
        }
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || `Error al ${modoEdicion ? 'actualizar' : 'crear'} cotización`);
    } finally {
      setLoading(false);
    }
  };

  const formatearMoneda = (valor) => {
    const simbolo = formCabecera.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toFixed(3)}`;
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

  const tituloFormulario = modoEdicion ? 'Editar Cotización' : modoDuplicar ? 'Duplicar Cotización' : 'Nueva Cotización';
  const subtituloFormulario = modoEdicion ? 'Modificar cotización existente' : modoDuplicar ? 'Crear nueva cotización basada en una existente' : 'Emitir cotización de venta al cliente';

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
              <span>Esta cotización ya fue convertida a Orden de Venta y no puede ser editada.</span>
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
                    disabled={cotizacionConvertida}
                  >
                    Cambiar
                  </button>
                </div>
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
              Datos de la Cotización
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
                  disabled={cotizacionConvertida}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Validez (días) *</label>
                <input
                  type="number"
                  className="form-input"
                  value={formCabecera.validez_dias}
                  onChange={(e) => setFormCabecera({ ...formCabecera, validez_dias: e.target.value })}
                  min="1"
                  disabled={cotizacionConvertida}
                  required
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
                  <Info size={12} className="inline" /> Se calcula automáticamente
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
                  <option value="USD">Dólares (USD)</option>
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
                      ✓ API: {new Date(tipoCambioFecha).toLocaleDateString()}
                    </small>
                  )}
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">Condición de Pago *</label>
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
                      if (formCabecera.plazo_pago === 'Contado') {
                        setFormCabecera(prev => ({ ...prev, plazo_pago: '' })); 
                      }
                    }}
                    disabled={cotizacionConvertida}
                  >
                    Crédito
                  </button>
                </div>
              </div>

              {formCabecera.plazo_pago !== 'Contado' && (
                <div className="form-group">
                  <label className="form-label">Días de Crédito * <AlertCircle size={14} className="inline text-warning" /></label>
                  <select
                    className={`form-select ${!formCabecera.plazo_pago && formCabecera.plazo_pago !== 'Contado' ? 'border-primary ring-2 ring-primary/20' : ''}`}
                    value={formCabecera.plazo_pago === 'Contado' ? '' : formCabecera.plazo_pago}
                    onChange={(e) => setFormCabecera({ ...formCabecera, plazo_pago: e.target.value })}
                    disabled={cotizacionConvertida}
                    required={formCabecera.plazo_pago !== 'Contado'}
                  >
                    <option value="">Seleccione los días...</option>
                    {PLAZOS_PAGO.filter(p => p !== 'Contado').map(plazo => (
                      <option key={plazo} value={plazo}>{plazo}</option>
                    ))}
                  </select>
                  {!formCabecera.plazo_pago && (
                    <small className="text-primary block mt-1">
                      ↑ Por favor seleccione los días de crédito
                    </small>
                  )}
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
                <small className="text-muted block mt-1">
                  <Info size={12} className="inline" /> Por defecto se asigna al usuario actual
                </small>
              </div>
            </div>
            
            <div className="form-group mt-4">
              <label className="form-label">Lugar de Entrega</label>
              <input
                type="text"
                className="form-input"
                value={formCabecera.lugar_entrega}
                onChange={(e) => setFormCabecera({ ...formCabecera, lugar_entrega: e.target.value })}
                placeholder="Dirección de entrega"
                disabled={cotizacionConvertida}
              />
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
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h2 className="card-title">
                <Calculator size={20} />
                Productos *
              </h2>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setModalProductoOpen(true)}
                disabled={cotizacionConvertida}
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
                      <th className="text-right">Cantidad</th>
                      <th>UM</th>
                      <th className="text-right">P. Base</th>
                      <th className="text-right">% Comis.</th>
                      <th className="text-right">P. Final</th>
                      <th className="text-right">Desc. %</th>
                      <th className="text-right">Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((item, index) => {
                      const valorVenta = (item.cantidad * item.precio_unitario) * (1 - item.descuento_porcentaje / 100);
                      return (
                        <tr key={index}>
                          <td className="font-mono text-sm">{item.codigo_producto}</td>
                          <td>{item.producto}</td>
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
                            />
                          </td>
                          <td className="text-sm text-muted">{item.unidad_medida}</td>
                          <td>
                            <input
                              type="number"
                              className="form-input text-right bg-blue-50"
                              value={item.precio_base}
                              onChange={(e) => handlePrecioBaseChange(index, e.target.value)}
                              min="0"
                              step="0.001"
                              disabled={cotizacionConvertida}
                              required
                            />
                            <div className="text-xs text-muted text-right mt-1">Editable</div>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input text-right bg-yellow-50"
                              value={item.porcentaje_comision}
                              onChange={(e) => handleComisionChange(index, e.target.value)}
                              min="0"
                              max="100"
                              step="0.01"
                              disabled={cotizacionConvertida}
                              placeholder="0"
                            />
                            <div className="text-xs text-success text-right mt-1">
                              +{formatearMoneda(item.monto_comision || 0)}
                            </div>
                          </td>
                          <td className="text-right">
                            <div className="font-bold text-primary">
                              {formatearMoneda(item.precio_unitario)}
                            </div>
                            <div className="text-xs text-muted">al cliente</div>
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
                              disabled={cotizacionConvertida}
                            />
                          </td>
                          <td className="text-right font-bold">{formatearMoneda(valorVenta)}</td>
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
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={() => setModalProductoOpen(true)}
                  disabled={cotizacionConvertida}
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
                  {totales.totalComisiones > 0 && (
                    <div className="flex justify-between py-2 border-b text-success">
                      <span className="font-medium">💰 Mis Comisiones:</span>
                      <span className="font-bold">{formatearMoneda(totales.totalComisiones)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">
                      {TIPOS_IMPUESTO.find(t => t.codigo === formCabecera.tipo_impuesto)?.nombre}:
                    </span>
                    <span className="font-bold">{formatearMoneda(totales.impuesto)}</span>
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
              {loading ? 'Guardando...' : modoEdicion ? 'Actualizar Cotización' : 'Guardar Cotización'}
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
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-success mt-1" size={20} />
                  <div className="flex-1">
                    <h4 className="font-bold text-success mb-1">Datos Encontrados</h4>
                    <p className="text-sm"><strong>Razón Social:</strong> {clienteApiData.razon_social || clienteApiData.nombre_completo}</p>
                    <p className="text-sm"><strong>Dirección:</strong> {clienteApiData.direccion || '-'}</p>
                    <p className="text-sm"><strong>Estado:</strong> {clienteApiData.estado || 'Activo'}</p>
                    
                    <button 
                      type="button" 
                      className="btn btn-success w-full mt-3"
                      onClick={crearYSeleccionarCliente}
                      disabled={loadingApi}
                    >
                      {loadingApi ? 'Registrando...' : 'Registrar y Seleccionar Cliente'}
                    </button>
                    <p className="text-xs text-muted text-center mt-2">
                      Se registrará automáticamente como cliente nuevo.
                    </p>
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
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary text-lg">{formatearMoneda(producto.precio_venta)}</div>
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

export default NuevaCotizacion;