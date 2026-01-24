import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  User,
  Building,
  Calendar,
  CreditCard,
  FileText,
  X,
  Eye,
  ChevronRight
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { ordenesVentaAPI } from '../../config/api';

function VerificarOrdenes() {
  const navigate = useNavigate();
  
  const [ordenesPendientes, setOrdenesPendientes] = useState([]);
  const [datosVerificacion, setDatosVerificacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [modalVerificar, setModalVerificar] = useState(false);
  const [modalRechazar, setModalRechazar] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  
  const [formRechazo, setFormRechazo] = useState({
    motivo_rechazo: '',
    observaciones_verificador: ''
  });

  const [observacionesAprobacion, setObservacionesAprobacion] = useState('');

  useEffect(() => {
    cargarOrdenesPendientes();
  }, []);

  const cargarOrdenesPendientes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await ordenesVentaAPI.getOrdenesPendientesVerificacion();
      
      if (response.data.success) {
        setOrdenesPendientes(response.data.data || []);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar órdenes pendientes');
    } finally {
      setLoading(false);
    }
  };

  const abrirVerificacion = async (orden) => {
    try {
      setProcesando(true);
      setError(null);
      setOrdenSeleccionada(orden);
      
      const response = await ordenesVentaAPI.getDatosVerificacion(orden.id_orden_venta);
      
      if (response.data.success) {
        setDatosVerificacion(response.data.data);
        setModalVerificar(true);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar datos de verificación');
    } finally {
      setProcesando(false);
    }
  };

  const handleAprobar = async () => {
    if (!ordenSeleccionada) return;
    
    if (!confirm(`¿Está seguro de APROBAR la orden ${ordenSeleccionada.numero_orden}?`)) {
      return;
    }
    
    try {
      setProcesando(true);
      setError(null);
      
      const response = await ordenesVentaAPI.aprobarVerificacion(
        ordenSeleccionada.id_orden_venta,
        { observaciones_verificador: observacionesAprobacion || null }
      );
      
      if (response.data.success) {
        setSuccess(`Orden ${ordenSeleccionada.numero_orden} aprobada exitosamente`);
        setModalVerificar(false);
        setDatosVerificacion(null);
        setOrdenSeleccionada(null);
        setObservacionesAprobacion('');
        await cargarOrdenesPendientes();
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al aprobar orden');
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = async (e) => {
    e.preventDefault();
    
    if (!ordenSeleccionada) return;
    
    if (!formRechazo.motivo_rechazo.trim()) {
      setError('El motivo del rechazo es obligatorio');
      return;
    }
    
    try {
      setProcesando(true);
      setError(null);
      
      const response = await ordenesVentaAPI.rechazarVerificacion(
        ordenSeleccionada.id_orden_venta,
        formRechazo
      );
      
      if (response.data.success) {
        setSuccess(`Orden ${ordenSeleccionada.numero_orden} rechazada exitosamente`);
        setModalRechazar(false);
        setModalVerificar(false);
        setDatosVerificacion(null);
        setOrdenSeleccionada(null);
        setFormRechazo({ motivo_rechazo: '', observaciones_verificador: '' });
        await cargarOrdenesPendientes();
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al rechazar orden');
    } finally {
      setProcesando(false);
    }
  };

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return '-';
    const cleanFecha = fechaStr.split('T')[0];
    const partes = cleanFecha.split('-');
    if (partes.length !== 3) return cleanFecha;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2
    }).format(valor);
  };

  const formatearMoneda = (valor, moneda = 'PEN') => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  const getPrioridadConfig = (prioridad) => {
    const configs = {
      'Baja': { clase: 'badge-secondary', color: '#6b7280' },
      'Media': { clase: 'badge-info', color: '#3b82f6' },
      'Alta': { clase: 'badge-warning', color: '#f59e0b' },
      'Urgente': { clase: 'badge-danger', color: '#ef4444' }
    };
    return configs[prioridad] || configs['Media'];
  };

  const columns = [
    {
      header: 'N° Orden',
      accessor: 'numero_orden',
      width: '140px',
      render: (value, row) => (
        <div>
          <div className="font-mono font-bold text-primary">{value}</div>
          {row.numero_comprobante && (
            <div className="text-xs text-muted">
              {row.tipo_comprobante}: {row.numero_comprobante}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Fecha',
      accessor: 'fecha_emision',
      width: '110px',
      render: (value) => (
        <div className="text-sm">{formatearFecha(value)}</div>
      )
    },
    {
      header: 'Cliente',
      accessor: 'cliente',
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted">RUC: {row.ruc_cliente}</div>
        </div>
      )
    },
    {
      header: 'Comercial',
      accessor: 'comercial',
      width: '150px',
      render: (value) => (
        <div className="flex items-center gap-1 text-sm">
          <User size={14} className="text-primary" />
          {value || 'Sin asignar'}
        </div>
      )
    },
    {
      header: 'Tipo Venta',
      accessor: 'tipo_venta',
      width: '120px',
      align: 'center',
      render: (value, row) => (
        <div>
          <span className={`badge ${value === 'Contado' ? 'badge-success' : 'badge-warning'}`}>
            {value || 'Contado'}
          </span>
          {value === 'Crédito' && row.dias_credito && (
            <div className="text-xs text-muted mt-1">
              {row.dias_credito} días
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Total',
      accessor: 'total',
      width: '120px',
      align: 'right',
      render: (value, row) => (
        <div className="font-bold text-primary">
          {formatearMoneda(value, row.moneda)}
        </div>
      )
    },
    {
      header: 'Prioridad',
      accessor: 'prioridad',
      width: '100px',
      align: 'center',
      render: (value) => {
        const config = getPrioridadConfig(value);
        return (
          <span className={`badge ${config.clase}`}>
            {value}
          </span>
        );
      }
    },
    {
      header: 'Items',
      accessor: 'total_items',
      width: '70px',
      align: 'center',
      render: (value) => (
        <span className="badge badge-neutral">{value || 0}</span>
      )
    },
    {
      header: 'Acciones',
      accessor: 'id_orden_venta',
      width: '100px',
      align: 'center',
      render: (value, row) => (
        <button
          className="btn btn-sm btn-primary"
          onClick={() => abrirVerificacion(row)}
          disabled={procesando}
        >
          <Eye size={14} />
          Verificar
        </button>
      )
    }
  ];
  if (loading) return <Loading message="Cargando órdenes pendientes..." />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield size={32} className="text-primary" />
            Verificación de Órdenes de Venta
          </h1>
          <p className="text-muted">Aprobar o rechazar órdenes pendientes de verificación</p>
        </div>
        <button 
          className="btn btn-outline"
          onClick={() => navigate('/ventas/ordenes')}
        >
          Volver a Órdenes
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card border-l-4 border-warning">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Pendientes Verificación</p>
                <h3 className="text-3xl font-bold text-warning">{ordenesPendientes.length}</h3>
                <p className="text-xs text-muted mt-1">Requieren atención</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock size={32} className="text-warning" />
              </div>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-info">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Monto Total Pendiente</p>
                <h3 className="text-2xl font-bold text-info">
                  {formatearMoneda(
                    ordenesPendientes.reduce((sum, o) => sum + parseFloat(o.total || 0), 0),
                    'PEN'
                  )}
                </h3>
                <p className="text-xs text-muted mt-1">En revisión</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign size={32} className="text-info" />
              </div>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-danger">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Órdenes Urgentes</p>
                <h3 className="text-3xl font-bold text-danger">
                  {ordenesPendientes.filter(o => o.prioridad === 'Urgente').length}
                </h3>
                <p className="text-xs text-muted mt-1">Alta prioridad</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertTriangle size={32} className="text-danger" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {ordenesPendientes.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <CheckCircle size={64} className="text-success mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              ¡Excelente! No hay órdenes pendientes de verificación
            </h3>
            <p className="text-muted mb-4">
              Todas las órdenes han sido revisadas y aprobadas
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/ventas/ordenes')}
            >
              Ver Todas las Órdenes
            </button>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="card-header flex justify-between items-center bg-gray-50/50">
            <h2 className="card-title">
              Órdenes Pendientes de Verificación
              <span className="badge badge-warning ml-2">{ordenesPendientes.length}</span>
            </h2>
          </div>
          
          <div className="card-body p-0">
            <Table
              columns={columns}
              data={ordenesPendientes}
              emptyMessage="No hay órdenes pendientes de verificación"
            />
          </div>
        </div>
      )}

      <Modal 
        isOpen={modalVerificar} 
        onClose={() => {
          setModalVerificar(false);
          setDatosVerificacion(null);
          setOrdenSeleccionada(null);
          setObservacionesAprobacion('');
        }}
        title={`Verificación de Orden ${ordenSeleccionada?.numero_orden || ''}`}
        size="xl"
      >
        {datosVerificacion && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card bg-blue-50 border border-blue-200">
                <div className="card-header bg-blue-100 border-b border-blue-200">
                  <h3 className="font-bold text-blue-900 flex items-center gap-2">
                    <FileText size={18} />
                    Datos de la Orden
                  </h3>
                </div>
                <div className="card-body space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Cliente:</span>
                    <span className="font-semibold text-right">{datosVerificacion.orden.cliente}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">RUC:</span>
                    <span className="font-mono">{datosVerificacion.orden.ruc_cliente}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Tipo Venta:</span>
                    <span className={`badge ${datosVerificacion.orden.tipo_venta === 'Contado' ? 'badge-success' : 'badge-warning'}`}>
                      {datosVerificacion.orden.tipo_venta || 'Contado'}
                    </span>
                  </div>
                  {datosVerificacion.orden.dias_credito > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted">Plazo:</span>
                      <span className="font-semibold">{datosVerificacion.orden.dias_credito} días</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted">Total Orden:</span>
                    <span className="font-bold text-primary text-lg">
                      {formatearMoneda(datosVerificacion.orden.total, datosVerificacion.orden.moneda)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Comercial:</span>
                    <span className="font-semibold">{datosVerificacion.orden.comercial || 'Sin asignar'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Productos:</span>
                    <span className="badge badge-neutral">{datosVerificacion.orden.detalle?.length || 0} items</span>
                  </div>
                </div>
              </div>

              <div className="card bg-purple-50 border border-purple-200">
                <div className="card-header bg-purple-100 border-b border-purple-200">
                  <h3 className="font-bold text-purple-900 flex items-center gap-2">
                    <Building size={18} />
                    Información del Cliente
                  </h3>
                </div>
                <div className="card-body space-y-2 text-sm">
                  {datosVerificacion.orden.direccion_cliente && (
                    <div>
                      <span className="text-muted block mb-1">Dirección:</span>
                      <span className="text-xs">{datosVerificacion.orden.direccion_cliente}</span>
                    </div>
                  )}
                  {datosVerificacion.orden.telefono_cliente && (
                    <div className="flex justify-between">
                      <span className="text-muted">Teléfono:</span>
                      <span className="font-semibold">{datosVerificacion.orden.telefono_cliente}</span>
                    </div>
                  )}
                  {datosVerificacion.orden.email_cliente && (
                    <div>
                      <span className="text-muted block mb-1">Email:</span>
                      <span className="text-xs">{datosVerificacion.orden.email_cliente}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-purple-200">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted">Total Órdenes (6m):</span>
                      <span className="font-bold">{datosVerificacion.estadisticas_pago.total_ordenes || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Órdenes Pagadas:</span>
                      <span className="font-bold text-success">{datosVerificacion.estadisticas_pago.ordenes_pagadas || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Pendientes Pago:</span>
                      <span className="font-bold text-warning">{datosVerificacion.estadisticas_pago.ordenes_pendientes || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {datosVerificacion.analisis_credito && (
              <div className={`card border-2 ${datosVerificacion.alertas.excede_limite_credito ? 'border-red-400 bg-red-50' : 'border-green-400 bg-green-50'}`}>
                <div className={`card-header ${datosVerificacion.alertas.excede_limite_credito ? 'bg-red-100 border-b border-red-200' : 'bg-green-100 border-b border-green-200'}`}>
                  <h3 className={`font-bold flex items-center gap-2 ${datosVerificacion.alertas.excede_limite_credito ? 'text-red-900' : 'text-green-900'}`}>
                    <CreditCard size={18} />
                    Análisis de Crédito
                    {datosVerificacion.alertas.excede_limite_credito && (
                      <span className="badge badge-danger ml-2">¡EXCEDE LÍMITE!</span>
                    )}
                  </h3>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted text-xs mb-1">Límite Asignado</p>
                      <p className="font-bold text-lg">{formatearMoneda(datosVerificacion.analisis_credito.limite_asignado, datosVerificacion.orden.moneda)}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs mb-1">Deuda Actual</p>
                      <p className="font-bold text-lg text-warning">{formatearMoneda(datosVerificacion.analisis_credito.deuda_actual, datosVerificacion.orden.moneda)}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs mb-1">Disponible ANTES</p>
                      <p className="font-bold text-lg text-info">{formatearMoneda(datosVerificacion.analisis_credito.disponible, datosVerificacion.orden.moneda)}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs mb-1">Disponible DESPUÉS</p>
                      <p className={`font-bold text-lg ${datosVerificacion.analisis_credito.disponible_despues_orden < 0 ? 'text-danger' : 'text-success'}`}>
                        {formatearMoneda(datosVerificacion.analisis_credito.disponible_despues_orden, datosVerificacion.orden.moneda)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted">Uso Actual</span>
                        <span className="font-bold">{datosVerificacion.analisis_credito.porcentaje_uso_actual}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full ${parseFloat(datosVerificacion.analisis_credito.porcentaje_uso_actual) > 90 ? 'bg-danger' : parseFloat(datosVerificacion.analisis_credito.porcentaje_uso_actual) > 70 ? 'bg-warning' : 'bg-success'}`}
                          style={{ width: `${Math.min(100, datosVerificacion.analisis_credito.porcentaje_uso_actual)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted">Uso Después de Aprobar</span>
                        <span className="font-bold">{datosVerificacion.analisis_credito.porcentaje_uso_despues}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full ${parseFloat(datosVerificacion.analisis_credito.porcentaje_uso_despues) > 100 ? 'bg-danger' : parseFloat(datosVerificacion.analisis_credito.porcentaje_uso_despues) > 90 ? 'bg-warning' : 'bg-success'}`}
                          style={{ width: `${Math.min(100, datosVerificacion.analisis_credito.porcentaje_uso_despues)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {datosVerificacion.alertas && (
              <div className="space-y-2">
                {datosVerificacion.alertas.excede_limite_credito && (
                  <div className="alert alert-danger">
                    <AlertTriangle size={20} />
                    <div>
                      <strong>¡ALERTA CRÍTICA!</strong> Esta orden excede el límite de crédito disponible del cliente.
                      <br />
                      <small>
                        Déficit: {formatearMoneda(
                          Math.abs(datosVerificacion.analisis_credito.disponible_despues_orden),
                          datosVerificacion.orden.moneda
                        )}
                      </small>
                    </div>
                  </div>
                )}

                {datosVerificacion.alertas.tiene_ordenes_vencidas && (
                  <div className="alert alert-warning">
                    <Clock size={20} />
                    <div>
                      <strong>Atención:</strong> El cliente tiene {datosVerificacion.ordenes_vencidas.length} orden(es) vencida(s) sin pagar.
                    </div>
                  </div>
                )}

                {datosVerificacion.alertas.promedio_retraso_alto && (
                  <div className="alert alert-warning">
                    <TrendingUp size={20} />
                    <div>
                      <strong>Historial de Retrasos:</strong> El cliente tiene un promedio de {Math.round(datosVerificacion.estadisticas_pago.promedio_dias_retraso || 0)} días de retraso en sus pagos.
                    </div>
                  </div>
                )}

                {datosVerificacion.alertas.tasa_pago_baja && (
                  <div className="alert alert-info">
                    <AlertTriangle size={20} />
                    <div>
                      <strong>Tasa de Cumplimiento:</strong> El cliente ha pagado {datosVerificacion.estadisticas_pago.ordenes_pagadas} de {datosVerificacion.estadisticas_pago.total_ordenes} órdenes (
                      {datosVerificacion.estadisticas_pago.total_ordenes > 0 
                        ? ((datosVerificacion.estadisticas_pago.ordenes_pagadas / datosVerificacion.estadisticas_pago.total_ordenes) * 100).toFixed(0)
                        : 0}%).
                    </div>
                  </div>
                )}
              </div>
            )}
            {datosVerificacion.ordenes_vencidas && datosVerificacion.ordenes_vencidas.length > 0 && (
              <div className="card border-l-4 border-danger">
                <div className="card-header bg-red-50">
                  <h3 className="font-bold text-danger flex items-center gap-2">
                    <XCircle size={18} />
                    Órdenes Vencidas ({datosVerificacion.ordenes_vencidas.length})
                  </h3>
                </div>
                <div className="card-body">
                  <div className="space-y-2">
                    {datosVerificacion.ordenes_vencidas.map((vencida, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-red-50 rounded border border-red-200">
                        <div>
                          <div className="font-mono font-semibold text-sm">{vencida.numero_orden}</div>
                          <div className="text-xs text-muted">
                            Vencida: {formatearFecha(vencida.fecha_vencimiento)} 
                            <span className="text-danger font-bold ml-2">
                              ({vencida.dias_vencido} días)
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-danger">
                            {formatearMoneda(vencida.saldo_pendiente, vencida.moneda)}
                          </div>
                          <div className="text-xs text-muted">Saldo pendiente</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {datosVerificacion.historial_cliente && datosVerificacion.historial_cliente.length > 0 && (
              <div className="card border-l-4 border-info">
                <div className="card-header bg-blue-50">
                  <h3 className="font-bold text-info flex items-center gap-2">
                    <Calendar size={18} />
                    Historial de Órdenes (Últimas 10)
                  </h3>
                </div>
                <div className="card-body">
                  <div className="overflow-x-auto">
                    <table className="table table-sm w-full">
                      <thead>
                        <tr>
                          <th>N° Orden</th>
                          <th>Fecha</th>
                          <th className="text-right">Total</th>
                          <th className="text-right">Pagado</th>
                          <th className="text-center">Estado Pago</th>
                          <th className="text-center">Estado</th>
                          <th className="text-center">Retraso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datosVerificacion.historial_cliente.map((hist, idx) => {
                          const diasRetraso = hist.dias_retraso || 0;
                          const tieneRetraso = diasRetraso > 0 && hist.estado_pago !== 'Pagado';
                          
                          return (
                            <tr key={idx} className={tieneRetraso ? 'bg-red-50' : ''}>
                              <td className="font-mono text-xs">{hist.numero_orden}</td>
                              <td className="text-xs">{formatearFecha(hist.fecha_emision)}</td>
                              <td className="text-right font-semibold text-xs">
                                {formatearMoneda(hist.total, hist.moneda)}
                              </td>
                              <td className="text-right text-xs">
                                {formatearMoneda(hist.monto_pagado, hist.moneda)}
                              </td>
                              <td className="text-center">
                                <span className={`badge badge-xs ${
                                  hist.estado_pago === 'Pagado' ? 'badge-success' : 
                                  hist.estado_pago === 'Parcial' ? 'badge-info' : 'badge-warning'
                                }`}>
                                  {hist.estado_pago}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className={`badge badge-xs ${
                                  hist.estado === 'Entregada' ? 'badge-success' : 
                                  hist.estado === 'Cancelada' ? 'badge-danger' : 'badge-info'
                                }`}>
                                  {hist.estado}
                                </span>
                              </td>
                              <td className="text-center">
                                {tieneRetraso ? (
                                  <span className="text-danger font-bold text-xs">
                                    {diasRetraso} días
                                  </span>
                                ) : hist.estado_pago === 'Pagado' ? (
                                  <span className="text-success text-xs">
                                    <CheckCircle size={14} className="inline" />
                                  </span>
                                ) : (
                                  <span className="text-muted text-xs">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="card border-l-4 border-gray-300">
              <div className="card-header bg-gray-50">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <FileText size={18} />
                  Detalle de Productos ({datosVerificacion.orden.detalle?.length || 0} items)
                </h3>
              </div>
              <div className="card-body">
                <div className="overflow-x-auto">
                  <table className="table table-sm w-full">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th className="text-right">Cantidad</th>
                        <th className="text-right">Precio Unit.</th>
                        <th className="text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datosVerificacion.orden.detalle?.map((item, idx) => (
                        <tr key={idx}>
                          <td className="font-mono text-xs">{item.codigo_producto}</td>
                          <td>
                            <div className="font-medium text-sm">{item.producto}</div>
                            <div className="text-xs text-muted">{item.unidad_medida}</div>
                          </td>
                          <td className="text-right font-semibold">{formatearNumero(item.cantidad)}</td>
                          <td className="text-right">{formatearMoneda(item.precio_unitario, datosVerificacion.orden.moneda)}</td>
                          <td className="text-right font-bold text-primary">
                            {formatearMoneda(item.valor_venta, datosVerificacion.orden.moneda)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2">
                        <td colSpan="4" className="text-right font-bold">TOTAL:</td>
                        <td className="text-right font-bold text-xl text-primary">
                          {formatearMoneda(datosVerificacion.orden.total, datosVerificacion.orden.moneda)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="card bg-gray-50 border border-gray-200">
              <div className="card-header bg-gray-100 border-b border-gray-200">
                <h3 className="font-bold text-gray-700">Observaciones del Verificador (Opcional)</h3>
              </div>
              <div className="card-body">
                <textarea
                  className="form-textarea w-full"
                  rows={3}
                  placeholder="Agregue observaciones o comentarios sobre esta verificación (opcional)..."
                  value={observacionesAprobacion}
                  onChange={(e) => setObservacionesAprobacion(e.target.value)}
                ></textarea>
                <small className="text-muted">
                  Estas observaciones quedarán registradas en el historial de la orden.
                </small>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setModalVerificar(false);
                  setDatosVerificacion(null);
                  setOrdenSeleccionada(null);
                  setObservacionesAprobacion('');
                }}
                disabled={procesando}
              >
                Cancelar
              </button>
              
              <button
                className="btn btn-danger"
                onClick={() => {
                  setModalRechazar(true);
                }}
                disabled={procesando}
              >
                <XCircle size={18} />
                Rechazar Orden
              </button>

              <button
                className="btn btn-success"
                onClick={handleAprobar}
                disabled={procesando}
              >
                <CheckCircle size={18} />
                {procesando ? 'Aprobando...' : 'Aprobar Orden'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={modalRechazar}
        onClose={() => {
          setModalRechazar(false);
          setFormRechazo({ motivo_rechazo: '', observaciones_verificador: '' });
        }}
        title={`Rechazar Orden ${ordenSeleccionada?.numero_orden || ''}`}
        size="md"
      >
        <form onSubmit={handleRechazar}>
          <div className="space-y-4">
            <div className="alert alert-warning">
              <AlertTriangle size={20} />
              <div>
                <strong>¡Atención!</strong> Esta acción rechazará la orden y notificará al comercial.
                <br />
                <small>El comercial podrá corregir la orden y reenviarla para una nueva verificación.</small>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Motivo del Rechazo *
              </label>
              <select
                className="form-select"
                value={formRechazo.motivo_rechazo}
                onChange={(e) => setFormRechazo({ ...formRechazo, motivo_rechazo: e.target.value })}
                required
              >
                <option value="">Seleccione un motivo...</option>
                <option value="Cliente excede límite de crédito">Cliente excede límite de crédito</option>
                <option value="Cliente tiene órdenes vencidas sin pagar">Cliente tiene órdenes vencidas sin pagar</option>
                <option value="Historial de pagos deficiente">Historial de pagos deficiente</option>
                <option value="Información incompleta del cliente">Información incompleta del cliente</option>
                <option value="Productos o cantidades incorrectas">Productos o cantidades incorrectas</option>
                <option value="Precios no autorizados">Precios no autorizados</option>
                <option value="Condiciones de pago no aprobadas">Condiciones de pago no aprobadas</option>
                <option value="Requiere autorización de gerencia">Requiere autorización de gerencia</option>
                <option value="Otro motivo">Otro motivo</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Observaciones Adicionales
              </label>
              <textarea
                className="form-textarea"
                rows={4}
                placeholder="Agregue detalles específicos sobre el rechazo, instrucciones para corrección, o cualquier información adicional..."
                value={formRechazo.observaciones_verificador}
                onChange={(e) => setFormRechazo({ ...formRechazo, observaciones_verificador: e.target.value })}
              ></textarea>
              <small className="text-muted">
                Ejemplo: "Solicitar pago adelantado del 50% antes de procesar", "Actualizar precio según lista vigente", etc.
              </small>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setModalRechazar(false);
                  setFormRechazo({ motivo_rechazo: '', observaciones_verificador: '' });
                }}
                disabled={procesando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={procesando || !formRechazo.motivo_rechazo.trim()}
              >
                <XCircle size={18} />
                {procesando ? 'Rechazando...' : 'Confirmar Rechazo'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default VerificarOrdenes;