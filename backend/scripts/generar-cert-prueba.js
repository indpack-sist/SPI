/**
 * Genera un certificado digital AUTOFIRMADO para PRUEBAS en SUNAT Beta.
 *
 * OJO: esto NO sirve para Producción. En Beta, SUNAT no valida la cadena de
 * confianza del certificado, solo que la firma XML esté bien hecha. Para
 * Producción se reemplaza el .pfx por uno de una entidad acreditada (INDECOPI).
 *
 * Uso:  node scripts/generar-cert-prueba.js
 * Salida: backend/certs/cert-prueba.pfx  (clave: la de CERT_PASSWORD abajo)
 */
import forge from 'node-forge';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CERTS_DIR = path.join(__dirname, '..', 'certs');

// Datos del emisor de PRUEBA (RUC de homologación de SUNAT)
const RUC = '20000000001';
const RAZON_SOCIAL = 'EMPRESA DE PRUEBA SEE';
const CERT_PASSWORD = '123456'; // clave del .pfx — cámbiala en tu .env real

function main() {
  if (!fs.existsSync(CERTS_DIR)) fs.mkdirSync(CERTS_DIR, { recursive: true });

  console.log('Generando par de llaves RSA 2048...');
  const keys = forge.pki.rsa.generateKeyPair(2048);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + Date.now();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

  const attrs = [
    { name: 'commonName', value: `${RAZON_SOCIAL} ${RUC}` },
    { name: 'organizationName', value: RAZON_SOCIAL },
    { name: 'serialNumber', value: RUC },
    { name: 'countryName', value: 'PE' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs); // autofirmado: issuer == subject
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, keyEncipherment: true },
  ]);

  // Firma con SHA-256
  cert.sign(keys.privateKey, forge.md.sha256.create());
  console.log('Certificado autofirmado creado.');

  // Empaquetar en PKCS#12 (.pfx)
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], CERT_PASSWORD, {
    algorithm: '3des',
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();

  const pfxPath = path.join(CERTS_DIR, 'cert-prueba.pfx');
  fs.writeFileSync(pfxPath, Buffer.from(p12Der, 'binary'));

  // También guardo PEM sueltos por comodidad de debug
  fs.writeFileSync(path.join(CERTS_DIR, 'cert-prueba.crt.pem'), forge.pki.certificateToPem(cert));
  fs.writeFileSync(path.join(CERTS_DIR, 'cert-prueba.key.pem'), forge.pki.privateKeyToPem(keys.privateKey));

  console.log('\n✅ Listo:');
  console.log('   PFX :', pfxPath);
  console.log('   Clave del PFX:', CERT_PASSWORD);
  console.log('   RUC :', RUC);
  console.log('\nAgrega a tu .env:');
  console.log(`   SEE_CERT_PATH=./certs/cert-prueba.pfx`);
  console.log(`   SEE_CERT_PASSWORD=${CERT_PASSWORD}`);
  console.log(`   SEE_RUC=${RUC}`);
}

main();
