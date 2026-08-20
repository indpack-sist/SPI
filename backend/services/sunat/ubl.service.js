// services/sunat/ubl.service.js  —  Constructores de XML UBL 2.1.
// FASE 6: Factura (01). Notas de Crédito/Débito (07/08) en FASE 7.
import { numeroALetras } from '../../utils/numeroALetras.js';

// ── Helpers ────────────────────────────────────────────────────────────────
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const roundN = (n, d) => { const f = 10 ** d; return Math.round((Number(n) + Number.EPSILON) * f) / f; };
const m2 = (n) => round2(n).toFixed(2);              // montos: 2 decimales
const u6 = (n) => roundN(n, 6).toFixed(6);           // valores unitarios: 6 decimales
const cdata = (s) => `<![CDATA[${String(s ?? '').replace(/]]>/g, ']]&gt;')}]]>`;

// Catálogo 07 (afectación IGV) -> TaxScheme + porcentaje.
const AFECTACION = {
  '10': { scheme: '1000', name: 'IGV', typeCode: 'VAT', percent: 18, gravado: true },
  '20': { scheme: '9997', name: 'EXO', typeCode: 'VAT', percent: 0, gravado: false },
  '30': { scheme: '9998', name: 'INA', typeCode: 'FRE', percent: 0, gravado: false },
  '40': { scheme: '9995', name: 'EXP', typeCode: 'FRE', percent: 0, gravado: false }
};

// Catálogo 06 (documento de identidad del cliente).
function schemeIdDocumento(tipoDoc) {
  switch (String(tipoDoc || '').toUpperCase()) {
    case 'RUC': return '6';
    case 'DNI': return '1';
    case 'CE':
    case 'CARNET DE EXTRANJERIA': return '4';
    case 'PASAPORTE': return '7';
    default: return '0';
  }
}

/**
 * Construye el XML de una Factura (01) a partir de la OV, su detalle, el cliente y empresa_config.
 * @returns {{ xml: string, totales: {subtotal:number, igv:number, total:number} }}
 */
export function construirInvoiceXML({ serie, numero, ov, detalle, cliente, empresa, fecha }) {
  if (!detalle || !detalle.length) {
    const err = new Error('La orden de venta no tiene líneas para facturar');
    err.statusCode = 422; err.isOperational = true; throw err;
  }
  const moneda = ov.moneda || 'PEN';
  const esExport = Number(ov.es_exportacion) === 1;
  const idComprobante = `${serie}-${numero}`;

  // ── Líneas ────────────────────────────────────────────────────────────────
  const grupos = {}; // afectación -> { base, igv }
  const lineasXml = detalle.map((d, i) => {
    const unidad = d.codigo_unidad_sunat;
    if (!unidad) {
      const err = new Error(`El producto "${d.codigo || d.id_producto}" no tiene codigo_unidad_sunat; complétalo antes de facturar`);
      err.statusCode = 422; err.isOperational = true; throw err;
    }
    const afect = esExport ? '40' : String(d.codigo_afectacion_igv || '10');
    const cfg = AFECTACION[afect] || AFECTACION['10'];

    const cantidad = Number(d.cantidad);
    const desc = Number(d.descuento_porcentaje || 0);
    const netUnit = Number(d.precio_unitario) * (1 - desc / 100);       // valor unitario sin IGV
    const lineExt = round2(cantidad * netUnit);                         // valor de venta de la línea
    const igvLine = cfg.gravado ? round2(lineExt * (cfg.percent / 100)) : 0;
    const precioConIgvUnit = cfg.gravado ? netUnit * (1 + cfg.percent / 100) : netUnit;

    grupos[afect] = grupos[afect] || { base: 0, igv: 0, cfg };
    grupos[afect].base += lineExt;
    grupos[afect].igv += igvLine;

    return `  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${unidad}">${cantidad}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${moneda}">${m2(lineExt)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="${moneda}">${u6(precioConIgvUnit)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${moneda}">${m2(igvLine)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${moneda}">${m2(lineExt)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${moneda}">${m2(igvLine)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>${cfg.percent.toFixed(2)}</cbc:Percent>
          <cbc:TaxExemptionReasonCode>${afect}</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>${cfg.scheme}</cbc:ID><cbc:Name>${cfg.name}</cbc:Name><cbc:TaxTypeCode>${cfg.typeCode}</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description>${cdata(d.nombre || d.descripcion || d.codigo)}</cbc:Description>
      <cac:SellersItemIdentification><cbc:ID>${cdata(d.codigo || d.id_producto)}</cbc:ID></cac:SellersItemIdentification>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${moneda}">${u6(netUnit)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`;
  }).join('\n');

  // ── Totales (recalculados desde líneas) ─────────────────────────────────────
  const totalBase = round2(Object.values(grupos).reduce((s, g) => s + g.base, 0));
  const totalIgv = round2(Object.values(grupos).reduce((s, g) => s + g.igv, 0));
  const totalPagar = round2(totalBase + totalIgv);

  const taxSubtotalsHeader = Object.entries(grupos).map(([afect, g]) => {
    const cfg = g.cfg;
    return `    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${moneda}">${m2(g.base)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${moneda}">${m2(g.igv)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>${cfg.percent.toFixed(2)}</cbc:Percent>
        <cbc:TaxExemptionReasonCode>${afect}</cbc:TaxExemptionReasonCode>
        <cac:TaxScheme>
          <cbc:ID>${cfg.scheme}</cbc:ID><cbc:Name>${cfg.name}</cbc:Name><cbc:TaxTypeCode>${cfg.typeCode}</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`;
  }).join('\n');

  // ── Forma de pago (Contado / Crédito 1 cuota) ───────────────────────────────
  const esCredito = String(ov.tipo_venta || '').toLowerCase().startsWith('cr');
  let paymentTerms;
  if (esCredito) {
    const venc = fecha.vencimiento || fecha.emision;
    paymentTerms =
`  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID><cbc:PaymentMeansID>Credito</cbc:PaymentMeansID>
    <cbc:Amount currencyID="${moneda}">${m2(totalPagar)}</cbc:Amount>
  </cac:PaymentTerms>
  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID><cbc:PaymentMeansID>Cuota001</cbc:PaymentMeansID>
    <cbc:Amount currencyID="${moneda}">${m2(totalPagar)}</cbc:Amount>
    <cbc:PaymentDueDate>${venc}</cbc:PaymentDueDate>
  </cac:PaymentTerms>`;
  } else {
    paymentTerms =
`  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID><cbc:PaymentMeansID>Contado</cbc:PaymentMeansID>
  </cac:PaymentTerms>`;
  }

  // ── Cliente (receptor) ──────────────────────────────────────────────────────
  const cliScheme = esExport ? '0' : schemeIdDocumento(cliente.tipo_documento);
  const cliNumDoc = esExport ? (cliente.ruc || '0') : (cliente.ruc || '0');
  const dueDateLine = esCredito ? `\n  <cbc:DueDate>${fecha.vencimiento || fecha.emision}</cbc:DueDate>` : '';
  const tipoOperacion = esExport ? '0200' : (ov.tipo_operacion_sunat || '0101');

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${idComprobante}</cbc:ID>
  <cbc:IssueDate>${fecha.emision}</cbc:IssueDate>
  <cbc:IssueTime>${fecha.hora}</cbc:IssueTime>${dueDateLine}
  <cbc:InvoiceTypeCode listID="${tipoOperacion}">01</cbc:InvoiceTypeCode>
  <cbc:Note languageLocaleID="1000">${cdata(numeroALetras(totalPagar, moneda))}</cbc:Note>
  <cbc:DocumentCurrencyCode>${moneda}</cbc:DocumentCurrencyCode>
  <cac:Signature>
    <cbc:ID>SignatureSP</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification><cbc:ID>${empresa.ruc}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${cdata(empresa.razon_social)}</cbc:Name></cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference><cbc:URI>#SignatureSP</cbc:URI></cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${empresa.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${cdata(empresa.nombre_comercial || empresa.razon_social)}</cbc:Name></cac:PartyName>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(empresa.razon_social)}</cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:ID>${empresa.ubigeo}</cbc:ID>
          <cbc:AddressTypeCode>${empresa.codigo_establecimiento || '0000'}</cbc:AddressTypeCode>
          <cbc:CitySubdivisionName>${cdata(empresa.urbanizacion || '')}</cbc:CitySubdivisionName>
          <cbc:CityName>${cdata(empresa.provincia)}</cbc:CityName>
          <cbc:CountrySubentity>${cdata(empresa.departamento)}</cbc:CountrySubentity>
          <cbc:District>${cdata(empresa.distrito)}</cbc:District>
          <cac:AddressLine><cbc:Line>${cdata(empresa.direccion)}</cbc:Line></cac:AddressLine>
          <cac:Country><cbc:IdentificationCode>PE</cbc:IdentificationCode></cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${cliScheme}" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${cliNumDoc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(cliente.razon_social)}</cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cac:AddressLine><cbc:Line>${cdata(cliente.direccion_despacho || '-')}</cbc:Line></cac:AddressLine>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
${paymentTerms}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${moneda}">${m2(totalIgv)}</cbc:TaxAmount>
${taxSubtotalsHeader}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${moneda}">${m2(totalBase)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${moneda}">${m2(totalPagar)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${moneda}">${m2(totalPagar)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lineasXml}
</Invoice>`;

  return { xml, totales: { subtotal: totalBase, igv: totalIgv, total: totalPagar } };
}
