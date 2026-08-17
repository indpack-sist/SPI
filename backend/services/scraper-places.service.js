import axios from 'axios';

// ============================================================
// Integración con Google Places (API oficial). Descubre empresas
// por rubro + zona, incluidos negocios pequeños/informales que no
// tienen presencia formal en SUNAT. Se activa definiendo
// GOOGLE_PLACES_API_KEY en el .env del backend.
//
// Usa la API "legacy" Text Search + Place Details, que solo requiere
// una API key con Places API habilitada y facturación activa
// (Google da crédito mensual gratuito).
// ============================================================

const KEY = process.env.GOOGLE_PLACES_API_KEY;
const TIMEOUT = 12000;
const TEXTSEARCH = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const DETAILS = 'https://maps.googleapis.com/maps/api/place/details/json';

/** ¿Está configurada la API key? */
export function placesDisponible() {
  return !!KEY;
}

/** Intenta separar distrito/provincia de una dirección formateada de Google. */
function partirDireccion(addr) {
  if (!addr) return { distrito: null, provincia: null };
  // Formato típico: "Av. X 123, Distrito 15001, Provincia, Perú"
  const partes = addr.split(',').map((s) => s.trim()).filter(Boolean);
  const sinPais = partes.filter((p) => !/per[uú]/i.test(p));
  const distrito = sinPais.length >= 2 ? sinPais[sinPais.length - 2].replace(/\d{4,6}/g, '').trim() : null;
  const provincia = sinPais.length >= 1 ? sinPais[sinPais.length - 1].replace(/\d{4,6}/g, '').trim() : null;
  return { distrito: distrito || null, provincia: provincia || null };
}

async function detallePlace(placeId) {
  try {
    const res = await axios.get(DETAILS, {
      timeout: TIMEOUT,
      params: {
        place_id: placeId,
        key: KEY,
        language: 'es',
        fields: 'name,formatted_address,formatted_phone_number,international_phone_number,website,url,rating,user_ratings_total,business_status',
      },
    });
    return res.data?.result || null;
  } catch {
    return null;
  }
}

/**
 * Busca negocios por término + zona. Devuelve una lista normalizada
 * lista para convertir en prospectos.
 *
 * @param {string} query   rubro / término (ej. "distribuidora de alimentos")
 * @param {Object} opts    { zona, limite }
 * @returns {Promise<{ok:boolean, empresas:Array, error?:string}>}
 */
export async function buscarNegocios(query, opts = {}) {
  if (!KEY) return { ok: false, error: 'GOOGLE_PLACES_API_KEY no configurada', empresas: [] };

  const zona = opts.zona || 'Perú';
  const limite = Math.min(parseInt(opts.limite || 20), 40);
  const termino = `${query} en ${zona}`;

  let resultados = [];
  try {
    let pageToken = null;
    // Google entrega hasta 20 por página; paginamos hasta cubrir el límite.
    for (let pagina = 0; pagina < 3 && resultados.length < limite; pagina++) {
      const params = pageToken
        ? { pagetoken: pageToken, key: KEY }
        : { query: termino, key: KEY, language: 'es', region: 'pe' };

      const res = await axios.get(TEXTSEARCH, { timeout: TIMEOUT, params });
      const data = res.data || {};

      if (data.status === 'REQUEST_DENIED') {
        return { ok: false, error: data.error_message || 'API key rechazada por Google', empresas: [] };
      }
      if (data.status === 'OVER_QUERY_LIMIT') {
        return { ok: false, error: 'Cuota de Google Places agotada', empresas: resultadosNormalizados(resultados) };
      }
      resultados = resultados.concat(data.results || []);
      pageToken = data.next_page_token;
      if (!pageToken) break;
      // El token tarda unos segundos en activarse.
      await new Promise((r) => setTimeout(r, 2200));
    }
  } catch (e) {
    return { ok: false, error: e.message, empresas: [] };
  }

  resultados = resultados.slice(0, limite);

  // Enriquecemos cada negocio con teléfono/web vía Place Details.
  const empresas = [];
  for (const r of resultados) {
    const det = await detallePlace(r.place_id);
    const addr = det?.formatted_address || r.formatted_address;
    const { distrito, provincia } = partirDireccion(addr);
    empresas.push({
      razon_social: det?.name || r.name,
      direccion: addr || null,
      distrito,
      provincia,
      telefono: det?.formatted_phone_number || det?.international_phone_number || null,
      web: det?.website || null,
      rating: det?.rating ?? r.rating ?? null,
      total_reviews: det?.user_ratings_total ?? r.user_ratings_total ?? null,
      place_id: r.place_id,
      maps_url: det?.url || null,
      datos_raw: { ...r, detalle: det || undefined },
    });
  }

  return { ok: true, empresas };
}

function resultadosNormalizados(resultados) {
  return resultados.map((r) => ({
    razon_social: r.name,
    direccion: r.formatted_address || null,
    place_id: r.place_id,
    datos_raw: r,
  }));
}
