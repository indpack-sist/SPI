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
  calcularEvolucionCUP
} from '../controllers/productos.controller.js';

import {
  realizarConteoFisico,
  getAjustesPorProducto,
  getMotivosAjuste
} from '../controllers/ajustes.controller.js';

import { verificarToken } from '../middleware/auth.js';

const router = express.Router();

// =====================================================
// IMPORTANTE: Rutas específicas ANTES de rutas con parámetros
// =====================================================

// Tipos y categorías
router.get('/tipos-inventario', getTiposInventario);
router.get('/categorias', getCategorias);

// Productos con costo
router.get('/con-costo', getAllProductosConCosto);

// Recálculo de CUPs
router.post('/recalcular-cups/todos', recalcularTodosCUP);

// =====================================================
// AJUSTES - RUTAS ESPECÍFICAS PRIMERO
// =====================================================
router.get('/ajustes/motivos', getMotivosAjuste);
router.post('/ajustes/conteo-fisico', realizarConteoFisico);

// =====================================================
// RECETAS - Rutas de items y detalle
// =====================================================
router.post('/recetas/items', createRecetaItem);
router.put('/recetas/items/:id', updateRecetaItem);
router.delete('/recetas/items/:id', deleteRecetaItem);

router.get('/recetas/:idReceta/detalle', getDetalleReceta);
router.post('/recetas/:idReceta/duplicar', duplicarReceta);
router.post('/recetas', createReceta);
router.put('/recetas/:idReceta', updateReceta);
router.delete('/recetas/:idReceta', deleteReceta);

// =====================================================
// PRODUCTOS - CRUD básico
// =====================================================
router.get('/', getAllProductos);
router.post('/', createProducto);

// =====================================================
// PRODUCTOS - Rutas con ID (DEBEN IR AL FINAL)
// =====================================================
router.get('/:id/historial-movimientos', getHistorialMovimientos);
router.get('/:id/recetas', getRecetasByProducto);
router.get('/:id/calcular-cup-receta', calcularCUPDesdeReceta);
router.get('/:id/evolucion-cup', calcularEvolucionCUP);
router.get('/:id/cup-por-recetas', verCUPPorRecetas);
router.get('/:id/ajustes', getAjustesPorProducto);

// Estas SIEMPRE al final
router.get('/:id', getProductoById);
router.put('/:id', updateProducto);
router.delete('/:id', deleteProducto);

export default router;