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
  const fmtCant = (v) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(parseFloat(v || 0));
  const esCredito = String(orden?.tipo_venta || '').toLowerCase().startsWith('cr');

  // Datos derivados para la vista previa del comprobante (lo que se enviará a SUNAT).
  const esExportacion = Number(orden?.es_exportacion) === 1;
  // Exportación (0200) fuerza 0%; también exonerado/inafecto. La emisión SEE deriva esto de es_exportacion.
  const pctIgv = (esExportacion || ['INAFECTO', 'EXONERADO'].includes(String(orden?.tipo_impuesto || '').toUpperCase().trim()))
    ? 0 : parseFloat(orden?.porcentaje_impuesto || 18);
  const lineas = orden?.detalle || [];
  const hoy = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

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

      {/* Modal: vista previa completa de la factura antes de enviar a SUNAT */}
      <Modal isOpen={modalEmitir} onClose={() => !procesando && setModalEmitir(false)} title="Vista previa — Factura electrónica (SEE)" size="xl">
        <div className="space-y-3 text-sm">
          <p className="text-muted text-xs">Revisa los datos antes de enviar. Esto es lo que se generará en el comprobante electrónico (UBL 2.1) y se declarará a SUNAT.</p>

          {/* Cabecera del comprobante */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded p-2">
              <div className="text-[10px] text-muted uppercase">Comprobante</div>
              <div className="font-semibold">Factura electrónica (01)</div>
              <div className="font-mono text-xs">Serie FE01</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-[10px] text-muted uppercase">Fecha de emisión</div>
              <div className="font-semibold">{hoy}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-[10px] text-muted uppercase">Moneda</div>
              <div className="font-semibold">{orden?.moneda === 'USD' ? 'Dólares (USD)' : 'Soles (PEN)'}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-[10px] text-muted uppercase">Tipo de operación</div>
              <div className="font-semibold">{esExportacion ? 'Exportación (0200)' : 'Venta interna (0101)'}</div>
            </div>
          </div>

          {/* Adquiriente / cliente */}
          <div className="border border-gray-200 rounded p-3">
            <div className="text-[10px] text-muted uppercase mb-1">Adquiriente / Cliente</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex justify-between gap-2"><span className="text-muted">Razón social:</span><span className="font-medium text-right">{orden?.cliente || '-'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">RUC:</span><span className="font-mono">{orden?.ruc_cliente || '-'}</span></div>
              <div className="flex justify-between gap-2 md:col-span-2"><span className="text-muted">Dirección fiscal:</span><span className="text-right">{orden?.direccion_cliente || orden?.direccion_entrega || '-'}</span></div>
              {orden?.direccion_entrega && orden.direccion_entrega !== orden?.direccion_cliente && (
                <div className="flex justify-between gap-2 md:col-span-2"><span className="text-muted">Dirección de entrega:</span><span className="text-right">{orden.direccion_entrega}</span></div>
              )}
            </div>
          </div>

          {/* Forma de pago */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs bg-gray-50 rounded p-2">
            <span><span className="text-muted">Forma de pago:</span> <strong>{esCredito ? `Crédito${orden?.dias_credito ? ` a ${orden.dias_credito} días` : ''}` : 'Contado'}</strong></span>
            {esCredito && orden?.fecha_vencimiento && (
              <span><span className="text-muted">Vence:</span> <strong>{new Date(orden.fecha_vencimiento).toLocaleDateString('es-PE')}</strong></span>
            )}
            <span><span className="text-muted">Ítems:</span> <strong>{lineas.length}</strong></span>
          </div>

          {/* Detalle de productos (líneas del comprobante) */}
          <div className="border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 text-muted">
                <tr>
                  <th className="text-left p-2">Código</th>
                  <th className="text-left p-2">Descripción</th>
                  <th className="text-center p-2">Und</th>
                  <th className="text-right p-2">Cant.</th>
                  <th className="text-right p-2 whitespace-nowrap">P. Unit. (sin IGV)</th>
                  <th className="text-right p-2">Valor venta</th>
                  <th className="text-right p-2">IGV</th>
                </tr>
              </thead>
              <tbody>
                {lineas.length === 0 ? (
                  <tr><td colSpan={7} className="p-3 text-center text-muted">La orden no tiene líneas de detalle.</td></tr>
                ) : lineas.map((it, i) => {
                  const cant = parseFloat(it.cantidad || 0);
                  const pu = parseFloat(it.precio_unitario || 0);
                  const valor = cant * pu;
                  const igvLinea = valor * (pctIgv / 100);
                  return (
                    <tr key={it.id_detalle_orden || it.id_producto || i} className="border-t border-gray-100">
                      <td className="p-2 font-mono">{it.codigo_producto || '-'}</td>
                      <td className="p-2">{it.producto}</td>
                      <td className="p-2 text-center">{it.unidad_medida || 'NIU'}</td>
                      <td className="p-2 text-right">{fmtCant(cant)}</td>
                      <td className="p-2 text-right">{fmt(pu)}</td>
                      <td className="p-2 text-right">{fmt(valor)}</td>
                      <td className="p-2 text-right">{fmt(igvLinea)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="flex justify-end">
            <div className="w-full md:w-72 space-y-1">
              <div className="flex justify-between"><span className="text-muted">{esExportacion ? 'Op. exportación:' : (pctIgv === 0 ? 'Op. no gravada:' : 'Op. gravada:')}</span><span>{fmt(orden?.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted">{esExportacion ? 'IGV exportación (0%):' : `IGV (${pctIgv}%):`}</span><span>{fmt(orden?.igv)}</span></div>
              <div className="flex justify-between font-bold border-t border-gray-200 pt-1 text-base"><span>Importe total:</span><span>{fmt(orden?.total)}</span></div>
            </div>
          </div>

          <p className="text-[11px] text-muted italic">Vista previa referencial: los importes finales pueden variar en centavos por el redondeo oficial de SUNAT al firmar el comprobante.</p>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <button className="btn btn-sm btn-outline" onClick={() => setModalEmitir(false)} disabled={procesando}>Cancelar</button>
            <button className="btn btn-sm btn-primary" onClick={handleEmitir} disabled={procesando}>{procesando ? 'Emitiendo…' : 'Confirmar y emitir a SUNAT'}</button>
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
