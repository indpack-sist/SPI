import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, FileText, Calendar,
  Building, AlertCircle,
  CheckCircle, XCircle, Calculator, Percent, TrendingUp,
  AlertTriangle, User, CreditCard, Package, MapPin, Copy, ExternalLink, Lock
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { cotizacionesAPI, clientesAPI } from '../../config/api';

function DetalleCotizacion() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [cotizacion, setCotizacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalPrioridadOpen, setModalPrioridadOpen] = useState(false);
  const [estadoCredito, setEstadoCredito] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await cotizacionesAPI.getById(id);
      
      if (response.data.success) {
        setCotizacion(response.data.data);
        
        const creditoRes = await clientesAPI.getEstadoCredito(response.data.data.id_cliente);
        if (creditoRes.data.success) {
          setEstadoCredito(creditoRes.data.data);
        }
      } else {
        setError('Cotización no encontrada');
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar la cotización');
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarPDF = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 1. Llamada a la API (esperamos un Blob)
      const response = await cotizacionesAPI.descargarPDF(id);
      
      // 2. Crear URL y descargar
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      
      // Intentar sacar el nombre del archivo del header
      const contentDisposition = response.headers['content-disposition'];
      let fileName = `Cotizacion-${cotizacion.numero_cotizacion}.pdf`;
      
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (fileNameMatch && fileNameMatch.length === 2) {
          fileName = fileNameMatch[1];
        }
      }
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess('PDF descargado exitosamente');

    } catch (err) {
      console.error("Error original:", err);

      // --- AQUÍ ESTÁ LA SOLUCIÓN AL "UNDEFINED" ---
      // Si la respuesta es un Blob (porque axios así lo configuró), hay que leerlo como texto
      if (err.response && err.response.data instanceof Blob) {
        try {
          // Leemos el contenido del Blob (que contiene el JSON de error)
          const errorText = await err.response.data.text();
          const errorJson = JSON.parse(errorText);
          
          // Ahora sí mostramos el mensaje real del backend
          const mensajeError = errorJson.error || 'Error al generar el PDF';
          console.error("Mensaje del backend:", mensajeError);
          setError(mensajeError);
          
        } catch (e) {
          // Si no es JSON válido
          setError('Ocurrió un error inesperado al descargar el archivo.');
        }
      } else {
        // Error de red u otro tipo que no sea del backend
        setError(err.message || 'Error de conexión al descargar el PDF');
      }
    } finally {
      setLoading(false);
    }
  };

 const handleDuplicar = async () => {
  try {
    setLoading(true);
    setError(null);
    
    const response = await cotizacionesAPI.duplicar(id);
    
    if (response.data.success) {
      setSuccess(`Cotización duplicada: ${response.data.data.numero_cotizacion}`);
      
      setTimeout(() => {
        navigate(`/ventas/cotizaciones/${response.data.data.id_cotizacion}`);
      }, 1500);
    }
    
  } catch (err) {
    console.error('Error al duplicar cotización:', err);
    setError(err.response?.data?.error || 'Error al duplicar cotización');
  } finally {
    setLoading(false);
  }
};

  const handleCambiarPrioridad = async (prioridad) => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await cotizacionesAPI.actualizarPrioridad(id, prioridad);
      
      if (response.data.success) {
        setCotizacion({ ...cotizacion, prioridad });
        setSuccess(`Prioridad actualizada a ${prioridad}`);
        setModalPrioridadOpen(false);
      }
      
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar prioridad');
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstado = async (estado) => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await cotizacionesAPI.actualizarEstado(id, estado);
      
      if (response.data.success) {
        if (estado === 'Aprobada') {
          setSuccess('Cotización aprobada. Redirigiendo a crear Orden de Venta...');
          
          setTimeout(() => {
            navigate(`/ventas/ordenes/nueva?cotizacion=${id}`);
          }, 1500);
        } else {
          await cargarDatos();
          setSuccess(`Estado actualizado a ${estado}`);
        }
      }
      
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar estado');
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(valor);
  };

  const formatearMoneda = (valor) => {
    if (!cotizacion) return '-';
    const simbolo = cotizacion.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  const getTipoImpuestoNombre = (valor) => {
    if (!valor) return 'IGV 18%';

    const codigo = String(valor).toUpperCase().trim();

    const tipos = {
      'IGV': 'IGV 18%',
      'EXO': 'Exonerado 0%',
      'INA': 'Inafecto 0%'
    };

    if (tipos[codigo]) return tipos[codigo];
    
    return valor; 
  };

  const getEstadoConfig = (estado) => {
    const configs = {
      'Pendiente': { 
        icono: Calculator, 
        clase: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        badge: 'badge-warning'
      },
      'Enviada': { 
        icono: FileText, 
        clase: 'bg-blue-100 text-blue-800 border-blue-200',
        badge: 'badge-info'
      },
      'Aprobada': { 
        icono: CheckCircle, 
        clase: 'bg-green-100 text-green-800 border-green-200',
        badge: 'badge-success'
      },
      'Rechazada': { 
        icono: XCircle, 
        clase: 'bg-red-100 text-red-800 border-red-200',
        badge: 'badge-danger'
      },
      'Convertida': { 
        icono: CheckCircle, 
        clase: 'bg-primary/10 text-primary border-primary/20',
        badge: 'badge-primary'
      },
      'Vencida': { 
        icono: AlertCircle, 
        clase: 'bg-gray-100 text-gray-800 border-gray-200',
        badge: 'badge-secondary'
      }
    };
    return configs[estado] || configs['Pendiente'];
  };

  const columns = [
    {
      header: 'Producto',
      accessor: 'producto',
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted font-mono">{row.codigo_producto}</div>
          {parseFloat(row.cantidad) > parseFloat(row.stock_disponible || 0) && (
            <div className="text-xs text-warning flex items-center gap-1 mt-1">
              <AlertTriangle size={12} />
              Stock insuficiente ({parseFloat(row.stock_disponible || 0).toFixed(2)} {row.unidad_medida})
            </div>
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
      header: 'Subtotal',
      accessor: 'valor_venta',
      width: '130px',
      align: 'right',
      render: (value) => (
        <span className="font-bold text-lg">{formatearMoneda(value)}</span>
      )
    }
  ];

  if (loading && !cotizacion) {
    return <Loading message="Cargando cotización..." />;
  }

  if (!cotizacion) {
    return (
      <div className="p-6">
        <Alert type="error" message="Cotización no encontrada" />
        <button 
          className="btn btn-outline mt-4"
          onClick={() => navigate('/ventas/cotizaciones')}
        >
          <ArrowLeft size={20} />
          Volver a Cotizaciones
        </button>
      </div>
    );
  }

  const estadoConfig = getEstadoConfig(cotizacion.estado);
  const IconoEstado = estadoConfig.icono;
  const diasVencimiento = cotizacion.fecha_vencimiento 
    ? Math.ceil((new Date(cotizacion.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const estaConvertida = cotizacion.convertida_venta || cotizacion.estado === 'Convertida';

  const disponible = estadoCredito ? (cotizacion.moneda === 'USD' ? estadoCredito.credito_usd.disponible : estadoCredito.credito_pen.disponible) : 0;
  const creditoInsuficiente = estadoCredito?.usar_limite_credito && cotizacion.plazo_pago !== 'Contado' && parseFloat(cotizacion.total) > parseFloat(disponible);

  return (
    <div className="p-6">
      <div className="sticky top-0 bg-white z-10 pb-4 mb-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              className="btn btn-outline"
              onClick={() => navigate('/ventas/cotizaciones')}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText size={32} className="text-primary" />
                {cotizacion.numero_cotizacion}
                {estaConvertida && (
                  <span className="badge badge-primary ml-2">
                    <Lock size={14} className="inline mr-1" />
                    Convertida
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted">
                Emitida el {formatearFecha(cotizacion.fecha_emision)}
                {diasVencimiento !== null && diasVencimiento > 0 && !estaConvertida && (
                  <span className="ml-2 text-warning">
                    • Vence en {diasVencimiento} día(s)
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button className="btn btn-outline" onClick={handleDescargarPDF}>
              <Download size={18} /> PDF
            </button>
            
            <button className="btn btn-info" onClick={handleDuplicar}>
              <Copy size={18} /> Duplicar
            </button>
            
            {!estaConvertida && cotizacion.estado !== 'Vencida' && (
              <button 
                className="btn btn-secondary" 
                onClick={() => navigate(`/ventas/cotizaciones/${id}/editar`)}
              >
                <Edit size={18} /> Editar
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {estaConvertida && cotizacion.id_orden_venta && (
        <Alert 
          type="info"
          message={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} />
                <span>Esta cotización fue convertida a Orden de Venta</span>
              </div>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => navigate(`/ventas/ordenes/${cotizacion.id_orden_venta}`)}
              >
                Ver Orden de Venta <ExternalLink size={14} className="inline ml-1" />
              </button>
            </div>
          }
        />
      )}

      <div className={`card border-2 ${estadoConfig.clase} mb-6`}>
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-xl ${estadoConfig.clase}`}>
                <IconoEstado size={40} />
              </div>
              <div>
                <p className="text-sm uppercase font-semibold opacity-70 mb-1">Estado Actual</p>
                <h3 className="text-3xl font-bold">{cotizacion.estado}</h3>
                {cotizacion.fecha_vencimiento && cotizacion.estado === 'Pendiente' && (
                  <p className="text-sm mt-1 opacity-70">
                    Válida hasta: {formatearFecha(cotizacion.fecha_vencimiento)}
                  </p>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm uppercase font-semibold opacity-70 mb-2">Prioridad</p>
              <button 
                className={`badge ${cotizacion.prioridad === 'Urgente' ? 'badge-danger' : cotizacion.prioridad === 'Alta' ? 'badge-warning' : 'badge-info'} text-lg px-4 py-2`}
                onClick={() => !estaConvertida && cotizacion.estado !== 'Vencida' && setModalPrioridadOpen(true)}
                disabled={estaConvertida || cotizacion.estado === 'Vencida'}
              >
                {cotizacion.prioridad}
              </button>
            </div>
          </div>
          
          {!estaConvertida && cotizacion.estado !== 'Vencida' && (
            <div className="border-t border-black/10 pt-4 mt-2">
              <p className="text-xs font-bold uppercase opacity-60 mb-3">Cambiar Estado:</p>
              <div className="flex gap-3 flex-wrap">
                <button
                  className={`btn btn-sm ${
                    cotizacion.estado === 'Pendiente' 
                      ? 'btn-warning cursor-not-allowed opacity-60' 
                      : 'btn-outline btn-warning hover:btn-warning'
                  }`}
                  onClick={() => handleCambiarEstado('Pendiente')}
                  disabled={cotizacion.estado === 'Pendiente' || loading}
                >
                  <Calculator size={16} className="mr-1.5" />
                  Pendiente
                </button>

                <button
                  className={`btn btn-sm ${
                    cotizacion.estado === 'Enviada' 
                      ? 'btn-info cursor-not-allowed opacity-60' 
                      : 'btn-outline btn-info hover:btn-info'
                  }`}
                  onClick={() => handleCambiarEstado('Enviada')}
                  disabled={cotizacion.estado === 'Enviada' || loading}
                >
                  <FileText size={16} className="mr-1.5" />
                  Enviada
                </button>

                <button
                  className={`btn btn-sm ${
                    cotizacion.estado === 'Aprobada' || creditoInsuficiente
                      ? 'btn-success cursor-not-allowed opacity-60' 
                      : 'btn-outline btn-success hover:btn-success'
                  }`}
                  onClick={() => !creditoInsuficiente && handleCambiarEstado('Aprobada')}
                  disabled={cotizacion.estado === 'Aprobada' || loading || creditoInsuficiente}
                  title={creditoInsuficiente ? "Crédito insuficiente para aprobar" : ""}
                >
                  {creditoInsuficiente ? <Lock size={16} className="mr-1.5" /> : <CheckCircle size={16} className="mr-1.5" />}
                  Aprobar (→ Nueva OV)
                </button>

                <button
                  className={`btn btn-sm ${
                    cotizacion.estado === 'Rechazada' 
                      ? 'btn-danger cursor-not-allowed opacity-60' 
                      : 'btn-outline btn-danger hover:btn-danger'
                  }`}
                  onClick={() => handleCambiarEstado('Rechazada')}
                  disabled={cotizacion.estado === 'Rechazada' || loading}
                >
                  <XCircle size={16} className="mr-1.5" />
                  Rechazar
                </button>
              </div>

              {creditoInsuficiente ? (
                <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-center gap-2">
                  <AlertTriangle size={14} />
                  <strong>Bloqueado:</strong> El total de la cotización excede el crédito disponible del cliente. No se puede aprobar.
                </div>
              ) : (
                <div className="mt-3 text-xs text-muted bg-blue-50 border border-blue-200 rounded p-2">
                  <AlertCircle size={12} className="inline mr-1" />
                  <strong>Nota:</strong> Al aprobar, se abrirá el formulario de Nueva Orden de Venta con los datos de esta cotización precargados.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="card">
          <div className="card-header bg-gradient-to-r from-blue-50 to-white">
            <h2 className="card-title text-blue-900">
              <Building size={20} />
              Cliente
            </h2>
          </div>
          <div className="card-body space-y-3">
            <div>
              <p className="text-xs text-muted uppercase font-semibold mb-1">Razón Social</p>
              <p className="font-bold text-lg">{cotizacion.cliente}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1">RUC</p>
                <p className="font-mono font-medium">{cotizacion.ruc_cliente}</p>
              </div>
              {cotizacion.telefono_cliente && (
                <div>
                  <p className="text-xs text-muted uppercase font-semibold mb-1">Teléfono</p>
                  <p className="font-medium">{cotizacion.telefono_cliente}</p>
                </div>
              )}
            </div>
            {cotizacion.direccion_cliente && (
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1 flex items-center gap-1">
                  <MapPin size={12} />
                  Dirección
                </p>
                <p className="text-sm">{cotizacion.direccion_cliente}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-gradient-to-r from-green-50 to-white">
            <h2 className="card-title text-green-900">
              <CreditCard size={20} />
              Condiciones Comerciales
            </h2>
          </div>
          <div className="card-body space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1">Moneda</p>
                <span className={`badge ${cotizacion.moneda === 'USD' ? 'badge-success' : 'badge-primary'}`}>
                  {cotizacion.moneda === 'USD' ? '$ USD' : 'S/ PEN'}
                </span>
              </div>
              {cotizacion.moneda === 'USD' && (
                <div>
                  <p className="text-xs text-muted uppercase font-semibold mb-1 flex items-center gap-1">
                    <TrendingUp size={12} />
                    T.C.
                  </p>
                  <p className="font-bold text-primary">
                    S/ {parseFloat(cotizacion.tipo_cambio || 1).toFixed(4)}
                  </p>
                </div>
              )}
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-muted uppercase font-semibold mb-1 flex items-center gap-1">
                <Percent size={12} />
                Impuesto
              </p>
              <p className="font-bold text-blue-900">
                {getTipoImpuestoNombre(cotizacion.tipo_impuesto)}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1">Plazo Pago</p>
                {cotizacion.plazo_pago && cotizacion.plazo_pago !== 'Contado' ? (
                  <span className="badge badge-warning">{cotizacion.plazo_pago}</span>
                ) : (
                  <span className="badge badge-success">Contado</span>
                )}
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1">Forma Pago</p>
                <p className="font-medium">{cotizacion.forma_pago || '-'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-gradient-to-r from-purple-50 to-white">
            <h2 className="card-title text-purple-900">
              <User size={20} />
              Información Adicional
            </h2>
          </div>
          <div className="card-body space-y-3">
            <div>
              <p className="text-xs text-muted uppercase font-semibold mb-1">Comercial Responsable</p>
              <p className="font-medium text-lg">{cotizacion.comercial || 'Sin asignar'}</p>
            </div>
            
            {cotizacion.plazo_entrega && (
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1 flex items-center gap-1">
                  <Calendar size={12} />
                  Plazo de Entrega
                </p>
                <p className="font-medium">{cotizacion.plazo_entrega}</p>
              </div>
            )}
            
            {cotizacion.lugar_entrega && (
  <div className="bg-orange-50 p-2 rounded border border-orange-100"> {/* Cambio para resaltar */}
    <p className="text-xs text-orange-800 uppercase font-semibold mb-1 flex items-center gap-1">
      <MapPin size={12} />
      Lugar de Entrega
    </p>
    <p className="text-sm font-medium text-gray-800">{cotizacion.lugar_entrega}</p>
  </div>
)}
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header bg-gradient-to-r from-gray-50 to-white">
          <h2 className="card-title">
            <Package size={20} />
            Productos Cotizados
            <span className="badge badge-primary ml-2">{cotizacion.detalle?.length || 0}</span>
          </h2>
        </div>
        <div className="card-body p-0">
          <Table
            columns={columns}
            data={cotizacion.detalle || []}
            emptyMessage="No hay productos en esta cotización"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {cotizacion.observaciones && (
          <div className="col-span-2 card">
            <div className="card-header">
              <h3 className="card-title">Observaciones</h3>
            </div>
            <div className="card-body">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{cotizacion.observaciones}</p>
            </div>
          </div>
        )}

        <div className={`card ${!cotizacion.observaciones ? 'col-span-3 ml-auto w-full max-w-md' : ''}`}>
          <div className="card-header bg-gradient-to-r from-primary/5 to-white">
            <h3 className="card-title">
              <Calculator size={20} />
              Resumen
            </h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted">Sub Total:</span>
                <span className="font-bold text-lg">{formatearMoneda(cotizacion.subtotal)}</span>
              </div>
              {cotizacion.total_comision > 0 && (
                <div className="flex justify-between py-2 border-b text-yellow-600">
                  <span className="font-medium">Total Comisiones ({parseFloat(cotizacion.porcentaje_comision_promedio || 0).toFixed(2)}%):</span>
                  <span className="font-bold">{formatearMoneda(cotizacion.total_comision)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted">
                  {getTipoImpuestoNombre(cotizacion.tipo_impuesto)}:
                </span>
                <span className="font-bold text-lg">{formatearMoneda(cotizacion.igv)}</span>
              </div>
              <div className="flex justify-between py-4 bg-gray-100 text-black px-4 rounded-xl shadow-inner">
                <span className="font-bold text-xl">TOTAL:</span>
                <span className="font-bold text-3xl">{formatearMoneda(cotizacion.total)}</span>
              </div>
              
              {cotizacion.moneda === 'USD' && parseFloat(cotizacion.tipo_cambio || 0) > 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-center text-blue-900">
                    <span className="font-medium">Equivalente en Soles:</span>
                    <span className="font-bold text-blue-900 text-lg">
                      S/ {formatearNumero(parseFloat(cotizacion.total) * parseFloat(cotizacion.tipo_cambio))}
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    TC: S/ {parseFloat(cotizacion.tipo_cambio).toFixed(4)}
                  </p>
                </div>
              )}
            </div>

            {estadoCredito && estadoCredito.usar_limite_credito && (
              <div className="mt-6 pt-4 border-t">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <CreditCard size={14} /> Saldo de Crédito del Cliente
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className={`p-3 rounded-lg border ${parseFloat(estadoCredito.credito_pen.disponible) < parseFloat(cotizacion.total) && cotizacion.moneda === 'PEN' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-600">PEN Disponible:</span>
                      <span className="font-bold text-gray-800">S/ {formatearNumero(parseFloat(estadoCredito.credito_pen.disponible))}</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg border ${parseFloat(estadoCredito.credito_usd.disponible) < parseFloat(cotizacion.total) && cotizacion.moneda === 'USD' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-600">USD Disponible:</span>
                      <span className="font-bold text-gray-800">$ {formatearNumero(parseFloat(estadoCredito.credito_usd.disponible))}</span>
                    </div>
                  </div>
                </div>
                {creditoInsuficiente && (
                  <p className="text-[10px] text-red-600 mt-2 font-bold flex items-center gap-1">
                    <AlertTriangle size={10} /> No podrá convertirse a OV: saldo insuficiente.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={modalPrioridadOpen}
        onClose={() => setModalPrioridadOpen(false)}
        title="Cambiar Prioridad"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-muted">Prioridad actual:</p>
            <p className="font-bold text-lg">{cotizacion.prioridad}</p>
          </div>
          
          <div className="space-y-2">
            {['Baja', 'Media', 'Alta', 'Urgente'].map(prioridad => (
              <button
                key={prioridad}
                className={`btn btn-outline w-full justify-start ${cotizacion.prioridad === prioridad ? 'opacity-50' : ''}`}
                onClick={() => handleCambiarPrioridad(prioridad)}
                disabled={cotizacion.prioridad === prioridad}
              >
                {prioridad}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button className="btn btn-outline" onClick={() => setModalPrioridadOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DetalleCotizacion;