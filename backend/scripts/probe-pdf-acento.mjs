import 'dotenv/config';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { PDFParse } from 'pdf-parse';

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

async function bajar(id, archivo) {
  for (let i = 0; i < 6; i++) {
    try {
      const { data } = await axios.get(`https://api-cpe.sunat.gob.pe/v1/contribuyente/consultacpe/comprobantes/${id}-2/${archivo}`,
        { headers: { ...headers, Authorization: `Bearer ${tok}` } });
      return new AdmZip(Buffer.from(data.valArchivo, 'base64')).getEntries()[0].getData();
    } catch (e) { if (i === 5) throw e; await new Promise((r) => setTimeout(r, 2500)); }
  }
}

const id = '20603404492-01-E001-1051';
const pdfBuf = await bajar(id, '01');
const texto = (await new PDFParse({ data: pdfBuf }).getText()).text;
const idx = texto.indexOf('CAT');
console.log('PDF texto cerca de "CAT":');
console.log(texto.slice(Math.max(0, idx - 10), idx + 90));
console.log('\n¿tiene "CATÁLOGO"?', texto.includes('CATÁLOGO'));
console.log('¿tiene "Á" o acentos?', /[ÁÉÍÓÚáéíóúÑñ]/.test(texto));
console.log('¿tiene "�"?', texto.includes('�'));
process.exit(0);
