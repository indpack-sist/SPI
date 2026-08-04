/**
 * Servicio de emisión: toma un despacho (salida) real de la BD, arma la factura,
 * la firma y la envía a SUNAT. En Beta el emisor es el de pruebas; el receptor y
 * las líneas son datos REALES de la BD.
 *
 * Modelo: factura se emite por despacho parcial (salida). Líneas = detalle_salidas
 * (cantidad despachada) + precio desde detalle_orden_venta (match por id_producto;
 * producto único por orden, precio inmutable).
 */
import { pool } from '../../config/database.js';
import { construirFacturaXml } from './ubl/factura.builder.js';
import { firmarXml } from './firma.service.js';
import { enviarFactura } from './cpe.client.js';
import { siguienteCorrelativo } from './correlativo.service.js';
import { getEmisor } from './emisor.service.js';

const SERIE_FACTURA = 'F002'; // serie dedicada del sistema (manual = E001, aparte)

const TIPO_DOC_SUNAT = { RUC: '6', DNI: '1' };

/** Lee de la BD y arma el objeto `datos` que consume el builder. */
export async function construirDatosDesdeSalida(idSalida) {
  const [[salida]] = await pool.query(
    `SELECT s.id_salida, s.id_orden_venta, s.moneda,
            ov.tipo_venta, ov.dias_credito, ov.fecha_vencimiento, ov.id_cliente,
            ov.es_exportacion
     FROM salidas s
     JOIN ordenes_venta ov ON ov.id_orden_venta = s.id_orden_venta
     WHERE s.id_salida = ?`,
    [idSalida]
  );
  if (!salida) throw new Error(`No existe la salida ${idSalida} o no está ligada a una orden de venta`);

  const [[cliente]] = await pool.query(
    'SELECT ruc, tipo_documento, razon_social, direccion_despacho FROM clientes WHERE id_cliente = ?',
    [salida.id_cliente]
  );
  if (!cliente) throw new Error('Cliente no encontrado');

  const [lineasRaw] = await pool.query(
    `SELECT ds.id_producto, ds.cantidad,
            dov.precio_unitario, dov.descuento_porcentaje,
            p.nombre, p.codigo, p.codigo_unidad_sunat
     FROM detalle_salidas ds
     JOIN productos p ON p.id_producto = ds.id_producto
     JOIN detalle_orden_venta dov
          ON dov.id_orden_venta = ? AND dov.id_producto = ds.id_producto
     WHERE ds.id_salida = ?`,
    [salida.id_orden_venta, idSalida]
  );
  if (lineasRaw.length === 0) throw new Error('La salida no tiene líneas facturables');

  const lineas = lineasRaw.map((r) => {
    const desc = Number(r.descuento_porcentaje || 0);
    const valorUnitario = Number(r.precio_unitario) * (1 - desc / 100); // sin IGV, con descuento aplicado
    return {
      cantidad: Number(r.cantidad),
      unidad: r.codigo_unidad_sunat || 'NIU',
      descripcion: r.nombre,
      codigoProducto: r.codigo,
      valorUnitario,
    };
  });

  const esExportacion = salida.es_exportacion === 1;
  // En exportación el receptor es no domiciliado: tipo de documento 0 (no RUC).
  const tipoDoc = esExportacion ? '0' : (TIPO_DOC_SUNAT[cliente.tipo_documento] || '6');

  return {
    _salida: salida,
    serie: SERIE_FACTURA,
    tipoOperacion: esExportacion ? '0200' : '0101', // 0200 = exportación (IGV 0%)
    moneda: salida.moneda === 'USD' ? 'USD' : 'PEN',
    formaPago: salida.tipo_venta === 'Crédito' ? 'Credito' : 'Contado',
    cuotas:
      salida.tipo_venta === 'Crédito' && salida.fecha_vencimiento
        ? [{ monto: null, fechaVencimiento: salida.fecha_vencimiento }] // monto se completa abajo
        : undefined,
    cliente: {
      tipoDoc,
      numDoc: cliente.ruc,
      razonSocial: cliente.razon_social,
      direccion: cliente.direccion_despacho,
    },
    lineas,
  };
}

/**
 * Emite la factura de un despacho a SUNAT.
 * @param {number} idSalida
 * @param {object} opts { correlativoOverride?: number, persist?: boolean }
 */
export async function emitirDesdeSalida(idSalida, opts = {}) {
  const emisor = await getEmisor();
  const datos = await construirDatosDesdeSalida(idSalida);

  // correlativo: real (consume la serie) o override para pruebas sin gastar número
  const correlativo =
    opts.correlativoOverride ?? (await siguienteCorrelativo('01', datos.serie));

  const datosFactura = {
    ...datos,
    correlativo,
    fechaEmision: new Date(),
    emisor,
  };

  // completar monto de cuota única si es crédito
  const construido = construirFacturaXml(datosFactura);
  if (datosFactura.cuotas?.length === 1 && datosFactura.cuotas[0].monto == null) {
    datosFactura.cuotas[0].monto = construido.totales.total;
  }
  const { xml, nombreArchivo, totales } =
    datosFactura.cuotas ? construirFacturaXml(datosFactura) : construido;

  const { xmlFirmado, digestValue } = firmarXml(xml);
  const cdr = await enviarFactura(nombreArchivo, xmlFirmado);

  return { nombreArchivo, totales, digestValue, xmlFirmado, cdr, correlativo, serie: datos.serie };
}
