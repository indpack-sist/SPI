import express from 'express';
import {
  crearSolicitudCredito,
  getAllSolicitudes,
  getSolicitudesPendientes,
  getSolicitudById,
  aprobarSolicitud,
  rechazarSolicitud,
  getHistorialSolicitudesCliente
} from '../controllers/solicitudes-credito.controller.js';
import { uploadMiddleware } from '../services/cloudinary.service.js'; 

const router = express.Router();

router.post('/', uploadMiddleware.single('archivo_sustento'), crearSolicitudCredito);
router.get('/', getAllSolicitudes);
router.get('/pendientes', getSolicitudesPendientes);
router.get('/cliente/:id', getHistorialSolicitudesCliente);
router.get('/:id', getSolicitudById);
router.put('/:id/aprobar', aprobarSolicitud);
router.put('/:id/rechazar', rechazarSolicitud);

export default router;