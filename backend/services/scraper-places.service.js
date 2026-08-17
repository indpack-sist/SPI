import axios from 'axios';

// ============================================================
// Integración con Google Places (API oficial). Descubre empresas
// que COMPRAN empaque industrial, por rubro + zona. Se activa
// definiendo GOOGLE_PLACES_API_KEY en el .env del backend.
//
// Separa la búsqueda (Text Search, barata) del detalle (Place
// Details, costoso) para que el worker pueda saltar duplicados por
// place_id ANTES de gastar cuota en el detalle.
// ============================================================

const KEY = process.env.GOOGLE_PLACES_API_KEY;
const TIMEOUT = 12000;
const TEXTSEARCH = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const DETAILS = 'https://maps.googleapis.com/maps/api/place/details/json';

/** ¿Está configurada la API key? */
export function placesDisponible() {
  return !!KEY;
}

// Rubros objetivo para el modo "Descubrir todo", ordenados por afinidad
// con el producto (prioridad 1 = mayor cliente potencial). El worker
// procesa por prioridad ascendente, así que los mejores salen primero.
export const RUBROS_OBJETIVO = [
  { q: 'empresa agroexportadora', prioridad: 1 },
  { q: 'operador logistico almacen', prioridad: 1 },
  { q: 'centro de distribucion', prioridad: 1 },
  { q: 'empresa ecommerce tienda online', prioridad: 2 },
  { q: 'empresa courier paqueteria', prioridad: 2 },
  { q: 'empresa de mudanzas y embalaje', prioridad: 2 },
  { q: 'planta procesadora de alimentos', prioridad: 2 },
  { q: 'planta embotelladora de bebidas', prioridad: 3 },
  { q: 'distribuidora mayorista', prioridad: 3 },
  { q: 'empresa importadora', prioridad: 3 },
  { q: 'fabrica industrial', prioridad: 3 },
  { q: 'distribuidora de electrodomesticos', prioridad: 3 },
  { q: 'fabrica de vidrios y ceramicos', prioridad: 3 },
  { q: 'fabrica de muebles', prioridad: 4 },
  { q: 'laboratorio farmaceutico', prioridad: 4 },
  { q: 'ferreteria industrial', prioridad: 4 },
];

/** Intenta separar distrito/provincia de una dirección formateada de Google. */
function partirDireccion(addr) {
  if (!addr) return { distrito: null, provincia: null };
  const partes = addr.split(',').map((s) => s.trim()).filter(Boolean);
  const sinPais = partes.filter((p) => !/per[uú]/i.test(p));
  const distrito = sinPais.length >= 2 ? sinPais[sinPais.length - 2].replace(/\d{4,6}/g, '').trim() : null;
  const provincia = sinPais.length >= 1 ? sinPais[sinPais.length - 1].replace(/\d{4,6}/g, '').trim() : null;
  return { distrito: distrito || null, provincia: provincia || null };
}

/**
 * Búsqueda BÁSICA por término + zona (solo Text Search, sin detalles).
 * Barata: no consume Place Details. Devuelve place_id, nombre, dirección
 * aproximada y foto para poder deduplicar antes de pedir el detalle.
 *
 * @returns {Promise<{ok:boolean, resultados:Array, error?:string}>}
 */
export async function buscarBasico(query, opts = {}) {
  if (!KEY) return { ok: false, error: 'GOOGLE_PLACES_API_KEY no configurada', resultados: [] };

  const zona = opts.zona || 'Perú';
  const limite = Math.min(parseInt(opts.limite || 20), 40);
  const termino = `${query} en ${zona}`;

  let crudos = [];
  try {
    let pageToken = null;
    for (let pagina = 0; pagina < 3 && crudos.length < limite; pagina++) {
      const params = pageToken
        ? { pagetoken: pageToken, key: KEY }
        : { query: termino, key: KEY, language: 'es', region: 'pe' };

      const res = await axios.get(TEXTSEARCH, { timeout: TIMEOUT, params });
      const data = res.data || {};

      if (data.status === 'REQUEST_DENIED') return { ok: false, error: data.error_message || 'API key rechazada por Google', resultados: [] };
      if (data.status === 'OVER_QUERY_LIMIT') return { ok: false, error: 'Cuota de Google Places agotada', resultados: normalizar(crudos) };

      crudos = crudos.concat(data.results || []);
      pageToken = data.next_page_token;
      if (!pageToken) break;
      await new Promise((r) => setTimeout(r, 2200)); // el token tarda en activarse
    }
  } catch (e) {
    return { ok: false, error: e.message, resultados: [] };
  }

  return { ok: true, resultados: normalizar(crudos.slice(0, limite)) };
}

function normalizar(crudos) {
  return crudos.map((r) => {
    const { distrito, provincia } = partirDireccion(r.formatted_address);
    return {
      razon_social: r.name,
      direccion: r.formatted_address || null,
      distrito,
      provincia,
      rating: r.rating ?? null,
      total_reviews: r.user_ratings_total ?? null,
      place_id: r.place_id,
      foto_referencia: r.photos?.[0]?.photo_reference || null,
      datos_raw: r,
    };
  });
}

/**
 * DETALLE de un negocio (Place Details): teléfono, web, dirección exacta.
 * Costoso — llamarlo solo para los que NO son duplicados.
 * @returns {Promise<Object|null>}
 */
export async function detallar(placeId) {
  if (!KEY || !placeId) return null;
  try {
    const res = await axios.get(DETAILS, {
      timeout: TIMEOUT,
      params: {
        place_id: placeId,
        key: KEY,
        language: 'es',
        fields: 'name,formatted_address,formatted_phone_number,international_phone_number,website,url,rating,user_ratings_total',
      },
    });
    const det = res.data?.result;
    if (!det) return null;
    const { distrito, provincia } = partirDireccion(det.formatted_address);
    return {
      razon_social: det.name,
      direccion: det.formatted_address || null,
      distrito,
      provincia,
      telefono: det.formatted_phone_number || det.international_phone_number || null,
      web: det.website || null,
      maps_url: det.url || null,
      rating: det.rating ?? null,
      total_reviews: det.user_ratings_total ?? null,
      detalle_raw: det,
    };
  } catch {
    return null;
  }
}
