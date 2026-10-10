import 'dotenv/config';
import axios from 'axios';
import AdmZip from 'adm-zip';

const RUC = String(process.env.SUNAT_RUC || '').trim();
const SOL_USER = String(process.env.SUNAT_SOL_USER || '').trim();
const SOL_PASS = String(process.env.SUNAT_SOL_PASS || '').trim();
const GID = String(process.env.SUNAT_GRE_CLIENT_ID || '').trim();
const GSEC = String(process.env.SUNAT_GRE_CLIENT_SECRET || '').trim();

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

const tok = (await axios.post(`https://api-seguridad.sunat.gob.pe/v1/clientessol/${GID}/oauth2/token`,
  new URLSearchParams({ grant_type: 'password', scope: 'https://api-cpe.sunat.gob.pe',
    client_id: GID, client_secret: GSEC, username: RUC + SOL_USER, password: SOL_PASS }).toString(),
  { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).data.access_token;

let data;
for (let i = 0; i < 6; i++) {
  try { ({ data } = await axios.get('https://api-cpe.sunat.gob.pe/v1/contribuyente/consultacpe/comprobantes/20603404492-01-E001-1055-2/02',
    { headers: { ...headers, Authorization: `Bearer ${tok}` } })); break; }
  catch (e) { if (i === 5) throw e; await new Promise((r) => setTimeout(r, 2500)); }
}

const buf = new AdmZip(Buffer.from(data.valArchivo, 'base64')).getEntries()[0].getData();
console.log('declaracion XML:', buf.slice(0, 60).toString('latin1'));
const re = /<cbc:Description[^>]*>([\s\S]*?)<\/cbc:Description>/g;
const utf8 = buf.toString('utf8');
const latin1 = buf.toString('latin1');
console.log('\nUTF8 :', [...utf8.matchAll(re)].map((m) => m[1]).join(' || ').slice(0, 200));
console.log('\nLATIN1:', [...latin1.matchAll(re)].map((m) => m[1]).join(' || ').slice(0, 200));
process.exit(0);
