import rateLimit from 'express-rate-limit';

export const limitadorGlobal = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 2000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas solicitudes. Intente de nuevo en unos minutos.' }
});

export const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos de inicio de sesión. Intente de nuevo en unos minutos.' }
});
