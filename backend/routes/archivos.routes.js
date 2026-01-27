import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

router.get('/pdf-proxy', async (req, res) => {
  try {
    let { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL requerida' });

    // 1. Limpieza de seguridad y compatibilidad
    // Reemplaza fl_attachment si existe y decodifica para limpiar doble codificación
    let decodedUrl = decodeURIComponent(url).replace('/fl_attachment/', '/upload/');

    // 2. Codificación manual para Cloudinary
    // Cloudinary requiere que los paréntesis ( ) y espacios se envíen de forma precisa
    const cleanUrl = decodedUrl
      .replace(/ /g, '%20')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');

    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': '*/*'
      },
      timeout: 10000
    });

    if (!response.ok) {
      console.error(`Cloudinary Error (${response.status}): ${cleanUrl}`);
      return res.status(response.status).json({ error: 'Archivo no encontrado en Cloudinary' });
    }

    const contentType = response.headers.get('content-type');
    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');

    response.body.pipe(res);

  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.status(500).json({ error: 'Error de conexión con el servidor de archivos' });
  }
});

export default router;