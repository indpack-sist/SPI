import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertCircle, Plus, Trash2, Star, CheckCircle, AlertTriangle, Factory, Layers, BarChart,
  Package, Zap, Search, X, RefreshCw, ChevronDown, Sun, Moon, Users, Info, Hash, Ruler, Scale
} from 'lucide-react';
import { ordenesProduccionAPI, productosAPI, empleadosAPI } from '../../config/api';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import './Produccion.css';

const extraerMedidas = (nombre) => {
  if (!nombre) return [];
  const matches = nombre.toUpperCase().match(/\d+(?:[.,]\d+)?/g);
  return matches ? matches.map(m => parseFloat(m.replace(',', '.'))) : [];
};

const rolloCoincideConLamina = (nombreLamina, nombreRollo) => {
  const medidasLamina = extraerMedidas(nombreLamina);
  const medidasRollo = extraerMedidas(nombreRollo);
  if (medidasLamina.length === 0 || medidasRollo.length === 0) return true;
  const anchoRollo = Math.min(...medidasRollo);
  return medidasLamina.some(m => Math.abs(m - anchoRollo) < 0.001);
};

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
  
  const [unidadMedidaSeleccionada, setUnidadMedidaSeleccionada] = useState('');

  const [modoReceta, setModoReceta] = useState('porcentaje');
  const [listaInsumos, setListaInsumos] = useState([]);
  const [modalAgregarInsumo, setModalAgregarInsumo] = useState(false);

  const [listaRollos, setListaRollos] = useState([]);
  const [modalAgregarRollo, setModalAgregarRollo] = useState(false);
  const [rolloSeleccionado, setRolloSeleccionado] = useState('');

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
    const tipoInsumo = (insumo.tipo_inventario || '').toUpperCase();

    if (nombreProd.includes('LÁMINA') || nombreProd.includes('LAMINA')) {
      return tipoInsumo.includes('BURBUPACK');
    }

    if (nombreProd.includes('ESQUINERO')) {
      return tipoInsumo.includes('ESQUINERO');
    }

    if (nombreProd.includes('BURBUPACK')) {
      return tipoInsumo.includes('BURBUPACK');
    }

    if (nombreProd.includes('ZUNCHO')) {
      return tipoInsumo.includes('ZUNCHO');
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

  const productoLaminaSeleccionado = productosTerminados.find(p => p.id_producto == formData.id_producto_terminado);
  const rollosFiltrados = (esProductoLamina && productoLaminaSeleccionado)
    ? insumosDisponibles.filter(insumo => {
        const nombreInsumo = insumo.nombre.toUpperCase();
        return nombreInsumo.includes('ROLLO BURBUPACK')
          && rolloCoincideConLamina(productoLaminaSeleccionado.nombre, insumo.nombre);
      })
    : [];

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
    setUnidadMedidaSeleccionada(producto.unidad_medida || 'UND');
    setMostrarDropdown(false);
    setListaInsumos([]);
    setListaRollos([]);
  };

  const handleLimpiarProducto = () => {
    setFormData({ ...formData, id_producto_terminado: '' });
    setBusquedaProducto('');
    setUnidadMedidaSeleccionada('');
    setListaInsumos([]);
    setListaRollos([]);
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

  const agregarRollo = () => {
    if (!rolloSeleccionado) return;
    const rollo = insumosDisponibles.find(i => i.id_producto == rolloSeleccionado);
    if (!rollo) return;

    if (listaRollos.find(r => r.id_insumo == rolloSeleccionado)) {
      setError('Ese rollo ya está en la lista');
      return;
    }

    setListaRollos([
      ...listaRollos,
      {
        id_insumo: rollo.id_producto,
        nombre: rollo.nombre,
        codigo: rollo.codigo,
        unidad_medida: rollo.unidad_medida,
        stock_actual: parseFloat(rollo.stock_actual)
      }
    ]);
    setRolloSeleccionado('');
    setModalAgregarRollo(false);
  };

  const eliminarRollo = (idInsumo) => {
    setListaRollos(listaRollos.filter(r => r.id_insumo != idInsumo));
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

      if (esProductoLamina && listaRollos.length > 0) {
        payload.rollos = listaRollos.map(r => ({ id_insumo: r.id_insumo }));
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
    return <Loading variant="form" />;
  }

  const costoTotalEstimado = listaInsumos.reduce((sum, item) => {
      const cantidad = calcularCantidadInsumo(item.porcentaje);
      return sum + (cantidad * item.costo_unitario);
  }, 0);

  const porcentajeActualTotal = listaInsumos.reduce((sum, item) => sum + item.porcentaje, 0);

  const porcentajeCompleto = Math.abs(porcentajeActualTotal - 100) < 0.01;
  const kilosMezcla = listaInsumos.reduce((sum, item) => sum + calcularCantidadInsumo(item.porcentaje), 0);
  const insumosSinStock = listaInsumos.filter(item => item.stock_actual < calcularCantidadInsumo(item.porcentaje)).length;
  const usaMezcla = modoReceta === 'porcentaje' && !esProductoLamina;

  const pendientes = [
    !formData.id_producto_terminado && 'Elegir el producto terminado',
    !esProductoLamina && !formData.cantidad_planificada && 'Indicar los kilos estimados',
    esProductoLamina && !formData.cantidad_unidades && 'Indicar la meta en unidades',
    !formData.id_supervisor && 'Asignar un supervisor',
    usaMezcla && listaInsumos.length === 0 && 'Agregar insumos a la mezcla',
    usaMezcla && listaInsumos.length > 0 && !porcentajeCompleto && 'Completar la mezcla al 100%'
  ].filter(Boolean);

  return (
    <div className="pg-page">
      <div className="pd-topbar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/produccion/ordenes')}>
          <ArrowLeft size={16} /> Órdenes de producción
        </button>
      </div>

      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Factory size={13} /> Producción</span>
          <h1 className="pg-title">Nueva orden de producción</h1>
          <p className="pg-subtitle">Define el producto, la meta y la mezcla de insumos por porcentaje.</p>
        </div>
        <div className="pg-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate('/produccion/ordenes')} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" form="form-crear-op" className="btn btn-primary" disabled={guardando || !formData.id_producto_terminado}>
            <CheckCircle size={16} /> {guardando ? 'Creando…' : 'Crear orden'}
          </button>
        </div>
      </header>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} />}

      <form id="form-crear-op" onSubmit={handleSubmit}>
        <div className="pd-create">
          <div className="pg-stack">
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Package size={16} /> Producto y cantidades</h2>
              </div>
              <div className="pg-panel-body">
                <div className="pd-form-grid pd-cols-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="co-numero">Número de orden</label>
                    <div className="pd-input-row">
                      <input id="co-numero" type="text" className="form-input pd-readonly-code" value={formData.numero_orden} readOnly />
                      <button type="button" className="pg-iconbtn pd-iconbtn-lg" onClick={generarSiguienteCorrelativo}
                        disabled={generandoCorrelativo} title="Generar siguiente correlativo" aria-label="Generar siguiente correlativo">
                        <RefreshCw size={16} className={generandoCorrelativo ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>

                  <div className="form-group pd-combo" ref={dropdownRef}>
                    <label className="form-label" htmlFor="co-producto">Producto terminado *</label>
                    <div className="pd-combo-field">
                      <Search size={16} className="pd-combo-icon" />
                      <input
                        id="co-producto"
                        type="text"
                        className="form-input"
                        autoComplete="off"
                        placeholder="Buscar por código o nombre"
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
                        aria-expanded={mostrarDropdown}
                      />
                      {formData.id_producto_terminado ? (
                        <button type="button" className="pd-combo-clear" onClick={handleLimpiarProducto} aria-label="Quitar producto">
                          <X size={16} />
                        </button>
                      ) : (
                        <ChevronDown size={16} className="pd-combo-chevron" />
                      )}
                    </div>

                    {mostrarDropdown && (
                      <ul className="pd-combo-menu" role="listbox">
                        {productosFiltrados.length > 0 ? (
                          productosFiltrados.map((prod) => {
                            const stock = parseFloat(prod.stock_actual || 0);
                            return (
                              <li key={prod.id_producto}>
                                <button type="button" role="option" aria-selected={formData.id_producto_terminado == prod.id_producto}
                                  onClick={() => handleSeleccionarProducto(prod)}>
                                  <span>
                                    <b>{prod.codigo}</b>
                                    <small>{prod.nombre}</small>
                                  </span>
                                  <span className={`pd-tag ${stock > 0 ? 'is-success' : 'is-danger'}`}>Stock {stock.toFixed(2)}</span>
                                </button>
                              </li>
                            );
                          })
                        ) : (
                          <li className="pd-combo-empty">No se encontraron productos</li>
                        )}
                      </ul>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="co-unidades">
                      Meta en unidades{esProductoLamina ? ' *' : ''}
                      {unidadMedidaSeleccionada && <span className="pg-muted"> · {unidadMedidaSeleccionada}</span>}
                    </label>
                    <div className="input-with-icon">
                      <Hash size={16} className="icon" />
                      <input
                        id="co-unidades"
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-input"
                        value={formData.cantidad_unidades}
                        onChange={(e) => setFormData({ ...formData, cantidad_unidades: e.target.value })}
                        required={esProductoLamina}
                        placeholder={unidadMedidaSeleccionada ? `Ej: 100 ${unidadMedidaSeleccionada}` : '0'}
                      />
                    </div>
                  </div>

                  {!esProductoLamina && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="co-kilos">Kilos estimados de insumos *</label>
                      <div className="input-with-icon">
                        <Scale size={16} className="icon" />
                        <input
                          id="co-kilos"
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="form-input"
                          value={formData.cantidad_planificada}
                          onChange={(e) => setFormData({ ...formData, cantidad_planificada: e.target.value })}
                          required
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <span className="form-label">Turno *</span>
                    <div className="pg-segmented" role="radiogroup" aria-label="Turno">
                      {[{ id: 'Día', icon: Sun }, { id: 'Noche', icon: Moon }].map(t => {
                        const Icono = t.icon;
                        return (
                          <button key={t.id} type="button" role="radio" aria-checked={formData.turno === t.id}
                            className={formData.turno === t.id ? 'active' : ''} onClick={() => setFormData({ ...formData, turno: t.id })}>
                            <Icono size={13} /> {t.id}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Ruler size={16} /> Especificaciones</h2>
                <span className="pg-panel-meta">Opcional</span>
              </div>
              <div className="pg-panel-body">
                <div className="pd-form-grid pd-cols-3">
                  <div className="form-group">
                    <label className="form-label" htmlFor="co-medida">Medida</label>
                    <div className="input-with-icon">
                      <Ruler size={14} className="icon" />
                      <input id="co-medida" type="text" className="form-input" value={formData.medida}
                        onChange={(e) => setFormData({ ...formData, medida: e.target.value })} placeholder="Ej: 50x70 cm" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="co-peso">Peso unitario</label>
                    <div className="input-with-icon">
                      <Scale size={14} className="icon" />
                      <input id="co-peso" type="text" className="form-input" value={formData.peso_producto}
                        onChange={(e) => setFormData({ ...formData, peso_producto: e.target.value })} placeholder="Ej: 200 g" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="co-gramaje">Gramaje</label>
                    <div className="input-with-icon">
                      <Info size={14} className="icon" />
                      <input id="co-gramaje" type="text" className="form-input" value={formData.gramaje}
                        onChange={(e) => setFormData({ ...formData, gramaje: e.target.value })} placeholder="Ej: 150 micras" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Users size={16} /> Personal asignado</h2>
              </div>
              <div className="pg-panel-body">
                <div className="pd-form-grid pd-cols-3">
                  <div className="form-group">
                    <label className="form-label" htmlFor="co-supervisor">Supervisor *</label>
                    <select id="co-supervisor" className="form-select" value={formData.id_supervisor}
                      onChange={(e) => setFormData({ ...formData, id_supervisor: e.target.value })} required>
                      <option value="">Seleccionar…</option>
                      {supervisores.map(sup => (
                        <option key={sup.id_empleado} value={sup.id_empleado}>{sup.nombre_completo}</option>
                      ))}
                    </select>
                  </div>
                  {esProductoLamina ? (
                    <>
                      <div className="form-group">
                        <label className="form-label" htmlFor="co-corte">Operario de corte</label>
                        <input id="co-corte" type="text" className="form-input" value={formData.operario_corte}
                          onChange={(e) => setFormData({ ...formData, operario_corte: e.target.value })} placeholder="Encargado del corte" />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="co-embalaje">Operario de embalaje</label>
                        <input id="co-embalaje" type="text" className="form-input" value={formData.operario_embalaje}
                          onChange={(e) => setFormData({ ...formData, operario_embalaje: e.target.value })} placeholder="Encargado de embalaje" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="form-group">
                        <label className="form-label" htmlFor="co-maquinista">Maquinista</label>
                        <input id="co-maquinista" type="text" className="form-input" value={formData.maquinista}
                          onChange={(e) => setFormData({ ...formData, maquinista: e.target.value })} placeholder="Nombre del maquinista" />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="co-ayudante">Ayudante</label>
                        <input id="co-ayudante" type="text" className="form-input" value={formData.ayudante}
                          onChange={(e) => setFormData({ ...formData, ayudante: e.target.value })} placeholder="Nombre del ayudante" />
                      </div>
                    </>
                  )}
                </div>
                <div className="form-group m-0">
                  <label className="form-label" htmlFor="co-observaciones">Observaciones</label>
                  <textarea id="co-observaciones" className="form-textarea" value={formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })} rows={2} placeholder="Notas adicionales…" />
                </div>
              </div>
            </section>

            {usaMezcla && (
              <section className="pg-panel">
                <div className="pg-panel-head">
                  <h2 className="pg-panel-title"><Layers size={16} /> Composición de la mezcla <span className="pg-count">{listaInsumos.length}</span></h2>
                  <button type="button" className="btn btn-sm btn-primary" onClick={abrirModalInsumo} disabled={!formData.cantidad_planificada}>
                    <Plus size={15} /> Agregar insumo
                  </button>
                </div>

                {!formData.cantidad_planificada ? (
                  <div className="pg-empty">
                    <AlertCircle size={28} />
                    <strong>Primero indica los kilos estimados</strong>
                    <span>Con ese total se calculan los kilos de cada insumo según su porcentaje.</span>
                  </div>
                ) : (
                  <div className="pg-table-wrap">
                    <table className="pg-table">
                      <thead>
                        <tr>
                          <th>Insumo</th>
                          <th className="num">Porcentaje</th>
                          <th className="num">Calculado</th>
                          <th className="num">Stock</th>
                          <th className="center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listaInsumos.length === 0 ? (
                          <tr>
                            <td colSpan={5}>
                              <div className="pg-empty">
                                <Layers size={24} />
                                <strong>Sin insumos</strong>
                                <span>Agrega los insumos hasta sumar 100%.</span>
                              </div>
                            </td>
                          </tr>
                        ) : listaInsumos.map(item => {
                          const calculado = calcularCantidadInsumo(item.porcentaje);
                          const tieneStock = item.stock_actual >= calculado;
                          return (
                            <tr key={item.id_insumo}>
                              <td>
                                <span className="pg-cell-main">{item.insumo}</span>
                                <span className="pg-cell-sub">{item.codigo_insumo}</span>
                              </td>
                              <td className="num"><b className="text-primary">{item.porcentaje}%</b></td>
                              <td className="num"><b>{calculado.toFixed(2)}</b> kg</td>
                              <td className="num">
                                <span className={`pd-tag ${tieneStock ? 'is-success' : 'is-danger'}`}>
                                  {tieneStock ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
                                  {item.stock_actual.toFixed(2)}
                                </span>
                              </td>
                              <td className="center">
                                <button type="button" className="pg-iconbtn" onClick={() => eliminarInsumoLista(item.id_insumo)}
                                  title="Quitar insumo" aria-label={`Quitar ${item.insumo}`}>
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {listaInsumos.length > 0 && (
                        <tfoot>
                          <tr className="pd-total-row">
                            <td>Total</td>
                            <td className={`num ${porcentajeCompleto ? 'text-success' : 'text-danger'}`}>{porcentajeActualTotal.toFixed(2)}%</td>
                            <td className="num">{kilosMezcla.toFixed(2)} kg</td>
                            <td colSpan={2} className="num">{formatearMoneda(costoTotalEstimado)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </section>
            )}

            {esProductoLamina && formData.id_producto_terminado && (
              <section className="pg-panel">
                <div className="pg-panel-head">
                  <div>
                    <h2 className="pg-panel-title"><Layers size={16} /> Rollos a consumir <span className="pg-count">{listaRollos.length}</span></h2>
                    <span className="pg-panel-meta">Solo rollos cuyo ancho coincide con la lámina. La cantidad se registra en producción.</span>
                  </div>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => { setRolloSeleccionado(''); setModalAgregarRollo(true); }}>
                    <Plus size={15} /> Agregar rollo
                  </button>
                </div>
                <div className="pg-table-wrap">
                  <table className="pg-table">
                    <thead>
                      <tr>
                        <th>Rollo</th>
                        <th className="num">Stock</th>
                        <th className="center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaRollos.length === 0 ? (
                        <tr>
                          <td colSpan={3}>
                            <div className="pg-empty">
                              <Layers size={24} />
                              <strong>Sin rollos seleccionados</strong>
                              <span>Puedes agregarlos ahora o durante la producción.</span>
                            </div>
                          </td>
                        </tr>
                      ) : listaRollos.map(item => (
                        <tr key={item.id_insumo}>
                          <td>
                            <span className="pg-cell-main">{item.nombre}</span>
                            <span className="pg-cell-sub">{item.codigo}</span>
                          </td>
                          <td className="num">
                            <span className={`pd-tag ${item.stock_actual > 0 ? 'is-success' : 'is-danger'}`}>
                              {item.stock_actual.toFixed(2)} {item.unidad_medida}
                            </span>
                          </td>
                          <td className="center">
                            <button type="button" className="pg-iconbtn" onClick={() => eliminarRollo(item.id_insumo)}
                              title="Quitar rollo" aria-label={`Quitar ${item.nombre}`}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          <aside className="pd-create-aside">
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Star size={16} /> Tipo de orden</h2>
              </div>
              <div className="pg-panel-body pd-vstack" role="radiogroup" aria-label="Tipo de orden">
                <button type="button" role="radio" aria-checked={usaMezcla}
                  className={`pd-option is-accent ${usaMezcla ? 'on' : ''}`}
                  onClick={() => { if (!esProductoLamina) setModoReceta('porcentaje'); }}
                  disabled={esProductoLamina}>
                  <Star size={18} />
                  <span>
                    <strong>Por porcentajes</strong>
                    <small>Calcula los kilos de cada insumo automáticamente.</small>
                  </span>
                </button>
                <button type="button" role="radio" aria-checked={modoReceta === 'manual'}
                  className={`pd-option is-warning ${modoReceta === 'manual' ? 'on' : ''}`}
                  onClick={() => setModoReceta('manual')}
                  disabled={esProductoLamina}>
                  <Zap size={18} />
                  <span>
                    <strong>{esProductoLamina ? 'Orden de conversión' : 'Orden manual'}</strong>
                    <small>{esProductoLamina ? 'Los rollos se eligen arriba o durante la producción.' : 'Sin insumos iniciales.'}</small>
                  </span>
                </button>
              </div>
            </section>

            {usaMezcla && (
              <section className="pg-panel">
                <div className="pg-panel-head">
                  <h2 className="pg-panel-title"><BarChart size={16} /> Resumen de la mezcla</h2>
                </div>
                <div className="pg-panel-body pd-vstack">
                  <div>
                    <span className="pg-field-label">Costo estimado</span>
                    <div className="pd-summary-value">{formatearMoneda(costoTotalEstimado)}</div>
                  </div>
                  <div>
                    <div className="pd-progress-top">
                      <span>Suma de porcentajes</span>
                      <b className={porcentajeCompleto ? 'text-success' : 'text-danger'}>{porcentajeActualTotal.toFixed(2)}%</b>
                    </div>
                    <div className="pg-meter" style={{ '--meter-c': porcentajeCompleto ? 'var(--success)' : porcentajeActualTotal > 100 ? 'var(--danger)' : 'var(--warning)' }}>
                      <span style={{ width: `${Math.min(porcentajeActualTotal, 100)}%` }} />
                    </div>
                  </div>
                  <div className="pg-kv">
                    <div><span>Insumos</span><strong>{listaInsumos.length}</strong></div>
                    <div><span>Kilos</span><strong>{kilosMezcla.toFixed(2)} kg</strong></div>
                    {insumosSinStock > 0 && <div className="wide"><span>Atención</span><strong className="text-danger">{insumosSinStock} sin stock suficiente</strong></div>}
                  </div>
                </div>
              </section>
            )}

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><CheckCircle size={16} /> Antes de crear</h2>
              </div>
              <div className="pg-panel-body">
                {pendientes.length === 0 ? (
                  <p className="pd-ready"><CheckCircle size={15} /> Todo listo para crear la orden.</p>
                ) : (
                  <ul className="pd-checklist">
                    {pendientes.map(p => <li key={p}><AlertCircle size={13} /> {p}</li>)}
                  </ul>
                )}
              </div>
            </section>
          </aside>
        </div>

        <div className="pd-form-footer">
          <button type="button" className="btn btn-outline" onClick={() => navigate('/produccion/ordenes')} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={guardando || !formData.id_producto_terminado}>
            <CheckCircle size={16} /> {guardando ? 'Creando…' : 'Crear orden'}
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

      <Modal
        isOpen={modalAgregarRollo}
        onClose={() => setModalAgregarRollo(false)}
        title="Agregar Rollo a Consumir"
        size="md"
      >
        <div className="form-group">
          <label className="form-label">Rollo (filtrado por medidas de la lámina) *</label>
          <select
            className="form-select"
            value={rolloSeleccionado}
            onChange={(e) => setRolloSeleccionado(e.target.value)}
          >
            <option value="">Seleccione...</option>
            {rollosFiltrados
              .filter(r => !listaRollos.find(lr => lr.id_insumo == r.id_producto))
              .map(rollo => (
                <option key={rollo.id_producto} value={rollo.id_producto}>
                  {rollo.nombre} - Stock: {parseFloat(rollo.stock_actual).toFixed(2)}
                </option>
              ))}
          </select>
          {rollosFiltrados.length === 0 ? (
            <small className="text-xs text-danger block mt-1">
              No se encontraron rollos que coincidan con las medidas de esta lámina.
            </small>
          ) : (
            <small className="text-xs text-blue-600 block mt-1">
              Mostrando solo rollos cuyo ancho coincide con las medidas de la lámina.
            </small>
          )}
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <button type="button" className="btn btn-outline" onClick={() => setModalAgregarRollo(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={agregarRollo}
            disabled={!rolloSeleccionado}
          >
            Agregar
          </button>
        </div>
      </Modal>
    </div>
  );
}
export default CrearOrden;