import express from 'express';
import {
  getAllClientes,
  getClienteById,
  getClienteByRuc,
  validarRUCCliente,
  validarDNICliente,
  createCliente,
  updateCliente,
  deleteCliente,
  getHistorialCotizacionesCliente,
  getHistorialOrdenesVentaCliente,
  getEstadoCreditoCliente,
  addDireccionCliente,
  deleteDireccionCliente
} from '../controllers/clientes.controller.js';

const router = express.Router();

router.get('/', getAllClientes);
router.get('/ruc/:ruc', getClienteByRuc);

router.get('/validar-ruc/:ruc', validarRUCCliente);
router.get('/validar-dni/:dni', validarDNICliente);

router.get('/:id', getClienteById);
router.get('/:id/cotizaciones', getHistorialCotizacionesCliente);
router.get('/:id/ordenes-venta', getHistorialOrdenesVentaCliente);
router.get('/:id/credito', getEstadoCreditoCliente);

router.post('/', createCliente);
router.put('/:id', updateCliente);
router.delete('/:id', deleteCliente);

router.post('/:id/direcciones', addDireccionCliente);
router.delete('/direcciones/:id_direccion', deleteDireccionCliente);

export default router;