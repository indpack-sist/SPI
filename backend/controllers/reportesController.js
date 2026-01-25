import { executeQuery } from '../config/database.js';

export const getReporteComprasSIRE = async (req, res) => {
  try {
    const { mes, anio } = req.query;

    if (!mes || !anio) {
      return res.status(400).json({ success: false, error: 'Mes y Año son obligatorios' });
    }

    const sql = `
      SELECT 
        CONCAT(YEAR(oc.fecha_emision), LPAD(MONTH(oc.fecha_emision), 2, '0'), '00') AS periodo,
        
        oc.id_orden_compra AS cuo,
        
        DATE_FORMAT(oc.fecha_emision, '%d/%m/%Y') AS fecha_emision,
        
        DATE_FORMAT(oc.fecha_vencimiento, '%d/%m/%Y') AS fecha_vencimiento,
        
        CASE 
          WHEN oc.tipo_documento = 'Factura' THEN '01'
          WHEN oc.tipo_documento = 'Boleta' THEN '03'
          WHEN oc.tipo_documento = 'Nota de Credito' THEN '07'
          WHEN oc.tipo_documento = 'Nota de Debito' THEN '08'
          ELSE '00' 
        END AS tipo_comprobante,
        
        oc.serie_documento AS serie,
        
        oc.numero_documento AS numero,
        
        CASE LENGTH(pr.ruc) WHEN 11 THEN '6' ELSE '1' END AS tipo_doc_proveedor,
        
        pr.ruc AS num_doc_proveedor,
        
        pr.razon_social,
        
        CASE WHEN oc.estado = 'Cancelada' THEN 0.00 ELSE oc.subtotal END AS base_imponible,
        CASE WHEN oc.estado = 'Cancelada' THEN 0.00 ELSE oc.igv END AS igv,
        CASE WHEN oc.estado = 'Cancelada' THEN 0.00 ELSE oc.total END AS total,
        
        oc.moneda,
        oc.tipo_cambio,
        
        CASE WHEN oc.estado = 'Cancelada' THEN '2' ELSE '1' END AS estado_sunat

      FROM ordenes_compra oc
      INNER JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      WHERE MONTH(oc.fecha_emision) = ? AND YEAR(oc.fecha_emision) = ?
      ORDER BY oc.fecha_emision ASC
    `;

    const result = await executeQuery(sql, [mes, anio]);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result.data });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getReporteVentasSIRE = async (req, res) => {
  try {
    const { mes, anio } = req.query;

    if (!mes || !anio) {
      return res.status(400).json({ success: false, error: 'Mes y Año son obligatorios' });
    }

    const sql = `
      SELECT 
        CONCAT(YEAR(ov.fecha_emision), LPAD(MONTH(ov.fecha_emision), 2, '0'), '00') AS periodo,
        
        ov.id_orden_venta AS cuo,
        
        DATE_FORMAT(ov.fecha_emision, '%d/%m/%Y') AS fecha_emision,
        
        CASE 
          WHEN ov.tipo_comprobante = 'Factura' THEN '01'
          WHEN ov.tipo_comprobante = 'Boleta' THEN '03' -- Asumiendo Nota de Venta como Boleta si aplica, sino filtrar
          ELSE '00' 
        END AS tipo_comprobante,
        
        SUBSTRING_INDEX(ov.numero_comprobante, '-', 1) AS serie,
        SUBSTRING_INDEX(ov.numero_comprobante, '-', -1) AS numero,
        
        CASE 
          WHEN c.tipo_documento = 'RUC' THEN '6' 
          WHEN c.tipo_documento = 'DNI' THEN '1' 
          ELSE '0' 
        END AS tipo_doc_cliente,
        
        c.ruc AS num_doc_cliente,
        
        c.razon_social,
        
    
        CASE WHEN ov.estado = 'Cancelada' THEN 0.00 ELSE ov.subtotal END AS base_imponible,
        CASE WHEN ov.estado = 'Cancelada' THEN 0.00 ELSE ov.igv END AS igv,
        CASE WHEN ov.estado = 'Cancelada' THEN 0.00 ELSE ov.total END AS total,
        
        ov.moneda,
        ov.tipo_cambio,
        
        CASE WHEN ov.estado = 'Cancelada' THEN '2' ELSE '1' END AS estado_sunat

      FROM ordenes_venta ov
      INNER JOIN clientes c ON ov.id_cliente = c.id_cliente
      WHERE MONTH(ov.fecha_emision) = ? AND YEAR(ov.fecha_emision) = ?
      AND ov.numero_comprobante IS NOT NULL -- Solo ventas con comprobante generado
      AND ov.tipo_comprobante != 'Nota de Venta' -- Opcional: Filtrar si Notas de Venta son solo internas
      ORDER BY ov.fecha_emision ASC
    `;

    const result = await executeQuery(sql, [mes, anio]);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result.data });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};