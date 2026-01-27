import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

router.get('/pdf-proxy', async (req, res) => {
  try {
    let { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Falta URL' });

    // 1. Limpieza de URL para compatibilidad con registros antiguos y nuevos
    let cleanUrl = url.replace('/fl_attachment/', '/upload/');
    cleanUrl = encodeURI(decodeURI(cleanUrl));

    const response = await fetch(cleanUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': '*/*'
      },
      timeout: 15000 // Evita que el servidor se quede colgado si Cloudinary no responde
    });

    if (!response.ok) {
      console.error(`Error en origen (${response.status}): ${cleanUrl}`);
      return res.status(response.status).json({ error: 'Archivo no encontrado en Cloudinary' });
    }

    // 2. Detección dinámica del tipo de archivo (PDF o Imagen)
    const contentType = response.headers.get('content-type');
    
    // 3. Configuración de cabeceras para visualización segura
    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Previene bloqueos de CORS
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Optimiza la carga repetida

    response.body.pipe(res);

  } catch (error) {
    console.error('Error Proxy Crítico:', error.message);
    res.status(500).json({ error: 'Error de conexión con el servidor de archivos' });
  }
});

export default router;