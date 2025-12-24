// frontend/src/pages/Ventas/DetalleCotizacion.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Download, 
  Check, 
  FileText,
  Calendar,
  DollarSign,
  Building,
  Clock,
  ShoppingCart,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calculator
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';

function DetalleCotizacion() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [cotizacion, setCotizacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalEstadoOpen, setModalEstadoOpen] = useState(false);
  const [modalConvertirOpen, setModalConvertirOpen] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // TODO: Reemplazar con API real
      // const response = await cotizacionesAPI.getById(id);
      // setCotizacion(response.data.data);
      
      const mockData = {
        id_cotizacion: 1,
        numero_cotizacion: 'C-2025-0001',
        fecha_emision: '2025-12-24',
        fecha_vencimiento: '2025-12-31',
        fecha_validez: '2025-12-31',
        estado: 'Pendiente',
        moneda: 'PEN',
        plazo_pago: '30 días',
        forma_pago: 'Transferencia bancaria',
        orden_compra_cliente: 'OC-2025-100',
        lugar_entrega: 'Av. Principal 123, Lima',
        plazo_entrega: '15 días',
        validez_dias: 7,
        observaciones: 'Incluye instalación y capacitación',
        cliente: 'EMPRESA DEMO SAC',
        ruc_cliente: '20123456789',
        direccion_cliente: 'Av. Principal 123',
        ciudad_cliente: 'Lima',
        telefono_cliente: '(01) 234-5678',
        email_cliente: 'contacto@empresa.com',
        comercial: 'Juan Pérez',
        email_comercial: 'jperez@indpack.com',
        subtotal: 5000.00,
        igv: 900.00,
        total: 5900.00,
        convertida_venta: false,
        id_orden_venta: null,
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
            subtotal: 1000.00
          },
          {
            id_detalle: 2,
            codigo_producto: 'PROD-002',
            producto: 'Producto Terminado 2',
            unidad_medida: 'unidad',
            cantidad: 20.00000,
            precio_unitario: 200.00,
            descuento_porcentaje: 0,
            subtotal: 4000.00
          }
        ]
      };
      
      setCotizacion(mockData);
    } catch (err) {
      setError('Error al cargar la cotización: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarPDF = async () => {
    try {
      setSuccess('Descargando PDF...');
      
      // TODO: Implementar descarga real
      // const response = await fetch(`/api/cotizaciones/${id}/pdf`);
      // const blob = await response.blob();
      // const url = window.URL.createObjectURL(blob);
      // const link = document.createElement('a');
      // link.href = url;
      // link.download = `cotizacion-${cotizacion.numero_cotizacion}.pdf`;
      // link.click();
      // window.URL.revokeObjectURL(url);
      
      console.log('Descargando PDF de cotización:', id);
      
    } catch (err) {
      setError('Error al descargar PDF: ' + err.message);
    }
  };

  const handleCambiarEstado = async (estado) => {
    try {
      setError(null);
      
      // TODO: Llamar API real
      // await cotizacionesAPI.cambiarEstado(id, estado);
      
      console.log('Cambiar estado a:', estado);
      setCotizacion({ ...cotizacion, estado });
      setSuccess(`Estado actualizado a ${estado}`);
      setModalEstadoOpen(false);
      
    } catch (err) {
      setError('Error al cambiar estado: ' + err.message);
    }
  };

  const handleConvertirVenta = async () => {
    try {
      setError(null);
      
      // TODO: Llamar API real
      // const response = await ordenesVentaAPI.convertirDesdeCotizacion(id);
      
      console.log('Convertir a orden de venta');
      setSuccess('Cotización convertida a Orden de Venta exitosamente');
      setModalConvertirOpen(false);
      
      setTimeout(() => {
        navigate('/ventas/ordenes/1');
      }, 1500);
      
    } catch (err) {
      setError('Error al convertir a orden de venta: ' + err.message);
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

  const getEstadoConfig = (estado) => {
    const configs = {
      'Pendiente': { 
        icono: Clock, 
        clase: 'badge-warning',
        color: 'border-warning'
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
      }
    };
    return configs[estado] || configs['Pendiente'];
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
      render: (value) => <span className="font-medium">{value}</span>
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
      header: 'Subtotal',
      accessor: 'subtotal',
      width: '140px',
      align: 'right',
      render: (value) => (
        <span className="font-bold text-primary">{formatearMoneda(value)}</span>
      )
    }
  ];

  if (loading) {
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
          <button
            className="btn btn-outline"
            onClick={handleDescargarPDF}
          >
            <Download size={20} />
            Descargar PDF
          </button>
          
          {cotizacion.estado !== 'Convertida' && (
            <>
              <button
                className="btn btn-outline"
                onClick={() => setModalEstadoOpen(true)}
              >
                <Edit size={20} />
                Cambiar Estado
              </button>
              
              {cotizacion.estado === 'Aprobada' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setModalConvertirOpen(true)}
                >
                  <ShoppingCart size={20} />
                  Convertir a Orden de Venta
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Estado y Alertas */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        {/* Estado */}
        <div className={`card border-l-4 ${estadoConfig.color}`}>
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
              
              {cotizacion.convertida_venta && (
                <div className="text-right">
                  <p className="text-sm text-muted">Convertida a Orden de Venta</p>
                  <button
                    className="btn btn-sm btn-primary mt-2"
                    onClick={() => navigate(`/ventas/ordenes/${cotizacion.id_orden_venta}`)}
                  >
                    Ver Orden de Venta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alerta de vencimiento */}
        {cotizacion.estado === 'Pendiente' && (
          <div className="card border-l-4 border-warning bg-yellow-50">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <AlertCircle size={24} className="text-warning" />
                <div>
                  <p className="font-medium">Validez de la Cotización</p>
                  <p className="text-sm text-muted">
                    Válida hasta el {formatearFecha(cotizacion.fecha_vencimiento)}
                    {' '}({cotizacion.validez_dias} días)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
          <div className="card-body">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted">Razón Social:</label>
                <p className="font-bold text-lg">{cotizacion.cliente}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted">RUC:</label>
                  <p className="font-medium">{cotizacion.ruc_cliente}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted">Ciudad:</label>
                  <p>{cotizacion.ciudad_cliente}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted">Dirección:</label>
                <p>{cotizacion.direccion_cliente}</p>
              </div>
              {cotizacion.telefono_cliente && (
                <div>
                  <label className="text-sm font-medium text-muted">Teléfono:</label>
                  <p>{cotizacion.telefono_cliente}</p>
                </div>
              )}
              {cotizacion.email_cliente && (
                <div>
                  <label className="text-sm font-medium text-muted">Email:</label>
                  <p className="text-sm">{cotizacion.email_cliente}</p>
                </div>
              )}
            </div>
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
          <div className="card-body">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted">Moneda:</label>
                  <p className="font-medium">
                    {cotizacion.moneda === 'USD' ? 'Dólares (USD)' : 'Soles (PEN)'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted">Fecha Emisión:</label>
                  <p>{formatearFecha(cotizacion.fecha_emision)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted">Plazo de Pago:</label>
                  <p>{cotizacion.plazo_pago || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted">Forma de Pago:</label>
                  <p>{cotizacion.forma_pago || '-'}</p>
                </div>
              </div>
              
              {cotizacion.orden_compra_cliente && (
                <div>
                  <label className="text-sm font-medium text-muted">Orden de Compra Cliente:</label>
                  <p className="font-medium">{cotizacion.orden_compra_cliente}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-muted">Plazo de Entrega:</label>
                <p>{cotizacion.plazo_entrega || '-'}</p>
              </div>
              
              {cotizacion.lugar_entrega && (
                <div>
                  <label className="text-sm font-medium text-muted">Lugar de Entrega:</label>
                  <p className="text-sm">{cotizacion.lugar_entrega}</p>
                </div>
              )}
              
              {cotizacion.comercial && (
                <div>
                  <label className="text-sm font-medium text-muted">Comercial:</label>
                  <p className="font-medium">{cotizacion.comercial}</p>
                  {cotizacion.email_comercial && (
                    <p className="text-sm text-muted">{cotizacion.email_comercial}</p>
                  )}
                </div>
              )}
            </div>
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
            data={cotizacion.detalle}
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
                <span className="font-medium">IGV (18%):</span>
                <span className="font-bold">{formatearMoneda(cotizacion.igv)}</span>
              </div>
              <div className="flex justify-between py-3 bg-primary text-white px-4 rounded-lg">
                <span className="font-bold text-lg">TOTAL:</span>
                <span className="font-bold text-2xl">{formatearMoneda(cotizacion.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Cambiar Estado */}
      <Modal
        isOpen={modalEstadoOpen}
        onClose={() => setModalEstadoOpen(false)}
        title="Cambiar Estado de Cotización"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-muted">
            Seleccione el nuevo estado para la cotización {cotizacion.numero_cotizacion}
          </p>
          
          <div className="space-y-2">
            <button
              className="btn btn-outline w-full justify-start"
              onClick={() => handleCambiarEstado('Pendiente')}
              disabled={cotizacion.estado === 'Pendiente'}
            >
              <Clock size={20} />
              Pendiente
            </button>
            
            <button
              className="btn btn-success w-full justify-start"
              onClick={() => handleCambiarEstado('Aprobada')}
              disabled={cotizacion.estado === 'Aprobada'}
            >
              <CheckCircle size={20} />
              Aprobada
            </button>
            
            <button
              className="btn btn-danger w-full justify-start"
              onClick={() => handleCambiarEstado('Rechazada')}
              disabled={cotizacion.estado === 'Rechazada'}
            >
              <XCircle size={20} />
              Rechazada
            </button>
          </div>
          
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button
              className="btn btn-outline"
              onClick={() => setModalEstadoOpen(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Convertir a Orden de Venta */}
      <Modal
        isOpen={modalConvertirOpen}
        onClose={() => setModalConvertirOpen(false)}
        title="Convertir a Orden de Venta"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={24} className="text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-medium text-blue-900">¿Está seguro de convertir esta cotización?</p>
                <p className="text-sm text-blue-700 mt-2">
                  Se creará una nueva Orden de Venta con todos los datos de esta cotización.
                  La cotización quedará marcada como "Convertida" y no podrá ser modificada.
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
                <span>{cotizacion.detalle.length} item(s)</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button
              className="btn btn-outline"
              onClick={() => setModalConvertirOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConvertirVenta}
            >
              <Check size={20} />
              Confirmar Conversión
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DetalleCotizacion;