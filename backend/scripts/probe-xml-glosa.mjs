import 'dotenv/config';
import axios from 'axios';
import AdmZip from 'adm-zip';

const RUC = String(process.env.SUNAT_RUC || '').trim();
const SOL_USER = String(process.env.SUNAT_SOL_USER || '').trim();
const SOL_PASS = String(process.env.SUNAT_SOL_PASS || '').trim();
const GID = String(process.env.SUNAT_GRE_CLIENT_ID || '').trim();
const GSEC = String(process.env.SUNAT_GRE_CLIENT_SECRET || '').trim();

const SEG = 'https://api-seguridad.sunat.gob.pe';
const CPE = 'https://api-cpe.sunat.gob.pe/v1/contribuyente/consultacpe';
const id = '20610334416-01-E001-1';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

(async () => {
  const tok = (await axios.post(`${SEG}/v1/clientessol/${GID}/oauth2/token`,
    new URLSearchParams({ grant_type: 'password', scope: 'https://api-cpe.sunat.gob.pe',
      client_id: GID, client_secret: GSEC, username: RUC + SOL_USER, password: SOL_PASS }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).data.access_token;

  let data;
  for (let i = 0; i < 6; i++) {
    try {
      ({ data } = await axios.get(`${CPE}/comprobantes/${id}-2/02`,
        { headers: { ...headers, Authorization: `Bearer ${tok}` }, timeout: 45000 }));
      break;
    } catch (e) {
      console.log(`intento ${i + 1}: ${e.response?.status || e.message}`);
      if (i === 5) throw e;
      await new Promise((r) => setTimeout(r, 2500));
    }
  }

  console.log('nomArchivo:', data.nomArchivo);
  const zipBuf = Buffer.from(data.valArchivo, 'base64');
  const zip = new AdmZip(zipBuf);
  console.log('entradas del zip:', zip.getEntries().map((e) => e.entryName));

  const xmlEntry = zip.getEntries().find((e) => /\.xml$/i.test(e.entryName));
  const xml = xmlEntry.getData().toString('utf8');
  console.log('tam XML:', xml.length);

  const descripciones = [...xml.matchAll(/<cbc:Description[^>]*>([\s\S]*?)<\/cbc:Description>/g)].map((m) => m[1].trim());
  console.log('\nDESCRIPCIONES DE ITEMS (glosa):');
  descripciones.forEach((d, i) => console.log(` ${i + 1}. ${d}`));

  const notas = [...xml.matchAll(/<cbc:Note[^>]*>([\s\S]*?)<\/cbc:Note>/g)].map((m) => m[1].trim()).filter(Boolean);
  if (notas.length) { console.log('\nNOTAS:'); notas.slice(0, 5).forEach((n) => console.log('  -', n.slice(0, 120))); }
  process.exit(0);
})().catch((e) => { console.error('ERR', e.response?.status, e.message); process.exit(1); });
