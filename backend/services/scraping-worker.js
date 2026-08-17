import { executeQuery } from '../config/database.js';
import {
  crearProspectoDesdeDatos,
  recalcularScore,
  normalizarTelefono,
  normalizarEmail,
} from './prospectos.service.js';
import { esEmpresaServicios } from './prospectos.service.js';
import { buscarBasico, detallar } from './scraper-places.service.js';
import { scrapeWebsite } from './scraper-web.service.js';
import { buscarRucPorNombre } from './ruc-lookup.service.js';

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
  const res = await buscarBasico(query, { zona, limite });
  if (!res.ok) return fallar(job.id_job, res.error || 'Búsqueda fallida');

  const resumen = { encontrados: res.resultados.length, creados: 0, duplicados: 0, ya_cliente: 0, irrelevantes: 0 };

  for (const base of res.resultados) {
    // Descartar empresas de servicios (agencias digitales, consultoras, estudios…)
    // que NO compran empaque: no se crean como prospecto y, al filtrar por el
    // nombre del Text Search, ni siquiera se pide el Place Details (ahorra cuota).
    if (esEmpresaServicios(base.razon_social)) { resumen.irrelevantes++; continue; }

    // Dedup barato por place_id: si ya existe, se salta SIN pedir el detalle
    // (ahorra cuota) y respeta exclusiones previas (no lo recrea).
    if (base.place_id) {
      const existe = await executeQuery('SELECT id_prospecto FROM prospectos WHERE place_id = ? LIMIT 1', [base.place_id]);
      if (existe.success && existe.data.length > 0) { resumen.duplicados++; continue; }
    }

    const det = await detallar(base.place_id);

    const r = await crearProspectoDesdeDatos({
      segmento: segmento || 'Formal',
      razon_social: det?.razon_social || base.razon_social,
      direccion: det?.direccion || base.direccion,
      distrito: det?.distrito || base.distrito,
      provincia: det?.provincia || base.provincia,
      telefono: det?.telefono || null,
      web: det?.web || null,
      foto_referencia: base.foto_referencia,
      place_id: base.place_id,
      origen: 'google_maps',
      origen_query: query,
      url: det?.maps_url || null,
      datos_raw: { ...base.datos_raw, detalle: det?.detalle_raw },
    }, job.id_empleado_solicita);

    if (!r.success) continue;
    if (r.duplicado_prospecto) { resumen.duplicados++; continue; }
    if (r.flag === 'Ya_cliente') resumen.ya_cliente++;
    resumen.creados++;

    // Auto-enriquecimiento en el mismo descubrimiento: si Google nos dio la
    // web, la leemos (gratis, no consume cuota de Places) para completar el
    // RUC y priorizar correos SIN depender del botón "Enriquecer".
    if (r.id_prospecto && det?.web) {
      try {
        const enr = await enriquecerDesdeWeb(r.id_prospecto, det.web);
        if (enr?.ruc) resumen.con_ruc = (resumen.con_ruc || 0) + 1;
        if (enr?.emails) resumen.con_email = (resumen.con_email || 0) + (enr.emails > 0 ? 1 : 0);
      } catch { /* el prospecto ya quedó creado; el scraping es best-effort */ }
    }
  }

  await completar(job.id_job, resumen);
}

// ---- Enriquecimiento por scraping de web corporativa (job manual) ----
async function procesarWebScrape(job, params) {
  const idProspecto = params.id_prospecto;
  if (!idProspecto) return fallar(job.id_job, 'Falta id_prospecto');

  const resultado = await enriquecerDesdeWeb(idProspecto, params.url);
  if (!resultado) return fallar(job.id_job, 'No se pudo leer el sitio web');
  await completar(job.id_job, { id_prospecto: idProspecto, ...resultado });
}

/**
 * Lee la web de un prospecto y vuelca lo público: correos y teléfonos (con el
 * área a la que pertenecen), redes, logo y RUC. Reutilizado por el job manual
 * "Enriquecer" y por el descubrimiento (para traer el RUC sin pasos extra).
 * @returns {Promise<Object|null>} resumen o null si no se pudo leer la web.
 */
async function enriquecerDesdeWeb(idProspecto, url) {
  const data = await scrapeWebsite(url);
  if (!data.ok) return null;

  let nuevos = 0;
  const agregar = async (tipo, valor, norm, area) => {
    const r = await executeQuery(
      `INSERT IGNORE INTO prospecto_contactos (id_prospecto, tipo, valor, valor_normalizado, area, fuente)
       VALUES (?,?,?,?,?,'web')`,
      [idProspecto, tipo, valor, norm, area || null]
    );
    if (r.success && r.data.affectedRows > 0) nuevos++;
  };

  // Contactos con área (correos primero, ya vienen priorizados del scraper).
  for (const c of data.contactos || []) {
    const norm = c.tipo === 'Email' ? normalizarEmail(c.valor) : normalizarTelefono(c.valor);
    await agregar(c.tipo, c.valor, norm, c.area);
  }
  for (const [, redUrl] of Object.entries(data.redes)) await agregar('RedSocial', redUrl, String(redUrl).toLowerCase(), null);

  // Guarda la web y el logo en el prospecto si no los tenía.
  if (data.base) {
    await executeQuery(
      'UPDATE prospectos SET web = COALESCE(NULLIF(web, ""), ?) WHERE id_prospecto = ?',
      [data.base, idProspecto]
    );
  }
  if (data.logo) {
    await executeQuery(
      'UPDATE prospectos SET logo_url = COALESCE(NULLIF(logo_url, ""), ?) WHERE id_prospecto = ?',
      [data.logo, idProspecto]
    );
  }

  // RUC del prospecto: preferimos el del pie de la web; si no está, lo
  // deducimos del nombre en directorios públicos (opt-in RUC_LOOKUP_NOMBRE).
  // En ambos casos se confirma con SUNAT (cacheado) y se detecta si ya es cliente.
  let rucAplicado = null;
  let dSunat = null;
  {
    const pr = await executeQuery('SELECT documento, razon_social FROM prospectos WHERE id_prospecto = ?', [idProspecto]);
    const row = pr.success ? pr.data[0] : null;
    const sinDoc = row && !row.documento;

    let rucFinal = data.ruc || null;
    // Sin RUC en la web → búsqueda por nombre (confirma contra SUNAT + parecido).
    if (sinDoc && !rucFinal && process.env.RUC_LOOKUP_NOMBRE === '1' && row.razon_social) {
      try {
        const hit = await buscarRucPorNombre(row.razon_social);
        if (hit) { rucFinal = hit.ruc; dSunat = hit.datos; }
      } catch { /* best-effort */ }
    }

    if (sinDoc && rucFinal) {
      // Sin APISPeru: si el RUC vino por nombre, ya trae datos de la página; si
      // vino del pie de la web, se aplica tal cual (nombre/dirección de Google).
      const d = dSunat || {};
      await executeQuery(
        `UPDATE prospectos SET
           documento = ?, tipo_documento = 'RUC', segmento = 'Formal',
           razon_social  = COALESCE(NULLIF(?, ''), razon_social),
           departamento  = COALESCE(departamento, ?),
           provincia     = COALESCE(provincia, ?),
           distrito      = COALESCE(distrito, ?),
           direccion     = COALESCE(NULLIF(direccion, ''), ?)
         WHERE id_prospecto = ?`,
        [rucFinal, d.razon_social || null, d.departamento || null, d.provincia || null,
         d.distrito || null, d.direccion || null, idProspecto]
      );
      // ¿Ese RUC ya es cliente?
      const cli = await executeQuery('SELECT id_cliente FROM clientes WHERE ruc = ? LIMIT 1', [rucFinal]);
      if (cli.success && cli.data.length > 0) {
        await executeQuery(
          "UPDATE prospectos SET flag_duplicado = 'Ya_cliente', id_cliente_match = ? WHERE id_prospecto = ?",
          [cli.data[0].id_cliente, idProspecto]
        );
      }
      rucAplicado = rucFinal;
    }
  }

  // Trazabilidad + recálculo de score con lo nuevo. Si validamos el RUC en SUNAT,
  // pasamos vigencia (activo/habido) para que suba a "caliente" si corresponde.
  await executeQuery(
    'INSERT INTO prospecto_fuentes (id_prospecto, fuente, url, datos_raw) VALUES (?, "web", ?, ?)',
    [idProspecto, data.base, JSON.stringify({ emails: data.emails, telefonos: data.telefonos, redes: data.redes })]
  );
  const score = await recalcularScore(
    idProspecto,
    dSunat ? { es_activo: dSunat.es_activo, es_habido: dSunat.es_habido } : {}
  );

  return {
    contactos_nuevos: nuevos,
    emails: data.emails.length,
    telefonos: data.telefonos.length,
    redes: Object.keys(data.redes).length,
    ruc: rucAplicado,
    score,
  };
}
