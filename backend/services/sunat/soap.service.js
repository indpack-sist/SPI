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

// Extrae fault de una respuesta SOAP y lanza un Error con faultCode numérico.
function lanzarFault(data, status, contexto) {
  const faultCode = /<faultcode>([^<]*)<\/faultcode>/.exec(data)?.[1] || String(status);
  const faultMsg = /<faultstring>([\s\S]*?)<\/faultstring>/.exec(data)?.[1] || 'Sin detalle';
  const err = new Error(`SUNAT fault ${faultCode} (${contexto}): ${faultMsg}`);
  err.faultCode = faultCode.replace(/\D/g, '');
  err.httpStatus = status;
  throw err;
}

/**
 * Envía un resumen/comunicación de baja (RA). Es ASÍNCRONO: devuelve un ticket que se
 * consulta luego con getStatus. Lanza Error con faultCode si SUNAT responde un fault.
 * @returns {Promise<string>} ticket
 */
export async function sendSummary(nombreZip, zipBuffer) {
  const body = '<ser:sendSummary>' +
    '<fileName>' + nombreZip + '</fileName>' +
    '<contentFile>' + zipBuffer.toString('base64') + '</contentFile>' +
  '</ser:sendSummary>';
  const { data, status } = await post(envelope(body), 'urn:sendSummary');
  const ticket = /<ticket>([^<]+)<\/ticket>/.exec(data)?.[1];
  if (!ticket) lanzarFault(data, status, 'sendSummary');
  return ticket;
}

/**
 * Consulta el estado de un ticket de sendSummary.
 * @returns {Promise<{statusCode:string, cdrZip:(Buffer|null)}>}
 *   statusCode: '0' aceptado (cdrZip presente) · '98' en proceso · '99' rechazado (cdrZip con error)
 */
export async function getStatus(ticket) {
  const body = '<ser:getStatus><ticket>' + ticket + '</ticket></ser:getStatus>';
  const { data, status } = await post(envelope(body), 'urn:getStatus');
  const statusCode = /<statusCode>([^<]*)<\/statusCode>/.exec(data)?.[1];
  if (statusCode == null) lanzarFault(data, status, 'getStatus');
  const contentB64 = /<content>([^<]+)<\/content>/.exec(data)?.[1] || null;
  return {
    statusCode: String(statusCode).trim(),
    cdrZip: contentB64 ? Buffer.from(contentB64, 'base64') : null
  };
}

/**
 * Consulta el CDR de un comprobante ya enviado (SOLO PRODUCCIÓN, tipos 01/07/08).
 * Usos: recuperar un CDR perdido, resolver fault 1033 (duplicado), verificar tras timeout.
 * @returns {Promise<{statusCode:string, statusMessage:string, cdrZip:(Buffer|null)}>}
 *   0001 aceptado (adjunta CDR) · 0002 rechazado · 0003 baja · 0004 no existe · 0098 en proceso
 */
export async function getStatusCdr(tipo, serie, numero) {
  if (!sunatConfig.urls.CONSULTA_CDR) {
    const err = new Error('Consulta de CDR (getStatusCdr) no disponible en BETA: es un servicio solo de producción');
    err.statusCode = 409; err.isOperational = true; throw err;
  }
  const body = '<ser:getStatusCdr>' +
    '<rucComprobante>' + sunatConfig.ruc + '</rucComprobante>' +
    '<tipoComprobante>' + tipo + '</tipoComprobante>' +
    '<serieComprobante>' + serie + '</serieComprobante>' +
    '<numeroComprobante>' + numero + '</numeroComprobante>' +
  '</ser:getStatusCdr>';
  const { data, status } = await post(envelope(body), 'urn:getStatusCdr', sunatConfig.urls.CONSULTA_CDR);
  const statusCode = /<statusCode>([^<]*)<\/statusCode>/.exec(data)?.[1];
  if (statusCode == null) lanzarFault(data, status, 'getStatusCdr');
  const statusMessage = /<statusMessage>([\s\S]*?)<\/statusMessage>/.exec(data)?.[1] || '';
  const contentB64 = /<content>([^<]+)<\/content>/.exec(data)?.[1] || null;
  return {
    statusCode: String(statusCode).trim(),
    statusMessage,
    cdrZip: contentB64 ? Buffer.from(contentB64, 'base64') : null
  };
}
