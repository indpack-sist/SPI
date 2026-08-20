// services/sunat/certificado.service.js
// Carga el certificado y la clave privada desde las variables de entorno (vía sunatConfig).
// La firma real (xml-crypto) se implementa en firma.service.js (Fase 5).
import { sunatConfig } from '../../config/sunat.js';

export function getCredencialesFirma() {
  if (!sunatConfig.cert || !sunatConfig.key) {
    throw new Error('Certificado SUNAT no configurado (SUNAT_CERT_B64 / SUNAT_KEY_B64)');
  }
  // Certificado sin cabeceras PEM, en una sola línea (para X509Certificate del XML firmado).
  const certDer = sunatConfig.cert
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
  return { privateKeyPem: sunatConfig.key, certPem: sunatConfig.cert, certDer };
}
