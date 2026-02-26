import { actualizarTipoCambio, obtenerTipoCambioCache } from '../services/tipo-cambio.service.js';

export const obtenerTC = (req, res) => {
  const resultado = obtenerTipoCambioCache();
  res.json(resultado);
};

export const actualizarTC = async (req, res) => {
  try {
    const resultado = await actualizarTipoCambio();
    res.json(resultado);
  } catch (error) {
    console.error('Error en actualizarTC:', error);
    res.status(500).json({ valido: false, error: 'Error al obtener tipo de cambio' });
  }
};