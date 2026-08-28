// components/Ventas/sunat/PanelFacturacionSee.jsx — Fase 14.
// Card independiente de Facturación Electrónica (SEE) nativa para el detalle de una OV.
// Coexiste con el panel de facturación manual (no lo reemplaza). Gatear su render con
// tienePermiso('facturacion') desde el contenedor. Toda la lógica SEE de comprobantes vive aquí.
import { useState, useEffect } from 'react';
import { Zap, FileText, RefreshCw, FileMinus, Ban, FileCode, FileCheck } from 'lucide-react';
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

// `soloLectura`: perfiles de venta (Comercial/Ventas) solo ven/descargan los documentos
// (PDF, XML, CDR) de comprobantes ya emitidos. No emiten, ni notas (NC/ND), ni baja.
export default function PanelFacturacionSee({ orden, facturas = [], onRefresh, soloLectura = false }) {
  const [alerta, setAlerta] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [modalEmitir, setModalEmitir] = useState(false);
  const [modalNota, setModalNota] = useState(null);   // { factura }
  const [modalBaja, setModalBaja] = useState(null);    // { factura }
  const [notaTipo, setNotaTipo] = useState('07');
  const [notaMotivo, setNotaMotivo] = useState('01');
  const [bajaMotivo, setBajaMotivo] = useState('');
  // Vista previa calculada por el backend (misma lógica que el UBL builder → lo que se firma).
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const simbolo = orden?.moneda === 'USD' ? '$' : 'S/';
  const fmt = (v) => `${simbolo} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v || 0))}`;
  const fmtCant = (v) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(parseFloat(v || 0));
  const esCredito = String(orden?.tipo_venta || '').toLowerCase().startsWith('cr');

  // Datos derivados para la vista previa del comprobante (lo que se enviará a SUNAT).
  const esExportacion = Number(orden?.es_exportacion) === 1;
  const lineas = orden?.detalle || [];
  // Fecha de emisión editable: por defecto hoy; se permite retro-fechar hasta 2 días, nunca a
  // futuro, y nunca por debajo de la última factura ya emitida de la serie (regla cronológica:
  // los días previos solo quedan libres mientras no se haya avanzado la facturación). El backend
  // revalida ambas reglas. `preview.ultimaFechaEmitida` (YYYY-MM-DD) llega al abrir el modal.
  const hoyISO = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD'
  const minVentana = new Date(Date.now() - 2 * 86400000).toLocaleDateString('en-CA');
  const ultimaFechaEmitida = preview?.ultimaFechaEmitida || null;
  const minISO = ultimaFechaEmitida && ultimaFechaEmitida > minVentana ? ultimaFechaEmitida : minVentana;
  const [fechaEmision, setFechaEmision] = useState(hoyISO);
  const fechaFmt = (iso) => { const [y, m, d] = (iso || '').split('-'); return d ? `${d}/${m}/${y}` : iso; };
  // Vencimiento del crédito = fecha de EMISIÓN de la factura + días de crédito (mismo cálculo que el
  // backend en el XML/PDF). Se recalcula al cambiar la fecha de emisión para que la previa no muestre
  // el vencimiento de la OV (que parte de la fecha de la orden, no de la emisión).
  const addDiasISO = (iso, dias) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    d.setDate(d.getDate() + Number(dias || 0));
    return d.toLocaleDateString('en-CA');
  };
  const vencimientoISO = esCredito ? addDiasISO(fechaEmision, orden?.dias_credito) : null;
  // Observaciones (cbc:Note) que SUNAT muestra como "Observaciones". Texto LIBRE editable.
  const [observaciones, setObservaciones] = useState('');
  const OBS_MAX = 250;
  // Orden de compra (cac:OrderReference) — campo PROPIO, ya no embebido en las observaciones.
  const [ordenCompra, setOrdenCompra] = useState('');
  const OC_MAX = 30;
  // ── Wizard de Nota de Crédito/Débito (2 pasos: formulario → preliminar estilo SUNAT) ──
  const [notaStep, setNotaStep] = useState(1);          // 1 = datos, 2 = preliminar
  const [notaSustento, setNotaSustento] = useState(''); // Motivo o Sustento (cbc:Description), lo escribe el usuario
  const [notaFecha, setNotaFecha] = useState(hoyISO);   // fecha de emisión editable (retro ≤2 días)
  const [notaPreview, setNotaPreview] = useState(null);
  const [notaPreviewLoading, setNotaPreviewLoading] = useState(false);
  const [notaPreviewError, setNotaPreviewError] = useState(null);
  const SUSTENTO_MAX = 250;
  // Símbolo/formato de la nota (según su propia moneda, que hereda de la factura afectada).
  const notaSimbolo = notaPreview?.moneda === 'USD' ? '$' : 'S/';
  const notaFmt = (v) => `${notaSimbolo} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v || 0))}`;
  const notaUltima = notaPreview?.ultimaFechaEmitida || null;
  const notaMinISO = notaUltima && notaUltima > minVentana ? notaUltima : minVentana;
  // Guías de remisión relacionadas (buscador manual): las GRE se emiten directo en SUNAT y no hay
  // registro local, así que se ingresan a mano (tipo 09/31 + serie + número) y se declaran en la
  // factura como cac:DespatchDocumentReference. `nuevaGuia` es la fila del formulario de alta.
  const [guiasRef, setGuiasRef] = useState([]);
  const [nuevaGuia, setNuevaGuia] = useState({ tipo_documento: '09', serie: '', numero: '' });
  const [guiaError, setGuiaError] = useState(null);
  // GRE del sistema ya ACEPTADAS de la OV: se auto-declaran (solo lectura, el backend las une).
  const [guiasSistema, setGuiasSistema] = useState([]);
  const TIPOS_GUIA = [['09', 'Guía de Remisión Remitente'], ['31', 'Guía de Remisión Transportista']];

  // Alta de una guía en la lista, con la MISMA validación de formato que el backend (para no llegar
  // a un rechazo de SUNAT): serie = 4 alfanuméricos; número = hasta 8 dígitos; sin duplicados.
  const agregarGuia = () => {
    const tipo_documento = nuevaGuia.tipo_documento;
    const serie = String(nuevaGuia.serie || '').toUpperCase().trim();
    const numero = String(nuevaGuia.numero || '').trim();
    if (!/^[A-Z0-9]{4}$/.test(serie)) { setGuiaError('La serie debe tener 4 caracteres alfanuméricos (p. ej. T001).'); return; }
    if (!/^\d{1,8}$/.test(numero)) { setGuiaError('El número debe ser solo dígitos (hasta 8).'); return; }
    if (guiasRef.some((g) => g.tipo_documento === tipo_documento && g.serie === serie && g.numero === numero)) {
      setGuiaError('Esa guía ya está en la lista.'); return;
    }
    setGuiasRef((prev) => [...prev, { tipo_documento, serie, numero }]);
    setNuevaGuia({ tipo_documento, serie: '', numero: '' });
    setGuiaError(null);
  };
  const quitarGuia = (i) => setGuiasRef((prev) => prev.filter((_, idx) => idx !== i));

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
    const r = await tras(() => sunatAPI.emitirFactura(orden.id_orden_venta, {
      fecha_emision: fechaEmision,
      observaciones,
      orden_compra_cliente: ordenCompra,
      guias: guiasRef
    }), null);
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
  // Descarga directa (con nombre SUNAT) del XML firmado o del CDR, igual que las cotizaciones.
  const handleDescargar = async (url) => { try { await sunatAPI.descargarArchivoUrl(url); } catch (e) { setAlerta({ type: 'error', message: errorMsg(e) }); } };

  // Abre el wizard de nota sobre una factura, reiniciando el formulario en el paso 1.
  const abrirNota = (factura) => {
    setNotaTipo('07'); setNotaMotivo('01'); setNotaSustento('');
    setNotaFecha(hoyISO); setNotaStep(1);
    setNotaPreview(null); setNotaPreviewError(null);
    setModalNota({ factura });
  };

  const handleEmitirNota = async () => {
    const r = await tras(() => sunatAPI.emitirNota({
      id_factura_ref: modalNota.factura.id_factura, tipo: notaTipo,
      motivo_codigo: notaMotivo, sustento: notaSustento, fecha_emision: notaFecha
    }), null);
    const d = r?.data;
    if (d) {
      setAlerta(d.ok
        ? { type: 'success', message: `Nota ${d.comprobante} ${d.estado} por SUNAT.` }
        : { type: d.estado === 'RECHAZADO' ? 'error' : 'warning', message: `Nota ${d.serie}-${d.numero}: ${d.estado}. ${d.descripcion || ''}` });
    }
    setModalNota(null);
  };

  const handleBaja = async () => {
    if (!bajaMotivo.trim()) { setAlerta({ type: 'error', message: 'Indique el motivo de la baja.' }); return; }
    await tras(() => sunatAPI.darDeBaja(modalBaja.factura.id_factura, bajaMotivo.trim()), 'Comunicación de baja enviada.');
    setModalBaja(null); setBajaMotivo('');
  };

  // Al abrir el modal de emisión, pide al backend la vista previa (fuente única de cálculo).
  useEffect(() => {
    if (!modalEmitir || !orden?.id_orden_venta) return undefined;
    let cancel = false;
    setPreviewLoading(true); setPreviewError(null); setPreview(null);
    sunatAPI.previewComprobante(orden.id_orden_venta)
      .then((r) => {
        if (cancel) return;
        setPreview(r.data);
        setObservaciones(r.data?.observacion || '');
        setOrdenCompra(r.data?.ordenCompra || '');
        setGuiasRef([]);
        setGuiasSistema(Array.isArray(r.data?.guiasSistema) ? r.data.guiasSistema : []);
        setNuevaGuia({ tipo_documento: '09', serie: '', numero: '' });
        setGuiaError(null);
      })
      .catch((e) => { if (!cancel) setPreviewError(errorMsg(e)); })
      .finally(() => { if (!cancel) setPreviewLoading(false); });
    return () => { cancel = true; };
  }, [modalEmitir, orden?.id_orden_venta]);

  // Al entrar al paso 2 (preliminar), pide al backend el mismo cálculo/desglose que se firmará.
  // Se refresca si cambia el tipo o el motivo (cambian serie, etiqueta y documento).
  useEffect(() => {
    if (!modalNota?.factura || notaStep !== 2) return undefined;
    let cancel = false;
    setNotaPreviewLoading(true); setNotaPreviewError(null);
    sunatAPI.previewNota({ id_factura_ref: modalNota.factura.id_factura, tipo: notaTipo, motivo_codigo: notaMotivo })
      .then((r) => { if (!cancel) setNotaPreview(r.data); })
      .catch((e) => { if (!cancel) setNotaPreviewError(errorMsg(e)); })
      .finally(() => { if (!cancel) setNotaPreviewLoading(false); });
    return () => { cancel = true; };
  }, [modalNota, notaStep, notaTipo, notaMotivo]);

  // En solo lectura la tarjeta aparece únicamente cuando ya hay un comprobante emitido.
  if (soloLectura && comprobantes.length === 0) return null;

  return (
    <div className="card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-sm">
          <Zap size={16} className="text-amber-500" /> Facturación Electrónica (SEE)
        </h3>
        {!soloLectura && puedeEmitir && (
          <button className="btn btn-sm btn-primary" onClick={() => { setFechaEmision(hoyISO); setModalEmitir(true); }} disabled={procesando}>
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
            const esRechazo = f.sunat_estado === 'RECHAZADO' || f.sunat_estado === 'ERROR';
            return (
              <div key={f.id_factura} className="border border-gray-200 rounded p-2 flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-sm">{f.numero_factura || `${f.serie}-${f.numero}`}</span>
                <BadgeEstadoSunat estado={f.sunat_estado} />
                <span className="text-xs text-muted">{fmt(f.total)}</span>
                <div className="flex flex-wrap items-center gap-1 ml-auto">
                  {(aceptado || f.sunat_estado === 'BAJA' || f.sunat_estado === 'RECHAZADO') && (
                    <button className="btn btn-xs btn-outline" onClick={() => handlePdf(f)} disabled={procesando}
                      title={f.sunat_estado === 'RECHAZADO' ? 'Ver PDF (rechazado, con marca y motivo)' : 'Ver PDF SEE'}>
                      <FileText size={13} className="mr-1" /> PDF
                    </button>
                  )}
                  {f.xml_url && (
                    <button className="btn btn-xs btn-outline" onClick={() => handleDescargar(f.xml_url)} disabled={procesando} title="Descargar XML firmado">
                      <FileCode size={13} className="mr-1" /> XML
                    </button>
                  )}
                  {f.cdr_url && (
                    <button className="btn btn-xs btn-outline" onClick={() => handleDescargar(f.cdr_url)} disabled={procesando} title="Descargar CDR de SUNAT">
                      <FileCheck size={13} className="mr-1" /> CDR
                    </button>
                  )}
                  {!soloLectura && (
                    <button className="btn btn-xs btn-outline" onClick={() => handleVerificar(f)} disabled={procesando} title="Verificar estado en SUNAT">
                      <RefreshCw size={13} className="mr-1" /> Estado
                    </button>
                  )}
                  {!soloLectura && esFactura && aceptado && (
                    <>
                      <button className="btn btn-xs btn-outline" onClick={() => abrirNota(f)} disabled={procesando} title="Emitir Nota de Crédito/Débito">
                        <FileMinus size={13} className="mr-1" /> NC/ND
                      </button>
                      <button className="btn btn-xs btn-danger" onClick={() => { setBajaMotivo(''); setModalBaja({ factura: f }); }} disabled={procesando} title="Comunicación de baja (≤7 días)">
                        <Ban size={13} className="mr-1" /> Baja
                      </button>
                    </>
                  )}
                </div>
                {esRechazo && (f.sunat_response_desc || f.sunat_response_code) && (
                  <div className="w-full text-xs bg-red-50 border border-red-200 text-red-700 rounded px-2 py-1">
                    <span className="font-semibold">
                      Motivo del rechazo{f.sunat_response_code ? ` (${f.sunat_response_code})` : ''}:
                    </span>{' '}
                    {f.sunat_response_desc || 'Sin detalle. Usa "Estado" para consultar el CDR en SUNAT.'}
                  </div>
                )}
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
              <input
                type="date"
                className="form-input w-full text-sm font-semibold py-0.5 px-1 bg-white"
                value={fechaEmision}
                min={minISO}
                max={hoyISO}
                onChange={(e) => setFechaEmision(e.target.value)}
                disabled={procesando}
              />
              {fechaEmision !== hoyISO && (
                <div className="text-[10px] text-amber-600 mt-0.5">Retro-fechada al {fechaFmt(fechaEmision)} (dentro del plazo).</div>
              )}
              {ultimaFechaEmitida && ultimaFechaEmitida >= hoyISO && (
                <div className="text-[10px] text-muted mt-0.5">Ya existe una factura con fecha {fechaFmt(ultimaFechaEmitida)}: no se puede retro-fechar.</div>
              )}
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

          {/* Información adicional del comprobante: Orden de compra (campo propio) + Observaciones */}
          <div className="border border-gray-200 rounded p-3 space-y-3">
            {/* Orden de compra → cac:OrderReference (ya no viaja dentro de las observaciones). */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-muted uppercase">Orden de compra</label>
                <span className="text-[10px] text-muted">{ordenCompra.length}/{OC_MAX}</span>
              </div>
              <input
                type="text"
                className="form-input w-full text-sm"
                maxLength={OC_MAX}
                value={ordenCompra}
                onChange={(e) => setOrdenCompra(e.target.value)}
                placeholder="Ej: 15152"
                disabled={procesando || previewLoading}
              />
              <div className="text-[10px] text-muted mt-0.5">
                Viaja como campo propio del comprobante (cac:OrderReference) y se rotula aparte en el PDF, igual que en SUNAT.
              </div>
            </div>
            {/* Observaciones → cbc:Note (texto libre). */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-muted uppercase">Observaciones (aparecen en SUNAT)</label>
                <span className="text-[10px] text-muted">{observaciones.length}/{OBS_MAX}</span>
              </div>
              <textarea
                className="form-input w-full text-sm"
                rows={2}
                maxLength={OBS_MAX}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas libres del comprobante"
                disabled={procesando || previewLoading}
              />
              <div className="text-[10px] text-muted mt-0.5">
                Texto libre que viaja en el comprobante (cbc:Note) y verás en SUNAT.
              </div>
            </div>
          </div>

          {/* Guías de remisión relacionadas → cac:DespatchDocumentReference (buscador manual). */}
          <div className="border border-gray-200 rounded p-3 space-y-2">
            <label className="text-[10px] text-muted uppercase">Guías de remisión relacionadas</label>
            <div className="text-[10px] text-muted -mt-1">
              Agrega las guías que amparan el traslado (se declaran en la factura). Como las emites directo en SUNAT, ingrésalas a mano.
            </div>
            {/* GRE ya emitidas desde el sistema para esta OV: se declaran solas (no editables). */}
            {guiasSistema.length > 0 && (
              <div className="text-[11px] bg-blue-50 border border-blue-200 rounded px-2 py-1">
                <span className="text-blue-700 font-semibold">Ya incluidas (emitidas desde el sistema): </span>
                <span className="font-mono">{guiasSistema.map((g) => `${g.serie}-${g.numero}`).join(', ')}</span>
              </div>
            )}
            {/* Formulario de alta: tipo + serie + número + botón agregar. */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[10px] text-muted mb-0.5">Tipo de documento</label>
                <select
                  className="form-select w-full text-sm"
                  value={nuevaGuia.tipo_documento}
                  onChange={(e) => setNuevaGuia((g) => ({ ...g, tipo_documento: e.target.value }))}
                  disabled={procesando || previewLoading}
                >
                  {TIPOS_GUIA.map(([cod, txt]) => <option key={cod} value={cod}>{cod} — {txt}</option>)}
                </select>
              </div>
              <div className="w-24">
                <label className="block text-[10px] text-muted mb-0.5">Serie</label>
                <input
                  type="text" className="form-input w-full text-sm font-mono" maxLength={4}
                  value={nuevaGuia.serie}
                  onChange={(e) => setNuevaGuia((g) => ({ ...g, serie: e.target.value.toUpperCase() }))}
                  placeholder="T001" disabled={procesando || previewLoading}
                />
              </div>
              <div className="w-32">
                <label className="block text-[10px] text-muted mb-0.5">Número</label>
                <input
                  type="text" className="form-input w-full text-sm font-mono" maxLength={8}
                  value={nuevaGuia.numero}
                  onChange={(e) => setNuevaGuia((g) => ({ ...g, numero: e.target.value.replace(/\D/g, '') }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarGuia(); } }}
                  placeholder="123" disabled={procesando || previewLoading}
                />
              </div>
              <button type="button" className="btn btn-sm btn-outline" onClick={agregarGuia} disabled={procesando || previewLoading}>
                Agregar
              </button>
            </div>
            {guiaError && <div className="text-[11px] text-red-600">{guiaError}</div>}
            {/* Lista de guías agregadas, con eliminar por fila. */}
            {guiasRef.length > 0 ? (
              <ul className="space-y-1">
                {guiasRef.map((g, i) => (
                  <li key={`${g.tipo_documento}-${g.serie}-${g.numero}`} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1">
                    <span className="text-muted">{g.tipo_documento === '31' ? 'Transportista' : 'Remitente'}</span>
                    <span className="font-mono font-semibold">{g.serie}-{g.numero}</span>
                    <button type="button" className="ml-auto text-red-600 hover:underline" onClick={() => quitarGuia(i)} disabled={procesando}>
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-[11px] text-muted italic">Sin guías relacionadas.</div>
            )}
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
            {esCredito && vencimientoISO && (
              <span><span className="text-muted">Vence:</span> <strong>{fechaFmt(vencimientoISO)}</strong></span>
            )}
            <span><span className="text-muted">Ítems:</span> <strong>{preview?.lineas?.length ?? lineas.length}</strong></span>
          </div>

          {/* Avisos del backend (no bloquean la vista previa, sí la emisión real). */}
          {previewError && <Alert type="error" message={previewError} onClose={() => setPreviewError(null)} />}
          {preview?.avisos?.length > 0 && <Alert type="warning" message={preview.avisos.join(' ')} />}

          {/* Detalle de productos (líneas del comprobante) — calculado por el backend (fuente única) */}
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
                {previewLoading ? (
                  <tr><td colSpan={7} className="p-3 text-center text-muted"><RefreshCw size={14} className="inline animate-spin mr-1" /> Calculando comprobante…</td></tr>
                ) : !preview?.lineas?.length ? (
                  <tr><td colSpan={7} className="p-3 text-center text-muted">La orden no tiene líneas de detalle.</td></tr>
                ) : preview.lineas.map((l) => (
                  <tr key={l.numero} className="border-t border-gray-100">
                    <td className="p-2 font-mono">{l.codigo || '-'}</td>
                    <td className="p-2">{l.descripcion}</td>
                    <td className="p-2 text-center">{l.unidad || '—'}</td>
                    <td className="p-2 text-right">{fmtCant(l.cantidad)}</td>
                    <td className="p-2 text-right">{fmt(l.valorUnitario)}</td>
                    <td className="p-2 text-right">{fmt(l.valorVenta)}</td>
                    <td className="p-2 text-right">{fmt(l.igv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totales (calculados por el backend — idénticos a lo que se firma) */}
          <div className="flex justify-end">
            <div className="w-full md:w-72 space-y-1">
              <div className="flex justify-between"><span className="text-muted">{esExportacion ? 'Op. exportación:' : (preview && preview.igv === 0 ? 'Op. no gravada:' : 'Op. gravada:')}</span><span>{fmt(preview?.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted">{esExportacion ? 'IGV exportación (0%):' : 'IGV (18%):'}</span><span>{fmt(preview?.igv)}</span></div>
              <div className="flex justify-between font-bold border-t border-gray-200 pt-1 text-base"><span>Importe total:</span><span>{fmt(preview?.total)}</span></div>
            </div>
          </div>

          {preview?.montoEnLetras && (
            <p className="text-[11px] text-muted"><span className="uppercase font-semibold">Son:</span> {preview.montoEnLetras}</p>
          )}
          <p className="text-[11px] text-muted italic">Los importes los calcula el servidor con la MISMA lógica (afectación por línea, redondeo half-up) que se usa al firmar el UBL, así que coinciden con lo que se declara. SUNAT aún podría observar por reglas de formato.</p>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <button className="btn btn-sm btn-outline" onClick={() => setModalEmitir(false)} disabled={procesando}>Cancelar</button>
            <button className="btn btn-sm btn-primary" onClick={handleEmitir} disabled={procesando}>{procesando ? 'Emitiendo…' : 'Confirmar y emitir a SUNAT'}</button>
          </div>
        </div>
      </Modal>

      {/* Modal: Nota de Crédito/Débito — wizard 2 pasos (datos → preliminar estilo SUNAT) */}
      <Modal
        isOpen={!!modalNota}
        onClose={() => !procesando && setModalNota(null)}
        title={notaStep === 1 ? 'Emitir Nota de Crédito / Débito' : `Preliminar de ${notaTipo === '08' ? 'Nota de Débito' : 'Nota de Crédito'}`}
        size="lg"
      >
        {/* ── Paso 1: datos de la nota ── */}
        {notaStep === 1 && (
          <div className="space-y-3 text-sm">
            <p className="text-muted text-xs">
              Sobre la factura <strong className="font-mono">{modalNota?.factura?.numero_factura}</strong>. Se emite una nota <strong>total</strong> (replica el detalle de la orden).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Fecha de emisión</label>
                <input
                  type="date"
                  className="form-input w-full"
                  value={notaFecha}
                  min={notaMinISO}
                  max={hoyISO}
                  onChange={(e) => setNotaFecha(e.target.value)}
                  disabled={procesando}
                />
                {notaFecha !== hoyISO && (
                  <div className="text-[10px] text-amber-600 mt-0.5">Retro-fechada al {fechaFmt(notaFecha)} (dentro del plazo).</div>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Tipo de nota</label>
                <select className="form-select w-full" value={notaTipo} disabled={procesando}
                  onChange={(e) => { setNotaTipo(e.target.value); setNotaMotivo(MOTIVOS[e.target.value][0][0]); }}>
                  <option value="07">Nota de Crédito (07)</option>
                  <option value="08">Nota de Débito (08)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Documento que modifica</label>
                <input type="text" className="form-input w-full bg-gray-50 font-mono" value={modalNota?.factura?.numero_factura || ''} readOnly disabled />
                <div className="text-[10px] text-muted mt-0.5">Seleccionado automáticamente (factura afectada).</div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Motivo</label>
                <select className="form-select w-full" value={notaMotivo} disabled={procesando} onChange={(e) => setNotaMotivo(e.target.value)}>
                  {MOTIVOS[notaTipo].map(([cod, txt]) => <option key={cod} value={cod}>{cod} — {txt}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted">Motivo o Sustento</label>
                <span className="text-[10px] text-muted">{notaSustento.length}/{SUSTENTO_MAX}</span>
              </div>
              <textarea
                className="form-input w-full"
                rows={3}
                maxLength={SUSTENTO_MAX}
                value={notaSustento}
                onChange={(e) => setNotaSustento(e.target.value)}
                placeholder="Ej: Anulación por acuerdo con el cliente…"
                disabled={procesando}
              />
              <div className="text-[10px] text-muted mt-0.5">Texto libre que viaja a SUNAT (cbc:Description) y aparece en el comprobante.</div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button className="btn btn-sm btn-outline" onClick={() => setModalNota(null)} disabled={procesando}>Cerrar</button>
              <button className="btn btn-sm btn-primary" onClick={() => setNotaStep(2)} disabled={procesando || !notaSustento.trim()}>Continuar</button>
            </div>
          </div>
        )}

        {/* ── Paso 2: preliminar estilo SUNAT ── */}
        {notaStep === 2 && (
          <div className="space-y-3 text-sm">
            {notaPreviewLoading && <p className="text-muted text-xs">Calculando preliminar…</p>}
            {notaPreviewError && <Alert type="error" message={notaPreviewError} />}
            {notaPreview && (
              <>
                {/* Cabecera del emisor */}
                <div className="text-center border-b border-gray-200 pb-2">
                  <div className="font-bold uppercase">{notaPreview.empresa?.razon_social}</div>
                  <div className="text-[10px] text-muted">{notaPreview.empresa?.direccion}</div>
                  <div className="mt-1 font-semibold">{notaPreview.tipoLabel}</div>
                  <div className="font-mono text-xs">RUC: {notaPreview.empresa?.ruc}</div>
                </div>

                {/* Datos de cabecera */}
                <div className="text-xs space-y-0.5">
                  <div><span className="text-muted">Fecha de Emisión: </span><strong>{fechaFmt(notaFecha)}</strong></div>
                  <div><span className="text-muted">Documento que modifica — {notaPreview.docAfectado?.tipoLabel}: </span>
                    <strong className="font-mono">{notaPreview.docAfectado?.numero}</strong></div>
                  <div><span className="text-muted">Señor(es): </span><strong>{notaPreview.cliente?.razon_social}</strong></div>
                  <div><span className="text-muted">{String(notaPreview.cliente?.tipo_documento || '').toUpperCase() === 'RUC' ? 'RUC' : 'Documento'}: </span>
                    <strong className="font-mono">{notaPreview.cliente?.ruc || '-'}</strong></div>
                  {notaPreview.cliente?.direccion && (
                    <div><span className="text-muted">Dirección del Receptor: </span>{notaPreview.cliente.direccion}</div>
                  )}
                  <div><span className="text-muted">Tipo de Moneda: </span><strong>{notaPreview.monedaLabel}</strong></div>
                  <div><span className="text-muted">Motivo o Sustento: </span><strong>{notaSustento}</strong></div>
                  {notaPreview.motivo?.label && (
                    <div className="uppercase font-semibold text-[11px]">{notaPreview.motivo.label}</div>
                  )}
                </div>

                {/* Desglose de totales (estilo SUNAT) */}
                <div className="border border-gray-200 rounded divide-y divide-gray-100 text-xs">
                  {[
                    ['Sub Total Ventas', notaPreview.totales?.subtotal],
                    ['Anticipos', notaPreview.totales?.anticipos],
                    ['Descuentos', notaPreview.totales?.descuentos],
                    ['Valor Venta', notaPreview.totales?.valorVenta],
                    ['ISC', notaPreview.totales?.isc],
                    ['IGV', notaPreview.totales?.igv],
                    ['Otros Cargos', notaPreview.totales?.otrosCargos],
                    ['Otros Tributos', notaPreview.totales?.otrosTributos],
                    ['Monto de redondeo', notaPreview.totales?.redondeo]
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between px-3 py-1">
                      <span className="text-muted">{label}</span>
                      <span className="font-mono">{notaFmt(val)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-1.5 bg-gray-50 font-semibold">
                    <span>Importe Total</span>
                    <span className="font-mono">{notaFmt(notaPreview.totales?.total)}</span>
                  </div>
                </div>

                {notaPreview.montoEnLetras && (
                  <p className="text-[11px] text-muted"><span className="uppercase font-semibold">Son:</span> {notaPreview.montoEnLetras}</p>
                )}

                {/* Información del crédito (solo si la factura es a crédito) */}
                {notaPreview.credito?.esCredito && (
                  <div className="border border-gray-200 rounded p-2 text-xs space-y-1">
                    <div className="font-semibold">Información del crédito</div>
                    <div className="flex justify-between"><span className="text-muted">Monto neto pendiente de pago</span>
                      <span className="font-mono">{notaFmt(notaPreview.credito.montoPendiente)}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Total de Cuotas</span>
                      <span>{notaPreview.credito.totalCuotas}</span></div>
                    <div className="grid grid-cols-3 gap-1 text-[11px] font-semibold text-muted border-t border-gray-100 pt-1 mt-1">
                      <span>Nº Cuota</span><span>Fec. Venc.</span><span className="text-right">Monto</span>
                    </div>
                    {(notaPreview.credito.cuotas || []).map((q) => (
                      <div key={q.n} className="grid grid-cols-3 gap-1 text-[11px]">
                        <span>{q.n}</span><span>{fechaFmt(q.venc)}</span>
                        <span className="text-right font-mono">{notaFmt(q.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {Array.isArray(notaPreview.avisos) && notaPreview.avisos.length > 0 && (
                  <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-700 rounded px-2 py-1">
                    {notaPreview.avisos.map((a, i) => <div key={i}>• {a}</div>)}
                  </div>
                )}

                <p className="text-[11px] text-muted italic">Los importes los calcula el servidor con la MISMA lógica del UBL que se firma. SUNAT aún podría observar por reglas de formato.</p>
              </>
            )}

            <div className="flex justify-between gap-2 pt-2 border-t border-gray-200">
              <button className="btn btn-sm btn-outline" onClick={() => setNotaStep(1)} disabled={procesando}>Retroceder</button>
              <div className="flex gap-2">
                <button className="btn btn-sm btn-outline" onClick={() => setModalNota(null)} disabled={procesando}>Cerrar</button>
                <button className="btn btn-sm btn-primary" onClick={handleEmitirNota} disabled={procesando || notaPreviewLoading || !notaPreview}>
                  {procesando ? 'Emitiendo…' : 'Emitir'}
                </button>
              </div>
            </div>
          </div>
        )}
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
