import { useState, useEffect } from 'react';
import { Truck, MapPin, Package, AlertCircle } from 'lucide-react';
import Modal from '../UI/Modal';
import Alert from '../UI/Alert';
import UbigeoSelector from '../common/UbigeoSelector';
import { guiasRemisionAPI, ordenesVentaAPI } from '../../config/api';

// Wizard de Guía de Remisión de COMPRA (motivo 02): SPI recoge su mercadería con flota propia.
// Partida = dirección del proveedor (texto libre; el maestro de proveedores no guarda dirección).
// Llegada = almacén de SPI. Al crear, el backend ingresa el stock (una entrada por tipo de inventario)
// y deja la guía lista para emitir la GRE a SUNAT desde su detalle.
export default function ModalGuiaCompra({ isOpen, onClose, compra, onCreated }) {
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [conductores, setConductores] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);

  const hoy = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    fecha_traslado: hoy,
    direccion_partida: '', ubigeo_partida: '',
    direccion_llegada: '', ubigeo_llegada: '',
    peso_bruto_kg: '', numero_bultos: '',
    id_conductor: '', id_vehiculo: '',
  });
  // Solo ítems de catálogo (id_producto). Los manuales de la compra no ingresan a inventario.
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setForm((f) => ({ ...f, fecha_traslado: hoy }));
    setItems((compra?.detalle || [])
      .filter((d) => d.id_producto)
      .map((d) => ({
        id_producto: d.id_producto,
        nombre: d.producto || d.codigo_producto,
        unidad: d.unidad_medida || 'UND',
        cantidad: parseFloat(d.cantidad) || 0,
      })));
    Promise.all([ordenesVentaAPI.getConductores(), ordenesVentaAPI.getVehiculos()])
      .then(([c, v]) => {
        setConductores(c.data?.data || c.data || []);
        setVehiculos(v.data?.data || v.data || []);
      })
      .catch(() => {});
    // Llegada = tu almacén: se prellena con la dirección/ubigeo de la empresa (editable).
    guiasRemisionAPI.getEmpresaRemitente()
      .then((r) => {
        const e = r.data?.data || {};
        setForm((f) => ({
          ...f,
          direccion_llegada: f.direccion_llegada || e.direccion || '',
          ubigeo_llegada: f.ubigeo_llegada || e.ubigeo || '',
        }));
      })
      .catch(() => {});
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (campo, val) => setForm((f) => ({ ...f, [campo]: val }));
  const setItem = (i, val) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, cantidad: val } : it));

  const crear = async () => {
    setError(null);
    if (!form.direccion_partida.trim()) return setError('Ingresa la dirección de partida (proveedor).');
    if (!/^\d{6}$/.test(form.ubigeo_partida)) return setError('Selecciona el ubigeo de partida (proveedor).');
    if (!form.direccion_llegada.trim()) return setError('Ingresa la dirección de llegada (tu almacén).');
    if (!/^\d{6}$/.test(form.ubigeo_llegada)) return setError('Selecciona el ubigeo de llegada.');
    if (!(parseFloat(form.peso_bruto_kg) > 0)) return setError('El peso bruto (kg) debe ser mayor a 0.');
    if (!form.id_conductor || !form.id_vehiculo) return setError('Selecciona el conductor y el vehículo de la flota.');
    const detalle = items.filter((it) => parseFloat(it.cantidad) > 0)
      .map((it) => ({ id_producto: it.id_producto, cantidad: parseFloat(it.cantidad) }));
    if (!detalle.length) return setError('Indica la cantidad recibida de al menos un producto.');

    setSubmitting(true);
    try {
      const { data } = await guiasRemisionAPI.createCompra({
        id_orden_compra: compra.id_orden_compra,
        fecha_emision: hoy,
        fecha_traslado: form.fecha_traslado,
        direccion_partida: form.direccion_partida,
        ubigeo_partida: form.ubigeo_partida,
        direccion_llegada: form.direccion_llegada,
        ubigeo_llegada: form.ubigeo_llegada,
        peso_bruto_kg: parseFloat(form.peso_bruto_kg),
        numero_bultos: parseInt(form.numero_bultos) || 0,
        id_conductor: parseInt(form.id_conductor),
        id_vehiculo: parseInt(form.id_vehiculo),
        detalle,
      });
      if (data.success) {
        onCreated?.(data.data?.id_guia, data.data?.numero_guia);
      } else {
        setError(data.error || 'No se pudo crear la guía.');
      }
    } catch (err) {
      setError(err?.error || err?.response?.data?.error || err?.message || 'No se pudo crear la guía.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Emitir Guía de Remisión (Compra)" size="lg">
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <div className="text-sm text-muted mb-3 flex items-start gap-2">
        <AlertCircle size={16} className="shrink-0 mt-0.5" />
        La mercadería la recoge tu flota (motivo <b>02 Compra</b>). Al crear la guía se ingresa el stock; luego podrás emitir la GRE a SUNAT desde su detalle.
      </div>

      {/* Transporte */}
      <div className="mb-4">
        <h3 className="font-semibold flex items-center gap-2 mb-2"><Truck size={16} /> Transporte (flota propia)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="form-label">Fecha de traslado</label>
            <input type="date" className="form-input" value={form.fecha_traslado} onChange={(e) => set('fecha_traslado', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Conductor</label>
            <select className="form-select" value={form.id_conductor} onChange={(e) => set('id_conductor', e.target.value)}>
              <option value="">— Seleccionar —</option>
              {conductores.map((c) => (
                <option key={c.id_empleado} value={c.id_empleado}>{c.nombre_completo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Vehículo</label>
            <select className="form-select" value={form.id_vehiculo} onChange={(e) => set('id_vehiculo', e.target.value)}>
              <option value="">— Seleccionar —</option>
              {vehiculos.map((v) => (
                <option key={v.id_vehiculo} value={v.id_vehiculo}>{v.placa}{v.marca ? ` · ${v.marca}` : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Puntos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2 mb-2"><MapPin size={16} /> Partida (proveedor)</h3>
          <label className="form-label">Dirección</label>
          <input className="form-input mb-2" placeholder="Dirección del proveedor" value={form.direccion_partida} onChange={(e) => set('direccion_partida', e.target.value)} />
          <label className="form-label">Ubigeo</label>
          <UbigeoSelector value={form.ubigeo_partida} onChange={(cod) => set('ubigeo_partida', cod)} required />
        </div>
        <div>
          <h3 className="font-semibold flex items-center gap-2 mb-2"><MapPin size={16} /> Llegada (tu almacén)</h3>
          <label className="form-label">Dirección</label>
          <input className="form-input mb-2" placeholder="Dirección de tu almacén" value={form.direccion_llegada} onChange={(e) => set('direccion_llegada', e.target.value)} />
          <label className="form-label">Ubigeo</label>
          <UbigeoSelector value={form.ubigeo_llegada} onChange={(cod) => set('ubigeo_llegada', cod)} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="form-label">Peso bruto total (kg)</label>
          <input type="number" step="0.01" min="0" className="form-input" value={form.peso_bruto_kg} onChange={(e) => set('peso_bruto_kg', e.target.value)} />
        </div>
        <div>
          <label className="form-label">N.º de bultos</label>
          <input type="number" min="0" className="form-input" value={form.numero_bultos} onChange={(e) => set('numero_bultos', e.target.value)} />
        </div>
      </div>

      {/* Ítems recibidos */}
      <div className="mb-4">
        <h3 className="font-semibold flex items-center gap-2 mb-2"><Package size={16} /> Cantidad recibida</h3>
        <p className="text-muted text-sm mb-2">Ajusta la cantidad que realmente llega (puede ser parcial o mayor a la facturada).</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Producto</th>
              <th className="p-2">Unid.</th>
              <th className="p-2 text-right">Recibido</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id_producto} className="border-b">
                <td className="p-2">{it.nombre}</td>
                <td className="p-2">{it.unidad}</td>
                <td className="p-2 text-right">
                  <input type="number" step="0.0001" min="0" className="form-input form-input-sm w-28 text-right"
                    value={it.cantidad} onChange={(e) => setItem(i, e.target.value)} />
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={3} className="p-3 text-center text-muted">La compra no tiene productos de catálogo para trasladar.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancelar</button>
        <button className="btn btn-primary" onClick={crear} disabled={submitting || items.length === 0}>
          <Truck size={18} /> {submitting ? 'Creando…' : 'Crear Guía e Ingresar Stock'}
        </button>
      </div>
    </Modal>
  );
}
