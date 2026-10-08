import express from 'express';
import {
  realizarConteoFisico,
  getAjustesPorProducto,
  getTodosLosAjustes,
  getHistorialAjustes,
  getDetalleAjuste,
  getEstadisticasAjustes,
  aprobarAjuste,
  getMotivosAjuste
} from '../controllers/ajustes.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/motivos', verificarToken, getMotivosAjuste);

router.get('/estadisticas', verificarToken, getEstadisticasAjustes);

router.get('/historial', verificarToken, getHistorialAjustes);

router.get('/', verificarToken, getTodosLosAjustes);

router.post('/', verificarToken, realizarConteoFisico);

router.get('/:id', verificarToken, getDetalleAjuste);

router.put('/:id/aprobar', verificarToken, aprobarAjuste);

router.get('/producto/:idProducto', verificarToken, getAjustesPorProducto);

export default router;