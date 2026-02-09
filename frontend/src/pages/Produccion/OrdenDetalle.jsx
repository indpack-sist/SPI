import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Play, Pause, CheckCircle, XCircle, 
  Package, Clock, FileText, ClipboardList, 
  BarChart, AlertTriangle, Trash2, Plus,
  Layers, TrendingUp, TrendingDown, ShoppingCart,
  UserCog, AlertCircle, Zap, Calendar as CalendarIcon, 
  Users, Clipboard, Info, Hash, Scale, Ruler, Star, Edit, History
} from 'lucide-react';
import { ordenesProduccionAPI, empleadosAPI, productosAPI } from '../../config/api';
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

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
        
      const [ordenRes, consumoRes, registrosRes, insumosRes] = await Promise.all([
        ordenesProduccionAPI.getById(id),
        ordenesProduccionAPI.getConsumoMateriales(id),
        ordenesProduccionAPI.getRegistrosParciales(id).catch(() => ({ data: { data: [] } })),
        productosAPI.getAll({ estado: 'Activo' }).catch(() => ({ data: { data: [] } }))
      ]);
        
      setOrden(ordenRes.data.data);
      setConsumoMateriales(consumoRes.data.data);
      setRegistrosParciales(registrosRes.data.data || []);
      setInsumosDisponibles(insumosRes.data.data || []);
        
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

  const handleRegistroParcial = async (e) => {
    e.preventDefault();
        
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

  const kilosParcialCalculados = insumosParcialesConsumo.reduce((acc, item) => acc + (parseFloat(item.cantidad) || 0), 0);
  
  const kilosAdicionalesCierre = insumosFinalesConsumo.reduce((acc, item) => acc + (parseFloat(item.cantidad) || 0), 0);
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
      'Cancelada': 'badge-danger',
      'Anulada': 'badge-danger'
    };
    return badges[estado] || 'badge-secondary';
  };

  const totalInsumosReales = insumosFinalesConsumo.reduce((acc, item) => acc + (parseFloat(item.cantidad) || 0) + (parseFloat(item.cantidad_ya_consumida) || 0), 0);
  const totalMerma = mermas.reduce((acc, m) => acc + (parseFloat(m.cantidad) || 0), 0);
  const totalKilosProd = kilosFinalesCalculados; 
  const diferenciaMasa = totalInsumosReales - (totalKilosProd + totalMerma);

  const totalMasaRealConsumida = consumoMateriales.reduce((acc, item) => acc + parseFloat(item.cantidad_real_consumida || 0), 0);

  const porcentajeActualTotal = listaInsumos.reduce((sum, item) => sum + item.porcentaje, 0);
  const porcentajeEdicionTotal = insumosEdicion.reduce((sum, item) => sum + item.porcentaje, 0);

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

  const puedeEditar = orden.estado === 'Pendiente Asignación' || orden.estado === 'Pendiente';
  const puedeAsignar = orden.estado === 'Pendiente Asignación';
  const puedeIniciar = orden.estado === 'Pendiente';
  const puedePausar = orden.estado === 'En Curso';
  const puedeReanudar = orden.estado === 'En Pausa';
  const puedeFinalizar = orden.estado === 'En Curso' || orden.estado === 'En Pausa';
  const puedeRegistrarParcial = orden.estado === 'En Curso' || orden.estado === 'En Pausa';
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

  return (
    <div className="p-6">
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

          {puedeEditar && (
            <button 
              className="btn btn-secondary" 
              onClick={inicializarEdicion}
              disabled={procesando}
            >
              <Edit size={18} className="mr-2" /> Editar Orden
            </button>
          )}

          {puedeAsignar && (
            <button 
              className="btn btn-warning" 
              onClick={() => {
                cargarSupervisores();
                setModalAsignar(true);
              }}
              disabled={procesando}
            >
              <AlertCircle size={18} className="mr-2" /> 
              {esPendienteAsignacionDesdeVenta ? 'Configurar Orden' : 'Asignar Personal'}
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
                setCantidadUnidadesParcial('');
                setObservacionesParcial('');
                setMermas([]);
                setMostrarMermas(false);
                inicializarInsumosParaParcial();
                cargarProductosMerma();
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
                setCantidadUnidadesFinal('');
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
          {!['Cancelada', 'Anulada'].includes(orden.estado) && (
            <button 
                className="btn btn-danger ml-2"
                onClick={() => setModalAnular(true)} 
                disabled={procesando}
                title="Revertir toda la producción e inventario"
            >
              <Trash2 size={18} className="mr-2" /> Anular (Revertir)
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
            
            {(orden.medida || orden.peso_producto || orden.gramaje) && (
                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2 rounded border border-gray-100 mt-1">
                    {orden.medida && (
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1"><Ruler size={10}/> Medida</p>
                            <p className="text-xs font-bold">{orden.medida}</p>
                        </div>
                    )}
                    {orden.peso_producto && (
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1"><Scale size={10}/> Peso</p>
                            <p className="text-xs font-bold">{orden.peso_producto}</p>
                        </div>
                    )}
                    {orden.gramaje && (
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1"><Info size={10}/> Gramaje</p>
                            <p className="text-xs font-bold">{orden.gramaje}</p>
                        </div>
                    )}
                </div>
            )}

            <div>
              <p className="text-xs text-muted uppercase font-semibold">Supervisor</p>
              <p>{orden.supervisor || '-'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <p className="text-xs text-muted uppercase font-semibold">Turno</p>
                    <p>{orden.turno || '-'}</p>
                </div>
                
                {esLamina ? (
                    <>
                        <div className="col-span-2 grid grid-cols-2 gap-2 bg-blue-50 p-2 rounded border border-blue-100">
                            <div>
                                <p className="text-xs text-blue-800 uppercase font-semibold">Corte</p>
                                <p className="text-sm font-medium">{orden.operario_corte || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-blue-800 uppercase font-semibold">Embalaje</p>
                                <p className="text-sm font-medium">{orden.operario_embalaje || '-'}</p>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
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
                    </>
                )}
            </div>

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
                    <p className="text-xs text-muted uppercase font-semibold">Meta {unidadProduccion}</p>
                    <p className="font-bold text-lg text-blue-600">
                        {orden.cantidad_unidades ? parseInt(orden.cantidad_unidades) : '-'} <span className="text-xs font-normal text-muted">{unidadProduccion}</span>
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
                    <p className="text-xs text-muted uppercase font-semibold">Real {unidadProduccion}</p>
                    <p className={`font-bold text-lg ${orden.cantidad_unidades_producida > 0 ? 'text-success' : 'text-gray-400'}`}>
                        {orden.cantidad_unidades_producida ? parseInt(orden.cantidad_unidades_producida) : '0'} <span className="text-xs font-normal text-muted">{unidadProduccion}</span>
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
                  <th className="text-center">Cant. {unidadProduccion}</th>
                  <th className="text-right">Peso (Kg)</th>
                  <th>Detalle Insumos</th>
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
                    <td className="text-xs text-gray-600 max-w-xs break-words">
                      {registro.detalle_insumos || '-'}
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
                {consumoMateriales.map((item) => {
                  const analisisItem = analisisConsumo?.detalle.find(a => a.id_insumo === item.id_insumo);
                  const diferencia = analisisItem ? parseFloat(analisisItem.diferencia) : 0;
                  const plan = parseFloat(item.cantidad_requerida);
                  const real = parseFloat(item.cantidad_real_consumida || 0);
                  const porcentajeAvance = plan > 0 ? Math.min(100, (real / plan) * 100) : 0;
                  const porcentajeMezcla = totalMasaRealConsumida > 0 ? (real / totalMasaRealConsumida) * 100 : 0;
                  
                  const esRollo = item.insumo && item.insumo.toUpperCase().includes('ROLLO BURBUPACK');
                  const unidadMostrar = esRollo ? 'Und' : item.unidad_medida;
                    
                  return (
                    <tr key={item.id_consumo}>
                      <td className="font-mono text-xs">{item.codigo_insumo}</td>
                      <td className="font-medium">{item.insumo}</td>
                      <td className="text-right text-muted">
                        {plan.toFixed(esRollo ? 0 : 4)} <span className="text-xs">{unidadMostrar}</span>
                      </td>
                      <td className="text-right font-bold">
                          {real.toFixed(esRollo ? 0 : 4)} <span className="text-xs text-muted">{unidadMostrar}</span>
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
              <p><strong>Registro Parcial:</strong> Registre la cantidad de unidades fabricadas y los insumos consumidos. El peso total se calculará automáticamente.</p>
              <p className="mt-1">Ya producidas: <strong>{parseFloat(orden.cantidad_producida || 0).toFixed(2)}</strong> de <strong>{parseFloat(orden.cantidad_planificada).toFixed(2)}</strong> Kg</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="form-group">
                <label className="form-label">Cantidad {unidadProduccion} *</label>
                <div className="relative input-with-icon">
                    <Hash className="icon" size={16} />
                    <input
                        type="number"
                        step="1"
                        min="0"
                        className="form-input pl-8"
                        value={cantidadUnidadesParcial}
                        onChange={(e) => setCantidadUnidadesParcial(e.target.value)}
                        placeholder="0"
                        required
                    />
                </div>
            </div>

            <div className="form-group">
              <label className="form-label text-muted">Peso Calculado (Estimado)</label>
              <div className="form-input bg-gray-100 flex items-center justify-between text-gray-700 font-bold">
                 <span>{kilosParcialCalculados.toFixed(2)}</span>
                 <span className="text-xs font-normal">Kg</span>
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

          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-primary" />
                <h3 className="font-semibold">{esLamina ? 'Rollos Utilizados' : 'Consumo de Insumos'} *</h3>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setModalAgregarInsumoParcial(true)}
              >
                <Plus size={14} /> Agregar {esLamina ? 'Rollo' : 'Insumo'}
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto table-container">
              <table className="table table-sm">
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
                                <div className="text-xs text-blue-600 mt-1">
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
              onClick={() => setModalParcial(false)}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-info"
              disabled={procesando || insumosParcialesConsumo.length === 0}
            >
              {procesando ? 'Procesando...' : 'Registrar Producción Parcial'}
            </button>
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
              <p><strong>Cierre de Orden:</strong> Ingrese las cantidades <strong>ADICIONALES</strong> producidas en este cierre (no el total acumulado).</p>
              <p className="mt-1">Ya producidas: <strong>{parseFloat(orden.cantidad_producida || 0).toFixed(2)} Kg</strong> | <strong>{parseInt(orden.cantidad_unidades_producida || 0)} {unidadProduccion}</strong></p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="form-group">
                <label className="form-label">Cant. {unidadProduccion} (Adicional)</label>
                <div className="relative input-with-icon">
                    <Hash className="icon" size={16} />
                    <input
                      type="number"
                      step="1"
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
                    <div className="form-input bg-gray-100 flex items-center text-gray-700 font-bold" style={{ paddingLeft: '2.5rem' }}>
                        {kilosFinalesCalculados.toFixed(2)} Kg
                    </div>
                </div>
                <small className="text-muted block mt-1">Suma de insumos ingresados abajo.</small>
              </div>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Package size={18} className="text-primary" />
                    <h3 className="font-semibold">{esLamina ? 'Rollos Utilizados (Cierre)' : 'Consumo Insumos (Cierre)'}</h3>
                </div>
                <button 
                    type="button" 
                    className="btn btn-sm btn-primary"
                    onClick={() => setModalAgregarInsumoFinal(true)}
                >
                    <Plus size={14} className="mr-1"/> Agregar {esLamina ? 'Rollo' : 'Insumo'}
                </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto mb-4 table-container">
              <table className="table table-sm">
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
                        
                        return (
                          <tr key={idx}>
                            <td>
                                <div className="font-medium text-sm">{item.insumo}</div>
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
                            <td className="text-right font-bold text-blue-700">
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
            <Edit className="text-secondary" /> Editar Orden de Producción
          </span>
        }
        size="xl"
      >
          <form onSubmit={handleGuardarEdicion}>
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                
                <div className="grid grid-cols-3 gap-4">
                    <div className="form-group">
                        <label className="form-label">Cantidad Kilos *</label>
                        <input type="number" step="0.01" className="form-input" value={datosEdicion.cantidad_planificada} onChange={(e) => setDatosEdicion({...datosEdicion, cantidad_planificada: e.target.value})} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Cantidad Unidades</label>
                        <input type="number" step="1" className="form-input" value={datosEdicion.cantidad_unidades} onChange={(e) => setDatosEdicion({...datosEdicion, cantidad_unidades: e.target.value})} />
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
                    <div className="grid grid-cols-2 gap-4">
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
                    <div className="grid grid-cols-2 gap-4">
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
                
                <div className="grid grid-cols-3 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
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
                    <div className="border-t border-gray-200 pt-4 mt-4">
                        <h3 className="font-semibold text-sm mb-3">Configuración de Materiales</h3>
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
                                        <table className="table table-sm">
                                            <thead><tr><th>Insumo</th><th className="text-center">Porcentaje</th><th className="text-right">Calculado (Kg)</th><th className="text-center"></th></tr></thead>
                                            <tbody>
                                                {insumosEdicion.map(item => (
                                                    <tr key={item.id_insumo}>
                                                        <td><div className="font-medium text-sm">{item.codigo_insumo}</div><div className="text-xs text-muted">{item.insumo}</div></td>
                                                        <td className="text-center font-bold text-blue-600">{item.porcentaje}%</td>
                                                        <td className="text-right font-mono">{calcularCantidadInsumoEdicion(item.porcentaje).toFixed(2)} Kg</td>
                                                        <td className="text-center"><button type="button" className="btn btn-sm btn-danger p-1" onClick={() => eliminarInsumoEdicion(item.id_insumo)}><Trash2 size={14} /></button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="p-4 text-center text-muted bg-gray-50 rounded border border-gray-200"><p className="text-sm">No hay insumos agregados.</p></div>
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
              <div className="space-y-4">
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
         <div className="space-y-4">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded flex items-start gap-3">
                <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={24} />
                <div className="text-sm text-red-800">
                    <p className="font-bold text-lg mb-1">¡ACCIÓN IRREVERSIBLE!</p>
                    <p>Al confirmar esta acción, se realizarán los siguientes movimientos automáticos:</p>
                </div>
            </div>
            
            <div className="flex gap-3 justify-end pt-4 border-t mt-2">
                <button className="btn btn-outline" onClick={() => setModalAnular(false)} disabled={procesando}>Cancelar</button>
                <button className="btn btn-danger font-bold px-6" onClick={handleAnular} disabled={procesando}>{procesando ? 'Procesando...' : 'CONFIRMAR ANULACIÓN'}</button>
            </div>
         </div>
      </Modal>

    </div>
  );
}

export default OrdenDetalle;