import express from 'express';
import { 
  getAllTransferencias,
  getTransferenciaById,
  createTransferenciaMultiple,
  deleteTransferencia,
  getProductosDisponibles,
  getResumenStockInventario,
  generarPDFTransferenciaController
} from '../controllers/transferencias.controller.js';

const router = express.Router();

router.get('/resumen-stock', getResumenStockInventario);
router.get('/productos-disponibles', getProductosDisponibles);


router.get('/', getAllTransferencias);
router.get('/:id', getTransferenciaById);
router.get('/:id/pdf', generarPDFTransferenciaController);
router.post('/', createTransferenciaMultiple);
router.delete('/:id', deleteTransferencia);

export default router;