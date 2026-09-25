// controllers/trazabilidad-see.controller.js
// Trazabilidad del SEE (Sistema de Emisión Electrónica): listados totalmente detallados de
// comprobantes (facturas + notas de crédito/débito) y de guías de remisión, con todos sus
// estados (emitido/aceptado/rechazado/anulado/baja) para auditoría de Administración.
// Solo lectura. Protegido por permiso 'facturacion' (Administrador / Administrativo).
import { pool } from '../config/database.js';
import { extraerUrl } from '../services/sunat/util.service.js';

// Una factura queda ANULADA cuando existe una Nota de Crédito 07 con motivo 01 (anulación de la
// operación) ya ACEPTADA por SUNAT que la referencia. Mismo criterio que el Monitor SUNAT.
const NC_ANULACION = `EXISTS (
  SELECT 1 FROM facturas_venta nc
   WHERE nc.id_factura_ref = fv.id_factura
     AND nc.codigo_tipo_sunat = '07'
     AND nc.motivo_nota_codigo = '01'
     AND nc.sunat_estado = 'ACEPTADO'
)`;

// Estado "de negocio" de un comprobante: prioriza la anulación, luego el estado real ante SUNAT y,
// por último, reconoce las facturas manuales históricas (sin fila SUNAT) marcadas en la orden.
function estadoFinalComprobante(r) {
  if (r.estado === 'Anulada' || r.anulada_por_nc) return 'ANULADA';
  if (r.sunat_estado) return String(r.sunat_estado).toUpperCase();
  if (r.codigo_tipo_sunat == null && Number(r.facturado_sunat) === 1) return 'ACEPTADO';
  return 'PENDIENTE';
}

function estadoFinalGuia(r) {
  if (r.estado === 'Anulada') return Number(r.baja_sunat_confirmada) === 1 ? 'BAJA' : 'ANULADA';
  if (r.sunat_estado) return String(r.sunat_estado).toUpperCase();
  return 'PENDIENTE';
}

function construirResumen(filas) {
  const porEstado = {};
  const porClase = {};
  for (const f of filas) {
    porEstado[f.estado_final] = (porEstado[f.estado_final] || 0) + 1;
    if (f.clase) porClase[f.clase] = (porClase[f.clase] || 0) + 1;
  }
  return { total: filas.length, porEstado, porClase };
}

// GET /api/sunat/trazabilidad/comprobantes
// Filtros (todos opcionales): tipo (FACTURA|NOTA_CREDITO|NOTA_DEBITO), estado (sunat_estado o
// ANULADA), desde, hasta (YYYY-MM-DD sobre fecha_emision), q (texto libre).
export async function listarComprobantes(req, res) {
  try {
    const { tipo = 'all', estado = 'all', desde, hasta, q, solo_sistema } = req.query;
    const where = [`fv.estado <> 'Eliminada'`];
    const params = [];

    if (tipo === 'FACTURA') where.push(`(fv.codigo_tipo_sunat IS NULL OR fv.codigo_tipo_sunat = '01')`);
    else if (tipo === 'NOTA_CREDITO') where.push(`fv.codigo_tipo_sunat = '07'`);
    else if (tipo === 'NOTA_DEBITO') where.push(`fv.codigo_tipo_sunat = '08'`);

    // solo_sistema=1 → únicamente comprobantes emitidos electrónicamente desde el sistema
    // (excluye las facturas manuales/legacy cargadas antes de la integración SEE).
    if (String(solo_sistema) === '1') {
      where.push(`NOT (fv.codigo_tipo_sunat IS NULL AND fv.sunat_estado IS NULL)`);
    }

    if (estado && estado !== 'all') {
      if (estado === 'ANULADA') where.push(`(fv.estado = 'Anulada' OR ${NC_ANULACION})`);
      else { where.push(`fv.sunat_estado = ?`); params.push(estado); }
    }
    if (desde) { where.push(`DATE(fv.fecha_emision) >= ?`); params.push(desde); }
    if (hasta) { where.push(`DATE(fv.fecha_emision) <= ?`); params.push(hasta); }
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      where.push(`(fv.numero_factura LIKE ? OR CONCAT(fv.serie,'-',fv.numero) LIKE ? OR cl.razon_social LIKE ? OR cl.ruc LIKE ? OR ov.numero_orden LIKE ?)`);
      params.push(like, like, like, like, like);
    }

    const sql = `
      SELECT
        fv.*,
        CASE fv.codigo_tipo_sunat
          WHEN '07' THEN 'NOTA_CREDITO'
          WHEN '08' THEN 'NOTA_DEBITO'
          ELSE 'FACTURA'
        END AS clase,
        ov.numero_orden, ov.facturado_sunat, ov.id_cliente AS ov_id_cliente,
        cl.razon_social AS cliente, cl.ruc AS ruc_cliente,
        emp.nombre_completo  AS registrado_por,
        emp2.nombre_completo AS anulado_por,
        ref.numero_factura AS ref_numero,
        CONCAT(ref.serie, '-', ref.numero) AS ref_documento,
        ref.codigo_tipo_sunat AS ref_tipo,
        ${NC_ANULACION} AS anulada_por_nc
      FROM facturas_venta fv
      LEFT JOIN ordenes_venta ov  ON ov.id_orden_venta = fv.id_orden_venta
      LEFT JOIN clientes cl        ON cl.id_cliente = ov.id_cliente
      LEFT JOIN facturas_venta ref ON ref.id_factura = fv.id_factura_ref
      LEFT JOIN empleados emp       ON emp.id_empleado = fv.id_registrado_por
      LEFT JOIN empleados emp2      ON emp2.id_empleado = fv.id_anulado_por
      WHERE ${where.join(' AND ')}
      ORDER BY fv.fecha_emision DESC, fv.id_factura DESC
      LIMIT 1000`;

    const [rows] = await pool.query(sql, params);
    const data = rows.map((r) => {
      const anulada_por_nc = !!Number(r.anulada_por_nc);
      const row = { ...r, anulada_por_nc };
      row.documento = (r.serie && r.numero != null) ? `${r.serie}-${r.numero}` : r.numero_factura;
      row.estado_final = estadoFinalComprobante(row);
      row.es_manual = r.codigo_tipo_sunat == null && Number(r.facturado_sunat) === 1 && !r.sunat_estado;
      row.url_pdf = extraerUrl(r.url_pdf);
      row.xml_url = extraerUrl(r.xml_url);
      row.cdr_url = extraerUrl(r.cdr_url);
      return row;
    });

    res.json({ success: true, data, resumen: construirResumen(data) });
  } catch (error) {
    console.error('Error en trazabilidad de comprobantes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/sunat/trazabilidad/guias
// Filtros (todos opcionales): estado (sunat_estado o ANULADA), desde, hasta, q.
export async function listarGuias(req, res) {
  try {
    const { estado = 'all', desde, hasta, q } = req.query;
    const where = ['1=1'];
    const params = [];

    if (estado && estado !== 'all') {
      if (estado === 'ANULADA') where.push(`gr.estado = 'Anulada'`);
      else { where.push(`gr.sunat_estado = ?`); params.push(estado); }
    }
    if (desde) { where.push(`DATE(gr.fecha_emision) >= ?`); params.push(desde); }
    if (hasta) { where.push(`DATE(gr.fecha_emision) <= ?`); params.push(hasta); }
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      where.push(`(gr.numero_guia LIKE ? OR CONCAT(gr.serie_sunat,'-',gr.numero_sunat) LIKE ? OR cl.razon_social LIKE ? OR cl.ruc LIKE ? OR ov.numero_orden LIKE ?)`);
      params.push(like, like, like, like, like);
    }

    const sql = `
      SELECT
        gr.*,
        ov.numero_orden,
        cl.razon_social AS cliente, cl.ruc AS ruc_cliente,
        emp.nombre_completo AS anulado_por,
        (SELECT COUNT(*) FROM detalle_guia_remision WHERE id_guia = gr.id_guia) AS total_items
      FROM guias_remision gr
      LEFT JOIN ordenes_venta ov ON ov.id_orden_venta = gr.id_orden_venta
      LEFT JOIN clientes cl       ON cl.id_cliente = gr.id_cliente
      LEFT JOIN empleados emp      ON emp.id_empleado = gr.anulado_por
      WHERE ${where.join(' AND ')}
      ORDER BY gr.fecha_emision DESC, gr.id_guia DESC
      LIMIT 1000`;

    const [rows] = await pool.query(sql, params);
    const data = rows.map((r) => {
      const row = { ...r, clase: 'GUIA' };
      row.documento = (r.serie_sunat && r.numero_sunat) ? `${r.serie_sunat}-${r.numero_sunat}` : r.numero_guia;
      row.estado_final = estadoFinalGuia(r);
      row.url_pdf = extraerUrl(r.url_pdf);
      row.xml_url = extraerUrl(r.xml_url);
      row.cdr_url = extraerUrl(r.cdr_url);
      return row;
    });

    res.json({ success: true, data, resumen: construirResumen(data) });
  } catch (error) {
    console.error('Error en trazabilidad de guías:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
