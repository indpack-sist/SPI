import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

router.get('/pdf-proxy', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL requerida' });
    }

    if (!url.includes('cloudinary.com')) {
      return res.status(403).json({ error: 'URL no permitida' });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(404).json({ error: 'Archivo no encontrado en origen' });
    }

    const contentType = response.headers.get('content-type');

    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

    response.body.pipe(res);

  } catch (error) {
    console.error('Error al servir PDF:', error);
    res.status(500).json({ error: 'Error al cargar archivo' });
  }
});

export default router;