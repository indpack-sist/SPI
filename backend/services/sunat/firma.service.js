import { SignedXml } from 'xml-crypto';
import { getCredencialesFirma } from './certificado.service.js';

export const FIRMA_ALGOS = {
  canonicalization: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  signature: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512',
  digest: 'http://www.w3.org/2001/04/xmlenc#sha512',
  enveloped: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
};

export function firmarXml(xml) {
  const { privateKeyPem, certDer } = getCredencialesFirma();

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    canonicalizationAlgorithm: FIRMA_ALGOS.canonicalization,
    signatureAlgorithm: FIRMA_ALGOS.signature,
    getKeyInfoContent: ({ prefix } = {}) => {
      const p = prefix ? `${prefix}:` : '';
      return `<${p}X509Data><${p}X509Certificate>${certDer}</${p}X509Certificate></${p}X509Data>`;
    }
  });

  sig.addReference({
    xpath: '/*',
    transforms: [FIRMA_ALGOS.enveloped, FIRMA_ALGOS.canonicalization],
    digestAlgorithm: FIRMA_ALGOS.digest,
    uri: '',
    isEmptyUri: true
  });

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
