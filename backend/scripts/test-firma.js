/**
 * PoC: firma un UBL mínimo y VERIFICA la firma localmente (sin SUNAT).
 * Confirma que la firma queda dentro de ExtensionContent y es válida.
 */
import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
import { firmarXml, SIGNATURE_ID } from '../services/sunat/firma.service.js';
import { cargarCertificado } from '../services/sunat/cert.service.js';

// UBL Invoice mínimo pero estructuralmente válido (namespaces + ExtensionContent vacío)
const ublMinimo = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>F001-1</cbc:ID>
  <cac:Signature>
    <cbc:ID>${SIGNATURE_ID}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification><cbc:ID>20000000001</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>EMPRESA DE PRUEBA SEE</cbc:Name></cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference><cbc:URI>#${SIGNATURE_ID}</cbc:URI></cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
</Invoice>`;

const { xmlFirmado, digestValue, signatureValue } = firmarXml(ublMinimo);

console.log('DigestValue   :', digestValue);
console.log('SignatureValue:', (signatureValue || '').slice(0, 40), '...');

// ¿La firma quedó DENTRO de ExtensionContent?
const dentro = /<ext:ExtensionContent>\s*<ds:Signature/.test(xmlFirmado);
console.log('Firma dentro de ExtensionContent:', dentro ? 'SÍ ✅' : 'NO ❌');

// Verificación criptográfica local
const doc = new DOMParser().parseFromString(xmlFirmado, 'text/xml');
const signatureNode = doc.getElementsByTagName('ds:Signature')[0];
const { certificatePem } = cargarCertificado();
const verify = new SignedXml({ publicCert: certificatePem });
verify.loadSignature(signatureNode);
const ok = verify.checkSignature(xmlFirmado);
console.log('Firma válida (checkSignature):', ok ? 'SÍ ✅' : 'NO ❌');
if (!ok) console.log('Errores:', verify.validationErrors);
