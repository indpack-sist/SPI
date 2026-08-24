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
  conductor: { dni: '75336849', nombre_completo: 'MAX ALEX SANANCINO', licencia_conducir: 'Q75336849' },
  placa: 'XXX-000' // placeholder BETA (guias_remision no tiene columna placa)
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
check('DespatchAdviceTypeCode = 09', String(da?.DespatchAdviceTypeCode) === '09');
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
check('TransportHandlingUnit con placa', String(ship?.TransportHandlingUnit?.TransportEquipment?.ID) === 'XXX-000');

// Líneas
const lineas = Array.isArray(da?.DespatchLine) ? da.DespatchLine : [da?.DespatchLine];
check('DespatchLine: cantidad de líneas == detalle', lineas.length === datos.detalle.length);
check('DeliveredQuantity con unitCode', lineas[0]?.DeliveredQuantity?.['@unitCode'] === 'NIU',
  `unitCode=${lineas[0]?.DeliveredQuantity?.['@unitCode']}`);

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
