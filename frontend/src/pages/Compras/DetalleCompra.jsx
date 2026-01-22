import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, ShoppingCart, CheckCircle,
  XCircle, Clock, AlertCircle, Building, Calendar,
  MapPin, CreditCard, Wallet, DollarSign, TrendingUp,
  ArrowRightLeft, PackageCheck, FileText
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { comprasAPI, cuentasPagoAPI } from '../../config/api';

function DetalleCompra() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [compra, setCompra] = useState(null);
  const [cuotas, setCuotas] = useState([]);
  const [resumenPagos, setResumenPagos] = useState(null);
  const [historialPagos, setHistorialPagos] = useState([]);
  const [cuentasPago, setCuentasPago] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [modalPagarCuotaOpen, setModalPagarCuotaOpen] = useState(false);
  const [modalPagoDirectoOpen, setModalPagoDirectoOpen] = useState(false);
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState(null);
  const [modalCancelarOpen, setModalCancelarOpen] = useState(false);
  
  const [datosPago, setDatosPago] = useState({
    id_cuenta_pago: '',
    monto_pagado: '',
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'Transferencia',
    referencia: '',
    observaciones: ''
  });

  const [motivoCancelacion, setMotivoCancelacion] = useState('');

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [compraRes, resumenRes, historialRes, cuentasRes] = await Promise.all([
        comprasAPI.getById(id),
        comprasAPI.getResumenPagos(id),
        comprasAPI.getHistorialPagos(id),
        cuentasPagoAPI.getAll({ estado: 'Activo' })
      ]);
      
      if (compraRes.data.success) {
        const compraData = compraRes.data.data;
        setCompra(compraData);
        
        if (compraData.tipo_compra === 'Credito') {
          const cuotasRes = await comprasAPI.getCuotas(id);
          if (cuotasRes.data.success) {
            setCuotas(cuotasRes.data.data || []);
          }
        }
      } else {
        setError('Compra no encontrada');
      }

      if (resumenRes.data.success) {
        setResumenPagos(resumenRes.data.data);
      }

      if (historialRes.data.success) {
        setHistorialPagos(historialRes.data.data || []);
      }

      if (cuentasRes.data.success) {
        setCuentasPago(cuentasRes.data.data || []);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar la compra');
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirPagarCuota = (cuota) => {
    setCuotaSeleccionada(cuota);
    const saldoPendiente = parseFloat(cuota.monto_cuota) - parseFloat(cuota.monto_pagado || 0);
    setDatosPago({
      id_cuenta_pago: '',
      monto_pagado: saldoPendiente.toFixed(2),
      fecha_pago: new Date().toISOString().split('T')[0],
      metodo_pago: 'Transferencia',
      referencia: '',
      observaciones: ''
    });
    setModalPagarCuotaOpen(true);
  };

  const handleAbrirPagoDirecto = () => {
    const saldoPendienteTotal = parseFloat(compra.total) - parseFloat(compra.monto_pagado || 0);
    setDatosPago({
      id_cuenta_pago: '',
      monto_pagado: saldoPendienteTotal.toFixed(2),
      fecha_pago: new Date().toISOString().split('T')[0],
      metodo_pago: 'Transferencia',
      referencia: '',
      observaciones: ''
    });
    setModalPagoDirectoOpen(true);
  };

  const handlePagarCuota = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const response = await comprasAPI.pagarCuota(id, cuotaSeleccionada.id_cuota, datosPago);
      if (response.data.success) {
        setSuccess(`Pago de cuota registrado exitosamente.`);
        setModalPagarCuotaOpen(false);
        await cargarDatos();
      } else {
        setError(response.data.error || 'Error al registrar pago');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar pago');
    } finally {
      setLoading(false);
    }
  };

  const handlePagoDirecto = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const response = await comprasAPI.registrarPago(id, datosPago);
      if (response.data.success) {
        const estadoFinal = response.data.data.estado_pago;
        setSuccess(`Pago registrado exitosamente (${estadoFinal === 'Pagado' ? 'Total' : 'Parcial'}).`);
        setModalPagoDirectoOpen(false);
        await cargarDatos();
      } else {
        setError(response.data.error || 'Error al registrar pago');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar pago');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarCompra = async () => {
    if (!motivoCancelacion.trim()) {
      setError('Debe indicar el motivo de cancelación');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await comprasAPI.cancelar(id, motivoCancelacion);
      if (response.data.success) {
        setSuccess('Compra cancelada exitosamente');
        setModalCancelarOpen(false);
        await cargarDatos();
      } else {
        setError(response.data.error || 'Error al cancelar compra');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cancelar compra');
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarPDF = async () => {
    try {
      setLoading(true);
      await comprasAPI.descargarPDF(id);
      setSuccess('PDF descargado exitosamente');
    } catch (err) {
      setError('Error al descargar el PDF');
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatearFechaHora = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatearMoneda = (valor, monedaOverride = null) => {
    const monedaUsar = monedaOverride || compra?.moneda;
    if (!monedaUsar) return '-';
    const simbolo = monedaUsar === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor).toFixed(2)}`;
  };

  const getEstadoPagoConfig = (estado) => {
    const configs = {
      'Pendiente': { clase: 'badge-warning', icono: Clock },
      'Parcial': { clase: 'badge-info', icono: TrendingUp },
      'Pagado': { clase: 'badge-success', icono: CheckCircle }
    };
    return configs[estado] || configs['Pendiente'];
  };

  const getNivelAlertaClase = (nivel) => {
    const clases = { 'success': 'badge-success', 'info': 'badge-info', 'warning': 'badge-warning', 'danger': 'badge-danger' };
    return clases[nivel] || 'badge-info';
  };

  if (loading && !compra) return <Loading message="Cargando compra..." />;
  
  if (!compra) {
    return (
      <div className="p-6">
        <Alert type="error" message="Compra no encontrada" />
        <button className="btn btn-outline mt-4" onClick={() => navigate('/compras')}>
          <ArrowLeft size={20} /> Volver
        </button>
      </div>
    );
  }

  const estadoPagoConfig = getEstadoPagoConfig(compra.estado_pago);
  const IconoEstadoPago = estadoPagoConfig.icono;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button className="btn btn-outline" onClick={() => navigate('/compras')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart size={32} />
              Compra {compra.numero_orden}
            </h1>
            <div className="flex items-center gap-2 text-muted">
                <p>Emitida el {formatearFecha(compra.fecha_emision)}</p>
                {compra.estado === 'Recibida' && (
                    <span className="badge badge-success flex items-center gap-1 text-xs">
                        <CheckCircle size={12} /> Recibida
                    </span>
                )}
                {compra.estado === 'Confirmada' && (
                    <span className="badge badge-info flex items-center gap-1 text-xs">
                        <Clock size={12} /> Confirmada
                    </span>
                )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleDescargarPDF}>
            <Download size={20} /> PDF
          </button>
          
          {compra.estado !== 'Cancelada' && compra.estado_pago !== 'Pagado' && (
            <>
              {compra.tipo_compra === 'Contado' && (
                  <button 
                    className="btn btn-primary"
                    onClick={handleAbrirPagoDirecto}
                  >
                    <DollarSign size={20} /> Registrar Pago
                  </button>
              )}
              
              <button 
                className="btn btn-outline"
                onClick={() => navigate(`/compras/${id}/editar`)}
              >
                <Edit size={20} /> Editar
              </button>
              
              <button 
                className="btn btn-danger"
                onClick={() => setModalCancelarOpen(true)}
              >
                <XCircle size={20} /> Cancelar Compra
              </button>
            </>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className={`card border-l-4 ${estadoPagoConfig.clase.replace('badge-', 'border-')} mb-4`}>
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${estadoPagoConfig.clase} bg-opacity-10`}>
                <IconoEstadoPago size={32} />
              </div>
              <div>
                <p className="text-sm text-muted">Estado de Pago</p>
                <h3 className="text-xl font-bold">{compra.estado_pago}</h3>
                <p className="text-sm text-muted">
                  {compra.tipo_compra === 'Contado' ? 'Compra al Contado' : `Compra a Crédito - ${compra.numero_cuotas} cuotas`}
                </p>
              </div>
            </div>
            
            {resumenPagos && (
              <div className="text-right">
                <div className="mb-2">
                  <span className="text-sm text-muted">Total: </span>
                  <span className="font-bold text-lg">{formatearMoneda(resumenPagos.total_compra)}</span>
                </div>
                <div className="mb-2">
                  <span className="text-sm text-muted">Pagado: </span>
                  <span className="font-bold text-success">{formatearMoneda(resumenPagos.monto_pagado)}</span>
                </div>
                {resumenPagos.saldo_pendiente > 0 && (
                  <div>
                    <span className="text-sm text-muted">Pendiente: </span>
                    <span className="font-bold text-danger">{formatearMoneda(resumenPagos.saldo_pendiente)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {compra.tipo_cambio && parseFloat(compra.tipo_cambio) !== 1.0 && (
        <div className="card border-l-4 border-info mb-4">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ArrowRightLeft size={24} className="text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted">Conversión de Moneda Aplicada</p>
                  <h3 className="text-xl font-bold">
                    Tipo de Cambio: {parseFloat(compra.tipo_cambio).toFixed(4)}
                  </h3>
                  <p className="text-sm text-muted">
                    Compra en {compra.moneda} / Cuenta en {compra.moneda_cuenta}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="mb-2">
                  <span className="text-sm text-muted">Total Compra:</span>
                  <div className="font-bold text-lg">{formatearMoneda(compra.total)}</div>
                </div>
                <div className="text-sm text-info">
                  {compra.moneda_cuenta === 'PEN' && compra.moneda === 'USD' ? (
                    <>Pagado en cuenta: S/ {(parseFloat(compra.total) * parseFloat(compra.tipo_cambio)).toFixed(2)}</>
                  ) : compra.moneda_cuenta === 'USD' && compra.moneda === 'PEN' ? (
                    <>Pagado en cuenta: $ {(parseFloat(compra.total) / parseFloat(compra.tipo_cambio)).toFixed(2)}</>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Building size={20} /> Proveedor
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Razón Social:</label>
              <p className="font-bold">{compra.proveedor}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">RUC:</label>
              <p className="font-medium">{compra.ruc_proveedor}</p>
            </div>
            {compra.contacto_proveedor && (
              <div>
                <label className="text-sm font-medium text-muted">Contacto:</label>
                <p className="text-sm">{compra.contacto_proveedor}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
            <div className="card-header">
                <h2 className="card-title">
                    <FileText size={20} /> Documento Físico
                </h2>
            </div>
            <div className="card-body space-y-2">
                <div>
                    <label className="text-sm font-medium text-muted">Tipo Documento:</label>
                    <p className="font-bold">{compra.tipo_documento || '-'}</p>
                </div>
                <div className="flex gap-2">
                    <div>
                        <label className="text-sm font-medium text-muted">Serie:</label>
                        <p className="font-mono">{compra.serie_documento || '-'}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-muted">Número:</label>
                        <p className="font-mono">{compra.numero_documento || '-'}</p>
                    </div>
                </div>
                <div>
                    <label className="text-sm font-medium text-muted">Fecha Emisión Doc:</label>
                    <p className="text-sm">{formatearFecha(compra.fecha_emision_documento)}</p>
                </div>
            </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Wallet size={20} /> Cuenta de Pago
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Cuenta:</label>
              <p className="font-medium">{compra.cuenta_pago || 'No registrada'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Tipo:</label>
              <p className="font-medium">{compra.tipo_cuenta || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Saldo/Cupo Actual:</label>
              <p className="font-bold text-success">{formatearMoneda(compra.saldo_cuenta, compra.moneda_cuenta)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Calendar size={20} /> Información
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Prioridad:</label>
              <p className="font-medium">
                <span className={`badge ${
                  compra.prioridad === 'Urgente' ? 'badge-danger' :
                  compra.prioridad === 'Alta' ? 'badge-warning' :
                  compra.prioridad === 'Media' ? 'badge-info' : 'badge-secondary'
                }`}>
                  {compra.prioridad}
                </span>
              </p>
            </div>
            {compra.fecha_entrega_estimada && (
              <div>
                <label className="text-sm font-medium text-muted">Entrega Estimada:</label>
                <p className="font-medium">{formatearFecha(compra.fecha_entrega_estimada)}</p>
              </div>
            )}
            {compra.responsable && (
              <div>
                <label className="text-sm font-medium text-muted">Responsable:</label>
                <p className="font-medium">{compra.responsable}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {compra.tipo_compra === 'Credito' && cuotas.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <CreditCard size={20} /> Cuotas de Pago
            </h2>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Cuota</th>
                    <th style={{ width: '120px' }}>Monto</th>
                    <th style={{ width: '120px' }}>Pagado</th>
                    <th style={{ width: '120px' }}>Saldo</th>
                    <th style={{ width: '120px' }}>Vencimiento</th>
                    <th style={{ width: '100px' }}>Días</th>
                    <th style={{ width: '100px' }}>Estado</th>
                    <th style={{ width: '100px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cuotas.map((cuota) => {
                    const saldoCuota = parseFloat(cuota.monto_cuota) - parseFloat(cuota.monto_pagado || 0);
                    return (
                      <tr key={cuota.id_cuota}>
                        <td className="text-center font-bold">#{cuota.numero_cuota}</td>
                        <td className="text-right font-mono">{formatearMoneda(cuota.monto_cuota)}</td>
                        <td className="text-right font-mono text-success">{formatearMoneda(cuota.monto_pagado || 0)}</td>
                        <td className="text-right font-mono text-danger">{formatearMoneda(saldoCuota)}</td>
                        <td className="text-center">{formatearFecha(cuota.fecha_vencimiento)}</td>
                        <td className="text-center">
                          <span className={`${
                            cuota.dias_para_vencer < 0 ? 'text-danger font-bold' :
                            cuota.dias_para_vencer <= 7 ? 'text-warning font-bold' :
                            'text-muted'
                          }`}>
                            {cuota.dias_para_vencer < 0 ? `Vencido` : `${cuota.dias_para_vencer}d`}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`badge ${getNivelAlertaClase(cuota.nivel_alerta)}`}>
                            {cuota.estado}
                          </span>
                        </td>
                        <td className="text-center">
                          {cuota.estado !== 'Pagada' && (
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleAbrirPagarCuota(cuota)}
                            >
                              <DollarSign size={14} /> Pagar
                            </button>
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

      {historialPagos.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <TrendingUp size={20} /> Historial de Pagos
            </h2>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th>Cuenta</th>
                    <th>Referencia</th>
                    <th className="text-right">Monto</th>
                    <th>Registrado Por</th>
                  </tr>
                </thead>
                <tbody>
                  {historialPagos.map((pago) => (
                    <tr key={pago.id_movimiento}>
                      <td>{formatearFechaHora(pago.fecha_movimiento)}</td>
                      <td>
                        {pago.concepto}
                        {pago.numero_cuota && (
                          <div className="text-xs text-muted">Cuota #{pago.numero_cuota}</div>
                        )}
                      </td>
                      <td>
                        <div>{pago.cuenta_pago}</div>
                        <div className="text-xs text-muted">{pago.tipo_cuenta}</div>
                      </td>
                      <td className="text-sm">{pago.referencia || '-'}</td>
                      <td className="text-right font-bold text-danger">
                        {formatearMoneda(pago.monto)}
                      </td>
                      <td className="text-sm">{pago.registrado_por_nombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {compra.direccion_entrega && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <MapPin size={20} /> Dirección de Entrega
            </h2>
          </div>
          <div className="card-body">
            <p className="font-medium">{compra.direccion_entrega}</p>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="card-header flex items-center gap-2">
          <h2 className="card-title flex items-center gap-2">
            <PackageCheck size={20} /> Detalle de Productos
          </h2>
        </div>
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Código</th>
                  <th>Descripción</th>
                  <th style={{ width: '60px' }} className="text-center">Unidad</th>
                  <th style={{ width: '100px' }} className="text-right">Solicitado</th>
                  <th style={{ width: '100px' }} className="text-right">Recibido</th>
                  <th style={{ width: '120px' }} className="text-right">Precio</th>
                  <th style={{ width: '80px' }} className="text-right">Desc.</th>
                  <th style={{ width: '120px' }} className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {compra.detalle && compra.detalle.map((item, index) => (
                  <tr key={index}>
                    <td className="font-mono text-sm">{item.codigo_producto}</td>
                    <td>
                      <div className="font-medium">{item.producto}</div>
                    </td>
                    <td className="text-center text-sm text-muted">{item.unidad_medida}</td>
                    <td className="text-right font-mono">
                      {parseFloat(item.cantidad).toFixed(2)}
                    </td>
                    <td className="text-right font-mono">
                      <span className={`${
                        parseFloat(item.cantidad_recibida) < parseFloat(item.cantidad) 
                            ? 'text-orange-600 font-bold' 
                            : 'text-success font-bold'
                      }`}>
                        {parseFloat(item.cantidad_recibida || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="text-right font-mono">
                      {formatearMoneda(item.precio_unitario)}
                    </td>
                    <td className="text-right text-sm text-muted">
                      {item.descuento_porcentaje > 0 ? `${item.descuento_porcentaje}%` : '-'}
                    </td>
                    <td className="text-right font-bold text-primary">
                      {formatearMoneda(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="flex justify-end">
            <div className="w-80">
              <div className="flex justify-between py-2">
                <span className="font-medium">Subtotal:</span>
                <span className="font-bold">{formatearMoneda(compra.subtotal)}</span>
              </div>
              <div className="flex justify-between py-2 border-t">
                <span className="font-medium">{compra.tipo_impuesto} ({compra.porcentaje_impuesto}%):</span>
                <span className="font-bold">{formatearMoneda(compra.igv)}</span>
              </div>
              <div className="flex justify-between py-3 border-t bg-primary text-white px-3 rounded">
                <span className="font-bold text-lg">TOTAL:</span>
                <span className="font-bold text-xl">{formatearMoneda(compra.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {compra.observaciones && (
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">Observaciones</h3>
          </div>
          <div className="card-body">
            <p className="whitespace-pre-wrap">{compra.observaciones}</p>
          </div>
        </div>
      )}

      <Modal
        isOpen={modalPagarCuotaOpen}
        onClose={() => setModalPagarCuotaOpen(false)}
        title={`Pagar Cuota #${cuotaSeleccionada?.numero_cuota}`}
        size="md"
      >
        {cuotaSeleccionada && (
          <form onSubmit={handlePagarCuota}>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted">Monto de la cuota:</span>
                  <span className="font-bold">{formatearMoneda(cuotaSeleccionada.monto_cuota)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted">Ya pagado:</span>
                  <span className="font-bold text-success">{formatearMoneda(cuotaSeleccionada.monto_pagado || 0)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-bold">Saldo pendiente:</span>
                  <span className="font-bold text-danger">
                    {formatearMoneda(parseFloat(cuotaSeleccionada.monto_cuota) - parseFloat(cuotaSeleccionada.monto_pagado || 0))}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Cuenta de Pago *</label>
                <select
                  className="form-select"
                  value={datosPago.id_cuenta_pago}
                  onChange={(e) => setDatosPago({ ...datosPago, id_cuenta_pago: e.target.value })}
                  required
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentasPago.filter(c => c.moneda === compra.moneda).map(cuenta => (
                    <option key={cuenta.id_cuenta} value={cuenta.id_cuenta}>
                      {cuenta.nombre} - Disp: {formatearMoneda(cuenta.saldo_actual, cuenta.moneda)}
                    </option>
                  ))}
                </select>
                {cuentasPago.filter(c => c.moneda === compra.moneda).length === 0 && (
                    <small className="text-danger block mt-1">No tienes cuentas activas en {compra.moneda}</small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Monto a Pagar *</label>
                <input
                  type="number"
                  className="form-input text-right font-bold"
                  value={datosPago.monto_pagado}
                  onChange={(e) => setDatosPago({ ...datosPago, monto_pagado: e.target.value })}
                  step="0.01"
                  min="0.01"
                  required
                />
                {parseFloat(datosPago.monto_pagado) > (parseFloat(cuotaSeleccionada.monto_cuota) - parseFloat(cuotaSeleccionada.monto_pagado || 0)) && (
                    <small className="text-danger block mt-1">El monto excede la deuda de la cuota</small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Fecha de Pago *</label>
                <input type="date" className="form-input" value={datosPago.fecha_pago}
                  onChange={(e) => setDatosPago({ ...datosPago, fecha_pago: e.target.value })} required />
              </div>

              <div className="form-group">
                <label className="form-label">Método de Pago</label>
                <select className="form-select" value={datosPago.metodo_pago}
                  onChange={(e) => setDatosPago({ ...datosPago, metodo_pago: e.target.value })}>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Tarjeta">Tarjeta</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Referencia / N° Operación</label>
                <input type="text" className="form-input" value={datosPago.referencia}
                  onChange={(e) => setDatosPago({ ...datosPago, referencia: e.target.value })}
                  placeholder="Número de operación" />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <button type="button" className="btn btn-outline" onClick={() => setModalPagarCuotaOpen(false)} disabled={loading}>Cancelar</button>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  <DollarSign size={20} /> {loading ? 'Procesando...' : 'Confirmar Pago Cuota'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={modalPagoDirectoOpen}
        onClose={() => setModalPagoDirectoOpen(false)}
        title="Registrar Pago a Cuenta"
        size="md"
      >
        <form onSubmit={handlePagoDirecto}>
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted">Total Compra:</span>
                  <span className="font-bold">{formatearMoneda(compra.total)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted">Abonado:</span>
                  <span className="font-bold text-success">{formatearMoneda(compra.monto_pagado || 0)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-bold">Deuda Actual:</span>
                  <span className="font-bold text-danger text-lg">
                    {formatearMoneda(parseFloat(compra.total) - parseFloat(compra.monto_pagado || 0))}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Cuenta de Pago *</label>
                <select
                  className="form-select"
                  value={datosPago.id_cuenta_pago}
                  onChange={(e) => setDatosPago({ ...datosPago, id_cuenta_pago: e.target.value })}
                  required
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentasPago.filter(c => c.moneda === compra.moneda).map(cuenta => (
                    <option key={cuenta.id_cuenta} value={cuenta.id_cuenta}>
                      {cuenta.nombre} - Disp: {formatearMoneda(cuenta.saldo_actual, cuenta.moneda)}
                    </option>
                  ))}
                </select>
                {cuentasPago.filter(c => c.moneda === compra.moneda).length === 0 && (
                    <small className="text-danger block mt-1">No tienes cuentas activas en {compra.moneda}</small>
                )}
              </div>

              <div className="form-group">
                <div className="flex justify-between items-center mb-1">
                    <label className="form-label mb-0">Monto a Pagar *</label>
                    <button type="button" className="text-xs text-primary hover:underline"
                        onClick={() => {
                            const deuda = parseFloat(compra.total) - parseFloat(compra.monto_pagado || 0);
                            setDatosPago({ ...datosPago, monto_pagado: deuda.toFixed(2) });
                        }}>
                        Pagar Todo
                    </button>
                </div>
                <input type="number" className="form-input text-right font-bold text-lg" value={datosPago.monto_pagado}
                  onChange={(e) => setDatosPago({ ...datosPago, monto_pagado: e.target.value })}
                  step="0.01" min="0.01" required />
                
                {datosPago.monto_pagado && (
                    <div className="text-right mt-1">
                        {parseFloat(datosPago.monto_pagado) < (parseFloat(compra.total) - parseFloat(compra.monto_pagado || 0)) ? (
                            <span className="text-xs text-info font-bold flex justify-end items-center gap-1">
                                <TrendingUp size={12} /> Pago Parcial
                            </span>
                        ) : parseFloat(datosPago.monto_pagado) > (parseFloat(compra.total) - parseFloat(compra.monto_pagado || 0) + 0.01) ? (
                            <span className="text-xs text-danger font-bold">Monto excede la deuda</span>
                        ) : (
                            <span className="text-xs text-success font-bold flex justify-end items-center gap-1">
                                <CheckCircle size={12} /> Pago Total
                            </span>
                        )}
                    </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                    <label className="form-label">Fecha de Pago *</label>
                    <input type="date" className="form-input" value={datosPago.fecha_pago}
                    onChange={(e) => setDatosPago({ ...datosPago, fecha_pago: e.target.value })} required />
                </div>
                <div className="form-group">
                    <label className="form-label">Método</label>
                    <select className="form-select" value={datosPago.metodo_pago}
                    onChange={(e) => setDatosPago({ ...datosPago, metodo_pago: e.target.value })}>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Tarjeta">Tarjeta</option>
                    </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Referencia / Observación</label>
                <input type="text" className="form-input" value={datosPago.referencia}
                  onChange={(e) => setDatosPago({ ...datosPago, referencia: e.target.value })}
                  placeholder="Ej: Pago a cuenta..." />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <button type="button" className="btn btn-outline" onClick={() => setModalPagoDirectoOpen(false)} disabled={loading}>Cancelar</button>
                <button type="submit" className="btn btn-success" 
                    disabled={loading || parseFloat(datosPago.monto_pagado) > (parseFloat(compra.total) - parseFloat(compra.monto_pagado || 0) + 0.01)}>
                  <DollarSign size={20} /> {loading ? 'Procesando...' : 'Confirmar Pago'}
                </button>
              </div>
            </div>
        </form>
      </Modal>

      <Modal
        isOpen={modalCancelarOpen}
        onClose={() => setModalCancelarOpen(false)}
        title="Cancelar Compra"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-danger mt-1" />
              <div>
                <p className="font-bold text-red-900">¿Está seguro de cancelar esta compra?</p>
                <ul className="text-sm text-red-800 mt-2 space-y-1">
                  <li>• Esta acción no se puede deshacer</li>
                  <li>• No se pueden cancelar compras con pagos realizados</li>
                  <li>• El stock se revertirá automáticamente</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Motivo de Cancelación *</label>
            <textarea
              className="form-textarea"
              value={motivoCancelacion}
              onChange={(e) => setMotivoCancelacion(e.target.value)}
              rows={3}
              placeholder="Indique el motivo de la cancelación..."
              required
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <button className="btn btn-outline" onClick={() => setModalCancelarOpen(false)} disabled={loading}>No, Volver</button>
            <button className="btn btn-danger" onClick={handleCancelarCompra} disabled={loading}>
              <XCircle size={20} /> {loading ? 'Cancelando...' : 'Sí, Cancelar Compra'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DetalleCompra;