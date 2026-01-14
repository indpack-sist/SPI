import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, Package, Truck, CheckCircle,
  XCircle, Clock, FileText, Building, DollarSign, MapPin,
  AlertCircle, TrendingUp, Plus, ShoppingCart, Calculator,
  CreditCard, Trash2, Factory, AlertTriangle, PackageOpen, User, Percent, Calendar
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
  const [resumenPagos, setResumenPagos] = useState(null);
  const [estadoCredito, setEstadoCredito] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [procesando, setProcesando] = useState(false);
  
  const [modalPrioridadOpen, setModalPrioridadOpen] = useState(false);
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [modalCrearOP, setModalCrearOP] = useState(false);
  
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidadOP, setCantidadOP] = useState('');
  
  const [pagoForm, setPagoForm] = useState({
    fecha_pago: getFechaLocal(),
    monto_pagado: '',
    metodo_pago: 'Transferencia',
    numero_operacion: '',
    banco: '',
    observaciones: ''
  });

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('es-DE', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(valor);
  };

  const formatearMoneda = (valor) => {
    if (!orden && !valor) return '-';
    const simbolo = orden?.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [ordenRes, pagosRes, resumenRes] = await Promise.all([
        ordenesVentaAPI.getById(id),
        ordenesVentaAPI.getPagos(id),
        ordenesVentaAPI.getResumenPagos(id)
      ]);
      
      if (ordenRes.data.success) {
        setOrden(ordenRes.data.data);
        const creditoRes = await clientesAPI.getEstadoCredito(ordenRes.data.data.id_cliente);
        if (creditoRes.data.success) {
          setEstadoCredito(creditoRes.data.data);
        }
      }
      
      if (pagosRes.data.success) {
        setPagos(pagosRes.data.data);
      }
      
      if (resumenRes.data.success) {
        setResumenPagos(resumenRes.data.data);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
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

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
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
        siguientes: ['Despachada', 'Cancelada']
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
    return orden.estado === 'Atendido por Producción';
  };

  const columns = [
    {
      header: 'Código',
      accessor: 'codigo_producto',
      width: '100px',
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
              <AlertCircle size={12} />
              Requiere producción
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Cantidad',
      accessor: 'cantidad',
      width: '100px',
      align: 'right',
      render: (value, row) => (
        <div className="text-right">
          <div className="font-bold">{parseFloat(value).toFixed(2)}</div>
          <div className="text-xs text-muted">{row.unidad_medida}</div>
        </div>
      )
    },
    {
      header: 'P. Base',
      accessor: 'precio_base',
      width: '110px',
      align: 'right',
      render: (value) => (
        <span className="text-muted font-mono text-sm">{formatearMoneda(value)}</span>
      )
    },
    {
      header: 'Comisión',
      width: '110px',
      align: 'right',
      render: (_, row) => (
        <div className="flex flex-col items-end">
          <span className="text-xs font-medium text-yellow-600">
            {parseFloat(row.porcentaje_comision || 0).toFixed(2)}%
          </span>
          <span className="text-xs text-success">
            +{formatearMoneda(row.monto_comision)}
          </span>
        </div>
      )
    },
    {
      header: 'P. Final',
      accessor: 'precio_unitario',
      width: '120px',
      align: 'right',
      render: (value) => (
        <span className="font-medium text-primary">{formatearMoneda(value)}</span>
      )
    },
    {
      header: 'Desc.',
      accessor: 'descuento_porcentaje',
      width: '70px',
      align: 'center',
      render: (value) => (
        <span className="text-sm">{parseFloat(value || 0).toFixed(1)}%</span>
      )
    },
    {
      header: 'Estado',
      accessor: 'tiene_op',
      width: '150px',
      align: 'center',
      render: (value, row) => {
        if (!row.requiere_receta) {
          return (
            <span className="badge badge-success">
              <CheckCircle size={12} />
              Stock disponible
            </span>
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

        if (stockDisponible >= cantidadRequerida) {
          return (
            <div className="flex flex-col gap-1">
              <span className="badge badge-success">
                <CheckCircle size={12} />
                Stock disponible
              </span>
              <span className="text-xs text-muted">
                {stockDisponible.toFixed(2)} {row.unidad_medida}
              </span>
            </div>
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
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart size={32} />
              Orden de Venta {orden.numero_orden}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-muted">
                Emitida el {formatearFecha(orden.fecha_emision)}
              </p>
              
              {orden.tipo_comprobante && (
                <div className="flex items-center gap-2">
                  <span className={`badge ${orden.tipo_comprobante === 'Factura' ? 'badge-success' : 'badge-info'}`}>
                    {orden.tipo_comprobante}
                  </span>
                  <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 rounded">
                    {orden.serie_correlativo || orden.numero_comprobante || 'Pendiente'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
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
              {orden.estado !== 'Despachada' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => navigate(`/ventas/ordenes/${id}/editar`)}
                >
                  <Edit size={20} /> Editar
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
                orden.estado === 'Despachada' ? 'from-purple-100 to-purple-200' :
                orden.estado === 'Entregada' ? 'from-emerald-100 to-emerald-200' :
                'from-red-100 to-red-200'
              }`}>
                <IconoEstado size={40} className={
                  orden.estado === 'En Espera' ? 'text-yellow-600' :
                  orden.estado === 'En Proceso' ? 'text-blue-600' :
                  orden.estado === 'Atendido por Producción' ? 'text-green-600' :
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
              
              {orden.estado === 'Atendido por Producción' && (
                <div className="mt-3 text-xs bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle size={14} className="text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-blue-800">
                    <strong>Importante:</strong> Al cambiar a "Despachada" se generará automáticamente una salida de inventario y se descontará el stock.
                  </div>
                </div>
              )}
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
              <div>
                 <label className="text-sm font-medium text-muted">N° Serie:</label>
                 <p className="font-mono">{orden.serie_correlativo || orden.numero_comprobante || '-'}</p>
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
    </div>
  );
}

export default DetalleOrdenVenta;