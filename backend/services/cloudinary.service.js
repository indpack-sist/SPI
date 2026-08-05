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

/**
 * Sube contenido de texto (XML firmado, CDR) a Cloudinary como archivo raw.
 * @param {string} nombre     nombre base sin extensión, ej. 20550932297-01-F002-1
 * @param {string} contenido  texto a subir
 * @param {string} folder
 * @param {string} extension  ej. '.xml'
 * @returns {Promise<object>} resultado Cloudinary (con secure_url)
 */
export const subirTextoACloudinary = async (nombre, contenido, folder, extension = '.xml') => {
  return new Promise((resolve, reject) => {
    const publicId = `${nombre.replace(/\s+/g, '_')}${extension}`;
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'raw', public_id: publicId },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    uploadStream.end(Buffer.from(contenido, 'utf8'));
  });
};

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