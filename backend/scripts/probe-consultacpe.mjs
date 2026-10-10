import 'dotenv/config';
import axios from 'axios';

const RUC = String(process.env.SUNAT_RUC || '').trim();
const SOL_USER = String(process.env.SUNAT_SOL_USER || '').trim();
const SOL_PASS = String(process.env.SUNAT_SOL_PASS || '').trim();
const GID = String(process.env.SUNAT_GRE_CLIENT_ID || '').trim();
const GSEC = String(process.env.SUNAT_GRE_CLIENT_SECRET || '').trim();
const CID = String(process.env.SUNAT_CONSULTA_CLIENT_ID || '').trim();
const CSEC = String(process.env.SUNAT_CONSULTA_CLIENT_SECRET || '').trim();

const SEG = 'https://api-seguridad.sunat.gob.pe';
const CPE = 'https://api-cpe.sunat.gob.pe/v1/contribuyente/consultacpe';

const cp = { ruc: '20610334416', tipo: '01', serie: 'E001', numero: '1' };
const idBase = `${cp.ruc}-${cp.tipo}-${cp.serie}-${cp.numero}`;

async function tokenGre() {
  const { data } = await axios.post(
    `${SEG}/v1/clientessol/${GID}/oauth2/token`,
    new URLSearchParams({ grant_type: 'password', scope: 'https://api-cpe.sunat.gob.pe',
      client_id: GID, client_secret: GSEC, username: RUC + SOL_USER, password: SOL_PASS }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });
  return data.access_token;
}
async function tokenConsulta() {
  const { data } = await axios.post(
    `${SEG}/v1/clientesextranet/${CID}/oauth2/token`,
    new URLSearchParams({ grant_type: 'client_credentials',
      scope: 'https://api.sunat.gob.pe/v1/contribuyente/contribuyentes', client_id: CID, client_secret: CSEC }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });
  return data.access_token;
}

async function probar(tk, etiqueta) {
  const urls = [
    `${CPE}/comprobantes/${idBase}-2`,
    `${CPE}/comprobantes/${idBase}-2/02`,
    `${CPE}/comprobantes/${idBase}-2/01`,
    `${CPE}/comprobantes/${idBase}-2/03`,
    `${CPE}/contribuyentes/${cp.ruc}`,
  ];
  const headers = {
    Authorization: `Bearer ${tk}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br'
  };
  for (const url of urls) {
    try {
      const r = await axios.get(url, { headers, responseType: 'arraybuffer', timeout: 45000, maxRedirects: 5 });
      const body = Buffer.from(r.data);
      console.log(`  200  ${url.replace('https://api-cpe.sunat.gob.pe','')}`);
      console.log(`       ct=${r.headers['content-type']} bytes=${body.length} magic=${body.slice(0, 4).toString('latin1')}`);
      console.log(`       ${body.toString('utf8').slice(0, 140).replace(/\n/g, ' ')}`);
    } catch (e) {
      const body = e.response?.data ? Buffer.from(e.response.data).toString('utf8').slice(0, 120) : e.message;
      console.log(`  ${e.response?.status || 'ERR'}  ${url.replace('https://api-cpe.sunat.gob.pe','')}  ->  ${body}`);
    }
  }
}

(async () => {
  console.log('comprobante de prueba (compra):', idBase, 'origen=2 (recibido)\n');
  if (GID && GSEC) {
    try { const t = await tokenGre(); console.log(`== TOKEN GRE (clientessol/password/scope api-cpe) len ${t.length} ==`); await probar(t, 'GRE'); }
    catch (e) { console.log('TOKEN GRE FALLO', e.response?.status, JSON.stringify(e.response?.data || e.message)); }
  }
  console.log('');
  if (CID && CSEC) {
    try { const t = await tokenConsulta(); console.log(`== TOKEN CONSULTA (clientesextranet/scope contribuyentes) len ${t.length} ==`); await probar(t, 'CONSULTA'); }
    catch (e) { console.log('TOKEN CONSULTA FALLO', e.response?.status, JSON.stringify(e.response?.data || e.message)); }
  }
  process.exit(0);
})();
