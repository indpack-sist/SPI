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

    console.log("Procesando URL:", url);

    const urlParts = decodeURIComponent(url).split('/upload/');
    if (urlParts.length < 2) return res.status(400).json({ error: 'URL mal formada' });

    // Parte crítica: "v1769.../carpeta/archivo.pdf"
    const pathAndVersion = urlParts[1];

    // 1. Extraemos la versión real (Ej: 1769530784)
    const versionMatch = pathAndVersion.match(/^v(\d+)\//);
    const version = versionMatch ? versionMatch[1] : null;

    // 2. Extraemos el Public ID (quitando la versión)
    const publicId = pathAndVersion.replace(/^v\d+\//, '');

    // 3. Detectamos el tipo
    const resourceType = url.includes('/raw/') ? 'raw' : 'image';

    console.log(`Firma para ID: ${publicId} | Versión: ${version} | Tipo: ${resourceType}`);

    // 4. Generamos la URL firmada USANDO LA VERSIÓN EXACTA
    // Si no pasamos la versión, el SDK pone 'v1' y la firma falla.
    const signedUrl = cloudinary.url(publicId, {
      resource_type: resourceType,
      sign_url: true,
      secure: true,
      version: version // <--- ESTO SOLUCIONA EL 401
    });

    // Petición a Cloudinary
    const response = await fetch(signedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });

    if (!response.ok) {
      console.error(`Error Cloudinary (${response.status}) URL: ${signedUrl}`);
      return res.status(response.status).json({ error: 'Acceso denegado a Cloudinary' });
    }

    // Cabeceras correctas
    if (resourceType === 'raw' || publicId.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
    } else {
        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    }
    
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    response.body.pipe(res);

  } catch (error) {
    console.error('Error Proxy:', error.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;