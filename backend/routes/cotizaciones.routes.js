// =====================================================
// backend/routes/cotizaciones.routes.js
// =====================================================
import express from 'express';
import {
  getAllCotizaciones,
  getCotizacionById,
  createCotizacion,
  cambiarEstado,
  getPDFCotizacion // Usamos solo el nombre correcto
} from '../controllers/cotizaciones.controller.js';

const router = express.Router();

// Listar cotizaciones
router.get('/', getAllCotizaciones);

// Generar PDF (Es importante poner esta ruta ANTES de /:id genérico si fuera conflicto, 
// pero al tener /pdf al final es específica, así que funciona bien)
router.get('/:id/pdf', getPDFCotizacion);

// Obtener cotización por ID
router.get('/:id', getCotizacionById);

// Crear nueva cotización
router.post('/', createCotizacion);

// Cambiar estado
router.patch('/:id/estado', cambiarEstado);

export default router;