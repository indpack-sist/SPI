// =====================================================
// REEMPLAZAR: backend/routes/cotizaciones.routes.js
// =====================================================

import express from 'express';
import { getPDFCotizacion } from '../controllers/cotizaciones.controller.js';

import {
  getAllCotizaciones,
  getCotizacionById,
  createCotizacion,
  cambiarEstado,
  generarPDF
} from '../controllers/cotizaciones.controller.js';

const router = express.Router();

// Listar cotizaciones
router.get('/', getAllCotizaciones);

// Generar PDF (ANTES de /:id para evitar conflictos)
router.get('/:id/pdf', generarPDF);

// Obtener cotización por ID
router.get('/:id', getCotizacionById);

// Crear nueva cotización
router.post('/', createCotizacion);

// Cambiar estado
router.patch('/:id/estado', cambiarEstado);
router.get('/:id/pdf', getPDFCotizacion);

export default router;