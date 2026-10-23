export const fmtFecha = (fecha) => {
  if (!fecha) return '—';
  const texto = String(fecha);
  if (texto.includes('T') || (texto.includes(' ') && texto.includes(':'))) {
    const d = new Date(texto);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  const partes = texto.split(' ')[0].split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return texto;
};

export const diasDesde = (fecha) => {
  if (!fecha) return null;
  const d = new Date(String(fecha).includes('T') ? fecha : `${String(fecha).split(' ')[0]}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((hoy - d) / 86400000);
};

export const haceTexto = (fecha) => {
  const dias = diasDesde(fecha);
  if (dias === null) return '';
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 31) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const anios = Math.round(dias / 365);
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`;
};

const formatoNumero = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtMonto = (valor, moneda = 'PEN') => `${moneda === 'USD' ? '$' : 'S/'} ${formatoNumero.format(parseFloat(valor || 0))}`;

export const fmtNumero = (valor, decimales = 0) => new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: decimales,
  maximumFractionDigits: decimales
}).format(parseFloat(valor || 0));

export const iniciales = (nombre) => String(nombre || '?')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map(p => p[0])
  .join('')
  .toUpperCase();

export const incluye = (valor, termino) => String(valor || '').toLowerCase().includes(termino);
