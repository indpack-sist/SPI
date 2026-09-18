import express from 'express';
import {
  getAllProspectos,
  exportarProspectosExcel,
  getEstadisticas,
  getFacetas,
  getBarridos,
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
  liberarProspecto,
  deleteProspecto,
  crearJob,
  listarJobs,
  getLotesActivos,
  descubrirEmpresas,
  descubrirTodo,
  padronStats,
  descubrirPadron,
  enriquecerProspecto,
  redescubrirProspecto,
  redescubrirMasivo,
  enriquecerMasivo,
  buscarRucProspecto,
  excluirProspecto,
} from '../controllers/prospectos.controller.js';

const router = express.Router();

router.get('/', getAllProspectos);
router.get('/export/excel', exportarProspectosExcel);
router.get('/estadisticas', getEstadisticas);
router.get('/facetas', getFacetas);
router.get('/barridos', getBarridos);
router.get('/jobs', listarJobs);
router.get('/lotes-activos', getLotesActivos);
router.get('/padron/stats', padronStats);
router.get('/:id', getProspectoById);

router.post('/', createProspecto);
router.post('/ingesta-lista', ingestaLista);
router.post('/descubrir', descubrirEmpresas);
router.post('/descubrir-todo', descubrirTodo);
router.post('/descubrir-padron', descubrirPadron);
router.post('/jobs', crearJob);
router.post('/enriquecer-masivo', enriquecerMasivo);
router.post('/redescubrir-masivo', redescubrirMasivo);
router.post('/:id/enriquecer', enriquecerProspecto);
router.post('/:id/redescubrir', redescubrirProspecto);
router.post('/:id/buscar-ruc', buscarRucProspecto);

router.put('/:id', updateProspecto);
router.patch('/:id/estado', cambiarEstado);
router.patch('/:id/asignar', asignarProspecto);

router.post('/:id/contactos', addContacto);
router.delete('/contactos/:id_contacto', deleteContacto);

router.post('/:id/convertir', convertirACliente);
router.patch('/:id/descartar', descartarProspecto);
router.patch('/:id/liberar', liberarProspecto);
router.patch('/:id/excluir', excluirProspecto);
router.delete('/:id', deleteProspecto);

export default router;
