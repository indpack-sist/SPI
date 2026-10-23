import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, CheckCircle, XCircle,
  Package, Clock, FileText, ClipboardList,
  BarChart, AlertTriangle, Trash2, Plus,
  Layers, TrendingUp, TrendingDown, ShoppingCart,
  UserCog, AlertCircle, Zap, Calendar as CalendarIcon,
  Users, Clipboard, Info, Hash, Scale, Ruler, Star, Edit, History, ShieldCheck,
  Paperclip, Image, Download, Eye, X, Factory
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ordenesProduccionAPI, empleadosAPI, productosAPI } from '../../config/api';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import ModalNuevaIncidencia from '../Calidad/ModalNuevaIncidencia';
import { BadgeEstadoProduccion, BadgePrioridad } from './estadosProduccion';
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

const fmtUnid = (valor) => String(parseFloat(parseFloat(valor || 0).toFixed(2)));

function OrdenDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const userRole = user?.rol || '';
  const esComercial = ['comercial', 'ventas', 'vendedor'].includes(userRole.toLowerCase());
  
  const [orden, setOrden] = useState(null);
  const [consumoMateriales, setConsumoMateriales] = useState([]);
  const [registrosParciales, setRegistrosParciales] = useState([]);
  const [analisisConsumo, setAnalisisConsumo] = useState(null);
  const [insumosDisponibles, setInsumosDisponibles] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [procesando, setProcesando] = useState(false);
    
  const [modalAsignar, setModalAsignar] = useState(false);
  const [supervisoresDisponibles, setSupervisoresDisponibles] = useState([]);
  const [asignacionData, setAsignacionData] = useState({
      id_supervisor: '',
      turno: 'Día',
      maquinista: '',
      ayudante: '',
      operario_corte: '',
      operario_embalaje: '',
      medida: '',
      peso_producto: '',
      gramaje: ''
  });

  const [modoReceta, setModoReceta] = useState('porcentaje');
  const [listaInsumos, setListaInsumos] = useState([]);
  const [modalAgregarInsumo, setModalAgregarInsumo] = useState(false);
  const [nuevoInsumo, setNuevoInsumo] = useState({ id_insumo: '', porcentaje: '' });

  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [cantidadUnidadesFinal, setCantidadUnidadesFinal] = useState('');
  const [observacionesFinal, setObservacionesFinal] = useState('');
  const [totalRealInsumos, setTotalRealInsumos] = useState('');
    
  const [modalParcial, setModalParcial] = useState(false);
  const [cantidadUnidadesParcial, setCantidadUnidadesParcial] = useState('');
  const [observacionesParcial, setObservacionesParcial] = useState('');
    
  const [insumosParcialesConsumo, setInsumosParcialesConsumo] = useState([]);
  const [insumosFinalesConsumo, setInsumosFinalesConsumo] = useState([]);
    
  const [productosMerma, setProductosMerma] = useState([]);
  const [mermas, setMermas] = useState([]);
  const [mostrarMermas, setMostrarMermas] = useState(false);

  const [modalAgregarInsumoParcial, setModalAgregarInsumoParcial] = useState(false);
  const [nuevoInsumoParcial, setNuevoInsumoParcial] = useState({ id_insumo: '', cantidad: '' });

  const [modalAgregarInsumoFinal, setModalAgregarInsumoFinal] = useState(false);
  const [nuevoInsumoFinal, setNuevoInsumoFinal] = useState({ id_insumo: '', cantidad: '' });

  const [modalEditar, setModalEditar] = useState(false);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [datosEdicion, setDatosEdicion] = useState({
    id_producto_terminado: '',
    cantidad_planificada: '',
    cantidad_unidades: '',
    id_supervisor: '',
    turno: 'Día',
    maquinista: '',
    ayudante: '',
    operario_corte: '',
    operario_embalaje: '',
    medida: '',
    peso_producto: '',
    gramaje: '',
    fecha_programada: '',
    fecha_programada_fin: '',
    observaciones: ''
  });
  const [insumosEdicion, setInsumosEdicion] = useState([]);
  const [modoRecetaEdicion, setModoRecetaEdicion] = useState('porcentaje');
  const [modalAgregarInsumoEdicion, setModalAgregarInsumoEdicion] = useState(false);
  const [nuevoInsumoEdicion, setNuevoInsumoEdicion] = useState({ id_insumo: '', porcentaje: '' });

  const [modalAnular, setModalAnular] = useState(false);

  const [adjuntos, setAdjuntos] = useState([]);
  const [subiendoAdjunto, setSubiendoAdjunto] = useState(false);
  const [adjuntoVisor, setAdjuntoVisor] = useState(null);

  const [finalizarVieneDeParcial, setFinalizarVieneDeParcial] = useState(false);

  const puedeSubirAdjunto = ['Supervisor', 'Calidad', 'Administrador', 'Jefe de Planta', 'Jefe de Producción'].includes(userRole);
  const puedeRegistrarIncidencia = ['Supervisor', 'Calidad', 'Administrador', 'Produccion', 'Jefe de Planta', 'Jefe de Producción'].includes(userRole);

  const [modalIncidencia, setModalIncidencia] = useState(false);
  const [modalCalidad, setModalCalidad] = useState(false);
  const [resultadoCalidad, setResultadoCalidad] = useState('');
  const [observacionCalidad, setObservacionCalidad] = useState('');

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
        
      const [ordenRes, consumoRes, registrosRes, insumosRes, adjuntosRes] = await Promise.all([
        ordenesProduccionAPI.getById(id),
        ordenesProduccionAPI.getConsumoMateriales(id),
        ordenesProduccionAPI.getRegistrosParciales(id).catch(() => ({ data: { data: [] } })),
        productosAPI.getAll({ estado: 'Activo', requiere_receta: 'false' }).catch(() => ({ data: { data: [] } })),
        ordenesProduccionAPI.getAdjuntos(id).catch(() => ({ data: { adjuntos: [] } }))
      ]);

      setOrden(ordenRes.data.data);
      setConsumoMateriales(consumoRes.data.data);
      setRegistrosParciales(registrosRes.data.data || []);
      setInsumosDisponibles(insumosRes.data.data || []);
      setAdjuntos(adjuntosRes.data.adjuntos || []);
        
      if (ordenRes.data.data.estado === 'Finalizada') {
        const analisisRes = await ordenesProduccionAPI.getAnalisisConsumo(id);
        setAnalisisConsumo(analisisRes.data.data);
      }

      const esLaminaTemp = ordenRes.data.data.producto.toUpperCase().includes('LÁMINA') || ordenRes.data.data.producto.toUpperCase().includes('LAMINA');
      
      setAsignacionData({
        id_supervisor: ordenRes.data.data.id_supervisor || '',
        turno: ordenRes.data.data.turno || 'Día',
        maquinista: ordenRes.data.data.maquinista || '',
        ayudante: ordenRes.data.data.ayudante || '',
        operario_corte: ordenRes.data.data.operario_corte || '',
        operario_embalaje: ordenRes.data.data.operario_embalaje || '',
        medida: ordenRes.data.data.medida || '',
        peso_producto: ordenRes.data.data.peso_producto || '',
        gramaje: ordenRes.data.data.gramaje || ''
      });

      if (esLaminaTemp) {
        setModoReceta('manual');
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

  const cargarProductos = async () => {
    try {
      const res = await productosAPI.getAll({ estado: 'Activo', id_tipo_inventario: 3 });
      if (res.data.success) {
        setProductosDisponibles(res.data.data);
      }
    } catch (err) {
      console.error("Error cargando productos", err);
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

  const handleSubirAdjunto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setSubiendoAdjunto(true);
      const formData = new FormData();
      formData.append('archivo', file);
      const res = await ordenesProduccionAPI.subirAdjunto(id, formData);
      if (res.data.success) {
        setAdjuntos(prev => [res.data.adjunto, ...prev]);
        setSuccess('Adjunto subido correctamente.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir el adjunto.');
    } finally {
      setSubiendoAdjunto(false);
      e.target.value = '';
    }
  };

  const handleEliminarAdjunto = async (idAdjunto) => {
    if (!window.confirm('¿Eliminar este adjunto?')) return;
    try {
      await ordenesProduccionAPI.eliminarAdjunto(idAdjunto);
      setAdjuntos(prev => prev.filter(a => a.id_adjunto !== idAdjunto));
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar el adjunto.');
    }
  };

  const inicializarEdicion = async () => {
    await cargarSupervisores();
    await cargarProductos();

    const esLaminaEdit = orden.producto.toUpperCase().includes('LÁMINA') || orden.producto.toUpperCase().includes('LAMINA');

    setDatosEdicion({
      id_producto_terminado: orden.id_producto_terminado || '',
      cantidad_planificada: orden.cantidad_planificada || '',
      cantidad_unidades: orden.cantidad_unidades || '',
      id_supervisor: orden.id_supervisor || '',
      turno: orden.turno || 'Día',
      maquinista: orden.maquinista || '',
      ayudante: orden.ayudante || '',
      operario_corte: orden.operario_corte || '',
      operario_embalaje: orden.operario_embalaje || '',
      medida: orden.medida || '',
      peso_producto: orden.peso_producto || '',
      gramaje: orden.gramaje || '',
      fecha_programada: orden.fecha_programada || '',
      fecha_programada_fin: orden.fecha_programada_fin || '',
      observaciones: orden.observaciones || ''
    });

    if (esLaminaEdit || orden.es_orden_manual === 1) {
      setModoRecetaEdicion('manual');
      setInsumosEdicion([]);
    } else {
      setModoRecetaEdicion('porcentaje');

      if (consumoMateriales && consumoMateriales.length > 0) {
        const insumosActuales = consumoMateriales.map(item => {
          const porcentaje = parseFloat(orden.cantidad_planificada) > 0
            ? (parseFloat(item.cantidad_requerida) / parseFloat(orden.cantidad_planificada)) * 100
            : 0;

          return {
            id_insumo: item.id_insumo,
            porcentaje: parseFloat(porcentaje.toFixed(2)),
            insumo: item.insumo,
            codigo_insumo: item.codigo_insumo,
            unidad_medida: item.unidad_medida,
            costo_unitario: parseFloat(item.costo_unitario),
            stock_actual: 0
          };
        });
        setInsumosEdicion(insumosActuales);
      } else {
        setInsumosEdicion([]);
      }
    }

    setModalEditar(true);
  };

  const agregarInsumoEdicion = () => {
    if (!nuevoInsumoEdicion.id_insumo || !nuevoInsumoEdicion.porcentaje) {
      setError('Complete todos los campos del insumo');
      return;
    }

    const insumo = insumosDisponibles.find(i => i.id_producto == nuevoInsumoEdicion.id_insumo);
    if (!insumo) return;

    if (insumosEdicion.find(i => i.id_insumo == nuevoInsumoEdicion.id_insumo)) {
      setError('Este insumo ya está en la lista');
      return;
    }

    setInsumosEdicion([
      ...insumosEdicion,
      {
        id_insumo: nuevoInsumoEdicion.id_insumo,
        porcentaje: parseFloat(nuevoInsumoEdicion.porcentaje),
        insumo: insumo.nombre,
        codigo_insumo: insumo.codigo,
        unidad_medida: insumo.unidad_medida,
        costo_unitario: parseFloat(insumo.costo_unitario_promedio),
        stock_actual: parseFloat(insumo.stock_actual)
      }
    ]);

    setModalAgregarInsumoEdicion(false);
    setNuevoInsumoEdicion({ id_insumo: '', porcentaje: '' });
  };

  const eliminarInsumoEdicion = (idInsumo) => {
    setInsumosEdicion(insumosEdicion.filter(i => i.id_insumo != idInsumo));
  };

  const calcularCantidadInsumoEdicion = (porcentaje) => {
    const total = parseFloat(datosEdicion.cantidad_planificada) || 0;
    return (total * parseFloat(porcentaje)) / 100;
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();

    try {
      setProcesando(true);
      setError(null);

      if (modoRecetaEdicion === 'porcentaje' && insumosEdicion.length > 0) {
        const totalPorcentaje = insumosEdicion.reduce((acc, curr) => acc + curr.porcentaje, 0);
        if (Math.abs(totalPorcentaje - 100) > 0.01) {
          setError(`La suma de los porcentajes es ${totalPorcentaje.toFixed(2)}%. Debe ser exactamente 100%`);
          setProcesando(false);
          return;
        }
      }

      const payload = {
        id_producto_terminado: parseInt(datosEdicion.id_producto_terminado),
        cantidad_planificada: parseFloat(datosEdicion.cantidad_planificada),
        cantidad_unidades: parseFloat(datosEdicion.cantidad_unidades || 0),
        id_supervisor: datosEdicion.id_supervisor ? parseInt(datosEdicion.id_supervisor) : null,
        turno: datosEdicion.turno,
        maquinista: datosEdicion.maquinista || null,
        ayudante: datosEdicion.ayudante || null,
        operario_corte: datosEdicion.operario_corte || null,
        operario_embalaje: datosEdicion.operario_embalaje || null,
        medida: datosEdicion.medida || null,
        peso_producto: datosEdicion.peso_producto || null,
        gramaje: datosEdicion.gramaje || null,
        fecha_programada: datosEdicion.fecha_programada || null,
        fecha_programada_fin: datosEdicion.fecha_programada_fin || null,
        observaciones: datosEdicion.observaciones || null,
        modo_receta: modoRecetaEdicion
      };

      if (modoRecetaEdicion === 'porcentaje' && insumosEdicion.length > 0) {
        payload.insumos = insumosEdicion.map(i => ({
          id_insumo: i.id_insumo,
          porcentaje: i.porcentaje
        }));
      }

      await ordenesProduccionAPI.editarCompleta(id, payload);
      setSuccess('Orden actualizada exitosamente');
      setModalEditar(false);
      setInsumosEdicion([]);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar orden');
    } finally {
      setProcesando(false);
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

  const insumosFiltradosParaMostrar = insumosDisponibles.filter(insumo => {
    if (!orden) return insumo.id_tipo_inventario === 2;

    const nombreProd = orden.producto.toUpperCase();
    const nombreInsumo = insumo.nombre.toUpperCase();

    if (nombreProd.includes('LÁMINA') || nombreProd.includes('LAMINA')) {
        if (!nombreInsumo.includes('ROLLO BURBUPACK')) return false;
        return rolloCoincideConLamina(nombreProd, nombreInsumo);
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

  const inicializarInsumosParaParcial = () => {
    const insumos = consumoMateriales.map(item => ({
      id_insumo: item.id_insumo,
      codigo_insumo: item.codigo_insumo,
      insumo: item.insumo,
      unidad_medida: item.unidad_medida,
      cantidad_ya_consumida: parseFloat(item.cantidad_real_consumida || 0),
      cantidad: '0'
    }));
    setInsumosParcialesConsumo(insumos);
  };

  const inicializarInsumosParaFinal = () => {
    const insumos = consumoMateriales.map(item => {
      const yaConsumido = parseFloat(item.cantidad_real_consumida || 0);
      const requerido = parseFloat(item.cantidad_requerida);
        
      return {
        id_insumo: item.id_insumo,
        codigo_insumo: item.codigo_insumo,
        insumo: item.insumo,
        unidad_medida: item.unidad_medida,
        cantidad_requerida: requerido,
        cantidad_ya_consumida: yaConsumido,
        cantidad: '', 
        es_nuevo: false 
      };
    });
    setInsumosFinalesConsumo(insumos);
  };

  const agregarInsumoParcialNuevo = () => {
    if (!nuevoInsumoParcial.id_insumo || !nuevoInsumoParcial.cantidad) {
      setError('Complete todos los campos del insumo');
      return;
    }

    const insumo = insumosDisponibles.find(i => i.id_producto == nuevoInsumoParcial.id_insumo);
    if (!insumo) return;

    if (insumosParcialesConsumo.find(i => i.id_insumo == nuevoInsumoParcial.id_insumo)) {
      setError('Este insumo ya está en la lista');
      return;
    }

    const esRollo = insumo.nombre.toUpperCase().includes('ROLLO BURBUPACK');

    setInsumosParcialesConsumo([
      ...insumosParcialesConsumo,
      {
        id_insumo: nuevoInsumoParcial.id_insumo,
        codigo_insumo: insumo.codigo,
        insumo: insumo.nombre,
        unidad_medida: esRollo ? 'Und' : insumo.unidad_medida,
        cantidad_ya_consumida: 0,
        cantidad: nuevoInsumoParcial.cantidad,
        es_nuevo: true
      }
    ]);

    setModalAgregarInsumoParcial(false);
    setNuevoInsumoParcial({ id_insumo: '', cantidad: '' });
  };

  const eliminarInsumoParcial = (idInsumo) => {
    setInsumosParcialesConsumo(insumosParcialesConsumo.filter(i => i.id_insumo != idInsumo));
  };

  const agregarInsumoFinalNuevo = () => {
    if (!nuevoInsumoFinal.id_insumo || !nuevoInsumoFinal.cantidad) {
      setError('Complete todos los campos del insumo');
      return;
    }

    const insumo = insumosDisponibles.find(i => i.id_producto == nuevoInsumoFinal.id_insumo);
    if (!insumo) return;

    if (insumosFinalesConsumo.find(i => i.id_insumo == nuevoInsumoFinal.id_insumo)) {
      setError('Este insumo ya está en la lista');
      return;
    }

    const esRollo = insumo.nombre.toUpperCase().includes('ROLLO BURBUPACK');

    setInsumosFinalesConsumo([
      ...insumosFinalesConsumo,
      {
        id_insumo: nuevoInsumoFinal.id_insumo,
        codigo_insumo: insumo.codigo,
        insumo: insumo.nombre,
        unidad_medida: esRollo ? 'Und' : insumo.unidad_medida,
        cantidad_requerida: 0,
        cantidad_ya_consumida: 0,
        cantidad: nuevoInsumoFinal.cantidad,
        es_nuevo: true
      }
    ]);

    setModalAgregarInsumoFinal(false);
    setNuevoInsumoFinal({ id_insumo: '', cantidad: '' });
  };

  const eliminarInsumoFinal = (idInsumo) => {
    setInsumosFinalesConsumo(insumosFinalesConsumo.filter(i => i.id_insumo != idInsumo));
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

  const distribuirTotalRealPorPorcentaje = () => {
    const total = parseFloat(totalRealInsumos);
    if (!total || total <= 0) {
      setError('Ingrese un total de insumos reales válido (mayor a 0).');
      return;
    }

    const sumaRequerida = insumosFinalesConsumo.reduce(
      (acc, item) => acc + (parseFloat(item.cantidad_requerida) || 0),
      0
    );

    if (sumaRequerida <= 0) {
      setError('No hay porcentajes de receta definidos para repartir el total.');
      return;
    }

    setInsumosFinalesConsumo(prev =>
      prev.map(item => {
        const requerido = parseFloat(item.cantidad_requerida) || 0;
        const porcentaje = requerido / sumaRequerida;
        const objetivoTotal = total * porcentaje;
        const yaConsumido = parseFloat(item.cantidad_ya_consumida) || 0;
        const adicional = Math.max(0, objetivoTotal - yaConsumido);
        return { ...item, cantidad: parseFloat(adicional.toFixed(4)).toString() };
      })
    );
    setError(null);
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

  const calcularCantidadInsumo = (porcentaje) => {
      const total = parseFloat(orden?.cantidad_planificada) || 0;
      return (total * parseFloat(porcentaje)) / 100;
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

  const handleDescargarPDF = async () => {
    try {
        setProcesando(true);
        await ordenesProduccionAPI.generarPDF(id);
        setProcesando(false);
    } catch (err) {
        console.error("Error descargando PDF de la orden", err);
        setError("Error al descargar el PDF de la orden");
        setProcesando(false);
    }
  };

  const pasarParcialAFinalizar = () => {
    const reqMap = {};
    consumoMateriales.forEach(item => {
      reqMap[item.id_insumo] = parseFloat(item.cantidad_requerida || 0);
    });

    const insumosParaFinal = insumosParcialesConsumo.map(item => ({
      id_insumo: item.id_insumo,
      codigo_insumo: item.codigo_insumo,
      insumo: item.insumo,
      unidad_medida: item.unidad_medida,
      cantidad_requerida: reqMap[item.id_insumo] || 0,
      cantidad_ya_consumida: item.cantidad_ya_consumida || 0,
      cantidad: item.cantidad,
      es_nuevo: item.es_nuevo || false
    }));

    setCantidadUnidadesFinal(cantidadUnidadesParcial);
    setInsumosFinalesConsumo(insumosParaFinal);
    setFinalizarVieneDeParcial(true);
    setModalParcial(false);
    setModalFinalizar(true);
  };

  const handleRegistroParcial = async (e) => {
    e.preventDefault();

    if (alcanzaMetaEnParcial) {
      pasarParcialAFinalizar();
      return;
    }

    try {
      setProcesando(true);
      setError(null);

      const insumosConCantidad = insumosParcialesConsumo.filter(i => parseFloat(i.cantidad) > 0);
      
      const mermasValidas = mermas.filter(m => 
          m.id_producto_merma && 
          m.cantidad && 
          parseFloat(m.cantidad) > 0
      );
        
      if (insumosParcialesConsumo.length > 0 && insumosConCantidad.length === 0) {
        setError('Debe especificar al menos un insumo con cantidad mayor a 0');
        setProcesando(false);
        return;
      }

      const payload = {
        cantidad_kilos: 0, 
        cantidad_unidades: parseFloat(cantidadUnidadesParcial || 0), 
        insumos_consumidos: insumosConCantidad.map(i => ({
          id_insumo: i.id_insumo,
          cantidad: parseFloat(i.cantidad)
        })),
        observaciones: observacionesParcial,
        mermas: mermasValidas.map(m => ({
          id_producto_merma: parseInt(m.id_producto_merma),
          cantidad: parseFloat(m.cantidad),
          observaciones: m.observaciones || null
        }))
      };

      const response = await ordenesProduccionAPI.registrarParcial(id, payload);
        
      if (response.data.success) {
        setSuccess(response.data.message);
        setModalParcial(false);
        setCantidadUnidadesParcial('');
        setObservacionesParcial('');
        setInsumosParcialesConsumo([]);
        setMermas([]); 
        setMostrarMermas(false);
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
    
    const insumosValidos = insumosFinalesConsumo.filter(i => i.id_insumo && parseFloat(i.cantidad) > 0);

    try {
      setProcesando(true);
      setError(null);

      const payload = {
        cantidad_kilos_final: 0, 
        cantidad_unidades_final: parseFloat(cantidadUnidadesFinal || 0),
        insumos_reales: insumosValidos.map(i => ({
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
        setFinalizarVieneDeParcial(false);
        setMermas([]);
        setMostrarMermas(false);
        setInsumosFinalesConsumo([]);
        setTotalRealInsumos('');
        cargarDatos();
      }
        
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.error || 'Error al finalizar producción';
      setError(errorMsg);
    } finally {
      setProcesando(false);
    }
  };

  const kilosParcialCalculados = insumosParcialesConsumo.reduce((acc, item) => acc + (parseFloat(item.cantidad) || 0), 0);

  const kilosAdicionalesCierre = insumosFinalesConsumo.reduce((acc, item) => acc + (parseFloat(item.cantidad) || 0), 0);

  const yaKgAcumulado  = parseFloat(orden?.cantidad_producida || 0);
  const yaUndAcumulado = parseFloat(orden?.cantidad_unidades_producida || 0);
  const metaKgOrden    = parseFloat(orden?.cantidad_planificada || 0);
  const metaUndOrden   = parseFloat(orden?.cantidad_unidades || 0);
  const undNuevasParcial = parseFloat(cantidadUnidadesParcial || 0);

  const alcanzaMetaEnParcial = modalParcial && (
    (metaKgOrden  > 0 && (yaKgAcumulado  + kilosParcialCalculados) >= metaKgOrden)  ||
    (metaUndOrden > 0 && (yaUndAcumulado + undNuevasParcial)       >= metaUndOrden)
  );
  const kilosFinalesCalculados = parseFloat(orden?.cantidad_producida || 0) + kilosAdicionalesCierre;

  const handleAsignarSupervisor = async (e) => {
    e.preventDefault();
    
    const esPendienteAsignacionDesdeVenta = orden.estado === 'Pendiente Asignación' && orden.origen_tipo === 'Orden de Venta';

    try {
      setProcesando(true);
      setError(null);

      if (esPendienteAsignacionDesdeVenta) {
        if (modoReceta === 'porcentaje' && listaInsumos.length === 0) {
          setError('Debe agregar al menos un insumo');
          setProcesando(false);
          return;
        }

        if (modoReceta === 'porcentaje') {
          const totalPorcentaje = listaInsumos.reduce((acc, curr) => acc + curr.porcentaje, 0);
          if (Math.abs(totalPorcentaje - 100) > 0.01) {
            setError(`La suma de los porcentajes es ${totalPorcentaje.toFixed(2)}%. Debe ser exactamente 100%`);
            setProcesando(false);
            return;
          }
        }

        const payload = {
          id_supervisor: parseInt(asignacionData.id_supervisor),
          turno: asignacionData.turno,
          maquinista: asignacionData.maquinista || null,
          ayudante: asignacionData.ayudante || null,
          operario_corte: asignacionData.operario_corte || null,
          operario_embalaje: asignacionData.operario_embalaje || null,
          medida: asignacionData.medida || null,
          peso_producto: asignacionData.peso_producto || null,
          gramaje: asignacionData.gramaje || null,
          modo_receta: modoReceta
        };

        if (modoReceta === 'porcentaje') {
          payload.insumos = listaInsumos.map(i => ({
            id_insumo: i.id_insumo,
            porcentaje: i.porcentaje
          }));
        }

        await ordenesProduccionAPI.completarAsignacion(id, payload);
        setSuccess('Orden configurada y asignada exitosamente.');
      } else {
        const payload = {
          id_supervisor: parseInt(asignacionData.id_supervisor),
          turno: asignacionData.turno,
          maquinista: asignacionData.maquinista,
          ayudante: asignacionData.ayudante,
          operario_corte: asignacionData.operario_corte,
          operario_embalaje: asignacionData.operario_embalaje
        };
        
        await ordenesProduccionAPI.update(id, payload);
        setSuccess('Datos de asignación actualizados.');
      }

      setModalAsignar(false);
      setListaInsumos([]);
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

  const handleAnular = async () => {
    try {
      setProcesando(true);
      setError(null);
      await ordenesProduccionAPI.anular(id);
      setSuccess('Orden anulada correctamente. Inventario revertido.');
      setModalAnular(false);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al anular la orden');
    } finally {
      setProcesando(false);
    }
  };

  const handleVerificarCalidad = async () => {
    if (!resultadoCalidad) {
      setError('Seleccione un resultado de calidad.');
      return;
    }
    try {
      setProcesando(true);
      setError(null);
      const response = await ordenesProduccionAPI.verificarCalidad(id, {
        resultado: resultadoCalidad,
        observacion: observacionCalidad || null
      });
      if (response.data.success) {
        setSuccess(response.data.message);
        setModalCalidad(false);
        setResultadoCalidad('');
        setObservacionCalidad('');
        cargarDatos();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.error || 'Error al registrar la verificación de calidad');
    } finally {
      setProcesando(false);
    }
  };

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 3
    }).format(valor);
  };

  const formatearMoneda = (valor) => {
    const simbolo = 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';

    if (fecha.includes('T') || (fecha.includes(' ') && fecha.includes(':'))) {
      return new Date(fecha).toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }

    const partes = fecha.split(' ')[0].split('-');
    if (partes.length === 3) {
      const [year, month, day] = partes;
      return `${day}/${month}/${year}`;
    }
    
    return fecha;
  };

  const formatearTiempo = (minutos) => {
    if (!minutos || minutos === 0) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}m`;
  };

  const totalInsumosReales = insumosFinalesConsumo.reduce((acc, item) => acc + (parseFloat(item.cantidad) || 0) + (parseFloat(item.cantidad_ya_consumida) || 0), 0);
  const sumaRequeridaFinal = insumosFinalesConsumo.reduce((acc, item) => acc + (parseFloat(item.cantidad_requerida) || 0), 0);
  const totalMerma = mermas.reduce((acc, m) => acc + (parseFloat(m.cantidad) || 0), 0);
  const totalKilosProd = kilosFinalesCalculados; 
  const diferenciaMasa = totalInsumosReales - (totalKilosProd + totalMerma);

  const totalMasaRealConsumida = consumoMateriales.reduce((acc, item) => acc + parseFloat(item.cantidad_real_consumida || 0), 0);

  const porcentajeActualTotal = listaInsumos.reduce((sum, item) => sum + item.porcentaje, 0);
  const porcentajeEdicionTotal = insumosEdicion.reduce((sum, item) => sum + item.porcentaje, 0);

  useEffect(() => {
    if (!adjuntoVisor) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setAdjuntoVisor(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [adjuntoVisor]);

  if (loading) {
    return <Loading variant="detail" />;
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

  const puedeEditar = (orden.estado === 'Pendiente Asignación' || orden.estado === 'Pendiente') && !esComercial;
  const puedeAsignar = (orden.estado === 'Pendiente Asignación') && !esComercial;
  const puedeIniciar = (orden.estado === 'Pendiente') && !esComercial;
  const puedePausar = (orden.estado === 'En Curso') && !esComercial;
  const puedeReanudar = (orden.estado === 'En Pausa') && !esComercial;
  const puedeFinalizar = (orden.estado === 'En Curso' || orden.estado === 'En Pausa') && !esComercial;
  const puedeRegistrarParcial = (orden.estado === 'En Curso' || orden.estado === 'En Pausa') && !esComercial;
  const desdeOrdenVenta = orden.origen_tipo === 'Orden de Venta';
  const esPendienteAsignacionDesdeVenta = orden.estado === 'Pendiente Asignación' && desdeOrdenVenta;
  
  const esLamina = orden.producto.toUpperCase().includes('LÁMINA') || orden.producto.toUpperCase().includes('LAMINA');
  const unidadProduccion = orden.unidad_medida || (esLamina ? 'Millares' : 'Unidades');

  const esLaminaEdicion = datosEdicion.id_producto_terminado ? 
    (productosDisponibles.find(p => p.id_producto == datosEdicion.id_producto_terminado)?.nombre.toUpperCase().includes('LÁMINA') || 
     productosDisponibles.find(p => p.id_producto == datosEdicion.id_producto_terminado)?.nombre.toUpperCase().includes('LAMINA')) : 
    esLamina;

  const tieneRegistrosParciales = registrosParciales && registrosParciales.length > 0;
  const tieneConsumoMateriales = consumoMateriales && consumoMateriales.length > 0;

  const metaUnd = parseFloat(orden.cantidad_unidades || 0);
  const realUnd = parseFloat(orden.cantidad_unidades_producida || 0);
  const metaKg = parseFloat(orden.cantidad_planificada || 0);
  const realKg = parseFloat(orden.cantidad_producida || 0);
  const avanceUnd = metaUnd > 0 ? (realUnd / metaUnd) * 100 : 0;
  const avanceKg = metaKg > 0 ? (realKg / metaKg) * 100 : 0;

  const diasParaEntrega = (() => {
    if (!orden.fecha_estimada_venta) return null;
    const base = String(orden.fecha_estimada_venta).split('T')[0];
    const objetivo = new Date(`${base}T00:00:00`);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((objetivo - hoy) / 86400000);
  })();

  const textoDiasEntrega = diasParaEntrega === null
    ? ''
    : diasParaEntrega > 1 ? `Faltan ${diasParaEntrega} días`
      : diasParaEntrega === 1 ? 'Mañana'
        : diasParaEntrega === 0 ? 'Hoy'
          : `Vencida hace ${Math.abs(diasParaEntrega)} día${Math.abs(diasParaEntrega) === 1 ? '' : 's'}`;

  const ordenTerminada = ['Finalizada', 'Cancelada', 'Anulada'].includes(orden.estado);
  const diferenciaCosto = analisisConsumo?.resumen?.diferencia || 0;
  const costoMostrado = analisisConsumo ? analisisConsumo.resumen.costo_real : orden.costo_materiales;

  const abrirParcial = () => {
    setCantidadUnidadesParcial('');
    setObservacionesParcial('');
    setMermas([]);
    setMostrarMermas(false);
    inicializarInsumosParaParcial();
    cargarProductosMerma();
    setModalParcial(true);
  };

  const abrirFinalizar = () => {
    setCantidadUnidadesFinal('');
    setObservacionesFinal('');
    setMermas([]);
    setMostrarMermas(false);
    setFinalizarVieneDeParcial(false);
    inicializarInsumosParaFinal();
    cargarProductosMerma();
    setModalFinalizar(true);
  };

  return (
    <div className="pg-page">
      <div className="pd-topbar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/produccion/ordenes')}>
          <ArrowLeft size={16} /> Órdenes de producción
        </button>
        {puedeRegistrarIncidencia && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setModalIncidencia(true)}>
            <AlertTriangle size={15} className="text-danger" /> Registrar incidencia
          </button>
        )}
      </div>

      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Factory size={13} /> Orden de producción</span>
          <h1 className="pg-title">{orden.numero_orden}</h1>
          <p className="pg-subtitle"><b>{orden.producto}</b> · {orden.codigo_producto}</p>
          <div className="pg-drawer-badges">
            <BadgeEstadoProduccion estado={orden.estado} />
            {desdeOrdenVenta ? (
              <span className="badge badge-info"><ShoppingCart size={11} /> Desde O.V.</span>
            ) : (
              <span className="badge badge-secondary"><UserCog size={11} /> Interna</span>
            )}
            {orden.es_manual === 1 && <span className="badge badge-warning"><Zap size={11} /> Manual</span>}
            {orden.resultado_calidad && (
              <span className={`badge ${orden.resultado_calidad === 'Aprobado' ? 'badge-success' : orden.resultado_calidad === 'Observado' ? 'badge-warning' : 'badge-danger'}`}>
                <ShieldCheck size={11} /> Calidad: {orden.resultado_calidad}
              </span>
            )}
          </div>
        </div>

        <div className="pd-header-actions">
          <div className="pg-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={handleDescargarPDF} disabled={procesando} title="Descargar la orden en PDF">
              <FileText size={15} /> Orden PDF
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleDescargarHojaRuta} disabled={procesando} title="Hoja de ruta para el operario">
              <Clipboard size={15} /> Hoja de ruta
            </button>
            {puedeEditar && (
              <button type="button" className="btn btn-outline btn-sm" onClick={inicializarEdicion} disabled={procesando}>
                <Edit size={15} /> Editar
              </button>
            )}
            {!['Cancelada', 'Anulada'].includes(orden.estado) && !esComercial && (
              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setModalAnular(true)} disabled={procesando} title="Revertir toda la producción e inventario">
                <Trash2 size={15} /> Anular
              </button>
            )}
          </div>

          {(puedeAsignar || puedeIniciar || puedePausar || puedeReanudar || puedeRegistrarParcial || puedeFinalizar ||
            (orden.estado === 'Finalizada' && (user?.rol === 'Calidad' || user?.rol === 'Administrador') && !orden.resultado_calidad)) && (
            <div className="pg-actions">
              {puedeAsignar && (
                <button type="button" className="btn btn-primary" onClick={() => { cargarSupervisores(); setModalAsignar(true); }} disabled={procesando}>
                  <Users size={16} /> {esPendienteAsignacionDesdeVenta ? 'Configurar orden' : 'Asignar personal'}
                </button>
              )}
              {puedeIniciar && (
                <button type="button" className="btn btn-primary" onClick={handleIniciar} disabled={procesando}>
                  <Play size={16} /> Iniciar producción
                </button>
              )}
              {puedePausar && (
                <button type="button" className="btn btn-outline" onClick={handlePausar} disabled={procesando}>
                  <Pause size={16} /> Pausar
                </button>
              )}
              {puedeReanudar && (
                <button type="button" className="btn btn-primary" onClick={handleReanudar} disabled={procesando}>
                  <Play size={16} /> Reanudar
                </button>
              )}
              {puedeRegistrarParcial && (
                <button type="button" className="btn btn-outline" onClick={abrirParcial} disabled={procesando}>
                  <Layers size={16} /> Registro parcial
                </button>
              )}
              {puedeFinalizar && (
                <button type="button" className="btn btn-success" onClick={abrirFinalizar} disabled={procesando}>
                  <CheckCircle size={16} /> Finalizar
                </button>
              )}
              {orden.estado === 'Finalizada' && (user?.rol === 'Calidad' || user?.rol === 'Administrador') && !orden.resultado_calidad && (
                <button type="button" className="btn btn-primary" onClick={() => { setResultadoCalidad(''); setObservacionCalidad(''); setModalCalidad(true); }} disabled={procesando}>
                  <ShieldCheck size={16} /> Verificar calidad
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <ModalNuevaIncidencia
        isOpen={modalIncidencia}
        onClose={() => setModalIncidencia(false)}
        onCreated={() => setSuccess('Incidencia de calidad registrada correctamente.')}
        prefill={{
          id_orden: orden.id_orden,
          id_orden_venta: orden.id_orden_venta || null,
          id_producto: orden.id_producto_terminado,
          producto_nombre: orden.producto,
          unidad_medida: orden.unidad_medida,
          numero_op: orden.numero_orden,
          numero_ov: orden.numero_orden_venta,
          fase_deteccion: 'Producto Terminado'
        }}
      />

      <Modal
        isOpen={modalCalidad}
        onClose={() => setModalCalidad(false)}
        title={<span className="flex items-center gap-2"><ShieldCheck className="text-primary" /> Verificación de Calidad</span>}
      >
        <p className="text-sm text-muted mb-2">Registra el resultado de la inspección de calidad de la orden <strong>{orden.numero_orden}</strong>.</p>
        <div className="form-group">
          <label className="form-label">Resultado <span className="text-danger">*</span></label>
          <div className="pd-vstack" role="radiogroup" aria-label="Resultado de calidad">
            {[
              { val: 'Aprobado', desc: 'El producto cumple con las especificaciones.', tono: 'is-success', icon: CheckCircle },
              { val: 'Observado', desc: 'Cumple con observaciones. Se generará una incidencia.', tono: 'is-warning', icon: AlertTriangle },
              { val: 'Rechazado', desc: 'No cumple. Se generará una incidencia.', tono: 'is-danger', icon: XCircle }
            ].map(op => {
              const Icono = op.icon;
              return (
                <button
                  key={op.val}
                  type="button"
                  role="radio"
                  aria-checked={resultadoCalidad === op.val}
                  className={`pd-option ${op.tono} ${resultadoCalidad === op.val ? 'on' : ''}`}
                  onClick={() => setResultadoCalidad(op.val)}
                >
                  <Icono size={18} />
                  <span>
                    <strong>{op.val}</strong>
                    <small>{op.desc}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Observación {(resultadoCalidad === 'Rechazado' || resultadoCalidad === 'Observado') && <span className="text-muted">(se incluirá en la incidencia)</span>}</label>
          <textarea className="form-textarea" rows={3} value={observacionCalidad} onChange={(e) => setObservacionCalidad(e.target.value)} placeholder="Detalle de la inspección..." />
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <button className="btn btn-outline" onClick={() => setModalCalidad(false)} disabled={procesando}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleVerificarCalidad} disabled={procesando || !resultadoCalidad}>
            {procesando ? 'Registrando...' : 'Registrar verificación'}
          </button>
        </div>
      </Modal>

      <div className="pg-stack">
        {desdeOrdenVenta && (
          <section className="pd-ov-strip">
            <span className="pd-ov-icon"><ShoppingCart size={18} /></span>
            <div className="pd-ov-main">
              <span className="pg-field-label">Orden de venta</span>
              <strong>{orden.numero_orden_venta || 'N/A'}</strong>
              <small>Cliente a la espera de producción</small>
            </div>
            {orden.prioridad_venta && (
              <div className="pd-ov-item">
                <span className="pg-field-label">Prioridad</span>
                <BadgePrioridad prioridad={orden.prioridad_venta} />
              </div>
            )}
            {orden.fecha_estimada_venta && (
              <div className="pd-ov-item">
                <span className="pg-field-label">Fecha prometida</span>
                <strong>{formatearFecha(orden.fecha_estimada_venta)}</strong>
                {!ordenTerminada && (
                  <small className={diasParaEntrega < 0 ? 'text-danger' : diasParaEntrega <= 2 ? 'text-warning' : ''}>{textoDiasEntrega}</small>
                )}
              </div>
            )}
          </section>
        )}

        <div className="pg-kpis">
          <div className={`pg-kpi ${avanceUnd >= 100 ? 'is-success' : 'is-accent'}`}>
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Avance en {unidadProduccion.toLowerCase()}</span>
              <span className="pg-kpi-icon"><Package size={16} /></span>
            </div>
            <span className="pg-kpi-value">{fmtUnid(realUnd)}<small style={{ marginLeft: '0.35rem' }}>/ {metaUnd > 0 ? fmtUnid(metaUnd) : '—'}</small></span>
            <span className="pg-kpi-foot">{metaUnd > 0 ? <><b>{avanceUnd.toFixed(1)}%</b> de la meta</> : 'Sin meta en unidades'}</span>
            {metaUnd > 0 && (
              <div className="pg-meter" style={{ '--meter-c': avanceUnd > 100 ? 'var(--warning)' : 'var(--info)' }}>
                <span style={{ width: `${Math.min(avanceUnd, 100)}%` }} />
              </div>
            )}
          </div>

          <div className={`pg-kpi ${avanceKg >= 100 ? 'is-success' : 'is-accent'}`}>
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Avance en kilos</span>
              <span className="pg-kpi-icon"><Scale size={16} /></span>
            </div>
            <span className="pg-kpi-value">{realKg.toFixed(2)}<small style={{ marginLeft: '0.35rem' }}>/ {metaKg.toFixed(2)} kg</small></span>
            <span className="pg-kpi-foot">{metaKg > 0 ? <><b>{avanceKg.toFixed(1)}%</b> de la meta</> : 'Sin meta en kilos'}</span>
            {metaKg > 0 && (
              <div className="pg-meter" style={{ '--meter-c': avanceKg > 100 ? 'var(--warning)' : 'var(--success)' }}>
                <span style={{ width: `${Math.min(avanceKg, 100)}%` }} />
              </div>
            )}
          </div>

          <div className="pg-kpi is-info">
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Tiempo total</span>
              <span className="pg-kpi-icon"><Clock size={16} /></span>
            </div>
            <span className="pg-kpi-value">{formatearTiempo(orden.tiempo_total_minutos)}</span>
            <span className="pg-kpi-foot">{orden.fecha_inicio ? <>Inicio <b>{formatearFecha(orden.fecha_inicio)}</b></> : 'Aún no inicia'}</span>
          </div>

          <div className={`pg-kpi ${diferenciaCosto > 0 ? 'is-warning' : 'is-success'}`}>
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Costo de materiales</span>
              <span className="pg-kpi-icon"><BarChart size={16} /></span>
            </div>
            <span className="pg-kpi-value">{formatearMoneda(costoMostrado)}</span>
            <span className="pg-kpi-foot">
              {diferenciaCosto > 0 && <><TrendingUp size={12} className="text-warning" /> Sobrecosto <b>{formatearMoneda(diferenciaCosto)}</b></>}
              {diferenciaCosto < 0 && <><TrendingDown size={12} className="text-success" /> Ahorro <b>{formatearMoneda(Math.abs(diferenciaCosto))}</b></>}
              {diferenciaCosto === 0 && `${consumoMateriales.length} insumos registrados`}
            </span>
          </div>
        </div>

        <div className="pd-grid-3">
          <section className="pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><ClipboardList size={16} /> Producto</h2>
            </div>
            <div className="pg-panel-body">
              <div className="pg-kv">
                <div className="wide"><span>Producto</span><strong>{orden.producto}</strong></div>
                <div><span>Código</span><strong>{orden.codigo_producto}</strong></div>
                <div><span>Unidad</span><strong>{unidadProduccion}</strong></div>
                {orden.medida && <div><span><Ruler size={10} /> Medida</span><strong>{orden.medida}</strong></div>}
                {orden.peso_producto && <div><span><Scale size={10} /> Peso</span><strong>{orden.peso_producto}</strong></div>}
                {orden.gramaje && <div><span><Info size={10} /> Gramaje</span><strong>{orden.gramaje}</strong></div>}
              </div>
            </div>
          </section>

          <section className="pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><Users size={16} /> Equipo</h2>
            </div>
            <div className="pg-panel-body">
              <div className="pg-kv">
                <div className="wide"><span>Supervisor</span><strong>{orden.supervisor || 'Sin asignar'}</strong></div>
                <div><span>Turno</span><strong>{orden.turno || '—'}</strong></div>
                {esLamina ? (
                  <>
                    <div><span>Corte</span><strong>{orden.operario_corte || '—'}</strong></div>
                    <div><span>Embalaje</span><strong>{orden.operario_embalaje || '—'}</strong></div>
                  </>
                ) : (
                  <>
                    <div><span>Maquinista</span><strong>{orden.maquinista || '—'}</strong></div>
                    {orden.ayudante && <div><span>Ayudante</span><strong>{orden.ayudante}</strong></div>}
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><CalendarIcon size={16} /> Fechas</h2>
            </div>
            <div className="pg-panel-body">
              <div className="pg-kv">
                <div className="wide">
                  <span>Programación</span>
                  <strong>
                    {orden.fecha_programada
                      ? <>{formatearFecha(orden.fecha_programada)}{orden.fecha_programada_fin && orden.fecha_programada_fin !== orden.fecha_programada && <> al {formatearFecha(orden.fecha_programada_fin)}</>}</>
                      : <span className="pg-muted">No programada</span>}
                  </strong>
                </div>
                <div><span>Inicio</span><strong>{formatearFecha(orden.fecha_inicio)}</strong></div>
                <div><span>Fin</span><strong>{formatearFecha(orden.fecha_fin)}</strong></div>
              </div>
            </div>
          </section>
        </div>

        {tieneRegistrosParciales && (
          <section className="pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><Layers size={16} /> Registros parciales <span className="pg-count">{registrosParciales.length}</span></h2>
            </div>
            <div className="pg-table-wrap">
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th className="num">{unidadProduccion}</th>
                    <th className="num">Peso</th>
                    <th>Insumos</th>
                    <th>Registrado por</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosParciales.map(registro => (
                    <tr key={registro.id_registro}>
                      <td className="nowrap">{formatearFecha(registro.fecha_registro)}</td>
                      <td className="num"><b>{registro.cantidad_unidades_registrada ? fmtUnid(registro.cantidad_unidades_registrada) : '—'}</b></td>
                      <td className="num">{parseFloat(registro.cantidad_registrada).toFixed(2)} kg</td>
                      <td><span className="pg-cell-sub" style={{ maxWidth: 320 }}>{registro.detalle_insumos || '—'}</span></td>
                      <td className="nowrap">{registro.registrado_por || '—'}</td>
                      <td className="pg-muted">{registro.observaciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tieneConsumoMateriales && (
          <section className="pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><Package size={16} /> Materiales consumidos <span className="pg-count">{consumoMateriales.length}</span></h2>
              {analisisConsumo && diferenciaCosto !== 0 && (
                <span className={`badge ${diferenciaCosto > 0 ? 'badge-warning' : 'badge-success'}`}>
                  {diferenciaCosto > 0
                    ? <><TrendingUp size={12} /> Sobrecosto {formatearMoneda(diferenciaCosto)}</>
                    : <><TrendingDown size={12} /> Ahorro {formatearMoneda(Math.abs(diferenciaCosto))}</>}
                </span>
              )}
            </div>
            <div className="pg-table-wrap">
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Insumo</th>
                    <th className="num">Plan</th>
                    <th className="num">Real</th>
                    <th>Avance</th>
                    <th className="num">% mezcla</th>
                    {analisisConsumo && <th className="num">Diferencia</th>}
                    <th className="num">Costo unit.</th>
                    <th className="num">Costo total</th>
                  </tr>
                </thead>
                <tbody>
                  {consumoMateriales.map((item) => {
                    const analisisItem = analisisConsumo?.detalle.find(a => a.id_insumo === item.id_insumo);
                    const diferencia = analisisItem ? parseFloat(analisisItem.diferencia) : 0;
                    const plan = parseFloat(item.cantidad_requerida);
                    const real = parseFloat(item.cantidad_real_consumida || 0);
                    const porcentajeAvance = plan > 0 ? (real / plan) * 100 : 0;
                    const porcentajeMezcla = totalMasaRealConsumida > 0 ? (real / totalMasaRealConsumida) * 100 : 0;
                    const esRollo = item.insumo && item.insumo.toUpperCase().includes('ROLLO BURBUPACK');
                    const unidadMostrar = esRollo ? 'Und' : item.unidad_medida;
                    const decimales = esRollo ? 0 : 4;

                    return (
                      <tr key={item.id_consumo}>
                        <td>
                          <span className="pg-cell-main">{item.insumo}</span>
                          <span className="pg-cell-sub">{item.codigo_insumo}</span>
                        </td>
                        <td className="num pg-muted">{plan.toFixed(decimales)} <small>{unidadMostrar}</small></td>
                        <td className="num"><b>{real.toFixed(decimales)}</b> <small className="pg-muted">{unidadMostrar}</small></td>
                        <td style={{ minWidth: 120 }}>
                          <span className="pg-cell-sub">{porcentajeAvance.toFixed(0)}%</span>
                          <div className="pg-meter" style={{ marginTop: 4, '--meter-c': porcentajeAvance > 100 ? 'var(--warning)' : 'var(--success)' }}>
                            <span style={{ width: `${Math.min(porcentajeAvance, 100)}%` }} />
                          </div>
                        </td>
                        <td className="num">{porcentajeMezcla.toFixed(2)}%</td>
                        {analisisConsumo && (
                          <td className="num">
                            {diferencia !== 0
                              ? <span className={`badge ${diferencia > 0 ? 'badge-warning' : 'badge-success'}`}>{diferencia > 0 ? '+' : ''}{diferencia.toFixed(4)}</span>
                              : <span className="pg-muted">—</span>}
                          </td>
                        )}
                        <td className="num">{formatearMoneda(item.costo_unitario)}</td>
                        <td className="num"><b>{formatearMoneda(analisisItem ? analisisItem.costo_real : (real * parseFloat(item.costo_unitario)))}</b></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="pd-total-row">
                    <td colSpan={analisisConsumo ? 7 : 6} className="num">Total materiales</td>
                    <td className="num">{formatearMoneda(costoMostrado)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {orden.observaciones && (
          <section className="pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><FileText size={16} /> Observaciones</h2>
            </div>
            <div className="pg-panel-body">
              <p className="pd-observaciones">{orden.observaciones}</p>
            </div>
          </section>
        )}

        <section className="pg-panel">
          <div className="pg-panel-head">
            <h2 className="pg-panel-title"><Paperclip size={16} /> Fotos y adjuntos <span className="pg-count">{adjuntos.length}</span></h2>
            {puedeSubirAdjunto && (
              <div className="pg-actions" aria-busy={subiendoAdjunto} style={subiendoAdjunto ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
                <label className="btn btn-primary btn-sm">
                  <Image size={14} /> {subiendoAdjunto ? 'Subiendo…' : 'Tomar foto'}
                  <input type="file" accept="image/*" capture="environment" hidden onChange={handleSubirAdjunto} disabled={subiendoAdjunto} />
                </label>
                <label className="btn btn-outline btn-sm">
                  <Paperclip size={14} /> Adjuntar archivo
                  <input type="file" accept="image/*,application/pdf,.doc,.docx" hidden onChange={handleSubirAdjunto} disabled={subiendoAdjunto} />
                </label>
              </div>
            )}
          </div>
          <div className="pg-panel-body">
            {adjuntos.length === 0 ? (
              <div className="pg-empty">
                <Image size={26} />
                <strong>Sin fotos ni archivos</strong>
                {puedeSubirAdjunto && <span>Toma una foto del lote o adjunta un documento de la producción.</span>}
              </div>
            ) : (
              <div className="pd-gallery">
                {adjuntos.map(adj => (
                  <figure key={adj.id_adjunto} className="pd-gallery-item">
                    {adj.tipo_archivo === 'imagen' ? (
                      <button type="button" className="pd-gallery-media" onClick={() => setAdjuntoVisor(adj)} aria-label={`Ver ${adj.nombre_archivo}`}>
                        <img src={adj.url} alt={adj.nombre_archivo} loading="lazy" />
                      </button>
                    ) : (
                      <a href={adj.url} target="_blank" rel="noopener noreferrer" className="pd-gallery-media is-file">
                        <FileText size={28} />
                        <span>{adj.nombre_archivo}</span>
                      </a>
                    )}
                    <figcaption>
                      <span>
                        <b title={adj.nombre_archivo}>{adj.nombre_archivo}</b>
                        <small>{adj.subido_por || 'Desconocido'}</small>
                      </span>
                      {puedeSubirAdjunto && (
                        <button type="button" className="pg-iconbtn" onClick={() => handleEliminarAdjunto(adj.id_adjunto)} title="Eliminar" aria-label={`Eliminar ${adj.nombre_archivo}`}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {adjuntoVisor && (
        <div className="pd-lightbox" onClick={() => setAdjuntoVisor(null)} role="dialog" aria-modal="true" aria-label={adjuntoVisor.nombre_archivo}>
          <div className="pd-lightbox-inner" onClick={e => e.stopPropagation()}>
            <button type="button" className="pg-iconbtn pd-lightbox-close" onClick={() => setAdjuntoVisor(null)} aria-label="Cerrar" autoFocus>
              <X size={18} />
            </button>
            <img src={adjuntoVisor.url} alt={adjuntoVisor.nombre_archivo} />
            <p>{adjuntoVisor.nombre_archivo}</p>
          </div>
        </div>
      )}

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
          {alcanzaMetaEnParcial ? (
            <div className="pd-callout is-success">
              <CheckCircle className="text-success shrink-0" size={20} />
              <div className="pd-callout-text">
                <p className="font-bold">Esta cantidad completa la producción planificada</p>
                <p className="mt-1">
                  Acumulado: <strong>{yaKgAcumulado.toFixed(2)} Kg</strong>
                  {metaUndOrden > 0 && <> · <strong>{yaUndAcumulado} {unidadProduccion}</strong></>}
                  &nbsp;+&nbsp;
                  {kilosParcialCalculados > 0 && <><strong>{kilosParcialCalculados.toFixed(2)} Kg</strong>&nbsp;</>}
                  {undNuevasParcial > 0 && <strong>{undNuevasParcial} {unidadProduccion}</strong>}
                  &nbsp;=&nbsp;
                  <strong className="text-success">
                    {(yaKgAcumulado + kilosParcialCalculados).toFixed(2)} Kg
                    {metaUndOrden > 0 && ` · ${yaUndAcumulado + undNuevasParcial} ${unidadProduccion}`}
                  </strong>
                </p>
                <p className="pd-callout-note">Al confirmar, pasarás directamente al cierre de la orden con estos mismos datos.</p>
              </div>
            </div>
          ) : (
            <div className="pd-callout is-info">
              <Info className="text-info shrink-0" size={20} />
              <div className="pd-callout-text">
                <p><strong>Registro Parcial:</strong> Registre la cantidad de unidades fabricadas y los insumos consumidos. El peso total se calculará automáticamente.</p>
                <p className="mt-1">Ya producidas: <strong>{parseFloat(orden.cantidad_producida || 0).toFixed(2)}</strong> de <strong>{parseFloat(orden.cantidad_planificada).toFixed(2)}</strong> Kg</p>
              </div>
            </div>
          )}

          <div className="pd-form-grid pd-cols-2">
            <div className="form-group">
                <label className="form-label">Cantidad {unidadProduccion} *</label>
                <div className="relative input-with-icon">
                    <Hash className="icon" size={16} />
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        value={cantidadUnidadesParcial}
                        onChange={(e) => setCantidadUnidadesParcial(e.target.value)}
                        placeholder="0"
                        required
                    />
                </div>
            </div>

            <div className="form-group">
              <label className="form-label text-muted">Peso Calculado (Estimado)</label>
              <div className="form-input pd-readout">
                 <span>{kilosParcialCalculados.toFixed(2)}</span>
                 <span className="text-xs text-muted">Kg</span>
              </div>
              <small className="text-muted block mt-1">
                Suma automática de los insumos ingresados abajo.
              </small>
            </div>
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

          <div className="pd-section">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-primary" />
                <h3 className="pd-section-title">{esLamina ? 'Rollos Utilizados' : 'Consumo de Insumos'} *</h3>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setModalAgregarInsumoParcial(true)}
              >
                <Plus size={14} /> Agregar {esLamina ? 'Rollo' : 'Insumo'}
              </button>
            </div>

            <div className="table-container pd-scroll-md">
              <table className="table pd-table-compact">
                 <thead>
                    <tr>
                        <th>Insumo</th>
                        <th className="text-right">En este parcial</th>
                        <th className="w-12"></th>
                    </tr>
                 </thead>
                 <tbody>
                  {insumosParcialesConsumo.length > 0 ? (
                      insumosParcialesConsumo.map(item => {
                        const esRollo = item.insumo && item.insumo.toUpperCase().includes('ROLLO BURBUPACK');
                        const unidadMostrar = esRollo ? 'Und' : item.unidad_medida;
                        
                        return (
                          <tr key={item.id_insumo}>
                            <td>
                              <div className="font-medium text-sm">{item.insumo}</div>
                              <div className="text-xs text-muted">{item.codigo_insumo}</div>
                              {item.cantidad_ya_consumida > 0 && (
                                <div className="text-xs text-info">
                                  Ya consumido: {item.cantidad_ya_consumida.toFixed(esRollo ? 0 : 2)} {unidadMostrar}
                                </div>
                              )}
                            </td>
                            <td className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <input
                                    type="number"
                                    step={esRollo ? "1" : "0.0001"}
                                    min="0"
                                    className="form-input form-input-sm text-right w-24"
                                    value={item.cantidad}
                                    onChange={(e) => actualizarCantidadInsumoParcial(item.id_insumo, e.target.value)}
                                    placeholder="0.0000"
                                    required
                                  />
                                  <span className="text-xs text-muted">{unidadMostrar}</span>
                                </div>
                            </td>
                            <td className="text-center">
                                {item.es_nuevo && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger p-1"
                                    onClick={() => eliminarInsumoParcial(item.id_insumo)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                      <tr><td colSpan="3" className="text-center text-sm text-muted italic p-4">No hay {esLamina ? 'rollos' : 'insumos'} registrados. Agregue al menos uno.</td></tr>
                  )}
                 </tbody>
              </table>
            </div>
          </div>

          <div className="pd-section">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning" />
                <h3 className="pd-section-title">Registro de Mermas (Opcional)</h3>
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
              <div className="pd-vstack">
                {mermas.map((merma) => (
                  <div key={merma.id_temp} className="pd-subcard">
                    <div className="pd-merma-row">
                      <div>
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

                      <div>
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
                        {parseFloat(merma.cantidad) > 0 && kilosParcialCalculados > 0 && (
                          <small className="text-xs text-red-600 font-medium block mt-1">
                            {((parseFloat(merma.cantidad) / kilosParcialCalculados) * 100).toFixed(2)}% del total de insumos
                          </small>
                        )}
                      </div>

                      <div>
                          <label className="form-label text-xs">Observación</label>
                          <input
                          type="text"
                          className="form-input form-input-sm"
                          value={merma.observaciones}
                          onChange={(e) => actualizarMerma(merma.id_temp, 'observaciones', e.target.value)}
                        />
                      </div>

                      <div>
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

          <div className="mt-6">
            {alcanzaMetaEnParcial && (
              <p className="pd-callout-note text-right mb-1">
                Los insumos y mermas ingresados se trasladarán al cierre final de la orden.
              </p>
            )}
            <div className="flex gap-2 justify-end">
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
                className={alcanzaMetaEnParcial ? 'btn btn-success' : 'btn btn-info'}
                disabled={procesando || insumosParcialesConsumo.length === 0}
              >
                {procesando
                  ? 'Procesando...'
                  : alcanzaMetaEnParcial
                    ? <span className="flex items-center gap-1"><CheckCircle size={16} /> Finalizar orden →</span>
                    : 'Registrar Producción Parcial'
                }
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={modalAgregarInsumoParcial}
        onClose={() => setModalAgregarInsumoParcial(false)}
        title={`Agregar ${esLamina ? 'Rollo' : 'Insumo'} al Registro Parcial`}
        size="md"
      >
        <div className="form-group">
          <label className="form-label">{esLamina ? 'Rollo Burbupack' : 'Insumo'} *</label>
          <select
            className="form-select"
            value={nuevoInsumoParcial.id_insumo}
            onChange={(e) => setNuevoInsumoParcial({ ...nuevoInsumoParcial, id_insumo: e.target.value })}
          >
            <option value="">Seleccione...</option>
            {insumosFiltradosParaMostrar
              .filter(i => !insumosParcialesConsumo.find(ip => ip.id_insumo == i.id_producto))
              .map(insumo => (
                <option key={insumo.id_producto} value={insumo.id_producto}>
                  {insumo.nombre} - Stock: {parseFloat(insumo.stock_actual).toFixed(2)}
                </option>
              ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Cantidad *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="form-input"
            value={nuevoInsumoParcial.cantidad}
            onChange={(e) => setNuevoInsumoParcial({ ...nuevoInsumoParcial, cantidad: e.target.value })}
            placeholder="0.00"
          />
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <button type="button" className="btn btn-outline" onClick={() => setModalAgregarInsumoParcial(false)}>
            Cancelar
          </button>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={agregarInsumoParcialNuevo}
            disabled={!nuevoInsumoParcial.id_insumo || !nuevoInsumoParcial.cantidad}
          >
            Agregar
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={modalFinalizar}
        onClose={() => { setModalFinalizar(false); setFinalizarVieneDeParcial(false); setTotalRealInsumos(''); }}
        title={
          <span className="flex items-center gap-2">
            <CheckCircle className="text-success" /> Finalizar Producción
          </span>
        }
        size="xl"
      >
        <form onSubmit={handleFinalizar}>
          {finalizarVieneDeParcial ? (
            <div className="pd-callout is-success">
              <CheckCircle className="text-success shrink-0" size={20} />
              <div className="pd-callout-text">
                <p className="font-bold">Datos trasladados desde el registro parcial</p>
                <p className="mt-1">Las cantidades, insumos y mermas ya están cargados. Revísalos antes de confirmar el cierre.</p>
                <p className="pd-callout-note">Ya producidas (parciales anteriores): <strong>{parseFloat(orden.cantidad_producida || 0).toFixed(2)} Kg</strong> | <strong>{fmtUnid(orden.cantidad_unidades_producida)} {unidadProduccion}</strong></p>
              </div>
            </div>
          ) : (
            <div className="pd-callout is-info">
              <Info className="text-info shrink-0" size={20} />
              <div className="pd-callout-text">
                <p><strong>Cierre de Orden:</strong> Ingrese las cantidades <strong>ADICIONALES</strong> producidas en este cierre (no el total acumulado).</p>
                <p className="mt-1">Ya producidas: <strong>{parseFloat(orden.cantidad_producida || 0).toFixed(2)} Kg</strong> | <strong>{fmtUnid(orden.cantidad_unidades_producida)} {unidadProduccion}</strong></p>
              </div>
            </div>
          )}

          <div className="pd-form-grid pd-cols-2">
              <div className="form-group">
                <label className="form-label">Cant. {unidadProduccion} (Adicional)</label>
                <div className="relative input-with-icon">
                    <Hash className="icon" size={16} />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={cantidadUnidadesFinal}
                      onChange={(e) => setCantidadUnidadesFinal(e.target.value)}
                      placeholder="0"
                      required
                    />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label text-muted">Peso Adicional Calculado</label>
                <div className="relative input-with-icon">
                    <Scale className="icon" size={16} />
                    <div className="form-input pd-readout" style={{ paddingLeft: '2.5rem' }}>
                        {kilosAdicionalesCierre.toFixed(2)} Kg
                    </div>
                </div>
                <small className="text-muted block mt-1">Suma de insumos ingresados abajo.</small>
              </div>
          </div>

          {!esLamina && (
            <div className="pd-callout is-accent pd-callout-block">
              <div className="flex items-center gap-2 mb-2">
                <Scale size={16} className="text-primary" />
                <h4 className="pd-callout-title">Repartir por porcentaje de receta</h4>
              </div>
              <p className="pd-callout-text mb-1">
                Ingrese el <strong>total real de insumos</strong> y se distribuirá automáticamente
                entre los insumos según el porcentaje original de la orden. Revise el resultado antes de confirmar.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="form-group m-0 flex-1" style={{ minWidth: 160 }}>
                  <label className="form-label text-xs">Total insumos reales (Kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input form-input-sm"
                    value={totalRealInsumos}
                    onChange={(e) => setTotalRealInsumos(e.target.value)}
                    placeholder="Ej: 200"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={distribuirTotalRealPorPorcentaje}
                >
                  Aplicar distribución
                </button>
              </div>
            </div>
          )}

          <div className="pd-section">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Package size={18} className="text-primary" />
                    <h3 className="pd-section-title">{esLamina ? 'Rollos Utilizados (Cierre)' : 'Consumo Insumos (Cierre)'}</h3>
                </div>
                <button 
                    type="button" 
                    className="btn btn-sm btn-primary"
                    onClick={() => setModalAgregarInsumoFinal(true)}
                >
                    <Plus size={14} className="mr-1"/> Agregar {esLamina ? 'Rollo' : 'Insumo'}
                </button>
            </div>

            <div className="table-container pd-scroll-sm">
              <table className="table pd-table-compact">
                <thead>
                    <tr>
                        <th>Insumo</th>
                        <th className="text-right">Acumulado</th>
                        <th className="text-right">+ Adicional Cierre</th>
                        <th className="text-right">Total Final</th>
                        <th className="w-12"></th>
                    </tr>
                </thead>
                <tbody>
                  {insumosFinalesConsumo.length === 0 ? (
                      <tr><td colSpan="5" className="text-center text-sm text-muted italic p-4">No hay insumos adicionales para el cierre.</td></tr>
                  ) : (
                    insumosFinalesConsumo.map((item, idx) => {
                        const esRollo = item.insumo && item.insumo.toUpperCase().includes('ROLLO BURBUPACK');
                        const unidadMostrar = esRollo ? 'Und' : item.unidad_medida;
                        const acumulado = parseFloat(item.cantidad_ya_consumida || 0);
                        const adicional = parseFloat(item.cantidad || 0);
                        const total = acumulado + adicional;
                        const porcentajeReceta = sumaRequeridaFinal > 0
                          ? ((parseFloat(item.cantidad_requerida) || 0) / sumaRequeridaFinal) * 100
                          : 0;

                        return (
                          <tr key={idx}>
                            <td>
                                <div className="font-medium text-sm">
                                    {item.insumo}
                                    {!esLamina && porcentajeReceta > 0 && (
                                        <span className="ml-2 text-xs font-bold text-primary">{porcentajeReceta.toFixed(1)}%</span>
                                    )}
                                </div>
                                <div className="text-xs text-muted">{item.codigo_insumo}</div>
                            </td>
                            <td className="text-right text-muted text-xs">
                                {acumulado.toFixed(2)} {unidadMostrar}
                            </td>
                            <td className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <span className="text-green-600 font-bold">+</span>
                                    <input
                                      type="number"
                                      step={esRollo ? "1" : "0.0001"}
                                      min="0"
                                      className="form-input form-input-sm text-right w-20"
                                      value={item.cantidad}
                                      onChange={(e) => actualizarCantidadInsumoFinal(item.id_insumo, e.target.value)}
                                      placeholder="0"
                                    />
                                </div>
                            </td>
                            <td className="text-right font-bold">
                                {total.toFixed(2)} {unidadMostrar}
                            </td>
                            <td className="text-center">
                                {item.es_nuevo && (
                                    <button 
                                      type="button" 
                                      className="btn btn-sm btn-danger p-1"
                                      onClick={() => eliminarInsumoFinal(item.id_insumo)}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                )}
                            </td>
                          </tr>
                        );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pd-subcard pd-section">
            <h3 className="pd-section-title">Balance de Masas</h3>
            <div className="pd-balance">
                <div className="pd-balance-item">
                    <div className="text-muted text-xs">Total Insumos</div>
                    <div className="font-bold">{totalInsumosReales.toFixed(2)} Kg</div>
                </div>
                <div className="pd-balance-item is-info">
                    <div className="text-muted text-xs">(−) Prod. terminado</div>
                    <div className="font-bold">{totalKilosProd.toFixed(2)} Kg</div>
                </div>
                <div className="pd-balance-item is-danger">
                    <div className="text-muted text-xs">(−) Mermas</div>
                    <div className="font-bold">{totalMerma.toFixed(2)} Kg</div>
                </div>
                <div className={`pd-balance-item ${Math.abs(diferenciaMasa) < 0.1 ? 'is-success' : 'is-warning'}`}>
                    <div className="text-muted text-xs">Diferencia</div>
                    <div className="font-bold">{diferenciaMasa.toFixed(2)} Kg</div>
                </div>
            </div>
            {Math.abs(diferenciaMasa) > 1 && (
                <p className="text-xs text-warning mt-2 flex items-center gap-1">
                    <AlertTriangle size={12}/> La diferencia de peso es considerable. Verifique los datos.
                </p>
            )}
          </div>

          <div className="pd-section">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning" />
                <h3 className="pd-section-title">Registro de Mermas</h3>
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
              <div className="pd-vstack">
                {mermas.map((merma) => (
                  <div key={merma.id_temp} className="pd-subcard">
                    <div className="pd-merma-row">
                      <div>
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

                      <div>
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
                        {parseFloat(merma.cantidad) > 0 && totalInsumosReales > 0 && (
                          <small className="text-xs text-red-600 font-medium block mt-1">
                            {((parseFloat(merma.cantidad) / totalInsumosReales) * 100).toFixed(2)}% del total de insumos
                          </small>
                        )}
                      </div>

                      <div>
                          <label className="form-label text-xs">Observación</label>
                          <input
                          type="text"
                          className="form-input form-input-sm"
                          value={merma.observaciones}
                          onChange={(e) => actualizarMerma(merma.id_temp, 'observaciones', e.target.value)}
                        />
                      </div>

                      <div>
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
              disabled={procesando}
            >
              {procesando ? 'Procesando...' : 'Finalizar Producción'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={modalAgregarInsumoFinal}
        onClose={() => setModalAgregarInsumoFinal(false)}
        title={`Agregar ${esLamina ? 'Rollo' : 'Insumo'} Adicional`}
        size="md"
      >
        <div className="form-group">
          <label className="form-label">{esLamina ? 'Rollo Burbupack' : 'Insumo'} *</label>
          <select
            className="form-select"
            value={nuevoInsumoFinal.id_insumo}
            onChange={(e) => setNuevoInsumoFinal({ ...nuevoInsumoFinal, id_insumo: e.target.value })}
          >
            <option value="">Seleccione...</option>
            {insumosFiltradosParaMostrar
              .filter(i => !insumosFinalesConsumo.find(ifc => ifc.id_insumo == i.id_producto))
              .map(insumo => (
                <option key={insumo.id_producto} value={insumo.id_producto}>
                  {insumo.nombre} - Stock: {parseFloat(insumo.stock_actual).toFixed(2)}
                </option>
              ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Cantidad Total Consumida *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="form-input"
            value={nuevoInsumoFinal.cantidad}
            onChange={(e) => setNuevoInsumoFinal({ ...nuevoInsumoFinal, cantidad: e.target.value })}
            placeholder="0.00"
          />
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <button type="button" className="btn btn-outline" onClick={() => setModalAgregarInsumoFinal(false)}>
            Cancelar
          </button>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={agregarInsumoFinalNuevo}
            disabled={!nuevoInsumoFinal.id_insumo || !nuevoInsumoFinal.cantidad}
          >
            Agregar
          </button>
        </div>
      </Modal>
      
      <Modal
        isOpen={modalEditar}
        onClose={() => setModalEditar(false)}
        title={
          <span className="flex items-center gap-2">
            <Edit className="text-muted" /> Editar Orden de Producción
          </span>
        }
        size="xl"
      >
          <form onSubmit={handleGuardarEdicion}>
             <div className="pd-vstack">
                <div className="pd-form-grid pd-cols-2">
                    <div className="form-group">
                        <label className="form-label">Producto Terminado *</label>
                        <select className="form-select" value={datosEdicion.id_producto_terminado} onChange={(e) => setDatosEdicion({...datosEdicion, id_producto_terminado: e.target.value})} required>
                            <option value="">Seleccione...</option>
                            {productosDisponibles.map(prod => <option key={prod.id_producto} value={prod.id_producto}>{prod.nombre}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Supervisor</label>
                        <select className="form-select" value={datosEdicion.id_supervisor} onChange={(e) => setDatosEdicion({...datosEdicion, id_supervisor: e.target.value})}>
                            <option value="">Seleccione...</option>
                            {supervisoresDisponibles.map(sup => <option key={sup.id_empleado} value={sup.id_empleado}>{sup.nombre_completo}</option>)}
                        </select>
                    </div>
                </div>
                
                <div className="pd-form-grid pd-cols-3">
                    <div className="form-group">
                        <label className="form-label">Cantidad Kilos *</label>
                        <input type="number" step="0.01" className="form-input" value={datosEdicion.cantidad_planificada} onChange={(e) => setDatosEdicion({...datosEdicion, cantidad_planificada: e.target.value})} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Cantidad Unidades</label>
                        <input type="number" step="0.01" className="form-input" value={datosEdicion.cantidad_unidades} onChange={(e) => setDatosEdicion({...datosEdicion, cantidad_unidades: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Turno</label>
                        <select className="form-select" value={datosEdicion.turno} onChange={(e) => setDatosEdicion({...datosEdicion, turno: e.target.value})}>
                            <option value="Día">Día</option>
                            <option value="Noche">Noche</option>
                        </select>
                    </div>
                </div>

                {esLaminaEdicion ? (
                    <div className="pd-form-grid pd-cols-2">
                        <div className="form-group">
                            <label className="form-label">Operario de Corte</label>
                            <input className="form-input" value={datosEdicion.operario_corte} onChange={(e) => setDatosEdicion({...datosEdicion, operario_corte: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Operario de Embalaje</label>
                            <input className="form-input" value={datosEdicion.operario_embalaje} onChange={(e) => setDatosEdicion({...datosEdicion, operario_embalaje: e.target.value})} />
                        </div>
                    </div>
                ) : (
                    <div className="pd-form-grid pd-cols-2">
                        <div className="form-group">
                            <label className="form-label">Maquinista</label>
                            <input className="form-input" value={datosEdicion.maquinista} onChange={(e) => setDatosEdicion({...datosEdicion, maquinista: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ayudante</label>
                            <input className="form-input" value={datosEdicion.ayudante} onChange={(e) => setDatosEdicion({...datosEdicion, ayudante: e.target.value})} />
                        </div>
                    </div>
                )}
                
                <div className="pd-form-grid pd-cols-3">
                    <div className="form-group">
                        <label className="form-label">Medida</label>
                        <input className="form-input" value={datosEdicion.medida} onChange={(e) => setDatosEdicion({...datosEdicion, medida: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Peso Producto</label>
                        <input className="form-input" value={datosEdicion.peso_producto} onChange={(e) => setDatosEdicion({...datosEdicion, peso_producto: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Gramaje</label>
                        <input className="form-input" value={datosEdicion.gramaje} onChange={(e) => setDatosEdicion({...datosEdicion, gramaje: e.target.value})} />
                    </div>
                </div>

                <div className="pd-form-grid pd-cols-2">
                    <div className="form-group">
                        <label className="form-label">Fecha Programada</label>
                        <input type="date" className="form-input" value={datosEdicion.fecha_programada} onChange={(e) => setDatosEdicion({...datosEdicion, fecha_programada: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Fecha Programada Fin</label>
                        <input type="date" className="form-input" value={datosEdicion.fecha_programada_fin} onChange={(e) => setDatosEdicion({...datosEdicion, fecha_programada_fin: e.target.value})} />
                    </div>
                </div>
                
                <div className="form-group">
                    <label className="form-label">Observaciones</label>
                    <textarea className="form-textarea" value={datosEdicion.observaciones} onChange={(e) => setDatosEdicion({...datosEdicion, observaciones: e.target.value})} rows={3} />
                </div>
                
                {!esLaminaEdicion && (
                    <div className="pd-section">
                        <h3 className="pd-section-title">Configuración de Materiales</h3>
                        <div className="flex gap-2 mb-4">
                            <button type="button" className={`btn flex-1 text-left ${modoRecetaEdicion === 'porcentaje' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setModoRecetaEdicion('porcentaje')}>
                                <Star size={18} className="mr-2" />
                                <div><div className="font-bold">Por Porcentajes</div><div className="text-xs opacity-80">Calcula kilos automáticamente</div></div>
                            </button>
                            <button type="button" className={`btn flex-1 text-left ${modoRecetaEdicion === 'manual' ? 'btn-warning' : 'btn-outline'}`} onClick={() => setModoRecetaEdicion('manual')}>
                                <Zap size={18} className="mr-2" />
                                <div><div className="font-bold">Orden Manual</div><div className="text-xs opacity-80">Sin insumos iniciales</div></div>
                            </button>
                        </div>
                        {modoRecetaEdicion === 'porcentaje' && (
                             <>
                                <div className="flex justify-between items-center mb-3">
                                    <button type="button" className="btn btn-sm btn-primary" onClick={() => setModalAgregarInsumoEdicion(true)}><Plus size={16} /> Agregar Insumo</button>
                                </div>
                                {insumosEdicion.length > 0 ? (
                                    <div className="table-container">
                                        <table className="table pd-table-compact">
                                            <thead><tr><th>Insumo</th><th className="text-center">Porcentaje</th><th className="text-right">Calculado (Kg)</th><th className="text-center"></th></tr></thead>
                                            <tbody>
                                                {insumosEdicion.map(item => (
                                                    <tr key={item.id_insumo}>
                                                        <td><div className="font-medium text-sm">{item.codigo_insumo}</div><div className="text-xs text-muted">{item.insumo}</div></td>
                                                        <td className="text-center font-bold text-primary">{item.porcentaje}%</td>
                                                        <td className="text-right font-mono">{calcularCantidadInsumoEdicion(item.porcentaje).toFixed(2)} Kg</td>
                                                        <td className="text-center"><button type="button" className="btn btn-sm btn-danger p-1" onClick={() => eliminarInsumoEdicion(item.id_insumo)}><Trash2 size={14} /></button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="pd-col-empty"><p className="text-sm">No hay insumos agregados.</p></div>
                                )}
                             </>
                        )}
                    </div>
                )}
                
                <div className="flex gap-2 justify-end mt-6">
                    <button type="button" className="btn btn-outline" onClick={() => setModalEditar(false)} disabled={procesando}>Cancelar</button>
                    <button type="submit" className="btn btn-secondary" disabled={procesando}>{procesando ? 'Procesando...' : 'Guardar Cambios'}</button>
                </div>
             </div>
          </form>
      </Modal>

       <Modal
        isOpen={modalAsignar}
        onClose={() => setModalAsignar(false)}
        title={
          <span className="flex items-center gap-2">
            <Users className="text-warning" /> 
            {orden.estado === 'Pendiente Asignación' && orden.origen_tipo === 'Orden de Venta' ? 'Configurar Orden de Producción' : 'Asignar Personal'}
          </span>
        }
        size={orden.estado === 'Pendiente Asignación' && orden.origen_tipo === 'Orden de Venta' ? "xl" : "md"}
      >
          <form onSubmit={handleAsignarSupervisor}>
              <div className="pd-vstack">
                  <div className="form-group">
                      <label className="form-label">Supervisor *</label>
                      <select className="form-select" value={asignacionData.id_supervisor} onChange={(e) => setAsignacionData({...asignacionData, id_supervisor: e.target.value})} required>
                          <option value="">Seleccione...</option>
                          {supervisoresDisponibles.map(sup => <option key={sup.id_empleado} value={sup.id_empleado}>{sup.nombre_completo}</option>)}
                      </select>
                  </div>
                  
                  <div className="flex gap-2 justify-end mt-6">
                    <button type="button" className="btn btn-outline" onClick={() => setModalAsignar(false)} disabled={procesando}>Cancelar</button>
                    <button type="submit" className="btn btn-warning" disabled={procesando || !asignacionData.id_supervisor}>{procesando ? 'Procesando...' : 'Guardar Asignación'}</button>
                  </div>
              </div>
          </form>
      </Modal>
      
      <Modal
        isOpen={modalAgregarInsumoEdicion}
        onClose={() => setModalAgregarInsumoEdicion(false)}
        title="Agregar Insumo"
        size="md"
      >
         <div className="form-group">
            <label className="form-label">Insumo *</label>
            <select className="form-select" value={nuevoInsumoEdicion.id_insumo} onChange={(e) => setNuevoInsumoEdicion({ ...nuevoInsumoEdicion, id_insumo: e.target.value })}>
                <option value="">Seleccione...</option>
                {insumosFiltradosParaMostrar.filter(i => !insumosEdicion.find(ie => ie.id_insumo == i.id_producto)).map(insumo => (
                    <option key={insumo.id_producto} value={insumo.id_producto}>{insumo.nombre} - Stock: {parseFloat(insumo.stock_actual).toFixed(2)}</option>
                ))}
            </select>
         </div>
         <div className="form-group">
            <label className="form-label">Porcentaje (%) *</label>
            <div className="relative input-with-icon">
                <input type="number" step="0.01" className="form-input pr-8" value={nuevoInsumoEdicion.porcentaje} onChange={(e) => setNuevoInsumoEdicion({ ...nuevoInsumoEdicion, porcentaje: e.target.value })} placeholder="Ej: 50" />
                <span className="absolute right-3 top-2.5 text-gray-500 font-bold">%</span>
            </div>
         </div>
         <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn btn-outline" onClick={() => setModalAgregarInsumoEdicion(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={agregarInsumoEdicion} disabled={!nuevoInsumoEdicion.id_insumo || !nuevoInsumoEdicion.porcentaje}>Agregar</button>
         </div>
      </Modal>

       <Modal
        isOpen={modalAgregarInsumo}
        onClose={() => setModalAgregarInsumo(false)}
        title="Agregar Insumo a la Mezcla"
        size="md"
      >
         <div className="form-group">
            <label className="form-label">Insumo *</label>
            <select className="form-select" value={nuevoInsumo.id_insumo} onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, id_insumo: e.target.value })}>
                <option value="">Seleccione...</option>
                {insumosFiltradosParaMostrar.filter(i => !listaInsumos.find(li => li.id_insumo == i.id_producto)).map(insumo => (
                    <option key={insumo.id_producto} value={insumo.id_producto}>{insumo.nombre}</option>
                ))}
            </select>
         </div>
         <div className="form-group">
            <label className="form-label">Porcentaje (%) *</label>
            <div className="relative input-with-icon">
                <input type="number" step="0.01" className="form-input pr-8" value={nuevoInsumo.porcentaje} onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, porcentaje: e.target.value })} />
                <span className="absolute right-3 top-2.5 text-gray-500 font-bold">%</span>
            </div>
         </div>
         <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn btn-outline" onClick={() => setModalAgregarInsumo(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={agregarInsumoLista} disabled={!nuevoInsumo.id_insumo || !nuevoInsumo.porcentaje}>Agregar</button>
         </div>
      </Modal>

      <Modal
        isOpen={modalAnular}
        onClose={() => setModalAnular(false)}
        title="ANULAR ORDEN DE PRODUCCIÓN"
        size="lg"
      >
         <div className="pd-vstack">
            <div className="pd-callout is-danger">
                <AlertTriangle className="text-danger shrink-0" size={24} />
                <div className="pd-callout-text">
                    <p className="pd-callout-title">¡ACCIÓN IRREVERSIBLE!</p>
                    <p>Al confirmar esta acción, se realizarán los siguientes movimientos automáticos:</p>
                </div>
            </div>

            <ul className="pd-vstack pd-list-plain">
                <li className="flex items-start gap-2">
                    <span className="text-danger font-bold">•</span>
                    <span>El estado de la orden pasará a <strong>Anulada</strong> y no podrá modificarse.</span>
                </li>
                {parseFloat(orden?.cantidad_producida || 0) > 0 && (
                    <li className="flex items-start gap-2">
                        <span className="text-danger font-bold">•</span>
                        <span>
                            Se <strong>retirará del inventario</strong> el producto terminado producido hasta ahora
                            (<strong>{parseFloat(orden.cantidad_producida).toFixed(2)} Kg</strong>
                            {parseFloat(orden?.cantidad_unidades_producida || 0) > 0 && ` / ${orden.cantidad_unidades_producida} unid.`}).
                        </span>
                    </li>
                )}
                {consumoMateriales.length > 0 && (
                    <li className="flex items-start gap-2">
                        <span className="text-danger font-bold">•</span>
                        <span>
                            Los <strong>{consumoMateriales.length} insumos</strong> consumidos durante la producción serán
                            <strong> devueltos a inventario</strong>.
                        </span>
                    </li>
                )}
                {mermas.length > 0 && (
                    <li className="flex items-start gap-2">
                        <span className="text-warning font-bold">•</span>
                        <span>Los registros de mermas quedarán eliminados junto con la orden.</span>
                    </li>
                )}
            </ul>

            <div className="pd-modal-actions">
                <button className="btn btn-outline" onClick={() => setModalAnular(false)} disabled={procesando}>Cancelar</button>
                <button className="btn btn-danger font-bold" onClick={handleAnular} disabled={procesando}>{procesando ? 'Procesando...' : 'CONFIRMAR ANULACIÓN'}</button>
            </div>
         </div>
      </Modal>

    </div>
  );
}

export default OrdenDetalle;