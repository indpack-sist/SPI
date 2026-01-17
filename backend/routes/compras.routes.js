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
  registrarPagoCompra,
  getAlertasCompras,
  getEstadisticasCompras,
  getResumenPagosCompra,
  getHistorialPagosCompra,
  descargarPDFCompra,
  getComprasPorCuenta
} from '../controllers/compras.controller.js';

const router = express.Router();

// ==========================================
// 1. Rutas de Reportes y Estadísticas (Estáticas)
// ==========================================
// Deben ir PRIMERO para evitar conflictos con :id
router.get('/alertas', getAlertasCompras);
router.get('/estadisticas', getEstadisticasCompras);
router.get('/por-cuenta', getComprasPorCuenta);

// ==========================================
// 2. Rutas Principales (CRUD Colección)
// ==========================================
router.get('/', getAllCompras);
router.post('/', createCompra);

// ==========================================
// 3. Rutas de Operaciones Específicas por ID
// ==========================================

// --- Documentos ---
router.get('/:id/pdf', descargarPDFCompra);

// --- Gestión de Pagos Generales ---
router.get('/:id/pagos/resumen', getResumenPagosCompra);
router.get('/:id/pagos/historial', getHistorialPagosCompra);
router.post('/:id/pagos', registrarPagoCompra); // Es más limpio usar /pagos que /pagar

// --- Gestión de Cuotas (Compras a Crédito) ---
router.get('/:id/cuotas', getCuotasCompra);
router.get('/:id/cuotas/:idCuota', getCuotaById);
router.post('/:id/cuotas/:idCuota/pagar', pagarCuota);

// ==========================================
// 4. Rutas CRUD de Recurso Individual (Dinámicas)
// ==========================================
// Deben ir al FINAL para capturar cualquier :id que no coincida con lo anterior

router.get('/:id', getCompraById);
router.put('/:id', updateCompra);

// Usamos PATCH porque es una actualización de estado (Soft Delete), no un borrado físico
router.patch('/:id/cancelar', cancelarCompra); 

export default router;