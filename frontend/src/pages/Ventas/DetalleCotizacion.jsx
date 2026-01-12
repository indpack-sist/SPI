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
import { cotizacionesAPI } from '../../config/api';

function DetalleCotizacion() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [cotizacion, setCotizacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalPrioridadOpen, setModalPrioridadOpen] = useState(false);

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
      await cotizacionesAPI.descargarPDF(id);
      setSuccess('PDF descargado exitosamente');
    } catch (err) {
      console.error(err);
      setError('Error al descargar el PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicar = () => {
    navigate(`/ventas/cotizaciones/${id}/duplicar`);
  };

  const handleCambiarEstado = async (estado) => {
  try {
    setError(null);
    setLoading(true);
    
    const response = await cotizacionesAPI.actualizarEstado(id, estado);
    
    if (response.data.success) {
      if (estado === 'Aprobada' && response.data.data?.id_orden_venta) {
        // Convertida a Orden de Venta - redirigir
        setSuccess(`Cotización convertida exitosamente a ${response.data.data.numero_orden}`);
        
        setTimeout(() => {
          navigate(`/ventas/ordenes/${response.data.data.id_orden_venta}`);
        }, 1500);
      } else {
        // Cambio de estado normal - recargar datos
        await cargarDatos(); // Recargar todos los datos
        setSuccess(`Estado actualizado a ${estado}`);
      }
    }
    
  } catch (err) {
    setError(err.response?.data?.error || 'Error al cambiar estado');
  } finally {
    setLoading(false); // IMPORTANTE: Siempre liberar el loading
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

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatearMoneda = (valor) => {
    if (!cotizacion) return '-';
    const simbolo = cotizacion.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toFixed(3)}`;
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
                {['Pendiente', 'Enviada', 'Aprobada', 'Rechazada'].map(estado => {
                  const config = getEstadoConfig(estado);
                  const Icono = config.icono;
                  const esActual = cotizacion.estado === estado;
                  return (
                    <button
                      key={estado}
                      className={`btn btn-sm ${esActual ? 'btn-primary opacity-50 cursor-not-allowed' : 'btn-outline bg-white hover:bg-white/50'}`}
                      onClick={() => handleCambiarEstado(estado)}
                      disabled={esActual || loading}
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
                <p className="font-medium">{cotizacion.plazo_pago || '-'}</p>
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
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1 flex items-center gap-1">
                  <MapPin size={12} />
                  Lugar de Entrega
                </p>
                <p className="text-sm">{cotizacion.lugar_entrega}</p>
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
              <div className="flex justify-between py-4 bg-gradient-to-r from-primary to-blue-600 text-white px-4 rounded-xl">
                <span className="font-bold text-xl">TOTAL:</span>
                <span className="font-bold text-3xl">{formatearMoneda(cotizacion.total)}</span>
              </div>
              
              {cotizacion.moneda === 'USD' && parseFloat(cotizacion.tipo_cambio || 0) > 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-900 font-medium">
                      Equivalente en Soles:
                    </span>
                    <span className="font-bold text-blue-900 text-lg">
                      S/ {(parseFloat(cotizacion.total) * parseFloat(cotizacion.tipo_cambio)).toFixed(3)}
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    TC: S/ {parseFloat(cotizacion.tipo_cambio).toFixed(4)}
                  </p>
                </div>
              )}
            </div>
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