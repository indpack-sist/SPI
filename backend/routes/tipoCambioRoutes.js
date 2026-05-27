import { Router } from 'express';
import multer from 'multer';
import { obtenerTC, actualizarTC, obtenerHistorial, subirHistorialExcel } from '../controllers/tipoCambioController.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', verificarToken, obtenerTC);
router.post('/actualizar', verificarToken, actualizarTC);

router.get('/historial', verificarToken, obtenerHistorial);
router.post('/historial/upload', verificarToken, upload.single('excel'), subirHistorialExcel);

export default router;