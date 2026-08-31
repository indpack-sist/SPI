// scripts/test-pdf-sunat.js  —  Smoke test OFFLINE de la Fase 13 (representación impresa).
// Renderiza factura (01), nota de crédito (07) y GRE (09) a PDF real y valida el buffer.
// No toca BD: prueba los generadores + el QR PNG. Escribe a sunat-output/ (gitignored).
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';
import { qrPng } from '../services/sunat/qr.service.js';
import { generarComprobanteSunatPDF } from '../utils/pdfGenerators/comprobanteSunatPDF.js';
import { generarGuiaRemisionSunatPDF } from '../utils/pdfGenerators/guiaRemisionSunatPDF.js';

// Extrae el texto de un PDF (para asertar rótulos impresos).
const textoDe = async (buf) => (await new PDFParse({ data: buf }).getText()).text;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../sunat-output');

const emisor = {
  razon_social: 'INDPACK S.A.C.', ruc: '20550932297',
  direccion: 'AV. EL SOL LT. 4 B MZ. LL-1', urbanizacion: 'COO. LAS VERTIENTES',
  telefono: '01-312 7858', email: 'informes@indpackperu.com'
};
const cliente = { razon_social: 'OCULAB S.A.C.', ruc: '20562860984', tipo_documento: 'RUC', direccion: 'AV. ARGENTINA 1234 - CERCADO DE LIMA - LIMA - LIMA' };
const detalle = [
  { codigo: 'PROD-001', nombre: 'CAJA DE CARTON 30x30x30 CORRUGADO', cantidad: 100, precio_unitario: 1.40, unidad: 'NIU', descuento_porcentaje: 0 },
  { codigo: 'PROD-002', nombre: 'CINTA DE EMBALAJE TRANSPARENTE 48mm', cantidad: 20, precio_unitario: 3.50, unidad: 'NIU', descuento_porcentaje: 10 }
];

// ── Origen del hash (valor resumen) ──────────────────────────────────────────
// El hash REAL de una factura vive en facturas_venta.sunat_digest_value (lo escribe firmarXml
// en la emisión). Este script es OFFLINE y no tiene cert ni BD, así que NO puede firmar ni leer
// el valor aceptado en Beta. Prioridad:
//   1) REAL_DIGEST=<valor>  → usa el digest real que pegues (p.ej. el de FE01-1 aceptada).
//   2) sin él → SHA-512 base64 de contenido local, ETIQUETADO como SIMULADO (no de factura aceptada).
// Nunca se usa un placeholder decodificable a texto.
const DIGEST_REAL = process.env.REAL_DIGEST || null;
const digestSimulado = (semilla) => crypto.createHash('sha512').update(String(semilla)).digest('base64');
const digestPara = (semilla) => DIGEST_REAL || digestSimulado(semilla);

let pass = 0, fail = 0;
const check = (n, cond, extra = '') => { const ok = !!cond; ok ? pass++ : fail++; console.log(`  ${ok ? '✅' : '❌'} ${n}${extra ? '  —  ' + extra : ''}`); };
const esPdf = (buf) => Buffer.isBuffer(buf) && buf.slice(0, 5).toString() === '%PDF-';

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  console.log('\n=== FASE 13 — Smoke test de representación impresa (offline) ===\n');
  console.log(DIGEST_REAL
    ? `  Hash impreso: REAL (provisto por REAL_DIGEST, ${DIGEST_REAL.length} chars)\n`
    : '  ⚠️  Hash impreso: SIMULADO (SHA-512 local) — NO es de una factura aceptada.\n' +
      '     Para el hash real: REAL_DIGEST=<sunat_digest_value> npm run test:pdf\n');

  // 1) Factura 01 ACEPTADA
  const qrFactura = await qrPng('20550932297|01|FE01|1|25.20|165.20|2026-08-24|6|20562860984|');
  const pdfFactura = await generarComprobanteSunatPDF({
    comprobante: {
      codigo_tipo_sunat: '01', serie: 'FE01', numero: 1, fecha_emision: '24/08/2026',
      moneda: 'PEN', subtotal: 203.00, igv: 36.54, total: 239.54,
      tipo_venta: 'Credito', dias_credito: 30, fecha_vencimiento: '23/09/2026',
      observaciones: 'GUIA DE REMISION REMITENTE: TE01-45. Entregar en almacén central.',
      orden_compra: '260810058',
      direccion_entrega: 'AV. INDUSTRIAL 500 - LURÍN - LIMA - LIMA',
      sunat_digest_value: digestPara('FE01-1'), sunat_estado: 'ACEPTADO', docAfectado: null
    }, emisor, cliente, detalle, qrBuffer: qrFactura
  });
  check('Factura (01) genera PDF válido', esPdf(pdfFactura), `${pdfFactura.length} bytes`);
  await fs.writeFile(path.join(outDir, 'test-FE01-1.pdf'), pdfFactura);

  // 2) Nota de Crédito 07 con documento afectado + motivo
  const qrNota = await qrPng('20550932297|07|FC01|1|9.00|59.00|2026-08-24|6|20562860984|');
  const pdfNota = await generarComprobanteSunatPDF({
    comprobante: {
      codigo_tipo_sunat: '07', serie: 'FC01', numero: 1, fecha_emision: '24/08/2026',
      moneda: 'PEN', subtotal: 50.00, igv: 9.00, total: 59.00,
      sunat_digest_value: digestPara('FC01-1'), sunat_estado: 'ACEPTADO',
      docAfectado: { comprobante: 'FE01-2', motivo: '07 - DEVOLUCION POR ITEM' }
    }, emisor, cliente, detalle, qrBuffer: qrNota
  });
  check('Nota de Crédito (07) genera PDF válido', esPdf(pdfNota), `${pdfNota.length} bytes`);
  const txtNota = await textoDe(pdfNota);
  check('NC usa cabecera SUNAT (Señor(es), Documento que modifica, Tipo de Moneda)',
    txtNota.includes('Señor(es)') && txtNota.includes('Documento que modifica') && txtNota.includes('Tipo de Moneda'));
  check('NC muestra el motivo en "Observación" (sin código, en mayúsculas)',
    txtNota.includes('Observación') && txtNota.includes('DEVOLUCION POR ITEM'));
  await fs.writeFile(path.join(outDir, 'test-FC01-1.pdf'), pdfNota);

  // 3) Factura BAJA → marca de agua ANULADO
  const pdfBaja = await generarComprobanteSunatPDF({
    comprobante: {
      codigo_tipo_sunat: '01', serie: 'FE01', numero: 3, fecha_emision: '24/08/2026',
      moneda: 'PEN', subtotal: 100, igv: 18, total: 118,
      sunat_digest_value: digestPara('FE01-3'), sunat_estado: 'BAJA', docAfectado: null
    }, emisor, cliente, detalle, qrBuffer: qrFactura
  });
  check('Factura BAJA genera PDF válido (marca ANULADO)', esPdf(pdfBaja), `${pdfBaja.length} bytes`);
  await fs.writeFile(path.join(outDir, 'test-FE01-3-anulado.pdf'), pdfBaja);

  // 4) GRE 09 con QR-URL de SUNAT
  const qrGre = await qrPng('https://ww1.sunat.gob.pe/ol-ti-itconsultaunificadalibre/consultaUnificadaLibre/consulta?...');
  const pdfGre = await generarGuiaRemisionSunatPDF({
    guia: {
      serie_sunat: 'TE01', numero_sunat: 1, fecha_emision: '24/08/2026', fecha_traslado: '24/08/2026',
      motivo_traslado_cod: '01', peso_bruto_kg: 100.50,
      ubigeo_partida: '150142', direccion_partida: 'COO. LAS VERTIENTES - VILLA EL SALVADOR',
      ubigeo_llegada: '150101', direccion_llegada: 'AV. ARGENTINA 1234 - LIMA',
      sunat_estado: 'ACEPTADO', sunat_digest_value: digestPara('TE01-1'), placa: 'ABC123',
      observaciones: 'Entrega en almacen central | OC: 260610043'
    },
    emisor, cliente,
    detalle: [{ codigo: 'PROD-001', nombre: 'CAJA DE CARTON 30x30x30', cantidad: 100, codigo_unidad_sunat: 'NIU' }],
    conductor: { nombre_completo: 'MAX ALEX SANANCINO', dni: '75336849', licencia_conducir: 'Q75336849' },
    qrBuffer: qrGre
  });
  check('GRE (09) genera PDF válido (QR = URL SUNAT)', esPdf(pdfGre), `${pdfGre.length} bytes`);
  const txtGre = await textoDe(pdfGre);
  check('GRE (09) imprime Observaciones (texto libre + OC)',
    txtGre.includes('Observaciones') && txtGre.includes('OC: 260610043'));
  await fs.writeFile(path.join(outDir, 'test-TE01-1.pdf'), pdfGre);

  // 4b) GRE Caso 1 (tercero público SIN registrar veh/cond) — solo transportista (espeja EG07-81).
  const pdfGreC1 = await generarGuiaRemisionSunatPDF({
    guia: {
      serie_sunat: 'TE01', numero_sunat: 81, fecha_emision: '16/02/2026', fecha_traslado: '17/02/2026',
      motivo_traslado_cod: '01', peso_bruto_kg: 100, ubigeo_partida: '150142', direccion_partida: 'COO. LAS VERTIENTES - VES',
      ubigeo_llegada: '110205', direccion_llegada: 'CAMINO A VINA VIEJA - EL CARMEN', sunat_estado: 'ACEPTADO',
      observaciones: 'OC: 0004-624'
    },
    emisor, cliente,
    detalle: [{ codigo: 'LBT60G019', nombre: 'LAMINA BURBUPACK 0.55 x 0.73 MTS', cantidad: 10, codigo_unidad_sunat: 'MIL' }],
    transportista: { razon: 'TRANSPORTES MORON EXPRESS S.R.L.', ruc: '20610431420', mtc: '15139386CNG' },
    registrar: false, modalidad: '01', qrBuffer: qrGre
  });
  check('GRE Caso 1 (solo transportista) genera PDF válido', esPdf(pdfGreC1), `${pdfGreC1.length} bytes`);
  const txtC1 = await textoDe(pdfGreC1);
  check('C1 imprime modalidad PÚBLICO + transportista + RUC + MTC',
    txtC1.includes('PÚBLICO') && txtC1.includes('TRANSPORTES MORON') && txtC1.includes('20610431420') && txtC1.includes('15139386CNG'));
  check('C1 muestra el indicador "registrar" y NO imprime conductores',
    txtC1.includes('registrar veh') && !txtC1.includes('Conductor principal'));
  await fs.writeFile(path.join(outDir, 'test-TE01-C1.pdf'), pdfGreC1);

  // 4c) GRE Caso 3 (tercero CON registrar) — 2 vehículos con permisos + 2 conductores (espeja EG07-325).
  const pdfGreC3 = await generarGuiaRemisionSunatPDF({
    guia: {
      serie_sunat: 'TE01', numero_sunat: 325, fecha_emision: '27/08/2026', fecha_traslado: '27/08/2026',
      motivo_traslado_cod: '01', peso_bruto_kg: 104, ubigeo_partida: '150142', direccion_partida: 'COO. LAS VERTIENTES - VES',
      ubigeo_llegada: '200104', direccion_llegada: 'CAR. MEDIO PIURA KM. 11.5 - CASTILLA', sunat_estado: 'ACEPTADO',
      observaciones: 'OC - 4600144796'
    },
    emisor, cliente,
    detalle: [{ codigo: 'LBT60G002', nombre: 'LAMINA BURBUPACK 0.36 x 0.56 MTS', cantidad: 107, codigo_unidad_sunat: 'NIU' }],
    transportista: { razon: 'EMPRESA DE TRANSPORTES Y SERVICIOS YELA & N S.A.C.', ruc: '20611807555', mtc: '15141794CNG' },
    registrar: true, modalidad: '01', fechaEntrega: '27/08/2026',
    vehiculos: [
      { placa: 'T7U937', tuce: '151716963', autorizacion: '15M25063308E' },
      { placa: 'TJQ970', tuce: '152108547', autorizacion: '15M25063309E' }
    ],
    conductores: [
      { nombre: 'TANTALEAN REVILLA OSCAR PEPE', dni: '80627794', licencia: 'L80627794' },
      { nombre: 'CONTRERAS URQUIZO JENSON PAUL', dni: '80257817', licencia: 'Q80257817' }
    ],
    qrBuffer: qrGre
  });
  check('GRE Caso 3 (permisos, 2 veh/2 cond) genera PDF válido', esPdf(pdfGreC3), `${pdfGreC3.length} bytes`);
  const txtC3 = await textoDe(pdfGreC3);
  check('C3 imprime 2 vehículos con TUCE + autorización especial',
    txtC3.includes('T7U937') && txtC3.includes('TJQ970') && txtC3.includes('151716963') && txtC3.includes('15M25063308E') && txtC3.includes('15M25063309E'));
  check('C3 imprime 2 conductores (principal + secundario)',
    txtC3.includes('Conductor principal') && txtC3.includes('Conductor secundario') && txtC3.includes('80627794') && txtC3.includes('80257817'));
  check('C3 imprime fecha de entrega al transportista',
    txtC3.includes('Fecha entrega al transportista') && txtC3.includes('27/08/2026'));
  await fs.writeFile(path.join(outDir, 'test-TE01-C3.pdf'), pdfGreC3);

  // 5) Rótulo de operación por afectación (catálogo 07) — impreso en la línea "Tipo de operación".
  //    Gravada: el IGV del bloque de totales es != 0 (180.00); exonerada/inafecta/exportación: IGV 0.
  //    El bloque de totales usa el formato SUNAT (Sub Total Ventas / Valor Venta / Importe Total).
  const detalleAfect = [{ codigo: 'P1', nombre: 'PRODUCTO', cantidad: 10, precio_unitario: 100, unidad: 'NIU', descuento_porcentaje: 0 }];
  const casosAfect = [
    { afect: '10', label: 'OP. GRAVADA',      igv: 180, gravado: true  },
    { afect: '20', label: 'OP. EXONERADA',    igv: 0,   gravado: false },
    { afect: '30', label: 'OP. INAFECTA',     igv: 0,   gravado: false },
    { afect: '40', label: 'OP. EXPORTACIÓN',  igv: 0,   gravado: false }
  ];
  for (const ca of casosAfect) {
    const pdf = await generarComprobanteSunatPDF({
      comprobante: {
        codigo_tipo_sunat: '01', serie: 'FE01', numero: 5, fecha_emision: '26/08/2026',
        moneda: 'PEN', subtotal: 1000, igv: ca.igv, total: 1000 + ca.igv, afectacion: ca.afect,
        sunat_digest_value: digestPara(`AF-${ca.afect}`), sunat_estado: 'ACEPTADO', docAfectado: null
      }, emisor, cliente, detalle: detalleAfect, qrBuffer: null
    });
    const txt = await textoDe(pdf);
    const rotulaOk = txt.includes(`Tipo de operación: ${ca.label}`);
    const bloqueOk = txt.includes('Sub Total Ventas') && txt.includes('Importe Total');
    const igvOk = ca.gravado ? txt.includes('180.00') : !txt.includes('180.00');
    check(`Afectación ${ca.afect} rotula "${ca.label}", usa bloque SUNAT y ${ca.gravado ? 'muestra IGV' : 'IGV 0'}`, rotulaOk && bloqueOk && igvOk);
  }

  console.log(`\n  PDFs escritos en: ${outDir}`);
  console.log(`\n=== RESUMEN: ${pass} PASS · ${fail} FAIL ===\n`);
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
