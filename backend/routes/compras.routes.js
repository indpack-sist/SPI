import express from 'express';
import {
  getAllCompras,
  getCompraById,
  createCompra,
  updateCompra,
  cancelarCompra,
  establecerCronograma,
  getCuotasCompra,
  getCuotaById,
  pagarCuota,
  registrarPagoCompra,
  getAlertasCompras,
  getEstadisticasCompras,
  getResumenPagosCompra,
  getHistorialPagosCompra,
  descargarPDFCompra,
  getComprasPorCuenta,
  registrarLetrasCompra,
  getLetrasCompra,
  pagarLetraCompra,
  registrarReembolsoComprador,
  registrarIngresoInventario,
  getIngresosCompra,
  getItemsPendientesIngreso,
  cambiarCuentaCompra,
  parsearXmlFactura
} from '../controllers/compras.controller.js';

const router = express.Router();

router.get('/alertas', getAlertasCompras);
router.get('/estadisticas', getEstadisticasCompras);
router.get('/por-cuenta', getComprasPorCuenta);

router.get('/:id/pdf', descargarPDFCompra);

router.post('/parse-xml', parsearXmlFactura);

router.get('/', getAllCompras);
router.post('/', createCompra);

router.get('/:id/pagos/resumen', getResumenPagosCompra);
router.get('/:id/pagos/historial', getHistorialPagosCompra);
router.post('/:id/pagos', registrarPagoCompra);
router.post('/:id/reembolsos', registrarReembolsoComprador);
router.post('/:id/cronograma', establecerCronograma);

router.post('/:id/letras', registrarLetrasCompra);
router.get('/:id/letras', getLetrasCompra);
router.post('/letras/:idLetra/pagar', pagarLetraCompra);

router.post('/:id/ingresos', registrarIngresoInventario);
router.get('/:id/ingresos', getIngresosCompra);
router.get('/:id/items-pendientes', getItemsPendientesIngreso);

router.get('/:id/cuotas', getCuotasCompra);
router.get('/:id/cuotas/:idCuota', getCuotaById);
router.post('/:id/cuotas/:idCuota/pagar', pagarCuota);

router.get('/:id', getCompraById);
router.put('/:id', updateCompra);
router.patch('/:id/cancelar', cancelarCompra);
router.patch('/:id/cambiar-cuenta', cambiarCuentaCompra);

export default router;