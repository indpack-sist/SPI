// services/sunat/ubl-nota.service.js  —  Constructor de XML UBL 2.1 para Notas.
// FASE 7: Nota de Crédito (07 / CreditNote) y Nota de Débito (08 / DebitNote).
// Reusa la firma, el zip, el envío (sendBill) y el CDR de la Fase 6 sin cambios.
import { numeroALetras } from '../../utils/numeroALetras.js';
import { round2, m2, u6, cdata, trunc, AFECTACION, schemeIdDocumento } from './ubl.service.js';

// Catálogo 09 (motivos de Nota de Crédito).
const MOTIVOS_NC = {
  '01': 'ANULACION DE LA OPERACION',
  '02': 'ANULACION POR ERROR EN EL RUC',
  '03': 'CORRECCION POR ERROR EN LA DESCRIPCION',
  '04': 'DESCUENTO GLOBAL',
  '05': 'DESCUENTO POR ITEM',
  '06': 'DEVOLUCION TOTAL',
  '07': 'DEVOLUCION POR ITEM',
  '08': 'BONIFICACION',
  '09': 'DISMINUCION EN EL VALOR',
  '13': 'AJUSTES - MONTOS Y/O FECHAS DE PAGO'
};
// Catálogo 10 (motivos de Nota de Débito).
const MOTIVOS_ND = {
  '01': 'INTERESES POR MORA',
  '02': 'AUMENTO EN EL VALOR',
  '03': 'PENALIDADES / OTROS CONCEPTOS'
};

export function motivosValidos(tipo) {
  return tipo === '08' ? MOTIVOS_ND : MOTIVOS_NC;
}

// Perfiles por tipo de nota (elementos que cambian entre CreditNote y DebitNote).
const PERFIL = {
  '07': {
    root: 'CreditNote',
    ns: 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
    lineTag: 'CreditNoteLine',
    qtyTag: 'CreditedQuantity',
    totalTag: 'LegalMonetaryTotal',
    motivos: MOTIVOS_NC
  },
  '08': {
    root: 'DebitNote',
    ns: 'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2',
    lineTag: 'DebitNoteLine',
    qtyTag: 'DebitedQuantity',
    totalTag: 'RequestedMonetaryTotal',
    motivos: MOTIVOS_ND
  }
};

/**
 * Construye el XML de una Nota de Crédito (07) o Débito (08).
 * @param {object}  p
 * @param {'07'|'08'} p.tipo
 * @param {string}  p.serie          FC01 (NC) | FD01 (ND)
 * @param {number}  p.numero
 * @param {string}  p.motivoCodigo   catálogo 09 (NC) / 10 (ND)
 * @param {object}  p.docAfectado    { comprobante:'FE01-1', tipo:'01' }
 * @param {object}  p.ov             orden de venta del comprobante afectado (moneda, tipo_operacion_sunat, es_exportacion)
 * @param {array}   p.detalle        líneas de la nota (total: replica la factura; parcial: subconjunto/ítems)
 * @param {object}  p.cliente
 * @param {object}  p.empresa        empresa_config
 * @param {object}  p.fecha          { emision, hora }
 * @returns {{ xml: string, totales: {subtotal:number, igv:number, total:number} }}
 */
export function construirNotaXML({ tipo, serie, numero, motivoCodigo, docAfectado, ov, detalle, cliente, empresa, fecha }) {
  const perfil = PERFIL[tipo];
  if (!perfil) {
    const err = new Error(`Tipo de nota no soportado: ${tipo}`);
    err.statusCode = 422; err.isOperational = true; throw err;
  }
  const motivoDesc = perfil.motivos[String(motivoCodigo)];
  if (!motivoDesc) {
    const err = new Error(`motivo_codigo ${motivoCodigo} inválido para el tipo ${tipo} (ver catálogo ${tipo === '08' ? '10' : '09'})`);
    err.statusCode = 422; err.isOperational = true; throw err;
  }
  if (!detalle || !detalle.length) {
    const err = new Error('La nota no tiene líneas');
    err.statusCode = 422; err.isOperational = true; throw err;
  }

  const moneda = ov.moneda || 'PEN';
  const esExport = Number(ov.es_exportacion) === 1;
  const idComprobante = `${serie}-${numero}`;

  // ── Líneas (misma matemática que la factura de la Fase 6) ───────────────────
  const grupos = {}; // afectación -> { base, igv, cfg }
  const lineasXml = detalle.map((d, i) => {
    const unidad = d.codigo_unidad_sunat;
    if (!unidad) {
      const err = new Error(`El ítem "${d.codigo || d.descripcion || d.id_producto}" no tiene codigo_unidad_sunat`);
      err.statusCode = 422; err.isOperational = true; throw err;
    }
    const afect = esExport ? '40' : String(d.codigo_afectacion_igv || '10');
    const cfg = AFECTACION[afect] || AFECTACION['10'];

    const cantidad = Number(d.cantidad);
    const desc = Number(d.descuento_porcentaje || 0);
    const netUnit = Number(d.precio_unitario) * (1 - desc / 100);
    const lineExt = round2(cantidad * netUnit);
    const igvLine = cfg.gravado ? round2(lineExt * (cfg.percent / 100)) : 0;
    const precioConIgvUnit = cfg.gravado ? netUnit * (1 + cfg.percent / 100) : netUnit;

    grupos[afect] = grupos[afect] || { base: 0, igv: 0, cfg };
    grupos[afect].base += lineExt;
    grupos[afect].igv += igvLine;

    return `  <cac:${perfil.lineTag}>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:${perfil.qtyTag} unitCode="${unidad}">${cantidad}</cbc:${perfil.qtyTag}>
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
      <cac:SellersItemIdentification><cbc:ID>${cdata(d.codigo || d.id_producto || '-')}</cbc:ID></cac:SellersItemIdentification>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${moneda}">${u6(netUnit)}</cbc:PriceAmount></cac:Price>
  </cac:${perfil.lineTag}>`;
  }).join('\n');

  // ── Totales ─────────────────────────────────────────────────────────────────
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

  const cliScheme = esExport ? '0' : schemeIdDocumento(cliente.tipo_documento);
  const cliNumDoc = cliente.ruc || '0';

  // ── XML. OJO orden XSD: DiscrepancyResponse y BillingReference van ANTES de
  //    cac:Signature (mismo tipo de restricción que resolvió el 0306 en la dirección).
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<${perfil.root} xmlns="${perfil.ns}"
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
  <cbc:IssueTime>${fecha.hora}</cbc:IssueTime>
  <cbc:Note languageLocaleID="1000">${cdata(numeroALetras(totalPagar, moneda))}</cbc:Note>
  <cbc:DocumentCurrencyCode>${moneda}</cbc:DocumentCurrencyCode>
  <cac:DiscrepancyResponse>
    <cbc:ReferenceID>${docAfectado.comprobante}</cbc:ReferenceID>
    <cbc:ResponseCode>${motivoCodigo}</cbc:ResponseCode>
    <cbc:Description>${cdata(motivoDesc)}</cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${docAfectado.comprobante}</cbc:ID>
      <cbc:DocumentTypeCode>${docAfectado.tipo}</cbc:DocumentTypeCode>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
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
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${moneda}">${m2(totalIgv)}</cbc:TaxAmount>
${taxSubtotalsHeader}
  </cac:TaxTotal>
  <cac:${perfil.totalTag}>
    <cbc:LineExtensionAmount currencyID="${moneda}">${m2(totalBase)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${moneda}">${m2(totalPagar)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${moneda}">${m2(totalPagar)}</cbc:PayableAmount>
  </cac:${perfil.totalTag}>
${lineasXml}
</${perfil.root}>`;

  return { xml, totales: { subtotal: totalBase, igv: totalIgv, total: totalPagar } };
}
