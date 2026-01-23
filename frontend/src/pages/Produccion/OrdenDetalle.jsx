import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Play, Pause, CheckCircle, XCircle, 
  Package, Clock, FileText, ClipboardList, 
  BarChart, AlertTriangle, Trash2, Plus,
  Layers, TrendingUp, TrendingDown, ShoppingCart,
  UserCog, AlertCircle, Zap, Calendar as CalendarIcon, 
  Users, Clipboard, Info, Hash, Scale, PieChart
} from 'lucide-react';
import { ordenesProduccionAPI, empleadosAPI } from '../../config/api';
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
    
  const [modalAsignar, setModalAsignar] = useState(false);
  const [supervisoresDisponibles, setSupervisoresDisponibles] = useState([]);
  const [asignacionData, setAsignacionData] = useState({
      id_supervisor: '',
      turno: 'Mañana',
      maquinista: '',
      ayudante: ''
  });

  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [cantidadKilosFinal, setCantidadKilosFinal] = useState('');
  const [cantidadUnidadesFinal, setCantidadUnidadesFinal] = useState('');
  const [observacionesFinal, setObservacionesFinal] = useState('');
    
  const [modalParcial, setModalParcial] = useState(false);
  const [cantidadParcial, setCantidadParcial] = useState('');
  const [observacionesParcial, setObservacionesParcial] = useState('');
    
  const [insumosParcialesConsumo, setInsumosParcialesConsumo] = useState([]);
  const [insumosFinalesConsumo, setInsumosFinalesConsumo] = useState([]);
    
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

  const cargarSupervisores = async () => {
    try {
        const res = await empleadosAPI.getByRol('Supervisor');
        if (res.data.success) {
            setSupervisoresDisponibles(res.data.data);
        }
    } catch (err) {
        console.error("Error cargando supervisores", err);
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

  const mermasFiltradas = productosMerma.filter(merma => {
      if (!orden) return false;
      const nombreProducto = orden.producto.toUpperCase();
      const nombreMerma = merma.nombre.toUpperCase();

      if (nombreProducto.includes('BURBUPACK')) return nombreMerma.includes('BURBUPACK');
      if (nombreProducto.includes('ESQUINERO')) return nombreMerma.includes('ESQUINERO');
      if (nombreProducto.includes('ZUNCHO')) return nombreMerma.includes('ZUNCHO');
      if (nombreProducto.includes('GRAPA')) return nombreMerma.includes('GRAPA');
      
      return true;
  });

  const inicializarInsumosParaParcial = () => {
    const insumos = consumoMateriales.map(item => ({
      id_insumo: item.id_insumo,
      codigo_insumo: item.codigo_insumo,
      insumo: item.insumo,
      unidad_medida: item.unidad_medida,
      cantidad: '0'
    }));
    setInsumosParcialesConsumo(insumos);
  };

  const inicializarInsumosParaFinal = () => {
    const insumos = consumoMateriales.map(item => {
      const yaConsumido = parseFloat(item.cantidad_real_consumida || 0);
      const requerido = parseFloat(item.cantidad_requerida);
      const pendiente = Math.max(0, requerido - yaConsumido);
        
      return {
        id_insumo: item.id_insumo,
        codigo_insumo: item.codigo_insumo,
        insumo: item.insumo,
        unidad_medida: item.unidad_medida,
        cantidad_requerida: requerido,
        cantidad_ya_consumida: yaConsumido,
        cantidad_pendiente: pendiente,
        cantidad: (yaConsumido + pendiente).toFixed(4) 
      };
    });
    setInsumosFinalesConsumo(insumos);
  };

  const actualizarCantidadInsumoParcial = (id_insumo, valor) => {
    setInsumosParcialesConsumo(prev => 
      prev.map(item => 
        item.id_insumo === id_insumo 
          ? { ...item, cantidad: valor }
          : item
      )
    );
  };

  const actualizarCantidadInsumoFinal = (id_insumo, valor) => {
    setInsumosFinalesConsumo(prev => 
      prev.map(item => 
        item.id_insumo === id_insumo 
          ? { ...item, cantidad: valor }
          : item
      )
    );
  };

  const handleDescargarHojaRuta = async () => {
    try {
        setProcesando(true);
        const response = await ordenesProduccionAPI.downloadHojaRuta(id);
        
        const url = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Hoja_Ruta_${orden.numero_orden}.pdf`);
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        setProcesando(false);
    } catch (err) {
        console.error("Error descargando hoja de ruta", err);
        setError("Error al descargar la hoja de ruta");
        setProcesando(false);
    }
  };

 const handleRegistroParcial = async (e) => {
    e.preventDefault();
        
    try {
      setProcesando(true);
      setError(null);

      const insumosConCantidad = insumosParcialesConsumo.filter(i => parseFloat(i.cantidad) > 0);
        
      if (insumosParcialesConsumo.length > 0 && insumosConCantidad.length === 0) {
        setError('Debe especificar al menos un insumo con cantidad mayor a 0');
        setProcesando(false);
        return;
      }
        
      const payload = {
        cantidad_parcial: parseFloat(cantidadParcial),
        insumos_consumidos: insumosConCantidad.map(i => ({
          id_insumo: i.id_insumo,
          cantidad: parseFloat(i.cantidad)
        })),
        observaciones: observacionesParcial
      };

      const response = await ordenesProduccionAPI.registrarParcial(id, payload);
        
      if (response.data.success) {
        setSuccess(response.data.message);
        setModalParcial(false);
        setCantidadParcial('');
        setObservacionesParcial('');
        setInsumosParcialesConsumo([]);
        cargarDatos();
      }
        
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.error || 'Error al registrar producción parcial';
      setError(errorMsg);
    } finally {
      setProcesando(false);
    }
  };

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
        cantidad_kilos_final: parseFloat(cantidadKilosFinal),
        cantidad_unidades_final: parseFloat(cantidadUnidadesFinal || 0),
        insumos_reales: insumosFinalesConsumo.map(i => ({
          id_insumo: i.id_insumo,
          cantidad: parseFloat(i.cantidad)
        })),
        observaciones: observacionesFinal,
        mermas: mermasValidas.map(m => ({
          id_producto_merma: parseInt(m.id_producto_merma),
          cantidad: parseFloat(m.cantidad),
          observaciones: m.observaciones || null
        }))
      };

      const response = await ordenesProduccionAPI.finalizar(id, payload);
        
      if (response.data.success) {
        setSuccess('Producción finalizada exitosamente.');
        setModalFinalizar(false);
        setMermas([]);
        setMostrarMermas(false);
        setInsumosFinalesConsumo([]);
        cargarDatos();
      }
        
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.error || 'Error al finalizar producción';
      setError(errorMsg);
    } finally {
      setProcesando(false);
    }
  };

  const handleAsignarSupervisor = async (e) => {
    e.preventDefault();
    try {
      setProcesando(true);
      setError(null);
        
      const payload = {
        id_supervisor: parseInt(asignacionData.id_supervisor),
        turno: asignacionData.turno,
        maquinista: asignacionData.maquinista,
        ayudante: asignacionData.ayudante
      };
        
      await ordenesProduccionAPI.update(id, payload);
      setSuccess('Datos de asignación actualizados.');
      setModalAsignar(false);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al asignar supervisor');
    } finally {
      setProcesando(false);
    }
  };

  const handleIniciar = async () => {
    if (!confirm('¿Está seguro de iniciar la producción?')) return;

    try {
      setProcesando(true);
      setError(null);
      await ordenesProduccionAPI.iniciar(id);
      setSuccess('Producción iniciada exitosamente');
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

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(valor);
  };

  const formatearMoneda = (valor) => {
    const simbolo = 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    if (fecha.includes('T')) {
        return new Date(fecha).toLocaleString('es-PE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatearTiempo = (minutos) => {
    if (!minutos || minutos === 0) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}m`;
  };

  const getBadgeEstado = (estado) => {
    const badges = {
      'Pendiente Asignación': 'badge-warning',
      'Pendiente': 'badge-secondary',
      'En Curso': 'badge-primary',
      'En Pausa': 'badge-warning',
      'Finalizada': 'badge-success',
      'Cancelada': 'badge-danger'
    };
    return badges[estado] || 'badge-secondary';
  };

  const totalInsumosReales = insumosFinalesConsumo.reduce((acc, item) => acc + (parseFloat(item.cantidad) || 0), 0);
  const totalMerma = mermas.reduce((acc, m) => acc + (parseFloat(m.cantidad) || 0), 0);
  const totalKilosProd = parseFloat(cantidadKilosFinal || 0);
  const diferenciaMasa = totalInsumosReales - (totalKilosProd + totalMerma);

  const totalMasaRealConsumida = consumoMateriales.reduce((acc, item) => acc + parseFloat(item.cantidad_real_consumida || 0), 0);

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

  const puedeAsignar = orden.estado === 'Pendiente Asignación';
  const puedeIniciar = orden.estado === 'Pendiente';
  const puedePausar = orden.estado === 'En Curso';
  const puedeReanudar = orden.estado === 'En Pausa';
  const puedeFinalizar = orden.estado === 'En Curso' || orden.estado === 'En Pausa';
  const puedeCancelar = ['Pendiente Asignación', 'Pendiente', 'En Curso', 'En Pausa'].includes(orden.estado);
  const puedeRegistrarParcial = orden.estado === 'En Curso' || orden.estado === 'En Pausa';
  const desdeOrdenVenta = orden.origen_tipo === 'Orden de Venta';
  
  const esLamina = orden.producto.toUpperCase().includes('LÁMINA') || orden.producto.toUpperCase().includes('LAMINA');

  return (
    <div>
      <button className="btn btn-outline mb-4" onClick={() => navigate('/produccion/ordenes')}>
        <ArrowLeft size={20} className="mr-2" />
        Volver a Órdenes
      </button>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {desdeOrdenVenta && (
        <div className="card border-l-4 border-info bg-blue-50 mb-4">
          <div className="card-body py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart size={24} className="text-info" />
                <div>
                  <p className="font-medium text-blue-900 flex items-center gap-2">
                    Orden de Venta: {orden.numero_orden_venta || 'N/A'}
                  </p>
                  <p className="text-sm text-blue-700">
                    Cliente a la espera de producción
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 text-sm">
                 {orden.prioridad_venta && (
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-blue-600 uppercase font-semibold">Prioridad</span>
                      <span className={`badge ${
                        orden.prioridad_venta === 'Alta' ? 'badge-error' : 
                        orden.prioridad_venta === 'Media' ? 'badge-warning' : 'badge-success'
                      }`}>
                        {orden.prioridad_venta}
                      </span>
                    </div>
                 )}
                 
                 {orden.fecha_estimada_venta && (
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-blue-600 uppercase font-semibold">Fecha Prometida</span>
                      <span className="font-bold text-blue-900">
                        {formatearFecha(orden.fecha_estimada_venta)}
                      </span>
                    </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="card-title text-2xl font-bold">Orden de Producción: {orden.numero_orden}</h1>
          <div className="flex gap-2 items-center mt-2">
            <span className={`badge ${getBadgeEstado(orden.estado)}`}>{orden.estado}</span>
            {desdeOrdenVenta ? (
              <span className="badge badge-info flex items-center gap-1">
                <ShoppingCart size={14} /> Desde Orden Venta
              </span>
            ) : (
              <span className="badge badge-secondary flex items-center gap-1">
                <UserCog size={14} /> Creada por Supervisor
              </span>
            )}
            {orden.es_manual === 1 && (
              <span className="badge badge-warning flex items-center gap-1">
                <Zap size={14} /> Manual
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            className="btn btn-outline" 
            onClick={handleDescargarHojaRuta}
            disabled={procesando}
            title="Descargar Hoja de Ruta para Operario"
          >
            <Clipboard size={18} className="mr-2" /> Hoja de Ruta
          </button>

          {puedeAsignar && (
            <button 
              className="btn btn-warning" 
              onClick={() => {
                cargarSupervisores();
                setModalAsignar(true);
              }}
              disabled={procesando}
            >
              <AlertCircle size={18} className="mr-2" /> Asignar Personal
            </button>
          )}
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
          {puedeRegistrarParcial && (
            <button 
              className="btn btn-info" 
              onClick={() => {
                const cantidadRestante = parseFloat(orden.cantidad_planificada) - parseFloat(orden.cantidad_producida || 0);
                setCantidadParcial(cantidadRestante > 0 ? cantidadRestante.toFixed(2) : '');
                setObservacionesParcial('');
                inicializarInsumosParaParcial();
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
                const cantidadRestante = parseFloat(orden.cantidad_planificada) - parseFloat(orden.cantidad_producida || 0);
                setCantidadKilosFinal(cantidadRestante > 0 ? cantidadRestante.toFixed(2) : '');
                setObservacionesFinal('');
                setMermas([]);
                setMostrarMermas(false);
                inicializarInsumosParaFinal();
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
              <p>{orden.supervisor || '-'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <p className="text-xs text-muted uppercase font-semibold">Turno</p>
                    <p>{orden.turno || '-'}</p>
                </div>
                <div>
                    <p className="text-xs text-muted uppercase font-semibold">Maquinista</p>
                    <p>{orden.maquinista || '-'}</p>
                </div>
                {orden.ayudante && (
                    <div className="col-span-2">
                        <p className="text-xs text-muted uppercase font-semibold">Ayudante</p>
                        <p>{orden.ayudante}</p>
                    </div>
                )}
            </div>
            
            {esLamina && (
                <div className="grid grid-cols-2 gap-2 mt-2 bg-blue-50 p-2 rounded border border-blue-100">
                    <div>
                        <p className="text-xs text-blue-800 uppercase font-semibold">Corte</p>
                        <p className="text-sm">{orden.operario_corte || '-'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-blue-800 uppercase font-semibold">Embalaje</p>
                        <p className="text-sm">{orden.operario_embalaje || '-'}</p>
                    </div>
                </div>
            )}

            {desdeOrdenVenta && orden.numero_orden_venta && (
              <div>
                <p className="text-xs text-muted uppercase font-semibold">Orden de Venta</p>
                <p className="font-mono text-info">{orden.numero_orden_venta}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center gap-2">
            <BarChart size={18} className="text-gray-500" />
            <h2 className="card-title">Producción</h2>
          </div>
          <div className="p-4 grid gap-3">
            <div className="grid grid-cols-2 gap-2 pb-2 border-b border-gray-100">
                <div>
                    <p className="text-xs text-muted uppercase font-semibold">Meta Unidades</p>
                    <p className="font-bold text-lg text-blue-600">
                        {orden.cantidad_unidades ? parseInt(orden.cantidad_unidades) : '-'} <span className="text-xs font-normal text-muted">uds</span>
                    </p>
                </div>
                <div>
                    <p className="text-xs text-muted uppercase font-semibold">Meta Kilos</p>
                    <p className="font-bold text-lg">
                        {parseFloat(orden.cantidad_planificada).toFixed(2)} <span className="text-xs font-normal text-muted">Kg</span>
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <p className="text-xs text-muted uppercase font-semibold">Real Unidades</p>
                    <p className={`font-bold text-lg ${orden.cantidad_unidades_producida > 0 ? 'text-success' : 'text-gray-400'}`}>
                        {orden.cantidad_unidades_producida ? parseInt(orden.cantidad_unidades_producida) : '0'} <span className="text-xs font-normal text-muted">uds</span>
                    </p>
                </div>
                <div>
                    <p className="text-xs text-muted uppercase font-semibold">Real Kilos</p>
                    <p className={`font-bold text-lg ${orden.cantidad_producida > 0 ? 'text-success' : 'text-gray-400'}`}>
                        {parseFloat(orden.cantidad_producida || 0).toFixed(2)} <span className="text-xs font-normal text-muted">Kg</span>
                    </p>
                </div>
            </div>
            <div className="pt-1">
              <p className="text-xs text-muted uppercase font-semibold">Eficiencia (Kilos)</p>
              <div className="flex items-center gap-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-blue-600 h-2.5 rounded-full" 
                           style={{ width: `${Math.min(100, (parseFloat(orden.cantidad_producida || 0) / parseFloat(orden.cantidad_planificada)) * 100)}%` }}></div>
                  </div>
                  <span className="text-xs font-bold">
                    {orden.cantidad_producida > 0 
                      ? `${((parseFloat(orden.cantidad_producida) / parseFloat(orden.cantidad_planificada)) * 100).toFixed(1)}%`
                      : '0%'}
                  </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Clock size={18} className="text-gray-500" />
            <h2 className="card-title">Tiempos y Costos</h2>
          </div>
          <div className="p-4 grid gap-3">
            <div className="bg-blue-50 p-2 rounded border border-blue-100">
                <p className="text-xs text-blue-700 uppercase font-semibold flex items-center gap-1">
                    <CalendarIcon size={12}/> Programación
                </p>
                {orden.fecha_programada ? (
                    <div>
                        <p className="text-sm font-medium text-blue-900">
                            {formatearFecha(orden.fecha_programada)}
                            {orden.fecha_programada_fin && orden.fecha_programada_fin !== orden.fecha_programada && (
                                <> al {formatearFecha(orden.fecha_programada_fin)}</>
                            )}
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 italic">No programada</p>
                )}
            </div>

            <div>
              <p className="text-xs text-muted uppercase font-semibold">Ejecución (Inicio / Fin)</p>
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
            </div>
          </div>
        </div>
      </div>

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
                  <th className="text-center">Cant. Productos</th>
                  <th className="text-right">Peso (Kg)</th>
                  <th>Registrado Por</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {registrosParciales.map(registro => (
                  <tr key={registro.id_registro}>
                    <td>{formatearFecha(registro.fecha_registro)}</td>
                    <td className="text-center font-bold text-blue-600">
                        {registro.cantidad_unidades_registrada ? parseInt(registro.cantidad_unidades_registrada) : '-'}
                    </td>
                    <td className="text-right font-bold">
                      {parseFloat(registro.cantidad_registrada).toFixed(2)} Kg
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
                  <th className="text-right">Estimado (Plan)</th>
                  <th className="text-right">Real Consumido</th>
                  <th className="text-center">Avance</th>
                  <th className="text-center">% Mezcla Real</th>
                  {analisisConsumo && <th className="text-right">Diferencia</th>}
                  <th className="text-right">Costo Unit.</th>
                  <th className="text-right">Costo Total</th>
                </tr>
              </thead>
              <tbody>
                {consumoMateriales.map((item, idx) => {
                  const analisisItem = analisisConsumo?.detalle.find(a => a.id_insumo === item.id_insumo);
                  const diferencia = analisisItem ? parseFloat(analisisItem.diferencia) : 0;
                  const plan = parseFloat(item.cantidad_requerida);
                  const real = parseFloat(item.cantidad_real_consumida || 0);
                  const porcentajeAvance = plan > 0 ? Math.min(100, (real / plan) * 100) : 0;
                  const porcentajeMezcla = totalMasaRealConsumida > 0 ? (real / totalMasaRealConsumida) * 100 : 0;
                    
                  return (
                    <tr key={item.id_consumo}>
                      <td className="font-mono text-xs">{item.codigo_insumo}</td>
                      <td className="font-medium">{item.insumo}</td>
                      <td className="text-right text-muted">
                        {plan.toFixed(4)} <span className="text-xs">{item.unidad_medida}</span>
                      </td>
                      <td className="text-right font-bold">
                         {real.toFixed(4)} <span className="text-xs text-muted">{item.unidad_medida}</span>
                      </td>
                      <td className="text-center" style={{ width: '120px' }}>
                         <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div className={`h-1.5 rounded-full ${porcentajeAvance > 100 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, porcentajeAvance)}%` }}></div>
                         </div>
                         <span className="text-xs text-muted">{porcentajeAvance.toFixed(0)}%</span>
                      </td>
                      <td className="text-center text-xs font-medium text-blue-600">
                         {porcentajeMezcla.toFixed(2)}%
                      </td>
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
                        {formatearMoneda(analisisItem ? analisisItem.costo_real : (real * parseFloat(item.costo_unitario)))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={analisisConsumo ? 8 : 7} className="text-right">
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
        
      <Modal
        isOpen={modalAsignar}
        onClose={() => setModalAsignar(false)}
        title={
          <span className="flex items-center gap-2">
            <Users className="text-warning" /> Asignar Personal
          </span>
        }
        size="md"
      >
        <form onSubmit={handleAsignarSupervisor}>
          <div className="space-y-4">
            <div className="form-group">
                <label className="form-label">Supervisor *</label>
                <select
                    className="form-select"
                    value={asignacionData.id_supervisor}
                    onChange={(e) => setAsignacionData({...asignacionData, id_supervisor: e.target.value})}
                    required
                >
                    <option value="">Seleccione...</option>
                    {supervisoresDisponibles.map(sup => (
                        <option key={sup.id_empleado} value={sup.id_empleado}>{sup.nombre_completo}</option>
                    ))}
                </select>
            </div>
            
            <div className="form-group">
                <label className="form-label">Turno</label>
                <select
                    className="form-select"
                    value={asignacionData.turno}
                    onChange={(e) => setAsignacionData({...asignacionData, turno: e.target.value})}
                >
                    <option value="Mañana">Mañana</option>
                    <option value="Noche">Noche</option>
                </select>
            </div>

            <div className="form-group">
                <label className="form-label">Maquinista</label>
                <input 
                    className="form-input" 
                    value={asignacionData.maquinista}
                    onChange={(e) => setAsignacionData({...asignacionData, maquinista: e.target.value})}
                    placeholder="Nombre del maquinista"
                />
            </div>

            <div className="form-group">
                <label className="form-label">Ayudante</label>
                <input 
                    className="form-input" 
                    value={asignacionData.ayudante}
                    onChange={(e) => setAsignacionData({...asignacionData, ayudante: e.target.value})}
                    placeholder="Nombre del ayudante"
                />
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={() => setModalAsignar(false)}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-warning"
              disabled={procesando || !asignacionData.id_supervisor}
            >
              {procesando ? 'Procesando...' : 'Guardar Asignación'}
            </button>
          </div>
        </form>
      </Modal>

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
              <p className="mt-1">Ya producidas: <strong>{parseFloat(orden.cantidad_producida || 0).toFixed(2)}</strong> de <strong>{parseFloat(orden.cantidad_planificada).toFixed(2)}</strong> Kg</p>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Cantidad a Registrar (Kg) *</label>
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
              Restante: {(parseFloat(orden.cantidad_planificada) - parseFloat(orden.cantidad_producida || 0)).toFixed(2)} Kg
            </small>
          </div>

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

          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Package size={18} className="text-primary" />
              <h3 className="font-semibold">Consumo de Insumos *</h3>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {insumosParcialesConsumo.map(item => (
                <div key={item.id_insumo} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-3 rounded border">
                  <div className="col-span-6">
                    <div className="font-medium text-sm">{item.insumo}</div>
                    <div className="text-xs text-muted">{item.codigo_insumo}</div>
                  </div>
                    
                  <div className="col-span-3">
                    <label className="text-xs text-muted block mb-1">Cantidad Consumida:</label>
                  </div>
                    
                  <div className="col-span-3">
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      className="form-input form-input-sm"
                      value={item.cantidad}
                      onChange={(e) => actualizarCantidadInsumoParcial(item.id_insumo, e.target.value)}
                      placeholder="0.0000"
                      required
                    />
                    <div className="text-xs text-muted mt-1">{item.unidad_medida}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
            <div className="text-sm text-blue-700">
              <p><strong>Cierre de Orden:</strong> Ingrese los valores reales obtenidos al finalizar el turno.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="form-group">
                <label className="form-label">Total Kilos Producidos (Real) *</label>
                <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input pl-8"
                      value={cantidadKilosFinal}
                      onChange={(e) => setCantidadKilosFinal(e.target.value)}
                      required
                      placeholder="0.00"
                    />
                    <Scale className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Total Unidades Producidas (Real)</label>
                <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      className="form-input pl-8"
                      value={cantidadUnidadesFinal}
                      onChange={(e) => setCantidadUnidadesFinal(e.target.value)}
                      placeholder="0"
                    />
                    <Hash className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                </div>
              </div>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Package size={18} className="text-primary" />
              <h3 className="font-semibold">Consumo Final de Insumos (Real)</h3>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {insumosFinalesConsumo.map(item => (
                <div key={item.id_insumo} className="bg-gray-50 p-2 rounded border flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.insumo}</div>
                      <div className="text-xs text-muted">Planificado: {item.cantidad_requerida.toFixed(2)} {item.unidad_medida}</div>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        className="form-input form-input-sm text-right"
                        value={item.cantidad}
                        onChange={(e) => actualizarCantidadInsumoFinal(item.id_insumo, e.target.value)}
                        required
                      />
                    </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4 bg-gray-50 p-4 rounded mb-4">
            <h3 className="font-semibold text-sm mb-3">Balance de Masas</h3>
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div className="p-2 bg-white rounded border">
                    <div className="text-muted text-xs">Total Insumos</div>
                    <div className="font-bold">{totalInsumosReales.toFixed(2)} Kg</div>
                </div>
                <div className="p-2 bg-white rounded border border-blue-200">
                    <div className="text-blue-600 text-xs">(-) Prod. Terminado</div>
                    <div className="font-bold">{totalKilosProd.toFixed(2)} Kg</div>
                </div>
                <div className="p-2 bg-white rounded border border-red-200">
                    <div className="text-red-600 text-xs">(-) Mermas</div>
                    <div className="font-bold">{totalMerma.toFixed(2)} Kg</div>
                </div>
                <div className={`p-2 rounded border ${Math.abs(diferenciaMasa) < 0.1 ? 'bg-green-100 border-green-300' : 'bg-yellow-100 border-yellow-300'}`}>
                    <div className="text-xs font-bold">Diferencia</div>
                    <div className="font-bold">{diferenciaMasa.toFixed(2)} Kg</div>
                </div>
            </div>
            {Math.abs(diferenciaMasa) > 1 && (
                <p className="text-xs text-warning mt-2 flex items-center gap-1">
                    <AlertTriangle size={12}/> La diferencia de peso es considerable. Verifique los datos.
                </p>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning" />
                <h3 className="font-semibold">Registro de Mermas</h3>
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
                {mermas.map((merma) => (
                  <div key={merma.id_temp} className="bg-gray-50 p-3 rounded border border-gray-200">
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5">
                        <label className="form-label text-xs">Tipo de Merma</label>
                        <select
                          className="form-select form-select-sm"
                          value={merma.id_producto_merma}
                          onChange={(e) => actualizarMerma(merma.id_temp, 'id_producto_merma', e.target.value)}
                          required={mermas.length > 0}
                        >
                          <option value="">Seleccione...</option>
                          {mermasFiltradas.map(p => (
                            <option key={p.id_producto} value={p.id_producto}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="form-label text-xs">Cantidad (Kg)</label>
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

                      <div className="col-span-3">
                         <label className="form-label text-xs">Observación</label>
                         <input
                          type="text"
                          className="form-input form-input-sm"
                          value={merma.observaciones}
                          onChange={(e) => actualizarMerma(merma.id_temp, 'observaciones', e.target.value)}
                        />
                      </div>

                      <div className="col-span-1 flex items-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-danger w-full"
                          onClick={() => eliminarMerma(merma.id_temp)}
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
              disabled={procesando || !cantidadKilosFinal}
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