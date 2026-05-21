import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Parsea un PDF de factura SUNAT y extrae los campos clave usando expresiones regulares.
 * 
 * @param {Buffer} pdfBuffer - El archivo PDF en memoria (Buffer)
 * @returns {Object} JSON con los datos extraídos estructurados
 */
export const parseSunatInvoice = async (pdfBuffer) => {
    try {
        const data = await pdfParse(pdfBuffer);
        const text = data.text;

        // Limpiar el texto para facilitar búsquedas y estandarizar saltos de línea
        const cleanText = text.replace(/\r/g, '\n');

        // Función auxiliar para extraer con regex y capturar el primer grupo
        const extract = (regex, defaultValue = '') => {
            const match = cleanText.match(regex);
            return match ? match[1].trim() : defaultValue;
        };

        const result = {
            emisor: {
                ruc: extract(/R\.U\.C\.\s*(?:N[Nº°]?)?\s*(\d{11})/i),
            },
            comprobante: {
                tipo: 'FACTURA ELECTRÓNICA',
                // Busca el patrón típico de factura (Ej: F001-12345)
                serie_correlativo: extract(/(?:FACTURA ELECTRÓNICA|FACTURA\s+ELECTR[OÓ]NICA)\s*\n*(F[A-Z0-9]{3}\s*-\s*\d+)/i) || extract(/(F[A-Z0-9]{3}\s*-\s*\d+)/i),
                fecha_emision: extract(/Fecha\s+de\s+Emisi[oó]n\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i),
                moneda: extract(/Tipo\s+de\s+Moneda\s*[:\-]?\s*([A-Za-z\s]+)/i) || 'SOLES',
            },
            cliente: {
                // El RUC del cliente suele estar cerca del texto de RUC de receptor o abajo de Señor(es)
                ruc: extract(/RUC\s*(?:del Cliente|del Receptor)?\s*[:\-]?\s*(\d{11})(?!\s*FACTURA)/i) || extract(/Señor\(es\)\s*[:\-]?\s*.*?\nRUC\s*[:\-]?\s*(\d{11})/ims),
                razon_social: extract(/Señor(?:es)?\s*[:\-]?\s*([^\n]+)/i) || extract(/Raz[oó]n\s+Social(?:.*?)\n([^\n]+)/i),
                direccion: extract(/Direcci[oó]n\s+(?:del\s+Cliente|del\s+Receptor)\s*[:\-]?\s*([^\n]+)/i) || extract(/Dirección\s*[:\-]?\s*([^\n]+)\n(?:RUC|Tipo de Moneda)/im)
            },
            totales: {
                subtotal: extract(/Sub\s*Total\s*Ventas\s*[:\-]?\s*(?:S\/|USD)?\s*([\d,]+\.\d{2})/i),
                descuentos: extract(/Descuentos\s*[:\-]?\s*(?:S\/|USD)?\s*([\d,]+\.\d{2})/i),
                valor_venta: extract(/Valor\s*Venta\s*[:\-]?\s*(?:S\/|USD)?\s*([\d,]+\.\d{2})/i),
                igv: extract(/IGV\s*(?:18%|18\.00%)?\s*[:\-]?\s*(?:S\/|USD)?\s*([\d,]+\.\d{2})/i),
                importe_total: extract(/Importe\s*Total\s*[:\-]?\s*(?:S\/|USD)?\s*([\d,]+\.\d{2})/i),
            },
            // raw_text: cleanText // Opcional, para debug
        };

        // Limpieza de espacios en serie_correlativo (Ej: "F001 -  123" -> "F001-123")
        if (result.comprobante.serie_correlativo) {
            result.comprobante.serie_correlativo = result.comprobante.serie_correlativo.replace(/\s+/g, '');
        }

        return result;
    } catch (error) {
        console.error('Error parseando PDF de SUNAT:', error);
        throw new Error('No se pudo procesar el archivo PDF. Asegúrese de que sea un documento legible.');
    }
};