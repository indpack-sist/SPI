import express from 'express';
import { fotoProxy } from '../controllers/prospectos.controller.js';

// Ruta de medios (fotos de Google Places) servida con token en la URL,
// para que un <img src> del frontend pueda autenticarse sin cabecera.
const router = express.Router();

router.get('/foto', fotoProxy);

export default router;
