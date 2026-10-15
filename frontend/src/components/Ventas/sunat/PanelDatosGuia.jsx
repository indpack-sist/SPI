import { useState, useEffect } from 'react';
import {
  Truck, Edit, User, IdCard, MapPin, Package, Calendar, Building2,
  ShieldCheck, Save, X, AlertCircle, CheckCircle
} from 'lucide-react';
import Modal from '../../UI/Modal';
import Alert from '../../UI/Alert';
import UbigeoSelector from '../../common/UbigeoSelector';
import { guiasRemisionAPI, ordenesVentaAPI } from '../../../config/api';

const MODO_LABEL = {
  tercero: 'Transporte público / tercero',
  particular: 'Vehículo particular',
  flota: 'Flota propia',
};

function Dato({ etiqueta, valor, mono = false }) {
  return (
    <div>
      <label className="text-xs text-muted uppercase font-semibold">{etiqueta}</label>
      <p className={`${mono ? 'font-mono' : 'font-medium'}`}>{valor || valor === 0 ? valor : '—'}</p>
    </div>
  );
}

function modoDeGuia(guia) {
  if (guia?.id_transportista) return 'tercero';
  if (guia?.transporte_modo === 'particular' || (guia?.transporte_placa && !guia?.id_vehiculo)) return 'particular';
  return 'flota';
}

function estadoFecha(valor) {
  if (!valor) return '';
  const m = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valor).slice(0, 10);
}

function PanelDatosGuia({ guia, onRefresh, soloLectura = false }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const [conductores, setConductores] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [transportistas, setTransportistas] = useState([]);

  const [form, setForm] = useState(null);
  const [topes, setTopes] = useState({});

  const modo = modoDeGuia(guia);
  const esComex = Number(guia?.es_comercio_exterior) === 1;
  const registrar = guia?.transporte_registrar !== 0;

  const despachada = ['En Tránsito', 'Entregada'].includes(guia?.estado);
  const bloqueada = ['ACEPTADO', 'ENVIADO'].includes(guia?.sunat_estado) || guia?.estado === 'Anulada' || despachada;
  const puedeEditar = !soloLectura && !bloqueada && guia?.tipo_origen !== 'Compra';
  const editarLineas = puedeEditar && !esComex;

  useEffect(() => {
    if (!modalOpen) return;
    let activo = true;
    (async () => {
      try {
        const [rc, rv, rt] = await Promise.all([
          ordenesVentaAPI.getConductores(),
          ordenesVentaAPI.getVehiculos(),
          guiasRemisionAPI.getTransportistas(),
        ]);
        if (!activo) return;
        if (rc.data?.success) setConductores(rc.data.data || []);
        if (rv.data?.success) setVehiculos(rv.data.data || []);
        if (rt.data?.success) setTransportistas(rt.data.data || []);
        if (activo && editarLineas && guia?.id_orden_venta) {
          try {
            const ro = await ordenesVentaAPI.getById(guia.id_orden_venta);
            if (activo && ro.data?.success) {
              const mapa = {};
              for (const it of (ro.data.data.detalle || [])) {
                mapa[Number(it.id_detalle)] = {
                  pedido: parseFloat(it.cantidad) || 0,
                  en_guias: parseFloat(it.cantidad_en_guias || 0),
                };
              }
              setTopes(mapa);
            }
          } catch { }
        }
      } catch {
        if (activo) setError('No se pudieron cargar transportistas/flota');
      }
    })();
    return () => { activo = false; };
  }, [modalOpen]);

  const abrirEdicion = () => {
    setError(null);
    setForm({
      modo,
      id_transportista: guia.id_transportista || '',
      nuevo_transportista: false,
      transportista_ruc: '', transportista_razon: '', transportista_mtc: '',
      transporte_registrar: registrar ? 1 : 0,
      transporte_dni: guia.transporte_dni || '', transporte_conductor: guia.transporte_conductor || '', transporte_licencia: guia.transporte_licencia || '',
      transporte_dni2: guia.transporte_dni2 || '', transporte_conductor2: guia.transporte_conductor2 || '', transporte_licencia2: guia.transporte_licencia2 || '',
      transporte_placa: guia.transporte_placa || '', transporte_tuc: guia.transporte_tuc || '', transporte_autorizacion: guia.transporte_autorizacion || '',
      transporte_placa2: guia.transporte_placa2 || '', transporte_tuc2: guia.transporte_tuc2 || '', transporte_autorizacion2: guia.transporte_autorizacion2 || '',
      transporte_ind_transbordo: guia.transporte_ind_transbordo ? 1 : 0,
      transporte_ind_m1l: guia.transporte_ind_m1l ? 1 : 0,
      transporte_ind_retorno_vacio: guia.transporte_ind_retorno_vacio ? 1 : 0,
      transporte_fecha_entrega: estadoFecha(guia.transporte_fecha_entrega) ? guia.transporte_fecha_entrega?.slice?.(0, 10) || '' : '',
      id_conductor: guia.id_conductor || '', id_vehiculo: guia.id_vehiculo || '',
      id_conductor2: guia.id_conductor2 || '', id_vehiculo2: guia.id_vehiculo2 || '',
      peso_bruto_kg: guia.peso_bruto_kg ?? '', numero_bultos: guia.numero_bultos ?? '',
      direccion_llegada: guia.direccion_llegada || guia.punto_llegada || '',
      ubigeo_llegada: guia.ubigeo_llegada || '', ciudad_llegada: guia.ciudad_llegada || '',
      destinatario_ruc: guia.destinatario_ruc || '', destinatario_razon: guia.destinatario_razon || '',
      observaciones: guia.observaciones || '',
      fecha_traslado: guia.fecha_traslado ? String(guia.fecha_traslado).slice(0, 10) : '',
      lineas: (guia.detalle || []).map((d) => ({
        id_detalle: d.id_detalle,
        id_detalle_orden: d.id_detalle_orden,
        codigo: d.codigo_producto,
        producto: d.producto,
        unidad: d.unidad_medida_producto || d.unidad_medida,
        es_libre: d.id_producto == null,
        stock_actual: parseFloat(d.stock_actual ?? 0) || 0,
        cantidad: d.cantidad ?? 0,
        cantidad_original: parseFloat(d.cantidad ?? 0) || 0,
        peso_unitario_kg: d.peso_unitario_kg ?? 0,
      })),
    });
    setModalOpen(true);
  };

  const set = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const setLinea = (index, campo, valor) =>
    setForm((prev) => ({ ...prev, lineas: prev.lineas.map((l, i) => (i === index ? { ...l, [campo]: valor } : l)) }));

  const pesoBrutoDe = (lineas) =>
    (lineas || []).reduce((s, l) => s + (parseFloat(l.cantidad) || 0) * (parseFloat(l.peso_unitario_kg) || 0), 0);

  const guardar = async () => {
    try {
      setError(null);
      if (editarLineas) {
        const incluidas = (form.lineas || []).filter((l) => (parseFloat(l.cantidad) || 0) > 0);
        if (incluidas.length === 0) {
          setError('La guía debe conservar al menos un producto con cantidad mayor a 0');
          return;
        }
      }
      setGuardando(true);
      const payload = {
        modo: form.modo,
        peso_bruto_kg: form.peso_bruto_kg,
        numero_bultos: form.numero_bultos,
        direccion_llegada: form.direccion_llegada,
        ubigeo_llegada: form.ubigeo_llegada,
        ciudad_llegada: form.ciudad_llegada,
        observaciones: form.observaciones,
        fecha_traslado: form.fecha_traslado,
      };
      if (esComex) {
        payload.destinatario_ruc = form.destinatario_ruc;
        payload.destinatario_razon = form.destinatario_razon;
      }
      if (form.modo === 'tercero') {
        payload.transportista = form.nuevo_transportista
          ? { ruc: form.transportista_ruc, razon_social: form.transportista_razon, numero_mtc: form.transportista_mtc }
          : { id_transportista: form.id_transportista || null };
        payload.transporte_registrar = Number(form.transporte_registrar) ? 1 : 0;
        if (Number(form.transporte_registrar)) {
          Object.assign(payload, {
            transporte_dni: form.transporte_dni, transporte_conductor: form.transporte_conductor, transporte_licencia: form.transporte_licencia,
            transporte_dni2: form.transporte_dni2, transporte_conductor2: form.transporte_conductor2, transporte_licencia2: form.transporte_licencia2,
            transporte_placa: form.transporte_placa, transporte_tuc: form.transporte_tuc, transporte_autorizacion: form.transporte_autorizacion,
            transporte_placa2: form.transporte_placa2, transporte_tuc2: form.transporte_tuc2, transporte_autorizacion2: form.transporte_autorizacion2,
            transporte_ind_transbordo: Number(form.transporte_ind_transbordo) ? 1 : 0,
            transporte_ind_m1l: Number(form.transporte_ind_m1l) ? 1 : 0,
            transporte_ind_retorno_vacio: Number(form.transporte_ind_retorno_vacio) ? 1 : 0,
            transporte_fecha_entrega: form.transporte_fecha_entrega || null,
          });
        }
      } else if (form.modo === 'particular') {
        Object.assign(payload, {
          transporte_placa: form.transporte_placa, transporte_conductor: form.transporte_conductor,
          transporte_dni: form.transporte_dni, transporte_licencia: form.transporte_licencia,
        });
      } else {
        Object.assign(payload, {
          id_conductor: form.id_conductor || null, id_vehiculo: form.id_vehiculo || null,
          id_conductor2: form.id_conductor2 || null, id_vehiculo2: form.id_vehiculo2 || null,
        });
      }
      if (editarLineas && Array.isArray(form.lineas)) {
        payload.detalle = form.lineas.map((l) => ({
          id_detalle: l.id_detalle,
          id_detalle_orden: l.id_detalle_orden,
          cantidad: parseFloat(l.cantidad) || 0,
          peso_unitario_kg: parseFloat(l.peso_unitario_kg) || 0,
        }));
        payload.peso_bruto_kg = pesoBrutoDe(form.lineas);
      }
      const resp = await guiasRemisionAPI.update(guia.id_guia, payload);
      if (resp.data?.success) {
        setModalOpen(false);
        onRefresh?.();
      } else {
        setError(resp.data?.error || 'No se pudo guardar');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const indicadoresActivos = [
    guia?.transporte_ind_transbordo && 'Transbordo programado',
    guia?.transporte_ind_m1l && 'Vehículo M1/L',
    guia?.transporte_ind_retorno_vacio && 'Retorno vehículo vacío',
  ].filter(Boolean);

  const topeDeLinea = (l) => {
    const t = topes[Number(l.id_detalle_orden)];
    if (!t) return null;
    return t.pedido - t.en_guias + (parseFloat(l.cantidad_original) || 0);
  };
  const hayErrorLineas = editarLineas && (form?.lineas || []).some((l) => {
    const cant = parseFloat(l.cantidad) || 0;
    const tope = topeDeLinea(l);
    const excedeTope = tope != null && cant > tope + 1e-6;
    const excedeStock = !l.es_libre && cant > (parseFloat(l.stock_actual) || 0) + 1e-6;
    return excedeTope || excedeStock;
  });
  const sinLineas = editarLineas && !(form?.lineas || []).some((l) => (parseFloat(l.cantidad) || 0) > 0);
  const pesoBrutoDerivado = pesoBrutoDe(form?.lineas);

  return (
    <div className="card mb-4">
      <div className="card-header flex items-center justify-between">
        <h2 className="card-title">
          <Truck size={20} />
          Datos de la guía · lo que se enviará a SUNAT
        </h2>
        <div className="flex items-center gap-2">
          <span className="badge badge-info">{MODO_LABEL[modo]}</span>
          {puedeEditar && (
            <button className="btn btn-outline btn-sm" onClick={abrirEdicion}>
              <Edit size={16} /> Editar datos
            </button>
          )}
        </div>
      </div>

      <div className="card-body space-y-6">
        {bloqueada && (
          <div className="flex items-start gap-2 text-sm text-muted">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>
              {guia?.sunat_estado === 'ACEPTADO'
                ? 'La GRE fue aceptada por SUNAT: los datos quedan en solo lectura.'
                : guia?.estado === 'Anulada'
                  ? 'La guía está anulada: solo lectura.'
                  : despachada
                    ? 'La guía ya fue despachada (en tránsito/entregada): solo lectura.'
                    : 'Hay un envío en curso: espera el resultado para poder editar.'}
            </span>
          </div>
        )}

        {modo === 'tercero' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Dato etiqueta="Transportista" valor={guia.transportista_razon} />
              <Dato etiqueta="RUC" valor={guia.transportista_ruc} mono />
              <Dato etiqueta="N° MTC" valor={guia.transportista_mtc} mono />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck size={16} className="text-muted" />
              <span className="text-muted">Registra vehículo y conductor:</span>
              <span className={`badge ${registrar ? 'badge-success' : 'badge-secondary'}`}>{registrar ? 'Sí' : 'No (lo declara el transportista)'}</span>
            </div>
            {registrar && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Dato etiqueta="Vehículo (placa)" valor={guia.transporte_placa} mono />
                  <Dato etiqueta="TUC / Habilitación" valor={guia.transporte_tuc} mono />
                  <Dato etiqueta="Autorización" valor={guia.transporte_autorizacion} mono />
                </div>
                {guia.transporte_placa2 && (
                  <div className="grid grid-cols-3 gap-4">
                    <Dato etiqueta="2° Vehículo (placa)" valor={guia.transporte_placa2} mono />
                    <Dato etiqueta="2° TUC" valor={guia.transporte_tuc2} mono />
                    <Dato etiqueta="2° Autorización" valor={guia.transporte_autorizacion2} mono />
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <Dato etiqueta="Conductor" valor={guia.transporte_conductor} />
                  <Dato etiqueta="DNI" valor={guia.transporte_dni} mono />
                  <Dato etiqueta="Licencia" valor={guia.transporte_licencia} mono />
                </div>
                {guia.transporte_dni2 && (
                  <div className="grid grid-cols-3 gap-4">
                    <Dato etiqueta="2° Conductor" valor={guia.transporte_conductor2} />
                    <Dato etiqueta="2° DNI" valor={guia.transporte_dni2} mono />
                    <Dato etiqueta="2° Licencia" valor={guia.transporte_licencia2} mono />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {modo === 'particular' && (
          <div className="grid grid-cols-4 gap-4">
            <Dato etiqueta="Vehículo (placa)" valor={guia.transporte_placa} mono />
            <Dato etiqueta="Conductor" valor={guia.transporte_conductor} />
            <Dato etiqueta="DNI" valor={guia.transporte_dni} mono />
            <Dato etiqueta="Licencia" valor={guia.transporte_licencia} mono />
          </div>
        )}

        {modo === 'flota' && (
          <div className="grid grid-cols-3 gap-4">
            <Dato etiqueta="Conductor" valor={guia.conductor_flota_nombre} />
            <Dato etiqueta="DNI / Licencia" valor={[guia.conductor_flota_dni, guia.conductor_flota_licencia].filter(Boolean).join(' · ')} mono />
            <Dato etiqueta="Vehículo" valor={[guia.vehiculo_flota_placa, guia.vehiculo_flota_marca].filter(Boolean).join(' — ')} />
          </div>
        )}

        {indicadoresActivos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {indicadoresActivos.map((t) => <span key={t} className="badge badge-secondary">{t}</span>)}
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 border-t pt-4">
          <Dato etiqueta="Fecha de traslado" valor={estadoFecha(guia.fecha_traslado)} />
          <Dato etiqueta="Peso bruto (kg)" valor={guia.peso_bruto_kg != null ? Number(guia.peso_bruto_kg).toFixed(2) : null} mono />
          <Dato etiqueta="Bultos" valor={guia.numero_bultos} mono />
          {modo === 'tercero' && registrar && <Dato etiqueta="Entrega al transportista" valor={estadoFecha(guia.transporte_fecha_entrega)} />}
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Editar datos de la guía" size="lg">
        {form && (
          <div className="space-y-5" style={{ overscrollBehavior: 'contain' }}>
            {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

            <div className="form-group">
              <label className="form-label">Modalidad de transporte</label>
              <select className="form-select" value={form.modo} onChange={(e) => set('modo', e.target.value)}>
                <option value="tercero">Transporte público / tercero</option>
                <option value="particular">Vehículo particular</option>
                <option value="flota">Flota propia</option>
              </select>
            </div>

            {form.modo === 'tercero' && (
              <div className="space-y-4 border rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-muted" />
                  <span className="font-semibold">Transportista</span>
                </div>
                {!form.nuevo_transportista ? (
                  <div className="form-group">
                    <label className="form-label">Seleccionar transportista</label>
                    <select className="form-select" value={form.id_transportista} onChange={(e) => set('id_transportista', e.target.value)}>
                      <option value="">— Seleccionar —</option>
                      {transportistas.map((t) => (
                        <option key={t.id_transportista} value={t.id_transportista}>
                          {t.razon_social} (RUC {t.ruc})
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-link btn-sm mt-1" onClick={() => set('nuevo_transportista', true)}>
                      Corregir / registrar un transportista por RUC
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="form-group">
                      <label className="form-label">RUC</label>
                      <input className="form-input" value={form.transportista_ruc} onChange={(e) => set('transportista_ruc', e.target.value)} maxLength={11} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Razón social</label>
                      <input className="form-input" value={form.transportista_razon} onChange={(e) => set('transportista_razon', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">N° MTC (opcional)</label>
                      <input className="form-input" value={form.transportista_mtc} onChange={(e) => set('transportista_mtc', e.target.value)} />
                    </div>
                    <div className="col-span-3">
                      <button type="button" className="btn btn-link btn-sm" onClick={() => set('nuevo_transportista', false)}>
                        Elegir uno existente
                      </button>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Number(form.transporte_registrar) === 1} onChange={(e) => set('transporte_registrar', e.target.checked ? 1 : 0)} />
                  La guía declara vehículo y conductor
                </label>

                {Number(form.transporte_registrar) === 1 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="form-group"><label className="form-label">Placa</label><input className="form-input" value={form.transporte_placa} onChange={(e) => set('transporte_placa', e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">TUC / Habilitación</label><input className="form-input" value={form.transporte_tuc} onChange={(e) => set('transporte_tuc', e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">Autorización</label><input className="form-input" value={form.transporte_autorizacion} onChange={(e) => set('transporte_autorizacion', e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="form-group"><label className="form-label">Conductor</label><input className="form-input" value={form.transporte_conductor} onChange={(e) => set('transporte_conductor', e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">DNI</label><input className="form-input" value={form.transporte_dni} onChange={(e) => set('transporte_dni', e.target.value)} maxLength={8} /></div>
                      <div className="form-group"><label className="form-label">Licencia</label><input className="form-input" value={form.transporte_licencia} onChange={(e) => set('transporte_licencia', e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 border-t pt-3">
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Number(form.transporte_ind_transbordo) === 1} onChange={(e) => set('transporte_ind_transbordo', e.target.checked ? 1 : 0)} /> Transbordo</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Number(form.transporte_ind_m1l) === 1} onChange={(e) => set('transporte_ind_m1l', e.target.checked ? 1 : 0)} /> Vehículo M1/L</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Number(form.transporte_ind_retorno_vacio) === 1} onChange={(e) => set('transporte_ind_retorno_vacio', e.target.checked ? 1 : 0)} /> Retorno vacío</label>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fecha de entrega al transportista</label>
                      <input type="date" className="form-input" value={form.transporte_fecha_entrega || ''} onChange={(e) => set('transporte_fecha_entrega', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.modo === 'particular' && (
              <div className="grid grid-cols-2 gap-3 border rounded-lg p-4">
                <div className="form-group"><label className="form-label">Placa</label><input className="form-input" value={form.transporte_placa} onChange={(e) => set('transporte_placa', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Conductor</label><input className="form-input" value={form.transporte_conductor} onChange={(e) => set('transporte_conductor', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">DNI</label><input className="form-input" value={form.transporte_dni} onChange={(e) => set('transporte_dni', e.target.value)} maxLength={8} /></div>
                <div className="form-group"><label className="form-label">Licencia</label><input className="form-input" value={form.transporte_licencia} onChange={(e) => set('transporte_licencia', e.target.value)} /></div>
              </div>
            )}

            {form.modo === 'flota' && (
              <div className="grid grid-cols-2 gap-3 border rounded-lg p-4">
                <div className="form-group">
                  <label className="form-label">Conductor</label>
                  <select className="form-select" value={form.id_conductor} onChange={(e) => set('id_conductor', e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {conductores.map((c) => <option key={c.id_empleado} value={c.id_empleado}>{c.nombre_completo} (DNI {c.dni})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Vehículo</label>
                  <select className="form-select" value={form.id_vehiculo} onChange={(e) => set('id_vehiculo', e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {vehiculos.map((v) => <option key={v.id_vehiculo} value={v.id_vehiculo}>{v.placa}{v.marca_modelo ? ` — ${v.marca_modelo}` : ''}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">2° Conductor (opcional)</label>
                  <select className="form-select" value={form.id_conductor2} onChange={(e) => set('id_conductor2', e.target.value)}>
                    <option value="">— Ninguno —</option>
                    {conductores.map((c) => <option key={c.id_empleado} value={c.id_empleado}>{c.nombre_completo} (DNI {c.dni})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">2° Vehículo (opcional)</label>
                  <select className="form-select" value={form.id_vehiculo2} onChange={(e) => set('id_vehiculo2', e.target.value)}>
                    <option value="">— Ninguno —</option>
                    {vehiculos.map((v) => <option key={v.id_vehiculo} value={v.id_vehiculo}>{v.placa}{v.marca_modelo ? ` — ${v.marca_modelo}` : ''}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-muted" />
                <span className="font-semibold">Punto de llegada y carga</span>
              </div>
              <div className="form-group">
                <label className="form-label">Dirección de llegada</label>
                <input className="form-input" value={form.direccion_llegada} onChange={(e) => set('direccion_llegada', e.target.value)} />
              </div>
              <UbigeoSelector
                value={form.ubigeo_llegada}
                onChange={(codigo, meta) => setForm((prev) => ({ ...prev, ubigeo_llegada: codigo, ciudad_llegada: meta?.distrito || prev.ciudad_llegada }))}
              />
              <div className="grid grid-cols-3 gap-3">
                <div className="form-group">
                  <label className="form-label">Peso bruto (kg)</label>
                  {editarLineas ? (
                    <>
                      <input type="number" className="form-input text-right" value={pesoBrutoDerivado.toFixed(2)} readOnly aria-readonly="true" />
                      <small className="text-gray-500">Se calcula desde las líneas.</small>
                    </>
                  ) : (
                    <input type="number" step="0.01" className="form-input" value={form.peso_bruto_kg} onChange={(e) => set('peso_bruto_kg', e.target.value)} />
                  )}
                </div>
                <div className="form-group"><label className="form-label">Bultos</label><input type="number" className="form-input" value={form.numero_bultos} onChange={(e) => set('numero_bultos', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Fecha de traslado</label><input type="date" className="form-input" value={form.fecha_traslado} onChange={(e) => set('fecha_traslado', e.target.value)} /></div>
              </div>
            </div>

            {editarLineas && form.lineas && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-muted" />
                  <span className="font-semibold">Productos de la guía</span>
                </div>
                <p className="text-xs text-muted">Ajusta cantidades y pesos. Para excluir un producto, pon su cantidad en 0; debe quedar al menos uno.</p>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th className="text-right">Pendiente</th>
                        <th className="text-right">Cantidad</th>
                        <th>UM</th>
                        <th className="text-right">Peso Unit.</th>
                        <th className="text-right">Peso Total</th>
                        <th className="text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.lineas.map((l, i) => {
                        const cant = parseFloat(l.cantidad) || 0;
                        const pu = parseFloat(l.peso_unitario_kg) || 0;
                        const tope = topeDeLinea(l);
                        const excedeTope = tope != null && cant > tope + 1e-6;
                        const excedeStock = !l.es_libre && cant > (parseFloat(l.stock_actual) || 0) + 1e-6;
                        const hayError = excedeTope || excedeStock;
                        return (
                          <tr key={l.id_detalle} className={hayError ? 'bg-red-50' : cant === 0 ? 'bg-yellow-50' : ''}>
                            <td className="font-mono text-sm">{l.es_libre ? <span className="badge badge-warning text-[10px]">LIBRE</span> : l.codigo}</td>
                            <td>
                              <div className="font-medium">{l.producto}</div>
                              {excedeTope && <div className="text-xs text-danger mt-1">Excede lo pendiente en la orden ({Math.max(0, tope).toFixed(2)})</div>}
                              {excedeStock && <div className="text-xs text-danger mt-1">Stock insuficiente ({(parseFloat(l.stock_actual) || 0).toFixed(2)})</div>}
                            </td>
                            <td className="text-right font-mono">{tope != null ? Math.max(0, tope).toFixed(2) : '—'}</td>
                            <td>
                              <input type="number" min="0" step="0.001" className={`form-input text-right ${hayError ? 'border-danger' : ''}`} value={l.cantidad} onChange={(e) => setLinea(i, 'cantidad', e.target.value)} />
                            </td>
                            <td className="text-sm text-muted">{l.unidad}</td>
                            <td>
                              <input type="number" min="0" step="0.01" className="form-input text-right text-sm" value={l.peso_unitario_kg} onChange={(e) => setLinea(i, 'peso_unitario_kg', e.target.value)} />
                            </td>
                            <td className="text-right font-bold">{(cant * pu).toFixed(2)}</td>
                            <td className="text-center">
                              {hayError ? <span className="badge badge-danger text-xs">Error</span> : cant === 0 ? <span className="text-muted text-xs">No se incluye</span> : <CheckCircle size={16} className="text-success mx-auto" />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="6" className="text-right font-bold">Peso bruto:</td>
                        <td className="text-right font-bold text-primary">{pesoBrutoDerivado.toFixed(2)} kg</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {esComex && (
              <div className="grid grid-cols-2 gap-3 border rounded-lg p-4">
                <div className="form-group"><label className="form-label">Destinatario · RUC</label><input className="form-input" value={form.destinatario_ruc} onChange={(e) => set('destinatario_ruc', e.target.value)} maxLength={11} /></div>
                <div className="form-group"><label className="form-label">Destinatario · Razón social</label><input className="form-input" value={form.destinatario_razon} onChange={(e) => set('destinatario_razon', e.target.value)} /></div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea className="form-input" rows={2} value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} />
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <button className="btn btn-outline" onClick={() => setModalOpen(false)} disabled={guardando}>
                <X size={18} /> Cancelar
              </button>
              <button className="btn btn-primary" onClick={guardar} disabled={guardando || hayErrorLineas || sinLineas}>
                <Save size={18} /> {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PanelDatosGuia;
