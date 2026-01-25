import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

// Configuración usando variables de entorno (SEGURO)
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

// Configurar Multer para almacenamiento en memoria (RAM)
// Esto permite procesar el archivo sin guardarlo en el disco del servidor
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({ storage: storage });

// Función para subir el buffer a Cloudinary
export const subirArchivoACloudinary = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    // Usamos upload_stream para subir directamente desde la memoria
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "indpack_solicitudes", // Carpeta donde se guardarán
        resource_type: "auto" // Detecta automáticamente si es PDF, JPG, PNG, etc.
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );
    // Finalizamos el stream enviando el buffer del archivo
    uploadStream.end(fileBuffer);
  });
};