import { executeQuery, executeTransaction, withTransaction } from '../config/database.js';
import { obtenerCorrelativoAtomico, obtenerCorrelativo } from '../services/sunat/numeracion.service.js';
import { componerObservacion, extraerUrl, codigoBienValido } from '../services/sunat/util.service.js';
import { ingresarStockCompra } from '../services/compras/recepcion.service.js';

// Fecha en zona horaria de Lima (evita el desfase +5h del pool vs. la sesión UTC de Railway
// al escribir TIMESTAMP/DATETIME). Espeja el helper homónimo de ordenesVenta.controller.js.
function getFechaPeru() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
}

// Arma la dirección completa de la empresa a partir de los campos de empresa_config:
// "AV. ... URBANIZACION DEPARTAMENTO - PROVINCIA - DISTRITO"
function armarDireccionCompleta(cfg) {
  const valorReal = (v) => v && String(v).trim() && String(v).trim() !== '-';
  const partes = [cfg.direccion, cfg.urbanizacion].filter(valorReal).join(' ');
  const ubicacion = [cfg.departamento, cfg.provincia, cfg.distrito].filter(valorReal).join(' - ');
  return [partes, ubicacion].filter(Boolean).join(' ');
}

// Alta/actualización de transportista deduplicada por RUC. Devuelve el id_transportista
// (o null si el RUC no es válido). Se usa desde el endpoint de alta rápida y desde el wiring
// OV→GRE (cuando la orden se entrega por tercero, su RUC se materializa en el maestro).
async function upsertTransportista(ruc, razon_social, numero_mtc) {
  const rucLimpio = String(ruc || '').trim();
  if (!/^\d{11}$/.test(rucLimpio) || !razon_social || !String(razon_social).trim()) return null;
  const razon = String(razon_social).trim();
  const mtc = numero_mtc ? String(numero_mtc).trim() : null;

  const existente = await executeQuery(
    'SELECT id_transportista FROM transportistas WHERE ruc = ?', [rucLimpio]
  );
  if (existente.success && existente.data.length > 0) {
    const idT = existente.data[0].id_transportista;
    await executeQuery(
      'UPDATE transportistas SET razon_social = ?, numero_mtc = COALESCE(?, numero_mtc), activo = 1 WHERE id_transportista = ?',
      [razon, mtc, idT]
    );
    return idT;
  }
  const ins = await executeQuery(
    'INSERT INTO transportistas (ruc, razon_social, numero_mtc) VALUES (?, ?, ?)',
    [rucLimpio, razon, mtc]
  );
  return ins.success ? ins.data.insertId : null;
}

export async function getAllGuiasRemision(req, res) {
  try {
    const { estado, fecha_inicio, fecha_fin, id_orden_venta } = req.query;

    let sql = `
      SELECT 
        gr.id_guia,
        gr.numero_guia,
        gr.fecha_emision,
        gr.fecha_traslado,
        gr.estado,
        gr.punto_partida,
        gr.punto_llegada,
        gr.peso_bruto_kg,
        gr.numero_bultos,
        gr.serie_sunat,
        gr.numero_sunat,
        gr.sunat_estado,
        gr.sunat_response_code,
        gr.sunat_response_desc,
        gr.xml_url,
        gr.cdr_url,
        gr.url_pdf,
        gr.motivo_anulacion,
        gr.fecha_anulacion,
        gr.baja_sunat_confirmada,
        gr.baja_sunat_fecha,
        gr.baja_sunat_origen,
        gr.baja_sunat_evidencia_url,
        gr.id_guia_reemplazo,
        ov.numero_orden,
        ov.id_orden_venta,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        emp_baja.nombre_completo AS baja_confirmada_por,
        (SELECT COUNT(*) FROM detalle_guia_remision WHERE id_guia = gr.id_guia) AS total_items
      FROM guias_remision gr
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON gr.id_cliente = cl.id_cliente
      LEFT JOIN empleados emp_baja ON gr.anulado_por = emp_baja.id_empleado
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      sql += ` AND gr.estado = ?`;
      params.push(estado);
    }

    if (id_orden_venta) {
      sql += ` AND gr.id_orden_venta = ?`;
      params.push(id_orden_venta);
    }

    if (fecha_inicio) {
      sql += ` AND DATE(gr.fecha_emision) >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND DATE(gr.fecha_emision) <= ?`;
      params.push(fecha_fin);
    }
    
    sql += ` ORDER BY gr.fecha_emision DESC, gr.id_guia DESC`;
    
    const result = await executeQuery(sql, params);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.json({
      success: true,
      data: result.data.map((g) => ({
        ...g,
        xml_url: extraerUrl(g.xml_url),
        cdr_url: extraerUrl(g.cdr_url),
        url_pdf: extraerUrl(g.url_pdf)
      }))
    });
    
  } catch (error) {
    console.error('Error al obtener guías de remisión:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getGuiaRemisionById(req, res) {
  try {
    const { id } = req.params;
    
    const guiaResult = await executeQuery(`
      SELECT
        gr.*,
        ov.numero_orden,
        ov.id_orden_venta,
        ov.estado AS estado_orden,
        ov.orden_compra_cliente,
        ov.tipo_entrega AS ov_tipo_entrega,
        ov.transporte_nombre AS ov_transporte_nombre,
        ov.transporte_ruc AS ov_transporte_ruc,
        ov.transporte_mtc AS ov_transporte_mtc,
        ov.transporte_placa AS ov_transporte_placa,
        ov.transporte_conductor AS ov_transporte_conductor,
        ov.transporte_dni AS ov_transporte_dni,
        ov.transporte_licencia AS ov_transporte_licencia,
        ov.transporte_tuc AS ov_transporte_tuc,
        ov.transporte_autorizacion AS ov_transporte_autorizacion,
        ov.transporte_placa2 AS ov_transporte_placa2,
        ov.transporte_tuc2 AS ov_transporte_tuc2,
        ov.transporte_autorizacion2 AS ov_transporte_autorizacion2,
        ov.transporte_dni2 AS ov_transporte_dni2,
        ov.transporte_conductor2 AS ov_transporte_conductor2,
        ov.transporte_licencia2 AS ov_transporte_licencia2,
        ov.transporte_registrar AS ov_transporte_registrar,
        ov.transporte_ind_transbordo AS ov_ind_transbordo,
        ov.transporte_ind_m1l AS ov_ind_m1l,
        ov.transporte_ind_retorno_vacio AS ov_ind_retorno_vacio,
        DATE_FORMAT(ov.transporte_fecha_entrega, '%Y-%m-%d') AS ov_transporte_fecha_entrega,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        emp.nombre_completo AS conductor_flota_nombre,
        emp.dni AS conductor_flota_dni,
        emp.licencia_conducir AS conductor_flota_licencia,
        fl.placa AS vehiculo_flota_placa,
        fl.marca_modelo AS vehiculo_flota_marca,
        tr.razon_social AS transportista_razon,
        tr.ruc AS transportista_ruc,
        tr.numero_mtc AS transportista_mtc,
        pr.razon_social AS proveedor,
        pr.ruc AS ruc_proveedor,
        oc.numero_orden AS numero_orden_compra,
        oc.serie_documento AS oc_serie_documento,
        oc.numero_documento AS oc_numero_documento,
        oc.fecha_emision_documento AS oc_fecha_documento
      FROM guias_remision gr
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON gr.id_cliente = cl.id_cliente
      LEFT JOIN empleados emp ON gr.id_conductor = emp.id_empleado
      LEFT JOIN flota fl ON gr.id_vehiculo = fl.id_vehiculo
      LEFT JOIN transportistas tr ON gr.id_transportista = tr.id_transportista
      LEFT JOIN proveedores pr ON gr.id_proveedor = pr.id_proveedor
      LEFT JOIN ordenes_compra oc ON gr.id_orden_compra = oc.id_orden_compra
      WHERE gr.id_guia = ?
    `, [id]);
    
    if (!guiaResult.success) {
      return res.status(500).json({ 
        success: false,
        error: guiaResult.error 
      });
    }
    
    if (guiaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía de remisión no encontrada'
      });
    }
    
    const guia = guiaResult.data[0];
    guia.xml_url = extraerUrl(guia.xml_url);
    guia.cdr_url = extraerUrl(guia.cdr_url);
    guia.url_pdf = extraerUrl(guia.url_pdf);
    // Observación sugerida para el panel de emisión: prellenado editable = texto libre + OC de la OV.
    // Lo que el usuario deje en ese campo es lo que viaja a SUNAT como cbc:Note.
    guia.observacion_sugerida = componerObservacion(guia.observaciones, guia.orden_compra_cliente);

    const detalleResult = await executeQuery(`
      SELECT
        dgr.*,
        p.codigo AS codigo_producto,
        COALESCE(p.nombre, dgr.descripcion) AS producto,
        COALESCE(p.unidad_medida, dgr.unidad_medida) AS unidad_medida_producto,
        p.stock_actual,
        p.id_tipo_inventario,
        ti.nombre AS tipo_inventario
      FROM detalle_guia_remision dgr
      LEFT JOIN productos p ON dgr.id_producto = p.id_producto
      LEFT JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE dgr.id_guia = ?
      ORDER BY dgr.id_detalle
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false,
        error: detalleResult.error 
      });
    }
    
    guia.detalle = detalleResult.data;
    if (guia.tipo_origen === 'Compra') {
      guia.detalle = guia.detalle.map((item) => ({
        ...item,
        codigo_producto_interno: item.codigo_producto,
        producto_interno: item.producto,
        codigo_producto: item.codigo_documento || item.codigo_producto,
        producto: item.descripcion || item.producto,
      }));
    }

    // Historial de emisiones SUNAT (append-only): cada intento (incluido el rechazado que se
    // sobrescribió en la cabecera al reemitir) con su estado, motivo y documentos. Alimenta el
    // historial del panel + el PDF por intento (con marca RECHAZADO). Best-effort: si la tabla aún
    // no existe (sin el DDL nuevo) simplemente no hay historial.
    try {
      const emisionesResult = await executeQuery(
        `SELECT id_emision, serie_sunat, numero_sunat, sunat_estado, sunat_response_code,
                sunat_response_desc, sunat_ticket, xml_url, cdr_url,
                (snapshot_json IS NOT NULL) AS tiene_snapshot,
                DATE_FORMAT(created_at, '%d/%m/%Y %H:%i') AS created_at
           FROM guias_remision_emisiones WHERE id_guia = ? ORDER BY id_emision`,
        [id]);
      guia.emisiones = (emisionesResult.success ? emisionesResult.data : []).map((e) => ({
        ...e,
        xml_url: extraerUrl(e.xml_url),
        cdr_url: extraerUrl(e.cdr_url),
      }));
    } catch { guia.emisiones = []; }

    // Comercio exterior: documentos relacionados (DAM) + contenedores/precintos (tablas repetibles).
    // Se devuelven siempre (arrays vacíos en guías domésticas) para que el front pueda mostrar/editar
    // una guía comex ya creada. El orden de inserción == el del XML emitido (ver gre-emision.service.js).
    if (Number(guia.es_comercio_exterior) === 1) {
      const docsRelResult = await executeQuery(
        `SELECT tipo_cod, tipo_desc, serie, numero
         FROM guias_remision_doc_relacionado WHERE id_guia = ?`, [id]);
      const contenedoresResult = await executeQuery(
        `SELECT numero_contenedor, numero_precinto
         FROM guias_remision_contenedor WHERE id_guia = ?`, [id]);
      guia.docs_relacionados = docsRelResult.success ? docsRelResult.data : [];
      guia.contenedores = contenedoresResult.success ? contenedoresResult.data : [];
    } else {
      guia.docs_relacionados = [];
      guia.contenedores = [];
    }

    const guiaTransportistaResult = await executeQuery(`
      SELECT 
        id_guia_transportista,
        numero_guia,
        razon_social_transportista,
        ruc_transportista,
        nombre_conductor,
        licencia_conducir,
        placa_vehiculo,
        marca_vehiculo
      FROM guias_transportista
      WHERE id_guia = ?
    `, [id]);
    
    if (guiaTransportistaResult.success && guiaTransportistaResult.data.length > 0) {
      guia.guia_transportista = guiaTransportistaResult.data[0];
    }
    
    res.json({
      success: true,
      data: guia
    });
    
  } catch (error) {
    console.error('Error al obtener guía de remisión:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function createGuiaRemision(req, res) {
  try {
    const {
      id_orden_venta,
      fecha_emision,
      fecha_traslado,
      tipo_traslado,
      motivo_traslado,
      modalidad_transporte,
      direccion_llegada,
      ubigeo_llegada,
      ciudad_llegada,
      peso_bruto_kg,
      numero_bultos,
      observaciones,
      id_conductor,
      id_vehiculo,
      id_transportista,
      motivo_traslado_cod,
      motivo_descripcion,   // "Especifique" cuando el motivo es Otros (cat.20 = 13), ej. MUESTRAS
      detalle,
      // Comercio exterior (exportación). Solo se persisten si la OV es export (esComex).
      destinatario_ruc,
      destinatario_razon,
      puerto_codigo,
      traslado_total_dam,
      docs_relacionados,   // [{ tipo_cod, tipo_desc, serie, numero }]
      contenedores         // [{ numero_contenedor, numero_precinto }]
    } = req.body;

    // Catálogo 20 (SUNAT): derivar el código de motivo desde el motivo de negocio si no viene explícito.
    // Requerido para emitir la GRE electrónica (gre-emision valida motivo_traslado_cod).
    const MOTIVO_TRASLADO_COD = {
      'Venta': '01',
      'Traslado entre Almacenes': '04',
      'Devolución': '13', // 13 = Otros
      'Otros': '13',      // 13 = Otros (muestras) → descripción libre en motivo_descripcion
      'Exportación': '09', // Comercio exterior (cat.20)
      'Importación': '08'
    };
    let motivoCod = motivo_traslado_cod || MOTIVO_TRASLADO_COD[motivo_traslado] || '01';
    // "Especifique" del motivo Otros (cat.20 = 13): texto libre que viaja como HandlingInstructions.
    const motivoDescripcion = motivoCod === '13' ? (String(motivo_descripcion || '').trim() || null) : null;
    
    if (!id_orden_venta) {
      return res.status(400).json({
        success: false,
        error: 'La orden de venta es obligatoria'
      });
    }
    
    if (!detalle || detalle.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe incluir al menos un producto'
      });
    }
    
    if (!direccion_llegada || direccion_llegada.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'La dirección de llegada es obligatoria'
      });
    }

    // Obtener información de la orden (incluye el transporte asignado a nivel de OV
    // para que la guía lo herede si el request no envía conductor/vehículo).
    const ordenResult = await executeQuery(`
      SELECT
        ov.id_cliente,
        ov.estado,
        ov.direccion_entrega,
        (SELECT cd.ubigeo
           FROM clientes_direcciones cd
          WHERE cd.id_cliente = ov.id_cliente
            AND cd.estado = 'Activo'
            AND TRIM(cd.direccion) = TRIM(ov.direccion_entrega)
          ORDER BY cd.es_principal DESC, cd.id_direccion DESC
          LIMIT 1) AS ubigeo_cliente,
        ov.es_exportacion,
        ov.id_conductor,
        ov.id_vehiculo,
        ov.tipo_entrega,
        ov.transporte_nombre,
        ov.transporte_ruc,
        ov.transporte_mtc,
        ov.transporte_placa,
        ov.transporte_conductor,
        ov.transporte_dni,
        ov.transporte_licencia
      FROM ordenes_venta ov
      WHERE ov.id_orden_venta = ?
    `, [id_orden_venta]);

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }

    const orden = ordenResult.data[0];
    // La selección explícita (por ejemplo, un puerto de exportación) tiene prioridad. Para una
    // venta nacional, si el formulario no lo envía, se reutiliza el ubigeo del domicilio elegido
    // en la OV. Así el backend también funciona correctamente sin depender del autocompletado UI.
    const ubigeoLlegadaFinal = String(ubigeo_llegada || orden.ubigeo_cliente || '').trim();
    if (!/^\d{6}$/.test(ubigeoLlegadaFinal)) {
      return res.status(400).json({
        success: false,
        error: 'El domicilio de llegada no tiene un ubigeo válido. Regístrelo en la ficha del cliente.'
      });
    }

    // Comercio exterior: se hereda del checkbox "Factura de exportación" de la OV
    // (ordenes_venta.es_exportacion). Es la fuente única que responde a "¿Es una
    // operación de comercio exterior?" en la guía. Si la OV es exportación, la GRE
    // nace con motivo Exportación (cat.20 = 09) y es_comercio_exterior = 1, sin
    // depender de que el usuario lo marque a mano al emitir. Ver GRE_EXPORT_EG07-273.xml.
    const esComex = Number(orden.es_exportacion) === 1;
    let motivoTexto = motivo_traslado || 'Venta';
    if (esComex) {
      motivoTexto = 'Exportación';
      motivoCod = '09';
    }

    // Una guía de remisión es un documento de despacho: se permite en cualquier
    // estado activo de la OV, bloqueando solo las órdenes canceladas o ya entregadas
    // (mismo criterio que registrarDespacho en ordenesVenta.controller.js).
    if (orden.estado === 'Cancelada' || orden.estado === 'Entregada') {
      return res.status(400).json({
        success: false,
        error: `No se pueden crear guías para órdenes en estado "${orden.estado}".`
      });
    }

    // Entregas parciales: una OV puede tener VARIAS guías vigentes, cada una por una parte del
    // pedido (ya no se bloquea por "una guía activa por orden"). El tope por línea (más abajo)
    // garantiza que la suma de cantidades en guías NO anuladas nunca supere lo pedido, incluso
    // antes de despachar. Aquí se precomputa lo ya comprometido en guías vigentes, por línea.
    const enGuiasResult = await executeQuery(
      `SELECT dgr.id_detalle_orden AS id_detalle, COALESCE(SUM(dgr.cantidad), 0) AS en_guias
         FROM detalle_guia_remision dgr
         JOIN guias_remision gr ON gr.id_guia = dgr.id_guia
        WHERE gr.id_orden_venta = ? AND gr.estado <> 'Anulada'
        GROUP BY dgr.id_detalle_orden`,
      [id_orden_venta]
    );
    const mapaEnGuias = new Map(
      (enGuiasResult.success ? enGuiasResult.data : []).map((r) => [Number(r.id_detalle), parseFloat(r.en_guias) || 0])
    );
    const EPS_GUIA = 0.0001;

    // Transporte público (tercero transportista) vs privado (conductor+vehículo propios).
    // Fuente del transportista, en orden de prioridad:
    //   1) el que venga explícito en el request (id_transportista);
    //   2) el que la OV declaró como entrega por tercero ('Transporte Privado' + RUC): se
    //      materializa en el maestro (upsert por RUC) para emitir la GRE pública.
    let idTransportistaFinal = id_transportista || null;
    if (!idTransportistaFinal && orden.tipo_entrega === 'Transporte Privado' && orden.transporte_ruc) {
      idTransportistaFinal = await upsertTransportista(
        orden.transporte_ruc, orden.transporte_nombre, orden.transporte_mtc
      );
    }
    // La OV es por tercero pero no tiene RUC: no se puede emitir GRE pública sin él.
    if (orden.tipo_entrega === 'Transporte Privado' && !idTransportistaFinal && !orden.transporte_ruc) {
      return res.status(400).json({
        success: false,
        error: 'La orden se entrega por transporte de tercero, pero falta el RUC del transportista. Complétalo en "Transporte y Logística" de la orden antes de crear la guía.'
      });
    }

    // La presencia de un transportista define la modalidad pública: en ese caso NO se hereda
    // el conductor/vehículo de la OV (evita datos que harían derivar modalidad privada al emitir).
    const esPublico = !!idTransportistaFinal;
    // Carro particular del cliente (sin RUC): modalidad 02 privada con conductor/placa de TEXTO LIBRE
    // heredados de la OV. No usa flota ni transportista.
    const esParticular = orden.tipo_entrega === 'Vehiculo Particular';
    // Herencia de transporte: si el request no especifica conductor/vehículo, usar el
    // asignado en la orden de venta (la OV ya los captura a su nivel).
    const idConductorFinal = (esPublico || esParticular) ? null : (id_conductor || orden.id_conductor || null);
    const idVehiculoFinal = (esPublico || esParticular) ? null : (id_vehiculo || orden.id_vehiculo || null);
    // Datos de transporte de texto libre para la guía (solo modo particular).
    const modoGuia = esPublico ? 'tercero' : (esParticular ? 'particular' : 'flota');
    const guiaTransportePlaca = esParticular ? (orden.transporte_placa || null) : null;
    const guiaTransporteConductor = esParticular ? (orden.transporte_conductor || null) : null;
    const guiaTransporteDni = esParticular ? (orden.transporte_dni || null) : null;
    const guiaTransporteLicencia = esParticular ? (orden.transporte_licencia || null) : null;

    // En guías de venta el punto de partida es autoritativamente el domicilio fiscal configurado.
    // No se aceptan valores del navegador: así una manipulación o estado viejo del formulario no
    // puede enviar a SUNAT un origen distinto de empresa_config.
    const empresaResult = await executeQuery('SELECT direccion, ubigeo, urbanizacion, departamento, provincia, distrito FROM empresa_config WHERE id = 1');
    const empresaCfg = (empresaResult.success && empresaResult.data[0]) || {};
    const direccionPartidaFinal = armarDireccionCompleta(empresaCfg) || String(empresaCfg.direccion || '').trim();
    const ubigeoPartidaFinal = String(empresaCfg.ubigeo || '').trim();
    if (!direccionPartidaFinal) {
      return res.status(400).json({
        success: false,
        error: 'Falta la dirección fiscal en la configuración de la empresa'
      });
    }
    if (!/^\d{6}$/.test(ubigeoPartidaFinal)) {
      return res.status(400).json({
        success: false,
        error: 'Falta un ubigeo fiscal válido (6 dígitos) en la configuración de la empresa'
      });
    }
    
    // Validar cada producto del detalle
    for (const item of detalle) {
      // Validar detalle de orden. LEFT JOIN productos: los ítems de muestra pueden ser de texto
      // libre (id_producto NULL, sin fila en productos) y deben pasar la validación igual.
      const detalleOrdenResult = await executeQuery(`
        SELECT
          dov.cantidad,
          dov.cantidad_despachada,
          dov.es_producto_libre,
          dov.descripcion_libre,
          dov.id_producto,
          p.codigo,
          p.nombre,
          p.stock_actual,
          p.id_tipo_inventario
        FROM detalle_orden_venta dov
        LEFT JOIN productos p ON dov.id_producto = p.id_producto
        WHERE dov.id_detalle = ?
      `, [item.id_detalle_orden]);

      if (!detalleOrdenResult.success || detalleOrdenResult.data.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Detalle de orden inválido'
        });
      }

      const detalleOrden = detalleOrdenResult.data[0];
      const esLibre = Number(detalleOrden.es_producto_libre) === 1;
      const nombreItem = detalleOrden.nombre || detalleOrden.descripcion_libre || 'Ítem';
      const codigoItem = detalleOrden.codigo || 'libre';
      const cantidadOrden = parseFloat(detalleOrden.cantidad);
      // Pendiente = pedido − lo ya comprometido en guías vigentes (no anuladas) de esta OV. Así, al
      // crear guías parciales sucesivas, la suma nunca supera lo pedido (aunque aún no se despachen).
      const yaEnGuias = mapaEnGuias.get(Number(item.id_detalle_orden)) || 0;
      const cantidadDisponibleOrden = cantidadOrden - yaEnGuias;
      const cantidadSolicitada = parseFloat(item.cantidad);

      // Validar que no exceda lo pendiente de la orden (considerando otras guías vigentes)
      if (cantidadSolicitada > cantidadDisponibleOrden + EPS_GUIA) {
        return res.status(400).json({
          success: false,
          error: `${nombreItem} (${codigoItem}): Cantidad a despachar (${cantidadSolicitada}) excede lo pendiente en la orden (${Math.max(0, cantidadDisponibleOrden).toFixed(4)})`
        });
      }
      // Reserva local: si el detalle repite la misma línea, acumula para no exceder al sumar.
      mapaEnGuias.set(Number(item.id_detalle_orden), yaEnGuias + cantidadSolicitada);

      // Ítem libre (muestra sin producto de catálogo): no hay stock ni id_producto que validar.
      if (!esLibre) {
        const stockActual = parseFloat(detalleOrden.stock_actual);
        // Validar stock disponible
        if (cantidadSolicitada > stockActual) {
          return res.status(400).json({
            success: false,
            error: `${nombreItem} (${codigoItem}): Stock insuficiente. Disponible: ${stockActual.toFixed(4)}, Requerido: ${cantidadSolicitada.toFixed(4)}`
          });
        }
        // Validar que el id_producto coincida
        if (item.id_producto !== detalleOrden.id_producto) {
          return res.status(400).json({
            success: false,
            error: `El producto del detalle no coincide con el de la orden`
          });
        }
      }

      // Código de Bien (GTIN-13): opcional, decidido por el usuario en el modal.
      if (item.codigo_bien && !codigoBienValido(item.codigo_bien)) {
        return res.status(400).json({
          success: false,
          error: `${nombreItem} (${codigoItem}): Código de bien inválido (debe tener 13 dígitos)`
        });
      }
    }
    
    
    // Generar número de guía con correlativo atómico dedicado (fila 'GR'/'T001' en
    // series_correlativos). Reemplaza el antiguo MAX(id_guia)+regex, que era frágil:
    // colisionaba con el UNIQUE si el último numero_guia no terminaba en dígitos y no
    // tenía lock de secuencia (carrera bajo concurrencia).
    const numeroSecuencia = await obtenerCorrelativoAtomico('GR', 'T001');
    const numeroGuia = `T001-${String(numeroSecuencia).padStart(8, '0')}`;
    
    // Crear la guía
    const result = await executeQuery(`
      INSERT INTO guias_remision (
        numero_guia,
        id_orden_venta,
        id_cliente,
        fecha_emision,
        fecha_traslado,
        punto_partida,
        punto_llegada,
        tipo_traslado,
        motivo_traslado,
        modalidad_transporte,
        direccion_partida,
        ubigeo_partida,
        direccion_llegada,
        ubigeo_llegada,
        ciudad_llegada,
        peso_bruto_kg,
        numero_bultos,
        observaciones,
        id_conductor,
        id_vehiculo,
        id_transportista,
        motivo_traslado_cod,
        motivo_descripcion,
        transporte_modo,
        transporte_placa,
        transporte_conductor,
        transporte_dni,
        transporte_licencia,
        es_comercio_exterior,
        destinatario_ruc,
        destinatario_razon,
        traslado_total_dam,
        puerto_codigo,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Emitida')
    `, [
      numeroGuia,
      id_orden_venta,
      orden.id_cliente,
      fecha_emision || new Date().toISOString().split('T')[0],
      fecha_traslado || new Date().toISOString().split('T')[0],
      direccionPartidaFinal,
      direccion_llegada,
      tipo_traslado || 'Privado',
      motivoTexto,
      modalidad_transporte || 'Transporte Privado',
      direccionPartidaFinal,
      ubigeoPartidaFinal,
      direccion_llegada,
      ubigeoLlegadaFinal,
      ciudad_llegada,
      parseFloat(peso_bruto_kg) || 0,
      parseInt(numero_bultos) || 0,
      observaciones,
      idConductorFinal,
      idVehiculoFinal,
      idTransportistaFinal,
      motivoCod,
      motivoDescripcion,
      modoGuia,
      guiaTransportePlaca,
      guiaTransporteConductor,
      guiaTransporteDni,
      guiaTransporteLicencia,
      esComex ? 1 : 0,
      esComex ? (destinatario_ruc || null) : null,
      esComex ? (destinatario_razon || null) : null,
      esComex ? (Number(traslado_total_dam) === 0 ? 0 : 1) : 1,
      esComex ? (puerto_codigo || null) : null
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    const idGuia = result.data.insertId;
    
    // Insertar detalle de la guía
    for (const item of detalle) {
      const pesoTotal = parseFloat(item.cantidad) * parseFloat(item.peso_unitario_kg || 0);
      
            await executeQuery(`
        INSERT INTO detalle_guia_remision (
          id_guia,
          id_detalle_orden,
          id_producto,
          cantidad,
          unidad_medida,
          descripcion,
          peso_unitario_kg,
          peso_total_kg,
          subpartida_nacional,
          dam_serie,
          codigo_bien
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        idGuia,
        item.id_detalle_orden,
        item.id_producto || null,
        parseFloat(item.cantidad),
        item.unidad_medida || 'NIU',
        item.descripcion || item.producto || '',
        parseFloat(item.peso_unitario_kg) || 0,
        pesoTotal,
        esComex ? (item.subpartida_nacional || null) : null,
        esComex ? (item.dam_serie || null) : null,
        item.codigo_bien ? String(item.codigo_bien).trim() : null
      ]);
    }

    // Comercio exterior: documentos relacionados (DAM) + contenedores/precintos (tablas repetibles).
    if (esComex) {
      for (const doc of (Array.isArray(docs_relacionados) ? docs_relacionados : [])) {
        if (!doc?.tipo_cod || !doc?.numero) continue;
        await executeQuery(
          `INSERT INTO guias_remision_doc_relacionado (id_guia, tipo_cod, tipo_desc, serie, numero)
           VALUES (?, ?, ?, ?, ?)`,
          [idGuia, String(doc.tipo_cod), doc.tipo_desc || '', doc.serie || null, String(doc.numero)]);
      }
      for (const c of (Array.isArray(contenedores) ? contenedores : [])) {
        if (!c?.numero_contenedor) continue;
        await executeQuery(
          `INSERT INTO guias_remision_contenedor (id_guia, numero_contenedor, numero_precinto)
           VALUES (?, ?, ?)`,
          [idGuia, String(c.numero_contenedor), c.numero_precinto || null]);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id_guia: idGuia,
        numero_guia: numeroGuia
      },
      message: 'Guía de remisión creada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al crear guía de remisión:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ── GUÍA DE REMISIÓN DE COMPRA (motivo 02) ───────────────────────────────────────────────────
// Función DEDICADA (no toca createGuiaRemision de venta): SPI recoge su mercadería con flota propia
// y emite la GRE con motivo "02 Compra". Crea la guía (tipo_origen='Compra', ligada a la orden de
// compra y al proveedor, destinatario = la propia empresa al emitir) e INGRESA el stock en la misma
// transacción (entrada por tipo_inventario). La emisión a SUNAT es un paso posterior (emitirGuiaGre).
export async function createGuiaCompra(req, res) {
  const fail = (status, msg) => { const e = new Error(msg); e.status = status; return e; };
  try {
    const {
      id_orden_compra,
      fecha_emision, fecha_traslado,
      direccion_partida, ubigeo_partida,
      ciudad_llegada,
      peso_bruto_kg, numero_bultos, observaciones,
      id_conductor, id_vehiculo,
      detalle
    } = req.body;
    const idRegistradoPor = req.user?.id_empleado || null;

    if (!id_orden_compra) throw fail(400, 'La orden de compra es obligatoria');
    if (!Array.isArray(detalle) || detalle.length === 0) throw fail(400, 'Debe incluir al menos un producto');
    if (!id_conductor || !id_vehiculo) throw fail(400, 'Debe seleccionar el conductor y el vehículo de la flota que realiza el traslado');
    if (!(parseFloat(peso_bruto_kg) > 0)) throw fail(422, 'El peso bruto (kg) debe ser mayor a 0');

    // Llegada = tu almacén y su fuente autoritativa es empresa_config. No se acepta el valor del
    // request: evita que una UI antigua o un cliente API emita una GRE de compra hacia otro punto.
    const empRes = await executeQuery('SELECT razon_social, ruc, direccion, ubigeo FROM empresa_config WHERE id = 1');
    if (!empRes.success) throw fail(500, 'No se pudo leer la configuración de la empresa');
    const empCfg = empRes.data[0] || {};
    const direccionLlegada = String(empCfg.direccion || '').trim();
    const ubigeoLlegada = String(empCfg.ubigeo || '').trim();

    if (!direccion_partida || !String(direccion_partida).trim()) throw fail(400, 'La dirección de partida (proveedor) es obligatoria');
    if (!/^\d{6}$/.test(String(ubigeo_partida || ''))) throw fail(400, 'El ubigeo de partida es obligatorio (6 dígitos)');
    if (!direccionLlegada) throw fail(422, 'Falta la dirección de llegada en empresa_config');
    if (!/^\d{6}$/.test(ubigeoLlegada)) throw fail(422, 'Falta un ubigeo de llegada válido (6 dígitos) en empresa_config');
    if (!/^\d{11}$/.test(String(empCfg.ruc || '').trim())) throw fail(422, 'Falta un RUC válido en empresa_config');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha_traslado || ''))) throw fail(422, 'La fecha de traslado es inválida');

    const result = await withTransaction(async (conn) => {
      const [[oc]] = await conn.query(
        'SELECT * FROM ordenes_compra WHERE id_orden_compra = ? FOR UPDATE', [id_orden_compra]);
      if (!oc) throw fail(404, 'Orden de compra no encontrada');
      if (oc.estado === 'Cancelada') throw fail(409, 'No se pueden crear guías para una compra cancelada');

      const [[proveedor]] = await conn.query(
        'SELECT ruc, razon_social FROM proveedores WHERE id_proveedor = ?', [oc.id_proveedor]);
      if (!proveedor || !/^\d{11}$/.test(String(proveedor.ruc || '').trim())) {
        throw fail(422, 'El proveedor de la compra no tiene un RUC válido');
      }
      if (!String(oc.serie_documento || '').trim() || !String(oc.numero_documento || '').trim()) {
        throw fail(422, 'La compra no tiene una factura relacionada completa (serie y número)');
      }

      const [[conductor]] = await conn.query(
        'SELECT dni, nombre_completo, licencia_conducir FROM empleados WHERE id_empleado = ?', [id_conductor]);
      if (!conductor) throw fail(422, 'El conductor seleccionado no existe');
      if (!/^\d{8}$/.test(String(conductor.dni || '').trim())) throw fail(422, 'El conductor seleccionado no tiene un DNI válido');
      if (!String(conductor.licencia_conducir || '').trim()) throw fail(422, 'El conductor seleccionado no tiene licencia de conducir registrada');

      const [[vehiculo]] = await conn.query(
        'SELECT placa FROM flota WHERE id_vehiculo = ?', [id_vehiculo]);
      const placa = String(vehiculo?.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!vehiculo || !/^[A-Z0-9]{6,8}$/.test(placa)) {
        throw fail(422, 'El vehículo seleccionado no tiene una placa válida registrada');
      }

      // Precio + tipo de inventario por producto salen de la COMPRA (no de la guía).
      const [lineasCompra] = await conn.query(
        `SELECT doc.id_detalle, doc.id_producto, doc.cantidad AS cantidad_comprada,
                doc.precio_unitario, doc.descuento_porcentaje,
                doc.codigo_documento, doc.descripcion_documento, doc.unidad_documento_sunat,
                p.id_tipo_inventario, p.codigo, p.unidad_medida, p.codigo_unidad_sunat, p.nombre
           FROM detalle_orden_compra doc JOIN productos p ON p.id_producto = doc.id_producto
          WHERE doc.id_orden_compra = ?`, [id_orden_compra]);
      const mapaCompra = new Map(lineasCompra.map((l) => [Number(l.id_detalle), l]));

      // Cuánto se ha despachado ya por línea en guías previas de esta MISMA compra (las anuladas
      // liberan su cantidad). La OC está bloqueada con FOR UPDATE arriba → dos guías concurrentes de
      // la misma compra se serializan y esta suma es consistente. Sirve para no despachar de más.
      const [despachadoRows] = await conn.query(
        `SELECT dgr.id_detalle_compra AS id_detalle, COALESCE(SUM(dgr.cantidad), 0) AS despachado
           FROM detalle_guia_remision dgr
           JOIN guias_remision gr ON gr.id_guia = dgr.id_guia
          WHERE gr.id_orden_compra = ? AND gr.tipo_origen = 'Compra' AND gr.estado <> 'Anulada'
          GROUP BY dgr.id_detalle_compra`, [id_orden_compra]);
      const mapaDespachado = new Map(despachadoRows.map((r) => [Number(r.id_detalle), parseFloat(r.despachado) || 0]));
      const EPS = 0.0001;

      const items = [];
      for (const it of detalle) {
        const idProd = Number(it.id_producto);
        const idDetalleCompra = Number(it.id_detalle_compra);
        const base = mapaCompra.get(idDetalleCompra);
        if (!base || Number(base.id_producto) !== idProd) {
          throw fail(400, `La línea de compra del producto (id ${idProd}) no es válida`);
        }
                const cantidad = parseFloat(it.cantidad);
        if (!(cantidad > 0)) throw fail(400, `Cantidad recibida inválida para "${base.nombre}"`);

        // Tope por línea: lo despachado en guías + esta cantidad NUNCA puede superar lo comprado.
        // Evita emitir más de lo que dice la factura (sobre-despacho / doble emisión).
        const cantidadComprada = parseFloat(base.cantidad_comprada) || 0;
        const yaDespachado = mapaDespachado.get(idDetalleCompra) || 0;
        if (yaDespachado + cantidad > cantidadComprada + EPS) {
          const pendiente = Math.max(0, cantidadComprada - yaDespachado);
          const nombreItem = base.descripcion_documento || base.nombre;
          throw fail(422, `"${nombreItem}": intentas despachar ${cantidad} pero solo quedan ${pendiente} por despachar `
            + `(comprado ${cantidadComprada}, ya en guías ${yaDespachado}).`);
        }
        // Reserva local para el resto de líneas del MISMO producto dentro de esta guía (si el
        // detalle trae la línea repetida) y para no exceder al acumular.
        mapaDespachado.set(idDetalleCompra, yaDespachado + cantidad);

        // Código de Bien (GTIN-13): opcional, decidido por el usuario en el modal.
        if (it.codigo_bien && !codigoBienValido(it.codigo_bien)) {
          throw fail(400, `Código de bien inválido para "${base.nombre}" (debe tener 13 dígitos)`);
        }
        const codigoDocumento = base.codigo_documento
          || String(it.codigo_documento || '').trim().slice(0, 100);
        const descripcionDocumento = base.descripcion_documento
          || String(it.descripcion_documento || '').trim().slice(0, 500);
        const unidadDocumento = base.unidad_documento_sunat
          || String(it.unidad_documento_sunat || '').trim().slice(0, 20).toUpperCase();
        if (!codigoDocumento || !descripcionDocumento || !unidadDocumento) {
          throw fail(422, `Faltan los datos documentales del producto "${base.nombre}"`);
        }
        if (!base.descripcion_documento || !base.unidad_documento_sunat || !base.codigo_documento) {
          await conn.query(
            `UPDATE detalle_orden_compra
                SET codigo_documento = ?, descripcion_documento = ?, unidad_documento_sunat = ?
              WHERE id_detalle = ? AND id_orden_compra = ?`,
            [codigoDocumento, descripcionDocumento, unidadDocumento, base.id_detalle, id_orden_compra]
          );
        }
                items.push({
          id_detalle_compra: base.id_detalle,
          id_producto: idProd,
          id_tipo_inventario: base.id_tipo_inventario,
          cantidad,
          precio_unitario: base.precio_unitario,
          descuento_porcentaje: base.descuento_porcentaje,
          codigo_documento: codigoDocumento,
          unidad_medida: unidadDocumento,
          descripcion: descripcionDocumento,
          peso_unitario_kg: parseFloat(it.peso_unitario_kg || 0),
          codigo_bien: it.codigo_bien ? String(it.codigo_bien).trim() : null,
        });
      }

      // Correlativo interno de guía (atómico dentro de la TX; no lo quema si algo falla).
      const numeroSecuencia = await obtenerCorrelativo(conn, 'GR', 'T001');
      const numeroGuia = `T001-${String(numeroSecuencia).padStart(8, '0')}`;
      const hoy = new Date().toISOString().split('T')[0];

      const [resGuia] = await conn.query(
        `INSERT INTO guias_remision (
           numero_guia, tipo_origen, id_orden_compra, id_proveedor,
           fecha_emision, fecha_traslado, punto_partida, punto_llegada,
           tipo_traslado, motivo_traslado, modalidad_transporte,
           direccion_partida, ubigeo_partida, direccion_llegada, ubigeo_llegada, ciudad_llegada,
           peso_bruto_kg, numero_bultos, observaciones,
           id_conductor, id_vehiculo, motivo_traslado_cod, transporte_modo, estado
         ) VALUES (?, 'Compra', ?, ?, ?, ?, ?, ?, 'Privado', 'Compra', 'Transporte Privado', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '02', 'flota', 'Emitida')`,
        [
          numeroGuia, id_orden_compra, oc.id_proveedor,
          fecha_emision || hoy, fecha_traslado || hoy, direccion_partida, direccionLlegada,
          direccion_partida, ubigeo_partida, direccionLlegada, ubigeoLlegada, ciudad_llegada || null,
          parseFloat(peso_bruto_kg) || 0, parseInt(numero_bultos) || 0, observaciones || null,
          id_conductor, id_vehiculo,
        ]
      );
      const idGuia = resGuia.insertId;

            for (const it of items) {
        const pesoTotal = it.cantidad * (it.peso_unitario_kg || 0);
        await conn.query(
          `INSERT INTO detalle_guia_remision (
             id_guia, id_detalle_orden, id_detalle_compra, id_producto, cantidad, unidad_medida,
             descripcion, codigo_documento, peso_unitario_kg, peso_total_kg, codigo_bien
           ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [idGuia, it.id_detalle_compra, it.id_producto, it.cantidad, it.unidad_medida || 'NIU',
            it.descripcion || '', it.codigo_documento || null, it.peso_unitario_kg || 0, pesoTotal, it.codigo_bien]);
      }

      // ¿La compra YA ingresó su mercadería en la recepción (Total/Parcial)? Entonces la guía es
      // SOLO documento (no vuelve a sumar stock) → evita el doble conteo. Señal limpia:
      // detalle_orden_compra.cantidad_recibida > 0 (lo pone createCompra en su recepción; la guía no).
      const [[rec]] = await conn.query(
        'SELECT COALESCE(SUM(cantidad_recibida), 0) AS recibido FROM detalle_orden_compra WHERE id_orden_compra = ?',
        [id_orden_compra]);
      const yaRecibio = parseFloat(rec.recibido || 0) > 0.0001;

      // Ingreso de stock (entrada por tipo_inventario) en la MISMA transacción — solo si no se ingresó ya.
      let idsEntrada = [];
      if (!yaRecibio) {
        const docSoporte = (oc.serie_documento && oc.numero_documento)
          ? `${oc.serie_documento}-${oc.numero_documento}` : oc.numero_orden;
        idsEntrada = await ingresarStockCompra(conn, {
          idOrdenCompra: id_orden_compra, idProveedor: oc.id_proveedor, docSoporte,
          moneda: oc.moneda, tipoCambio: oc.tipo_cambio, porcentajeIgv: oc.porcentaje_impuesto,
          idRegistradoPor, observaciones: `Ingreso por guía de compra ${numeroGuia}`, items,
        });
      }

      return { id_guia: idGuia, numero_guia: numeroGuia, ids_entrada: idsEntrada, stock_ingresado: !yaRecibio };
    });

    const msg = result.stock_ingresado
      ? 'Guía de compra creada e inventario ingresado'
      : 'Guía de compra creada (el stock ya se había ingresado en la recepción de la compra; no se volvió a sumar)';
    return res.status(201).json({ success: true, data: result, message: msg });
  } catch (error) {
    console.error('Error al crear guía de compra:', error);
    return res.status(error?.status || 500).json({ success: false, error: error.message });
  }
}

// Datos del remitente (empresa) para prellenar los puntos de partida/llegada en los wizards de guía.
// En la guía de compra, la LLEGADA es tu almacén → el wizard la prellena con esto (editable).
export async function getEmpresaRemitente(req, res) {
  try {
    const r = await executeQuery('SELECT razon_social, ruc, direccion, ubigeo, urbanizacion, departamento, provincia, distrito FROM empresa_config WHERE id = 1');
    const emp = (r.success && r.data[0]) || {};
    res.json({
      success: true,
      data: {
        razon_social: emp.razon_social || null,
        ruc: emp.ruc || null,
        direccion: emp.direccion || null,
        ubigeo: emp.ubigeo || null,
        direccion_completa: armarDireccionCompleta(emp) || emp.direccion || null,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function despacharGuiaRemision(req, res) {
  try {
    const { id } = req.params;
    const { fecha_despacho } = req.body;
    const id_usuario = req.user?.id_empleado || null;
    
    // Obtener información de la guía
    const guiaResult = await executeQuery(`
      SELECT 
        gr.*,
        ov.id_cliente,
        ov.numero_orden AS numero_orden_venta,
        ov.estado AS estado_orden
      FROM guias_remision gr
      INNER JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      WHERE gr.id_guia = ?
    `, [id]);
    
    if (!guiaResult.success || guiaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía no encontrada'
      });
    }
    
    const guia = guiaResult.data[0];
    // Rótulo del despacho: preferir el comprobante SUNAT (serie-número, p.ej. TE01-6) cuando la guía
    // ya está emitida; si no, el correlativo interno (T001-…). Evita confundir el nº interno con la
    // serie SUNAT (y con un intento rechazado previo).
    const refGuia = (guia.serie_sunat && guia.numero_sunat)
      ? `${guia.serie_sunat}-${guia.numero_sunat}`
      : guia.numero_guia;

    if (guia.estado !== 'Emitida') {
      return res.status(400).json({
        success: false,
        error: `Solo se pueden despachar guías en estado Emitida. Estado actual: ${guia.estado}`
      });
    }
    
    // Obtener detalle de la guía con información completa del producto
    const detalleResult = await executeQuery(`
      SELECT
        dgr.*,
        p.id_tipo_inventario,
        p.costo_unitario_promedio,
        p.stock_actual,
        p.codigo,
        COALESCE(p.nombre, dgr.descripcion) AS producto,
        COALESCE(p.unidad_medida, dgr.unidad_medida) AS unidad_producto
      FROM detalle_guia_remision dgr
      LEFT JOIN productos p ON dgr.id_producto = p.id_producto
      WHERE dgr.id_guia = ?
      ORDER BY dgr.id_detalle
    `, [id]);
    
    if (!detalleResult.success || detalleResult.data.length === 0) {
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener detalle de la guía' 
      });
    }
    
    const detalle = detalleResult.data;
    // Los ítems de MUESTRA de texto libre (id_producto NULL) no tienen stock ni costo: no generan
    // línea de salida ni descuento de inventario. Solo los productos reales mueven stock.
    const detalleReal = detalle.filter((it) => it.id_producto != null);

    // Validar stock actual antes de despachar (solo productos reales)
    for (const item of detalleReal) {
      const stockActual = parseFloat(item.stock_actual);
      const cantidadDespachar = parseFloat(item.cantidad);

      if (stockActual < cantidadDespachar) {
        return res.status(400).json({
          success: false,
          error: `Stock insuficiente para ${item.producto} (${item.codigo}). Disponible: ${stockActual.toFixed(4)}, Requerido: ${cantidadDespachar.toFixed(4)}`
        });
      }
    }

    // Tipo de inventario del primer producto real (todos deberían ser del mismo tipo en una guía).
    const primerReal = detalleReal[0];
    const id_tipo_inventario = primerReal ? primerReal.id_tipo_inventario : 3;

    // Calcular totales (solo productos reales)
    let totalCosto = 0;
    let totalPrecio = 0;

    for (const item of detalleReal) {
      const costoUnitario = parseFloat(item.costo_unitario_promedio || 0);
      const cantidad = parseFloat(item.cantidad);

      totalCosto += cantidad * costoUnitario;
      totalPrecio += cantidad * costoUnitario;
    }

    // Crear la salida de inventario solo si hay productos reales que descontar (una muestra con
    // exclusivamente ítems libres no mueve stock). Se vincula a la OV por FK (id_orden_venta) igual
    // que "Registrar Despacho", para que aparezca en el "Historial de Despachos" de la orden y pueda
    // cruzarse con facturas por id_salida. La fecha va en hora de Lima (getFechaPeru).
    let id_salida = null;
    if (detalleReal.length > 0) {
      const salidaResult = await executeQuery(`
        INSERT INTO salidas (
          id_tipo_inventario,
          tipo_movimiento,
          id_cliente,
          id_orden_venta,
          id_guia_remision,
          total_costo,
          total_precio,
          moneda,
          id_registrado_por,
          observaciones,
          estado,
          fecha_movimiento
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id_tipo_inventario,
        'Venta',
        guia.id_cliente,
        guia.id_orden_venta,
        id,
        totalCosto,
        totalPrecio,
        'PEN',
        id_usuario,
        `Despacho Guía ${refGuia} - Orden ${guia.numero_orden_venta}`,
        'Activo',
        fecha_despacho || getFechaPeru()
      ]);

      if (!salidaResult.success) {
        return res.status(500).json({
          success: false,
          error: `Error al crear salida: ${salidaResult.error}`
        });
      }

      id_salida = salidaResult.data.insertId;

      // Línea de salida + descuento de stock por cada producto real
      for (const item of detalleReal) {
        const costoUnitario = parseFloat(item.costo_unitario_promedio || 0);
        const cantidad = parseFloat(item.cantidad);

        const detalleSalidaResult = await executeQuery(`
          INSERT INTO detalle_salidas (
            id_salida,
            id_producto,
            cantidad,
            costo_unitario,
            precio_unitario
          ) VALUES (?, ?, ?, ?, ?)
        `, [id_salida, item.id_producto, cantidad, costoUnitario, costoUnitario]);

        if (!detalleSalidaResult.success) {
          return res.status(500).json({
            success: false,
            error: `Error al crear detalle de salida para ${item.producto}: ${detalleSalidaResult.error}`
          });
        }

        const updateStockResult = await executeQuery(`
          UPDATE productos
          SET stock_actual = stock_actual - ?
          WHERE id_producto = ?
        `, [cantidad, item.id_producto]);

        if (!updateStockResult.success) {
          return res.status(500).json({
            success: false,
            error: `Error al actualizar stock de ${item.producto}: ${updateStockResult.error}`
          });
        }
      }
    }

    // Actualizar cantidad despachada en la orden para TODAS las líneas (reales y libres), para que
    // el estado de la OV pueda llegar a 'Despachada' aunque haya ítems de muestra sin stock.
    for (const item of detalle) {
      const cantidad = parseFloat(item.cantidad);
      const updateOrdenResult = await executeQuery(`
        UPDATE detalle_orden_venta
        SET cantidad_despachada = cantidad_despachada + ?
        WHERE id_detalle = ?
      `, [cantidad, item.id_detalle_orden]);

      if (!updateOrdenResult.success) {
        return res.status(500).json({
          success: false,
          error: `Error al actualizar orden para ${item.producto}: ${updateOrdenResult.error}`
        });
      }
    }
    
    // Actualizar estado de la guía
    await executeQuery(`
      UPDATE guias_remision
      SET estado = 'En Tránsito'
      WHERE id_guia = ?
    `, [id]);
    
    // Estado de la orden según lo despachado en TODAS sus líneas: 'Despachada' solo si cada línea
    // está completa; si aún queda saldo (entrega parcial con varias guías), 'Despacho Parcial'.
    // Antes se forzaba 'Despachada' siempre, lo que marcaba mal la OV al despachar una guía parcial.
    const resumenDespachoResult = await executeQuery(`
      SELECT COUNT(*) AS total_items,
             SUM(CASE WHEN cantidad_despachada >= cantidad THEN 1 ELSE 0 END) AS items_completos
      FROM detalle_orden_venta WHERE id_orden_venta = ?
    `, [guia.id_orden_venta]);
    const resDesp = resumenDespachoResult.data?.[0] || {};
    const estadoOrdenDespacho = (Number(resDesp.total_items) > 0 && Number(resDesp.items_completos) >= Number(resDesp.total_items))
      ? 'Despachada'
      : 'Despacho Parcial';
    // Apunta al último despacho (id_salida) para el cruce factura↔despacho y el historial.
    await executeQuery(`
      UPDATE ordenes_venta
      SET estado = ?, id_salida = ?
      WHERE id_orden_venta = ?
    `, [estadoOrdenDespacho, id_salida, guia.id_orden_venta]);
    
    res.json({
      success: true,
      message: `Guía despachada exitosamente. Salida ID: ${id_salida}`,
      data: {
        id_salida,
        productos_despachados: detalle.length,
        total_costo: totalCosto.toFixed(2)
      }
    });
    
  } catch (error) {
    console.error('Error al despachar guía:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function marcarEntregadaGuiaRemision(req, res) {
  try {
    const { id } = req.params;
    const { fecha_entrega } = req.body;
    
    const guiaResult = await executeQuery(`
      SELECT estado, id_orden_venta
      FROM guias_remision
      WHERE id_guia = ?
    `, [id]);
    
    if (!guiaResult.success || guiaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía no encontrada'
      });
    }
    
    const guia = guiaResult.data[0];
    
    if (guia.estado !== 'En Tránsito') {
      return res.status(400).json({
        success: false,
        error: `Solo se pueden marcar como entregadas las guías En Tránsito. Estado actual: ${guia.estado}`
      });
    }
    
    await executeQuery(`
      UPDATE guias_remision
      SET estado = 'Entregada'
      WHERE id_guia = ?
    `, [id]);
    
    // Verificar si todas las guías de la orden están entregadas
    if (guia.id_orden_venta) {
      const pendientesResult = await executeQuery(`
        SELECT COUNT(*) as pendientes
        FROM guias_remision
        WHERE id_orden_venta = ? AND estado NOT IN ('Entregada', 'Anulada')
      `, [guia.id_orden_venta]);
      
      if (pendientesResult.success && pendientesResult.data[0].pendientes === 0) {
        await executeQuery(`
          UPDATE ordenes_venta
          SET estado = 'Entregada',
              fecha_entrega_real = ?
          WHERE id_orden_venta = ?
        `, [fecha_entrega || new Date().toISOString().split('T')[0], guia.id_orden_venta]);
      }
    }
    
    res.json({
      success: true,
      message: 'Guía marcada como entregada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al marcar entregada:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function actualizarEstadoGuiaRemision(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    const estadosValidos = ['Emitida', 'En Tránsito', 'Entregada', 'Anulada'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }
    
    const guiaResult = await executeQuery(`
      SELECT estado, sunat_estado, baja_sunat_confirmada, id_orden_venta
      FROM guias_remision WHERE id_guia = ?
    `, [id]);
    
    if (!guiaResult.success || guiaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía no encontrada'
      });
    }
    
    const guiaActual = guiaResult.data[0];
    const estadoActual = guiaActual.estado;

    // Una GRE aceptada no puede desaparecer mediante el cambio de estado local. Su baja oficial
    // se realiza en SOL y se confirma desde el panel SUNAT, que además escribe la auditoría.
    if (estado === 'Anulada' && guiaActual.sunat_estado === 'ACEPTADO') {
      return res.status(422).json({
        success: false,
        error: 'Esta GRE fue aceptada por SUNAT. Realiza primero la baja en SUNAT SOL y luego usa “Baja SUNAT” para sincronizarla en SPI.'
      });
    }

    if (estado === estadoActual) {
      return res.json({ success: true, message: `La guía ya se encuentra en estado ${estado}` });
    }

    // Una baja SUNAT confirmada es final: el endpoint genérico no puede volver a activar la guía.
    if (Number(guiaActual.baja_sunat_confirmada) === 1 && estado !== 'Anulada') {
      return res.status(409).json({
        success: false,
        error: 'La guía tiene una baja SUNAT confirmada y no puede reactivarse.'
      });
    }
    
    if (estado === 'Anulada' && (estadoActual === 'En Tránsito' || estadoActual === 'Entregada')) {
      return res.status(400).json({
        success: false,
        error: 'No se puede anular una guía que ya fue despachada o entregada'
      });
    }
    
    if (estado === 'Anulada') {
      const idUsuario = req.user?.id_empleado || null;
      const fecha = getFechaPeru();
      const result = await executeTransaction([
        {
          sql: `UPDATE guias_remision
                   SET estado = 'Anulada', motivo_anulacion = COALESCE(motivo_anulacion, ?),
                       anulado_por = COALESCE(anulado_por, ?), fecha_anulacion = COALESCE(fecha_anulacion, ?)
                 WHERE id_guia = ?`,
          params: ['Anulación local de guía no aceptada por SUNAT', idUsuario, fecha, id]
        },
        {
          sql: `INSERT INTO guias_remision_historial
                  (id_guia, id_orden_venta, evento, estado_anterior, estado_nuevo,
                   motivo, origen, id_usuario, evidencia_url, fecha)
                VALUES (?, ?, 'ANULACION_LOCAL', ?, 'Anulada', ?, 'SPI', ?, NULL, ?)`,
          params: [id, guiaActual.id_orden_venta || null,
            guiaActual.sunat_estado || estadoActual,
            'Anulación local de guía no aceptada por SUNAT', idUsuario, fecha]
        }
      ]);
      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error });
      }
    } else {
      await executeQuery(`
        UPDATE guias_remision
        SET estado = ?
        WHERE id_guia = ?
      `, [estado, id]);
    }
    
    res.json({
      success: true,
      message: 'Estado actualizado exitosamente'
    });
    
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getEstadisticasGuiasRemision(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_guias,
        SUM(CASE WHEN estado = 'Emitida' THEN 1 ELSE 0 END) AS emitidas,
        SUM(CASE WHEN estado = 'En Tránsito' THEN 1 ELSE 0 END) AS en_transito,
        SUM(CASE WHEN estado = 'Entregada' THEN 1 ELSE 0 END) AS entregadas,
        SUM(CASE WHEN estado = 'Anulada' THEN 1 ELSE 0 END) AS anuladas,
        SUM(peso_bruto_kg) AS peso_total,
        SUM(numero_bultos) AS bultos_total,
        COUNT(DISTINCT id_orden_venta) AS ordenes_relacionadas
      FROM guias_remision
    `);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
    
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function descargarPDFGuiaRemision(req, res) {
  try {
    const { id } = req.params;
    
    const guiaResult = await executeQuery(`
      SELECT 
        gr.*,
        ov.numero_orden,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente
      FROM guias_remision gr
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON gr.id_cliente = cl.id_cliente
      WHERE gr.id_guia = ?
    `, [id]);
    
    if (!guiaResult.success || guiaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía no encontrada'
      });
    }
    
    const guia = guiaResult.data[0];
    
    const detalleResult = await executeQuery(`
      SELECT
        dgr.*,
        p.codigo AS codigo_producto,
        COALESCE(p.nombre, dgr.descripcion) AS producto
      FROM detalle_guia_remision dgr
      LEFT JOIN productos p ON dgr.id_producto = p.id_producto
      WHERE dgr.id_guia = ?
      ORDER BY dgr.id_detalle
    `, [id]);
    
    guia.detalle = detalleResult.data;
    if (guia.tipo_origen === 'Compra') {
      guia.detalle = guia.detalle.map((item) => ({
        ...item,
        codigo_producto_interno: item.codigo_producto,
        producto_interno: item.producto,
        codigo_producto: item.codigo_documento || item.codigo_producto,
        producto: item.descripcion || item.producto,
      }));
    }
    
    res.json({
      success: true,
      data: guia,
      message: 'Generar PDF con estos datos'
    });
    
  } catch (error) {
    console.error('Error al descargar PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ── Maestro de transportistas (terceros para GRE en transporte público) ──────
// Reutilizable: se registra una vez cada transportista y se elige por su id en la guía.
// El nº de registro MTC se guarda solo como referencia interna (SUNAT no lo exige en la
// GRE del remitente en modalidad pública: solo RUC + razón social viajan en el XML).

export async function getTransportistas(req, res) {
  try {
    const result = await executeQuery(`
      SELECT id_transportista, ruc, razon_social, numero_mtc
      FROM transportistas
      WHERE activo = 1
      ORDER BY razon_social
    `);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error al obtener transportistas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createTransportista(req, res) {
  try {
    const { ruc, razon_social, numero_mtc } = req.body;

    if (!ruc || !/^\d{11}$/.test(String(ruc).trim())) {
      return res.status(400).json({
        success: false,
        error: 'El RUC del transportista es obligatorio y debe tener 11 dígitos'
      });
    }

    if (!razon_social || razon_social.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'La razón social del transportista es obligatoria'
      });
    }

    const rucLimpio = String(ruc).trim();

    // Idempotente por RUC (ver upsertTransportista): si ya existe se actualiza en vez de
    // fallar por el UNIQUE. Así el alta rápida nunca se rompe al reingresar un RUC ya registrado.
    const idT = await upsertTransportista(rucLimpio, razon_social, numero_mtc);
    if (!idT) {
      return res.status(500).json({ success: false, error: 'No se pudo registrar el transportista' });
    }

    res.status(201).json({
      success: true,
      data: { id_transportista: idT, ruc: rucLimpio, razon_social: razon_social.trim(), numero_mtc: numero_mtc?.trim() || null },
      message: 'Transportista registrado exitosamente'
    });
  } catch (error) {
    console.error('Error al crear transportista:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── Catálogo de destinatarios comex (operadores de puerto / depósito temporal) ──────────────
// El destinatario de una GRE de exportación NO es el cliente extranjero de la OV (ese va en la
// factura), sino el operador local de puerto/depósito. codigo_establecimiento = anexo del
// destinatario que va en DeliveryAddress/AddressTypeCode (ver gre-comex-spec).
export async function getDestinatariosComex(req, res) {
  try {
    const result = await executeQuery(`
      SELECT id_destinatario, ruc, razon_social, codigo_establecimiento
      FROM comex_destinatarios
      WHERE activo = 1
      ORDER BY razon_social
    `);
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error al obtener destinatarios comex:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createDestinatarioComex(req, res) {
  try {
    const { ruc, razon_social, codigo_establecimiento } = req.body;
    if (!ruc || !/^\d{11}$/.test(String(ruc).trim())) {
      return res.status(400).json({ success: false, error: 'El RUC del destinatario es obligatorio y debe tener 11 dígitos' });
    }
    if (!razon_social || razon_social.trim() === '') {
      return res.status(400).json({ success: false, error: 'La razón social del destinatario es obligatoria' });
    }
    const rucLimpio = String(ruc).trim();
    const estab = String(codigo_establecimiento ?? '0').trim() || '0';
    // Idempotente por RUC: si ya existe se actualiza (mismo criterio que transportistas).
    const result = await executeQuery(
      `INSERT INTO comex_destinatarios (ruc, razon_social, codigo_establecimiento)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE razon_social = VALUES(razon_social),
         codigo_establecimiento = VALUES(codigo_establecimiento), activo = 1`,
      [rucLimpio, razon_social.trim(), estab]);
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    res.status(201).json({
      success: true,
      data: { ruc: rucLimpio, razon_social: razon_social.trim(), codigo_establecimiento: estab },
      message: 'Destinatario comex registrado exitosamente'
    });
  } catch (error) {
    console.error('Error al crear destinatario comex:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
