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
  actualizarTipoComprobante,
  actualizarDatosTransporte,
  getEstadisticasOrdenesVenta,
  descargarPDFOrdenVenta,
  descargarPDFDespacho,
  registrarPagoOrden,
  getPagosOrden,
  anularPagoOrden,
  getResumenPagosOrden,
  registrarDespacho,
  getSalidasOrden,
  anularDespacho,
  anularOrdenVenta,
  reservarStockOrden,
  ejecutarReservaStock,
  agregarDireccionClienteDesdeOrden,
  rectificarCantidadProducto
} from '../controllers/ordenesVenta.controller.js';
import { getConductores } from '../controllers/empleados.controller.js';
import { getVehiculosParaOrdenes } from '../controllers/flota.controller.js';

const router = express.Router();

router.get('/estadisticas', verificarToken, getEstadisticasOrdenesVenta);
router.get('/catalogo/conductores', verificarToken, getConductores);
router.get('/catalogo/vehiculos', verificarToken, getVehiculosParaOrdenes);

router.post('/direccion-cliente', verificarToken, agregarDireccionClienteDesdeOrden);

router.get('/', verificarToken, getAllOrdenesVenta);
router.post('/', verificarToken, createOrdenVenta);

router.get('/:id/pdf', verificarToken, descargarPDFOrdenVenta);
router.get('/:id/salidas/:idSalida/pdf', verificarToken, descargarPDFDespacho);

router.post('/:id/crear-orden-produccion', verificarToken, crearOrdenProduccionDesdeVenta);
router.post('/:id/reservar', verificarToken, reservarStockOrden);
router.post('/:id/ejecutar-reserva', verificarToken, ejecutarReservaStock);

router.put('/:id/estado', verificarToken, actualizarEstadoOrdenVenta);
router.put('/:id/prioridad', verificarToken, actualizarPrioridadOrdenVenta);
router.put('/:id/tipo-comprobante', verificarToken, actualizarTipoComprobante);
router.put('/:id/transporte', verificarToken, actualizarDatosTransporte);
router.put('/:id/rectificar', verificarToken, rectificarCantidadProducto);

router.delete('/:id/anular', verificarToken, anularOrdenVenta);

router.post('/:id/despacho', verificarToken, registrarDespacho);
router.get('/:id/salidas', verificarToken, getSalidasOrden);
router.delete('/:id/salidas/:idSalida', verificarToken, anularDespacho);

router.get('/:id/pagos/resumen', verificarToken, getResumenPagosOrden);
router.get('/:id/pagos', verificarToken, getPagosOrden);
router.post('/:id/pagos', verificarToken, registrarPagoOrden);
router.delete('/:id/pagos/:idPago', verificarToken, anularPagoOrden);

router.put('/:id', verificarToken, updateOrdenVenta);
router.get('/:id', verificarToken, getOrdenVentaById);

export default router;