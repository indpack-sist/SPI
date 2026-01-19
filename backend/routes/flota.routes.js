import express from 'express';
import {
  getAllVehiculos,
  getVehiculoById,
  createVehiculo,
  updateVehiculo,
  deleteVehiculo,
  getVehiculosDisponibles,
  getVehiculosParaOrdenes
} from '../controllers/flota.controller.js';

const router = express.Router();

router.get('/', getAllVehiculos);
router.get('/disponibles', getVehiculosDisponibles);
router.get('/para-ordenes', getVehiculosParaOrdenes);
router.get('/:id', getVehiculoById);
router.post('/', createVehiculo);
router.put('/:id', updateVehiculo);
router.delete('/:id', deleteVehiculo);

export default router;