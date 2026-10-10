import 'dotenv/config';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { extraerGlosa } from '../services/sunat/sire-compras.service.js';

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
    } catch (e) { if (i === 5) return null; await new Promise((r) => setTimeout(r, 2500)); }
  }
}

for (const id of ['20603404492-01-E001-1055', '20612062995-01-E001-3965', '20601223369-01-E001-676', '20602043488-01-F001-116']) {
  const xml = await bajar(id, '02');
  const pdf = await bajar(id, '01');
  const glosa = await extraerGlosa(xml, pdf);
  console.log(`${id}\n   => ${glosa}\n`);
}
process.exit(0);
