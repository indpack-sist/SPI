// services/sunat/gre-emision.service.js — FASE 10: core de emisión de GRE Remitente (09).
// Extraído del controller para centralizar el pipeline SUNAT (mock en BETA → real en PROD).
import { pool, withTransaction } from '../../config/database.js';
import { sunatConfig } from '../../config/sunat.js';
import { obtenerCorrelativo } from './numeracion.service.js';
import { construirDespatchAdviceXML } from './ubl-gre.service.js';
import { firmarXml } from './firma.service.js';
import { zipXml } from './zip.service.js';
import { obtenerTokenGre, enviarGuia, consultarGuia } from './gre.service.js';
import { parsearCdr } from './cdr.service.js';
import { registrarSunatLog } from './log.service.js';
import { subirRaw } from '../cloudinary.service.js';
import { fechaLima } from './fecha.service.js';
import { sleep, copiaLocal, normalizarPlaca, componerObservacionGuia, placaValida, dniValido, ubigeoValido, codigoBienValido } from './util.service.js';
import AppError from '../../utils/AppError.js';

// Compatibilidad con reemplazos iniciados por versiones anteriores. Aceptar una GRE nueva no
// invalida la original en SUNAT; por eso esta reconciliación limpia la marca local y mantiene la
// original ACEPTADA. La baja real debe completarse por separado en SUNAT SOL.
async function finalizarReemplazoSiAplica(idGuiaCerrada, aceptado) {
  const [[orig]] = await pool.query(
    "SELECT id_guia, numero_guia FROM guias_remision WHERE id_guia_reemplazo = ? AND sunat_estado = 'ACEPTADO'",
    [idGuiaCerrada]);
  if (!orig) return; // la guía cerrada no es un reemplazo en curso: emisión normal.

  if (aceptado) {
    // Ambas GRE siguen aceptadas por SUNAT. Se elimina la relación local que antes podía marcar
    // incorrectamente la original como anulada/reemplazada.
    await pool.query(
      `UPDATE guias_remision
         SET id_guia_reemplazo = NULL, anulado_por = NULL,
             motivo_anulacion = NULL, fecha_anulacion = NULL
       WHERE id_guia = ?`,
      [orig.id_guia]);
    await registrarSunatLog({ origen: 'GRE_REMITENTE', referenciaId: orig.id_guia, evento: 'reemplazoNoAplicado',
      exito: false, httpStatus: 200,
      detalle: `Nueva guía id ${idGuiaCerrada} aceptada; ${orig.numero_guia} permanece ACEPTADA hasta una baja real en SUNAT SOL` });
  } else {
    // La guía nueva fue RECHAZADA → aborta el reemplazo: la original vuelve a quedar intacta (ACEPTADO).
    await pool.query(
      `UPDATE guias_remision
         SET id_guia_reemplazo = NULL, anulado_por = NULL, motivo_anulacion = NULL, fecha_anulacion = NULL
       WHERE id_guia = ?`, [orig.id_guia]);
    await registrarSunatLog({ origen: 'GRE_REMITENTE', referenciaId: orig.id_guia, evento: 'reemplazoAbortado',
      exito: false, httpStatus: 200, detalle: `Reemplazo abortado: guía nueva id ${idGuiaCerrada} rechazada; original ${orig.numero_guia} sigue vigente` });
  }
}

// Construye el snapshot INMUTABLE de un intento de emisión, en la MISMA forma que
// generarPdfGuia pasa a generarGuiaRemisionSunatPDF. Así el PDF histórico (con marca de agua
// RECHAZADO) se reimprime fielmente aunque la guía/OV cambien después. Ver docs/sql_gre_emisiones_historial.sql.
function construirSnapshotPdfGre({
  g, serie, numero, empresa, destinatario, proveedor, docRelacionado,
  carrier, registrar, conductores, vehiculos, indicadores, modalidad,
  fechaEntregaTransportista, comex, detalleEmision, fechaTraslado,
  emision, hora, observacion, esCompra, esComex,
}) {
  const isoAFmt = (v) => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : null; };
  const fechaEmisionFmt = `${isoAFmt(emision) || emision} ${hora || ''}`.trim();
  const clientePdf = esCompra
    ? { razon_social: empresa.razon_social, ruc: empresa.ruc, direccion: empresa.direccion }
    : {
        razon_social: destinatario?.razon_social,
        ruc: destinatario?.ruc || destinatario?.numero_documento || null,
        numero_documento: destinatario?.numero_documento || null,
        tipo_documento: destinatario?.tipo_documento || null,
        direccion: destinatario?.direccion || destinatario?.direccion_despacho || null,
      };
  const conductoresPdf = (conductores || []).map((c) => ({ dni: c.dni, nombre_completo: c.nombre, licencia_conducir: c.licencia }));
  const vehiculosPdf = (vehiculos || []).map((v) => ({ placa: v.placa, tuce: v.tuce || null, autorizacion: v.autorizacion || null }));
  const detallePdf = (detalleEmision || []).map((d) => ({
    cantidad: d.cantidad,
    subpartida_nacional: d.subpartida_nacional || null,
    codigo: d.codigo,
    nombre: d.nombre,
    codigo_unidad_sunat: d.codigo_unidad_sunat,
    codigo_bien: d.codigo_bien || null,
  }));
  let comexPdf = null;
  if (esComex && comex) {
    comexPdf = {
      destinatario: destinatario ? { razon_social: destinatario.razon_social, ruc: destinatario.ruc } : null,
      docsRelacionados: comex.docsRelacionados || [],
      contenedores: comex.contenedores || [],
      trasladoTotalDam: !!comex.trasladoTotalDam,
      unidadPeso: 'KGM',
    };
  }
  const [docSerie, docNumero] = String(docRelacionado?.numero || '').split('-');
  return {
    guia: {
      serie_sunat: serie, numero_sunat: numero,
      fecha_emision: fechaEmisionFmt, fecha_traslado: isoAFmt(fechaTraslado),
      motivo_traslado_cod: g.motivo_traslado_cod, peso_bruto_kg: g.peso_bruto_kg,
      ubigeo_partida: g.ubigeo_partida, direccion_partida: g.direccion_partida,
      ubigeo_llegada: g.ubigeo_llegada, direccion_llegada: g.direccion_llegada,
      observaciones: observacion, es_comercio_exterior: esComex ? 1 : 0,
      tipo_origen: g.tipo_origen,
    },
    cliente: clientePdf,
    detalle: detallePdf,
    transportista: carrier ? { razon: carrier.razon, ruc: carrier.ruc, mtc: carrier.mtc } : null,
    conductores: conductoresPdf,
    vehiculos: vehiculosPdf,
    indicadores: indicadores || {},
    registrar: !!registrar,
    modalidad,
    fechaEntrega: fechaEntregaTransportista || null,
    comex: comexPdf,
    proveedor: proveedor ? { razon_social: proveedor.razon_social, ruc: proveedor.ruc } : null,
    docRelacionado: docRelacionado ? { tipo_desc: docRelacionado.tipo_desc, serie: docSerie || null, numero: docNumero || null } : null,
  };
}

// Resuelve el intento (fila de guias_remision_emisiones) todavía abierto de una guía, para que la
// reconciliación por ticket (job de reintentos / botón "Estado") actualice la fila correcta cuando
// no se le pasa el id explícito.
async function resolverEmisionAbierta(idGuia) {
  const [[row]] = await pool.query(
    `SELECT id_emision FROM guias_remision_emisiones
      WHERE id_guia = ? AND (sunat_estado IS NULL OR sunat_estado NOT IN ('ACEPTADO','RECHAZADO'))
      ORDER BY id_emision DESC LIMIT 1`, [idGuia]);
  return row?.id_emision || null;
}

// Cierra el ticket de una GRE contra el CDR (o el mock BETA) y persiste el estado.
// `emisionId` (opcional) apunta al intento archivado; si no llega se resuelve el intento abierto.
export async function cerrarTicketGre(idGuia, nombre, ticket, st, t0, emisionId = null) {
  const aceptado = st.codRespuesta === '0';
  const estadoFinal = aceptado ? 'ACEPTADO' : (st.codRespuesta === '99' ? 'RECHAZADO' : 'ENVIADO');
  let cdr = null, cdrUrl = null, qrUrl = null;
  if (st.cdrZip) {
    cdr = parsearCdr(st.cdrZip);
    try { cdrUrl = await subirRaw(st.cdrZip, `sunat/cdr/R-${nombre}.zip`); }
    catch (e) { console.warn('[SUNAT] subir CDR GRE falló:', e.message); }
    await copiaLocal(`R-${nombre}.zip`, st.cdrZip);
  }
  const descripcion = aceptado
    ? (cdr?.description || (st.mock ? 'Guía aceptada (mock BETA, sin CDR real)' : 'Guía aceptada'))
    : (st.error ? `${st.error.numError || ''} ${st.error.desError || ''}`.trim() : `codRespuesta ${st.codRespuesta}`);
  await pool.query(
    `UPDATE guias_remision SET sunat_estado = ?, sunat_response_code = ?, sunat_response_desc = ?,
       cdr_url = COALESCE(?, cdr_url), sunat_qr_url = COALESCE(?, sunat_qr_url) WHERE id_guia = ?`,
    [estadoFinal, st.codRespuesta, String(descripcion).slice(0, 4000),
     cdrUrl ? JSON.stringify({ url: cdrUrl }) : null, qrUrl, idGuia]);
  // Espeja el estado final en el intento archivado (historial de emisiones). Best-effort: no debe
  // romper el cierre si la tabla aún no existe (instalaciones sin el DDL nuevo).
  try {
    const idEm = emisionId || await resolverEmisionAbierta(idGuia);
    if (idEm) {
      await pool.query(
        `UPDATE guias_remision_emisiones SET sunat_estado = ?, sunat_response_code = ?,
           sunat_response_desc = ?, cdr_url = COALESCE(?, cdr_url), sunat_qr_url = COALESCE(?, sunat_qr_url)
         WHERE id_emision = ?`,
        [estadoFinal, st.codRespuesta, String(descripcion).slice(0, 4000),
         cdrUrl ? JSON.stringify({ url: cdrUrl }) : null, qrUrl, idEm]);
    }
  } catch (e) { console.warn('[SUNAT] archivar cierre GRE emisión falló:', e.message); }
  await registrarSunatLog({ origen: 'GRE_REMITENTE', referenciaId: idGuia, evento: 'consultarGuia',
    exito: aceptado, httpStatus: 200, detalle: `${st.codRespuesta} ${descripcion}`.slice(0, 4000),
    duracionMs: Date.now() - t0 });
  // Compatibilidad: limpia cualquier reemplazo iniciado por una versión anterior.
  if (estadoFinal === 'ACEPTADO' || estadoFinal === 'RECHAZADO') {
    await finalizarReemplazoSiAplica(idGuia, aceptado);
  }
  return { aceptado, estadoFinal, codRespuesta: st.codRespuesta, descripcion, cdrUrl, mock: st.mock || false };
}

/**
 * Core de emisión de GRE Remitente (09) de una guias_remision existente.
 * @returns {Promise<{httpStatus:number, body:object}>}  (lanza AppError en validaciones)
 */
export async function emitirGuiaGre(idGuia, idEmpleado = null, observacionOverride = undefined) {
  if (!idGuia) throw new AppError('id de guía inválido', 400);
  const tipo = '09', serie = 'TE01';
  const { emision, hora, emisionDateTime } = fechaLima();

  // ── TX1: validar + reservar correlativo + marcar ENVIADO ──
  const prep = await withTransaction(async (conn) => {
    const [[g]] = await conn.query('SELECT * FROM guias_remision WHERE id_guia = ? FOR UPDATE', [idGuia]);
    if (!g) throw new AppError('Guía no existe', 404);
    if (g.sunat_estado === 'ACEPTADO') throw new AppError('La guía ya fue aceptada por SUNAT', 409);
    // Origen de la guía: 'Venta' (ligada a una OV despachada) o 'Compra' (ligada a una orden de
    // compra; SPI recoge su mercadería con flota propia y emite la GRE con motivo 02). La rama
    // Compra NO valida estado de OV ni carga cliente: el destinatario es la propia empresa.
    const esCompra = g.tipo_origen === 'Compra';

    let ov = null;
    if (!esCompra) {
      // Regla de negocio: la GRE de venta se emite una vez que la orden ya fue despachada.
      const [ovRows] = await conn.query(
        `SELECT estado, orden_compra_cliente, tipo_entrega, transporte_registrar,
                transporte_placa, transporte_conductor, transporte_dni, transporte_licencia,
                transporte_dni2, transporte_conductor2, transporte_licencia2,
                transporte_tuc, transporte_autorizacion,
                transporte_placa2, transporte_tuc2, transporte_autorizacion2,
                transporte_ind_transbordo, transporte_ind_m1l, transporte_ind_retorno_vacio,
                DATE_FORMAT(transporte_fecha_entrega, '%Y-%m-%d') AS transporte_fecha_entrega
           FROM ordenes_venta WHERE id_orden_venta = ?`, [g.id_orden_venta]);
      ov = ovRows[0] || null;
      if (!ov || ov.estado !== 'Despachada') {
        throw new AppError(`La orden debe estar en estado "Despachada" para emitir la GRE (estado actual: ${ov?.estado || 'desconocido'})`, 409);
      }
    }
    const [[empresa]] = await conn.query('SELECT * FROM empresa_config WHERE id = 1');
    if (!empresa) throw new AppError('Falta la configuración de la empresa remitente', 422);

    // En venta el origen es autoritativamente empresa_config. En compra lo es el destino, porque
    // SPI recoge los bienes del proveedor y los lleva a su propio establecimiento. Se sincroniza
    // justo antes de construir y firmar el XML, por lo que ningún cliente puede sobrescribirlo.
    if (esCompra) {
      g.direccion_llegada = String(empresa.direccion || '').trim();
      g.punto_llegada = g.direccion_llegada;
      g.ubigeo_llegada = String(empresa.ubigeo || '').trim();
      await conn.query(
        `UPDATE guias_remision
            SET direccion_llegada = ?, punto_llegada = ?, ubigeo_llegada = ?
          WHERE id_guia = ?`,
        [g.direccion_llegada, g.punto_llegada, g.ubigeo_llegada, idGuia]
      );
    }

    // En venta el origen es autoritativamente empresa_config. Se sincroniza dentro de esta
    // transacción, después de validar que la guía es emitible, para corregir también borradores
    // antiguos sin alterar documentos que ya fueron aceptados por SUNAT.
    if (!esCompra) {
      g.direccion_partida = String(empresa.direccion || '').trim();
      g.punto_partida = g.direccion_partida;
      g.ubigeo_partida = String(empresa.ubigeo || '').trim();
      await conn.query(
        `UPDATE guias_remision
            SET direccion_partida = ?, punto_partida = ?, ubigeo_partida = ?
          WHERE id_guia = ?`,
        [g.direccion_partida, g.punto_partida, g.ubigeo_partida, idGuia]
      );
    }

    if (!g.direccion_partida || !g.direccion_llegada) {
      throw new AppError('Faltan las direcciones de partida/llegada', 422);
    }
    if (!g.ubigeo_partida || !g.ubigeo_llegada) throw new AppError('Faltan ubigeos de partida/llegada (6 dígitos)', 422);
    if (!(Number(g.peso_bruto_kg) > 0)) throw new AppError('peso_bruto_kg debe ser > 0', 422);
    if (!g.motivo_traslado_cod) throw new AppError('Falta motivo_traslado_cod (catálogo 20)', 422);

    // Destinatario de la GRE + (solo compra) proveedor y documento relacionado.
    const esComex = Number(g.es_comercio_exterior) === 1;
    let destinatario, proveedor = null, docRelacionado = undefined;
    if (esCompra) {
      // Compra: destinatario = la propia empresa; el vendedor va en SellerSupplierParty; la factura
      // del proveedor se referencia con IssuerParty. Espeja EG07-333.
      const [[oc]] = await conn.query(
        'SELECT id_proveedor, tipo_documento, serie_documento, numero_documento FROM ordenes_compra WHERE id_orden_compra = ?',
        [g.id_orden_compra]);
      if (!oc) throw new AppError('Orden de compra de la guía no existe', 404);
      const [[prov]] = await conn.query(
        'SELECT ruc, razon_social FROM proveedores WHERE id_proveedor = ?', [g.id_proveedor || oc.id_proveedor]);
      if (!prov?.ruc) throw new AppError('Proveedor de la guía no existe', 404);
      proveedor = { ruc: prov.ruc, razon_social: prov.razon_social };
      destinatario = { ruc: empresa.ruc, razon_social: empresa.razon_social, tipo_documento: 'RUC' };
      const tipoDocumentoCompra = String(oc.tipo_documento || '').trim().toLowerCase();
      const esFacturaCompra = tipoDocumentoCompra === '01' || tipoDocumentoCompra.includes('factura');
      const serieFactura = String(oc.serie_documento || '').trim();
      const numeroFactura = String(oc.numero_documento || '').trim();
      if (esFacturaCompra && (!serieFactura || !numeroFactura)) {
        throw new AppError('La factura asociada de la compra está incompleta: faltan serie y/o número del XML', 422);
      }
      if (serieFactura && numeroFactura) {
        docRelacionado = { tipo: '01', tipo_desc: 'Factura', numero: `${serieFactura}-${numeroFactura}`, issuerRuc: prov.ruc };
      }
    } else {
      const [[cliente]] = await conn.query('SELECT * FROM clientes WHERE id_cliente = ?', [g.id_cliente]);
      if (!cliente) throw new AppError('Cliente de la guía no existe', 404);
      destinatario = cliente;
      // Comercio exterior (exportación): el DESTINATARIO de la GRE es el operador de puerto/depósito
      // (guias_remision.destinatario_ruc/razon), NO el cliente extranjero de la OV (ese va en la factura).
      if (esComex) {
        if (!g.destinatario_ruc || !g.destinatario_razon) {
          throw new AppError('Comercio exterior: falta el destinatario (RUC y razón social)', 422);
        }
        if (!/^\d{11}$/.test(String(g.destinatario_ruc))) {
          throw new AppError('RUC del destinatario comex inválido (11 dígitos)', 422);
        }
        destinatario = { ruc: g.destinatario_ruc, razon_social: g.destinatario_razon, tipo_documento: 'RUC' };
      }
    }

    // ── Transporte ─────────────────────────────────────────────────────────────
    //   · Tercero (g.id_transportista): modalidad 01 (público); CarrierParty (RUC+razón+MTC) del
    //     maestro; conductor + vehículos (hasta 2, cada uno con TUCE + autorización especial) +
    //     fecha de entrega al transportista salen del bloque de transporte de la OV.
    //   · Propio (Vehículo Empresa): modalidad 02 (privado); conductor de empleados y placa de la flota.
    const esTercero = !!g.id_transportista;
    // registrar: interruptor "registrar vehículos y conductores del transportista" (solo tercero).
    // default 1 (Caso 2/3); 0 = Caso 1 (solo transportista, él emite su GRE 31). No tercero → siempre true.
    let carrier = null, conductores = [], vehiculos = [], registrar = true;
    // Indicadores opcionales (SpecialInstructions) tomados de la OV.
    const indicadores = {
      transbordo: !!ov?.transporte_ind_transbordo,
      m1l: !!ov?.transporte_ind_m1l,
      retornoVacio: !!ov?.transporte_ind_retorno_vacio,
    };

    if (esTercero) {
      const [[t]] = await conn.query(
        'SELECT ruc, razon_social, numero_mtc FROM transportistas WHERE id_transportista = ?', [g.id_transportista]);
      if (!t?.ruc || !t?.razon_social) throw new AppError('Falta el transportista (RUC y razón social)', 422);
      if (!/^\d{11}$/.test(String(t.ruc))) throw new AppError('RUC del transportista inválido (11 dígitos)', 422);
      carrier = { ruc: t.ruc, razon: t.razon_social, mtc: t.numero_mtc || null };
      registrar = ov.transporte_registrar !== 0; // default 1 (Caso 2/3)
      if (registrar) {
        // Caso 2/3: se declaran conductor(es) principal + secundario y vehículo(s).
        if (ov.transporte_dni) conductores.push({ dni: ov.transporte_dni, nombre: ov.transporte_conductor, licencia: ov.transporte_licencia });
        if (ov.transporte_dni2) conductores.push({ dni: ov.transporte_dni2, nombre: ov.transporte_conductor2, licencia: ov.transporte_licencia2 });
        // Vehículo principal + opcional secundario (carreta); cada uno TUCE (RegistrationNationalityID)
        // + autorización especial (ShipmentDocumentReference).
        vehiculos = [{
          placa: normalizarPlaca(ov.transporte_placa),
          tuce: ov.transporte_tuc || null,
          autorizacion: ov.transporte_autorizacion || null
        }];
        const placa2 = normalizarPlaca(ov.transporte_placa2);
        if (placa2) vehiculos.push({ placa: placa2, tuce: ov.transporte_tuc2 || null, autorizacion: ov.transporte_autorizacion2 || null });
      }
      // Caso 1 (registrar=false): conductores/vehiculos quedan vacíos → solo CarrierParty en el XML.
    } else if (g.transporte_modo === 'particular' || g.transporte_placa) {
      // Modalidad 02 (privado) con vehículo/conductor de TEXTO LIBRE: el cliente (o un particular
      // que NO es empresa de transporte) traslada con su propio carro/camioneta. Estructura idéntica
      // al vehículo propio (DriverPerson + TransportEquipment, SIN CarrierParty). Calcado del XML
      // aceptado docs/20550932297-09-EG07-256.xml.
      conductores = [{ dni: g.transporte_dni, nombre: g.transporte_conductor, licencia: g.transporte_licencia }];
      vehiculos = [{ placa: normalizarPlaca(g.transporte_placa), tuce: null, autorizacion: null }];
    } else {
      const [[cRow]] = g.id_conductor
        ? await conn.query('SELECT dni, nombre_completo, licencia_conducir FROM empleados WHERE id_empleado = ?', [g.id_conductor])
        : [[null]];
      const [[vRow]] = g.id_vehiculo
        ? await conn.query('SELECT placa FROM flota WHERE id_vehiculo = ?', [g.id_vehiculo])
        : [[null]];
      conductores = cRow ? [{ dni: cRow.dni, nombre: cRow.nombre_completo, licencia: cRow.licencia_conducir }] : [];
      vehiculos = vRow ? [{ placa: normalizarPlaca(vRow.placa), tuce: null, autorizacion: null }] : [];
      // Vehículo propio: conductor y vehículo secundarios opcionales (SUNAT admite hasta 2 de cada uno).
      if (g.id_conductor2) {
        const [[c2]] = await conn.query('SELECT dni, nombre_completo, licencia_conducir FROM empleados WHERE id_empleado = ?', [g.id_conductor2]);
        if (c2) conductores.push({ dni: c2.dni, nombre: c2.nombre_completo, licencia: c2.licencia_conducir });
      }
      if (g.id_vehiculo2) {
        const [[v2]] = await conn.query('SELECT placa FROM flota WHERE id_vehiculo = ?', [g.id_vehiculo2]);
        if (v2) vehiculos.push({ placa: normalizarPlaca(v2.placa), tuce: null, autorizacion: null });
      }
    }
    // ¿Se declaran vehículos y conductores? No tercero siempre; tercero solo si registrar=true.
    const declararVC = !esTercero || registrar;
    // Público (tercero) + registrar veh/cond (Caso 2/3): el remitente declara el vehículo y conductor
    // del transportista, lo que EXIGE el indicador SUNAT_Envio_IndicadorVehiculoConductoresTransp.
    // Sin él, SUNAT rechaza con 3354 "no debe ingresar información de vehículo principal" (nodo
    // cac:TransportEquipment/cbc:ID). Confirmado contra XML reales aceptados EG07-325 (2 veh) y
    // EG07-318 (1 veh), ambos domésticos. En privado (modalidad 02, vehículo propio) NO aplica: el
    // vehículo es del remitente y va sin indicador (calcado de EG07-294, placa sin TUCE).
    if (esTercero && registrar) indicadores.registrarTransp = true;
    // fecha_traslado como string 'YYYY-MM-DD' (sin corrimiento de zona).
    const [[ft]] = await conn.query("SELECT DATE_FORMAT(fecha_traslado, '%Y-%m-%d') AS f FROM guias_remision WHERE id_guia = ?", [idGuia]);
    const fechaTraslado = ft?.f || emision;

    const [detalle] = await conn.query(
      `SELECT d.id_detalle_orden, d.id_producto, d.cantidad, d.subpartida_nacional, d.dam_serie,
              d.codigo_documento, d.descripcion AS descripcion_documento,
              d.unidad_medida AS unidad_documento_sunat, d.codigo_bien,
              p.codigo, p.nombre, p.codigo_unidad_sunat
         FROM detalle_guia_remision d JOIN productos p ON p.id_producto = d.id_producto
        WHERE d.id_guia = ? ORDER BY d.id_detalle`, [idGuia]);
    if (!detalle.length) throw new AppError('La guía no tiene detalle', 422);
    // Ventas conserva su comportamiento integrado (catálogo de productos). En compras se emiten
    // los datos documentales copiados desde la factura/XML del proveedor.
    const detalleEmision = esCompra
      ? detalle.map((d) => ({
          ...d,
          codigo: d.codigo_documento || d.codigo,
          nombre: d.descripcion_documento || d.nombre,
          codigo_unidad_sunat: d.unidad_documento_sunat || d.codigo_unidad_sunat,
        }))
      : detalle;
        for (const d of detalleEmision) {
      if (!d.codigo_unidad_sunat) throw new AppError(`Producto ${d.codigo} sin codigo_unidad_sunat`, 422);
      if (!codigoBienValido(d.codigo_bien)) {
        throw new AppError(`Código de bien inválido en "${d.codigo || d.nombre}": debe tener exactamente 13 dígitos (GTIN-13)`, 422);
      }
    }
    // Modalidad de traslado (catálogo 18): 01 público para tercero, 02 privado para vehículo propio.
    const modalidad = esTercero ? '01' : '02';

    // Ubigeos de partida/llegada: 6 dígitos (catálogo INEI). Siempre obligatorios (independiente del modo).
    if (!ubigeoValido(g.ubigeo_partida)) throw new AppError(`Ubigeo de partida inválido: "${g.ubigeo_partida}" (6 dígitos)`, 422);
    if (!ubigeoValido(g.ubigeo_llegada)) throw new AppError(`Ubigeo de llegada inválido: "${g.ubigeo_llegada}" (6 dígitos)`, 422);

    if (declararVC) {
      // Caso 2/3 (o privado): conductor principal + placa obligatorios; secundario opcional.
      const c0 = conductores[0];
      if (!c0?.dni || !c0?.nombre || !c0?.licencia) {
        throw new AppError('Faltan datos del conductor (DNI, nombre y licencia de conducir)', 422);
      }
      // Validación de FORMATO de cada conductor (corre antes de reservar el correlativo → no lo quema).
      for (const c of conductores) {
        if (!dniValido(c.dni)) throw new AppError(`DNI del conductor inválido: "${c.dni}" (deben ser 8 dígitos)`, 422);
        if (!c.nombre || !c.licencia) throw new AppError('Conductor secundario incompleto (faltan nombre y/o licencia)', 422);
      }
      // Placa del vehículo principal normalizada. En PROD es obligatoria; en BETA se usa un
      // placeholder solo para el mock (no válido en PROD).
      if (!vehiculos[0]?.placa) {
        if (sunatConfig.mode === 'PROD') throw new AppError('Falta la placa del vehículo', 422);
        vehiculos = [{ placa: 'XXX000', tuce: null, autorizacion: null }];
      } else if (!placaValida(vehiculos[0].placa)) {
        throw new AppError(`Placa inválida: "${vehiculos[0].placa}" (6 a 8 caracteres alfanuméricos; el guion y los espacios se ignoran)`, 422);
      }
      // Placa del vehículo secundario (carreta) si viene: mismo formato.
      if (vehiculos[1]?.placa && !placaValida(vehiculos[1].placa)) {
        throw new AppError(`Placa del vehículo secundario inválida: "${vehiculos[1].placa}" (6 a 8 caracteres alfanuméricos)`, 422);
      }
    } else {
      // Caso 1 (tercero sin registrar veh/cond): no se declaran; basta el transportista (ya validado).
      conductores = []; vehiculos = [];
    }

    // Fecha de entrega de bienes al transportista (LoadingTransportEvent, solo tercero). Los 3 XML del
    // portal SUNAT NO emiten este nodo, así que NO se rellena por defecto: solo si el usuario capturó
    // explícitamente una fecha de entrega en la OV (sin fallback a fechaTraslado, que lo forzaba siempre).
    const fechaEntregaTransportista = (esTercero && ov.transporte_fecha_entrega) ? ov.transporte_fecha_entrega : null;

    // Observación → cbc:Note. Si el panel envía `observaciones` (editable, prellenado con la OC),
    // se usa TAL CUAL y se persiste en la guía (el PDF luego muestra lo persistido = lo enviado).
    // Si no viene (API antigua), se compone del texto libre de la guía + OC de la OV.
    const observacion = observacionOverride !== undefined
  ? String(observacionOverride).replace(/\r\n/g, '\n').trim().slice(0, 250)
  : componerObservacionGuia(g.observaciones, ov?.orden_compra_cliente);
    if (observacionOverride !== undefined) {
      await conn.query('UPDATE guias_remision SET observaciones = ? WHERE id_guia = ?', [observacion, idGuia]);
    }

    // ── Comercio exterior: documentos relacionados (DAM) + contenedores + subpartidas ──────────
    // Alcance actual: solo "traslado total de la DAM/DS = Sí" (importa bienes de la DAM). El detalle
    // manual por ítem (traslado parcial) queda fuera de alcance. Ver memoria gre-comex-spec.
    let comex = null;
    if (esComex) {
      const [docs] = await conn.query(
        'SELECT tipo_cod, tipo_desc, serie, numero FROM guias_remision_doc_relacionado WHERE id_guia = ?', [idGuia]);
      const [contenedores] = await conn.query(
        'SELECT numero_contenedor, numero_precinto FROM guias_remision_contenedor WHERE id_guia = ?', [idGuia]);
      if (!docs.length) throw new AppError('Comercio exterior: falta al menos un documento relacionado (DAM)', 422);
      for (const it of detalle) {
        if (!it.subpartida_nacional) throw new AppError(`Comercio exterior: falta la subpartida nacional del ítem ${it.codigo}`, 422);
      }
      const dam = docs.find((x) => String(x.tipo_cod) === '50') || null; // cat.61: 50 = DAM
      // Código de establecimiento anexo del destinatario (DeliveryAddress/AddressTypeCode).
      // Sale del catálogo de destinatarios (p.ej. VILLAS OQUENDO puerto = "2"); default "0" (matriz).
      const [[destCat]] = await conn.query(
        'SELECT codigo_establecimiento FROM comex_destinatarios WHERE ruc = ?', [g.destinatario_ruc]);
      comex = {
        trasladoTotalDam: Number(g.traslado_total_dam) !== 0,
        docsRelacionados: docs,
        contenedores,
        damNumero: dam?.numero || null,
        deliveryEstablishmentCode: destCat?.codigo_establecimiento || '0',
      };
      // El indicador SUNAT_Envio_IndicadorVehiculoConductoresTransp ya se activa arriba para todo
      // público + registrar (doméstico y comex; molde EG07-273). No se duplica aquí.
    }

    const numero = await obtenerCorrelativo(conn, tipo, serie);
    const datos = {
      tipo, serie, numero, empresa, cliente: destinatario, guia: g, detalle: detalleEmision,
      fecha: { emision, hora }, fechaTraslado, modalidad,
      transportista: carrier, registrarTransportista: registrar, fechaEntregaTransportista,
      conductores, vehiculos, indicadores,
      observacion, comex, proveedor, docRelacionado
    };
    const { xml } = construirDespatchAdviceXML(datos);
    const { xmlFirmado, digestValue } = firmarXml(xml);
    const nombre = `${sunatConfig.ruc}-${tipo}-${serie}-${numero}`;

    // Snapshot inmutable del transporte tercero. Sin esto el PDF regenerado leía en vivo de
    // ordenes_venta y mostraba datos distintos si la OV se editaba tras una baja + nueva emisión.
    // Los campos transporte_placa/dni/conductor/licencia son compartidos con modo particular (cond 1).
    if (esTercero) {
      await conn.query(
        `UPDATE guias_remision SET
           transporte_placa = ?, transporte_tuc = ?, transporte_autorizacion = ?,
           transporte_placa2 = ?, transporte_tuc2 = ?, transporte_autorizacion2 = ?,
           transporte_dni = ?, transporte_conductor = ?, transporte_licencia = ?,
           transporte_dni2 = ?, transporte_conductor2 = ?, transporte_licencia2 = ?,
           transporte_registrar = ?, transporte_ind_transbordo = ?, transporte_ind_m1l = ?,
           transporte_ind_retorno_vacio = ?, transporte_fecha_entrega = ?
         WHERE id_guia = ?`,
        [
          vehiculos[0]?.placa || null,
          ov.transporte_tuc || null,
          ov.transporte_autorizacion || null,
          vehiculos[1]?.placa || null,
          ov.transporte_tuc2 || null,
          ov.transporte_autorizacion2 || null,
          conductores[0]?.dni || null,
          conductores[0]?.nombre || null,
          conductores[0]?.licencia || null,
          conductores[1]?.dni || null,
          conductores[1]?.nombre || null,
          conductores[1]?.licencia || null,
          registrar ? 1 : 0,
          indicadores.transbordo ? 1 : 0,
          indicadores.m1l ? 1 : 0,
          indicadores.retornoVacio ? 1 : 0,
          fechaEntregaTransportista || null,
          idGuia,
        ]
      );
    }

    await conn.query(
      `UPDATE guias_remision SET serie_sunat = ?, numero_sunat = ?, sunat_estado = 'ENVIADO',
         sunat_digest_value = ?, sunat_fecha_envio = ? WHERE id_guia = ?`,
      [serie, numero, digestValue, emisionDateTime, idGuia]);

    // Archiva ESTE intento (historial de emisiones): al reemitir tras un rechazo, la cabecera se
    // sobrescribe con el nuevo correlativo; aquí queda el snapshot inmutable de cada intento para
    // reimprimir su PDF con marca RECHAZADO + su motivo. Best-effort: no aborta la emisión si la
    // tabla aún no existe (instalaciones sin el DDL nuevo).
    let emisionId = null;
    try {
      const snapshot = construirSnapshotPdfGre({
        g, serie, numero, empresa, destinatario, proveedor, docRelacionado,
        carrier, registrar, conductores, vehiculos, indicadores, modalidad,
        fechaEntregaTransportista, comex, detalleEmision: detalleEmision, fechaTraslado,
        emision, hora, observacion, esCompra, esComex,
      });
      const [ins] = await conn.query(
        `INSERT INTO guias_remision_emisiones
           (id_guia, serie_sunat, numero_sunat, sunat_estado, sunat_digest_value, snapshot_json)
         VALUES (?, ?, ?, 'ENVIADO', ?, ?)`,
        [idGuia, serie, numero, digestValue, JSON.stringify(snapshot)]);
      emisionId = ins.insertId;
    } catch (e) { console.warn('[SUNAT] archivar intento GRE falló:', e.message); }

    return { numero, nombre, xmlFirmado, emisionId };
  });

  const { numero, nombre, xmlFirmado, emisionId } = prep;
  await copiaLocal(`${nombre}.xml`, xmlFirmado);
  const zipBuf = zipXml(`${nombre}.xml`, xmlFirmado);

  // Token real (aun en BETA, para cubrir el checkpoint) — no fatal si el SOL no tiene permiso GRE.
  let tokenOk = false, tokenError = null;
  try { await obtenerTokenGre(); tokenOk = true; }
  catch (e) { tokenError = e.message; }

  const t0 = Date.now();
  let ticket;
  try {
    ticket = await enviarGuia(nombre, zipBuf);
  } catch (e) {
    await pool.query(
      `UPDATE guias_remision SET sunat_estado = 'ERROR', sunat_response_desc = ?, sunat_intentos = sunat_intentos + 1 WHERE id_guia = ?`,
      [String(e.message).slice(0, 4000), idGuia]);
    if (emisionId) {
      try {
        await pool.query(
          `UPDATE guias_remision_emisiones SET sunat_estado = 'ERROR', sunat_response_desc = ? WHERE id_emision = ?`,
          [String(e.message).slice(0, 4000), emisionId]);
      } catch { /* best-effort: historial no debe romper el flujo */ }
    }
    await registrarSunatLog({ origen: 'GRE_REMITENTE', referenciaId: idGuia, evento: 'enviarGuia',
      exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
    return { httpStatus: 502, body: { ok: false, estado: 'ERROR', idGuia, error: e.message, tokenOk, tokenError } };
  }

  let xmlUrl = null;
  try { xmlUrl = await subirRaw(Buffer.from(xmlFirmado, 'utf8'), `sunat/xml/${nombre}.xml`); }
  catch (e) { console.warn('[SUNAT] subir XML GRE falló:', e.message); }
  await pool.query(
    `UPDATE guias_remision SET sunat_ticket = ?, xml_url = COALESCE(?, xml_url) WHERE id_guia = ?`,
    [ticket, xmlUrl ? JSON.stringify({ url: xmlUrl }) : null, idGuia]);
  if (emisionId) {
    try {
      await pool.query(
        `UPDATE guias_remision_emisiones SET sunat_ticket = ?, xml_url = COALESCE(?, xml_url) WHERE id_emision = ?`,
        [ticket, xmlUrl ? JSON.stringify({ url: xmlUrl }) : null, emisionId]);
    } catch { /* best-effort */ }
  }
  console.log('[SUNAT] emitirGuia ->', JSON.stringify({ idGuia, comprobante: `${serie}-${numero}`, ticket }));

  // Poll consultarGuia (en BETA el mock resuelve al instante; en PROD 15s × 3).
  for (let i = 0; i < 3; i++) {
    if (sunatConfig.mode === 'PROD') await sleep(15000);
    let st;
    try { st = await consultarGuia(ticket); }
    catch (e) {
      await registrarSunatLog({ origen: 'GRE_REMITENTE', referenciaId: idGuia, evento: 'consultarGuia',
        exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
      continue;
    }
    if (st.codRespuesta === '98') continue;
    const r = await cerrarTicketGre(idGuia, nombre, ticket, st, t0, emisionId);
    return { httpStatus: 200, body: {
      ok: r.aceptado, estado: r.estadoFinal, idGuia, serie, numero, comprobante: `${serie}-${numero}`,
      ticket, codRespuesta: r.codRespuesta, descripcion: r.descripcion, xmlUrl, cdrUrl: r.cdrUrl,
      mock: r.mock, tokenOk, tokenError
    } };
  }
  return { httpStatus: 202, body: {
    ok: null, estado: 'ENVIADO', idGuia, serie, numero, comprobante: `${serie}-${numero}`, ticket,
    mensaje: 'GRE en proceso (codRespuesta 98). Reconsultar con GET /guias/:id/estado.', tokenOk, tokenError
  } };
}
