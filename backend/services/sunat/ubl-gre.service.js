// services/sunat/ubl-gre.service.js  —  DespatchAdvice (GRE Remitente 09 y Transportista 31).
// FASE 10: Remitente (09). Transportista (31) en FASE 11.
import { cdata, trunc } from './ubl.service.js';

// Catálogo 20 (motivo de traslado) — descripción para HandlingInstructions.
const MOTIVOS_TRASLADO = {
  '01': 'VENTA',
  '02': 'COMPRA',
  '04': 'TRASLADO ENTRE ESTABLECIMIENTOS DE LA MISMA EMPRESA',
  '08': 'IMPORTACION',
  '09': 'EXPORTACION',
  '13': 'OTROS',
  '14': 'VENTA SUJETA A CONFIRMACION DEL COMPRADOR',
  '18': 'TRASLADO EMISOR ITINERANTE CP'
};

// Divide "NOMBRE APELLIDO APELLIDO" en {first, family} para DriverPerson.
function partirNombre(nombre) {
  const t = String(nombre || '').trim().split(/\s+/);
  if (t.length <= 1) return { first: t[0] || '-', family: t[0] || '-' };
  return { first: t[0], family: t.slice(1).join(' ') };
}

/**
 * Construye el XML DespatchAdvice (GRE Remitente 09).
 * @param {object} d
 * @param {'09'} d.tipo
 * @param {string} d.serie  TE01
 * @param {number} d.numero
 * @param {object} d.empresa       empresa_config (remitente)
 * @param {object} d.cliente       destinatario (razon_social, ruc, tipo_documento)
 * @param {object} d.guia          guias_remision (motivo_traslado_cod, peso_bruto_kg, direccion_*, ubigeo_*)
 * @param {Array}  d.detalle       [{cantidad, codigo_unidad_sunat, nombre, codigo}]
 * @param {object} d.fecha         {emision, hora}
 * @param {string} d.fechaTraslado 'YYYY-MM-DD'
 * @param {'01'|'02'} d.modalidad  01 público (CarrierParty) · 02 privado (DriverPerson+placa)
 * @param {object|null} d.conductor {dni, nombre_completo, licencia_conducir}  (privado)
 * @param {string|null} d.placa    placa del vehículo (privado)
 * @param {object|null} d.docRelacionado {tipo, numero} (factura relacionada)
 * @returns {{ xml: string }}
 */
export function construirDespatchAdviceXML(d) {
  if (d.tipo !== '09') {
    const err = new Error(`GRE tipo ${d.tipo} no soportado en Fase 10 (Transportista 31 = Fase 11)`);
    err.statusCode = 422; err.isOperational = true; throw err;
  }
  const emp = d.empresa;
  const cli = d.cliente;
  const g = d.guia;
  const idComprobante = `${d.serie}-${d.numero}`;
  const motivoCod = String(g.motivo_traslado_cod);
  const motivoDesc = MOTIVOS_TRASLADO[motivoCod] || String(g.motivo_traslado || 'TRASLADO').toUpperCase();
  const cliScheme = String(cli.tipo_documento || '').toUpperCase() === 'RUC' ? '6' : '1';

  // ── Etapa de transporte (modalidad 01 público / 02 privado) ─────────────────
  let etapaTransporte;
  if (d.modalidad === '02') {
    const n = partirNombre(d.conductor?.nombre_completo);
    etapaTransporte = `      <cac:DriverPerson>
        <cbc:ID schemeID="1">${d.conductor.dni}</cbc:ID>
        <cbc:FirstName>${cdata(n.first)}</cbc:FirstName>
        <cbc:FamilyName>${cdata(n.family)}</cbc:FamilyName>
        <cbc:JobTitle>Principal</cbc:JobTitle>
        <cac:IdentityDocumentReference><cbc:ID>${d.conductor.licencia_conducir}</cbc:ID></cac:IdentityDocumentReference>
      </cac:DriverPerson>`;
  } else {
    etapaTransporte = `      <cac:CarrierParty>
        <cac:PartyIdentification><cbc:ID schemeID="6">${d.transportista?.ruc || ''}</cbc:ID></cac:PartyIdentification>
        <cac:PartyLegalEntity><cbc:RegistrationName>${cdata(d.transportista?.razon || '')}</cbc:RegistrationName></cac:PartyLegalEntity>
      </cac:CarrierParty>`;
  }

  // Vehículo (solo transporte privado).
  const vehiculoXml = d.modalidad === '02'
    ? `\n    <cac:TransportHandlingUnit>
      <cac:TransportEquipment><cbc:ID>${d.placa}</cbc:ID></cac:TransportEquipment>
    </cac:TransportHandlingUnit>`
    : '';

  // Documento relacionado (factura), opcional.
  const docRelXml = d.docRelacionado
    ? `\n  <cac:AdditionalDocumentReference>
    <cbc:ID>${d.docRelacionado.numero}</cbc:ID>
    <cbc:DocumentTypeCode>${d.docRelacionado.tipo}</cbc:DocumentTypeCode>
  </cac:AdditionalDocumentReference>`
    : '';

  const lineasXml = d.detalle.map((it, i) => `  <cac:DespatchLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:DeliveredQuantity unitCode="${it.codigo_unidad_sunat}">${Number(it.cantidad)}</cbc:DeliveredQuantity>
    <cac:OrderLineReference><cbc:LineID>${i + 1}</cbc:LineID></cac:OrderLineReference>
    <cac:Item>
      <cbc:Description>${cdata(trunc(it.nombre || it.codigo, 250))}</cbc:Description>
      <cac:SellersItemIdentification><cbc:ID>${cdata(it.codigo || it.id_producto || '-')}</cbc:ID></cac:SellersItemIdentification>
    </cac:Item>
  </cac:DespatchLine>`).join('\n');

  // OJO: sin xmlns:ds en la raíz (mismo criterio que la factura).
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<DespatchAdvice xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${idComprobante}</cbc:ID>
  <cbc:IssueDate>${d.fecha.emision}</cbc:IssueDate>
  <cbc:IssueTime>${d.fecha.hora}</cbc:IssueTime>
  <cbc:DespatchAdviceTypeCode>09</cbc:DespatchAdviceTypeCode>${docRelXml}
  <cac:Signature>
    <cbc:ID>SignatureSP</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification><cbc:ID>${emp.ruc}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${cdata(emp.razon_social)}</cbc:Name></cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference><cbc:URI>#SignatureSP</cbc:URI></cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:DespatchSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="6">${emp.ruc}</cbc:ID></cac:PartyIdentification>
      <cac:PartyLegalEntity><cbc:RegistrationName>${cdata(emp.razon_social)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:DespatchSupplierParty>
  <cac:DeliveryCustomerParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="${cliScheme}">${cli.ruc || '-'}</cbc:ID></cac:PartyIdentification>
      <cac:PartyLegalEntity><cbc:RegistrationName>${cdata(cli.razon_social)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:DeliveryCustomerParty>
  <cac:Shipment>
    <cbc:ID>SUNAT_Envio</cbc:ID>
    <cbc:HandlingCode listAgencyName="PE:SUNAT" listName="Motivo de traslado" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo20">${motivoCod}</cbc:HandlingCode>
    <cbc:HandlingInstructions>${cdata(motivoDesc)}</cbc:HandlingInstructions>
    <cbc:GrossWeightMeasure unitCode="KGM">${Number(g.peso_bruto_kg).toFixed(2)}</cbc:GrossWeightMeasure>
    <cac:ShipmentStage>
      <cbc:TransportModeCode listName="Modalidad de traslado" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo18">${d.modalidad}</cbc:TransportModeCode>
      <cac:TransitPeriod><cbc:StartDate>${d.fechaTraslado}</cbc:StartDate></cac:TransitPeriod>
${etapaTransporte}
    </cac:ShipmentStage>
    <cac:Delivery>
      <cac:DeliveryAddress>
        <cbc:ID schemeAgencyName="PE:INEI">${g.ubigeo_llegada}</cbc:ID>
        <cac:AddressLine><cbc:Line>${cdata(trunc(g.direccion_llegada, 250))}</cbc:Line></cac:AddressLine>
      </cac:DeliveryAddress>
      <cac:Despatch>
        <cac:DespatchAddress>
          <cbc:ID schemeAgencyName="PE:INEI">${g.ubigeo_partida}</cbc:ID>
          <cac:AddressLine><cbc:Line>${cdata(trunc(g.direccion_partida, 250))}</cbc:Line></cac:AddressLine>
        </cac:DespatchAddress>
      </cac:Despatch>
    </cac:Delivery>${vehiculoXml}
  </cac:Shipment>
${lineasXml}
</DespatchAdvice>`;

  return { xml };
}
