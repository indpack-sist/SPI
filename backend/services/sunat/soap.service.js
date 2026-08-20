// services/sunat/soap.service.js  —  Canal SOAP SUNAT: sendBill, sendSummary, getStatus, getStatusCdr.
// SKELETON: se implementa en la FASE 6 (WS-Security UsernameToken sobre sunatConfig.urls.FACTURACION).
/* eslint-disable no-unused-vars */

export async function sendBill(nombreZip, zipBuffer) {
  throw new Error('soap.service.sendBill no implementado (Fase 6)');
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
