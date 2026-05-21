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
        const text = data.text;
        
        // DEBUG: Descomentar para ver qué texto está leyendo realmente el sistema en el log del servidor
        // console.log('--- TEXTO EXTRAIDO DEL PDF ---');
        // console.log(text);
        // console.log('------------------------------');

        // Limpiar el texto para facilitar búsquedas y estandarizar saltos de línea
        const cleanText = text.replace(/\r/g, '\n');

        // Función auxiliar para probar múltiples regex y quedarse con la primera que coincida
        const extractMultiple = (regexes) => {
            for (const r of regexes) {
                const match = cleanText.match(r);
                if (match && match[1]) return match[1].trim();
            }
            return '';
        };

        const result = {
            emisor: {
                ruc: extractMultiple([/R\.?U\.?C\.?\s*(?:N[Nº°]?)?\s*[:\-]?\s*(\d{11})/i]),
            },
            comprobante: {
                tipo: 'FACTURA ELECTRÓNICA',
                // Busca correlativos F o E. Ej: F001-123 o E001-123. Soportamos posibles saltos de linea o basura en medio
                serie_correlativo: extractMultiple([
                    /(?:FACTURA|BOLETA)[\s\S]{0,150}([EF][A-Z0-9]{3}\s*-\s*\d+)/i,
                    /([EF][A-Z0-9]{3}\s*-\s*\d+)/i
                ]),
                fecha_emision: extractMultiple([
                    /Fecha\s+(?:de\s+)?Emisi[oó]n\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
                    /Fecha\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
                    /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/ // Fallback a la primera fecha del documento
                ]),
                moneda: extractMultiple([
                    /Tipo\s+de\s+Moneda\s*[:\-]?\s*([A-Za-z\s]+)/i,
                    /Moneda\s*[:\-]?\s*([A-Za-z\s]+)/i
                ]) || 'SOLES',
            },
            cliente: {
                // RUC del cliente: probamos varios formatos comunes, asegurando que no agarre el RUC del emisor (buscando Señor(es) antes)
                ruc: extractMultiple([
                    /Señor(?:es)?[\s\S]{0,250}RUC\s*[:\-]?\s*(\d{11})/i,
                    /RUC\s+(?:del\s+Cliente|del\s+Receptor)\s*[:\-]?\s*(\d{11})/i,
                    /(?:Cliente|Receptor).*?\s+RUC\s*[:\-]?\s*(\d{11})/i,
                    /RUC\s*[:\-]?\s*(\d{11})(?!\s*(?:FACTURA|BOLETA))/i 
                ]),
                razon_social: extractMultiple([
                    /Señor(?:es)?\s*[:\-]?\s*([^\n]+)/i,
                    /Raz[oó]n\s+Social(?:.*?)\n([^\n]+)/i
                ]),
                direccion: extractMultiple([
                    /Direcci[oó]n\s+(?:del\s+Cliente|del\s+Receptor)(?:\s+de\s+la\s+factura)?\s*[:\-]?\s*([^\n]+)/i,
                    /Dirección\s*[:\-]?\s*([^\n]+)\n(?:RUC|Tipo de Moneda)/im
                ])
            },
            totales: {
                subtotal: extractMultiple([/Sub\s*Total\s*Ventas\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.)?\s*([\d,]+\.\d{2})/i]),
                descuentos: extractMultiple([/Descuentos\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.)?\s*([\d,]+\.\d{2})/i]),
                valor_venta: extractMultiple([/Valor\s*Venta\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.)?\s*([\d,]+\.\d{2})/i]),
                igv: extractMultiple([/IGV\s*(?:18%|18\.00%)?\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.)?\s*([\d,]+\.\d{2})/i]),
                importe_total: extractMultiple([
                    /(?:Importe\s+)?Total\s*a\s*Pagar\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.|S\/)?\s*([\d,]+\.\d{2})/i,
                    /Importe\s+Total\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.|S\/)?\s*([\d,]+\.\d{2})/i,
                    /TOTAL\s*V[E|E]NTA\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.|S\/)?\s*([\d,]+\.\d{2})/i,
                    /TOTAL\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.|S\/)?\s*([\d,]+\.\d{2})/i
                ]),
            },
            // raw_text: cleanText // Opcional, para debug
        };

        // Limpieza de espacios en serie_correlativo (Ej: "F001 -  123" -> "F001-123")
        if (result.comprobante.serie_correlativo) {
            result.comprobante.serie_correlativo = result.comprobante.serie_correlativo.replace(/\s+/g, '');
        }

        return result;
    } catch (error) {
        console.error('Error parseando PDF de SUNAT:', error.message || error);
        throw new Error(`No se pudo procesar el archivo PDF. Detalle: ${error.message || error}`);
    }
};