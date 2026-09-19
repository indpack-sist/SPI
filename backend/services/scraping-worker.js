import { executeQuery } from '../config/database.js';
import {
  crearProspectoDesdeDatos,
  recalcularScore,
  normalizarTelefono,
  normalizarEmail,
  normalizarDocumento,
  getFechaPeru,
} from './prospectos.service.js';
import { scrapeWebsite } from './scraper-web.service.js';
import { buscarRucPorNombre } from './ruc-lookup.service.js';
import { descubrirWeb } from './descubrir-web.service.js';
import { scrapeSocial } from './scraper-social.service.js';

// ============================================================
// Worker en proceso para la cola scraping_jobs. Corre dentro del
// mismo servidor (I/O asíncrono, no bloquea): sondea la cola, procesa
// un job a la vez y emite progreso por socket.io. Diseñado para la
// escala de INDPACK; no requiere Redis ni un proceso aparte.
// ============================================================

let socketIo = null;
let procesando = false;
let intervalo = null;

// Cuántos jobs se procesan EN PARALELO. Cada job es casi todo I/O de red
// (fetch de dominios candidatos, web y redes) que NO está limitado por el
// throttle de búsqueda —ese sigue siendo un candado global anti-baneo—, así
// que solapar varios multiplica el throughput sin golpear más por segundo a
// los buscadores ni perder precisión. La toma de jobs ya es atómica
// (tomarSiguienteJob reclama con UPDATE optimista), así que varios obreros
// compiten por la cola sin pisarse. Ajustable por entorno.
const CONCURRENCIA = Math.max(1, Number(process.env.PROSPECTOS_WORKER_CONCURRENCIA) || 8);

// Tras cuántos intentos un job que se cuelga deja de reintentarse y se cierra como
// error (evita que un job "veneno" reviva para siempre y clave la barra de progreso).
const MAX_INTENTOS = Math.max(1, Number(process.env.PROSPECTOS_WORKER_MAX_INTENTOS) || 3);
// Un job en 'procesando' más viejo que esto se considera colgado (fetch trabado) y
// se recupera en caliente. En el arranque no se aplica el tiempo: TODO 'procesando'
// es huérfano porque el worker es único y aún no tomó nada.
const STALE_MIN = Math.max(1, Number(process.env.PROSPECTOS_WORKER_STALE_MIN) || 15);

let ultimoStaleCheck = 0; // epoch ms del último barrido de huérfanos en caliente

/** Arranca el worker. Se llama desde server.js con la instancia de socket.io. */
export function startWorker(io) {
  socketIo = io;
  if (intervalo) clearInterval(intervalo);
  intervalo = setInterval(tick, 5000);
  // Recupera jobs que quedaron en 'procesando' de una corrida anterior (deploy /
  // reinicio a mitad de proceso). Son huérfanos: el worker que los tomó ya no
  // existe. Se rescatan ANTES de la primera pasada para que se re-procesen y no
  // dejen la barra de progreso pegada al 100 % con "N en curso" fantasma.
  recuperarHuerfanos({ soloArranque: true })
    .catch((e) => console.error('Error recuperando jobs huérfanos:', e.message))
    .finally(() => tick());
  console.log('🛰️  Worker de prospección iniciado (cola scraping_jobs)');
}

// Rescata jobs atascados en 'procesando'. Los que aún tienen intentos disponibles
// vuelven a 'pendiente' (se re-procesan); los que agotaron el cupo se cierran como
// 'error' para que el lote deje de contarse como activo. En el arranque se rescata
// todo lo 'procesando'; en caliente solo lo que lleva demasiado tiempo colgado.
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
    // Red de seguridad: cada ~2 min rescata jobs colgados en 'procesando' (fetch
    // trabado sin que el proceso se haya reiniciado). Barato: casi siempre 0 filas.
    if (Date.now() - ultimoStaleCheck > 120000) {
      ultimoStaleCheck = Date.now();
      await recuperarHuerfanos({ soloArranque: false }).catch(() => {});
    }
    // Lanza CONCURRENCIA obreros que compiten por la cola en paralelo. Cada uno
    // drena jobs mientras haya; el claim atómico evita que dos tomen el mismo.
    await Promise.all(Array.from({ length: CONCURRENCIA }, () => obrero()));
  } catch (e) {
    console.error('Error en worker de prospección:', e.message);
  } finally {
    procesando = false;
  }
}

// Un obrero: toma y procesa jobs pendientes en cascada hasta que la cola se
// vacía. Un fallo de un job no debe tumbar al obrero (ni al resto): se aísla.
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
    if (job.tipo === 'web_scrape' || job.tipo === 'enriquecer') {
      await procesarWebScrape(job, params);
    } else {
      // 'google_places' quedó fuera de servicio (se eliminó la dependencia).
      await fallar(job.id_job, `Tipo de job no soportado por el worker: ${job.tipo}`);
    }
  } catch (e) {
    await fallar(job.id_job, e.message);
  }
}

// ---- Enriquecimiento por scraping de web corporativa (job manual) ----
async function procesarWebScrape(job, params) {
  const idProspecto = params.id_prospecto;
  if (!idProspecto) return fallar(job.id_job, 'Falta id_prospecto');

  // Re-descubrir: purga TODO lo recolectado automáticamente (web, teléfonos,
  // correos y redes), CONSERVA lo ingresado a mano, y olvida la web guardada
  // para forzar una búsqueda NUEVA (no desde caché). Sirve para corregir un
  // prospecto al que se le pegaron datos de OTRA empresa por una web mal
  // atribuida: se vuelve a verificar todo desde cero con matching estricto.
  const redescubrir = !!params.redescubrir;
  if (redescubrir) {
    await executeQuery(
      "DELETE FROM prospecto_contactos WHERE id_prospecto = ? AND (fuente IS NULL OR fuente <> 'manual')",
      [idProspecto]
    );
    await executeQuery('UPDATE prospectos SET web = NULL, logo_url = NULL WHERE id_prospecto = ?', [idProspecto]);
  }

  let url = redescubrir ? null : params.url;
  let webVerificada = false; // el descubridor ya confirmó que la web es del prospecto

  // Si no vino URL en el job, resolvemos en este orden:
  //   1) la web que el prospecto YA tiene guardada  → se raspa directo.
  //   2) descubrimiento anclado en el RUC (buscadores gratis + candado de RUC
  //      en la página). Ya NO se usa Google Places.
  // En re-descubrir la web quedó en NULL arriba, así que siempre cae en la
  // búsqueda nueva (nunca reutiliza la web guardada).
  if (!url) {
    const pr = await executeQuery('SELECT razon_social, documento, distrito, provincia, web FROM prospectos WHERE id_prospecto = ?', [idProspecto]);
    const p = pr.data?.[0];
    let documento = p?.documento || null;

    // Recuperación de RUC faltante (clave para los leads viejos "sin RUC"): al
    // re-descubrir, si el prospecto no tiene documento, se busca por nombre en
    // ruc.pe (gratis, con triple candado de similitud/checksum). Opt-out con
    // buscar_ruc:false. Si aparece, se aplica y el descubrimiento de web queda
    // anclado a ese RUC. NO altera estado/gestor/historial.
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
      // Descubrimiento anclado en RUC ya viene verificado (RUC en la página o
      // dominio == nombre): no hace falta re-verificar al raspar.
      webVerificada = !!disc;
    }
  }

  // Sin web no se puede raspar contacto.
  if (!url) {
    // En re-descubrir es un desenlace VÁLIDO: se purgó lo dudoso y no hay web
    // que corresponda al nombre → el prospecto queda limpio (solo datos SUNAT).
    if (redescubrir) {
      const score = await recalcularScore(idProspecto, {}, { permitirBajar: true });
      emit('prospectos:cambio', { accion: 'enriquecer', id_prospecto: Number(idProspecto), ts: Date.now() });
      return completar(job.id_job, { id_prospecto: idProspecto, redescubierto: true, web_no_encontrada: true, purgado: true, score });
    }
    return fallar(job.id_job, 'No se encontró una web que publique el RUC del prospecto (búsqueda por RUC en buscadores gratis).');
  }

  // Verificación de correspondencia de la web: activa por defecto. Se omite si
  // el job la desactiva (web escrita a mano por el usuario) o si el descubridor
  // ya la verificó por RUC (evita una segunda lectura innecesaria).
  const verificar = params.verificar !== false && !webVerificada;
  const resultado = await enriquecerDesdeWeb(idProspecto, url, { permitirBajar: redescubrir, verificar });
  if (!resultado) return fallar(job.id_job, 'No se pudo leer el sitio web');
  emit('prospectos:cambio', { accion: 'enriquecer', id_prospecto: Number(idProspecto), ts: Date.now() });
  await completar(job.id_job, { id_prospecto: idProspecto, redescubierto: redescubrir, ...resultado });
}

// ============================================================
// Verificación de que una web descubierta CORRESPONDE al prospecto.
// Evita pegar la web (y sus contactos) de OTRA empresa co-ubicada que Google
// Places o DuckDuckGo devolvieron por un dato cruzado (mismo edificio, el
// "website" del place apunta a otra firma, etc.).
// ============================================================
function normalizarTextoNombre(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
// Palabras genéricas/geográficas que NO distinguen una empresa de otra.
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
/**
 * ¿La web scrapeada corresponde al prospecto? Criterio ESTRICTO (cero falsos
 * positivos):
 *  - Si el prospecto tiene RUC → la web debe publicar ESE RUC exacto en alguna
 *    de sus páginas (rucsWeb). Es la única prueba que se acepta cuando hay RUC:
 *    que el sitio muestre otros RUCs, o ninguno, NO basta → se rechaza. Así una
 *    web ajena (co-ubicada, directorio, dato cruzado) nunca contamina el lead.
 *  - Si el prospecto NO tiene RUC → se acepta solo si el token DISTINTIVO del
 *    nombre ES el dominio (ej. "anguard" ↔ anguardperu.com). El match por título
 *    se eliminó a propósito: era el que dejaba pasar directorios.
 * @returns {{ok:boolean, motivo:string}}
 */
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
  // El token distintivo debe SER el dominio (contenido y de largo parecido),
  // no solo aparecer suelto en el título.
  const distintivo = toks.find((t) => t.length >= 4 && host.includes(t) && host.length <= t.length + 12);
  return distintivo ? { ok: true, motivo: 'dominio_es_nombre' } : { ok: false, motivo: 'sin_relacion_con_nombre' };
}

/**
 * Lee la web de un prospecto y vuelca lo público: correos y teléfonos (con el
 * área a la que pertenecen), redes, logo y RUC. Reutilizado por el job manual
 * "Enriquecer" y por el descubrimiento (para traer el RUC sin pasos extra).
 * @returns {Promise<Object|null>} resumen o null si no se pudo leer la web.
 */
async function enriquecerDesdeWeb(idProspecto, url, opciones = {}) {
  const data = await scrapeWebsite(url);
  if (!data.ok) return null;

  // Verifica que la web sea realmente del prospecto (salvo que se pida omitir,
  // p.ej. web escrita a mano por el usuario). Si NO corresponde, no se pega
  // nada: ni contactos, ni web, ni logo. Así no se repite la contaminación de
  // una web ajena (mismo edificio / place con website cruzado).
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
  // fuenteUrl = URL EXACTA de donde salió el dato (página o perfil), para que la
  // ficha permita verificar la veracidad de cada contacto.
  const agregar = async (tipo, valor, norm, area, fuente = 'web', fuenteUrl = null) => {
    const r = await executeQuery(
      `INSERT IGNORE INTO prospecto_contactos (id_prospecto, tipo, valor, valor_normalizado, area, fuente, fuente_url)
       VALUES (?,?,?,?,?,?,?)`,
      [idProspecto, tipo, valor, norm, area || null, fuente, fuenteUrl]
    );
    if (r.success && r.data.affectedRows > 0) nuevos++;
  };

  // Contactos con área y URL de origen (correos primero, ya vienen priorizados).
  for (const c of data.contactos || []) {
    const norm = c.tipo === 'Email' ? normalizarEmail(c.valor) : normalizarTelefono(c.valor);
    await agregar(c.tipo, c.valor, norm, c.area, 'web', c.fuente_url || data.base);
  }

  // Redes sociales: el perfil ES su propia fuente; las guardamos como contacto
  // y TAMBIÉN intentamos rasparlas (su URL es la fuente de lo que devuelvan).
  for (const [red, redUrl] of Object.entries(data.redes)) {
    await agregar('RedSocial', redUrl, String(redUrl).toLowerCase(), null, 'web', redUrl);

    // Raspar la red social (best-effort, aislado)
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
      // Si falla una red, el proceso sigue
    }
  }

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

  // RUC del pie de la web: si el prospecto no tenía documento, lo aplica tal
  // cual y detecta si ya es cliente. SIN APISPeru y SIN tocar ruc.pe. La
  // búsqueda de RUC por NOMBRE se hace BAJO DEMANDA con el botón "Buscar RUC"
  // (no en el barrido, para no depender de ruc.pe ni arriesgar baneo de IP).
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

  // Trazabilidad + recálculo de score con lo nuevo.
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
