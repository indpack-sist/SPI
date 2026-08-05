/**
 * Parser del CDR (Constancia de Recepción) que devuelve SUNAT.
 * El CDR es un ApplicationResponse UBL firmado por SUNAT.
 *
 * ResponseCode:
 *   "0"        -> ACEPTADO
 *   2000-3999  -> RECHAZADO (error; el comprobante no existe para SUNAT)
 *   4000+      -> ACEPTADO con OBSERVACIONES (existe pero con advertencias)
 */
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });

export function parsearCdr(cdrXml) {
  const obj = parser.parse(cdrXml);
  const appResp = obj.ApplicationResponse || {};
  const docResponse = appResp.DocumentResponse?.Response || {};

  const responseCode = String(docResponse.ResponseCode ?? '');
  const description = docResponse.Description ?? '';

  // Notas/observaciones (advertencias)
  let notes = appResp.DocumentResponse?.DocumentReference?.DocumentDescription;
  const observaciones = []
    .concat(docResponse.Note || [])
    .concat(notes || [])
    .filter(Boolean);

  let estado;
  const code = parseInt(responseCode, 10);
  if (responseCode === '0') estado = 'ACEPTADO';
  else if (code >= 4000) estado = 'OBSERVADO';
  else estado = 'RECHAZADO';

  return { estado, responseCode, description, observaciones };
}
