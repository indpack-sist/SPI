import express from 'express';
import { 
  getAllSalidas, 
  getSalidaById, 
  createSalidaMultiple,
  updateSalida, 
  deleteSalida,
  getTiposMovimientoSalida,
  generarPDFSalidaController
} from '../controllers/movimientos-salida.controller.js';

const router = express.Router();

router.get('/tipos-movimiento', getTiposMovimientoSalida);

router.get('/', getAllSalidas);
router.get('/:id', getSalidaById);
router.get('/:id/pdf', generarPDFSalidaController);
router.post('/', createSalidaMultiple);
router.put('/:id', updateSalida);
router.delete('/:id', deleteSalida);

export default router;