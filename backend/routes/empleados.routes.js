import express from 'express';
import {
  getAllEmpleados,
  getEmpleadoById,
  getEmpleadosByRol,
  validarDNIEmpleado,
  validarEmailEmpleado, 
  createEmpleado,
  updateEmpleado,
  deleteEmpleado
} from '../controllers/empleados.controller.js';

const router = express.Router();

router.get('/', getAllEmpleados);
router.get('/rol/:rol', getEmpleadosByRol);
router.get('/validar-dni/:dni', validarDNIEmpleado);

router.get('/validar-email/:email', validarEmailEmpleado);

router.get('/:id', getEmpleadoById);
router.post('/', createEmpleado);
router.put('/:id', updateEmpleado);
router.delete('/:id', deleteEmpleado);

export default router;