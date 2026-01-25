import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import path from 'path';

// Configuración
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const storage = multer.memoryStorage();
export const uploadMiddleware = multer({ storage: storage });

export const subirArchivoACloudinary = async (file) => {
  return new Promise((resolve, reject) => {
    
    // Detectamos si es un PDF
    const isPdf = file.originalname.toLowerCase().endsWith('.pdf');
    
    // Configuración dinámica
    const uploadOptions = {
      folder: "indpack_solicitudes",
      // Si es PDF, usamos 'raw' (archivo crudo). Si es imagen, 'auto'.
      resource_type: isPdf ? 'raw' : 'auto',
      // Generamos un nombre único
      public_id: path.parse(file.originalname).name + "_" + Date.now() 
    };

    // TRUCO IMPORTANTE: 
    // Si es modo 'raw', Cloudinary no pone la extensión automáticamente.
    // Se la agregamos al public_id para que el link termine en .pdf y funcione al hacer click.
    if (isPdf) {
      uploadOptions.public_id += '.pdf';
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error("Error subiendo a Cloudinary:", error);
          return reject(error);
        }
        resolve(result);
      }
    );
    
    uploadStream.end(file.buffer);
  });
};