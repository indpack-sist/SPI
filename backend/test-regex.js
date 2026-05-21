const text = `FACTURA ELECTRÓNICA
RUC: 20550932297
E001-1776

Fecha de Emisión: 18/04/2026
Señor(es) : XIMESA S.A.C.
RUC : 20125508716
Dirección del Receptor de la factura :
AV. NICOLAS AYLLON 2480 Z.I.
Importe Total: S/ 10,148.00`;

const cleanText = text.replace(/\r/g, '\n');
const extractMultiple = (regexes) => {
    for (const r of regexes) {
        const match = cleanText.match(r);
        if (match && match[1]) return match[1].trim();
    }
    return '';
};

console.log('Comprobante:', extractMultiple([
    /(?:FACTURA|BOLETA)[\s\S]{0,100}([EF][A-Z0-9]{3}\s*-\s*\d+)/i,
    /([EF][A-Z0-9]{3}\s*-\s*\d+)/i
]));
console.log('Total:', extractMultiple([
    /(?:Importe\s+)?Total\s*a\s*Pagar\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.)?\s*([\d,]+\.\d{2})/i,
    /Importe\s+Total\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.)?\s*([\d,]+\.\d{2})/i,
    /TOTAL\s*V[E|E]NTA\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.)?\s*([\d,]+\.\d{2})/i,
    /TOTAL\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.)?\s*([\d,]+\.\d{2})/i
]));
console.log('RUC:', extractMultiple([
    /RUC\s+(?:del\s+Cliente|del\s+Receptor)\s*[:\-]?\s*(\d{11})/i,
    /Señor(?:es)?\s*[:\-]?\s*[\s\S]{0,100}RUC\s*[:\-]?\s*(\d{11})/i,
    /(?:Cliente|Receptor).*?\s+RUC\s*[:\-]?\s*(\d{11})/i,
    /RUC\s*[:\-]?\s*(\d{11})(?!\s*FACTURA)/i
]));
console.log('Fecha:', extractMultiple([
    /Fecha\s+de\s+Emisi[oó]n\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
    /Fecha\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
    /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/
]));
