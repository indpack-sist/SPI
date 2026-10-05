import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Un hash bcrypt siempre empieza por $2a$, $2b$ o $2y$ seguido del coste.
const BCRYPT_PREFIX = /^\$2[aby]\$\d{2}\$/;

/**
 * ¿La cadena guardada ya es un hash bcrypt?
 * Sirve para decidir, en el login, si toca re-hashear (migración lazy).
 */
export function esHash(guardado) {
  return typeof guardado === 'string' && BCRYPT_PREFIX.test(guardado);
}

/**
 * Compara una contraseña en texto plano contra lo guardado en BD.
 * - Si lo guardado es un hash bcrypt → bcrypt.compare.
 * - Si lo guardado es texto plano (legacy, pre-migración) → comparación directa.
 * Devuelve true/false. Nunca lanza por un valor nulo.
 */
export async function verificarPassword(plano, guardado) {
  if (plano == null || guardado == null) return false;
  if (esHash(guardado)) {
    return bcrypt.compare(plano, guardado);
  }
  // Legacy: contraseña en texto plano. Se acepta temporalmente para permitir
  // la migración al vuelo; el llamador debe re-hashear tras un match.
  return plano === guardado;
}

/**
 * Genera el hash bcrypt de una contraseña en texto plano.
 */
export async function hashPassword(plano) {
  return bcrypt.hash(plano, SALT_ROUNDS);
}
