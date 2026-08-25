// components/Ventas/sunat/PanelFacturacionSee.jsx — Fase 14.
// Card independiente de Facturación Electrónica (SEE) nativa para el detalle de una OV.
// Coexiste con el panel de facturación manual (no lo reemplaza). Gatear su render con
// tienePermiso('facturacion') desde el contenedor. Toda la lógica SEE de comprobantes vive aquí.
import { useState } from 'react';
import { Zap, FileText, RefreshCw, FileMinus, Ban } from 'lucide-react';
import Modal from '../../UI/Modal';
import Alert from '../../UI/Alert';
import BadgeEstadoSunat from './BadgeEstadoSunat';
import { sunatAPI } from '../../../config/api';

// Catálogo 09 (Nota de Crédito) y 10 (Nota de Débito) — deben coincidir con el backend.
const MOTIVOS = {
  '07': [
    ['01', 'Anulación de la operación'], ['02', 'Anulación por error en el RUC'],
    ['03', 'Corrección por error en la descripción'], ['04', 'Descuento global'],
    ['05', 'Descuento por ítem'], ['06', 'Devolución total'], ['07', 'Devolución por ítem'],
    ['08', 'Bonificación'], ['09', 'Disminución en el valor'], ['13', 'Ajustes de montos/fechas']
  ],
  '08': [['01', 'Intereses por mora'], ['02', 'Aumento en el valor'], ['03', 'Penalidades / otros']]
};

export default function PanelFacturacionSee({ orden, facturas = [], onRefresh }) {
  const [alerta, setAlerta] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [modalEmitir, setModalEmitir] = useState(false);
  const [modalNota, setModalNota] = useState(null);   // { factura }
  const [modalBaja, setModalBaja] = useState(null);    // { factura }
  const [notaTipo, setNotaTipo] = useState('07');
  const [notaMotivo, setNotaMotivo] = useState('01');
  const [bajaMotivo, setBajaMotivo] = useState('');

  const simbolo = orden?.moneda === 'USD' ? '$' : 'S/';
  const fmt = (v) => `${simbolo} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v || 0))}`;
  const esCredito = String(orden?.tipo_venta || '').toLowerCase().startsWith('cr');

  // Comprobantes electrónicos (nativos): tienen sunat_estado. Los manuales quedan en su panel.
  const comprobantes = (facturas || []).filter((f) => f.sunat_estado);
  const puedeEmitir = orden?.estado_verificacion === 'Aprobada' && Number(orden?.facturado_sunat) !== 1;

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
    const r = await tras(() => sunatAPI.emitirFactura(orden.id_orden_venta), null);
    const d = r?.data;
    if (d) {
      setAlerta(d.ok
        ? { type: 'success', message: `Factura ${d.comprobante} ${d.estado} por SUNAT.` }
        : { type: d.estado === 'RECHAZADO' ? 'error' : 'warning', message: `Factura ${d.serie}-${d.numero}: ${d.estado}. ${d.descripcion || ''}` });
    }
    setModalEmitir(false);
  };

  const handleVerificar = (f) => tras(() => sunatAPI.estadoComprobante(f.id_factura), 'Estado consultado.');
  const handlePdf = async (f) => { try { await sunatAPI.verPdfComprobante(f.id_factura); } catch (e) { setAlerta({ type: 'error', message: errorMsg(e) }); } };

  const handleEmitirNota = async () => {
    await tras(() => sunatAPI.emitirNota({ id_factura_ref: modalNota.factura.id_factura, tipo: notaTipo, motivo_codigo: notaMotivo }),
      `Nota ${notaTipo === '07' ? 'de crédito' : 'de débito'} emitida.`);
    setModalNota(null);
  };

  const handleBaja = async () => {
    if (!bajaMotivo.trim()) { setAlerta({ type: 'error', message: 'Indique el motivo de la baja.' }); return; }
    await tras(() => sunatAPI.darDeBaja(modalBaja.factura.id_factura, bajaMotivo.trim()), 'Comunicación de baja enviada.');
    setModalBaja(null); setBajaMotivo('');
  };

  return (
    <div className="card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-sm">
          <Zap size={16} className="text-amber-500" /> Facturación Electrónica (SEE)
          <span className="badge badge-warning text-[10px]">BETA</span>
        </h3>
        {puedeEmitir && (
          <button className="btn btn-sm btn-primary" onClick={() => setModalEmitir(true)} disabled={procesando}>
            <Zap size={14} className="mr-1" /> Emitir factura SEE
          </button>
        )}
      </div>

      {alerta && <Alert type={alerta.type} message={alerta.message} onClose={() => setAlerta(null)} />}

      {comprobantes.length === 0 ? (
        <p className="text-xs text-muted">
          {puedeEmitir ? 'Aún no se ha emitido un comprobante electrónico para esta orden.'
            : 'La orden debe estar Aprobada y sin facturar para emitir el comprobante electrónico.'}
        </p>
      ) : (
        <div className="space-y-2">
          {comprobantes.map((f) => {
            const esFactura = f.codigo_tipo_sunat === '01';
            const aceptado = f.sunat_estado === 'ACEPTADO';
            return (
              <div key={f.id_factura} className="border border-gray-200 rounded p-2 flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-sm">{f.numero_factura || `${f.serie}-${f.numero}`}</span>
                <BadgeEstadoSunat estado={f.sunat_estado} />
                <span className="text-xs text-muted">{fmt(f.total)}</span>
                <div className="flex flex-wrap items-center gap-1 ml-auto">
                  {(aceptado || f.sunat_estado === 'BAJA') && (
                    <button className="btn btn-xs btn-outline" onClick={() => handlePdf(f)} disabled={procesando} title="Ver PDF SEE">
                      <FileText size={13} className="mr-1" /> PDF
                    </button>
                  )}
                  <button className="btn btn-xs btn-outline" onClick={() => handleVerificar(f)} disabled={procesando} title="Verificar estado en SUNAT">
                    <RefreshCw size={13} className="mr-1" /> Estado
                  </button>
                  {esFactura && aceptado && (
                    <>
                      <button className="btn btn-xs btn-outline" onClick={() => { setNotaTipo('07'); setNotaMotivo('01'); setModalNota({ factura: f }); }} disabled={procesando} title="Emitir Nota de Crédito/Débito">
                        <FileMinus size={13} className="mr-1" /> NC/ND
                      </button>
                      <button className="btn btn-xs btn-danger" onClick={() => { setBajaMotivo(''); setModalBaja({ factura: f }); }} disabled={procesando} title="Comunicación de baja (≤7 días)">
                        <Ban size={13} className="mr-1" /> Baja
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: emitir factura (preview + confirmar) */}
      <Modal isOpen={modalEmitir} onClose={() => !procesando && setModalEmitir(false)} title="Emitir factura electrónica (SEE)" size="sm">
        <div className="space-y-3 text-sm">
          <p className="text-muted">Se emitirá la factura a SUNAT a partir de esta orden de venta.</p>
          <div className="bg-gray-50 rounded p-3 space-y-1">
            <div className="flex justify-between"><span className="text-muted">Cliente:</span><span className="font-medium">{orden?.cliente}</span></div>
            <div className="flex justify-between"><span className="text-muted">RUC:</span><span className="font-mono">{orden?.ruc_cliente || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted">Forma de pago:</span><span>{esCredito ? `Crédito${orden?.dias_credito ? ` a ${orden.dias_credito} días` : ''}` : 'Contado'}</span></div>
            <div className="flex justify-between"><span className="text-muted">Subtotal:</span><span>{fmt(orden?.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted">IGV:</span><span>{fmt(orden?.igv)}</span></div>
            <div className="flex justify-between font-bold border-t border-gray-200 pt-1"><span>Total:</span><span>{fmt(orden?.total)}</span></div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-sm btn-outline" onClick={() => setModalEmitir(false)} disabled={procesando}>Cancelar</button>
            <button className="btn btn-sm btn-primary" onClick={handleEmitir} disabled={procesando}>{procesando ? 'Emitiendo…' : 'Emitir a SUNAT'}</button>
          </div>
        </div>
      </Modal>

      {/* Modal: nota de crédito / débito */}
      <Modal isOpen={!!modalNota} onClose={() => !procesando && setModalNota(null)} title="Emitir Nota de Crédito / Débito" size="sm">
        <div className="space-y-3 text-sm">
          <p className="text-muted">Sobre la factura <strong className="font-mono">{modalNota?.factura?.numero_factura}</strong>. Se emite una nota <strong>total</strong> (replica el detalle de la orden).</p>
          <div>
            <label className="block text-xs text-muted mb-1">Tipo de nota</label>
            <select className="form-select w-full" value={notaTipo} onChange={(e) => { setNotaTipo(e.target.value); setNotaMotivo(MOTIVOS[e.target.value][0][0]); }}>
              <option value="07">Nota de Crédito (07)</option>
              <option value="08">Nota de Débito (08)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Motivo</label>
            <select className="form-select w-full" value={notaMotivo} onChange={(e) => setNotaMotivo(e.target.value)}>
              {MOTIVOS[notaTipo].map(([cod, txt]) => <option key={cod} value={cod}>{cod} — {txt}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-sm btn-outline" onClick={() => setModalNota(null)} disabled={procesando}>Cancelar</button>
            <button className="btn btn-sm btn-primary" onClick={handleEmitirNota} disabled={procesando}>{procesando ? 'Emitiendo…' : 'Emitir nota'}</button>
          </div>
        </div>
      </Modal>

      {/* Modal: comunicación de baja */}
      <Modal isOpen={!!modalBaja} onClose={() => !procesando && setModalBaja(null)} title="Comunicación de baja (RA)" size="sm">
        <div className="space-y-3 text-sm">
          <p className="text-muted">Se dará de baja la factura <strong className="font-mono">{modalBaja?.factura?.numero_factura}</strong> ante SUNAT (solo dentro de los 7 días de emitida).</p>
          <div>
            <label className="block text-xs text-muted mb-1">Motivo de la baja</label>
            <textarea className="form-input w-full" rows={3} value={bajaMotivo} onChange={(e) => setBajaMotivo(e.target.value)} placeholder="Ej: Error en los datos del cliente" />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-sm btn-outline" onClick={() => setModalBaja(null)} disabled={procesando}>Cancelar</button>
            <button className="btn btn-sm btn-danger" onClick={handleBaja} disabled={procesando}>{procesando ? 'Enviando…' : 'Dar de baja'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
