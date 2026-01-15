import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, Package, Truck, CheckCircle,
  XCircle, Clock, FileText, Building, DollarSign, MapPin,
  AlertCircle, TrendingUp, Plus, ShoppingCart, Calculator,
  CreditCard, Trash2, Factory, AlertTriangle, PackageOpen, User, Percent, Calendar,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { ordenesVentaAPI, salidasAPI, clientesAPI } from '../../config/api';

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
  
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidadOP, setCantidadOP] = useState('');
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  
  const [pagoForm, setPagoForm] = useState({
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

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
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

  const handleNavegar = (nuevoId) => {
    if (nuevoId) {
        navigate(`/ventas/ordenes/${nuevoId}`);
    }
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [ordenRes, pagosRes, resumenRes, salidasRes] = await Promise.all([
        ordenesVentaAPI.getById(id),
        ordenesVentaAPI.getPagos(id),
        ordenesVentaAPI.getResumenPagos(id),
        ordenesVentaAPI.getSalidas(id).catch(() => ({ data: { success: true, data: [] } }))
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
        fecha_despacho: despachoForm.fecha_despacho
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

  const handleRegistrarPago = async (e) => {
    e.preventDefault();
    
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

  const handleGenerarGuia = () => {
    navigate(`/ventas/guias-remision/nueva?orden=${id}`);
  };

  const handleDescargarPDF = async (tipoDocumento) => {
    try {
      setProcesando(true);
      setError(null);
      
      await ordenesVentaAPI.descargarPDF(id, tipoDocumento);
      
      const nombreArchivo = tipoDocumento === 'comprobante' ? orden.tipo_comprobante : 'Orden de Venta';
      setSuccess(`PDF de ${nombreArchivo} descargado exitosamente`);
    } catch (err) {
      console.error(err);
      setError('Error al descargar el PDF');
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
      
      await salidasAPI.generarPDF(orden.id_salida);
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
      await salidasAPI.generarPDF(idSalida);
      setSuccess('Guía de Salida descargada');
    } catch (err) {
      setError('Error al descargar la guía de salida');
    } finally {
      setDescargandoPDF(null);
    }
  };

  const getTipoImpuestoNombre = (codigo) => {
    const tipos = {
      'IGV': 'IGV 18%',
      'EXO': 'Exonerado 0%',
      'INA': 'Inafecto 0%'
    };
    return tipos[codigo] || 'IGV 18%';
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
        const pendiente = parseFloat(value);
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
        if (!row.requiere_receta) {
          const stockDisponible = parseFloat(row.stock_disponible || 0);
          const pendiente = parseFloat(row.cantidad_pendiente || 0);
          
          if (pendiente <= 0) return <span className="badge badge-success"><CheckCircle size={12}/> Completado</span>;

          return (
            <div className="flex flex-col gap-1">
              <span className={`badge ${stockDisponible >= pendiente ? 'badge-success' : 'badge-warning'}`}>
                {stockDisponible >= pendiente ? 'Stock Disponible' : 'Stock Insuficiente'}
              </span>
              <span className="text-xs text-muted">Stock: {stockDisponible.toFixed(2)}</span>
            </div>
          );
        }

        const stockDisponible = parseFloat(row.stock_disponible || 0);
        const cantidadRequerida = parseFloat(row.cantidad);

        if (value > 0) {
          return (
            <span className="badge badge-info">
              <Factory size={12} />
              En producción
            </span>
          );
        }

        return (
          <div className="flex flex-col gap-1">
            <span className="badge badge-warning">
              <AlertCircle size={12} />
              Pendiente OP
            </span>
            <span className="text-xs text-danger">
              Falta: {(cantidadRequerida - stockDisponible).toFixed(2)} {row.unidad_medida}
            </span>
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
        const stockDisponible = parseFloat(row.stock_disponible || 0);
        const cantidadRequerida = parseFloat(row.cantidad);
        const stockSuficiente = stockDisponible >= cantidadRequerida;

        if (row.tiene_op > 0) {
          return (
            <span className="text-xs text-muted">OP creada</span>
          );
        }

        if (orden?.estado === 'Cancelada' || 
            orden?.estado === 'Entregada' || 
            orden?.estado === 'Despachada') {
          return '-';
        }

        if (row.requiere_receta) {
          return (
            <button
              className={`btn btn-sm ${stockSuficiente ? 'btn-outline btn-primary' : 'btn-primary'}`}
              onClick={() => {
                setProductoSeleccionado(row);
                const faltante = cantidadRequerida - stockDisponible;
                setCantidadOP(faltante > 0 ? faltante : cantidadRequerida);
                setModalCrearOP(true);
              }}
              disabled={procesando}
              title={stockSuficiente ? 'Crear OP adicional' : 'Crear OP requerida'}
            >
              <Factory size={14} />
              {stockSuficiente ? 'Producir más' : 'Crear OP'}
            </button>
          );
        }

        return '-';
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
          disabled={procesando}
        >
          <Trash2 size={14} />
        </button>
      )
    }
  ];

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

  const estadoConfig = getEstadoConfig(orden.estado);
  const IconoEstado = estadoConfig.icono;
  const prioridadConfig = getPrioridadConfig(orden.prioridad);
  const estadoPagoConfig = getEstadoPagoConfig(orden.estado_pago);
  const IconoEstadoPago = estadoPagoConfig.icono;

  const productosRequierenOP = orden.detalle.filter(item => {
    const stockDisponible = parseFloat(item.stock_disponible || 0);
    const cantidadRequerida = parseFloat(item.cantidad);
    return item.requiere_receta && 
           item.tiene_op === 0 && 
           stockDisponible < cantidadRequerida &&
           orden.estado !== 'Cancelada' &&
           orden.estado !== 'Entregada' &&
           orden.estado !== 'Despachada';
  });

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
          
          {orden.estado !== 'Cancelada' && orden.estado !== 'Entregada' && (
            <>
              {orden.estado === 'En Espera' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => navigate(`/ventas/ordenes/${id}/editar`)}
                >
                  <Edit size={20} /> Editar
                </button>
              )}
              <button
                className="btn btn-danger"
                onClick={() => setModalAnularOrden(true)}
                disabled={procesando}
              >
                <XCircle size={20} /> Anular Orden
              </button>
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

      <div className="card mb-4 border-l-4 border-primary">
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

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className={`card border-l-4 ${estadoPagoConfig.clase.replace('badge-', 'border-')}`}>
          <div className="card-body">
            <div className="flex items-center gap-3">
              <IconoEstadoPago size={32} />
              <div>
                <p className="text-sm text-muted">Estado Pago</p>
                <span className={`badge ${estadoPagoConfig.clase}`}>{orden.estado_pago}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <p className="text-sm text-muted mb-2">Productos</p>
            <div className="flex items-center gap-2">
              <Package size={24} />
              <div>
                <span className="font-bold text-2xl">{orden.detalle.length}</span>
                <span className="text-sm text-muted ml-1">items</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <p className="text-sm text-muted mb-2">Comercial</p>
            <div className="flex items-center gap-2">
              <User size={24} />
              <div>
                <span className="font-bold text-lg">{orden.comercial || 'Sin asignar'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card col-span-3">
            <div className="card-body">
                <p className="text-sm text-muted mb-2">Progreso Entrega</p>
                {(() => {
                    const totalQty = orden.detalle.reduce((acc, i) => acc + parseFloat(i.cantidad), 0);
                    const despachadoQty = orden.detalle.reduce((acc, i) => acc + parseFloat(i.cantidad_despachada || 0), 0);
                    const pct = totalQty > 0 ? (despachadoQty / totalQty) * 100 : 0;
                    return (
                        <div className="flex items-center gap-3 mt-2">
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
        </div>
      </div>

      {resumenPagos && (
        <div className="card mb-4 border-l-4 border-primary">
          <div className="card-header flex justify-between items-center">
            <h2 className="card-title"><CreditCard size={20} /> Resumen de Pagos</h2>
            {orden.estado_pago !== 'Pagado' && (
              <button className="btn btn-sm btn-success" onClick={() => setModalPagoOpen(true)}>
                <Plus size={16} /> Registrar Pago
              </button>
            )}
          </div>
          <div className="card-body">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted">Total Orden</p>
                <p className="text-2xl font-bold">{formatearMoneda(resumenPagos.total_orden)}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Monto Pagado</p>
                <p className="text-2xl font-bold text-success">{formatearMoneda(resumenPagos.monto_pagado)}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Saldo Pendiente</p>
                <p className="text-2xl font-bold text-warning">{formatearMoneda(resumenPagos.saldo_pendiente)}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Progreso</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${
                        parseFloat(resumenPagos.porcentaje_pagado) === 100 ? 'bg-success' : 
                        parseFloat(resumenPagos.porcentaje_pagado) > 0 ? 'bg-info' : 'bg-warning'
                      }`}
                      style={{ width: `${resumenPagos.porcentaje_pagado}%` }}
                    ></div>
                  </div>
                  <span className="font-bold">{resumenPagos.porcentaje_pagado}%</span>
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
              <FileText size={20} /> Historial de Pagos
              <span className="badge badge-primary ml-2">{pagos.length}</span>
            </h2>
          </div>
          <div className="card-body">
            <Table columns={columnsPagos} data={pagos} emptyMessage="No hay pagos registrados" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card">
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

        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><DollarSign size={20} /> Condiciones Comerciales</h2>
          </div>
          <div className="card-body space-y-2">
            <div className="grid grid-cols-2 gap-2 pb-2 mb-2 border-b border-gray-100">
              <div>
                 <label className="text-sm font-medium text-muted">Tipo Documento:</label>
                 <p className="font-semibold text-primary">{orden.tipo_comprobante || 'Orden Venta'}</p>
              </div>
              {orden.tipo_comprobante && orden.tipo_comprobante !== 'Factura' && (
                <div>
                   <label className="text-sm font-medium text-muted">N° Serie:</label>
                   <p className="font-mono">{orden.numero_comprobante || '-'}</p>
                </div>
              )}
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
              {orden.dias_credito > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted">Crédito:</label>
                  <p>{orden.dias_credito} días</p>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Forma Pago:</label>
              <p>{orden.forma_pago || orden.plazo_pago || '-'}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><MapPin size={20} /> Entrega</h2>
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
              <p className="text-sm">{orden.direccion_entrega || orden.lugar_entrega || '-'}</p>
            </div>
            {orden.ciudad_entrega && (
              <div>
                <label className="text-sm font-medium text-muted">Ciudad:</label>
                <p>{orden.ciudad_entrega}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title"><Package size={20} /> Detalle de Productos</h2>
        </div>
        <div className="card-body">
          <Table columns={columns} data={orden.detalle} />
        </div>
      </div>

      {salidas.length > 0 && (
         <div className="card mb-4 border-l-4 border-info">
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
                               {row.estado === 'Activo' && (
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

      <div className="grid grid-cols-2 gap-4">
        {orden.observaciones && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Observaciones</h3></div>
            <div className="card-body"><p className="whitespace-pre-wrap">{orden.observaciones}</p></div>
          </div>
        )}
        <div className="card ml-auto w-full">
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
              <span className="font-bold">{formatearMoneda(orden.igv)}</span>
            </div>
            <div className="flex justify-between py-3 bg-gray-100 text-black px-4 rounded-lg">
              <span className="font-bold">TOTAL:</span>
              <span className="font-bold text-xl">{formatearMoneda(orden.total)}</span>
            </div>
            
            {orden.moneda === 'USD' && parseFloat(orden.tipo_cambio || 0) > 1 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <div className="flex justify-between items-center text-blue-900">
                  <span className="font-medium">Equivalente en Soles:</span>
                  <span className="font-bold">S/ {formatearNumero(parseFloat(orden.total) * parseFloat(orden.tipo_cambio))}</span>
                </div>
              </div>
            )}
          </div>
        </div>
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
                <strong>Saldo Pendiente:</strong> {formatearMoneda(resumenPagos.saldo_pendiente)}
              </div>
            )}

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
                max={resumenPagos?.saldo_pendiente}
                placeholder="0.00"
              />
              {resumenPagos && (
                <small className="text-muted">
                  Máximo: {formatearMoneda(resumenPagos.saldo_pendiente)}
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
              <label className="form-label">Banco</label>
              <input
                type="text"
                className="form-input"
                value={pagoForm.banco}
                onChange={(e) => setPagoForm({ ...pagoForm, banco: e.target.value })}
                placeholder="Nombre del banco"
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
    </div>
  );
}

export default DetalleOrdenVenta;