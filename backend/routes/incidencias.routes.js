import express from 'express';
import {
  getIncidencias,
  getIncidenciaById,
  getIncidenciasPorProducto,
  getTiposIncidencia,
  crearIncidencia,
  actualizarIncidencia,
  cambiarEstado,
  getHistorial,
  uploadMiddleware,
  subirAdjunto,
  getAdjuntos,
  eliminarAdjunto
} from '../controllers/incidencias.controller.js';

const router = express.Router();

router.get('/', getIncidencias);
router.post('/', crearIncidencia);

router.get('/auxiliar/tipos', getTiposIncidencia);
router.get('/producto/:idProducto', getIncidenciasPorProducto);

router.delete('/adjuntos/:idAdjunto', eliminarAdjunto);

router.get('/:id', getIncidenciaById);
router.put('/:id', actualizarIncidencia);
router.patch('/:id/estado', cambiarEstado);
router.get('/:id/historial', getHistorial);

router.post('/:id/adjuntos', uploadMiddleware.single('archivo'), subirAdjunto);
router.get('/:id/adjuntos', getAdjuntos);

export default router;
