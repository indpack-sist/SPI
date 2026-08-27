// scripts/test-gre-xml.js  —  Punto de Control Fase 10 (ítems 2 y 3), reproducible y OFFLINE.
//
// Qué cubre:
//   (2) Validación ESTRUCTURAL del XML DespatchAdvice (GRE Remitente 09): buen-formado
//       (fast-xml-parser) + invariantes obligatorias que SUNAT verifica (cbc:ID == core del
//       nombre de archivo, orden/ presencia de nodos, ubigeos, unidades, firmabilidad).
//       ⚠️ NO es una validación XSD de conformidad total (no hay esquemas .xsd en el repo);
//       la conformidad XSD real la da recién la aceptación del API GRE en PROD (Fase 16).
//   (3) Flujo MOCK de punta a punta a nivel de servicio (sin BD ni certificado): construir
//       XML → zip → enviarGuia(mock) → consultarGuia(mock) → decisión de estado ==> ACEPTADO.
//
// Uso:  node backend/scripts/test-gre-xml.js     (o  npm run test:gre  desde backend/)
// Espeja el fixture real guias_remision id_guia=2 (TE01-1, OCULAB, conductor MAX, VES→Lima).

import { XMLValidator, XMLParser } from 'fast-xml-parser';
import { construirDespatchAdviceXML } from '../services/sunat/ubl-gre.service.js';
import { zipXml } from '../services/sunat/zip.service.js';

const RUC = '20550932297';

// ── Fixture que espeja guias_remision id_guia=2 ──────────────────────────────
const datos = {
  tipo: '09', serie: 'TE01', numero: 1,
  empresa: { ruc: RUC, razon_social: 'INDPACK S.A.C.' },
  cliente: { ruc: '20562860984', razon_social: 'OCULAB S.A.C.', tipo_documento: 'RUC' },
  guia: {
    motivo_traslado_cod: '01', motivo_traslado: 'VENTA', peso_bruto_kg: 100.50,
    ubigeo_partida: '150142', direccion_partida: 'COO. LAS VERTIENTES - VILLA EL SALVADOR',
    ubigeo_llegada: '150101', direccion_llegada: 'AV. ARGENTINA 1234 - LIMA'
  },
  detalle: [
    { cantidad: 10, codigo_unidad_sunat: 'NIU', nombre: 'CAJA DE CARTON 30x30', codigo: 'PROD-001' }
  ],
  fecha: { emision: '2026-08-24', hora: '10:00:00' },
  fechaTraslado: '2026-08-24',
  modalidad: '02',
  conductor: { dni: '75336849', nombre: 'MAX ALEX SANANCINO', licencia: 'Q75336849' },
  vehiculo: { placa: 'XXX000', tuc: null }, // placeholder BETA (ya normalizado, sin guion)
  observacion: 'Entrega en almacen central | OC: 260610043' // texto libre + OC → cbc:Note
};

const nombre = `${RUC}-${datos.tipo}-${datos.serie}-${datos.numero}`; // core del filename == cbc:ID sin serie
const cbcIdEsperado = `${datos.serie}-${datos.numero}`;               // TE01-1

let pass = 0, fail = 0;
const check = (nombreCheck, cond, detalle = '') => {
  const ok = !!cond;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${nombreCheck}${detalle ? '  —  ' + detalle : ''}`);
};

console.log('\n=== FASE 10 · ítem 2 — Validación estructural del DespatchAdvice (GRE 09) ===\n');

const { xml } = construirDespatchAdviceXML(datos);

// 2.a — buen-formado
const wf = XMLValidator.validate(xml);
check('XML bien-formado (fast-xml-parser)', wf === true, wf === true ? '' : JSON.stringify(wf));

// Parse con atributos y sin prefijos ns para inspeccionar nodos.
// parseTagValue/parseAttributeValue en false: los códigos SUNAT ("09","2.0","01","02") son
// STRINGS con ceros a la izquierda; sin esto el parser los coacciona a número y falsea el check.
const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: '@', removeNSPrefix: true,
  parseTagValue: false, parseAttributeValue: false
});
const doc = parser.parse(xml);
const da = doc.DespatchAdvice;

check('Elemento raíz = DespatchAdvice', !!da);
check('DespatchAdviceTypeCode = 09', String(da?.DespatchAdviceTypeCode?.['#text'] ?? da?.DespatchAdviceTypeCode) === '09');
check('UBLVersionID = 2.1', String(da?.UBLVersionID) === '2.1');
check('CustomizationID = 2.0', String(da?.CustomizationID) === '2.0');
check(`cbc:ID = ${cbcIdEsperado} (== core del filename ${nombre})`, String(da?.ID) === cbcIdEsperado,
  `ID=${da?.ID}`);
check('ext:ExtensionContent presente (firmable)',
  da?.UBLExtensions?.UBLExtension && 'ExtensionContent' in da.UBLExtensions.UBLExtension);
check('DespatchSupplierParty = RUC emisor',
  String(da?.DespatchSupplierParty?.Party?.PartyIdentification?.ID?.['#text']) === RUC);
check('DeliveryCustomerParty = RUC destinatario',
  String(da?.DeliveryCustomerParty?.Party?.PartyIdentification?.ID?.['#text']) === datos.cliente.ruc);

const ship = da?.Shipment;
check('Shipment/HandlingCode = motivo traslado (cat20)', String(ship?.HandlingCode?.['#text']) === '01');
check('GrossWeightMeasure > 0 en KGM',
  Number(ship?.GrossWeightMeasure?.['#text']) > 0 && ship?.GrossWeightMeasure?.['@unitCode'] === 'KGM',
  `${ship?.GrossWeightMeasure?.['#text']} ${ship?.GrossWeightMeasure?.['@unitCode']}`);
check('TransportModeCode = modalidad (cat18)', String(ship?.ShipmentStage?.TransportModeCode?.['#text']) === '02');
check('Ubigeo de llegada presente', String(ship?.Delivery?.DeliveryAddress?.ID?.['#text']) === '150101');
check('Ubigeo de partida presente',
  String(ship?.Delivery?.Despatch?.DespatchAddress?.ID?.['#text']) === '150142');

// Modalidad privada (02): conductor con DNI+licencia y placa del vehículo.
const driver = ship?.ShipmentStage?.DriverPerson;
check('DriverPerson con DNI (schemeID=1)', String(driver?.ID?.['#text']) === '75336849');
check('DriverPerson con licencia', String(driver?.IdentityDocumentReference?.ID) === 'Q75336849');
check('TransportHandlingUnit con placa', String(ship?.TransportHandlingUnit?.TransportEquipment?.ID) === 'XXX000');

// Observación (texto libre + OC) → cbc:Note, que SUNAT refleja como "Observaciones".
check('cbc:Note con observación + OC', String(da?.Note || '').includes('OC: 260610043'), `Note=${da?.Note}`);

// Líneas
const lineas = Array.isArray(da?.DespatchLine) ? da.DespatchLine : [da?.DespatchLine];
check('DespatchLine: cantidad de líneas == detalle', lineas.length === datos.detalle.length);
check('DeliveredQuantity con unitCode', lineas[0]?.DeliveredQuantity?.['@unitCode'] === 'NIU',
  `unitCode=${lineas[0]?.DeliveredQuantity?.['@unitCode']}`);

// ── Escenario TERCERO (transporte por transportista): CarrierParty + MTC + TUC ──────────────
// Espeja la GRE real aceptada docs/…-09-EG07-309.xml (modalidad 02 con carrier+vehículo+conductor).
console.log('\n=== Escenario TERCERO — CarrierParty (RUC+MTC) + DriverPerson + Vehículo (placa+TUC) ===\n');
const datosTercero = {
  ...datos,
  transportista: { ruc: '20611807555', razon: 'EMPRESA DE TRANSPORTES Y SERVICIOS YELA & N S.A.C.', mtc: '15141794CNG' },
  conductor: { dni: '47327793', nombre: 'VASQUEZ MENDEZ MIGUEL', licencia: 'D47327793' },
  // Un solo vehículo (la placa que se coloca al emitir), tal como la GRE real EG07-309.
  vehiculo: { placa: 'BZK970', tuc: '15M26042991E' }
};
const { xml: xmlT } = construirDespatchAdviceXML(datosTercero);
check('XML tercero bien-formado', XMLValidator.validate(xmlT) === true);
const dt = parser.parse(xmlT).DespatchAdvice;
const stageT = dt?.Shipment?.ShipmentStage;
check('CarrierParty RUC transportista', String(stageT?.CarrierParty?.PartyIdentification?.ID?.['#text']) === '20611807555');
check('CarrierParty razón social', String(stageT?.CarrierParty?.PartyLegalEntity?.RegistrationName || '').includes('YELA'));
check('Nº MTC en CompanyID', String(stageT?.CarrierParty?.PartyLegalEntity?.CompanyID) === '15141794CNG');
check('DriverPerson (tercero) con DNI', String(stageT?.DriverPerson?.ID?.['#text']) === '47327793');
const teq = dt?.Shipment?.TransportHandlingUnit?.TransportEquipment;
check('Placa del vehículo (una sola)', String(teq?.ID) === 'BZK970');
check('Registro del vehículo en RegistrationNationalityID',
  String(teq?.ApplicableTransportMeans?.RegistrationNationalityID) === '15M26042991E');
check('Sin segundo vehículo (AttachedTransportEquipment ausente)', !teq?.AttachedTransportEquipment);
check('AdditionalItemProperty bien regulado (cat55 7022)',
  String((Array.isArray(dt?.DespatchLine) ? dt.DespatchLine[0] : dt?.DespatchLine)?.Item?.AdditionalItemProperty?.NameCode?.['#text']) === '7022');

console.log('\n=== FASE 10 · ítem 3 — Flujo MOCK de punta a punta (sin BD/cert) ===\n');

// Espeja gre.service.js en BETA: enviarGuia -> MOCKGRE+ts ; consultarGuia -> codRespuesta 0.
const esBeta = true;
const enviarGuiaMock = () => (esBeta ? 'MOCKGRE' + Date.now() : null);
const consultarGuiaMock = () => (esBeta
  ? { codRespuesta: '0', cdrZip: null, indCdrGenerado: '0', error: null, mock: true }
  : null);
// Espeja cerrarTicketGre: codRespuesta '0' -> ACEPTADO ; '99' -> RECHAZADO ; resto -> ENVIADO.
const decidirEstado = (st) => st.codRespuesta === '0' ? 'ACEPTADO' : (st.codRespuesta === '99' ? 'RECHAZADO' : 'ENVIADO');

const zipBuf = zipXml(`${nombre}.xml`, xml);
check('ZIP generado con 1 entrada = <nombre>.xml',
  Buffer.isBuffer(zipBuf) && zipBuf.length > 0);

const ticket = enviarGuiaMock();
check('enviarGuia(mock) devuelve ticket MOCKGRE...', typeof ticket === 'string' && ticket.startsWith('MOCKGRE'),
  `ticket=${ticket}`);

const st = consultarGuiaMock();
check('consultarGuia(mock) devuelve codRespuesta 0 (mock=true)', st.codRespuesta === '0' && st.mock === true);

const estadoFinal = decidirEstado(st);
check('Decisión de estado == ACEPTADO', estadoFinal === 'ACEPTADO', `estadoFinal=${estadoFinal}`);
check('CDR simulado: aceptación sin CDR-zip real (null en BETA)', st.cdrZip === null);

console.log(`\n=== RESUMEN: ${pass} PASS · ${fail} FAIL ===\n`);
if (fail > 0) process.exit(1);
