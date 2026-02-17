import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Download, ShoppingCart, 
  XCircle, AlertCircle, Building, Calendar,
  CreditCard, DollarSign, TrendingUp,
  PackageCheck, FileText, Plus, Receipt,
  RefreshCw, PackagePlus, Truck, AlertTriangle,
  ArrowRightLeft, ExternalLink, MapPin, FileCheck,
  Clock, CheckCircle2
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { comprasAPI, cuentasPagoAPI, productosAPI } from '../../config/api';

function DetalleCompra() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [compra, setCompra] = useState(null);
  const [cuentasPago, setCuentasPago] = useState([]);
  const [letras, setLetras] = useState([]);
  const [ingresos, setIngresos] = useState([]);
  const [itemsPendientes, setItemsPendientes] = useState([]);
  const [productos, setProductos] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [tabActiva, setTabActiva] = useState('general');
  
  const [modalPagarCuotaOpen, setModalPagarCuotaOpen] = useState(false);
  const [modalPagoDirectoOpen, setModalPagoDirectoOpen] = useState(false);
  const [modalReembolsoOpen, setModalReembolsoOpen] = useState(false);
  const [modalCancelarOpen, setModalCancelarOpen] = useState(false);
  const [modalCronogramaOpen, setModalCronogramaOpen] = useState(false);
  const [modalRegistrarLetrasOpen, setModalRegistrarLetrasOpen] = useState(false);
  const [modalPagarLetraOpen, setModalPagarLetraOpen] = useState(false);
  const [modalIngresoInventarioOpen, setModalIngresoInventarioOpen] = useState(false);
  const [modalCambiarCuentaOpen, setModalCambiarCuentaOpen] = useState(false);

  const [cuotaSeleccionada, setCuotaSeleccionada] = useState(null);
  const [letraSeleccionada, setLetraSeleccionada] = useState(null);
  
  const [datosPago, setDatosPago] = useState({
    id_cuenta_pago: '',
    monto_pagado: '',
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'Transferencia',
    referencia: '',
    observaciones: ''
  });

  const [datosReembolso, setDatosReembolso] = useState({
    id_cuenta_pago: '',
    monto_reembolso: '',
    referencia: '',
    observaciones: ''
  });

  const [datosLetra, setDatosLetra] = useState({
    id_cuenta_pago: '',
    monto_pagado: '',
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'Transferencia',
    numero_operacion: '',
    observaciones: ''
  });

  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [nuevaCuentaId, setNuevaCuentaId] = useState('');
  const [cronogramaForm, setCronogramaForm] = useState([]);
  const [letrasForm, setLetrasForm] = useState([]);
  
  const [ingresoForm, setIngresoForm] = useState({
    productos: [],
    observaciones: ''
  });

  useEffect(() => {
    cargarDatos();
  }, [id]);

  useEffect(() => {
    if (tabActiva === 'letras') {
      cargarLetras();
    } else if (tabActiva === 'ingresos') {
      cargarIngresos();
      cargarItemsPendientes();
    }
  }, [tabActiva]);

  const cargarDatos = async () => {
    try {
      setLoading(true); 
      setError(null);
      const [compraRes, cuentasRes, productosRes] = await Promise.all([
        comprasAPI.getById(id),
        cuentasPagoAPI.getAll({ estado: 'Activo' }),
        productosAPI.getAll({ estado: 'Activo' })
      ]);
      
      if (compraRes.data.success) {
        setCompra(compraRes.data.data);
        if (compraRes.data.data.id_cuenta_pago) {
          setNuevaCuentaId(compraRes.data.data.id_cuenta_pago);
        }
      } else {
        setError('Compra no encontrada');
      }

      if (cuentasRes.data.success) setCuentasPago(cuentasRes.data.data || []);
      if (productosRes.data.success) setProductos(productosRes.data.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar la compra');
    } finally {
      setLoading(false);
    }
  };

  const cargarLetras = async () => {
    try {
      const response = await comprasAPI.getLetras(id);
      if (response.data.success) setLetras(response.data.data || []);
    } catch (err) { 
      console.error(err); 
    }
  };

  const cargarIngresos = async () => {
    try {
      const response = await comprasAPI.getIngresos(id);
      if (response.data.success) setIngresos(response.data.data || []);
    } catch (err) { 
      console.error(err); 
    }
  };

  const cargarItemsPendientes = async () => {
    try {
      const response = await comprasAPI.getItemsPendientes(id);
      if (response.data.success) {
        setItemsPendientes(response.data.data || []);
        const productosIniciales = response.data.data.map(item => ({
          id_producto: item.id_producto,
          nombre: item.nombre,
          codigo: item.codigo,
          cantidad_pendiente: parseFloat(item.cantidad_pendiente),
          cantidad_ingresar: 0
        }));
        setIngresoForm({ ...ingresoForm, productos: productosIniciales });
      }
    } catch (err) { 
      console.error(err); 
    }
  };

  const handleAbrirPagarCuota = (cuota) => {
    setCuotaSeleccionada(cuota);
    const saldoPendiente = parseFloat(cuota.monto_cuota) - parseFloat(cuota.monto_pagado || 0);
    setDatosPago({ 
      ...datosPago, 
      monto_pagado: saldoPendiente.toFixed(2), 
      observaciones: `Pago Cuota ${cuota.numero_cuota}`,
      id_cuenta_pago: compra.id_cuenta_pago || ''
    });
    setModalPagarCuotaOpen(true);
  };

  const handleAbrirPagoDirecto = () => {
    setDatosPago({ 
      ...datosPago, 
      monto_pagado: parseFloat(compra.saldo_pendiente).toFixed(2), 
      observaciones: 'Amortización / Regularización',
      id_cuenta_pago: compra.id_cuenta_pago || ''
    });
    setModalPagoDirectoOpen(true);
  };

  const handleAbrirReembolso = () => {
    const montoReembolsoPendiente = parseFloat(compra.monto_reembolsar || 0) - parseFloat(compra.monto_reembolsado || 0);
    setDatosReembolso({ 
      ...datosReembolso, 
      monto_reembolso: montoReembolsoPendiente.toFixed(2),
      observaciones: `Reembolso a ${compra.comprador || 'empleado'} - OC ${compra.numero_orden}`
    });
    setModalReembolsoOpen(true);
  };

  const handlePagarCuota = async (e) => {
    e.preventDefault();
    
    if (!datosPago.id_cuenta_pago) {
      setError('Debe seleccionar una cuenta de pago');
      return;
    }

    try {
      setLoading(true);
      const response = await comprasAPI.pagarCuota(id, cuotaSeleccionada.id_cuota, datosPago);
      if (response.data.success) {
        setSuccess('Cuota pagada correctamente');
        setModalPagarCuotaOpen(false);
        await cargarDatos();
      } else {
        setError(response.data.error);
      }
    } catch (err) { 
      setError(err.response?.data?.error || 'Error al pagar'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handlePagoDirecto = async (e) => {
    e.preventDefault();
    
    if (!datosPago.id_cuenta_pago) {
      setError('Debe seleccionar una cuenta de pago');
      return;
    }

    try {
      setLoading(true);
      const response = await comprasAPI.registrarPago(id, datosPago);
      if (response.data.success) {
        setSuccess('Pago registrado correctamente');
        setModalPagoDirectoOpen(false);
        await cargarDatos();
      } else {
        setError(response.data.error);
      }
    } catch (err) { 
      setError(err.response?.data?.error || 'Error al pagar'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleRegistrarReembolso = async (e) => {
    e.preventDefault();
    
    if (!datosReembolso.id_cuenta_pago) {
      setError('Debe seleccionar una cuenta de origen');
      return;
    }

    try {
      setLoading(true);
      const response = await comprasAPI.registrarReembolso(id, datosReembolso);
      if (response.data.success) {
        setSuccess('Reembolso registrado correctamente');
        setModalReembolsoOpen(false);
        await cargarDatos();
      } else {
        setError(response.data.error);
      }
    } catch (err) { 
      setError(err.response?.data?.error || 'Error al registrar reembolso'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleAbrirCronograma = () => {
    const numCuotas = compra.numero_cuotas || 1;
    const montoBase = parseFloat(compra.saldo_pendiente) / numCuotas;
    const diasEntre = compra.dias_entre_cuotas || 30;
    
    let fechaBase = new Date(compra.fecha_vencimiento || compra.fecha_emision);
    if (compra.fecha_primera_cuota) {
      fechaBase = new Date(compra.fecha_primera_cuota);
    }
    
    const nuevoCrono = [];
    for(let i=1; i<=numCuotas; i++) {
      const fechaCuota = new Date(fechaBase);
      fechaCuota.setDate(fechaCuota.getDate() + ((i-1) * diasEntre));
      
      nuevoCrono.push({
        numero: i,
        fecha_vencimiento: fechaCuota.toISOString().split('T')[0],
        monto: montoBase.toFixed(2),
        codigo_letra: ''
      });
    }
    setCronogramaForm(nuevoCrono);
    setModalCronogramaOpen(true);
  };

  const handleGuardarCronograma = async (e) => {
    e.preventDefault();
    
    const totalCronograma = cronogramaForm.reduce((acc, c) => acc + parseFloat(c.monto || 0), 0);
    const saldoPendiente = parseFloat(compra.saldo_pendiente);
    
    if (Math.abs(totalCronograma - saldoPendiente) > 1.00) {
      setError(`La suma de las cuotas (${formatearMoneda(totalCronograma)}) no coincide con el saldo pendiente (${formatearMoneda(saldoPendiente)})`);
      return;
    }
    
    try {
      setLoading(true);
      const response = await comprasAPI.establecerCronograma(id, { cuotas: cronogramaForm });
      if(response.data.success) {
        setSuccess('Cronograma establecido correctamente');
        setModalCronogramaOpen(false);
        await cargarDatos();
      } else {
        setError(response.data.error);
      }
    } catch(err) { 
      setError(err.response?.data?.error || 'Error al establecer cronograma'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleAbrirRegistrarLetras = () => {
    const numLetras = compra.numero_cuotas || 3;
    const montoBase = parseFloat(compra.saldo_pendiente) / numLetras;
    const diasEntre = compra.dias_entre_cuotas || 30;
    
    let fechaBase = new Date();
    if (compra.fecha_primera_cuota) {
      fechaBase = new Date(compra.fecha_primera_cuota);
    } else {
      fechaBase.setDate(fechaBase.getDate() + diasEntre);
    }
    
    const nuevasLetras = [];
    for(let i=1; i<=numLetras; i++) {
      const fechaLetra = new Date(fechaBase);
      fechaLetra.setDate(fechaLetra.getDate() + ((i-1) * diasEntre));
      
      nuevasLetras.push({
        numero_letra: `L-${compra.numero_orden}-${String(i).padStart(2, '0')}`,
        monto: montoBase.toFixed(2),
        fecha_emision: new Date().toISOString().split('T')[0],
        fecha_vencimiento: fechaLetra.toISOString().split('T')[0],
        banco: '',
        observaciones: ''
      });
    }
    setLetrasForm(nuevasLetras);
    setModalRegistrarLetrasOpen(true);
  };

  const handleGuardarLetras = async (e) => {
    e.preventDefault();
    
    const totalLetras = letrasForm.reduce((acc, l) => acc + parseFloat(l.monto || 0), 0);
    const saldoPendiente = parseFloat(compra.saldo_pendiente);
    
    if (Math.abs(totalLetras - saldoPendiente) > 1.00) {
      setError(`La suma de las letras (${formatearMoneda(totalLetras)}) no coincide con el saldo pendiente (${formatearMoneda(saldoPendiente)})`);
      return;
    }
    
    try {
      setLoading(true);
      const response = await comprasAPI.registrarLetras(id, { letras: letrasForm });
      if (response.data.success) {
        setSuccess('Letras registradas correctamente');
        setModalRegistrarLetrasOpen(false);
        await cargarDatos();
        await cargarLetras();
      } else {
        setError(response.data.error);
      }
    } catch (err) { 
      setError(err.response?.data?.error || 'Error al registrar letras'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleAbrirPagarLetra = (letra) => {
    setLetraSeleccionada(letra);
    setDatosLetra({ 
      ...datosLetra, 
      monto_pagado: parseFloat(letra.saldo_pendiente || letra.monto).toFixed(2),
      observaciones: `Pago Letra ${letra.numero_letra}`,
      id_cuenta_pago: compra.id_cuenta_pago || ''
    });
    setModalPagarLetraOpen(true);
  };

  const handlePagarLetra = async (e) => {
    e.preventDefault();
    
    if (!datosLetra.id_cuenta_pago) {
      setError('Debe seleccionar una cuenta de pago');
      return;
    }

    try {
      setLoading(true);
      const response = await comprasAPI.pagarLetra(letraSeleccionada.id_letra, datosLetra);
      if (response.data.success) {
        setSuccess('Letra pagada correctamente');
        setModalPagarLetraOpen(false);
        await cargarDatos();
        await cargarLetras();
      } else {
        setError(response.data.error);
      }
    } catch (err) { 
      setError(err.response?.data?.error || 'Error al pagar letra'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleAbrirIngresoInventario = () => {
    setModalIngresoInventarioOpen(true);
  };

  const handleActualizarCantidadIngreso = (idProducto, cantidad) => {
    const nuevosProductos = ingresoForm.productos.map(p => 
      p.id_producto === idProducto ? { ...p, cantidad_ingresar: parseFloat(cantidad) || 0 } : p
    );
    setIngresoForm({ ...ingresoForm, productos: nuevosProductos });
  };

  const handleRegistrarIngreso = async (e) => {
    e.preventDefault();
    const productosAIngresar = ingresoForm.productos.filter(p => p.cantidad_ingresar > 0);
    
    if (productosAIngresar.length === 0) {
      setError('Debe ingresar al menos un producto con cantidad mayor a 0'); 
      return;
    }
    
    const productosExcedidos = productosAIngresar.filter(p => p.cantidad_ingresar > p.cantidad_pendiente);
    if (productosExcedidos.length > 0) {
      setError('Algunas cantidades exceden lo pendiente'); 
      return;
    }

    try {
      setLoading(true);
      const payload = {
        productos: productosAIngresar.map(p => ({
          id_producto: p.id_producto,
          cantidad_ingresar: p.cantidad_ingresar
        })),
        observaciones: ingresoForm.observaciones
      };

      const response = await comprasAPI.registrarIngreso(id, payload);
      if (response.data.success) {
        setSuccess('Ingreso registrado correctamente');
        setModalIngresoInventarioOpen(false);
        await cargarDatos();
        await cargarIngresos();
        await cargarItemsPendientes();
      } else {
        setError(response.data.error);
      }
    } catch (err) { 
      setError(err.response?.data?.error || 'Error al registrar ingreso'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleCancelarCompra = async () => {
    if (!motivoCancelacion.trim()) { 
      setError('Indique motivo de la cancelación'); 
      return; 
    }
    
    try {
      setLoading(true);
      const response = await comprasAPI.cancelar(id, { motivo_cancelacion: motivoCancelacion });
      if (response.data.success) {
        setSuccess('Compra cancelada y reversiones ejecutadas correctamente');
        setModalCancelarOpen(false);
        await cargarDatos();
      } else {
        setError(response.data.error);
      }
    } catch (err) { 
      setError(err.response?.data?.error || 'Error al cancelar'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleCambiarCuenta = async () => {
    if (!nuevaCuentaId) { 
      setError('Seleccione una cuenta'); 
      return; 
    }
    
    if (parseInt(nuevaCuentaId) === parseInt(compra.id_cuenta_pago)) {
      setError('La cuenta seleccionada es la misma que la actual');
      return;
    }
    
    try {
      setLoading(true);
      const response = await comprasAPI.cambiarCuenta(id, { id_nueva_cuenta: nuevaCuentaId });
      if (response.data.success) {
        setSuccess('Cuenta actualizada y movimientos migrados correctamente');
        setModalCambiarCuentaOpen(false);
        await cargarDatos();
      } else {
        setError(response.data.error);
      }
    } catch (err) { 
      setError(err.response?.data?.error || 'Error al cambiar cuenta'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDescargarPDF = async () => {
    try {
      setLoading(true); 
      await comprasAPI.descargarPDF(id); 
      setSuccess('PDF descargado correctamente');
    } catch (err) { 
      setError('Error al descargar PDF'); 
    } finally { 
      setLoading(false); 
    }
  };

  const formatearFecha = (f) => f ? new Date(f).toLocaleDateString('es-PE') : '-';
  
  const formatearMoneda = (v, m) => {
    const mon = m || compra?.moneda || 'PEN';
    return `${mon === 'USD' ? '$' : 'S/'} ${parseFloat(v||0).toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
  };

  if (loading && !compra) return <Loading message="Cargando detalles..." />;
  if (!compra) return <Alert type="error" message="Compra no encontrada" />;

  const saldoReembolso = parseFloat(compra.monto_reembolsar || 0) - parseFloat(compra.monto_reembolsado || 0);
  
 const normalizar = (v) => (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const tipoCompra = normalizar(compra.tipo_compra);
const formaPago = normalizar(compra.forma_pago_detalle);

const esCredito = tipoCompra === 'credito' || formaPago === 'credito';
const esLetras = tipoCompra === 'letras' || formaPago === 'letras';
const esContado = tipoCompra === 'contado' || formaPago === 'contado';
  
  const tieneSaldoPendiente = parseFloat(compra.saldo_pendiente) > 0.01;
  const estaPagado = compra.estado_pago === 'Pagado';
  const estaCancelada = compra.estado === 'Cancelada';
  const usaFondosPropios = compra.usa_fondos_propios === 1;
  
  const tieneCronogramaPendiente = (esCredito || esLetras) && !compra.cronograma_definido;
  const tieneLetrasRegistradas = compra.letras_registradas === 1;
  
  const esContadoSinPago = esContado && tieneSaldoPendiente && parseFloat(compra.monto_pagado) === 0;
  const esContadoPendienteRegularizar = esContado && tieneSaldoPendiente && parseFloat(compra.monto_pagado) > 0;
  
  const mostrarBotonPagoDirecto = !estaCancelada && !estaPagado && !usaFondosPropios && tieneSaldoPendiente && (
  esContado ||
  (esCredito || esLetras)
);
  
  const mostrarBotonCronograma = !estaCancelada && !estaPagado && (esCredito || esLetras) && tieneCronogramaPendiente;
  const mostrarBotonRegistrarLetras = !estaCancelada && !estaPagado && esLetras && !tieneLetrasRegistradas;
  const mostrarBotonCambiarCuenta = !estaCancelada && !estaPagado && !usaFondosPropios && compra.id_cuenta_pago;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <button className="btn btn-outline" onClick={() => navigate('/compras')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart size={28} className="text-primary"/> Compra {compra.numero_orden}
            </h1>
            <div className="flex gap-3 text-sm text-muted mt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar size={14}/> {formatearFecha(compra.fecha_emision)}
              </span>
              <span className={`badge ${
                compra.estado === 'Recibida' ? 'badge-success' : 
                compra.estado === 'En Tránsito' ? 'badge-info' : 
                compra.estado === 'Cancelada' ? 'badge-danger' : 
                'badge-warning'
              }`}>
                {compra.estado}
              </span>
              {usaFondosPropios && (
                <span className="badge badge-purple">Fondos Propios</span>
              )}
              <span className="badge badge-outline">
                {compra.forma_pago_detalle || compra.tipo_compra}
              </span>
              {esContadoSinPago && (
                <span className="badge badge-warning flex items-center gap-1">
                  <Clock size={12} /> Solo Registro
                </span>
              )}
              {(esCredito || esLetras) && tieneCronogramaPendiente && (
                <span className="badge badge-warning flex items-center gap-1">
                  <AlertCircle size={12} /> Sin Cronograma
                </span>
              )}
              {(esCredito || esLetras) && compra.cronograma_definido && (
                <span className="badge badge-success flex items-center gap-1">
                  <CheckCircle2 size={12} /> Cronograma OK
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {compra.url_comprobante && (
            <a 
              href={compra.url_comprobante} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-outline text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <FileCheck size={18} /> Ver Comprobante
            </a>
          )}
          
          <button className="btn btn-outline" onClick={handleDescargarPDF}>
            <Download size={18} /> PDF
          </button>
          
          {!estaCancelada && (
            <>
              {mostrarBotonCambiarCuenta && (
                <button 
                  className="btn btn-outline" 
                  onClick={() => setModalCambiarCuentaOpen(true)}
                >
                  <ArrowRightLeft size={18} /> Mover Cuenta
                </button>
              )}
              
              {mostrarBotonPagoDirecto && (
                <button 
                  className="btn btn-primary" 
                  onClick={handleAbrirPagoDirecto}
                >
                  <DollarSign size={18} /> 
                  {esContadoSinPago ? 'Regularizar Pago' : 
                   esContadoPendienteRegularizar ? 'Completar Pago' : 
                   'Amortizar Deuda'}
                </button>
              )}

              {mostrarBotonCronograma && (
                <button 
                  className="btn btn-warning text-white" 
                  onClick={handleAbrirCronograma}
                >
                  <FileText size={18} /> Definir Cronograma
                </button>
              )}
              
              {mostrarBotonRegistrarLetras && (
                <button 
                  className="btn btn-purple text-white" 
                  onClick={handleAbrirRegistrarLetras}
                >
                  <Receipt size={18} /> Registrar Letras
                </button>
              )}
              
              <button 
                className="btn btn-outline text-danger border-danger hover:bg-danger/10" 
                onClick={() => setModalCancelarOpen(true)}
              >
                <XCircle size={18} /> Cancelar / Anular
              </button>
            </>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className={`card mb-6 border-l-4 ${
        estaCancelada ? 'border-danger' : 
        estaPagado ? 'border-success' : 
        'border-warning'
      }`}>
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
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-danger">{formatearMoneda(compra.saldo_pendiente)}</p>
              {esContadoSinPago && (
                <span className="badge badge-warning text-xs">Sin Pago</span>
              )}
              {esContadoPendienteRegularizar && (
                <span className="badge badge-warning text-xs">Regularizar</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted">Vencimiento</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium">{formatearFecha(compra.fecha_vencimiento)}</span>
              {compra.dias_para_vencer < 0 && tieneSaldoPendiente && (
                <span className="badge badge-danger">Vencido</span>
              )}
              {compra.dias_para_vencer >= 0 && compra.dias_para_vencer <= 7 && tieneSaldoPendiente && (
                <span className="badge badge-warning">{compra.dias_para_vencer}d</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {esContadoSinPago && !estaCancelada && (
        <div className="card mb-6 border-l-4 border-orange-500 bg-orange-50">
          <div className="card-body">
            <div className="flex items-start gap-3">
              <Clock className="text-orange-600 shrink-0 mt-1" size={24} />
              <div className="flex-1">
                <h3 className="font-bold text-orange-900 mb-1">Compra Registrada Sin Desembolso</h3>
                <p className="text-sm text-orange-800">
                  Esta compra fue registrada sin realizar el pago. Usa el botón "Regularizar Pago" para completar el desembolso desde una cuenta.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {usaFondosPropios && saldoReembolso > 0 && !estaCancelada && (
        <div className="card mb-6 border-l-4 border-purple-500 bg-purple-50">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-purple-900 flex items-center gap-2">
                  <RefreshCw size={18} /> Reembolso Pendiente
                </h3>
                <p className="text-sm text-purple-700 mt-1">
                  Comprador: <span className="font-medium">{compra.comprador || 'No especificado'}</span>
                </p>
                <p className="text-sm text-purple-700">
                  Estado: <span className={`badge ${
                    compra.estado_reembolso === 'Pendiente' ? 'badge-danger' : 
                    compra.estado_reembolso === 'Parcial' ? 'badge-warning' : 
                    'badge-success'
                  }`}>
                    {compra.estado_reembolso}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted">Monto a reembolsar</p>
                <p className="text-2xl font-bold text-purple-900">{formatearMoneda(saldoReembolso)}</p>
                <button 
                  className="btn btn-sm btn-purple text-white mt-2" 
                  onClick={handleAbrirReembolso}
                >
                  <DollarSign size={16} /> Reembolsar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {estaCancelada && (
        <div className="card mb-6 bg-red-50 border border-red-200">
          <div className="card-body flex items-start gap-3">
            <XCircle className="text-red-500 shrink-0" size={24} />
            <div>
              <h3 className="font-bold text-red-800">Compra Cancelada</h3>
              <p className="text-sm text-red-700 mt-1">
                Esta compra fue anulada y sus movimientos financieros revertidos.
              </p>
              {compra.observaciones && compra.observaciones.includes('[CANCELADA') && (
                <div className="mt-2 text-xs text-red-600 bg-white p-2 rounded border border-red-200">
                  {compra.observaciones.split('\n').filter(line => line.includes('[CANCELADA')).join('\n')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            <button 
              className={`px-4 py-2 border-b-2 font-medium transition ${
                tabActiva === 'general' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted hover:text-gray-700'
              }`} 
              onClick={() => setTabActiva('general')}
            >
              General
            </button>
            <button 
              className={`px-4 py-2 border-b-2 font-medium transition ${
                tabActiva === 'pagos' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted hover:text-gray-700'
              }`} 
              onClick={() => setTabActiva('pagos')}
            >
              Pagos
            </button>
            {(esLetras || esCredito) && (
  <button 
    className={`px-4 py-2 border-b-2 font-medium transition ${
      tabActiva === 'letras' 
        ? 'border-primary text-primary' 
        : 'border-transparent text-muted hover:text-gray-700'
    }`} 
    onClick={() => setTabActiva('letras')}
  >
    {esLetras ? 'Letras' : 'Cuotas'}
    {compra.cuotas && compra.cuotas.filter(c => c.estado !== 'Pagada' && c.estado !== 'Cancelada').length > 0 && (
      <span className="ml-2 badge badge-warning text-xs">
        {compra.cuotas.filter(c => c.estado !== 'Pagada' && c.estado !== 'Cancelada').length}
      </span>
    )}
  </button>
)}
            <button 
              className={`px-4 py-2 border-b-2 font-medium transition ${
                tabActiva === 'ingresos' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted hover:text-gray-700'
              }`} 
              onClick={() => setTabActiva('ingresos')}
            >
              Ingresos Inventario 
              {itemsPendientes.length > 0 && (
                <span className="ml-2 badge badge-info text-xs">
                  {itemsPendientes.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {tabActiva === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <div className="card-header bg-gray-50">
                <h3 className="card-title flex gap-2">
                  <PackageCheck size={18}/> Items de la Compra
                </h3>
              </div>
              <div className="card-body p-0">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="text-right">Cant. Solicitada</th>
                      <th className="text-right">Progreso Entrega</th>
                      <th className="text-right">Precio</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compra.detalle?.map((item, i) => {
                      const porcentaje = (parseFloat(item.cantidad_recibida || 0) / parseFloat(item.cantidad)) * 100;
                      const esCompleto = parseFloat(item.cantidad_recibida || 0) >= parseFloat(item.cantidad);
                      return (
                        <tr key={i}>
                          <td>
                            <div className="font-medium">{item.producto}</div>
                            <div className="text-xs text-muted">{item.codigo_producto}</div>
                          </td>
                          <td className="text-right">
                            {parseFloat(item.cantidad).toFixed(2)} {item.unidad_medida}
                          </td>
                          <td className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-xs font-bold ${
                                esCompleto ? 'text-success' : 'text-warning'
                              }`}>
                                {parseFloat(item.cantidad_recibida || 0).toFixed(2)} / {parseFloat(item.cantidad).toFixed(2)}
                              </span>
                              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    esCompleto ? 'bg-success' : 'bg-warning'
                                  }`} 
                                  style={{ width: `${Math.min(porcentaje, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="text-right">{formatearMoneda(item.precio_unitario)}</td>
                          <td className="text-right font-bold">{formatearMoneda(item.subtotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 font-medium">
                    <tr>
                      <td colSpan="4" className="text-right">Subtotal</td>
                      <td className="text-right">{formatearMoneda(compra.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan="4" className="text-right">
                        Impuesto ({parseFloat(compra.igv) > 0 ? '18%' : '0%'})
                      </td>
                      <td className="text-right">{formatearMoneda(compra.igv)}</td>
                    </tr>
                    <tr>
                      <td colSpan="4" className="text-right font-bold text-lg">Total</td>
                      <td className="text-right font-bold text-lg">{formatearMoneda(compra.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <div className="card-header bg-gray-50">
                  <h3 className="card-title flex gap-2 text-sm">
                    <FileText size={16}/> Notas Internas
                  </h3>
                </div>
                <div className="card-body text-sm text-gray-600">
                  {compra.observaciones ? (
                    <div className="whitespace-pre-wrap">{compra.observaciones}</div>
                  ) : (
                    <span className="italic text-muted">Sin observaciones.</span>
                  )}
                </div>
              </div>
              <div className="card">
                <div className="card-header bg-gray-50">
                  <h3 className="card-title flex gap-2 text-sm">
                    <MapPin size={16}/> Dirección de Entrega
                  </h3>
                </div>
                <div className="card-body text-sm text-gray-600">
                  {compra.direccion_entrega ? (
                    compra.direccion_entrega
                  ) : (
                    <span className="italic text-muted">No especificada.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card">
              <div className="card-header bg-gray-50">
                <h3 className="card-title flex gap-2">
                  <Building size={18}/> Proveedor
                </h3>
              </div>
              <div className="card-body">
                <p className="font-bold text-lg">{compra.proveedor}</p>
                <p className="text-sm text-muted">RUC: {compra.ruc_proveedor}</p>
                {compra.contacto_proveedor && (
                  <p className="text-sm mt-2">
                    <span className="font-medium">Contacto:</span> {compra.contacto_proveedor}
                  </p>
                )}
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-bold text-muted uppercase mb-1">Documento Físico</p>
                  <p className="font-mono text-lg">
                    {compra.serie_documento}-{compra.numero_documento}
                  </p>
                  <p className="text-xs text-muted">{compra.tipo_documento}</p>
                  {compra.url_comprobante && (
                    <a 
                      href={compra.url_comprobante} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-blue-600 text-xs hover:underline flex items-center gap-1 mt-1"
                    >
                      <ExternalLink size={12}/> Ver archivo adjunto
                    </a>
                  )}
                </div>
              </div>
            </div>

            {compra.id_cuenta_pago && !usaFondosPropios && (
              <div className="card">
                <div className="card-header bg-gray-50">
                  <h3 className="card-title flex gap-2">
                    <CreditCard size={18}/> Cuenta de Pago Asignada
                  </h3>
                </div>
                <div className="card-body">
                  <p className="font-medium text-lg">{compra.cuenta_pago || 'Cuenta no encontrada'}</p>
                  <p className="text-sm text-muted">
                    {compra.tipo_cuenta_pago}
                  </p>
                  {compra.banco_cuenta && (
                    <p className="text-xs text-muted mt-1">Banco: {compra.banco_cuenta}</p>
                  )}
                </div>
              </div>
            )}

            {!compra.id_cuenta_pago && !usaFondosPropios && esContadoSinPago && (
              <div className="card border-l-4 border-orange-500">
                <div className="card-body">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="font-medium text-sm text-orange-900">Sin Cuenta Asignada</p>
                      <p className="text-xs text-orange-700 mt-1">
                        Esta compra se registró sin cuenta. Al regularizar el pago, se asignará automáticamente.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {(esCredito || esLetras) && (
              <div className="card">
                <div className="card-header bg-gray-50 flex justify-between items-center">
                  <h3 className="card-title flex gap-2">
                    <CreditCard size={18}/> Cuotas / Cronograma
                  </h3>
                  {tieneCronogramaPendiente && (
                    <span className="badge badge-warning text-[10px]">Por definir</span>
                  )}
                  {compra.cronograma_definido && (
                    <span className="badge badge-success text-[10px]">Definido</span>
                  )}
                </div>
                <div className="card-body p-0">
                  {compra.cuotas && compra.cuotas.length > 0 ? (
                    <div className="divide-y">
                      {compra.cuotas.map((cuota) => (
                        <div 
                          key={cuota.id_cuota} 
                          className="p-3 hover:bg-gray-50 flex justify-between items-center"
                        >
                          <div>
                            <p className="font-bold text-sm">
                              Cuota #{cuota.numero_cuota} 
                              {cuota.codigo_letra ? ` (${cuota.codigo_letra})` : ''}
                            </p>
                            <p className="text-xs text-muted">
                              Vence: {formatearFecha(cuota.fecha_vencimiento)}
                            </p>
                            {cuota.dias_para_vencer !== undefined && cuota.dias_para_vencer < 7 && cuota.estado !== 'Pagada' && (
                              <p className={`text-xs ${
                                cuota.dias_para_vencer < 0 ? 'text-danger' : 'text-warning'
                              }`}>
                                {cuota.dias_para_vencer < 0 
                                  ? `Vencida hace ${Math.abs(cuota.dias_para_vencer)} días` 
                                  : `Vence en ${cuota.dias_para_vencer} días`}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatearMoneda(cuota.monto_cuota)}</p>
                            {cuota.estado === 'Pagada' ? (
                              <span className="badge badge-success text-[10px]">Pagada</span>
                            ) : cuota.estado === 'Cancelada' ? (
                              <span className="badge badge-danger text-[10px]">Cancelada</span>
                            ) : (
                              <button 
                                className="btn btn-xs btn-primary mt-1" 
                                onClick={() => handleAbrirPagarCuota(cuota)}
                              >
                                Pagar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted mb-2">No hay cronograma definido.</p>
                      {!estaPagado && !estaCancelada && (
                        <button 
                          className="btn btn-sm btn-outline" 
                          onClick={handleAbrirCronograma}
                        >
                          Crear Cronograma
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tabActiva === 'pagos' && (
        <div className="card">
          <div className="card-header bg-gray-50">
            <h3 className="card-title flex gap-2">
              <TrendingUp size={18}/> Historial de Pagos
            </h3>
          </div>
          <div className="card-body p-0">
            {compra.pagos_realizados && compra.pagos_realizados.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Cuenta Origen</th>
                    <th>Concepto</th>
                    <th>Ref.</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {compra.pagos_realizados.map((pago, i) => (
                    <tr 
                      key={i} 
                      className={pago.tipo_movimiento === 'Ingreso' ? 'bg-red-50' : ''}
                    >
                      <td>{new Date(pago.fecha_movimiento).toLocaleDateString('es-PE')}</td>
                      <td>
                        {pago.tipo_movimiento === 'Ingreso' ? (
                          <span className="badge badge-danger">Anulación</span>
                        ) : pago.es_reembolso === 1 ? (
                          <span className="badge badge-purple flex items-center gap-1 w-fit">
                            <RefreshCw size={12} /> Reembolso
                          </span>
                        ) : (
                          <span className="badge badge-info">Pago</span>
                        )}
                      </td>
                      <td>
                        <div className="font-medium">{pago.cuenta_origen}</div>
                        <div className="text-xs text-muted">{pago.tipo_cuenta}</div>
                      </td>
                      <td className="text-sm">{pago.concepto || '-'}</td>
                      <td className="text-sm">{pago.referencia || '-'}</td>
                      <td className={`text-right font-bold ${
                        pago.tipo_movimiento === 'Ingreso' ? 'text-danger' : 'text-success'
                      }`}>
                        {pago.tipo_movimiento === 'Ingreso' ? '-' : ''}
                        {formatearMoneda(pago.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="5" className="text-right font-bold">Total Pagado:</td>
                    <td className="text-right font-bold text-success">
                      {formatearMoneda(compra.monto_pagado)}
                    </td>
                  </tr>
                  {tieneSaldoPendiente && (
                    <tr>
                      <td colSpan="5" className="text-right font-bold">Saldo Pendiente:</td>
                      <td className="text-right font-bold text-danger">
                        {formatearMoneda(compra.saldo_pendiente)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            ) : (
              <div className="p-8 text-center text-muted">
                <TrendingUp size={48} className="mx-auto mb-3 opacity-20" />
                <p>No hay pagos registrados aún.</p>
                {esContadoSinPago && (
                  <p className="text-sm mt-2 text-orange-600">
                    Esta compra se registró sin pago. Usa "Regularizar Pago" para completar el desembolso.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tabActiva === 'letras' && (
  <div className="space-y-6">
    {esCredito && (
      <div className="card">
        <div className="card-header bg-gray-50 flex justify-between items-center">
          <h3 className="card-title flex gap-2">
            <CreditCard size={18}/> Cronograma de Cuotas
          </h3>
          {tieneCronogramaPendiente && !estaCancelada && (
            <button className="btn btn-sm btn-warning text-white" onClick={handleAbrirCronograma}>
              <FileText size={14}/> Definir Cronograma
            </button>
          )}
          {compra.cronograma_definido && (
            <span className="badge badge-success text-[10px]">Cronograma Definido</span>
          )}
        </div>
        <div className="card-body p-0">
          {compra.cuotas && compra.cuotas.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Cuota</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th className="text-right">Monto</th>
                  <th className="text-right">Pagado</th>
                  <th className="text-right">Saldo</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {compra.cuotas.map((cuota) => (
                  <tr
                    key={cuota.id_cuota}
                    className={
                      cuota.nivel_alerta === 'danger' ? 'bg-red-50' :
                      cuota.nivel_alerta === 'warning' ? 'bg-yellow-50' : ''
                    }
                  >
                    <td className="font-bold">
                      #{cuota.numero_cuota}
                      {cuota.codigo_letra ? ` (${cuota.codigo_letra})` : ''}
                    </td>
                    <td>
                      <div>{formatearFecha(cuota.fecha_vencimiento)}</div>
                      {cuota.dias_para_vencer !== undefined && cuota.estado !== 'Pagada' && cuota.estado !== 'Cancelada' && (
                        <div className={`text-xs ${cuota.dias_para_vencer < 0 ? 'text-danger' : cuota.dias_para_vencer <= 7 ? 'text-warning' : 'text-muted'}`}>
                          {cuota.dias_para_vencer < 0
                            ? `Vencida hace ${Math.abs(cuota.dias_para_vencer)}d`
                            : `Vence en ${cuota.dias_para_vencer}d`}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        cuota.estado === 'Pagada' ? 'badge-success' :
                        cuota.estado === 'Cancelada' ? 'badge-danger' :
                        cuota.nivel_alerta === 'danger' ? 'badge-danger' :
                        cuota.nivel_alerta === 'warning' ? 'badge-warning' :
                        'badge-info'
                      }`}>
                        {cuota.estado}
                      </span>
                    </td>
                    <td className="text-right font-medium">{formatearMoneda(cuota.monto_cuota)}</td>
                    <td className="text-right text-success">{formatearMoneda(cuota.monto_pagado || 0)}</td>
                    <td className="text-right font-bold text-danger">
                      {formatearMoneda(parseFloat(cuota.monto_cuota) - parseFloat(cuota.monto_pagado || 0))}
                    </td>
                    <td className="text-center">
                      {cuota.estado !== 'Pagada' && cuota.estado !== 'Cancelada' && !estaCancelada && (
                        <button
                          className="btn btn-xs btn-primary"
                          onClick={() => handleAbrirPagarCuota(cuota)}
                        >
                          Pagar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="3" className="text-right font-bold">Totales:</td>
                  <td className="text-right font-bold">{formatearMoneda(compra.total)}</td>
                  <td className="text-right font-bold text-success">{formatearMoneda(compra.monto_pagado)}</td>
                  <td className="text-right font-bold text-danger">{formatearMoneda(compra.saldo_pendiente)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="p-8 text-center text-muted">
              <CreditCard size={48} className="mx-auto mb-3 opacity-20"/>
              <p>No hay cronograma definido aún.</p>
              {!estaCancelada && (
                <button className="btn btn-sm btn-outline mt-3" onClick={handleAbrirCronograma}>
                  Crear Cronograma
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )}

    {esLetras && (
      <div className="card">
        <div className="card-header bg-gray-50 flex justify-between items-center">
          <h3 className="card-title flex gap-2">
            <Receipt size={18}/> Letras de Cambio
          </h3>
          {!tieneLetrasRegistradas && !estaCancelada && (
            <button className="btn btn-sm btn-primary" onClick={handleAbrirRegistrarLetras}>
              <Plus size={16}/> Registrar Letras
            </button>
          )}
        </div>
        <div className="card-body p-0">
          {letras.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Número Letra</th>
                  <th>Banco</th>
                  <th>Emisión</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th className="text-right">Monto</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {letras.map((letra) => (
                  <tr
                    key={letra.id_letra}
                    className={
                      letra.nivel_alerta === 'danger' ? 'bg-red-50' :
                      letra.nivel_alerta === 'warning' ? 'bg-yellow-50' : ''
                    }
                  >
                    <td>
                      <div className="font-medium">{letra.numero_letra}</div>
                      {letra.dias_para_vencer !== undefined && letra.dias_para_vencer < 7 && letra.estado === 'Pendiente' && (
                        <div className={`text-xs ${letra.dias_para_vencer < 0 ? 'text-danger' : 'text-warning'}`}>
                          {letra.dias_para_vencer < 0
                            ? `Vencida hace ${Math.abs(letra.dias_para_vencer)} días`
                            : `Vence en ${letra.dias_para_vencer} días`}
                        </div>
                      )}
                    </td>
                    <td className="text-sm">{letra.banco || '-'}</td>
                    <td>{formatearFecha(letra.fecha_emision)}</td>
                    <td>{formatearFecha(letra.fecha_vencimiento)}</td>
                    <td>
                      <span className={`badge ${
                        letra.estado === 'Pagada' ? 'badge-success' :
                        letra.estado === 'Vencida' ? 'badge-danger' :
                        'badge-warning'
                      }`}>
                        {letra.estado}
                      </span>
                    </td>
                    <td className="text-right font-bold">{formatearMoneda(letra.monto)}</td>
                    <td className="text-center">
                      {letra.estado === 'Pendiente' && (
                        <button className="btn btn-xs btn-primary" onClick={() => handleAbrirPagarLetra(letra)}>
                          Pagar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-muted">
              <Receipt size={48} className="mx-auto mb-3 opacity-20"/>
              <p>No hay letras registradas</p>
              {!tieneLetrasRegistradas && !estaCancelada && (
                <button className="btn btn-sm btn-primary mt-3" onClick={handleAbrirRegistrarLetras}>
                  Registrar Letras
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )}
  </div>
)}
  
      {tabActiva === 'ingresos' && (
        <div className="space-y-6">
          {itemsPendientes.length > 0 ? (
            <div className="card border-l-4 border-warning">
              <div className="card-body">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-warning flex items-center gap-2">
                      <AlertCircle size={18} /> Items Pendientes de Ingreso
                    </h3>
                    <p className="text-sm text-muted mt-1">
                      Hay {itemsPendientes.length} producto(s) pendiente(s) de ingresar al inventario
                    </p>
                  </div>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleAbrirIngresoInventario}
                  >
                    <PackagePlus size={18} /> Registrar Ingreso
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card border-l-4 border-success">
              <div className="card-body">
                <div className="flex items-center gap-2 text-success">
                  <PackageCheck size={24}/>
                  <div>
                    <h3 className="font-bold">Entrega Completada</h3>
                    <p className="text-sm text-muted">
                      Todos los productos de esta compra han ingresado al inventario.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header bg-gray-50">
              <h3 className="card-title flex gap-2">
                <Truck size={18}/> Historial de Ingresos
              </h3>
            </div>
            <div className="card-body p-0">
              {ingresos.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>ID Entrada</th>
                      <th className="text-right">Items Ingresados</th>
                      <th className="text-right">Total</th>
                      <th>Estado</th>
                      <th>Registrado Por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingresos.map((ingreso) => (
                      <tr key={ingreso.id_entrada}>
                        <td>{formatearFecha(ingreso.fecha_movimiento)}</td>
                        <td className="font-mono">{ingreso.id_entrada}</td>
                        <td className="text-right">
                          {parseFloat(ingreso.cantidad_items_ingresada).toFixed(2)}
                        </td>
                        <td className="text-right font-bold">
                          {formatearMoneda(ingreso.total)}
                        </td>
                        <td>
                          <span className={`badge ${
                            ingreso.estado_ingreso === 'Completo' ? 'badge-success' : 'badge-info'
                          }`}>
                            {ingreso.estado_ingreso}
                          </span>
                        </td>
                        <td className="text-sm">{ingreso.registrado_por || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-muted">
                  <Truck size={48} className="mx-auto mb-3 opacity-20" />
                  <p>No hay ingresos registrados</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal 
        isOpen={modalPagarCuotaOpen} 
        onClose={() => setModalPagarCuotaOpen(false)} 
        title="Pagar Cuota"
      >
        <form onSubmit={handlePagarCuota} className="space-y-4">
          {cuotaSeleccionada && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
              <p className="font-medium">Cuota #{cuotaSeleccionada.numero_cuota}</p>
              <p className="text-muted">Vencimiento: {formatearFecha(cuotaSeleccionada.fecha_vencimiento)}</p>
              <p className="text-muted">Monto: {formatearMoneda(cuotaSeleccionada.monto_cuota)}</p>
              {cuotaSeleccionada.monto_pagado > 0 && (
                <p className="text-success text-xs mt-1">
                  Pagado: {formatearMoneda(cuotaSeleccionada.monto_pagado)}
                </p>
              )}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Cuenta Origen</label>
            <select 
              className="form-select" 
              value={datosPago.id_cuenta_pago} 
              onChange={e => setDatosPago({...datosPago, id_cuenta_pago: e.target.value})} 
              required
            >
              <option value="">Seleccione...</option>
              {cuentasPago.filter(c => c.estado === 'Activo').map(c => (
                <option key={c.id_cuenta} value={c.id_cuenta}>
                  {c.nombre} - {c.tipo} (PEN: S/ {parseFloat(c.saldo_pen || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})} | USD: $ {parseFloat(c.saldo_usd || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Monto a Pagar</label>
            <input 
              type="number" 
              className="form-input" 
              value={datosPago.monto_pagado} 
              onChange={e => setDatosPago({...datosPago, monto_pagado: e.target.value})} 
              step="0.01" 
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Referencia / Número de Operación</label>
            <input 
              type="text" 
              className="form-input" 
              value={datosPago.referencia} 
              onChange={e => setDatosPago({...datosPago, referencia: e.target.value})} 
              placeholder="Opcional"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea 
              className="form-textarea" 
              rows="2"
              value={datosPago.observaciones} 
              onChange={e => setDatosPago({...datosPago, observaciones: e.target.value})}
              placeholder="Opcional"
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary w-full" 
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Confirmar Pago'}
          </button>
        </form>
      </Modal>
      <Modal 
        isOpen={modalPagoDirectoOpen} 
        onClose={() => setModalPagoDirectoOpen(false)} 
        title={esContadoSinPago ? "Regularizar Pago" : "Registrar Pago"}
      >
        <form onSubmit={handlePagoDirecto} className="space-y-4">
          {esContadoSinPago && (
            <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm text-orange-800">
              <p className="font-medium mb-1">Regularización de Pago al Contado</p>
              <p>
                Esta compra fue registrada sin desembolso. Al confirmar, se registrará el egreso en la cuenta seleccionada.
              </p>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Cuenta Origen</label>
            <select 
              className="form-select" 
              value={datosPago.id_cuenta_pago} 
              onChange={e => setDatosPago({...datosPago, id_cuenta_pago: e.target.value})} 
              required
            >
              <option value="">Seleccione...</option>
              {cuentasPago.filter(c => c.estado === 'Activo').map(c => (
                <option key={c.id_cuenta} value={c.id_cuenta}>
                  {c.nombre} - {c.tipo} (PEN: S/ {parseFloat(c.saldo_pen || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})} | USD: $ {parseFloat(c.saldo_usd || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Monto a Pagar</label>
            <input 
              type="number" 
              className="form-input" 
              value={datosPago.monto_pagado} 
              onChange={e => setDatosPago({...datosPago, monto_pagado: e.target.value})} 
              step="0.01" 
              max={compra.saldo_pendiente} 
              required 
            />
            <p className="text-xs text-muted mt-1">
              Saldo pendiente: {formatearMoneda(compra.saldo_pendiente)}
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">Referencia / Número de Operación</label>
            <input 
              type="text" 
              className="form-input" 
              value={datosPago.referencia} 
              onChange={e => setDatosPago({...datosPago, referencia: e.target.value})} 
              placeholder="Opcional"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea 
              className="form-textarea" 
              rows="2"
              value={datosPago.observaciones} 
              onChange={e => setDatosPago({...datosPago, observaciones: e.target.value})}
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary w-full" 
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Registrar Pago'}
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={modalReembolsoOpen} 
        onClose={() => setModalReembolsoOpen(false)} 
        title="Reembolsar a Comprador"
      >
        <form onSubmit={handleRegistrarReembolso} className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded p-3 text-sm text-purple-800">
            <p className="font-medium">Comprador: {compra.comprador || 'No especificado'}</p>
            <p className="mt-1">
              Monto pendiente de reembolso: <span className="font-bold">{formatearMoneda(saldoReembolso)}</span>
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">Cuenta INDPACK (Origen)</label>
            <select 
              className="form-select" 
              value={datosReembolso.id_cuenta_pago} 
              onChange={e => setDatosReembolso({...datosReembolso, id_cuenta_pago: e.target.value})} 
              required
            >
              <option value="">Seleccione cuenta de empresa...</option>
              {cuentasPago.filter(c => c.estado === 'Activo').map(c => (
                <option key={c.id_cuenta} value={c.id_cuenta}>
                  {c.nombre} - {c.tipo} (PEN: S/ {parseFloat(c.saldo_pen || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})} | USD: $ {parseFloat(c.saldo_usd || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Monto a Reembolsar</label>
            <input 
              type="number" 
              className="form-input" 
              value={datosReembolso.monto_reembolso} 
              onChange={e => setDatosReembolso({...datosReembolso, monto_reembolso: e.target.value})} 
              step="0.01" 
              max={saldoReembolso} 
              required 
            />
            <p className="text-xs text-muted mt-1">
              Máximo: {formatearMoneda(saldoReembolso)}
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">Referencia / Número de Operación</label>
            <input 
              type="text" 
              className="form-input" 
              value={datosReembolso.referencia} 
              onChange={e => setDatosReembolso({...datosReembolso, referencia: e.target.value})} 
              placeholder="Nro. operación, etc."
            />
          </div>
          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea 
              className="form-textarea" 
              rows="2" 
              value={datosReembolso.observaciones} 
              onChange={e => setDatosReembolso({...datosReembolso, observaciones: e.target.value})} 
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-purple text-white w-full" 
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Registrar Reembolso'}
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={modalCronogramaOpen} 
        onClose={() => setModalCronogramaOpen(false)} 
        title="Definir Letras / Cuotas" 
        size="lg"
      >
        <form onSubmit={handleGuardarCronograma}>
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            <p className="font-medium">
              {esLetras ? 'Definición de Letras' : 'Definición de Cuotas'}
            </p>
            <p className="text-xs mt-1">
              Establece las fechas y montos. La suma debe coincidir con el saldo pendiente.
            </p>
          </div>
          <div className="space-y-2 mb-4 max-h-[60vh] overflow-y-auto">
            {cronogramaForm.map((c, i) => (
              <div key={i} className="flex gap-2 items-center p-2 bg-gray-50 rounded">
                <span className="w-8 font-bold text-center text-sm">#{c.numero}</span>
                <input 
                  type="date" 
                  className="form-input form-input-sm w-36" 
                  value={c.fecha_vencimiento} 
                  onChange={e => { 
                    const newCrono = [...cronogramaForm]; 
                    newCrono[i].fecha_vencimiento = e.target.value; 
                    setCronogramaForm(newCrono); 
                  }} 
                  required 
                />
                <input 
                  type="number" 
                  className="form-input form-input-sm flex-1" 
                  placeholder="Monto" 
                  value={c.monto} 
                  onChange={e => { 
                    const newCrono = [...cronogramaForm]; 
                    newCrono[i].monto = e.target.value; 
                    setCronogramaForm(newCrono); 
                  }} 
                  step="0.01" 
                  required 
                />
                {esLetras && (
                  <input 
                    type="text" 
                    className="form-input form-input-sm w-32" 
                    placeholder="Cód. Letra" 
                    value={c.codigo_letra} 
                    onChange={e => { 
                      const newCrono = [...cronogramaForm]; 
                      newCrono[i].codigo_letra = e.target.value; 
                      setCronogramaForm(newCrono); 
                    }} 
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm">
              <p>
                Total: <b>{formatearMoneda(cronogramaForm.reduce((acc, c) => acc + parseFloat(c.monto||0), 0))}</b>
              </p>
              <p className="text-muted text-xs mt-1">
                Debe ser: {formatearMoneda(compra.saldo_pendiente)}
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setModalCronogramaOpen(false)}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Guardar Cronograma'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={modalRegistrarLetrasOpen} 
        onClose={() => setModalRegistrarLetrasOpen(false)} 
        title="Registrar Letras de Cambio" 
        size="lg"
      >
        <form onSubmit={handleGuardarLetras}>
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded text-sm text-purple-800">
            <p className="font-medium">Registro de Letras Físicas</p>
            <p className="text-xs mt-1">
              Registra los detalles de cada letra emitida. La suma debe coincidir con el saldo pendiente.
            </p>
          </div>
          <div className="space-y-3 mb-4 max-h-[60vh] overflow-y-auto">
            {letrasForm.map((letra, i) => (
              <div key={i} className="border rounded p-3 bg-gray-50">
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label text-xs">Número Letra</label>
                    <input 
                      type="text" 
                      className="form-input form-input-sm" 
                      value={letra.numero_letra} 
                      onChange={e => { 
                        const nuevasLetras = [...letrasForm]; 
                        nuevasLetras[i].numero_letra = e.target.value; 
                        setLetrasForm(nuevasLetras); 
                      }} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label text-xs">Monto</label>
                    <input 
                      type="number" 
                      className="form-input form-input-sm" 
                      value={letra.monto} 
                      onChange={e => { 
                        const nuevasLetras = [...letrasForm]; 
                        nuevasLetras[i].monto = e.target.value; 
                        setLetrasForm(nuevasLetras); 
                      }} 
                      step="0.01" 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label text-xs">Fecha Emisión</label>
                    <input 
                      type="date" 
                      className="form-input form-input-sm" 
                      value={letra.fecha_emision} 
                      onChange={e => { 
                        const nuevasLetras = [...letrasForm]; 
                        nuevasLetras[i].fecha_emision = e.target.value; 
                        setLetrasForm(nuevasLetras); 
                      }} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label text-xs">Fecha Vencimiento</label>
                    <input 
                      type="date" 
                      className="form-input form-input-sm" 
                      value={letra.fecha_vencimiento} 
                      onChange={e => { 
                        const nuevasLetras = [...letrasForm]; 
                        nuevasLetras[i].fecha_vencimiento = e.target.value; 
                        setLetrasForm(nuevasLetras); 
                      }} 
                      required 
                    />
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-label text-xs">Banco</label>
                    <input 
                      type="text" 
                      className="form-input form-input-sm" 
                      value={letra.banco} 
                      onChange={e => { 
                        const nuevasLetras = [...letrasForm]; 
                        nuevasLetras[i].banco = e.target.value; 
                        setLetrasForm(nuevasLetras); 
                      }} 
                      placeholder="Opcional" 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm">
              <p>
                Total: <b>{formatearMoneda(letrasForm.reduce((acc, l) => acc + parseFloat(l.monto||0), 0))}</b>
              </p>
              <p className="text-muted text-xs mt-1">
                Debe ser: {formatearMoneda(compra.saldo_pendiente)}
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => { 
                  setLetrasForm([
                    ...letrasForm, 
                    { 
                      numero_letra: `L-${compra.numero_orden}-${String(letrasForm.length + 1).padStart(2, '0')}`, 
                      monto: '0.00', 
                      fecha_emision: new Date().toISOString().split('T')[0], 
                      fecha_vencimiento: new Date().toISOString().split('T')[0], 
                      banco: '', 
                      observaciones: '' 
                    }
                  ]); 
                }}
              >
                <Plus size={16} /> Agregar Letra
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Guardar Letras'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={modalPagarLetraOpen} 
        onClose={() => setModalPagarLetraOpen(false)} 
        title="Pagar Letra"
      >
        <form onSubmit={handlePagarLetra} className="space-y-4">
          {letraSeleccionada && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
              <p className="font-medium">Letra: {letraSeleccionada.numero_letra}</p>
              <p className="text-muted">Vencimiento: {formatearFecha(letraSeleccionada.fecha_vencimiento)}</p>
              <p className="text-muted">Monto: {formatearMoneda(letraSeleccionada.monto)}</p>
              {letraSeleccionada.banco && (
                <p className="text-muted">Banco: {letraSeleccionada.banco}</p>
              )}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Cuenta Origen</label>
            <select 
              className="form-select" 
              value={datosLetra.id_cuenta_pago} 
              onChange={e => setDatosLetra({...datosLetra, id_cuenta_pago: e.target.value})} 
              required
            >
              <option value="">Seleccione...</option>
              {cuentasPago.filter(c => c.estado === 'Activo').map(c => (
                <option key={c.id_cuenta} value={c.id_cuenta}>
                  {c.nombre} - {c.tipo} (PEN: S/ {parseFloat(c.saldo_pen || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})} | USD: $ {parseFloat(c.saldo_usd || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Monto a Pagar</label>
            <input 
              type="number" 
              className="form-input" 
              value={datosLetra.monto_pagado} 
              onChange={e => setDatosLetra({...datosLetra, monto_pagado: e.target.value})} 
              step="0.01" 
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Método de Pago</label>
            <select 
              className="form-select" 
              value={datosLetra.metodo_pago} 
              onChange={e => setDatosLetra({...datosLetra, metodo_pago: e.target.value})}
            >
              <option value="Transferencia">Transferencia</option>
              <option value="Cheque">Cheque</option>
              <option value="Efectivo">Efectivo</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Número de Operación</label>
            <input 
              type="text" 
              className="form-input" 
              value={datosLetra.numero_operacion} 
              onChange={e => setDatosLetra({...datosLetra, numero_operacion: e.target.value})} 
              placeholder="Opcional"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea 
              className="form-textarea" 
              rows="2"
              value={datosLetra.observaciones} 
              onChange={e => setDatosLetra({...datosLetra, observaciones: e.target.value})}
              placeholder="Opcional"
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary w-full" 
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Confirmar Pago'}
          </button>
        </form>
      </Modal>
      <Modal 
        isOpen={modalIngresoInventarioOpen} 
        onClose={() => setModalIngresoInventarioOpen(false)} 
        title="Registrar Ingreso a Inventario" 
        size="lg"
      >
        <form onSubmit={handleRegistrarIngreso}>
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            <p className="font-medium">Ingreso Parcial de Productos</p>
            <p className="text-xs mt-1">
              Indica la cantidad que vas a ingresar de cada producto. Solo se ingresarán los que tengan cantidad mayor a 0.
            </p>
          </div>
          <div className="space-y-3 mb-4 max-h-[60vh] overflow-y-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-right">Pendiente</th>
                  <th className="text-right w-32">Ingresar</th>
                </tr>
              </thead>
              <tbody>
                {ingresoForm.productos.map((prod) => (
                  <tr key={prod.id_producto}>
                    <td>
                      <div className="font-medium">{prod.nombre}</div>
                      <div className="text-xs text-muted">{prod.codigo}</div>
                    </td>
                    <td className="text-right text-warning font-medium">
                      {prod.cantidad_pendiente.toFixed(2)}
                    </td>
                    <td>
                      <input 
                        type="number" 
                        className="form-input form-input-sm text-right" 
                        value={prod.cantidad_ingresar} 
                        onChange={e => handleActualizarCantidadIngreso(prod.id_producto, e.target.value)} 
                        min="0" 
                        max={prod.cantidad_pendiente} 
                        step="0.01" 
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea 
              className="form-textarea" 
              rows="2" 
              value={ingresoForm.observaciones} 
              onChange={e => setIngresoForm({...ingresoForm, observaciones: e.target.value})} 
              placeholder="Notas sobre el ingreso..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={() => setModalIngresoInventarioOpen(false)}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
            >
              <PackagePlus size={18} /> 
              {loading ? 'Registrando...' : 'Registrar Ingreso'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={modalCancelarOpen} 
        onClose={() => setModalCancelarOpen(false)} 
        title="Cancelar Compra y Anular Movimientos"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-500 shrink-0" size={24} />
              <div className="text-sm text-red-700">
                <p className="font-bold mb-2">Advertencia: Esta acción es irreversible</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Se revertirá el stock de los productos ingresados.</li>
                  <li>Se registrarán movimientos de reversión (ingresos) en las cuentas de origen.</li>
                  <li>Se cancelarán todas las cuotas y letras pendientes.</li>
                  <li>La compra quedará marcada como "Cancelada" permanentemente.</li>
                </ul>
              </div>
            </div>
          </div>
          
          {compra.monto_pagado > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
              <p className="font-medium">Pagos a Revertir:</p>
              <p className="mt-1">
                Se registrarán ingresos de reversión por <span className="font-bold">{formatearMoneda(compra.monto_pagado)}</span> en las cuentas de origen.
              </p>
            </div>
          )}
          
          <div className="form-group">
            <label className="form-label">Motivo de la cancelación / anulación *</label>
            <textarea 
              className="form-textarea" 
              placeholder="Indique la razón detallada de la cancelación..." 
              value={motivoCancelacion} 
              onChange={e => setMotivoCancelacion(e.target.value)} 
              required 
              rows="3"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <button 
              className="btn btn-outline" 
              onClick={() => setModalCancelarOpen(false)}
            >
              Volver
            </button>
            <button 
              className="btn btn-danger" 
              onClick={handleCancelarCompra}
              disabled={loading || !motivoCancelacion.trim()}
            >
              {loading ? 'Procesando...' : 'Confirmar Anulación'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={modalCambiarCuentaOpen} 
        onClose={() => setModalCambiarCuentaOpen(false)} 
        title="Cambiar Cuenta de Pago (Migración)"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-blue-800 mb-2">
              <span className="font-medium">¿Qué hace esta acción?</span>
            </p>
            <p className="text-sm text-blue-700">
              Esta operación transferirá todos los pagos y la deuda de esta compra a una nueva cuenta. 
              Se crearán movimientos de reversión en la cuenta actual y nuevos egresos en la cuenta destino.
            </p>
          </div>
          
          {compra.id_cuenta_pago && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <p className="text-xs font-bold text-muted uppercase mb-1">Cuenta Actual</p>
              <p className="font-medium">{compra.cuenta_pago}</p>
              <p className="text-sm text-muted">{compra.tipo_cuenta_pago}</p>
            </div>
          )}
          
          <div className="form-group">
            <label className="form-label">Seleccionar Nueva Cuenta</label>
            <select 
              className="form-select" 
              value={nuevaCuentaId} 
              onChange={e => setNuevaCuentaId(e.target.value)} 
              required
            >
              <option value="">Seleccione...</option>
              {cuentasPago.filter(c => c.estado === 'Activo').map(c => (
                <option key={c.id_cuenta} value={c.id_cuenta}>
                  {c.nombre} - {c.tipo} (PEN: S/ {parseFloat(c.saldo_pen || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})} | USD: $ {parseFloat(c.saldo_usd || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted mt-1">
              Se mostrarán cuentas de todas las monedas disponibles
            </p>
          </div>
          
          {compra.monto_pagado > 0 && nuevaCuentaId && parseInt(nuevaCuentaId) !== parseInt(compra.id_cuenta_pago) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
              <p className="font-medium mb-1">Movimientos a Realizar:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Cuenta actual: Ingreso de reversión {formatearMoneda(compra.monto_pagado)}</li>
                <li>Cuenta nueva: Egreso {formatearMoneda(compra.monto_pagado)}</li>
              </ul>
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-2">
            <button 
              className="btn btn-outline" 
              onClick={() => setModalCambiarCuentaOpen(false)}
            >
              Cancelar
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleCambiarCuenta} 
              disabled={loading || !nuevaCuentaId || parseInt(nuevaCuentaId) === parseInt(compra.id_cuenta_pago)}
            >
              {loading ? 'Procesando...' : 'Confirmar Cambio'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DetalleCompra;