import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET && String(process.env.JWT_SECRET).trim();

if (!JWT_SECRET) {
  throw new Error(
    '[SECURITY] Falta la variable de entorno JWT_SECRET. ' +
    'Cárgala en Render (o en backend/.env para desarrollo local) antes de iniciar el servidor.'
  );
}

export const JWT_EXPIRES_IN = '24h';
export { JWT_SECRET };
