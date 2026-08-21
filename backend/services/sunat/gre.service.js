// services/sunat/gre.service.js  —  API REST GRE (OAuth2): token + envío/consulta. FASE 10.
// El token OAuth2 es REAL en cualquier modo (mismo servidor de seguridad). El envío/consulta
// se MOCKEAN en BETA porque SUNAT no publica un ambiente Beta del API REST de GRE.
import axios from 'axios';
import crypto from 'crypto';
import { sunatConfig } from '../../config/sunat.js';
import { pool } from '../../config/database.js';

const esBeta = () => sunatConfig.mode !== 'PROD';

/** Token OAuth2 GRE (grant_type=password), cacheado en sunat_gre_token (id=1). */
export async function obtenerTokenGre() {
  const [[t]] = await pool.query(
    'SELECT access_token FROM sunat_gre_token WHERE id = 1 AND expira_en > DATE_ADD(NOW(), INTERVAL 2 MINUTE)');
  if (t) return t.access_token;

  if (!sunatConfig.greClientId || !sunatConfig.greClientSecret) {
    const err = new Error('Faltan credenciales GRE (SUNAT_GRE_CLIENT_ID/SECRET) para obtener el token');
    err.statusCode = 422; err.isOperational = true; throw err;
  }
  const url = sunatConfig.urls.GRE_TOKEN.replace('{client_id}', sunatConfig.greClientId);
  const body = new URLSearchParams({
    grant_type: 'password',
    scope: 'https://api-cpe.sunat.gob.pe',
    client_id: sunatConfig.greClientId,
    client_secret: sunatConfig.greClientSecret,
    username: sunatConfig.ruc + sunatConfig.solUser,
    password: sunatConfig.solPass
  });
  const { data } = await axios.post(url, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000
  });
  await pool.query(
    `INSERT INTO sunat_gre_token (id, access_token, expira_en)
       VALUES (1, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
       ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), expira_en = VALUES(expira_en)`,
    [data.access_token, (data.expires_in || 3600) - 60]);
  return data.access_token;
}

/** Envía el ZIP de la guía. nombreDoc = RUC-09-TE01-1 (sin extensión). Devuelve numTicket. */
export async function enviarGuia(nombreDoc, zipBuffer) {
  if (esBeta()) return 'MOCKGRE' + Date.now(); // sin Beta oficial del API GRE
  const token = await obtenerTokenGre();
  const hashZip = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  const { data } = await axios.post(
    sunatConfig.urls.GRE_API + '/comprobantes/' + nombreDoc,
    { archivo: { nomArchivo: nombreDoc + '.zip', arcGreZip: zipBuffer.toString('base64'), hashZip } },
    { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, timeout: 60000 });
  return data.numTicket;
}

/** Consulta el ticket. codRespuesta: '0' aceptado, '98' en proceso, '99' con errores. */
export async function consultarGuia(numTicket) {
  if (esBeta()) {
    // MOCK: aceptación simulada. Sin CDR/QR reales (solo existen en PROD).
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
