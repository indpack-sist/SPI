/**
 * Convierte un monto a su representación en letras (español), formato SUNAT.
 * Ej: 1234.50 -> "MIL DOSCIENTOS TREINTA Y CUATRO CON 50/100"
 * SUNAT exige esta leyenda (catálogo 52, código 1000) en el comprobante.
 */
const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIEZ_A_DIECINUEVE = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const DECENAS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function seccion(n) {
  // n de 0 a 999
  let out = '';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c > 0) out += (n === 100 ? 'CIEN' : CENTENAS[c]) + ' ';
  if (resto >= 10 && resto <= 19) {
    out += DIEZ_A_DIECINUEVE[resto - 10] + ' ';
  } else if (resto >= 20 && resto <= 29) {
    out += (resto === 20 ? 'VEINTE' : 'VEINTI' + UNIDADES[resto - 20]) + ' ';
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    if (d > 0) out += DECENAS[d] + (u > 0 ? ' Y ' : ' ');
    if (u > 0) out += UNIDADES[u] + ' ';
  }
  return out;
}

function enteroALetras(n) {
  if (n === 0) return 'CERO';
  let out = '';
  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const cientos = n % 1000;

  if (millones > 0) out += (millones === 1 ? 'UN MILLON ' : seccion(millones) + 'MILLONES ');
  if (miles > 0) out += (miles === 1 ? 'MIL ' : seccion(miles) + 'MIL ');
  if (cientos > 0) out += seccion(cientos);
  return out.trim();
}

export function montoALetras(monto) {
  const entero = Math.floor(monto);
  const decimales = Math.round((monto - entero) * 100);
  const dec = String(decimales).padStart(2, '0');
  return `${enteroALetras(entero)} CON ${dec}/100`;
}
