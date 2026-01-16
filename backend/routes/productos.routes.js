import express from 'express';
import {
  getAllProductos,
  getProductoById,
  getAllProductosConCosto,
  createProducto,
  updateProducto,
  deleteProducto,
  getHistorialMovimientos,
  getRecetasByProducto,
  getDetalleReceta,
  createReceta,
  updateReceta,
  deleteReceta,
  createRecetaItem,
  updateRecetaItem,
  deleteRecetaItem,
  duplicarReceta,
  getTiposInventario,
  getCategorias,
  calcularCUPDesdeReceta,
  recalcularTodosCUP,
  verCUPPorRecetas,
  calcularEvolucionCUP,
  getHistorialComprasProducto
} from '../controllers/productos.controller.js';

import {
  realizarConteoFisico,
  getAjustesPorProducto,
  getMotivosAjuste
} from '../controllers/ajustes.controller.js';

import { verificarToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/tipos-inventario', getTiposInventario);
router.get('/categorias', getCategorias);

router.get('/con-costo', getAllProductosConCosto);
router.post('/recalcular-cups/todos', recalcularTodosCUP);


router.get('/ajustes/motivos', getMotivosAjuste);
router.post('/ajustes/conteo-fisico', realizarConteoFisico);

router.post('/recetas/items', createRecetaItem);
router.put('/recetas/items/:id', updateRecetaItem);
router.delete('/recetas/items/:id', deleteRecetaItem);

router.get('/recetas/:idReceta/detalle', getDetalleReceta);
router.post('/recetas/:idReceta/duplicar', duplicarReceta);
router.post('/recetas', createReceta);
router.put('/recetas/:idReceta', updateReceta);
router.delete('/recetas/:idReceta', deleteReceta);


router.get('/', getAllProductos);
router.post('/', createProducto);
router.get('/:id/historial-compras', getHistorialComprasProducto);
router.get('/:id/historial-movimientos', getHistorialMovimientos);
router.get('/:id/recetas', getRecetasByProducto);
router.get('/:id/calcular-cup-receta', calcularCUPDesdeReceta);
router.get('/:id/evolucion-cup', calcularEvolucionCUP);
router.get('/:id/cup-por-recetas', verCUPPorRecetas);
router.get('/:id/ajustes', getAjustesPorProducto);

router.get('/:id', getProductoById);
router.put('/:id', updateProducto);
router.delete('/:id', deleteProducto);

export default router;