const text = `FACTURA ELECTRÓNICA
RUC: 20550932297
E001-1776
Forma de pago: Crédito
GUIA DE REMISION
REMITENTE :EG07 - 132
Descripción Valor Unitario ICBPER
4000 UNIDAD EPV180GO
03 ESQUINERO PLASTICO VERDE 2.40 MTS 2.15 0.00
Sub Total Ventas : S/ 8,600.00
Anticipos : S/0.00
Valor de Venta de Operaciones Gratuitas: S/0.00 Descuentos : S/0.00
Valor Venta: S/8,600.00
ISC: S/0.00
IGV: S/ 1,548.00 SON: DIEZ MIL CIENTO CUARENTA Y OCHO Y 00/100 SOLES
Número de Contrato : ICBPER : S/0.00
Orden de Compra : L202600251 Otros Cargos S/0.00
Otros Tributos : S/0.00
Monto de Redondeo : S/0.00
Importe Total: S/ 10,148.00 Fecha de Emisión
Señor(es)
RUC
Dirección del Receptor de la
Factura
Dirección del Cliente
Tipo de Moneda
Observación
: 20/03/2026
: XIMESA S.A.C.
: 20125508716
: AV. NICOLAS AYLLON 2480 Z.I. SANTA
ANGELICA A 3 CDRS. PUENTE STA.ANITA
CARR.CENTRAL LIMA LIMA ATE
AV. NICOLAS AYLLON 2480 Z.I. SANTA
: ANGELICA A 3 CDRS. PUENTE STA.ANITACARR.CENTRAL LIMA-LIMA-ATE
: SOL`;

const cleanText = text.replace(/\r/g, '\n');

const extractMultiple = (regexes) => {
    for (const r of regexes) {
        const match = cleanText.match(r);
        if (match && match[1]) return match[1].trim();
    }
    return '';
};

// Buscamos el bloque de arriba (Emisor + Correlativo)
const emisorBlock = cleanText.substring(0, 500);
const correlativo = emisorBlock.match(/(?:FACTURA|BOLETA).*?\n*([EF][A-Z0-9]{3}\s*-\s*\d+)/i)?.[1] || 
                    emisorBlock.match(/([EF][A-Z0-9]{3}\s*-\s*\d+)/i)?.[1] || '';

// Buscamos el bloque de etiquetas para saber dónde buscar los valores
const rucLabelIndex = cleanText.indexOf('RUC\nDirección'); 
const total = extractMultiple([/Importe\s+Total\s*[:\-]?\s*(?:S\/?|USD|\$|S\/\.|S\/)?\s*([\d,]+\.\d{2})/i]);

// RUC CLIENTE: Buscamos 11 dígitos que aparezcan DESPUÉS de Señor(es) y que tengan un ":" cerca
const rucCliente = extractMultiple([
    /Señor(?:es)?[\s\S]{0,600}:\s*.*?\s+:\s*(\d{11})/i,
    /RUC[\s\S]{0,600}:\s*(\d{11})/i
]);

const fechaEmision = extractMultiple([
    /Fecha\s+(?:de\s+)?Emisi[oó]n[\s\S]{0,600}:\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i
]);

console.log('Correlativo:', correlativo);
console.log('Total:', total);
console.log('RUC Cliente:', rucCliente);
console.log('Fecha:', fechaEmision);
