import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, Package, Truck, CheckCircle,
  XCircle, Clock, FileText, Building, DollarSign, MapPin,
  AlertCircle, TrendingUp, Plus, ShoppingCart, Calculator,
  CreditCard, Trash2, Factory, AlertTriangle, PackageOpen, User, Percent, Calendar,
  ChevronLeft, ChevronRight, Lock, Save, Box
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { ordenesVentaAPI, salidasAPI, clientesAPI, cuentasPagoAPI } from '../../config/api';

function DetalleOrdenVenta() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const getFechaLocal = () => {
    const fecha = new Date();
    const offset = fecha.getTimezoneOffset() * 60000;
    const fechaLocal = new Date(fecha.getTime() - offset);
    return fechaLocal.toISOString().split('T')[0];
  };
  
  const [orden, setOrden] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [salidas, setSalidas] = useState([]);
  const [resumenPagos, setResumenPagos] = useState(null);
  const [estadoCredito, setEstadoCredito] = useState(null);
  const [cuentasPago, setCuentasPago] = useState([]);
  
  const [vehiculos, setVehiculos] = useState([]);
  const [conductores, setConductores] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [descargandoPDF, setDescargandoPDF] = useState(null);
  
  const [navInfo, setNavInfo] = useState({ prev: null, next: null, current: 0, total: 0 });
  
  const [modalPrioridadOpen, setModalPrioridadOpen] = useState(false);
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [modalCrearOP, setModalCrearOP] = useState(false);
  const [modalDespacho, setModalDespacho] = useState(false);
  const [modalAnularOrden, setModalAnularOrden] = useState(false);
  const [modalEditarComprobante, setModalEditarComprobante] = useState(false);
  const [modalTransporteOpen, setModalTransporteOpen] = useState(false);
  const [modalRectificarOpen, setModalRectificarOpen] = useState(false);
  const [modalReservaStock, setModalReservaStock] = useState(false);
  
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidadOP, setCantidadOP] = useState('');
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [nuevoTipoComprobante, setNuevoTipoComprobante] = useState('');
  
  const [productoRectificar, setProductoRectificar] = useState(null);
  const [rectificarForm, setRectificarForm] = useState({ nueva_cantidad: '', motivo: '' });

  const [infoReservaStock, setInfoReservaStock] = useState(null);
  const [productosReservaSeleccionados, setProductosReservaSeleccionados] = useState([]);

  const [pagoForm, setPagoForm] = useState({
    id_cuenta_destino: '',
    fecha_pago: getFechaLocal(),
    monto_pagado: '',
    metodo_pago: 'Transferencia',
    numero_operacion: '',
    banco: '',
    observaciones: ''
  });

  const [despachoForm, setDespachoForm] = useState({
    detalles: [],
    fecha_despacho: getFechaLocal()
  });

  const [transporteForm, setTransporteForm] = useState({
    tipo_entrega: 'Vehiculo Empresa',
    id_vehiculo: '',
    id_conductor: '',
    transporte_nombre: '',
    transporte_placa: '',
    transporte_conductor: '',
    transporte_dni: '',
    fecha_entrega_estimada: ''
  });

  const handleWheelDisable = (e) => {
    e.target.blur();
  };

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 4
    }).format(valor);
  };

  const formatearMoneda = (valor, monedaOverride = null) => {
    const monedaUsar = monedaOverride || orden?.moneda;
    if (!monedaUsar && !valor) return '-';
    const simbolo = monedaUsar === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  useEffect(() => {
    cargarDatos();
    cargarNavegacion();
    cargarCatalogosTransporte();
  }, [id]);

  const cargarNavegacion = async () => {
    try {
        const response = await ordenesVentaAPI.getAll();
        if (response.data.success) {
            const lista = response.data.data;
            const currentIndex = lista.findIndex(o => String(o.id_orden_venta) === String(id));
            if (currentIndex !== -1) {
                setNavInfo({
                    prev: currentIndex > 0 ? lista[currentIndex - 1].id_orden_venta : null,
                    next: currentIndex < lista.length - 1 ? lista[currentIndex + 1].id_orden_venta : null,
                    current: currentIndex + 1,
                    total: lista.length
                });
            }
        }
    } catch (err) {
        console.error('Error cargando navegación', err);
    }
  };

  const cargarCatalogosTransporte = async () => {
    try {
      const [vehiculosRes, conductoresRes] = await Promise.all([
        ordenesVentaAPI.getVehiculos(),
        ordenesVentaAPI.getConductores()
      ]);
      if (vehiculosRes.data.success) setVehiculos(vehiculosRes.data.data);
      if (conductoresRes.data.success) setConductores(conductoresRes.data.data);
    } catch (error) {
      console.error("Error cargando catálogos transporte", error);
    }
  };

  const handleNavegar = (nuevoId) => {
    if (nuevoId) {
        navigate(`/ventas/ordenes/${nuevoId}`);
    }
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [ordenRes, pagosRes, resumenRes, salidasRes, cuentasRes] = await Promise.all([
        ordenesVentaAPI.getById(id),
        ordenesVentaAPI.getPagos(id),
        ordenesVentaAPI.getResumenPagos(id),
        ordenesVentaAPI.getSalidas(id).catch(() => ({ data: { success: true, data: [] } })),
        cuentasPagoAPI.getAll({ estado: 'Activo' })
      ]);
      
      if (ordenRes.data.success) {
        setOrden(ordenRes.data.data);
        const creditoRes = await clientesAPI.getEstadoCredito(ordenRes.data.data.id_cliente);
        if (creditoRes.data.success) {
          setEstadoCredito(creditoRes.data.data);
        }
      }
      
      if (pagosRes.data.success) setPagos(pagosRes.data.data);
      if (resumenRes.data.success) setResumenPagos(resumenRes.data.data);
      if (salidasRes.data.success) setSalidas(salidasRes.data.data || []);
      if (cuentasRes.data.success) setCuentasPago(cuentasRes.data.data || []);
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirDespacho = () => {
    const itemsPendientes = orden.detalle
      .filter(item => (parseFloat(item.cantidad) - parseFloat(item.cantidad_despachada || 0)) > 0)
      .map(item => ({
        id_producto: item.id_producto,
        codigo_producto: item.codigo_producto,
        producto: item.producto,
        unidad_medida: item.unidad_medida,
        cantidad_pendiente: parseFloat(item.cantidad) - parseFloat(item.cantidad_despachada || 0),
        cantidad_a_despachar: parseFloat(item.cantidad) - parseFloat(item.cantidad_despachada || 0),
        stock_disponible: parseFloat(item.stock_disponible || 0)
      }));

    if (itemsPendientes.length === 0) {
      setError("No hay productos pendientes de despacho.");
      return;
    }

    setDespachoForm({
      fecha_despacho: getFechaLocal(),
      detalles: itemsPendientes
    });
    setModalDespacho(true);
  };

  const handleCambioCantidadDespacho = (idProducto, valor) => {
    const nuevosDetalles = [...despachoForm.detalles];
    let val = parseFloat(valor);
    if (isNaN(val) || val < 0) val = 0;
    
    const index = nuevosDetalles.findIndex(item => item.id_producto === idProducto);
    if (index !== -1) {
        if (val > nuevosDetalles[index].cantidad_pendiente) {
            val = nuevosDetalles[index].cantidad_pendiente;
        }
        nuevosDetalles[index].cantidad_a_despachar = val;
        setDespachoForm({ ...despachoForm, detalles: nuevosDetalles });
    }
  };

  const getFechaConHora = (fechaString) => {
    return `${fechaString}T12:00:00`;
  };

  const handleRegistrarDespacho = async () => {
    try {
      setProcesando(true);
      setError(null);

      const itemsADespachar = despachoForm.detalles
        .filter(item => parseFloat(item.cantidad_a_despachar) > 0)
        .map(item => ({
          id_producto: item.id_producto,
          cantidad: parseFloat(item.cantidad_a_despachar)
        }));

      if (itemsADespachar.length === 0) {
        setError("Debe seleccionar al menos un producto para despachar");
        setProcesando(false);
        return;
      }

      const response = await ordenesVentaAPI.registrarDespacho(id, {
        detalles_despacho: itemsADespachar,
        fecha_despacho: getFechaConHora(despachoForm.fecha_despacho) 
      });

      if (response.data.success) {
        setSuccess(response.data.message);
        setModalDespacho(false);
        await cargarDatos();
      }

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al registrar despacho');
    } finally {
      setProcesando(false);
    }
  };

  const handleAnularDespacho = async (idSalida) => {
    if (!confirm('¿Está seguro de anular este despacho? Se revertirá el stock y las cantidades despachadas.')) return;

    try {
      setProcesando(true);
      setError(null);

      const response = await ordenesVentaAPI.anularDespacho(id, idSalida);

      if (response.data.success) {
        setSuccess(response.data.message);
        await cargarDatos();
      }

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al anular despacho');
    } finally {
      setProcesando(false);
    }
  };

  const handleAnularOrden = async () => {
    if (!motivoAnulacion.trim()) {
      setError('Debe ingresar un motivo de anulación');
      return;
    }

    try {
      setProcesando(true);
      setError(null);

      const response = await ordenesVentaAPI.anularOrden(id, motivoAnulacion);

      if (response.data.success) {
        setSuccess(response.data.message);
        setModalAnularOrden(false);
        setMotivoAnulacion('');
        await cargarDatos();
      }

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al anular orden');
    } finally {
      setProcesando(false);
    }
  };

  const handleAbrirReservaStock = async () => {
    try {
      setProcesando(true);
      setError(null);

      const response = await ordenesVentaAPI.reservarStock(id);

      if (response.data.success) {
        setInfoReservaStock(response.data.data);
        setProductosReservaSeleccionados(
          response.data.data.productos.map(p => ({
            id_producto: p.id_producto,
            id_detalle: p.id_detalle,
            nombre: p.nombre,
            cantidad_requerida: parseFloat(p.cantidad_requerida),
            stock_disponible: parseFloat(p.stock_disponible),
            stock_maximo_disponible: parseFloat(p.stock_maximo_disponible),
            cantidad_ya_reservada: parseFloat(p.cantidad_ya_reservada),
            cantidad_a_reservar: parseFloat(p.cantidad_a_reservar),
            estado_reserva: p.estado_reserva,
            tipo_reserva: p.estado_reserva === 'completo' ? 'completo' : 'parcial',
            seleccionado: parseFloat(p.cantidad_a_reservar) > 0
          }))
        );
        setModalReservaStock(true);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al consultar reserva de stock');
    } finally {
      setProcesando(false);
    }
  };

  const handleToggleProductoReserva = (id_detalle) => {
    setProductosReservaSeleccionados(prev => 
      prev.map(p => {
        if (p.id_detalle === id_detalle) {
          const nuevoSeleccionado = !p.seleccionado;
          const maximoPosible = Math.min(p.stock_maximo_disponible, p.cantidad_requerida);
          return { 
             ...p, 
             seleccionado: nuevoSeleccionado,
             cantidad_a_reservar: nuevoSeleccionado ? maximoPosible : 0,
             tipo_reserva: nuevoSeleccionado 
                ? (maximoPosible >= p.cantidad_requerida ? 'completo' : 'parcial') 
                : 'sin_stock'
          };
        }
        return p;
      })
    );
  };

  const handleCambioCantidadManualReserva = (id_detalle, valor) => {
    const nuevosProductos = [...productosReservaSeleccionados];
    const index = nuevosProductos.findIndex(p => p.id_detalle === id_detalle);
    
    if (index !== -1) {
      let val = parseFloat(valor);
      if (isNaN(val) || val < 0) val = 0;

      const item = nuevosProductos[index];
      const maximoPosible = Math.min(item.stock_maximo_disponible, item.cantidad_requerida);

      if (val > maximoPosible) {
        val = maximoPosible;
      }

      nuevosProductos[index].cantidad_a_reservar = val;
      
      if (val === 0) {
         nuevosProductos[index].tipo_reserva = 'sin_stock'; 
         nuevosProductos[index].seleccionado = false; 
      } else {
         nuevosProductos[index].seleccionado = true;
         if (val >= item.cantidad_requerida - 0.001) {
            nuevosProductos[index].tipo_reserva = 'completo';
         } else {
            nuevosProductos[index].tipo_reserva = 'parcial';
         }
      }

      setProductosReservaSeleccionados(nuevosProductos);
    }
  };

  const handleEjecutarReservaStock = async () => {
    try {
      setProcesando(true);
      setError(null);

      const productosAReservar = productosReservaSeleccionados.map(p => ({
          id_producto: p.id_producto,
          id_detalle: p.id_detalle,
          nueva_cantidad_reserva: parseFloat(p.cantidad_a_reservar)
      }));

      const response = await ordenesVentaAPI.ejecutarReservaStock(id, {
        productos_a_reservar: productosAReservar
      });

      if (response.data.success) {
        setSuccess(response.data.message);
        setModalReservaStock(false);
        await cargarDatos();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al ejecutar reserva de stock');
    } finally {
      setProcesando(false);
    }
  };

  const handleCambiarTipoComprobante = async () => {
    if (!nuevoTipoComprobante || nuevoTipoComprobante === orden.tipo_comprobante) {
      setError('Debe seleccionar un tipo de comprobante diferente');
      return;
    }

    try {
      setProcesando(true);
      setError(null);

      const response = await ordenesVentaAPI.actualizarTipoComprobante(id, {
        tipo_comprobante: nuevoTipoComprobante
      });

      if (response.data.success) {
        setSuccess(`Tipo de comprobante actualizado exitosamente a ${nuevoTipoComprobante}`);
        setModalEditarComprobante(false);
        setNuevoTipoComprobante('');
        await cargarDatos();
      }

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cambiar tipo de comprobante');
    } finally {
      setProcesando(false);
    }
  };

  const handleAbrirTransporte = () => {
    setTransporteForm({
      tipo_entrega: orden.tipo_entrega || 'Vehiculo Empresa',
      id_vehiculo: orden.id_vehiculo || '',
      id_conductor: orden.id_conductor || '',
      transporte_nombre: orden.transporte_nombre || '',
      transporte_placa: orden.transporte_placa || '',
      transporte_conductor: orden.transporte_conductor || '',
      transporte_dni: orden.transporte_dni || '',
      fecha_entrega_estimada: orden.fecha_entrega_estimada ? orden.fecha_entrega_estimada.split('T')[0] : ''
    });
    setModalTransporteOpen(true);
  };

  const handleGuardarTransporte = async (e) => {
    e.preventDefault();
    try {
      setProcesando(true);
      setError(null);
      
      const response = await ordenesVentaAPI.actualizarTransporte(id, transporteForm);
      
      if (response.data.success) {
        setSuccess('Datos de transporte actualizados');
        setModalTransporteOpen(false);
        await cargarDatos();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al actualizar transporte');
    } finally {
      setProcesando(false);
    }
  };

  const handleRegistrarPago = async (e) => {
    e.preventDefault();
    
    if (!pagoForm.id_cuenta_destino) {
        setError('Debe seleccionar una cuenta de pago');
        return;
    }

    const monto = parseFloat(pagoForm.monto_pagado);

    if (!monto || monto <= 0) {
      setError('Ingrese un monto válido');
      return;
    }

    if (resumenPagos && monto > parseFloat(resumenPagos.saldo_pendiente) + 0.1) {
      setError(`El monto no puede ser mayor al saldo pendiente (${formatearMoneda(resumenPagos.saldo_pendiente)})`);
      return;
    }
    
    try {
      setError(null);
      setProcesando(true);
      
      const response = await ordenesVentaAPI.registrarPago(id, {
        ...pagoForm,
        monto_pagado: monto
      });
      
      if (response.data.success) {
        setSuccess(`Pago registrado: ${response.data.data.numero_pago}`);
        setModalPagoOpen(false);
        setPagoForm({
          id_cuenta_destino: '',
          fecha_pago: getFechaLocal(),
          monto_pagado: '',
          metodo_pago: 'Transferencia',
          numero_operacion: '',
          banco: '',
          observaciones: ''
        });
        await cargarDatos();
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al registrar pago');
    } finally {
      setProcesando(false);
    }
  };

  const handleAnularPago = async (idPago, numeroPago) => {
    if (!confirm(`¿Está seguro de anular el pago ${numeroPago}?`)) return;
    
    try {
      setError(null);
      setProcesando(true);
      
      const response = await ordenesVentaAPI.anularPago(id, idPago);
      
      if (response.data.success) {
        setSuccess('Pago anulado exitosamente');
        await cargarDatos();
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al anular pago');
    } finally {
      setProcesando(false);
    }
  };

  const handleCambiarEstado = async (estado) => {
    if (estado !== 'Cancelada' && orden.tipo_venta === 'Crédito' && estadoCredito?.usar_limite_credito) {
      const disponible = orden.moneda === 'USD' ? estadoCredito.credito_usd.disponible : estadoCredito.credito_pen.disponible;
      const deudaPropiaDeEstaOrden = parseFloat(orden.total) - parseFloat(orden.monto_pagado || 0);
      if (deudaPropiaDeEstaOrden > disponible + 0.1) {
        setError(`Acción bloqueada: El cliente ha excedido su límite de crédito disponible (${formatearMoneda(disponible)}).`);
        return;
      }
    }
    try {
      setError(null);
      setProcesando(true);
      
      const response = await ordenesVentaAPI.actualizarEstado(
        id, 
        estado,
        estado === 'Entregada' ? getFechaLocal() : null
      );
      
      if (response.data.success) {
        setSuccess(response.data.message || `Estado actualizado a ${estado}`);
        await cargarDatos();
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cambiar estado');
    } finally {
      setProcesando(false);
    }
  };

  const handleCambiarPrioridad = async (prioridad) => {
    try {
      setError(null);
      setProcesando(true);
      
      const response = await ordenesVentaAPI.actualizarPrioridad(id, prioridad);
      
      if (response.data.success) {
        setOrden({ ...orden, prioridad });
        setSuccess(`Prioridad actualizada a ${prioridad}`);
        setModalPrioridadOpen(false);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cambiar prioridad');
    } finally {
      setProcesando(false);
    }
  };

  const handleDescargarPDF = async (tipoDocumento) => {
    try {
      setProcesando(true);
      setError(null);
      
      const response = await ordenesVentaAPI.descargarPDF(id, tipoDocumento);
      
      if (response.data.type === 'application/json') {
          const errorText = await response.data.text();
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || "Error generado por el servidor");
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      
      const clienteSanitizado = (orden.cliente || 'CLIENTE')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .toUpperCase();

      let nombreArchivo;

      if (tipoDocumento === 'comprobante') {
        const tipoDoc = (orden.tipo_comprobante || 'DOC').toUpperCase().replace(/\s+/g, '_');
        const numDoc = orden.numero_comprobante || orden.numero_orden;
        nombreArchivo = `${clienteSanitizado}_${tipoDoc}_${numDoc}.pdf`;
      } else {
        const nroOrden = orden.numero_orden || id;
        nombreArchivo = `${clienteSanitizado}_${nroOrden}.pdf`;
      }
        
      link.setAttribute('download', nombreArchivo);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess(`PDF descargado exitosamente`);

    } catch (err) {
      console.error("Error al descargar:", err);

      if (err.response && err.response.data instanceof Blob && err.response.data.type === 'application/json') {
        try {
            const errorText = await err.response.data.text();
            const errorJson = JSON.parse(errorText);
            setError(errorJson.error || 'Error desconocido del servidor');
        } catch (e) {
            setError('Error al procesar la respuesta del servidor');
        }
      } else {
        setError(err.message || 'Error de conexión al descargar PDF');
      }
    } finally {
      setProcesando(false);
    }
  };

  const handleDescargarPDFSalida = async () => {
    try {
      setProcesando(true);
      setError(null);
      
      if (!orden.id_salida) {
        setError('No hay salida de inventario asociada');
        return;
      }
      
      const response = await salidasAPI.generarPDF(orden.id_salida);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Salida-${orden.id_salida}.pdf`);
      
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess('PDF de salida descargado exitosamente');
      
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al descargar el PDF de salida');
    } finally {
      setProcesando(false);
    }
  };

  const handleDescargarSalidaEspecificaPDF = async (idSalida) => {
    try {
      setDescargandoPDF(idSalida);
      
      const response = await ordenesVentaAPI.descargarPDFDespacho(id, idSalida);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      
      link.setAttribute('download', `GuiaRemision-${orden.numero_orden}-${idSalida}.pdf`);
      
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess('Guía de Salida descargada');
    } catch (err) {
      console.error(err);
      setError('Error al descargar la guía de salida');
    } finally {
      setDescargandoPDF(null);
    }
  };

  const handleRectificarCantidad = async (e) => {
    e.preventDefault();
    if (!productoRectificar) return;

    try {
      setProcesando(true);
      setError(null);

      const response = await ordenesVentaAPI.rectificarCantidad(id, {
        id_producto: productoRectificar.id_producto,
        nueva_cantidad: parseFloat(rectificarForm.nueva_cantidad),
        motivo: rectificarForm.motivo
      });

      if (response.data.success) {
        setSuccess(`Cantidad rectificada: ${productoRectificar.producto}`);
        setModalRectificarOpen(false);
        setProductoRectificar(null);
        setRectificarForm({ nueva_cantidad: '', motivo: '' });
        await cargarDatos();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al rectificar cantidad');
    } finally {
      setProcesando(false);
    }
  };

  const getTipoImpuestoNombre = (valor) => {
    const codigo = String(valor || '').toUpperCase().trim();
    
    const tipos = {
      'IGV': 'IGV 18%',
      'EXO': 'Exonerado 0%',
      'INA': 'Inafecto 0%'
    };
    
    if (tipos[codigo]) return tipos[codigo];
    if (codigo === 'EXONERADO') return tipos['EXO'];
    if (codigo === 'INAFECTO') return tipos['INA'];
    
    return tipos['IGV'];
  };

  const getEstadoConfig = (estado) => {
    const configs = {
      'En Espera': { 
        icono: Clock, 
        clase: 'badge-warning', 
        color: 'border-warning', 
        siguientes: ['En Proceso', 'Cancelada'] 
      },
      'En Proceso': { 
        icono: Factory, 
        clase: 'badge-info', 
        color: 'border-info', 
        siguientes: ['Atendido por Producción', 'Cancelada']
      },
      'Atendido por Producción': {  
        icono: CheckCircle, 
        clase: 'badge-primary', 
        color: 'border-primary', 
        siguientes: ['Despacho Parcial', 'Despachada', 'Cancelada']
      },
      'Despacho Parcial': {
        icono: Truck,
        clase: 'badge-warning',
        color: 'border-warning',
        siguientes: ['Entregada']
      },
      'Despachada': { 
        icono: Truck, 
        clase: 'badge-primary', 
        color: 'border-primary', 
        siguientes: ['Entregada']
      },
      'Entregada': { 
        icono: CheckCircle, 
        clase: 'badge-success', 
        color: 'border-success', 
        siguientes: []
      },
      'Cancelada': { 
        icono: XCircle, 
        clase: 'badge-danger', 
        color: 'border-danger', 
        siguientes: []
      }
    };
    return configs[estado] || configs['En Espera'];
  };

  const getPrioridadConfig = (prioridad) => {
    const configs = {
      'Baja': { clase: 'badge-secondary', icono: '◯' },
      'Media': { clase: 'badge-info', icono: '◐' },
      'Alta': { clase: 'badge-warning', icono: '◉' },
      'Urgente': { clase: 'badge-danger', icono: '⚠' }
    };
    return configs[prioridad] || configs['Media'];
  };

  const getEstadoPagoConfig = (estadoPago) => {
    const configs = {
      'Pendiente': { clase: 'badge-warning', icono: Clock },
      'Parcial': { clase: 'badge-info', icono: CreditCard },
      'Pagado': { clase: 'badge-success', icono: CheckCircle }
    };
    return configs[estadoPago] || configs['Pendiente'];
  };

  const puedeDespachar = () => {
    if (!orden || orden.estado === 'Cancelada' || orden.estado === 'Entregada') {
      return false;
    }
    const pendientes = orden.detalle.some(item => (parseFloat(item.cantidad) - parseFloat(item.cantidad_despachada || 0)) > 0);
    return pendientes;
  };

  const puedeReservarStock = () => {
    if (!orden) return false;
    const estadosNoPermitidos = ['Cancelada', 'Despacho Parcial', 'Despachada', 'Entregada'];
    return !estadosNoPermitidos.includes(orden.estado);
  };

  if (loading) return <Loading message="Cargando orden de venta..." />;
  
  if (!orden) {
    return (
      <div className="p-6">
        <Alert type="error" message="Orden de venta no encontrada" />
        <button className="btn btn-outline mt-4" onClick={() => navigate('/ventas/ordenes')}>
          <ArrowLeft size={20} /> Volver
        </button>
      </div>
    );
  }

  const estadosConDespacho = ['Despacho Parcial', 'Despachada', 'Entregada'];
  const mostrarAlertaStock = !estadosConDespacho.includes(orden.estado);

  const columns = [
    {
      header: 'Código',
      accessor: 'codigo_producto',
      width: '90px',
      render: (value) => <span className="font-mono text-sm">{value}</span>
    },
    {
      header: 'Producto',
      accessor: 'producto',
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          {row.requiere_receta && (
            <span className="badge badge-warning badge-sm mt-1">
              <AlertCircle size={10} /> Prod
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Pedido',
      accessor: 'cantidad',
      width: '90px',
      align: 'right',
      render: (value, row) => (
        <div className="text-right">
          <div className="font-bold">{formatearNumero(value)}</div>
          <div className="text-[10px] text-muted">{row.unidad_medida}</div>
        </div>
      )
    },
    {
      header: 'Despachado',
      accessor: 'cantidad_despachada',
      width: '100px',
      align: 'right',
      render: (value) => (
        <span className={`font-bold ${parseFloat(value) > 0 ? 'text-success' : 'text-gray-400'}`}>
          {formatearNumero(value || 0)}
        </span>
      )
    },
    {
      header: 'Pendiente',
      accessor: 'cantidad_pendiente',
      width: '100px',
      align: 'right',
      render: (value) => {
        const pendiente = Math.max(0, parseFloat(value));
        return (
          <span className={`font-bold ${pendiente > 0 ? 'text-danger' : 'text-success'}`}>
             {formatearNumero(pendiente || 0)}
          </span>
        );
      }
    },
    {
      header: 'P. Final',
      accessor: 'precio_unitario',
      width: '100px',
      align: 'right',
      render: (value) => (
        <span className="font-medium text-primary">{formatearMoneda(value)}</span>
      )
    },
    {
      header: 'Estado',
      accessor: 'tiene_op',
      width: '140px',
      align: 'center',
      render: (value, row) => {
        const pendiente = parseFloat(row.cantidad_pendiente || 0);
        
        if (pendiente <= 0) return <span className="badge badge-success"><CheckCircle size={12}/> Completado</span>;

        if (row.stock_reservado === 1) {
            return (
                <div className="flex flex-col gap-1">
                    <span className="badge badge-success bg-green-100 text-green-700 border-green-200">
                        <Lock size={10} className="mr-1"/> Reservado
                    </span>
                </div>
            );
        }
        
        if (row.stock_reservado === 2) {
             return (
                <div className="flex flex-col gap-1">
                    <span className="badge badge-warning bg-yellow-100 text-yellow-800 border-yellow-200">
                        <Lock size={10} className="mr-1"/> Res. Parcial
                    </span>
                </div>
            );
        }

        const stockDisponible = parseFloat(row.stock_disponible || 0);
        const cantidadRequerida = parseFloat(row.cantidad);
        const stockSuficiente = stockDisponible >= cantidadRequerida;

        if (stockSuficiente && mostrarAlertaStock) {
            return (
              <div className="flex flex-col gap-1">
                  <span className="text-xs text-success font-bold flex items-center justify-center gap-1">
                      <CheckCircle size={12} /> Stock Cubierto
                  </span>
              </div>
            );
        }

        if (!row.requiere_receta) {
          if (!mostrarAlertaStock) {
            return <span className="badge badge-info">En despacho</span>;
          }
          return (
            <div className="flex flex-col gap-1">
              <span className="badge badge-warning">Stock Insuficiente</span>
              <span className="text-xs text-muted">Stock: {stockDisponible.toFixed(2)}</span>
            </div>
          );
        }

        if (value > 0) {
          return (
            <div className="flex flex-col gap-1">
                <span className="badge badge-info">
                    <Factory size={12} />
                    En producción
                </span>
                <span className="text-[10px] text-danger text-center">
                    Falta: {Math.max(0, cantidadRequerida - stockDisponible).toFixed(2)}
                </span>
            </div>
          );
        }

        const faltante = Math.max(0, cantidadRequerida - stockDisponible);

        return (
          <div className="flex flex-col gap-1">
            <span className="badge badge-warning">
              <AlertCircle size={12} />
              Pendiente OP
            </span>
            {mostrarAlertaStock && faltante > 0 && (
                <span className="text-xs text-danger">
                  Falta: {faltante.toFixed(2)} {row.unidad_medida}
                </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Acciones',
      accessor: 'id_producto',
      width: '140px',
      align: 'center',
      render: (value, row) => {
        if (orden?.estado === 'Cancelada') return '-';

        return (
          <div className="flex items-center justify-center gap-1">
            {row.requiere_receta && !estadosConDespacho.includes(orden.estado) && (
               <button
                 className={`btn btn-xs ${parseFloat(row.stock_disponible) >= parseFloat(row.cantidad) ? 'btn-outline btn-primary' : 'btn-primary'}`}
                 onClick={() => {
                   setProductoSeleccionado(row);
                   const stockDisponible = parseFloat(row.stock_disponible || 0);
                   const cantidadRequerida = parseFloat(row.cantidad);
                   const faltante = Math.max(0, cantidadRequerida - stockDisponible);
                   setCantidadOP(faltante > 0 ? faltante : cantidadRequerida);
                   setModalCrearOP(true);
                 }}
                 disabled={procesando}
                 title="Crear Orden Producción"
               >
                 <Factory size={12} />
               </button>
            )}

            <button
              className="btn btn-xs btn-ghost text-orange-600 hover:bg-orange-50 border border-transparent hover:border-orange-200"
              onClick={() => {
                setProductoRectificar(row);
                setRectificarForm({ 
                    nueva_cantidad: row.cantidad, 
                    motivo: '' 
                });
                setModalRectificarOpen(true);
              }}
              disabled={procesando}
              title="Rectificar Cantidad / Corregir Inventario"
            >
              <Edit size={12} />
            </button>
          </div>
        );
      }
    },
    {
      header: 'Subtotal',
      accessor: 'valor_venta',
      width: '120px',
      align: 'right',
      render: (value) => (
        <span className="font-bold text-primary">{formatearMoneda(value)}</span>
      )
    }
  ];

  const columnsPagos = [
    {
      header: 'N° Pago',
      accessor: 'numero_pago',
      width: '140px',
      render: (value) => <span className="font-mono font-bold text-sm">{value}</span>
    },
    {
      header: 'Fecha',
      accessor: 'fecha_pago',
      width: '110px',
      render: (value) => formatearFecha(value)
    },
    {
      header: 'Monto',
      accessor: 'monto_pagado',
      width: '120px',
      align: 'right',
      render: (value) => <span className="font-bold text-success">{formatearMoneda(value)}</span>
    },
    {
      header: 'Método',
      accessor: 'metodo_pago',
      width: '130px'
    },
    {
      header: 'N° Operación',
      accessor: 'numero_operacion',
      width: '140px',
      render: (value) => value || '-'
    },
    {
      header: 'Banco',
      accessor: 'banco',
      width: '130px',
      render: (value) => value || '-'
    },
    {
      header: 'Registrado por',
      accessor: 'registrado_por',
      width: '150px'
    },
    {
      header: 'Acciones',
      accessor: 'id_pago_orden',
      width: '100px',
      align: 'center',
      render: (value, row) => (
        <button
          className="btn btn-sm btn-danger"
          onClick={() => handleAnularPago(value, row.numero_pago)}
          title="Anular pago"
          disabled={procesando || orden.estado === 'Cancelada'}
        >
          <Trash2 size={14} />
        </button>
      )
    }
  ];

  const estadoConfig = getEstadoConfig(orden.estado);
  const IconoEstado = estadoConfig.icono;
  const prioridadConfig = getPrioridadConfig(orden.prioridad);
  const estadoPagoConfig = getEstadoPagoConfig(orden.estado_pago);
  const IconoEstadoPago = estadoPagoConfig.icono;

  const productosRequierenOP = orden.detalle.filter(item => {
    if(item.stock_reservado === 1) return false;
    if(!mostrarAlertaStock) return false;

    const stockDisponible = parseFloat(item.stock_disponible || 0);
    const cantidadRequerida = parseFloat(item.cantidad);
    return item.requiere_receta && 
           stockDisponible < cantidadRequerida &&
           orden.estado !== 'Cancelada' &&
           orden.estado !== 'Entregada' &&
           orden.estado !== 'Despachada';
  });

  const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO'].includes(String(orden.tipo_impuesto || '').toUpperCase());
  const totalCorregido = esSinImpuesto ? parseFloat(orden.subtotal) : parseFloat(orden.total);
  const saldoCorregido = resumenPagos ? Math.max(0, totalCorregido - parseFloat(resumenPagos.monto_pagado)) : 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button className="btn btn-outline" onClick={() => navigate('/ventas/ordenes')}>
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex items-center bg-white rounded-lg border border-gray-200 px-1 py-0.5">
            <button 
                className="btn btn-sm btn-ghost p-1" 
                disabled={!navInfo.prev} 
                onClick={() => handleNavegar(navInfo.prev)}
                title="Orden anterior"
            >
                <ChevronLeft size={20} />
            </button>
            <span className="text-xs font-medium text-gray-500 mx-2">
                {navInfo.current} / {navInfo.total}
            </span>
            <button 
                className="btn btn-sm btn-ghost p-1" 
                disabled={!navInfo.next} 
                onClick={() => handleNavegar(navInfo.next)}
                title="Orden siguiente"
            >
                <ChevronRight size={20} />
            </button>
          </div>

          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart size={32} />
              Orden de Venta {orden.numero_orden}
              {orden.stock_reservado === 1 && (
                  <span className="badge badge-sm badge-success ml-2 border border-green-500 text-white" title="Stock reservado físicamente para toda la orden">
                      <Lock size={12} className="mr-1"/> Reserva Total
                  </span>
              )}
              {orden.stock_reservado === 2 && (
                  <span className="badge badge-sm badge-warning ml-2 border border-yellow-500 text-yellow-800" title="Stock reservado parcialmente">
                      <Lock size={12} className="mr-1"/> Reserva Parcial
                  </span>
              )}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-muted">
                Emitida el {formatearFecha(orden.fecha_emision)}
              </p>
              
              {orden.tipo_comprobante && orden.tipo_comprobante !== 'Factura' && (
                <div className="flex items-center gap-2">
                  <span className="badge badge-info">
                    {orden.tipo_comprobante}
                  </span>
                  <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 rounded">
                    {orden.numero_comprobante || 'Pendiente'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          {puedeReservarStock() && (
            <button
              className="btn btn-warning border-yellow-400 text-yellow-800 hover:bg-yellow-100"
              onClick={handleAbrirReservaStock}
              disabled={procesando}
              title="Reservar/Editar stock físico"
            >
              <Lock size={20} /> {orden.stock_reservado > 0 ? 'Editar Reserva' : 'Reservar Stock'}
            </button>
          )}

          {puedeDespachar() && (
             <button 
               className="btn btn-primary shadow-lg shadow-primary/20" 
               onClick={handleAbrirDespacho}
               disabled={procesando}
               title="Registrar Despacho Parcial o Total"
             >
               <Truck size={20} /> Registrar Despacho
             </button>
          )}

          <button 
            className="btn btn-outline" 
            onClick={() => handleDescargarPDF('orden')} 
            disabled={procesando}
            title="Descargar Orden Interna"
          >
            <FileText size={20} /> PDF Orden
          </button>

          {orden.tipo_comprobante && orden.tipo_comprobante !== 'Factura' && (
            <button 
              className="btn btn-outline border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" 
              onClick={() => handleDescargarPDF('comprobante')} 
              disabled={procesando}
              title={`Descargar ${orden.tipo_comprobante}`}
            >
              <Download size={20} /> PDF {orden.tipo_comprobante}
            </button>
          )}
          
          {orden.estado === 'Despachada' && orden.id_salida && (
            <button 
              className="btn btn-success" 
              onClick={handleDescargarPDFSalida}
              disabled={procesando}
              title="Descargar PDF de Salida de Inventario"
            >
              <PackageOpen size={20} /> PDF Salida
            </button>
          )}
          
          {orden.estado !== 'Cancelada' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/ventas/ordenes/${id}/editar`)}
              >
                <Edit size={20} /> Editar
              </button>
              
              {orden.estado !== 'Entregada' && (
                <button
                  className="btn btn-danger"
                  onClick={() => setModalAnularOrden(true)}
                  disabled={procesando}
                >
                  <XCircle size={20} /> Anular Orden
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {productosRequierenOP.length > 0 && (
        <div className="alert alert-warning mb-4">
          <AlertTriangle size={20} />
          <div>
            <strong>Atención:</strong> Hay {productosRequierenOP.length} producto(s) sin stock suficiente que requieren orden de producción.
            <br />
            <small>Puede crear órdenes de producción para los productos faltantes o producir cantidades adicionales.</small>
          </div>
        </div>
      )}

      {orden.estado === 'Despachada' && orden.id_salida && (
        <div className="alert alert-info mb-4">
          <PackageOpen size={20} />
          <div>
            <strong>Salida de Inventario Generada:</strong> Se ha registrado automáticamente la salida #{orden.id_salida}.
            <br />
            <small>Puede descargar el PDF de salida usando el botón "PDF Salida" en la parte superior.</small>
          </div>
        </div>
      )}

      <div className="card mb-6 border-l-4 border-primary">
        <div className="card-header">
          <h2 className="card-title">
            <TrendingUp size={20} />
            Estado de la Orden
          </h2>
        </div>
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-xl bg-gradient-to-br ${
                orden.estado === 'En Espera' ? 'from-yellow-100 to-yellow-200' :
                orden.estado === 'En Proceso' ? 'from-blue-100 to-blue-200' :
                orden.estado === 'Atendido por Producción' ? 'from-green-100 to-green-200' :
                orden.estado === 'Despacho Parcial' ? 'from-orange-100 to-orange-200' :
                orden.estado === 'Despachada' ? 'from-purple-100 to-purple-200' :
                orden.estado === 'Entregada' ? 'from-emerald-100 to-emerald-200' :
                'from-red-100 to-red-200'
              }`}>
                <IconoEstado size={40} className={
                  orden.estado === 'En Espera' ? 'text-yellow-600' :
                  orden.estado === 'En Proceso' ? 'text-blue-600' :
                  orden.estado === 'Atendido por Producción' ? 'text-green-600' :
                  orden.estado === 'Despacho Parcial' ? 'text-orange-600' :
                  orden.estado === 'Despachada' ? 'text-purple-600' :
                  orden.estado === 'Entregada' ? 'text-emerald-600' :
                  'text-red-600'
                } />
              </div>
              <div>
                <p className="text-sm uppercase font-semibold text-muted mb-1">Estado Actual</p>
                <h3 className="text-3xl font-bold">{orden.estado}</h3>
                {orden.fecha_vencimiento && (
                  <p className={`text-sm mt-1 ${new Date(orden.fecha_vencimiento) < new Date() && orden.estado_pago !== 'Pagado' ? 'text-danger font-bold' : 'text-muted'}`}>
                    Vence: {formatearFecha(orden.fecha_vencimiento)}
                  </p>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm uppercase font-semibold text-muted mb-2">Prioridad</p>
              <button 
                className={`badge ${prioridadConfig.clase} text-lg px-4 py-2`}
                onClick={() => setModalPrioridadOpen(true)}
                disabled={orden.estado === 'Cancelada' || orden.estado === 'Entregada'}
              >
                {prioridadConfig.icono} {orden.prioridad}
              </button>
            </div>
          </div>

          {orden.estado !== 'Cancelada' && orden.estado !== 'Entregada' && (
            <div className="border-t border-gray-200 pt-4 mt-2">
              <p className="text-xs font-bold uppercase text-muted mb-3">Cambiar Estado:</p>
              <div className="flex gap-3 flex-wrap">
                {estadoConfig.siguientes.map(estado => {
                  const config = getEstadoConfig(estado);
                  const Icono = config.icono;
                  const esActual = orden.estado === estado;
                  
                  let colorClases = '';
                  if (estado === 'En Proceso') {
                    colorClases = esActual 
                      ? 'bg-blue-500 text-white cursor-not-allowed opacity-70' 
                      : 'bg-white text-blue-600 border-2 border-blue-500 hover:bg-blue-500 hover:text-white';
                  } else if (estado === 'Atendido por Producción') {
                    colorClases = esActual 
                      ? 'bg-green-500 text-white cursor-not-allowed opacity-70' 
                      : 'bg-white text-green-600 border-2 border-green-500 hover:bg-green-500 hover:text-white';
                  } else if (estado === 'Despacho Parcial') {
                    colorClases = esActual 
                      ? 'bg-orange-500 text-white cursor-not-allowed opacity-70' 
                      : 'bg-white text-orange-600 border-2 border-orange-500 hover:bg-orange-500 hover:text-white';
                  } else if (estado === 'Despachada') {
                    colorClases = esActual 
                      ? 'bg-purple-500 text-white cursor-not-allowed opacity-70' 
                      : 'bg-white text-purple-600 border-2 border-purple-500 hover:bg-purple-500 hover:text-white';
                  } else if (estado === 'Entregada') {
                    colorClases = esActual 
                      ? 'bg-emerald-500 text-white cursor-not-allowed opacity-70' 
                      : 'bg-white text-emerald-600 border-2 border-emerald-500 hover:bg-emerald-500 hover:text-white';
                  } else if (estado === 'Cancelada') {
                    colorClases = esActual 
                      ? 'bg-red-500 text-white cursor-not-allowed opacity-70' 
                      : 'bg-white text-red-600 border-2 border-red-500 hover:bg-red-500 hover:text-white';
                  }

                  return (
                    <button
                      key={estado}
                      className={`btn btn-sm font-semibold transition-all ${colorClases}`}
                      onClick={() => handleCambiarEstado(estado)}
                      disabled={esActual || procesando}
                    >
                      <Icono size={16} className="mr-1.5" />
                      {estado}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        
        <div className="card h-full">
            <div className="card-header">
                <h2 className="card-title"><Building size={20} /> Cliente</h2>
            </div>
            <div className="card-body space-y-2">
                <div>
                    <label className="text-sm font-medium text-muted">Razón Social:</label>
                    <p className="font-bold">{orden.cliente}</p>
                </div>
                <div>
                    <label className="text-sm font-medium text-muted">RUC:</label>
                    <p>{orden.ruc_cliente}</p>
                </div>
                <div>
                    <label className="text-sm font-medium text-muted">Comercial Asignado:</label>
                    <p className="flex items-center gap-1"><User size={14}/> {orden.comercial || 'Sin asignar'}</p>
                </div>
                {estadoCredito?.usar_limite_credito && (
                    <div className="pt-3 mt-2 border-t border-gray-100">
                        <p className="text-xs font-bold text-primary uppercase flex items-center gap-1"><CreditCard size={14}/> Crédito Disponible</p>
                        <div className="grid grid-cols-1 gap-1 mt-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted">PEN:</span>
                                <span className="font-bold text-green-600">{formatearMoneda(estadoCredito.credito_pen.disponible, 'PEN')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">USD:</span>
                                <span className="font-bold text-blue-600">$ {parseFloat(estadoCredito.credito_usd.disponible).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="card h-full">
            <div className="card-header">
                <h2 className="card-title"><DollarSign size={20} /> Condiciones Comerciales</h2>
            </div>
            <div className="card-body space-y-2">
                
                {orden.id_cotizacion && (
                    <div className="pb-2 mb-2 border-b border-gray-100">
                        <label className="text-sm font-medium text-muted">Cotización Origen:</label>
                        <button 
                            className="flex items-center gap-2 text-primary font-bold hover:underline"
                            onClick={() => navigate(`/ventas/cotizaciones/${orden.id_cotizacion}`)}
                        >
                            <FileText size={16} />
                            {orden.numero_cotizacion}
                        </button>
                    </div>
                )}

                {orden.orden_compra_cliente && (
                    <div className="pb-2 mb-2 border-b border-gray-100 bg-orange-50 p-3 rounded">
                        <label className="text-sm font-medium text-muted">O/C Cliente:</label>
                        <p className="font-mono font-bold text-orange-800">{orden.orden_compra_cliente}</p>
                    </div>
                )}

                <div className="pb-2 mb-2 border-b border-gray-100">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <label className="text-sm font-medium text-muted">Tipo Documento:</label>
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-primary">{orden.tipo_comprobante || 'Orden Venta'}</p>
                                {!orden.comprobante_editado && orden.estado !== 'Cancelada' && (
                                    <button
                                        className="btn btn-xs btn-outline text-xs"
                                        onClick={() => {
                                            setNuevoTipoComprobante(orden.tipo_comprobante);
                                            setModalEditarComprobante(true);
                                        }}
                                        title="Editar tipo de comprobante (solo una vez)"
                                    >
                                        <Edit size={12} /> Editar
                                    </button>
                                )}
                                {orden.comprobante_editado && (
                                    <span className="badge badge-sm badge-secondary" title="Ya se editó el tipo de comprobante">
                                        <Lock size={10} /> Editado
                                    </span>
                                )}
                            </div>
                        </div>
                        {orden.tipo_comprobante && orden.tipo_comprobante !== 'Factura' && (
                            <div>
                                <label className="text-sm font-medium text-muted">N° Serie:</label>
                                <p className="font-mono">{orden.numero_comprobante || '-'}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-sm font-medium text-muted">Moneda:</label>
                        <p className="font-semibold">{orden.moneda === 'USD' ? 'Dólares' : 'Soles'}</p>
                    </div>
                    {orden.moneda === 'USD' && (
                        <div>
                            <label className="text-sm font-medium text-muted">T.C.:</label>
                            <p>{parseFloat(orden.tipo_cambio).toFixed(4)}</p>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-sm font-medium text-muted">Tipo Venta:</label>
                        <span className={`badge ${orden.tipo_venta === 'Contado' ? 'badge-success' : 'badge-warning'}`}>
                            {orden.tipo_venta || 'Contado'}
                        </span>
                    </div>
                    {orden.tipo_venta === 'Crédito' ? (
                        <div>
                            <label className="text-sm font-medium text-muted">Crédito / Vence:</label>
                            <div className="flex flex-col">
                                <span className="font-semibold">{orden.dias_credito} días</span>
                                {orden.fecha_vencimiento && (
                                    <span className={`text-xs flex items-center gap-1 ${new Date(orden.fecha_vencimiento) < new Date() && orden.estado_pago !== 'Pagado' ? 'text-red-600 font-bold' : 'text-muted'}`}>
                                        <Calendar size={10} /> {formatearFecha(orden.fecha_vencimiento)}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        orden.dias_credito > 0 && (
                            <div>
                                <label className="text-sm font-medium text-muted">Crédito:</label>
                                <p>{orden.dias_credito} días</p>
                            </div>
                        )
                    )}
                </div>
                <div>
                    <label className="text-sm font-medium text-muted">Forma Pago:</label>
                    <p>{orden.forma_pago || orden.plazo_pago || '-'}</p>
                </div>
            </div>
        </div>

        <div className="card h-full">
            <div className="card-header flex justify-between items-center">
                <h2 className="card-title"><MapPin size={20} /> Entrega y Logística</h2>
                <button 
                  className="btn btn-xs btn-outline" 
                  onClick={handleAbrirTransporte}
                  title="Editar datos de transporte"
                  disabled={orden.estado === 'Cancelada'}
                >
                  <Edit size={14} />
                </button>
            </div>
            <div className="card-body space-y-2">
                <div>
                    <label className="text-sm font-medium text-muted">Fecha Estimada:</label>
                    <p className="flex items-center gap-1">
                        <Calendar size={14} />
                        {formatearFecha(orden.fecha_entrega_estimada)}
                    </p>
                </div>
                <div>
                    <label className="text-sm font-medium text-muted">Dirección:</label>
                    <p className="text-sm">{orden.direccion_entrega || orden.direccion_cliente || orden.lugar_entrega || '-'}</p>
                </div>
                {orden.ciudad_entrega && (
                    <div>
                        <label className="text-sm font-medium text-muted">Ciudad:</label>
                        <p>{orden.ciudad_entrega}</p>
                    </div>
                )}
                
                <div className="pt-3 mt-2 border-t border-gray-100">
                    <label className="text-sm font-medium text-muted">Progreso Entrega:</label>
                    {(() => {
                        const totalQty = orden.detalle.reduce((acc, i) => acc + parseFloat(i.cantidad), 0);
                        const despachadoQty = orden.detalle.reduce((acc, i) => acc + parseFloat(i.cantidad_despachada || 0), 0);
                        const pct = totalQty > 0 ? (despachadoQty / totalQty) * 100 : 0;
                        return (
                            <div className="flex items-center gap-3 mt-1">
                                <div className="flex-1 bg-gray-200 rounded-full h-4">
                                    <div className="bg-primary h-4 rounded-full" style={{ width: `${pct}%` }}></div>
                                </div>
                                <span className="text-sm font-bold text-gray-700 min-w-[3rem] text-right">
                                    {pct.toFixed(0)}%
                                </span>
                            </div>
                        )
                    })()}
                </div>

                <div className="pt-3 mt-2 border-t border-gray-100">
                    <p className="text-xs font-bold text-indigo-700 uppercase mb-2">Transporte Asignado</p>
                    {orden.tipo_entrega === 'Vehiculo Empresa' ? (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                            <Truck size={14} className="text-indigo-600" />
                            <div>
                                <span className="text-xs text-muted">Vehículo:</span>
                                <span className="font-bold ml-1">{orden.vehiculo_placa_interna || orden.vehiculo_placa || 'No asignado'}</span>
                                {orden.vehiculo_modelo && <span className="text-xs text-muted ml-1">({orden.vehiculo_modelo})</span>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <User size={14} className="text-indigo-600" />
                            <div>
                                <span className="text-xs text-muted">Conductor:</span>
                                <span className="font-bold ml-1">{orden.conductor_nombre || orden.conductor || 'No asignado'}</span>
                            </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm">
                        <p><span className="font-bold">Privado:</span> {orden.transporte_nombre}</p>
                        <p><span className="font-bold">Placa:</span> {orden.transporte_placa}</p>
                        <p><span className="font-bold">Chofer:</span> {orden.transporte_conductor}</p>
                      </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header flex justify-between items-center">
          <h2 className="card-title"><Package size={20} /> Detalle de Productos</h2>
          <span className="badge badge-neutral">{orden.detalle.length} items</span>
        </div>
        <div className="card-body">
          <Table columns={columns} data={orden.detalle} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {orden.observaciones && (
          <div className="card h-full">
            <div className="card-header"><h3 className="card-title">Observaciones</h3></div>
            <div className="card-body"><p className="whitespace-pre-wrap">{orden.observaciones}</p></div>
          </div>
        )}
        <div className={`card ${!orden.observaciones ? 'md:col-span-2' : ''} ml-auto w-full`}>
          <div className="card-header">
            <h3 className="card-title"><Calculator size={20} /> Totales</h3>
          </div>
          <div className="card-body space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span>Sub Total:</span>
              <span className="font-bold">{formatearMoneda(orden.subtotal)}</span>
            </div>
            {orden.total_comision > 0 && (
              <div className="flex justify-between py-2 border-b text-yellow-600">
                <span className="font-medium">Total Comisiones ({parseFloat(orden.porcentaje_comision_promedio || 0).toFixed(2)}%):</span>
                <span className="font-bold">{formatearMoneda(orden.total_comision)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b">
              <span className="flex items-center gap-1">
                <Percent size={14} />
                {getTipoImpuestoNombre(orden.tipo_impuesto)}:
              </span>
              <span className="font-bold">
                {formatearMoneda(esSinImpuesto ? 0 : orden.igv)}
              </span>
            </div>
            <div className="flex justify-between py-3 bg-gray-100 text-black px-4 rounded-lg">
              <span className="font-bold">TOTAL:</span>
              <span className="font-bold text-xl">{formatearMoneda(totalCorregido)}</span>
            </div>
            
            {orden.moneda === 'USD' && parseFloat(orden.tipo_cambio || 0) > 1 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <div className="flex justify-between items-center text-blue-900">
                  <span className="font-medium">Equivalente en Soles:</span>
                  <span className="font-bold">
                    S/ {formatearNumero(totalCorregido * parseFloat(orden.tipo_cambio))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {salidas.length > 0 && (
         <div className="card mb-6 border-l-4 border-info">
             <div className="card-header flex items-center gap-2">
                 <Truck size={20} className="text-info"/>
                 <h2 className="card-title">Historial de Despachos (Guías de Salida)</h2>
             </div>
             <div className="card-body">
                 <Table 
                     columns={[
                         { header: 'N° Salida', accessor: 'numero_salida', width: '120px', render: val => `SAL-${String(val).padStart(6,'0')}` },
                         { header: 'Fecha', accessor: 'fecha_salida', width: '120px', render: val => formatearFecha(val) },
                         { 
                           header: 'Estado', 
                           accessor: 'estado', 
                           width: '100px',
                           align: 'center',
                           render: (val) => (
                             <span className={`badge ${val === 'Activo' ? 'badge-success' : 'badge-danger'}`}>
                               {val}
                             </span>
                           )
                         },
                         { header: 'Observaciones', accessor: 'observaciones' },
                         { 
                           header: 'Acciones', 
                           accessor: 'id_salida', 
                           width: '150px',
                           align:'center', 
                           render: (val, row) => (
                             <div className="flex gap-2 justify-center">
                               <button 
                                 className="btn btn-sm btn-outline" 
                                 onClick={() => handleDescargarSalidaEspecificaPDF(val)} 
                                 disabled={descargandoPDF === val}
                                 title="Descargar PDF"
                               >
                                 {descargandoPDF === val ? (
                                   <div className="animate-spin rounded-full h-3 w-3 border-2 border-current"></div>
                                 ) : (
                                   <Download size={14}/>
                                 )}
                               </button>
                               {row.estado === 'Activo' && orden.estado !== 'Cancelada' && (
                                 <button 
                                   className="btn btn-sm btn-danger" 
                                   onClick={() => handleAnularDespacho(val)}
                                   disabled={procesando}
                                   title="Anular despacho"
                                 >
                                   <Trash2 size={14}/>
                                 </button>
                               )}
                             </div>
                           )
                         }
                     ]} 
                     data={salidas} 
                     emptyMessage="No hay despachos registrados"
                 />
             </div>
         </div>
      )}

      <div className="mt-8 border-t-2 border-gray-100 pt-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-700">
            <CreditCard size={24} /> Gestión de Cobranzas
        </h2>

        {resumenPagos && (
            <div className="card mb-4 border-l-4 border-success">
            <div className="card-header flex justify-between items-center">
                <h2 className="card-title">Resumen de Pagos</h2>
                {orden.estado_pago !== 'Pagado' && orden.estado !== 'Cancelada' && (
                <button className="btn btn-sm btn-success" onClick={() => setModalPagoOpen(true)}>
                    <Plus size={16} /> Registrar Pago
                </button>
                )}
            </div>
            <div className="card-body">
                <div className="grid grid-cols-4 gap-4">
                <div>
                    <p className="text-sm text-muted">Total Orden</p>
                    <p className="text-2xl font-bold">{formatearMoneda(totalCorregido)}</p>
                </div>
                <div>
                    <p className="text-sm text-muted">Monto Pagado</p>
                    <p className="text-2xl font-bold text-success">{formatearMoneda(resumenPagos.monto_pagado)}</p>
                </div>
                <div>
                    <p className="text-sm text-muted">Saldo Pendiente</p>
                    <p className="text-2xl font-bold text-warning">{formatearMoneda(saldoCorregido)}</p>
                </div>
                <div>
                    <p className="text-sm text-muted">Progreso Pago</p>
                    <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                        <div 
                        className={`h-3 rounded-full ${
                            (resumenPagos.monto_pagado >= totalCorregido - 0.1) ? 'bg-success' : 
                            parseFloat(resumenPagos.monto_pagado) > 0 ? 'bg-info' : 'bg-warning'
                        }`}
                        style={{ width: `${Math.min(100, (parseFloat(resumenPagos.monto_pagado) / totalCorregido) * 100)}%` }}
                        ></div>
                    </div>
                    <span className="font-bold">{((parseFloat(resumenPagos.monto_pagado) / totalCorregido) * 100).toFixed(0)}%</span>
                    </div>
                </div>
                </div>
            </div>
            </div>
        )}

        {pagos.length > 0 && (
            <div className="card mb-4">
            <div className="card-header">
                <h2 className="card-title">
                <FileText size={20} /> Historial de Transacciones
                <span className="badge badge-primary ml-2">{pagos.length}</span>
                </h2>
            </div>
            <div className="card-body">
                <Table columns={columnsPagos} data={pagos} emptyMessage="No hay pagos registrados" />
            </div>
            </div>
        )}
      </div>

      <Modal isOpen={modalPrioridadOpen} onClose={() => setModalPrioridadOpen(false)} title="Cambiar Prioridad">
        <div className="space-y-2">
          {['Baja', 'Media', 'Alta', 'Urgente'].map(prioridad => (
            <button 
              key={prioridad} 
              className="btn btn-outline w-full justify-start" 
              onClick={() => handleCambiarPrioridad(prioridad)} 
              disabled={orden.prioridad === prioridad || procesando}
            >
              <span className="text-2xl mr-2">{getPrioridadConfig(prioridad).icono}</span>
              {prioridad}
            </button>
          ))}
        </div>
      </Modal>

      <Modal isOpen={modalPagoOpen} onClose={() => setModalPagoOpen(false)} title="Registrar Pago" size="md">
        <form onSubmit={handleRegistrarPago}>
          <div className="space-y-4">
            {resumenPagos && (
              <div className="alert alert-info">
                <strong>Saldo Pendiente:</strong> {formatearMoneda(saldoCorregido)}
              </div>
            )}

            <div className="form-group">
                <label className="form-label">Cuenta de Depósito *</label>
                <select
                    className="form-select"
                    value={pagoForm.id_cuenta_destino || ''}
                    onChange={(e) => setPagoForm({ ...pagoForm, id_cuenta_destino: e.target.value })}
                    required
                >
                    <option value="">Seleccione cuenta</option>
                    {cuentasPago.filter(c => c.estado === 'Activo' && c.moneda === orden.moneda).map(c => (
                        <option key={c.id_cuenta} value={c.id_cuenta}>
                            {c.nombre} - {c.tipo} ({c.moneda} {c.saldo_actual})
                        </option>
                    ))}
                </select>
                <small className="text-muted">Cuenta donde ingresa el dinero</small>
            </div>

            <div className="form-group">
              <label className="form-label">Fecha de Pago *</label>
              <input
                type="date"
                className="form-input"
                value={pagoForm.fecha_pago}
                onChange={(e) => setPagoForm({ ...pagoForm, fecha_pago: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Monto a Pagar *</label>
              <input
                type="number"
                className="form-input"
                value={pagoForm.monto_pagado}
                onChange={(e) => setPagoForm({ ...pagoForm, monto_pagado: e.target.value })}
                required
                step="0.01"
                min="0.01"
                max={saldoCorregido}
                placeholder="0.00"
                onWheel={handleWheelDisable}
              />
              {resumenPagos && (
                <small className="text-muted">
                  Máximo: {formatearMoneda(saldoCorregido)}
                </small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Método de Pago *</label>
              <select
                className="form-select"
                value={pagoForm.metodo_pago}
                onChange={(e) => setPagoForm({ ...pagoForm, metodo_pago: e.target.value })}
                required
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Cheque">Cheque</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Deposito">Depósito</option>
                <option value="Yape">Yape</option>
                <option value="Plin">Plin</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">N° Operación</label>
              <input
                type="text"
                className="form-input"
                value={pagoForm.numero_operacion}
                onChange={(e) => setPagoForm({ ...pagoForm, numero_operacion: e.target.value })}
                placeholder="Número de operación o referencia"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Banco Origen</label>
              <input
                type="text"
                className="form-input"
                value={pagoForm.banco}
                onChange={(e) => setPagoForm({ ...pagoForm, banco: e.target.value })}
                placeholder="Nombre del banco del cliente"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea
                className="form-textarea"
                value={pagoForm.observaciones}
                onChange={(e) => setPagoForm({ ...pagoForm, observaciones: e.target.value })}
                rows={3}
                placeholder="Notas adicionales sobre el pago"
              ></textarea>
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-outline" onClick={() => setModalPagoOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-success" disabled={procesando}>
                <CreditCard size={20} /> Registrar Pago
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={modalCrearOP} 
        onClose={() => {
          setModalCrearOP(false);
          setProductoSeleccionado(null);
          setCantidadOP('');
        }} 
        title="Crear Orden de Producción"
        size="md"
      >
        {productoSeleccionado && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            
            if (!cantidadOP || parseFloat(cantidadOP) <= 0) {
              setError('Ingrese una cantidad válida');
              return;
            }

            try {
              setProcesando(true);
              setError(null);

              const response = await ordenesVentaAPI.crearOrdenProduccion(id, {
                id_producto: productoSeleccionado.id_producto,
                cantidad: parseFloat(cantidadOP)
              });

              if (response.data.success) {
                setSuccess(`Orden de producción ${response.data.data.numero_orden_produccion} creada exitosamente`);
                setModalCrearOP(false);
                setProductoSeleccionado(null);
                setCantidadOP('');
                await cargarDatos();
              }

            } catch (err) {
              console.error(err);
              setError(err.response?.data?.error || 'Error al crear orden de producción');
            } finally {
              setProcesando(false);
            }
          }}>
            <div className="space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <div className="flex items-start gap-3">
                  <Factory className="text-blue-500 shrink-0 mt-0.5" size={20} />
                  <div className="text-sm text-blue-700">
                    <p className="font-semibold mb-1">Producto: {productoSeleccionado.producto}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <strong>Código:</strong> {productoSeleccionado.codigo_producto}
                      </div>
                      <div>
                        <strong>Cantidad OV:</strong> {parseFloat(productoSeleccionado.cantidad).toFixed(2)} {productoSeleccionado.unidad_medida}
                      </div>
                      <div>
                        <strong>Stock actual:</strong> {parseFloat(productoSeleccionado.stock_disponible || 0).toFixed(2)} {productoSeleccionado.unidad_medida}
                      </div>
                      <div>
                        <strong>Faltante:</strong> {Math.max(0, parseFloat(productoSeleccionado.cantidad) - parseFloat(productoSeleccionado.stock_disponible || 0)).toFixed(2)} {productoSeleccionado.unidad_medida}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Cantidad a Producir *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input"
                  value={cantidadOP}
                  onChange={(e) => setCantidadOP(e.target.value)}
                  required
                  placeholder="0.00"
                  autoFocus
                  onWheel={handleWheelDisable}
                />
                <small className="text-muted block mt-1">
                  Puede producir cualquier cantidad. El faltante sugerido es: {Math.max(0, parseFloat(productoSeleccionado.cantidad) - parseFloat(productoSeleccionado.stock_disponible || 0)).toFixed(2)} {productoSeleccionado.unidad_medida}
                </small>
              </div>

              {parseFloat(productoSeleccionado.stock_disponible || 0) >= parseFloat(productoSeleccionado.cantidad) && (
                <div className="alert alert-info">
                  <AlertCircle size={18} />
                  <div>
                    <strong>Nota:</strong> Ya hay stock suficiente para esta orden.
                    <br />
                    <small>Esta orden de producción es adicional y aumentará el inventario.</small>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => {
                    setModalCrearOP(false);
                    setProductoSeleccionado(null);
                    setCantidadOP('');
                  }}
                  disabled={procesando}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={procesando || !cantidadOP}
                >
                  <Factory size={20} />
                  {procesando ? 'Creando...' : 'Crear Orden de Producción'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={modalDespacho}
        onClose={() => setModalDespacho(false)}
        title="Registrar Despacho Parcial/Total"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 p-3 rounded border border-blue-200">
            <p className="text-sm text-blue-700">
              Seleccione la cantidad a despachar para cada producto.
              Se generará una <strong>Salida de Inventario</strong> automáticamente.
            </p>
          </div>
          <div className="table-container max-h-80 overflow-y-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-right">Pendiente</th>
                  <th className="text-right">Stock</th>
                  <th className="w-32 text-right">Despachar</th>
                </tr>
              </thead>
              <tbody>
                {despachoForm.detalles.map((item, idx) => (
                  <tr key={item.id_producto}>
                    <td>
                      <div className="font-medium text-sm">{item.producto}</div>
                      <div className="text-xs text-muted">{item.codigo_producto}</div>
                    </td>
                    <td className="text-right font-medium">
                      {parseFloat(item.cantidad_pendiente).toFixed(2)}
                    </td>
                    <td className="text-right text-muted">
                      {parseFloat(item.stock_disponible).toFixed(2)}
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-input form-input-sm text-right"
                        min="0"
                        max={item.cantidad_pendiente}
                        step="0.01"
                        value={item.cantidad_a_despachar}
                        onChange={(e) => handleCambioCantidadDespacho(item.id_producto, e.target.value)}
                        onWheel={handleWheelDisable}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-group mt-4">
              <label className="form-label">Fecha de Despacho</label>
              <input 
                  type="date" 
                  className="form-input"
                  value={despachoForm.fecha_despacho}
                  onChange={(e) => setDespachoForm({...despachoForm, fecha_despacho: e.target.value})}
              />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              className="btn btn-outline"
              onClick={() => setModalDespacho(false)}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleRegistrarDespacho}
              disabled={procesando}
            >
              {procesando ? 'Procesando...' : 'Confirmar Despacho'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalAnularOrden}
        onClose={() => {
          setModalAnularOrden(false);
          setMotivoAnulacion('');
        }}
        title="Anular Orden de Venta"
        size="md"
      >
        <div className="space-y-4">
          <div className="alert alert-warning">
            <AlertTriangle size={20} />
            <div>
              <strong>¡Atención!</strong> Esta acción anulará completamente la orden de venta.
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>Se anularán todos los despachos asociados</li>
                <li>Se revertirá el stock de todos los productos</li>
                <li>Se revertirá la cotización asociada (si existe)</li>
                <li>Esta acción no se puede deshacer</li>
              </ul>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Motivo de Anulación *</label>
            <textarea
              className="form-textarea"
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              rows={4}
              placeholder="Ingrese el motivo por el cual se anula esta orden..."
              required
            ></textarea>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              className="btn btn-outline"
              onClick={() => {
                setModalAnularOrden(false);
                setMotivoAnulacion('');
              }}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button
              className="btn btn-danger"
              onClick={handleAnularOrden}
              disabled={procesando || !motivoAnulacion.trim()}
            >
              <XCircle size={20} />
              {procesando ? 'Anulando...' : 'Confirmar Anulación'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalEditarComprobante}
        onClose={() => {
          setModalEditarComprobante(false);
          setNuevoTipoComprobante('');
        }}
        title="Cambiar Tipo de Comprobante"
        size="md"
      >
        <div className="space-y-4">
          <div className="alert alert-warning">
            <AlertTriangle size={20} />
            <div>
              <strong>¡Importante!</strong> Debe consultar antes de realizar este cambio.
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>Solo puede cambiar el tipo de comprobante una vez</li>
                <li>Este cambio puede afectar aspectos contables y tributarios</li>
                <li>Consulte con el área correspondiente antes de continuar</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded border border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>Tipo actual:</strong> {orden.tipo_comprobante || 'Orden Venta'}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-muted">Seleccione el nuevo tipo de comprobante:</p>
            
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                className={`btn py-4 text-left ${
                  nuevoTipoComprobante === 'Factura' 
                    ? 'btn-success text-white shadow-md' 
                    : 'btn-outline hover:bg-green-50'
                }`}
                onClick={() => setNuevoTipoComprobante('Factura')}
              >
                <div className="flex items-center gap-3">
                  <FileText size={24} />
                  <div>
                    <div className="font-bold">FACTURA</div>
                    <div className="text-xs opacity-80">Comprobante fiscal para clientes con RUC</div>
                  </div>
                </div>
              </button>
              
              <button
                type="button" className={`btn py-4 text-left ${
                  nuevoTipoComprobante === 'Nota de Venta' 
                    ? 'btn-info text-white shadow-md' 
                    : 'btn-outline hover:bg-blue-50'
                }`}
                onClick={() => setNuevoTipoComprobante('Nota de Venta')}
              >
                <div className="flex items-center gap-3">
                  <FileText size={24} />
                  <div>
                    <div className="font-bold">NOTA DE VENTA</div>
                    <div className="text-xs opacity-80">Comprobante simple para ventas menores</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t">
            <button
              className="btn btn-outline"
              onClick={() => {
                setModalEditarComprobante(false);
                setNuevoTipoComprobante('');
              }}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCambiarTipoComprobante}
              disabled={procesando || !nuevoTipoComprobante || nuevoTipoComprobante === orden.tipo_comprobante}
            >
              <Edit size={20} />
              {procesando ? 'Actualizando...' : 'Confirmar Cambio'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalTransporteOpen}
        onClose={() => setModalTransporteOpen(false)}
        title="Editar Datos de Transporte"
        size="md"
      >
        <form onSubmit={handleGuardarTransporte}>
          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label">Tipo de Entrega</label>
              <select 
                className="form-select"
                value={transporteForm.tipo_entrega}
                onChange={(e) => setTransporteForm({ ...transporteForm, tipo_entrega: e.target.value })}
              >
                <option value="Vehiculo Empresa">Vehículo Empresa</option>
                <option value="Transporte Privado">Transporte Privado / Tercero</option>
                <option value="Recojo Tienda">Recojo en Tienda</option>
              </select>
            </div>

            {transporteForm.tipo_entrega === 'Vehiculo Empresa' && (
              <>
                <div className="form-group">
                  <label className="form-label">Vehículo</label>
                  <select 
                    className="form-select"
                    value={transporteForm.id_vehiculo}
                    onChange={(e) => setTransporteForm({ ...transporteForm, id_vehiculo: e.target.value })}
                  >
                    <option value="">Seleccione vehículo</option>
                    {vehiculos.map(v => (
                      <option key={v.id_vehiculo} value={v.id_vehiculo}>{v.placa} - {v.marca_modelo}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Conductor</label>
                  <select 
                    className="form-select"
                    value={transporteForm.id_conductor}
                    onChange={(e) => setTransporteForm({ ...transporteForm, id_conductor: e.target.value })}
                  >
                    <option value="">Seleccione conductor</option>
                    {conductores.map(c => (
                      <option key={c.id_empleado} value={c.id_empleado}>{c.nombre_completo}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {transporteForm.tipo_entrega === 'Transporte Privado' && (
              <>
                <div className="form-group">
                  <label className="form-label">Empresa Transporte</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={transporteForm.transporte_nombre}
                    onChange={(e) => setTransporteForm({ ...transporteForm, transporte_nombre: e.target.value })}
                    placeholder="Nombre del empresa o transportista"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Placa Vehículo</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={transporteForm.transporte_placa}
                      onChange={(e) => setTransporteForm({ ...transporteForm, transporte_placa: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">DNI Chofer</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={transporteForm.transporte_dni}
                      onChange={(e) => setTransporteForm({ ...transporteForm, transporte_dni: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre Chofer</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={transporteForm.transporte_conductor}
                    onChange={(e) => setTransporteForm({ ...transporteForm, transporte_conductor: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Fecha Estimada Entrega</label>
              <input 
                type="date" 
                className="form-input"
                value={transporteForm.fecha_entrega_estimada}
                onChange={(e) => setTransporteForm({ ...transporteForm, fecha_entrega_estimada: e.target.value })}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" className="btn btn-outline" onClick={() => setModalTransporteOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={procesando}>
                <Save size={20} /> Guardar Cambios
              </button>
            </div>
          </div>
        </form>
      </Modal>
      
      <Modal
        isOpen={modalRectificarOpen}
        onClose={() => setModalRectificarOpen(false)}
        title="Rectificar Cantidad de Producto"
        size="sm"
      >
        {productoRectificar && (
          <form onSubmit={handleRectificarCantidad}>
            <div className="space-y-4">
              <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded">
                <div className="flex gap-2">
                  <AlertTriangle className="text-orange-500 shrink-0" size={20} />
                  <div className="text-sm text-orange-800">
                    <p className="font-bold">{productoRectificar.producto}</p>
                    <p>Cantidad actual: <strong>{formatearNumero(productoRectificar.cantidad)}</strong></p>
                    <p className="text-xs mt-1">
                        Esta acción actualizará el inventario y, si corresponde, las salidas asociadas.
                    </p>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nueva Cantidad *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={rectificarForm.nueva_cantidad}
                  onChange={(e) => setRectificarForm({ ...rectificarForm, nueva_cantidad: e.target.value })}
                  required
                  autoFocus
                  onWheel={handleWheelDisable}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Motivo del Cambio *</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={rectificarForm.motivo}
                  onChange={(e) => setRectificarForm({ ...rectificarForm, motivo: e.target.value })}
                  placeholder="Ej: Error de digitación, devolución parcial, etc."
                  required
                ></textarea>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setModalRectificarOpen(false)}
                  disabled={procesando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-warning text-white"
                  disabled={procesando}
                >
                  <Save size={16} className="mr-1"/> Confirmar Rectificación
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={modalReservaStock}
        onClose={() => setModalReservaStock(false)}
        title="Reservar Stock Físico"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
            <div className="flex gap-2">
              <Box className="text-yellow-600 shrink-0" size={20} />
              <div className="text-sm text-yellow-800">
                <strong>Reserva de Stock:</strong>
                <p>
                  Seleccione los productos para reservar. Esto deducirá inmediatamente el stock del inventario para garantizar la disponibilidad.
                </p>
                {infoReservaStock && (
                  <div className="mt-2 flex gap-4 text-xs font-semibold">
                    <span>Total Items: {infoReservaStock.resumen.total_items}</span>
                    <span className="text-green-700">Stock Completo: {infoReservaStock.resumen.con_stock_completo}</span>
                    <span className="text-orange-700">Stock Parcial: {infoReservaStock.resumen.con_stock_parcial}</span>
                    <span className="text-red-700">Sin Stock: {infoReservaStock.resumen.sin_stock}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="table-container max-h-[60vh] overflow-y-auto border rounded-lg">
            <table className="table table-sm w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="w-10 text-center">#</th>
                  <th>Producto</th>
                  <th className="text-right">Requerido</th>
                  <th className="text-right">Disponible Total</th>
                  <th className="text-right">Reserva Actual</th>
                  <th className="text-right">Nueva Reserva</th>
                </tr>
              </thead>
              <tbody>
                {productosReservaSeleccionados.map((item) => {
                  const sinStockAbsoluto = item.stock_maximo_disponible <= 0;
                  
                  return (
                    <tr key={item.id_detalle} className={sinStockAbsoluto ? 'bg-gray-50 opacity-60' : ''}>
                      <td className="text-center">
                        <input 
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
                          checked={item.seleccionado}
                          onChange={() => {
                             const nuevoVal = !item.seleccionado ? item.stock_maximo_disponible : 0;
                             handleCambioCantidadManualReserva(item.id_detalle, nuevoVal);
                          }}
                          disabled={sinStockAbsoluto}
                        />
                      </td>
                      <td>
                        <div className="font-medium text-sm">{item.nombre}</div>
                      </td>
                      <td className="text-right font-medium">
                        {formatearNumero(item.cantidad_requerida)}
                      </td>
                      <td className="text-right text-muted">
                        {formatearNumero(item.stock_maximo_disponible)}
                      </td>
                      <td className="text-right text-blue-600 font-medium">
                         {formatearNumero(item.cantidad_ya_reservada)}
                      </td>
                      <td className="text-right">
                        <input
                          type="number"
                          className="form-input form-input-sm text-right w-24 ml-auto"
                          min="0"
                          max={Math.min(item.stock_maximo_disponible, item.cantidad_requerida)}
                          step="0.01"
                          value={item.cantidad_a_reservar}
                          onChange={(e) => handleCambioCantidadManualReserva(item.id_detalle, e.target.value)}
                          onWheel={handleWheelDisable}
                          disabled={!item.seleccionado} 
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t mt-2">
            <button
              className="btn btn-outline"
              onClick={() => setModalReservaStock(false)}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleEjecutarReservaStock}
              disabled={procesando}
            >
              <Lock size={16} className="mr-1"/> Confirmar Reserva
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DetalleOrdenVenta;