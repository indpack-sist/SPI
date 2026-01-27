import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import fetch from 'node-fetch';

const router = express.Router();

// El SDK toma las variables CLOUDINARY_CLOUD_NAME, API_KEY y API_SECRET de Render
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

router.get('/pdf-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL requerida' });

    // Extraemos el Public ID para generar la firma de seguridad
    const urlParts = decodeURIComponent(url).split('/upload/');
    if (urlParts.length < 2) return res.status(400).json({ error: 'URL mal formada' });
    
    const publicId = urlParts[1].replace(/^v\d+\//, '');

    // Generamos la URL firmada para autorizar la descarga (Solución al 401)
    const signedUrl = cloudinary.url(publicId, {
      resource_type: 'raw',
      sign_url: true,
      secure: true
    });

    const response = await fetch(signedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) {
      console.error(`Error Cloudinary (${response.status}): ${signedUrl}`);
      return res.status(response.status).json({ error: 'Acceso denegado' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    response.body.pipe(res);

  } catch (error) {
    console.error('Error en Proxy:', error.message);
    res.status(500).json({ error: 'Error al procesar el archivo' });
  }
});

export default router;