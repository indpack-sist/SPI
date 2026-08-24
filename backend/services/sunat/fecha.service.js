// services/sunat/fecha.service.js — hora Lima explícita para columnas DATETIME del módulo SUNAT.
// La sesión MySQL corre en UTC (time_zone=SYSTEM); toda columna de tiempo se ESCRIBE con hora
// Lima calculada en Node (Intl formatToParts), nunca con NOW()/CURRENT_TIMESTAMP.

/**
 * Fecha/hora en zona Lima para IssueDate/IssueTime (XML) y para persistir en BD.
 * @returns {{emision:string, hora:string, emisionDateTime:string}}
 *   emision='YYYY-MM-DD', hora='HH:MM:SS', emisionDateTime='YYYY-MM-DD HH:MM:SS'
 */
export function fechaLima() {
  const now = new Date();
  const emision = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  let hora = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Lima', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(now);
  hora = hora.replace(/^24/, '00'); // quirk de medianoche en algunos runtimes
  return { emision, hora, emisionDateTime: `${emision} ${hora}` };
}

/** Atajo: 'YYYY-MM-DD HH:MM:SS' en hora Lima, listo para persistir en DATETIME. */
export function ahoraLima() {
  return fechaLima().emisionDateTime;
}
