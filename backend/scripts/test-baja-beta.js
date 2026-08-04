/**
 * Prueba de Comunicación de Baja contra SUNAT Beta:
 *   1) emite una factura de prueba
 *   2) la da de baja (anula) y consulta el ticket
 * No toca la BD (emisor de pruebas + correlativo override).
 */
import { construirFacturaXml } from '../services/sunat/ubl/factura.builder.js';
import { firmarXml } from '../services/sunat/firma.service.js';
import { enviarFactura } from '../services/sunat/cpe.client.js';
import { anularFactura } from '../services/sunat/anulacion.service.js';
import { EMISOR_BETA } from '../services/sunat/emisor.service.js';

const correlativoFactura = Math.floor(Date.now() / 1000) % 100000;

async function main() {
  // 1) Emitir factura
  const datos = {
    serie: 'F001',
    correlativo: correlativoFactura,
    fechaEmision: new Date(),
    tipoOperacion: '0101',
    moneda: 'PEN',
    formaPago: 'Contado',
    emisor: EMISOR_BETA,
    cliente: { tipoDoc: '6', numDoc: '20123456789', razonSocial: 'CLIENTE DE PRUEBA SAC', direccion: 'AV. CLIENTE 456' },
    lineas: [{ cantidad: 1, unidad: 'NIU', descripcion: 'PRODUCTO A', codigoProducto: 'P001', valorUnitario: 100 }],
  };
  const { xml, nombreArchivo } = construirFacturaXml(datos);
  const { xmlFirmado } = firmarXml(xml);
  console.log(`Emitiendo F001-${correlativoFactura}...`);
  const cdr = await enviarFactura(nombreArchivo, xmlFirmado);
  console.log('  Emisión:', cdr.estado, cdr.responseCode, '-', cdr.description);
  if (cdr.estado !== 'ACEPTADO') return console.log('No se puede anular: la factura no fue aceptada.');

  // 2) Anular (Comunicación de Baja)
  console.log(`\nAnulando F001-${correlativoFactura}...`);
  const baja = await anularFactura(
    { serie: 'F001', numero: correlativoFactura, fechaEmision: new Date(), motivo: 'ERROR EN LOS DATOS DEL COMPROBANTE' },
    { correlativoOverride: 1, maxIntentos: 15, delayMs: 3000 }
  );

  console.log('\n========== BAJA ==========');
  console.log('idBaja       :', baja.idBaja);
  console.log('Ticket       :', baja.ticket);
  console.log('statusCode   :', baja.statusCode);
  console.log('Estado       :', baja.estado);
  console.log('ResponseCode :', baja.responseCode);
  console.log('Descripción  :', baja.description);
  if (baja.observaciones?.length) console.log('Observaciones:', baja.observaciones);
}

main().catch((e) => {
  console.error('\n❌ ERROR:', e.message);
  process.exit(1);
});
