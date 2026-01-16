import express from 'express';
import {
  getAllCompras,
  getCompraById,
  createCompra,
  updateCompra,
  cancelarCompra,
  getCuotasCompra,
  getCuotaById,
  pagarCuota,
  getAlertasCompras,
  getEstadisticasCompras,
  getResumenPagosCompra,
  getHistorialPagosCompra,
  descargarPDFCompra,
  getComprasPorCuenta
} from '../controllers/compras.controller.js';

const router = express.Router();

// Rutas de estadísticas y reportes (SIEMPRE PRIMERO)
router.get('/alertas', getAlertasCompras);
router.get('/estadisticas', getEstadisticasCompras);
router.get('/por-cuenta', getComprasPorCuenta);

// Rutas generales
router.get('/', getAllCompras);
router.post('/', createCompra);

// Rutas específicas con paths literales (ANTES de :id)
// Estas deben ir ANTES de cualquier ruta con parámetros dinámicos

// Rutas que dependen del ID pero con paths específicos
router.get('/:id/pdf', descargarPDFCompra);
router.get('/:id/resumen-pagos', getResumenPagosCompra);
router.get('/:id/historial-pagos', getHistorialPagosCompra);
router.get('/:id/cuotas', getCuotasCompra);
router.get('/:id/cuotas/:idCuota', getCuotaById);
router.post('/:id/cuotas/:idCuota/pagar', pagarCuota);

// Rutas generales con :id (SIEMPRE AL FINAL)
router.get('/:id', getCompraById);
router.put('/:id', updateCompra);
router.delete('/:id/cancelar', cancelarCompra);

export default router;