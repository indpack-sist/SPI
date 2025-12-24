// frontend/src/pages/Ventas/NuevaGuiaRemision.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  FileText,
  ShoppingCart,
  MapPin,
  Truck,
  Package,
  Calendar,
  AlertCircle
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';

function NuevaGuiaRemision() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idOrden = searchParams.get('orden');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Orden origen
  const [orden, setOrden] = useState(null);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  
  // Formulario
  const [formData, setFormData] = useState({
    id_orden_venta: idOrden || '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_inicio_traslado: '',
    tipo_traslado: 'Venta',
    motivo_traslado: 'Venta',
    modalidad_transporte: 'Privado',
    direccion_partida: '',
    ubigeo_partida: '150101', // Lima
    direccion_llegada: '',
    ubigeo_llegada: '',
    ciudad_llegada: '',
    peso_bruto_kg: 0,
    numero_bultos: 0,
    observaciones: ''
  });
  
  // Detalle
  const [detalle, setDetalle] = useState([]);

  useEffect(() => {
    if (idOrden) {
      cargarOrden(idOrden);
    }
  }, [idOrden]);

  useEffect(() => {
    calcularTotales();
  }, [detalle]);

  const cargarOrden = async (id) => {
    try {
      setLoading(true);
      
      // TODO: API real
      const mockOrden = {
        id_orden_venta: id,
        numero_orden: 'OV-2025-0001',
        cliente: 'EMPRESA DEMO SAC',
        ruc_cliente: '20123456789',
        direccion_entrega: 'Av. Principal 123, Lima',
        ciudad_entrega: 'Lima',
        estado: 'En Proceso'
      };
      
      const mockProductos = [
        {
          id_detalle: 1,
          id_producto: 1,
          codigo_producto: 'PROD-001',
          producto: 'Producto Terminado 1',
          unidad_medida: 'unidad',
          cantidad_total: 10.00000,
          cantidad_despachada: 0.00000,
          cantidad_disponible: 10.00000,
          peso_unitario_kg: 5.5
        },
        {
          id_detalle: 2,
          id_producto: 2,
          codigo_producto: 'PROD-002',
          producto: 'Producto Terminado 2',
          unidad_medida: 'unidad',
          cantidad_total: 20.00000,
          cantidad_despachada: 5.00000,
          cantidad_disponible: 15.00000,
          peso_unitario_kg: 3.2
        }
      ];
      
      setOrden(mockOrden);
      setProductosDisponibles(mockProductos);
      
      // Auto-llenar detalle con productos disponibles
      const detalleInicial = mockProductos.map(p => ({
        id_detalle_orden: p.id_detalle,
        id_producto: p.id_producto,
        codigo_producto: p.codigo_producto,
        producto: p.producto,
        unidad_medida: p.unidad_medida,
        cantidad: p.cantidad_disponible,
        peso_unitario_kg: p.peso_unitario_kg || 0,
        descripcion: p.producto
      }));
      
      setDetalle(detalleInicial);
      
      // Auto-llenar dirección
      setFormData({
        ...formData,
        id_orden_venta: id,
        direccion_llegada: mockOrden.direccion_entrega,
        ciudad_llegada: mockOrden.ciudad_entrega
      });
      
    } catch (err) {
      setError('Error al cargar orden: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCantidadChange = (index, cantidad) => {
    const newDetalle = [...detalle];
    const producto = productosDisponibles.find(p => p.id_producto === newDetalle[index].id_producto);
    
    const cantidadNum = parseFloat(cantidad) || 0;
    
    if (cantidadNum > producto.cantidad_disponible) {
      setError(`Cantidad máxima disponible: ${producto.cantidad_disponible}`);
      return;
    }
    
    newDetalle[index].cantidad = cantidadNum;
    setDetalle(newDetalle);
  };

  const calcularTotales = () => {
    const pesoTotal = detalle.reduce((sum, item) => 
      sum + (parseFloat(item.cantidad) * parseFloat(item.peso_unitario_kg || 0)), 0
    );
    
    setFormData(prev => ({
      ...prev,
      peso_bruto_kg: pesoTotal
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    // Validaciones
    if (!formData.id_orden_venta) {
      setError('Debe seleccionar una orden de venta');
      return;
    }
    
    if (detalle.length === 0) {
      setError('Debe agregar al menos un producto');
      return;
    }
    
    if (!formData.direccion_llegada) {
      setError('Debe especificar la dirección de llegada');
      return;
    }
    
    // Validar que haya cantidades a despachar
    const totalCantidad = detalle.reduce((sum, item) => sum + parseFloat(item.cantidad), 0);
    if (totalCantidad === 0) {
      setError('Debe especificar cantidades a despachar');
      return;
    }
    
    try {
      setLoading(true);
      
      const payload = {
        ...formData,
        detalle: detalle.filter(item => parseFloat(item.cantidad) > 0)
      };
      
      // TODO: Llamar API real
      console.log('Payload:', payload);
      
      setSuccess('Guía de remisión creada exitosamente');
      
      setTimeout(() => {
        navigate('/ventas/guias-remision');
      }, 1500);
      
    } catch (err) {
      setError('Error al crear guía de remisión: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !orden) {
    return <Loading message="Cargando orden..." />;
  }

  if (!idOrden) {
    return (
      <div className="p-6">
        <Alert type="error" message="Debe especificar una orden de venta" />
        <button 
          className="btn btn-outline mt-4"
          onClick={() => navigate('/ventas/ordenes')}
        >
          <ArrowLeft size={20} />
          Ir a Órdenes de Venta
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          className="btn btn-outline"
          onClick={() => navigate('/ventas/guias-remision')}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText size={32} />
            Nueva Guía de Remisión
          </h1>
          <p className="text-muted">
            Desde orden {orden?.numero_orden}
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Info Orden */}
      {orden && (
        <div className="card border-l-4 border-primary bg-blue-50 mb-4">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <ShoppingCart size={24} className="text-primary" />
              <div className="flex-1">
                <p className="font-medium text-blue-900">
                  Orden de Venta: {orden.numero_orden}
                </p>
                <p className="text-sm text-blue-700">
                  Cliente: {orden.cliente} ({orden.ruc_cliente})
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Datos de la Guía */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <Calendar size={20} />
              Datos de la Guía
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">Fecha de Emisión *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.fecha_emision}
                  onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Fecha Inicio Traslado</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.fecha_inicio_traslado}
                  onChange={(e) => setFormData({ ...formData, fecha_inicio_traslado: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Tipo de Traslado *</label>
                <select
                  className="form-select"
                  value={formData.tipo_traslado}
                  onChange={(e) => setFormData({ ...formData, tipo_traslado: e.target.value })}
                  required
                >
                  <option value="Venta">Venta</option>
                  <option value="Traslado entre almacenes">Traslado entre almacenes</option>
                  <option value="Consignación">Consignación</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Modalidad de Transporte *</label>
                <select
                  className="form-select"
                  value={formData.modalidad_transporte}
                  onChange={(e) => setFormData({ ...formData, modalidad_transporte: e.target.value })}
                  required
                >
                  <option value="Privado">Transporte Privado</option>
                  <option value="Público">Transporte Público</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Número de Bultos</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.numero_bultos}
                  onChange={(e) => setFormData({ ...formData, numero_bultos: e.target.value })}
                  min="0"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Peso Bruto (kg)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.peso_bruto_kg}
                  readOnly
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Punto de Partida */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <MapPin size={20} />
              Punto de Partida
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group col-span-2">
                <label className="form-label">Dirección de Partida</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.direccion_partida}
                  onChange={(e) => setFormData({ ...formData, direccion_partida: e.target.value })}
                  placeholder="Dirección del almacén o punto de origen"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Ubigeo de Partida</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.ubigeo_partida}
                  onChange={(e) => setFormData({ ...formData, ubigeo_partida: e.target.value })}
                  placeholder="Código ubigeo (6 dígitos)"
                  maxLength="6"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Punto de Llegada */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <MapPin size={20} />
              Punto de Llegada
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group col-span-2">
                <label className="form-label">Dirección de Llegada *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.direccion_llegada}
                  onChange={(e) => setFormData({ ...formData, direccion_llegada: e.target.value })}
                  placeholder="Dirección completa de entrega"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Ciudad de Llegada</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.ciudad_llegada}
                  onChange={(e) => setFormData({ ...formData, ciudad_llegada: e.target.value })}
                  placeholder="Ciudad"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Ubigeo de Llegada</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.ubigeo_llegada}
                  onChange={(e) => setFormData({ ...formData, ubigeo_llegada: e.target.value })}
                  placeholder="Código ubigeo (6 dígitos)"
                  maxLength="6"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Detalle de Productos */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <Package size={20} />
              Productos a Despachar
            </h2>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '100px' }}>Código</th>
                    <th>Descripción</th>
                    <th style={{ width: '100px' }}>Disponible</th>
                    <th style={{ width: '100px' }}>Cantidad *</th>
                    <th style={{ width: '80px' }}>Unidad</th>
                    <th style={{ width: '100px' }}>Peso Unit.</th>
                    <th style={{ width: '100px' }}>Peso Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.map((item, index) => {
                    const producto = productosDisponibles.find(p => p.id_producto === item.id_producto);
                    return (
                      <tr key={index}>
                        <td className="font-mono text-sm">{item.codigo_producto}</td>
                        <td className="font-medium">{item.producto}</td>
                        <td className="text-right">
                          <span className="font-bold text-primary">
                            {parseFloat(producto?.cantidad_disponible || 0).toFixed(2)}
                          </span>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input text-right"
                            value={item.cantidad}
                            onChange={(e) => handleCantidadChange(index, e.target.value)}
                            min="0"
                            max={producto?.cantidad_disponible || 0}
                            step="0.01"
                            required
                          />
                        </td>
                        <td className="text-sm text-muted">{item.unidad_medida}</td>
                        <td className="text-right text-sm">
                          {parseFloat(item.peso_unitario_kg).toFixed(2)} kg
                        </td>
                        <td className="text-right font-bold">
                          {(parseFloat(item.cantidad) * parseFloat(item.peso_unitario_kg)).toFixed(2)} kg
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan="6" className="text-right font-bold">PESO TOTAL:</td>
                    <td className="text-right font-bold text-primary">
                      {parseFloat(formData.peso_bruto_kg).toFixed(2)} kg
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
              <div className="flex items-start gap-2">
                <AlertCircle size={20} className="text-warning flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-900">
                  <p className="font-medium">Importante:</p>
                  <p>Solo se despacharán los productos con cantidad mayor a 0. Las cantidades no pueden exceder lo disponible en la orden.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Observaciones */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea
                className="form-textarea"
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                rows={3}
                placeholder="Observaciones adicionales sobre el traslado..."
              />
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/ventas/guias-remision')}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            <Save size={20} />
            Crear Guía de Remisión
          </button>
        </div>
      </form>
    </div>
  );
}

export default NuevaGuiaRemision;