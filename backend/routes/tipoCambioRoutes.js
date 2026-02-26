import { Router } from 'express';
import { obtenerTC, actualizarTC } from '../controllers/tipoCambioController.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

router.get('/', verificarToken, obtenerTC);
router.post('/actualizar', verificarToken, actualizarTC);

export default router;