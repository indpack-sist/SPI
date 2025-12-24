// frontend/src/pages/Ventas/DetalleOrdenVenta.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Download, 
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Building,
  DollarSign,
  MapPin,
  AlertCircle,
  TrendingUp,
  Calendar,
  Plus,
  ShoppingCart,
  Calculator
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';

function DetalleOrdenVenta() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Modales
  const [modalEstadoOpen, setModalEstadoOpen] = useState(false);
  const [modalPrioridadOpen, setModalPrioridadOpen] = useState(false);
  const [modalProgresoOpen, setModalProgresoOpen] = useState(false);
  
  // Control de progreso
  const [progreso, setProgreso] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // TODO: API real
      const mockData = {
        id_orden_venta: 1,
        numero_orden: 'OV-2025-0001',
        numero_cotizacion: 'C-2025-0001',
        id_cotizacion: 1,
        fecha_emision: '2025-12-24',
        fecha_entrega_estimada: '2025-12-31',
        fecha_entrega_real: null,
        estado: 'Pendiente',
        prioridad: 'Alta',
        moneda: 'PEN',
        plazo_pago: '30 días',
        forma_pago: 'Transferencia bancaria',
        orden_compra_cliente: 'OC-2025-100',
        direccion_entrega: 'Av. Principal 123, Lima',
        lugar_entrega: 'Almacén central',
        ciudad_entrega: 'Lima',
        contacto_entrega: 'Juan Pérez',
        telefono_entrega: '(01) 234-5678',
        observaciones: 'Entrega en horario de oficina',
        cliente: 'EMPRESA DEMO SAC',
        ruc_cliente: '20123456789',
        direccion_cliente: 'Av. Principal 123',
        ciudad_cliente: 'Lima',
        comercial: 'María García',
        subtotal: 5000.00,
        igv: 900.00,
        total: 5900.00,
        fecha_creacion: '2025-12-24T10:30:00',
        detalle: [
          {
            id_detalle: 1,
            codigo_producto: 'PROD-001',
            producto: 'Producto Terminado 1',
            unidad_medida: 'unidad',
            cantidad: 10.00000,
            precio_unitario: 100.00,
            descuento_porcentaje: 0,
            valor_venta: 1000.00,
            stock_actual: 5,
            requiere_produccion: true,
            cantidad_producida: 3.00000,
            cantidad_despachada: 0.00000
          },
          {
            id_detalle: 2,
            codigo_producto: 'PROD-002',
            producto: 'Producto Terminado 2',
            unidad_medida: 'unidad',
            cantidad: 20.00000,
            precio_unitario: 200.00,
            descuento_porcentaje: 0,
            valor_venta: 4000.00,
            stock_actual: 25,
            requiere_produccion: false,
            cantidad_producida: 0.00000,
            cantidad_despachada: 0.00000
          }
        ]
      };
      
      setOrden(mockData);
      setProgreso(mockData.detalle.map(d => ({
        id_detalle: d.id_detalle,
        cantidad_producida: d.cantidad_producida,
        cantidad_despachada: d.cantidad_despachada
      })));
      
    } catch (err) {
      setError('Error al cargar la orden de venta: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstado = async (estado) => {
    try {
      setError(null);
      console.log('Cambiar estado a:', estado);
      setOrden({ ...orden, estado });
      setSuccess(`Estado actualizado a ${estado}`);
      setModalEstadoOpen(false);
    } catch (err) {
      setError('Error al cambiar estado: ' + err.message);
    }
  };

  const handleCambiarPrioridad = async (prioridad) => {
    try {
      setError(null);
      console.log('Cambiar prioridad a:', prioridad);
      setOrden({ ...orden, prioridad });
      setSuccess(`Prioridad actualizada a ${prioridad}`);
      setModalPrioridadOpen(false);
    } catch (err) {
      setError('Error al cambiar prioridad: ' + err.message);
    }
  };

  const handleActualizarProgreso = async () => {
    try {
      setError(null);
      console.log('Actualizar progreso:', progreso);
      
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
    } catch (err) {
      setError('Error al actualizar progreso: ' + err.message);
    }
  };

  const handleGenerarGuia = () => {
    navigate(`/ventas/guias-remision/nueva?orden=${id}`);
  };

  const handleDescargarPDF = () => {
    console.log('Descargar PDF de orden:', id);
    setSuccess('Descargando PDF...');
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
        siguientes: ['En Proceso', 'Cancelada']
      },
      'En Proceso': { 
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

  const calcularProgresoPorcentaje = (item) => {
    if (!item.requiere_produccion) {
      return (parseFloat(item.cantidad_despachada) / parseFloat(item.cantidad)) * 100;
    }
    return (parseFloat(item.cantidad_producida) / parseFloat(item.cantidad)) * 100;
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
              {(orden.estado === 'En Proceso' || orden.estado === 'Despachada') && (
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

      <div className="grid grid-cols-3 gap-4 mb-4">
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

      {/* Modales */}
      <Modal isOpen={modalEstadoOpen} onClose={() => setModalEstadoOpen(false)} title="Cambiar Estado">
        <div className="space-y-4">
          <p className="text-muted">Estado actual: <strong>{orden.estado}</strong></p>
          <div className="space-y-2">
            {estadoConfig.siguientes.map(estado => {
              const config = getEstadoConfig(estado);
              const Icono = config.icono;
              return (
                <button key={estado} className="btn btn-outline w-full justify-start" onClick={() => handleCambiarEstado(estado)}>
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
            <button key={prioridad} className="btn btn-outline w-full justify-start" 
              onClick={() => handleCambiarPrioridad(prioridad)} disabled={orden.prioridad === prioridad}>
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
              <tr><th>Producto</th><th>Total</th><th>Producida</th><th>Despachada</th></tr>
            </thead>
            <tbody>
              {orden.detalle.map((item) => {
                const prog = progreso.find(p => p.id_detalle === item.id_detalle);
                return (
                  <tr key={item.id_detalle}>
                    <td>{item.producto}</td>
                    <td>{parseFloat(item.cantidad).toFixed(2)}</td>
                    <td>
                      <input type="number" className="form-input" value={prog?.cantidad_producida || 0}
                        onChange={(e) => {
                          const newProgreso = [...progreso];
                          const idx = newProgreso.findIndex(p => p.id_detalle === item.id_detalle);
                          if (idx >= 0) newProgreso[idx].cantidad_producida = parseFloat(e.target.value) || 0;
                          setProgreso(newProgreso);
                        }}
                        disabled={!item.requiere_produccion} />
                    </td>
                    <td>
                      <input type="number" className="form-input" value={prog?.cantidad_despachada || 0}
                        onChange={(e) => {
                          const newProgreso = [...progreso];
                          const idx = newProgreso.findIndex(p => p.id_detalle === item.id_detalle);
                          if (idx >= 0) newProgreso[idx].cantidad_despachada = parseFloat(e.target.value) || 0;
                          setProgreso(newProgreso);
                        }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-outline" onClick={() => setModalProgresoOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleActualizarProgreso}>
              <CheckCircle size={20} /> Guardar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DetalleOrdenVenta;