import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const BCRYPT_PREFIX = /^\$2[aby]\$\d{2}\$/;

export function esHash(guardado) {
  return typeof guardado === 'string' && BCRYPT_PREFIX.test(guardado);
}

export async function verificarPassword(plano, guardado) {
  if (plano == null || guardado == null) return false;
  if (esHash(guardado)) {
    return bcrypt.compare(plano, guardado);
  }
  return plano === guardado;
}

export async function hashPassword(plano) {
  return bcrypt.hash(plano, SALT_ROUNDS);
}
