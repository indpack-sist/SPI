import { executeQuery } from '../config/database.js';
import { validarRUC } from '../services/documento-cache.service.js';
import {
  crearProspectoDesdeDatos,
  buscarProspectoPorDocumento,
  normalizarDocumento,
  normalizarTelefono,
  normalizarEmail,
} from '../services/prospectos.service.js';
import { placesDisponible } from '../services/scraper-places.service.js';
import { notificarJob } from '../services/scraping-worker.js';

const ESTADOS_WORKFLOW = ['Nuevo', 'En_gestion', 'Contactado', 'Convertido', 'Descartado'];

// ------------------------------------------------------------
// Listado con filtros
// ------------------------------------------------------------
export async function getAllProspectos(req, res) {
  try {
    const { segmento, estado, flag, search, orden } = req.query;

    let sql = `
      SELECT p.*,
        e.nombre_completo AS empleado_asignado,
        c.razon_social    AS cliente_match_nombre,
        (SELECT COUNT(*) FROM prospecto_contactos pc WHERE pc.id_prospecto = p.id_prospecto) AS total_contactos,
        (SELECT GROUP_CONCAT(pc.valor SEPARATOR ' / ') FROM prospecto_contactos pc
           WHERE pc.id_prospecto = p.id_prospecto AND pc.tipo IN ('Telefono','Celular','Whatsapp')) AS telefonos,
        (SELECT GROUP_CONCAT(pc.valor SEPARATOR ' / ') FROM prospecto_contactos pc
           WHERE pc.id_prospecto = p.id_prospecto AND pc.tipo = 'Email') AS emails
      FROM prospectos p
      LEFT JOIN empleados e ON p.id_empleado_asignado = e.id_empleado
      LEFT JOIN clientes  c ON p.id_cliente_match      = c.id_cliente
      WHERE 1=1`;
    const params = [];

    if (segmento) { sql += ' AND p.segmento = ?'; params.push(segmento); }
    if (estado)   { sql += ' AND p.estado_workflow = ?'; params.push(estado); }
    if (flag)     { sql += ' AND p.flag_duplicado = ?'; params.push(flag); }
    if (search) {
      sql += ' AND (p.razon_social LIKE ? OR p.documento LIKE ? OR p.nombre_comercial LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (orden === 'recientes') sql += ' ORDER BY p.fecha_captura DESC';
    else if (orden === 'nombre') sql += ' ORDER BY p.razon_social ASC';
    else sql += ' ORDER BY p.score DESC, p.fecha_captura DESC';

    const result = await executeQuery(sql, params);
    if (!result.success) return res.status(500).json({ error: result.error });

    res.json({ success: true, data: result.data, total: result.data.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Estadísticas para las tarjetas del encabezado
// ------------------------------------------------------------
export async function getEstadisticas(req, res) {
  try {
    const r = await executeQuery(`
      SELECT
        COUNT(*)                                                       AS total,
        SUM(estado_workflow = 'Nuevo')                                 AS nuevos,
        SUM(flag_duplicado = 'Ya_cliente')                             AS ya_clientes,
        SUM(flag_duplicado = 'Posible_duplicado')                      AS posibles_dup,
        SUM(estado_workflow = 'Convertido')                            AS convertidos,
        ROUND(AVG(CASE WHEN flag_duplicado = 'Ninguno' THEN score END)) AS score_promedio,
        SUM(score >= 70 AND flag_duplicado = 'Ninguno')                AS calientes
      FROM prospectos
    `);
    if (!r.success) return res.status(500).json({ error: r.error });
    res.json({ success: true, data: r.data[0] });
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
      SELECT p.*, e.nombre_completo AS empleado_asignado, c.razon_social AS cliente_match_nombre
      FROM prospectos p
      LEFT JOIN empleados e ON p.id_empleado_asignado = e.id_empleado
      LEFT JOIN clientes  c ON p.id_cliente_match      = c.id_cliente
      WHERE p.id_prospecto = ?`, [id]);

    if (!r.success) return res.status(500).json({ error: r.error });
    if (r.data.length === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });

    const prospecto = r.data[0];
    const contactos = await executeQuery(
      'SELECT * FROM prospecto_contactos WHERE id_prospecto = ? ORDER BY tipo, id_contacto', [id]);
    const fuentes = await executeQuery(
      'SELECT id_fuente, fuente, url, fecha_scraping FROM prospecto_fuentes WHERE id_prospecto = ? ORDER BY fecha_scraping DESC', [id]);

    prospecto.contactos = contactos.success ? contactos.data : [];
    prospecto.fuentes = fuentes.success ? fuentes.data : [];

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

        if (ins.flag === 'Ya_cliente') resumen.ya_cliente++;
        resumen.creados++;
        detalle.push({ ruc, estado: ins.flag === 'Ya_cliente' ? 'creado_ya_cliente' : 'creado', score: ins.score });
      } catch (e) {
        resumen.errores.push({ ruc, error: e.message });
      }
    }

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
    res.json({ success: true, message: 'Prospecto actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Cambiar estado del workflow comercial
// ------------------------------------------------------------
export async function cambiarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    if (!ESTADOS_WORKFLOW.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const r = await executeQuery('UPDATE prospectos SET estado_workflow = ? WHERE id_prospecto = ?', [estado, id]);
    if (!r.success) return res.status(500).json({ error: r.error });
    res.json({ success: true, message: 'Estado actualizado' });
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
    res.status(201).json({ success: true, message: 'Contacto agregado', id_contacto: r.data.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteContacto(req, res) {
  try {
    const { id_contacto } = req.params;
    const r = await executeQuery('DELETE FROM prospecto_contactos WHERE id_contacto = ?', [id_contacto]);
    if (!r.success) return res.status(500).json({ error: r.error });
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
    const r = await executeQuery('SELECT * FROM prospectos WHERE id_prospecto = ?', [id]);
    if (r.data.length === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });
    const p = r.data[0];

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

    res.status(201).json({ success: true, message: 'Cliente creado desde el prospecto', data: { id_cliente: idCliente, razon_social } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// Cola de scraping (jobs asíncronos)
// ============================================================
const TIPOS_JOB = ['google_places', 'web_scrape', 'sunat_ruc', 'sunat_ciiu', 'enriquecer'];

async function encolarJob(tipo, parametros, idEmpleado) {
  const ins = await executeQuery(
    'INSERT INTO scraping_jobs (tipo, parametros, id_empleado_solicita) VALUES (?,?,?)',
    [tipo, JSON.stringify(parametros || {}), idEmpleado || null]
  );
  if (!ins.success) throw new Error(ins.error);
  const idJob = ins.data.insertId;
  notificarJob(); // despierta al worker
  return idJob;
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

// Enriquecer un prospecto scrapeando su web
export async function enriquecerProspecto(req, res) {
  try {
    const { id } = req.params;
    const url = req.body.web;
    const r = await executeQuery('SELECT web FROM prospectos WHERE id_prospecto = ?', [id]);
    if (r.data.length === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });

    const web = url || r.data[0].web;
    if (!web) return res.status(400).json({ error: 'El prospecto no tiene una web registrada. Agrega la URL para enriquecerlo.' });

    const idJob = await encolarJob('web_scrape', { id_prospecto: parseInt(id), url: web }, req.user?.id_empleado);
    res.status(201).json({ success: true, message: 'Enriquecimiento encolado', id_job: idJob });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ------------------------------------------------------------
// Descartar / eliminar
// ------------------------------------------------------------
export async function descartarProspecto(req, res) {
  try {
    const { id } = req.params;
    const r = await executeQuery("UPDATE prospectos SET estado_workflow = 'Descartado' WHERE id_prospecto = ?", [id]);
    if (!r.success) return res.status(500).json({ error: r.error });
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
    res.json({ success: true, message: 'Prospecto eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
