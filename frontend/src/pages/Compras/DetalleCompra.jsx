import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, ShoppingCart, CheckCircle,
  XCircle, Clock, AlertCircle, Building, Calendar,
  MapPin, CreditCard, Wallet, Package, DollarSign
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [modalPagarCuotaOpen, setModalPagarCuotaOpen] = useState(false);
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState(null);
  const [cuentasPago, setCuentasPago] = useState([]);
  
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
      
      const [compraRes, resumenRes] = await Promise.all([
        comprasAPI.getById(id),
        comprasAPI.getResumenPagos(id)
      ]);
      
      if (compraRes.data.success) {
        setCompra(compraRes.data.data);
        
        if (compraRes.data.data.tipo_compra === 'Credito') {
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
      
    } catch (err) {
      console.error('Error al cargar la compra:', err);
      setError(err.response?.data?.error || 'Error al cargar la compra');
    } finally {
      setLoading(false);
    }
  };

  const cargarCuentasPago = async (moneda) => {
    try {
      const response = await cuentasPagoAPI.getAll({ estado: 'Activo', moneda });
      if (response.data.success) {
        setCuentasPago(response.data.data || []);
      }
    } catch (err) {
      console.error('Error al cargar cuentas:', err);
    }
  };

  const handleAbrirPagarCuota = async (cuota) => {
    setCuotaSeleccionada(cuota);
    await cargarCuentasPago(compra.moneda);
    setDatosPago({
      id_cuenta_pago: compra.id_cuenta_pago || '',
      monto_pagado: (cuota.monto_cuota - (cuota.monto_pagado || 0)).toFixed(2),
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
        setSuccess(`Pago de cuota ${cuotaSeleccionada.numero_cuota} registrado exitosamente`);
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

  const formatearMoneda = (valor) => {
    if (!compra) return '-';
    const simbolo = compra.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor).toFixed(2)}`;
  };

  const getEstadoPagoConfig = (estado) => {
    const configs = {
      'Pendiente': { 
        icono: Clock, 
        clase: 'badge-warning',
        color: 'border-warning'
      },
      'Parcial': { 
        icono: AlertCircle, 
        clase: 'badge-info',
        color: 'border-info'
      },
      'Pagado': { 
        icono: CheckCircle, 
        clase: 'badge-success',
        color: 'border-success'
      }
    };
    return configs[estado] || configs['Pendiente'];
  };

  const getNivelAlertaClase = (nivel) => {
    const clases = {
      'success': 'text-success',
      'info': 'text-info',
      'warning': 'text-warning',
      'danger': 'text-danger'
    };
    return clases[nivel] || 'text-muted';
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
            <button 
              className="btn btn-outline" 
              onClick={() => navigate(`/compras/${id}/editar`)}
            >
              <Edit size={20} /> Editar
            </button>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className={`card border-l-4 ${estadoPagoConfig.color} mb-4`}>
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${estadoPagoConfig.clase} bg-opacity-10`}>
                <IconoEstadoPago size={32} />
              </div>
              <div>
                <p className="text-sm text-muted">Estado de Pago</p>
                <h3 className="text-xl font-bold">{compra.estado_pago}</h3>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted">Total Compra</p>
              <h3 className="text-xl font-bold text-primary">{formatearMoneda(compra.total)}</h3>
            </div>

            <div>
              <p className="text-sm text-muted">Monto Pagado</p>
              <h3 className="text-xl font-bold text-success">{formatearMoneda(compra.monto_pagado || 0)}</h3>
            </div>

            <div>
              <p className="text-sm text-muted">Saldo Pendiente</p>
              <h3 className="text-xl font-bold text-danger">
                {formatearMoneda(compra.total - (compra.monto_pagado || 0))}
              </h3>
            </div>
          </div>

          {compra.dias_para_vencer !== null && compra.estado_pago !== 'Pagado' && (
            <div className={`mt-3 p-3 rounded-lg ${
              compra.dias_para_vencer < 0 ? 'bg-red-50' : 
              compra.dias_para_vencer <= 7 ? 'bg-yellow-50' : 'bg-blue-50'
            }`}>
              <p className={`text-sm font-medium ${getNivelAlertaClase(compra.nivel_alerta)}`}>
                {compra.dias_para_vencer < 0 ? 
                  `⚠️ Vencida hace ${Math.abs(compra.dias_para_vencer)} días` :
                  compra.dias_para_vencer === 0 ?
                  `⚠️ Vence hoy` :
                  `Vence en ${compra.dias_para_vencer} días`
                }
              </p>
            </div>
          )}
        </div>
      </div>

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
              <CreditCard size={20} />
              Tipo de Compra
            </h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Modalidad:</label>
              <p className="font-medium">
                {compra.tipo_compra === 'Contado' ? (
                  <span className="badge badge-success">
                    <Wallet size={14} /> Contado
                  </span>
                ) : (
                  <span className="badge badge-warning">
                    <CreditCard size={14} /> Crédito
                  </span>
                )}
              </p>
            </div>
            {compra.tipo_compra === 'Credito' && (
              <>
                <div>
                  <label className="text-sm font-medium text-muted">Cuotas:</label>
                  <p className="font-medium">{compra.numero_cuotas} cuotas</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted">Días entre cuotas:</label>
                  <p className="font-medium">{compra.dias_entre_cuotas} días</p>
                </div>
              </>
            )}
            <div>
              <label className="text-sm font-medium text-muted">Prioridad:</label>
              <p className="font-medium">{compra.prioridad}</p>
            </div>
          </div>
        </div>
      </div>

      {compra.tipo_compra === 'Credito' && cuotas.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <DollarSign size={20} />
              Cuotas de Pago
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
                    <th style={{ width: '100px' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {cuotas.map((cuota) => (
                    <tr key={cuota.id_cuota}>
                      <td className="font-bold">#{cuota.numero_cuota}</td>
                      <td className="font-mono">{formatearMoneda(cuota.monto_cuota)}</td>
                      <td className="font-mono text-success">{formatearMoneda(cuota.monto_pagado || 0)}</td>
                      <td className="font-mono text-danger">
                        {formatearMoneda(cuota.monto_cuota - (cuota.monto_pagado || 0))}
                      </td>
                      <td>{formatearFecha(cuota.fecha_vencimiento)}</td>
                      <td>
                        <span className={getNivelAlertaClase(cuota.nivel_alerta)}>
                          {cuota.dias_para_vencer < 0 ? `Vencida` : `${cuota.dias_para_vencer}d`}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          cuota.estado === 'Pagada' ? 'badge-success' :
                          cuota.estado === 'Parcial' ? 'badge-info' :
                          'badge-warning'
                        }`}>
                          {cuota.estado}
                        </span>
                      </td>
                      <td>
                        {cuota.estado !== 'Pagada' && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleAbrirPagarCuota(cuota)}
                          >
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

      {compra.direccion_entrega && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <MapPin size={20} />
              Dirección de Entrega
            </h2>
          </div>
          <div className="card-body">
            <p className="font-medium">{compra.direccion_entrega}</p>
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
                      <div className="text-xs text-muted">{item.tipo_inventario}</div>
                    </td>
                    <td className="text-right font-mono">
                      {parseFloat(item.cantidad).toFixed(2)}
                    </td>
                    <td className="text-center text-sm text-muted">{item.unidad_medida}</td>
                    <td className="text-right font-mono">
                      {formatearMoneda(item.precio_unitario)}
                    </td>
                    <td className="text-right text-sm">
                      {item.descuento_porcentaje > 0 ? `${item.descuento_porcentaje}%` : '-'}
                    </td>
                    <td className="text-right font-bold text-primary">
                      {formatearMoneda(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan="6" className="text-right">
                    Total Items: {compra.detalle?.length || 0}
                  </td>
                  <td className="text-right text-primary">
                    {formatearMoneda(compra.subtotal)}
                  </td>
                </tr>
              </tfoot>
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
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted">Monto Cuota:</p>
                  <p className="font-bold text-lg">{formatearMoneda(cuotaSeleccionada.monto_cuota)}</p>
                </div>
                <div>
                  <p className="text-muted">Ya Pagado:</p>
                  <p className="font-bold text-success">{formatearMoneda(cuotaSeleccionada.monto_pagado || 0)}</p>
                </div>
                <div>
                  <p className="text-muted">Saldo Pendiente:</p>
                  <p className="font-bold text-danger">
                    {formatearMoneda(cuotaSeleccionada.monto_cuota - (cuotaSeleccionada.monto_pagado || 0))}
                  </p>
                </div>
                <div>
                  <p className="text-muted">Vencimiento:</p>
                  <p className="font-medium">{formatearFecha(cuotaSeleccionada.fecha_vencimiento)}</p>
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
                {cuentasPago.map(cuenta => (
                  <option key={cuenta.id_cuenta} value={cuenta.id_cuenta}>
                    {cuenta.nombre} - Saldo: {formatearMoneda(cuenta.saldo_actual)}
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
                placeholder="N° de operación, cheque, etc."
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
                className="btn btn-primary" 
                onClick={handlePagarCuota}
                disabled={loading}
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