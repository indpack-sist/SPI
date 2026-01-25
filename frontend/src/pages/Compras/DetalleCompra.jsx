import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, ShoppingCart, CheckCircle,
  XCircle, Clock, AlertCircle, Building, Calendar,
  MapPin, CreditCard, Wallet, DollarSign, TrendingUp,
  ArrowRightLeft, PackageCheck, FileText, Plus
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { comprasAPI, cuentasPagoAPI } from '../../config/api';

function DetalleCompra() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [compra, setCompra] = useState(null);
  const [cuentasPago, setCuentasPago] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Modales
  const [modalPagarCuotaOpen, setModalPagarCuotaOpen] = useState(false);
  const [modalPagoDirectoOpen, setModalPagoDirectoOpen] = useState(false);
  const [modalCancelarOpen, setModalCancelarOpen] = useState(false);
  const [modalCronogramaOpen, setModalCronogramaOpen] = useState(false);

  // Estados de formularios
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState(null);
  const [datosPago, setDatosPago] = useState({
    id_cuenta_pago: '',
    monto_pagado: '',
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'Transferencia',
    referencia: '',
    observaciones: ''
  });
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  
  // Estado para definir cronograma (Letras diferidas)
  const [cronogramaForm, setCronogramaForm] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true); setError(null);
      const [compraRes, cuentasRes] = await Promise.all([
        comprasAPI.getById(id),
        cuentasPagoAPI.getAll({ estado: 'Activo' })
      ]);
      
      if (compraRes.data.success) {
        setCompra(compraRes.data.data);
      } else {
        setError('Compra no encontrada');
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

  // --- MANEJO DE PAGOS ---
  const handleAbrirPagarCuota = (cuota) => {
    setCuotaSeleccionada(cuota);
    const saldoPendiente = parseFloat(cuota.monto_cuota) - parseFloat(cuota.monto_pagado || 0);
    setDatosPago({ ...datosPago, monto_pagado: saldoPendiente.toFixed(2), observaciones: `Pago Letra ${cuota.numero_cuota}` });
    setModalPagarCuotaOpen(true);
  };

  const handleAbrirPagoDirecto = () => {
    setDatosPago({ ...datosPago, monto_pagado: parseFloat(compra.saldo_pendiente).toFixed(2), observaciones: 'Amortización' });
    setModalPagoDirectoOpen(true);
  };

  const handlePagarCuota = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await comprasAPI.pagarCuota(id, cuotaSeleccionada.id_cuota, datosPago);
      if (response.data.success) {
        setSuccess('Cuota pagada correctamente');
        setModalPagarCuotaOpen(false);
        await cargarDatos();
      } else setError(response.data.error);
    } catch (err) { setError(err.response?.data?.error || 'Error al pagar'); } finally { setLoading(false); }
  };

  const handlePagoDirecto = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await comprasAPI.registrarPago(id, datosPago);
      if (response.data.success) {
        setSuccess('Pago registrado correctamente');
        setModalPagoDirectoOpen(false);
        await cargarDatos();
      } else setError(response.data.error);
    } catch (err) { setError(err.response?.data?.error || 'Error al pagar'); } finally { setLoading(false); }
  };

  // --- MANEJO DE CRONOGRAMA (LETRAS) ---
  const handleAbrirCronograma = () => {
    // Generar borrador basado en saldo pendiente
    const numCuotas = compra.numero_cuotas || 1;
    const montoBase = parseFloat(compra.saldo_pendiente) / numCuotas;
    const fechaBase = new Date(compra.fecha_vencimiento); // O fecha emision + dias
    const nuevoCrono = [];
    
    for(let i=1; i<=numCuotas; i++) {
        nuevoCrono.push({
            numero: i,
            fecha_vencimiento: fechaBase.toISOString().split('T')[0], // Simplificado, idealmente sumar dias
            monto: montoBase.toFixed(2),
            codigo_letra: ''
        });
        // Aquí podrías sumar días si tuvieras la frecuencia
    }
    setCronogramaForm(nuevoCrono);
    setModalCronogramaOpen(true);
  };

  const handleGuardarCronograma = async (e) => {
      e.preventDefault();
      try {
          setLoading(true);
          const response = await comprasAPI.establecerCronograma(id, { cuotas: cronogramaForm });
          if(response.data.success) {
              setSuccess('Cronograma de letras establecido');
              setModalCronogramaOpen(false);
              await cargarDatos();
          } else setError(response.data.error);
      } catch(err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleCancelarCompra = async () => {
    if (!motivoCancelacion.trim()) { setError('Indique motivo'); return; }
    try {
      setLoading(true);
      const response = await comprasAPI.cancelar(id, motivoCancelacion);
      if (response.data.success) {
        setSuccess('Compra cancelada');
        setModalCancelarOpen(false);
        await cargarDatos();
      } else setError(response.data.error);
    } catch (err) { setError(err.response?.data?.error); } finally { setLoading(false); }
  };

  const handleDescargarPDF = async () => {
    try {
      setLoading(true); await comprasAPI.descargarPDF(id); setSuccess('PDF descargado');
    } catch (err) { setError('Error al descargar PDF'); } finally { setLoading(false); }
  };

  // Helpers de formato
  const formatearFecha = (f) => f ? new Date(f).toLocaleDateString('es-PE') : '-';
  const formatearMoneda = (v, m) => {
      const mon = m || compra?.moneda || 'PEN';
      return `${mon === 'USD' ? '$' : 'S/'} ${parseFloat(v||0).toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
  };

  if (loading && !compra) return <Loading message="Cargando detalles..." />;
  if (!compra) return <Alert type="error" message="Compra no encontrada" />;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <button className="btn btn-outline" onClick={() => navigate('/compras')}><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart size={28} className="text-primary"/> 
              Compra {compra.numero_orden}
            </h1>
            <div className="flex gap-3 text-sm text-muted mt-1">
                <span className="flex items-center gap-1"><Calendar size={14}/> {formatearFecha(compra.fecha_emision)}</span>
                <span className={`badge ${compra.estado === 'Recibida' ? 'badge-success' : 'badge-info'}`}>{compra.estado}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleDescargarPDF}><Download size={18} /> PDF</button>
          
          {compra.estado !== 'Cancelada' && compra.estado_pago !== 'Pagado' && (
            <>
              {/* Botón Pagar (Solo si no es Crédito con Cronograma Definido, o si es Contado con deuda) */}
              {(compra.tipo_compra === 'Contado' || (compra.tipo_compra === 'Credito' && !compra.cronograma_definido)) && (
                  <button className="btn btn-primary" onClick={handleAbrirPagoDirecto}>
                    <DollarSign size={18} /> Registrar Pago
                  </button>
              )}

              {/* Botón Definir Letras (Solo si es Crédito y aún no se definen) */}
              {compra.tipo_compra === 'Credito' && !compra.cronograma_definido && (
                  <button className="btn btn-warning text-white" onClick={handleAbrirCronograma}>
                    <FileText size={18} /> Definir Letras
                  </button>
              )}
              
              <button className="btn btn-outline text-danger border-danger hover:bg-danger/10" onClick={() => setModalCancelarOpen(true)}>
                <XCircle size={18} /> Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* TARJETA DE ESTADO FINANCIERO */}
      <div className={`card mb-6 border-l-4 ${compra.estado_pago === 'Pagado' ? 'border-success' : 'border-warning'}`}>
        <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
                <p className="text-sm text-muted">Total Compra</p>
                <p className="text-2xl font-bold">{formatearMoneda(compra.total)}</p>
            </div>
            <div>
                <p className="text-sm text-muted">Pagado a la fecha</p>
                <p className="text-2xl font-bold text-success">{formatearMoneda(compra.monto_pagado)}</p>
            </div>
            <div>
                <p className="text-sm text-muted">Saldo Pendiente</p>
                <p className="text-2xl font-bold text-danger">{formatearMoneda(compra.saldo_pendiente)}</p>
            </div>
            <div>
                <p className="text-sm text-muted">Vencimiento</p>
                <div className="flex items-center gap-2">
                    <span className="text-lg font-medium">{formatearFecha(compra.fecha_vencimiento)}</span>
                    {compra.dias_para_vencer < 0 && <span className="badge badge-danger">Vencido</span>}
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA IZQUIERDA: DETALLES */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* TABLA PRODUCTOS */}
            <div className="card">
                <div className="card-header bg-gray-50/50"><h3 className="card-title flex gap-2"><PackageCheck size={18}/> Items de la Compra</h3></div>
                <div className="card-body p-0">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th className="text-right">Cant.</th>
                                <th className="text-right">Precio</th>
                                <th className="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {compra.detalle?.map((item, i) => (
                                <tr key={i}>
                                    <td>
                                        <div className="font-medium">{item.producto}</div>
                                        <div className="text-xs text-muted">{item.codigo_producto}</div>
                                    </td>
                                    <td className="text-right">{parseFloat(item.cantidad).toFixed(2)} {item.unidad_medida}</td>
                                    <td className="text-right">{formatearMoneda(item.precio_unitario)}</td>
                                    <td className="text-right font-bold">{formatearMoneda(item.subtotal)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TABLA PAGOS REALIZADOS (TRAZABILIDAD) */}
            <div className="card">
                <div className="card-header bg-gray-50/50"><h3 className="card-title flex gap-2"><TrendingUp size={18}/> Historial de Pagos</h3></div>
                <div className="card-body p-0">
                    {compra.pagos_realizados && compra.pagos_realizados.length > 0 ? (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Cuenta Origen</th>
                                    <th>Ref.</th>
                                    <th className="text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {compra.pagos_realizados.map((pago, i) => (
                                    <tr key={i}>
                                        <td>{new Date(pago.fecha_movimiento).toLocaleDateString()}</td>
                                        <td>
                                            <div className="font-medium">{pago.cuenta_origen}</div>
                                            <div className="text-xs text-muted">{pago.tipo_cuenta}</div>
                                        </td>
                                        <td className="text-sm">{pago.referencia || '-'}</td>
                                        <td className="text-right font-bold text-success">{formatearMoneda(pago.monto)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-4 text-center text-muted">No hay pagos registrados aún.</div>
                    )}
                </div>
            </div>

        </div>

        {/* COLUMNA DERECHA: INFO Y CUOTAS */}
        <div className="space-y-6">
            
            {/* INFO PROVEEDOR */}
            <div className="card">
                <div className="card-header"><h3 className="card-title flex gap-2"><Building size={18}/> Proveedor</h3></div>
                <div className="card-body">
                    <p className="font-bold text-lg">{compra.proveedor}</p>
                    <p className="text-sm text-muted">RUC: {compra.ruc_proveedor}</p>
                    {compra.contacto_proveedor && <p className="text-sm mt-2"><span className="font-medium">Contacto:</span> {compra.contacto_proveedor}</p>}
                    <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-bold text-muted uppercase">Documento Físico</p>
                        <p className="font-mono text-lg">{compra.serie_documento}-{compra.numero_documento}</p>
                        <p className="text-xs text-muted">{compra.tipo_documento}</p>
                    </div>
                </div>
            </div>

            {/* CUOTAS / LETRAS */}
            {compra.tipo_compra === 'Credito' && (
                <div className="card">
                    <div className="card-header bg-gray-50/50 flex justify-between items-center">
                        <h3 className="card-title flex gap-2"><CreditCard size={18}/> Letras / Cuotas</h3>
                        {!compra.cronograma_definido && <span className="badge badge-warning text-[10px]">Por definir</span>}
                    </div>
                    <div className="card-body p-0">
                        {compra.cuotas && compra.cuotas.length > 0 ? (
                            <div className="divide-y">
                                {compra.cuotas.map((cuota) => {
                                    const saldoC = parseFloat(cuota.monto_cuota) - parseFloat(cuota.monto_pagado||0);
                                    return (
                                        <div key={cuota.id_cuota} className="p-3 hover:bg-gray-50 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-sm">Letra #{cuota.numero_cuota} {cuota.codigo_letra ? `(${cuota.codigo_letra})` : ''}</p>
                                                <p className="text-xs text-muted">Vence: {formatearFecha(cuota.fecha_vencimiento)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-medium">{formatearMoneda(cuota.monto_cuota)}</p>
                                                {cuota.estado === 'Pagada' ? (
                                                    <span className="badge badge-success text-[10px]">Pagada</span>
                                                ) : (
                                                    <button className="btn btn-xs btn-primary mt-1" onClick={() => handleAbrirPagarCuota(cuota)}>Pagar</button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-4 text-center">
                                <p className="text-sm text-muted mb-2">No hay cronograma definido.</p>
                                <button className="btn btn-sm btn-outline" onClick={handleAbrirCronograma}>Crear Cronograma</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
      </div>

      {/* --- MODALES --- */}

      {/* Modal Pagar Cuota */}
      <Modal isOpen={modalPagarCuotaOpen} onClose={() => setModalPagarCuotaOpen(false)} title="Pagar Letra">
        <form onSubmit={handlePagarCuota} className="space-y-4">
            <div className="form-group">
                <label className="form-label">Cuenta Origen</label>
                <select className="form-select" value={datosPago.id_cuenta_pago} onChange={e => setDatosPago({...datosPago, id_cuenta_pago: e.target.value})} required>
                    <option value="">Seleccione...</option>
                    {cuentasPago.map(c => <option key={c.id_cuenta} value={c.id_cuenta}>{c.nombre} ({c.moneda})</option>)}
                </select>
            </div>
            <div className="form-group">
                <label className="form-label">Monto</label>
                <input type="number" className="form-input" value={datosPago.monto_pagado} onChange={e => setDatosPago({...datosPago, monto_pagado: e.target.value})} step="0.01" required />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>Confirmar Pago</button>
        </form>
      </Modal>

      {/* Modal Pago Directo (Amortización) */}
      <Modal isOpen={modalPagoDirectoOpen} onClose={() => setModalPagoDirectoOpen(false)} title="Registrar Pago">
        <form onSubmit={handlePagoDirecto} className="space-y-4">
            <div className="form-group">
                <label className="form-label">Cuenta Origen</label>
                <select className="form-select" value={datosPago.id_cuenta_pago} onChange={e => setDatosPago({...datosPago, id_cuenta_pago: e.target.value})} required>
                    <option value="">Seleccione...</option>
                    {cuentasPago.map(c => <option key={c.id_cuenta} value={c.id_cuenta}>{c.nombre} ({c.moneda})</option>)}
                </select>
            </div>
            <div className="form-group">
                <label className="form-label">Monto a Pagar</label>
                <input type="number" className="form-input" value={datosPago.monto_pagado} onChange={e => setDatosPago({...datosPago, monto_pagado: e.target.value})} step="0.01" max={compra.saldo_pendiente} required />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>Registrar Pago</button>
        </form>
      </Modal>

      {/* Modal Definir Cronograma */}
      <Modal isOpen={modalCronogramaOpen} onClose={() => setModalCronogramaOpen(false)} title="Definir Letras / Cuotas" size="lg">
        <form onSubmit={handleGuardarCronograma}>
            <div className="space-y-2 mb-4 max-h-[60vh] overflow-y-auto">
                {cronogramaForm.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center">
                        <span className="w-8 font-bold text-center">#{c.numero}</span>
                        <input type="date" className="form-input w-32" value={c.fecha_vencimiento} onChange={e => {
                            const newCrono = [...cronogramaForm]; newCrono[i].fecha_vencimiento = e.target.value; setCronogramaForm(newCrono);
                        }} required />
                        <input type="number" className="form-input flex-1" placeholder="Monto" value={c.monto} onChange={e => {
                            const newCrono = [...cronogramaForm]; newCrono[i].monto = e.target.value; setCronogramaForm(newCrono);
                        }} step="0.01" required />
                        <input type="text" className="form-input flex-1" placeholder="Cód. Letra (Opcional)" value={c.codigo_letra} onChange={e => {
                            const newCrono = [...cronogramaForm]; newCrono[i].codigo_letra = e.target.value; setCronogramaForm(newCrono);
                        }} />
                    </div>
                ))}
            </div>
            <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm">
                    Total Letras: <b>{formatearMoneda(cronogramaForm.reduce((acc, c) => acc + parseFloat(c.monto||0), 0))}</b>
                    <span className="text-muted ml-2">(Debe ser {formatearMoneda(compra.saldo_pendiente)})</span>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>Guardar Cronograma</button>
            </div>
        </form>
      </Modal>

      {/* Modal Cancelar */}
      <Modal isOpen={modalCancelarOpen} onClose={() => setModalCancelarOpen(false)} title="Cancelar Compra">
        <div className="space-y-4">
            <p className="text-sm text-muted">¿Está seguro? Esta acción revertirá el stock.</p>
            <textarea className="form-textarea" placeholder="Motivo..." value={motivoCancelacion} onChange={e => setMotivoCancelacion(e.target.value)} required />
            <div className="flex justify-end gap-2">
                <button className="btn btn-outline" onClick={() => setModalCancelarOpen(false)}>Volver</button>
                <button className="btn btn-danger" onClick={handleCancelarCompra}>Confirmar Cancelación</button>
            </div>
        </div>
      </Modal>

    </div>
  );
}

export default DetalleCompra;