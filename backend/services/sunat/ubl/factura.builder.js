/**
 * Constructor de XML UBL 2.1 para Factura electrónica (SEE SUNAT).
 *
 * Genera el documento SIN firmar, con <ext:ExtensionContent> vacío listo para
 * que firma.service.js inserte la firma. IMPORTANTE: la raíz NO declara xmlns:ds
 * (el namespace ds solo aparece en el <ds:Signature> que agrega la firma).
 *
 * Soporta:
 *   - Gravado 18% (tipo operación 0101, afectación 10)
 *   - Exportación 0% (tipo operación 0200, afectación 40)
 */
import { SIGNATURE_ID } from '../firma.service.js';
import { montoALetras } from './numero-a-letras.js';

// Catálogo 7 (afectación IGV) -> configuración de tributo
const AFECTACION = {
  '10': { percent: 18, schemeId: '1000', name: 'IGV', typeCode: 'VAT', gravado: true },   // Gravado
  '40': { percent: 0, schemeId: '9995', name: 'EXP', typeCode: 'FRE', gravado: false },   // Exportación
};

// --- Helpers de formato ---
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const f2 = (n) => Number(n || 0).toFixed(2);
const fNum = (n) => {
  // hasta 10 decimales, sin ceros de más, mínimo sin decimales forzados
  const v = parseFloat(Number(n || 0).toFixed(10));
  return String(v);
};

/**
 * @param {object} d
 * @param {string} d.serie              F001
 * @param {number} d.correlativo        123
 * @param {Date}   d.fechaEmision
 * @param {string} d.tipoOperacion      '0101' | '0200'
 * @param {string} d.moneda             'PEN' | 'USD'
 * @param {object} d.emisor             { ruc, razonSocial, nombreComercial, ubigeo, direccion, distrito, provincia, departamento }
 * @param {object} d.cliente            { tipoDoc, numDoc, razonSocial, direccion }
 * @param {Array}  d.lineas             [{ cantidad, unidad, descripcion, codigoProducto, valorUnitario, afectacion }]
 * @returns {{ xml: string, nombreArchivo: string, totales: object }}
 */
export function construirFacturaXml(d) {
  const cur = d.moneda;
  const fecha = d.fechaEmision instanceof Date ? d.fechaEmision : new Date(d.fechaEmision);
  const fechaEmision = fecha.toISOString().slice(0, 10);
  const horaEmision = fecha.toISOString().slice(11, 19);

  // --- Cálculo de líneas ---
  let totalGravado = 0;
  let totalExportacion = 0;
  let totalIGV = 0;

  const lineasXml = d.lineas
    .map((ln, i) => {
      const afect = ln.afectacion || (d.tipoOperacion === '0200' ? '40' : '10');
      const cfg = AFECTACION[afect];
      if (!cfg) throw new Error(`Afectación IGV no soportada: ${afect}`);

      const valorVenta = round2(ln.cantidad * ln.valorUnitario);
      const igvLinea = cfg.gravado ? round2(valorVenta * (cfg.percent / 100)) : 0;
      const precioVentaUnit = cfg.gravado ? ln.valorUnitario * (1 + cfg.percent / 100) : ln.valorUnitario;

      if (cfg.gravado) totalGravado += valorVenta;
      else totalExportacion += valorVenta;
      totalIGV += igvLinea;

      return `    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${esc(ln.unidad)}">${fNum(ln.cantidad)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${cur}">${f2(valorVenta)}</cbc:LineExtensionAmount>
      <cac:PricingReference>
        <cac:AlternativeConditionPrice>
          <cbc:PriceAmount currencyID="${cur}">${fNum(round2(precioVentaUnit))}</cbc:PriceAmount>
          <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
        </cac:AlternativeConditionPrice>
      </cac:PricingReference>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${cur}">${f2(igvLinea)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="${cur}">${f2(valorVenta)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="${cur}">${f2(igvLinea)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:Percent>${f2(cfg.percent)}</cbc:Percent>
            <cbc:TaxExemptionReasonCode>${afect}</cbc:TaxExemptionReasonCode>
            <cac:TaxScheme>
              <cbc:ID>${cfg.schemeId}</cbc:ID>
              <cbc:Name>${cfg.name}</cbc:Name>
              <cbc:TaxTypeCode>${cfg.typeCode}</cbc:TaxTypeCode>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Description>${esc(ln.descripcion)}</cbc:Description>
        ${ln.codigoProducto ? `<cac:SellersItemIdentification><cbc:ID>${esc(ln.codigoProducto)}</cbc:ID></cac:SellersItemIdentification>` : ''}
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${cur}">${fNum(round2(ln.valorUnitario))}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
    })
    .join('\n');

  const totalVenta = round2(totalGravado + totalExportacion + totalIGV);

  // --- TaxTotal de cabecera ---
  const subtotalesTax = [];
  if (totalGravado > 0) subtotalesTax.push(taxSubtotal(cur, totalGravado, totalIGV, AFECTACION['10']));
  if (totalExportacion > 0) subtotalesTax.push(taxSubtotal(cur, totalExportacion, 0, AFECTACION['40']));

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${esc(d.serie)}-${d.correlativo}</cbc:ID>
  <cbc:IssueDate>${fechaEmision}</cbc:IssueDate>
  <cbc:IssueTime>${horaEmision}</cbc:IssueTime>
  <cbc:InvoiceTypeCode listID="${d.tipoOperacion}">01</cbc:InvoiceTypeCode>
  <cbc:Note languageLocaleID="1000">${esc(montoALetras(totalVenta))}</cbc:Note>
  <cbc:DocumentCurrencyCode>${cur}</cbc:DocumentCurrencyCode>
  <cac:Signature>
    <cbc:ID>${esc(d.emisor.ruc)}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification><cbc:ID>${esc(d.emisor.ruc)}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${esc(d.emisor.razonSocial)}</cbc:Name></cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference><cbc:URI>#${SIGNATURE_ID}</cbc:URI></cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="6">${esc(d.emisor.ruc)}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${esc(d.emisor.nombreComercial || d.emisor.razonSocial)}</cbc:Name></cac:PartyName>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(d.emisor.razonSocial)}</cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:ID>${esc(d.emisor.ubigeo)}</cbc:ID>
          <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
          <cbc:CityName>${esc(d.emisor.provincia)}</cbc:CityName>
          <cbc:CountrySubentity>${esc(d.emisor.departamento)}</cbc:CountrySubentity>
          <cbc:District>${esc(d.emisor.distrito)}</cbc:District>
          <cac:AddressLine><cbc:Line>${esc(d.emisor.direccion)}</cbc:Line></cac:AddressLine>
          <cac:Country><cbc:IdentificationCode>PE</cbc:IdentificationCode></cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="${esc(d.cliente.tipoDoc)}">${esc(d.cliente.numDoc)}</cbc:ID></cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(d.cliente.razonSocial)}</cbc:RegistrationName>
        ${d.cliente.direccion ? `<cac:RegistrationAddress><cac:AddressLine><cbc:Line>${esc(d.cliente.direccion)}</cbc:Line></cac:AddressLine></cac:RegistrationAddress>` : ''}
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
${bloqueFormaPago(d, cur, totalVenta)}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${cur}">${f2(totalIGV)}</cbc:TaxAmount>
${subtotalesTax.join('\n')}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${cur}">${f2(totalGravado + totalExportacion)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${cur}">${f2(totalVenta)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${cur}">${f2(totalVenta)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lineasXml}
</Invoice>`;

  return {
    xml,
    nombreArchivo: `${d.emisor.ruc}-01-${d.serie}-${d.correlativo}`,
    totales: {
      gravado: round2(totalGravado),
      exportacion: round2(totalExportacion),
      igv: round2(totalIGV),
      total: totalVenta,
    },
  };
}

/**
 * Bloque Forma de Pago (obligatorio, error 3244 si falta).
 * Contado: una sola línea. Crédito: total + N cuotas con vencimiento.
 * d.formaPago = 'Contado' | 'Credito'; d.cuotas = [{ monto, fechaVencimiento }]
 */
function bloqueFormaPago(d, cur, total) {
  const forma = d.formaPago === 'Credito' ? 'Credito' : 'Contado';
  if (forma === 'Contado') {
    return `  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>Contado</cbc:PaymentMeansID>
  </cac:PaymentTerms>`;
  }
  const cuotas = (d.cuotas || []).map((c, i) => {
    const n = String(i + 1).padStart(3, '0');
    const venc = (c.fechaVencimiento instanceof Date ? c.fechaVencimiento : new Date(c.fechaVencimiento))
      .toISOString()
      .slice(0, 10);
    return `  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>Cuota${n}</cbc:PaymentMeansID>
    <cbc:Amount currencyID="${cur}">${f2(c.monto)}</cbc:Amount>
    <cbc:PaymentDueDate>${venc}</cbc:PaymentDueDate>
  </cac:PaymentTerms>`;
  });
  return `  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>Credito</cbc:PaymentMeansID>
    <cbc:Amount currencyID="${cur}">${f2(total)}</cbc:Amount>
  </cac:PaymentTerms>
${cuotas.join('\n')}`;
}

function taxSubtotal(cur, base, igv, cfg) {
  return `    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${cur}">${f2(base)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${cur}">${f2(igv)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>${f2(cfg.percent)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>${cfg.schemeId}</cbc:ID>
          <cbc:Name>${cfg.name}</cbc:Name>
          <cbc:TaxTypeCode>${cfg.typeCode}</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
