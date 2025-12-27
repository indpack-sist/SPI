// frontend/src/pages/Ventas/NuevaGuiaRemision.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Save, FileText, ShoppingCart, MapPin,
  Truck, Package, Calendar, AlertCircle
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { guiasRemisionAPI, ordenesVentaAPI } from '../../config/api';

function NuevaGuiaRemision() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idOrden = searchParams.get('orden');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [orden, setOrden] = useState(null);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  
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
  
  const [detalle, setDetalle] = useState([]);

  useEffect(() => {
    if (idOrden) {
      cargarOrden(idOrden);
    }
  }, [idOrden]);

  useEffect(() => {
    calcularTotales();
  }, [detalle]);

  // ✅ CARGAR ORDEN DESDE API
  const cargarOrden = async (id) => {
    try {
      setLoading(true);
      
      const response = await ordenesVentaAPI.getById(id);
      
      if (response.data.success) {
        const ordenData = response.data.data;
        setOrden(ordenData);
        
        // Filtrar productos disponibles para despachar
        const productosConDisponibilidad = ordenData.detalle.map(item => {
          const cantidadDisponible = parseFloat(item.cantidad) - parseFloat(item.cantidad_despachada || 0);
          return {
            id_detalle: item.id_detalle,
            id_producto: item.id_producto,
            codigo_producto: item.codigo_producto,
            producto: item.producto,
            unidad_medida: item.unidad_medida,
            cantidad_total: parseFloat(item.cantidad),
            cantidad_despachada: parseFloat(item.cantidad_despachada || 0),
            cantidad_disponible: cantidadDisponible,
            peso_unitario_kg: parseFloat(item.peso_unitario_kg || 0)
          };
        }).filter(item => item.cantidad_disponible > 0);
        
        setProductosDisponibles(productosConDisponibilidad);
        
        // Auto-llenar detalle con productos disponibles
        const detalleInicial = productosConDisponibilidad.map(p => ({
          id_detalle_orden: p.id_detalle,
          id_producto: p.id_producto,
          codigo_producto: p.codigo_producto,
          producto: p.producto,
          unidad_medida: p.unidad_medida,
          cantidad: p.cantidad_disponible,
          peso_unitario_kg: p.peso_unitario_kg,
          descripcion: p.producto
        }));
        
        setDetalle(detalleInicial);
        
        // Auto-llenar dirección
        setFormData(prev => ({
          ...prev,
          id_orden_venta: id,
          direccion_llegada: ordenData.direccion_entrega || '',
          ciudad_llegada: ordenData.ciudad_entrega || '',
          ubigeo_llegada: ordenData.ubigeo_llegada || ''
        }));
      } else {
        setError('Orden no encontrada');
      }
      
    } catch (err) {
      console.error('Error al cargar orden:', err);
      setError(err.response?.data?.error || 'Error al cargar orden');
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

  // ✅ GUARDAR EN API REAL
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
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
        id_orden_venta: parseInt(formData.id_orden_venta),
        fecha_emision: formData.fecha_emision,
        fecha_inicio_traslado: formData.fecha_inicio_traslado || null,
        tipo_traslado: formData.tipo_traslado,
        motivo_traslado: formData.motivo_traslado,
        modalidad_transporte: formData.modalidad_transporte,
        direccion_partida: formData.direccion_partida,
        ubigeo_partida: formData.ubigeo_partida,
        direccion_llegada: formData.direccion_llegada,
        ubigeo_llegada: formData.ubigeo_llegada,
        ciudad_llegada: formData.ciudad_llegada,
        peso_bruto_kg: parseFloat(formData.peso_bruto_kg),
        numero_bultos: parseInt(formData.numero_bultos) || 0,
        observaciones: formData.observaciones,
        detalle: detalle
          .filter(item => parseFloat(item.cantidad) > 0)
          .map((item, index) => ({
            id_detalle_orden: item.id_detalle_orden,
            id_producto: item.id_producto,
            cantidad: parseFloat(item.cantidad),
            descripcion: item.descripcion,
            peso_unitario_kg: parseFloat(item.peso_unitario_kg) || 0,
            orden: index + 1
          }))
      };
      
      const response = await guiasRemisionAPI.create(payload);
      
      if (response.data.success) {
        setSuccess('Guía de remisión creada exitosamente');
        setTimeout(() => {
          navigate('/ventas/guias-remision');
        }, 1500);
      } else {
        setError(response.data.error || 'Error al crear guía de remisión');
      }
      
    } catch (err) {
      console.error('Error al crear guía de remisión:', err);
      setError(err.response?.data?.error || 'Error al crear guía de remisión');
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
            {productosDisponibles.length > 0 ? (
              <>
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
              </>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle size={20} className="text-warning" />
                  <p className="text-sm text-yellow-900">
                    No hay productos disponibles para despachar en esta orden. Todos los productos ya han sido despachados.
                  </p>
                </div>
              </div>
            )}
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
            disabled={loading || productosDisponibles.length === 0}
          >
            <Save size={20} />
            {loading ? 'Guardando...' : 'Crear Guía de Remisión'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default NuevaGuiaRemision;