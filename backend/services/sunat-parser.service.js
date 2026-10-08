import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

export const parseSunatInvoice = async (pdfBuffer) => {
    try {
        const parser = new PDFParse({ data: pdfBuffer });
        const data = await parser.getText();
        const text = data.text || '';

        const cleanText = text.replace(/\r/g, '\n');
        const flatText = cleanText.replace(/\n+/g, ' ').replace(/\s+/g, ' ');

        const getAllMatches = (regex, targetText) => {
            const matches = [];
            let match;
            const globalRegex = new RegExp(regex, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
            while ((match = globalRegex.exec(targetText)) !== null) {
                matches.push(match[1] || match[0]);
            }
            return matches;
        };

        const allRucs = getAllMatches(/(\d{11})/g, flatText);

        const allSeries = getAllMatches(/([EF][A-Z0-9]{3}\s*-\s*\d+)/gi, flatText);

        const allDates = getAllMatches(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/g, flatText);

        const totalStrictRegex = /Importe\s+Total\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.|S\/)?\s*([\d,]+\.\d{2})/i;
        const strictMatch = flatText.match(totalStrictRegex);

        let importe_total = '';
        if (strictMatch) {
            importe_total = strictMatch[1];
        } else {
            const totalMatches = getAllMatches(/(?:TOTAL|PAGAR).*?(?:S\/?|USD|\$|S\/\.|S\/)?\s*([\d,]+\.\d{2})/gi, flatText);
            importe_total = totalMatches.length > 0 ? totalMatches[totalMatches.length - 1] : '';
        }

        const serie_correlativo = allSeries.length > 0 ? allSeries[0].replace(/\s+/g, '') : '';

        const rucEmisor = allRucs[0] || '';
        const rucCliente = allRucs.length >= 2 ? allRucs[1] : (allRucs[0] || '');

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