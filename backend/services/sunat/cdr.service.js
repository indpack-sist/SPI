// services/sunat/cdr.service.js  —  Parseo del CDR (ApplicationResponse) devuelto por SUNAT.
import { XMLParser } from 'fast-xml-parser';
import { extraerCdr } from './zip.service.js';

/**
 * @param {Buffer} cdrZipBuffer  ZIP del CDR (R-....zip)
 * @returns {{responseCode:string, description:string, notas:string[], referenceId:string, xmlCdr:string}}
 */
export function parsearCdr(cdrZipBuffer) {
  const xml = extraerCdr(cdrZipBuffer);
  const p = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  const doc = p.parse(xml);
  const resp = doc.ApplicationResponse?.DocumentResponse?.Response || {};
  return {
    responseCode: String(resp.ResponseCode ?? ''),   // '0' = aceptado
    description: resp.Description ?? '',
    notas: [].concat(doc.ApplicationResponse?.Note || []).filter(Boolean).map(String),
    referenceId: doc.ApplicationResponse?.DocumentResponse?.DocumentReference?.ID ?? '',
    xmlCdr: xml
  };
}
