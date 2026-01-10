import express from 'express';
import { 
  getAllEntradas, 
  getEntradaById,
  createEntrada,
  createProductoRapido,    
  updateEntrada, 
  deleteEntrada,
  validarProductosInventario,
  crearProductoMultiInventario,
  generarPDFEntradaController,
  registrarPagoEntrada,
  getPagosEntrada,
  anularPagoEntrada,
  getResumenPagosEntrada
} from '../controllers/movimientos-entradas.controller.js';

const router = express.Router();

router.post('/producto-rapido', createProductoRapido);
router.post('/validar-inventario', validarProductosInventario);
router.post('/crear-multi-inventario', crearProductoMultiInventario);

router.get('/', getAllEntradas);
router.get('/:id', getEntradaById);
router.get('/:id/pdf', generarPDFEntradaController);
router.get('/:id/pagos/resumen', getResumenPagosEntrada);
router.get('/:id/pagos', getPagosEntrada);
router.post('/', createEntrada);
router.post('/:id/pagos', registrarPagoEntrada);
router.delete('/:id/pagos/:idPago', anularPagoEntrada);
router.put('/:id', updateEntrada);
router.delete('/:id', deleteEntrada);

export default router;