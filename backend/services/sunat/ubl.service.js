import { numeroALetras } from '../../utils/numeroALetras.js';

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const roundN = (n, d) => { const f = 10 ** d; return Math.round((Number(n) + Number.EPSILON) * f) / f; };
export const m2 = (n) => round2(n).toFixed(2);
export const u6 = (n) => roundN(n, 6).toFixed(6);
export const cdata = (s) => `<![CDATA[${String(s ?? '').replace(/]]>/g, ']]&gt;')}]]>`;
export const trunc = (s, max) => String(s ?? '').trim().slice(0, max);
const valorReal = (v) => String(v ?? '').trim() && String(v).trim() !== '-';

const direccionEstablecimientoEmisor = (empresa = {}) => {
  const direccion = [empresa.direccion, empresa.urbanizacion]
    .filter(valorReal)
    .join(' - ');
  const ubicacion = [empresa.departamento, empresa.provincia, empresa.distrito]
    .filter(valorReal)
    .join('-');
  return [direccion, ubicacion].filter(valorReal).join(' ');
};

export const AFECTACION = {
  '10': { scheme: '1000', name: 'IGV', typeCode: 'VAT', percent: 18, gravado: true },
  '20': { scheme: '9997', name: 'EXO', typeCode: 'VAT', percent: 0, gravado: false },
  '30': { scheme: '9998', name: 'INA', typeCode: 'FRE', percent: 0, gravado: false },
  '40': { scheme: '9995', name: 'EXP', typeCode: 'FRE', percent: 0, gravado: false }
};

const TIPO_IMPUESTO_AFECTACION = {
  IGV: '10', GRAVADO: '10', GRAVADA: '10', '10': '10',
  EXO: '20', EXONERADO: '20', EXONERADA: '20', '20': '20',
  INA: '30', INAFECTO: '30', INAFECTA: '30', '30': '30',
  EXP: '40', EXPORT: '40', EXPORTACION: '40', '40': '40'
};

export function afectacionDesdeOrden(tipoImpuesto) {
  return TIPO_IMPUESTO_AFECTACION[String(tipoImpuesto ?? '').toUpperCase().trim()] || '10';
}

export function afectacionLinea(ov, d) {
  if (Number(ov?.es_exportacion) === 1) return '40';
  const linea = String(d?.codigo_afectacion_igv ?? '').trim();
  if (linea && linea !== '10') return linea;
  return afectacionDesdeOrden(ov?.tipo_impuesto);
}

export const TIPOS_GUIA_REF = {
  '09': 'Guía de Remisión Remitente',
  '31': 'Guía de Remisión Transportista'
};

export function normalizarGuiaRef(g) {
  if (!g) return null;
  const tipoDoc = String(g.tipo_documento ?? g.tipoDoc ?? g.tipo ?? '09').trim() || '09';
  const serie = String(g.serie ?? g.serie_sunat ?? '').toUpperCase().trim();
  const numero = String(g.numero ?? g.numero_sunat ?? '').trim();
  if (!serie || !numero) return null;
  return { tipoDoc, serie, numero, id: `${serie}-${numero}` };
}

export function schemeIdDocumento(tipoDoc) {
  switch (String(tipoDoc || '').toUpperCase()) {
    case 'RUC': return '6';
    case 'DNI': return '1';
    case 'CE':
    case 'CARNET DE EXTRANJERIA': return '4';
    case 'PASAPORTE': return '7';
    default: return '0';
  }
}

export function calcularComprobante({ ov, detalle }) {
  const moneda = ov.moneda || 'PEN';
  const esExport = Number(ov.es_exportacion) === 1;
  const grupos = {};

  const lineas = (detalle || []).map((d, i) => {
    const afect = afectacionLinea(ov, d);
    const cfg = AFECTACION[afect] || AFECTACION['10'];

    const cantidad = Number(d.cantidad);
    const desc = Number(d.descuento_porcentaje || 0);
    const netUnit = Number(d.precio_unitario);
    const lineExt = round2(cantidad * netUnit);
    const igvLine = cfg.gravado ? round2(lineExt * (cfg.percent / 100)) : 0;
    const precioConIgvUnit = cfg.gravado ? netUnit * (1 + cfg.percent / 100) : netUnit;

    grupos[afect] = grupos[afect] || { base: 0, igv: 0, cfg };
    grupos[afect].base += lineExt;
    grupos[afect].igv += igvLine;

    return {
      numero: i + 1,
      codigo: d.codigo || d.id_producto,
      descripcion: d.nombre || d.descripcion || d.codigo,
      unidad: d.codigo_unidad_sunat || null,
      cantidad,
      afectacion: afect,
      afectacionNombre: cfg.name,
      porcentajeIgv: cfg.percent,
      gravado: cfg.gravado,
      descuentoPorcentaje: desc,
      valorUnitario: netUnit,
      precioUnitarioConIgv: precioConIgvUnit,
      valorVenta: lineExt,
      igv: igvLine,
      cfg
    };
  });

  const subtotal = round2(Object.values(grupos).reduce((s, g) => s + g.base, 0));
  const igv = round2(Object.values(grupos).reduce((s, g) => s + g.igv, 0));
  const total = round2(subtotal + igv);

  return { moneda, esExport, lineas, grupos, subtotal, igv, total, montoEnLetras: numeroALetras(total, moneda) };
}

export function construirInvoiceXML({ serie, numero, ov, detalle, cliente, empresa, fecha, guias }) {
  if (!detalle || !detalle.length) {
    const err = new Error('La orden de venta no tiene líneas para facturar');
    err.statusCode = 422; err.isOperational = true; throw err;
  }
  const moneda = ov.moneda || 'PEN';
  const esExport = Number(ov.es_exportacion) === 1;
  const idComprobante = `${serie}-${numero}`;

  const { lineas, grupos, subtotal: totalBase, igv: totalIgv, total: totalPagar } = calcularComprobante({ ov, detalle });
  const lineasXml = lineas.map((L) => {
    if (!L.unidad) {
      const err = new Error(`El producto "${L.codigo}" no tiene codigo_unidad_sunat; complétalo antes de facturar`);
      err.statusCode = 422; err.isOperational = true; throw err;
    }
    return `  <cac:InvoiceLine>
    <cbc:ID>${L.numero}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${L.unidad}">${L.cantidad}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${moneda}">${m2(L.valorVenta)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="${moneda}">${u6(L.precioUnitarioConIgv)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${moneda}">${m2(L.igv)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${moneda}">${m2(L.valorVenta)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${moneda}">${m2(L.igv)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>${L.cfg.percent.toFixed(2)}</cbc:Percent>
          <cbc:TaxExemptionReasonCode>${L.afectacion}</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>${L.cfg.scheme}</cbc:ID><cbc:Name>${L.cfg.name}</cbc:Name><cbc:TaxTypeCode>${L.cfg.typeCode}</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description>${cdata(L.descripcion)}</cbc:Description>
      <cac:SellersItemIdentification><cbc:ID>${cdata(L.codigo)}</cbc:ID></cac:SellersItemIdentification>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${moneda}">${u6(L.valorUnitario)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`;
  }).join('\n');

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

  const cliScheme = esExport ? '-' : schemeIdDocumento(cliente.tipo_documento);
  const cliNumDoc = esExport ? '-' : (cliente.ruc || '0');
  const cliSchemeName = esExport ? ' schemeName="Documento de Identidad"' : '';
  const dueDateLine = esCredito ? `\n  <cbc:DueDate>${fecha.vencimiento || fecha.emision}</cbc:DueDate>` : '';
  const tipoOperacion = esExport ? '0200' : (ov.tipo_operacion_sunat || '0101');

  const customerAddress = esExport
    ? ''
    : `        <cac:RegistrationAddress>
          <cac:AddressLine><cbc:Line>${cdata(cliente.direccion_despacho || '-')}</cbc:Line></cac:AddressLine>
        </cac:RegistrationAddress>`;
  const sellerSupplierParty = esExport
    ? `  <cac:SellerSupplierParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:ID>${empresa.ubigeo}</cbc:ID>
        <cbc:CitySubdivisionName/>
        <cbc:CityName>${cdata(empresa.provincia)}</cbc:CityName>
        <cbc:CountrySubentity>${cdata(empresa.departamento)}</cbc:CountrySubentity>
        <cbc:District>${cdata(empresa.distrito)}</cbc:District>
        <cac:AddressLine><cbc:Line>${cdata(direccionEstablecimientoEmisor(empresa))}</cbc:Line></cac:AddressLine>
        <cac:Country><cbc:IdentificationCode>PE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
    </cac:Party>
  </cac:SellerSupplierParty>\n`
    : '';

  const ocCliente = trunc(ov.orden_compra_cliente, 20);
  const observaciones = String(ov.observaciones || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
  const notaObservaciones = observaciones ? `\n  <cbc:Note>${cdata(observaciones)}</cbc:Note>` : '';
  const orderReference = ocCliente ? `\n  <cac:OrderReference><cbc:ID>${cdata(ocCliente)}</cbc:ID></cac:OrderReference>` : '';

  const despatchReferences = (guias || [])
    .map(normalizarGuiaRef)
    .filter(Boolean)
    .map((g) => `\n  <cac:DespatchDocumentReference>
    <cbc:ID>${g.id}</cbc:ID>
    <cbc:DocumentTypeCode>${g.tipoDoc}</cbc:DocumentTypeCode>
    <cbc:DocumentType>${cdata(TIPOS_GUIA_REF[g.tipoDoc] || 'Guía de Remisión')}</cbc:DocumentType>
  </cac:DespatchDocumentReference>`)
    .join('');

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
  <cbc:Note languageLocaleID="1000">${cdata(numeroALetras(totalPagar, moneda))}</cbc:Note>${notaObservaciones}
  <cbc:DocumentCurrencyCode>${moneda}</cbc:DocumentCurrencyCode>${orderReference}${despatchReferences}
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
          <cbc:CitySubdivisionName>${cdata(trunc(empresa.urbanizacion, 25))}</cbc:CitySubdivisionName>
          <cbc:CityName>${cdata(empresa.provincia)}</cbc:CityName>
          <cbc:CountrySubentity>${cdata(empresa.departamento)}</cbc:CountrySubentity>
          <cbc:CountrySubentityCode>${cdata(empresa.ubigeo)}</cbc:CountrySubentityCode>
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
        <cbc:ID schemeID="${cliScheme}" schemeAgencyName="PE:SUNAT"${cliSchemeName} schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${cliNumDoc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(cliente.razon_social)}</cbc:RegistrationName>
${customerAddress}
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
${sellerSupplierParty}${paymentTerms}
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
