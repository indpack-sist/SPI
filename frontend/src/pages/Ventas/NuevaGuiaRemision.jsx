import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Save, FileText, ShoppingCart, MapPin,
  Truck, Package, Calendar, AlertCircle, Plus, CheckCircle
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import UbigeoSelector from '../../components/common/UbigeoSelector';
import { resolverUbigeoDesdeDireccion } from '../../utils/ubigeo';
import { guiasRemisionAPI, ordenesVentaAPI } from '../../config/api';
import puertos from '../../data/puertos.json';

// Tipos de documento relacionado comex (catálogo 61). MVP: DAM (código 50 confirmado vs molde
// EG07-273). Otros tipos (DS, Constancia IVAP/Detracción, Otros) requieren confirmar su código
// cat.61 en las Reglas de Validación antes de habilitarlos.
const DOC_TIPOS_COMEX = [
  { cod: '50', desc: 'Declaración Aduanera de Mercancías (DAM)' },
];

function NuevaGuiaRemision() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idOrden = searchParams.get('orden');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [orden, setOrden] = useState(null);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [validacionProductos, setValidacionProductos] = useState({});
  const [conductores, setConductores] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [transportistas, setTransportistas] = useState([]);
  // Comercio exterior (exportación): catálogo de destinatarios + listas repetibles.
  const [destinatariosComex, setDestinatariosComex] = useState([]);
  const [docsRelacionados, setDocsRelacionados] = useState([
    { tipo_cod: '50', tipo_desc: 'Declaración Aduanera de Mercancías (DAM)', serie: '', numero: '' }
  ]);
  const [contenedores, setContenedores] = useState([{ numero_contenedor: '', numero_precinto: '' }]);
  // Transportista heredado de la OV cuando la entrega es por tercero (modalidad pública).
  const [ovTransportista, setOvTransportista] = useState(null);
  // Datos del carro particular del cliente (sin RUC) heredados de la OV (modalidad 02 privada, texto libre).
  const [ovParticular, setOvParticular] = useState(null);
  // Alta rápida de transportista (modalidad pública) sin salir del form.
  const [showNuevoTransportista, setShowNuevoTransportista] = useState(false);
  const [nuevoTransportista, setNuevoTransportista] = useState({ ruc: '', razon_social: '', numero_mtc: '' });
  const [guardandoTransportista, setGuardandoTransportista] = useState(false);
  // Alta rápida de destinatario comex (operador de puerto/depósito) sin salir del form.
  const [showNuevoDestinatario, setShowNuevoDestinatario] = useState(false);
  const [nuevoDestinatario, setNuevoDestinatario] = useState({ ruc: '', razon_social: '', codigo_establecimiento: '0' });
  const [guardandoDestinatario, setGuardandoDestinatario] = useState(false);
  
  const [formData, setFormData] = useState({
    id_orden_venta: idOrden || '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_traslado: new Date().toISOString().split('T')[0],
    tipo_traslado: 'Privado',
    motivo_traslado: 'Venta',
    modalidad_transporte: 'Transporte Privado',
    direccion_partida: '',
    ubigeo_partida: '',
    direccion_llegada: '',
    ubigeo_llegada: '',
    ciudad_llegada: '',
    peso_bruto_kg: 0,
    numero_bultos: 0,
    observaciones: '',
    id_conductor: '',
    id_vehiculo: '',
    id_transportista: '',
    // Comercio exterior (exportación)
    destinatario_ruc: '',
    destinatario_razon: '',
    puerto_codigo: '',
    traslado_total_dam: 1
  });

  // La OV de exportación (checkbox "Factura de exportación") activa toda la captura comex.
  const esExportacion = Number(orden?.es_exportacion) === 1;

  // Modalidad pública = transporte por un tercero transportista (RUC + razón social).
  const esPublico = String(formData.modalidad_transporte)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .includes('publico');
  // Carro particular del cliente (sin RUC): modalidad 02 privada con datos manuales heredados de la OV.
  const esParticular = orden?.tipo_entrega === 'Vehiculo Particular';
  
  const [detalle, setDetalle] = useState([]);

  useEffect(() => {
    if (idOrden) {
      cargarOrden(idOrden);
    }
  }, [idOrden]);

  // Catálogos para la GRE electrónica (transporte privado): conductor + vehículo de la flota.
  useEffect(() => {
    (async () => {
      try {
        const [rc, rv, rt] = await Promise.all([
          ordenesVentaAPI.getConductores(),
          ordenesVentaAPI.getVehiculos(),
          guiasRemisionAPI.getTransportistas()
        ]);
        if (rc.data?.success) setConductores(rc.data.data || []);
        if (rv.data?.success) setVehiculos(rv.data.data || []);
        if (rt.data?.success) setTransportistas(rt.data.data || []);
        // Punto de partida = domicilio fiscal de la empresa (empresa_config). Siempre es el mismo,
        // así que se prellena la dirección/ubigeo de partida (queda editable por si el traslado sale
        // de otro local). El backend ya lo autocompleta desde empresa_config, esto solo lo muestra.
        try {
          const re = await guiasRemisionAPI.getEmpresaRemitente();
          const emp = re.data?.data;
          if (emp) {
            setFormData((prev) => ({
              ...prev,
              direccion_partida: prev.direccion_partida || emp.direccion || '',
              ubigeo_partida: prev.ubigeo_partida || emp.ubigeo || '',
            }));
          }
        } catch (e) {
          console.warn('No se pudo cargar el punto de partida de la empresa:', e.message);
        }
        // Catálogo comex aparte: un fallo (endpoint nuevo aún no desplegado) NO debe romper los
        // catálogos de transporte de las guías normales.
        try {
          const rd = await guiasRemisionAPI.getDestinatariosComex();
          if (rd.data?.success) setDestinatariosComex(rd.data.data || []);
        } catch (e) {
          console.warn('Catálogo de destinatarios comex no disponible:', e.message);
        }
      } catch (err) {
        console.error('Error al cargar catálogos de transporte:', err);
      }
    })();
  }, []);

  useEffect(() => {
    calcularTotales();
    validarProductos();
  }, [detalle]);

  const cargarOrden = async (id) => {
    try {
      setLoading(true);
      
      const response = await ordenesVentaAPI.getById(id);
      
      if (response.data.success) {
        const ordenData = response.data.data;
        setOrden(ordenData);
        
        // Una guía es un documento de despacho: se permite en cualquier estado activo
        // de la OV, bloqueando solo canceladas o ya entregadas (alineado con el backend).
        if (ordenData.estado === 'Cancelada' || ordenData.estado === 'Entregada') {
          setError(`No se pueden crear guías para órdenes en estado "${ordenData.estado}".`);
          return;
        }
        
        // Mapear productos con toda la información necesaria
        const productosConDisponibilidad = ordenData.detalle.map(item => {
          const cantidadDisponible = parseFloat(item.cantidad) - parseFloat(item.cantidad_despachada || 0);
          return {
            id_detalle: item.id_detalle,
            id_producto: item.id_producto,
            codigo_producto: item.codigo_producto,
            producto: item.producto,
            unidad_medida: item.unidad_medida,
            cantidad_total: parseFloat(item.cantidad),
            cantidad_despachada: parseFloat(item.cantidad_despachada || 0),
            cantidad_disponible: cantidadDisponible,
            stock_actual: parseFloat(item.stock_disponible || 0),
            // Peso por unidad heredado de la OV (el detalle de la orden lo devuelve como
            // `peso_unitario`, del maestro de productos). Se traspasa como valor inicial y queda
            // editable en el form; si viene vacío/0, el usuario puede completarlo a mano.
            peso_unitario_kg: parseFloat(item.peso_unitario_kg ?? item.peso_unitario ?? 0) || 0
          };
        }).filter(item => item.cantidad_disponible > 0);
        
        if (productosConDisponibilidad.length === 0) {
          setError('No hay productos disponibles para despachar en esta orden');
          return;
        }
        
        setProductosDisponibles(productosConDisponibilidad);
        
        // Inicializar detalle con cantidades disponibles
        const detalleInicial = productosConDisponibilidad.map((p, i) => ({
          id_detalle_orden: p.id_detalle,
          id_producto: p.id_producto,
          codigo_producto: p.codigo_producto,
          producto: p.producto,
          unidad_medida: p.unidad_medida,
          cantidad: p.cantidad_disponible,
          peso_unitario_kg: p.peso_unitario_kg,
          descripcion: p.producto,
          // Comex: subpartida nacional (7020) y nº de serie en la DAM (7023). Serie default = orden del ítem.
          subpartida_nacional: '',
          dam_serie: String(i + 1)
        }));
        
        setDetalle(detalleInicial);
        
        // Transporte por tercero en la OV ('Transporte Privado') = modalidad pública SUNAT.
        // Se hereda el transportista declarado en la orden (RUC + razón social); el backend lo
        // materializa en el maestro al crear la guía, así no hay que re-seleccionarlo aquí.
        const ovEsTercero = ordenData.tipo_entrega === 'Transporte Privado';
        setOvTransportista(ovEsTercero ? {
          ruc: ordenData.transporte_ruc || '',
          razon: ordenData.transporte_nombre || '',
          mtc: ordenData.transporte_mtc || ''
        } : null);

        // Carro particular del cliente (sin RUC): se hereda conductor/placa a la guía como texto libre.
        const ovEsParticular = ordenData.tipo_entrega === 'Vehiculo Particular';
        setOvParticular(ovEsParticular ? {
          placa: ordenData.transporte_placa || '',
          conductor: ordenData.transporte_conductor || '',
          dni: ordenData.transporte_dni || '',
          licencia: ordenData.transporte_licencia || ''
        } : null);

        setFormData(prev => ({
          ...prev,
          id_orden_venta: id,
          // Comercio exterior: si la OV está marcada como exportación (checkbox
          // "Factura de exportación"), la guía nace con motivo Exportación (cat.20 = 09).
          // El backend igual lo fuerza desde ordenes_venta.es_exportacion (fuente única).
          motivo_traslado: Number(ordenData.es_exportacion) === 1 ? 'Exportación' : prev.motivo_traslado,
          direccion_llegada: ordenData.direccion_entrega || '',
          ciudad_llegada: ordenData.ciudad_entrega || '',
          // Ubigeo: si la OV no lo trae, se intenta derivar de la cola de la dirección de entrega
          // ("..., DISTRITO, PROVINCIA, DEPARTAMENTO"). El usuario siempre puede corregirlo en el selector.
          ubigeo_llegada: ordenData.ubigeo_llegada
            || resolverUbigeoDesdeDireccion(ordenData.direccion_entrega)?.codigo
            || '',
          // Si la OV es por tercero, la guía nace en modalidad pública.
          modalidad_transporte: ovEsTercero ? 'Transporte Público' : prev.modalidad_transporte,
          tipo_traslado: ovEsTercero ? 'Público' : prev.tipo_traslado,
          // Heredar el transporte propio asignado en la OV (editable como override en los selects).
          id_conductor: ordenData.id_conductor ? String(ordenData.id_conductor) : '',
          id_vehiculo: ordenData.id_vehiculo ? String(ordenData.id_vehiculo) : ''
        }));
      } else {
        setError('Orden no encontrada');
      }
      
    } catch (err) {
      console.error('Error al cargar orden:', err);
      setError(err.response?.data?.error || 'Error al cargar orden');
    } finally {
      setLoading(false);
    }
  };

  // Nueva función: Validar productos
  const validarProductos = () => {
    const validaciones = {};
    
    detalle.forEach(item => {
      const producto = productosDisponibles.find(p => p.id_producto === item.id_producto);
      if (!producto) return;
      
      const cantidadSolicitada = parseFloat(item.cantidad || 0);
      const errores = [];
      const warnings = [];
      
      // Validar cantidad vs disponible en orden
      if (cantidadSolicitada > producto.cantidad_disponible) {
        errores.push(`Excede lo disponible en orden: ${producto.cantidad_disponible.toFixed(4)}`);
      }
      
      // Validar cantidad vs stock actual
      if (cantidadSolicitada > producto.stock_actual) {
        errores.push(`Stock insuficiente. Disponible: ${producto.stock_actual.toFixed(4)}`);
      }
      
      // Warning si la cantidad es 0
      if (cantidadSolicitada === 0) {
        warnings.push('Este producto no se incluirá en la guía');
      }
      
      // Warning si está cerca del límite de stock
      if (cantidadSolicitada > 0 && cantidadSolicitada === producto.stock_actual && producto.stock_actual < producto.cantidad_disponible) {
        warnings.push('Usando todo el stock disponible');
      }
      
      validaciones[item.id_producto] = {
        valido: errores.length === 0,
        errores,
        warnings
      };
    });
    
    setValidacionProductos(validaciones);
  };

  const handleCantidadChange = (index, cantidad) => {
    const newDetalle = [...detalle];
    const cantidadNum = parseFloat(cantidad) || 0;
    
    // Permitir el cambio pero validar después
    newDetalle[index].cantidad = cantidadNum;
    setDetalle(newDetalle);
    
    // Limpiar error general si existe
    setError(null);
  };

  const handlePesoChange = (index, peso) => {
    const newDetalle = [...detalle];
    newDetalle[index].peso_unitario_kg = parseFloat(peso) || 0;
    setDetalle(newDetalle);
  };

  // ── Comercio exterior (exportación): handlers ──────────────────────────────────────────────
  // Subpartida nacional / nº serie DAM por ítem.
  const handleComexDetalle = (index, field, value) => {
    const nd = [...detalle];
    nd[index][field] = value;
    setDetalle(nd);
  };
  // Destinatario elegido del catálogo → snapshot RUC + razón + puerto (para AddressTypeCode en backend).
  const handleDestinatario = (ruc) => {
    const d = destinatariosComex.find((x) => x.ruc === ruc);
    setFormData((prev) => ({ ...prev, destinatario_ruc: ruc, destinatario_razon: d?.razon_social || '' }));
  };
  // Puerto de llegada → arma dirección + ubigeo de llegada desde el catálogo estático.
  const handlePuerto = (codigo) => {
    const p = puertos.find((x) => x.codigo === codigo);
    setFormData((prev) => ({
      ...prev,
      puerto_codigo: codigo,
      direccion_llegada: p?.domicilio || prev.direccion_llegada,
      ubigeo_llegada: p?.ubigeo || prev.ubigeo_llegada,
      ciudad_llegada: p?.nombre || prev.ciudad_llegada,
    }));
  };
  // Documentos relacionados (lista repetible).
  const setDoc = (i, field, value) => setDocsRelacionados((prev) => prev.map((d, j) => {
    if (j !== i) return d;
    const nd = { ...d, [field]: value };
    if (field === 'tipo_cod') nd.tipo_desc = (DOC_TIPOS_COMEX.find((t) => t.cod === value)?.desc) || '';
    return nd;
  }));
  const addDoc = () => setDocsRelacionados((prev) => [...prev, { tipo_cod: '50', tipo_desc: 'Declaración Aduanera de Mercancías (DAM)', serie: '', numero: '' }]);
  const removeDoc = (i) => setDocsRelacionados((prev) => prev.filter((_, j) => j !== i));
  // Contenedores (lista repetible).
  const setCont = (i, field, value) => setContenedores((prev) => prev.map((c, j) => (j === i ? { ...c, [field]: value } : c)));
  const addCont = () => setContenedores((prev) => [...prev, { numero_contenedor: '', numero_precinto: '' }]);
  const removeCont = (i) => setContenedores((prev) => prev.filter((_, j) => j !== i));

  // Alta rápida de transportista: lo registra en el maestro y lo deja seleccionado en la guía.
  const guardarTransportista = async () => {
    setError(null);
    const { ruc, razon_social } = nuevoTransportista;
    if (!/^\d{11}$/.test(String(ruc).trim())) {
      setError('El RUC del transportista debe tener 11 dígitos');
      return;
    }
    if (!razon_social.trim()) {
      setError('La razón social del transportista es obligatoria');
      return;
    }
    try {
      setGuardandoTransportista(true);
      const resp = await guiasRemisionAPI.createTransportista({
        ruc: ruc.trim(),
        razon_social: razon_social.trim(),
        numero_mtc: nuevoTransportista.numero_mtc.trim() || null
      });
      if (!resp.data?.success) {
        setError(resp.data?.error || 'No se pudo registrar el transportista');
        return;
      }
      const nuevo = resp.data.data;
      // Refrescar el maestro y dejar el nuevo seleccionado.
      const lista = await guiasRemisionAPI.getTransportistas();
      if (lista.data?.success) setTransportistas(lista.data.data || []);
      setFormData(prev => ({ ...prev, id_transportista: String(nuevo.id_transportista) }));
      setShowNuevoTransportista(false);
      setNuevoTransportista({ ruc: '', razon_social: '', numero_mtc: '' });
    } catch (err) {
      console.error('Error al registrar transportista:', err);
      setError(err.response?.data?.error || 'Error al registrar transportista');
    } finally {
      setGuardandoTransportista(false);
    }
  };

  // Alta rápida de destinatario comex: lo registra en el catálogo y lo deja seleccionado en la guía.
  // El código de establecimiento (anexo del destinatario) alimenta DeliveryAddress/AddressTypeCode
  // en la emisión (default '0' = matriz). Idempotente por RUC en el backend.
  const guardarDestinatario = async () => {
    setError(null);
    const { ruc, razon_social } = nuevoDestinatario;
    if (!/^\d{11}$/.test(String(ruc).trim())) {
      setError('El RUC del destinatario debe tener 11 dígitos');
      return;
    }
    if (!razon_social.trim()) {
      setError('La razón social del destinatario es obligatoria');
      return;
    }
    try {
      setGuardandoDestinatario(true);
      const resp = await guiasRemisionAPI.createDestinatarioComex({
        ruc: ruc.trim(),
        razon_social: razon_social.trim(),
        codigo_establecimiento: (nuevoDestinatario.codigo_establecimiento || '0').trim() || '0'
      });
      if (!resp.data?.success) {
        setError(resp.data?.error || 'No se pudo registrar el destinatario');
        return;
      }
      // Refrescar el catálogo y dejar el nuevo seleccionado.
      const lista = await guiasRemisionAPI.getDestinatariosComex();
      if (lista.data?.success) setDestinatariosComex(lista.data.data || []);
      setFormData(prev => ({ ...prev, destinatario_ruc: ruc.trim(), destinatario_razon: razon_social.trim() }));
      setShowNuevoDestinatario(false);
      setNuevoDestinatario({ ruc: '', razon_social: '', codigo_establecimiento: '0' });
    } catch (err) {
      console.error('Error al registrar destinatario comex:', err);
      setError(err.response?.data?.error || 'Error al registrar destinatario');
    } finally {
      setGuardandoDestinatario(false);
    }
  };

  const calcularTotales = () => {
    const pesoTotal = detalle.reduce((sum, item) =>
      sum + (parseFloat(item.cantidad) * parseFloat(item.peso_unitario_kg || 0)), 0
    );
    
    setFormData(prev => ({
      ...prev,
      peso_bruto_kg: pesoTotal.toFixed(2)
    }));
  };

  // Validar antes de enviar
  const validarFormulario = () => {
    // Verificar que haya productos válidos
    const detalleValido = detalle.filter(item => {
      const cantidad = parseFloat(item.cantidad || 0);
      const validacion = validacionProductos[item.id_producto];
      return cantidad > 0 && validacion?.valido !== false;
    });
    
    if (detalleValido.length === 0) {
      setError('No hay productos válidos para despachar. Verifique las cantidades y el stock disponible.');
      return false;
    }
    
    // Verificar si hay errores en algún producto
    const hayErrores = Object.values(validacionProductos).some(v => v.errores && v.errores.length > 0);
    if (hayErrores) {
      setError('Hay productos con errores. Corrija las cantidades antes de continuar.');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!formData.id_orden_venta) {
      setError('Debe seleccionar una orden de venta');
      return;
    }
    
    if (!formData.direccion_llegada || formData.direccion_llegada.trim() === '') {
      setError('La dirección de llegada es obligatoria');
      return;
    }

    if (!/^\d{6}$/.test(String(formData.ubigeo_llegada || ''))) {
      setError('Seleccione el ubigeo de llegada completo (Departamento, Provincia y Distrito)');
      return;
    }

    if (!formData.fecha_traslado) {
      setError('La fecha de traslado es obligatoria');
      return;
    }

    // Validación de comercio exterior (exportación): destinatario, DAM, contenedor y subpartidas.
    if (esExportacion) {
      if (!/^\d{11}$/.test(String(formData.destinatario_ruc || ''))) {
        setError('Exportación: selecciona el destinatario (operador de puerto/depósito) del catálogo.');
        return;
      }
      const damOk = docsRelacionados.some((d) => d.tipo_cod === '50' && String(d.numero).trim());
      if (!damOk) {
        setError('Exportación: agrega el número de la DAM en Documentos Relacionados.');
        return;
      }
      if (!contenedores.some((c) => String(c.numero_contenedor).trim())) {
        setError('Exportación: ingresa al menos un número de contenedor.');
        return;
      }
      const faltaSub = detalle.some((it) => parseFloat(it.cantidad) > 0 && !String(it.subpartida_nacional || '').trim());
      if (faltaSub) {
        setError('Exportación: falta la subpartida nacional en uno o más productos.');
        return;
      }
    }

    // Requisitos según modalidad para que la GRE sea emitible (se emite en un solo paso):
    //  · Público  → transportista tercero (RUC + razón social).
    //  · Privado  → conductor + vehículo (placa de la flota).
    if (esPublico) {
      // Válido si la OV ya trae el transportista (con RUC) o si se eligió uno del maestro.
      const tieneOvTransportista = ovTransportista && ovTransportista.ruc;
      if (!tieneOvTransportista && !formData.id_transportista) {
        setError(ovTransportista
          ? 'La orden se entrega por tercero pero le falta el RUC del transportista. Complétalo en "Transporte y Logística" de la orden.'
          : 'Para emitir la GRE en transporte público debes seleccionar (o registrar) un transportista.');
        return;
      }
    } else if (!esParticular && (!formData.id_conductor || !formData.id_vehiculo)) {
      setError('Para emitir la GRE en transporte privado debes seleccionar conductor y vehículo (placa).');
      return;
    }
    // Carro particular del cliente: los datos (conductor/placa) se heredan de la OV y se pueden
    // completar/editar en el wizard de emisión, así que aquí no se bloquea la creación.

    // Validar formulario
    if (!validarFormulario()) {
      return;
    }
    
    const detalleValido = detalle.filter(item => parseFloat(item.cantidad) > 0);
    
    try {
      setLoading(true);
      
      const payload = {
        id_orden_venta: parseInt(formData.id_orden_venta),
        fecha_emision: formData.fecha_emision,
        fecha_traslado: formData.fecha_traslado,
        tipo_traslado: formData.tipo_traslado,
        motivo_traslado: formData.motivo_traslado,
        modalidad_transporte: formData.modalidad_transporte,
        direccion_partida: formData.direccion_partida,
        ubigeo_partida: formData.ubigeo_partida,
        direccion_llegada: formData.direccion_llegada,
        ubigeo_llegada: formData.ubigeo_llegada,
        ciudad_llegada: formData.ciudad_llegada,
        peso_bruto_kg: parseFloat(formData.peso_bruto_kg),
        numero_bultos: parseInt(formData.numero_bultos) || 0,
        observaciones: formData.observaciones,
        // En público el transporte lo hace el tercero: no se envían conductor/vehículo propios.
        id_conductor: esPublico ? null : (formData.id_conductor ? parseInt(formData.id_conductor) : null),
        id_vehiculo: esPublico ? null : (formData.id_vehiculo ? parseInt(formData.id_vehiculo) : null),
        id_transportista: esPublico && formData.id_transportista ? parseInt(formData.id_transportista) : null,
        detalle: detalleValido.map(item => ({
          id_detalle_orden: item.id_detalle_orden,
          id_producto: item.id_producto,
          cantidad: parseFloat(item.cantidad),
          unidad_medida: item.unidad_medida,
          descripcion: item.descripcion || item.producto,
          peso_unitario_kg: parseFloat(item.peso_unitario_kg) || 0,
          // Comex: subpartida (7020) + serie DAM (7023) por ítem.
          subpartida_nacional: esExportacion ? (item.subpartida_nacional || '').trim() : undefined,
          dam_serie: esExportacion ? (item.dam_serie || '').trim() : undefined
        }))
      };

      // Datos de comercio exterior (solo si la OV es exportación).
      if (esExportacion) {
        payload.destinatario_ruc = formData.destinatario_ruc;
        payload.destinatario_razon = formData.destinatario_razon;
        payload.puerto_codigo = formData.puerto_codigo;
        payload.traslado_total_dam = formData.traslado_total_dam;
        payload.docs_relacionados = docsRelacionados
          .filter((d) => d.tipo_cod && String(d.numero).trim())
          .map((d) => ({ tipo_cod: d.tipo_cod, tipo_desc: d.tipo_desc, serie: (d.serie || '').trim() || null, numero: String(d.numero).trim() }));
        payload.contenedores = contenedores
          .filter((c) => String(c.numero_contenedor).trim())
          .map((c) => ({ numero_contenedor: String(c.numero_contenedor).trim(), numero_precinto: (c.numero_precinto || '').trim() || null }));
      }

      const response = await guiasRemisionAPI.create(payload);

      if (!response.data.success) {
        setError(response.data.error || 'Error al crear guía de remisión');
        return;
      }

      const { numero_guia } = response.data.data;

      // La emisión a SUNAT se hace desde la card SEE del detalle de la orden (igual que la
      // factura): al volver a la OV aparece "Guía de Remisión Electrónica" con el botón
      // "Emitir GRE" → confirmación → estado y PDF. Aquí solo se crea la guía.
      setSuccess(`Guía ${numero_guia} creada. Emítela a SUNAT desde el detalle de la orden.`);
      setTimeout(() => {
        navigate(`/ventas/ordenes/${formData.id_orden_venta}`);
      }, 1500);

    } catch (err) {
      console.error('Error al crear guía:', err);
      // El backend ahora devuelve mensajes de error más específicos
      setError(err.response?.data?.error || 'Error al crear guía de remisión');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !orden) {
    return <Loading message="Cargando orden..." />;
  }

  if (!idOrden) {
    return (
      <div className="p-6">
        <Alert type="error" message="Debe especificar una orden de venta" />
        <button 
          className="btn btn-outline mt-4"
          onClick={() => navigate('/ventas/ordenes')}
        >
          <ArrowLeft size={20} />
          Ir a Órdenes de Venta
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button 
          className="btn btn-outline"
          onClick={() => navigate('/ventas/guias-remision')}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText size={32} className="text-primary" />
            Nueva Guía de Remisión
          </h1>
          <p className="text-muted">
            {orden ? `Desde orden ${orden.numero_orden}` : 'Preparando guía...'}
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {orden && (
        <div className="card border-l-4 border-primary bg-blue-50 mb-4">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <ShoppingCart size={24} className="text-primary" />
              <div className="flex-1">
                <p className="font-medium text-blue-900">
                  Orden de Venta: {orden.numero_orden}
                </p>
                <p className="text-sm text-blue-700">
                  Cliente: {orden.cliente} ({orden.ruc_cliente})
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-700">Estado</p>
                <span className={`badge ${orden.estado === 'Confirmada' ? 'badge-success' : 'badge-info'}`}>
                  {orden.estado}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card mb-4">
          <div className="card-header bg-gradient-to-r from-gray-50 to-white">
            <h2 className="card-title">
              <Calendar size={20} />
              Datos de la Guía
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">Fecha de Emisión *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.fecha_emision}
                  onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Fecha de Traslado *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.fecha_traslado}
                  onChange={(e) => setFormData({ ...formData, fecha_traslado: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Motivo de Traslado *</label>
                <select
                  className="form-select"
                  value={formData.motivo_traslado}
                  onChange={(e) => setFormData({ ...formData, motivo_traslado: e.target.value })}
                  required
                  disabled={Number(orden?.es_exportacion) === 1}
                >
                  <option value="Venta">Venta</option>
                  <option value="Traslado entre Almacenes">Traslado entre Almacenes</option>
                  <option value="Devolución">Devolución</option>
                  {Number(orden?.es_exportacion) === 1 && (
                    <option value="Exportación">Exportación</option>
                  )}
                </select>
                {Number(orden?.es_exportacion) === 1 && (
                  <p className="text-xs text-muted mt-1">
                    Operación de comercio exterior (la OV está marcada como exportación): motivo fijado en Exportación (código 09).
                  </p>
                )}
              </div>
              
              <div className="form-group">
                <label className="form-label">Tipo de Traslado *</label>
                <select
                  className="form-select"
                  value={formData.tipo_traslado}
                  onChange={(e) => setFormData({ ...formData, tipo_traslado: e.target.value })}
                  required
                >
                  <option value="Privado">Privado</option>
                  <option value="Público">Público</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Modalidad de Transporte *</label>
                <select
                  className="form-select"
                  value={formData.modalidad_transporte}
                  onChange={(e) => setFormData({ ...formData, modalidad_transporte: e.target.value })}
                  required
                >
                  <option value="Transporte Privado">Transporte Privado</option>
                  <option value="Transporte Público">Transporte Público</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Número de Bultos</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.numero_bultos}
                  onChange={(e) => setFormData({ ...formData, numero_bultos: e.target.value })}
                  min="0"
                />
              </div>

              {esPublico ? (
                <div className="form-group col-span-2">
                  <label className="form-label">Transportista (tercero) *</label>
                  {ovTransportista && ovTransportista.ruc ? (
                    // Heredado de la orden: se emite con estos datos (el backend lo registra en el maestro).
                    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
                      <p className="font-medium text-green-900">{ovTransportista.razon || '(sin razón social)'}</p>
                      <p className="text-green-700">RUC {ovTransportista.ruc}{ovTransportista.mtc ? ` · MTC ${ovTransportista.mtc}` : ''}</p>
                      <p className="text-xs text-muted mt-1">Tomado de "Transporte y Logística" de la orden.</p>
                    </div>
                  ) : ovTransportista ? (
                    // Orden por tercero pero sin RUC: no se puede emitir la GRE pública.
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                      La orden se entrega por tercero pero <b>no tiene el RUC del transportista</b>.
                      Complétalo en "Transporte y Logística" de la orden antes de crear la guía.
                    </div>
                  ) : (
                    // Público elegido manualmente (sin datos en la OV): elegir del maestro.
                    <div className="flex gap-2">
                      <select
                        className="form-select flex-1"
                        value={formData.id_transportista}
                        onChange={(e) => setFormData({ ...formData, id_transportista: e.target.value })}
                      >
                        <option value="">— Seleccionar transportista —</option>
                        {transportistas.map((t) => (
                          <option key={t.id_transportista} value={t.id_transportista}>
                            {t.razon_social} (RUC {t.ruc})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setShowNuevoTransportista(true)}
                        title="Registrar nuevo transportista"
                      >
                        <Plus size={18} />
                        Nuevo
                      </button>
                    </div>
                  )}
                </div>
              ) : esParticular ? (
                <div className="form-group col-span-2">
                  <label className="form-label">Carro particular del cliente (sin RUC)</label>
                  <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
                    <p className="font-medium text-green-900">{ovParticular?.conductor || '(conductor por completar)'}</p>
                    <p className="text-green-700">
                      {ovParticular?.dni ? `DNI ${ovParticular.dni}` : 'DNI —'}
                      {ovParticular?.licencia ? ` · Lic. ${ovParticular.licencia}` : ''}
                      {ovParticular?.placa ? ` · Placa ${ovParticular.placa}` : ''}
                    </p>
                    <p className="text-xs text-muted mt-1">Modalidad 02 (privado). Tomado de "Transporte y Logística" de la orden; podrás completar o editar estos datos en el wizard de emisión.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Conductor</label>
                    <select
                      className="form-select"
                      value={formData.id_conductor}
                      onChange={(e) => setFormData({ ...formData, id_conductor: e.target.value })}
                    >
                      <option value="">— Seleccionar conductor —</option>
                      {conductores.map((c) => (
                        <option key={c.id_empleado} value={c.id_empleado}>
                          {c.nombre_completo} (DNI {c.dni})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vehículo (placa)</label>
                    <select
                      className="form-select"
                      value={formData.id_vehiculo}
                      onChange={(e) => setFormData({ ...formData, id_vehiculo: e.target.value })}
                    >
                      <option value="">— Seleccionar vehículo —</option>
                      {vehiculos.map((v) => (
                        <option key={v.id_vehiculo} value={v.id_vehiculo}>
                          {v.placa}{v.marca_modelo ? ` — ${v.marca_modelo}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-muted mt-2">
              {esPublico
                ? 'En transporte público la GRE declara al transportista (RUC + razón social). La placa y el conductor los declara el propio transportista en su guía.'
                : esParticular
                  ? 'Carro particular del cliente (modalidad 02, privado): la GRE declara conductor + placa (texto libre, sin RUC). Se heredan de la orden y se pueden editar al emitir.'
                  : 'Conductor y vehículo son obligatorios para emitir la Guía de Remisión electrónica (GRE) en transporte privado.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="card">
            <div className="card-header bg-gradient-to-r from-green-50 to-white">
              <h2 className="card-title text-green-900">
                <MapPin size={20} />
                Punto de Partida
              </h2>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Dirección de Partida</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.direccion_partida}
                  onChange={(e) => setFormData({ ...formData, direccion_partida: e.target.value })}
                  placeholder="Vacío = se usará tu dirección fiscal"
                />
                <small className="text-gray-500">Prellenado con el domicilio fiscal de la empresa. Edítalo solo si el traslado sale de otro local.</small>
              </div>
              
              <div className="form-group">
                <label className="form-label">Ubigeo de Partida</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.ubigeo_partida}
                  onChange={(e) => setFormData({ ...formData, ubigeo_partida: e.target.value })}
                  placeholder="Vacío = ubigeo fiscal"
                  maxLength="6"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header bg-gradient-to-r from-blue-50 to-white">
              <h2 className="card-title text-blue-900">
                <MapPin size={20} />
                Punto de Llegada *
              </h2>
            </div>
            <div className="card-body">
              {esExportacion ? (
                <>
                  {/* Exportación: el punto de llegada es el PUERTO (catálogo estático con ubigeo fijo). */}
                  <div className="form-group">
                    <label className="form-label">Puerto de embarque *</label>
                    <select
                      className="form-select"
                      value={formData.puerto_codigo}
                      onChange={(e) => handlePuerto(e.target.value)}
                      required
                    >
                      <option value="">Selecciona un puerto…</option>
                      {puertos.map((p) => (
                        <option key={p.codigo} value={p.codigo}>{p.nombre} (ubigeo {p.ubigeo})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dirección de Llegada *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.direccion_llegada}
                      onChange={(e) => setFormData({ ...formData, direccion_llegada: e.target.value })}
                      placeholder="Se completa con el puerto; puedes ajustarla"
                      required
                    />
                    <small className="text-gray-500">Ubigeo de llegada: {formData.ubigeo_llegada || '—'} (del puerto)</small>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Dirección de Llegada *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.direccion_llegada}
                      onChange={(e) => setFormData({ ...formData, direccion_llegada: e.target.value })}
                      placeholder="Dirección completa de entrega"
                      required
                    />
                  </div>

                  <UbigeoSelector
                    value={formData.ubigeo_llegada}
                    required
                    onChange={(codigo, meta) => setFormData({
                      ...formData,
                      ubigeo_llegada: codigo,
                      // La ciudad se deriva del distrito seleccionado (referencial para el PDF).
                      ciudad_llegada: meta?.distrito || '',
                    })}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {esExportacion && (
          <div className="card mb-4">
            <div className="card-header bg-gradient-to-r from-amber-50 to-white">
              <h2 className="card-title text-amber-900">
                <FileText size={20} />
                Comercio Exterior (Exportación)
              </h2>
            </div>
            <div className="card-body space-y-5">
              {/* Destinatario (operador de puerto/depósito) */}
              <div className="form-group">
                <label className="form-label">Destinatario (operador de puerto/depósito) *</label>
                <div className="flex gap-2">
                  <select
                    className="form-select flex-1"
                    value={formData.destinatario_ruc}
                    onChange={(e) => handleDestinatario(e.target.value)}
                    required
                  >
                    <option value="">Selecciona un destinatario…</option>
                    {destinatariosComex.map((d) => (
                      <option key={d.ruc} value={d.ruc}>{d.razon_social} — RUC {d.ruc}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowNuevoDestinatario(true)}
                    title="Registrar nuevo destinatario"
                  >
                    <Plus size={18} />
                    Nuevo
                  </button>
                </div>
                <small className="text-gray-500">
                  Es el operador local que recibe en el puerto, NO el cliente extranjero (ese va en la factura).
                  {destinatariosComex.length === 0 && ' No hay destinatarios registrados: créalos con “Nuevo”.'}
                </small>
              </div>

              {/* Documentos relacionados (DAM) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">Documentos Relacionados *</label>
                  <button type="button" className="btn btn-sm btn-outline" onClick={addDoc}>
                    <Plus size={14} className="mr-1" /> Agregar documento
                  </button>
                </div>
                {docsRelacionados.map((d, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2 mb-2">
                    <div className="flex-1 min-w-[180px]">
                      <label className="text-xs text-muted">Tipo</label>
                      <select className="form-select" value={d.tipo_cod} onChange={(e) => setDoc(i, 'tipo_cod', e.target.value)}>
                        {DOC_TIPOS_COMEX.map((t) => <option key={t.cod} value={t.cod}>{t.desc}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-xs text-muted">Número (ej. 118-2026-40-70727)</label>
                      <input className="form-input" value={d.numero} onChange={(e) => setDoc(i, 'numero', e.target.value)} placeholder="{aduana}-{año}-{régimen}-{número}" />
                    </div>
                    {docsRelacionados.length > 1 && (
                      <button type="button" className="btn btn-sm btn-outline text-danger" onClick={() => removeDoc(i)}>Quitar</button>
                    )}
                  </div>
                ))}
                <small className="text-gray-500">Régimen DAM = 40 (exportación). El número no debe iniciar con cero.</small>
              </div>

              {/* Traslado total de la DAM/DS (alcance actual: Sí) */}
              <div className="form-group">
                <label className="form-label">¿Traslado por el total de los bienes de la DAM/DS?</label>
                <div className="text-sm">
                  <span className="badge badge-success">Sí</span>
                  <span className="text-gray-500 ml-2">El peso bruto y los bienes se toman de la DAM.</span>
                </div>
              </div>

              {/* Contenedores + precintos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">Contenedores *</label>
                  <button type="button" className="btn btn-sm btn-outline" onClick={addCont}>
                    <Plus size={14} className="mr-1" /> Agregar contenedor
                  </button>
                </div>
                {contenedores.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2 mb-2">
                    <div className="flex-1 min-w-[180px]">
                      <label className="text-xs text-muted">Nº de contenedor {i + 1}</label>
                      <input className="form-input" value={c.numero_contenedor} onChange={(e) => setCont(i, 'numero_contenedor', e.target.value)} placeholder="Ej. MRSU4280077" />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="text-xs text-muted">Nº de precinto (naviera)</label>
                      <input className="form-input" value={c.numero_precinto} onChange={(e) => setCont(i, 'numero_precinto', e.target.value)} placeholder="Ej. MLPE0153521" />
                    </div>
                    {contenedores.length > 1 && (
                      <button type="button" className="btn btn-sm btn-outline text-danger" onClick={() => removeCont(i)}>Quitar</button>
                    )}
                  </div>
                ))}
                <small className="text-gray-500">El precinto de agencia, si aplica, se escribe en Observaciones al emitir.</small>
              </div>
            </div>
          </div>
        )}

        <div className="card mb-4">
          <div className="card-header bg-gradient-to-r from-gray-50 to-white">
            <h2 className="card-title">
              <Package size={20} />
              Productos a Despachar
              <span className="badge badge-primary ml-2">{productosDisponibles.length}</span>
            </h2>
          </div>
          <div className="card-body p-0">
            {productosDisponibles.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th className="text-right">Stock Actual</th>
                        <th className="text-right">Pendiente Orden</th>
                        <th className="text-right">Cantidad *</th>
                        <th>UM</th>
                        <th className="text-right">Peso Unit. (kg)</th>
                        <th className="text-right">Peso Total (kg)</th>
                        {esExportacion && <th>Subpartida *</th>}
                        {esExportacion && <th className="text-center">Serie DAM</th>}
                        <th className="text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.map((item, index) => {
                        const producto = productosDisponibles.find(p => p.id_producto === item.id_producto);
                        const pesoTotal = parseFloat(item.cantidad) * parseFloat(item.peso_unitario_kg || 0);
                        const validacion = validacionProductos[item.id_producto] || { valido: true, errores: [], warnings: [] };
                        const hayError = validacion.errores && validacion.errores.length > 0;
                        const hayWarning = validacion.warnings && validacion.warnings.length > 0;
                        
                        return (
                          <tr key={index} className={hayError ? 'bg-red-50' : hayWarning ? 'bg-yellow-50' : ''}>
                            <td className="font-mono text-sm">{item.codigo_producto}</td>
                            <td>
                              <div className="font-medium">{item.producto}</div>
                              {hayError && validacion.errores.map((err, i) => (
                                <div key={i} className="text-xs text-danger mt-1 flex items-center gap-1">
                                  <AlertCircle size={12} />
                                  {err}
                                </div>
                              ))}
                              {!hayError && hayWarning && validacion.warnings.map((warn, i) => (
                                <div key={i} className="text-xs text-warning mt-1 flex items-center gap-1">
                                  <AlertCircle size={12} />
                                  {warn}
                                </div>
                              ))}
                            </td>
                            <td className="text-right">
                              <span className={`font-medium ${
                                parseFloat(item.cantidad) > parseFloat(producto?.stock_actual || 0) 
                                  ? 'text-danger' 
                                  : 'text-success'
                              }`}>
                                {parseFloat(producto?.stock_actual || 0).toFixed(4)}
                              </span>
                            </td>
                            <td className="text-right">
                              <span className="font-bold text-primary">
                                {parseFloat(producto?.cantidad_disponible || 0).toFixed(4)}
                              </span>
                            </td>
                            <td>
                              <input
                                type="number"
                                className={`form-input text-right ${hayError ? 'border-danger' : ''}`}
                                value={item.cantidad}
                                onChange={(e) => handleCantidadChange(index, e.target.value)}
                                min="0"
                                max={Math.min(producto?.cantidad_disponible || 0, producto?.stock_actual || 0)}
                                step="0.001"
                                required
                              />
                            </td>
                            <td className="text-sm text-muted">{item.unidad_medida}</td>
                            <td>
                              <input
                                type="number"
                                className="form-input text-right text-sm"
                                value={item.peso_unitario_kg}
                                onChange={(e) => handlePesoChange(index, e.target.value)}
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="text-right font-bold">
                              {pesoTotal.toFixed(2)}
                            </td>
                            {esExportacion && (
                              <td>
                                <input
                                  type="text"
                                  className="form-input text-sm"
                                  value={item.subpartida_nacional || ''}
                                  onChange={(e) => handleComexDetalle(index, 'subpartida_nacional', e.target.value)}
                                  placeholder="Ej. 3923210000"
                                />
                              </td>
                            )}
                            {esExportacion && (
                              <td>
                                <input
                                  type="text"
                                  className="form-input text-center text-sm"
                                  value={item.dam_serie || ''}
                                  onChange={(e) => handleComexDetalle(index, 'dam_serie', e.target.value)}
                                  placeholder="1"
                                />
                              </td>
                            )}
                            <td className="text-center">
                              {hayError ? (
                                <span className="badge badge-danger text-xs">Error</span>
                              ) : hayWarning ? (
                                <span className="badge badge-warning text-xs">Aviso</span>
                              ) : parseFloat(item.cantidad) > 0 ? (
                                <CheckCircle size={18} className="text-success mx-auto" />
                              ) : (
                                <span className="text-muted text-xs">Sin cant.</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary/5">
                        <td colSpan="7" className="text-right font-bold text-primary">PESO TOTAL:</td>
                        <td className="text-right font-bold text-primary text-lg">
                          {parseFloat(formData.peso_bruto_kg).toFixed(2)} kg
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                <div className="bg-blue-50 border-t border-blue-200 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={18} className="text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-medium">Validaciones automáticas:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Las cantidades se validan en tiempo real contra el stock y lo pendiente</li>
                        <li>Solo se despacharán productos con cantidad mayor a 0 y sin errores</li>
                        <li>El backend realizará una validación final antes de crear la guía</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center">
                <Package size={48} className="mx-auto text-muted opacity-20 mb-4" />
                <p className="text-muted font-medium">
                  No hay productos disponibles para despachar
                </p>
                <p className="text-sm text-muted">
                  Todos los productos de esta orden ya han sido despachados
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea
                className="form-textarea"
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                rows={3}
                placeholder="Observaciones adicionales sobre el traslado..."
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/ventas/guias-remision')}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || productosDisponibles.length === 0}
          >
            <Save size={20} />
            {loading ? 'Guardando…' : 'Crear Guía de Remisión'}
          </button>
        </div>
      </form>

      {showNuevoTransportista && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <div className="card-header flex items-center gap-2">
              <Truck size={20} />
              <h2 className="card-title">Nuevo Transportista</h2>
            </div>
            <div className="card-body space-y-3">
              <div className="form-group">
                <label className="form-label">RUC *</label>
                <input
                  type="text"
                  className="form-input"
                  value={nuevoTransportista.ruc}
                  onChange={(e) => setNuevoTransportista({ ...nuevoTransportista, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  placeholder="11 dígitos"
                  maxLength="11"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Razón Social *</label>
                <input
                  type="text"
                  className="form-input"
                  value={nuevoTransportista.razon_social}
                  onChange={(e) => setNuevoTransportista({ ...nuevoTransportista, razon_social: e.target.value })}
                  placeholder="Nombre de la empresa transportista"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nº Registro MTC</label>
                <input
                  type="text"
                  className="form-input"
                  value={nuevoTransportista.numero_mtc}
                  onChange={(e) => setNuevoTransportista({ ...nuevoTransportista, numero_mtc: e.target.value })}
                  placeholder="Opcional (referencia interna)"
                />
                <small className="text-gray-500">Solo referencia interna; no se envía en la GRE del remitente.</small>
              </div>
            </div>
            <div className="card-footer flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => { setShowNuevoTransportista(false); setNuevoTransportista({ ruc: '', razon_social: '', numero_mtc: '' }); }}
                disabled={guardandoTransportista}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={guardarTransportista}
                disabled={guardandoTransportista}
              >
                <Save size={18} />
                {guardandoTransportista ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNuevoDestinatario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <div className="card-header flex items-center gap-2">
              <Package size={20} />
              <h2 className="card-title">Nuevo Destinatario (comex)</h2>
            </div>
            <div className="card-body space-y-3">
              <div className="form-group">
                <label className="form-label">RUC *</label>
                <input
                  type="text"
                  className="form-input"
                  value={nuevoDestinatario.ruc}
                  onChange={(e) => setNuevoDestinatario({ ...nuevoDestinatario, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  placeholder="11 dígitos"
                  maxLength="11"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Razón Social *</label>
                <input
                  type="text"
                  className="form-input"
                  value={nuevoDestinatario.razon_social}
                  onChange={(e) => setNuevoDestinatario({ ...nuevoDestinatario, razon_social: e.target.value })}
                  placeholder="Operador de puerto / depósito temporal"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Código de establecimiento (anexo)</label>
                <input
                  type="text"
                  className="form-input"
                  value={nuevoDestinatario.codigo_establecimiento}
                  onChange={(e) => setNuevoDestinatario({ ...nuevoDestinatario, codigo_establecimiento: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="0 = matriz"
                />
                <small className="text-gray-500">Anexo del destinatario (SUNAT). Va en el punto de llegada del XML; “0” si es la matriz.</small>
              </div>
            </div>
            <div className="card-footer flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => { setShowNuevoDestinatario(false); setNuevoDestinatario({ ruc: '', razon_social: '', codigo_establecimiento: '0' }); }}
                disabled={guardandoDestinatario}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={guardarDestinatario}
                disabled={guardandoDestinatario}
              >
                <Save size={18} />
                {guardandoDestinatario ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NuevaGuiaRemision;