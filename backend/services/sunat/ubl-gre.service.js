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
 * @param {'01'|'02'} d.modalidad   modalidad de traslado (catálogo 18): 01 público (tercero), 02 privado (propio)
 * @param {object|null} d.transportista {ruc, razon, mtc}  (tercero → CarrierParty; mtc = MTC empresa → CompanyID)
 * @param {boolean} [d.registrarTransportista=true] solo tercero: true (Caso 2/3) declara veh/cond + SpecialInstructions; false (Caso 1) solo CarrierParty
 * @param {string} [d.fechaEntregaTransportista] 'YYYY-MM-DD' → cac:LoadingTransportEvent (solo tercero)
 * @param {Array} [d.conductores]        [{dni, nombre, licencia}] hasta 2 (Principal + Secundario). Alternativa: d.conductor (single, legacy)
 * @param {object|null} [d.conductor]    {dni, nombre, licencia} (legacy; se envuelve en conductores[0])
 * @param {Array} d.vehiculos           [{placa, tuce, autorizacion}] hasta 2 (principal + secundario→AttachedTransportEquipment); tuce→RegistrationNationalityID, autorizacion→ShipmentDocumentReference
 * @param {object} [d.indicadores]       {transbordo, m1l, retornoVacio} booleans → cac:SpecialInstructions opcionales
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
  // Datos de comercio exterior (exportación). null en guías domésticas → todo el bloque comex se apaga.
  // { trasladoTotalDam, docsRelacionados:[{tipo_cod,tipo_desc,serie,numero}], contenedores:[{numero_contenedor,numero_precinto}], damNumero }
  const comex = d.comex || null;
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

  // ── ¿Se declaran vehículos y conductores? ────────────────────────────────────────────────
  //   · No tercero (flota/particular): SIEMPRE se declaran (es la esencia del traslado privado).
  //   · Tercero (público 01): depende del interruptor "registrar vehículos y conductores del
  //     transportista". registrar=true (Caso 2/3) → se declaran + indicador SpecialInstructions.
  //     registrar=false (Caso 1) → SOLO CarrierParty; el transportista emite su propia GRE 31.
  const esTercero = !!d.transportista?.ruc;
  const registrar = esTercero ? (d.registrarTransportista !== false) : true;
  const declararVC = !esTercero || registrar;

  // ── Conductores → cac:DriverPerson (Principal + Secundario) dentro de ShipmentStage ───────
  // Acepta d.conductores [] (1-2) o el legacy d.conductor (single). El proveedor de referencia
  // repite el nombre completo en FirstName y FamilyName; se replica. Solo si se declaran (Caso 2/3).
  const conductores = Array.isArray(d.conductores)
    ? d.conductores.filter((c) => c?.dni)
    : (d.conductor?.dni ? [d.conductor] : []);
  const driverPersonXml = (c, i) => {
    const nom = trunc(c.nombre || '', 250);
    return `
      <cac:DriverPerson>
        <cbc:ID schemeID="1" ${SCHEME_DOC}>${cdata(c.dni)}</cbc:ID>
        <cbc:FirstName>${cdata(nom)}</cbc:FirstName>
        <cbc:FamilyName>${cdata(nom)}</cbc:FamilyName>
        <cbc:JobTitle>${i === 0 ? 'Principal' : 'Secundario'}</cbc:JobTitle>
        <cac:IdentityDocumentReference><cbc:ID>${cdata(c.licencia || '')}</cbc:ID></cac:IdentityDocumentReference>
      </cac:DriverPerson>`;
  };
  const driverXml = declararVC ? conductores.map(driverPersonXml).join('') : '';

  // ── Indicadores → cac:SpecialInstructions (cada indicador es su propio nodo) ──────────────
  // Strings CONFIRMADOS contra el estándar oficial "UBL 2.1 Guía de Remisión Remitente"
  // (Anexo de la R.S. 123-2022/SUNAT). El de "registrar" además está probado por XML aceptado.
  const IND = {
    trasladoTotalDam: 'SUNAT_Envio_IndicadorTrasladoTotalDAMoDS',
    registrarTransp: 'SUNAT_Envio_IndicadorVehiculoConductoresTransp',
    transbordo:      'SUNAT_Envio_IndicadorTransbordoProgramado',
    m1l:             'SUNAT_Envio_IndicadorTrasladoVehiculoM1L',
    retornoVacio:    'SUNAT_Envio_IndicadorRetornoVehiculoEnvaseVacio',
  };
  const ind = d.indicadores || {};
  const indicadores = [];
  // Comex/exportación: el indicador de traslado total de la DAM/DS va PRIMERO (calcado de EG07-273).
  if (comex?.trasladoTotalDam) indicadores.push(IND.trasladoTotalDam);
  // NOTA: SUNAT_Envio_IndicadorVehiculoConductoresTransp NO se auto-emite en guías domésticas: los 3 XML
  // del portal SUNAT (EG07-81/220/309), incluso Casos 2/3 con vehículo+conductor declarados, NO lo llevan.
  // Queda tras el flag explícito (ind.registrarTransp). En export SÍ se emite (el molde EG07-273 lo lleva):
  // el servicio de emisión activa ind.registrarTransp cuando es comex + se declaran veh/cond.
  if (ind.registrarTransp) indicadores.push(IND.registrarTransp);
  if (ind.transbordo) indicadores.push(IND.transbordo);
  if (ind.m1l) indicadores.push(IND.m1l);
  if (ind.retornoVacio) indicadores.push(IND.retornoVacio);
  const specialXml = indicadores.map((s) => `\n    <cbc:SpecialInstructions>${s}</cbc:SpecialInstructions>`).join('');

  // ── Fecha de entrega de bienes al transportista → cac:LoadingTransportEvent (solo tercero) ─
  const loadingXml = (esTercero && d.fechaEntregaTransportista)
    ? `
      <cac:LoadingTransportEvent><cbc:OccurrenceDate>${d.fechaEntregaTransportista}</cbc:OccurrenceDate></cac:LoadingTransportEvent>`
    : '';

  // ── Vehículos → cac:TransportHandlingUnit/TransportEquipment (tras cac:Delivery) ─────────
  // Hasta 2 vehículos: principal (TransportEquipment) + secundario (AttachedTransportEquipment).
  // Cada uno con TUCE/Certificado (RegistrationNationalityID) y autorización especial
  // (ShipmentDocumentReference schemeID="06"). Estructura calcada de docs/…-09-EG07-325.xml.
  const vehiculos = (declararVC && Array.isArray(d.vehiculos)) ? d.vehiculos.filter(v => v?.placa) : [];
  const tuceXml = (v, ind) => v?.tuce
    ? `\n${ind}<cac:ApplicableTransportMeans><cbc:RegistrationNationalityID>${cdata(v.tuce)}</cbc:RegistrationNationalityID></cac:ApplicableTransportMeans>`
    : '';
  const autorizXml = (v, ind) => v?.autorizacion
    ? `\n${ind}<cac:ShipmentDocumentReference><cbc:ID schemeID="06" schemeName="Entidad Autorizadora" schemeAgencyName="PE:SUNAT">${cdata(v.autorizacion)}</cbc:ID></cac:ShipmentDocumentReference>`
    : '';
  const [vp, vs] = vehiculos;
  const attachedXml = vs
    ? `\n        <cac:AttachedTransportEquipment>
          <cbc:ID>${cdata(vs.placa)}</cbc:ID>${tuceXml(vs, '          ')}${autorizXml(vs, '          ')}
        </cac:AttachedTransportEquipment>`
    : '';
  // ── Contenedores comex → cac:Package dentro de TransportHandlingUnit (tras TransportEquipment) ──
  // ID = nº de contenedor, TraceID = nº de precinto (naviera). Calcado de EG07-273.
  const packagesXml = (comex?.contenedores || []).map((c) => `
      <cac:Package>
        <cbc:ID>${cdata(c.numero_contenedor)}</cbc:ID>${c.numero_precinto ? `
        <cbc:TraceID>${cdata(c.numero_precinto)}</cbc:TraceID>` : ''}
      </cac:Package>`).join('');
  const vehiculoXml = vp
    ? `
    <cac:TransportHandlingUnit>
      <cac:TransportEquipment>
        <cbc:ID>${cdata(vp.placa)}</cbc:ID>${tuceXml(vp, '        ')}${attachedXml}${autorizXml(vp, '        ')}
      </cac:TransportEquipment>${packagesXml}
    </cac:TransportHandlingUnit>`
    : (esTercero && !registrar)
      // ── Caso 1 (tercero sin registrar veh/cond): TransportHandlingUnit vacío (espeja EG07-81) ──
      ? `
    <cac:TransportHandlingUnit>
      <cac:TransportEquipment></cac:TransportEquipment>${packagesXml}
    </cac:TransportHandlingUnit>`
      // Sin vehículo pero con contenedores (comex sin veh declarado): THU solo con Package.
      : (packagesXml
        ? `
    <cac:TransportHandlingUnit>
      <cac:TransportEquipment></cac:TransportEquipment>${packagesXml}
    </cac:TransportHandlingUnit>`
        : '');

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

  // Documentos relacionados comex (catálogo 61): DAM (cód. 50), DS, etc. Cada uno con su
  // DocumentType descriptivo. Calcado de EG07-273. GRE Remitente lleva serie → ID = serie-numero.
  const comexDocsXml = (comex?.docsRelacionados || []).map((doc) => {
    const id = doc.serie ? `${doc.serie}-${doc.numero}` : doc.numero;
    return `\n  <cac:AdditionalDocumentReference>
    <cbc:ID>${cdata(id)}</cbc:ID>
    <cbc:DocumentTypeCode listAgencyName="PE:SUNAT" listName="Documento relacionado al transporte" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo61">${cdata(doc.tipo_cod)}</cbc:DocumentTypeCode>
    <cbc:DocumentType>${cdata(doc.tipo_desc)}</cbc:DocumentType>
  </cac:AdditionalDocumentReference>`;
  }).join('');

  // AdditionalItemProperty (catálogo 55). 7022 siempre; los comex (7020 subpartida / 7021 nº DAM /
  // 7023 nº serie DAM) solo si hay datos. Orden calcado de EG07-273: 7020, 7022, 7021, 7023.
  const CAT55 = 'listAgencyName="PE:SUNAT" listName="Propiedad del item" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo55"';
  const itemProp = (nombre, code, value) => `
      <cac:AdditionalItemProperty>
        <cbc:Name>${nombre}</cbc:Name>
        <cbc:NameCode ${CAT55}>${code}</cbc:NameCode>
        <cbc:Value>${cdata(String(value))}</cbc:Value>
      </cac:AdditionalItemProperty>`;
  const lineasXml = d.detalle.map((it, i) => {
    const prop7020 = it.subpartida_nacional ? itemProp('Subpartida nacional', '7020', it.subpartida_nacional) : '';
    const prop7022 = itemProp('Indicador de bien regulado por SUNAT', '7022', '0');
    const prop7021 = comex?.damNumero ? itemProp('Numeracion de la DAM o DS', '7021', comex.damNumero) : '';
    const prop7023 = it.dam_serie ? itemProp('Numero de serie en la DAM o DS', '7023', it.dam_serie) : '';
    return `  <cac:DespatchLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:DeliveredQuantity unitCode="${it.codigo_unidad_sunat}" unitCodeListID="UN/ECE rec 20" unitCodeListAgencyName="United Nations Economic Commission for Europe">${Number(it.cantidad)}</cbc:DeliveredQuantity>
    <cac:OrderLineReference><cbc:LineID>${i + 1}</cbc:LineID></cac:OrderLineReference>
    <cac:Item>
      <cbc:Description>${cdata(trunc(it.nombre || it.codigo, 250))}</cbc:Description>
      <cac:SellersItemIdentification><cbc:ID>${cdata(it.codigo || it.id_producto || '-')}</cbc:ID></cac:SellersItemIdentification>${prop7020}${prop7022}${prop7021}${prop7023}
    </cac:Item>
  </cac:DespatchLine>`;
  }).join('\n');

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
  <cbc:DespatchAdviceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">09</cbc:DespatchAdviceTypeCode>${notaXml}${docRelXml}${comexDocsXml}
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
    <cbc:GrossWeightMeasure unitCode="KGM">${Number(g.peso_bruto_kg).toFixed(2)}</cbc:GrossWeightMeasure>${specialXml}
    <cac:ShipmentStage>
      <cbc:TransportModeCode listName="Modalidad de traslado" listAgencyName="PE:SUNAT" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo18">${modalidad}</cbc:TransportModeCode>
      <cac:TransitPeriod><cbc:StartDate>${d.fechaTraslado}</cbc:StartDate></cac:TransitPeriod>${carrierXml}${loadingXml}${driverXml}
    </cac:ShipmentStage>
    <cac:Delivery>
      <cac:DeliveryAddress>
        <cbc:ID schemeName="Ubigeos" schemeAgencyName="PE:INEI">${g.ubigeo_llegada}</cbc:ID>
        <cbc:AddressTypeCode listID="${cli.ruc || ''}" listAgencyName="PE:SUNAT" listName="Establecimientos anexos">${comex?.deliveryEstablishmentCode || '0'}</cbc:AddressTypeCode>
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
