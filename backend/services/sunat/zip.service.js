/**
 * Empaquetado ZIP para SEE. SUNAT recibe el XML firmado dentro de un ZIP
 * (mismo nombre base) y devuelve el CDR también dentro de un ZIP.
 */
import JSZip from 'jszip';

/**
 * Comprime el XML firmado. El .xml dentro del zip debe llamarse igual que el zip.
 * @returns {Promise<string>} ZIP en Base64 (para <contentFile> del SOAP)
 */
export async function comprimirXml(nombreBase, xmlFirmado) {
  const zip = new JSZip();
  zip.file(`${nombreBase}.xml`, xmlFirmado);
  return zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
}

/**
 * Descomprime el ZIP del CDR (viene en Base64) y devuelve el XML del CDR.
 * El CDR se llama R-<nombreBase>.xml.
 * @returns {Promise<string>} XML del CDR
 */
export async function extraerCdr(base64Zip) {
  const zip = await JSZip.loadAsync(base64Zip, { base64: true });
  const archivo = Object.keys(zip.files).find((n) => /\.xml$/i.test(n) && !zip.files[n].dir);
  if (!archivo) throw new Error('El ZIP del CDR no contiene ningún XML');
  return zip.files[archivo].async('string');
}
