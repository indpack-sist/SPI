import { v2 as cloudinary } from 'cloudinary';

// Configuración centralizada (usando las variables de Render)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const subirArchivoACloudinary = async (file, folder = 'indpack_solicitudes') => {
  try {
    // Determinamos si es imagen o PDF para aplicar la optimización
    const esImagen = file.mimetype.startsWith('image/');
    
    const opciones = {
      folder: folder,
      resource_type: esImagen ? 'image' : 'raw', // 'raw' es vital para PDFs
      public_id: `${file.originalname.split('.')[0]}_${Date.now()}`,
    };

    // Si es una imagen, aplicamos el Ejemplo 3 (Transform on upload)
    // Esto limita el tamaño a 1200px y baja el peso sin perder calidad visual
    if (esImagen) {
      opciones.width = 1200;
      opciones.height = 1200;
      opciones.crop = "limit";
      opciones.quality = "auto";
    }

    // Retornamos la promesa de subida
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