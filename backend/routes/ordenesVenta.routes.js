import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import { uploadMiddleware } from '../services/cloudinary.service.js';
import {
  verificarOrdenAprobada,
  esVerificador,
  puedeEditarOrdenRechazada
} from '../middleware/verificacionOrden.js';
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
  descargarPDFGuiaInterna,
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
  rectificarCantidadProducto,
  generarGuiaInterna,
  getOrdenesPendientesVerificacion,
  getDatosVerificacionOrden,
  aprobarOrdenVerificacion,
  rechazarOrdenVerificacion,
  reenviarOrdenVerificacion
} from '../controllers/ordenesVenta.controller.js';
import { getConductores } from '../controllers/empleados.controller.js';
import { getVehiculosParaOrdenes } from '../controllers/flota.controller.js';

const router = express.Router();

const uploadArchivos = uploadMiddleware.fields([
  { name: 'orden_compra', maxCount: 1 },
  { name: 'comprobante', maxCount: 1 }
]);

router.get('/estadisticas', verificarToken, getEstadisticasOrdenesVenta);
router.get('/catalogo/conductores', verificarToken, getConductores);
router.get('/catalogo/vehiculos', verificarToken, getVehiculosParaOrdenes);

router.post('/direccion-cliente', verificarToken, agregarDireccionClienteDesdeOrden);

router.get('/verificacion/pendientes', verificarToken, esVerificador, getOrdenesPendientesVerificacion);

router.get('/', verificarToken, getAllOrdenesVenta);
router.post('/', verificarToken, uploadArchivos, createOrdenVenta);

router.get('/:id/pdf', verificarToken, descargarPDFOrdenVenta);
router.get('/:id/pdf-guia-interna', verificarToken, descargarPDFGuiaInterna);
router.get('/:id/salidas/:idSalida/pdf', verificarToken, descargarPDFDespacho);

router.get('/:id/verificacion/datos', verificarToken, esVerificador, getDatosVerificacionOrden);
router.post('/:id/verificacion/aprobar', verificarToken, esVerificador, aprobarOrdenVerificacion);
router.post('/:id/verificacion/rechazar', verificarToken, esVerificador, rechazarOrdenVerificacion);
router.post('/:id/verificacion/reenviar', verificarToken, puedeEditarOrdenRechazada, reenviarOrdenVerificacion);

router.post('/:id/crear-orden-produccion', verificarToken, verificarOrdenAprobada, crearOrdenProduccionDesdeVenta);
router.post('/:id/reservar', verificarToken, verificarOrdenAprobada, reservarStockOrden);
router.post('/:id/ejecutar-reserva', verificarToken, verificarOrdenAprobada, ejecutarReservaStock);
router.post('/:id/guia-interna', verificarToken, verificarOrdenAprobada, generarGuiaInterna);

router.put('/:id/estado', verificarToken, verificarOrdenAprobada, actualizarEstadoOrdenVenta);
router.put('/:id/prioridad', verificarToken, verificarOrdenAprobada, actualizarPrioridadOrdenVenta);
router.put('/:id/tipo-comprobante', verificarToken, verificarOrdenAprobada, actualizarTipoComprobante);
router.put('/:id/transporte', verificarToken, verificarOrdenAprobada, actualizarDatosTransporte);
router.put('/:id/rectificar', verificarToken, verificarOrdenAprobada, rectificarCantidadProducto);

router.delete('/:id/anular', verificarToken, verificarOrdenAprobada, anularOrdenVenta);

router.post('/:id/despacho', verificarToken, verificarOrdenAprobada, registrarDespacho);
router.get('/:id/salidas', verificarToken, getSalidasOrden);
router.delete('/:id/salidas/:idSalida', verificarToken, verificarOrdenAprobada, anularDespacho);

router.get('/:id/pagos/resumen', verificarToken, getResumenPagosOrden);
router.get('/:id/pagos', verificarToken, getPagosOrden);
router.post('/:id/pagos', verificarToken, verificarOrdenAprobada, registrarPagoOrden);
router.delete('/:id/pagos/:idPago', verificarToken, verificarOrdenAprobada, anularPagoOrden);

router.put('/:id', verificarToken, puedeEditarOrdenRechazada, uploadArchivos, updateOrdenVenta);
router.get('/:id', verificarToken, getOrdenVentaById);

export default router;