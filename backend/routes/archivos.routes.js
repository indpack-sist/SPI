import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

router.get('/pdf-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL requerida' });

    // 1. Limpieza de URL (elimina flags de descarga y decodifica caracteres)
    const targetUrl = decodeURIComponent(url).replace('/fl_attachment/', '/upload/');

    // 2. Autenticación con Cloudinary usando las variables de Render
    // Esto genera el header necesario para que Cloudinary no responda 401
    const auth = Buffer.from(
      `${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`
    ).toString('base64');

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/pdf, */*'
      }
    });

    if (!response.ok) {
      console.error(`Error Cloudinary (${response.status}): ${targetUrl}`);
      return res.status(response.status).json({ 
        error: 'No se pudo acceder al archivo en Cloudinary',
        status: response.status 
      });
    }

    // 3. Configuración de cabeceras para visualización en el navegador
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

    // 4. Stream del archivo al frontend
    response.body.pipe(res);

  } catch (error) {
    console.error('Error Crítico en Proxy:', error.message);
    res.status(500).json({ error: 'Error al procesar el documento' });
  }
});

export default router;