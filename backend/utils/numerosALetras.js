// =====================================================
// backend/utils/numeroALetras.js
// Convierte números a letras en español para PDFs
// =====================================================

const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DECENAS = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const DECENAS_MULTIPLO = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function unidades(num) {
  return UNIDADES[num] || '';
}

function decenas(num) {
  const decena = Math.floor(num / 10);
  const unidad = num % 10;

  if (num < 10) return unidades(num);
  if (num >= 10 && num < 20) return DECENAS[num - 10];
  if (num === 20) return 'VEINTE';
  if (unidad === 0) return DECENAS_MULTIPLO[decena];
  
  return DECENAS_MULTIPLO[decena] + (num > 30 ? ' Y ' : '') + unidades(unidad);
}

function centenas(num) {
  const centena = Math.floor(num / 100);
  const resto = num % 100;

  if (num === 100) return 'CIEN';
  if (num < 100) return decenas(num);
  
  return CENTENAS[centena] + (resto > 0 ? ' ' + decenas(resto) : '');
}

function miles(num) {
  const divisorMiles = Math.floor(num / 1000);
  const restoMiles = num % 1000;

  if (num < 1000) return centenas(num);
  
  const milesTexto = divisorMiles === 1 ? 'MIL' : centenas(divisorMiles) + ' MIL';
  
  return milesTexto + (restoMiles > 0 ? ' ' + centenas(restoMiles) : '');
}

function millones(num) {
  const divisorMillones = Math.floor(num / 1000000);
  const restoMillones = num % 1000000;

  if (num < 1000000) return miles(num);
  
  const millonesTexto = divisorMillones === 1 
    ? 'UN MILLON' 
    : miles(divisorMillones) + ' MILLONES';
  
  return millonesTexto + (restoMillones > 0 ? ' ' + miles(restoMillones) : '');
}

/**
 * Convierte un número a letras en español
 * @param {number} numero - El número a convertir
 * @param {string} moneda - 'PEN' o 'USD'
 * @returns {string} - El número en letras
 */
export function numeroALetras(numero, moneda = 'PEN') {
  if (numero === 0) {
    return moneda === 'USD' 
      ? 'CERO DÓLARES AMERICANOS' 
      : 'CERO SOLES';
  }

  const parteEntera = Math.floor(numero);
  const parteDecimal = Math.round((numero - parteEntera) * 100);

  let textoEntero = millones(parteEntera);
  
  // Nombre de la moneda
  const nombreMoneda = moneda === 'USD' 
    ? (parteEntera === 1 ? 'DÓLAR AMERICANO' : 'DÓLARES AMERICANOS')
    : (parteEntera === 1 ? 'SOL' : 'SOLES');
  
  const nombreCentavos = moneda === 'USD' ? 'CENTAVOS' : 'CÉNTIMOS';
  
  let resultado = textoEntero + ' ' + nombreMoneda;
  
  if (parteDecimal > 0) {
    const textoCentavos = parteDecimal < 10 
      ? '0' + parteDecimal 
      : parteDecimal.toString();
    resultado += ' CON ' + textoCentavos + '/100 ' + nombreCentavos;
  }
  
  return resultado;
}

/**
 * Versión simplificada para montos con centavos
 * @param {number} numero - El número a convertir
 * @param {string} moneda - 'PEN' o 'USD'
 * @returns {string} - Formato: "QUINIENTOS CUARENTA Y CINCO CON 50/100 SOLES"
 */
export function numeroALetrasSimple(numero, moneda = 'PEN') {
  const parteEntera = Math.floor(numero);
  const parteDecimal = Math.round((numero - parteEntera) * 100);

  const textoEntero = millones(parteEntera);
  const nombreMoneda = moneda === 'USD' ? 'DÓLARES' : 'SOLES';
  
  const textoCentavos = parteDecimal.toString().padStart(2, '0');
  
  return `${textoEntero} CON ${textoCentavos}/100 ${nombreMoneda}`;
}

// Exportar como default también
export default {
  numeroALetras,
  numeroALetrasSimple
};