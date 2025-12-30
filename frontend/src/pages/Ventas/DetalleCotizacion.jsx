// frontend/src/pages/Ventas/DetalleCotizacion.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, Check, FileText, Calendar,
  DollarSign, Building, Clock, ShoppingCart, AlertCircle,
  CheckCircle, XCircle, Calculator, Percent, TrendingUp
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
  const [modalEstadoOpen, setModalEstadoOpen] = useState(false);
  const [modalPrioridadOpen, setModalPrioridadOpen] = useState(false);
  const [modalConvertirOpen, setModalConvertirOpen] = useState(false);

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
      console.error('Error al cargar la cotización:', err);
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
      console.error('Error al descargar PDF:', err);
      setError('Error al descargar el PDF');
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
        setCotizacion({ ...cotizacion, estado });
        setSuccess(`Estado actualizado a ${estado}`);
        setModalEstadoOpen(false);
      } else {
        setError(response.data.error || 'Error al cambiar estado');
      }
      
    } catch (err) {
      console.error('Error al cambiar estado:', err);
      setError(err.response?.data?.error || 'Error al cambiar estado');
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
      } else {
        setError(response.data.error || 'Error al cambiar prioridad');
      }
      
    } catch (err) {
      console.error('Error al cambiar prioridad:', err);
      setError(err.response?.data?.error || 'Error al cambiar prioridad');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertirVenta = async () => {
    try {
      setError(null);
      setLoading(true);
      
      // Esta función redirige a crear orden desde cotización
      navigate(`/ventas/ordenes/nueva?cotizacion=${id}`);
      
    } catch (err) {
      console.error('Error al convertir:', err);
      setError(err.response?.data?.error || 'Error al convertir a orden de venta');
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
    return `${simbolo} ${parseFloat(valor || 0).toFixed(2)}`;
  };

  // ✅ Mapeo de tipos de impuesto
  const getTipoImpuestoNombre = (codigo) => {
    const tipos = {
      'IGV': '18% (Incluye IGV)',
      'IGV3': '6% (Incluye IGV)',
      'IGV4': '18%',
      'GRA': '0% Gratis - Exonerado',
      '6%': '6%',
      'EXO': '0% Exonerado',
      'INA': 'Inafecto',
      'EXP': 'Exportación'
    };
    return tipos[codigo] || codigo || 'IGV (18%)';
  };

  const getEstadoConfig = (estado) => {
    const configs = {
      'Pendiente': { 
        icono: Clock, 
        clase: 'badge-warning',
        color: 'border-warning'
      },
      'Enviada': { 
        icono: FileText, 
        clase: 'badge-info',
        color: 'border-info'
      },
      'Aprobada': { 
        icono: CheckCircle, 
        clase: 'badge-success',
        color: 'border-success'
      },
      'Rechazada': { 
        icono: XCircle, 
        clase: 'badge-danger',
        color: 'border-danger'
      },
      'Convertida': { 
        icono: Check, 
        clase: 'badge-primary',
        color: 'border-primary'
      },
      'Vencida': { 
        icono: AlertCircle, 
        clase: 'badge-secondary',
        color: 'border-secondary'
      }
    };
    return configs[estado] || configs['Pendiente'];
  };

  const getPrioridadConfig = (prioridad) => {
    const configs = {
      'Baja': { clase: 'badge-secondary' },
      'Media': { clase: 'badge-info' },
      'Alta': { clase: 'badge-warning' },
      'Urgente': { clase: 'badge-danger' }
    };
    return configs[prioridad] || configs['Media'];
  };

  const columns = [
    {
      header: 'Código',
      accessor: 'codigo_producto',
      width: '120px',
      render: (value) => <span className="font-mono text-sm">{value}</span>
    },
    {
      header: 'Producto',
      accessor: 'producto',
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          {/* ✅ LÓGICA CORREGIDA: Mostrar solo si cantidad > stock */}
          {parseFloat(row.cantidad) > parseFloat(row.stock_disponible || 0) && (
            <div className="text-xs text-warning flex items-center gap-1 mt-1">
              <AlertTriangle size={12} />
              Requerirá producción (disponible: {parseFloat(row.stock_disponible || 0).toFixed(2)})
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Cantidad',
      accessor: 'cantidad',
      width: '120px',
      align: 'right',
      render: (value, row) => (
        <div className="text-right">
          <div className="font-bold">{parseFloat(value).toFixed(5)}</div>
          <div className="text-xs text-muted">{row.unidad_medida}</div>
        </div>
      )
    },
    {
      header: 'Precio Unitario',
      accessor: 'precio_unitario',
      width: '140px',
      align: 'right',
      render: (value) => (
        <span className="font-medium">{formatearMoneda(value)}</span>
      )
    },
    {
      header: 'Descuento',
      accessor: 'descuento_porcentaje',
      width: '100px',
      align: 'center',
      render: (value) => (
        <span className="text-sm">{parseFloat(value || 0).toFixed(2)}%</span>
      )
    },
    {
      header: 'Valor Venta',
      accessor: 'valor_venta',
      width: '140px',
      align: 'right',
      render: (value) => (
        <span className="font-bold text-primary">{formatearMoneda(value)}</span>
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
  const prioridadConfig = getPrioridadConfig(cotizacion.prioridad);
  const IconoEstado = estadoConfig.icono;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            className="btn btn-outline"
            onClick={() => navigate('/ventas/cotizaciones')}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText size={32} />
              Cotización {cotizacion.numero_cotizacion}
            </h1>
            <p className="text-muted">
              Emitida el {formatearFecha(cotizacion.fecha_emision)}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleDescargarPDF}>
            <Download size={20} /> PDF
          </button>
          
          {cotizacion.estado !== 'Convertida' && cotizacion.estado !== 'Vencida' && (
            <>
              <button className="btn btn-outline" onClick={() => setModalEstadoOpen(true)}>
                <Edit size={20} /> Estado
              </button>
              
              <button className="btn btn-outline" onClick={() => setModalPrioridadOpen(true)}>
                <Edit size={20} /> Prioridad
              </button>
              
              {cotizacion.estado === 'Aprobada' && (
                <button className="btn btn-primary" onClick={() => setModalConvertirOpen(true)}>
                  <ShoppingCart size={20} /> Convertir a Orden
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Estado y Prioridad */}
      <div className={`card border-l-4 ${estadoConfig.color} mb-4`}>
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${estadoConfig.clase} bg-opacity-10`}>
                <IconoEstado size={32} />
              </div>
              <div>
                <p className="text-sm text-muted">Estado de la Cotización</p>
                <h3 className="text-xl font-bold">{cotizacion.estado}</h3>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-muted">Prioridad</p>
              <span className={`badge ${prioridadConfig.clase}`}>
                {cotizacion.prioridad}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de vencimiento */}
      {cotizacion.estado === 'Pendiente' && cotizacion.fecha_vencimiento && (
        <div className="card border-l-4 border-warning bg-yellow-50 mb-4">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <AlertCircle size={24} className="text-warning" />
              <div>
                <p className="font-medium">Validez de la Cotización</p>
                <p className="text-sm text-muted">
                  Válida hasta el {formatearFecha(cotizacion.fecha_vencimiento)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Información General */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Cliente */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Building size={20} />
              Información del Cliente
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Razón Social:</label>
              <p className="font-bold text-lg">{cotizacion.cliente}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">RUC:</label>
              <p className="font-medium">{cotizacion.ruc_cliente}</p>
            </div>
            {cotizacion.direccion_cliente && (
              <div>
                <label className="text-sm font-medium text-muted">Dirección:</label>
                <p>{cotizacion.direccion_cliente}</p>
              </div>
            )}
            {cotizacion.telefono_cliente && (
              <div>
                <label className="text-sm font-medium text-muted">Teléfono:</label>
                <p>{cotizacion.telefono_cliente}</p>
              </div>
            )}
          </div>
        </div>

        {/* Datos Comerciales */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <DollarSign size={20} />
              Datos Comerciales
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted">Moneda:</label>
                <p className="font-medium">
                  {cotizacion.moneda === 'USD' ? 'Dólares (USD)' : 'Soles (PEN)'}
                </p>
              </div>
              {/* ✅ TIPO DE CAMBIO */}
              {(cotizacion.moneda === 'USD' || (cotizacion.tipo_cambio && parseFloat(cotizacion.tipo_cambio) !== 1.0000)) && (
                <div>
                  <label className="text-sm font-medium text-muted flex items-center gap-1">
                    <TrendingUp size={14} />
                    Tipo de Cambio:
                  </label>
                  <p className="font-bold text-primary">
                    S/ {parseFloat(cotizacion.tipo_cambio || 1).toFixed(4)}
                  </p>
                </div>
              )}
            </div>
            
            {/* ✅ TIPO DE IMPUESTO Y PORCENTAJE */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <label className="text-sm font-medium text-muted flex items-center gap-1">
                <Percent size={14} />
                Tipo de Impuesto:
              </label>
              <p className="font-bold text-primary">
                {getTipoImpuestoNombre(cotizacion.tipo_impuesto)}
              </p>
              {cotizacion.porcentaje_impuesto !== undefined && (
                <p className="text-xs text-muted mt-1">
                  Porcentaje aplicado: {parseFloat(cotizacion.porcentaje_impuesto).toFixed(2)}%
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <label className="text-sm font-medium text-muted">Plazo de Pago:</label>
                <p>{cotizacion.plazo_pago || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted">Forma de Pago:</label>
                <p>{cotizacion.forma_pago || '-'}</p>
              </div>
            </div>
            
            {cotizacion.direccion_entrega && (
              <div>
                <label className="text-sm font-medium text-muted">Dirección de Entrega:</label>
                <p className="text-sm">{cotizacion.direccion_entrega}</p>
              </div>
            )}
            
            {cotizacion.comercial && (
              <div>
                <label className="text-sm font-medium text-muted">Comercial:</label>
                <p className="font-medium">{cotizacion.comercial}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detalle de Productos */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">
            <FileText size={20} />
            Detalle de Productos
          </h2>
        </div>
        <div className="card-body">
          <Table
            columns={columns}
            data={cotizacion.detalle || []}
            emptyMessage="No hay productos en esta cotización"
          />
        </div>
      </div>

      {/* Observaciones y Totales */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Observaciones */}
        {cotizacion.observaciones ? (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Observaciones</h3>
            </div>
            <div className="card-body">
              <p className="whitespace-pre-wrap">{cotizacion.observaciones}</p>
            </div>
          </div>
        ) : (
          <div></div>
        )}

        {/* Totales */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Calculator size={20} />
              Resumen de Totales
            </h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="font-medium">Sub Total:</span>
                <span className="font-bold">{formatearMoneda(cotizacion.subtotal)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="font-medium">
                  {getTipoImpuestoNombre(cotizacion.tipo_impuesto)}:
                </span>
                <span className="font-bold">{formatearMoneda(cotizacion.igv)}</span>
              </div>
              <div className="flex justify-between py-3 bg-primary text-white px-4 rounded-lg">
                <span className="font-bold text-lg">TOTAL:</span>
                <span className="font-bold text-2xl">{formatearMoneda(cotizacion.total)}</span>
              </div>
              
              {/* ✅ NUEVO: Conversión de moneda con tipo de cambio */}
              {cotizacion.moneda === 'USD' && parseFloat(cotizacion.tipo_cambio || 1) > 1 && (
                <div className="flex justify-between py-2 bg-blue-50 px-4 rounded-lg border border-blue-200">
                  <span className="text-sm font-medium text-blue-900">
                    Equivalente en Soles (TC: {parseFloat(cotizacion.tipo_cambio).toFixed(4)}):
                  </span>
                  <span className="font-bold text-blue-900">
                    S/ {(parseFloat(cotizacion.total) * parseFloat(cotizacion.tipo_cambio)).toFixed(2)}
                  </span>
                </div>
              )}
              
              {cotizacion.moneda === 'PEN' && parseFloat(cotizacion.tipo_cambio || 1) > 1 && (
                <div className="flex justify-between py-2 bg-green-50 px-4 rounded-lg border border-green-200">
                  <span className="text-sm font-medium text-green-900">
                    Equivalente en Dólares (TC: {parseFloat(cotizacion.tipo_cambio).toFixed(4)}):
                  </span>
                  <span className="font-bold text-green-900">
                    $ {(parseFloat(cotizacion.total) / parseFloat(cotizacion.tipo_cambio)).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Cambiar Estado */}
      <Modal
        isOpen={modalEstadoOpen}
        onClose={() => setModalEstadoOpen(false)}
        title="Cambiar Estado"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-muted">Estado actual: <strong>{cotizacion.estado}</strong></p>
          
          <div className="space-y-2">
            {['Pendiente', 'Enviada', 'Aprobada', 'Rechazada'].map(estado => (
              <button
                key={estado}
                className="btn btn-outline w-full justify-start"
                onClick={() => handleCambiarEstado(estado)}
                disabled={cotizacion.estado === estado}
              >
                {estado}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button className="btn btn-outline" onClick={() => setModalEstadoOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Cambiar Prioridad */}
      <Modal
        isOpen={modalPrioridadOpen}
        onClose={() => setModalPrioridadOpen(false)}
        title="Cambiar Prioridad"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-muted">Prioridad actual: <strong>{cotizacion.prioridad}</strong></p>
          
          <div className="space-y-2">
            {['Baja', 'Media', 'Alta', 'Urgente'].map(prioridad => (
              <button
                key={prioridad}
                className="btn btn-outline w-full justify-start"
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

      {/* Modal Convertir a Orden */}
      <Modal
        isOpen={modalConvertirOpen}
        onClose={() => setModalConvertirOpen(false)}
        title="Convertir a Orden de Venta"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={24} className="text-info flex-shrink-0 mt-1" />
              <div>
                <p className="font-medium text-blue-900">¿Convertir esta cotización?</p>
                <p className="text-sm text-blue-700 mt-2">
                  Se creará una nueva Orden de Venta con todos los datos de esta cotización.
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Resumen:</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Cliente:</span>
                <span className="font-medium">{cotizacion.cliente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total:</span>
                <span className="font-bold text-primary">{formatearMoneda(cotizacion.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Productos:</span>
                <span>{cotizacion.detalle?.length || 0} item(s)</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button className="btn btn-outline" onClick={() => setModalConvertirOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleConvertirVenta}>
              <Check size={20} /> Continuar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DetalleCotizacion;