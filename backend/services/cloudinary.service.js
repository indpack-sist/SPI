import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import path from 'path';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const storage = multer.memoryStorage();
export const uploadMiddleware = multer({ storage: storage });

export const subirArchivoACloudinary = async (file) => {
  return new Promise((resolve, reject) => {
    const isPdf = file.originalname.toLowerCase().endsWith('.pdf');
    
    const uploadOptions = {
      folder: "indpack_solicitudes",
      resource_type: isPdf ? 'raw' : 'auto',
      public_id: path.parse(file.originalname).name.replace(/\s+/g, '_') + "_" + Date.now(),
      // 🔴 NUEVO: Configurar para permitir visualización
      flags: isPdf ? 'attachment' : undefined
    };

    if (isPdf) {
      uploadOptions.public_id += '.pdf';
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          return reject(error);
        }
        
        // 🔴 NUEVO: Si es PDF, generar URL visualizable
        if (isPdf) {
          // Construir URL con flag para inline viewing
          const publicId = result.public_id;
          const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
          
          // URL con fl_attachment para forzar inline display
          result.secure_url = `https://res.cloudinary.com/${cloudName}/raw/upload/fl_attachment/${publicId}`;
        }
        
        resolve(result);
      }
    );
    
    uploadStream.end(file.buffer);
  });
};