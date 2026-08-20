// services/sunat/soap.service.js  —  Canal SOAP SUNAT (WS-Security UsernameToken).
// FASE 6: sendBill. sendSummary/getStatus (Fase 8) y getStatusCdr (Fase 9) siguen pendientes.
import axios from 'axios';
import { sunatConfig } from '../../config/sunat.js';

function envelope(bodyInner) {
  const user = sunatConfig.ruc + sunatConfig.solUser; // ej: 20550932297MODDATOS
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
      'xmlns:ser="http://service.sunat.gob.pe" ' +
      'xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">' +
      '<soapenv:Header><wsse:Security><wsse:UsernameToken>' +
        '<wsse:Username>' + user + '</wsse:Username>' +
        '<wsse:Password>' + sunatConfig.solPass + '</wsse:Password>' +
      '</wsse:UsernameToken></wsse:Security></soapenv:Header>' +
      '<soapenv:Body>' + bodyInner + '</soapenv:Body>' +
    '</soapenv:Envelope>';
}

async function post(xml, soapAction, url = sunatConfig.urls.FACTURACION) {
  const { data, status } = await axios.post(url, xml, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapAction },
    timeout: 60000,
    validateStatus: () => true // los faults llegan como HTTP 500 con XML
  });
  return { data, status };
}

/**
 * Envía factura/nota. Devuelve el Buffer del ZIP del CDR, o lanza un Error con faultCode.
 */
export async function sendBill(nombreZip, zipBuffer) {
  const body = '<ser:sendBill>' +
    '<fileName>' + nombreZip + '</fileName>' +
    '<contentFile>' + zipBuffer.toString('base64') + '</contentFile>' +
  '</ser:sendBill>';
  const { data, status } = await post(envelope(body), 'urn:sendBill');
  const cdrB64 = /<applicationResponse>([^<]+)<\/applicationResponse>/.exec(data)?.[1];
  if (!cdrB64) {
    const faultCode = /<faultcode>([^<]*)<\/faultcode>/.exec(data)?.[1] || String(status);
    const faultMsg = /<faultstring>([\s\S]*?)<\/faultstring>/.exec(data)?.[1] || 'Sin detalle';
    const err = new Error('SUNAT fault ' + faultCode + ': ' + faultMsg);
    err.faultCode = faultCode.replace(/\D/g, ''); // "soap-env:Client.1033" -> "1033"
    err.httpStatus = status;
    throw err;
  }
  return Buffer.from(cdrB64, 'base64');
}

export async function sendSummary(nombreZip, zipBuffer) {
  throw new Error('soap.service.sendSummary no implementado (Fase 8)');
}

export async function getStatus(ticket) {
  throw new Error('soap.service.getStatus no implementado (Fase 8)');
}

export async function getStatusCdr(tipo, serie, numero) {
  throw new Error('soap.service.getStatusCdr no implementado (Fase 9)');
}
