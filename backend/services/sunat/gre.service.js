import axios from 'axios';
import crypto from 'crypto';
import { sunatConfig } from '../../config/sunat.js';
import { pool } from '../../config/database.js';

const esBeta = () => sunatConfig.mode !== 'PROD';

export async function obtenerTokenGre() {
  const [[t]] = await pool.query(
    'SELECT access_token FROM sunat_gre_token WHERE id = 1 AND expira_en > DATE_ADD(NOW(), INTERVAL 2 MINUTE)');
  if (t) return t.access_token;

  if (!sunatConfig.greClientId || !sunatConfig.greClientSecret) {
    const err = new Error('Faltan credenciales GRE (SUNAT_GRE_CLIENT_ID/SECRET) para obtener el token');
    err.statusCode = 422; err.isOperational = true; throw err;
  }
  const clientId = String(sunatConfig.greClientId).trim();
  const clientSecret = String(sunatConfig.greClientSecret).trim();
  const url = sunatConfig.urls.GRE_TOKEN.replace('{client_id}', clientId);
  const body = new URLSearchParams({
    grant_type: 'password',
    scope: 'https://api-cpe.sunat.gob.pe',
    client_id: clientId,
    client_secret: clientSecret,
    username: sunatConfig.ruc + sunatConfig.solUser,
    password: sunatConfig.solPass
  });
  let data;
  try {
    ({ data } = await axios.post(url, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000
    }));
  } catch (e) {
    const status = e.response?.status;
    const cuerpo = e.response?.data;
    const detalle = typeof cuerpo === 'object' ? JSON.stringify(cuerpo) : String(cuerpo ?? e.message);
    const err = new Error(`Token GRE falló (HTTP ${status ?? '?'}): ${detalle}`);
    err.sunatStatus = status;
    err.sunatBody = cuerpo ?? null;
    err.httpStatus = status;
    throw err;
  }
  await pool.query(
    `INSERT INTO sunat_gre_token (id, access_token, expira_en)
       VALUES (1, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
       ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), expira_en = VALUES(expira_en)`,
    [data.access_token, (data.expires_in || 3600) - 60]);
  return data.access_token;
}

export async function enviarGuia(nombreDoc, zipBuffer) {
  if (esBeta()) return 'MOCKGRE' + Date.now();
  const token = await obtenerTokenGre();
  const hashZip = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  const { data } = await axios.post(
    sunatConfig.urls.GRE_API + '/comprobantes/' + nombreDoc,
    { archivo: { nomArchivo: nombreDoc + '.zip', arcGreZip: zipBuffer.toString('base64'), hashZip } },
    { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, timeout: 60000 });
  return data.numTicket;
}

export async function consultarGuia(numTicket) {
  if (esBeta()) {
    return { codRespuesta: '0', cdrZip: null, indCdrGenerado: '0', error: null, mock: true };
  }
  const token = await obtenerTokenGre();
  const { data } = await axios.get(
    sunatConfig.urls.GRE_API + '/comprobantes/envios/' + numTicket,
    { headers: { Authorization: 'Bearer ' + token }, timeout: 30000 });
  return {
    codRespuesta: String(data.codRespuesta),
    cdrZip: data.arcCdr ? Buffer.from(data.arcCdr, 'base64') : null,
    indCdrGenerado: data.indCdrGenerado,
    error: data.error || null
  };
}
