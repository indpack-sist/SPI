/**
 * Carga el certificado digital (.pfx / PKCS#12) y expone lo que necesita la
 * firma XML-DSig: la clave privada en PEM y el certificado X.509 en Base64 DER.
 *
 * Todo el proyecto obtiene el certificado SOLO por aquí. Para pasar a Producción
 * basta cambiar SEE_CERT_PATH/PASSWORD en el .env; ni una línea más cambia.
 */
import fs from 'fs';
import forge from 'node-forge';
import { CERT } from './config.js';

let _cache = null;

export function cargarCertificado() {
  if (_cache) return _cache;

  const p12Buffer = fs.readFileSync(CERT.path);
  const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'));
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, CERT.password);

  // Clave privada
  const keyBag =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0] ||
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
  if (!keyBag) throw new Error('No se encontró la clave privada en el .pfx');
  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);

  // Certificado
  const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
  if (!certBag) throw new Error('No se encontró el certificado en el .pfx');
  const certificatePem = forge.pki.certificateToPem(certBag.cert);

  // Certificado en Base64 DER (sin cabeceras) → va dentro de <ds:X509Certificate>
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certBag.cert)).getBytes();
  const certificateBase64 = forge.util.encode64(certDer);

  _cache = {
    privateKeyPem,
    certificatePem,
    certificateBase64,
    // Datos útiles del subject (RUC va en serialNumber del subject)
    subject: certBag.cert.subject.attributes.reduce((acc, a) => {
      acc[a.name || a.type] = a.value;
      return acc;
    }, {}),
  };
  return _cache;
}
