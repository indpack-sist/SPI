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
    
    const extension = path.extname(file.originalname).toLowerCase().replace('.', '');
    
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "indpack_solicitudes", 
        resource_type: "auto",
        format: extension,
        public_id: `${path.parse(file.originalname).name}_${Date.now()}`
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );
    uploadStream.end(file.buffer);
  });
};