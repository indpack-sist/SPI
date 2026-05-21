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

        // Limpiar el texto para facilitar búsquedas y estandarizar saltos de línea
        const cleanText = text.replace(/\r/g, '\n');

        // Función auxiliar para probar múltiples regex y quedarse con la primera que coincida
        const extractMultiple = (regexes, scopeText = cleanText) => {
            for (const r of regexes) {
                const match = scopeText.match(r);
                if (match && match[1]) return match[1].trim();
            }
            return '';
        };

        // El portal SUNAT pone el Emisor arriba. Limitamos el bloque del emisor para el correlativo.
        const emisorBlock = cleanText.substring(0, 800);
        const correlativo = extractMultiple([
            /(?:FACTURA|BOLETA).*?\n*([EF][A-Z0-9]{3}\s*-\s*\d+)/i,
            /([EF][A-Z0-9]{3}\s*-\s*\d+)/i
        ], emisorBlock);

        const result = {
            emisor: {
                ruc: extractMultiple([/R\.?U\.?C\.?\s*(?:N[Nº°]?)?\s*[:\-]?\s*(\d{11})/i], emisorBlock),
            },
            comprobante: {
                tipo: 'FACTURA ELECTRÓNICA',
                serie_correlativo: correlativo,
                // Fecha: Buscamos ": DD/MM/YYYY" que aparezca después de la etiqueta "Fecha de Emisión"
                fecha_emision: extractMultiple([
                    /Fecha\s+(?:de\s+)?Emisi[oó]n[\s\S]{0,800}:\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
                    /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/
                ]),
                moneda: extractMultiple([
                    /Tipo\s+de\s+Moneda[\s\S]{0,800}:\s*([A-Za-z\s]+)/i,
                    /Moneda\s*[:\-]?\s*([A-Za-z\s]+)/i
                ]) || 'SOLES',
            },
            cliente: {
                // RUC Cliente: En SUNAT portal, el RUC está en una columna de valores. 
                // Buscamos 11 dígitos que vengan después de un ":" en el bloque central del PDF
                ruc: extractMultiple([
                    /Señor(?:es)?[\s\S]{0,800}:\s*.*?\s+:\s*(\d{11})/i, // Formato portal SUNAT (Señor : ... RUC : ...)
                    /RUC\s+(?:del\s+Cliente|del\s+Receptor)\s*[:\-]?\s*(\d{11})/i,
                    /RUC[\s\S]{0,800}:\s*(\d{11})/i
                ]),
                razon_social: extractMultiple([
                    /Señor(?:es)?[\s\S]{0,800}:\s*([^\n:]+)/i,
                    /Raz[oó]n\s+Social(?:.*?)\n([^\n]+)/i
                ]),
                direccion: extractMultiple([
                    /Direcci[oó]n\s+(?:del\s+Cliente|del\s+Receptor)(?:\s+de\s+la\s+factura)?[\s\S]{0,800}:\s*([^\n]+)/i,
                    /Dirección\s*[:\-]?\s*([^\n]+)\n(?:RUC|Tipo de Moneda)/im
                ])
            },
            totales: {
                subtotal: extractMultiple([/Sub\s*Total\s*Ventas\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.)?\s*([\d,]+\.\d{2})/i]),
                descuentos: extractMultiple([/Descuentos\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.)?\s*([\d,]+\.\d{2})/i]),
                valor_venta: extractMultiple([/Valor\s*Venta\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.)?\s*([\d,]+\.\d{2})/i]),
                igv: extractMultiple([/IGV\s*(?:18%|18\.00%)?\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.)?\s*([\d,]+\.\d{2})/i]),
                importe_total: extractMultiple([
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