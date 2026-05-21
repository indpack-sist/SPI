import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

/**
 * Parsea un PDF de factura SUNAT y extrae los campos clave usando expresiones regulares.
 * 
 * @param {Buffer} pdfBuffer - El archivo PDF en memoria (Buffer)
 * @returns {Object} JSON con los datos extraídos estructurados
 */
export const parseSunatInvoice = async (pdfBuffer) => {
    try {
        const parser = new PDFParse({ data: pdfBuffer });
        const data = await parser.getText();
        const text = data.text || '';
        
        // 1. Limpieza y Normalización
        // Creamos una versión del texto "plana" (sin saltos de línea) para buscar patrones que se rompen entre líneas
        const cleanText = text.replace(/\r/g, '\n');
        const flatText = cleanText.replace(/\n+/g, ' ').replace(/\s+/g, ' ');

        // Función para extraer todos los matches de una regex
        const getAllMatches = (regex, targetText) => {
            const matches = [];
            let match;
            const globalRegex = new RegExp(regex, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
            while ((match = globalRegex.exec(targetText)) !== null) {
                matches.push(match[1] || match[0]);
            }
            return matches;
        };

        // --- EXTRACCIÓN POR PATRONES GLOBALES ---

        // 1. RUCs (Cualquier bloque de 11 dígitos)
        const allRucs = getAllMatches(/(\d{11})/g, flatText);
        
        // 2. Correlativos (E001-123, F001-123)
        const allSeries = getAllMatches(/([EF][A-Z0-9]{3}\s*-\s*\d+)/gi, flatText);
        
        // 3. Fechas (DD/MM/YYYY)
        const allDates = getAllMatches(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/g, flatText);
        
        // 4. Importe Total (Buscamos específicamente "Importe Total" para evitar Subtotales)
        // Probamos primero con una búsqueda más estricta en el texto normalizado
        const totalStrictRegex = /Importe\s+Total\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.|S\/)?\s*([\d,]+\.\d{2})/i;
        const strictMatch = flatText.match(totalStrictRegex);
        
        let importe_total = '';
        if (strictMatch) {
            importe_total = strictMatch[1];
        } else {
            // Si falla, buscamos el último monto que aparezca después de la palabra TOTAL
            const totalMatches = getAllMatches(/(?:TOTAL|PAGAR).*?(?:S\/?|USD|\$|S\/\.|S\/)?\s*([\d,]+\.\d{2})/gi, flatText);
            importe_total = totalMatches.length > 0 ? totalMatches[totalMatches.length - 1] : '';
        }

        // --- HEURÍSTICA DE SELECCIÓN ---
        
        // El primer correlativo que encuentre
        const serie_correlativo = allSeries.length > 0 ? allSeries[0].replace(/\s+/g, '') : '';
        
        // En facturas SUNAT: El 1er RUC es Emisor, el 2do RUC es Cliente.
        const rucEmisor = allRucs[0] || '';
        const rucCliente = allRucs.length >= 2 ? allRucs[1] : (allRucs[0] || '');

        // La primera fecha suele ser la de emisión
        const fecha_emision = allDates[0] || '';

        const result = {
            emisor: { ruc: rucEmisor },
            comprobante: {
                tipo: 'FACTURA ELECTRÓNICA',
                serie_correlativo,
                fecha_emision,
                moneda: flatText.includes('DOLAR') || flatText.includes('USD') || flatText.includes('$') ? 'USD' : 'PEN'
            },
            cliente: {
                ruc: rucCliente,
                razon_social: '', 
                direccion: ''
            },
            totales: {
                importe_total
            }
        };

        return result;

    } catch (error) {
        console.error('Error parseando PDF de SUNAT:', error.message);
        throw new Error(`No se pudo procesar el archivo PDF. Detalle: ${error.message}`);
    }
};