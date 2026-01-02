import express from 'express';
import { login, verificarToken, cambiarPassword } from '../controllers/auth.controller.js';
import { verificarToken as verificarTokenMiddleware, obtenerPermisos } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);

router.get('/verificar', verificarToken);

router.get('/permisos', verificarTokenMiddleware, obtenerPermisos);

router.put('/cambiar-password/:id_empleado', verificarTokenMiddleware, cambiarPassword);

export default router;