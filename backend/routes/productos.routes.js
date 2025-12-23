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

const router = express.Router();

// ============================================
// RUTAS ESTÁTICAS (sin parámetros)
// ============================================
router.get('/tipos-inventario', getTiposInventario);
router.get('/categorias', getCategorias);
router.get('/con-costo', getAllProductosConCosto);
router.post('/recalcular-cups/todos', recalcularTodosCUP);

// ============================================
// RUTAS DE RECETAS (sin :id de producto)
// ============================================
router.get('/recetas/:idReceta/detalle', getDetalleReceta);
router.post('/recetas', createReceta);
router.put('/recetas/:idReceta', updateReceta);
router.delete('/recetas/:idReceta', deleteReceta);
router.post('/recetas/:idReceta/duplicar', duplicarReceta);

// Items de recetas
router.post('/recetas/items', createRecetaItem);
router.put('/recetas/items/:id', updateRecetaItem);
router.delete('/recetas/items/:id', deleteRecetaItem);

// ============================================
// RUTAS DE PRODUCTOS (base)
// ============================================
router.get('/', getAllProductos);
router.post('/', createProducto);

// ============================================
// RUTAS CON :id (ORDEN IMPORTANTE)
// ============================================
// ✅ RUTAS ESPECÍFICAS PRIMERO (antes del GET /:id)
router.get('/:id/historial-movimientos', getHistorialMovimientos);
router.get('/:id/recetas', getRecetasByProducto);

// ✅ RUTAS CUP - CAMBIADAS A GET
router.get('/:id/calcular-cup-receta', calcularCUPDesdeReceta);
router.get('/:id/evolucion-cup', calcularEvolucionCUP);
router.get('/:id/cup-por-recetas', verCUPPorRecetas);

// ✅ RUTAS GENERICAS AL FINAL
router.get('/:id', getProductoById);
router.put('/:id', updateProducto);
router.delete('/:id', deleteProducto);

export default router;