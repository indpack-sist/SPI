import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import fetch from 'node-fetch';

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

router.get('/pdf-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL requerida' });

    const urlParts = decodeURIComponent(url).split('/upload/');
    if (urlParts.length < 2) return res.status(400).json({ error: 'URL mal formada' });
    
    // Extraemos el publicId eliminando la versión (v1234567/)
    const publicId = urlParts[1].replace(/^v\d+\//, '');

    // Generamos la URL firmada. 
    // Nota: El SDK manejará automáticamente si el resource_type es image o raw 
    // basándose en el publicId si lo especificas correctamente.
    const signedUrl = cloudinary.url(publicId, {
      resource_type: url.includes('/raw/') ? 'raw' : 'image',
      sign_url: true,
      secure: true
    });

    const response = await fetch(signedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000 // Evita que Render se quede colgado si Cloudinary tarda
    });

    if (!response.ok) {
      console.error(`Error Cloudinary (${response.status}) para ID: ${publicId}`);
      return res.status(response.status).json({ error: 'Acceso denegado a Cloudinary' });
    }

    // Usamos el Content-Type original de Cloudinary (PDF o Imagen)
    const contentType = response.headers.get('content-type');
    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    response.body.pipe(res);

  } catch (error) {
    console.error('Error Crítico en Proxy:', error.message);
    res.status(500).json({ error: 'Error al procesar el archivo' });
  }
});

export default router;