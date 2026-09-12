// components/Ventas/sunat/PanelGuiaRemisionSee.jsx — Fase 14 (paso 4).
// Card independiente de GRE Remitente (09) electrónica para el detalle de una guía de remisión.
// Espeja PanelFacturacionSee pero opera sobre UNA sola guía. Coexiste con el flujo manual (no lo
// reemplaza). Gatear su render con tienePermiso('facturacion') desde el contenedor.
import { useState, useEffect } from 'react';
import { Zap, FileText, FileCode, FileCheck, RefreshCw, Ban, ChevronLeft, ChevronRight, Check, Truck, MapPin, Package, ExternalLink } from 'lucide-react';
import Modal from '../../UI/Modal';
import Alert from '../../UI/Alert';
import BadgeEstadoSunat from './BadgeEstadoSunat';
import UbigeoSelector from '../../common/UbigeoSelector';
import { resolverUbigeoDesdeDireccion } from '../../../utils/ubigeo';
import { sunatAPI, ordenesVentaAPI, guiasRemisionAPI } from '../../../config/api';

// ── Validadores de formato (espejo del backend util.service.js) para bloquear "Emitir" ───────────
// Placa peruana: alfanumérica, sin guion/espacios; se acepta "B2Q671" y "B2Q-671" (ambas → B2Q671).
const normPlaca = (p) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const placaOk = (p) => /^[A-Z0-9]{6,8}$/.test(normPlaca(p));
const dniOk = (d) => /^\d{8}$/.test(String(d || '').trim());
const ubigeoOk = (u) => /^\d{6}$/.test(String(u || '').trim());
const codigoBienOk = (v) => !v || /^\d{13}$/.test(String(v).trim());

// Motivo de traslado (catálogo 20) según sea comercio exterior o no.
const MOTIVOS_DOMESTICO = [
  { cod: '01', label: 'Venta' },
  { cod: '02', label: 'Compra' },
  { cod: '04', label: 'Traslado entre establecimientos de la misma empresa' },
  { cod: '14', label: 'Venta sujeta a confirmación del comprador' },
  { cod: '13', label: 'Otros' },
];
const MOTIVOS_COMEX = [
  { cod: '09', label: 'Exportación' },
  { cod: '08', label: 'Importación' },
];
const labelMotivo = (cod) => [...MOTIVOS_DOMESTICO, ...MOTIVOS_COMEX].find((m) => m.cod === cod)?.label || cod;

// `soloLectura`: perfiles de venta (Comercial/Ventas) ven y descargan PDF/XML/CDR de la GRE
// ya emitida. No emiten ni registran bajas.
export default function PanelGuiaRemisionSee({ guia, onRefresh, soloLectura = false }) {
  const [alerta, setAlerta] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [modalEmitir, setModalEmitir] = useState(false);
  // Wizard de emisión estilo SUNAT: paso actual + formulario editable (prellenado desde la guía/OV).
  const [wizStep, setWizStep] = useState(0);
  const [emitForm, setEmitForm] = useState(null);
  // Catálogos de flota para el modo "vehículo propio de la empresa".
  const [conductores, setConductores] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  // empresa_config es la fuente autoritativa del punto de partida en ventas y del punto de llegada
  // en compras.
  const [empresaRemitente, setEmpresaRemitente] = useState(null);
  const [modalSinEfecto, setModalSinEfecto] = useState(false);
  const [ubigeoDetectado, setUbigeoDetectado] = useState(null);
  const hoyIsoLima = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const [bajaForm, setBajaForm] = useState({
    causal: 'TRASLADO_NO_INICIADO', motivo: '', fecha: hoyIsoLima,
    confirmacionSol: false, evidenciaUrl: '', origen: 'SOL_PREVIA'
  });

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
  // Guía de COMPRA (motivo 02): SPI recoge su mercadería; NO depende de una OV despachada.
  const esCompra = guia?.tipo_origen === 'Compra';
  const ordenDespachada = esCompra || guia?.estado_orden === 'Despachada';
  const puedeEmitir = guiaVigente && sinEmitirSunat && ordenDespachada;
  const enviado = estado === 'ENVIADO';
  const aceptado = estado === 'ACEPTADO';
  const bajaLocalSinConfirmar = estado === 'ANULADA' && Number(guia?.baja_sunat_confirmada) !== 1;
  const cerradaOk = ['ACEPTADO', 'ANULADA', 'REEMPLAZADA'].includes(estado);

  // En venta el punto de partida vigente siempre procede de empresa_config. Las guías de compra
  // conservan como partida el domicilio del proveedor porque SPI recoge allí la mercadería.
  const partidaDireccion = esCompra
    ? (guia?.direccion_partida || guia?.punto_partida || '')
    : (empresaRemitente?.direccion || guia?.direccion_partida || guia?.punto_partida || '');
  const partidaUbigeo = esCompra
    ? (guia?.ubigeo_partida || '')
    : (empresaRemitente?.ubigeo || guia?.ubigeo_partida || '');

  const llegadaDireccion = esCompra
    ? (empresaRemitente?.direccion || '')
    : (guia?.direccion_llegada || guia?.punto_llegada || '');
  const llegadaUbigeo = esCompra
    ? (empresaRemitente?.ubigeo || '')
    : (guia?.ubigeo_llegada || '');

  // Prerrequisitos autoritativos: empresa_config aporta partida en ventas y llegada en compras.
  const faltantes = [];
  if (puedeEmitir && (!partidaDireccion || !/^\d{6}$/.test(String(partidaUbigeo || '')))) {
    faltantes.push(esCompra ? 'dirección/ubigeo de partida del proveedor' : 'dirección/ubigeo de partida en la configuración de la empresa');
  }
  if (puedeEmitir && esCompra && (!llegadaDireccion || !/^\d{6}$/.test(String(llegadaUbigeo || '')))) {
    faltantes.push('dirección/ubigeo de llegada en la configuración de la empresa');
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

  // Modo de transporte inicial derivado de la guía: tercero (empresa de transporte), particular
  // (carro común del cliente, texto libre) o flota (vehículo propio de la empresa).
  const modoInicial = guia?.id_transportista
    ? 'tercero'
    : (guia?.transporte_modo === 'particular' || guia?.transporte_placa) ? 'particular' : 'flota';

  // Catálogos de flota (solo se necesitan para el modo "vehículo propio"). Se cargan una vez.
  useEffect(() => {
    if (soloLectura) return;
    (async () => {
      try {
        const [rc, rv] = await Promise.all([ordenesVentaAPI.getConductores(), ordenesVentaAPI.getVehiculos()]);
        if (rc.data?.success) setConductores(rc.data.data || []);
        if (rv.data?.success) setVehiculos(rv.data.data || []);
      } catch { /* no crítico: el modo flota simplemente no listará opciones */ }
      try {
        const re = await guiasRemisionAPI.getEmpresaRemitente();
        if (re.data?.data) setEmpresaRemitente(re.data.data);
      } catch { /* no crítico: solo respalda el punto de partida */ }
    })();
  }, [soloLectura]);

  // Abre el wizard de emisión, prellenando TODOS los campos editables desde la guía/OV.
  const abrirEmitir = () => {
    const comex = !!guia?.es_comercio_exterior;
    const direccionLlegada = llegadaDireccion;
    // En comercio exterior manda el ubigeo fijo elegido con el puerto; no se recalcula desde texto.
    const ubicacion = comex ? null : resolverUbigeoDesdeDireccion(direccionLlegada);
    const ubigeoGuardado = llegadaUbigeo;
    setUbigeoDetectado(!ubigeoGuardado ? ubicacion : null);
        setEmitForm({
      es_comercio_exterior: comex,
      motivo_traslado_cod: guia?.motivo_traslado_cod || (comex ? '09' : (esCompra ? '02' : '01')),
      peso_bruto_kg: guia?.peso_bruto_kg ?? '',
      direccion_llegada: direccionLlegada,
      ubigeo_llegada: ubigeoGuardado || ubicacion?.codigo || '',
      ciudad_llegada: guia?.ciudad_llegada || ubicacion?.distrito || '',
      observaciones: guia?.observacion_sugerida ?? guia?.observaciones ?? '',
      transporteModo: modoInicial,
      placa: guia?.transporte_placa || guia?.ov_transporte_placa || '',
      dni: guia?.transporte_dni || guia?.ov_transporte_dni || '',
      conductor: guia?.transporte_conductor || guia?.ov_transporte_conductor || '',
      licencia: guia?.transporte_licencia || guia?.ov_transporte_licencia || '',
      id_conductor: guia?.id_conductor ? String(guia.id_conductor) : '',
      id_vehiculo: guia?.id_vehiculo ? String(guia.id_vehiculo) : '',
      id_conductor2: guia?.id_conductor2 ? String(guia.id_conductor2) : '',
      id_vehiculo2: guia?.id_vehiculo2 ? String(guia.id_vehiculo2) : '',
      registrar: guia?.ov_transporte_registrar === 0 ? false : true,
      indTransbordo: !!guia?.ov_ind_transbordo,
      indM1l: !!guia?.ov_ind_m1l,
      indRetornoVacio: !!guia?.ov_ind_retorno_vacio,
            // Código de Bien opcional por línea (lo indica el cliente): si se completa, reemplaza al
      // código interno del producto en esa línea al declararla a SUNAT. Editable antes de emitir.
      codigosBien: Object.fromEntries(
        (guia?.detalle || []).map((it) => [it.id_detalle, it.codigo_bien || ''])
      ),
    });
    setWizStep(0);
    setAlerta(null);
    setModalEmitir(true);
  };

  const setF = (k, v) => setEmitForm((f) => ({ ...f, [k]: v }));
  const setCodigoBien = (idDetalle, valor) => {
    const limpio = valor.replace(/\D/g, '').slice(0, 13);
    setEmitForm((f) => ({ ...f, codigosBien: { ...f.codigosBien, [idDetalle]: limpio } }));
  };
  const handleDireccionLlegada = (direccion) => {
    if (emitForm?.es_comercio_exterior) {
      setF('direccion_llegada', direccion);
      setUbigeoDetectado(null);
      return;
    }
    const ubicacion = resolverUbigeoDesdeDireccion(direccion);
    setEmitForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        direccion_llegada: direccion,
        ...(ubicacion ? {
          ubigeo_llegada: ubicacion.codigo,
          ciudad_llegada: ubicacion.distrito || ''
        } : {
          ubigeo_llegada: '',
          ciudad_llegada: ''
        })
      };
    });
    setUbigeoDetectado(ubicacion);
  };

  // Al cambiar comercio exterior se reajusta el motivo al primero válido de su lista.
  const toggleComex = (comex) => {
    setEmitForm((f) => ({
      ...f,
      es_comercio_exterior: comex,
      // En compra el motivo siempre es 02 (no cae a "01 Venta" si se togglea comercio exterior).
      motivo_traslado_cod: comex ? MOTIVOS_COMEX[0].cod : (esCompra ? '02' : MOTIVOS_DOMESTICO[0].cod),
    }));
  };

  const handleEmitir = async () => {
    const f = emitForm;
    const transporte = f.transporteModo === 'tercero'
      ? { modo: 'tercero', registrar: f.registrar, indicadores: { transbordo: f.indTransbordo, m1l: f.indM1l, retornoVacio: f.indRetornoVacio } }
      : f.transporteModo === 'particular'
        ? { modo: 'particular', placa: normPlaca(f.placa), dni: f.dni.trim(), conductor: f.conductor.trim(), licencia: f.licencia.trim() }
        : { modo: 'flota', id_conductor: f.id_conductor || null, id_vehiculo: f.id_vehiculo || null,
            id_conductor2: f.id_conductor2 || null, id_vehiculo2: f.id_vehiculo2 || null };
        const payload = {
      observaciones: f.observaciones,
      direccion_llegada: f.direccion_llegada,
      ubigeo_llegada: f.ubigeo_llegada,
      ciudad_llegada: f.ciudad_llegada,
      peso_bruto_kg: f.peso_bruto_kg,
      motivo_traslado_cod: f.motivo_traslado_cod,
      es_comercio_exterior: f.es_comercio_exterior,
      transporte,
            // Código de Bien del cliente (13 dígitos), opcional por línea: si se envía, reemplaza el
      // código interno en esa línea del XML. Se filtran las vacías para no pisar con ''.
      codigos_bien: Object.entries(f.codigosBien || {})
        .filter(([, v]) => v)
        .map(([id_detalle, codigo_bien]) => ({ id_detalle: Number(id_detalle), codigo_bien })),
    };
    const r = await tras(() => sunatAPI.emitirGuia(guia.id_guia, payload), null);
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
  const archivoUrl = (v) => {
    if (!v) return null;
    if (Array.isArray(v)) return archivoUrl(v[0]);
    if (typeof v === 'object') return v.url || null;
    if (typeof v === 'string') {
      try { return archivoUrl(JSON.parse(v)); } catch { return v; }
    }
    return null;
  };
  const handleArchivo = async (tipo) => {
    try {
      if (tipo === 'xml') await sunatAPI.descargarXmlGuia(guia.id_guia);
      else await sunatAPI.descargarCdrGuia(guia.id_guia);
    }
    catch (e) { setAlerta({ type: 'error', message: errorMsg(e) }); }
  };

  const abrirBaja = () => {
    setBajaForm({ causal: 'TRASLADO_NO_INICIADO', motivo: '', fecha: hoyIsoLima, confirmacionSol: false, evidenciaUrl: '', origen: 'SOL_PREVIA' });
    setAlerta(null);
    setModalSinEfecto(true);
  };

  const handleSinEfecto = async () => {
    if (!bajaForm.motivo.trim()) { setAlerta({ type: 'error', message: 'Indique el sustento de la baja.' }); return; }
    if (!bajaForm.confirmacionSol) { setAlerta({ type: 'error', message: 'Primero complete la baja en SUNAT SOL y marque la confirmación.' }); return; }
    const r = await tras(() => sunatAPI.confirmarBajaGuia(guia.id_guia, {
      causal: bajaForm.causal,
      motivo: bajaForm.motivo.trim(),
      fecha_baja_sunat: bajaForm.fecha,
      confirmacion_sol: true,
      origen: bajaForm.origen,
      ...(bajaForm.evidenciaUrl.trim() ? { evidencia_url: bajaForm.evidenciaUrl.trim() } : {})
    }), 'Baja realizada en SUNAT SOL confirmada y sincronizada en SPI.');
    if (r) setModalSinEfecto(false);
  };

  // ── Estado derivado del wizard de emisión (recomputado en cada render; emitForm es null si cerrado) ──
  const f = emitForm;
  const condFlota = conductores.find((c) => String(c.id_empleado) === String(f?.id_conductor));
  const vehFlota = vehiculos.find((v) => String(v.id_vehiculo) === String(f?.id_vehiculo));
  const condFlota2 = conductores.find((c) => String(c.id_empleado) === String(f?.id_conductor2));
  const vehFlota2 = vehiculos.find((v) => String(v.id_vehiculo) === String(f?.id_vehiculo2));
  const MOTIVOS_ACTUALES = f?.es_comercio_exterior ? MOTIVOS_COMEX : MOTIVOS_DOMESTICO;
  // Resumen de transporte para la vista previa (según el modo elegido).
  const resTransporte = !f ? null : (
    f.transporteModo === 'tercero'
      ? { modalidad: f.registrar ? 'Público (01) — registra veh/cond (Caso 2/3)' : 'Público (01) — solo transportista (Caso 1)',
          empresa: guia?.transportista_razon || guia?.ov_transporte_nombre,
          ruc: guia?.transportista_ruc || guia?.ov_transporte_ruc,
          mtc: guia?.transportista_mtc || guia?.ov_transporte_mtc,
          registrar: f.registrar,
          fechaEntrega: guia?.ov_transporte_fecha_entrega || null,
          indicadores: { transbordo: f.indTransbordo, m1l: f.indM1l, retornoVacio: f.indRetornoVacio },
          vehiculos: f.registrar ? [
            guia?.ov_transporte_placa ? { placa: normPlaca(guia.ov_transporte_placa), tuce: guia?.ov_transporte_tuc, autorizacion: guia?.ov_transporte_autorizacion } : null,
            guia?.ov_transporte_placa2 ? { placa: normPlaca(guia.ov_transporte_placa2), tuce: guia?.ov_transporte_tuc2, autorizacion: guia?.ov_transporte_autorizacion2 } : null,
          ].filter(Boolean) : [],
          conductores: f.registrar ? [
            guia?.ov_transporte_dni ? { nombre: guia.ov_transporte_conductor, dni: guia.ov_transporte_dni, licencia: guia.ov_transporte_licencia } : null,
            guia?.ov_transporte_dni2 ? { nombre: guia.ov_transporte_conductor2, dni: guia.ov_transporte_dni2, licencia: guia.ov_transporte_licencia2 } : null,
          ].filter(Boolean) : [] }
      : f.transporteModo === 'particular'
        ? { modalidad: 'Privado (02) — carro particular', conductor: f.conductor, dni: f.dni, licencia: f.licencia, placa: normPlaca(f.placa) }
        : { modalidad: 'Privado (02) — vehículo propio', conductor: condFlota?.nombre_completo, dni: condFlota?.dni, licencia: condFlota?.licencia_conducir, placa: vehFlota?.placa,
            conductor2: condFlota2?.nombre_completo, dni2: condFlota2?.dni, licencia2: condFlota2?.licencia_conducir, placa2: vehFlota2?.placa }
  );
  
  // Validez por paso (bloquea "Siguiente"/"Emitir" hasta que el formato sea correcto → sin rechazos SUNAT).
    const codigosBienOk = !f ? true : Object.values(f.codigosBien || {}).every(codigoBienOk);
  const vGeneral = !!f && Number(f.peso_bruto_kg) > 0 && !!f.motivo_traslado_cod && codigosBienOk;
  const vLlegada = !!f && !!String(f.direccion_llegada).trim() && ubigeoOk(f.ubigeo_llegada);
  const vTransporte = !f ? false : (
    f.transporteModo === 'tercero'
      ? !!(guia?.id_transportista || guia?.ov_transporte_ruc)
      : f.transporteModo === 'particular'
        ? placaOk(f.placa) && dniOk(f.dni) && !!String(f.conductor).trim() && !!String(f.licencia).trim()
        : !!(f.id_conductor && f.id_vehiculo && condFlota?.licencia_conducir
             // Si se eligió un 2º conductor, debe tener licencia registrada (SUNAT la exige).
             && (!f.id_conductor2 || !!condFlota2?.licencia_conducir))
  );
  const vPaso1 = vLlegada && vTransporte;
  const puedeEmitirWizard = vGeneral && vPaso1;
  const pasoActualValido = wizStep === 0 ? vGeneral : wizStep === 1 ? vPaso1 : puedeEmitirWizard;
  const PASOS = ['Datos generales', 'Transporte y llegada', 'Vista previa'];

  // En solo lectura la tarjeta aparece únicamente cuando la GRE ya está emitida y con PDF disponible.
  if (soloLectura && !(tieneComprobante && cerradaOk)) return null;

  return (
    <div className="card p-3 space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-sm">
          <Zap size={16} className="text-amber-500" /> Guía de Remisión Electrónica (SEE · GRE 09)
        </h3>
        {!soloLectura && puedeEmitir && (
          <button className="btn btn-sm btn-primary" onClick={abrirEmitir} disabled={procesando || faltantes.length > 0}>
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
          {archivoUrl(guia?.xml_url) && (
            <button className="btn btn-xs btn-outline" onClick={() => handleArchivo('xml')} disabled={procesando} title="Descargar XML firmado">
              <FileCode size={13} className="mr-1" /> XML
            </button>
          )}
          {archivoUrl(guia?.cdr_url) && (
            <button className="btn btn-xs btn-outline" onClick={() => handleArchivo('cdr')} disabled={procesando} title="Descargar CDR de SUNAT">
              <FileCheck size={13} className="mr-1" /> CDR
            </button>
          )}
          {!soloLectura && enviado && (
            <button className="btn btn-xs btn-outline" onClick={handleVerificar} disabled={procesando} title="Reconsultar estado en SUNAT">
              <RefreshCw size={13} className="mr-1" /> Estado
            </button>
          )}
          {!soloLectura && (aceptado || bajaLocalSinConfirmar) && (
            <button className="btn btn-xs btn-danger" onClick={abrirBaja} disabled={procesando} title="Registrar una baja realizada en SUNAT SOL">
              <Ban size={13} className="mr-1" /> {bajaLocalSinConfirmar ? 'Sincronizar baja SUNAT' : 'Baja SUNAT'}
            </button>
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

      {/* Wizard de emisión estilo SUNAT: 3 pasos + Retroceder/Cancelar/Emitir */}
      <Modal isOpen={modalEmitir} onClose={() => !procesando && setModalEmitir(false)} title="Emitir Guía de Remisión Electrónica (GRE 09)" size="xl">
        {f && (
        <div className="space-y-3 text-sm">
          {/* Barra de pasos */}
          <div className="flex items-center gap-1 text-xs">
            {PASOS.map((p, i) => (
              <div key={p} className="flex items-center gap-1">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${i === wizStep ? 'bg-primary text-on-accent' : i < wizStep ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {i < wizStep ? <Check size={12} /> : i + 1}
                </span>
                <span className={i === wizStep ? 'font-semibold' : 'text-muted'}>{p}</span>
                {i < PASOS.length - 1 && <ChevronRight size={13} className="text-gray-300 mx-1" />}
              </div>
            ))}
          </div>

          {/* ── PASO 1: Datos generales ── */}
          {wizStep === 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">¿Es una operación de comercio exterior?</label>
                  <div className="flex gap-2">
                    <button type="button" className={`btn btn-sm ${f.es_comercio_exterior ? 'btn-primary' : 'btn-outline'}`} onClick={() => toggleComex(true)}>Sí</button>
                    <button type="button" className={`btn btn-sm ${!f.es_comercio_exterior ? 'btn-primary' : 'btn-outline'}`} onClick={() => toggleComex(false)}>No</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Motivo de traslado *</label>
                  <select className="form-input w-full text-sm" value={f.motivo_traslado_cod} onChange={(e) => setF('motivo_traslado_cod', e.target.value)}>
                    {MOTIVOS_ACTUALES.map((m) => <option key={m.cod} value={m.cod}>{m.label} ({m.cod})</option>)}
                  </select>
                </div>
              </div>

              {/* Contraparte: cliente (venta) o proveedor (compra). En compra el destinatario del XML
                  es la propia empresa; aquí se muestra el proveedor como referencia de la operación. */}
              <div className="border border-gray-200 rounded p-3">
                <div className="text-[10px] text-muted uppercase mb-1">{esCompra ? 'Proveedor' : 'Destinatario (de la orden)'}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between gap-2"><span className="text-muted">Razón social:</span><span className="font-medium text-right">{(esCompra ? guia?.proveedor : guia?.cliente) || '-'}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted">RUC:</span><span className="font-mono">{(esCompra ? guia?.ruc_proveedor : guia?.ruc_cliente) || '-'}</span></div>
                </div>
              </div>

              {/* Detalle de bienes (de la OV, solo lectura) */}
                            <div className="border border-gray-200 rounded overflow-x-auto">
                <div className="text-[10px] text-muted uppercase px-2 pt-2 flex items-center gap-1"><Package size={12} /> Bienes por transportar (de la orden)</div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 text-muted">
                    <tr>
                      <th className="text-left p-2">Código</th>
                      <th className="text-left p-2">Descripción</th>
                      <th className="text-center p-2">Und</th>
                      <th className="text-right p-2">Cant.</th>
                      <th className="text-right p-2">Peso total</th>
                      <th className="text-left p-2">Código de Bien del cliente (opcional)</th>                    
                      </tr>
                  </thead>
                  <tbody>
                    {lineas.length === 0 ? (
                      <tr><td colSpan={6} className="p-3 text-center text-muted">La guía no tiene detalle.</td></tr>
                    ) : lineas.map((it, i) => {
                      const idL = it.id_detalle || it.id_producto || i;
                      const valor = f.codigosBien?.[it.id_detalle] ?? '';
                      const ok = codigoBienOk(valor);
                      return (
                        <tr key={idL} className="border-t border-gray-100">
                          <td className="p-2 font-mono">{it.codigo_producto || '-'}</td>
                          <td className="p-2">{it.producto || it.descripcion}</td>
                          <td className="p-2 text-center">{it.unidad_medida || 'NIU'}</td>
                          <td className="p-2 text-right">{fmtCant(it.cantidad)}</td>
                          <td className="p-2 text-right">{fmtPeso(it.peso_total_kg)}</td>
                          <td className="p-2">
                            <input
                              className={`form-input w-full text-xs font-mono ${valor && !ok ? 'border-danger' : ''}`}
                              value={valor}
                              onChange={(e) => setCodigoBien(it.id_detalle, e.target.value)}
                              placeholder="13 dígitos (código de bien del cliente)"
                              maxLength={13}
                            />
                            {valor && !ok && <p className="text-[10px] text-danger mt-0.5">Debe tener 13 dígitos.</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Carga */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Unidad de peso bruto</label>
                  <input className="form-input w-full text-sm bg-gray-50" value="KGM (kilogramos)" readOnly />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Peso bruto total *</label>
                  <input type="number" step="0.01" min="0" className={`form-input w-full text-sm ${Number(f.peso_bruto_kg) > 0 ? '' : 'border-danger'}`} value={f.peso_bruto_kg} onChange={(e) => setF('peso_bruto_kg', e.target.value)} />
                  {!(Number(f.peso_bruto_kg) > 0) && <p className="text-[11px] text-danger mt-1">El peso debe ser mayor a 0.</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 2: Transporte y punto de llegada ── */}
          {wizStep === 1 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><Truck size={13} /> Modalidad de transporte</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    { k: 'flota', t: 'Vehículo propio', d: 'Camioneta/carro de la empresa (flota)' },
                    { k: 'particular', t: 'Carro particular del cliente', d: 'Carro común, no es empresa de transporte' },
                    { k: 'tercero', t: 'Empresa de transporte', d: 'Transportista con RUC (modalidad pública)' },
                  ].map((o) => (
                    <button key={o.k} type="button" onClick={() => setF('transporteModo', o.k)}
                      className={`text-left border rounded p-2 ${f.transporteModo === o.k ? 'border-primary bg-blue-50' : 'border-gray-200'}`}>
                      <div className="font-semibold text-xs">{o.t}</div>
                      <div className="text-[11px] text-muted">{o.d}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Campos por modalidad */}
              {f.transporteModo === 'flota' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Conductor (flota) *</label>
                      <select className="form-input w-full text-sm" value={f.id_conductor} onChange={(e) => setF('id_conductor', e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {conductores.map((c) => <option key={c.id_empleado} value={c.id_empleado}>{c.nombre_completo} (DNI {c.dni})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Vehículo / placa (flota) *</label>
                      <select className="form-input w-full text-sm" value={f.id_vehiculo} onChange={(e) => setF('id_vehiculo', e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {vehiculos.map((v) => <option key={v.id_vehiculo} value={v.id_vehiculo}>{v.placa}{v.marca_modelo ? ` — ${v.marca_modelo}` : ''}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Datos que se declaran a SUNAT, autocompletados del maestro al elegir conductor/vehículo. */}
                  {(condFlota || vehFlota) && (
                    <div className="rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-800 grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                      <div>DNI: <span className="font-mono font-semibold">{condFlota?.dni || '—'}</span></div>
                      <div>Licencia: <span className="font-mono font-semibold">{condFlota?.licencia_conducir || '—'}</span></div>
                      <div>Placa: <span className="font-mono font-semibold">{vehFlota?.placa ? normPlaca(vehFlota.placa) : '—'}</span></div>
                      {condFlota && !condFlota.licencia_conducir && (
                        <div className="md:col-span-3 text-amber-700">Este conductor no tiene licencia registrada en su ficha de empleado. Complétala antes de emitir.</div>
                      )}
                    </div>
                  )}

                  {/* Segundo conductor / vehículo (opcional). SUNAT admite hasta 2 de cada uno. */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Conductor secundario (opcional)</label>
                      <select className="form-input w-full text-sm" value={f.id_conductor2} onChange={(e) => setF('id_conductor2', e.target.value)}>
                        <option value="">— Ninguno —</option>
                        {conductores.filter((c) => String(c.id_empleado) !== String(f.id_conductor)).map((c) => <option key={c.id_empleado} value={c.id_empleado}>{c.nombre_completo} (DNI {c.dni})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Vehículo secundario (opcional)</label>
                      <select className="form-input w-full text-sm" value={f.id_vehiculo2} onChange={(e) => setF('id_vehiculo2', e.target.value)}>
                        <option value="">— Ninguno —</option>
                        {vehiculos.filter((v) => String(v.id_vehiculo) !== String(f.id_vehiculo)).map((v) => <option key={v.id_vehiculo} value={v.id_vehiculo}>{v.placa}{v.marca_modelo ? ` — ${v.marca_modelo}` : ''}</option>)}
                      </select>
                    </div>
                  </div>
                  {(condFlota2 || vehFlota2) && (
                    <div className="rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-800 grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                      <div>DNI 2: <span className="font-mono font-semibold">{condFlota2?.dni || '—'}</span></div>
                      <div>Licencia 2: <span className="font-mono font-semibold">{condFlota2?.licencia_conducir || '—'}</span></div>
                      <div>Placa 2: <span className="font-mono font-semibold">{vehFlota2?.placa ? normPlaca(vehFlota2.placa) : '—'}</span></div>
                      {condFlota2 && !condFlota2.licencia_conducir && (
                        <div className="md:col-span-3 text-amber-700">El conductor secundario no tiene licencia registrada en su ficha. Complétala o quítalo.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {f.transporteModo === 'particular' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del conductor *</label>
                    <input className="form-input w-full text-sm" value={f.conductor} onChange={(e) => setF('conductor', e.target.value)} placeholder="Ej. CHAVEZ GUERRA CHARLES JORGE" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">DNI del conductor *</label>
                    <input className={`form-input w-full text-sm ${f.dni && !dniOk(f.dni) ? 'border-danger' : ''}`} value={f.dni} onChange={(e) => setF('dni', e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="8 dígitos" />
                    {f.dni && !dniOk(f.dni) && <p className="text-[11px] text-danger mt-1">El DNI debe tener 8 dígitos.</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Licencia de conducir *</label>
                    <input className="form-input w-full text-sm" value={f.licencia} onChange={(e) => setF('licencia', e.target.value)} placeholder="Ej. Q07471043" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Placa del vehículo *</label>
                    <input className={`form-input w-full text-sm ${f.placa && !placaOk(f.placa) ? 'border-danger' : ''}`} value={f.placa} onChange={(e) => setF('placa', e.target.value.toUpperCase())} placeholder="Ej. B2Q-671 o B2Q671" />
                    {f.placa
                      ? (placaOk(f.placa)
                          ? <p className="text-[11px] text-green-600 mt-1">Se enviará como: <span className="font-mono font-bold">{normPlaca(f.placa)}</span></p>
                          : <p className="text-[11px] text-danger mt-1">Placa inválida (6 a 8 caracteres alfanuméricos; el guion/espacio se ignora).</p>)
                      : <p className="text-[11px] text-muted mt-1">Acepta con o sin guion; se normaliza para SUNAT.</p>}
                  </div>
                </div>
              )}

              {f.transporteModo === 'tercero' && (
                (guia?.id_transportista || guia?.ov_transporte_ruc) ? (
                  <div className="space-y-2">
                    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-xs">
                      <p className="font-medium text-green-900">{guia?.transportista_razon || guia?.ov_transporte_nombre || '(sin razón social)'}</p>
                      <p className="text-green-700">RUC {guia?.transportista_ruc || guia?.ov_transporte_ruc}{(guia?.transportista_mtc || guia?.ov_transporte_mtc) ? ` · MTC ${guia?.transportista_mtc || guia?.ov_transporte_mtc}` : ''}</p>
                      <p className="text-muted mt-1">Empresa, vehículos y conductores se toman de la orden ("Transporte y Logística"). Aquí ajustas el registro y los indicadores para esta emisión.</p>
                    </div>

                    {/* Interruptor registrar veh/cond (Caso 1 ↔ 2/3) */}
                    <label className="flex items-start gap-2 cursor-pointer border border-gray-200 rounded p-2">
                      <input type="checkbox" className="mt-1" checked={f.registrar} onChange={(e) => setF('registrar', e.target.checked)} />
                      <span className="text-xs">
                        <b>Registrar vehículos y conductores del transportista</b>
                        <span className="block text-muted">Si lo desactivas, la GRE declara solo al transportista (Caso 1) y él emite su GRE 31.</span>
                      </span>
                    </label>

                    {f.registrar ? (
                      <div className="border border-gray-200 rounded p-2 text-xs space-y-1">
                        <div className="text-[10px] text-muted uppercase">Se declararán (desde la orden)</div>
                        {(guia?.ov_transporte_placa || guia?.ov_transporte_placa2)
                          ? (<>
                              {guia?.ov_transporte_placa && <div>Veh. principal: <b>{normPlaca(guia.ov_transporte_placa)}</b>{guia?.ov_transporte_tuc ? ` · TUCE ${guia.ov_transporte_tuc}` : ''}{guia?.ov_transporte_autorizacion ? ` · Aut. ${guia.ov_transporte_autorizacion}` : ''}</div>}
                              {guia?.ov_transporte_placa2 && <div>Veh. secundario: <b>{normPlaca(guia.ov_transporte_placa2)}</b>{guia?.ov_transporte_tuc2 ? ` · TUCE ${guia.ov_transporte_tuc2}` : ''}{guia?.ov_transporte_autorizacion2 ? ` · Aut. ${guia.ov_transporte_autorizacion2}` : ''}</div>}
                            </>)
                          : <div className="text-amber-700">Falta la placa del vehículo en la orden.</div>}
                        {guia?.ov_transporte_dni && <div>Cond. principal: <b>{guia.ov_transporte_conductor}</b> (DNI {guia.ov_transporte_dni}, Lic. {guia.ov_transporte_licencia})</div>}
                        {guia?.ov_transporte_dni2 && <div>Cond. secundario: <b>{guia.ov_transporte_conductor2}</b> (DNI {guia.ov_transporte_dni2}, Lic. {guia.ov_transporte_licencia2})</div>}
                        {!guia?.ov_transporte_dni && <div className="text-amber-700">Falta el conductor en la orden.</div>}
                      </div>
                    ) : (
                      <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
                        No se declaran vehículos ni conductores: la GRE declara solo al transportista.
                      </div>
                    )}

                    {/* Indicadores (opcional) */}
                    <div className="border border-gray-200 rounded p-2 text-xs space-y-1">
                      <div className="text-[10px] text-muted uppercase">Indicadores (opcional)</div>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={f.indTransbordo} onChange={(e) => setF('indTransbordo', e.target.checked)} /> Transbordo programado</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={f.indM1l} onChange={(e) => setF('indM1l', e.target.checked)} /> Traslado en vehículo M1/L</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={f.indRetornoVacio} onChange={(e) => setF('indRetornoVacio', e.target.checked)} /> Retorno con envases/embalajes vacíos</label>
                    </div>
                  </div>
                ) : (
                  <Alert type="warning" message="Esta orden no tiene una empresa de transporte con RUC. Regístrala en 'Transporte y Logística' de la orden, o usa otra modalidad." />
                )
              )}

              {/* Punto de partida (fijo) / llegada (editable) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-gray-200 rounded p-3">
                  <div className="text-[10px] text-muted uppercase mb-1 flex items-center gap-1"><MapPin size={12} /> Punto de partida (fijo)</div>
                  <div className="text-xs">{partidaDireccion || '-'}</div>
                  <div className="text-xs text-muted mt-1">Ubigeo: <span className="font-mono">{partidaUbigeo || '—'}</span></div>
                </div>
                <div className="border border-gray-200 rounded p-3 space-y-2">
                  <div className="text-[10px] text-muted uppercase flex items-center gap-1"><MapPin size={12} /> Punto de llegada {esCompra ? '(empresa_config)' : '(editable)'}</div>
                  <div>
                    <label className="block text-[11px] text-muted mb-1">Dirección *</label>
                    <input
                      className="form-input w-full text-sm"
                      value={f.direccion_llegada}
                      onChange={(e) => handleDireccionLlegada(e.target.value)}
                      readOnly={esCompra}
                      placeholder="Dirección detallada, distrito, provincia, departamento"
                    />
                    {ubigeoDetectado && (
                      <p className="text-[11px] text-emerald-700 mt-1">
                        Detectado: {ubigeoDetectado.departamento} / {ubigeoDetectado.provincia} / {ubigeoDetectado.distrito} ({ubigeoDetectado.codigo})
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-1">Ubigeo * (Departamento / Provincia / Distrito)</label>
                    {esCompra ? (
                      <input className="form-input w-full text-sm font-mono bg-gray-50" value={f.ubigeo_llegada} readOnly />
                    ) : (
                      <UbigeoSelector
                        value={f.ubigeo_llegada}
                        required
                        onChange={(codigo, meta) => {
                          setUbigeoDetectado(null);
                          setEmitForm((prev) => prev ? {
                            ...prev,
                            ubigeo_llegada: codigo,
                            ciudad_llegada: meta?.distrito || ''
                          } : prev);
                        }}
                      />
                    )}
                    {esCompra && <p className="text-[11px] text-muted mt-1">Se usa la dirección fiscal configurada para la empresa.</p>}
                  </div>
                  {!ubigeoDetectado && f.direccion_llegada && !f.ubigeo_llegada && (
                    <p className="text-[11px] text-amber-700">Incluye distrito, provincia y departamento en la dirección o selecciónalos manualmente.</p>
                  )}
                  {f.ubigeo_llegada && !ubigeoOk(f.ubigeo_llegada) && <p className="text-[11px] text-danger">El ubigeo debe tener 6 dígitos.</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 3: Vista previa ── */}
          {wizStep === 2 && (
            <div className="space-y-3">
              <p className="text-muted text-xs">Esto es lo que se declarará a SUNAT (DespatchAdvice UBL 2.1). Revísalo antes de emitir.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-gray-50 rounded p-2"><div className="text-[10px] text-muted uppercase">Documento</div><div className="font-semibold">GRE Remitente (09)</div><div className="font-mono text-xs">Serie TE01</div></div>
                <div className="bg-gray-50 rounded p-2"><div className="text-[10px] text-muted uppercase">Fecha emisión</div><div className="font-semibold">{hoy}</div></div>
                <div className="bg-gray-50 rounded p-2"><div className="text-[10px] text-muted uppercase">Fecha traslado</div><div className="font-semibold">{guia?.fecha_traslado ? new Date(guia.fecha_traslado).toLocaleDateString('es-PE') : '-'}</div></div>
                <div className="bg-gray-50 rounded p-2"><div className="text-[10px] text-muted uppercase">Guía interna</div><div className="font-mono text-xs">{guia?.numero_guia}</div></div>
              </div>

              <div className={`grid grid-cols-1 ${esCompra ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-2`}>
                <div className="border border-gray-200 rounded p-3">
                  <div className="text-[10px] text-muted uppercase mb-1">Remitente</div>
                  <div className="font-medium">{empresaRemitente?.razon_social || '-'}</div>
                  <div className="font-mono text-xs">RUC {empresaRemitente?.ruc || '-'}</div>
                </div>
                <div className="border border-gray-200 rounded p-3">
                  <div className="text-[10px] text-muted uppercase mb-1">Destinatario</div>
                  <div className="font-medium">{(esCompra ? empresaRemitente?.razon_social : guia?.cliente) || '-'}</div>
                  <div className="font-mono text-xs">RUC {(esCompra ? empresaRemitente?.ruc : guia?.ruc_cliente) || '-'}</div>
                </div>
                {esCompra && (
                  <div className="border border-gray-200 rounded p-3">
                    <div className="text-[10px] text-muted uppercase mb-1">Proveedor (vendedor)</div>
                    <div className="font-medium">{guia?.proveedor || '-'}</div>
                    <div className="font-mono text-xs">RUC {guia?.ruc_proveedor || '-'}</div>
                  </div>
                )}
              </div>

              {esCompra && (
                <div className="border border-gray-200 rounded p-3 text-xs">
                  <div className="text-[10px] text-muted uppercase mb-1">Validación de identidad documental</div>
                  <div>Remitente y destinatario: <span className="font-semibold">{empresaRemitente?.razon_social || '—'}</span></div>
                  <div>Vendedor e issuer de la factura: <span className="font-semibold">{guia?.proveedor || '—'}</span> · RUC <span className="font-mono">{guia?.ruc_proveedor || '—'}</span></div>
                  <div>N.º de bultos: <span className="font-semibold">{guia?.numero_bultos ?? 0}</span></div>
                </div>
              )}

              {esCompra && guia?.oc_serie_documento && guia?.oc_numero_documento && (
                <div className="border border-gray-200 rounded p-3">
                  <div className="text-[10px] text-muted uppercase mb-1">Factura asociada</div>
                  <div className="font-mono font-semibold">{guia.oc_serie_documento}-{guia.oc_numero_documento}</div>
                  <div className="text-xs text-muted mt-1">Se declarará como documento relacionado, con el RUC del proveedor emisor.</div>
                </div>
              )}

              <div className="border border-gray-200 rounded p-3">
                <div className="text-[10px] text-muted uppercase mb-1">Traslado</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between gap-2"><span className="text-muted">Comercio exterior:</span><span>{f.es_comercio_exterior ? 'Sí' : 'No'}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted">Motivo:</span><span className="text-right">{labelMotivo(f.motivo_traslado_cod)} ({f.motivo_traslado_cod})</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted">Modalidad:</span><span className="text-right">{resTransporte?.modalidad}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted">Peso bruto:</span><span>{fmtPeso(f.peso_bruto_kg)}</span></div>
                </div>
              </div>

              <div className="border border-gray-200 rounded p-3">
                <div className="text-[10px] text-muted uppercase mb-1 flex items-center gap-1"><Truck size={12} /> Transporte</div>
                {resTransporte?.empresa && <div className="flex justify-between gap-2"><span className="text-muted">Empresa:</span><span className="text-right">{resTransporte.empresa} (RUC {resTransporte.ruc}{resTransporte.mtc ? ` · MTC ${resTransporte.mtc}` : ''})</span></div>}
                {f.transporteModo === 'tercero' ? (
                  <>
                    {resTransporte?.fechaEntrega && <div className="flex justify-between gap-2"><span className="text-muted">Fecha entrega al transportista:</span><span>{resTransporte.fechaEntrega}</span></div>}
                    {resTransporte?.registrar ? (
                      <>
                        {(resTransporte.vehiculos || []).map((v, i) => (
                          <div key={`v${i}`} className="flex justify-between gap-2"><span className="text-muted">{i === 0 ? 'Veh. principal:' : 'Veh. secundario:'}</span><span className="font-mono text-right">{v.placa}{v.tuce ? ` · TUCE ${v.tuce}` : ''}{v.autorizacion ? ` · Aut. ${v.autorizacion}` : ''}</span></div>
                        ))}
                        {(resTransporte.conductores || []).map((c, i) => (
                          <div key={`c${i}`} className="flex justify-between gap-2"><span className="text-muted">{i === 0 ? 'Cond. principal:' : 'Cond. secundario:'}</span><span className="text-right">{c.nombre} (DNI {c.dni}, Lic. {c.licencia})</span></div>
                        ))}
                      </>
                    ) : (
                      <div className="text-amber-700 text-xs mt-1">Solo se declara al transportista (Caso 1); él emite su GRE Transportista (31).</div>
                    )}
                    {(resTransporte?.indicadores?.transbordo || resTransporte?.indicadores?.m1l || resTransporte?.indicadores?.retornoVacio) && (
                      <div className="flex justify-between gap-2"><span className="text-muted">Indicadores:</span><span className="text-right">{[resTransporte.indicadores.transbordo && 'Transbordo', resTransporte.indicadores.m1l && 'M1/L', resTransporte.indicadores.retornoVacio && 'Retorno vacíos'].filter(Boolean).join(', ')}</span></div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex justify-between gap-2"><span className="text-muted">Conductor:</span><span className="text-right">{resTransporte?.conductor || '—'}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-muted">DNI:</span><span className="font-mono">{resTransporte?.dni || '—'}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-muted">Licencia:</span><span className="font-mono">{resTransporte?.licencia || '—'}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-muted">Placa:</span><span className="font-mono font-bold">{resTransporte?.placa || '—'}</span></div>
                    {resTransporte?.conductor2 && (
                      <>
                        <div className="flex justify-between gap-2"><span className="text-muted">Conductor 2:</span><span className="text-right">{resTransporte.conductor2}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-muted">DNI 2:</span><span className="font-mono">{resTransporte?.dni2 || '—'}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-muted">Licencia 2:</span><span className="font-mono">{resTransporte?.licencia2 || '—'}</span></div>
                      </>
                    )}
                    {resTransporte?.placa2 && (
                      <div className="flex justify-between gap-2"><span className="text-muted">Placa 2:</span><span className="font-mono font-bold">{normPlaca(resTransporte.placa2)}</span></div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="border border-gray-200 rounded p-3">
                  <div className="text-[10px] text-muted uppercase mb-1">Punto de partida</div>
                  <div className="text-xs">{partidaDireccion || '-'}</div>
                  <div className="text-xs text-muted mt-1">Ubigeo: <span className="font-mono">{partidaUbigeo || '—'}</span></div>
                </div>
                <div className="border border-gray-200 rounded p-3">
                  <div className="text-[10px] text-muted uppercase mb-1">Punto de llegada</div>
                  <div className="text-xs">{f.direccion_llegada || '-'}</div>
                  <div className="text-xs text-muted mt-1">Ubigeo: <span className="font-mono">{f.ubigeo_llegada || '—'}</span></div>
                </div>
              </div>

                            <div className="border border-gray-200 rounded overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 text-muted"><tr><th className="text-left p-2">Código</th><th className="text-left p-2">Descripción</th><th className="text-center p-2">Und</th><th className="text-right p-2">Cant.</th><th className="text-right p-2">Peso total</th></tr></thead>
                  <tbody>
                    {lineas.map((it, i) => {
                      const codigoBien = f.codigosBien?.[it.id_detalle];
                      return (
                        <tr key={it.id_detalle || it.id_producto || i} className="border-t border-gray-100">
                          <td className="p-2 font-mono">{codigoBien || it.codigo_producto || '-'}</td>
                          <td className="p-2">{it.producto || it.descripcion}</td>
                          <td className="p-2 text-center">{it.unidad_medida || 'NIU'}</td>
                          <td className="p-2 text-right">{fmtCant(it.cantidad)}</td>
                          <td className="p-2 text-right">{fmtPeso(it.peso_total_kg)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Observaciones (viajan a SUNAT como observación de la GRE)</label>
                <textarea className="form-input w-full text-sm" rows={2} maxLength={250} value={f.observaciones} onChange={(e) => setF('observaciones', e.target.value)} placeholder="Ej. OC: 260810058" />
                <p className="text-[11px] text-muted mt-1">Lo que escribas aquí es exactamente lo que se envía a SUNAT y se muestra en el PDF. (máx. 250)</p>
              </div>

              {f.es_comercio_exterior && (
                <Alert type="warning" message="Comercio exterior: la GRE de exportación/importación puede requerir datos adicionales según SUNAT. Verifica el resultado de la primera emisión." />
              )}
            </div>
          )}

          {/* Footer de navegación */}
          <div className="flex justify-between items-center gap-2 pt-2 border-t border-gray-200">
            <button className="btn btn-sm btn-outline" onClick={() => setModalEmitir(false)} disabled={procesando}>Cancelar</button>
            <div className="flex gap-2">
              {wizStep > 0 && (
                <button className="btn btn-sm btn-outline" onClick={() => setWizStep((s) => s - 1)} disabled={procesando}>
                  <ChevronLeft size={14} className="mr-1" /> Retroceder
                </button>
              )}
              {wizStep < 2 ? (
                <button className="btn btn-sm btn-primary" onClick={() => setWizStep((s) => s + 1)} disabled={!pasoActualValido}>
                  Siguiente <ChevronRight size={14} className="ml-1" />
                </button>
              ) : (
                <button className="btn btn-sm btn-primary" onClick={handleEmitir} disabled={procesando || !puedeEmitirWizard}>
                  <Zap size={14} className="mr-1" /> {procesando ? 'Emitiendo…' : 'Emitir a SUNAT'}
                </button>
              )}
            </div>
          </div>
        </div>
        )}
      </Modal>

      {/* Modal: baja oficial en SOL + sincronización local */}
      <Modal isOpen={modalSinEfecto} onClose={() => !procesando && setModalSinEfecto(false)} title="Dar de baja la GRE en SUNAT" size="md">
        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <p className="font-semibold">La baja oficial se completa en SUNAT SOL.</p>
            <p className="text-xs mt-1">El API REST de emisión GRE no ofrece una operación de baja. SPI solo registrará la baja después de tu confirmación y conservará la guía en el historial de la OV.</p>
            <a href="https://www.sunat.gob.pe/sol.html" target="_blank" rel="noreferrer" className="btn btn-sm btn-outline mt-3 inline-flex items-center">
              Ir a SUNAT SOL <ExternalLink size={13} className="ml-1" />
            </a>
          </div>
          <p>GRE: <strong className="font-mono">{comprobante}</strong></p>
          <div>
            <label className="block text-xs text-muted mb-1">Origen de la sincronización</label>
            <select className="form-select w-full" value={bajaForm.origen} onChange={(e) => setBajaForm((f) => ({ ...f, origen: e.target.value }))}>
              <option value="SOL_PREVIA">Inicié el proceso desde SPI y lo completé en SOL</option>
              <option value="SOL_MANUAL">La baja ya había sido realizada directamente en SOL</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Causal permitida por SUNAT</label>
            <select className="form-select w-full" value={bajaForm.causal} onChange={(e) => setBajaForm((f) => ({ ...f, causal: e.target.value }))}>
              <option value="TRASLADO_NO_INICIADO">El traslado todavía no se inició</option>
              <option value="CAMBIO_DESTINATARIO">Cambio de destinatario antes de llegar</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Sustento</label>
            <textarea className="form-input w-full" rows={3} value={bajaForm.motivo} onChange={(e) => setBajaForm((f) => ({ ...f, motivo: e.target.value }))} placeholder="Ej: Traslado cancelado antes de su inicio" maxLength={500} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Fecha de la baja en SUNAT</label>
            <input type="date" className="form-input w-full" value={bajaForm.fecha} max={hoyIsoLima} onChange={(e) => setBajaForm((f) => ({ ...f, fecha: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">URL de evidencia (opcional)</label>
            <input type="url" className="form-input w-full" value={bajaForm.evidenciaUrl} onChange={(e) => setBajaForm((f) => ({ ...f, evidenciaUrl: e.target.value }))} placeholder="https://..." />
          </div>
          <label className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={bajaForm.confirmacionSol} onChange={(e) => setBajaForm((f) => ({ ...f, confirmacionSol: e.target.checked }))} />
            <span className="text-xs text-red-900">Confirmo que ya realicé la baja de <strong>{comprobante}</strong> en SUNAT SOL y que los datos anteriores son correctos.</span>
          </label>
          <div className="rounded-md bg-gray-50 p-2 text-xs text-muted">
            Si la baja ya fue hecha anteriormente directamente en SUNAT, utiliza este mismo formulario para sincronizar su estado real en SPI.
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-sm btn-outline" onClick={() => setModalSinEfecto(false)} disabled={procesando}>Cancelar</button>
            <button className="btn btn-sm btn-danger" onClick={handleSinEfecto} disabled={procesando || !bajaForm.confirmacionSol || !bajaForm.motivo.trim() || !bajaForm.fecha}>
              {procesando ? 'Sincronizando…' : 'Confirmar baja y sincronizar'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
