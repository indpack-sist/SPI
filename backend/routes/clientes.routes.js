import express from 'express';
import {
  getAllClientes,
  getClienteById,
  getClienteByRuc,
  validarRUCCliente,
  createCliente,
  updateCliente,
  deleteCliente,
  getHistorialCotizacionesCliente,
  getHistorialOrdenesVentaCliente,
  getEstadoCreditoCliente
} from '../controllers/clientes.controller.js';

const router = express.Router();

router.get('/', getAllClientes);
router.get('/ruc/:ruc', getClienteByRuc);
router.get('/validar-ruc/:ruc', validarRUCCliente);
router.get('/:id', getClienteById);
router.get('/:id/cotizaciones', getHistorialCotizacionesCliente);
router.get('/:id/ordenes-venta', getHistorialOrdenesVentaCliente);
router.get('/:id/credito', getEstadoCreditoCliente);

router.post('/', createCliente);
router.put('/:id', updateCliente);
router.delete('/:id', deleteCliente);

export default router;