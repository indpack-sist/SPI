import { cdata, trunc } from './ubl.service.js';

const MOTIVOS_TRASLADO = {
  '01': 'VENTA',
  '02': 'COMPRA',
  '04': 'TRASLADO ENTRE ESTABLECIMIENTOS DE LA MISMA EMPRESA',
  '08': 'IMPORTACION',
  '09': 'EXPORTACION',
  '13': 'Otros (no especificados en los anteriores)',
  '14': 'VENTA SUJETA A CONFIRMACION DEL COMPRADOR',
  '18': 'TRASLADO EMISOR ITINERANTE CP'
};

const limpiarIdVehicular = (s) => Array.from(String(s ?? '')).filter((ch) => {
  const c = ch.codePointAt(0);
  return !(c <= 0x20 || c === 0xA0 || (c >= 0x200B && c <= 0x200D) || c === 0xFEFF);
}).join('');

function partirNombre(nombre) {
  const t = String(nombre || '').trim().split(/\s+/);
  if (t.length <= 1) return { first: t[0] || '-', family: t[0] || '-' };
  return { first: t[0], family: t.slice(1).join(' ') };
}

function carrierPartyXml(transportista) {
  return `      <cac:CarrierParty>
        <cac:PartyIdentification><cbc:ID schemeID="6">${transportista.ruc}</cbc:ID></cac:PartyIdentification>
        <cac:PartyLegalEntity><cbc:RegistrationName>${cdata(transportista.razon_social)}</cbc:RegistrationName></cac:PartyLegalEntity>
      </cac:CarrierParty>`;
}

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

function vehiclesXml(vehiculos, mtcDefault) {
  return vehiculos.map((v) => {
    const mtc = limpiarIdVehicular(v.certificado_habilitacion || mtcDefault);
    const placa = limpiarIdVehicular(v.placa);
    const mtcXml = mtc
      ? `
        <cac:ApplicableTransportMeans>
          <cbc:RegistrationNationalityID>${mtc}</cbc:RegistrationNationalityID>
        </cac:ApplicableTransportMeans>`
      : '';
    return `    <cac:TransportHandlingUnit>
      <cac:TransportEquipment>
        <cbc:ID>${placa}</cbc:ID>${mtcXml}
      </cac:TransportEquipment>
    </cac:TransportHandlingUnit>`;
  }).join('\n');
}

const SCHEME_DOC = 'schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06"';

export function construirDespatchAdviceXML(d) {
  if (d.tipo !== '09') {
    const err = new Error(`GRE tipo ${d.tipo} no soportado en Fase 10 (Transportista 31 = Fase 11)`);
    err.statusCode = 422; err.isOperational = true; throw err;
  }
  const emp = d.empresa;
  const cli = d.cliente;
  const g = d.guia;
  const comex = d.comex || null;
  const modalidad = d.modalidad || '02';
  const idComprobante = `${d.serie}-${d.numero}`;
  const motivoCod = String(g.motivo_traslado_cod);
  const motivoDesc = MOTIVOS_TRASLADO[motivoCod] || String(g.motivo_traslado || 'TRASLADO').toUpperCase();
  const cliScheme = String(cli.tipo_documento || '').toUpperCase() === 'RUC' ? '6' : '1';

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

  const esTercero = !!d.transportista?.ruc;
  const registrar = esTercero ? (d.registrarTransportista !== false) : true;
  const declararVC = !esTercero || registrar;

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

  const IND = {
    trasladoTotalDam: 'SUNAT_Envio_IndicadorTrasladoTotalDAMoDS',
    registrarTransp: 'SUNAT_Envio_IndicadorVehiculoConductoresTransp',
    transbordo:      'SUNAT_Envio_IndicadorTransbordoProgramado',
    m1l:             'SUNAT_Envio_IndicadorTrasladoVehiculoM1L',
    retornoVacio:    'SUNAT_Envio_IndicadorRetornoVehiculoEnvaseVacio',
  };
  const ind = d.indicadores || {};
  const indicadores = [];
  if (comex?.trasladoTotalDam) indicadores.push(IND.trasladoTotalDam);
  if (ind.registrarTransp) indicadores.push(IND.registrarTransp);
  if (ind.transbordo) indicadores.push(IND.transbordo);
  if (ind.m1l) indicadores.push(IND.m1l);
  if (ind.retornoVacio) indicadores.push(IND.retornoVacio);
  const specialXml = indicadores.map((s) => `\n    <cbc:SpecialInstructions>${s}</cbc:SpecialInstructions>`).join('');

  const loadingXml = (esTercero && d.fechaEntregaTransportista)
    ? `
      <cac:LoadingTransportEvent><cbc:OccurrenceDate>${d.fechaEntregaTransportista}</cbc:OccurrenceDate></cac:LoadingTransportEvent>`
    : '';

  const vehiculos = (declararVC && Array.isArray(d.vehiculos)) ? d.vehiculos.filter(v => v?.placa) : [];
  const tuceXml = (v, ind) => {
    const tuce = limpiarIdVehicular(v?.tuce);
    return tuce
      ? `\n${ind}<cac:ApplicableTransportMeans><cbc:RegistrationNationalityID>${cdata(tuce)}</cbc:RegistrationNationalityID></cac:ApplicableTransportMeans>`
      : '';
  };
  const autorizXml = (v, ind) => {
    const aut = limpiarIdVehicular(v?.autorizacion);
    return aut
      ? `\n${ind}<cac:ShipmentDocumentReference><cbc:ID schemeID="06" schemeName="Entidad Autorizadora" schemeAgencyName="PE:SUNAT">${cdata(aut)}</cbc:ID></cac:ShipmentDocumentReference>`
      : '';
  };
  const [vp, vs] = vehiculos;
  const attachedXml = vs
    ? `\n        <cac:AttachedTransportEquipment>
          <cbc:ID>${cdata(limpiarIdVehicular(vs.placa))}</cbc:ID>${tuceXml(vs, '          ')}${autorizXml(vs, '          ')}
        </cac:AttachedTransportEquipment>`
    : '';
  const packagesXml = (comex?.contenedores || []).map((c) => `
      <cac:Package>
        <cbc:ID>${cdata(c.numero_contenedor)}</cbc:ID>${c.numero_precinto ? `
        <cbc:TraceID>${cdata(c.numero_precinto)}</cbc:TraceID>` : ''}
      </cac:Package>`).join('');
  const vehiculoXml = vp
    ? `
    <cac:TransportHandlingUnit>
      <cac:TransportEquipment>
        <cbc:ID>${cdata(limpiarIdVehicular(vp.placa))}</cbc:ID>${tuceXml(vp, '        ')}${attachedXml}${autorizXml(vp, '        ')}
      </cac:TransportEquipment>${packagesXml}
    </cac:TransportHandlingUnit>`
    : (esTercero && !registrar)
      ? `
    <cac:TransportHandlingUnit>
      <cac:TransportEquipment></cac:TransportEquipment>${packagesXml}
    </cac:TransportHandlingUnit>`
      : (packagesXml
        ? `
    <cac:TransportHandlingUnit>
      <cac:TransportEquipment></cac:TransportEquipment>${packagesXml}
    </cac:TransportHandlingUnit>`
        : '');

  const notaXml = d.observacion
    ? `\n  <cbc:Note>${cdata(trunc(d.observacion, 250))}</cbc:Note>`
    : '';

  const docRelXml = d.docRelacionado
    ? (d.docRelacionado.issuerRuc
      ? `\n  <cac:AdditionalDocumentReference>
    <cbc:ID>${cdata(d.docRelacionado.numero)}</cbc:ID>
    <cbc:DocumentTypeCode listAgencyName="PE:SUNAT" listName="Documento relacionado al transporte" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo61">${cdata(d.docRelacionado.tipo)}</cbc:DocumentTypeCode>
    <cbc:DocumentType>${cdata(d.docRelacionado.tipo_desc || 'Factura')}</cbc:DocumentType>
    <cac:IssuerParty>
      <cac:PartyIdentification><cbc:ID schemeID="6" ${SCHEME_DOC}>${cdata(d.docRelacionado.issuerRuc)}</cbc:ID></cac:PartyIdentification>
    </cac:IssuerParty>
  </cac:AdditionalDocumentReference>`
      : `\n  <cac:AdditionalDocumentReference>
    <cbc:ID>${d.docRelacionado.numero}</cbc:ID>
    <cbc:DocumentTypeCode>${d.docRelacionado.tipo}</cbc:DocumentTypeCode>
  </cac:AdditionalDocumentReference>`)
    : '';

  const sellerSupplierXml = d.proveedor?.ruc
    ? `\n  <cac:SellerSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="6" ${SCHEME_DOC}>${cdata(d.proveedor.ruc)}</cbc:ID></cac:PartyIdentification>
      <cac:PartyLegalEntity><cbc:RegistrationName>${cdata(d.proveedor.razon_social || '')}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:SellerSupplierParty>`
    : '';

  const docsVentaXml = (Array.isArray(d.docsRelacionadosVenta) ? d.docsRelacionadosVenta : [])
    .filter((doc) => doc && doc.numero)
    .map((doc) => `\n  <cac:AdditionalDocumentReference>
    <cbc:ID>${cdata(doc.numero)}</cbc:ID>
    <cbc:DocumentTypeCode listAgencyName="PE:SUNAT" listName="Documento relacionado al transporte" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo61">${cdata(doc.tipo || '01')}</cbc:DocumentTypeCode>
    <cbc:DocumentType>${cdata(doc.tipo_desc || 'Factura')}</cbc:DocumentType>
    <cac:IssuerParty>
      <cac:PartyIdentification><cbc:ID schemeID="6" ${SCHEME_DOC}>${cdata(doc.issuerRuc)}</cbc:ID></cac:PartyIdentification>
    </cac:IssuerParty>
  </cac:AdditionalDocumentReference>`).join('');

  const comexDocsXml = (comex?.docsRelacionados || []).map((doc) => {
    const id = doc.serie ? `${doc.serie}-${doc.numero}` : doc.numero;
    return `\n  <cac:AdditionalDocumentReference>
    <cbc:ID>${cdata(id)}</cbc:ID>
    <cbc:DocumentTypeCode listAgencyName="PE:SUNAT" listName="Documento relacionado al transporte" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo61">${cdata(doc.tipo_cod)}</cbc:DocumentTypeCode>
    <cbc:DocumentType>${cdata(doc.tipo_desc)}</cbc:DocumentType>
  </cac:AdditionalDocumentReference>`;
  }).join('');

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
    const itemCodigo = it.codigo_bien || it.codigo || (it.id_producto != null ? String(it.id_producto) : '');
    const sellerIdXml = itemCodigo
      ? `
      <cac:SellersItemIdentification><cbc:ID>${cdata(itemCodigo)}</cbc:ID></cac:SellersItemIdentification>`
      : '';
    return `  <cac:DespatchLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:DeliveredQuantity unitCode="${it.codigo_unidad_sunat}" unitCodeListID="UN/ECE rec 20" unitCodeListAgencyName="United Nations Economic Commission for Europe">${Number(it.cantidad)}</cbc:DeliveredQuantity>
    <cac:OrderLineReference><cbc:LineID>${i + 1}</cbc:LineID></cac:OrderLineReference>
    <cac:Item>
      <cbc:Description>${cdata(trunc(it.nombre || it.codigo, 250))}</cbc:Description>${sellerIdXml}${prop7020}${prop7022}${prop7021}${prop7023}    </cac:Item>
  </cac:DespatchLine>`;
  }).join('\n');

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
  <cbc:DespatchAdviceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">09</cbc:DespatchAdviceTypeCode>${notaXml}${docRelXml}${docsVentaXml}${comexDocsXml}
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
  </cac:DeliveryCustomerParty>${sellerSupplierXml}
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
          <cbc:AddressTypeCode listID="${d.proveedor?.ruc || emp.ruc || ''}" listAgencyName="PE:SUNAT" listName="Establecimientos anexos">0</cbc:AddressTypeCode>
          <cac:AddressLine><cbc:Line>${cdata(trunc(g.direccion_partida, 250))}</cbc:Line></cac:AddressLine>
        </cac:DespatchAddress>
      </cac:Despatch>
    </cac:Delivery>${vehiculoXml}
  </cac:Shipment>
${lineasXml}
</DespatchAdvice>`;

  return { xml };
}
