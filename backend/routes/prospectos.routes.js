import express from 'express';
import {
  getAllProspectos,
  getEstadisticas,
  getFacetas,
  getProspectoById,
  createProspecto,
  ingestaLista,
  updateProspecto,
  cambiarEstado,
  asignarProspecto,
  addContacto,
  deleteContacto,
  convertirACliente,
  descartarProspecto,
  deleteProspecto,
  crearJob,
  listarJobs,
  descubrirEmpresas,
  descubrirTodo,
  enriquecerProspecto,
  excluirProspecto,
} from '../controllers/prospectos.controller.js';

const router = express.Router();

router.get('/', getAllProspectos);
router.get('/estadisticas', getEstadisticas);
router.get('/facetas', getFacetas);
router.get('/jobs', listarJobs);
router.get('/:id', getProspectoById);

router.post('/', createProspecto);
router.post('/ingesta-lista', ingestaLista);
router.post('/descubrir', descubrirEmpresas);
router.post('/descubrir-todo', descubrirTodo);
router.post('/jobs', crearJob);
router.post('/:id/enriquecer', enriquecerProspecto);

router.put('/:id', updateProspecto);
router.patch('/:id/estado', cambiarEstado);
router.patch('/:id/asignar', asignarProspecto);

router.post('/:id/contactos', addContacto);
router.delete('/contactos/:id_contacto', deleteContacto);

router.post('/:id/convertir', convertirACliente);
router.patch('/:id/descartar', descartarProspecto);
router.patch('/:id/excluir', excluirProspecto);
router.delete('/:id', deleteProspecto);

export default router;
