import { pool } from '../config/database.js';
import { obtenerPropuestaVentas } from '../services/sunat/sire-ventas.service.js';
import {
  normalizarVentas, conciliarVentas, filtrarVentasPorClaves, claveVenta
} from '../services/sunat/sire-ventas.parser.js';
import { generarVentasSireXLSX } from '../utils/excelGenerators/ventasSireXLSX.js';
import { CONDICION_ACEPTADO, construirMontos, estadoFinalComprobante } from './trazabilidad-see.controller.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const rangoPeriodo = (periodo) => {
  const anio = Number(periodo.slice(0, 4));
  const mes = Number(periodo.slice(4, 6));
  const ultimo = String(new Date(anio, mes, 0).getDate()).padStart(2, '0');
  const mm = String(mes).padStart(2, '0');
  return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${ultimo}` };
};

function identificarDoc(d) {
  const m = /^([A-Z0-9]{4})-0*(\d+)$/i.exec(String(d.numero_factura || '').trim());
  const serie = d.serie || m?.[1] || '';
  const numero = d.numero ?? m?.[2] ?? '';
  return { serie, numero, documento: serie ? `${serie}-${numero}` : d.numero_factura };
}

async function documentosSistema(periodo, ventas) {
  const { desde, hasta } = rangoPeriodo(periodo);
  const documentos = ventas.map((f) => f.documento);
  const [rows] = await pool.query(`
    SELECT fv.id_factura, fv.codigo_tipo_sunat, fv.serie, fv.numero, fv.numero_factura,
           fv.moneda, fv.total, fv.subtotal, fv.igv, fv.estado, fv.sunat_estado,
           ov.facturado_sunat, cl.razon_social AS cliente,
           DATE_FORMAT(fv.fecha_emision, '%Y-%m-%d') AS fecha,
           DATE_FORMAT(COALESCE(ref.fecha_emision, fv.fecha_emision), '%Y-%m-%d') AS fecha_tc,
           ${CONDICION_ACEPTADO} AS cuenta
    FROM facturas_venta fv
    LEFT JOIN ordenes_venta ov  ON ov.id_orden_venta = fv.id_orden_venta
    LEFT JOIN clientes cl        ON cl.id_cliente = ov.id_cliente
    LEFT JOIN facturas_venta ref ON ref.id_factura = fv.id_factura_ref
    WHERE fv.estado <> 'Eliminada'
      AND (DATE(fv.fecha_emision) BETWEEN ? AND ? OR fv.numero_factura IN (?))`,
    [desde, hasta, documentos.length ? documentos : ['']]);

  return rows.map((d) => {
    const { serie, numero, documento } = identificarDoc(d);
    return {
      ...d,
      serie,
      numero,
      documento,
      clave: claveVenta(d.codigo_tipo_sunat || '01', serie, numero),
      moneda: (d.moneda || 'PEN').toUpperCase(),
      total: Number(d.total) || 0,
      cuenta: Number(d.cuenta) === 1,
      en_periodo: d.fecha >= desde && d.fecha <= hasta,
      estado: estadoFinalComprobante(d)
    };
  });
}

const sumar = (filas, campo) => r2(filas.reduce((s, f) => s + (Number(f[campo]) || 0), 0));

export const consultar = async (req, res) => {
  try {
    const { periodo, refrescar } = req.query;
    const propuesta = await obtenerPropuestaVentas(periodo, { refrescar: String(refrescar) === '1' });
    const ventas = normalizarVentas(propuesta);
    const docs = await documentosSistema(periodo, ventas);
    const { filas, solo_sunat, solo_spi, diferencias } = conciliarVentas(ventas, docs);
    const { pen } = await construirMontos(docs.filter((d) => d.cuenta && d.en_periodo));
    const sunat = { neto: sumar(filas, 'total'), cantidad: filas.length };

    res.json({
      success: true,
      periodo,
      consultado_en: propuesta.consultado_en,
      data: filas,
      conciliacion: {
        sistema: { neto: pen.neto, cantidad: pen.cantidad, sin_tc: pen.sin_tc },
        sunat,
        diferencia: r2(pen.neto - sunat.neto),
        solo_sunat,
        diferencias,
        solo_spi: solo_spi.map((d) => ({
          id_factura: d.id_factura, documento: d.documento, cliente: d.cliente, moneda: d.moneda, total: d.total
        }))
      }
    });
  } catch (e) {
    console.error('Error consultando propuesta SIRE de ventas:', e.message);
    res.status(e.statusCode || 500).json({ success: false, error: e.message });
  }
};

export const exportarExcel = async (req, res) => {
  try {
    const { periodo, claves } = req.body || {};
    const propuesta = await obtenerPropuestaVentas(periodo);
    const buffer = await generarVentasSireXLSX(propuesta.cabeceras, filtrarVentasPorClaves(propuesta, claves));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ventas-sire-${periodo}.xlsx"`);
    res.send(buffer);
  } catch (e) {
    res.status(e.statusCode || 500).json({ success: false, error: e.message });
  }
};
