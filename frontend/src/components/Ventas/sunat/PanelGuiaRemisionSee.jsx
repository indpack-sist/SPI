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

export default function PanelGuiaRemisionSee({ guia, onRefresh }) {
  const [alerta, setAlerta] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [modalEmitir, setModalEmitir] = useState(false);
  const [modalSinEfecto, setModalSinEfecto] = useState(false);
  const [modalReemplazo, setModalReemplazo] = useState(false);
  const [motivo, setMotivo] = useState('');
  // Correcciones opcionales del reemplazo (prellenadas al abrir el modal). Solo se envían las que cambian.
  const [correcciones, setCorrecciones] = useState({});

  const estado = guia?.sunat_estado || null;               // null = sin emitir
  const tieneComprobante = !!(guia?.serie_sunat && guia?.numero_sunat);
  const comprobante = tieneComprobante ? `${guia.serie_sunat}-${guia.numero_sunat}` : null;

  // Máquina de estados (sunat_estado de guias_remision).
  const puedeEmitir = !estado || ['PENDIENTE', 'ERROR', 'RECHAZADO'].includes(estado);
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
    if (!guia?.id_conductor) faltantes.push('conductor (transporte privado)');
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

  const handleEmitir = async () => {
    const r = await tras(() => sunatAPI.emitirGuia(guia.id_guia), null);
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

  return (
    <div className="card p-3 space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-sm">
          <Zap size={16} className="text-amber-500" /> Guía de Remisión Electrónica (SEE · GRE 09)
          <span className="badge badge-warning text-[10px]">BETA</span>
        </h3>
        {puedeEmitir && (
          <button className="btn btn-sm btn-primary" onClick={() => setModalEmitir(true)} disabled={procesando}>
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
          {(enviado || aceptado) && (
            <button className="btn btn-xs btn-outline" onClick={handleVerificar} disabled={procesando} title="Reconsultar estado en SUNAT">
              <RefreshCw size={13} className="mr-1" /> Estado
            </button>
          )}
          {aceptado && (
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
      {!estado && faltantes.length === 0 && (
        <p className="text-xs text-muted">Aún no se ha emitido la GRE electrónica de esta guía.</p>
      )}

      {/* Modal: emitir GRE */}
      <Modal isOpen={modalEmitir} onClose={() => !procesando && setModalEmitir(false)} title="Emitir Guía de Remisión Electrónica (09)" size="sm">
        <div className="space-y-3 text-sm">
          <p className="text-muted">Se emitirá la GRE Remitente a SUNAT a partir de esta guía.</p>
          <div className="bg-gray-50 rounded p-3 space-y-1">
            <div className="flex justify-between"><span className="text-muted">Guía:</span><span className="font-mono">{guia?.numero_guia}</span></div>
            <div className="flex justify-between"><span className="text-muted">Cliente:</span><span className="font-medium">{guia?.cliente}</span></div>
            <div className="flex justify-between"><span className="text-muted">Partida → Llegada:</span><span className="font-mono">{guia?.ubigeo_partida || '?'} → {guia?.ubigeo_llegada || '?'}</span></div>
            <div className="flex justify-between"><span className="text-muted">Peso bruto:</span><span>{Number(guia?.peso_bruto_kg || 0).toFixed(2)} kg</span></div>
          </div>
          {faltantes.length > 0 && (
            <Alert type="warning" message={`Faltan datos obligatorios: ${faltantes.join(', ')}.`} />
          )}
          <div className="flex justify-end gap-2">
            <button className="btn btn-sm btn-outline" onClick={() => setModalEmitir(false)} disabled={procesando}>Cancelar</button>
            <button className="btn btn-sm btn-primary" onClick={handleEmitir} disabled={procesando}>{procesando ? 'Emitiendo…' : 'Emitir a SUNAT'}</button>
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
