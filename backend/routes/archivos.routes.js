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

    const pathAndVersion = urlParts[1];

    const versionMatch = pathAndVersion.match(/^v(\d+)\//);
    const version = versionMatch ? versionMatch[1] : null;

    const publicId = pathAndVersion.replace(/^v\d+\//, '');

    const resourceType = url.includes('/raw/') ? 'raw' : 'image';

    console.log(`Firma para -> ID: ${publicId} | Versión: ${version} | Tipo: ${resourceType}`);

    const signOptions = {
      resource_type: resourceType,
      sign_url: true,
      secure: true
    };

    if (version) {
        signOptions.version = version;
    }

    const signedUrl = cloudinary.url(publicId, signOptions);

    console.log("URL Firmada Generada:", signedUrl);

    const response = await fetch(signedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });

    if (!response.ok) {
      console.error(`Error Cloudinary (${response.status})`);
      return res.status(response.status).json({ error: 'Acceso denegado a Cloudinary' });
    }

    if (resourceType === 'raw' || publicId.toLowerCase().endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
    } else {
        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    }

    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');

    response.body.pipe(res);

  } catch (error) {
    console.error('Error Crítico en Proxy:', error.message);
    res.status(500).json({ error: 'Error al procesar el archivo' });
  }
});

export default router;