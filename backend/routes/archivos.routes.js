import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Endpoint para servir PDFs desde Cloudinary
router.get('/pdf-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL requerida' });
    }

    // Verificar que sea una URL de Cloudinary
    if (!url.includes('cloudinary.com')) {
      return res.status(403).json({ error: 'URL no permitida' });
    }

    // Obtener el archivo desde Cloudinary
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    // Configurar headers para visualización inline
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    
    // Enviar el PDF
    response.body.pipe(res);
    
  } catch (error) {
    console.error('Error al servir PDF:', error);
    res.status(500).json({ error: 'Error al cargar archivo' });
  }
});

export default router;