import axios from 'axios';
import AdmZip from 'adm-zip';
import { sunatConfig } from '../../config/sunat.js';
import { pool } from '../../config/database.js';
import { parseComprasPropuesta } from './sire-compras.parser.js';

async function tokenSire() {
  const [[t]] = await pool.query(
    'SELECT access_token FROM sunat_gre_token WHERE id = 2 AND expira_en > DATE_ADD(NOW(), INTERVAL 2 MINUTE)');
  if (t) return t.access_token;

  const clientId = String(sunatConfig.greClientId || '').trim();
  const clientSecret = String(sunatConfig.greClientSecret || '').trim();
  if (!clientId || !clientSecret) {
    const err = new Error('Faltan credenciales SUNAT (SUNAT_GRE_CLIENT_ID/SECRET).');
    err.statusCode = 422; err.isOperational = true; throw err;
  }
  const url = sunatConfig.urls.GRE_TOKEN.replace('{client_id}', clientId);
  const body = new URLSearchParams({
    grant_type: 'password',
    scope: sunatConfig.urls.SIRE_SCOPE,
    client_id: clientId,
    client_secret: clientSecret,
    username: sunatConfig.ruc + sunatConfig.solUser,
    password: sunatConfig.solPass
  });
  let data;
  try {
    ({ data } = await axios.post(url, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 }));
  } catch (e) {
    const status = e.response?.status;
    const cuerpo = e.response?.data;
    const detalle = typeof cuerpo === 'object' ? JSON.stringify(cuerpo) : String(cuerpo ?? e.message);
    const err = new Error(`Token SIRE falló (HTTP ${status ?? '?'}): ${detalle}`);
    err.statusCode = 502; throw err;
  }
  await pool.query(
    `INSERT INTO sunat_gre_token (id, access_token, expira_en)
       VALUES (2, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
       ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), expira_en = VALUES(expira_en)`,
    [data.access_token, (data.expires_in || 3600) - 60]);
  return data.access_token;
}

const base = () => sunatConfig.urls.SIRE_API;

async function solicitarPropuesta(periodo, token) {
  const { data } = await axios.get(
    `${base()}/libros/rce/propuesta/web/propuesta/${periodo}/exportacioncomprobantepropuesta`,
    { params: { codTipoArchivo: 0, codOrigenEnvio: 1 },
      headers: { Authorization: `Bearer ${token}` }, timeout: 60000 });
  if (!data.numTicket) {
    const e = new Error('SUNAT no devolvió numTicket para la propuesta de compras.');
    e.statusCode = 502; throw e;
  }
  return data.numTicket;
}

async function esperarArchivo(numTicket, periodo, token) {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const { data } = await axios.get(
      `${base()}/libros/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets`,
      { params: { numTicket, perIni: periodo, perFin: periodo, page: 1, perPage: 20 },
        headers: { Authorization: `Bearer ${token}` }, timeout: 30000 });
    const reg = (data.registros || []).find((r) => r.numTicket === numTicket) || (data.registros || [])[0];
    const estado = reg?.codEstadoProceso;
    if (estado === '06' || estado === '03' || estado === '04') {
      const entrada = (reg.archivoReporte || [])[0];
      if (!entrada?.nomArchivoReporte) {
        const e = new Error('SUNAT terminó el ticket pero no entregó el nombre del archivo.');
        e.statusCode = 502; throw e;
      }
      return { nomArchivoReporte: entrada.nomArchivoReporte, codTipo: entrada.codTipoAchivoReporte || '00' };
    }
    if (estado === '07' || estado === '09') {
      const e = new Error('SUNAT reportó el proceso de la propuesta como fallido.');
      e.statusCode = 502; throw e;
    }
  }
  const e = new Error('SUNAT sigue generando la propuesta. Reintenta en unos minutos.');
  e.statusCode = 504; e.isOperational = true; throw e;
}

async function descargarArchivo({ nomArchivoReporte, codTipo }, numTicket, periodo, token) {
  const { data } = await axios.get(
    `${base()}/libros/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte`,
    { params: {
        nomArchivoReporte, codTipoArchivoReporte: codTipo, codLibro: '080000',
        perTributario: periodo, codProceso: '10', numTicket
      },
      headers: { Authorization: `Bearer ${token}` }, responseType: 'arraybuffer', timeout: 120000 });
  const buffer = Buffer.from(data);
  try {
    const zip = new AdmZip(buffer);
    return zip.getEntries().map((en) => en.getData().toString('utf8')).join('\n');
  } catch {
    return buffer.toString('utf8');
  }
}

export async function listarComprasPeriodo(periodo) {
  if (!/^\d{6}$/.test(String(periodo || ''))) {
    const e = new Error('Periodo inválido, usa el formato YYYYMM.');
    e.statusCode = 400; e.isOperational = true; throw e;
  }
  const token = await tokenSire();
  const numTicket = await solicitarPropuesta(periodo, token);
  const archivo = await esperarArchivo(numTicket, periodo, token);
  const texto = await descargarArchivo(archivo, numTicket, periodo, token);
  return parseComprasPropuesta(texto);
}
