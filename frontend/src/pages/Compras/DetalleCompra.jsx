import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, ShoppingCart, CheckCircle,
  XCircle, Clock, AlertCircle, Building, Calendar,
  MapPin, CreditCard, Wallet, Package, DollarSign, Plus
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { comprasAPI, cuentasPagoAPI } from '../../config/api';

function DetalleCompra() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [compra, setCompra] = useState(null);
  const [resumenPagos, setResumenPagos] = useState(null);
  const [cuotas, setCuotas] = useState([]);
  const [historialPagos, setHistorialPagos] = useState([]);
  const [cuentasPago, setCuentasPago] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [modalCancelarOpen, setModalCancelarOpen] = useState(false);
  const [modalPagarCuotaOpen, setModalPagarCuotaOpen] = useState(false);
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  
  const [datosPago, setDatosPago] = useState({
    id_cuenta_pago: '',
    monto_pagado: '',
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'Transferencia',
    referencia: '',
    observaciones: ''
  });

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [compraRes, resumenRes, cuentasRes] = await Promise.all([
        comprasAPI.getById(id),
        comprasAPI.getResumenPagos(id),
        cuentasPagoAPI.getAll({ estado: 'Activo' })
      ]);
      
      if (compraRes.data.success) {
        setCompra(compraRes.data.data);
        
        if (compraRes.data.data.tipo_compra === 'Credito') {
          const cuotasRes = await comprasAPI.getCuotas(id);
          if (cuotasRes.data.success) {
            setCuotas(cuotasRes.data.data || []);
          }
        }

        const historialRes = await comprasAPI.getHistorialPagos(id);
        if (historialRes.data.success) {
          setHistorialPagos(historialRes.data.data || []);
        }
      }

      if (resumenRes.data.success) {
        setResumenPagos(resumenRes.data.data);
      }

      if (cuentasRes.data.success) {
        setCuentasPago(cuentasRes.data.data || []);
      }
      
    } catch (err) {
      console.error('Error al cargar la compra:', err);
      setError(err.response?.data?.error || 'Error al cargar la compra');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelar = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await comprasAPI.cancelar(id, motivoCancelacion);
      
      if (response.data.success) {
        setCompra({ ...compra, estado: 'Cancelada' });
        setSuccess('Compra cancelada exitosamente');
        setModalCancelarOpen(false);
      } else {
        setError(response.data.error || 'Error al cancelar compra');
      }
      
    } catch (err) {
      console.error('Error al cancelar:', err);
      setError(err.response?.data?.error || 'Error al cancelar compra');
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirModalPago = async (cuota) => {
    setCuotaSeleccionada(cuota);
    setDatosPago({
      id_cuenta_pago: compra.id_cuenta_pago || '',
      monto_pagado: (parseFloat(cuota.monto_cuota) - parseFloat(cuota.monto_pagado || 0)).toFixed(2),
      fecha_pago: new Date().toISOString().split('T')[0],
      metodo_pago: 'Transferencia',
      referencia: '',
      observaciones: ''
    });
    setModalPagarCuotaOpen(true);
  };

  const handlePagarCuota = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await comprasAPI.pagarCuota(id, cuotaSeleccionada.id_cuota, datosPago);
      
      if (response.data.success) {
        setSuccess(`Pago registrado exitosamente. Nuevo saldo: ${formatearMoneda(response.data.data.nuevo_saldo_cuenta, compra.moneda)}`);
        setModalPagarCuotaOpen(false);
        await cargarDatos();
      } else {
        setError(response.data.error || 'Error al registrar pago');
      }
      
    } catch (err) {
      console.error('Error al pagar cuota:', err);
      setError(err.response?.data?.error || 'Error al registrar pago');
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
      console.error('Error al descargar PDF:', err);
      setError('Error al descargar el PDF');
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

  const formatearFechaHora = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearMoneda = (valor, moneda) => {
    if (valor === null || valor === undefined) return '-';
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor).toFixed(2)}`;
  };

  const getEstadoPagoClase = (estado) => {
    const clases = {
      'Pendiente': 'badge-warning',
      'Parcial': 'badge-info',
      'Pagado': 'badge-success'
    };
    return clases[estado] || 'badge-warning';
  };

  const getNivelAlertaClase = (nivel) => {
    const clases = {
      'success': 'border-success',
      'info': 'border-info',
      'warning': 'border-warning',
      'danger': 'border-danger'
    };
    return clases[nivel] || 'border-info';
  };

  const getCuotaEstadoClase = (estado) => {
    const clases = {
      'Pendiente': 'badge-warning',
      'Parcial': 'badge-info',
      'Pagada': 'badge-success',
      'Cancelada': 'badge-danger'
    };
    return clases[estado] || 'badge-warning';
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
            <p className="text-muted">
              Emitida el {formatearFecha(compra.fecha_emision)}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleDescargarPDF}>
            <Download size={20} /> PDF
          </button>
          
          {compra.estado !== 'Cancelada' && compra.estado_pago !== 'Pagado' && (
            <button className="btn btn-outline btn-danger" onClick={() => setModalCancelarOpen(true)}>
              <XCircle size={20} /> Cancelar
            </button>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className={`card border-l-4 ${getNivelAlertaClase(compra.nivel_alerta)} mb-4`}>
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <span className={`badge ${getEstadoPagoClase(compra.estado_pago)}`}>
                  {compra.estado_pago}
                </span>
                <span className={`badge ${compra.tipo_compra === 'Contado' ? 'badge-success' : 'badge-warning'}`}>
                  {compra.tipo_compra === 'Contado' ? <Wallet size={14} /> : <CreditCard size={14} />}
                  {compra.tipo_compra}
                </span>
              </div>
            </div>
            
            {compra.dias_para_vencer !== null && compra.estado_pago !== 'Pagado' && (
              <div className="text-right">
                <p className="text-sm text-muted">Vencimiento</p>
                <p className={`font-bold ${
                  compra.dias_para_vencer < 0 ? 'text-danger' : 
                  compra.dias_para_vencer <= 7 ? 'text-warning' : 
                  'text-muted'
                }`}>
                  {compra.dias_para_vencer < 0 
                    ? `Vencido hace ${Math.abs(compra.dias_para_vencer)} días`
                    : `${compra.dias_para_vencer} días`
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {resumenPagos && compra.tipo_compra === 'Credito' && (
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="card">
            <div className="card-body">
              <p className="text-sm text-muted">Total Compra</p>
              <h3 className="text-xl font-bold text-primary">
                {formatearMoneda(resumenPagos.total_compra, compra.moneda)}
              </h3>
            </div>
          </div>

          <div className="card border-l-4 border-success">
            <div className="card-body">
              <p className="text-sm text-muted">Monto Pagado</p>
              <h3 className="text-xl font-bold text-success">
                {formatearMoneda(resumenPagos.monto_pagado, compra.moneda)}
              </h3>
              <p className="text-xs text-muted">{resumenPagos.porcentaje_pagado}% pagado</p>
            </div>
          </div>

          <div className="card border-l-4 border-warning">
            <div className="card-body">
              <p className="text-sm text-muted">Saldo Pendiente</p>
              <h3 className="text-xl font-bold text-warning">
                {formatearMoneda(resumenPagos.saldo_pendiente, compra.moneda)}
              </h3>
            </div>
          </div>

          <div className="card border-l-4 border-info">
            <div className="card-body">
              <p className="text-sm text-muted">Cuotas</p>
              <h3 className="text-xl font-bold text-info">
                {resumenPagos.cuotas?.cuotas_pagadas || 0} / {resumenPagos.cuotas?.total_cuotas || 0}
              </h3>
              {resumenPagos.cuotas?.cuotas_vencidas > 0 && (
                <p className="text-xs text-danger">{resumenPagos.cuotas.cuotas_vencidas} vencidas</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Building size={20} />
              Proveedor
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
              <Wallet size={20} />
              Cuenta de Pago
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Cuenta:</label>
              <p className="font-medium">{compra.cuenta_pago}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Tipo:</label>
              <p className="font-medium">{compra.tipo_cuenta}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Moneda:</label>
              <p className="font-medium">{compra.moneda === 'USD' ? 'Dólares (USD)' : 'Soles (PEN)'}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Calendar size={20} />
              Fechas
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Emisión:</label>
              <p className="font-medium">{formatearFecha(compra.fecha_emision)}</p>
            </div>
            {compra.fecha_entrega_estimada && (
              <div>
                <label className="text-sm font-medium text-muted">Entrega Estimada:</label>
                <p className="font-medium">{formatearFecha(compra.fecha_entrega_estimada)}</p>
              </div>
            )}
            {compra.fecha_vencimiento && compra.tipo_compra === 'Credito' && (
              <div>
                <label className="text-sm font-medium text-muted">Vencimiento:</label>
                <p className="font-medium">{formatearFecha(compra.fecha_vencimiento)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {compra.tipo_compra === 'Credito' && cuotas.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <CreditCard size={20} />
              Cuotas de Pago
            </h2>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>N° Cuota</th>
                    <th style={{ width: '120px' }}>Monto</th>
                    <th style={{ width: '120px' }}>Pagado</th>
                    <th style={{ width: '120px' }}>Saldo</th>
                    <th style={{ width: '140px' }}>Vencimiento</th>
                    <th style={{ width: '100px' }}>Estado</th>
                    <th style={{ width: '80px' }}>Alerta</th>
                    <th style={{ width: '100px' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {cuotas.map((cuota) => (
                    <tr key={cuota.id_cuota}>
                      <td className="font-bold">#{cuota.numero_cuota}</td>
                      <td className="font-mono">{formatearMoneda(cuota.monto_cuota, compra.moneda)}</td>
                      <td className="font-mono text-success">{formatearMoneda(cuota.monto_pagado || 0, compra.moneda)}</td>
                      <td className="font-mono text-warning">
                        {formatearMoneda(parseFloat(cuota.monto_cuota) - parseFloat(cuota.monto_pagado || 0), compra.moneda)}
                      </td>
                      <td>{formatearFecha(cuota.fecha_vencimiento)}</td>
                      <td>
                        <span className={`badge ${getCuotaEstadoClase(cuota.estado)}`}>
                          {cuota.estado}
                        </span>
                      </td>
                      <td className="text-center">
                        {cuota.nivel_alerta !== 'success' && (
                          <span className={`badge ${getNivelAlertaClase(cuota.nivel_alerta).replace('border-', 'badge-')}`}>
                            <AlertCircle size={14} />
                          </span>
                        )}
                      </td>
                      <td>
                        {cuota.estado !== 'Pagada' && cuota.estado !== 'Cancelada' && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleAbrirModalPago(cuota)}
                          >
                            <DollarSign size={14} />
                            Pagar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
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
              <Clock size={20} />
              Historial de Pagos
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
                    <th>Cuota</th>
                    <th className="text-right">Monto</th>
                    <th>Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {historialPagos.map((pago) => (
                    <tr key={pago.id_movimiento}>
                      <td className="text-sm">{formatearFechaHora(pago.fecha_movimiento)}</td>
                      <td>{pago.concepto}</td>
                      <td>
                        <div className="text-sm">{pago.cuenta_pago}</div>
                        <div className="text-xs text-muted">{pago.tipo_cuenta}</div>
                      </td>
                      <td>
                        {pago.numero_cuota ? (
                          <span className="badge badge-info">Cuota #{pago.numero_cuota}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="text-right font-bold text-success">
                        {formatearMoneda(pago.monto, compra.moneda)}
                      </td>
                      <td className="text-sm">{pago.registrado_por_nombre || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">
            <Package size={20} />
            Detalle de Productos
          </h2>
        </div>
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Código</th>
                  <th>Descripción</th>
                  <th style={{ width: '120px' }} className="text-right">Cantidad</th>
                  <th style={{ width: '60px' }} className="text-center">Unidad</th>
                  <th style={{ width: '120px' }} className="text-right">Precio</th>
                  <th style={{ width: '80px' }} className="text-right">Desc. %</th>
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
                    <td className="text-right font-mono">
                      {parseFloat(item.cantidad).toFixed(2)}
                    </td>
                    <td className="text-center text-sm text-muted">{item.unidad_medida}</td>
                    <td className="text-right font-mono">
                      {formatearMoneda(item.precio_unitario, compra.moneda)}
                    </td>
                    <td className="text-right">
                      {item.descuento_porcentaje > 0 ? `${item.descuento_porcentaje}%` : '-'}
                    </td>
                    <td className="text-right font-bold text-primary">
                      {formatearMoneda(item.subtotal, compra.moneda)}
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
                <span className="font-bold">{formatearMoneda(compra.subtotal, compra.moneda)}</span>
              </div>
              <div className="flex justify-between py-2 border-t">
                <span className="font-medium">{compra.tipo_impuesto} ({compra.porcentaje_impuesto}%):</span>
                <span className="font-bold">{formatearMoneda(compra.igv, compra.moneda)}</span>
              </div>
              <div className="flex justify-between py-3 border-t bg-primary text-white px-3 rounded">
                <span className="font-bold text-lg">TOTAL:</span>
                <span className="font-bold text-xl">{formatearMoneda(compra.total, compra.moneda)}</span>
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
                <p className="font-bold text-red-900">Advertencia</p>
                <p className="text-sm text-red-800 mt-1">
                  Esta acción cancelará la compra y no se puede deshacer. 
                  Solo se pueden cancelar compras sin pagos realizados.
                </p>
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
              placeholder="Explique el motivo de la cancelación..."
              required
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <button 
              className="btn btn-outline" 
              onClick={() => setModalCancelarOpen(false)}
              disabled={loading}
            >
              Cerrar
            </button>
            <button 
              className="btn btn-danger" 
              onClick={handleCancelar}
              disabled={loading || !motivoCancelacion.trim()}
            >
              <XCircle size={20} />
              {loading ? 'Cancelando...' : 'Confirmar Cancelación'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalPagarCuotaOpen}
        onClose={() => setModalPagarCuotaOpen(false)}
        title={`Pagar Cuota #${cuotaSeleccionada?.numero_cuota}`}
        size="md"
      >
        {cuotaSeleccionada && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Monto Cuota:</span>
                  <span className="font-bold">{formatearMoneda(cuotaSeleccionada.monto_cuota, compra.moneda)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Ya Pagado:</span>
                  <span className="text-success">{formatearMoneda(cuotaSeleccionada.monto_pagado || 0, compra.moneda)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Saldo Pendiente:</span>
                  <span className="font-bold text-warning">
                    {formatearMoneda(parseFloat(cuotaSeleccionada.monto_cuota) - parseFloat(cuotaSeleccionada.monto_pagado || 0), compra.moneda)}
                  </span>
                </div>
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
                    {cuenta.nombre} - {cuenta.tipo} - Saldo: {formatearMoneda(cuenta.saldo_actual, compra.moneda)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Monto a Pagar *</label>
              <input
                type="number"
                className="form-input"
                value={datosPago.monto_pagado}
                onChange={(e) => setDatosPago({ ...datosPago, monto_pagado: e.target.value })}
                min="0"
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Fecha de Pago *</label>
              <input
                type="date"
                className="form-input"
                value={datosPago.fecha_pago}
                onChange={(e) => setDatosPago({ ...datosPago, fecha_pago: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Método de Pago</label>
              <select
                className="form-select"
                value={datosPago.metodo_pago}
                onChange={(e) => setDatosPago({ ...datosPago, metodo_pago: e.target.value })}
              >
                <option value="Transferencia">Transferencia</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Cheque">Cheque</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Deposito">Depósito</option>
                <option value="Yape">Yape</option>
                <option value="Plin">Plin</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Referencia</label>
              <input
                type="text"
                className="form-input"
                value={datosPago.referencia}
                onChange={(e) => setDatosPago({ ...datosPago, referencia: e.target.value })}
                placeholder="Número de operación, voucher, etc."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea
                className="form-textarea"
                value={datosPago.observaciones}
                onChange={(e) => setDatosPago({ ...datosPago, observaciones: e.target.value })}
                rows={2}
                placeholder="Observaciones del pago..."
              />
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <button 
                className="btn btn-outline" 
                onClick={() => setModalPagarCuotaOpen(false)}
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-success" 
                onClick={handlePagarCuota}
                disabled={loading || !datosPago.id_cuenta_pago || !datosPago.monto_pagado}
              >
                <DollarSign size={20} />
                {loading ? 'Procesando...' : 'Registrar Pago'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default DetalleCompra;