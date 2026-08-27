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

// ── FASE 11 (tipo 31): sub-bloques de transporte ────────────────────────────
// En GRE Transportista el emisor ES el transportista (INDPACK) y SIEMPRE declara
// sus vehículos y conductores. Estos helpers arman las listas N (multi-conductor /
// multi-placa que exige el punto de control XSD) y se componen dentro de Shipment.

/** cac:CarrierParty del transportista (INDPACK). Se ubica dentro de cac:ShipmentStage. */
function carrierPartyXml(transportista) {
  return `      <cac:CarrierParty>
        <cac:PartyIdentification><cbc:ID schemeID="6">${transportista.ruc}</cbc:ID></cac:PartyIdentification>
        <cac:PartyLegalEntity><cbc:RegistrationName>${cdata(transportista.razon_social)}</cbc:RegistrationName></cac:PartyLegalEntity>
      </cac:CarrierParty>`;
}

/** N conductores → cac:DriverPerson (el primero Principal, el resto Secundario). En cac:ShipmentStage. */
function driversXml(conductores) {
  return conductores.map((c, i) => {
    const n = partirNombre(c.nombre_completo);
    return `      <cac:DriverPerson>
        <cbc:ID schemeID="1">${c.dni}</cbc:ID>
        <cbc:FirstName>${cdata(n.first)}</cbc:FirstName>
        <cbc:FamilyName>${cdata(n.family)}</cbc:FamilyName>
        <cbc:JobTitle>${i === 0 ? 'Principal' : 'Secundario'}</cbc:JobTitle>
        <cac:IdentityDocumentReference><cbc:ID>${c.licencia_conducir}</cbc:ID></cac:IdentityDocumentReference>
      </cac:DriverPerson>`;
  }).join('\n');
}

/** N vehículos → cac:TransportHandlingUnit/TransportEquipment con Nº MTC. En cac:Shipment (tras Delivery). */
function vehiclesXml(vehiculos, mtcDefault) {
  return vehiculos.map((v) => {
    const mtc = v.certificado_habilitacion || mtcDefault;
    // ⚠️ VERIFICAR CONTRA XSD: elemento exacto del Nº de registro MTC dentro de ApplicableTransportMeans.
    const mtcXml = mtc
      ? `
        <cac:ApplicableTransportMeans>
          <cbc:RegistrationNationalityID>${mtc}</cbc:RegistrationNationalityID>
        </cac:ApplicableTransportMeans>`
      : '';
    return `    <cac:TransportHandlingUnit>
      <cac:TransportEquipment>
        <cbc:ID>${v.placa}</cbc:ID>${mtcXml}
      </cac:TransportEquipment>
    </cac:TransportHandlingUnit>`;
  }).join('\n');
}

// Atributos de esquema del documento de identidad (catálogo 06), tal como los emite el
// proveedor de referencia en la GRE aceptada por SUNAT.
const SCHEME_DOC = 'schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06"';

/**
 * Construye el XML DespatchAdvice (GRE Remitente 09).
 *
 * Modalidad de traslado (catálogo 18): se emite como 02 (privado) tanto para vehículo propio
 * como para traslado con transportista tercero. En ambos casos se declaran conductor + vehículo;
 * cuando hay tercero se añade además el bloque CarrierParty (RUC + razón social + Nº MTC en
 * cbc:CompanyID). Estructura calcada del XML real aceptado por SUNAT (docs/…-09-EG07-309.xml).
 *
 * @param {object} d
 * @param {'09'} d.tipo
 * @param {string} d.serie
 * @param {number} d.numero
 * @param {object} d.empresa       empresa_config (remitente)
 * @param {object} d.cliente       destinatario (razon_social, ruc, tipo_documento)
 * @param {object} d.guia          guias_remision (motivo_traslado_cod, peso_bruto_kg, direccion_*, ubigeo_*)
 * @param {Array}  d.detalle       [{cantidad, codigo_unidad_sunat, nombre, codigo}]
 * @param {object} d.fecha         {emision, hora}
 * @param {string} d.fechaTraslado 'YYYY-MM-DD'
 * @param {'02'} d.modalidad       modalidad de traslado (catálogo 18); hoy siempre 02
 * @param {object|null} d.transportista {ruc, razon, mtc}  (solo traslado por tercero → CarrierParty)
 * @param {object|null} d.conductor     {dni, nombre, licencia}
 * @param {object|null} d.vehiculo      {placa, tuc}  (un solo vehículo; tuc = registro del vehículo → RegistrationNationalityID)
 * @param {string} [d.observacion] observación libre + OC → cbc:Note
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
  const modalidad = d.modalidad || '02';
  const idComprobante = `${d.serie}-${d.numero}`;
  const motivoCod = String(g.motivo_traslado_cod);
  const motivoDesc = MOTIVOS_TRASLADO[motivoCod] || String(g.motivo_traslado || 'TRASLADO').toUpperCase();
  const cliScheme = String(cli.tipo_documento || '').toUpperCase() === 'RUC' ? '6' : '1';

  // ── Bloque del transportista (solo traslado por tercero) → cac:CarrierParty ──────────────
  // El Nº de registro MTC de la empresa transportista va en cac:PartyLegalEntity/cbc:CompanyID.
  const carrierXml = d.transportista?.ruc
    ? `
      <cac:CarrierParty>
        <cac:PartyIdentification><cbc:ID schemeID="6" ${SCHEME_DOC}>${cdata(d.transportista.ruc)}</cbc:ID></cac:PartyIdentification>
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${cdata(d.transportista.razon || '')}</cbc:RegistrationName>${d.transportista.mtc ? `
          <cbc:CompanyID>${cdata(d.transportista.mtc)}</cbc:CompanyID>` : ''}
        </cac:PartyLegalEntity>
      </cac:CarrierParty>`
    : '';

  // ── Conductor principal → cac:DriverPerson (dentro de ShipmentStage, tras CarrierParty) ──
  // El proveedor de referencia repite el nombre completo en FirstName y FamilyName; se replica.
  const nombreCond = trunc(d.conductor?.nombre || '', 250);
  const driverXml = d.conductor?.dni
    ? `
      <cac:DriverPerson>
        <cbc:ID schemeID="1" ${SCHEME_DOC}>${cdata(d.conductor.dni)}</cbc:ID>
        <cbc:FirstName>${cdata(nombreCond)}</cbc:FirstName>
        <cbc:FamilyName>${cdata(nombreCond)}</cbc:FamilyName>
        <cbc:JobTitle>Principal</cbc:JobTitle>
        <cac:IdentityDocumentReference><cbc:ID>${cdata(d.conductor.licencia || '')}</cbc:ID></cac:IdentityDocumentReference>
      </cac:DriverPerson>`
    : '';

  // ── Vehículo → cac:TransportHandlingUnit/TransportEquipment (tras cac:Delivery) ──────────
  // La guía declara UN solo vehículo (la placa que se coloca al emitir). El Nº de registro del
  // vehículo (distinto del MTC de la empresa) va en RegistrationNationalityID.
  const vehiculoXml = d.vehiculo?.placa
    ? `
    <cac:TransportHandlingUnit>
      <cac:TransportEquipment>
        <cbc:ID>${cdata(d.vehiculo.placa)}</cbc:ID>${d.vehiculo.tuc ? `
        <cac:ApplicableTransportMeans><cbc:RegistrationNationalityID>${cdata(d.vehiculo.tuc)}</cbc:RegistrationNationalityID></cac:ApplicableTransportMeans>` : ''}
      </cac:TransportEquipment>
    </cac:TransportHandlingUnit>`
    : '';

  // Observación (texto libre + OC) → cbc:Note tras DespatchAdviceTypeCode.
  const notaXml = d.observacion
    ? `\n  <cbc:Note>${cdata(trunc(d.observacion, 250))}</cbc:Note>`
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
    <cbc:DeliveredQuantity unitCode="${it.codigo_unidad_sunat}" unitCodeListID="UN/ECE rec 20" unitCodeListAgencyName="United Nations Economic Commission for Europe">${Number(it.cantidad)}</cbc:DeliveredQuantity>
    <cac:OrderLineReference><cbc:LineID>${i + 1}</cbc:LineID></cac:OrderLineReference>
    <cac:Item>
      <cbc:Description>${cdata(trunc(it.nombre || it.codigo, 250))}</cbc:Description>
      <cac:SellersItemIdentification><cbc:ID>${cdata(it.codigo || it.id_producto || '-')}</cbc:ID></cac:SellersItemIdentification>
      <cac:AdditionalItemProperty>
        <cbc:Name>Indicador de bien regulado por SUNAT</cbc:Name>
        <cbc:NameCode listAgencyName="PE:SUNAT" listName="Propiedad del item" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo55">7022</cbc:NameCode>
        <cbc:Value>0</cbc:Value>
      </cac:AdditionalItemProperty>
    </cac:Item>
  </cac:DespatchLine>`).join('\n');

  // OJO: sin xmlns:ds en la raíz (lo agrega la firma). ext:ExtensionContent vacío = placeholder
  // que rellena firma.service con la firma envelopada.
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
  <cbc:DespatchAdviceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">09</cbc:DespatchAdviceTypeCode>${notaXml}${docRelXml}
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
      <cac:PartyIdentification><cbc:ID schemeID="6" ${SCHEME_DOC}>${emp.ruc}</cbc:ID></cac:PartyIdentification>
      <cac:PartyLegalEntity><cbc:RegistrationName>${cdata(emp.razon_social)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:DespatchSupplierParty>
  <cac:DeliveryCustomerParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="${cliScheme}" ${SCHEME_DOC}>${cli.ruc || '-'}</cbc:ID></cac:PartyIdentification>
      <cac:PartyLegalEntity><cbc:RegistrationName>${cdata(cli.razon_social)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:DeliveryCustomerParty>
  <cac:Shipment>
    <cbc:ID>SUNAT_Envio</cbc:ID>
    <cbc:HandlingCode listAgencyName="PE:SUNAT" listName="Motivo de traslado" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo20">${motivoCod}</cbc:HandlingCode>
    <cbc:HandlingInstructions>${cdata(motivoDesc)}</cbc:HandlingInstructions>
    <cbc:GrossWeightMeasure unitCode="KGM">${Number(g.peso_bruto_kg).toFixed(2)}</cbc:GrossWeightMeasure>
    <cac:ShipmentStage>
      <cbc:TransportModeCode listName="Modalidad de traslado" listAgencyName="PE:SUNAT" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo18">${modalidad}</cbc:TransportModeCode>
      <cac:TransitPeriod><cbc:StartDate>${d.fechaTraslado}</cbc:StartDate></cac:TransitPeriod>${carrierXml}${driverXml}
    </cac:ShipmentStage>
    <cac:Delivery>
      <cac:DeliveryAddress>
        <cbc:ID schemeName="Ubigeos" schemeAgencyName="PE:INEI">${g.ubigeo_llegada}</cbc:ID>
        <cbc:AddressTypeCode listID="${cli.ruc || ''}" listAgencyName="PE:SUNAT" listName="Establecimientos anexos">0</cbc:AddressTypeCode>
        <cac:AddressLine><cbc:Line>${cdata(trunc(g.direccion_llegada, 250))}</cbc:Line></cac:AddressLine>
      </cac:DeliveryAddress>
      <cac:Despatch>
        <cac:DespatchAddress>
          <cbc:ID schemeName="Ubigeos" schemeAgencyName="PE:INEI">${g.ubigeo_partida}</cbc:ID>
          <cbc:AddressTypeCode listID="${emp.ruc || ''}" listAgencyName="PE:SUNAT" listName="Establecimientos anexos">0</cbc:AddressTypeCode>
          <cac:AddressLine><cbc:Line>${cdata(trunc(g.direccion_partida, 250))}</cbc:Line></cac:AddressLine>
        </cac:DespatchAddress>
      </cac:Despatch>
    </cac:Delivery>${vehiculoXml}
  </cac:Shipment>
${lineasXml}
</DespatchAdvice>`;

  return { xml };
}
