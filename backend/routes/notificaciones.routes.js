import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import { 
  getMisNotificaciones, 
  marcarLeida, 
  marcarTodasLeidas 
} from '../controllers/notificacionesController.js';

const router = express.Router();

router.get('/', verificarToken, getMisNotificaciones);
router.put('/marcar-todas-leidas', verificarToken, marcarTodasLeidas);
router.put('/:id/leida', verificarToken, marcarLeida);

export default router;