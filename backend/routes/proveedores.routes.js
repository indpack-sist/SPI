import express from 'express';
import {
  getAllProveedores,
  getProveedorById,
  getProveedorByRuc,
  validarRUCProveedor, 
  createProveedor,
  updateProveedor,
  deleteProveedor
} from '../controllers/proveedores.controller.js';

const router = express.Router();

router.get('/', getAllProveedores);
router.get('/ruc/:ruc', getProveedorByRuc);
router.get('/validar-ruc/:ruc', validarRUCProveedor);
router.get('/:id', getProveedorById);
router.post('/', createProveedor);
router.put('/:id', updateProveedor);
router.delete('/:id', deleteProveedor);

export default router;