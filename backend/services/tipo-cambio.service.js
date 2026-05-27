import axios from 'axios';
import { executeQuery } from '../config/database.js';

const DECOLECTA_API_URL = 'https://api.decolecta.com/v1';
const DECOLECTA_API_KEY = process.env.API_DECOLECTA_TOKEN || process.env.DECOLECTA_API_KEY;
const API_TIMEOUT = 10000;

let tipoCambioCache = {
  data: null,
  timestamp: null,
  ttl: 86400000 
};


export function obtenerTipoCambioCache() {
  const now = Date.now();
  
  if (tipoCambioCache.data && tipoCambioCache.timestamp) {
    const edad = now - tipoCambioCache.timestamp;
    const horas = Math.floor(edad / 3600000);
    
    return {
      valido: true,
      ...tipoCambioCache.data,
      desde_cache: true,
      cache_edad_horas: horas,
      cache_valido: edad < tipoCambioCache.ttl
    };
  }
  
  return {
    valido: true,
    compra: 3.75,
    venta: 3.78,
    promedio: 3.765,
    fecha: new Date().toISOString().split('T')[0],
    moneda_base: 'USD',
    moneda_destino: 'PEN',
    desde_cache: false,
    es_default: true,
    advertencia: 'Tipo de cambio predeterminado. Haga clic en "Actualizar TC" para obtener el valor real.'
  };
}

export async function actualizarTipoCambio(date = null) {
  try {
    // 1. Determinar la fecha a consultar
    const dateToQuery = date || new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }).split(',')[0].split('/').reverse().join('-'); 
    // Format mm/dd/yyyy to yyyy-mm-dd roughly, or just rely on MySQL handling if we parse date cleanly
    
    // Mejor formato de fecha actual en Lima
    let fechaConsulta = date;
    if (!fechaConsulta) {
       const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
       const yyyy = today.getFullYear();
       const mm = String(today.getMonth() + 1).padStart(2, '0');
       const dd = String(today.getDate()).padStart(2, '0');
       fechaConsulta = `${yyyy}-${mm}-${dd}`;
    }

    // 2. Consulta Inteligente: Verificar BD Local primero
    try {
      const dbResult = await executeQuery(
        `SELECT compra, venta, promedio, fecha, moneda_base, moneda_destino 
         FROM tipo_cambio_historico 
         WHERE fecha = ?`, 
        [fechaConsulta]
      );
      
      if (dbResult.success && dbResult.data && dbResult.data.length > 0) {
        const localTC = dbResult.data[0];
        
        // Formatear la fecha para que sea string en lugar de objeto Date de MySQL
        const dateObj = new Date(localTC.fecha);
        const fechaStr = dateObj.toISOString().split('T')[0];

        const tipoCambioLocal = {
          compra: parseFloat(localTC.compra),
          venta: parseFloat(localTC.venta),
          promedio: parseFloat(localTC.promedio),
          fecha: fechaStr,
          moneda_base: localTC.moneda_base || 'USD',
          moneda_destino: localTC.moneda_destino || 'PEN'
        };

        // Actualizar caché
        tipoCambioCache = {
          data: tipoCambioLocal,
          timestamp: Date.now()
        };

        console.log(`TC para ${fechaConsulta} obtenido de BD Local (Ahorrando 1 petición API)`);

        return {
          valido: true,
          ...tipoCambioLocal,
          desde_cache: false,
          desde_bd_local: true,
          actualizado: true
        };
      }
    } catch (dbReadError) {
      console.error('Error leyendo TC local, procediendo a API externa:', dbReadError);
    }

    // 3. Si no existe localmente, consultar API de Decolecta
    console.log(`TC para ${fechaConsulta} no encontrado localmente. Consultando API Decolecta...`);
    const params = {};
    if (date) {
      params.date = date; 
    }

    const response = await axios.get(
      `${DECOLECTA_API_URL}/tipo-cambio/sunat`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DECOLECTA_API_KEY}`
        },
        params,
        timeout: API_TIMEOUT
      }
    );

    if (response.data) {
      const tipoCambio = {
        compra: parseFloat(response.data.buy_price),
        venta: parseFloat(response.data.sell_price),
        promedio: (parseFloat(response.data.buy_price) + parseFloat(response.data.sell_price)) / 2,
        fecha: response.data.date,
        moneda_base: response.data.base_currency,
        moneda_destino: response.data.quote_currency
      };

      tipoCambioCache = {
        data: tipoCambio,
        timestamp: Date.now()
      };

      try {
        await executeQuery(
          `INSERT INTO tipo_cambio_historico (fecha, compra, venta, promedio, origen) 
           VALUES (?, ?, ?, ?, 'SUNAT_API') 
           ON DUPLICATE KEY UPDATE 
           compra = VALUES(compra), venta = VALUES(venta), promedio = VALUES(promedio)`,
          [tipoCambio.fecha, tipoCambio.compra, tipoCambio.venta, tipoCambio.promedio]
        );
      } catch (dbError) {
        console.error('Error al guardar tipo de cambio en historial BD:', dbError);
      }

      return {
        valido: true,
        ...tipoCambio,
        desde_cache: false,
        actualizado: true
      };
    }

    return {
      valido: false,
      error: 'No se pudo obtener el tipo de cambio desde la API'
    };

  } catch (error) {
    console.error('Error al obtener tipo de cambio desde API:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    if (tipoCambioCache.data) {
      return {
        valido: true,
        ...tipoCambioCache.data,
        desde_cache: true,
        error_api: true,
        advertencia: 'No se pudo actualizar. Usando valor en cache.'
      };
    }

    return {
      valido: true,
      compra: 3.75,
      venta: 3.78,
      promedio: 3.765,
      fecha: new Date().toISOString().split('T')[0],
      moneda_base: 'USD',
      moneda_destino: 'PEN',
      error_api: true,
      es_default: true,
      advertencia: 'API no disponible. Usando valor predeterminado.'
    };
  }
}

export function convertirPENaUSD(montoPEN, tipoCambio) {
  const tc = tipoCambio?.promedio || tipoCambio?.venta || 3.765;
  return montoPEN / tc;
}

export function convertirUSDaPEN(montoUSD, tipoCambio) {
  const tc = tipoCambio?.promedio || tipoCambio?.compra || 3.765;
  return montoUSD * tc;
}

export function limpiarCache() {
  tipoCambioCache = {
    data: null,
    timestamp: null,
    ttl: 86400000
  };
}

export function obtenerInfoCache() {
  if (!tipoCambioCache.data) {
    return {
      hay_cache: false,
      mensaje: 'No hay tipo de cambio en cache'
    };
  }

  const now = Date.now();
  const edad = now - tipoCambioCache.timestamp;
  const horas = Math.floor(edad / 3600000);
  const minutos = Math.floor((edad % 3600000) / 60000);

  return {
    hay_cache: true,
    fecha_cache: new Date(tipoCambioCache.timestamp).toLocaleString('es-PE'),
    edad_horas: horas,
    edad_minutos: minutos,
    edad_ms: edad,
    valido: edad < tipoCambioCache.ttl,
    expira_en_horas: Math.floor((tipoCambioCache.ttl - edad) / 3600000),
    datos: tipoCambioCache.data
  };
}