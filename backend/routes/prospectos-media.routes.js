import express from 'express';
import { fotoProxy } from '../controllers/prospectos.controller.js';

const router = express.Router();

router.get('/foto', fotoProxy);

export default router;
