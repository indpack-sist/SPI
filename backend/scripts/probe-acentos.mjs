import 'dotenv/config';
import axios from 'axios';
import AdmZip from 'adm-zip';

const RUC = String(process.env.SUNAT_RUC || '').trim();
const SOL_USER = String(process.env.SUNAT_SOL_USER || '').trim();
const SOL_PASS = String(process.env.SUNAT_SOL_PASS || '').trim();
const GID = String(process.env.SUNAT_GRE_CLIENT_ID || '').trim();
const GSEC = String(process.env.SUNAT_GRE_CLIENT_SECRET || '').trim();
const headers = { 'User-Agent': 'Mozilla/5.0 Chrome/124.0 Safari/537.36', 'Accept': 'application/json, */*' };

const tok = (await axios.post(`https://api-seguridad.sunat.gob.pe/v1/clientessol/${GID}/oauth2/token`,
  new URLSearchParams({ grant_type: 'password', scope: 'https://api-cpe.sunat.gob.pe',
    client_id: GID, client_secret: GSEC, username: RUC + SOL_USER, password: SOL_PASS }).toString(),
  { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).data.access_token;

const FFFD = Buffer.from([0xEF, 0xBF, 0xBD]);
const utf8acc = /[À-ÿ]/; // acentos reales ya decodificados

async function bajar(id) {
  for (let i = 0; i < 6; i++) {
    try {
      const { data } = await axios.get(`https://api-cpe.sunat.gob.pe/v1/contribuyente/consultacpe/comprobantes/${id}-2/02`,
        { headers: { ...headers, Authorization: `Bearer ${tok}` } });
      return new AdmZip(Buffer.from(data.valArchivo, 'base64')).getEntries()[0].getData();
    } catch (e) { if (i === 5) throw e; await new Promise((r) => setTimeout(r, 2500)); }
  }
}

const muestra = [
  { documento: 'F001-16713', id: '20566058601-01-F001-16713' },
  { documento: 'E001-1051', id: '20603404492-01-E001-1051' },
  { documento: 'E001-3965', id: '20612062995-01-E001-3965' },
  { documento: 'F001-116', id: '20602043488-01-F001-116' },
  { documento: 'F033-174890', id: '20101266819-01-F033-174890' },
  { documento: 'F001-148454', id: '20600612922-01-F001-148454' },
  { documento: 'F001-114700', id: '20100064490-01-F001-114700' },
  { documento: 'E001-676', id: '20601223369-01-E001-676' },
  { documento: 'F013-11894', id: '20265681299-01-F013-11894' },
  { documento: 'F001-35451', id: '10102083500-01-F001-35451' }
];
let corruptos = 0, conAcentoReal = 0, sinAcento = 0;

for (const f of muestra) {
  try {
    const buf = await bajar(f.id);
    const enc = (/encoding=["']([^"']+)["']/i.exec(buf.subarray(0, 120).toString('latin1'))?.[1] || 'utf-8').toLowerCase();
    const esLatin = enc.includes('8859') || enc.includes('latin') || enc.includes('1252');
    const txt = buf.toString(esLatin ? 'latin1' : 'utf8');
    const tieneFFFD = buf.includes(FFFD) || txt.includes('�');
    const tieneAcento = esLatin ? /[À-ÿ]/.test(txt.replace(/�/g, '')) : utf8acc.test(txt);
    if (tieneFFFD) corruptos++; else if (tieneAcento) conAcentoReal++; else sinAcento++;
    console.log(`${f.documento.padEnd(14)} enc=${enc.padEnd(11)} ${tieneFFFD ? 'CORRUPTO(�)' : tieneAcento ? 'ACENTO OK' : 'sin acentos'}`);
  } catch (e) { console.log(f.documento, 'ERR', e.response?.status || e.message); }
}
console.log(`\nResumen de ${muestra.length}: corruptos=${corruptos}, con acento OK=${conAcentoReal}, sin acentos=${sinAcento}`);
process.exit(0);
