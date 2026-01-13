import express from 'express';
import {
  getAllClientes,
  getClienteById,
  getClienteByRuc,
  validarRUCCliente,
  validarDNICliente,        // NUEVO
  createCliente,
  updateCliente,
  deleteCliente,
  getHistorialCotizacionesCliente,
  getHistorialOrdenesVentaCliente,
  getEstadoCreditoCliente
} from '../controllers/clientes.controller.js';

const router = express.Router();

// ============================================
// RUTAS DE CONSULTA
// ============================================
router.get('/', getAllClientes);
router.get('/ruc/:ruc', getClienteByRuc);

// VALIDACIONES (deben ir ANTES de /:id para evitar conflictos)
router.get('/validar-ruc/:ruc', validarRUCCliente);
router.get('/validar-dni/:dni', validarDNICliente);  // NUEVO

// RUTAS CON ID
router.get('/:id', getClienteById);
router.get('/:id/cotizaciones', getHistorialCotizacionesCliente);
router.get('/:id/ordenes-venta', getHistorialOrdenesVentaCliente);
router.get('/:id/credito', getEstadoCreditoCliente);

// ============================================
// RUTAS DE MODIFICACIÓN
// ============================================
router.post('/', createCliente);
router.put('/:id', updateCliente);
router.delete('/:id', deleteCliente);

export default router;