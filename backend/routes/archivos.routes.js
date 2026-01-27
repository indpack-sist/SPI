import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

router.get('/pdf-proxy', async (req, res) => {
  try {
    let { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL requerida' });
    }

    if (!url.includes('cloudinary.com')) {
      return res.status(403).json({ error: 'URL no permitida' });
    }

    // Limpieza: Reemplaza fl_attachment por upload para evitar errores de descarga forzada
    let cleanUrl = url.replace('/fl_attachment/', '/upload/');

    // Manejo de caracteres especiales como los paréntesis (1) en la URL
    cleanUrl = encodeURI(decodeURIComponent(cleanUrl));

    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!response.ok) {
      console.error(`Error en origen (${response.status}): ${cleanUrl}`);
      return res.status(404).json({ error: 'Archivo no encontrado en origen' });
    }

    const contentType = response.headers.get('content-type');

    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

    response.body.pipe(res);

  } catch (error) {
    console.error('Error al servir archivo:', error);
    res.status(500).json({ error: 'Error al cargar archivo' });
  }
});

export default router;