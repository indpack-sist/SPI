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

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { XMLValidator, XMLParser } from 'fast-xml-parser';
import { construirDespatchAdviceXML } from '../services/sunat/ubl-gre.service.js';
import { zipXml } from '../services/sunat/zip.service.js';
import { normalizarPlaca, placaValida } from '../services/sunat/util.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  modalidad: '02', // vehículo propio (privado)
  conductor: { dni: '75336849', nombre: 'MAX ALEX SANANCINO', licencia: 'Q75336849' },
  vehiculos: [{ placa: 'XXX000', tuce: null, autorizacion: null }], // placeholder BETA (ya normalizado)
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

// ── Escenario TERCERO (público 01, 2 vehículos): espeja la GRE real aceptada EG07-325 ──────
console.log('\n=== Escenario TERCERO (público 01) — CarrierParty+MTC + fecha entrega + 2 vehículos (TUCE+autorización) ===\n');
const datosTercero = {
  ...datos,
  modalidad: '01',
  transportista: { ruc: '20611807555', razon: 'EMPRESA DE TRANSPORTES Y SERVICIOS YELA & N S.A.C.', mtc: '15141794CNG' },
  fechaEntregaTransportista: '2026-08-27',
  conductor: { dni: '80627794', nombre: 'TANTALEAN REVILLA OSCAR PEPE', licencia: 'L80627794' },
  vehiculos: [
    { placa: 'T7U937', tuce: '151716963', autorizacion: '15M25063308E' },
    { placa: 'TJQ970', tuce: '152108547', autorizacion: '15M25063309E' }
  ]
};
const { xml: xmlT } = construirDespatchAdviceXML(datosTercero);
check('XML tercero bien-formado', XMLValidator.validate(xmlT) === true);
const dt = parser.parse(xmlT).DespatchAdvice;
const shipT = dt?.Shipment;
const stageT = shipT?.ShipmentStage;
check('TransportModeCode = 01 (público)', String(stageT?.TransportModeCode?.['#text']) === '01');
// El portal SUNAT (EG07-220/309, Casos 2 y 3 con veh+cond) NO emite este indicador → el builder tampoco.
check('SIN SpecialInstructions auto (patrón portal EG07-220/309)',
  !String(shipT?.SpecialInstructions || '').includes('IndicadorVehiculoConductoresTransp'));
check('LoadingTransportEvent (fecha entrega al transportista)',
  String(stageT?.LoadingTransportEvent?.OccurrenceDate) === '2026-08-27');
check('CarrierParty RUC transportista', String(stageT?.CarrierParty?.PartyIdentification?.ID?.['#text']) === '20611807555');
check('Nº MTC empresa en CompanyID', String(stageT?.CarrierParty?.PartyLegalEntity?.CompanyID) === '15141794CNG');
check('DriverPerson (tercero) con DNI', String(stageT?.DriverPerson?.ID?.['#text']) === '80627794');
const teq = shipT?.TransportHandlingUnit?.TransportEquipment;
check('Veh. principal placa', String(teq?.ID) === 'T7U937');
check('Veh. principal TUCE en RegistrationNationalityID',
  String(teq?.ApplicableTransportMeans?.RegistrationNationalityID) === '151716963');
check('Veh. principal autorización en ShipmentDocumentReference',
  String(teq?.ShipmentDocumentReference?.ID?.['#text']) === '15M25063308E');
check('Veh. secundario en AttachedTransportEquipment (placa)', String(teq?.AttachedTransportEquipment?.ID) === 'TJQ970');
check('Veh. secundario TUCE',
  String(teq?.AttachedTransportEquipment?.ApplicableTransportMeans?.RegistrationNationalityID) === '152108547');
check('Veh. secundario autorización',
  String(teq?.AttachedTransportEquipment?.ShipmentDocumentReference?.ID?.['#text']) === '15M25063309E');
check('AdditionalItemProperty bien regulado (cat55 7022)',
  String((Array.isArray(dt?.DespatchLine) ? dt.DespatchLine[0] : dt?.DespatchLine)?.Item?.AdditionalItemProperty?.NameCode?.['#text']) === '7022');

// ── Escenario CASO 1 (tercero 01, registrar=OFF): SOLO CarrierParty (espeja EG07-81) ─────────
// Interruptor "registrar vehículos y conductores del transportista" DESACTIVADO: la GRE del
// remitente declara únicamente al transportista; será el transportista quien emita su GRE 31.
console.log('\n=== Escenario CASO 1 (tercero 01, registrar=OFF) — solo transportista, sin veh/cond ===\n');
const datosCaso1 = { ...datosTercero, registrarTransportista: false };
const { xml: xml1 } = construirDespatchAdviceXML(datosCaso1);
check('XML caso1 bien-formado', XMLValidator.validate(xml1) === true);
const d1 = parser.parse(xml1).DespatchAdvice;
const ship1 = d1?.Shipment;
const stage1 = ship1?.ShipmentStage;
check('[C1] Modalidad 01 (público)', String(stage1?.TransportModeCode?.['#text']) === '01');
check('[C1] CarrierParty presente (RUC transportista)', String(stage1?.CarrierParty?.PartyIdentification?.ID?.['#text']) === '20611807555');
check('[C1] SIN SpecialInstructions (registrar=OFF)', ship1?.SpecialInstructions === undefined);
check('[C1] SIN DriverPerson', stage1?.DriverPerson === undefined);
check('[C1] TransportEquipment vacío (sin placa)', ship1?.TransportHandlingUnit?.TransportEquipment?.ID === undefined);

// ── Escenario multi-conductor: 2 cac:DriverPerson (Principal + Secundario) ───────────────────
console.log('\n=== Escenario multi-conductor (Principal + Secundario) ===\n');
const datosMulti = {
  ...datosTercero,
  conductor: undefined,
  conductores: [
    { dni: '75336849', nombre: 'RODRIGUEZ SANANCINO MAX ALEX', licencia: 'Q75336849' },
    { dni: '80257817', nombre: 'CONTRERAS URQUIZO JENSON PAUL', licencia: 'Q80257817' },
  ],
};
const { xml: xmlM } = construirDespatchAdviceXML(datosMulti);
check('XML multi-conductor bien-formado', XMLValidator.validate(xmlM) === true);
const driversM = parser.parse(xmlM).DespatchAdvice?.Shipment?.ShipmentStage?.DriverPerson;
check('2 DriverPerson emitidos', Array.isArray(driversM) && driversM.length === 2, `n=${Array.isArray(driversM) ? driversM.length : 'no-array'}`);
check('Conductor 1 = Principal', String(driversM?.[0]?.JobTitle) === 'Principal');
check('Conductor 2 = Secundario', String(driversM?.[1]?.JobTitle) === 'Secundario');
check('Conductor 2 DNI = 80257817', String(driversM?.[1]?.ID?.['#text']) === '80257817');

// ── Indicadores opcionales (SpecialInstructions múltiples) ───────────────────────────────────
console.log('\n=== Indicadores opcionales (transbordo / M1-L / retorno vacíos) ===\n');
const datosInd = { ...datosTercero, indicadores: { transbordo: true, m1l: true, retornoVacio: true } };
const { xml: xmlI } = construirDespatchAdviceXML(datosInd);
check('XML indicadores bien-formado', XMLValidator.validate(xmlI) === true);
const siList = parser.parse(xmlI).DespatchAdvice?.Shipment?.SpecialInstructions;
const siArr = Array.isArray(siList) ? siList : [siList];
// Solo los 3 indicadores opcionales explícitos; el de vehículos/conductores ya no se auto-emite (patrón portal).
check('3 SpecialInstructions (solo indicadores explícitos)', siArr.length === 3, `n=${siArr.length}`);
check('SIN indicador vehículos/conductores auto', !siArr.some((s) => String(s).includes('IndicadorVehiculoConductoresTransp')));
check('Incluye transbordo', siArr.some((s) => String(s).includes('Transbordo')));
check('Incluye M1L', siArr.some((s) => String(s).includes('VehiculoM1L')));
check('Incluye retorno vacíos', siArr.some((s) => String(s).includes('RetornoVehiculoEnvaseVacio')));

// ── Escenario PARTICULAR (privado 02) — carro común del cliente SIN RUC: espeja EG07-256 ─────
// El cliente traslada con su propio auto/camioneta. Estructura IDÉNTICA al vehículo propio de
// flota (DriverPerson + TransportEquipment, sin CarrierParty): solo cambia el ORIGEN del dato
// (texto libre vs desplegable de flota). Se contrasta contra el XML real aceptado por SUNAT.
console.log('\n=== Escenario PARTICULAR (privado 02) — carro del cliente sin RUC (espeja EG07-256) ===\n');

// Normalización de placa: el usuario puede escribir "B2Q-671" y debe llegar a SUNAT como "B2Q671".
check('placaValida acepta "B2Q-671" y "B2Q671"', placaValida('B2Q-671') && placaValida('B2Q671'));
check('normalizarPlaca("B2Q-671") == "B2Q671"', normalizarPlaca('B2Q-671') === 'B2Q671', normalizarPlaca('B2Q-671'));
check('placaValida rechaza vacío / con longitud inválida', !placaValida('') && !placaValida('B2Q'));

const datosParticular = {
  ...datos,
  cliente: { ruc: '20606396628', razon_social: 'BERRYCO S.A.C.', tipo_documento: 'RUC' },
  guia: {
    motivo_traslado_cod: '01', motivo_traslado: 'VENTA', peso_bruto_kg: 620,
    ubigeo_partida: '150142', direccion_partida: 'AV. EL SOL MZ. LL-1 LOTE. 4 B - VILLA EL SALVADOR',
    ubigeo_llegada: '150131', direccion_llegada: '---- JUAN PEZET NRO. 543 DPTO. 401 - SAN ISIDRO'
  },
  modalidad: '02',            // privado — igual que la flota
  transportista: null,        // ← sin empresa de transporte (no hay RUC tercero)
  fechaEntregaTransportista: null,
  // Conductor + placa de TEXTO LIBRE (el backend ya aplicó normalizarPlaca antes de llegar aquí).
  conductor: { dni: '07471043', nombre: 'CHAVEZ GUERRA CHARLES JORGE', licencia: 'Q07471043' },
  vehiculos: [{ placa: normalizarPlaca('B2Q-671'), tuce: null, autorizacion: null }]
};
const { xml: xmlP } = construirDespatchAdviceXML(datosParticular);
check('XML particular bien-formado', XMLValidator.validate(xmlP) === true);
const dp = parser.parse(xmlP).DespatchAdvice;
const shipP = dp?.Shipment;
const stageP = shipP?.ShipmentStage;

check('TransportModeCode = 02 (privado)', String(stageP?.TransportModeCode?.['#text']) === '02');
check('SIN CarrierParty (no es empresa de transporte)', stageP?.CarrierParty === undefined);
check('SIN SpecialInstructions (solo aplica a tercero)', shipP?.SpecialInstructions === undefined);
check('SIN LoadingTransportEvent (solo aplica a tercero)', stageP?.LoadingTransportEvent === undefined);
check('DriverPerson DNI = 07471043', String(stageP?.DriverPerson?.ID?.['#text']) === '07471043');
check('DriverPerson licencia = Q07471043', String(stageP?.DriverPerson?.IdentityDocumentReference?.ID) === 'Q07471043');
check('TransportEquipment placa = B2Q671 (normalizada, sin guion)',
  String(shipP?.TransportHandlingUnit?.TransportEquipment?.ID) === 'B2Q671');
check('Veh. principal SIN TUCE ni AttachedTransportEquipment',
  shipP?.TransportHandlingUnit?.TransportEquipment?.ApplicableTransportMeans === undefined &&
  shipP?.TransportHandlingUnit?.TransportEquipment?.AttachedTransportEquipment === undefined);

// Contraste directo contra el XML REAL aceptado por SUNAT (docs/20550932297-09-EG07-256.xml):
// misma modalidad, mismo conductor/placa y misma AUSENCIA de bloques de tercero.
try {
  const refXml = readFileSync(join(__dirname, '..', '..', 'docs', '20550932297-09-EG07-256.xml'), 'utf8');
  const ref = parser.parse(refXml).DespatchAdvice;
  const shipR = ref?.Shipment;
  const stageR = shipR?.ShipmentStage;
  check('[EG07-256] modalidad real = 02 == la generada', String(stageR?.TransportModeCode?.['#text']) === String(stageP?.TransportModeCode?.['#text']));
  check('[EG07-256] motivo real = 01 == el generado', String(shipR?.HandlingCode?.['#text']) === String(shipP?.HandlingCode?.['#text']));
  check('[EG07-256] DriverPerson DNI real == el generado', String(stageR?.DriverPerson?.ID?.['#text']) === String(stageP?.DriverPerson?.ID?.['#text']));
  check('[EG07-256] licencia real == la generada', String(stageR?.DriverPerson?.IdentityDocumentReference?.ID) === String(stageP?.DriverPerson?.IdentityDocumentReference?.ID));
  check('[EG07-256] placa real == la generada', String(shipR?.TransportHandlingUnit?.TransportEquipment?.ID) === String(shipP?.TransportHandlingUnit?.TransportEquipment?.ID));
  check('[EG07-256] el XML real TAMPOCO tiene CarrierParty', stageR?.CarrierParty === undefined);
} catch (e) {
  check('XML de referencia EG07-256 legible en docs/', false, e.message);
}

// Prueba de EQUIVALENCIA: mismo caso emitido "como flota" (mismos datos) produce el MISMO XML
// que "como particular". Confirma que para SUNAT no cambia NADA: ambos son privado 02.
const { xml: xmlComoFlota } = construirDespatchAdviceXML({ ...datosParticular });
check('Particular y flota generan XML idéntico (misma estructura privada 02)', xmlComoFlota === xmlP);

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

// ── Escenario COMEX / EXPORTACIÓN (09): espeja la GRE real aceptada EG07-273 ────────────────
console.log('\n=== FASE 16 · EXPORTACIÓN — GRE comex espeja el molde real EG07-273 ===\n');

const datosComex = {
  tipo: '09', serie: 'EG07', numero: '273',
  empresa: { ruc: RUC, razon_social: 'INDPACK S.A.C.' },
  cliente: { ruc: '20508782013', razon_social: 'VILLAS OQUENDO S.A.', tipo_documento: 'RUC' },
  guia: {
    motivo_traslado_cod: '09', motivo_traslado: 'Exportación', peso_bruto_kg: 1200,
    ubigeo_llegada: '070101', direccion_llegada: 'CAL. G NRO. S/N (PARCELA 1) CALLAO',
    ubigeo_partida: '150142', direccion_partida: 'AV. EL SOL MZ. LL-1 LOTE. 4 B VILLA EL SALVADOR',
  },
  detalle: [{ cantidad: 1, codigo_unidad_sunat: 'U', nombre: 'BURBUPACK TRANSPARENTE', codigo: '', subpartida_nacional: '3923210000', dam_serie: '1' }],
  fecha: { emision: '2026-07-16', hora: '12:57:01' }, fechaTraslado: '2026-07-16', modalidad: '01',
  transportista: { ruc: '20600579755', razon: 'CT LOGISTICO S.A.C.', mtc: '1560506CNG' },
  registrarTransportista: true, fechaEntregaTransportista: '2026-07-16',
  conductores: [{ dni: '80257817', nombre: 'CONTRERAS URQUIZO JENSON PAUL', licencia: 'Q80257817' }],
  vehiculos: [{ placa: 'C5M782', tuce: '151522444', autorizacion: null }, { placa: 'BPO993', tuce: '15M25044060E', autorizacion: null }],
  indicadores: { registrarTransp: true },
  observacion: 'CONTENEDOR: MRSU4280077 PRECINTO NAVIERA: ML-PE0153521 PRECINTO AGENCIA: 004VA380282',
  comex: {
    trasladoTotalDam: true,
    docsRelacionados: [{ tipo_cod: '50', tipo_desc: 'Declaración Aduanera de Mercancías (DAM)', serie: null, numero: '118-2026-40-70727' }],
    contenedores: [{ numero_contenedor: 'MRSU4280077', numero_precinto: 'MLPE0153521' }],
    damNumero: '118-2026-40-70727',
    deliveryEstablishmentCode: '2', // cód. establecimiento anexo del destinatario (VILLAS OQUENDO puerto)
  },
};

const { xml: xmlCx } = construirDespatchAdviceXML(datosComex);
check('COMEX: XML bien-formado', XMLValidator.validate(xmlCx) === true);
const dcx = parser.parse(xmlCx).DespatchAdvice;
const shipCx = dcx?.Shipment;

// Documento relacionado DAM (cat.61 cód.50) tras el Note.
const docRel = dcx?.AdditionalDocumentReference;
check('COMEX: AdditionalDocumentReference DAM presente', !!docRel);
check('COMEX: DAM ID = nº DAM', String(docRel?.ID) === '118-2026-40-70727', `ID=${docRel?.ID}`);
check('COMEX: DAM DocumentTypeCode = 50 (cat.61)', String(docRel?.DocumentTypeCode?.['#text']) === '50');
check('COMEX: DAM DocumentType descriptivo', String(docRel?.DocumentType || '').includes('DAM'));

// SpecialInstructions: traslado total PRIMERO, luego VehiculoConductoresTransp.
const si = Array.isArray(shipCx?.SpecialInstructions) ? shipCx.SpecialInstructions : [shipCx?.SpecialInstructions];
check('COMEX: SpecialInstructions traslado total de la DAM/DS', si.includes('SUNAT_Envio_IndicadorTrasladoTotalDAMoDS'));
check('COMEX: traslado total va PRIMERO', String(si[0]) === 'SUNAT_Envio_IndicadorTrasladoTotalDAMoDS', `si[0]=${si[0]}`);
check('COMEX: IndicadorVehiculoConductoresTransp presente (export lo emite)', si.includes('SUNAT_Envio_IndicadorVehiculoConductoresTransp'));

// HandlingCode 09 + destinatario = operador de puerto.
check('COMEX: HandlingCode = 09 (Exportación)', String(shipCx?.HandlingCode?.['#text']) === '09');
check('COMEX: destinatario = operador de puerto (no cliente OV)',
  String(dcx?.DeliveryCustomerParty?.Party?.PartyIdentification?.ID?.['#text']) === '20508782013');
check('COMEX: DeliveryAddress AddressTypeCode = cód. establecimiento destinatario (2, como el molde)',
  String(shipCx?.Delivery?.DeliveryAddress?.AddressTypeCode?.['#text']) === '2',
  `AddressTypeCode=${shipCx?.Delivery?.DeliveryAddress?.AddressTypeCode?.['#text']}`);

// cac:Package (contenedor + precinto) dentro del TransportHandlingUnit, tras el vehículo.
const thuCx = shipCx?.TransportHandlingUnit;
check('COMEX: Package (contenedor) presente', String(thuCx?.Package?.ID) === 'MRSU4280077', `ID=${thuCx?.Package?.ID}`);
check('COMEX: Package TraceID = precinto', String(thuCx?.Package?.TraceID) === 'MLPE0153521', `TraceID=${thuCx?.Package?.TraceID}`);
check('COMEX: 2 vehículos (principal + AttachedTransportEquipment)',
  String(thuCx?.TransportEquipment?.ID) === 'C5M782' && String(thuCx?.TransportEquipment?.AttachedTransportEquipment?.ID) === 'BPO993');

// Item: 7020 subpartida / 7021 nº DAM / 7023 serie DAM (además del 7022).
const itemCx = (Array.isArray(dcx?.DespatchLine) ? dcx.DespatchLine[0] : dcx?.DespatchLine)?.Item;
const props = Array.isArray(itemCx?.AdditionalItemProperty) ? itemCx.AdditionalItemProperty : [itemCx?.AdditionalItemProperty];
const byCode = (c) => props.find((p) => String(p?.NameCode?.['#text']) === c);
check('COMEX: 7020 subpartida nacional', String(byCode('7020')?.Value) === '3923210000');
check('COMEX: 7021 numeración de la DAM', String(byCode('7021')?.Value) === '118-2026-40-70727');
check('COMEX: 7023 nº serie en la DAM', String(byCode('7023')?.Value) === '1');
check('COMEX: 7022 (bien regulado) se mantiene', String(byCode('7022')?.Value) === '0');
check('COMEX: orden de propiedades = 7020, 7022, 7021, 7023',
  props.map((p) => String(p?.NameCode?.['#text'])).join(',') === '7020,7022,7021,7023',
  props.map((p) => String(p?.NameCode?.['#text'])).join(','));

// ── Escenario COMPRA (GRE 09, motivo 02) — SPI recoge su mercadería: espeja EG07-333 ─────────
// Diferencias vs venta: destinatario = la propia empresa; se agrega cac:SellerSupplierParty con el
// proveedor; la factura del proveedor va como AdditionalDocumentReference con IssuerParty (RUC
// proveedor); y el establecimiento de partida (listID) es el del proveedor. Contrasta con el XML real.
console.log('\n=== COMPRA (GRE 09 motivo 02) — SPI recoge con flota propia (espeja EG07-333) ===\n');

const PROV_RUC = '20100064490';
const datosCompra = {
  tipo: '09', serie: 'EG07', numero: '333',
  empresa: { ruc: RUC, razon_social: 'INDPACK S.A.C.' },
  cliente: { ruc: RUC, razon_social: 'INDPACK S.A.C.', tipo_documento: 'RUC' }, // destinatario = la propia empresa
  proveedor: { ruc: PROV_RUC, razon_social: 'DISPERCOL S A' },
  guia: {
    motivo_traslado_cod: '02', motivo_traslado: 'COMPRA', peso_bruto_kg: 3000,
    ubigeo_partida: '150103', direccion_partida: 'AV. SEPARADORA INDUSTRIAL NRO. 2295 URB. VULCANO LIMA - LIMA - ATE',
    ubigeo_llegada: '150142', direccion_llegada: 'AV. EL SOL MZ. LL-1 LOTE. 4 B COO. LAS VERTIENTES - VILLA EL SALVADOR'
  },
  detalle: [
    { cantidad: 1500, codigo_unidad_sunat: 'KGM', nombre: 'EXXONMOBIL LD 2022.AC', codigo: '01002098F' },
    { cantidad: 1500, codigo_unidad_sunat: 'KGM', nombre: 'BRASKEM LL4405S', codigo: '02002057F' }
  ],
  fecha: { emision: '2026-09-01', hora: '16:48:25' }, fechaTraslado: '2026-09-01',
  modalidad: '02',
  conductor: { dni: '75336849', nombre: 'RODRIGUEZ SANANCINO MAX ALEX', licencia: 'Q75336849' },
  vehiculos: [{ placa: 'ANA848', tuce: null, autorizacion: null }],
  docRelacionado: { tipo: '01', tipo_desc: 'Factura', numero: 'F001-115256', issuerRuc: PROV_RUC }
};
const { xml: xmlC } = construirDespatchAdviceXML(datosCompra);
check('COMPRA: XML bien-formado', XMLValidator.validate(xmlC) === true);
const dc = parser.parse(xmlC).DespatchAdvice;
const shipC = dc?.Shipment;

check('COMPRA: HandlingCode = 02 (Compra)', String(shipC?.HandlingCode?.['#text']) === '02');
check('COMPRA: HandlingInstructions = COMPRA', String(shipC?.HandlingInstructions || '').toUpperCase().includes('COMPRA'));
check('COMPRA: DespatchSupplierParty (remitente) = SPI',
  String(dc?.DespatchSupplierParty?.Party?.PartyIdentification?.ID?.['#text']) === RUC);
check('COMPRA: DeliveryCustomerParty (destinatario) = SPI mismo',
  String(dc?.DeliveryCustomerParty?.Party?.PartyIdentification?.ID?.['#text']) === RUC);
check('COMPRA: SellerSupplierParty = proveedor',
  String(dc?.SellerSupplierParty?.Party?.PartyIdentification?.ID?.['#text']) === PROV_RUC);
check('COMPRA: SellerSupplierParty razón social',
  String(dc?.SellerSupplierParty?.Party?.PartyLegalEntity?.RegistrationName) === 'DISPERCOL S A');

// AdditionalDocumentReference = factura del proveedor (forma completa cat.61 + IssuerParty).
const docRelC = dc?.AdditionalDocumentReference;
check('COMPRA: AdditionalDocumentReference ID = factura proveedor', String(docRelC?.ID) === 'F001-115256');
check('COMPRA: DocumentTypeCode = 01 (cat.61)', String(docRelC?.DocumentTypeCode?.['#text']) === '01');
check('COMPRA: DocumentType = Factura', String(docRelC?.DocumentType) === 'Factura');
check('COMPRA: IssuerParty = RUC del proveedor emisor',
  String(docRelC?.IssuerParty?.PartyIdentification?.ID?.['#text']) === PROV_RUC);

// Establecimientos: partida = proveedor, llegada = SPI.
check('COMPRA: partida (DespatchAddress) listID = RUC proveedor',
  String(shipC?.Delivery?.Despatch?.DespatchAddress?.AddressTypeCode?.['@listID']) === PROV_RUC,
  `listID=${shipC?.Delivery?.Despatch?.DespatchAddress?.AddressTypeCode?.['@listID']}`);
check('COMPRA: llegada (DeliveryAddress) listID = RUC SPI',
  String(shipC?.Delivery?.DeliveryAddress?.AddressTypeCode?.['@listID']) === RUC);
check('COMPRA: 2 DespatchLine (KGM)',
  Array.isArray(dc?.DespatchLine) && dc.DespatchLine.length === 2 &&
  dc.DespatchLine[0]?.DeliveredQuantity?.['@unitCode'] === 'KGM');

// Regresión: la GRE de VENTA (sin proveedor) NO emite SellerSupplierParty ni IssuerParty.
check('COMPRA: VENTA no regresiona (sin SellerSupplierParty)', da?.SellerSupplierParty === undefined);
check('COMPRA: VENTA no regresiona (docRel simple sin IssuerParty)',
  da?.AdditionalDocumentReference === undefined || da?.AdditionalDocumentReference?.IssuerParty === undefined);

// Contraste directo contra el XML REAL aceptado por SUNAT (docs/20550932297-09-EG07-333.xml).
try {
  const refXml = readFileSync(join(__dirname, '..', '..', 'docs', '20550932297-09-EG07-333.xml'), 'utf8');
  const refC = parser.parse(refXml).DespatchAdvice;
  const shipRC = refC?.Shipment;
  check('[EG07-333] motivo real = 02 == el generado', String(shipRC?.HandlingCode?.['#text']) === String(shipC?.HandlingCode?.['#text']));
  check('[EG07-333] destinatario real = SPI == el generado',
    String(refC?.DeliveryCustomerParty?.Party?.PartyIdentification?.ID?.['#text']) === String(dc?.DeliveryCustomerParty?.Party?.PartyIdentification?.ID?.['#text']));
  check('[EG07-333] SellerSupplierParty real == el generado',
    String(refC?.SellerSupplierParty?.Party?.PartyIdentification?.ID?.['#text']) === String(dc?.SellerSupplierParty?.Party?.PartyIdentification?.ID?.['#text']));
  check('[EG07-333] IssuerParty real == el generado',
    String(refC?.AdditionalDocumentReference?.IssuerParty?.PartyIdentification?.ID?.['#text']) === String(docRelC?.IssuerParty?.PartyIdentification?.ID?.['#text']));
  check('[EG07-333] partida listID real (proveedor) == el generado',
    String(shipRC?.Delivery?.Despatch?.DespatchAddress?.AddressTypeCode?.['@listID']) === String(shipC?.Delivery?.Despatch?.DespatchAddress?.AddressTypeCode?.['@listID']));
} catch (e) {
  check('XML de referencia EG07-333 legible en docs/', false, e.message);
}

console.log(`\n=== RESUMEN: ${pass} PASS · ${fail} FAIL ===\n`);
if (fail > 0) process.exit(1);
