// services/sunat/ubl-baja.service.js  —  VoidedDocuments (RA / Comunicación de Baja).
// FASE 8. Único mecanismo de anulación de facturas (01) y sus notas (07/08) dentro de 7 días.
// (RC/Resumen Diario NO aplica: SPI no emite boletas.)
import { cdata } from './ubl.service.js';

/**
 * Construye el XML de una Comunicación de Baja (VoidedDocuments-1).
 * @param {object} ra
 * @param {string} ra.identificador     'RA-YYYYMMDD-#####' (== cbc:ID; comparte core con el filename)
 * @param {string} ra.fechaReferencia   'YYYY-MM-DD' fecha de EMISIÓN de los comprobantes
 * @param {string} ra.fechaComunicacion 'YYYY-MM-DD' fecha en que se comunica la baja
 * @param {object} ra.empresa           empresa_config (ruc, razon_social)
 * @param {Array<{lineId:number,tipoDoc:string,serie:string,numero:number,motivo:string}>} ra.lineas
 * @returns {string} XML sin firmar (con <ext:ExtensionContent/> reservado para la firma)
 */
export function construirVoidedDocumentsXML(ra) {
  if (!ra.lineas || !ra.lineas.length) {
    const err = new Error('La comunicación de baja no tiene líneas');
    err.statusCode = 422; err.isOperational = true; throw err;
  }
  const emp = ra.empresa;

  const lineasXml = ra.lineas.map((l) => `  <sac:VoidedDocumentsLine>
    <cbc:LineID>${l.lineId}</cbc:LineID>
    <cbc:DocumentTypeCode>${l.tipoDoc}</cbc:DocumentTypeCode>
    <sac:DocumentSerialID>${l.serie}</sac:DocumentSerialID>
    <sac:DocumentNumberID>${l.numero}</sac:DocumentNumberID>
    <sac:VoidReasonDescription>${cdata(l.motivo)}</sac:VoidReasonDescription>
  </sac:VoidedDocumentsLine>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<VoidedDocuments xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1">
  <ext:UBLExtensions>
    <ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>${ra.identificador}</cbc:ID>
  <cbc:ReferenceDate>${ra.fechaReferencia}</cbc:ReferenceDate>
  <cbc:IssueDate>${ra.fechaComunicacion}</cbc:IssueDate>
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
  <cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>${emp.ruc}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>6</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(emp.razon_social)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
${lineasXml}
</VoidedDocuments>`;
}
