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

    // Separamos la URL base del path
    const urlParts = decodeURIComponent(url).split('/upload/');
    if (urlParts.length < 2) return res.status(400).json({ error: 'URL mal formada' });
    
    // Esto contiene "v123456/carpeta/archivo.pdf"
    const pathAndVersion = urlParts[1];

    // 1. Extraemos la versión real usando Expresión Regular
    // Captura los números después de la 'v' y antes del '/'
    const versionMatch = pathAndVersion.match(/^v(\d+)\//);
    const version = versionMatch ? versionMatch[1] : null;

    // 2. Extraemos el Public ID limpio (quitando la versión)
    const publicId = pathAndVersion.replace(/^v\d+\//, '');

    // 3. Detectamos el tipo (raw para PDF, image para fotos)
    const resourceType = url.includes('/raw/') ? 'raw' : 'image';

    console.log(`Firma para -> ID: ${publicId} | Versión: ${version} | Tipo: ${resourceType}`);

    // 4. Configuración de opciones para firmar
    const signOptions = {
      resource_type: resourceType,
      sign_url: true,
      secure: true
    };

    // ¡IMPORTANTE! Si tenemos versión, la forzamos. Si no, Cloudinary pondrá v1 y fallará.
    if (version) {
        signOptions.version = version;
    }

    const signedUrl = cloudinary.url(publicId, signOptions);

    console.log("URL Firmada Generada:", signedUrl);

    // 5. Solicitud al servidor de Cloudinary
    const response = await fetch(signedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });

    if (!response.ok) {
      console.error(`Error Cloudinary (${response.status})`);
      return res.status(response.status).json({ error: 'Acceso denegado a Cloudinary' });
    }

    // 6. Configurar cabeceras de respuesta
    if (resourceType === 'raw' || publicId.toLowerCase().endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
    } else {
        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    }
    
    // 'inline' hace que el navegador lo muestre en lugar de descargarlo
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 7. Enviar el archivo al cliente
    response.body.pipe(res);

  } catch (error) {
    console.error('Error Crítico en Proxy:', error.message);
    res.status(500).json({ error: 'Error al procesar el archivo' });
  }
});

export default router;