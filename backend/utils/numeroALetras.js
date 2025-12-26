export function numeroALetras(num, moneda = 'PEN') {
  const unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  
  function convertirGrupo(n) {
    if (n === 0) return '';
    if (n < 10) return unidades[n];
    if (n < 20) return especiales[n - 10];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return decenas[d] + (u ? ' Y ' + unidades[u] : '');
    }
    const c = Math.floor(n / 100);
    const resto = n % 100;
    return (c === 1 && resto === 0 ? 'CIEN' : centenas[c]) + (resto ? ' ' + convertirGrupo(resto) : '');
  }
  
  const [entero, decimal] = num.toFixed(2).split('.');
  const parteEntera = parseInt(entero);
  const texto = convertirGrupo(parteEntera) || 'CERO';
  const monedaTexto = moneda === 'USD' ? 'DÓLARES' : 'SOLES';
  
  return `${texto} CON ${decimal}/100 ${monedaTexto}`;
}