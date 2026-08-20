// services/sunat/firma.service.js  —  Firma XML-DSig enveloped sobre UBL.
// La firma se inserta dentro de ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent
// (nodo vacío reservado en la plantilla UBL). Devuelve { xmlFirmado, digestValue }.
import { SignedXml } from 'xml-crypto';
import { getCredencialesFirma } from './certificado.service.js';

// ── ALGORITMOS DE FIRMA — ÚNICO lugar a cambiar ────────────────────────────
// Preset guía v1.1 (a validar contra Beta en la Fase 6): RSA-SHA512 + C14N exclusiva.
//
// FALLBACK (si Beta rechaza la firma con error 2017/2022 "firma inválida"), usar el
// preset que el branch antiguo confirmó en Beta — solo cambiar estos 3 valores:
//   canonicalization: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'   // C14N INCLUSIVA
//   signature:        'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
//   digest:           'http://www.w3.org/2000/09/xmldsig#sha1'
export const FIRMA_ALGOS = {
  canonicalization: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  signature: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512',
  digest: 'http://www.w3.org/2001/04/xmlenc#sha512',
  enveloped: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
};

/**
 * Firma un XML UBL (Invoice, CreditNote, DebitNote, VoidedDocuments, DespatchAdvice).
 * @param {string} xml  XML sin firmar, con un <ext:ExtensionContent/> reservado.
 * @returns {{ xmlFirmado: string, digestValue: string }}
 */
export function firmarXml(xml) {
  const { privateKeyPem, certDer } = getCredencialesFirma();

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    canonicalizationAlgorithm: FIRMA_ALGOS.canonicalization,
    signatureAlgorithm: FIRMA_ALGOS.signature,
    // KeyInfo con el certificado público (X509Certificate en una sola línea).
    // Se respeta el prefijo de la firma (ds) para que X509Data/X509Certificate queden
    // en el namespace XML-DSig (SUNAT lo valida contra XSD).
    getKeyInfoContent: ({ prefix } = {}) => {
      const p = prefix ? `${prefix}:` : '';
      return `<${p}X509Data><${p}X509Certificate>${certDer}</${p}X509Certificate></${p}X509Data>`;
    }
  });

  // Referencia al documento completo (URI=""), transform enveloped + C14N exclusiva.
  sig.addReference({
    xpath: '/*',
    transforms: [FIRMA_ALGOS.enveloped, FIRMA_ALGOS.canonicalization],
    digestAlgorithm: FIRMA_ALGOS.digest,
    uri: '',
    isEmptyUri: true
  });

  // Insertar la firma DENTRO del primer ext:ExtensionContent.
  sig.computeSignature(xml, {
    location: {
      reference: "//*[local-name()='ExtensionContent']",
      action: 'append'
    },
    prefix: 'ds',
    attrs: { Id: 'SignatureSP' }
  });

  const xmlFirmado = sig.getSignedXml();
  const digestValue = /<ds:DigestValue>([^<]+)<\/ds:DigestValue>/.exec(xmlFirmado)?.[1] || '';
  return { xmlFirmado, digestValue };
}
