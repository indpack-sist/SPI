import dns from 'dns/promises';

const IPV4_PRIVADA = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|7[0-9]|8[0-9]|9[0-9]|1[01][0-9]|12[0-7])\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^198\.18\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^192\.0\.0\./,
  /^192\.0\.2\./,
  /^224\./,
  /^240\./,
  /^255\./,
];

function ipPrivada(ip) {
  if (!ip) return true;
  if (ip.includes(':')) {
    if (ip.startsWith('::ffff:')) ip = ip.slice(7);
    else {
      return /^(fc|fd|fe8|fe9|fea|feb)/i.test(ip) || /^::1$/.test(ip) || /^::$/.test(ip);
    }
  }
  return IPV4_PRIVADA.some((re) => re.test(ip));
}

export async function esHostSeguro(host) {
  if (!host) return false;
  host = String(host).trim();
  if (!host || host.includes('..') || /[\x00-\x20]/.test(host)) return false;
  while (host.endsWith('.')) host = host.slice(0, -1);
  if (!host) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return !ipPrivada(host);
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (/^[0-9a-fA-F:]+$/.test(host) && host.includes(':')) return !ipPrivada(host);
  let direcciones;
  try {
    direcciones = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    return false;
  }
  if (!direcciones || direcciones.length === 0) return false;
  return direcciones.every((d) => !ipPrivada(d.address));
}

export async function urlSegura(raw) {
  if (!raw) return null;
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (!(await esHostSeguro(u.hostname))) return null;
  return u;
}
