// services/sunat/qr.service.js  —  Cadena pipe-separated y PNG del QR (RS 193-2020).
// FASE 6 usa solo la cadena (sunat_qr_data). El PNG se rinde en el PDF (FASE 13).
import QRCode from 'qrcode';

/**
 * @returns {{ data:string, png: () => Promise<Buffer> }}
 * data = RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPO_DOC_CLIENTE|NUM_DOC_CLIENTE|
 */
export function generarQr({ ruc, tipo, serie, numero, igv, total, fechaEmision, tipoDocCliente, numDocCliente }) {
  const data = [
    ruc, tipo, serie, numero,
    Number(igv).toFixed(2), Number(total).toFixed(2),
    fechaEmision, tipoDocCliente, numDocCliente, ''
  ].join('|');
  return { data, png: () => QRCode.toBuffer(data, { width: 200, margin: 1 }) };
}

/**
 * PNG de un QR a partir de una cadena arbitraria. FASE 13.
 * Sirve tanto para la cadena pipe de comprobantes (sunat_qr_data) como para la
 * URL que devuelve SUNAT en la GRE (sunat_qr_url).
 * @returns {Promise<Buffer>}
 */
export function qrPng(data, opts = {}) {
  return QRCode.toBuffer(String(data ?? ''), { width: 220, margin: 1, ...opts });
}
