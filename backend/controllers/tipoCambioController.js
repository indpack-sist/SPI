import { actualizarTipoCambio, obtenerTipoCambioCache } from '../services/tipo-cambio.service.js';
import { executeQuery, pool } from '../config/database.js';
import * as xlsx from 'xlsx';

export const obtenerTC = (req, res) => {
  const resultado = obtenerTipoCambioCache();
  res.json(resultado);
};

export const actualizarTC = async (req, res) => {
  try {
    const resultado = await actualizarTipoCambio();
    res.json(resultado);
  } catch (error) {
    console.error('Error en actualizarTC:', error);
    res.status(500).json({ valido: false, error: 'Error al obtener tipo de cambio' });
  }
};

export const obtenerHistorial = async (req, res) => {
  try {
    const { mes, anio } = req.query;
    if (!mes || !anio) {
      return res.status(400).json({ success: false, error: 'Se requiere mes y anio' });
    }

    const query = `
      SELECT fecha, compra, venta, promedio, origen
      FROM tipo_cambio_historico
      WHERE MONTH(fecha) = ? AND YEAR(fecha) = ?
      ORDER BY fecha ASC
    `;
    const historial = await executeQuery(query, [mes, anio]);
    
    res.json({ success: true, data: historial.success ? historial.data : [] });
  } catch (error) {
    console.error('Error en obtenerHistorial:', error);
    res.status(500).json({ success: false, error: 'Error al obtener el historial' });
  }
};

export const subirHistorialExcel = async (req, res) => {
  try {
    const { mes, anio } = req.body;
    
    if (!mes || !anio) {
      return res.status(400).json({ success: false, error: 'Se requiere el mes y el año para la carga' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se subió ningún archivo' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Columns should be: FECHA | TC. COMER. | VENTA FP | COMPRA FP
    const insertedRecords = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowArr = Object.values(row);
      
      if (rowArr.length >= 4) {
        let fechaExcel = rowArr[0]; // Ej: "01/05/2026" o número serial excel
        let venta = parseFloat(rowArr[2]);
        let compra = parseFloat(rowArr[3]);
        
        if (!isNaN(compra) && !isNaN(venta)) {
          let promedio = (compra + venta) / 2;
          let fecha = null;
          
          // Parsear la fecha del Excel
          if (typeof fechaExcel === 'number') {
            // Es un número de serie de Excel (días desde 1/1/1900)
            const excelEpoch = new Date(1899, 11, 30);
            const dateObj = new Date(excelEpoch.getTime() + fechaExcel * 86400000);
            fecha = dateObj.toISOString().split('T')[0];
          } else if (typeof fechaExcel === 'string') {
             // Asumimos formato DD/MM/YYYY
             const parts = fechaExcel.split('/');
             if (parts.length === 3) {
               fecha = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
             } else {
                 // Fallback por si la fecha viene mal formada pero conocemos el mes y anio de la peticion
                 // Intenta extraer solo el día
                 const maybeDay = parseInt(fechaExcel.replace(/\D/g, '').substring(0,2));
                 if(!isNaN(maybeDay) && maybeDay > 0 && maybeDay <= 31) {
                     fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(maybeDay).padStart(2, '0')}`;
                 }
             }
          }

          if (fecha) {
              insertedRecords.push([fecha, compra, venta, promedio, 'EXCEL_SUNAT']);
          }
        }
      }
    }
    
    if (insertedRecords.length === 0) {
       return res.status(400).json({ success: false, error: 'No se encontraron datos válidos en el archivo' });
    }

    const query = `
      INSERT INTO tipo_cambio_historico (fecha, compra, venta, promedio, origen)
      VALUES ?
      ON DUPLICATE KEY UPDATE 
      compra = VALUES(compra), venta = VALUES(venta), promedio = VALUES(promedio), origen = VALUES(origen)
    `;
    
    await executeQuery(query, [insertedRecords]);

    res.json({ success: true, message: `Se importaron ${insertedRecords.length} registros exitosamente.` });
  } catch (error) {
    console.error('Error en subirHistorialExcel:', error);
    res.status(500).json({ success: false, error: 'Error interno procesando el archivo Excel.' });
  }
};
rchivo Excel.' });
  }
};
