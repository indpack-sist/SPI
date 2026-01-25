import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import { 
    getReporteComprasSIRE, 
    getReporteVentasSIRE 
} from '../controllers/reportes.controller.js';

const router = express.Router();

router.get('/sire/compras', verificarToken, getReporteComprasSIRE);
router.get('/sire/ventas', verificarToken, getReporteVentasSIRE);

export default router;