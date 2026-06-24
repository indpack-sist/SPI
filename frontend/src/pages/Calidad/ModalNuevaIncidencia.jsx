import { useState, useEffect } from 'react';
import { ShieldAlert, Save, Package } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import { incidenciasAPI, productosAPI } from '../../config/api';

const SEVERIDADES = ['Crítica', 'Mayor', 'Menor'];
const FASES = ['Recepción', 'Proceso', 'Producto Terminado', 'Despacho', 'Cliente'];
const DISPOSICIONES = ['Pendiente', 'Reproceso', 'Descarte', 'Aceptar con desviación', 'Devolución'];

/**
 * Modal reutilizable para registrar una incidencia.
 * prefill: { id_orden, id_orden_venta, id_producto, producto_nombre, unidad_medida }
 *   Si llega id_producto en prefill, el producto queda fijo (no editable).
 */
function ModalNuevaIncidencia({ isOpen, onClose, onCreated, prefill = {} }) {
  const [tipos, setTipos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const productoFijo = !!prefill.id_producto;

  const [form, setForm] = useState({
    id_producto: '',
    id_tipo: '',
    severidad: 'Menor',
    fase_deteccion: 'Proceso',
    descripcion: '',
    cantidad_afectada: '',
    unidad_medida: '',
    disposicion: 'Pendiente'
  });

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setForm({
      id_producto: prefill.id_producto || '',
      id_tipo: '',
      severidad: 'Menor',
      fase_deteccion: prefill.fase_deteccion || 'Proceso',
      descripcion: '',
      cantidad_afectada: '',
      unidad_medida: prefill.unidad_medida || '',
      disposicion: 'Pendiente'
    });

    incidenciasAPI.getTipos()
      .then(res => {
        // Deduplicamos por nombre (defensa ante filas repetidas en el catálogo)
        const vistos = new Set();
        const unicos = (res.data.data || []).filter(t => {
          const clave = (t.nombre || '').trim().toLowerCase();
          if (vistos.has(clave)) return false;
          vistos.add(clave);
          return true;
        });
        setTipos(unicos);
      })
      .catch(() => setTipos([]));

    // Solo cargamos catálogo de productos si no viene uno fijo; solo los que requieren receta (BOM)
    if (!prefill.id_producto) {
      productosAPI.getAll({ estado: 'Activo', requiere_receta: 'true' })
        .then(res => setProductos(res.data.data || []))
        .catch(() => setProductos([]));
    }
  }, [isOpen]);

  const handleChange = (campo, valor) => setForm(prev => ({ ...prev, [campo]: valor }));

  const handleSubmit = async () => {
    if (!form.descripcion.trim()) {
      setError('La descripción es obligatoria.');
      return;
    }
    try {
      setGuardando(true);
      setError(null);
      const payload = {
        ...form,
        id_orden: prefill.id_orden || null,
        id_orden_venta: prefill.id_orden_venta || null,
        cantidad_afectada: form.cantidad_afectada === '' ? null : parseFloat(form.cantidad_afectada)
      };
      const res = await incidenciasAPI.create(payload);
      if (res.data.success) {
        onCreated?.(res.data.data);
        onClose();
      }
    } catch (err) {
      setError(err.error || err.response?.data?.error || 'Error al registrar la incidencia.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={<span className="flex items-center gap-2"><ShieldAlert className="text-danger" /> Registrar Incidencia de Calidad</span>}
    >
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {(prefill.numero_op || prefill.numero_ov) && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-sm flex flex-wrap gap-x-6 gap-y-1">
          {prefill.numero_op && <span><strong>O.P.:</strong> {prefill.numero_op}</span>}
          {prefill.numero_ov && <span><strong>O.V.:</strong> {prefill.numero_ov}</span>}
          {prefill.producto_nombre && <span className="flex items-center gap-1"><Package size={14} /> {prefill.producto_nombre}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!productoFijo && (
          <div className="form-group md:col-span-2">
            <label className="form-label">Producto afectado</label>
            <select
              className="form-input"
              value={form.id_producto}
              onChange={(e) => {
                const prod = productos.find(p => String(p.id_producto) === e.target.value);
                handleChange('id_producto', e.target.value);
                if (prod) handleChange('unidad_medida', prod.unidad_medida || '');
              }}
            >
              <option value="">— Sin producto específico —</option>
              {productos.map(p => (
                <option key={p.id_producto} value={p.id_producto}>
                  {p.codigo} — {p.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Tipo de defecto</label>
          <select className="form-input" value={form.id_tipo} onChange={(e) => handleChange('id_tipo', e.target.value)}>
            <option value="">— Seleccionar —</option>
            {tipos.map(t => <option key={t.id_tipo} value={t.id_tipo}>{t.nombre}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Severidad</label>
          <select className="form-input" value={form.severidad} onChange={(e) => handleChange('severidad', e.target.value)}>
            {SEVERIDADES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Fase de detección</label>
          <select className="form-input" value={form.fase_deteccion} onChange={(e) => handleChange('fase_deteccion', e.target.value)}>
            {FASES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Disposición</label>
          <select className="form-input" value={form.disposicion} onChange={(e) => handleChange('disposicion', e.target.value)}>
            {DISPOSICIONES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Cantidad afectada</label>
          <input
            type="number"
            step="0.01"
            className="form-input"
            value={form.cantidad_afectada}
            onChange={(e) => handleChange('cantidad_afectada', e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Unidad</label>
          <input
            type="text"
            className="form-input"
            value={form.unidad_medida}
            onChange={(e) => handleChange('unidad_medida', e.target.value)}
            placeholder="Kg / Und"
          />
        </div>

        <div className="form-group md:col-span-2">
          <label className="form-label">Descripción del problema <span className="text-danger">*</span></label>
          <textarea
            className="form-input"
            rows={4}
            value={form.descripcion}
            onChange={(e) => handleChange('descripcion', e.target.value)}
            placeholder="Describe la no conformidad detectada..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button className="btn btn-outline" onClick={onClose} disabled={guardando}>Cancelar</button>
        <button className="btn btn-primary flex items-center gap-2" onClick={handleSubmit} disabled={guardando}>
          <Save size={16} /> {guardando ? 'Guardando...' : 'Registrar Incidencia'}
        </button>
      </div>
    </Modal>
  );
}

export default ModalNuevaIncidencia;
