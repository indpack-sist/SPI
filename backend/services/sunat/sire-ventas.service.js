import axios from 'axios';
import { tokenSire, base, esperarArchivo, descargarArchivo } from './sire-compras.service.js';
import { parseVentasPropuesta, CABECERAS_VENTAS } from './sire-ventas.parser.js';

const COD_LIBRO_RVIE = '140000';
const CACHE_MS = 15 * 60 * 1000;
const cache = new Map();

async function solicitarPropuesta(periodo, token) {
  try {
    const { data } = await axios.get(
      `${base()}/libros/rvie/propuesta/web/propuesta/${periodo}/exportapropuesta`,
      { params: { codTipoArchivo: 0 }, headers: { Authorization: `Bearer ${token}` }, timeout: 60000 });
    if (!data.numTicket) {
      const e = new Error('SUNAT no devolvió numTicket para la propuesta de ventas.');
      e.statusCode = 502; throw e;
    }
    return data.numTicket;
  } catch (e) {
    if (e.response?.status === 422) return null;
    if (!e.response) throw e;
    const cuerpo = e.response.data;
    const detalle = typeof cuerpo === 'object' ? JSON.stringify(cuerpo) : String(cuerpo ?? e.message);
    const err = new Error(`SUNAT rechazó la consulta de la propuesta de ventas (HTTP ${e.response.status}): ${detalle}`);
    err.statusCode = 502; throw err;
  }
}

async function descargarPropuesta(periodo) {
  const token = await tokenSire();
  const numTicket = await solicitarPropuesta(periodo, token);
  const consultado_en = new Date().toISOString();
  if (!numTicket) return { cabeceras: CABECERAS_VENTAS, filas: [], consultado_en };
  const archivo = await esperarArchivo(numTicket, periodo, token);
  const texto = await descargarArchivo(archivo, numTicket, periodo, token, {
    codLibro: COD_LIBRO_RVIE, codProceso: archivo.codProceso || '10'
  });
  return { ...parseVentasPropuesta(texto), consultado_en };
}

export async function obtenerPropuestaVentas(periodo, { refrescar = false } = {}) {
  if (!/^\d{6}$/.test(String(periodo || ''))) {
    const e = new Error('Periodo inválido, usa el formato YYYYMM.');
    e.statusCode = 400; e.isOperational = true; throw e;
  }
  const previa = cache.get(periodo);
  if (previa && (previa.pendiente || (!refrescar && previa.expira > Date.now()))) return previa.promesa;

  const entrada = { pendiente: true, expira: 0, promesa: null };
  entrada.promesa = descargarPropuesta(periodo)
    .then((r) => { entrada.pendiente = false; entrada.expira = Date.now() + CACHE_MS; return r; })
    .catch((e) => { cache.delete(periodo); throw e; });
  cache.set(periodo, entrada);
  return entrada.promesa;
}
