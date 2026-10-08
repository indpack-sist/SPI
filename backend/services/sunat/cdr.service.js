import { XMLParser } from 'fast-xml-parser';
import { extraerCdr } from './zip.service.js';

export function parsearCdr(cdrZipBuffer) {
  const xml = extraerCdr(cdrZipBuffer);
  const p = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  const doc = p.parse(xml);
  const resp = doc.ApplicationResponse?.DocumentResponse?.Response || {};
  return {
    responseCode: String(resp.ResponseCode ?? ''),
    description: resp.Description ?? '',
    notas: [].concat(doc.ApplicationResponse?.Note || []).filter(Boolean).map(String),
    referenceId: doc.ApplicationResponse?.DocumentResponse?.DocumentReference?.ID ?? '',
    xmlCdr: xml
  };
}
