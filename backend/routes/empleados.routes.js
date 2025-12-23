import express from 'express';
import {
  getAllEmpleados,
  getEmpleadoById,
  getEmpleadosByRol,
  validarDNIEmpleado,
  validarEmailEmpleado, // ⚠️ NUEVA FUNCIÓN
  createEmpleado,
  updateEmpleado,
  deleteEmpleado
} from '../controllers/empleados.controller.js';

const router = express.Router();

// ============================================
// RUTAS EXISTENTES
// ============================================
router.get('/', getAllEmpleados);
router.get('/rol/:rol', getEmpleadosByRol);
router.get('/validar-dni/:dni', validarDNIEmpleado);

// ============================================
// NUEVA RUTA: Validar email
// ============================================
router.get('/validar-email/:email', validarEmailEmpleado);

router.get('/:id', getEmpleadoById);
router.post('/', createEmpleado);
router.put('/:id', updateEmpleado);
router.delete('/:id', deleteEmpleado);

export default router;