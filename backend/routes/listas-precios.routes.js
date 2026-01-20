import express from 'express';
import { 
  getListasByCliente, 
  getDetalleLista, 
  createListaPrecio 
} from '../controllers/listasPrecios.controller.js';

const router = express.Router();

router.get('/cliente/:id_cliente', getListasByCliente);
router.get('/:id/detalle', getDetalleLista);
router.post('/', createListaPrecio);

export default router;