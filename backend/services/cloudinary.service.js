import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer'; //

// Configuración de Multer para recibir archivos en memoria
const storage = multer.memoryStorage(); //
export const uploadMiddleware = multer({ storage: storage }); // ESTO ES LO QUE FALTA

// Configuración de Cloudinary (Render usará estas variables automáticamente)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const subirArchivoACloudinary = async (file, folder = 'indpack_solicitudes') => {
  try {
    const esImagen = file.mimetype.startsWith('image/');
    
    const opciones = {
      folder: folder,
      resource_type: esImagen ? 'image' : 'raw',
      public_id: `${file.originalname.split('.')[0]}_${Date.now()}`,
    };

    // Optimización automática para imágenes (Ejemplo 3 del SDK)
    if (esImagen) {
      opciones.width = 1200;
      opciones.height = 1200;
      opciones.crop = "limit";
      opciones.quality = "auto";
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        opciones,
        (error, result) => {
          if (error) {
            console.error("Error en el stream de Cloudinary:", error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      
      uploadStream.end(file.buffer);
    });
  } catch (error) {
    console.error("Error en servicio Cloudinary:", error);
    throw error;
  }
};