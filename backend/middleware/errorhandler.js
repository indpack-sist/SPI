export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Ocurrió un error inesperado en el servidor.';

  // Manejo de errores específicos de Base de Datos (MySQL/MariaDB)
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 400;
    message = 'Ya existe un registro con estos datos (duplicado).';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'No se pudo conectar con la base de datos. Intente más tarde.';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Su sesión no es válida. Por favor, ingrese de nuevo.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Su sesión ha expirado. Por favor, ingrese de nuevo.';
  }

  // Si estamos en desarrollo, enviamos el stack para debug, en producción solo el mensaje limpio
  const response = {
    success: false,
    error: message
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = err;
    console.error('❌ [Error Handler]:', err);
  }

  res.status(statusCode).json(response);
};