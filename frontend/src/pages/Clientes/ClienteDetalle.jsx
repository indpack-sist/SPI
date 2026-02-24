import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileText, ShoppingCart, Eye, Download, Building2, 
  DollarSign, CreditCard, AlertTriangle, TrendingUp, Plus, Trash2, MapPin,
  History, User, Clock
} from 'lucide-react';
import { clientesAPI, cotizacionesAPI, ordenesVentaAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';

function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [cliente, setCliente] = useState(null);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [ordenesVenta, setOrdenesVenta] = useState([]);
  const [estadoCredito, setEstadoCredito] = useState(null);
  const [historialCondicion, setHistorialCondicion] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [tabActiva, setTabActiva] = useState('cotizaciones');

  const [modalDireccionOpen, setModalDireccionOpen] = useState(false);
  const [nuevaDireccion, setNuevaDireccion] = useState({ direccion: '', referencia: '', es_principal: false });
  const [procesandoDireccion, setProcesandoDireccion] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [clienteRes, cotizacionesRes, ordenesRes, creditoRes, historialRes] = await Promise.all([
        clientesAPI.getById(id),
        clientesAPI.getHistorialCotizaciones(id),
        clientesAPI.getHistorialOrdenesVenta(id),
        clientesAPI.getEstadoCredito(id),
        clientesAPI.getHistorialCondicion(id)
      ]);
      
      setCliente(clienteRes.data.data);
      setCotizaciones(cotizacionesRes.data.data);
      setOrdenesVenta(ordenesRes.data.data);
      setEstadoCredito(creditoRes.data.data);
      setHistorialCondicion(historialRes.data.data || []);
    } catch (err) {
      setError(err.error || 'Error al cargar datos del cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleAgregarDireccion = async (e) => {
    e.preventDefault();
    if (!nuevaDireccion.direccion.trim()) return;
    try {
      setProcesandoDireccion(true);
      const response = await clientesAPI.addDireccion(id, nuevaDireccion);
      if (response.data.success) {
        setSuccess('Dirección agregada exitosamente');
        setModalDireccionOpen(false);
        setNuevaDireccion({ direccion: '', referencia: '', es_principal: false });
        const clienteRes = await clientesAPI.getById(id);
        setCliente(clienteRes.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al agregar dirección');
    } finally {
      setProcesandoDireccion(false);
    }
  };

  const handleEliminarDireccion = async (idDireccion) => {
    if (!confirm('¿Está seguro de eliminar esta dirección?')) return;
    try {
      const response = await clientesAPI.deleteDireccion(idDireccion);
      if (response.data.success) {
        setSuccess('Dirección eliminada');
        const clienteRes = await clientesAPI.getById(id);
        setCliente(clienteRes.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar dirección');
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE');
  };

  const formatearFechaHora = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatearMoneda = (valor, moneda = 'PEN') => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${parseFloat(valor || 0).toFixed(2)}`;
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      'Pendiente': 'badge-warning',
      'Enviada': 'badge-info',
      'Aprobada': 'badge-success',
      'Rechazada': 'badge-danger',
      'Convertida': 'badge-primary',
      'Vencida': 'badge-secondary',
      'Confirmada': 'badge-success',
      'En Preparación': 'badge-warning',
      'Despachada': 'badge-info',
      'Entregada': 'badge-success',
      'Cancelada': 'badge-danger'
    };
    return badges[estado] || 'badge-secondary';
  };

  const getEstadoPagoBadge = (estadoPago) => {
    const badges = {
      'Pendiente': 'badge-warning',
      'Parcial': 'badge-info',
      'Pagado': 'badge-success'
    };
    return badges[estadoPago] || 'badge-warning';
  };

  const calcularTotalesPorMoneda = (items, campo = 'total') => {
    const totalPEN = items
      .filter(item => item.moneda === 'PEN' && item.estado !== 'Cancelada' && item.estado !== 'Rechazada')
      .reduce((sum, item) => sum + parseFloat(item[campo] || 0), 0);
    const totalUSD = items
      .filter(item => item.moneda === 'USD' && item.estado !== 'Cancelada' && item.estado !== 'Rechazada')
      .reduce((sum, item) => sum + parseFloat(item[campo] || 0), 0);
    return { totalPEN, totalUSD };
  };

  const calcularDeudaReal = (items) => {
    const deudaPEN = items
      .filter(item => item.moneda === 'PEN' && item.estado !== 'Cancelada' && item.estado_pago !== 'Pagado' && (item.tipo_venta === 'Crédito' || item.tipo_venta === 'Credito'))
      .reduce((sum, item) => sum + parseFloat(item.saldo_pendiente || 0), 0);
    const deudaUSD = items
      .filter(item => item.moneda === 'USD' && item.estado !== 'Cancelada' && item.estado_pago !== 'Pagado' && (item.tipo_venta === 'Crédito' || item.tipo_venta === 'Credito'))
      .reduce((sum, item) => sum + parseFloat(item.saldo_pendiente || 0), 0);
    return { totalPEN: deudaPEN, totalUSD: deudaUSD };
  };

  const formatearCondicion = (condicion, dias) => {
    if (condicion === 'Credito') return `Crédito ${dias} días`;
    return 'Contado';
  };

  const columnsCotizaciones = [
    {
      header: 'N° Cotización',
      accessor: 'numero_cotizacion',
      width: '140px',
      render: (value) => <span className="font-mono font-bold">{value}</span>
    },
    {
      header: 'Fecha',
      accessor: 'fecha_emision',
      width: '110px',
      render: (value) => formatearFecha(value)
    },
    {
      header: 'Vencimiento',
      accessor: 'fecha_vencimiento',
      width: '110px',
      render: (value) => formatearFecha(value)
    },
    {
      header: 'Total',
      accessor: 'total',
      width: '120px',
      align: 'right',
      render: (value, row) => <span className="font-bold">{formatearMoneda(value, row.moneda)}</span>
    },
    {
      header: 'Items',
      accessor: 'total_items',
      width: '80px',
      align: 'center'
    },
    {
      header: 'Estado',
      accessor: 'estado',
      width: '120px',
      align: 'center',
      render: (value) => <span className={`badge ${getEstadoBadge(value)}`}>{value}</span>
    },
    {
      header: 'Comercial',
      accessor: 'comercial',
      width: '150px'
    },
    {
      header: 'Acciones',
      accessor: 'id_cotizacion',
      width: '100px',
      align: 'center',
      render: (value) => (
        <div className="flex gap-2 justify-center">
          <button className="btn btn-sm btn-primary" onClick={() => navigate(`/ventas/cotizaciones/${value}`)} title="Ver detalle">
            <Eye size={14} />
          </button>
          <button className="btn btn-sm btn-outline" onClick={() => cotizacionesAPI.descargarPDF(value)} title="Descargar PDF">
            <Download size={14} />
          </button>
        </div>
      )
    }
  ];

  const columnsOrdenes = [
    {
      header: 'N° Orden',
      accessor: 'numero_orden',
      width: '140px',
      render: (value) => <span className="font-mono font-bold">{value}</span>
    },
    {
      header: 'Fecha',
      accessor: 'fecha_emision',
      width: '110px',
      render: (value) => formatearFecha(value)
    },
    {
      header: 'Total / Pagado',
      accessor: 'total',
      width: '140px',
      align: 'right',
      render: (value, row) => {
        const total = parseFloat(value);
        const pagado = parseFloat(row.monto_pagado || 0);
        const porcentaje = total > 0 ? (pagado / total) * 100 : 0;
        return (
          <div>
            <div className="font-bold">{formatearMoneda(total, row.moneda)}</div>
            <div className="text-xs text-success">Pagado: {formatearMoneda(pagado, row.moneda)}</div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className={`h-1.5 rounded-full ${porcentaje === 100 ? 'bg-success' : porcentaje > 0 ? 'bg-info' : 'bg-warning'}`}
                style={{ width: `${porcentaje}%` }}
              ></div>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Saldo',
      accessor: 'saldo_pendiente',
      width: '120px',
      align: 'right',
      render: (value, row) => (
        <span className={`font-bold ${parseFloat(value) > 0 ? 'text-warning' : 'text-success'}`}>
          {formatearMoneda(value, row.moneda)}
        </span>
      )
    },
    {
      header: 'Estado Pago',
      accessor: 'estado_pago',
      width: '110px',
      align: 'center',
      render: (value) => <span className={`badge ${getEstadoPagoBadge(value)}`}>{value}</span>
    },
    {
      header: 'Estado',
      accessor: 'estado',
      width: '130px',
      align: 'center',
      render: (value) => <span className={`badge ${getEstadoBadge(value)}`}>{value}</span>
    },
    {
      header: 'Acciones',
      accessor: 'id_orden_venta',
      width: '100px',
      align: 'center',
      render: (value) => (
        <div className="flex gap-2 justify-center">
          <button className="btn btn-sm btn-primary" onClick={() => navigate(`/ventas/ordenes/${value}`)} title="Ver detalle">
            <Eye size={14} />
          </button>
          <button className="btn btn-sm btn-outline" onClick={() => ordenesVentaAPI.descargarPDF(value)} title="Descargar PDF">
            <Download size={14} />
          </button>
        </div>
      )
    }
  ];

  if (loading) return <Loading message="Cargando información del cliente..." />;

  if (!cliente) {
    return (
      <div>
        <Alert type="error" message="Cliente no encontrado" />
        <button className="btn btn-outline mt-3" onClick={() => navigate('/clientes')}>
          <ArrowLeft size={18} /> Volver a Clientes
        </button>
      </div>
    );
  }

  const totalesCotizaciones = calcularTotalesPorMoneda(cotizaciones);
  const totalesOrdenes = calcularTotalesPorMoneda(ordenesVenta);
  const totalesPendientes = calcularDeudaReal(ordenesVenta);

  return (
    <div>
      <button className="btn btn-outline mb-4" onClick={() => navigate('/clientes')}>
        <ArrowLeft size={20} /> Volver a Clientes
      </button>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="card mb-4">
        <div className="card-header flex items-center gap-2">
          <Building2 size={20} className="text-primary" />
          <h2 className="card-title">Información del Cliente</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted uppercase font-semibold">RUC</p>
              <p className="font-mono font-bold text-lg">{cliente.ruc}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted uppercase font-semibold">Razón Social</p>
              <p className="font-bold text-lg">{cliente.razon_social}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Contacto</p>
              <p>{cliente.contacto || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Teléfono</p>
              <p>{cliente.telefono || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Email</p>
              <p>{cliente.email || '-'}</p>
            </div>
            <div className="col-span-3">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs text-muted uppercase font-semibold">Direcciones de Despacho</p>
                <button className="btn btn-xs btn-outline" onClick={() => setModalDireccionOpen(true)}>
                  <Plus size={12} /> Agregar Dirección
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2 bg-blue-50 p-2 rounded border border-blue-100">
                  <MapPin size={16} className="text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{cliente.direccion_despacho || 'Sin dirección principal registrada'}</p>
                    <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded">Principal</span>
                  </div>
                </div>
                {cliente.direcciones && cliente.direcciones.filter(d => !d.es_principal).map(dir => (
                  <div key={dir.id_direccion} className="flex items-start gap-2 bg-gray-50 p-2 rounded border border-gray-200 group">
                    <MapPin size={16} className="text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm">{dir.direccion}</p>
                      {dir.referencia && <p className="text-xs text-muted">{dir.referencia}</p>}
                    </div>
                    <button
                      className="text-danger opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                      onClick={() => handleEliminarDireccion(dir.id_direccion)}
                      title="Eliminar dirección"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Estado</p>
              <span className={`badge ${cliente.estado === 'Activo' ? 'badge-success' : 'badge-secondary'}`}>
                {cliente.estado}
              </span>
            </div>
          </div>
        </div>
      </div>

      {estadoCredito && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="card border-l-4 border-primary">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2"><CreditCard size={20} /> Línea de Crédito PEN</h3>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Límite de Crédito:</span>
                  <span className="font-bold text-lg">{formatearMoneda(estadoCredito.credito_pen.limite, 'PEN')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Utilizado:</span>
                  <span className="font-bold text-warning">{formatearMoneda(estadoCredito.credito_pen.utilizado, 'PEN')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Disponible:</span>
                  <span className="font-bold text-success">{formatearMoneda(estadoCredito.credito_pen.disponible, 'PEN')}</span>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Porcentaje Utilizado</span>
                    <span className="font-bold">{estadoCredito.credito_pen.porcentaje_utilizado}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${parseFloat(estadoCredito.credito_pen.porcentaje_utilizado) >= 90 ? 'bg-danger' : parseFloat(estadoCredito.credito_pen.porcentaje_utilizado) >= 70 ? 'bg-warning' : 'bg-success'}`}
                      style={{ width: `${Math.min(estadoCredito.credito_pen.porcentaje_utilizado, 100)}%` }}
                    ></div>
                  </div>
                </div>
                {parseFloat(estadoCredito.credito_pen.porcentaje_utilizado) >= 90 && (
                  <div className="alert alert-danger mt-3">
                    <AlertTriangle size={16} />
                    <span className="text-sm">Límite de crédito casi agotado</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card border-l-4 border-success">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2"><DollarSign size={20} /> Línea de Crédito USD</h3>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Límite de Crédito:</span>
                  <span className="font-bold text-lg">{formatearMoneda(estadoCredito.credito_usd.limite, 'USD')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Utilizado:</span>
                  <span className="font-bold text-warning">{formatearMoneda(estadoCredito.credito_usd.utilizado, 'USD')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Disponible:</span>
                  <span className="font-bold text-success">{formatearMoneda(estadoCredito.credito_usd.disponible, 'USD')}</span>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Porcentaje Utilizado</span>
                    <span className="font-bold">{estadoCredito.credito_usd.porcentaje_utilizado}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${parseFloat(estadoCredito.credito_usd.porcentaje_utilizado) >= 90 ? 'bg-danger' : parseFloat(estadoCredito.credito_usd.porcentaje_utilizado) >= 70 ? 'bg-warning' : 'bg-success'}`}
                      style={{ width: `${Math.min(estadoCredito.credito_usd.porcentaje_utilizado, 100)}%` }}
                    ></div>
                  </div>
                </div>
                {parseFloat(estadoCredito.credito_usd.porcentaje_utilizado) >= 90 && (
                  <div className="alert alert-danger mt-3">
                    <AlertTriangle size={16} />
                    <span className="text-sm">Límite de crédito casi agotado</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid mb-4">
        <div className="stat-card">
          <div className="stat-icon"><FileText size={24} /></div>
          <div className="stat-content">
            <p className="stat-label">Cotizaciones</p>
            <h2 className="stat-value">{cotizaciones.length}</h2>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><ShoppingCart size={24} /></div>
          <div className="stat-content">
            <p className="stat-label">Órdenes de Venta</p>
            <h2 className="stat-value">{ordenesVenta.length}</h2>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><TrendingUp size={24} /></div>
          <div className="stat-content">
            <p className="stat-label">Total Cotizado</p>
            <div className="text-sm space-y-1">
              <div className="font-bold">{formatearMoneda(totalesCotizaciones.totalPEN, 'PEN')}</div>
              <div className="font-bold">{formatearMoneda(totalesCotizaciones.totalUSD, 'USD')}</div>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><DollarSign size={24} /></div>
          <div className="stat-content">
            <p className="stat-label">Total Facturado</p>
            <div className="text-sm space-y-1">
              <div className="font-bold">{formatearMoneda(totalesOrdenes.totalPEN, 'PEN')}</div>
              <div className="font-bold">{formatearMoneda(totalesOrdenes.totalUSD, 'USD')}</div>
            </div>
          </div>
        </div>
        <div className="stat-card border-l-4 border-warning">
          <div className="stat-icon"><AlertTriangle size={24} className="text-warning" /></div>
          <div className="stat-content">
            <p className="stat-label">Deuda Crédito</p>
            <div className="text-sm space-y-1">
              <div className="font-bold text-warning">{formatearMoneda(totalesPendientes.totalPEN, 'PEN')}</div>
              <div className="font-bold text-warning">{formatearMoneda(totalesPendientes.totalUSD, 'USD')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="tabs-navigation mb-4">
          <button
            className={`tab-item ${tabActiva === 'cotizaciones' ? 'active' : ''}`}
            onClick={() => setTabActiva('cotizaciones')}
          >
            <FileText size={18} /> Cotizaciones ({cotizaciones.length})
          </button>
          <button
            className={`tab-item ${tabActiva === 'ordenes' ? 'active' : ''}`}
            onClick={() => setTabActiva('ordenes')}
          >
            <ShoppingCart size={18} /> Órdenes de Venta ({ordenesVenta.length})
          </button>
          <button
            className={`tab-item ${tabActiva === 'historial_condicion' ? 'active' : ''}`}
            onClick={() => setTabActiva('historial_condicion')}
          >
            <History size={18} /> Historial Condición Comercial ({historialCondicion.length})
          </button>
        </div>

        <div className="tab-content">
          {tabActiva === 'cotizaciones' && (
            <Table columns={columnsCotizaciones} data={cotizaciones} emptyMessage="No hay cotizaciones registradas para este cliente" />
          )}

          {tabActiva === 'ordenes' && (
            <Table columns={columnsOrdenes} data={ordenesVenta} emptyMessage="No hay órdenes de venta registradas para este cliente" />
          )}

          {tabActiva === 'historial_condicion' && (
            <div className="p-4">
              {historialCondicion.length === 0 ? (
                <div className="text-center py-10 text-muted">
                  <History size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No hay cambios registrados en la condición comercial</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200"></div>
                  <div className="space-y-4">
                    {historialCondicion.map((item, index) => (
                      <div key={item.id_historial} className="relative flex gap-4 pl-12">
                        <div className="absolute left-3.5 top-2 w-3 h-3 rounded-full bg-primary border-2 border-white shadow"></div>
                        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User size={14} className="text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{item.nombre_completo}</p>
                                <p className="text-xs text-muted">{item.cargo || item.rol}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted">
                              <Clock size={12} />
                              {formatearFechaHora(item.fecha_cambio)}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className={`badge ${item.condicion_anterior === 'Credito' ? 'badge-warning' : 'badge-success'}`}>
                              {formatearCondicion(item.condicion_anterior, item.dias_anterior)}
                            </span>
                            <span className="text-muted text-xs">→</span>
                            <span className={`badge ${item.condicion_nueva === 'Credito' ? 'badge-warning' : 'badge-success'}`}>
                              {formatearCondicion(item.condicion_nueva, item.dias_nuevo)}
                            </span>
                          </div>

                          {item.observacion && (
                            <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600 border-l-2 border-gray-300">
                              {item.observacion}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={modalDireccionOpen} onClose={() => setModalDireccionOpen(false)} title="Agregar Dirección de Despacho" size="md">
        <form onSubmit={handleAgregarDireccion}>
          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label">Dirección *</label>
              <textarea
                className="form-textarea"
                value={nuevaDireccion.direccion}
                onChange={(e) => setNuevaDireccion({ ...nuevaDireccion, direccion: e.target.value })}
                required
                rows="3"
                placeholder="Ingrese la dirección completa..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">Referencia</label>
              <input
                type="text"
                className="form-input"
                value={nuevaDireccion.referencia}
                onChange={(e) => setNuevaDireccion({ ...nuevaDireccion, referencia: e.target.value })}
                placeholder="Ej: Altura cuadra 5, frente al parque..."
              />
            </div>
            <div className="form-group">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={nuevaDireccion.es_principal}
                  onChange={(e) => setNuevaDireccion({ ...nuevaDireccion, es_principal: e.target.checked })}
                />
                <span>Establecer como dirección principal</span>
              </label>
              {nuevaDireccion.es_principal && (
                <p className="text-xs text-warning mt-1 ml-5">Esta dirección reemplazará a la actual como predeterminada.</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn btn-outline" onClick={() => setModalDireccionOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={procesandoDireccion || !nuevaDireccion.direccion}>
              {procesandoDireccion ? 'Guardando...' : 'Guardar Dirección'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ClienteDetalle;