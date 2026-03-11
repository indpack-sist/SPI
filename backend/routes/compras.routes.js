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
  cambiarCuentaCompra
} from '../controllers/compras.controller.js';

const router = express.Router();

// Rutas de estadísticas y generales (sin parámetros de ID)
router.get('/alertas', getAlertasCompras);
router.get('/estadisticas', getEstadisticasCompras);
router.get('/por-cuenta', getComprasPorCuenta);

// RUTA CRÍTICA: Descarga de PDF (Debe ir antes de /:id para evitar conflictos)
router.get('/:id/pdf', descargarPDFCompra);

// Rutas de listado y creación
router.get('/', getAllCompras);
router.post('/', createCompra);

// Rutas de gestión de pagos y cronogramas
router.get('/:id/pagos/resumen', getResumenPagosCompra);
router.get('/:id/pagos/historial', getHistorialPagosCompra);
router.post('/:id/pagos', registrarPagoCompra);
router.post('/:id/reembolsos', registrarReembolsoComprador);
router.post('/:id/cronograma', establecerCronograma);

// Rutas de letras
router.post('/:id/letras', registrarLetrasCompra);
router.get('/:id/letras', getLetrasCompra);
router.post('/letras/:idLetra/pagar', pagarLetraCompra);

// Rutas de inventario
router.post('/:id/ingresos', registrarIngresoInventario);
router.get('/:id/ingresos', getIngresosCompra);
router.get('/:id/items-pendientes', getItemsPendientesIngreso);

// Rutas de cuotas
router.get('/:id/cuotas', getCuotasCompra);
router.get('/:id/cuotas/:idCuota', getCuotaById);
router.post('/:id/cuotas/:idCuota/pagar', pagarCuota);

// Rutas de gestión de la orden (ID al final)
router.get('/:id', getCompraById);
router.put('/:id', updateCompra);
router.patch('/:id/cancelar', cancelarCompra);
router.patch('/:id/cambiar-cuenta', cambiarCuentaCompra);

export default router;