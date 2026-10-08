import { executeQuery } from '../config/database.js';

export function getFechaPeru() {
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

const DIACRITICOS_SECTOR = /[̀-ͯ]/g;
function normalizarNombreSector(nombre) {
  return String(nombre || '').normalize('NFD').replace(DIACRITICOS_SECTOR, '').toUpperCase();
}

const INSUMOS_AGRICOLAS =/AGROQUIMIC|CROPSCIENCE|INSECTICID|PLAGUICID|PESTICID|FUNGICID|HERBICID|ACARICID|NEMATICID|FERTILIZ|ABONO|FUMIGA|VETERINARI|PECUARI|SEMILLA|VIVERO|PLANTIN|AGROINSUMO|FOLIAR|RIEGO|PERFORACION|ASESOR|ABARROTE|CARNE|JARDIN|MASCOTA/;

const AGRO_SECTOR =/\b(AGRO|AGRIC|FRUT|HORTALIZ|PALT|ARANDAN|BLUEBERR|BERR|ESPARRAG|ASPARAG|CITRIC|MANDARIN|NARANJA|BANAN|PAPRIKA|PIMIENT|ALCACHOFA|ARTICHOKE|GRANAD|JENGIBRE|GINGER|QUINUA|CACAO|PRODUCE|AGROEXPORT|AGRICOLA|FRESH|FRUIT)|\b(UVA|UVAS|AJO|AJOS|KION|MANGO|MANGOS|PINA|CEBOLLA)\b/;

export function esInsumoAgricola(nombre) {
  return INSUMOS_AGRICOLAS.test(normalizarNombreSector(nombre));
}

const SECTORES_OBJETIVO = [
  { patron: AGRO_SECTOR, sector: 'Agroexportación', bono: 16 },
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

const CIIU_SECTOR = [
  { div: ['01', '02'], sector: 'Agroexportación', bono: 16 },
  { div: ['03'], sector: 'Pesca / Congelados', bono: 12 },
  { div: ['49', '50', '51', '52', '53'], sector: 'Logística / Almacenes', bono: 15 },
  { div: ['10'], sector: 'Alimentos', bono: 13 },
  { div: ['11'], sector: 'Bebidas', bono: 12 },
  { div: ['23'], sector: 'Vidrio / Cerámica', bono: 12 },
  { div: ['26', '27'], sector: 'Electrodomésticos / Electrónica', bono: 12 },
  { div: ['20', '21'], sector: 'Farmacéutica / Química', bono: 11 },
  { div: ['16', '31'], sector: 'Muebles / Madera', bono: 10 },
  { div: ['46', '47'], sector: 'Importación / Distribución', bono: 10 },
  { div: ['13', '14', '15'], sector: 'Textil / Calzado', bono: 8 },
  { div: ['17', '18', '19', '22', '24', '25', '28', '29', '30', '32', '33'], sector: 'Industria / Manufactura', bono: 9 },
];

export function sectorPorCiiu(ciiu) {
  if (!ciiu) return null;
  const lista = Array.isArray(ciiu) ? ciiu : [ciiu];
  for (const item of lista) {
    const cod = String(item?.codigo ?? item ?? '').replace(/\D/g, '');
    if (cod.length < 2) continue;
    const div = cod.padStart(4, '0').slice(0, 2);
    for (const m of CIIU_SECTOR) {
      if (m.div.includes(div)) return { sector: m.sector, bono: m.bono, codigo: cod };
    }
  }
  return null;
}

const CIIU_FRUTA_VERDURA = ['011', '012', '0163', '4630'];

export function clasificarCiiuFrutaVerdura(ciiu) {
  if (!ciiu) return null;
  const lista = Array.isArray(ciiu) ? ciiu : [ciiu];
  const items = lista
    .map((it) => ({ codigo: String(it?.codigo ?? it ?? '').replace(/\D/g, ''), descripcion: it?.descripcion || null }))
    .filter((it) => it.codigo.length >= 3);
  if (!items.length) return null;

  for (const it of items) {
    if (CIIU_FRUTA_VERDURA.some((p) => it.codigo.startsWith(p))) return { objetivo: true };
  }
  const primero = items[0];
  const desc = primero.descripcion || `CIIU ${primero.codigo}`;
  return { objetivo: false, motivo: `Actividad no es comercio de fruta/verdura (${desc})` };
}

const ANTISECTORES =/(AGENCIA\s+(DE\s+)?(MARKETING|PUBLICIDAD|VIAJES|SEGUROS|ADUANA|EMPLEO|DIGITAL)|\bMARKETING\b|PUBLICIDAD|COMMUNITY\s+MANAGER|\bSEO\b|DIGITAL\s+LEADER|DISE[NÑ]O\s+(WEB|GR[AÁ]FICO)|DESARROLLO\s+(WEB|DE\s+SOFTWARE|DE\s+APP|DE\s+APLICACIONES)|P[AÁ]GINAS?\s+WEB|SITIOS?\s+WEB|TIENDAS?\s+VIRTUALES?|\bSOFTWARE\b|APLICACIONES\s+M[OÓ]VILES|INTELIGENCIA\s+ARTIFICIAL|AUTOMATIZACIONES?|CONSULTOR[IÍ]A|CONSULTORA|ESTUDIO\s+(CONTABLE|JUR[IÍ]DICO|DE\s+ABOGADOS)|ABOGADOS|NOTAR[IÍ]A|CONTABILIDAD|INMOBILIARIA|CORREDORA\s+DE|C[AÁ]MARA\s+(DE\s+COMERCIO|PERUANA)|GREMIO)/i;

export function normalizarTelefono(valor) {
  if (!valor) return '';
  const digitos = String(valor).replace(/\D/g, '');
  if (digitos.length > 9 && digitos.startsWith('51')) {
    return digitos.slice(2);
  }
  return digitos;
}

export function normalizarEmail(valor) {
  if (!valor) return '';
  return String(valor).trim().toLowerCase();
}

export function normalizarDocumento(valor) {
  if (!valor) return '';
  return String(valor).replace(/\D/g, '');
}

export function esEmpresaServicios(nombre) {
  return ANTISECTORES.test(normalizarNombreSector(nombre));
}

export function detectarSector(nombre) {
  if (!nombre) return null;
  const n = normalizarNombreSector(nombre);
  if (ANTISECTORES.test(n)) return null;
  for (const s of SECTORES_OBJETIVO) {
    if (!s.patron.test(n)) continue;
    if (s.sector === 'Agroexportación' && INSUMOS_AGRICOLAS.test(n)) continue;
    return { sector: s.sector, bono: s.bono };
  }
  return null;
}

export function calcularScore(p = {}) {
  const señales = [];
  let score = 25;

  const esInformal = p.segmento === 'Pequeno' || p.segmento === 'Informal';

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

  let sectorDetectado = p.sector || null;
  const porCiiu = sectorPorCiiu(p.ciiu);
  if (porCiiu) {
    sectorDetectado = porCiiu.sector;
    score += porCiiu.bono;
    señales.push(`Sector afín (CIIU ${porCiiu.codigo}): ${sectorDetectado}`);
  } else if (ANTISECTORES.test(p.razon_social || '')) {
    sectorDetectado = null;
    señales.push('Empresa de servicios (no compra empaque): sin encaje de sector');
  } else {
    const det = detectarSector(p.razon_social) || (sectorDetectado ? detectarSector(sectorDetectado) : null);
    if (det) {
      sectorDetectado = sectorDetectado || det.sector;
      score += det.bono;
      señales.push(`Sector afín: ${sectorDetectado}`);
    }
  }

  if (p.tiene_telefono) { score += 10; señales.push('Tiene teléfono de contacto'); }
  if (p.tiene_email)    { score += 10; señales.push('Tiene correo de contacto'); }
  if (p.tiene_web)      { score += 5;  señales.push('Tiene sitio web'); }
  if (p.tiene_direccion){ score += 5;  señales.push('Dirección registrada'); }

  if (esInformal && (p.tiene_telefono || p.tiene_direccion)) {
    score += 5;
    señales.push('Negocio pequeño con contacto directo (venta libre)');
  }

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
  const prioridad = p.score >= 75 ? 'Prioridad alta' : p.score >= 45 ? 'Prioridad media' : 'Prioridad baja';
  return `${prioridad}. ${partes.join(' ')}`;
}

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

export async function buscarProspectoPorDocumento(documento) {
  const doc = normalizarDocumento(documento);
  if (!doc) return null;
  const r = await executeQuery(
    'SELECT id_prospecto FROM prospectos WHERE documento = ? LIMIT 1',
    [doc]
  );
  return r.success && r.data.length > 0 ? r.data[0].id_prospecto : null;
}

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

export async function buscarProspectoPorPlaceId(placeId) {
  if (!placeId) return null;
  const r = await executeQuery('SELECT id_prospecto FROM prospectos WHERE place_id = ? LIMIT 1', [placeId]);
  return r.success && r.data.length > 0 ? r.data[0].id_prospecto : null;
}

export async function crearProspectoDesdeDatos(datos, idEmpleado) {
  const doc = normalizarDocumento(datos.documento);

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
    ciiu: datos.ciiu_detalle || datos.ciiu,
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
       flag_duplicado, id_cliente_match, id_empleado_asignado, logo_url, foto_referencia, place_id, fecha_captura)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      getFechaPeru(),
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
      `INSERT IGNORE INTO prospecto_contactos (id_prospecto, tipo, valor, valor_normalizado, fuente, fuente_url)
       VALUES (?,?,?,?,?,?)`,
      [idProspecto, ct.tipo, ct.valor, ct.norm, datos.origen || 'manual', datos.url || null]
    );
  }

  if (datos.datos_raw) {
    await executeQuery(
      'INSERT INTO prospecto_fuentes (id_prospecto, fuente, url, datos_raw, fecha_scraping) VALUES (?,?,?,?,?)',
      [idProspecto, datos.origen || 'manual', datos.url || null, JSON.stringify(datos.datos_raw), getFechaPeru()]
    );
  }

  return { success: true, id_prospecto: idProspecto, flag: dup.flag, score: scoring.score };
}

export async function recalcularScore(idProspecto, sunat = {}, opciones = {}) {
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
    ciiu: p.ciiu,
    tiene_telefono: tipos.some((t) => ['Telefono', 'Celular', 'Whatsapp'].includes(t)),
    tiene_email: tipos.includes('Email'),
    tiene_web: !!p.web || tipos.includes('Web'),
    tiene_direccion: !!p.direccion,
    ya_cliente: p.flag_duplicado === 'Ya_cliente',
    es_activo: sunat.es_activo !== undefined ? sunat.es_activo : (p.origen === 'sunat' ? true : undefined),
    es_habido: sunat.es_habido,
  });

  const nuevoScore = opciones.permitirBajar
    ? scoring.score
    : Math.max(Number(p.score) || 0, scoring.score);
  await executeQuery(
    'UPDATE prospectos SET score = ?, sector = COALESCE(sector, ?), score_detalle = ? WHERE id_prospecto = ?',
    [nuevoScore, scoring.sector, JSON.stringify({ señales: scoring.señales, por_que_contactar: scoring.por_que_contactar }), idProspecto]
  );
  return nuevoScore;
}
