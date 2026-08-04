/**
 * Anulación de facturas vía Comunicación de Baja (RA).
 * Flujo asíncrono: construir → firmar → sendSummary (ticket) → getStatus (poll) → CDR.
 */
import { construirBajaXml } from './ubl/baja.builder.js';
import { firmarXml } from './firma.service.js';
import { enviarResumen, consultarTicket } from './cpe.client.js';
import { siguienteCorrelativo } from './correlativo.service.js';
import { getEmisor } from './emisor.service.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Da de baja una factura ante SUNAT.
 * @param {object} p
 * @param {string} p.serie          serie de la factura a anular (ej. F002)
 * @param {number} p.numero         correlativo de la factura
 * @param {Date}   p.fechaEmision   fecha de emisión de la factura
 * @param {string} p.motivo         razón de la baja
 * @param {object} opts { maxIntentos?, delayMs? }
 * @returns {Promise<{idBaja, ticket, estado, responseCode, description, observaciones, cdrXml, xmlFirmado, nombreArchivo}>}
 */
export async function anularFactura(p, opts = {}) {
  const emisor = await getEmisor();
  const fechaGeneracion = new Date();

  // correlativo diario de la comunicación de baja (RA)
  const hoy = fechaGeneracion.toISOString().slice(0, 10).replace(/-/g, '');
  const correlativo = opts.correlativoOverride ?? (await siguienteCorrelativo('RA', hoy));

  const { xml, nombreArchivo, idBaja } = construirBajaXml({
    emisor,
    fechaGeneracion,
    fechaReferencia: p.fechaEmision,
    correlativo,
    items: [{ tipoDoc: '01', serie: p.serie, numero: p.numero, motivo: p.motivo }],
  });

  const { xmlFirmado } = firmarXml(xml);

  const ticket = await enviarResumen(nombreArchivo, xmlFirmado);

  // Poll del ticket
  const maxIntentos = opts.maxIntentos ?? 12;
  const delayMs = opts.delayMs ?? 3000;
  let resultado = null;
  for (let i = 0; i < maxIntentos; i++) {
    resultado = await consultarTicket(ticket);
    if (resultado.estado !== 'EN_PROCESO') break;
    await sleep(delayMs);
  }

  return { idBaja, ticket, nombreArchivo, xmlFirmado, ...resultado };
}
