import 'dotenv/config';
import axios from 'axios';

const RUC = String(process.env.SUNAT_RUC || '').trim();
const CID = String(process.env.SUNAT_CONSULTA_CLIENT_ID || '').trim();
const CSEC = String(process.env.SUNAT_CONSULTA_CLIENT_SECRET || '').trim();

const SEG = 'https://api-seguridad.sunat.gob.pe';
const cp = { ruc: '20610334416', tipo: '01', serie: 'E001', numero: '1' };
const id = `${cp.ruc}-${cp.tipo}-${cp.serie}-${cp.numero}`;

async function tokenConsulta() {
  const url = `${SEG}/v1/clientesextranet/${CID}/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://api.sunat.gob.pe/v1/contribuyente/contribuyentes',
    client_id: CID, client_secret: CSEC
  });
  const { data } = await axios.post(url, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });
  return data.access_token;
}

const A = 'https://api-cpe.sunat.gob.pe';
const B = 'https://api.sunat.gob.pe';

const urls = [
  `${A}/v1/contribuyente/consultacpe/contribuyente/${RUC}/comprobante/${id}/02`,
  `${B}/v1/contribuyente/consultacpe/contribuyente/${RUC}/comprobante/${id}/02`,
  `${A}/v1/contribuyente/consultacpe/${RUC}/comprobante/${id}/02`,
  `${B}/v1/contribuyente/consultacpe/${RUC}/comprobante/${id}/02`,
  `${A}/v1/contribuyente/consultacpe/${id}/02`,
  `${A}/v1/contribuyente/consultacpe/comprobante/${id}/02`,
  `${A}/v1/contribuyente/consultacpe/${cp.ruc}/${cp.tipo}/${cp.serie}/${cp.numero}/02`,
  `${A}/v1/contribuyente/consultacpe/contribuyente/${RUC}/comprobante/${id}`,
  `${B}/v1/contribuyente/consultacpe/contribuyente/${RUC}/comprobante/${id}`,
];

(async () => {
  if (!CID || !CSEC) { console.log('Faltan SUNAT_CONSULTA_CLIENT_ID/SECRET'); process.exit(1); }
  let tk;
  try { tk = await tokenConsulta(); console.log('TOKEN consulta OK len', tk.length, '\n'); }
  catch (e) { console.log('TOKEN FALLO', e.response?.status, JSON.stringify(e.response?.data || e.message)); process.exit(1); }

  for (const url of urls) {
    try {
      const r = await axios.get(url, { headers: { Authorization: `Bearer ${tk}` }, responseType: 'arraybuffer', timeout: 45000 });
      const body = Buffer.from(r.data);
      console.log(`200  ${url}`);
      console.log(`     ct=${r.headers['content-type']} bytes=${body.length} magic=${body.slice(0, 4).toString('latin1')}`);
      console.log(`     inicio: ${body.toString('utf8').slice(0, 120)}`);
    } catch (e) {
      const body = e.response?.data ? Buffer.from(e.response.data).toString('utf8').slice(0, 140) : e.message;
      console.log(`${e.response?.status || 'ERR'}  ${url}`);
      console.log(`     ${body}`);
    }
  }
  process.exit(0);
})();
