// backend/config/sunat.js
// Configuración central de la integración nativa con SUNAT (SEE - Del Contribuyente).
// Todos los secretos viven en variables de entorno (Render); aquí solo se leen.
// El modo (BETA/PROD) selecciona los endpoints: pasar a producción es cambiar UNA variable.
import dotenv from 'dotenv';
dotenv.config();

const MODE = process.env.SUNAT_MODE || 'BETA';

const ENDPOINTS = {
  BETA: {
    // Facturas, notas, RA (canal SOAP)
    FACTURACION: 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
    // Consulta de CDR/estado: solo existe en producción; en beta se omite
    CONSULTA_CDR: null,
    // GRE REST: SUNAT no publica beta oficial del API GRE.
    // Las pruebas se hacen contra un mock local (Fase 10.6) o datos reales controlados en prod.
    GRE_TOKEN: 'https://api-seguridad.sunat.gob.pe/v1/clientessol/{client_id}/oauth2/token',
    GRE_API: 'https://api-cpe.sunat.gob.pe/v1/contribuyente/gem'
  },
  PROD: {
    FACTURACION: 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
    CONSULTA_CDR: 'https://e-factura.sunat.gob.pe/ol-it-wsconscpegem/billConsultService',
    GRE_TOKEN: 'https://api-seguridad.sunat.gob.pe/v1/clientessol/{client_id}/oauth2/token',
    GRE_API: 'https://api-cpe.sunat.gob.pe/v1/contribuyente/gem'
  }
};

if (!ENDPOINTS[MODE]) {
  throw new Error(
    `[SUNAT] SUNAT_MODE inválido: "${MODE}". Valores permitidos: BETA | PROD.`
  );
}

// Validación de arranque: fallar temprano y con mensaje claro si falta un secreto crítico.
const REQUERIDAS = ['SUNAT_RUC', 'SUNAT_SOL_USER', 'SUNAT_SOL_PASS', 'SUNAT_CERT_B64', 'SUNAT_KEY_B64'];
const faltantes = REQUERIDAS.filter((k) => !process.env[k] || !String(process.env[k]).trim());
if (faltantes.length) {
  throw new Error(
    `[SUNAT] Faltan variables de entorno críticas: ${faltantes.join(', ')}. ` +
    `Cárgalas en Render (o en backend/.env para desarrollo local) antes de iniciar el servidor.`
  );
}

const cert = Buffer.from(process.env.SUNAT_CERT_B64 || '', 'base64').toString('utf8');
const key = Buffer.from(process.env.SUNAT_KEY_B64 || '', 'base64').toString('utf8');

// El base64 debe reconstruir un PEM válido; si no, la firma fallará silenciosamente más adelante.
if (!cert.includes('BEGIN CERTIFICATE')) {
  throw new Error('[SUNAT] SUNAT_CERT_B64 no decodifica a un certificado PEM válido (falta cabecera BEGIN CERTIFICATE).');
}
if (!/BEGIN (RSA )?PRIVATE KEY/.test(key)) {
  throw new Error('[SUNAT] SUNAT_KEY_B64 no decodifica a una clave privada PEM válida (falta cabecera BEGIN PRIVATE KEY).');
}

export const sunatConfig = {
  mode: MODE,
  ruc: process.env.SUNAT_RUC,
  razonSocial: process.env.SUNAT_RAZON_SOCIAL,
  nombreComercial: process.env.SUNAT_NOMBRE_COMERCIAL,
  ubigeo: process.env.SUNAT_UBIGEO,
  direccion: process.env.SUNAT_DIRECCION,
  distrito: process.env.SUNAT_DISTRITO,
  provincia: process.env.SUNAT_PROVINCIA,
  departamento: process.env.SUNAT_DEPARTAMENTO,
  solUser: process.env.SUNAT_SOL_USER,
  solPass: process.env.SUNAT_SOL_PASS,
  cert,
  key,
  greClientId: process.env.SUNAT_GRE_CLIENT_ID,
  greClientSecret: process.env.SUNAT_GRE_CLIENT_SECRET,
  urls: ENDPOINTS[MODE]
};

console.log(`[SUNAT] Configuración cargada. Modo: ${sunatConfig.mode}`);
