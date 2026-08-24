import express from 'express';
import {
  getAllEmpleados,
  getEmpleadoById,
  getEmpleadosByRol,
  getConductores,
  validarDNIEmpleado,
  validarEmailEmpleado, 
  createEmpleado,
  updateEmpleado,
  deleteEmpleado,
  reemplazarEmpleado,
  getClientesAsignados,
  updateClientesAsignados
} from '../controllers/empleados.controller.js';

const router = express.Router();

router.get('/', getAllEmpleados);
router.get('/conductores', getConductores);
router.get('/rol/:rol', getEmpleadosByRol);
router.get('/validar-dni/:dni', validarDNIEmpleado);
router.get('/validar-email/:email', validarEmailEmpleado);
router.get('/:id/clientes-asignados', getClientesAsignados);
router.put('/:id/clientes-asignados', updateClientesAsignados);
router.get('/:id', getEmpleadoById);
router.post('/', createEmpleado);
router.post('/:id/reemplazar', reemplazarEmpleado);
router.put('/:id', updateEmpleado);
router.delete('/:id', deleteEmpleado);

export default router;