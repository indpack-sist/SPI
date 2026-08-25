import axios from 'axios';
import { executeQuery } from '../config/database.js';
import { validarRUC } from '../services/documento-cache.service.js';
import {
  crearProspectoDesdeDatos,
  buscarProspectoPorDocumento,
  normalizarDocumento,
  normalizarTelefono,
  normalizarEmail,
  recalcularScore,
} from '../services/prospectos.service.js';
import { buscarRucPorNombre } from '../services/ruc-lookup.service.js';
import { placesDisponible, RUBROS_OBJETIVO } from '../services/scraper-places.service.js';
import { notificarJob } from '../services/scraping-worker.js';

const ESTADOS_WORKFLOW = ['Nuevo', 'En_gestion', 'Contactado', 'Convertido', 'Descartado'];

// Hora actual de Perú (America/Lima) como 'YYYY-MM-DD HH:mm:ss'. Se inserta
// explícitamente porque el default CURRENT_TIMESTAMP de MySQL usa la zona del
// servidor (UTC), lo que dejaba el historial 5 horas adelantado.
function getFechaPeru() {
  const now = new Date();
  const peruDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const year = peruDate.getFullYear();
  const month = String(peruDate.getMonth() + 1).padStart(2, '0');
  const day = String(peruDate.getDate()).padStart(2, '0');
  const hours = String(peruDate.getHours()).padStart(2, '0');
  const minutes = String(peruDate.getMinutes()).padStart(2, '0');
  const seconds = String(peruDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const POR_PAGINA = 50; // tamaño de página del sistema (también unidad de "hoja" en el export)

// Avisa a todos los clientes que están viendo el módulo de Prospección que algo
// cambió, para que refresquen la lista (y el detalle abierto) sin recargar la
// página. Best-effort: si el socket no está, no pasa nada.
function emitirCambioProspecto(req, data = {}) {
  try {
    const io = req.app.get('socketio');
    io?.emit('prospectos:cambio', { ...data, ts: Date.now() });
  } catch { /* noop */ }
}

// Arma el WHERE + ORDER BY del listado a partir de los filtros de la query.
// Compartido entre el listado paginado y la exportación a Excel para que ambos
// devuelvan exactamente el mismo conjunto.
function construirFiltros(q = {}) {
  const { segmento, estado, flag, search, orden, vista, sector, busqueda, min_score } = q;
  let where = ' WHERE 1=1';
  const params = [];

  // Vista: por defecto oculta los excluidos; "excluidos" muestra solo esos.
  where += vista === 'excluidos' ? ' AND p.excluido = 1' : ' AND p.excluido = 0';

  if (segmento) { where += ' AND p.segmento = ?'; params.push(segmento); }
  if (estado)   { where += ' AND p.estado_workflow = ?'; params.push(estado); }
  if (flag)     { where += ' AND p.flag_duplicado = ?'; params.push(flag); }
  if (sector)   { where += ' AND p.sector = ?'; params.push(sector); }
  if (busqueda) { where += ' AND p.origen_query = ?'; params.push(busqueda); }
  // Filtro por potencial mínimo (score 0-100). Se ignora si no es un número.
  if (min_score !== undefined && min_score !== '' && !Number.isNaN(Number(min_score))) {
    where += ' AND p.score >= ?'; params.push(Number(min_score));
  }
  if (search) {
    where += ` AND (p.razon_social LIKE ? OR p.documento LIKE ? OR p.nombre_comercial LIKE ?
              OR p.distrito LIKE ? OR p.provincia LIKE ? OR p.departamento LIKE ? OR p.sector LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like, like);
  }

  let orderBy;
  if (orden === 'recientes') orderBy = ' ORDER BY p.fecha_captura DESC';
  else if (orden === 'nombre') orderBy = ' ORDER BY p.razon_social ASC';
  else orderBy = ' ORDER BY p.score DESC, p.fecha_captura DESC';

  return { where, params, orderBy };
}

// SELECT del listado (con contactos agregados), reutilizado por listado y export.
// El LIMIT/OFFSET se concatena aparte según el caso.
function sqlListado(where, orderBy, limitClause = '') {
  return `
    SELECT p.*,
      e.nombre_completo AS empleado_asignado,
      c.razon_social    AS cliente_match_nombre,
      (SELECT COUNT(*) FROM prospecto_contactos pc WHERE pc.id_prospecto = p.id_prospecto) AS total_contactos,
      (SELECT GROUP_CONCAT(pc.valor ORDER BY (pc.valor_normalizado LIKE '9%') DESC, pc.id_contacto SEPARATOR ' / ')
         FROM prospecto_contactos pc
         WHERE pc.id_prospecto = p.id_prospecto AND pc.tipo IN ('Telefono','Celular','Whatsapp')) AS telefonos,
      (SELECT GROUP_CONCAT(pc.valor SEPARATOR ' / ') FROM prospecto_contactos pc
         WHERE pc.id_prospecto = p.id_prospecto AND pc.tipo = 'Email') AS emails
    FROM prospectos p
    LEFT JOIN empleados e ON p.id_empleado_asignado = e.id_empleado
    LEFT JOIN clientes  c ON p.id_cliente_match      = c.id_cliente
    ${where}${orderBy}${limitClause}`;
}

// ------------------------------------------------------------
// Listado con filtros
// ------------------------------------------------------------
export async function getAllProspectos(req, res) {
  try {
    const { page, limit } = req.query;
    const { where, params, orderBy } = construirFiltros(req.query);

    // --- Paginación (máx. 50 por página; se ignora si los valores no son válidos) ---
    const pageNum = Math.max(1, parseInt(page) || 1);
    const perPage = Math.min(Math.max(1, parseInt(limit) || POR_PAGINA), POR_PAGINA);
    const offset = (pageNum - 1) * perPage;

    // Conteo total con los mismos filtros (para saber cuántas páginas hay).
    const countRes = await executeQuery(`SELECT COUNT(*) AS total FROM prospectos p${where}`, params);
    if (!countRes.success) return res.status(500).json({ error: countRes.error });
    const total = countRes.data[0].total;

    const result = await executeQuery(sqlListado(where, orderBy, ` LIMIT ${perPage} OFFSET ${offset}`), params);
    if (!result.success) return res.status(500).json({ error: result.error });

    res.json({
      success: true,
      data: result.data,
      total,
      page: pageNum,
      limit: perPage,
      total_paginas: Math.max(1, Math.ceil(total / perPage)),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Exportación a Excel (server-side). Genera el .xlsx en el backend y lo
// envía como descarga, así el diálogo de guardado aparece de inmediato y no
// hay que recorrer decenas de páginas desde el navegador.
//
// Alcance seleccionable con los mismos filtros del listado:
//   - Todo el conjunto filtrado (sin desde_pagina/hasta_pagina), o
//   - Un rango de "hojas" de 50 registros: desde_pagina..hasta_pagina.
// Tope duro de seguridad para no generar archivos gigantes de golpe.
// ------------------------------------------------------------
const EXPORT_MAX_FILAS = 50000;

export async function exportarProspectosExcel(req, res) {
  try {
    const { where, params, orderBy } = construirFiltros(req.query);

    // Total con filtros: sirve para acotar el rango y para el encabezado.
    const countRes = await executeQuery(`SELECT COUNT(*) AS total FROM prospectos p${where}`, params);
    if (!countRes.success) return res.status(500).json({ error: countRes.error });
    const total = countRes.data[0].total;

    // --- Alcance: rango de páginas (50/hoja) o todo ---
    let desdePag = parseInt(req.query.desde_pagina, 10);
    let hastaPag = parseInt(req.query.hasta_pagina, 10);
    const usaRango = Number.isFinite(desdePag) || Number.isFinite(hastaPag);

    let limitClause = '';
    let descripcion;
    if (usaRango) {
      const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
      // Normaliza el rango: valores por defecto y recorte a límites válidos.
      if (!Number.isFinite(desdePag)) desdePag = 1;
      if (!Number.isFinite(hastaPag)) hastaPag = totalPaginas;
      desdePag = Math.min(Math.max(1, desdePag), totalPaginas);
      hastaPag = Math.min(Math.max(desdePag, hastaPag), totalPaginas);

      const offset = (desdePag - 1) * POR_PAGINA;
      const cuenta = Math.min((hastaPag - desdePag + 1) * POR_PAGINA, EXPORT_MAX_FILAS);
      limitClause = ` LIMIT ${cuenta} OFFSET ${offset}`;
      descripcion = `Hojas ${desdePag} a ${hastaPag} (50 registros por hoja)`;
    } else {
      if (total > EXPORT_MAX_FILAS) {
        return res.status(413).json({
          error: `Hay ${total.toLocaleString('es-PE')} registros; el máximo por descarga es ${EXPORT_MAX_FILAS.toLocaleString('es-PE')}. Usa un rango de hojas o filtra más.`,
        });
      }
      limitClause = ` LIMIT ${EXPORT_MAX_FILAS}`;
      descripcion = 'Todos los prospectos del filtro actual';
    }

    const result = await executeQuery(sqlListado(where, orderBy, limitClause), params);
    if (!result.success) return res.status(500).json({ error: result.error });

    const { generarProspectosXLSX } = await import('../utils/excelGenerators/prospectosXLSX.js');
    const buffer = await generarProspectosXLSX({ filas: result.data, filtros: { descripcion } });

    const stamp = new Date().toISOString().slice(0, 10);
    const nombre = usaRango
      ? `prospectos-${stamp}-hojas-${desdePag}-${hastaPag}.xlsx`
      : `prospectos-${stamp}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error al exportar prospectos a Excel:', error);
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Estadísticas para las tarjetas del encabezado
// ------------------------------------------------------------
export async function getEstadisticas(req, res) {
  try {
    // El umbral de potencial (min_score) también recorta las tarjetas para
    // que coincidan con la tabla y el Excel. Se ignora si no es número.
    const { min_score } = req.query;
    const params = [];
    let filtroScore = '';
    if (min_score !== undefined && min_score !== '' && !Number.isNaN(Number(min_score))) {
      filtroScore = ' AND score >= ?'; params.push(Number(min_score));
    }
    const r = await executeQuery(`
      SELECT
        COUNT(*)                                                       AS total,
        SUM(estado_workflow = 'Nuevo')                                 AS nuevos,
        SUM(flag_duplicado = 'Ya_cliente')                             AS ya_clientes,
        SUM(flag_duplicado = 'Posible_duplicado')                      AS posibles_dup,
        SUM(estado_workflow = 'Convertido')                            AS convertidos,
        ROUND(AVG(CASE WHEN flag_duplicado = 'Ninguno' THEN score END)) AS score_promedio,
        SUM(score >= 75 AND flag_duplicado = 'Ninguno')                AS calientes
      FROM prospectos
      WHERE excluido = 0${filtroScore}
    `, params);
    if (!r.success) return res.status(500).json({ error: r.error });
    res.json({ success: true, data: r.data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Facetas para los filtros de la barra: sectores detectados y
// búsquedas (rubros de Google) que originaron los prospectos, con conteo.
// ------------------------------------------------------------
export async function getFacetas(req, res) {
  try {
    const [sectores, busquedas] = await Promise.all([
      executeQuery(`
        SELECT sector AS valor, COUNT(*) AS total
        FROM prospectos
        WHERE excluido = 0 AND sector IS NOT NULL AND sector <> ''
        GROUP BY sector ORDER BY total DESC, sector ASC`),
      executeQuery(`
        SELECT origen_query AS valor, COUNT(*) AS total
        FROM prospectos
        WHERE excluido = 0 AND origen_query IS NOT NULL AND origen_query <> ''
        GROUP BY origen_query ORDER BY total DESC, origen_query ASC`),
    ]);
    if (!sectores.success) return res.status(500).json({ error: sectores.error });
    if (!busquedas.success) return res.status(500).json({ error: busquedas.error });
    res.json({ success: true, data: { sectores: sectores.data, busquedas: busquedas.data } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Últimos barridos (Google Places) por zona: para avisar que una
// zona ya fue explorada y evitar que otro usuario la repita sin querer.
// ------------------------------------------------------------
export async function getBarridos(req, res) {
  try {
    const r = await executeQuery(`
      SELECT
        JSON_UNQUOTE(JSON_EXTRACT(j.parametros, '$.zona')) AS zona,
        MAX(j.fecha_creacion) AS ultima_fecha,
        COUNT(*) AS busquedas,
        SUBSTRING_INDEX(
          GROUP_CONCAT(COALESCE(e.nombre_completo, 'Sistema') ORDER BY j.fecha_creacion DESC SEPARATOR '|#|'),
          '|#|', 1) AS ultimo_usuario
      FROM scraping_jobs j
      LEFT JOIN empleados e ON j.id_empleado_solicita = e.id_empleado
      WHERE j.tipo = 'google_places'
        AND JSON_UNQUOTE(JSON_EXTRACT(j.parametros, '$.zona')) IS NOT NULL
      GROUP BY zona
      ORDER BY ultima_fecha DESC
      LIMIT 60`);
    if (!r.success) return res.status(500).json({ error: r.error });

    const data = r.data.map((row) => ({
      zona: row.zona,
      busquedas: row.busquedas,
      ultimo_usuario: row.ultimo_usuario,
      ultima_fecha: row.ultima_fecha,
    }));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Detalle con contactos y fuentes
// ------------------------------------------------------------
export async function getProspectoById(req, res) {
  try {
    const { id } = req.params;
    const r = await executeQuery(`
      SELECT p.*, e.nombre_completo AS empleado_asignado,
             g.nombre_completo AS gestor_nombre,
             c.razon_social AS cliente_match_nombre
      FROM prospectos p
      LEFT JOIN empleados e ON p.id_empleado_asignado = e.id_empleado
      LEFT JOIN empleados g ON p.id_gestor            = g.id_empleado
      LEFT JOIN clientes  c ON p.id_cliente_match      = c.id_cliente
      WHERE p.id_prospecto = ?`, [id]);

    if (!r.success) return res.status(500).json({ error: r.error });
    if (r.data.length === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });

    const prospecto = r.data[0];
    const contactos = await executeQuery(
      'SELECT * FROM prospecto_contactos WHERE id_prospecto = ? ORDER BY tipo, id_contacto', [id]);
    const fuentes = await executeQuery(
      'SELECT id_fuente, fuente, url, fecha_scraping FROM prospecto_fuentes WHERE id_prospecto = ? ORDER BY fecha_scraping DESC', [id]);
    const historial = await executeQuery(
      `SELECT h.id_historial, h.accion, h.valor_anterior, h.valor_nuevo,
              DATE_FORMAT(h.fecha, '%Y-%m-%d %H:%i') AS fecha,
              e.nombre_completo AS usuario
       FROM prospecto_historial h
       LEFT JOIN empleados e ON h.id_empleado = e.id_empleado
       WHERE h.id_prospecto = ? ORDER BY h.id_historial DESC`, [id]);

    prospecto.contactos = contactos.success ? contactos.data : [];
    prospecto.fuentes = fuentes.success ? fuentes.data : [];
    prospecto.historial = historial.success ? historial.data : [];

    res.json({ success: true, data: prospecto });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Crear prospecto manual
// ------------------------------------------------------------
export async function createProspecto(req, res) {
  try {
    const { razon_social } = req.body;
    if (!razon_social) return res.status(400).json({ error: 'La razón social / nombre es requerido' });

    const doc = normalizarDocumento(req.body.documento);
    if (doc) {
      const existente = await buscarProspectoPorDocumento(doc);
      if (existente) return res.status(400).json({ error: 'Ya existe un prospecto con ese documento', id_prospecto: existente });
    }

    const r = await crearProspectoDesdeDatos(req.body, req.user?.id_empleado);
    if (!r.success) return res.status(500).json({ error: r.error });
    emitirCambioProspecto(req, { accion: 'crear', id_prospecto: r.id_prospecto });
    res.status(201).json({ success: true, message: 'Prospecto creado', data: r });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Ingesta masiva de RUCs (enriquece con SUNAT en el momento)
// ------------------------------------------------------------
export async function ingestaLista(req, res) {
  try {
    const { texto, rucs, segmento } = req.body;

    // Acepta un array o un bloque de texto (uno por línea / separado por comas).
    let lista = Array.isArray(rucs) ? rucs : [];
    if (texto) lista = lista.concat(String(texto).split(/[\s,;]+/));
    lista = [...new Set(lista.map((x) => normalizarDocumento(x)).filter((x) => x.length === 11))];

    if (lista.length === 0) {
      return res.status(400).json({ error: 'No se encontraron RUCs válidos (11 dígitos) en la lista' });
    }
    if (lista.length > 50) {
      return res.status(400).json({ error: 'Máximo 50 RUCs por lote (la validación SUNAT es secuencial).' });
    }

    const resumen = { creados: 0, ya_prospecto: 0, ya_cliente: 0, errores: [] };
    const detalle = [];

    for (const ruc of lista) {
      try {
        const existente = await buscarProspectoPorDocumento(ruc);
        if (existente) { resumen.ya_prospecto++; detalle.push({ ruc, estado: 'ya_prospecto' }); continue; }

        const val = await validarRUC(ruc);
        const d = val.datos || {};

        const datos = {
          segmento: segmento || 'Formal',
          tipo_documento: 'RUC',
          documento: ruc,
          razon_social: d.razon_social || `RUC ${ruc}`,
          nombre_comercial: d.nombre_comercial || null,
          departamento: d.departamento || null,
          provincia: d.provincia || null,
          distrito: d.distrito || null,
          direccion: d.direccion || null,
          es_activo: d.es_activo,
          es_habido: d.es_habido,
          origen: 'sunat',
          url: `https://dniruc.apisperu.com/api/v1/ruc/${ruc}`,
          datos_raw: d,
        };

        const ins = await crearProspectoDesdeDatos(datos, req.user?.id_empleado);
        if (!ins.success) { resumen.errores.push({ ruc, error: ins.error }); continue; }
        if (ins.duplicado_prospecto) { resumen.ya_prospecto++; detalle.push({ ruc, estado: 'ya_prospecto' }); continue; }

        // Encolar enriquecimiento automático: buscará la web sola y traerá contactos reales
        await encolarJob('web_scrape', { id_prospecto: ins.id_prospecto }, req.user?.id_empleado);

        if (ins.flag === 'Ya_cliente') resumen.ya_cliente++;
        resumen.creados++;
        detalle.push({ ruc, estado: ins.flag === 'Ya_cliente' ? 'creado_ya_cliente' : 'creado', score: ins.score });
      } catch (e) {
        resumen.errores.push({ ruc, error: e.message });
      }
    }

    if (resumen.creados > 0) emitirCambioProspecto(req, { accion: 'ingesta', creados: resumen.creados });
    res.json({ success: true, message: `Ingesta terminada: ${resumen.creados} creados`, resumen, detalle });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Actualizar campos editables del prospecto
// ------------------------------------------------------------
export async function updateProspecto(req, res) {
  try {
    const { id } = req.params;
    const { razon_social, nombre_comercial, sector, segmento, direccion, web, notas } = req.body;

    const check = await executeQuery('SELECT id_prospecto FROM prospectos WHERE id_prospecto = ?', [id]);
    if (check.data.length === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });

    const r = await executeQuery(
      `UPDATE prospectos SET razon_social = COALESCE(?, razon_social),
        nombre_comercial = ?, sector = ?, segmento = COALESCE(?, segmento),
        direccion = ?, web = ?, notas = ?
       WHERE id_prospecto = ?`,
      [razon_social || null, nombre_comercial || null, sector || null, segmento || null,
       direccion || null, web || null, notas || null, id]
    );
    if (!r.success) return res.status(500).json({ error: r.error });
    emitirCambioProspecto(req, { accion: 'actualizar', id_prospecto: Number(id) });
    res.json({ success: true, message: 'Prospecto actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Historial de gestión y bloqueo por dueño
// ------------------------------------------------------------

// Registra una entrada en el historial del prospecto (quién, cuándo, qué).
async function registrarHistorial(idProspecto, idEmpleado, accion, anterior, nuevo) {
  await executeQuery(
    `INSERT INTO prospecto_historial (id_prospecto, id_empleado, accion, valor_anterior, valor_nuevo, fecha)
     VALUES (?,?,?,?,?,?)`,
    [idProspecto, idEmpleado || null, accion, anterior ?? null, nuevo ?? null, getFechaPeru()]
  );
}

// Devuelve el nombre del gestor si el prospecto está siendo gestionado por OTRO
// usuario (bloqueado para el actual); null si está libre o es del propio usuario.
// Usa id_gestor (se fija al gestionar), NO id_empleado_asignado (que marca quién
// lo descubrió/creó y no debe bloquear).
async function bloqueadoPorOtro(idProspecto, idEmpleado) {
  const r = await executeQuery(
    `SELECT p.id_gestor, e.nombre_completo
     FROM prospectos p LEFT JOIN empleados e ON p.id_gestor = e.id_empleado
     WHERE p.id_prospecto = ?`, [idProspecto]
  );
  const row = r.data?.[0];
  if (row && row.id_gestor && Number(row.id_gestor) !== Number(idEmpleado)) {
    return row.nombre_completo || 'otro usuario';
  }
  return null;
}

// ------------------------------------------------------------
// Cambiar estado del workflow comercial
// (reclama el prospecto para quien lo gestiona y bloquea a terceros)
// ------------------------------------------------------------
export async function cambiarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    if (!ESTADOS_WORKFLOW.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const yo = req.user?.id_empleado;
    const actual = await executeQuery(
      'SELECT estado_workflow, id_gestor FROM prospectos WHERE id_prospecto = ?', [id]);
    if (!actual.success || actual.data.length === 0) {
      return res.status(404).json({ error: 'Prospecto no encontrado' });
    }
    const prev = actual.data[0];

    // Bloqueo: si ya lo gestiona otro usuario, no se permite editar.
    const dueno = await bloqueadoPorOtro(id, yo);
    if (dueno) {
      return res.status(409).json({
        error: `Este prospecto está siendo gestionado por ${dueno}. Pídele que lo libere para poder editarlo.`,
        bloqueado: true,
      });
    }

    // Si nadie lo gestiona aún, lo reclama el usuario actual (queda bloqueado
    // para los demás desde este momento).
    let sql, params;
    if (!prev.id_gestor) {
      sql = 'UPDATE prospectos SET estado_workflow = ?, id_gestor = ?, fecha_gestion = ? WHERE id_prospecto = ?';
      params = [estado, yo || null, getFechaPeru(), id];
    } else {
      sql = 'UPDATE prospectos SET estado_workflow = ? WHERE id_prospecto = ?';
      params = [estado, id];
    }
    const r = await executeQuery(sql, params);
    if (!r.success) return res.status(500).json({ error: r.error });

    await registrarHistorial(id, yo, 'estado', prev.estado_workflow, estado);
    emitirCambioProspecto(req, { accion: 'estado', id_prospecto: Number(id) });
    res.json({ success: true, message: 'Estado actualizado', id_gestor: prev.id_gestor || yo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Liberar la gestión (quita el dueño) para que otro pueda tomarlo.
// Permitido al dueño actual o a un Administrador.
// ------------------------------------------------------------
export async function liberarProspecto(req, res) {
  try {
    const { id } = req.params;
    const yo = req.user?.id_empleado;
    const esAdmin = req.user?.rol === 'Administrador';

    const r = await executeQuery(
      'SELECT id_gestor FROM prospectos WHERE id_prospecto = ?', [id]);
    if (!r.success || r.data.length === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });

    const dueno = r.data[0].id_gestor;
    if (dueno && Number(dueno) !== Number(yo) && !esAdmin) {
      return res.status(403).json({ error: 'Solo el usuario que lo gestiona o un administrador pueden liberarlo.' });
    }

    const up = await executeQuery(
      'UPDATE prospectos SET id_gestor = NULL, fecha_gestion = NULL WHERE id_prospecto = ?', [id]);
    if (!up.success) return res.status(500).json({ error: up.error });

    await registrarHistorial(id, yo, 'liberar', null, null);
    emitirCambioProspecto(req, { accion: 'liberar', id_prospecto: Number(id) });
    res.json({ success: true, message: 'Prospecto liberado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Asignar a un empleado
// ------------------------------------------------------------
export async function asignarProspecto(req, res) {
  try {
    const { id } = req.params;
    const { id_empleado } = req.body;
    const r = await executeQuery(
      'UPDATE prospectos SET id_empleado_asignado = ? WHERE id_prospecto = ?',
      [id_empleado || null, id]
    );
    if (!r.success) return res.status(500).json({ error: r.error });
    emitirCambioProspecto(req, { accion: 'asignar', id_prospecto: Number(id) });
    res.json({ success: true, message: 'Prospecto asignado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Contactos
// ------------------------------------------------------------
export async function addContacto(req, res) {
  try {
    const { id } = req.params;
    const { tipo, valor, nombre_persona, cargo, area } = req.body;
    if (!tipo || !valor) return res.status(400).json({ error: 'Tipo y valor son requeridos' });

    const norm = tipo === 'Email' ? normalizarEmail(valor)
      : (tipo === 'Web' || tipo === 'RedSocial') ? String(valor).trim().toLowerCase()
      : normalizarTelefono(valor);

    const r = await executeQuery(
      `INSERT INTO prospecto_contactos (id_prospecto, tipo, valor, valor_normalizado, nombre_persona, cargo, area, fuente, verificado)
       VALUES (?,?,?,?,?,?,?,?,1)`,
      [id, tipo, valor, norm, nombre_persona || null, cargo || null, area || null, 'manual']
    );
    if (!r.success) return res.status(500).json({ error: r.error });
    emitirCambioProspecto(req, { accion: 'contacto', id_prospecto: Number(id) });
    res.status(201).json({ success: true, message: 'Contacto agregado', id_contacto: r.data.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteContacto(req, res) {
  try {
    const { id_contacto } = req.params;
    // Recupera a qué prospecto pertenece ANTES de borrarlo, para avisar en vivo.
    const dueno = await executeQuery('SELECT id_prospecto FROM prospecto_contactos WHERE id_contacto = ?', [id_contacto]);
    const idProspecto = dueno.success && dueno.data[0] ? dueno.data[0].id_prospecto : null;
    const r = await executeQuery('DELETE FROM prospecto_contactos WHERE id_contacto = ?', [id_contacto]);
    if (!r.success) return res.status(500).json({ error: r.error });
    emitirCambioProspecto(req, { accion: 'contacto', id_prospecto: idProspecto });
    res.json({ success: true, message: 'Contacto eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Convertir prospecto -> cliente (reusa la tabla clientes)
// ------------------------------------------------------------
export async function convertirACliente(req, res) {
  try {
    const { id } = req.params;
    const yo = req.user?.id_empleado;
    const r = await executeQuery('SELECT * FROM prospectos WHERE id_prospecto = ?', [id]);
    if (r.data.length === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });
    const p = r.data[0];

    const dueno = await bloqueadoPorOtro(id, yo);
    if (dueno) {
      return res.status(409).json({
        error: `Este prospecto está siendo gestionado por ${dueno}. Pídele que lo libere para poder convertirlo.`,
        bloqueado: true,
      });
    }

    if (p.estado_workflow === 'Convertido' && p.id_cliente_match) {
      return res.status(400).json({ error: 'Este prospecto ya fue convertido en cliente', id_cliente: p.id_cliente_match });
    }

    // El documento es obligatorio para crear cliente (RUC o DNI).
    const documento = normalizarDocumento(req.body.documento || p.documento);
    if (!documento) {
      return res.status(400).json({ error: 'Se requiere RUC o DNI para crear el cliente. Ingresa el documento del prospecto.' });
    }
    const tipo_documento = req.body.tipo_documento || p.tipo_documento || (documento.length === 8 ? 'DNI' : 'RUC');
    const razon_social = req.body.razon_social || p.razon_social;

    // Si ya existe un cliente con ese documento, lo enlazamos en vez de duplicar.
    const existe = await executeQuery('SELECT id_cliente FROM clientes WHERE ruc = ? LIMIT 1', [documento]);
    if (existe.data.length > 0) {
      const idCliente = existe.data[0].id_cliente;
      await executeQuery(
        "UPDATE prospectos SET estado_workflow = 'Convertido', flag_duplicado = 'Ya_cliente', id_cliente_match = ? WHERE id_prospecto = ?",
        [idCliente, id]
      );
      await registrarHistorial(id, yo, 'convertido', p.estado_workflow, 'Convertido');
      return res.json({ success: true, message: 'El prospecto ya existía como cliente; se enlazó.', data: { id_cliente: idCliente, ya_existia: true } });
    }

    // Toma el primer teléfono/email del prospecto si no vienen en el body.
    const contactos = await executeQuery('SELECT tipo, valor FROM prospecto_contactos WHERE id_prospecto = ?', [id]);
    const primer = (tipo) => contactos.data?.find((c) => c.tipo === tipo || (tipo === 'Telefono' && c.tipo === 'Celular'))?.valor || null;

    const telefono = req.body.telefono ?? primer('Telefono');
    const email = req.body.email ?? primer('Email');
    const contacto = req.body.contacto || p.nombre_comercial || null;
    const direccion = req.body.direccion_despacho || p.direccion || null;
    const condicion_pago = req.body.condicion_pago === 'Credito' ? 'Credito' : 'Contado';
    const dias_credito = condicion_pago === 'Credito' ? parseInt(req.body.dias_credito || 0) : 0;

    const ins = await executeQuery(
      `INSERT INTO clientes
        (ruc, tipo_documento, razon_social, contacto, telefono, email, direccion_despacho,
         limite_credito_pen, limite_credito_usd, usar_limite_credito, condicion_pago, dias_credito, estado)
       VALUES (?,?,?,?,?,?,?,0,0,0,?,?,'Activo')`,
      [documento, tipo_documento, razon_social, contacto, telefono, email, direccion, condicion_pago, dias_credito]
    );
    if (!ins.success) return res.status(500).json({ error: ins.error });
    const idCliente = ins.data.insertId;

    if (direccion) {
      await executeQuery(
        'INSERT INTO clientes_direcciones (id_cliente, direccion, es_principal) VALUES (?, ?, 1)',
        [idCliente, direccion]
      );
    }

    // Auto-asignación al comercial que convierte (mismo criterio que clientes).
    const idRegistrador = req.user?.id_empleado;
    if (idRegistrador && ['Comercial', 'Ventas'].includes(req.user?.rol)) {
      await executeQuery(
        'INSERT IGNORE INTO empleado_clientes_asignados (id_empleado, id_cliente, asignado_por) VALUES (?, ?, ?)',
        [idRegistrador, idCliente, idRegistrador]
      );
    }

    await executeQuery(
      "UPDATE prospectos SET estado_workflow = 'Convertido', flag_duplicado = 'Ya_cliente', id_cliente_match = ? WHERE id_prospecto = ?",
      [idCliente, id]
    );
    await registrarHistorial(id, yo, 'convertido', p.estado_workflow, 'Convertido');

    emitirCambioProspecto(req, { accion: 'convertir', id_prospecto: Number(id) });
    res.status(201).json({ success: true, message: 'Cliente creado desde el prospecto', data: { id_cliente: idCliente, razon_social } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// Cola de scraping (jobs asíncronos)
// ============================================================
const TIPOS_JOB = ['google_places', 'web_scrape', 'sunat_ruc', 'sunat_ciiu', 'enriquecer'];

async function encolarJob(tipo, parametros, idEmpleado, prioridad = 5) {
  const ins = await executeQuery(
    'INSERT INTO scraping_jobs (tipo, parametros, id_empleado_solicita, prioridad) VALUES (?,?,?,?)',
    [tipo, JSON.stringify(parametros || {}), idEmpleado || null, prioridad]
  );
  if (!ins.success) throw new Error(ins.error);
  const idJob = ins.data.insertId;
  notificarJob(); // despierta al worker
  return idJob;
}

function parseZonas(zonas) {
  let lista = Array.isArray(zonas) ? zonas : String(zonas || '').split(/[\n;]+/);
  lista = lista.map((z) => z.trim()).filter(Boolean);
  return lista.length ? lista : ['Perú'];
}

// Crea un job genérico
export async function crearJob(req, res) {
  try {
    const { tipo, parametros } = req.body;
    if (!TIPOS_JOB.includes(tipo)) return res.status(400).json({ error: 'Tipo de job inválido' });
    const idJob = await encolarJob(tipo, parametros, req.user?.id_empleado);
    res.status(201).json({ success: true, message: 'Trabajo encolado', id_job: idJob });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Lista los jobs recientes (para el panel de actividad)
export async function listarJobs(req, res) {
  try {
    const r = await executeQuery(`
      SELECT id_job, tipo, parametros, estado, resultado, error, intentos,
             DATE_FORMAT(fecha_creacion, '%Y-%m-%d %H:%i:%s') AS fecha_creacion,
             DATE_FORMAT(fecha_fin, '%Y-%m-%d %H:%i:%s') AS fecha_fin
      FROM scraping_jobs ORDER BY id_job DESC LIMIT 25`);
    if (!r.success) return res.status(500).json({ error: r.error });
    res.json({ success: true, data: r.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Descubrimiento por rubro + zona vía Google Places
export async function descubrirEmpresas(req, res) {
  try {
    if (!placesDisponible()) {
      return res.status(400).json({
        error: 'Google Places no está configurado. Define GOOGLE_PLACES_API_KEY en el .env del backend para activar el descubrimiento.',
        requiere_key: true,
      });
    }
    const { query, zona, segmento, limite } = req.body;
    if (!query) return res.status(400).json({ error: 'Indica un rubro o término de búsqueda (ej. "distribuidora de alimentos")' });

    const idJob = await encolarJob('google_places', {
      query,
      zona: zona || 'Perú',
      segmento: segmento || 'Pequeno',
      limite: Math.min(parseInt(limite || 20), 40),
    }, req.user?.id_empleado);

    res.status(201).json({ success: true, message: 'Búsqueda encolada', id_job: idJob });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Descubrimiento MASIVO: barre todos los rubros objetivo en las zonas dadas,
// priorizando por afinidad (los mejores clientes potenciales primero).
export async function descubrirTodo(req, res) {
  try {
    if (!placesDisponible()) {
      return res.status(400).json({
        error: 'Google Places no está configurado. Define GOOGLE_PLACES_API_KEY en el .env del backend.',
        requiere_key: true,
      });
    }
    const { zonas, segmento, limite } = req.body;
    const listaZonas = parseZonas(zonas);
    const lim = Math.min(parseInt(limite || 15), 20);

    let encolados = 0;
    for (const rubro of RUBROS_OBJETIVO) {
      for (const zona of listaZonas) {
        await encolarJob('google_places', {
          query: rubro.q, zona, segmento: segmento || 'Formal', limite: lim,
        }, req.user?.id_empleado, rubro.prioridad);
        encolados++;
      }
    }

    res.status(201).json({
      success: true,
      message: `${encolados} búsquedas encoladas (${RUBROS_OBJETIVO.length} rubros × ${listaZonas.length} zona(s)), priorizadas por afinidad`,
      jobs: encolados,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Buscar el RUC de un prospecto por su nombre en ruc.pe (BAJO DEMANDA, gratis,
// sin APISPeru). Se aplica solo si el nombre de la ficha calza con el prospecto.
export async function buscarRucProspecto(req, res) {
  try {
    const { id } = req.params;
    const r = await executeQuery(
      'SELECT id_prospecto, razon_social, documento FROM prospectos WHERE id_prospecto = ?', [id]);
    if (!r.success || r.data.length === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });
    const p = r.data[0];
    if (p.documento) return res.json({ success: true, found: true, ya_tenia: true, ruc: p.documento });

    const hit = await buscarRucPorNombre(p.razon_social);
    if (!hit) {
      return res.json({ success: true, found: false, message: 'No se encontró en ruc.pe un RUC que coincida con el nombre.' });
    }

    const d = hit.datos || {};
    await executeQuery(
      `UPDATE prospectos SET documento = ?, tipo_documento = 'RUC', segmento = 'Formal',
         razon_social = COALESCE(NULLIF(?, ''), razon_social) WHERE id_prospecto = ?`,
      [hit.ruc, d.razon_social || null, id]
    );

    // ¿Ese RUC ya es cliente?
    let ya_cliente = false;
    const cli = await executeQuery('SELECT id_cliente FROM clientes WHERE ruc = ? LIMIT 1', [hit.ruc]);
    if (cli.success && cli.data.length > 0) {
      await executeQuery(
        "UPDATE prospectos SET flag_duplicado = 'Ya_cliente', id_cliente_match = ? WHERE id_prospecto = ?",
        [cli.data[0].id_cliente, id]
      );
      ya_cliente = true;
    }

    // Recalcula con la vigencia leída de la ficha (activo/habido) → puede subir a caliente.
    const score = await recalcularScore(id, { es_activo: d.es_activo, es_habido: d.es_habido });

    emitirCambioProspecto(req, { accion: 'buscar_ruc', id_prospecto: Number(id) });
    res.json({
      success: true, found: true, ruc: hit.ruc, razon_social: d.razon_social,
      es_activo: d.es_activo, es_habido: d.es_habido, sim: hit.sim, ya_cliente, score,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Enriquecer un prospecto scrapeando su web
export async function enriquecerProspecto(req, res) {
  try {
    const { id } = req.params;
    const url = req.body.web;
    const r = await executeQuery('SELECT web FROM prospectos WHERE id_prospecto = ?', [id]);
    if (r.data.length === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });

    const web = url || r.data[0].web;
    // Quitamos el check de if (!web) porque ahora el worker sabe descubrirla
    const idJob = await encolarJob('web_scrape', { id_prospecto: parseInt(id), url: web || null }, req.user?.id_empleado);
    res.status(201).json({ success: true, message: 'Enriquecimiento encolado', id_job: idJob });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Enriquecimiento MASIVO: encola un job de enriquecimiento por cada prospecto
// que cumpla el filtro. NO borra ni pisa nada (el worker solo AGREGA contactos
// e info faltante). Pensado para poblar de contactos una base ya descubierta.
//
// El worker resuelve la web en orden barato→caro: web ya guardada (gratis) →
// descubrimiento por Places (cuota). Por eso conviene saber cuántos NO tienen
// web antes de correrlo con `solo_con_web=false` (ahí está el costo de Places).
//
// Filtros (body): solo_con_web, solo_sin_contacto (default true), min_score, limite.
// ------------------------------------------------------------
export async function enriquecerMasivo(req, res) {
  try {
    const { solo_con_web, solo_sin_contacto = true, min_score, limite } = req.body || {};
    const params = [];
    let where = " WHERE p.excluido = 0 AND p.estado_workflow <> 'Descartado'";

    if (solo_con_web) where += " AND p.web IS NOT NULL AND p.web <> ''";

    // Salta los que ya tienen algún teléfono/correo (ahorra trabajo del worker).
    if (solo_sin_contacto) {
      where += ` AND NOT EXISTS (SELECT 1 FROM prospecto_contactos pc
        WHERE pc.id_prospecto = p.id_prospecto
          AND pc.tipo IN ('Email','Telefono','Celular','Whatsapp'))`;
    }

    if (min_score !== undefined && min_score !== '' && !Number.isNaN(Number(min_score))) {
      where += ' AND p.score >= ?'; params.push(Number(min_score));
    }

    // Idempotencia: no re-encolar prospectos que ya tienen un enriquecimiento
    // pendiente o en curso (evita duplicar la cola si se dispara dos veces).
    where += ` AND NOT EXISTS (SELECT 1 FROM scraping_jobs j
      WHERE j.tipo = 'web_scrape' AND j.estado IN ('pendiente','procesando')
        AND CAST(JSON_EXTRACT(j.parametros, '$.id_prospecto') AS UNSIGNED) = p.id_prospecto)`;

    // Cuántos candidatos entran (para el aviso de respuesta).
    const cnt = await executeQuery(`SELECT COUNT(*) AS n FROM prospectos p${where}`, params);
    if (!cnt.success) return res.status(500).json({ error: cnt.error });
    const candidatos = cnt.data[0].n;
    if (candidatos === 0) {
      return res.json({ success: true, encolados: 0, candidatos: 0, message: 'No hay prospectos por enriquecer con esos filtros.' });
    }

    // Un solo INSERT...SELECT: encola un job por prospecto aunque sean miles.
    // Prioridad 8 (baja): los descubrimientos activos siguen yendo primero.
    // Mayor score primero, para que los mejores leads se enriquezcan antes.
    const limClause = (limite && Number(limite) > 0) ? ` LIMIT ${Math.floor(Number(limite))}` : '';
    const ins = await executeQuery(
      `INSERT INTO scraping_jobs (tipo, parametros, id_empleado_solicita, prioridad)
       SELECT 'web_scrape', JSON_OBJECT('id_prospecto', p.id_prospecto), ?, 8
       FROM prospectos p${where}
       ORDER BY p.score DESC, p.id_prospecto ASC${limClause}`,
      [req.user?.id_empleado || null, ...params]
    );
    if (!ins.success) return res.status(500).json({ error: ins.error });

    notificarJob(); // despierta al worker para que empiece de inmediato
    const encolados = ins.data.affectedRows ?? candidatos;
    res.status(201).json({
      success: true,
      encolados,
      candidatos,
      message: `Se encolaron ${encolados} enriquecimientos. Se irán procesando en segundo plano; míralos en Actividad.`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Excluir / restaurar (lista de exclusión)
// ------------------------------------------------------------
export async function excluirProspecto(req, res) {
  try {
    const { id } = req.params;
    const excluido = req.body.excluido ? 1 : 0;
    const r = await executeQuery('UPDATE prospectos SET excluido = ? WHERE id_prospecto = ?', [excluido, id]);
    if (!r.success) return res.status(500).json({ error: r.error });
    emitirCambioProspecto(req, { accion: 'excluir', id_prospecto: Number(id) });
    res.json({ success: true, message: excluido ? 'Prospecto excluido' : 'Exclusión cancelada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Proxy de foto de Google Places (mantiene la API key en el backend)
// ------------------------------------------------------------
export async function fotoProxy(req, res) {
  try {
    const ref = req.query.ref;
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!ref || !key) return res.status(404).end();

    const img = await axios.get('https://maps.googleapis.com/maps/api/place/photo', {
      params: { maxwidth: 480, photo_reference: ref, key },
      responseType: 'arraybuffer',
      timeout: 12000,
    });
    res.set('Content-Type', img.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(img.data));
  } catch {
    res.status(404).end();
  }
}

// ------------------------------------------------------------
// Descartar / eliminar
// ------------------------------------------------------------
export async function descartarProspecto(req, res) {
  try {
    const { id } = req.params;
    const yo = req.user?.id_empleado;

    const dueno = await bloqueadoPorOtro(id, yo);
    if (dueno) {
      return res.status(409).json({
        error: `Este prospecto está siendo gestionado por ${dueno}. Pídele que lo libere para poder editarlo.`,
        bloqueado: true,
      });
    }

    const r = await executeQuery("UPDATE prospectos SET estado_workflow = 'Descartado' WHERE id_prospecto = ?", [id]);
    if (!r.success) return res.status(500).json({ error: r.error });
    await registrarHistorial(id, yo, 'estado', null, 'Descartado');
    emitirCambioProspecto(req, { accion: 'descartar', id_prospecto: Number(id) });
    res.json({ success: true, message: 'Prospecto descartado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteProspecto(req, res) {
  try {
    const { id } = req.params;
    const r = await executeQuery('DELETE FROM prospectos WHERE id_prospecto = ?', [id]);
    if (!r.success) return res.status(500).json({ error: r.error });
    emitirCambioProspecto(req, { accion: 'eliminar', id_prospecto: Number(id) });
    res.json({ success: true, message: 'Prospecto eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
