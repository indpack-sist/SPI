// components/Ventas/sunat/PanelGuiaRemisionSee.jsx — Fase 14 (paso 4).
// Card independiente de GRE Remitente (09) electrónica para el detalle de una guía de remisión.
// Espeja PanelFacturacionSee pero opera sobre UNA sola guía. Coexiste con el flujo manual (no lo
// reemplaza). Gatear su render con tienePermiso('facturacion') desde el contenedor.
import { useState } from 'react';
import { Zap, FileText, RefreshCw, Ban, RotateCcw } from 'lucide-react';
import Modal from '../../UI/Modal';
import Alert from '../../UI/Alert';
import BadgeEstadoSunat from './BadgeEstadoSunat';
import { sunatAPI } from '../../../config/api';

// `soloLectura`: perfiles de venta (Comercial/Ventas) solo ven/descargan el PDF de la GRE
// ya emitida. No emiten, ni reemplazan, ni dejan sin efecto.
export default function PanelGuiaRemisionSee({ guia, onRefresh, soloLectura = false }) {
  const [alerta, setAlerta] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [modalEmitir, setModalEmitir] = useState(false);
  // Observaciones editables que viajan a SUNAT como cbc:Note (prellenadas con la OC de la OV).
  const [observacionesEmitir, setObservacionesEmitir] = useState('');
  const [modalSinEfecto, setModalSinEfecto] = useState(false);
  const [modalReemplazo, setModalReemplazo] = useState(false);
  const [motivo, setMotivo] = useState('');
  // Correcciones opcionales del reemplazo (prellenadas al abrir el modal). Solo se envían las que cambian.
  const [correcciones, setCorrecciones] = useState({});

  const estado = guia?.sunat_estado || null;               // null = sin emitir (estado SUNAT)
  const estadoNegocio = guia?.estado || null;              // Emitida/En Tránsito/Entregada/Anulada
  const tieneComprobante = !!(guia?.serie_sunat && guia?.numero_sunat);
  const comprobante = tieneComprobante ? `${guia.serie_sunat}-${guia.numero_sunat}` : null;

  // Datos derivados para la vista previa de la GRE (lo que se enviará a SUNAT).
  const lineas = guia?.detalle || [];
  const hoy = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtPeso = (v) => `${Number(v || 0).toFixed(2)} kg`;
  const fmtCant = (v) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(parseFloat(v || 0));

  // Máquina de estados (sunat_estado de guias_remision).
  // Regla de negocio: la GRE se emite una vez que la ORDEN ya está "Despachada".
  const guiaVigente = !!estadoNegocio && estadoNegocio !== 'Anulada';
  const sinEmitirSunat = !estado || ['PENDIENTE', 'ERROR', 'RECHAZADO'].includes(estado);
  const ordenDespachada = guia?.estado_orden === 'Despachada';
  const puedeEmitir = guiaVigente && sinEmitirSunat && ordenDespachada;
  const enviado = estado === 'ENVIADO';
  const aceptado = estado === 'ACEPTADO';
  const cerradaOk = ['ACEPTADO', 'ANULADA', 'REEMPLAZADA'].includes(estado);

  // Prerrequisitos que valida el backend antes de emitir (los mostramos como aviso amigable).
  const faltantes = [];
  if (puedeEmitir) {
    if (!guia?.ubigeo_partida) faltantes.push('ubigeo de partida (6 dígitos)');
    if (!guia?.ubigeo_llegada) faltantes.push('ubigeo de llegada (6 dígitos)');
    if (!(Number(guia?.peso_bruto_kg) > 0)) faltantes.push('peso bruto > 0');
    if (!guia?.motivo_traslado_cod) faltantes.push('código de motivo de traslado (catálogo 20)');
    // Transporte público (tercero transportista) vs privado (conductor + vehículo propios).
    if (guia?.id_transportista) {
      // En público la placa/conductor los declara el transportista; aquí basta el transportista.
    } else {
      if (!guia?.id_conductor) faltantes.push('conductor (transporte privado) o un transportista (transporte público)');
      if (!guia?.id_vehiculo) faltantes.push('vehículo/placa de la flota (transporte privado)');
    }
  }

  const errorMsg = (e) => e?.response?.data?.error || e?.message || 'Error inesperado';
  const tras = async (fn, okMsg) => {
    setProcesando(true); setAlerta(null);
    try {
      const r = await fn();
      setAlerta({ type: 'success', message: okMsg || 'Operación realizada.' });
      if (onRefresh) await onRefresh();
      return r;
    } catch (e) {
      setAlerta({ type: 'error', message: errorMsg(e) });
    } finally { setProcesando(false); }
  };

  // Abre el modal de emisión con las observaciones prellenadas (texto libre de la guía + OC).
  const abrirEmitir = () => {
    setObservacionesEmitir(guia?.observacion_sugerida ?? guia?.observaciones ?? '');
    setModalEmitir(true);
  };

  const handleEmitir = async () => {
    const r = await tras(() => sunatAPI.emitirGuia(guia.id_guia, observacionesEmitir), null);
    const d = r?.data;
    if (d) {
      setAlerta(d.ok
        ? { type: 'success', message: `Guía ${d.comprobante} ${d.estado} por SUNAT${d.mock ? ' (mock BETA)' : ''}.` }
        : { type: d.estado === 'RECHAZADO' ? 'error' : 'warning', message: `Guía ${d.comprobante || ''}: ${d.estado}. ${d.descripcion || d.error || ''}` });
    }
    setModalEmitir(false);
  };

  const handleVerificar = () => tras(() => sunatAPI.estadoGuia(guia.id_guia), 'Estado consultado en SUNAT.');
  const handlePdf = async () => { try { await sunatAPI.verPdfGuia(guia.id_guia); } catch (e) { setAlerta({ type: 'error', message: errorMsg(e) }); } };

  const handleSinEfecto = async () => {
    if (!motivo.trim()) { setAlerta({ type: 'error', message: 'Indique el motivo para dejar sin efecto la guía.' }); return; }
    await tras(() => sunatAPI.dejarSinEfectoGuia(guia.id_guia, motivo.trim()), 'Guía dejada sin efecto.');
    setModalSinEfecto(false); setMotivo('');
  };

  const abrirReemplazo = () => {
    setCorrecciones({
      direccion_llegada: guia?.direccion_llegada || '',
      ubigeo_llegada: guia?.ubigeo_llegada || '',
      peso_bruto_kg: guia?.peso_bruto_kg ?? '',
      observaciones: guia?.observaciones || ''
    });
    setModalReemplazo(true);
  };

  // Envía solo las correcciones que difieren del valor original (el resto se clona en el backend).
  const handleReemplazar = async () => {
    const diff = {};
    const orig = {
      direccion_llegada: guia?.direccion_llegada || '',
      ubigeo_llegada: guia?.ubigeo_llegada || '',
      peso_bruto_kg: String(guia?.peso_bruto_kg ?? ''),
      observaciones: guia?.observaciones || ''
    };
    Object.entries(correcciones).forEach(([k, v]) => {
      if (String(v ?? '') !== String(orig[k] ?? '')) diff[k] = v;
    });
    const r = await tras(() => sunatAPI.reemplazarGuia(guia.id_guia, diff), null);
    const d = r?.data;
    if (d) {
      const rep = d.reemplazo;
      setAlerta(d.ok
        ? { type: 'success', message: `Guía reemplazada por ${rep?.numeroGuiaNueva || d.comprobante} (${d.estado}).` }
        : { type: d.estado === 'RECHAZADO' ? 'error' : 'warning', message: `Reemplazo ${d.estado}. ${d.descripcion || d.error || ''}${rep ? ` La original queda ${rep.estadoOriginal}.` : ''}` });
    }
    setModalReemplazo(false);
  };

  const setC = (k, v) => setCorrecciones((c) => ({ ...c, [k]: v }));

  // En solo lectura la tarjeta aparece únicamente cuando la GRE ya está emitida y con PDF disponible.
  if (soloLectura && !(tieneComprobante && cerradaOk)) return null;

  return (
    <div className="card p-3 space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-sm">
          <Zap size={16} className="text-amber-500" /> Guía de Remisión Electrónica (SEE · GRE 09)
        </h3>
        {!soloLectura && puedeEmitir && (
          <button className="btn btn-sm btn-primary" onClick={abrirEmitir} disabled={procesando}>
            <Zap size={14} className="mr-1" /> Emitir GRE
          </button>
        )}
      </div>

      {alerta && <Alert type={alerta.type} message={alerta.message} onClose={() => setAlerta(null)} />}

      <div className="border border-gray-200 rounded p-2 flex flex-wrap items-center gap-2">
        <span className="font-mono font-bold text-sm">{comprobante || 'Sin serie SUNAT'}</span>
        <BadgeEstadoSunat estado={estado} />
        {guia?.sunat_ticket && <span className="text-[11px] text-muted">ticket {guia.sunat_ticket}</span>}
        <div className="flex flex-wrap items-center gap-1 ml-auto">
          {tieneComprobante && cerradaOk && (
            <button className="btn btn-xs btn-outline" onClick={handlePdf} disabled={procesando} title="Ver PDF SEE (con QR)">
              <FileText size={13} className="mr-1" /> PDF
            </button>
          )}
          {!soloLectura && (enviado || aceptado) && (
            <button className="btn btn-xs btn-outline" onClick={handleVerificar} disabled={procesando} title="Reconsultar estado en SUNAT">
              <RefreshCw size={13} className="mr-1" /> Estado
            </button>
          )}
          {!soloLectura && aceptado && (
            <>
              <button className="btn btn-xs btn-outline" onClick={abrirReemplazo} disabled={procesando} title="Reemplazar por una GRE corregida">
                <RotateCcw size={13} className="mr-1" /> Reemplazar
              </button>
              <button className="btn btn-xs btn-danger" onClick={() => { setMotivo(''); setModalSinEfecto(true); }} disabled={procesando} title="Dejar sin efecto (traslado no iniciado)">
                <Ban size={13} className="mr-1" /> Sin efecto
              </button>
            </>
          )}
        </div>
      </div>

      {/* Descripción de la última respuesta de SUNAT (rechazo/observación/mock). */}
      {guia?.sunat_response_desc && (estado === 'RECHAZADO' || estado === 'ERROR') && (
        <p className="text-xs text-danger">SUNAT: {guia.sunat_response_desc}</p>
      )}
      {estado === 'REEMPLAZADA' && (
        <p className="text-xs text-muted">Esta guía fue reemplazada por una GRE corregida.</p>
      )}

      {/* Aviso de prerrequisitos faltantes antes de emitir. */}
      {puedeEmitir && faltantes.length > 0 && (
        <p className="text-xs text-warning">Antes de emitir, completa: {faltantes.join(', ')}.</p>
      )}
      {/* La emisión requiere que la orden ya esté despachada. */}
      {guiaVigente && sinEmitirSunat && !ordenDespachada && (
        <p className="text-xs text-warning">
          Para emitir la GRE, la orden de venta debe estar en estado "Despachada"{guia?.estado_orden ? ` (actualmente: ${guia.estado_orden})` : ''}.
        </p>
      )}
      {!estado && guiaVigente && ordenDespachada && faltantes.length === 0 && (
        <p className="text-xs text-muted">Aún no se ha emitido la GRE electrónica de esta guía.</p>
      )}

      {/* Modal: vista previa completa de la GRE antes de enviar a SUNAT */}
      <Modal isOpen={modalEmitir} onClose={() => !procesando && setModalEmitir(false)} title="Vista previa — Guía de Remisión Electrónica (09)" size="xl">
        <div className="space-y-3 text-sm">
          <p className="text-muted text-xs">Revisa los datos antes de enviar. Esto es lo que se generará en el DespatchAdvice (UBL 2.1) y se declarará a SUNAT.</p>

          {/* Cabecera */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded p-2">
              <div className="text-[10px] text-muted uppercase">Documento</div>
              <div className="font-semibold">GRE Remitente (09)</div>
              <div className="font-mono text-xs">Serie TE01</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-[10px] text-muted uppercase">Fecha de emisión</div>
              <div className="font-semibold">{hoy}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-[10px] text-muted uppercase">Fecha de traslado</div>
              <div className="font-semibold">{guia?.fecha_traslado ? new Date(guia.fecha_traslado).toLocaleDateString('es-PE') : '-'}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-[10px] text-muted uppercase">Guía interna</div>
              <div className="font-mono text-xs">{guia?.numero_guia}</div>
            </div>
          </div>

          {/* Destinatario */}
          <div className="border border-gray-200 rounded p-3">
            <div className="text-[10px] text-muted uppercase mb-1">Destinatario</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex justify-between gap-2"><span className="text-muted">Razón social:</span><span className="font-medium text-right">{guia?.cliente || '-'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">RUC:</span><span className="font-mono">{guia?.ruc_cliente || '-'}</span></div>
            </div>
          </div>

          {/* Datos del traslado */}
          <div className="border border-gray-200 rounded p-3">
            <div className="text-[10px] text-muted uppercase mb-1">Traslado</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex justify-between gap-2"><span className="text-muted">Motivo:</span><span className="text-right">{guia?.motivo_traslado || '-'}{guia?.motivo_traslado_cod ? ` (${guia.motivo_traslado_cod})` : ''}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">Modalidad:</span><span className="text-right">{guia?.modalidad_transporte || '-'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">Peso bruto:</span><span>{fmtPeso(guia?.peso_bruto_kg)}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">Bultos:</span><span>{guia?.numero_bultos ?? '-'}</span></div>
            </div>
          </div>

          {/* Punto de partida / llegada */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="border border-gray-200 rounded p-3">
              <div className="text-[10px] text-muted uppercase mb-1">Punto de partida</div>
              <div className="text-xs">{guia?.direccion_partida || guia?.punto_partida || '-'}</div>
              <div className="text-xs text-muted mt-1">Ubigeo: <span className="font-mono">{guia?.ubigeo_partida || '—'}</span></div>
            </div>
            <div className="border border-gray-200 rounded p-3">
              <div className="text-[10px] text-muted uppercase mb-1">Punto de llegada</div>
              <div className="text-xs">{guia?.direccion_llegada || guia?.punto_llegada || '-'}</div>
              <div className="text-xs text-muted mt-1">Ubigeo: <span className="font-mono">{guia?.ubigeo_llegada || '—'}</span></div>
            </div>
          </div>

          {/* Bienes transportados */}
          <div className="border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 text-muted">
                <tr>
                  <th className="text-left p-2">Código</th>
                  <th className="text-left p-2">Descripción</th>
                  <th className="text-center p-2">Und</th>
                  <th className="text-right p-2">Cant.</th>
                  <th className="text-right p-2">Peso total</th>
                </tr>
              </thead>
              <tbody>
                {lineas.length === 0 ? (
                  <tr><td colSpan={5} className="p-3 text-center text-muted">La guía no tiene detalle.</td></tr>
                ) : lineas.map((it, i) => (
                  <tr key={it.id_detalle || it.id_producto || i} className="border-t border-gray-100">
                    <td className="p-2 font-mono">{it.codigo_producto || '-'}</td>
                    <td className="p-2">{it.producto || it.descripcion}</td>
                    <td className="p-2 text-center">{it.unidad_medida || 'NIU'}</td>
                    <td className="p-2 text-right">{fmtCant(it.cantidad)}</td>
                    <td className="p-2 text-right">{fmtPeso(it.peso_total_kg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {faltantes.length > 0 && (
            <Alert type="warning" message={`Faltan datos obligatorios: ${faltantes.join(', ')}.`} />
          )}

          <div className="pt-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Observaciones (viajan a SUNAT)
            </label>
            <textarea
              className="form-input w-full text-sm"
              rows={2}
              maxLength={250}
              value={observacionesEmitir}
              onChange={(e) => setObservacionesEmitir(e.target.value)}
              placeholder="Ej. OC: 260810058"
            />
            <p className="text-[11px] text-muted mt-1">
              Prellenado con la OC de la orden; puedes corregirlo, quitarlo o añadir más. Lo que quede aquí es lo que llega a SUNAT. (máx. 250)
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <button className="btn btn-sm btn-outline" onClick={() => setModalEmitir(false)} disabled={procesando}>Cancelar</button>
            <button className="btn btn-sm btn-primary" onClick={handleEmitir} disabled={procesando}>{procesando ? 'Emitiendo…' : 'Confirmar y emitir a SUNAT'}</button>
          </div>
        </div>
      </Modal>

      {/* Modal: dejar sin efecto */}
      <Modal isOpen={modalSinEfecto} onClose={() => !procesando && setModalSinEfecto(false)} title="Dejar sin efecto la GRE" size="sm">
        <div className="space-y-3 text-sm">
          <p className="text-muted">La guía <strong className="font-mono">{comprobante}</strong> quedará SIN EFECTO. Solo procede si el traslado <strong>no ha iniciado</strong> (un Administrador puede forzarlo).</p>
          <div>
            <label className="block text-xs text-muted mb-1">Motivo</label>
            <textarea className="form-input w-full" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: Error en la dirección de llegada" />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-sm btn-outline" onClick={() => setModalSinEfecto(false)} disabled={procesando}>Cancelar</button>
            <button className="btn btn-sm btn-danger" onClick={handleSinEfecto} disabled={procesando}>{procesando ? 'Procesando…' : 'Dejar sin efecto'}</button>
          </div>
        </div>
      </Modal>

      {/* Modal: reemplazar por GRE corregida */}
      <Modal isOpen={modalReemplazo} onClose={() => !procesando && setModalReemplazo(false)} title="Reemplazar por una GRE corregida" size="sm">
        <div className="space-y-3 text-sm">
          <p className="text-muted">GRE 2.0 no tiene baja: se emite una <strong>guía nueva corregida</strong> y, si SUNAT la acepta, la original queda REEMPLAZADA. Ajusta solo lo que cambie.</p>
          <div>
            <label className="block text-xs text-muted mb-1">Dirección de llegada</label>
            <input className="form-input w-full" value={correcciones.direccion_llegada || ''} onChange={(e) => setC('direccion_llegada', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted mb-1">Ubigeo de llegada</label>
              <input className="form-input w-full" value={correcciones.ubigeo_llegada || ''} onChange={(e) => setC('ubigeo_llegada', e.target.value)} maxLength={6} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Peso bruto (kg)</label>
              <input type="number" step="0.01" min="0" className="form-input w-full" value={correcciones.peso_bruto_kg ?? ''} onChange={(e) => setC('peso_bruto_kg', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Observaciones</label>
            <textarea className="form-input w-full" rows={2} value={correcciones.observaciones || ''} onChange={(e) => setC('observaciones', e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-sm btn-outline" onClick={() => setModalReemplazo(false)} disabled={procesando}>Cancelar</button>
            <button className="btn btn-sm btn-primary" onClick={handleReemplazar} disabled={procesando}>{procesando ? 'Emitiendo…' : 'Emitir reemplazo'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
