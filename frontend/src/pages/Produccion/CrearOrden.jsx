import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, AlertCircle, Plus, Trash2, Star, 
  Package, Zap, Search, X, RefreshCw, ChevronDown 
} from 'lucide-react';
import { ordenesProduccionAPI, productosAPI, empleadosAPI } from '../../config/api';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';

function CrearOrden() {
  const navigate = useNavigate();
  
  const dropdownRef = useRef(null);

  const [productosTerminados, setProductosTerminados] = useState([]);
  const [supervisores, setSupervisores] = useState([]);
  const [recetasDisponibles, setRecetasDisponibles] = useState([]);
  const [recetaSeleccionada, setRecetaSeleccionada] = useState(null);
  const [detalleReceta, setDetalleReceta] = useState([]);
  const [insumosDisponibles, setInsumosDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [guardando, setGuardando] = useState(false);
  
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [generandoCorrelativo, setGenerandoCorrelativo] = useState(false);

  const [modoReceta, setModoReceta] = useState('seleccionar');
  const [recetaProvisional, setRecetaProvisional] = useState([]);
  const [rendimientoProvisional, setRendimientoProvisional] = useState('1');
  const [modalAgregarInsumo, setModalAgregarInsumo] = useState(false);

  const [formData, setFormData] = useState({
    numero_orden: '', 
    id_producto_terminado: '',
    cantidad_planificada: '',
    id_supervisor: '',
    observaciones: ''
  });
  
  const [nuevoInsumo, setNuevoInsumo] = useState({
    id_insumo: '',
    cantidad_requerida: ''
  });

  useEffect(() => {
    cargarDatos();
    generarSiguienteCorrelativo(); 

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMostrarDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const generarSiguienteCorrelativo = async () => {
    try {
      setGenerandoCorrelativo(true);
      
      const response = await ordenesProduccionAPI.getAll(); 
      const ordenes = response.data.data || [];
      
      const anioActual = new Date().getFullYear();
      const prefijo = `${anioActual}-`;
      
      const ordenesDelAnio = ordenes.filter(o => o.numero_orden && o.numero_orden.startsWith(prefijo));
      
      let maxCorrelativo = 0;
      ordenesDelAnio.forEach(o => {
        const partes = o.numero_orden.split('-');
        if (partes.length === 2) {
          const numero = parseInt(partes[1]);
          if (!isNaN(numero) && numero > maxCorrelativo) {
            maxCorrelativo = numero;
          }
        }
      });
      
      const siguienteNumero = maxCorrelativo + 1;
      const correlativoStr = String(siguienteNumero).padStart(5, '0');
      const nuevoCodigo = `${anioActual}-${correlativoStr}`;
      
      setFormData(prev => ({ ...prev, numero_orden: nuevoCodigo }));
      
    } catch (err) {
      console.error("Error generando correlativo:", err);
    } finally {
      setGenerandoCorrelativo(false);
    }
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [productosRes, supervisoresRes, insumosRes] = await Promise.all([
        productosAPI.getAll({ requiere_receta: 'true', estado: 'Activo' }),
        empleadosAPI.getByRol('Supervisor'),
        productosAPI.getAll({ estado: 'Activo' })
      ]);
      
      setProductosTerminados(productosRes.data.data);
      setSupervisores(supervisoresRes.data.data);
      
      const insumosFiltrados = insumosRes.data.data.filter(p => 
        p.id_tipo_inventario == 1 || p.id_tipo_inventario == 2
      );
      setInsumosDisponibles(insumosFiltrados);
    } catch (err) {
      setError(err.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const cargarRecetasProducto = async (idProducto) => {
    try {
      const response = await productosAPI.getRecetasByProducto(idProducto);
      const recetas = response.data.data || [];
      setRecetasDisponibles(recetas);
      
      const principal = recetas.find(r => r.es_principal && r.es_activa);
      if (principal) {
        await seleccionarReceta(principal.id_receta_producto);
      } else if (recetas.length > 0 && recetas[0].es_activa) {
        await seleccionarReceta(recetas[0].id_receta_producto);
      } else {
        setRecetaSeleccionada(null);
        setDetalleReceta([]);
      }
    } catch (err) {
      setError('Error al cargar recetas del producto');
      setRecetasDisponibles([]);
    }
  };

  const seleccionarReceta = async (idReceta) => {
    try {
      const response = await productosAPI.getDetalleReceta(idReceta);
      const receta = recetasDisponibles.find(r => r.id_receta_producto == idReceta);
      
      setRecetaSeleccionada(receta);
      setDetalleReceta(response.data.data || []);
      setModoReceta('seleccionar');
    } catch (err) {
      setError('Error al cargar detalle de receta');
      setDetalleReceta([]);
    }
  };

  
  const handleSeleccionarProducto = (producto) => {
    setFormData({ ...formData, id_producto_terminado: producto.id_producto });
    setBusquedaProducto(`${producto.codigo} - ${producto.nombre}`);
    setMostrarDropdown(false);
    cargarRecetasProducto(producto.id_producto);
    setRecetaProvisional([]);
    setRendimientoProvisional('1');
  };

  const handleLimpiarProducto = () => {
    setFormData({ ...formData, id_producto_terminado: '' });
    setBusquedaProducto('');
    setRecetasDisponibles([]);
    setRecetaSeleccionada(null);
    setDetalleReceta([]);
    setRecetaProvisional([]);
    setMostrarDropdown(true); 
  };

  const productosFiltrados = productosTerminados.filter(p => 
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) || 
    p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
  );
  

  const cambiarModoReceta = (modo) => {
    setModoReceta(modo);
    if (modo === 'provisional' || modo === 'manual') {
      setRecetaSeleccionada(null);
      setDetalleReceta([]);
    }
  };

  const abrirModalInsumo = () => {
    setNuevoInsumo({ id_insumo: '', cantidad_requerida: '' });
    setModalAgregarInsumo(true);
  };

  const agregarInsumoProvisional = () => {
    if (!nuevoInsumo.id_insumo || !nuevoInsumo.cantidad_requerida) {
      setError('Complete todos los campos del insumo');
      return;
    }

    const insumo = insumosDisponibles.find(i => i.id_producto == nuevoInsumo.id_insumo);
    if (!insumo) return;

    if (recetaProvisional.find(i => i.id_insumo == nuevoInsumo.id_insumo)) {
      setError('Este insumo ya está en la receta provisional');
      return;
    }

    setRecetaProvisional([
      ...recetaProvisional,
      {
        id_insumo: nuevoInsumo.id_insumo,
        cantidad_requerida: parseFloat(nuevoInsumo.cantidad_requerida),
        insumo: insumo.nombre,
        codigo_insumo: insumo.codigo,
        unidad_medida: insumo.unidad_medida,
        costo_unitario_promedio: parseFloat(insumo.costo_unitario_promedio),
        stock_actual: parseFloat(insumo.stock_actual)
      }
    ]);

    setModalAgregarInsumo(false);
    setNuevoInsumo({ id_insumo: '', cantidad_requerida: '' });
  };

  const eliminarInsumoProvisional = (idInsumo) => {
    setRecetaProvisional(recetaProvisional.filter(i => i.id_insumo != idInsumo));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError(null);
  setSuccess(null);
  setGuardando(true);

  try {
    const payload = {
      ...formData,
      cantidad_planificada: parseFloat(formData.cantidad_planificada),
      origen_tipo: 'Supervisor' // AGREGAR ESTA LÍNEA
    };

    if (modoReceta === 'manual') {
      payload.es_orden_manual = true;
      
      const response = await ordenesProduccionAPI.create(payload);
      setSuccess('Orden manual creada exitosamente (sin consumo de materiales)');
      
      setTimeout(() => {
        navigate(`/produccion/ordenes/${response.data.data.id_orden}`);
      }, 1500);
      return;
    }

      if (modoReceta === 'seleccionar' && recetaSeleccionada) {
        payload.id_receta_producto = recetaSeleccionada.id_receta_producto;
        payload.rendimiento_receta = recetaSeleccionada.rendimiento_unidades;
      } 
      else if (modoReceta === 'provisional' && recetaProvisional.length > 0) {
        payload.receta_provisional = recetaProvisional.map(i => ({
          id_insumo: i.id_insumo,
          cantidad_requerida: i.cantidad_requerida
        }));
        payload.rendimiento_receta = parseFloat(rendimientoProvisional);
      } else {
        setError('Debe seleccionar una receta, crear una receta provisional o elegir modo manual');
        setGuardando(false);
        return;
      }

      const response = await ordenesProduccionAPI.create(payload);
      setSuccess('Orden de producción creada exitosamente');
      
      setTimeout(() => {
        navigate(`/produccion/ordenes/${response.data.data.id_orden}`);
      }, 1500);
    } catch (err) {
      setError(err.error || 'Error al crear la orden');
      setGuardando(false);
    }
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'PEN'
    }).format(valor || 0);
  };

  const calcularCostoMateriales = () => {
    if (!formData.cantidad_planificada || modoReceta === 'manual') return 0;
    
    const cantidad = parseFloat(formData.cantidad_planificada);
    let rendimiento = 1;
    let receta = [];

    if (modoReceta === 'seleccionar' && recetaSeleccionada) {
      rendimiento = parseFloat(recetaSeleccionada.rendimiento_unidades) || 1;
      receta = detalleReceta;
    } else if (modoReceta === 'provisional') {
      rendimiento = parseFloat(rendimientoProvisional) || 1;
      receta = recetaProvisional;
    }

    if (receta.length === 0) return 0;

    const lotesNecesarios = Math.ceil(cantidad / rendimiento);
    
    return receta.reduce((sum, item) => {
      const cantidadPorLote = parseFloat(item.cantidad_requerida);
      const cantidadTotal = cantidadPorLote * lotesNecesarios;
      const costo = cantidadTotal * parseFloat(item.costo_unitario_promedio);
      return sum + costo;
    }, 0);
  };

  const validarStock = () => {
    if (!formData.cantidad_planificada || modoReceta === 'manual') {
      return { valido: true, faltantes: [] };
    }
    
    const cantidad = parseFloat(formData.cantidad_planificada);
    let rendimiento = 1;
    let receta = [];

    if (modoReceta === 'seleccionar' && recetaSeleccionada) {
      rendimiento = parseFloat(recetaSeleccionada.rendimiento_unidades) || 1;
      receta = detalleReceta;
    } else if (modoReceta === 'provisional') {
      rendimiento = parseFloat(rendimientoProvisional) || 1;
      receta = recetaProvisional;
    }

    if (receta.length === 0) return { valido: true, faltantes: [] };

    const lotesNecesarios = Math.ceil(cantidad / rendimiento);
    const faltantes = [];
    
    receta.forEach(item => {
      const cantidadPorLote = parseFloat(item.cantidad_requerida);
      const cantidadTotal = cantidadPorLote * lotesNecesarios;
      const stockDisponible = parseFloat(item.stock_actual);
      
      if (stockDisponible < cantidadTotal) {
        faltantes.push({
          insumo: item.insumo,
          requerido: cantidadTotal,
          disponible: stockDisponible,
          faltante: cantidadTotal - stockDisponible,
          unidad: item.unidad_medida
        });
      }
    });
    
    return { valido: faltantes.length === 0, faltantes };
  };

  const calcularLotes = () => {
    if (!formData.cantidad_planificada || modoReceta === 'manual') return 0;
    
    const cantidad = parseFloat(formData.cantidad_planificada);
    let rendimiento = 1;

    if (modoReceta === 'seleccionar' && recetaSeleccionada) {
      rendimiento = parseFloat(recetaSeleccionada.rendimiento_unidades) || 1;
    } else if (modoReceta === 'provisional') {
      rendimiento = parseFloat(rendimientoProvisional) || 1;
    }

    return Math.ceil(cantidad / rendimiento);
  };

  if (loading) {
    return <Loading message="Cargando formulario..." />;
  }

  const productoSeleccionado = productosTerminados.find(p => p.id_producto == formData.id_producto_terminado);
  const costoMateriales = calcularCostoMateriales();
  const validacionStock = validarStock();
  const lotesNecesarios = calcularLotes();
  const recetaActual = modoReceta === 'seleccionar' ? detalleReceta : 
                        modoReceta === 'provisional' ? recetaProvisional : [];
  const rendimientoActual = modoReceta === 'seleccionar' 
    ? (recetaSeleccionada?.rendimiento_unidades || 1) 
    : parseFloat(rendimientoProvisional) || 1;

  return (
    <div>
      <button className="btn btn-outline mb-4" onClick={() => navigate('/produccion/ordenes')}>
        <ArrowLeft size={20} />
        Volver a Órdenes
      </button>

      <div className="mb-4">
        <h1 className="card-title">Nueva Orden de Producción</h1>
        <p className="text-muted">Complete la información y seleccione el tipo de orden</p>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} />}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          
          {/* COLUMNA 1: Información Básica */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Información Básica</h2>
            </div>

            {/* --- 1. CAMPO NÚMERO DE ORDEN AUTOMÁTICO --- */}
            <div className="form-group">
              <label className="form-label">Número de Orden (Automático) *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-input bg-gray-100 font-mono font-bold"
                  value={formData.numero_orden}
                  readOnly 
                  placeholder="Generando..."
                />
                <button 
                  type="button" 
                  className="btn btn-outline p-2" 
                  onClick={generarSiguienteCorrelativo}
                  title="Regenerar correlativo"
                  disabled={generandoCorrelativo}
                >
                  <RefreshCw size={18} className={generandoCorrelativo ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* --- 2. BUSCADOR DE PRODUCTOS (Reemplazo del Select) --- */}
            <div className="form-group relative" ref={dropdownRef}>
              <label className="form-label">Producto a Fabricar *</label>
              
              {/* Input Buscador */}
              <div className="relative">
                <input
                  type="text"
                  className="form-input pl-9 pr-8"
                  placeholder="Buscar por código o nombre..."
                  value={busquedaProducto}
                  onChange={(e) => {
                    setBusquedaProducto(e.target.value);
                    setMostrarDropdown(true); 
                    if (e.target.value === '') {
                        setFormData({ ...formData, id_producto_terminado: '' });
                    }
                  }}
                  onFocus={() => setMostrarDropdown(true)} 
                  required={!formData.id_producto_terminado} 
                />
                
                {/* Icono Lupa */}
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                
                {/* Icono Flecha (si no hay selección) o X (si hay selección) */}
                {formData.id_producto_terminado ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    onClick={handleLimpiarProducto}
                  >
                    <X size={18} />
                  </button>
                ) : (
                  <ChevronDown className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={18} />
                )}
              </div>

              {/* Lista Desplegable (Dropdown) */}
              {mostrarDropdown && (
                <div 
                  className="absolute z-50 w-full mt-1 border border-gray-200 rounded-md shadow-lg overflow-y-auto"
                  style={{ 
                    maxHeight: '300px', 
                    backgroundColor: 'white'
                  }} 
                >
                  {productosFiltrados.length > 0 ? (
                    productosFiltrados.map((prod) => (
                      <div
                        key={prod.id_producto}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-50 last:border-0"
                        onClick={() => handleSeleccionarProducto(prod)}
                      >
                        <div className="font-bold text-gray-800">{prod.codigo}</div>
                        <div className="text-gray-600">{prod.nombre}</div>
                        <div className="text-xs text-muted mt-1">
                          Stock: {parseFloat(prod.stock_actual).toFixed(2)} {prod.unidad_medida}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      No se encontraron productos
                    </div>
                  )}
                </div>
              )}
              
              {/* Input oculto para la validación nativa del form si falla */}
              {!formData.id_producto_terminado && (
                 <input 
                   tabIndex={-1} 
                   autoComplete="off" 
                   style={{opacity: 0, height: 0, position: 'absolute'}} 
                   required={true} 
                   onInvalid={e => e.target.setCustomValidity('Seleccione un producto de la lista')} 
                   onInput={e => e.target.setCustomValidity('')} 
                 />
              )}
            </div>
            {/* ----------------------------------------------------------- */}

            <div className="form-group">
              <label className="form-label">Cantidad a Fabricar *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                value={formData.cantidad_planificada}
                onChange={(e) => setFormData({ ...formData, cantidad_planificada: e.target.value })}
                required
                placeholder="0.00"
                disabled={!formData.id_producto_terminado}
              />
              {productoSeleccionado && (
                <small className="text-muted">Unidad: {productoSeleccionado.unidad_medida}</small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Supervisor *</label>
              <select
                className="form-select"
                value={formData.id_supervisor}
                onChange={(e) => setFormData({ ...formData, id_supervisor: e.target.value })}
                required
              >
                <option value="">Seleccione un supervisor...</option>
                {supervisores.map(sup => (
                  <option key={sup.id_empleado} value={sup.id_empleado}>
                    {sup.nombre_completo}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea
                className="form-textarea"
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                placeholder="Notas o instrucciones especiales"
                rows={3}
              />
            </div>
          </div>

          {/* COLUMNA 2: Tipo de Orden */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Tipo de Orden</h2>
            </div>

            {!formData.id_producto_terminado ? (
              <div className="p-8 text-center">
                <Package size={48} style={{ margin: '0 auto', color: 'var(--text-secondary)', opacity: 0.3 }} />
                <p className="text-muted mt-3">Seleccione un producto primero</p>
              </div>
            ) : (
              <>
                {/* SELECTOR DE TIPO DE ORDEN */}
                <div className="mb-4">
                  <label className="form-label">Seleccione el Tipo de Orden *</label>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className={`btn text-left ${modoReceta === 'seleccionar' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => cambiarModoReceta('seleccionar')}
                      disabled={recetasDisponibles.length === 0}
                      style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
                    >
                      <Star size={18} style={{ marginRight: '8px' }} />
                      <div>
                        <div className="font-bold">Receta Existente</div>
                        <div className="text-xs opacity-80">Usa receta guardada y consume materiales</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`btn text-left ${modoReceta === 'provisional' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => cambiarModoReceta('provisional')}
                      style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
                    >
                      <Plus size={18} style={{ marginRight: '8px' }} />
                      <div>
                        <div className="font-bold">Receta Provisional</div>
                        <div className="text-xs opacity-80">Crea receta temporal y consume materiales</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`btn text-left ${modoReceta === 'manual' ? 'btn-warning' : 'btn-outline'}`}
                      onClick={() => cambiarModoReceta('manual')}
                      style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
                    >
                      <Zap size={18} style={{ marginRight: '8px' }} />
                      <div>
                        <div className="font-bold">Orden Manual</div>
                        <div className="text-xs opacity-80">Sin receta, NO consume materiales</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* MODO: Manual */}
                {modoReceta === 'manual' && (
                  <div className="alert alert-warning">
                    <Zap size={20} />
                    <div>
                      <strong>Orden Manual Seleccionada</strong>
                      <p className="text-xs mt-1">
                        Esta orden NO consumirá materiales del inventario. 
                        Solo registrará la producción final.
                      </p>
                    </div>
                  </div>
                )}

                {/* MODO: Seleccionar Receta Existente */}
                {modoReceta === 'seleccionar' && (
                  <>
                    {recetasDisponibles.length > 0 ? (
                      <>
                        <div className="form-group">
                          <label className="form-label">Receta a Utilizar *</label>
                          <select
                            className="form-select"
                            value={recetaSeleccionada?.id_receta_producto || ''}
                            onChange={(e) => seleccionarReceta(e.target.value)}
                            required={modoReceta === 'seleccionar'}
                          >
                            <option value="">Seleccione una receta...</option>
                            {recetasDisponibles.filter(r => r.es_activa).map(receta => (
                              <option key={receta.id_receta_producto} value={receta.id_receta_producto}>
                                {receta.es_principal && '⭐ '}
                                {receta.nombre_receta}
                                {receta.version && ` v${receta.version}`}
                              </option>
                            ))}
                          </select>
                        </div>

                        {recetaSeleccionada && (
                          <div className="bg-secondary p-3 rounded" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-bold">{recetaSeleccionada.nombre_receta}</h4>
                              {recetaSeleccionada.es_principal && (
                                <span className="badge badge-warning">
                                  <Star size={12} className="mr-1" style={{ display: 'inline' }} fill="currentColor" />
                                  Principal
                                </span>
                              )}
                            </div>
                            
                            {recetaSeleccionada.descripcion && (
                              <p className="text-sm text-muted mb-2">{recetaSeleccionada.descripcion}</p>
                            )}
                            
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted">Rendimiento:</span>
                                <strong className="ml-1">
                                  {recetaSeleccionada.rendimiento_unidades} {productoSeleccionado?.unidad_medida}
                                </strong>
                              </div>
                              <div>
                                <span className="text-muted">Insumos:</span>
                                <strong className="ml-1">{recetaSeleccionada.total_insumos || 0}</strong>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="alert alert-warning">
                        <AlertCircle size={20} />
                        <div>
                          <strong>Sin recetas configuradas</strong>
                          <p className="text-xs mt-1">
                            Este producto no tiene recetas. Use "Receta Provisional" o "Orden Manual".
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* MODO: Receta Provisional */}
                {modoReceta === 'provisional' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Rendimiento de esta Receta *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="form-input"
                        value={rendimientoProvisional}
                        onChange={(e) => setRendimientoProvisional(e.target.value)}
                        required={modoReceta === 'provisional'}
                        placeholder="1.00"
                      />
                      <small className="text-muted">
                        ¿Cuántas {productoSeleccionado?.unidad_medida} produce esta receta?
                      </small>
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-2">
                        <label className="form-label" style={{ marginBottom: 0 }}>
                          Insumos ({recetaProvisional.length})
                        </label>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={abrirModalInsumo}
                        >
                          <Plus size={16} />
                          Agregar
                        </button>
                      </div>

                      {recetaProvisional.length > 0 ? (
                        <div className="border rounded" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                          <table className="table" style={{ fontSize: '0.85rem' }}>
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-primary)' }}>
                              <tr>
                                <th>Insumo</th>
                                <th className="text-right">Cantidad</th>
                                <th style={{ width: '50px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {recetaProvisional.map(item => (
                                <tr key={item.id_insumo}>
                                  <td>
                                    <div className="font-medium">{item.codigo_insumo}</div>
                                    <div className="text-xs text-muted">{item.insumo}</div>
                                  </td>
                                  <td className="text-right">
                                    <div className="font-bold">{parseFloat(item.cantidad_requerida).toFixed(4)}</div>
                                    <div className="text-xs text-muted">{item.unidad_medida}</div>
                                  </td>
                                  <td className="text-center">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-danger"
                                      onClick={() => eliminarInsumoProvisional(item.id_insumo)}
                                      title="Eliminar"
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
                        <div className="border border-dashed rounded p-4 text-center">
                          <p className="text-muted text-sm">No hay insumos agregados</p>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary mt-2"
                            onClick={abrirModalInsumo}
                          >
                            <Plus size={16} />
                            Agregar Primer Insumo
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* COLUMNA 3: Resumen */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Resumen de Producción</h2>
            </div>

            {modoReceta === 'manual' && formData.cantidad_planificada ? (
              <>
                <div className="bg-gradient-to-br from-yellow-50 to-white p-3 rounded border border-yellow-200 mb-3">
                  <p className="text-xs text-muted mb-1">Orden Manual</p>
                  <p className="text-2xl font-bold text-warning">
                    {parseFloat(formData.cantidad_planificada).toFixed(2)} {productoSeleccionado?.unidad_medida}
                  </p>
                  <p className="text-xs text-muted">Sin consumo de materiales</p>
                </div>

                <div className="alert alert-info">
                  <Zap size={18} />
                  <div>
                    <strong>Modo Manual Activo</strong>
                    <p className="text-xs">Esta orden NO descontará materiales del inventario</p>
                  </div>
                </div>
              </>
            ) : formData.cantidad_planificada && recetaActual.length > 0 ? (
              <>
                <div className="bg-gradient-to-br from-blue-50 to-white p-3 rounded border border-blue-200 mb-3">
                  <p className="text-xs text-muted mb-1">Lotes Necesarios</p>
                  <p className="text-2xl font-bold text-primary">{lotesNecesarios}</p>
                  <p className="text-xs text-muted">
                    Rendimiento: {rendimientoActual} {productoSeleccionado?.unidad_medida} por lote
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-white p-3 rounded border border-green-200 mb-3">
                  <p className="text-xs text-muted mb-1">Costo de Materiales</p>
                  <p className="text-2xl font-bold text-success">{formatearMoneda(costoMateriales)}</p>
                  <p className="text-xs text-muted">
                    {formatearMoneda(costoMateriales / parseFloat(formData.cantidad_planificada))} por unidad
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-white p-3 rounded border border-purple-200 mb-3">
                  <p className="text-xs text-muted mb-1">Insumos Requeridos</p>
                  <p className="text-2xl font-bold text-purple-600">{recetaActual.length}</p>
                  <p className="text-xs text-muted">componente(s)</p>
                </div>

                {!validacionStock.valido ? (
                  <div className="alert alert-warning">
                    <AlertCircle size={18} />
                    <div>
                      <strong>Stock Insuficiente</strong>
                      <p className="text-xs mt-1">
                        {validacionStock.faltantes.length} insumo(s) sin stock suficiente
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-success">
                    <strong>Stock Disponible</strong>
                    <p className="text-xs">Todos los insumos disponibles</p>
                  </div>
                )}

                {modoReceta === 'provisional' && (
                  <div className="alert alert-info">
                    <strong>Receta Provisional</strong>
                    <p className="text-xs">Esta receta es temporal y solo se usará para esta orden</p>
                  </div>
                )}
              </>
            ) : (
              <div className="p-6 text-center">
                <p className="text-muted text-sm">
                  {!formData.id_producto_terminado 
                    ? 'Seleccione un producto'
                    : !formData.cantidad_planificada
                    ? 'Ingrese la cantidad'
                    : 'Configure el tipo de orden'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* TABLA DE MATERIALES (Solo si NO es manual) */}
        {modoReceta !== 'manual' && recetaActual.length > 0 && formData.cantidad_planificada && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Materiales Requeridos (Total para {lotesNecesarios} lote(s))</h2>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Insumo</th>
                    <th className="text-right">Cantidad por Lote</th>
                    <th className="text-right">Lotes</th>
                    <th className="text-right">Cantidad Total</th>
                    <th className="text-right">Stock Disponible</th>
                    <th className="text-right">CUP</th>
                    <th className="text-right">Costo Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recetaActual.map(item => {
                    const cantidadPorLote = parseFloat(item.cantidad_requerida);
                    const cantidadTotal = cantidadPorLote * lotesNecesarios;
                    const stockDisponible = parseFloat(item.stock_actual);
                    const suficiente = stockDisponible >= cantidadTotal;
                    const costoTotal = cantidadTotal * parseFloat(item.costo_unitario_promedio);

                    return (
                      <tr key={item.id_insumo || item.id_detalle}>
                        <td className="font-mono">{item.codigo_insumo}</td>
                        <td>{item.insumo}</td>
                        <td className="text-right">
                          {cantidadPorLote.toFixed(4)} <span className="text-muted">{item.unidad_medida}</span>
                        </td>
                        <td className="text-right">
                          <span className="badge badge-primary">{lotesNecesarios}</span>
                        </td>
                        <td className="text-right">
                          <strong>{cantidadTotal.toFixed(4)}</strong> <span className="text-muted">{item.unidad_medida}</span>
                        </td>
                        <td className="text-right">
                          <span className={suficiente ? 'text-success' : 'text-danger'}>
                            {stockDisponible.toFixed(2)}
                            {!suficiente && ' ⚠️'}
                          </span>
                        </td>
                        <td className="text-right">{formatearMoneda(item.costo_unitario_promedio)}</td>
                        <td className="text-right font-bold">{formatearMoneda(costoTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--bg-tertiary)', fontWeight: 'bold' }}>
                    <td colSpan={7} className="text-right">TOTAL MATERIALES:</td>
                    <td className="text-right">{formatearMoneda(costoMateriales)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* INSUMOS FALTANTES */}
        {!validacionStock.valido && validacionStock.faltantes.length > 0 && (
          <div className="card mt-4">
            <div className="card-header">
              <h2 className="card-title">Insumos Faltantes</h2>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Insumo</th>
                    <th className="text-right">Requerido</th>
                    <th className="text-right">Disponible</th>
                    <th className="text-right">Faltante</th>
                  </tr>
                </thead>
                <tbody>
                  {validacionStock.faltantes.map((item, index) => (
                    <tr key={index}>
                      <td>{item.insumo}</td>
                      <td className="text-right">{item.requerido.toFixed(2)} {item.unidad}</td>
                      <td className="text-right">{item.disponible.toFixed(2)} {item.unidad}</td>
                      <td className="text-right text-danger">
                        <strong>{item.faltante.toFixed(2)} {item.unidad}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BOTONES DE ACCIÓN */}
        <div className="flex gap-2 justify-end mt-4">
          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={() => navigate('/produccion/ordenes')}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={guardando || !formData.id_producto_terminado || 
                     (modoReceta !== 'manual' && recetaActual.length === 0)}
          >
            {guardando ? 'Creando...' : 'Crear Orden de Producción'}
          </button>
        </div>
      </form>

      {/* MODAL: Agregar Insumo a Receta Provisional */}
      <Modal
        isOpen={modalAgregarInsumo}
        onClose={() => setModalAgregarInsumo(false)}
        title="Agregar Insumo a Receta Provisional"
        size="md"
      >
        <div className="form-group">
          <label className="form-label">Insumo / Material *</label>
          <select
            className="form-select"
            value={nuevoInsumo.id_insumo}
            onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, id_insumo: e.target.value })}
          >
            <option value="">Seleccione un insumo...</option>
            {insumosDisponibles
              .filter(i => !recetaProvisional.find(rp => rp.id_insumo == i.id_producto))
              .map(insumo => (
                <option key={insumo.id_producto} value={insumo.id_producto}>
                  {insumo.codigo} - {insumo.nombre} (Stock: {parseFloat(insumo.stock_actual).toFixed(2)} {insumo.unidad_medida})
                </option>
              ))}
          </select>
          <small className="text-muted">Solo insumos y materia prima</small>
        </div>

        <div className="form-group">
          <label className="form-label">Cantidad Requerida (por lote) *</label>
          <input
            type="number"
            step="0.0001"
            min="0.0001"
            className="form-input"
            value={nuevoInsumo.cantidad_requerida}
            onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, cantidad_requerida: e.target.value })}
            placeholder="0.0000"
          />
          <small className="text-muted">
            Por cada {rendimientoProvisional} {productoSeleccionado?.unidad_medida} producida(s)
          </small>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={() => setModalAgregarInsumo(false)}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={agregarInsumoProvisional}
            disabled={!nuevoInsumo.id_insumo || !nuevoInsumo.cantidad_requerida}
          >
            Agregar Insumo
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default CrearOrden;