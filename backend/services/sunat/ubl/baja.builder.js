/**
 * Constructor del XML de Comunicación de Baja (SUNAT), tipo documento RA.
 * Sirve para ANULAR facturas ya aceptadas (dentro de 7 días de emitidas).
 *
 * Es un documento resumen: se envía por sendSummary (asíncrono) → ticket →
 * getStatus. Root = VoidedDocuments (namespace SUNAT). Deja ExtensionContent
 * vacío para la firma (mismo firma.service que la factura).
 */
import { SIGNATURE_ID } from '../firma.service.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const ymd = (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
const ymdCompact = (d) => ymd(d).replace(/-/g, '');

/**
 * @param {object} b
 * @param {object} b.emisor           { ruc, razonSocial }
 * @param {Date}   b.fechaGeneracion  fecha de la comunicación (hoy)
 * @param {Date}   b.fechaReferencia  fecha de emisión de los documentos a anular
 * @param {number} b.correlativo      correlativo diario de la baja (1,2,3...)
 * @param {Array}  b.items            [{ tipoDoc:'01', serie, numero, motivo }]
 * @returns {{ xml: string, nombreArchivo: string, idBaja: string }}
 */
export function construirBajaXml(b) {
  const idBaja = `RA-${ymdCompact(b.fechaGeneracion)}-${b.correlativo}`;

  const lineas = b.items
    .map(
      (it, i) => `  <sac:VoidedDocumentsLine>
    <cbc:LineID>${i + 1}</cbc:LineID>
    <cbc:DocumentTypeCode>${it.tipoDoc || '01'}</cbc:DocumentTypeCode>
    <sac:DocumentSerialID>${esc(it.serie)}</sac:DocumentSerialID>
    <sac:DocumentNumberID>${it.numero}</sac:DocumentNumberID>
    <sac:VoidReasonDescription>${esc(it.motivo)}</sac:VoidReasonDescription>
  </sac:VoidedDocumentsLine>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<VoidedDocuments xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>${idBaja}</cbc:ID>
  <cbc:ReferenceDate>${ymd(b.fechaReferencia)}</cbc:ReferenceDate>
  <cbc:IssueDate>${ymd(b.fechaGeneracion)}</cbc:IssueDate>
  <cac:Signature>
    <cbc:ID>${esc(b.emisor.ruc)}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification><cbc:ID>${esc(b.emisor.ruc)}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${esc(b.emisor.razonSocial)}</cbc:Name></cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference><cbc:URI>#${SIGNATURE_ID}</cbc:URI></cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>${esc(b.emisor.ruc)}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>6</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(b.emisor.razonSocial)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
${lineas}
</VoidedDocuments>`;

  return { xml, nombreArchivo: `${b.emisor.ruc}-${idBaja}`, idBaja };
}
