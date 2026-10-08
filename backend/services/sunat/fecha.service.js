export function fechaLima() {
  const now = new Date();
  const emision = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  let hora = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Lima', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(now);
  hora = hora.replace(/^24/, '00');
  return { emision, hora, emisionDateTime: `${emision} ${hora}` };
}

export function ahoraLima() {
  return fechaLima().emisionDateTime;
}
