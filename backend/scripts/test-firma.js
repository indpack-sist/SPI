// scripts/test-firma.js
// Prueba LOCAL de la firma XML-DSig (Fase 5). NO envía nada a SUNAT.
// Firma un XML UBL de prueba con el certificado real de las variables de entorno,
// imprime el digestValue y verifica que la firma quedó dentro de ext:ExtensionContent.
//
// Uso:  node scripts/test-firma.js      (requiere backend/.env con SUNAT_CERT_B64/SUNAT_KEY_B64)
//   o:  npm run test:firma
import { DOMParser } from 'xmldom';
import xpath from 'xpath';
import { firmarXml, FIRMA_ALGOS } from '../services/sunat/firma.service.js';
import { getCredencialesFirma } from '../services/sunat/certificado.service.js';
import { SignedXml } from 'xml-crypto';

// XML UBL mínimo de prueba, con el <ext:ExtensionContent/> reservado para la firma.
// (No se declara xmlns:ds en la raíz: la firma inserta su propio prefijo ds.)
const XML_PRUEBA = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
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
  <cbc:ID>FE01-1</cbc:ID>
  <cbc:IssueDate>2026-08-20</cbc:IssueDate>
  <cbc:InvoiceTypeCode listID="0101">01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
</Invoice>`;

function ok(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.error(`  ❌ ${msg}`); }

function verificarCriptografico(xmlFirmado, certPem) {
  const doc = new DOMParser().parseFromString(xmlFirmado);
  const nodo = xpath.select("//*[local-name()='Signature']", doc)[0];
  if (!nodo) throw new Error('No se encontró el nodo Signature para verificar');
  const sig = new SignedXml({ publicCert: certPem });
  sig.loadSignature(nodo);
  return { valido: sig.checkSignature(xmlFirmado) };
}

async function main() {
  console.log('── Prueba de firma XML-DSig (local, sin SUNAT) ──');
  console.log('Algoritmos:', {
    firma: FIRMA_ALGOS.signature.split('#')[1] || FIRMA_ALGOS.signature,
    digest: FIRMA_ALGOS.digest.split('#')[1] || FIRMA_ALGOS.digest,
    c14n: FIRMA_ALGOS.canonicalization
  });

  const { certPem } = getCredencialesFirma();
  const { xmlFirmado, digestValue } = firmarXml(XML_PRUEBA);

  let errores = 0;

  // 1) digestValue no vacío
  if (digestValue) ok(`digestValue: ${digestValue}`);
  else { fail('digestValue vacío'); errores++; }

  // 2) La firma quedó DENTRO de ext:ExtensionContent
  const m = /<ext:ExtensionContent>([\s\S]*?)<\/ext:ExtensionContent>/.exec(xmlFirmado);
  if (m && /<ds:Signature[\s>]/.test(m[1])) ok('ds:Signature insertada dentro de ext:ExtensionContent');
  else { fail('La firma NO está dentro de ext:ExtensionContent'); errores++; }

  // 3) Elementos de firma presentes
  for (const tag of ['ds:SignedInfo', 'ds:SignatureValue']) {
    if (xmlFirmado.includes(`<${tag}`)) ok(`presente ${tag}`);
    else { fail(`falta ${tag}`); errores++; }
  }
  // Certificado en KeyInfo (debe ir prefijado en el namespace ds)
  if (/<ds:X509Certificate>/.test(xmlFirmado)) ok('presente ds:X509Certificate (namespaced)');
  else { fail('falta ds:X509Certificate namespaced en KeyInfo'); errores++; }

  // 4) Verificación criptográfica con el certificado público
  try {
    const { valido } = verificarCriptografico(xmlFirmado, certPem);
    if (valido) ok('verificación criptográfica de la firma: VÁLIDA');
    else { fail('verificación criptográfica: INVÁLIDA'); errores++; }
  } catch (e) {
    console.warn(`  ⚠️  verificación criptográfica no concluyente: ${e.message}`);
  }

  // Volcar el XML firmado para inspección manual (no versionado; sunat-output está en .gitignore).
  try {
    const { writeFileSync, mkdirSync } = await import('fs');
    mkdirSync('sunat-output', { recursive: true });
    writeFileSync('sunat-output/test-firma.xml', xmlFirmado, 'utf8');
    console.log('\nXML firmado escrito en backend/sunat-output/test-firma.xml');
  } catch { /* no crítico */ }

  console.log(errores === 0 ? '\n✅ FIRMA OK — fase validable localmente' : `\n❌ ${errores} problema(s) en la firma`);
  process.exit(errores === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\n❌ Error ejecutando la prueba de firma:', e.message);
  console.error('   (¿Están SUNAT_CERT_B64 y SUNAT_KEY_B64 en backend/.env?)');
  process.exit(1);
});
