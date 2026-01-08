import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Save, FileText, ShoppingCart, MapPin,
  Truck, Package, Calendar, AlertCircle, Plus
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
    fecha_traslado: new Date().toISOString().split('T')[0],
    tipo_traslado: 'Privado',
    motivo_traslado: 'Venta',
    modalidad_transporte: 'Transporte Privado',
    direccion_partida: 'Almacén Central',
    ubigeo_partida: '150101',
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

  const cargarOrden = async (id) => {
    try {
      setLoading(true);
      
      const response = await ordenesVentaAPI.getById(id);
      
      if (response.data.success) {
        const ordenData = response.data.data;
        setOrden(ordenData);
        
        if (ordenData.estado !== 'Confirmada' && ordenData.estado !== 'En Preparación') {
          setError(`Solo se pueden crear guías para órdenes Confirmadas o En Preparación. Estado actual: ${ordenData.estado}`);
          return;
        }
        
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
            stock_actual: parseFloat(item.stock_disponible || 0),
            peso_unitario_kg: parseFloat(item.peso_unitario_kg || 0)
          };
        }).filter(item => item.cantidad_disponible > 0);
        
        if (productosConDisponibilidad.length === 0) {
          setError('No hay productos disponibles para despachar en esta orden');
          return;
        }
        
        setProductosDisponibles(productosConDisponibilidad);
        
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
      setError(`${producto.producto}: Cantidad máxima disponible ${producto.cantidad_disponible}`);
      return;
    }
    
    if (cantidadNum > producto.stock_actual) {
      setError(`${producto.producto}: Stock insuficiente. Disponible: ${producto.stock_actual}`);
      return;
    }
    
    newDetalle[index].cantidad = cantidadNum;
    setDetalle(newDetalle);
    setError(null);
  };

  const handlePesoChange = (index, peso) => {
    const newDetalle = [...detalle];
    newDetalle[index].peso_unitario_kg = parseFloat(peso) || 0;
    setDetalle(newDetalle);
  };

  const calcularTotales = () => {
    const pesoTotal = detalle.reduce((sum, item) => 
      sum + (parseFloat(item.cantidad) * parseFloat(item.peso_unitario_kg || 0)), 0
    );
    
    setFormData(prev => ({
      ...prev,
      peso_bruto_kg: pesoTotal.toFixed(2)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!formData.id_orden_venta) {
      setError('Debe seleccionar una orden de venta');
      return;
    }
    
    const detalleValido = detalle.filter(item => parseFloat(item.cantidad) > 0);
    
    if (detalleValido.length === 0) {
      setError('Debe especificar cantidades a despachar');
      return;
    }
    
    if (!formData.direccion_llegada || formData.direccion_llegada.trim() === '') {
      setError('La dirección de llegada es obligatoria');
      return;
    }
    
    if (!formData.fecha_traslado) {
      setError('La fecha de traslado es obligatoria');
      return;
    }
    
    try {
      setLoading(true);
      
      const payload = {
        id_orden_venta: parseInt(formData.id_orden_venta),
        fecha_emision: formData.fecha_emision,
        fecha_traslado: formData.fecha_traslado,
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
        detalle: detalleValido.map(item => ({
          id_detalle_orden: item.id_detalle_orden,
          id_producto: item.id_producto,
          cantidad: parseFloat(item.cantidad),
          unidad_medida: item.unidad_medida,
          descripcion: item.descripcion || item.producto,
          peso_unitario_kg: parseFloat(item.peso_unitario_kg) || 0
        }))
      };
      
      const response = await guiasRemisionAPI.create(payload);
      
      if (response.data.success) {
        setSuccess(`Guía creada: ${response.data.data.numero_guia}`);
        setTimeout(() => {
          navigate(`/ventas/guias-remision/${response.data.data.id_guia}`);
        }, 1500);
      } else {
        setError(response.data.error || 'Error al crear guía de remisión');
      }
      
    } catch (err) {
      console.error('Error al crear guía:', err);
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
            <FileText size={32} className="text-primary" />
            Nueva Guía de Remisión
          </h1>
          <p className="text-muted">
            {orden ? `Desde orden ${orden.numero_orden}` : 'Preparando guía...'}
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

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
              <div className="text-right">
                <p className="text-xs text-blue-700">Estado</p>
                <span className={`badge ${orden.estado === 'Confirmada' ? 'badge-success' : 'badge-info'}`}>
                  {orden.estado}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card mb-4">
          <div className="card-header bg-gradient-to-r from-gray-50 to-white">
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
                <label className="form-label">Fecha de Traslado *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.fecha_traslado}
                  onChange={(e) => setFormData({ ...formData, fecha_traslado: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Motivo de Traslado *</label>
                <select
                  className="form-select"
                  value={formData.motivo_traslado}
                  onChange={(e) => setFormData({ ...formData, motivo_traslado: e.target.value })}
                  required
                >
                  <option value="Venta">Venta</option>
                  <option value="Traslado entre Almacenes">Traslado entre Almacenes</option>
                  <option value="Devolución">Devolución</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Tipo de Traslado *</label>
                <select
                  className="form-select"
                  value={formData.tipo_traslado}
                  onChange={(e) => setFormData({ ...formData, tipo_traslado: e.target.value })}
                  required
                >
                  <option value="Privado">Privado</option>
                  <option value="Público">Público</option>
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
                  <option value="Transporte Privado">Transporte Privado</option>
                  <option value="Transporte Público">Transporte Público</option>
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
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="card">
            <div className="card-header bg-gradient-to-r from-green-50 to-white">
              <h2 className="card-title text-green-900">
                <MapPin size={20} />
                Punto de Partida
              </h2>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Dirección de Partida</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.direccion_partida}
                  onChange={(e) => setFormData({ ...formData, direccion_partida: e.target.value })}
                  placeholder="Almacén Central"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Ubigeo de Partida</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.ubigeo_partida}
                  onChange={(e) => setFormData({ ...formData, ubigeo_partida: e.target.value })}
                  placeholder="150101"
                  maxLength="6"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header bg-gradient-to-r from-blue-50 to-white">
              <h2 className="card-title text-blue-900">
                <MapPin size={20} />
                Punto de Llegada *
              </h2>
            </div>
            <div className="card-body">
              <div className="form-group">
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
              
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Ciudad</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.ciudad_llegada}
                    onChange={(e) => setFormData({ ...formData, ciudad_llegada: e.target.value })}
                    placeholder="Ciudad"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Ubigeo</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.ubigeo_llegada}
                    onChange={(e) => setFormData({ ...formData, ubigeo_llegada: e.target.value })}
                    placeholder="Código ubigeo"
                    maxLength="6"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header bg-gradient-to-r from-gray-50 to-white">
            <h2 className="card-title">
              <Package size={20} />
              Productos a Despachar
              <span className="badge badge-primary ml-2">{productosDisponibles.length}</span>
            </h2>
          </div>
          <div className="card-body p-0">
            {productosDisponibles.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th className="text-right">Disponible</th>
                        <th className="text-right">Cantidad *</th>
                        <th>UM</th>
                        <th className="text-right">Peso Unit. (kg)</th>
                        <th className="text-right">Peso Total (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.map((item, index) => {
                        const producto = productosDisponibles.find(p => p.id_producto === item.id_producto);
                        const pesoTotal = parseFloat(item.cantidad) * parseFloat(item.peso_unitario_kg || 0);
                        
                        return (
                          <tr key={index}>
                            <td className="font-mono text-sm">{item.codigo_producto}</td>
                            <td>
                              <div className="font-medium">{item.producto}</div>
                              {parseFloat(item.cantidad) > parseFloat(producto?.stock_actual || 0) && (
                                <div className="text-xs text-danger">
                                  Stock insuficiente (disponible: {producto?.stock_actual})
                                </div>
                              )}
                            </td>
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
                            <td>
                              <input
                                type="number"
                                className="form-input text-right text-sm"
                                value={item.peso_unitario_kg}
                                onChange={(e) => handlePesoChange(index, e.target.value)}
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="text-right font-bold">
                              {pesoTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary/5">
                        <td colSpan="6" className="text-right font-bold text-primary">PESO TOTAL:</td>
                        <td className="text-right font-bold text-primary text-lg">
                          {parseFloat(formData.peso_bruto_kg).toFixed(2)} kg
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                <div className="bg-yellow-50 border-t border-yellow-200 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={18} className="text-warning flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-900">
                      <p className="font-medium">Validaciones automáticas:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Las cantidades no pueden exceder lo disponible en la orden</li>
                        <li>El stock debe ser suficiente para todas las cantidades</li>
                        <li>Solo se despacharán productos con cantidad mayor a 0</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center">
                <Package size={48} className="mx-auto text-muted opacity-20 mb-4" />
                <p className="text-muted font-medium">
                  No hay productos disponibles para despachar
                </p>
                <p className="text-sm text-muted">
                  Todos los productos de esta orden ya han sido despachados
                </p>
              </div>
            )}
          </div>
        </div>

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