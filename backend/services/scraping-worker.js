import { executeQuery } from '../config/database.js';
import {
  crearProspectoDesdeDatos,
  recalcularScore,
  normalizarTelefono,
  normalizarEmail,
} from './prospectos.service.js';
import { buscarNegocios } from './scraper-places.service.js';
import { scrapeWebsite } from './scraper-web.service.js';

// ============================================================
// Worker en proceso para la cola scraping_jobs. Corre dentro del
// mismo servidor (I/O asíncrono, no bloquea): sondea la cola, procesa
// un job a la vez y emite progreso por socket.io. Diseñado para la
// escala de INDPACK; no requiere Redis ni un proceso aparte.
// ============================================================

let socketIo = null;
let procesando = false;
let intervalo = null;

/** Arranca el worker. Se llama desde server.js con la instancia de socket.io. */
export function startWorker(io) {
  socketIo = io;
  if (intervalo) clearInterval(intervalo);
  intervalo = setInterval(tick, 5000);
  tick();
  console.log('🛰️  Worker de prospección iniciado (cola scraping_jobs)');
}

/** Despierta al worker de inmediato (lo llama el controller al encolar). */
export function notificarJob() {
  tick();
}

function emit(evento, payload) {
  try { socketIo?.emit(evento, payload); } catch { /* noop */ }
}

async function tick() {
  if (procesando) return;
  procesando = true;
  try {
    // Procesa todos los pendientes en cascada mientras haya.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const job = await tomarSiguienteJob();
      if (!job) break;
      await procesarJob(job);
    }
  } catch (e) {
    console.error('Error en worker de prospección:', e.message);
  } finally {
    procesando = false;
  }
}

async function tomarSiguienteJob() {
  const sel = await executeQuery(
    "SELECT * FROM scraping_jobs WHERE estado = 'pendiente' ORDER BY prioridad ASC, id_job ASC LIMIT 1"
  );
  if (!sel.success || sel.data.length === 0) return null;
  const job = sel.data[0];

  // Reclama el job (optimista). Si otro tick lo tomó, affectedRows = 0.
  const upd = await executeQuery(
    "UPDATE scraping_jobs SET estado = 'procesando', fecha_inicio = NOW(), intentos = intentos + 1 WHERE id_job = ? AND estado = 'pendiente'",
    [job.id_job]
  );
  if (!upd.success || upd.data.affectedRows === 0) return null;

  emit('scraping:update', { id_job: job.id_job, tipo: job.tipo, estado: 'procesando' });
  return job;
}

async function completar(idJob, resultado) {
  await executeQuery(
    "UPDATE scraping_jobs SET estado = 'completado', resultado = ?, fecha_fin = NOW() WHERE id_job = ?",
    [JSON.stringify(resultado || {}), idJob]
  );
  emit('scraping:update', { id_job: idJob, estado: 'completado', resultado });
}

async function fallar(idJob, mensaje) {
  await executeQuery(
    "UPDATE scraping_jobs SET estado = 'error', error = ?, fecha_fin = NOW() WHERE id_job = ?",
    [String(mensaje).slice(0, 500), idJob]
  );
  emit('scraping:update', { id_job: idJob, estado: 'error', error: mensaje });
}

function parseParams(job) {
  if (!job.parametros) return {};
  if (typeof job.parametros === 'object') return job.parametros;
  try { return JSON.parse(job.parametros); } catch { return {}; }
}

async function procesarJob(job) {
  const params = parseParams(job);
  try {
    if (job.tipo === 'google_places') {
      await procesarPlaces(job, params);
    } else if (job.tipo === 'web_scrape' || job.tipo === 'enriquecer') {
      await procesarWebScrape(job, params);
    } else {
      await fallar(job.id_job, `Tipo de job no soportado por el worker: ${job.tipo}`);
    }
  } catch (e) {
    await fallar(job.id_job, e.message);
  }
}

// ---- Descubrimiento por Google Places ----
async function procesarPlaces(job, params) {
  const { query, zona, segmento, limite } = params;
  const res = await buscarNegocios(query, { zona, limite });
  if (!res.ok) return fallar(job.id_job, res.error || 'Búsqueda fallida');

  const resumen = { encontrados: res.empresas.length, creados: 0, duplicados: 0, ya_cliente: 0 };

  for (const emp of res.empresas) {
    const r = await crearProspectoDesdeDatos({
      segmento: segmento || 'Pequeno',
      razon_social: emp.razon_social,
      direccion: emp.direccion,
      distrito: emp.distrito,
      provincia: emp.provincia,
      telefono: emp.telefono,
      web: emp.web,
      origen: 'google_maps',
      url: emp.maps_url,
      datos_raw: emp.datos_raw,
    }, job.id_empleado_solicita);

    if (!r.success) continue;
    if (r.duplicado_prospecto) { resumen.duplicados++; continue; }
    if (r.flag === 'Ya_cliente') resumen.ya_cliente++;
    resumen.creados++;
  }

  await completar(job.id_job, resumen);
}

// ---- Enriquecimiento por scraping de web corporativa ----
async function procesarWebScrape(job, params) {
  const idProspecto = params.id_prospecto;
  if (!idProspecto) return fallar(job.id_job, 'Falta id_prospecto');

  const data = await scrapeWebsite(params.url);
  if (!data.ok) return fallar(job.id_job, data.error || 'No se pudo leer el sitio web');

  let nuevos = 0;
  const agregar = async (tipo, valor, norm) => {
    const r = await executeQuery(
      `INSERT IGNORE INTO prospecto_contactos (id_prospecto, tipo, valor, valor_normalizado, fuente)
       VALUES (?,?,?,?,'web')`,
      [idProspecto, tipo, valor, norm]
    );
    if (r.success && r.data.affectedRows > 0) nuevos++;
  };

  for (const email of data.emails) await agregar('Email', email, normalizarEmail(email));
  for (const tel of data.telefonos) await agregar('Telefono', tel, normalizarTelefono(tel));
  for (const [, url] of Object.entries(data.redes)) await agregar('RedSocial', url, String(url).toLowerCase());

  // Guarda la web en el prospecto si no la tenía.
  if (data.base) {
    await executeQuery(
      'UPDATE prospectos SET web = COALESCE(NULLIF(web, ""), ?) WHERE id_prospecto = ?',
      [data.base, idProspecto]
    );
  }

  // Trazabilidad + recálculo de score con lo nuevo.
  await executeQuery(
    'INSERT INTO prospecto_fuentes (id_prospecto, fuente, url, datos_raw) VALUES (?, "web", ?, ?)',
    [idProspecto, data.base, JSON.stringify({ emails: data.emails, telefonos: data.telefonos, redes: data.redes })]
  );
  const score = await recalcularScore(idProspecto);

  await completar(job.id_job, {
    id_prospecto: idProspecto,
    contactos_nuevos: nuevos,
    emails: data.emails.length,
    telefonos: data.telefonos.length,
    redes: Object.keys(data.redes).length,
    score,
  });
}
