/**
 * Firma digital XML-DSig para comprobantes SEE (SUNAT).
 *
 * Reglas SUNAT que cumple:
 *  - Firma "enveloped" sobre TODO el documento (Reference URI="").
 *  - La firma va DENTRO de <ext:UBLExtensions>/<ext:UBLExtension>/<ext:ExtensionContent>.
 *  - Canonicalización C14N inclusiva.
 *  - El <ds:Signature> lleva Id="SignatureSP", que el builder referencia desde
 *    <cac:Signature> del UBL.
 *
 * Algoritmo: por defecto RSA-SHA1 (el combo más universalmente aceptado por SUNAT,
 * usado por las librerías de referencia). SUNAT también acepta SHA-256: basta cambiar
 * las constantes de abajo.
 */
import { SignedXml } from 'xml-crypto';
import { cargarCertificado } from './cert.service.js';

export const SIGNATURE_ID = 'SignatureSP';

const SIGN_ALG = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
const DIGEST_ALG = 'http://www.w3.org/2000/09/xmldsig#sha1';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

/**
 * Firma un XML UBL que YA contiene el nodo <ext:ExtensionContent> vacío.
 * @param {string} xml - documento UBL sin firmar
 * @returns {{ xmlFirmado: string, digestValue: string, signatureValue: string }}
 */
export function firmarXml(xml) {
  const { privateKeyPem, certificatePem } = cargarCertificado();

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
    signatureAlgorithm: SIGN_ALG,
    canonicalizationAlgorithm: C14N,
  });

  // Referencia a todo el documento. El transform C14N explícito DESPUÉS del
  // enveloped es imprescindible cuando la raíz tiene namespace por defecto
  // (todos los UBL lo tienen); sin él el digest queda inconsistente.
  sig.addReference({
    xpath: '/*',
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: DIGEST_ALG,
    isEmptyUri: true, // => Reference URI=""
  });

  // Incluir el certificado X.509 en <ds:KeyInfo>
  sig.getKeyInfoContent = () =>
    `<ds:X509Data><ds:X509Certificate>${certLimpio(certificatePem)}</ds:X509Certificate></ds:X509Data>`;

  // Insertar la firma directamente dentro del primer <ext:ExtensionContent>.
  sig.computeSignature(xml, {
    prefix: 'ds',
    attrs: { Id: SIGNATURE_ID },
    location: {
      reference: "//*[local-name(.)='ExtensionContent']",
      action: 'append',
    },
  });

  const xmlFirmado = sig.getSignedXml();
  return {
    xmlFirmado,
    digestValue: extraer(xmlFirmado, 'DigestValue'),
    signatureValue: extraer(xmlFirmado, 'SignatureValue'),
  };
}

function certLimpio(pem) {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\r?\n|\r/g, '')
    .trim();
}

function extraer(xml, tag) {
  const m = xml.match(new RegExp(`<(?:ds:)?${tag}[^>]*>([^<]*)</(?:ds:)?${tag}>`));
  return m ? m[1] : null;
}
