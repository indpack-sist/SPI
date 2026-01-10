import express from 'express';
import {
  getResumenPagosCobranzas,
  getAllPagosCobranzas
} from '../controllers/pagos-cobranzas.controller.js';

const router = express.Router();

router.get('/resumen', getResumenPagosCobranzas);
router.get('/', getAllPagosCobranzas);

export default router;