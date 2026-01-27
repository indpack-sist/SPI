import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import fetch from 'node-fetch';

const router = express.Router();

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

router.get('/pdf-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL requerida' });

    // 1. Extraer el Public ID limpio
    const urlParts = decodeURIComponent(url).split('/upload/');
    if (urlParts.length < 2) return res.status(400).json({ error: 'URL mal formada' });
    
    // Eliminamos la versión (v12345/) para quedarnos con "carpeta/archivo.ext"
    const publicId = urlParts[1].replace(/^v\d+\//, '');

    // 2. Determinar si es PDF o Imagen basándonos en la extensión
    // Esto conecta con la lógica que pusimos en cloudinary.service.js
    const esPdf = publicId.toLowerCase().endsWith('.pdf');
    
    // Si tiene extensión .pdf, obligatoriamente es 'raw'. Si no, asumimos 'image'.
    const resourceType = esPdf ? 'raw' : 'image';

    // 3. Generar la URL firmada
    const signedUrl = cloudinary.url(publicId, {
      resource_type: resourceType,
      sign_url: true,
      secure: true
    });

    // 4. Obtener el archivo desde Cloudinary
    const response = await fetch(signedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000 // Aumentamos un poco el timeout por si el PDF es pesado
    });

    if (!response.ok) {
      console.error(`Error Cloudinary (${response.status}) ID: ${publicId} Tipo: ${resourceType}`);
      return res.status(response.status).json({ error: 'No se pudo acceder al archivo' });
    }

    // 5. Configurar cabeceras para el navegador
    // Forzamos el tipo correcto para que el visor no se confunda
    if (esPdf) {
        res.setHeader('Content-Type', 'application/pdf');
    } else {
        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    }
    
    res.setHeader('Content-Disposition', 'inline'); // 'inline' permite verlo en el navegador sin descargar
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 6. Enviar el stream
    response.body.pipe(res);

  } catch (error) {
    console.error('Error Crítico en Proxy:', error.message);
    res.status(500).json({ error: 'Error al procesar el archivo' });
  }
});

export default router;