import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Download, Package, Truck, CheckCircle,
  XCircle, Clock, FileText, Building, DollarSign, MapPin,
  AlertCircle, TrendingUp, Calendar, Plus, ShoppingCart, Calculator,
  CreditCard, Trash2
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import { ordenesVentaAPI } from '../../config/api';

function DetalleOrdenVenta() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [orden, setOrden] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [resumenPagos, setResumenPagos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [modalEstadoOpen, setModalEstadoOpen] = useState(false);
  const [modalPrioridadOpen, setModalPrioridadOpen] = useState(false);
  const [modalProgresoOpen, setModalProgresoOpen] = useState(false);
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  
  const [progreso, setProgreso] = useState([]);
  const [pagoForm, setPagoForm] = useState({
    fecha_pago: new Date().toISOString().split('T')[0],
    monto_pagado: '',
    metodo_pago: 'Transferencia',
    numero_operacion: '',
    banco: '',
    observaciones: ''
  });

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
        const data = ordenRes.data.data;
        setOrden(data);
        setProgreso(data.detalle.map(d => ({
          id_detalle: d.id_detalle,
          cantidad_producida: d.cantidad_producida || 0,
          cantidad_despachada: d.cantidad_despachada || 0
        })));
      }
      
      if (pagosRes.data.success) {
        setPagos(pagosRes.data.data);
      }
      
      if (resumenRes.data.success) {
        setResumenPagos(resumenRes.data.data);
      }
      
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrarPago = async (e) => {
    e.preventDefault();
    
    if (!pagoForm.monto_pagado || parseFloat(pagoForm.monto_pagado) <= 0) {
      setError('Ingrese un monto válido');
      return;
    }
    
    try {
      setError(null);
      setLoading(true);
      
      const response = await ordenesVentaAPI.registrarPago(id, {
        ...pagoForm,
        monto_pagado: parseFloat(pagoForm.monto_pagado)
      });
      
      if (response.data.success) {
        setSuccess(`Pago registrado: ${response.data.data.numero_pago}`);
        setModalPagoOpen(false);
        setPagoForm({
          fecha_pago: new Date().toISOString().split('T')[0],
          monto_pagado: '',
          metodo_pago: 'Transferencia',
          numero_operacion: '',
          banco: '',
          observaciones: ''
        });
        await cargarDatos();
      }
      
    } catch (err) {
      console.error('Error al registrar pago:', err);
      setError(err.response?.data?.error || 'Error al registrar pago');
    } finally {
      setLoading(false);
    }
  };

  const handleAnularPago = async (idPago, numeroPago) => {
    if (!confirm(`¿Está seguro de anular el pago ${numeroPago}?`)) return;
    
    try {
      setError(null);
      setLoading(true);
      
      const response = await ordenesVentaAPI.anularPago(id, idPago);
      
      if (response.data.success) {
        setSuccess('Pago anulado exitosamente');
        await cargarDatos();
      }
      
    } catch (err) {
      console.error('Error al anular pago:', err);
      setError(err.response?.data?.error || 'Error al anular pago');
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstado = async (estado) => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await ordenesVentaAPI.actualizarEstado(
        id, 
        estado,
        estado === 'Entregada' ? new Date().toISOString().split('T')[0] : null
      );
      
      if (response.data.success) {
        setOrden({ ...orden, estado });
        setSuccess(`Estado actualizado a ${estado}`);
        setModalEstadoOpen(false);
        await cargarDatos();
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
      
      const response = await ordenesVentaAPI.actualizarPrioridad(id, prioridad);
      
      if (response.data.success) {
        setOrden({ ...orden, prioridad });
        setSuccess(`Prioridad actualizada a ${prioridad}`);
        setModalPrioridadOpen(false);
      }
      
    } catch (err) {
      console.error('Error al cambiar prioridad:', err);
      setError(err.response?.data?.error || 'Error al cambiar prioridad');
    } finally {
      setLoading(false);
    }
  };

  const handleActualizarProgreso = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await ordenesVentaAPI.actualizarProgreso(id, {
        detalle: progreso
      });
      
      if (response.data.success) {
        const nuevoDetalle = orden.detalle.map(item => {
          const prog = progreso.find(p => p.id_detalle === item.id_detalle);
          return {
            ...item,
            cantidad_producida: prog?.cantidad_producida || item.cantidad_producida,
            cantidad_despachada: prog?.cantidad_despachada || item.cantidad_despachada
          };
        });
        
        setOrden({ ...orden, detalle: nuevoDetalle });
        setSuccess('Progreso actualizado exitosamente');
        setModalProgresoOpen(false);
      }
      
    } catch (err) {
      console.error('Error al actualizar progreso:', err);
      setError(err.response?.data?.error || 'Error al actualizar progreso');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarGuia = () => {
    navigate(`/ventas/guias-remision/nueva?orden=${id}`);
  };

  const handleDescargarPDF = async () => {
    try {
      setLoading(true);
      await ordenesVentaAPI.descargarPDF(id);
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
    return new Date(fecha).toLocaleDateString('es-PE');
  };

  const formatearMoneda = (valor) => {
    if (!orden) return '-';
    const simbolo = orden.moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toFixed(2)}`;
  };

  const getEstadoConfig = (estado) => {
    const configs = {
      'Pendiente': { 
        icono: Clock, 
        clase: 'badge-warning',
        color: 'border-warning',
        siguientes: ['Confirmada', 'Cancelada'] 
      },
      'Confirmada': { 
        icono: CheckCircle,
        clase: 'badge-info',
        color: 'border-info',
        siguientes: ['En Preparación', 'Cancelada']
      },
      'En Preparación': {  
        icono: Package, 
        clase: 'badge-info',
        color: 'border-info',
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
    return configs[estado] || configs['Pendiente'];
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

  const calcularProgresoPorcentaje = (item) => {
    if (!item.requiere_produccion) {
      return (parseFloat(item.cantidad_despachada || 0) / parseFloat(item.cantidad)) * 100;
    }
    return (parseFloat(item.cantidad_producida || 0) / parseFloat(item.cantidad)) * 100;
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
          {row.requiere_produccion && (
            <span className="badge badge-warning badge-sm">
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
      header: 'Precio Unit.',
      accessor: 'precio_unitario',
      width: '120px',
      align: 'right',
      render: (value) => formatearMoneda(value)
    },
    {
      header: 'Progreso',
      accessor: 'cantidad_producida',
      width: '150px',
      render: (value, row) => {
        const porcentaje = calcularProgresoPorcentaje(row);
        return (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>
                {row.requiere_produccion ? 'Producido' : 'Despachado'}: 
                {' '}{parseFloat(row.requiere_produccion ? row.cantidad_producida : row.cantidad_despachada).toFixed(2)}
              </span>
              <span className="font-bold">{porcentaje.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${porcentaje >= 100 ? 'bg-success' : 'bg-primary'}`}
                style={{ width: `${Math.min(porcentaje, 100)}%` }}
              ></div>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Valor Venta',
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
  
  const progresoGeneral = orden.detalle.reduce((sum, item) => 
    sum + calcularProgresoPorcentaje(item), 0
  ) / orden.detalle.length;

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
            <p className="text-muted">
              Emitida el {formatearFecha(orden.fecha_emision)}
              {orden.numero_cotizacion && <span> • Desde {orden.numero_cotizacion}</span>}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleDescargarPDF}>
            <Download size={20} /> PDF
          </button>
          
          {orden.estado !== 'Cancelada' && orden.estado !== 'Entregada' && (
            <>
              <button className="btn btn-outline" onClick={() => setModalEstadoOpen(true)}>
                <Edit size={20} /> Estado
              </button>
              <button className="btn btn-outline" onClick={() => setModalPrioridadOpen(true)}>
                <TrendingUp size={20} /> Prioridad
              </button>
              <button className="btn btn-info" onClick={() => setModalProgresoOpen(true)}>
                <Package size={20} /> Progreso
              </button>
              {(orden.estado === 'En Preparación' || orden.estado === 'Despachada') && (
                <button className="btn btn-primary" onClick={handleGenerarGuia}>
                  <Plus size={20} /> Guía de Remisión
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className={`card border-l-4 ${estadoConfig.color}`}>
          <div className="card-body">
            <div className="flex items-center gap-3">
              <IconoEstado size={32} />
              <div>
                <p className="text-sm text-muted">Estado</p>
                <h3 className="text-xl font-bold">{orden.estado}</h3>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{prioridadConfig.icono}</div>
              <div>
                <p className="text-sm text-muted">Prioridad</p>
                <span className={`badge ${prioridadConfig.clase}`}>{orden.prioridad}</span>
              </div>
            </div>
          </div>
        </div>

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
            <p className="text-sm text-muted mb-2">Progreso General</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full ${progresoGeneral >= 100 ? 'bg-success' : 'bg-primary'}`}
                  style={{ width: `${Math.min(progresoGeneral, 100)}%` }}
                ></div>
              </div>
              <span className="font-bold text-lg">{progresoGeneral.toFixed(0)}%</span>
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
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><DollarSign size={20} /> Comercial</h2>
          </div>
          <div className="card-body space-y-2">
            <div>
              <label className="text-sm font-medium text-muted">Moneda:</label>
              <p>{orden.moneda === 'USD' ? 'Dólares' : 'Soles'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted">Plazo:</label>
              <p>{orden.plazo_pago || '-'}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><MapPin size={20} /> Entrega</h2>
          </div>
          <div className="card-body">
            <label className="text-sm font-medium text-muted">Dirección:</label>
            <p className="text-sm">{orden.direccion_entrega}</p>
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
            <div className="card-body"><p>{orden.observaciones}</p></div>
          </div>
        )}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Calculator size={20} /> Totales</h3>
          </div>
          <div className="card-body space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span>Sub Total:</span>
              <span className="font-bold">{formatearMoneda(orden.subtotal)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span>IGV (18%):</span>
              <span className="font-bold">{formatearMoneda(orden.igv)}</span>
            </div>
            <div className="flex justify-between py-3 bg-primary text-white px-4 rounded-lg">
              <span className="font-bold">TOTAL:</span>
              <span className="font-bold text-xl">{formatearMoneda(orden.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={modalEstadoOpen} onClose={() => setModalEstadoOpen(false)} title="Cambiar Estado">
        <div className="space-y-4">
          <p className="text-muted">Estado actual: <strong>{orden.estado}</strong></p>
          <div className="space-y-2">
            {estadoConfig.siguientes.map(estado => {
              const config = getEstadoConfig(estado);
              const Icono = config.icono;
              return (
                <button 
                  key={estado} 
                  className="btn btn-outline w-full justify-start" 
                  onClick={() => handleCambiarEstado(estado)}
                >
                  <Icono size={20} /> {estado}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      <Modal isOpen={modalPrioridadOpen} onClose={() => setModalPrioridadOpen(false)} title="Cambiar Prioridad">
        <div className="space-y-2">
          {['Baja', 'Media', 'Alta', 'Urgente'].map(prioridad => (
            <button 
              key={prioridad} 
              className="btn btn-outline w-full justify-start" 
              onClick={() => handleCambiarPrioridad(prioridad)} 
              disabled={orden.prioridad === prioridad}
            >
              <span className="text-2xl mr-2">{getPrioridadConfig(prioridad).icono}</span>
              {prioridad}
            </button>
          ))}
        </div>
      </Modal>

      <Modal isOpen={modalProgresoOpen} onClose={() => setModalProgresoOpen(false)} title="Actualizar Progreso" size="lg">
        <div className="space-y-4">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Total</th>
                <th>Producida</th>
                <th>Despachada</th>
              </tr>
            </thead>
            <tbody>
              {orden.detalle.map((item) => {
                const prog = progreso.find(p => p.id_detalle === item.id_detalle);
                return (
                  <tr key={item.id_detalle}>
                    <td>{item.producto}</td>
                    <td>{parseFloat(item.cantidad).toFixed(2)}</td>
                    <td>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={prog?.cantidad_producida || 0}
                        onChange={(e) => {
                          const newProgreso = [...progreso];
                          const idx = newProgreso.findIndex(p => p.id_detalle === item.id_detalle);
                          if (idx >= 0) newProgreso[idx].cantidad_producida = parseFloat(e.target.value) || 0;
                          setProgreso(newProgreso);
                        }}
                        disabled={!item.requiere_produccion}
                        step="0.01"
                        min="0"
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={prog?.cantidad_despachada || 0}
                        onChange={(e) => {
                          const newProgreso = [...progreso];
                          const idx = newProgreso.findIndex(p => p.id_detalle === item.id_detalle);
                          if (idx >= 0) newProgreso[idx].cantidad_despachada = parseFloat(e.target.value) || 0;
                          setProgreso(newProgreso);
                        }}
                        step="0.01"
                        min="0"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-outline" onClick={() => setModalProgresoOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleActualizarProgreso}>
              <CheckCircle size={20} /> Guardar
            </button>
          </div>
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
              <button type="submit" className="btn btn-success">
                <CreditCard size={20} /> Registrar Pago
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default DetalleOrdenVenta;