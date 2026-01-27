import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

router.get('/pdf-proxy', async (req, res) => {
  try {
    let { url } = req.query;

    if (!url) return res.status(400).json({ error: 'URL requerida' });

    // 1. Limpieza profunda: Quitar fl_attachment y asegurar que use /upload/
    let cleanUrl = url.replace('/fl_attachment/', '/upload/');

    // 2. Normalización de caracteres: Maneja paréntesis, espacios y símbolos especiales
    // decode primero por si viene ya codificada, luego encodeURI para el formato estándar
    cleanUrl = encodeURI(decodeURI(cleanUrl));

    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      console.error(`Error en origen (${response.status}): ${cleanUrl}`);
      return res.status(404).json({ error: 'Archivo no encontrado en origen' });
    }

    // 3. Forzar el Content-Type si es PDF o detectarlo del origen
    const contentType = response.headers.get('content-type');
    const isPdf = cleanUrl.toLowerCase().endsWith('.pdf');

    res.setHeader('Content-Type', isPdf ? 'application/pdf' : (contentType || 'application/octet-stream'));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');

    response.body.pipe(res);

  } catch (error) {
    console.error('Error Crítico en Proxy:', error);
    res.status(500).json({ error: 'Error al procesar el archivo' });
  }
});

export default router;