import express from 'express';
import { 
  getListasByCliente, 
  getDetalleLista, 
  createListaPrecio,
  updateListaPrecio,
  deleteListaPrecio
} from '../controllers/listasPrecios.controller.js';

const router = express.Router();

router.get('/cliente/:id_cliente', getListasByCliente);
router.get('/:id/detalle', getDetalleLista);
router.post('/', createListaPrecio);
router.put('/:id', updateListaPrecio);
router.delete('/:id', deleteListaPrecio);

export default router;