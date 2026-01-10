import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Play, Pause, Square, CheckCircle, XCircle, 
  Star, Package, Clock, Beaker, FileText, ClipboardList, 
  BarChart, DollarSign, Info, AlertTriangle, Trash2, Plus,
  Layers, TrendingUp, TrendingDown, Minus, Edit
} from 'lucide-react';
import { ordenesProduccionAPI } from '../../config/api';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function OrdenDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orden, setOrden] = useState(null);
  const [consumoMateriales, setConsumoMateriales] = useState([]);
  const [registrosParciales, setRegistrosParciales] = useState([]);
  const [analisisConsumo, setAnalisisConsumo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [procesando, setProcesando] = useState(false);
  
  // Modal finalizar (ahora con consumo real)
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [cantidadProducida, setCantidadProducida] = useState('');
  const [observacionesFinal, setObservacionesFinal] = useState('');
  
  // Modal registro parcial NUEVO
  const [modalParcial, setModalParcial] = useState(false);
  const [cantidadParcial, setCantidadParcial] = useState('');
  const [observacionesParcial, setObservacionesParcial] = useState('');
  
  // Consumo real de insumos NUEVO
  const [consumoRealInsumos, setConsumoRealInsumos] = useState([]);
  const [mostrarConsumoReal, setMostrarConsumoReal] = useState(false);
  
  // Mermas
  const [productosMerma, setProductosMerma] = useState([]);
  const [mermas, setMermas] = useState([]);
  const [mostrarMermas, setMostrarMermas] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [ordenRes, consumoRes, registrosRes] = await Promise.all([
        ordenesProduccionAPI.getById(id),
        ordenesProduccionAPI.getConsumoMateriales(id),
        ordenesProduccionAPI.getRegistrosParciales(id).catch(() => ({ data: { data: [] } }))
      ]);
      
      setOrden(ordenRes.data.data);
      setConsumoMateriales(consumoRes.data.data);
      setRegistrosParciales(registrosRes.data.data || []);
      
      // Si la orden está finalizada, cargar análisis de consumo
      if (ordenRes.data.data.estado === 'Finalizada') {
        const analisisRes = await ordenesProduccionAPI.getAnalisisConsumo(id);
        setAnalisisConsumo(analisisRes.data.data);
      }
    } catch (err) {
      setError(err.error || 'Error al cargar la orden');
    } finally {
      setLoading(false);
    }
  };

  const cargarProductosMerma = async () => {
    try {
      const response = await ordenesProduccionAPI.getProductosMerma();
      setProductosMerma(response.data.data);
    } catch (err) {
      console.error('Error al cargar productos de merma:', err);
    }
  };

  const inicializarConsumoReal = () => {
    const consumo = consumoMateriales.map(item => ({
      id_insumo: item.id_insumo,
      codigo_insumo: item.codigo_insumo,
      insumo: item.insumo,
      unidad_medida: item.unidad_medida,
      cantidad_planificada: parseFloat(item.cantidad_requerida),
      cantidad_real: parseFloat(item.cantidad_requerida), // Inicialmente igual
      costo_unitario: parseFloat(item.costo_unitario)
    }));
    setConsumoRealInsumos(consumo);
  };

  const actualizarCantidadReal = (id_insumo, valor) => {
    setConsumoRealInsumos(prev => 
      prev.map(item => 
        item.id_insumo === id_insumo 
          ? { ...item, cantidad_real: parseFloat(valor) || 0 }
          : item
      )
    );
  };

  const calcularCostoReal = () => {
    return consumoRealInsumos.reduce((total, item) => {
      return total + (item.cantidad_real * item.costo_unitario);
    }, 0);
  };

  // Helper para procesar éxito parcial
  const procesarExitoParcial = (response) => {
    setSuccess(`Producción parcial registrada: ${response.data.data.cantidad_registrada} unidades. Total acumulado: ${response.data.data.cantidad_total_producida}`);
    setModalParcial(false);
    setCantidadParcial('');
    setObservacionesParcial('');
    setConsumoRealInsumos([]);
    setMostrarConsumoReal(false);
    cargarDatos();
  };

  // NUEVO: Handler para registro parcial con validación de exceso
  const handleRegistroParcial = async (e) => {
    e.preventDefault();
    
    try {
      setProcesando(true);
      setError(null);
      
      const payload = {
        cantidad_parcial: cantidadParcial,
        observaciones: observacionesParcial
      };
      
      // Si mostró consumo real, incluirlo
      if (mostrarConsumoReal && consumoRealInsumos.length > 0) {
        payload.consumo_real = consumoRealInsumos.map(item => ({
          id_insumo: item.id_insumo,
          cantidad_real: item.cantidad_real
        }));
      }
      
      try {
        // Intento normal
        const response = await ordenesProduccionAPI.registrarParcial(id, payload);
        procesarExitoParcial(response);
      } catch (err) {
        // Capturar error 409 (Conflicto / Exceso)
        if (err.response && err.response.status === 409 && err.response.data.requiere_confirmacion) {
          const confirmar = window.confirm(`${err.response.data.mensaje}\n\n¿Desea confirmar el registro con este exceso?`);
          
          if (confirmar) {
            // Reintentar con flag de confirmación
            payload.confirmar_exceso = true;
            const retryResponse = await ordenesProduccionAPI.registrarParcial(id, payload);
            procesarExitoParcial(retryResponse);
            return;
          }
        }
        // Si no es error 409 o el usuario canceló, lanzar el error original
        throw err;
      }
      
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.error || 'Error al registrar producción parcial';
      setError(errorMsg);
    } finally {
      setProcesando(false);
    }
  };

  // Helper para procesar éxito al finalizar
  const procesarExitoFinalizar = (mermasValidas) => {
    const mensajeExito = mostrarConsumoReal
      ? `Producción finalizada con ajustes de consumo real. ${mermasValidas.length > 0 ? `${mermasValidas.length} merma(s) registradas.` : ''}`
      : `Producción finalizada exitosamente. ${mermasValidas.length > 0 ? `${mermasValidas.length} merma(s) registradas.` : ''}`;
    
    setSuccess(mensajeExito);
    setModalFinalizar(false);
    setMermas([]);
    setMostrarMermas(false);
    setConsumoRealInsumos([]);
    setMostrarConsumoReal(false);
    cargarDatos();
  };

  // MODIFICADO: Handler para finalizar con consumo real y validación de exceso
  const handleFinalizar = async (e) => {
    e.preventDefault();
    
    const mermasValidas = mermas.filter(m => 
      m.id_producto_merma && 
      m.cantidad && 
      parseFloat(m.cantidad) > 0
    );
    
    try {
      setProcesando(true);
      setError(null);
      
      const payload = {
        cantidad_producida: cantidadProducida,
        observaciones: observacionesFinal,
        mermas: mermasValidas.map(m => ({
          id_producto_merma: parseInt(m.id_producto_merma),
          cantidad: parseFloat(m.cantidad),
          observaciones: m.observaciones || null
        }))
      };
      
      // Si mostró consumo real, usar endpoint especial o agregar al payload
      if (mostrarConsumoReal && consumoRealInsumos.length > 0) {
        payload.consumo_real = consumoRealInsumos.map(item => ({
          id_insumo: item.id_insumo,
          cantidad_real: item.cantidad_real
        }));
      }

      // Función auxiliar para llamar a la API correcta
      const ejecutarFinalizacion = async (data) => {
        if (mostrarConsumoReal && consumoRealInsumos.length > 0) {
          return await ordenesProduccionAPI.finalizarConConsumoReal(id, data);
        } else {
          return await ordenesProduccionAPI.finalizar(id, data);
        }
      };
      
      try {
        // Intento normal
        await ejecutarFinalizacion(payload);
        procesarExitoFinalizar(mermasValidas);
      } catch (err) {
        // Capturar error 409 (Exceso)
        if (err.response && err.response.status === 409 && err.response.data.requiere_confirmacion) {
          const confirmar = window.confirm(`${err.response.data.mensaje}\n\n¿Desea finalizar la orden con este exceso?`);
          
          if (confirmar) {
            payload.confirmar_exceso = true;
            await ejecutarFinalizacion(payload);
            procesarExitoFinalizar(mermasValidas);
            return;
          }
        }
        throw err;
      }
      
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.error || 'Error al finalizar producción';
      setError(errorMsg);
    } finally {
      setProcesando(false);
    }
  };

  const handleIniciar = async () => {
    if (!confirm('¿Está seguro de iniciar la producción? Esto consumirá los materiales del inventario.')) return;

    try {
      setProcesando(true);
      setError(null);
      await ordenesProduccionAPI.iniciar(id);
      setSuccess('Producción iniciada exitosamente. Los materiales han sido consumidos.');
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al iniciar producción');
    } finally {
      setProcesando(false);
    }
  };

  const handlePausar = async () => {
    try {
      setProcesando(true);
      setError(null);
      await ordenesProduccionAPI.pausar(id);
      setSuccess('Producción pausada');
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al pausar producción');
    } finally {
      setProcesando(false);
    }
  };

  const handleReanudar = async () => {
    try {
      setProcesando(true);
      setError(null);
      await ordenesProduccionAPI.reanudar(id);
      setSuccess('Producción reanudada');
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al reanudar producción');
    } finally {
      setProcesando(false);
    }
  };

  const agregarMerma = () => {
    setMermas([...mermas, {
      id_temp: Date.now(),
      id_producto_merma: '',
      cantidad: '',
      observaciones: ''
    }]);
  };

  const eliminarMerma = (id_temp) => {
    setMermas(mermas.filter(m => m.id_temp !== id_temp));
  };

  const actualizarMerma = (id_temp, campo, valor) => {
    setMermas(mermas.map(m => 
      m.id_temp === id_temp ? { ...m, [campo]: valor } : m
    ));
  };

  const handleCancelar = async () => {
    if (!confirm('¿Está seguro de cancelar esta orden? Los materiales consumidos serán devueltos al inventario.')) return;

    try {
      setProcesando(true);
      setError(null);
      await ordenesProduccionAPI.cancelar(id);
      setSuccess('Orden cancelada. Los materiales han sido devueltos al inventario.');
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al cancelar orden');
    } finally {
      setProcesando(false);
    }
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(valor || 0);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearTiempo = (minutos) => {
    if (!minutos || minutos === 0) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}m`;
  };

  const getBadgeEstado = (estado) => {
    const badges = {
      'Pendiente': 'badge-secondary',
      'En Curso': 'badge-primary',
      'En Pausa': 'badge-warning',
      'Finalizada': 'badge-success',
      'Cancelada': 'badge-danger'
    };
    return badges[estado] || 'badge-secondary';
  };

  const calcularLotesProducidos = () => {
    if (!orden || !orden.cantidad_producida || !orden.rendimiento_unidades) return 0;
    return Math.ceil(parseFloat(orden.cantidad_producida) / parseFloat(orden.rendimiento_unidades));
  };

  const calcularLotesPlanificados = () => {
    if (!orden || !orden.cantidad_planificada || !orden.rendimiento_unidades) return 0;
    return Math.ceil(parseFloat(orden.cantidad_planificada) / parseFloat(orden.rendimiento_unidades));
  };

  if (loading) {
    return <Loading message="Cargando orden..." />;
  }

  if (!orden) {
    return (
      <div>
        <Alert type="error" message="Orden no encontrada" />
        <button className="btn btn-outline mt-3" onClick={() => navigate('/produccion/ordenes')}>
          <ArrowLeft size={18} className="mr-2" />
          Volver a Órdenes
        </button>
      </div>
    );
  }

  const puedeIniciar = orden.estado === 'Pendiente';
  const puedePausar = orden.estado === 'En Curso';
  const puedeReanudar = orden.estado === 'En Pausa';
  const puedeFinalizar = orden.estado === 'En Curso' || orden.estado === 'En Pausa';
  const puedeCancelar = orden.estado === 'En Curso' || orden.estado === 'En Pausa';
  const puedeRegistrarParcial = orden.estado === 'En Curso' || orden.estado === 'En Pausa'; // NUEVO
  const esRecetaProvisional = !orden.id_receta_producto;
  const lotesPlanificados = calcularLotesPlanificados();
  const lotesProducidos = calcularLotesProducidos();
  const tieneReceta = orden.id_receta_producto !== null; // NUEVO

  return (
    <div>
      <button className="btn btn-outline mb-4" onClick={() => navigate('/produccion/ordenes')}>
        <ArrowLeft size={20} className="mr-2" />
        Volver a Órdenes
      </button>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="card-title text-2xl font-bold">Orden de Producción: {orden.numero_orden}</h1>
          <div className="flex gap-2 items-center mt-2">
            <span className={`badge ${getBadgeEstado(orden.estado)}`}>{orden.estado}</span>
            {esRecetaProvisional && (
              <span className="badge badge-info flex items-center gap-1">
                <FileText size={14} /> Receta Provisional
              </span>
            )}
            {orden.nombre_receta && (
              <span className="badge badge-secondary">
                {orden.nombre_receta}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {puedeIniciar && (
            <button className="btn btn-success" onClick={handleIniciar} disabled={procesando}>
              <Play size={18} className="mr-2" /> Iniciar Producción
            </button>
          )}
          {puedePausar && (
            <button className="btn btn-warning" onClick={handlePausar} disabled={procesando}>
              <Pause size={18} className="mr-2" /> Pausar
            </button>
          )}
          {puedeReanudar && (
            <button className="btn btn-primary" onClick={handleReanudar} disabled={procesando}>
              <Play size={18} className="mr-2" /> Reanudar
            </button>
          )}
          {/* NUEVO BOTÓN: Registrar Parcial */}
          {puedeRegistrarParcial && (
            <button 
              className="btn btn-info" 
              onClick={() => {
                const cantidadRestante = parseFloat(orden.cantidad_planificada) - parseFloat(orden.cantidad_producida || 0);
                setCantidadParcial(cantidadRestante > 0 ? cantidadRestante : '');
                setObservacionesParcial('');
                setConsumoRealInsumos([]);
                setMostrarConsumoReal(false);
                if (tieneReceta) {
                  inicializarConsumoReal();
                }
                setModalParcial(true);
              }}
              disabled={procesando}
            >
              <Layers size={18} className="mr-2" /> Registrar Parcial
            </button>
          )}
          {puedeFinalizar && (
            <button 
              className="btn btn-success" 
              onClick={() => {
                setCantidadProducida(orden.cantidad_planificada);
                setObservacionesFinal('');
                setMermas([]);
                setMostrarMermas(false);
                setConsumoRealInsumos([]);
                setMostrarConsumoReal(false);
                if (tieneReceta) {
                  inicializarConsumoReal();
                }
                cargarProductosMerma();
                setModalFinalizar(true);
              }}
              disabled={procesando}
            >
              <CheckCircle size={18} className="mr-2" /> Finalizar
            </button>
          )}
          {puedeCancelar && (
            <button className="btn btn-danger" onClick={handleCancelar} disabled={procesando}>
              <XCircle size={18} className="mr-2" /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* INFORMACIÓN DE LA RECETA UTILIZADA */}
      {(orden.nombre_receta || esRecetaProvisional) && (
        <div className="card mb-4" style={{ 
          background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
          border: '2px solid var(--border-color)'
        }}>
          <div className="card-header flex items-center gap-2" style={{ backgroundColor: 'transparent', borderBottom: '1px solid var(--border-color)' }}>
            <Beaker size={20} className="text-primary" />
            <h2 className="card-title">Receta Utilizada</h2>
          </div>

          <div className="grid grid-cols-4 gap-3 p-4">
            <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
              <div className="text-xs text-muted mb-1">Tipo de Receta</div>
              <div className="font-bold flex items-center gap-1">
                {esRecetaProvisional ? (
                  <span className="text-info flex items-center gap-1"><FileText size={14} /> Provisional</span>
                ) : (
                  <span className="text-primary">{orden.nombre_receta}</span>
                )}
              </div>
            </div>

            <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
              <div className="text-xs text-muted mb-1">Rendimiento</div>
              <div className="font-bold text-lg">
                {parseFloat(orden.rendimiento_unidades || 1).toFixed(2)} <span className="text-sm text-muted font-normal">{orden.unidad_medida}</span>
              </div>
              <div className="text-xs text-muted">por lote</div>
            </div>

            <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
              <div className="text-xs text-muted mb-1">Lotes Planificados</div>
              <div className="font-bold text-lg text-primary">
                {lotesPlanificados}
              </div>
              <div className="text-xs text-muted">
                para {parseFloat(orden.cantidad_planificada).toFixed(2)} {orden.unidad_medida}
              </div>
            </div>

            <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
              <div className="text-xs text-muted mb-1">Insumos</div>
              <div className="font-bold text-lg flex items-center gap-1">
                <Package size={18} className="text-gray-500" />
                {consumoMateriales.length}
              </div>
              <div className="text-xs text-muted">componente(s)</div>
            </div>
          </div>

          {orden.descripcion_receta && (
            <div className="mx-4 mb-4 bg-white p-3 rounded border border-gray-100">
              <div className="text-xs text-muted mb-1 font-semibold uppercase">Descripción de la Receta</div>
              <div className="text-sm text-gray-700">{orden.descripcion_receta}</div>
            </div>
          )}
        </div>
      )}

      {/* TARJETAS DE INFORMACIÓN */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <ClipboardList size={18} className="text-gray-500" />
            <h2 className="card-title">Información General</h2>
          </div>
          <div className="p-4 grid gap-3">
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Producto</p>
              <p className="font-bold">{orden.producto}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Código</p>
              <p>{orden.codigo_producto}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Supervisor</p>
              <p>{orden.supervisor}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Fecha de Creación</p>
              <p>{formatearFecha(orden.fecha_creacion)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center gap-2">
            <BarChart size={18} className="text-gray-500" />
            <h2 className="card-title">Producción</h2>
          </div>
          <div className="p-4 grid gap-3">
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Cantidad Planificada</p>
              <p className="font-bold text-lg">
                {parseFloat(orden.cantidad_planificada).toFixed(2)} {orden.unidad_medida}
              </p>
              <p className="text-xs text-muted italic">({lotesPlanificados} lote(s))</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Cantidad Producida</p>
              <p className="font-bold text-lg text-success">
                {parseFloat(orden.cantidad_producida).toFixed(2)} {orden.unidad_medida}
              </p>
              {orden.cantidad_producida > 0 && (
                <>
                  <p className="text-xs text-muted italic">({lotesProducidos} lote(s))</p>
                  {registrosParciales.length > 0 && (
                    <p className="text-xs text-info italic">
                      {registrosParciales.length} registro(s) parcial(es)
                    </p>
                  )}
                </>
              )}
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Eficiencia</p>
              <p className="font-bold">
                {orden.cantidad_producida > 0 
                  ? `${((parseFloat(orden.cantidad_producida) / parseFloat(orden.cantidad_planificada)) * 100).toFixed(1)}%`
                  : '-'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Clock size={18} className="text-gray-500" />
            <h2 className="card-title">Tiempos y Costos</h2>
          </div>
          <div className="p-4 grid gap-3">
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Fecha Inicio / Fin</p>
              <p className="text-sm">{formatearFecha(orden.fecha_inicio)}</p>
              <p className="text-sm">{formatearFecha(orden.fecha_fin)}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Tiempo Total</p>
              <p className="font-bold flex items-center gap-1">
                <Clock size={14} /> {formatearTiempo(orden.tiempo_total_minutos)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Costo de Materiales</p>
              <p className="font-bold text-lg text-primary flex items-center gap-1">
                {formatearMoneda(orden.costo_materiales)}
              </p>
              {orden.cantidad_producida > 0 && (
                <p className="text-xs text-muted italic">
                  {formatearMoneda(parseFloat(orden.costo_materiales) / parseFloat(orden.cantidad_producida))} por unidad
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NUEVO: HISTORIAL DE REGISTROS PARCIALES */}
      {registrosParciales.length > 0 && (
        <div className="card mb-4">
          <div className="card-header flex items-center gap-2">
            <Layers size={18} className="text-info" />
            <h2 className="card-title">Historial de Registros Parciales ({registrosParciales.length})</h2>
          </div>
          <div className="table-container p-0">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th className="text-right">Cantidad Registrada</th>
                  <th>Registrado Por</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {registrosParciales.map(registro => (
                  <tr key={registro.id_registro}>
                    <td>{formatearFecha(registro.fecha_registro)}</td>
                    <td className="text-right font-bold">
                      {parseFloat(registro.cantidad_registrada).toFixed(2)} {registro.unidad_medida}
                    </td>
                    <td>{registro.registrado_por || '-'}</td>
                    <td className="text-sm text-muted">{registro.observaciones || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OBSERVACIONES */}
      {orden.observaciones && (
        <div className="card mb-4">
          <div className="card-header flex items-center gap-2">
            <FileText size={18} className="text-gray-500" />
            <h2 className="card-title">Observaciones</h2>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-700" style={{ whiteSpace: 'pre-line' }}>{orden.observaciones}</p>
          </div>
        </div>
      )}

      {/* MATERIALES CONSUMIDOS CON ANÁLISIS */}
      {consumoMateriales.length > 0 && (
        <div className="card mb-4">
          <div className="card-header flex items-center gap-2">
            <Package size={18} className="text-gray-500" />
            <h2 className="card-title">Materiales Consumidos ({consumoMateriales.length})</h2>
            {analisisConsumo && analisisConsumo.resumen.diferencia !== 0 && (
              <span className={`badge ml-auto ${analisisConsumo.resumen.diferencia > 0 ? 'badge-warning' : 'badge-success'}`}>
                {analisisConsumo.resumen.diferencia > 0 ? (
                  <><TrendingUp size={14} /> Sobrecosto: {formatearMoneda(analisisConsumo.resumen.diferencia)}</>
                ) : (
                  <><TrendingDown size={14} /> Ahorro: {formatearMoneda(Math.abs(analisisConsumo.resumen.diferencia))}</>
                )}
              </span>
            )}
          </div>

          <div className="table-container p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Insumo</th>
                  <th className="text-right">Planificado</th>
                  {analisisConsumo && <th className="text-right">Real Consumido</th>}
                  {analisisConsumo && <th className="text-right">Diferencia</th>}
                  <th className="text-right">Costo Unit.</th>
                  <th className="text-right">Costo Total</th>
                </tr>
              </thead>
              <tbody>
                {consumoMateriales.map((item, idx) => {
                  const analisisItem = analisisConsumo?.detalle.find(a => a.id_insumo === item.id_insumo);
                  const diferencia = analisisItem ? parseFloat(analisisItem.diferencia) : 0;
                  
                  return (
                    <tr key={item.id_consumo}>
                      <td className="font-mono text-xs">{item.codigo_insumo}</td>
                      <td className="font-medium">{item.insumo}</td>
                      <td className="text-right">
                        {parseFloat(item.cantidad_requerida).toFixed(4)} <span className="text-xs text-muted">{item.unidad_medida}</span>
                      </td>
                      {analisisConsumo && (
                        <td className="text-right">
                          <strong className={diferencia !== 0 ? (diferencia > 0 ? 'text-warning' : 'text-success') : ''}>
                            {analisisItem ? parseFloat(analisisItem.cantidad_real).toFixed(4) : '-'}
                          </strong> <span className="text-xs text-muted">{item.unidad_medida}</span>
                        </td>
                      )}
                      {analisisConsumo && (
                        <td className="text-right">
                          {diferencia !== 0 ? (
                            <span className={`badge ${diferencia > 0 ? 'badge-warning' : 'badge-success'}`}>
                              {diferencia > 0 ? '+' : ''}{diferencia.toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                      )}
                      <td className="text-right">{formatearMoneda(item.costo_unitario)}</td>
                      <td className="text-right font-bold">
                        {formatearMoneda(analisisItem ? analisisItem.costo_real : item.costo_total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={analisisConsumo ? 6 : 4} className="text-right">
                    TOTAL MATERIALES:
                  </td>
                  <td className="text-right text-lg text-primary">
                    {analisisConsumo ? formatearMoneda(analisisConsumo.resumen.costo_real) : formatearMoneda(orden.costo_materiales)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL: Registrar Producción Parcial - NUEVO */}
      {/* ============================================ */}
      <Modal
        isOpen={modalParcial}
        onClose={() => setModalParcial(false)}
        title={
          <span className="flex items-center gap-2">
            <Layers className="text-info" /> Registrar Producción Parcial
          </span>
        }
        size="lg"
      >
        <form onSubmit={handleRegistroParcial}>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 flex gap-3">
            <Info className="text-blue-500 shrink-0" size={20} />
            <div className="text-sm text-blue-700">
              <p><strong>Registro Parcial:</strong> Permite registrar producción sin finalizar la orden.</p>
              <p className="mt-1">Ya producidas: <strong>{parseFloat(orden.cantidad_producida || 0).toFixed(2)}</strong> de <strong>{parseFloat(orden.cantidad_planificada).toFixed(2)}</strong> {orden.unidad_medida}</p>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Cantidad a Registrar *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="form-input"
              value={cantidadParcial}
              onChange={(e) => setCantidadParcial(e.target.value)}
              required
              placeholder="0.00"
            />
            <small className="text-muted block mt-1">
              Restante: {(parseFloat(orden.cantidad_planificada) - parseFloat(orden.cantidad_producida || 0)).toFixed(2)} {orden.unidad_medida}
            </small>
          </div>

          {cantidadParcial && (
            <div className="bg-gray-50 p-3 rounded mb-3 border border-gray-200">
              <div className="text-sm">
                <span className="text-muted">Total acumulado será:</span>
                <strong className="ml-2">{(parseFloat(orden.cantidad_producida || 0) + parseFloat(cantidadParcial)).toFixed(2)} {orden.unidad_medida}</strong>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea
              className="form-textarea"
              value={observacionesParcial}
              onChange={(e) => setObservacionesParcial(e.target.value)}
              placeholder="Comentarios sobre este registro..."
              rows={2}
            />
          </div>

          {/* Ajuste de consumo real para registro parcial */}
          {tieneReceta && consumoRealInsumos.length > 0 && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Edit size={18} className="text-primary" />
                  <h3 className="font-semibold">Ajustar Consumo Real (Opcional)</h3>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setMostrarConsumoReal(!mostrarConsumoReal)}
                >
                  {mostrarConsumoReal ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              {mostrarConsumoReal && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {consumoRealInsumos.map(item => {
                    const proporcional = item.cantidad_planificada * (parseFloat(cantidadParcial || 0) / parseFloat(orden.cantidad_planificada));
                    
                    return (
                      <div key={item.id_insumo} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2 rounded text-sm">
                        <div className="col-span-4 font-medium">{item.insumo}</div>
                        <div className="col-span-3 text-center text-muted">
                          Proporcional: {proporcional.toFixed(4)} {item.unidad_medida}
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-muted">Cantidad Real:</label>
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            className="form-input form-input-sm"
                            value={item.cantidad_real}
                            onChange={(e) => actualizarCantidadReal(item.id_insumo, e.target.value)}
                            placeholder={proporcional.toFixed(4)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end mt-6">
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={() => setModalParcial(false)}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-info"
              disabled={procesando || !cantidadParcial}
            >
              {procesando ? 'Procesando...' : 'Registrar Producción Parcial'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================ */}
      {/* MODAL: Finalizar Producción CON CONSUMO REAL */}
      {/* ============================================ */}
      <Modal
        isOpen={modalFinalizar}
        onClose={() => setModalFinalizar(false)}
        title={
          <span className="flex items-center gap-2">
            <CheckCircle className="text-success" /> Finalizar Producción
          </span>
        }
        size="xl"
      >
        <form onSubmit={handleFinalizar}>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 flex gap-3">
            <Info className="text-blue-500 shrink-0" size={20} />
            <p className="text-sm text-blue-700">
              <strong>Importante:</strong> Al finalizar, los productos terminados serán agregados automáticamente al inventario.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Cantidad Producida Final *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="form-input"
              value={cantidadProducida}
              onChange={(e) => setCantidadProducida(e.target.value)}
              required
              placeholder="0.00"
            />
            <small className="text-muted block mt-1 italic">
              Planificado: {parseFloat(orden.cantidad_planificada).toFixed(2)} {orden.unidad_medida} | 
              Ya producido: {parseFloat(orden.cantidad_producida || 0).toFixed(2)} {orden.unidad_medida}
            </small>
          </div>

          {cantidadProducida && (
            <div className="bg-gray-50 p-3 rounded mb-3 border border-gray-200">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted">Lotes producidos:</span>
                  <strong className="ml-2">{Math.ceil(parseFloat(cantidadProducida) / parseFloat(orden.rendimiento_unidades || 1))}</strong>
                </div>
                <div>
                  <span className="text-muted">Cantidad restante por registrar:</span>
                  <strong className="ml-2">{(parseFloat(cantidadProducida) - parseFloat(orden.cantidad_producida || 0)).toFixed(2)} {orden.unidad_medida}</strong>
                </div>
              </div>
            </div>
          )}

          {/* NUEVO: AJUSTE DE CONSUMO REAL DE INSUMOS */}
          {tieneReceta && consumoRealInsumos.length > 0 && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Edit size={18} className="text-primary" />
                  <h3 className="font-semibold">Consumo Real de Insumos (Opcional)</h3>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setMostrarConsumoReal(!mostrarConsumoReal)}
                >
                  {mostrarConsumoReal ? 'Ocultar' : 'Ajustar Consumo Real'}
                </button>
              </div>

              {mostrarConsumoReal && (
                <div className="space-y-2 bg-blue-50 p-4 rounded">
                  <div className="bg-white border-l-4 border-blue-500 p-3 mb-3 text-sm text-blue-800">
                    <p><strong>💡 Ajuste de Costos:</strong> Edite las cantidades reales consumidas si difieren de lo planificado.</p>
                    <p className="mt-1">Los costos se recalcularán automáticamente basándose en el consumo real.</p>
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {consumoRealInsumos.map(item => {
                      const diferencia = item.cantidad_real - item.cantidad_planificada;
                      const porcentajeDif = (diferencia / item.cantidad_planificada * 100).toFixed(1);
                      
                      return (
                        <div key={item.id_insumo} className="bg-white p-3 rounded border border-gray-200">
                          <div className="grid grid-cols-12 gap-3 items-center">
                            <div className="col-span-5">
                              <div className="font-medium text-sm">{item.insumo}</div>
                              <div className="text-xs text-muted">{item.codigo_insumo}</div>
                            </div>
                            
                            <div className="col-span-2 text-center">
                              <div className="text-xs text-muted mb-1">Planificado</div>
                              <div className="font-mono text-sm">
                                {item.cantidad_planificada.toFixed(4)}
                              </div>
                              <div className="text-xs text-muted">{item.unidad_medida}</div>
                            </div>
                            
                            <div className="col-span-3">
                              <label className="text-xs text-muted block mb-1">Cantidad Real Consumida:</label>
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                className="form-input form-input-sm"
                                value={item.cantidad_real}
                                onChange={(e) => actualizarCantidadReal(item.id_insumo, e.target.value)}
                              />
                            </div>
                            
                            <div className="col-span-2 text-center">
                              {diferencia !== 0 && (
                                <div className={`badge ${diferencia > 0 ? 'badge-warning' : 'badge-success'}`}>
                                  {diferencia > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                  {diferencia > 0 ? '+' : ''}{porcentajeDif}%
                                </div>
                              )}
                              {diferencia !== 0 && (
                                <div className="text-xs text-muted mt-1">
                                  {diferencia > 0 ? '+' : ''}{diferencia.toFixed(4)} {item.unidad_medida}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Resumen de diferencias */}
                  <div className="bg-white p-4 rounded border-2 border-blue-200 mt-3">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-xs text-muted mb-1">Costo Planificado</div>
                        <div className="font-bold text-lg">{formatearMoneda(orden.costo_materiales)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-1">Costo Real Estimado</div>
                        <div className="font-bold text-lg text-primary">{formatearMoneda(calcularCostoReal())}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-1">Diferencia</div>
                        <div className={`font-bold text-lg ${calcularCostoReal() > parseFloat(orden.costo_materiales) ? 'text-warning' : 'text-success'}`}>
                          {calcularCostoReal() > parseFloat(orden.costo_materiales) ? '+' : ''}
                          {formatearMoneda(calcularCostoReal() - parseFloat(orden.costo_materiales))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form-group mt-4">
            <label className="form-label">Observaciones Finales</label>
            <textarea
              className="form-textarea"
              value={observacionesFinal}
              onChange={(e) => setObservacionesFinal(e.target.value)}
              placeholder="Explique diferencias entre lo planificado y producido, si las hay"
              rows={3}
            />
          </div>

          {/* SECCIÓN DE MERMAS */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning" />
                <h3 className="font-semibold">Registro de Mermas (Opcional)</h3>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setMostrarMermas(!mostrarMermas)}
              >
                {mostrarMermas ? 'Ocultar' : 'Agregar Mermas'}
              </button>
            </div>

            {mostrarMermas && (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                  <p className="text-yellow-800">
                    <strong>Nota:</strong> Registre aquí las mermas generadas durante la producción. 
                    Estas mermas se agregarán automáticamente al inventario.
                  </p>
                </div>

                {mermas.map((merma, index) => (
                  <div key={merma.id_temp} className="bg-gray-50 p-3 rounded border border-gray-200">
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5">
                        <label className="form-label text-xs">Tipo de Merma *</label>
                        <select
                          className="form-select form-select-sm"
                          value={merma.id_producto_merma}
                          onChange={(e) => actualizarMerma(merma.id_temp, 'id_producto_merma', e.target.value)}
                          required={mermas.length > 0}
                        >
                          <option value="">Seleccione...</option>
                          {productosMerma.map(p => (
                            <option key={p.id_producto} value={p.id_producto}>
                              {p.nombre} ({p.unidad_medida})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="form-label text-xs">Cantidad *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="form-input form-input-sm"
                          value={merma.cantidad}
                          onChange={(e) => actualizarMerma(merma.id_temp, 'cantidad', e.target.value)}
                          placeholder="0.00"
                          required={mermas.length > 0}
                        />
                      </div>

                      <div className="col-span-4">
                        <label className="form-label text-xs">Observaciones</label>
                        <input
                          type="text"
                          className="form-input form-input-sm"
                          value={merma.observaciones}
                          onChange={(e) => actualizarMerma(merma.id_temp, 'observaciones', e.target.value)}
                          placeholder="Ej: Material defectuoso"
                        />
                      </div>

                      <div className="col-span-1 flex items-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-danger w-full"
                          onClick={() => eliminarMerma(merma.id_temp)}
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn btn-sm btn-outline w-full"
                  onClick={agregarMerma}
                >
                  <Plus size={16} className="mr-1" /> Agregar Línea de Merma
                </button>

                {mermas.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-700">
                    📝 Se registrarán {mermas.filter(m => m.id_producto_merma && m.cantidad).length} merma(s)
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={() => setModalFinalizar(false)}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-success"
              disabled={procesando || !cantidadProducida}
            >
              {procesando ? 'Procesando...' : 'Finalizar Producción'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default OrdenDetalle;