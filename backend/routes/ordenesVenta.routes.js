import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import {
  getAllOrdenesVenta,
  getOrdenVentaById,
  createOrdenVenta,
  updateOrdenVenta,
  crearOrdenProduccionDesdeVenta,
  actualizarEstadoOrdenVenta,
  actualizarPrioridadOrdenVenta,
  getEstadisticasOrdenesVenta,
  descargarPDFOrdenVenta,
  registrarPagoOrden,
  getPagosOrden,
  anularPagoOrden,
  getResumenPagosOrden,
  registrarDespacho,
  getSalidasOrden,
  anularDespacho,
  anularOrdenVenta
} from '../controllers/ordenesVenta.controller.js';

const router = express.Router();

// --- RUTAS GLOBALES (Sin ID de orden) ---
// Es importante que 'estadisticas' vaya antes de '/:id' para que no confunda la palabra con un ID
router.get('/estadisticas', verificarToken, getEstadisticasOrdenesVenta);
router.get('/', verificarToken, getAllOrdenesVenta);
router.post('/', verificarToken, createOrdenVenta);

// --- OPERACIONES SOBRE UNA ORDEN ESPECÍFICA ---
router.get('/:id/pdf', verificarToken, descargarPDFOrdenVenta);
router.post('/:id/crear-orden-produccion', verificarToken, crearOrdenProduccionDesdeVenta);

// Actualizaciones parciales
router.put('/:id/estado', verificarToken, actualizarEstadoOrdenVenta);
router.put('/:id/prioridad', verificarToken, actualizarPrioridadOrdenVenta);

// Anulación
router.delete('/:id/anular', verificarToken, anularOrdenVenta);

// --- GESTIÓN DE DESPACHOS Y SALIDAS ---
router.post('/:id/despacho', verificarToken, registrarDespacho);
router.get('/:id/salidas', verificarToken, getSalidasOrden);
// Nota: Aquí usamos dos parámetros dinámicos (:id de la orden y :idSalida de la salida)
router.delete('/:id/salidas/:idSalida', verificarToken, anularDespacho);

// --- GESTIÓN DE PAGOS ---
router.get('/:id/pagos/resumen', verificarToken, getResumenPagosOrden);
router.get('/:id/pagos', verificarToken, getPagosOrden);
router.post('/:id/pagos', verificarToken, registrarPagoOrden);
router.delete('/:id/pagos/:idPago', verificarToken, anularPagoOrden);

// --- OPERACIONES CRUD BÁSICAS POR ID ---
// Esta debe ir al final o casi al final para no interceptar rutas específicas anteriores
router.put('/:id', verificarToken, updateOrdenVenta);
router.get('/:id', verificarToken, getOrdenVentaById);

export default router;