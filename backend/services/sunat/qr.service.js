// services/sunat/qr.service.js  —  Cadena pipe-separated y PNG del QR (RS 193-2020).
// FASE 6 usa solo la cadena (sunat_qr_data). El PNG se rinde en el PDF (FASE 13).
import QRCode from 'qrcode';

/**
 * @returns {{ data:string, png: () => Promise<Buffer> }}
 * data = RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPO_DOC_CLIENTE|NUM_DOC_CLIENTE|DIGEST|
 * El campo DIGEST es el ds:DigestValue del XML firmado (RS 193-2020, "Valor de resumen").
 */
export function generarQr({ ruc, tipo, serie, numero, igv, total, fechaEmision, tipoDocCliente, numDocCliente, hash }) {
  const data = [
    ruc, tipo, serie, numero,
    Number(igv).toFixed(2), Number(total).toFixed(2),
    fechaEmision, tipoDocCliente, numDocCliente, hash || '', ''
  ].join('|');
  return { data, png: () => QRCode.toBuffer(data, { width: 200, margin: 1 }) };
}

/**
 * Contenido de respaldo del QR para una GRE emitida desde el SEE del contribuyente.
 * SUNAT no devuelve un `qrUrl` al consultar el ticket GRE: devuelve el CDR en
 * `arcCdr`. La identificación verificable de la guía se arma con los datos del
 * XML firmado y su ds:DigestValue.
 *
 * data = RUC|TIPO|SERIE|NUMERO(8)|FECHA|DOC_DESTINATARIO|DIGEST|
 */
export function generarQrGre({ ruc, tipo = '09', serie, numero, fechaEmision, numDocDestinatario, hash }) {
  const correlativo = String(numero ?? '').trim().padStart(8, '0');
  const data = [
    String(ruc ?? '').trim(), String(tipo ?? '09').trim(), String(serie ?? '').trim(), correlativo,
    String(fechaEmision ?? '').trim(), String(numDocDestinatario ?? '').trim(), String(hash ?? '').trim(), ''
  ].join('|');
  return { data, png: () => QRCode.toBuffer(data, { width: 220, margin: 1 }) };
}

/**
 * PNG de un QR a partir de una cadena arbitraria. FASE 13.
 * Sirve tanto para cadenas pipe de comprobantes/GRE como para una URL legacy.
 * @returns {Promise<Buffer>}
 */
export function qrPng(data, opts = {}) {
  return QRCode.toBuffer(String(data ?? ''), { width: 220, margin: 1, ...opts });
}
