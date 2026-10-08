import QRCode from 'qrcode';

export function generarQr({ ruc, tipo, serie, numero, igv, total, fechaEmision, tipoDocCliente, numDocCliente, hash }) {
  const data = [
    ruc, tipo, serie, numero,
    Number(igv).toFixed(2), Number(total).toFixed(2),
    fechaEmision, tipoDocCliente, numDocCliente, hash || '', ''
  ].join('|');
  return { data, png: () => QRCode.toBuffer(data, { width: 200, margin: 1 }) };
}

export function generarQrGre({ ruc, tipo = '09', serie, numero, fechaEmision, numDocDestinatario, hash }) {
  const correlativo = String(numero ?? '').trim().padStart(8, '0');
  const data = [
    String(ruc ?? '').trim(), String(tipo ?? '09').trim(), String(serie ?? '').trim(), correlativo,
    String(fechaEmision ?? '').trim(), String(numDocDestinatario ?? '').trim(), String(hash ?? '').trim(), ''
  ].join('|');
  return { data, png: () => QRCode.toBuffer(data, { width: 220, margin: 1 }) };
}

export function qrPng(data, opts = {}) {
  return QRCode.toBuffer(String(data ?? ''), { width: 220, margin: 1, ...opts });
}
