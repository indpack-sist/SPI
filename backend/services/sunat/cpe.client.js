/**
 * Cliente SOAP del servicio de facturación SEE (billService).
 * Operación principal: sendBill (síncrono) -> devuelve el CDR al instante.
 *
 * Seguridad: WS-Security UsernameToken.
 *   Username = RUC + usuario SOL   (ej. 20000000001MODDATOS)
 *   Password = clave SOL
 */
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { billServiceUrl, SOL } from './config.js';
import { comprimirXml, extraerCdr } from './zip.service.js';
import { parsearCdr } from './cdr.service.js';

const faultParser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });

function envelopeSendBill(nombreZip, contentFileBase64) {
  const username = `${SOL.ruc}${SOL.usuario}`;
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soapenv:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${username}</wsse:Username>
        <wsse:Password>${SOL.clave}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ser:sendBill>
      <fileName>${nombreZip}</fileName>
      <contentFile>${contentFileBase64}</contentFile>
    </ser:sendBill>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Envía una factura firmada y devuelve el resultado del CDR.
 * @param {string} nombreBase  ej. 20000000001-01-F001-1
 * @param {string} xmlFirmado  XML UBL firmado
 * @returns {Promise<{estado, responseCode, description, observaciones, cdrXml, cdrZipBase64}>}
 */
export async function enviarFactura(nombreBase, xmlFirmado) {
  const contentFile = await comprimirXml(nombreBase, xmlFirmado);
  const nombreZip = `${nombreBase}.zip`;
  const soap = envelopeSendBill(nombreZip, contentFile);

  let resp;
  try {
    resp = await axios.post(billServiceUrl, soap, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: '',
      },
      timeout: 60000,
    });
  } catch (err) {
    // SUNAT responde faults con HTTP 500 + cuerpo SOAP
    const body = err.response?.data;
    if (typeof body === 'string' && body.includes('Fault')) {
      throw new Error('SOAP Fault SUNAT: ' + extraerFault(body));
    }
    throw err;
  }

  const cdrZipBase64 = extraerApplicationResponse(resp.data);
  if (!cdrZipBase64) {
    throw new Error('Respuesta SOAP sin applicationResponse. Cuerpo: ' + String(resp.data).slice(0, 500));
  }

  const cdrXml = await extraerCdr(cdrZipBase64);
  const resultado = parsearCdr(cdrXml);
  return { ...resultado, cdrXml, cdrZipBase64 };
}

function extraerApplicationResponse(soapXml) {
  const m = String(soapXml).match(/<applicationResponse>([^<]+)<\/applicationResponse>/);
  return m ? m[1] : null;
}

function extraerFault(soapXml) {
  const obj = faultParser.parse(soapXml);
  const fault = obj?.Envelope?.Body?.Fault;
  if (!fault) return String(soapXml).slice(0, 300);
  return `${fault.faultcode || ''} - ${fault.faultstring || ''}`;
}
