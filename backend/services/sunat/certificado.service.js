import { sunatConfig } from '../../config/sunat.js';

export function getCredencialesFirma() {
  if (!sunatConfig.cert || !sunatConfig.key) {
    throw new Error('Certificado SUNAT no configurado (SUNAT_CERT_B64 / SUNAT_KEY_B64)');
  }
  const certDer = sunatConfig.cert
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
  return { privateKeyPem: sunatConfig.key, certPem: sunatConfig.cert, certDer };
}
