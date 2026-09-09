import { useState, useEffect } from 'react';
import { Truck, MapPin, Package, AlertCircle, ChevronLeft, ChevronRight, FileCheck } from 'lucide-react';
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
  const [okMsg, setOkMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [conductores, setConductores] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [paso, setPaso] = useState(0);

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
    setOkMsg(null);
    setPaso(0);
    setForm((f) => ({ ...f, fecha_traslado: hoy }));
    setItems((compra?.detalle || [])
      .filter((d) => d.id_producto)
      .map((d) => {
        const conservaDocumento = !!(d.codigo_documento && d.descripcion_documento && d.unidad_documento_sunat);
        return {
          id_detalle_compra: d.id_detalle,
          id_producto: d.id_producto,
          codigo_documento: conservaDocumento ? d.codigo_documento : '',
          nombre_documento: conservaDocumento ? d.descripcion_documento : '',
          producto_interno: d.producto || d.codigo_producto,
          unidad: conservaDocumento ? d.unidad_documento_sunat : '',
          conserva_documento_xml: conservaDocumento,
          cantidad: parseFloat(d.cantidad) || 0,
        };
      }));
    Promise.all([ordenesVentaAPI.getConductores(), ordenesVentaAPI.getVehiculos()])
      .then(([c, v]) => {
        setConductores(c.data?.data || c.data || []);
        setVehiculos(v.data?.data || v.data || []);
      })
      .catch(() => {});
    // Llegada = tu almacén: empresa_config es la fuente autoritativa (solo lectura).
    guiasRemisionAPI.getEmpresaRemitente()
      .then((r) => {
        const e = r.data?.data || {};
        setEmpresa(e);
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
  const setItemCampo = (i, campo, val) => setItems((prev) => prev.map((it, idx) => (
    idx === i ? { ...it, [campo]: val } : it
  )));
  const conductorSeleccionado = conductores.find((c) => String(c.id_empleado) === String(form.id_conductor));
  const vehiculoSeleccionado = vehiculos.find((v) => String(v.id_vehiculo) === String(form.id_vehiculo));

  const validar = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fecha_traslado)) return 'Selecciona una fecha de traslado válida.';
    if (!/^\d{11}$/.test(String(empresa?.ruc || '').trim())) return 'La empresa no tiene un RUC válido configurado.';
    if (!/^\d{11}$/.test(String(compra?.ruc_proveedor || '').trim())) return 'El proveedor no tiene un RUC válido registrado.';
    if (!String(compra?.serie_documento || '').trim() || !String(compra?.numero_documento || '').trim()) return 'La compra no tiene una factura relacionada completa.';
    if (!form.direccion_partida.trim()) return 'Ingresa la dirección de partida (proveedor).';
    if (!/^\d{6}$/.test(form.ubigeo_partida)) return 'Selecciona el ubigeo de partida (proveedor).';
    if (!form.direccion_llegada.trim()) return 'Falta la dirección de llegada en la configuración de empresa.';
    if (!/^\d{6}$/.test(form.ubigeo_llegada)) return 'Falta un ubigeo válido en la configuración de empresa.';
    if (!(parseFloat(form.peso_bruto_kg) > 0)) return 'El peso bruto (kg) debe ser mayor a 0.';
    if (!form.id_conductor || !form.id_vehiculo) return 'Selecciona el conductor y el vehículo de la flota.';
    if (!/^\d{8}$/.test(String(conductorSeleccionado?.dni || '').trim())) return 'El conductor seleccionado no tiene un DNI válido registrado.';
    if (!String(conductorSeleccionado?.licencia_conducir || '').trim()) return 'El conductor seleccionado no tiene licencia de conducir registrada.';
    if (!/^[A-Z0-9]{6,8}$/.test(String(vehiculoSeleccionado?.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))) return 'El vehículo seleccionado no tiene una placa válida registrada.';
    const legadoIncompleto = items.find((it) => parseFloat(it.cantidad) > 0 && !it.conserva_documento_xml
      && (!it.codigo_documento?.trim() || !it.nombre_documento?.trim() || !it.unidad?.trim()));
    if (legadoIncompleto) return 'Completa código, descripción y unidad SUNAT del comprobante para los productos históricos.';
    if (!items.some((it) => parseFloat(it.cantidad) > 0)) return 'Indica la cantidad recibida de al menos un producto.';
    return null;
  };

  const revisar = () => {
    setError(null);
    const mensaje = validar();
    if (mensaje) return setError(mensaje);
    setPaso(1);
  };

  const crear = async () => {
    setError(null);
    const mensaje = validar();
    if (mensaje) return setError(mensaje);
    const detalle = items.filter((it) => parseFloat(it.cantidad) > 0)
      .map((it) => ({
        id_detalle_compra: it.id_detalle_compra,
        id_producto: it.id_producto,
        cantidad: parseFloat(it.cantidad),
        codigo_documento: it.codigo_documento?.trim() || null,
        descripcion_documento: it.nombre_documento?.trim() || null,
        unidad_documento_sunat: it.unidad?.trim().toUpperCase() || null,
      }));
    if (!detalle.length) return setError('Indica la cantidad recibida de al menos un producto.');

    setSubmitting(true);
    try {
      const { data } = await guiasRemisionAPI.createCompra({
        id_orden_compra: compra.id_orden_compra,
        fecha_emision: hoy,
        fecha_traslado: form.fecha_traslado,
        direccion_partida: form.direccion_partida,
        ubigeo_partida: form.ubigeo_partida,
        peso_bruto_kg: parseFloat(form.peso_bruto_kg),
        numero_bultos: parseInt(form.numero_bultos) || 0,
        id_conductor: parseInt(form.id_conductor),
        id_vehiculo: parseInt(form.id_vehiculo),
        detalle,
      });
      if (data.success) {
        const d = data.data || {};
        setOkMsg(data.message || 'Guía de compra creada.');
        setTimeout(() => onCreated?.(d.id_guia, d.numero_guia), 1600);
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
      {okMsg && <Alert type="success" message={okMsg} />}

      <div className="text-sm text-muted mb-3 flex items-start gap-2">
        <AlertCircle size={16} className="shrink-0 mt-0.5" />
        La mercadería la recoge tu flota (motivo <b>02 Compra</b>). Al crear la guía se ingresa el stock; luego podrás emitir la GRE a SUNAT desde su detalle.
      </div>

      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className={`px-2 py-1 rounded ${paso === 0 ? 'bg-primary text-white' : 'bg-gray-100'}`}>1. Datos de traslado</span>
        <span className="text-muted">→</span>
        <span className={`px-2 py-1 rounded ${paso === 1 ? 'bg-primary text-white' : 'bg-gray-100'}`}>2. Vista previa SUNAT</span>
      </div>

      <div className={paso === 1 ? 'hidden' : ''}>

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
            {conductorSeleccionado && (
              <div className={`text-xs mt-1 ${conductorSeleccionado.licencia_conducir ? 'text-muted' : 'text-danger'}`}>
                DNI: <span className="font-mono">{conductorSeleccionado.dni || '—'}</span> · Licencia: <span className="font-mono">{conductorSeleccionado.licencia_conducir || 'NO REGISTRADA'}</span>
              </div>
            )}
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
          <h3 className="font-semibold flex items-center gap-2 mb-2"><MapPin size={16} /> Llegada (empresa_config)</h3>
          <label className="form-label">Dirección</label>
          <input className="form-input mb-2 bg-gray-50" value={form.direccion_llegada} readOnly placeholder="Configura la dirección de la empresa" />
          <label className="form-label">Ubigeo</label>
          <input className="form-input bg-gray-50 font-mono" value={form.ubigeo_llegada} readOnly placeholder="Configura el ubigeo de la empresa" />
          <small className="text-gray-500">Se toma de la configuración de empresa y no se puede modificar desde la guía.</small>
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
              <tr key={it.id_detalle_compra || `${it.id_producto}-${i}`} className="border-b">
                <td className="p-2">
                  {it.conserva_documento_xml ? (
                    <>
                      <div className="font-medium">{it.nombre_documento}</div>
                      {it.codigo_documento && <div className="text-xs font-mono text-muted">{it.codigo_documento}</div>}
                    </>
                  ) : (
                    <div className="space-y-1">
                      <input className="form-input form-input-sm w-full" value={it.nombre_documento}
                        onChange={(e) => setItemCampo(i, 'nombre_documento', e.target.value)}
                        placeholder="Descripción exacta del XML" />
                      <input className="form-input form-input-sm w-full font-mono" value={it.codigo_documento}
                        onChange={(e) => setItemCampo(i, 'codigo_documento', e.target.value)}
                        placeholder="Código exacto del XML" />
                      <div className="text-xs text-warning">Compra histórica: confirma los datos exactos del comprobante.</div>
                    </div>
                  )}
                  {it.producto_interno && it.producto_interno !== it.nombre_documento && (
                    <div className="text-xs text-muted mt-1">Vinculado en inventario a: {it.producto_interno}</div>
                  )}
                </td>
                <td className="p-2">
                  {it.conserva_documento_xml ? it.unidad : (
                    <input className="form-input form-input-sm w-20 uppercase" value={it.unidad}
                      onChange={(e) => setItemCampo(i, 'unidad', e.target.value.toUpperCase())}
                      placeholder="KGM" />
                  )}
                </td>
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
      </div>

      {paso === 1 && (
        <div className="space-y-3 mb-4">
          <div className="rounded border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
            <FileCheck size={18} className="text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Vista previa de lo que se declarará a SUNAT</div>
              <div className="text-xs text-muted">La guía interna se creará con estos mismos datos. Después, el panel SEE los volverá a mostrar antes del envío definitivo.</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="bg-gray-50 rounded p-2"><div className="text-[10px] text-muted uppercase">Documento</div><div className="font-semibold">GRE Remitente (09)</div><div className="text-xs">Motivo 02 · Compra</div></div>
            <div className="bg-gray-50 rounded p-2"><div className="text-[10px] text-muted uppercase">Factura relacionada</div><div className="font-mono font-semibold">{compra?.serie_documento && compra?.numero_documento ? `${compra.serie_documento}-${compra.numero_documento}` : '—'}</div></div>
            <div className="bg-gray-50 rounded p-2"><div className="text-[10px] text-muted uppercase">Fecha traslado</div><div className="font-semibold">{form.fecha_traslado}</div></div>
            <div className="bg-gray-50 rounded p-2"><div className="text-[10px] text-muted uppercase">Carga</div><div className="font-semibold">{form.peso_bruto_kg} KGM</div><div className="text-xs">{form.numero_bultos || 0} bultos</div></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="border rounded p-3"><div className="text-[10px] text-muted uppercase mb-1">Remitente y destinatario</div><div className="font-medium">{empresa?.razon_social || '—'}</div><div className="font-mono text-xs">RUC {empresa?.ruc || '—'}</div></div>
            <div className="border rounded p-3"><div className="text-[10px] text-muted uppercase mb-1">Proveedor</div><div className="font-medium">{compra?.proveedor || '—'}</div><div className="font-mono text-xs">RUC {compra?.ruc_proveedor || '—'}</div></div>
            <div className="border rounded p-3"><div className="text-[10px] text-muted uppercase mb-1">Partida</div><div>{form.direccion_partida}</div><div className="font-mono text-xs mt-1">Ubigeo {form.ubigeo_partida}</div></div>
            <div className="border rounded p-3"><div className="text-[10px] text-muted uppercase mb-1">Llegada</div><div>{form.direccion_llegada}</div><div className="font-mono text-xs mt-1">Ubigeo {form.ubigeo_llegada}</div></div>
          </div>

          <div className="border rounded p-3 text-sm">
            <div className="text-[10px] text-muted uppercase mb-2">Transporte privado (02)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              <div><span className="text-muted">Conductor:</span> {conductorSeleccionado?.nombre_completo}</div>
              <div><span className="text-muted">DNI:</span> <span className="font-mono">{conductorSeleccionado?.dni}</span></div>
              <div><span className="text-muted">Licencia:</span> <span className="font-mono font-semibold">{conductorSeleccionado?.licencia_conducir}</span></div>
              <div><span className="text-muted">Placa:</span> <span className="font-mono font-semibold">{vehiculoSeleccionado?.placa}</span></div>
            </div>
          </div>

          <div className="border rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="p-2 text-left">Código SUNAT</th><th className="p-2 text-left">Descripción documental</th><th className="p-2 text-center">Unidad</th><th className="p-2 text-right">Cantidad</th></tr></thead>
              <tbody>{items.filter((it) => parseFloat(it.cantidad) > 0).map((it, i) => (
                <tr key={it.id_detalle_compra || i} className="border-t"><td className="p-2 font-mono">{it.codigo_documento}</td><td className="p-2"><div className="font-medium">{it.nombre_documento}</div>{it.producto_interno !== it.nombre_documento && <div className="text-xs text-muted">Inventario: {it.producto_interno}</div>}</td><td className="p-2 text-center">{it.unidad}</td><td className="p-2 text-right font-semibold">{parseFloat(it.cantidad)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose} disabled={submitting || !!okMsg}>Cancelar</button>
        {paso === 1 && <button className="btn btn-outline" onClick={() => setPaso(0)} disabled={submitting || !!okMsg}><ChevronLeft size={18} /> Editar datos</button>}
        {paso === 0 ? (
          <button className="btn btn-primary" onClick={revisar} disabled={submitting || !!okMsg || items.length === 0}>Revisar vista previa <ChevronRight size={18} /></button>
        ) : (
          <button className="btn btn-primary" onClick={crear} disabled={submitting || !!okMsg || items.length === 0}>
            <Truck size={18} /> {submitting ? 'Creando…' : okMsg ? 'Creada ✓' : 'Confirmar y crear guía'}
          </button>
        )}
      </div>
    </Modal>
  );
}
