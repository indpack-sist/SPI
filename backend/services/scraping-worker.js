import { executeQuery } from '../config/database.js';
import {
  crearProspectoDesdeDatos,
  recalcularScore,
  normalizarTelefono,
  normalizarEmail,
  normalizarDocumento,
  getFechaPeru,
  clasificarCiiuFrutaVerdura,
} from './prospectos.service.js';
import { scrapeWebsite } from './scraper-web.service.js';
import { buscarRucPorNombre } from './ruc-lookup.service.js';
import { descubrirWeb } from './descubrir-web.service.js';
import { consultarPorRuc } from './padron-ruc.service.js';
import { scrapeSocial } from './scraper-social.service.js';

let socketIo = null;
let procesando = false;
let intervalo = null;

const CONCURRENCIA = Math.max(1, Number(process.env.PROSPECTOS_WORKER_CONCURRENCIA) || 2);

const MAX_INTENTOS = Math.max(1, Number(process.env.PROSPECTOS_WORKER_MAX_INTENTOS) || 3);
const STALE_MIN = Math.max(1, Number(process.env.PROSPECTOS_WORKER_STALE_MIN) || 15);

let ultimoStaleCheck = 0;

export function startWorker(io) {
  socketIo = io;
  if (intervalo) clearInterval(intervalo);
  intervalo = setInterval(tick, 30000);
  recuperarHuerfanos({ soloArranque: true })
    .catch((e) => console.error('Error recuperando jobs huérfanos:', e.message))
    .finally(() => tick());
  console.log('Worker de prospección iniciado (cola scraping_jobs)');
}

async function recuperarHuerfanos({ soloArranque = false } = {}) {
  const filtroTiempo = soloArranque ? '' : ` AND fecha_inicio < (NOW() - INTERVAL ${STALE_MIN} MINUTE)`;

  await executeQuery(
    `UPDATE scraping_jobs SET estado = 'pendiente'
     WHERE estado = 'procesando' AND intentos < ?${filtroTiempo}`,
    [MAX_INTENTOS]
  );
  const cerr = await executeQuery(
    `UPDATE scraping_jobs SET estado = 'error',
       error = 'Interrumpido: proceso reiniciado o tarea colgada', fecha_fin = NOW()
     WHERE estado = 'procesando' AND intentos >= ?${filtroTiempo}`,
    [MAX_INTENTOS]
  );
  if (cerr.success && cerr.data.affectedRows > 0) {
    emit('scraping:update', { estado: 'error', huerfanos_cerrados: cerr.data.affectedRows });
  }
}

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
    if (Date.now() - ultimoStaleCheck > 120000) {
      ultimoStaleCheck = Date.now();
      await recuperarHuerfanos({ soloArranque: false }).catch(() => {});
    }
    await Promise.all(Array.from({ length: CONCURRENCIA }, () => obrero()));
  } catch (e) {
    console.error('Error en worker de prospección:', e.message);
  } finally {
    procesando = false;
  }
}

async function obrero() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await tomarSiguienteJob();
    if (!job) break;
    try {
      await procesarJob(job);
    } catch (e) {
      console.error('Error procesando job de prospección:', e.message);
    }
  }
}

async function tomarSiguienteJob() {
  const sel = await executeQuery(
    "SELECT * FROM scraping_jobs WHERE estado = 'pendiente' ORDER BY prioridad ASC, id_job ASC LIMIT 1"
  );
  if (!sel.success || sel.data.length === 0) return null;
  const job = sel.data[0];

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
    if (job.tipo === 'web_scrape' || job.tipo === 'enriquecer') {
      await procesarWebScrape(job, params);
    } else {
      await fallar(job.id_job, `Tipo de job no soportado por el worker: ${job.tipo}`);
    }
  } catch (e) {
    await fallar(job.id_job, e.message);
  }
}

async function aplicarCompuertaCiiu(idProspecto, documento) {
  const doc = normalizarDocumento(documento);
  if (!/^\d{11}$/.test(doc)) return { excluido: false, verificado: false };

  let val = null;
  try { val = await consultarPorRuc(doc); } catch { /* fuente caída */ }
  if (!val?.valido || !val.datos) return { excluido: false, verificado: false };

  const ciiu = val.datos.ciiu || [];
  if (ciiu[0]?.codigo) {
    await executeQuery(
      'UPDATE prospectos SET ciiu = COALESCE(NULLIF(ciiu, ""), ?) WHERE id_prospecto = ?',
      [ciiu[0].codigo, idProspecto]
    );
  }

  const clasif = clasificarCiiuFrutaVerdura(ciiu);
  if (!clasif) return { excluido: false, verificado: false };

  if (clasif.objetivo === false) {
    await executeQuery('UPDATE prospectos SET excluido = 1 WHERE id_prospecto = ?', [idProspecto]);
    await executeQuery(
      'INSERT INTO prospecto_fuentes (id_prospecto, fuente, url, datos_raw, fecha_scraping) VALUES (?, "ciiu", ?, ?, ?)',
      [idProspecto, val.datos.fuentes?.[0]?.url || null, JSON.stringify({ excluido_por_ciiu: true, motivo: clasif.motivo, ciiu }), getFechaPeru()]
    );
    return { excluido: true, motivo: clasif.motivo, verificado: true };
  }
  return { excluido: false, verificado: true };
}

async function procesarWebScrape(job, params) {
  const idProspecto = params.id_prospecto;
  if (!idProspecto) return fallar(job.id_job, 'Falta id_prospecto');

  if (process.env.PROSPECTOS_CIIU_GATE === '1' && !params.redescubrir && params.accion === 'enriquecer') {
    const prg = await executeQuery('SELECT origen, documento, sector, estado_workflow, flag_duplicado, id_cliente_match FROM prospectos WHERE id_prospecto = ?', [idProspecto]);
    const pr0 = prg.data?.[0];
    const esClienteOGestionado = pr0 && (pr0.estado_workflow !== 'Nuevo' || pr0.flag_duplicado === 'Ya_cliente' || pr0.id_cliente_match);
    if (pr0 && pr0.origen === 'padron' && pr0.documento && pr0.sector === 'Agroexportación' && !esClienteOGestionado) {
      const gate = await aplicarCompuertaCiiu(idProspecto, pr0.documento);
      if (gate.excluido) {
        emit('prospectos:cambio', { accion: 'excluir', id_prospecto: Number(idProspecto), ts: Date.now() });
        return completar(job.id_job, { id_prospecto: idProspecto, excluido_por_ciiu: true, motivo: gate.motivo });
      }
    }
  }

  const redescubrir = !!params.redescubrir;
  if (redescubrir) {
    await executeQuery(
      "DELETE FROM prospecto_contactos WHERE id_prospecto = ? AND (fuente IS NULL OR fuente <> 'manual')",
      [idProspecto]
    );
    await executeQuery('UPDATE prospectos SET web = NULL, logo_url = NULL WHERE id_prospecto = ?', [idProspecto]);
  }

  let url = redescubrir ? null : params.url;
  let webVerificada = false;
  let motivoNoWeb = null;

  if (!url) {
    const pr = await executeQuery('SELECT razon_social, documento, distrito, provincia, web FROM prospectos WHERE id_prospecto = ?', [idProspecto]);
    const p = pr.data?.[0];
    let documento = p?.documento || null;

    if (redescubrir && !documento && p?.razon_social && params.buscar_ruc !== false) {
      try {
        const hit = await buscarRucPorNombre(p.razon_social);
        if (hit?.ruc) {
          documento = hit.ruc;
          await executeQuery(
            "UPDATE prospectos SET documento = ?, tipo_documento = 'RUC', segmento = 'Formal', razon_social = COALESCE(NULLIF(?, ''), razon_social) WHERE id_prospecto = ?",
            [hit.ruc, hit.datos?.razon_social || null, idProspecto]
          );
          const cli = await executeQuery('SELECT id_cliente FROM clientes WHERE ruc = ? LIMIT 1', [hit.ruc]);
          if (cli.success && cli.data.length > 0) {
            await executeQuery(
              "UPDATE prospectos SET flag_duplicado = 'Ya_cliente', id_cliente_match = ? WHERE id_prospecto = ?",
              [cli.data[0].id_cliente, idProspecto]
            );
          }
        }
      } catch { /* best-effort: si ruc.pe falla, se sigue sin RUC */ }
    }

    if (!redescubrir && p?.web) {
      url = p.web;
    } else if (p) {
      const zona = p.distrito ? `${p.distrito}, ${p.provincia || 'Perú'}` : 'Perú';
      const disc = await descubrirWeb(p.razon_social, { ruc: documento, zona });
      url = disc?.web || null;
      motivoNoWeb = disc?.motivo || null;
      webVerificada = !!disc?.web;
    }
  }

  if (!url) {
    if (redescubrir) {
      const score = await recalcularScore(idProspecto, {}, { permitirBajar: true });
      emit('prospectos:cambio', { accion: 'enriquecer', id_prospecto: Number(idProspecto), ts: Date.now() });
      return completar(job.id_job, { id_prospecto: idProspecto, redescubierto: true, web_no_encontrada: true, purgado: true, score });
    }
    return fallar(job.id_job, `No se encontró web verificable [${motivoNoWeb || 'desconocido'}].`);
  }

  const verificar = params.verificar !== false && !webVerificada;
  const resultado = await enriquecerDesdeWeb(idProspecto, url, { permitirBajar: redescubrir, verificar });
  if (!resultado) return fallar(job.id_job, 'No se pudo leer el sitio web');
  emit('prospectos:cambio', { accion: 'enriquecer', id_prospecto: Number(idProspecto), ts: Date.now() });
  await completar(job.id_job, { id_prospecto: idProspecto, redescubierto: redescubrir, ...resultado });
}

function normalizarTextoNombre(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const GENERICOS_NOMBRE = new Set([
  'peru', 'peruana', 'peruano', 'lima', 'callao', 'sac', 'sa', 'srl', 'eirl', 'ltda',
  'sociedad', 'anonima', 'cerrada', 'group', 'grupo', 'international', 'internacional',
  'corporation', 'corp', 'company', 'cia', 'holding', 'import', 'export', 'importaciones',
  'exportaciones', 'comercial', 'industrial', 'industria', 'industrias', 'servicios',
  'inversiones', 'negocios', 'distribuidora', 'distribuciones', 'empresa', 'del', 'de',
  'la', 'el', 'los', 'las', 'and',
]);
function tokensSignificativos(nombre) {
  return normalizarTextoNombre(nombre).split(' ').filter((t) => t.length >= 3 && !GENERICOS_NOMBRE.has(t));
}
function hostCompacto(url) {
  try { return new URL(url).host.toLowerCase().replace(/[^a-z0-9]/g, ''); } catch { return ''; }
}
function webCorrespondeAlProspecto({ razonSocial, documentoProspecto, urlBase, rucsWeb = [] }) {
  const docP = normalizarDocumento(documentoProspecto);
  const rucs = (rucsWeb || []).map(normalizarDocumento);

  if (docP) {
    return rucs.includes(docP)
      ? { ok: true, motivo: 'ruc_en_pagina' }
      : { ok: false, motivo: rucs.length ? 'ruc_distinto' : 'sin_ruc_en_pagina' };
  }

  const toks = tokensSignificativos(razonSocial);
  if (!toks.length) return { ok: false, motivo: 'nombre_sin_tokens_evaluables' };
  const host = hostCompacto(urlBase);
  const distintivo = toks.find((t) => t.length >= 4 && host.includes(t) && host.length <= t.length + 12);
  return distintivo ? { ok: true, motivo: 'dominio_es_nombre' } : { ok: false, motivo: 'sin_relacion_con_nombre' };
}

async function enriquecerDesdeWeb(idProspecto, url, opciones = {}) {
  const data = await scrapeWebsite(url);
  if (!data.ok) return null;

  if (opciones.verificar !== false) {
    const prow = await executeQuery('SELECT documento, razon_social FROM prospectos WHERE id_prospecto = ?', [idProspecto]);
    const p = prow.data?.[0] || {};
    const v = webCorrespondeAlProspecto({
      razonSocial: p.razon_social,
      documentoProspecto: p.documento,
      urlBase: data.base,
      rucsWeb: data.rucs,
    });
    if (!v.ok) {
      const score = await recalcularScore(idProspecto, {}, { permitirBajar: !!opciones.permitirBajar });
      return { rechazada: true, motivo: v.motivo, web_rechazada: data.base, contactos_nuevos: 0, emails: 0, telefonos: 0, redes: 0, ruc: null, score };
    }
  }

  let nuevos = 0;
  const agregar = async (tipo, valor, norm, area, fuente = 'web', fuenteUrl = null) => {
    const r = await executeQuery(
      `INSERT IGNORE INTO prospecto_contactos (id_prospecto, tipo, valor, valor_normalizado, area, fuente, fuente_url)
       VALUES (?,?,?,?,?,?,?)`,
      [idProspecto, tipo, valor, norm, area || null, fuente, fuenteUrl]
    );
    if (r.success && r.data.affectedRows > 0) nuevos++;
  };

  for (const c of data.contactos || []) {
    const norm = c.tipo === 'Email' ? normalizarEmail(c.valor) : normalizarTelefono(c.valor);
    await agregar(c.tipo, c.valor, norm, c.area, 'web', c.fuente_url || data.base);
  }

  for (const [red, redUrl] of Object.entries(data.redes)) {
    await agregar('RedSocial', redUrl, String(redUrl).toLowerCase(), null, 'web', redUrl);

    try {
      const socialData = await scrapeSocial(redUrl);
      if (socialData) {
        for (const email of socialData.emails) {
          await agregar('Email', email, normalizarEmail(email), `Social (${red})`, 'social', redUrl);
        }
        for (const tel of socialData.telefonos) {
          await agregar('Telefono', tel, normalizarTelefono(tel), `Social (${red})`, 'social', redUrl);
        }
      }
    } catch (e) {
    }
  }

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

  let rucAplicado = null;
  if (data.ruc) {
    const pr = await executeQuery('SELECT documento FROM prospectos WHERE id_prospecto = ?', [idProspecto]);
    const sinDoc = pr.success && pr.data[0] && !pr.data[0].documento;
    if (sinDoc) {
      await executeQuery(
        "UPDATE prospectos SET documento = ?, tipo_documento = 'RUC', segmento = 'Formal' WHERE id_prospecto = ?",
        [data.ruc, idProspecto]
      );
      const cli = await executeQuery('SELECT id_cliente FROM clientes WHERE ruc = ? LIMIT 1', [data.ruc]);
      if (cli.success && cli.data.length > 0) {
        await executeQuery(
          "UPDATE prospectos SET flag_duplicado = 'Ya_cliente', id_cliente_match = ? WHERE id_prospecto = ?",
          [cli.data[0].id_cliente, idProspecto]
        );
      }
      rucAplicado = data.ruc;
    }
  }

  await executeQuery(
    'INSERT INTO prospecto_fuentes (id_prospecto, fuente, url, datos_raw, fecha_scraping) VALUES (?, "web", ?, ?, ?)',
    [idProspecto, data.base, JSON.stringify({ emails: data.emails, telefonos: data.telefonos, redes: data.redes }), getFechaPeru()]
  );
  const score = await recalcularScore(idProspecto, {}, { permitirBajar: !!opciones.permitirBajar });

  return {
    contactos_nuevos: nuevos,
    emails: data.emails.length,
    telefonos: data.telefonos.length,
    redes: Object.keys(data.redes).length,
    ruc: rucAplicado,
    score,
  };
}
