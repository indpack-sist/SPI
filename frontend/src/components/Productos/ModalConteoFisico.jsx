import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Loader, ClipboardCheck } from 'lucide-react';
import Modal from '../UI/Modal';
import { api } from '../../config/api';
import { fmtCantidad } from '../../pages/Productos/estadosProductos';
import '../../pages/Productos/Productos.css';

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
      const response = await api.get('/productos/ajustes/motivos');
      
      if (response.data.success) {
        setMotivos(response.data.data);
      }
    } catch {
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
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No hay sesión activa. Por favor inicia sesión nuevamente.');
      }

      const response = await api.post('/productos/ajustes/conteo-fisico', {
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
      } else {
        throw new Error(response.data.error || 'Error desconocido');
      }

    } catch (err) {
      let mensajeError = 'Error al realizar el conteo físico';
      
      if (err.response?.data?.error) {
        mensajeError = err.response.data.error;
      } else if (err.error) {
        mensajeError = err.error;
      } else if (err.message) {
        mensajeError = err.message;
      }
      
      setError(mensajeError);
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

  const unidad = producto.unidad_medida;
  const hayDiferencia = diferencia !== null && diferencia !== 0;
  const esSobrante = tipoAjuste === 'Positivo';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Conteo físico de inventario" size="lg">
      <form onSubmit={handleSubmit}>
        <div className="pr-stock-box pr-conteo-head">
          <div>
            <strong className="pr-conteo-name">{producto.nombre}</strong>
            <span className="pg-code">{producto.codigo}</span>
          </div>
          <div className="pg-kv pr-kv-flat">
            <div><span>Stock en sistema</span><strong>{fmtCantidad(stockSistema)} {unidad}</strong></div>
          </div>
        </div>

        {error && (
          <div className="pr-note is-danger" role="alert">
            <AlertTriangle size={16} />
            <p>{error}</p>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="pr-conteo-fisico">Stock físico contado * <span className="pg-muted">({unidad})</span></label>
          <input
            id="pr-conteo-fisico"
            type="number"
            step="0.01"
            className="form-input"
            value={formData.stock_fisico}
            onChange={(e) => setFormData({ ...formData, stock_fisico: e.target.value })}
            placeholder={`Ej: ${stockSistema.toFixed(2)}`}
            required
          />
          <small className="pg-hint">Ingresa la cantidad exacta encontrada en el inventario físico.</small>
        </div>

        {hayDiferencia && (
          <div className={`pr-delta ${esSobrante ? 'is-in' : 'is-out'}`}>
            <div className="pr-delta-head">
              {esSobrante ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <strong>Ajuste {tipoAjuste.toLowerCase()} · {esSobrante ? 'sobrante: hay más stock del registrado' : 'faltante: hay menos stock del registrado'}</strong>
            </div>
            <div className="pg-kv pr-kv-flat">
              <div><span>Diferencia</span><strong className={`pr-qty ${esSobrante ? 'is-in' : 'is-out'}`}>{diferencia > 0 ? '+' : '−'}{fmtCantidad(Math.abs(diferencia), 2)} {unidad}</strong></div>
              <div><span>Stock nuevo</span><strong>{fmtCantidad(formData.stock_fisico, 2)} {unidad}</strong></div>
            </div>
          </div>
        )}

        {diferencia === 0 && formData.stock_fisico !== '' && (
          <div className="pr-note is-success">
            <CheckCircle size={16} />
            <p><strong>Stock correcto</strong>El stock físico coincide con el del sistema; no hay nada que ajustar.</p>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="pr-conteo-motivo">Motivo del ajuste *</label>
          <select
            id="pr-conteo-motivo"
            className="form-select"
            value={formData.motivo}
            onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
            required
            disabled={!hayDiferencia}
          >
            <option value="">Seleccione un motivo...</option>
            {motivos.map((motivo) => (
              <option key={motivo.value} value={motivo.value}>{motivo.label}</option>
            ))}
          </select>
          {motivos.length === 0 && <small className="pg-hint">Cargando motivos...</small>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="pr-conteo-obs">Observaciones</label>
          <textarea
            id="pr-conteo-obs"
            className="form-textarea"
            value={formData.observaciones}
            onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
            placeholder="Ubicación, condición del producto u otros detalles (opcional)"
            rows={3}
          />
        </div>

        {hayDiferencia && (
          <div className="pr-note is-warning">
            <AlertTriangle size={16} />
            <div>
              <strong>Confirma antes de continuar</strong>
              <ul>
                <li>El stock del sistema pasará a <b>{fmtCantidad(formData.stock_fisico, 2)} {unidad}</b>.</li>
                <li>El ajuste quedará registrado en el historial del producto.</li>
                <li>La acción no se puede deshacer.</li>
              </ul>
            </div>
          </div>
        )}

        <div className="pr-form-actions">
          <button type="button" className="btn btn-outline" onClick={handleClose} disabled={loading}>Cancelar</button>
          <button
            type="submit"
            className={`btn ${tipoAjuste === 'Positivo' ? 'btn-success' : tipoAjuste === 'Negativo' ? 'btn-danger' : 'btn-primary'}`}
            disabled={loading || !hayDiferencia}
          >
            {loading ? <><Loader size={16} className="animate-spin" /> Procesando...</> : (
              <>
                <ClipboardCheck size={16} />
                {tipoAjuste === 'Positivo' ? 'Registrar sobrante' : tipoAjuste === 'Negativo' ? 'Registrar faltante' : 'Realizar ajuste'}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default ModalConteoFisico;
