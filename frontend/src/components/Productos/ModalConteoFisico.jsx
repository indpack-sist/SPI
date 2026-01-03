import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Package, TrendingUp, TrendingDown } from 'lucide-react';
import Modal from '../UI/Modal';
import { productosAPI } from '../../config/api';

function ModalConteoFisico({ isOpen, onClose, producto, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [motivos, setMotivos] = useState([]);
  
  const [formData, setFormData] = useState({
    stock_fisico: '',
    motivo: '',
    observaciones: ''
  });

  const [diferencia, setDiferencia] = useState(null);
  const [tipoAjuste, setTipoAjuste] = useState(null);

  useEffect(() => {
    if (isOpen) {
      cargarMotivos();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.stock_fisico !== '' && producto) {
      const stockSistema = parseFloat(producto.stock_actual || 0);
      const stockFisico = parseFloat(formData.stock_fisico);
      const diff = stockFisico - stockSistema;
      
      setDiferencia(diff);
      setTipoAjuste(diff > 0 ? 'Positivo' : diff < 0 ? 'Negativo' : null);
    } else {
      setDiferencia(null);
      setTipoAjuste(null);
    }
  }, [formData.stock_fisico, producto]);

  const cargarMotivos = async () => {
    try {
      const response = await productosAPI.ajustes.getMotivos();
      
      if (response.data.success) {
        setMotivos(response.data.data);
      }
    } catch (err) {
      console.error('Error al cargar motivos:', err);
      setError('Error al cargar los motivos de ajuste');
    }
  };

  const resetForm = () => {
    setFormData({
      stock_fisico: '',
      motivo: '',
      observaciones: ''
    });
    setDiferencia(null);
    setTipoAjuste(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.stock_fisico || !formData.motivo) {
      setError('Stock físico y motivo son requeridos');
      return;
    }

    if (diferencia === 0) {
      setError('No hay diferencia entre el stock del sistema y el stock físico');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await productosAPI.ajustes.realizarConteo({
        id_producto: producto.id_producto,
        stock_fisico: parseFloat(formData.stock_fisico),
        motivo: formData.motivo,
        observaciones: formData.observaciones || null
      });

      if (response.data.success) {
        if (onSuccess) {
          onSuccess(response.data.data);
        }
        onClose();
        resetForm();
      }

    } catch (err) {
      console.error('Error al realizar conteo físico:', err);
      setError(err.error || err.message || 'Error al realizar el conteo físico');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  if (!producto) return null;

  const stockSistema = parseFloat(producto.stock_actual || 0);
  const valorAjuste = diferencia && producto.costo_unitario_promedio 
    ? Math.abs(diferencia) * parseFloat(producto.costo_unitario_promedio)
    : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Conteo Físico de Inventario"
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        {/* Información del Producto */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Package size={24} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{producto.nombre}</h3>
              <p className="text-sm text-gray-600">Código: {producto.codigo}</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="text-sm">
                  <span className="text-gray-500">Stock Sistema:</span>
                  <span className="ml-2 font-semibold text-gray-900">
                    {stockSistema.toFixed(2)} {producto.unidad_medida}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">CUP:</span>
                  <span className="ml-2 font-semibold text-gray-900">
                    S/ {parseFloat(producto.costo_unitario_promedio || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
        )}

        {/* Formulario */}
        <div className="space-y-4">
          {/* Stock Físico */}
          <div className="form-group">
            <label className="form-label">
              Stock Físico Contado *
              <span className="text-xs text-gray-500 ml-2">
                ({producto.unidad_medida})
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              value={formData.stock_fisico}
              onChange={(e) => setFormData({ ...formData, stock_fisico: e.target.value })}
              placeholder={`Ej: ${stockSistema.toFixed(2)}`}
              required
              autoFocus
            />
            <small className="text-muted">
              Ingresa la cantidad exacta que encontraste en el inventario físico
            </small>
          </div>

          {/* Resumen de Diferencia */}
          {diferencia !== null && diferencia !== 0 && (
            <div className={`p-4 rounded-lg border-2 ${
              tipoAjuste === 'Positivo' 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {tipoAjuste === 'Positivo' ? (
                  <TrendingUp size={20} className="text-green-600" />
                ) : (
                  <TrendingDown size={20} className="text-red-600" />
                )}
                <span className={`font-semibold ${
                  tipoAjuste === 'Positivo' ? 'text-green-900' : 'text-red-900'
                }`}>
                  Ajuste {tipoAjuste}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Diferencia</p>
                  <p className={`font-bold ${
                    tipoAjuste === 'Positivo' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {diferencia > 0 ? '+' : ''}{diferencia.toFixed(2)} {producto.unidad_medida}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Valor del Ajuste</p>
                  <p className="font-bold text-gray-900">
                    S/ {valorAjuste.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Stock Nuevo</p>
                  <p className="font-bold text-gray-900">
                    {parseFloat(formData.stock_fisico).toFixed(2)} {producto.unidad_medida}
                  </p>
                </div>
              </div>

              {tipoAjuste === 'Positivo' && (
                <p className="text-xs text-green-700 mt-2">
                  ✓ Se encontró más stock del registrado en el sistema
                </p>
              )}
              {tipoAjuste === 'Negativo' && (
                <p className="text-xs text-red-700 mt-2">
                  ⚠ Falta stock registrado en el sistema
                </p>
              )}
            </div>
          )}

          {diferencia === 0 && formData.stock_fisico !== '' && (
            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">
                  Stock correcto - No hay diferencia
                </span>
              </div>
              <p className="text-xs text-blue-700 mt-1">
                El stock físico coincide con el stock del sistema
              </p>
            </div>
          )}

          {/* Motivo */}
          <div className="form-group">
            <label className="form-label">Motivo del Ajuste *</label>
            <select
              className="form-select"
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              required
              disabled={diferencia === 0 || diferencia === null}
            >
              <option value="">Seleccione un motivo...</option>
              {motivos.map((motivo) => (
                <option key={motivo.value} value={motivo.value}>
                  {motivo.label}
                </option>
              ))}
            </select>
            {motivos.length === 0 && (
              <small className="text-red-500">Cargando motivos...</small>
            )}
          </div>

          {/* Observaciones */}
          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea
              className="form-textarea"
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              placeholder="Detalles adicionales sobre el conteo físico (opcional)"
              rows={3}
            />
            <small className="text-muted">
              Especifica detalles como ubicación, condición del producto, etc.
            </small>
          </div>
        </div>

        {/* Advertencia */}
        {diferencia !== null && diferencia !== 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold">Confirma antes de continuar:</p>
                <ul className="mt-1 ml-4 list-disc space-y-1">
                  <li>El stock del sistema se actualizará a <strong>{formData.stock_fisico} {producto.unidad_medida}</strong></li>
                  <li>Este ajuste quedará registrado en el historial</li>
                  <li>La acción no se puede deshacer</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 justify-end mt-6">
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={`btn ${
              tipoAjuste === 'Positivo' ? 'btn-success' : 
              tipoAjuste === 'Negativo' ? 'btn-danger' : 
              'btn-primary'
            }`}
            disabled={loading || diferencia === 0 || diferencia === null}
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Procesando...
              </>
            ) : (
              <>
                {tipoAjuste === 'Positivo' && '✓ Registrar Sobrante'}
                {tipoAjuste === 'Negativo' && '⚠ Registrar Faltante'}
                {(!tipoAjuste || diferencia === 0) && 'Realizar Ajuste'}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default ModalConteoFisico;