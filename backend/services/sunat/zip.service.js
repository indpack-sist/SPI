import AdmZip from 'adm-zip';

export function zipXml(nombreXml, xmlFirmado) {
  const zip = new AdmZip();
  zip.addFile(nombreXml, Buffer.from(xmlFirmado, 'utf8'));
  return zip.toBuffer();
}

export function extraerCdr(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith('.xml'));
  if (!entry) throw new Error('CDR sin XML interno');
  return entry.getData().toString('utf8');
}
