// backend/config/security.js
// Configuración de seguridad de la app. El secreto JWT vive SOLO en variable de
// entorno (Render; o backend/.env en desarrollo). Sin fallback hardcodeado: un
// literal en el repo sería un secreto público que firmaría tokens válidos.
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET && String(process.env.JWT_SECRET).trim();

// Validación de arranque: fallar temprano y con mensaje claro si falta el secreto.
if (!JWT_SECRET) {
  throw new Error(
    '[SECURITY] Falta la variable de entorno JWT_SECRET. ' +
    'Cárgala en Render (o en backend/.env para desarrollo local) antes de iniciar el servidor.'
  );
}

export const JWT_EXPIRES_IN = '24h';
export { JWT_SECRET };
