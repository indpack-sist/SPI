/**
 * Configuración central de la integración SEE (SUNAT).
 * Los endpoints cambian entre Beta (pruebas) y Producción; el resto del código
 * NO debe conocer URLs: siempre las pide aquí según SEE_AMBIENTE.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AMBIENTE = (process.env.SEE_AMBIENTE || 'beta').toLowerCase(); // 'beta' | 'produccion'

// --- Endpoints de Comprobantes de Pago Electrónico (SOAP) ---
const ENDPOINTS = {
  beta: {
    // RUC de pruebas 20000000001, usuario MODDATOS, clave MODDATOS
    billService: 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
  },
  produccion: {
    billService: 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
  },
};

export const billServiceUrl = ENDPOINTS[AMBIENTE].billService;

// --- Credenciales SOL (usuario secundario para facturación) ---
// En Beta son fijas. En Producción: RUC + usuario SOL + clave SOL.
export const SOL = {
  ruc: process.env.SEE_RUC || '20000000001',
  usuario: process.env.SEE_SOL_USER || 'MODDATOS',
  clave: process.env.SEE_SOL_PASS || 'MODDATOS',
};

// --- Certificado digital ---
export const CERT = {
  path: process.env.SEE_CERT_PATH
    ? path.resolve(__dirname, '..', '..', process.env.SEE_CERT_PATH)
    : path.join(__dirname, '..', '..', 'certs', 'cert-prueba.pfx'),
  password: process.env.SEE_CERT_PASSWORD || '123456',
};

// Carpeta donde guardamos XML firmados y CDR en pruebas
export const OUTPUT_DIR = path.join(__dirname, '..', '..', 'sunat-output');

export const esBeta = () => AMBIENTE === 'beta';
