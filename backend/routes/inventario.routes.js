import express from 'express';

import {
  getAllEntradas,
  getEntradaById,
  createEntrada,
  updateEntrada,
  deleteEntrada
} from '../controllers/movimientos-entradas.controller.js';

import {
  getAllSalidas,
  getSalidaById,
  createSalida,
  updateSalida,
  deleteSalida,
  getTiposMovimientoSalida
} from '../controllers/movimientos-salida.controller.js';

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

router.get('/entradas', getAllEntradas);
router.get('/entradas/:id', getEntradaById);
router.post('/entradas', createEntrada);
router.put('/entradas/:id', updateEntrada);
router.delete('/entradas/:id', deleteEntrada);

router.get('/salidas/tipos-movimiento', getTiposMovimientoSalida);
router.get('/salidas', getAllSalidas);
router.get('/salidas/:id', getSalidaById);
router.post('/salidas', createSalida);
router.put('/salidas/:id', updateSalida);
router.delete('/salidas/:id', deleteSalida);

router.get('/transferencias', getAllTransferencias);
router.get('/transferencias/resumen-stock', getResumenStockInventario);
router.get('/transferencias/productos-disponibles', getProductosDisponibles);
router.get('/transferencias/:id', getTransferenciaById);

router.post('/transferencias', createTransferenciaMultiple);
router.post('/transferencias/:id/pdf', generarPDFTransferenciaController);
router.delete('/transferencias/:id', deleteTransferencia);

export default router;