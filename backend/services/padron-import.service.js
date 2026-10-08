import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { executeQuery } from '../config/database.js';
import { detectarSector, getFechaPeru } from './prospectos.service.js';
import { resolverUbigeo } from './ubigeo.service.js';

export function parsearLineaPadron(linea) {
  if (!linea) return null;
  const delim = linea.indexOf('\t') !== -1 ? '\t' : '|';
  const f = linea.split(delim).map((x) => (x || '').trim());
  const ruc = f[0];
  if (!/^\d{11}$/.test(ruc)) return null;
  const direccion = [f[5], f[6], f[9] && `NRO ${f[9]}`, f[10] && `INT ${f[10]}`]
    .filter((x) => x && x !== '-' && x !== '.')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    ruc,
    razon_social: f[1] || '',
    estado: f[2] || null,
    condicion: f[3] || null,
    ubigeo: /^\d{6}$/.test(f[4] || '') ? f[4] : null,
    direccion: direccion || null,
  };
}

export function clasificarObjetivo(rec) {
  if (!rec || !rec.razon_social) return null;
  if (!/^(20|15|17)/.test(rec.ruc)) return null;
  if (!/ACTIVO/i.test(rec.estado || '')) return null;
  const det = detectarSector(rec.razon_social);
  return det ? { sector: det.sector } : null;
}

async function descargarA(url, destino) {
  const res = await axios.get(url, { responseType: 'stream', timeout: 0, maxContentLength: Infinity, maxBodyLength: Infinity });
  await new Promise((resolve, reject) => {
    const w = fs.createWriteStream(destino);
    res.data.pipe(w);
    w.on('finish', resolve);
    w.on('error', reject);
    res.data.on('error', reject);
  });
}

function extraerTxtDeZip(zipPath, dir) {
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntries().find((e) => /\.txt$/i.test(e.entryName));
  if (!entry) throw new Error('El ZIP no contiene un .txt (¿es el padrón reducido?)');
  zip.extractEntryTo(entry, dir, false, true);
  return path.join(dir, path.basename(entry.entryName));
}

async function obtenerTxt({ file, url }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'padron-'));
  const aBorrar = [tmp];
  const limpiar = () => { for (const p of aBorrar) { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* noop */ } } };

  let localZipOrTxt = file || null;
  if (url) {
    localZipOrTxt = path.join(tmp, 'padron.zip');
    await descargarA(url, localZipOrTxt);
  }
  if (!localZipOrTxt) throw new Error('Indica --file=<ruta zip/txt> o --url=<url del padrón>');

  if (/\.zip$/i.test(localZipOrTxt)) {
    const txtPath = extraerTxtDeZip(localZipOrTxt, tmp);
    return { txtPath, limpiar };
  }
  return { txtPath: localZipOrTxt, limpiar };
}

const COLS =['ruc', 'razon_social', 'estado', 'condicion', 'ubigeo', 'departamento', 'provincia', 'distrito', 'direccion', 'sector', 'fecha_import'];

async function insertarLote(filas) {
  if (!filas.length) return 0;
  const placeholders = filas.map(() => `(${COLS.map(() => '?').join(',')})`).join(',');
  const params = [];
  for (const r of filas) for (const c of COLS) params.push(r[c] ?? null);
  const sql = `INSERT INTO padron_empresas (${COLS.join(',')}) VALUES ${placeholders}
    ON DUPLICATE KEY UPDATE razon_social=VALUES(razon_social), estado=VALUES(estado),
      condicion=VALUES(condicion), ubigeo=VALUES(ubigeo), departamento=VALUES(departamento),
      provincia=VALUES(provincia), distrito=VALUES(distrito), direccion=VALUES(direccion),
      sector=VALUES(sector), fecha_import=VALUES(fecha_import)`;
  const r = await executeQuery(sql, params);
  if (!r.success) throw new Error(r.error);
  return filas.length;
}

export async function importarPadron(opts = {}) {
  const { departamentos, batch = 500, onProgress } = opts;
  const { txtPath, limpiar } = await obtenerTxt(opts);
  const fecha = getFechaPeru();
  const stats = { leidas: 0, objetivos: 0, insertadas: 0 };
  let buffer = [];

  try {
    const rl = readline.createInterface({ input: fs.createReadStream(txtPath, { encoding: 'latin1' }), crlfDelay: Infinity });
    for await (const linea of rl) {
      stats.leidas++;
      const rec = parsearLineaPadron(linea);
      if (!rec) continue;
      const obj = clasificarObjetivo(rec);
      if (!obj) continue;

      const { departamento, provincia, distrito } = resolverUbigeo(rec.ubigeo);
      if (departamentos && departamento && !departamentos.has(departamento)) continue;

      stats.objetivos++;
      buffer.push({
        ruc: rec.ruc,
        razon_social: rec.razon_social.slice(0, 255),
        estado: rec.estado,
        condicion: rec.condicion,
        ubigeo: rec.ubigeo,
        departamento,
        provincia,
        distrito,
        direccion: rec.direccion ? rec.direccion.slice(0, 255) : null,
        sector: obj.sector,
        fecha_import: fecha,
      });

      if (buffer.length >= batch) {
        stats.insertadas += await insertarLote(buffer);
        buffer = [];
        onProgress?.({ ...stats });
      }
    }
    if (buffer.length) stats.insertadas += await insertarLote(buffer);
    onProgress?.({ ...stats });
    return stats;
  } finally {
    limpiar();
  }
}
