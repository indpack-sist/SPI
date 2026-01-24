import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import { 
  getMisNotificaciones, 
  marcarLeida, 
  marcarTodasLeidas,
  eliminarNotificacion,
  eliminarTodasLeidas
} from '../controllers/notificacionesController.js';

const router = express.Router();

router.get('/', verificarToken, getMisNotificaciones);
router.put('/marcar-todas-leidas', verificarToken, marcarTodasLeidas);
router.put('/:id/leida', verificarToken, marcarLeida);
router.delete('/leidas/todas', verificarToken, eliminarTodasLeidas);
router.delete('/:id', verificarToken, eliminarNotificacion);

export default router;