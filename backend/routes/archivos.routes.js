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

    console.log("Procesando URL:", url); // Log para debug en Render

    const urlParts = decodeURIComponent(url).split('/upload/');
    if (urlParts.length < 2) return res.status(400).json({ error: 'URL mal formada' });
    
    // Extraer ID y Tipo
    const publicId = urlParts[1].replace(/^v\d+\//, '');
    
    // CORRECCIÓN CLAVE: Detectar el tipo mirando la URL original
    // Si la URL tiene "/raw/", es un archivo raw (PDF). Si tiene "/image/", es imagen.
    const resourceType = url.includes('/raw/') ? 'raw' : 'image'; 

    console.log(`Generando firma para ID: ${publicId} Tipo: ${resourceType}`);

    const signedUrl = cloudinary.url(publicId, {
      resource_type: resourceType,
      sign_url: true,
      secure: true
    });

    const response = await fetch(signedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });

    if (!response.ok) {
      // Este log aparecerá en tu panel de Render y nos dirá exactamente qué pasó
      console.error(`Error Cloudinary (${response.status}) al pedir: ${signedUrl}`);
      return res.status(response.status).json({ error: 'No se pudo acceder al archivo' });
    }

    // Forzar cabeceras correctas según el tipo real
    if (resourceType === 'raw' || publicId.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
    } else {
        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    }
    
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    response.body.pipe(res);

  } catch (error) {
    console.error('Error Crítico en Proxy:', error.message);
    res.status(500).json({ error: 'Error al procesar el archivo' });
  }
});

export default router;