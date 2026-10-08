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
import { sleep, copiaLocal, normalizarPlaca, componerObservacionGuia, placaValida, dniValido, ubigeoValido, codigoBienValido, armarDireccionEmpresa } from './util.service.js';
import { validarGuiaPrevia } from './validacion-previa.service.js';
import AppError from '../../utils/AppError.js';

async function finalizarReemplazoSiAplica(idGuiaCerrada, aceptado) {
  const [[orig]] = await pool.query(
    "SELECT id_guia, numero_guia FROM guias_remision WHERE id_guia_reemplazo = ? AND sunat_estado = 'ACEPTADO'",
    [idGuiaCerrada]);
  if (!orig) return;

  if (aceptado) {
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
    await pool.query(
      `UPDATE guias_remision
         SET id_guia_reemplazo = NULL, anulado_por = NULL, motivo_anulacion = NULL, fecha_anulacion = NULL
       WHERE id_guia = ?`, [orig.id_guia]);
    await registrarSunatLog({ origen: 'GRE_REMITENTE', referenciaId: orig.id_guia, evento: 'reemplazoAbortado',
      exito: false, httpStatus: 200, detalle: `Reemplazo abortado: guía nueva id ${idGuiaCerrada} rechazada; original ${orig.numero_guia} sigue vigente` });
  }
}

function construirSnapshotPdfGre({
  g, serie, numero, empresa, destinatario, proveedor, docRelacionado, docsRelacionadosVenta,
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
      motivo_traslado_cod: g.motivo_traslado_cod, motivo_descripcion: g.motivo_descripcion,
      peso_bruto_kg: g.peso_bruto_kg,
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
    docsRelacionadosVenta: Array.isArray(docsRelacionadosVenta)
      ? docsRelacionadosVenta.map((doc) => ({ tipo_desc: doc.tipo_desc, numero: doc.numero }))
      : [],
  };
}

async function resolverEmisionAbierta(idGuia) {
  const [[row]] = await pool.query(
    `SELECT id_emision FROM guias_remision_emisiones
      WHERE id_guia = ? AND (sunat_estado IS NULL OR sunat_estado NOT IN ('ACEPTADO','RECHAZADO'))
      ORDER BY id_emision DESC LIMIT 1`, [idGuia]);
  return row?.id_emision || null;
}

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
  if (estadoFinal === 'ACEPTADO' || estadoFinal === 'RECHAZADO') {
    await finalizarReemplazoSiAplica(idGuia, aceptado);
  }
  return { aceptado, estadoFinal, codRespuesta: st.codRespuesta, descripcion, cdrUrl, mock: st.mock || false };
}

export async function emitirGuiaGre(idGuia, idEmpleado = null, observacionOverride = undefined) {
  if (!idGuia) throw new AppError('id de guía inválido', 400);
  const tipo = '09', serie = 'TE01';
  const { emision, hora, emisionDateTime } = fechaLima();

  const prep = await withTransaction(async (conn) => {
    const [[g]] = await conn.query('SELECT * FROM guias_remision WHERE id_guia = ? FOR UPDATE', [idGuia]);
    if (!g) throw new AppError('Guía no existe', 404);
    if (g.sunat_estado === 'ACEPTADO') throw new AppError('La guía ya fue aceptada por SUNAT', 409);
    const esCompra = g.tipo_origen === 'Compra';

    let ov = null;
    if (!esCompra) {
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

    if (esCompra) {
      g.direccion_llegada = armarDireccionEmpresa(empresa) || String(empresa.direccion || '').trim();
      g.punto_llegada = g.direccion_llegada;
      g.ubigeo_llegada = String(empresa.ubigeo || '').trim();
      await conn.query(
        `UPDATE guias_remision
            SET direccion_llegada = ?, punto_llegada = ?, ubigeo_llegada = ?
          WHERE id_guia = ?`,
        [g.direccion_llegada, g.punto_llegada, g.ubigeo_llegada, idGuia]
      );
    }

    if (!esCompra) {
      g.direccion_partida = armarDireccionEmpresa(empresa) || String(empresa.direccion || '').trim();
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

    const esComex = Number(g.es_comercio_exterior) === 1;
    let destinatario, proveedor = null, docRelacionado = undefined, docsRelacionadosVenta = [];
    if (esCompra) {
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
      if (esComex) {
        if (!g.destinatario_ruc || !g.destinatario_razon) {
          throw new AppError('Comercio exterior: falta el destinatario (RUC y razón social)', 422);
        }
        if (!/^\d{11}$/.test(String(g.destinatario_ruc))) {
          throw new AppError('RUC del destinatario comex inválido (11 dígitos)', 422);
        }
        destinatario = { ruc: g.destinatario_ruc, razon_social: g.destinatario_razon, tipo_documento: 'RUC' };
      }
      if (!esComex) {
        const [refs] = await conn.query(
          `SELECT tipo_cod, tipo_desc, serie, numero
             FROM guias_remision_factura_referencia WHERE id_guia = ? ORDER BY id`, [idGuia]);
        docsRelacionadosVenta = refs.map((r) => ({
          tipo: r.tipo_cod,
          tipo_desc: r.tipo_desc,
          numero: r.serie ? `${r.serie}-${r.numero}` : r.numero,
          issuerRuc: empresa.ruc,
        }));
      }
    }

    const esTercero = !!g.id_transportista;
    let carrier = null, conductores = [], vehiculos = [], registrar = true;
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
      registrar = ov.transporte_registrar !== 0;
      if (registrar) {
        if (ov.transporte_dni) conductores.push({ dni: ov.transporte_dni, nombre: ov.transporte_conductor, licencia: ov.transporte_licencia });
        if (ov.transporte_dni2) conductores.push({ dni: ov.transporte_dni2, nombre: ov.transporte_conductor2, licencia: ov.transporte_licencia2 });
        vehiculos = [{
          placa: normalizarPlaca(ov.transporte_placa),
          tuce: ov.transporte_tuc || null,
          autorizacion: ov.transporte_autorizacion || null
        }];
        const placa2 = normalizarPlaca(ov.transporte_placa2);
        if (placa2) vehiculos.push({ placa: placa2, tuce: ov.transporte_tuc2 || null, autorizacion: ov.transporte_autorizacion2 || null });
      }
    } else if (g.transporte_modo === 'particular' || g.transporte_placa) {
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
      if (g.id_conductor2) {
        const [[c2]] = await conn.query('SELECT dni, nombre_completo, licencia_conducir FROM empleados WHERE id_empleado = ?', [g.id_conductor2]);
        if (c2) conductores.push({ dni: c2.dni, nombre: c2.nombre_completo, licencia: c2.licencia_conducir });
      }
      if (g.id_vehiculo2) {
        const [[v2]] = await conn.query('SELECT placa FROM flota WHERE id_vehiculo = ?', [g.id_vehiculo2]);
        if (v2) vehiculos.push({ placa: normalizarPlaca(v2.placa), tuce: null, autorizacion: null });
      }
    }
    const declararVC = !esTercero || registrar;
    if (esTercero && registrar) indicadores.registrarTransp = true;
    const [[ft]] = await conn.query("SELECT DATE_FORMAT(fecha_traslado, '%Y-%m-%d') AS f FROM guias_remision WHERE id_guia = ?", [idGuia]);
    const fechaTraslado = ft?.f || emision;

    const [detalle] = await conn.query(
      `SELECT d.id_detalle_orden, d.id_producto, d.cantidad, d.subpartida_nacional, d.dam_serie,
              d.codigo_documento, d.descripcion AS descripcion_documento,
              d.unidad_medida AS unidad_documento_sunat, d.codigo_bien,
              p.codigo, p.nombre, p.codigo_unidad_sunat
         FROM detalle_guia_remision d LEFT JOIN productos p ON p.id_producto = d.id_producto
        WHERE d.id_guia = ? ORDER BY d.id_detalle`, [idGuia]);
    if (!detalle.length) throw new AppError('La guía no tiene detalle', 422);
    const detalleEmision = esCompra
      ? detalle.map((d) => ({
          ...d,
          codigo: d.codigo_documento || d.codigo,
          nombre: d.descripcion_documento || d.nombre,
          codigo_unidad_sunat: d.unidad_documento_sunat || d.codigo_unidad_sunat,
        }))
      : detalle.map((d) => {
          const esLibre = d.id_producto == null;
          return {
            ...d,
            codigo: d.codigo || null,
            nombre: d.nombre || d.descripcion_documento,
            codigo_unidad_sunat: esLibre ? (d.unidad_documento_sunat || 'NIU') : d.codigo_unidad_sunat,
          };
        });
        for (const d of detalleEmision) {
      if (!d.codigo_unidad_sunat) throw new AppError(`Producto ${d.codigo} sin codigo_unidad_sunat`, 422);
      if (!codigoBienValido(d.codigo_bien)) {
        throw new AppError(`Código de bien inválido en "${d.codigo || d.nombre}": debe tener exactamente 13 dígitos (GTIN-13)`, 422);
      }
    }
    const modalidad = esTercero ? '01' : '02';

    if (!ubigeoValido(g.ubigeo_partida)) throw new AppError(`Ubigeo de partida inválido: "${g.ubigeo_partida}" (6 dígitos)`, 422);
    if (!ubigeoValido(g.ubigeo_llegada)) throw new AppError(`Ubigeo de llegada inválido: "${g.ubigeo_llegada}" (6 dígitos)`, 422);

    if (declararVC) {
      const c0 = conductores[0];
      if (!c0?.dni || !c0?.nombre || !c0?.licencia) {
        throw new AppError('Faltan datos del conductor (DNI, nombre y licencia de conducir)', 422);
      }
      for (const c of conductores) {
        if (!dniValido(c.dni)) throw new AppError(`DNI del conductor inválido: "${c.dni}" (deben ser 8 dígitos)`, 422);
        if (!c.nombre || !c.licencia) throw new AppError('Conductor secundario incompleto (faltan nombre y/o licencia)', 422);
      }
      if (!vehiculos[0]?.placa) {
        if (sunatConfig.mode === 'PROD') throw new AppError('Falta la placa del vehículo', 422);
        vehiculos = [{ placa: 'XXX000', tuce: null, autorizacion: null }];
      } else if (!placaValida(vehiculos[0].placa)) {
        throw new AppError(`Placa inválida: "${vehiculos[0].placa}" (6 a 8 caracteres alfanuméricos; el guion y los espacios se ignoran)`, 422);
      }
      if (vehiculos[1]?.placa && !placaValida(vehiculos[1].placa)) {
        throw new AppError(`Placa del vehículo secundario inválida: "${vehiculos[1].placa}" (6 a 8 caracteres alfanuméricos)`, 422);
      }
    } else {
      conductores = []; vehiculos = [];
    }

    const fechaEntregaTransportista = (esTercero && ov.transporte_fecha_entrega) ? ov.transporte_fecha_entrega : null;

    const observacion = observacionOverride !== undefined
  ? String(observacionOverride).replace(/\r\n/g, '\n').trim().slice(0, 250)
  : componerObservacionGuia(g.observaciones, ov?.orden_compra_cliente);
    if (observacionOverride !== undefined) {
      await conn.query('UPDATE guias_remision SET observaciones = ? WHERE id_guia = ?', [observacion, idGuia]);
    }

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
      const dam = docs.find((x) => String(x.tipo_cod) === '50') || null;
      const [[destCat]] = await conn.query(
        'SELECT codigo_establecimiento FROM comex_destinatarios WHERE ruc = ?', [g.destinatario_ruc]);
      comex = {
        trasladoTotalDam: Number(g.traslado_total_dam) !== 0,
        docsRelacionados: docs,
        contenedores,
        damNumero: dam?.numero || null,
        deliveryEstablishmentCode: destCat?.codigo_establecimiento || '0',
      };
    }

    const numero = await obtenerCorrelativo(conn, tipo, serie);
    const datos = {
      tipo, serie, numero, empresa, cliente: destinatario, guia: g, detalle: detalleEmision,
      fecha: { emision, hora }, fechaTraslado, modalidad,
      transportista: carrier, registrarTransportista: registrar, fechaEntregaTransportista,
      conductores, vehiculos, indicadores,
      observacion, comex, proveedor, docRelacionado, docsRelacionadosVenta
    };
    const { xml } = construirDespatchAdviceXML(datos);
    const { xmlFirmado, digestValue } = firmarXml(xml);
    const nombre = `${sunatConfig.ruc}-${tipo}-${serie}-${numero}`;

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

    let emisionId = null;
    try {
      const snapshot = construirSnapshotPdfGre({
        g, serie, numero, empresa, destinatario, proveedor, docRelacionado, docsRelacionadosVenta,
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
      } catch {}
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
    } catch {}
  }
  console.log('[SUNAT] emitirGuia ->', JSON.stringify({ idGuia, comprobante: `${serie}-${numero}`, ticket }));

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

export async function validarGuiaRemisionPrevia(idGuia) {
  if (!idGuia) throw new AppError('id de guía inválido', 400);
  const [[g]] = await pool.query('SELECT * FROM guias_remision WHERE id_guia = ?', [idGuia]);
  if (!g) throw new AppError('Guía no existe', 404);
  const esCompra = g.tipo_origen === 'Compra';
  const [[empresa]] = await pool.query('SELECT * FROM empresa_config WHERE id = 1');

  let ov = null;
  if (!esCompra) {
    const [[ovRow]] = await pool.query(
      `SELECT transporte_registrar, transporte_placa, transporte_conductor, transporte_dni, transporte_licencia,
              transporte_dni2, transporte_conductor2, transporte_licencia2, transporte_placa2
         FROM ordenes_venta WHERE id_orden_venta = ?`, [g.id_orden_venta]);
    ov = ovRow || null;
  }

  const gView = { ...g };
  if (esCompra) {
    gView.direccion_llegada = armarDireccionEmpresa(empresa) || String(empresa?.direccion || '').trim();
    gView.ubigeo_llegada = String(empresa?.ubigeo || '').trim();
  } else {
    gView.direccion_partida = armarDireccionEmpresa(empresa) || String(empresa?.direccion || '').trim();
    gView.ubigeo_partida = String(empresa?.ubigeo || '').trim();
  }

  const esComex = Number(g.es_comercio_exterior) === 1;

  let destinatario = null;
  if (esCompra) {
    destinatario = { ruc: empresa?.ruc, razon_social: empresa?.razon_social, tipo_documento: 'RUC' };
  } else if (esComex) {
    destinatario = { ruc: g.destinatario_ruc, razon_social: g.destinatario_razon, tipo_documento: 'RUC' };
  } else {
    const [[cliente]] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [g.id_cliente]);
    destinatario = cliente || null;
  }

  const esTercero = !!g.id_transportista;
  let carrier = null, conductores = [], vehiculos = [], registrar = true;
  if (esTercero) {
    const [[t]] = await pool.query(
      'SELECT ruc, razon_social, numero_mtc FROM transportistas WHERE id_transportista = ?', [g.id_transportista]);
    carrier = t ? { ruc: t.ruc, razon: t.razon_social, mtc: t.numero_mtc || null } : { ruc: null, razon: null };
    registrar = ov?.transporte_registrar !== 0;
    if (registrar) {
      if (ov?.transporte_dni) conductores.push({ dni: ov.transporte_dni, nombre: ov.transporte_conductor, licencia: ov.transporte_licencia });
      if (ov?.transporte_dni2) conductores.push({ dni: ov.transporte_dni2, nombre: ov.transporte_conductor2, licencia: ov.transporte_licencia2 });
      vehiculos = [{ placa: normalizarPlaca(ov?.transporte_placa) }];
      const placa2 = normalizarPlaca(ov?.transporte_placa2);
      if (placa2) vehiculos.push({ placa: placa2 });
    }
  } else if (g.transporte_modo === 'particular' || g.transporte_placa) {
    conductores = [{ dni: g.transporte_dni, nombre: g.transporte_conductor, licencia: g.transporte_licencia }];
    vehiculos = [{ placa: normalizarPlaca(g.transporte_placa) }];
  } else {
    const [[cRow]] = g.id_conductor
      ? await pool.query('SELECT dni, nombre_completo, licencia_conducir FROM empleados WHERE id_empleado = ?', [g.id_conductor])
      : [[null]];
    const [[vRow]] = g.id_vehiculo
      ? await pool.query('SELECT placa FROM flota WHERE id_vehiculo = ?', [g.id_vehiculo])
      : [[null]];
    conductores = cRow ? [{ dni: cRow.dni, nombre: cRow.nombre_completo, licencia: cRow.licencia_conducir }] : [];
    vehiculos = vRow ? [{ placa: normalizarPlaca(vRow.placa) }] : [];
    if (g.id_conductor2) {
      const [[c2]] = await pool.query('SELECT dni, nombre_completo, licencia_conducir FROM empleados WHERE id_empleado = ?', [g.id_conductor2]);
      if (c2) conductores.push({ dni: c2.dni, nombre: c2.nombre_completo, licencia: c2.licencia_conducir });
    }
    if (g.id_vehiculo2) {
      const [[v2]] = await pool.query('SELECT placa FROM flota WHERE id_vehiculo = ?', [g.id_vehiculo2]);
      if (v2) vehiculos.push({ placa: normalizarPlaca(v2.placa) });
    }
  }
  const declararVC = !esTercero || registrar;

  const [detalle] = await pool.query(
    `SELECT d.id_producto, d.subpartida_nacional, d.codigo_documento, d.descripcion AS descripcion_documento,
            d.unidad_medida AS unidad_documento_sunat, d.codigo_bien,
            p.codigo, p.nombre, p.codigo_unidad_sunat
       FROM detalle_guia_remision d LEFT JOIN productos p ON p.id_producto = d.id_producto
      WHERE d.id_guia = ? ORDER BY d.id_detalle`, [idGuia]);
  const detalleEmision = esCompra
    ? detalle.map((d) => ({ ...d,
        codigo: d.codigo_documento || d.codigo,
        nombre: d.descripcion_documento || d.nombre,
        codigo_unidad_sunat: d.unidad_documento_sunat || d.codigo_unidad_sunat }))
    : detalle.map((d) => ({ ...d,
        codigo: d.codigo || null,
        nombre: d.nombre || d.descripcion_documento,
        codigo_unidad_sunat: d.id_producto == null ? (d.unidad_documento_sunat || 'NIU') : d.codigo_unidad_sunat }));

  let docsComex = [];
  if (esComex) {
    const [docs] = await pool.query(
      'SELECT tipo_cod, tipo_desc, serie, numero FROM guias_remision_doc_relacionado WHERE id_guia = ?', [idGuia]);
    docsComex = docs;
  }

  return validarGuiaPrevia({
    empresa, guia: gView, destinatario, detalle: detalleEmision,
    esComex, declararVC, conductores, vehiculos, carrier, docsComex, mode: sunatConfig.mode
  });
}
