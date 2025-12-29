// frontend/src/pages/Ventas/NuevaCotizacion.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash2, Save, Search,
  Calculator, FileText, User, Building,
  Calendar, DollarSign, AlertTriangle, RefreshCw
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { cotizacionesAPI, clientesAPI, productosAPI, empleadosAPI, dashboard } from '../../config/api';

// ✅ TIPOS DE IMPUESTO CONFIGURABLES
const TIPOS_IMPUESTO = [
  { codigo: 'IGV', nombre: '18% (Incluye IGV)', porcentaje: 18.00 },
  { codigo: 'IGV3', nombre: '6% (Incluye IGV)', porcentaje: 6.00 },
  { codigo: 'IGV4', nombre: '18%', porcentaje: 18.00 },
  { codigo: 'GRA', nombre: '0% Gratis - Exonerado', porcentaje: 0.00 },
  { codigo: '6%', nombre: '6%', porcentaje: 6.00 },
  { codigo: 'EXO', nombre: '0% Exonerado', porcentaje: 0.00 },
  { codigo: 'INA', nombre: 'Inafecto', porcentaje: 0.00 },
  { codigo: 'EXP', nombre: 'Exportación', porcentaje: 0.00 },
];

function NuevaCotizacion() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [loadingTC, setLoadingTC] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // ✅ Catálogos REALES
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [comerciales, setComerciales] = useState([]);
  
  // ✅ TIPO DE CAMBIO
  const [tipoCambio, setTipoCambio] = useState(null);
  const [tipoCambioFecha, setTipoCambioFecha] = useState(null);
  
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [modalProductoOpen, setModalProductoOpen] = useState(false);
  
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  
  const [formCabecera, setFormCabecera] = useState({
    id_cliente: '',
    id_comercial: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_validez: '',
    moneda: 'PEN',
    tipo_impuesto: 'IGV',
    porcentaje_impuesto: 18.00,
    tipo_cambio: 1.0000,
    plazo_pago: '',
    forma_pago: '',
    orden_compra_cliente: '',
    lugar_entrega: '',
    plazo_entrega: '',
    validez_dias: '7',
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
  }, [detalle, formCabecera.tipo_impuesto, formCabecera.porcentaje_impuesto]);

  useEffect(() => {
    if (formCabecera.validez_dias && formCabecera.fecha_emision) {
      const fechaEmision = new Date(formCabecera.fecha_emision);
      fechaEmision.setDate(fechaEmision.getDate() + parseInt(formCabecera.validez_dias));
      setFormCabecera({
        ...formCabecera,
        fecha_validez: fechaEmision.toISOString().split('T')[0]
      });
    }
  }, [formCabecera.fecha_emision, formCabecera.validez_dias]);

  // ✅ CARGAR DATOS REALES DESDE API
  const cargarCatalogos = async () => {
    try {
      setLoading(true);
      
      // Cargar clientes activos
      const resClientes = await clientesAPI.getAll({ estado: 'Activo' });
      if (resClientes.data.success) {
        setClientes(resClientes.data.data || []);
      }
      
      // Cargar productos de Producto Terminado (tipo_inventario = 3)
      const resProductos = await productosAPI.getAll({ 
        id_tipo_inventario: 3,  // Solo productos terminados
        estado: 'Activo'
      });
      if (resProductos.data.success) {
        setProductos(resProductos.data.data || []);
      }
      
      // ✅ FILTRAR SOLO EMPLEADOS CON ROL "Ventas"
      const resComerciales = await empleadosAPI.getAll({ estado: 'Activo' });
      if (resComerciales.data.success) {
        const vendedores = (resComerciales.data.data || []).filter(
          emp => emp.rol?.toLowerCase() === 'ventas' || emp.rol?.toLowerCase() === 'comercial'
        );
        setComerciales(vendedores);
      }
      
    } catch (err) {
      console.error('Error al cargar catálogos:', err);
      setError('Error al cargar catálogos: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // ✅ OBTENER TIPO DE CAMBIO DESDE API
  const obtenerTipoCambio = async () => {
    try {
      setLoadingTC(true);
      setError(null);
      
      // ✅ USAR EL ENDPOINT CORRECTO - ACTUALIZAR MANUAL
      const response = await dashboard.actualizarTipoCambio({
        currency: 'USD',
        date: formCabecera.fecha_emision
      });
      
      if (response.data.success && response.data.data) {
        const tc = response.data.data;
        const valorTC = tc.venta || tc.compra || tc.tipo_cambio || 1.0000;
        setTipoCambio(valorTC);
        setTipoCambioFecha(tc.fecha || formCabecera.fecha_emision);
        setFormCabecera({
          ...formCabecera,
          tipo_cambio: parseFloat(valorTC)
        });
        setSuccess(`Tipo de cambio actualizado: S/ ${parseFloat(valorTC).toFixed(4)}`);
      } else {
        setError('No se pudo obtener el tipo de cambio. Ingrese manualmente.');
      }
    } catch (err) {
      console.error('Error al obtener TC:', err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Servicio no disponible';
      setError(`Tipo de cambio: ${errorMsg}. Puede ingresar manualmente.`);
    } finally {
      setLoadingTC(false);
    }
  };

  const handleSelectCliente = (cliente) => {
    setClienteSeleccionado(cliente);
    setFormCabecera({
      ...formCabecera,
      id_cliente: cliente.id_cliente,
      lugar_entrega: cliente.direccion_despacho || ''
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
      valor_venta: producto.precio_venta || 0,
      stock_actual: producto.stock_actual,
      requiere_receta: producto.requiere_receta
    };
    
    setDetalle([...detalle, nuevoItem]);
    setModalProductoOpen(false);
    setBusquedaProducto('');
  };

  const handleCantidadChange = (index, cantidad) => {
    const newDetalle = [...detalle];
    newDetalle[index].cantidad = parseFloat(cantidad) || 0;
    newDetalle[index].valor_venta = 
      newDetalle[index].cantidad * 
      newDetalle[index].precio_unitario * 
      (1 - newDetalle[index].descuento_porcentaje / 100);
    setDetalle(newDetalle);
  };

  const handlePrecioChange = (index, precio) => {
    const newDetalle = [...detalle];
    newDetalle[index].precio_unitario = parseFloat(precio) || 0;
    newDetalle[index].valor_venta = 
      newDetalle[index].cantidad * 
      newDetalle[index].precio_unitario * 
      (1 - newDetalle[index].descuento_porcentaje / 100);
    setDetalle(newDetalle);
  };

  const handleDescuentoChange = (index, descuento) => {
    const newDetalle = [...detalle];
    newDetalle[index].descuento_porcentaje = parseFloat(descuento) || 0;
    newDetalle[index].valor_venta = 
      newDetalle[index].cantidad * 
      newDetalle[index].precio_unitario * 
      (1 - newDetalle[index].descuento_porcentaje / 100);
    setDetalle(newDetalle);
  };

  const handleEliminarItem = (index) => {
    const newDetalle = detalle.filter((_, i) => i !== index);
    setDetalle(newDetalle);
  };

  // ✅ CALCULAR TOTALES CON IMPUESTO DINÁMICO
  const calcularTotales = () => {
    const subtotal = detalle.reduce((sum, item) => sum + (item.valor_venta || 0), 0);
    const porcentaje = parseFloat(formCabecera.porcentaje_impuesto) || 0;
    const impuesto = subtotal * (porcentaje / 100);
    const total = subtotal + impuesto;
    setTotales({ subtotal, impuesto, total });
  };

  // ✅ MANEJAR CAMBIO DE TIPO DE IMPUESTO
  const handleTipoImpuestoChange = (codigo) => {
    const tipoImpuesto = TIPOS_IMPUESTO.find(t => t.codigo === codigo);
    if (tipoImpuesto) {
      setFormCabecera({
        ...formCabecera,
        tipo_impuesto: codigo,
        porcentaje_impuesto: tipoImpuesto.porcentaje
      });
    }
  };

  // ✅ GUARDAR EN API REAL
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
    
    // Validar stock insuficiente
    const sinStock = detalle.filter(item => item.stock_actual < item.cantidad && !item.requiere_receta);
    if (sinStock.length > 0) {
      setError(`Productos sin stock suficiente: ${sinStock.map(i => i.producto).join(', ')}`);
      return;
    }
    
    try {
      setLoading(true);
      
      const payload = {
        id_cliente: parseInt(formCabecera.id_cliente),
        id_comercial: formCabecera.id_comercial ? parseInt(formCabecera.id_comercial) : null,
        fecha_emision: formCabecera.fecha_emision,
        fecha_vencimiento: formCabecera.fecha_validez, // ✅ CORREGIDO: era fecha_validez
        moneda: formCabecera.moneda,
        tipo_impuesto: formCabecera.tipo_impuesto,
        porcentaje_impuesto: parseFloat(formCabecera.porcentaje_impuesto),
        tipo_cambio: parseFloat(formCabecera.tipo_cambio),
        plazo_pago: formCabecera.plazo_pago,
        forma_pago: formCabecera.forma_pago,
        orden_compra_cliente: formCabecera.orden_compra_cliente,
        lugar_entrega: formCabecera.lugar_entrega,
        plazo_entrega: formCabecera.plazo_entrega,
        validez_dias: parseInt(formCabecera.validez_dias),
        observaciones: formCabecera.observaciones,
        subtotal: totales.subtotal,
        igv: totales.impuesto,
        total: totales.total,
        detalle: detalle.map((item, index) => ({
          id_producto: item.id_producto,
          cantidad: parseFloat(item.cantidad),
          precio_unitario: parseFloat(item.precio_unitario),
          descuento_porcentaje: parseFloat(item.descuento_porcentaje) || 0,
          valor_venta: parseFloat(item.valor_venta),
          orden: index + 1
        }))
      };
      
      const response = await cotizacionesAPI.create(payload);
      
      if (response.data.success) {
        setSuccess('Cotización creada exitosamente');
        setTimeout(() => {
          navigate('/ventas/cotizaciones');
        }, 1500);
      } else {
        setError(response.data.error || 'Error al crear cotización');
      }
      
    } catch (err) {
      console.error('Error al crear cotización:', err);
      setError(err.response?.data?.error || 'Error al crear cotización');
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

  if (loading && clientes.length === 0) {
    return <Loading message="Cargando formulario..." />;
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button 
          className="btn btn-outline"
          onClick={() => navigate('/ventas/cotizaciones')}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText size={32} />
            Nueva Cotización
          </h1>
          <p className="text-muted">Registre una nueva cotización de venta</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <form onSubmit={handleSubmit}>
        {/* Sección Cliente */}
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
                  <div className="flex-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted">Cliente:</label>
                        <p className="font-bold text-lg">{clienteSeleccionado.razon_social}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted">RUC:</label>
                        <p className="font-bold">{clienteSeleccionado.ruc}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted">Dirección:</label>
                        <p>{clienteSeleccionado.direccion_despacho || 'No especificado'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted">Contacto:</label>
                        <p>{clienteSeleccionado.contacto || 'No especificado'}</p>
                      </div>
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

        {/* Datos de la Cotización */}
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
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Validez (días)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formCabecera.validez_dias}
                  onChange={(e) => setFormCabecera({ ...formCabecera, validez_dias: e.target.value })}
                  min="1"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Fecha de Vencimiento</label>
                <input
                  type="date"
                  className="form-input"
                  value={formCabecera.fecha_validez}
                  readOnly
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                />
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
              
              {/* ✅ TIPO DE IMPUESTO SELECCIONABLE */}
              <div className="form-group">
                <label className="form-label">Tipo de Impuesto *</label>
                <select
                  className="form-select"
                  value={formCabecera.tipo_impuesto}
                  onChange={(e) => handleTipoImpuestoChange(e.target.value)}
                  required
                >
                  {TIPOS_IMPUESTO.map(tipo => (
                    <option key={tipo.codigo} value={tipo.codigo}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* ✅ TIPO DE CAMBIO CON BOTÓN - EDITABLE MANUALMENTE */}
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
                    placeholder="1.0000"
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={obtenerTipoCambio}
                    disabled={loadingTC}
                    title="Obtener tipo de cambio desde API"
                  >
                    {loadingTC ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <RefreshCw size={18} />
                    )}
                  </button>
                </div>
                {tipoCambioFecha && (
                  <p className="text-xs text-success mt-1">
                    ✓ TC API: {new Date(tipoCambioFecha).toLocaleDateString()}
                  </p>
                )}
                <p className="text-xs text-muted mt-1">
                  Ingrese manualmente o use el botón para obtener desde API
                </p>
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
                <label className="form-label">Plazo de Entrega</label>
                <input
                  type="text"
                  className="form-input"
                  value={formCabecera.plazo_entrega}
                  onChange={(e) => setFormCabecera({ ...formCabecera, plazo_entrega: e.target.value })}
                  placeholder="Ej: 15 días"
                />
              </div>
              
              {/* ✅ COMERCIAL (SOLO VENDEDORES) */}
              <div className="form-group">
                <label className="form-label">Vendedor/Comercial</label>
                <select
                  className="form-select"
                  value={formCabecera.id_comercial}
                  onChange={(e) => setFormCabecera({ ...formCabecera, id_comercial: e.target.value })}
                >
                  <option value="">Seleccione...</option>
                  {comerciales.map(c => (
                    <option key={c.id_empleado} value={c.id_empleado}>
                      {c.nombre_completo} ({c.rol})
                    </option>
                  ))}
                </select>
                {comerciales.length === 0 && (
                  <p className="text-xs text-warning mt-1">
                    No hay empleados con rol "Ventas" disponibles
                  </p>
                )}
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
              />
            </div>
          </div>
        </div>

        {/* Detalle de Productos */}
        <div className="card mb-4">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h2 className="card-title">
                <Calculator size={20} />
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
                      <th style={{ width: '100px' }}>Código</th>
                      <th>Descripción</th>
                      <th style={{ width: '100px' }}>Cantidad</th>
                      <th style={{ width: '80px' }}>Unidad</th>
                      <th style={{ width: '120px' }}>P. Unitario</th>
                      <th style={{ width: '100px' }}>Desc. %</th>
                      <th style={{ width: '120px' }}>Subtotal</th>
                      <th style={{ width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((item, index) => (
                      <tr key={index}>
                        <td className="font-mono text-sm">{item.codigo_producto}</td>
                        <td>
                          <div className="font-medium">{item.producto}</div>
                          {item.stock_actual < item.cantidad && !item.requiere_receta && (
                            <div className="text-xs text-danger flex items-center gap-1">
                              <AlertTriangle size={12} />
                              Stock insuficiente ({item.stock_actual} disponibles)
                            </div>
                          )}
                          {item.requiere_receta && (
                            <div className="text-xs text-warning flex items-center gap-1">
                              <AlertTriangle size={12} />
                              Requiere producción
                            </div>
                          )}
                        </td>
                        <td>
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
                        <td className="text-right font-bold">
                          {formatearMoneda(item.valor_venta)}
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
                <Calculator size={64} className="mx-auto text-muted mb-4" style={{ opacity: 0.3 }} />
                <p className="text-muted font-bold mb-2">No hay productos agregados</p>
                <p className="text-muted text-sm mb-4">Agregue productos para continuar con la cotización</p>
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

        {/* ✅ TOTALES CON IMPUESTO DINÁMICO */}
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
                      {TIPOS_IMPUESTO.find(t => t.codigo === formCabecera.tipo_impuesto)?.nombre || 'Impuesto'}:
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

        {/* Botones */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/ventas/cotizaciones')}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || !clienteSeleccionado || detalle.length === 0}
          >
            <Save size={20} />
            {loading ? 'Guardando...' : 'Guardar Cotización'}
          </button>
        </div>
      </form>

      {/* Modal Cliente */}
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

      {/* Modal Producto */}
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
                        {producto.requiere_receta && (
                          <span className="ml-2 badge badge-warning">Requiere producción</span>
                        )}
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

export default NuevaCotizacion;