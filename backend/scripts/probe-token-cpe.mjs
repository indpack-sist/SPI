import 'dotenv/config';
import axios from 'axios';

const RUC = String(process.env.SUNAT_RUC || '').trim();
const SOL_USER = String(process.env.SUNAT_SOL_USER || '').trim();
const SOL_PASS = String(process.env.SUNAT_SOL_PASS || '').trim();
const CID = String(process.env.SUNAT_CONSULTA_CLIENT_ID || '').trim();
const CSEC = String(process.env.SUNAT_CONSULTA_CLIENT_SECRET || '').trim();
const GID = String(process.env.SUNAT_GRE_CLIENT_ID || '').trim();
const GSEC = String(process.env.SUNAT_GRE_CLIENT_SECRET || '').trim();

const SEG = 'https://api-seguridad.sunat.gob.pe';
const CPE = 'https://api-cpe.sunat.gob.pe/v1/contribuyente/consultacpe';
const cp = { ruc: '20610334416', tipo: '01', serie: 'E001', numero: '1' };
const id = `${cp.ruc}-${cp.tipo}-${cp.serie}-${cp.numero}`;

async function token({ flujo, grant, clientId, clientSecret, scope }) {
  const url = `${SEG}/v1/${flujo}/${clientId}/oauth2/token`;
  const params = { grant_type: grant, scope, client_id: clientId, client_secret: clientSecret };
  if (grant === 'password') { params.username = RUC + SOL_USER; params.password = SOL_PASS; }
  const { data } = await axios.post(url, new URLSearchParams(params).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });
  return data.access_token;
}

async function probarDescarga(tk, etiqueta) {
  for (const suf of ['02', '']) {
    const url = `${CPE}/contribuyente/${RUC}/comprobante/${id}${suf ? '/' + suf : ''}`;
    try {
      const r = await axios.get(url, { headers: { Authorization: `Bearer ${tk}` }, responseType: 'arraybuffer', timeout: 45000 });
      console.log(`   [${etiqueta}] DESCARGA OK 200 ${url} ct=${r.headers['content-type']} bytes=${r.data.byteLength}`);
      console.log('   inicio:', Buffer.from(r.data).toString('utf8').slice(0, 120));
    } catch (e) {
      const body = e.response?.data ? Buffer.from(e.response.data).toString('utf8').slice(0, 100) : e.message;
      console.log(`   [${etiqueta}] DESCARGA ${e.response?.status} ${url.replace('https://','')} -> ${body}`);
    }
  }
}

const combos = [
  { nombre: 'CONSULTA via clientessol+password, scope api-cpe', flujo: 'clientessol', grant: 'password', clientId: CID, clientSecret: CSEC, scope: 'https://api-cpe.sunat.gob.pe' },
  { nombre: 'CONSULTA via clientesextranet+client_credentials, scope api-cpe', flujo: 'clientesextranet', grant: 'client_credentials', clientId: CID, clientSecret: CSEC, scope: 'https://api-cpe.sunat.gob.pe' },
  { nombre: 'GRE via clientessol+password, scope api-cpe (ya funciona para GRE)', flujo: 'clientessol', grant: 'password', clientId: GID, clientSecret: GSEC, scope: 'https://api-cpe.sunat.gob.pe' },
];

(async () => {
  for (const c of combos) {
    console.log(`\n== ${c.nombre} ==`);
    if (!c.clientId || !c.clientSecret) { console.log('   faltan credenciales'); continue; }
    let tk;
    try { tk = await token(c); console.log('   TOKEN OK len', tk.length); }
    catch (e) { console.log('   TOKEN', e.response?.status, JSON.stringify(e.response?.data || e.message)); continue; }
    await probarDescarga(tk, c.nombre.split(' ')[0]);
  }
  process.exit(0);
})();
