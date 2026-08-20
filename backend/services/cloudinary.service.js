import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import path from 'path'; // Necesario para manejar extensiones correctamente

// Configuración de Multer
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({ storage: storage });

// Configuración de Cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

export const subirArchivoACloudinary = async (file, folder = 'indpack_solicitudes') => {
  return new Promise((resolve, reject) => {
    try {
      const esImagen = file.mimetype.startsWith('image/');
      const fileExt = path.extname(file.originalname); // Ej: .pdf
      const fileName = path.basename(file.originalname, fileExt); // Ej: Hoja_Ruta

      // Construimos el ID. 
      // IMPORTANTE: Si es PDF (raw), agregamos la extensión al final.
      // Si es Imagen, Cloudinary la maneja automático, no hace falta agregarla.
      const publicId = `${fileName.replace(/\s+/g, '_')}_${Date.now()}${esImagen ? '' : fileExt}`;

      const opciones = {
        folder: folder,
        resource_type: esImagen ? 'image' : 'raw',
        public_id: publicId
      };

      // Optimización solo para imágenes (ahorra espacio)
      if (esImagen) {
        opciones.width = 1200;
        opciones.height = 1200;
        opciones.crop = "limit";
        opciones.quality = "auto";
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        opciones,
        (error, result) => {
          if (error) {
            console.error("Error subiendo a Cloudinary:", error);
            return reject(error);
          }
          resolve(result);
        }
      );
      
      uploadStream.end(file.buffer);

    } catch (error) {
      console.error("Error interno en servicio Cloudinary:", error);
      reject(error);
    }
  });
};

/**
 * Sube un Buffer crudo (XML, ZIP del CDR, etc.) a Cloudinary como resource_type 'raw'.
 * `publicPath` es la ruta lógica incluyendo extensión, ej: 'sunat/xml/20xxx-01-FE01-00000001.xml'.
 * Devuelve la secure_url del archivo. Función NUEVA para el módulo SUNAT; no altera
 * subirArchivoACloudinary (que sigue usándose para uploads vía multer).
 */
export const subirRaw = async (buffer, publicPath, { overwrite = true } = {}) => {
  return new Promise((resolve, reject) => {
    const lastSlash = publicPath.lastIndexOf('/');
    const folder = lastSlash >= 0 ? publicPath.slice(0, lastSlash) : undefined;
    const publicId = lastSlash >= 0 ? publicPath.slice(lastSlash + 1) : publicPath;

    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'raw', folder, public_id: publicId, overwrite },
      (error, result) => {
        if (error) {
          console.error('Error subiendo raw a Cloudinary:', error);
          return reject(error);
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
};