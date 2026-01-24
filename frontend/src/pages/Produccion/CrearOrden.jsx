import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, AlertCircle, Plus, Trash2, Star, 
  Package, Zap, Search, X, RefreshCw, ChevronDown, Clock, Users, Info, Hash, Ruler, Scale 
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
  const [insumosDisponibles, setInsumosDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [guardando, setGuardando] = useState(false);
  
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [generandoCorrelativo, setGenerandoCorrelativo] = useState(false);

  const [modoReceta, setModoReceta] = useState('porcentaje'); 
  const [listaInsumos, setListaInsumos] = useState([]);
  const [modalAgregarInsumo, setModalAgregarInsumo] = useState(false);

  const [formData, setFormData] = useState({
    numero_orden: '', 
    id_producto_terminado: '',
    cantidad_planificada: '',
    cantidad_unidades: '',
    id_supervisor: '',
    observaciones: '',
    turno: 'Día',
    maquinista: '',
    ayudante: '',
    operario_corte: '',
    operario_embalaje: '',
    medida: '',
    peso_producto: '',
    gramaje: ''
  });
  
  const [nuevoInsumo, setNuevoInsumo] = useState({
    id_insumo: '',
    porcentaje: ''
  });

  const productosFiltrados = productosTerminados.filter(p => 
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) || 
    p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
  );

  const esProductoLamina = busquedaProducto.toUpperCase().includes('LÁMINA') || busquedaProducto.toUpperCase().includes('LAMINA');

  useEffect(() => {
    if (esProductoLamina) {
        setModoReceta('manual'); 
    } else {
        setModoReceta('porcentaje');
    }
  }, [esProductoLamina]);

  const insumosFiltradosParaMostrar = insumosDisponibles.filter(insumo => {
    const productoSeleccionado = productosTerminados.find(p => p.id_producto == formData.id_producto_terminado);

    if (!productoSeleccionado) {
        return insumo.id_tipo_inventario === 2; 
    }

    const nombreProd = productoSeleccionado.nombre.toUpperCase();
    const nombreInsumo = insumo.nombre.toUpperCase();

    if (nombreProd.includes('LÁMINA') || nombreProd.includes('LAMINA')) {
        return nombreInsumo.includes('ROLLO BURBUPACK');
    }

    if (nombreProd.includes('ESQUINERO')) {
        return (
            nombreInsumo.includes('PELETIZADO VERDE') || 
            nombreInsumo.includes('BATERIA') ||
            nombreInsumo.includes('BEIGE DURO') || 
            nombreInsumo.includes('PLOMO DURO') ||
            nombreInsumo.includes('CHANCACA VERDE') ||
            nombreInsumo.includes('ESQUINERO MOLIDO') ||
            nombreInsumo.includes('TUTI') ||
            nombreInsumo.includes('PIGMENTO VERDE')
        );
    }

    if (nombreProd.includes('BURBUPACK')) {
        return (
            nombreInsumo.includes('POLIETILENO DE BAJA') || 
            nombreInsumo.includes('POLIETILENO DE ALTA') ||
            nombreInsumo.includes('PELETIZADO POLIETILENO')
        );
    }

    if (nombreProd.includes('ZUNCHO')) {
        return (
            nombreInsumo.includes('PELETIZADO NEGRO') || 
            nombreInsumo.includes('CHATARRA') ||
            nombreInsumo.includes('CHANCACA NEGRA') ||
            nombreInsumo.includes('ZUNCHO MOLIDO') ||
            nombreInsumo.includes('PIGMENTO NEGRO') ||
            nombreInsumo.includes('OTROS')
        );
    }

    if (nombreProd.includes('PELETIZADO NEGRO')) {
        return (
            nombreInsumo.includes('ETIQUETA MOLIDA') ||
            nombreInsumo.includes('CHANCACA NEGRA') ||
            nombreInsumo.includes('ZUNCHO MOLIDO') ||
            nombreInsumo.includes('SACA MOLIDA') ||
            nombreInsumo.includes('OTROS')
        );
    }

    if (nombreProd.includes('PELETIZADO VERDE')) {
        return (
            nombreInsumo.includes('ETIQUETA MOLIDA') ||
            nombreInsumo.includes('CHANCACA VERDE') ||
            nombreInsumo.includes('SACA MOLIDA') ||
            nombreInsumo.includes('OTROS')
        );
    }

    return insumo.id_tipo_inventario === 2; 
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
      const prefijo = `OP-${anioActual}-`;
      const ordenesDelAnio = ordenes.filter(o => o.numero_orden && o.numero_orden.startsWith(prefijo));
      
      let maxCorrelativo = 0;
      ordenesDelAnio.forEach(o => {
        const partes = o.numero_orden.split('-');
        if (partes.length === 3) {
          const numero = parseInt(partes[2]);
          if (!isNaN(numero) && numero > maxCorrelativo) {
            maxCorrelativo = numero;
          }
        }
      });
      
      const siguienteNumero = maxCorrelativo + 1;
      const correlativoStr = String(siguienteNumero).padStart(4, '0');
      const nuevoCodigo = `OP-${anioActual}-${correlativoStr}`;
      
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
      setInsumosDisponibles(insumosRes.data.data);
    } catch (err) {
      setError(err.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSeleccionarProducto = (producto) => {
    setFormData({ ...formData, id_producto_terminado: producto.id_producto });
    setBusquedaProducto(`${producto.codigo} - ${producto.nombre}`);
    setMostrarDropdown(false);
    setListaInsumos([]);
  };

  const handleLimpiarProducto = () => {
    setFormData({ ...formData, id_producto_terminado: '' });
    setBusquedaProducto('');
    setListaInsumos([]);
    setMostrarDropdown(true); 
    setTimeout(() => {
        if (dropdownRef.current) {
            const input = dropdownRef.current.querySelector('input');
            if (input) input.focus();
        }
    }, 100);
  };

  const abrirModalInsumo = () => {
    setNuevoInsumo({ id_insumo: '', porcentaje: '' });
    setModalAgregarInsumo(true);
  };

  const agregarInsumoLista = () => {
    if (!nuevoInsumo.id_insumo || !nuevoInsumo.porcentaje) {
      setError('Complete todos los campos del insumo');
      return;
    }

    const insumo = insumosDisponibles.find(i => i.id_producto == nuevoInsumo.id_insumo);
    if (!insumo) return;

    if (listaInsumos.find(i => i.id_insumo == nuevoInsumo.id_insumo)) {
      setError('Este insumo ya está en la lista');
      return;
    }

    setListaInsumos([
      ...listaInsumos,
      {
        id_insumo: nuevoInsumo.id_insumo,
        porcentaje: parseFloat(nuevoInsumo.porcentaje),
        insumo: insumo.nombre,
        codigo_insumo: insumo.codigo,
        unidad_medida: insumo.unidad_medida,
        costo_unitario: parseFloat(insumo.costo_unitario_promedio),
        stock_actual: parseFloat(insumo.stock_actual)
      }
    ]);

    setModalAgregarInsumo(false);
    setNuevoInsumo({ id_insumo: '', porcentaje: '' });
  };

  const eliminarInsumoLista = (idInsumo) => {
    setListaInsumos(listaInsumos.filter(i => i.id_insumo != idInsumo));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setGuardando(true);

    try {
      const payload = {
        ...formData,
        cantidad_planificada: formData.cantidad_planificada ? parseFloat(formData.cantidad_planificada) : 0,
        cantidad_unidades: formData.cantidad_unidades ? parseFloat(formData.cantidad_unidades) : 0,
        es_orden_manual: modoReceta === 'manual'
      };

      if (!esProductoLamina && (!payload.cantidad_planificada || payload.cantidad_planificada <= 0)) {
         setError('La Cantidad Planificada en Kilos es requerida para este producto');
         setGuardando(false);
         return;
      }
      
      if (esProductoLamina && (!payload.cantidad_unidades || payload.cantidad_unidades <= 0)) {
         setError('La Cantidad en Unidades/Millares es requerida para Láminas');
         setGuardando(false);
         return;
      }

      if (modoReceta === 'porcentaje' && !esProductoLamina) {
        if (listaInsumos.length === 0) {
            setError('Debe agregar al menos un insumo o cambiar a modo manual');
            setGuardando(false);
            return;
        }

        const totalPorcentaje = listaInsumos.reduce((acc, curr) => acc + curr.porcentaje, 0);
        if (Math.abs(totalPorcentaje - 100) > 0.01) {
            setError(`La suma de los porcentajes es ${totalPorcentaje.toFixed(2)}%. Debe ser exactamente 100% para crear la orden.`);
            setGuardando(false);
            return;
        }

        payload.insumos = listaInsumos.map(i => ({
            id_insumo: i.id_insumo,
            porcentaje: i.porcentaje
        }));
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

  const calcularCantidadInsumo = (porcentaje) => {
      if (esProductoLamina) {
          return parseFloat(porcentaje); 
      }
      const total = parseFloat(formData.cantidad_planificada) || 0;
      return (total * parseFloat(porcentaje)) / 100;
  };

  if (loading) {
    return <Loading message="Cargando formulario..." />;
  }

  const costoTotalEstimado = listaInsumos.reduce((sum, item) => {
      const cantidad = calcularCantidadInsumo(item.porcentaje);
      return sum + (cantidad * item.costo_unitario);
  }, 0);

  const porcentajeActualTotal = listaInsumos.reduce((sum, item) => sum + item.porcentaje, 0);

  return (
    <div>
      <button className="btn btn-outline mb-4" onClick={() => navigate('/produccion/ordenes')}>
        <ArrowLeft size={20} />
        Volver a Órdenes
      </button>

      <div className="mb-4">
        <h1 className="card-title">Nueva Orden de Producción</h1>
        <p className="text-muted">Configure los insumos por porcentaje según la cantidad a producir</p>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} />}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          
          <div className="card lg:col-span-2">
            <div className="card-header">
              <h2 className="card-title">Información de Producción</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                    <label className="form-label">Número de Orden</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="form-input bg-gray-100 font-mono font-bold"
                            value={formData.numero_orden}
                            readOnly 
                        />
                        <button 
                            type="button" 
                            className="btn btn-outline p-2" 
                            onClick={generarSiguienteCorrelativo}
                            disabled={generandoCorrelativo}
                        >
                            <RefreshCw size={18} className={generandoCorrelativo ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="form-group relative" ref={dropdownRef}>
                    <label className="form-label">Producto Terminado *</label>
                    <div className="relative">
                        <input
                            type="text"
                            className="form-input pl-9 pr-8"
                            placeholder="Buscar producto por código o nombre..."
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
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
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

                    {mostrarDropdown && (
                        <div 
                          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-y-auto max-h-60"
                          style={{ backgroundColor: 'white', zIndex: 9999 }}
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
                                        <div className="text-xs text-muted mt-1">Stock: {parseFloat(prod.stock_actual).toFixed(2)}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-3 text-sm text-gray-500 text-center">No se encontraron productos</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="form-group">
                    <label className="form-label">
                        {esProductoLamina ? 'Cantidad Unidades (Meta) *' : 'Cantidad Unidades (Meta)'}
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            min="1"
                            step="1"
                            className="form-input pl-9"
                            value={formData.cantidad_unidades}
                            onChange={(e) => setFormData({ ...formData, cantidad_unidades: e.target.value })}
                            required={esProductoLamina}
                            placeholder="0"
                        />
                        <Hash className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    </div>
                </div>

                {!esProductoLamina && (
                    <div className="form-group">
                        <label className="form-label">Total Kilos Estimados (Insumos) *</label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="form-input pl-9"
                                value={formData.cantidad_planificada}
                                onChange={(e) => setFormData({ ...formData, cantidad_planificada: e.target.value })}
                                required
                                placeholder="0.00"
                            />
                            <Package className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        </div>
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">Turno *</label>
                    <div className="relative">
                        <select
                            className="form-select pl-9"
                            value={formData.turno}
                            onChange={(e) => setFormData({ ...formData, turno: e.target.value })}
                            required
                        >
                            <option value="Día">Día</option>
                            <option value="Noche">Noche</option>
                        </select>
                        <Clock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 bg-gray-50 p-3 rounded border border-gray-100">
                <div className="form-group">
                    <label className="form-label text-xs">Medida (Opcional)</label>
                    <div className="relative">
                        <input
                            type="text"
                            className="form-input text-sm pl-8"
                            value={formData.medida}
                            onChange={(e) => setFormData({ ...formData, medida: e.target.value })}
                            placeholder="Ej: 50x70 cm"
                        />
                        <Ruler className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label text-xs">Peso Unitario (Opcional)</label>
                    <div className="relative">
                        <input
                            type="text"
                            className="form-input text-sm pl-8"
                            value={formData.peso_producto}
                            onChange={(e) => setFormData({ ...formData, peso_producto: e.target.value })}
                            placeholder="Ej: 200g"
                        />
                        <Scale className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label text-xs">Gramaje (Opcional)</label>
                    <div className="relative">
                        <input
                            type="text"
                            className="form-input text-sm pl-8"
                            value={formData.gramaje}
                            onChange={(e) => setFormData({ ...formData, gramaje: e.target.value })}
                            placeholder="Ej: 150 micras"
                        />
                        <Info className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
                    </div>
                </div>
            </div>
            
            <div className="border-t border-gray-100 my-4 pt-4">
                <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                    <Users size={16} /> Personal Asignado
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="form-group">
                        <label className="form-label text-xs">Supervisor *</label>
                        <select
                            className="form-select text-sm"
                            value={formData.id_supervisor}
                            onChange={(e) => setFormData({ ...formData, id_supervisor: e.target.value })}
                            required
                        >
                            <option value="">Seleccionar...</option>
                            {supervisores.map(sup => (
                                <option key={sup.id_empleado} value={sup.id_empleado}>{sup.nombre_completo}</option>
                            ))}
                        </select>
                    </div>

                    {esProductoLamina ? (
                        <>
                            <div className="form-group">
                                <label className="form-label text-xs">Operario de Corte</label>
                                <input
                                    type="text"
                                    className="form-input text-sm"
                                    value={formData.operario_corte}
                                    onChange={(e) => setFormData({ ...formData, operario_corte: e.target.value })}
                                    placeholder="Encargado del corte"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label text-xs">Operario de Embalaje</label>
                                <input
                                    type="text"
                                    className="form-input text-sm"
                                    value={formData.operario_embalaje}
                                    onChange={(e) => setFormData({ ...formData, operario_embalaje: e.target.value })}
                                    placeholder="Encargado de embalaje"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="form-group">
                                <label className="form-label text-xs">Maquinista</label>
                                <input
                                    type="text"
                                    className="form-input text-sm"
                                    value={formData.maquinista}
                                    onChange={(e) => setFormData({ ...formData, maquinista: e.target.value })}
                                    placeholder="Nombre del maquinista"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label text-xs">Ayudante</label>
                                <input
                                    type="text"
                                    className="form-input text-sm"
                                    value={formData.ayudante}
                                    onChange={(e) => setFormData({ ...formData, ayudante: e.target.value })}
                                    placeholder="Nombre del ayudante"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea
                className="form-textarea"
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                rows={2}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Configuración</h2>
                </div>
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        className={`btn text-left ${modoReceta === 'porcentaje' && !esProductoLamina ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => {
                            if (!esProductoLamina) setModoReceta('porcentaje');
                        }}
                        disabled={esProductoLamina}
                    >
                        <Star size={18} className="mr-2" />
                        <div>
                            <div className="font-bold">Por Porcentajes</div>
                            <div className="text-xs opacity-80">Calcula kilos autom.</div>
                        </div>
                    </button>
                    <button
                        type="button"
                        className={`btn text-left ${modoReceta === 'manual' ? 'btn-warning' : 'btn-outline'}`}
                        onClick={() => setModoReceta('manual')}
                        disabled={esProductoLamina}
                    >
                        <Zap size={18} className="mr-2" />
                        <div>
                            <div className="font-bold">{esProductoLamina ? 'Orden de Conversión' : 'Orden Manual'}</div>
                            <div className="text-xs opacity-80">{esProductoLamina ? 'Selección de rollos posterior' : 'Sin insumos iniciales'}</div>
                        </div>
                    </button>
                </div>
            </div>

            {modoReceta === 'porcentaje' && !esProductoLamina && (
                <div className="card bg-gray-50">
                    <div className="p-3">
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <p className="text-xs text-muted">Costo Estimado</p>
                                <p className="text-xl font-bold text-success">{formatearMoneda(costoTotalEstimado)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted">Total Insumos</p>
                                <p className="text-lg font-bold">{listaInsumos.length}</p>
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                            <span className="text-xs font-medium">Suma Porcentajes:</span>
                            <span className={`text-sm font-bold ${Math.abs(porcentajeActualTotal - 100) < 0.01 ? 'text-success' : 'text-danger'}`}>
                                {porcentajeActualTotal.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>

        {modoReceta === 'porcentaje' && !esProductoLamina && (
            <div className="card">
                <div className="card-header flex justify-between items-center">
                    <h2 className="card-title">Composición de la Mezcla</h2>
                    <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={abrirModalInsumo}
                        disabled={!formData.cantidad_planificada}
                    >
                        <Plus size={16} /> Agregar Insumo
                    </button>
                </div>

                {!formData.cantidad_planificada ? (
                    <div className="p-8 text-center text-muted">
                        <AlertCircle size={40} className="mx-auto mb-2 opacity-20" />
                        <p>Ingrese la cantidad total en kilos para habilitar la calculadora de insumos</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Insumo</th>
                                    <th className="text-center">Porcentaje (%)</th>
                                    <th className="text-right">Calculado (Kg)</th>
                                    <th className="text-right">Stock</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {listaInsumos.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="text-center py-4 text-muted">No hay insumos agregados</td>
                                    </tr>
                                ) : (
                                    listaInsumos.map(item => {
                                        const calculado = calcularCantidadInsumo(item.porcentaje);
                                        const tieneStock = item.stock_actual >= calculado;
                                        return (
                                            <tr key={item.id_insumo}>
                                                <td>
                                                    <div className="font-medium">{item.codigo_insumo}</div>
                                                    <div className="text-xs text-muted">{item.insumo}</div>
                                                </td>
                                                <td className="text-center font-bold text-blue-600">
                                                    {`${item.porcentaje}%`}
                                                </td>
                                                <td className="text-right font-mono font-bold">
                                                    {`${calculado.toFixed(2)} Kg`}
                                                </td>
                                                <td className="text-right">
                                                    <span className={tieneStock ? 'text-success' : 'text-danger'}>
                                                        {item.stock_actual.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-danger p-1"
                                                        onClick={() => eliminarInsumoLista(item.id_insumo)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

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
            disabled={guardando || !formData.id_producto_terminado}
          >
            {guardando ? 'Creando...' : 'Crear Orden'}
          </button>
        </div>
      </form>

      <Modal
        isOpen={modalAgregarInsumo}
        onClose={() => setModalAgregarInsumo(false)}
        title="Agregar Insumo a la Mezcla"
        size="md"
      >
        <div className="form-group">
          <label className="form-label">Insumo (Sugerido por nombre) *</label>
          <select
            className="form-select"
            value={nuevoInsumo.id_insumo}
            onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, id_insumo: e.target.value })}
          >
            <option value="">Seleccione...</option>
            {insumosFiltradosParaMostrar
              .filter(i => !listaInsumos.find(li => li.id_insumo == i.id_producto))
              .map(insumo => (
                <option key={insumo.id_producto} value={insumo.id_producto}>
                  {insumo.nombre} - Stock: {parseFloat(insumo.stock_actual).toFixed(2)}
                </option>
              ))}
          </select>
          <small className="text-xs text-blue-600 block mt-1">
             Filtrando insumos relacionados al nombre del producto.
          </small>
        </div>

        <div className="form-group">
          <label className="form-label">Porcentaje (%) *</label>
          <div className="relative">
            <input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                className="form-input pr-8"
                value={nuevoInsumo.porcentaje}
                onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, porcentaje: e.target.value })}
                placeholder="Ej: 50"
            />
            <span className="absolute right-3 top-2.5 text-gray-500 font-bold">%</span>
          </div>
          {formData.cantidad_planificada && nuevoInsumo.porcentaje && (
             <p className="text-sm text-blue-600 mt-1 text-right font-medium">
                Equivale a: {((parseFloat(formData.cantidad_planificada) * parseFloat(nuevoInsumo.porcentaje)) / 100).toFixed(2)} Kg
             </p>
          )}
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <button type="button" className="btn btn-outline" onClick={() => setModalAgregarInsumo(false)}>
            Cancelar
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={agregarInsumoLista}
            disabled={!nuevoInsumo.id_insumo || !nuevoInsumo.porcentaje}
          >
            Agregar
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default CrearOrden;