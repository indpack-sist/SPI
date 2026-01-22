import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import {
  getAllCompras,
  getCompraById,
  createCompra,
  updateCompra,
  cancelarCompra,
  getCuotasCompra,
  getCuotaById,
  pagarCuota,
  registrarPagoCompra,
  getAlertasCompras,
  getEstadisticasCompras,
  getResumenPagosCompra,
  getHistorialPagosCompra,
  descargarPDFCompra,
  getComprasPorCuenta
} from '../controllers/compras.controller.js';

const router = express.Router();

// Rutas de Reportes y Estadísticas
router.get('/alertas', verificarToken, getAlertasCompras);
router.get('/estadisticas', verificarToken, getEstadisticasCompras);
router.get('/por-cuenta', verificarToken, getComprasPorCuenta);

// Rutas Principales (CRUD)
// Nota: El POST '/' ahora soporta los campos de documento (tipo, serie, numero, fecha)
router.get('/', verificarToken, getAllCompras);
router.post('/', verificarToken, createCompra); 

// Rutas de Documentos
router.get('/:id/pdf', verificarToken, descargarPDFCompra);

// Rutas de Pagos
router.get('/:id/pagos/resumen', verificarToken, getResumenPagosCompra);
router.get('/:id/pagos/historial', verificarToken, getHistorialPagosCompra);
router.post('/:id/pagos', verificarToken, registrarPagoCompra);

// Rutas de Cuotas (Compras a Crédito)
router.get('/:id/cuotas', verificarToken, getCuotasCompra);
router.get('/:id/cuotas/:idCuota', verificarToken, getCuotaById);
router.post('/:id/cuotas/:idCuota/pagar', verificarToken, pagarCuota);

// Rutas de Operaciones sobre una Compra Específica
router.get('/:id', verificarToken, getCompraById);
router.put('/:id', verificarToken, updateCompra);
router.patch('/:id/cancelar', verificarToken, cancelarCompra);

export default router;