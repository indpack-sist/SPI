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

  const data = await postSoap(soap);

  const cdrZipBase64 = extraerApplicationResponse(data);
  if (!cdrZipBase64) {
    throw new Error('Respuesta SOAP sin applicationResponse. Cuerpo: ' + String(data).slice(0, 500));
  }

  const cdrXml = await extraerCdr(cdrZipBase64);
  const resultado = parsearCdr(cdrXml);
  return { ...resultado, cdrXml, cdrZipBase64 };
}

function envelopeOperacion(operacion, nombreZip, contentFileBase64) {
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
    <ser:${operacion}>
      <fileName>${nombreZip}</fileName>
      <contentFile>${contentFileBase64}</contentFile>
    </ser:${operacion}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postSoap(soap, { reintentos = 3, delayMs = 2500 } = {}) {
  let ultimoError;
  for (let intento = 0; intento <= reintentos; intento++) {
    try {
      const resp = await axios.post(billServiceUrl, soap, {
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
        timeout: 60000,
      });
      return resp.data;
    } catch (err) {
      const body = err.response?.data;
      if (typeof body === 'string' && body.includes('Fault')) {
        throw new Error('SOAP Fault SUNAT: ' + extraerFault(body));
      }
      // 401 y algunos 5xx en Beta son throttling transitorio: reintentar
      const status = err.response?.status;
      const transitorio = status === 401 || status === 500 || status === 503 || !err.response;
      ultimoError = err;
      if (transitorio && intento < reintentos) {
        await sleep(delayMs * (intento + 1));
        continue;
      }
      throw err;
    }
  }
  throw ultimoError;
}

/**
 * Envía un resumen (Comunicación de Baja RA / resumen). Asíncrono: devuelve un ticket.
 * @returns {Promise<string>} ticket
 */
export async function enviarResumen(nombreBase, xmlFirmado) {
  const contentFile = await comprimirXml(nombreBase, xmlFirmado);
  const data = await postSoap(envelopeOperacion('sendSummary', `${nombreBase}.zip`, contentFile));
  const m = String(data).match(/<ticket>([^<]+)<\/ticket>/);
  if (!m) throw new Error('sendSummary no devolvió ticket. Respuesta: ' + String(data).slice(0, 400));
  return m[1];
}

/**
 * Consulta el estado de un ticket (getStatus).
 * statusCode: '0' concluido OK (content=CDR) | '98' en proceso | '99' concluido con errores (content=CDR)
 * @returns {Promise<{statusCode, estado, responseCode, description, observaciones, cdrXml}>}
 */
export async function consultarTicket(ticket) {
  const soap = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soapenv:Header>
    <wsse:Security><wsse:UsernameToken>
      <wsse:Username>${SOL.ruc}${SOL.usuario}</wsse:Username>
      <wsse:Password>${SOL.clave}</wsse:Password>
    </wsse:UsernameToken></wsse:Security>
  </soapenv:Header>
  <soapenv:Body><ser:getStatus><ticket>${ticket}</ticket></ser:getStatus></soapenv:Body>
</soapenv:Envelope>`;

  const data = await postSoap(soap);
  const statusCode = (String(data).match(/<statusCode>([^<]+)<\/statusCode>/) || [])[1] || '';
  if (statusCode === '98') return { statusCode, estado: 'EN_PROCESO' };

  const contentB64 = (String(data).match(/<content>([^<]+)<\/content>/) || [])[1];
  if (!contentB64) {
    return { statusCode, estado: 'SIN_CDR', description: String(data).slice(0, 400) };
  }
  const cdrXml = await extraerCdr(contentB64);
  const parsed = parsearCdr(cdrXml);
  return { statusCode, ...parsed, cdrXml };
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
