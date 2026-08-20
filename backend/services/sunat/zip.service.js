// services/sunat/zip.service.js  —  Empaquetar XML -> ZIP y extraer el CDR del ZIP de respuesta.
import AdmZip from 'adm-zip';

/** Comprime el XML firmado en un ZIP con el XML en la raíz (sin carpetas). */
export function zipXml(nombreXml, xmlFirmado) {
  const zip = new AdmZip();
  zip.addFile(nombreXml, Buffer.from(xmlFirmado, 'utf8'));
  return zip.toBuffer();
}

/** Devuelve el XML interno (R-...xml) de un ZIP de CDR. */
export function extraerCdr(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith('.xml'));
  if (!entry) throw new Error('CDR sin XML interno');
  return entry.getData().toString('utf8');
}
