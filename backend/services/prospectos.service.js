import { executeQuery } from '../config/database.js';

// ============================================================
// Servicio de Prospección: normalización, scoring heurístico
// (gratis, sin IA) y detección de duplicados contra clientes.
// ============================================================

// Sectores que compran empaque terminado. Cada patrón aporta un
// "sector legible" y un bono de encaje al score. Se detecta por
// palabras clave en la razón social / nombre comercial mientras no
// tengamos el CIIU real de otra fuente.
// Sectores que COMPRAN empaque industrial (burbupack, stretch film, zunchos,
// esquineros, etc.): empresas que mueven, paletizan o protegen carga. Cada
// patrón aporta un "sector legible" y un bono de encaje al score. El orden
// importa: gana la primera coincidencia, así que van primero los de mayor fit.
const SECTORES_OBJETIVO = [
  { patron: /\b(AGRO|AGRIC|AGROEXPORT|FRUT|HORTALIZ|ESPARRAG|PALTA|ARANDAN|UVA|CITRIC)/i, sector: 'Agroexportación', bono: 16 },
  { patron: /\b(LOGISTIC|ALMACEN|OPERADOR LOG|CENTRO DE DISTRIBU|WAREHOUSE|FULFILL)/i, sector: 'Logística / Almacenes', bono: 15 },
  { patron: /\b(ECOMMERCE|E-COMMERCE|TIENDA ONLINE|MARKETPLACE|COURIER|PAQUETER|DELIVERY|MENSAJER)/i, sector: 'E-commerce / Courier', bono: 14 },
  { patron: /\b(MUDANZA|EMBALAD|RELOCAT|EMBALAJE)/i, sector: 'Mudanzas / Embalaje', bono: 13 },
  { patron: /\b(ALIMENT|SNACK|GALLET|PANIFIC|LACTE|CONSERV|EMBUTID|GOLOSIN|MOLINER)/i, sector: 'Alimentos', bono: 13 },
  { patron: /\b(BEBIDA|CERVEC|GASEOSA|EMBOTELL|LICOR|VINO|AGUA MINERAL)/i, sector: 'Bebidas', bono: 12 },
  { patron: /\b(PESQ|PESCA|MARIN|CONGELAD|HIDROBIOL)/i, sector: 'Pesca / Congelados', bono: 12 },
  { patron: /\b(ELECTRO|ELECTRODOMEST|ELECTRONIC|COMPUTO|TECNOLOG|LINEA BLANCA)/i, sector: 'Electrodomésticos / Electrónica', bono: 12 },
  { patron: /\b(VIDRIO|CRISTAL|CERAMIC|PORCELAN|SANITARIO|MAYOLIC)/i, sector: 'Vidrio / Cerámica', bono: 12 },
  { patron: /\b(FARMA|LABORATOR|MEDIC|COSMETIC|QUIMIC)/i, sector: 'Farmacéutica / Química', bono: 11 },
  { patron: /\b(MUEBL|MADERE|CARPINTER|MELAMIN)/i, sector: 'Muebles / Madera', bono: 10 },
  { patron: /\b(IMPORT|EXPORT|DISTRIBU|MAYORIST|COMERCIALIZ)/i, sector: 'Importación / Distribución', bono: 10 },
  { patron: /\b(INDUSTRI|MANUFACTUR|FABRICA|PLANTA|PRODUCC|METALMEC)/i, sector: 'Industria / Manufactura', bono: 9 },
  { patron: /\b(TEXTIL|CONFECC|PRENDA|ALGODON|CALZAD)/i, sector: 'Textil / Calzado', bono: 8 },
  { patron: /\b(FERRETER|FERRETERIA INDUSTRIAL|SUMINISTRO)/i, sector: 'Ferretería / Suministros', bono: 8 },
];

/** Deja solo dígitos de un teléfono (para comparar/deduplicar). */
export function normalizarTelefono(valor) {
  if (!valor) return '';
  const digitos = String(valor).replace(/\D/g, '');
  // Quita prefijo país 51 si el número queda con largo de móvil/fijo peruano.
  if (digitos.length > 9 && digitos.startsWith('51')) {
    return digitos.slice(2);
  }
  return digitos;
}

/** Normaliza un email a minúsculas sin espacios. */
export function normalizarEmail(valor) {
  if (!valor) return '';
  return String(valor).trim().toLowerCase();
}

/** Deja solo dígitos de un documento (RUC/DNI). */
export function normalizarDocumento(valor) {
  if (!valor) return '';
  return String(valor).replace(/\D/g, '');
}

/**
 * Detecta el sector objetivo a partir del nombre de la empresa.
 * Devuelve { sector, bono } o null si no calza con ninguno.
 */
export function detectarSector(nombre) {
  if (!nombre) return null;
  for (const s of SECTORES_OBJETIVO) {
    if (s.patron.test(nombre)) {
      return { sector: s.sector, bono: s.bono };
    }
  }
  return null;
}

/**
 * Scoring heurístico (0..100). No usa IA: puntúa señales concretas y
 * explica el "por qué" con plantillas. Recibe un objeto plano con lo
 * que se haya podido recolectar del prospecto.
 *
 * @param {Object} p
 * @param {string} [p.segmento]        'Formal' | 'Pequeno' | 'Informal'
 * @param {boolean} [p.es_activo]      RUC activo en SUNAT
 * @param {boolean} [p.es_habido]      Condición HABIDO en SUNAT
 * @param {string} [p.razon_social]
 * @param {string} [p.sector]          sector ya conocido (opcional)
 * @param {boolean} [p.tiene_telefono]
 * @param {boolean} [p.tiene_email]
 * @param {boolean} [p.tiene_web]
 * @param {boolean} [p.tiene_direccion]
 * @param {boolean} [p.ya_cliente]     ya existe en la BD
 * @returns {{score:number, sector:(string|null), señales:string[], por_que_contactar:string}}
 */
export function calcularScore(p = {}) {
  const señales = [];
  let score = 25; // base

  const esInformal = p.segmento === 'Pequeno' || p.segmento === 'Informal';

  // --- Vigencia SUNAT (peso alto en formales) ---
  if (p.es_activo) {
    score += 25;
    señales.push('RUC activo en SUNAT');
  } else if (p.es_activo === false) {
    score -= 15;
    señales.push('RUC no activo en SUNAT');
  }
  if (p.es_habido) {
    score += 15;
    señales.push('Condición HABIDO');
  } else if (p.es_habido === false) {
    score -= 10;
    señales.push('Condición NO HABIDO');
  }

  // --- Encaje de sector ---
  let sectorDetectado = p.sector || null;
  if (!sectorDetectado) {
    const det = detectarSector(p.razon_social);
    if (det) {
      sectorDetectado = det.sector;
      score += det.bono;
      señales.push(`Sector afín: ${det.sector}`);
    }
  } else {
    const det = detectarSector(p.razon_social) || detectarSector(sectorDetectado);
    if (det) {
      score += det.bono;
      señales.push(`Sector afín: ${sectorDetectado}`);
    }
  }

  // --- Accionabilidad del contacto ---
  if (p.tiene_telefono) { score += 10; señales.push('Tiene teléfono de contacto'); }
  if (p.tiene_email)    { score += 10; señales.push('Tiene correo de contacto'); }
  if (p.tiene_web)      { score += 5;  señales.push('Tiene sitio web'); }
  if (p.tiene_direccion){ score += 5;  señales.push('Dirección registrada'); }

  // Un negocio pequeño con local y contacto es igual de valioso: sube el piso.
  if (esInformal && (p.tiene_telefono || p.tiene_direccion)) {
    score += 5;
    señales.push('Negocio pequeño con contacto directo (venta libre)');
  }

  // Ya es cliente: no es un lead nuevo, pero conservamos el cálculo.
  if (p.ya_cliente) {
    señales.push('Ya registrado como cliente');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    sector: sectorDetectado,
    señales,
    por_que_contactar: construirPorQue({ ...p, sector: sectorDetectado, score, señales }),
  };
}

/** Arma el párrafo de "por qué contactar" con plantillas según señales. */
function construirPorQue(p) {
  const nombre = p.razon_social || 'La empresa';
  const partes = [];

  if (p.sector) {
    partes.push(`Pertenece al sector ${p.sector}, que suele demandar empaque y productos terminados.`);
  }
  if (p.es_activo && p.es_habido) {
    partes.push('Está activa y habida en SUNAT, lo que facilita facturación y crédito.');
  }
  if (p.segmento === 'Pequeno' || p.segmento === 'Informal') {
    partes.push('Realiza compras libres, un canal donde nuestros productos terminados tienen buena rotación.');
  }
  if (p.tiene_telefono || p.tiene_email) {
    partes.push('Tiene contacto directo disponible para una primera aproximación comercial.');
  }

  if (partes.length === 0) {
    return `${nombre} es un prospecto por evaluar; falta enriquecer datos de contacto y sector para priorizarlo.`;
  }
  const prioridad = p.score >= 70 ? 'Prioridad alta' : p.score >= 45 ? 'Prioridad media' : 'Prioridad baja';
  return `${prioridad}. ${partes.join(' ')}`;
}

/**
 * Busca si un prospecto ya existe como cliente. Ancla fuerte: documento
 * (RUC/DNI) contra clientes.ruc. Débil: teléfono normalizado (pocos
 * clientes lo tienen, se marca como "posible duplicado").
 *
 * @returns {Promise<{flag:'Ninguno'|'Ya_cliente'|'Posible_duplicado', id_cliente:(number|null), cliente:(object|null)}>}
 */
export async function detectarDuplicadoCliente({ documento, telefono }) {
  const doc = normalizarDocumento(documento);
  if (doc) {
    const r = await executeQuery(
      'SELECT id_cliente, razon_social, ruc FROM clientes WHERE ruc = ? LIMIT 1',
      [doc]
    );
    if (r.success && r.data.length > 0) {
      return { flag: 'Ya_cliente', id_cliente: r.data[0].id_cliente, cliente: r.data[0] };
    }
  }

  const tel = normalizarTelefono(telefono);
  if (tel && tel.length >= 6) {
    const r = await executeQuery(
      "SELECT id_cliente, razon_social, ruc FROM clientes WHERE telefono IS NOT NULL AND telefono <> '' AND REPLACE(REPLACE(REPLACE(telefono,' ',''),'-',''),'+','') LIKE ? LIMIT 1",
      [`%${tel}%`]
    );
    if (r.success && r.data.length > 0) {
      return { flag: 'Posible_duplicado', id_cliente: r.data[0].id_cliente, cliente: r.data[0] };
    }
  }

  return { flag: 'Ninguno', id_cliente: null, cliente: null };
}

/**
 * Detecta si ya existe un prospecto con el mismo documento (evita
 * capturar la misma empresa dos veces).
 * @returns {Promise<number|null>} id_prospecto existente o null.
 */
export async function buscarProspectoPorDocumento(documento) {
  const doc = normalizarDocumento(documento);
  if (!doc) return null;
  const r = await executeQuery(
    'SELECT id_prospecto FROM prospectos WHERE documento = ? LIMIT 1',
    [doc]
  );
  return r.success && r.data.length > 0 ? r.data[0].id_prospecto : null;
}

/**
 * Dedup para el segmento informal (sin RUC): busca un prospecto con el
 * mismo teléfono normalizado entre sus contactos.
 * @returns {Promise<number|null>} id_prospecto existente o null.
 */
export async function buscarProspectoPorTelefono(telefono) {
  const tel = normalizarTelefono(telefono);
  if (!tel || tel.length < 6) return null;
  const r = await executeQuery(
    `SELECT id_prospecto FROM prospecto_contactos
      WHERE tipo IN ('Telefono','Celular','Whatsapp') AND valor_normalizado = ? LIMIT 1`,
    [tel]
  );
  return r.success && r.data.length > 0 ? r.data[0].id_prospecto : null;
}

/** Dedup por el ID único de Google Places (idempotencia del descubrimiento). */
export async function buscarProspectoPorPlaceId(placeId) {
  if (!placeId) return null;
  const r = await executeQuery('SELECT id_prospecto FROM prospectos WHERE place_id = ? LIMIT 1', [placeId]);
  return r.success && r.data.length > 0 ? r.data[0].id_prospecto : null;
}

/**
 * Inserta un prospecto ya armado con sus contactos y su fuente, aplicando
 * dedup contra clientes y scoring. Reutilizado por el controller (manual /
 * ingesta SUNAT) y por el worker de scraping.
 *
 * @returns {Promise<{success:boolean, id_prospecto?:number, flag?:string,
 *   score?:number, duplicado_prospecto?:number, error?:string}>}
 */
export async function crearProspectoDesdeDatos(datos, idEmpleado) {
  const doc = normalizarDocumento(datos.documento);

  // Anti-duplicado entre prospectos: por place_id (Google), documento
  // (formal) o teléfono (informal). Cualquiera que coincida = ya existe.
  if (datos.place_id) {
    const existe = await buscarProspectoPorPlaceId(datos.place_id);
    if (existe) return { success: true, duplicado_prospecto: existe };
  }
  if (doc) {
    const existe = await buscarProspectoPorDocumento(doc);
    if (existe) return { success: true, duplicado_prospecto: existe };
  } else if (datos.telefono) {
    const existe = await buscarProspectoPorTelefono(datos.telefono);
    if (existe) return { success: true, duplicado_prospecto: existe };
  }

  const dup = await detectarDuplicadoCliente({ documento: datos.documento, telefono: datos.telefono });

  const scoring = calcularScore({
    segmento: datos.segmento,
    es_activo: datos.es_activo,
    es_habido: datos.es_habido,
    razon_social: datos.razon_social,
    sector: datos.sector,
    tiene_telefono: !!datos.telefono,
    tiene_email: !!datos.email,
    tiene_web: !!datos.web,
    tiene_direccion: !!datos.direccion,
    ya_cliente: dup.flag === 'Ya_cliente',
  });

  const ins = await executeQuery(
    `INSERT INTO prospectos
      (segmento, tipo_documento, documento, razon_social, nombre_comercial, sector, ciiu,
       departamento, provincia, distrito, direccion, web, origen, origen_query, score, score_detalle,
       flag_duplicado, id_cliente_match, id_empleado_asignado, logo_url, foto_referencia, place_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      datos.segmento || 'Formal',
      datos.tipo_documento || null,
      doc || null,
      datos.razon_social,
      datos.nombre_comercial || null,
      scoring.sector || null,
      datos.ciiu || null,
      datos.departamento || null,
      datos.provincia || null,
      datos.distrito || null,
      datos.direccion || null,
      datos.web || null,
      datos.origen || 'manual',
      datos.origen_query || null,
      scoring.score,
      JSON.stringify({ señales: scoring.señales, por_que_contactar: scoring.por_que_contactar }),
      dup.flag,
      dup.id_cliente,
      idEmpleado || null,
      datos.logo_url || null,
      datos.foto_referencia || null,
      datos.place_id || null,
    ]
  );
  if (!ins.success) return { success: false, error: ins.error };
  const idProspecto = ins.data.insertId;

  const contactos = [];
  if (datos.telefono) contactos.push({ tipo: 'Telefono', valor: datos.telefono, norm: normalizarTelefono(datos.telefono) });
  if (datos.email)    contactos.push({ tipo: 'Email', valor: datos.email, norm: normalizarEmail(datos.email) });
  if (datos.web)      contactos.push({ tipo: 'Web', valor: datos.web, norm: String(datos.web).trim().toLowerCase() });
  for (const ct of contactos) {
    await executeQuery(
      `INSERT IGNORE INTO prospecto_contactos (id_prospecto, tipo, valor, valor_normalizado, fuente)
       VALUES (?,?,?,?,?)`,
      [idProspecto, ct.tipo, ct.valor, ct.norm, datos.origen || 'manual']
    );
  }

  if (datos.datos_raw) {
    await executeQuery(
      'INSERT INTO prospecto_fuentes (id_prospecto, fuente, url, datos_raw) VALUES (?,?,?,?)',
      [idProspecto, datos.origen || 'manual', datos.url || null, JSON.stringify(datos.datos_raw)]
    );
  }

  return { success: true, id_prospecto: idProspecto, flag: dup.flag, score: scoring.score };
}

/**
 * Recalcula el score de un prospecto tras enriquecerlo (nuevos contactos,
 * web, etc.). Lee el estado actual + sus contactos y actualiza score y
 * score_detalle.
 */
export async function recalcularScore(idProspecto) {
  const pr = await executeQuery('SELECT * FROM prospectos WHERE id_prospecto = ?', [idProspecto]);
  if (!pr.success || pr.data.length === 0) return null;
  const p = pr.data[0];

  const ct = await executeQuery(
    'SELECT tipo FROM prospecto_contactos WHERE id_prospecto = ?', [idProspecto]);
  const tipos = (ct.success ? ct.data : []).map((c) => c.tipo);

  const scoring = calcularScore({
    segmento: p.segmento,
    razon_social: p.razon_social,
    sector: p.sector,
    tiene_telefono: tipos.some((t) => ['Telefono', 'Celular', 'Whatsapp'].includes(t)),
    tiene_email: tipos.includes('Email'),
    tiene_web: !!p.web || tipos.includes('Web'),
    tiene_direccion: !!p.direccion,
    ya_cliente: p.flag_duplicado === 'Ya_cliente',
    // Señales SUNAT ya no están a mano aquí; se preservan las del alta si existían.
    es_activo: p.origen === 'sunat' ? true : undefined,
  });

  await executeQuery(
    'UPDATE prospectos SET score = ?, sector = COALESCE(sector, ?), score_detalle = ? WHERE id_prospecto = ?',
    [scoring.score, scoring.sector, JSON.stringify({ señales: scoring.señales, por_que_contactar: scoring.por_que_contactar }), idProspecto]
  );
  return scoring.score;
}
