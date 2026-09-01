import { executeQuery } from '../config/database.js';
import { obtenerCorrelativoAtomico } from '../services/sunat/numeracion.service.js';
import { componerObservacion } from '../services/sunat/util.service.js';

// Fecha en zona horaria de Lima (evita el desfase +5h del pool vs. la sesión UTC de Railway
// al escribir TIMESTAMP/DATETIME). Espeja el helper homónimo de ordenesVenta.controller.js.
function getFechaPeru() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
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
        ov.numero_orden,
        ov.id_orden_venta,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        (SELECT COUNT(*) FROM detalle_guia_remision WHERE id_guia = gr.id_guia) AS total_items
      FROM guias_remision gr
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON gr.id_cliente = cl.id_cliente
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
      data: result.data
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
        tr.numero_mtc AS transportista_mtc
      FROM guias_remision gr
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON gr.id_cliente = cl.id_cliente
      LEFT JOIN empleados emp ON gr.id_conductor = emp.id_empleado
      LEFT JOIN flota fl ON gr.id_vehiculo = fl.id_vehiculo
      LEFT JOIN transportistas tr ON gr.id_transportista = tr.id_transportista
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
    // Observación sugerida para el panel de emisión: prellenado editable = texto libre + OC de la OV.
    // Lo que el usuario deje en ese campo es lo que viaja a SUNAT como cbc:Note.
    guia.observacion_sugerida = componerObservacion(guia.observaciones, guia.orden_compra_cliente);

    const detalleResult = await executeQuery(`
      SELECT
        dgr.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.stock_actual,
        p.id_tipo_inventario,
        ti.nombre AS tipo_inventario
      FROM detalle_guia_remision dgr
      INNER JOIN productos p ON dgr.id_producto = p.id_producto
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
      detalle
    } = req.body;

    // Catálogo 20 (SUNAT): derivar el código de motivo desde el motivo de negocio si no viene explícito.
    // Requerido para emitir la GRE electrónica (gre-emision valida motivo_traslado_cod).
    const MOTIVO_TRASLADO_COD = {
      'Venta': '01',
      'Traslado entre Almacenes': '04',
      'Devolución': '13' // 13 = Otros
    };
    const motivoCod = motivo_traslado_cod || MOTIVO_TRASLADO_COD[motivo_traslado] || '01';
    
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

    // Ubigeo de llegada: 6 dígitos INEI (catálogo 13). SUNAT lo exige en la GRE; se valida aquí
    // para no crear una guía que luego reviente al emitir (gre-emision valida lo mismo).
    if (!/^\d{6}$/.test(String(ubigeo_llegada || ''))) {
      return res.status(400).json({
        success: false,
        error: 'El ubigeo de llegada es obligatorio (6 dígitos: Departamento, Provincia y Distrito)'
      });
    }

    // Obtener información de la orden (incluye el transporte asignado a nivel de OV
    // para que la guía lo herede si el request no envía conductor/vehículo).
    const ordenResult = await executeQuery(`
      SELECT
        ov.id_cliente,
        ov.estado,
        ov.direccion_entrega,
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

    // Una guía de remisión es un documento de despacho: se permite en cualquier
    // estado activo de la OV, bloqueando solo las órdenes canceladas o ya entregadas
    // (mismo criterio que registrarDespacho en ordenesVenta.controller.js).
    if (orden.estado === 'Cancelada' || orden.estado === 'Entregada') {
      return res.status(400).json({
        success: false,
        error: `No se pueden crear guías para órdenes en estado "${orden.estado}".`
      });
    }

    // Regla: una GRE activa por orden. Una guía cubre el despacho de la orden, así que
    // no se permite crear otra mientras exista una guía vigente (no anulada). Esto evita
    // duplicados accidentales al volver a entrar a la orden y, en PROD (Fase 16), impide
    // emitir dos GRE reales para el mismo despacho. Para rehacerla, anule la existente.
    const guiaExistenteResult = await executeQuery(
      `SELECT id_guia, numero_guia, estado FROM guias_remision
       WHERE id_orden_venta = ? AND estado <> 'Anulada'
       ORDER BY id_guia DESC LIMIT 1`,
      [id_orden_venta]
    );
    if (guiaExistenteResult.success && guiaExistenteResult.data.length > 0) {
      const g = guiaExistenteResult.data[0];
      return res.status(409).json({
        success: false,
        error: `Esta orden ya tiene una guía de remisión (${g.numero_guia}, estado "${g.estado}"). Anúlela antes de crear otra.`,
        id_guia_existente: g.id_guia
      });
    }

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

    // Punto de partida por defecto = dirección fiscal de la empresa (empresa_config). El origen
    // real de un traslado por venta es el domicilio fiscal; si el request llega sin dirección/ubigeo
    // de partida se toman los fiscales (antes quedaba vacío o con el literal 'Almacén Central').
    const empresaResult = await executeQuery('SELECT direccion, ubigeo FROM empresa_config WHERE id = 1');
    const empresaCfg = (empresaResult.success && empresaResult.data[0]) || {};
    const direccionPartidaFinal = (direccion_partida && String(direccion_partida).trim())
      || empresaCfg.direccion || 'Almacén Central';
    const ubigeoPartidaFinal = (ubigeo_partida && String(ubigeo_partida).trim())
      || empresaCfg.ubigeo || null;
    
    // Validar cada producto del detalle
    for (const item of detalle) {
      // Validar detalle de orden
      const detalleOrdenResult = await executeQuery(`
        SELECT 
          dov.cantidad,
          dov.cantidad_despachada,
          p.id_producto,
          p.codigo,
          p.nombre,
          p.stock_actual,
          p.id_tipo_inventario
        FROM detalle_orden_venta dov
        INNER JOIN productos p ON dov.id_producto = p.id_producto
        WHERE dov.id_detalle = ?
      `, [item.id_detalle_orden]);
      
      if (!detalleOrdenResult.success || detalleOrdenResult.data.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Detalle de orden inválido'
        });
      }
      
      const detalleOrden = detalleOrdenResult.data[0];
      const cantidadOrden = parseFloat(detalleOrden.cantidad);
      const cantidadDespachada = parseFloat(detalleOrden.cantidad_despachada || 0);
      const cantidadDisponibleOrden = cantidadOrden - cantidadDespachada;
      const cantidadSolicitada = parseFloat(item.cantidad);
      const stockActual = parseFloat(detalleOrden.stock_actual);
      
      // Validar que no exceda lo pendiente de la orden
      if (cantidadSolicitada > cantidadDisponibleOrden) {
        return res.status(400).json({
          success: false,
          error: `${detalleOrden.nombre} (${detalleOrden.codigo}): Cantidad a despachar (${cantidadSolicitada}) excede lo pendiente en la orden (${cantidadDisponibleOrden.toFixed(4)})`
        });
      }
      
      // Validar stock disponible
      if (cantidadSolicitada > stockActual) {
        return res.status(400).json({
          success: false,
          error: `${detalleOrden.nombre} (${detalleOrden.codigo}): Stock insuficiente. Disponible: ${stockActual.toFixed(4)}, Requerido: ${cantidadSolicitada.toFixed(4)}`
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
        transporte_modo,
        transporte_placa,
        transporte_conductor,
        transporte_dni,
        transporte_licencia,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Emitida')
    `, [
      numeroGuia,
      id_orden_venta,
      orden.id_cliente,
      fecha_emision || new Date().toISOString().split('T')[0],
      fecha_traslado || new Date().toISOString().split('T')[0],
      direccionPartidaFinal,
      direccion_llegada,
      tipo_traslado || 'Privado',
      motivo_traslado || 'Venta',
      modalidad_transporte || 'Transporte Privado',
      direccionPartidaFinal,
      ubigeoPartidaFinal,
      direccion_llegada,
      ubigeo_llegada,
      ciudad_llegada,
      parseFloat(peso_bruto_kg) || 0,
      parseInt(numero_bultos) || 0,
      observaciones,
      idConductorFinal,
      idVehiculoFinal,
      idTransportistaFinal,
      motivoCod,
      modoGuia,
      guiaTransportePlaca,
      guiaTransporteConductor,
      guiaTransporteDni,
      guiaTransporteLicencia
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
          peso_total_kg
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        idGuia,
        item.id_detalle_orden,
        item.id_producto,
        parseFloat(item.cantidad),
        item.unidad_medida || 'UND',
        item.descripcion || item.producto || '',
        parseFloat(item.peso_unitario_kg) || 0,
        pesoTotal
      ]);
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
        p.nombre AS producto,
        p.unidad_medida AS unidad_producto
      FROM detalle_guia_remision dgr
      INNER JOIN productos p ON dgr.id_producto = p.id_producto
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
    
    // Validar stock actual antes de despachar
    for (const item of detalle) {
      const stockActual = parseFloat(item.stock_actual);
      const cantidadDespachar = parseFloat(item.cantidad);
      
      if (stockActual < cantidadDespachar) {
        return res.status(400).json({
          success: false,
          error: `Stock insuficiente para ${item.producto} (${item.codigo}). Disponible: ${stockActual.toFixed(4)}, Requerido: ${cantidadDespachar.toFixed(4)}`
        });
      }
    }
    
    // Usar el tipo de inventario del primer producto (todos deberían ser del mismo tipo en una guía)
    const id_tipo_inventario = detalle[0].id_tipo_inventario;
    
    // Calcular totales
    let totalCosto = 0;
    let totalPrecio = 0;
    
    for (const item of detalle) {
      const costoUnitario = parseFloat(item.costo_unitario_promedio || 0);
      const cantidad = parseFloat(item.cantidad);
      
      totalCosto += cantidad * costoUnitario;
      totalPrecio += cantidad * costoUnitario;
    }
    
    // Crear la salida de inventario. Se vincula a la OV por FK (id_orden_venta) igual que
    // "Registrar Despacho", para que aparezca en el "Historial de Despachos" de la orden y
    // pueda cruzarse con facturas por id_salida. La fecha va en hora de Lima (getFechaPeru).
    const salidaResult = await executeQuery(`
      INSERT INTO salidas (
        id_tipo_inventario,
        tipo_movimiento,
        id_cliente,
        id_orden_venta,
        total_costo,
        total_precio,
        moneda,
        id_registrado_por,
        observaciones,
        estado,
        fecha_movimiento
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id_tipo_inventario,
      'Venta',
      guia.id_cliente,
      guia.id_orden_venta,
      totalCosto,
      totalPrecio,
      'PEN',
      id_usuario,
      `Despacho Guía ${guia.numero_guia} - Orden ${guia.id_orden_venta}`,
      'Activo',
      fecha_despacho || getFechaPeru()
    ]);
    
    if (!salidaResult.success) {
      return res.status(500).json({
        success: false,
        error: `Error al crear salida: ${salidaResult.error}`
      });
    }
    
    const id_salida = salidaResult.data.insertId;
    
    // Procesar cada producto
    for (const item of detalle) {
      const costoUnitario = parseFloat(item.costo_unitario_promedio || 0);
      const cantidad = parseFloat(item.cantidad);
      
      // Insertar detalle de salida
      const detalleSalidaResult = await executeQuery(`
        INSERT INTO detalle_salidas (
          id_salida,
          id_producto,
          cantidad,
          costo_unitario,
          precio_unitario
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        id_salida,
        item.id_producto,
        cantidad,
        costoUnitario,
        costoUnitario
      ]);
      
      if (!detalleSalidaResult.success) {
        return res.status(500).json({
          success: false,
          error: `Error al crear detalle de salida para ${item.producto}: ${detalleSalidaResult.error}`
        });
      }
      
      // Actualizar stock del producto
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
      
      // Actualizar cantidad despachada en la orden
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
    
    // Actualizar estado de la orden y apuntar al último despacho (id_salida), igual que
    // "Registrar Despacho", para que el cruce factura↔despacho y el historial funcionen.
    await executeQuery(`
      UPDATE ordenes_venta
      SET estado = 'Despachada', id_salida = ?
      WHERE id_orden_venta = ?
    `, [id_salida, guia.id_orden_venta]);
    
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
      SELECT estado FROM guias_remision WHERE id_guia = ?
    `, [id]);
    
    if (!guiaResult.success || guiaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía no encontrada'
      });
    }
    
    const estadoActual = guiaResult.data[0].estado;
    
    if (estado === 'Anulada' && (estadoActual === 'En Tránsito' || estadoActual === 'Entregada')) {
      return res.status(400).json({
        success: false,
        error: 'No se puede anular una guía que ya fue despachada o entregada'
      });
    }
    
    await executeQuery(`
      UPDATE guias_remision
      SET estado = ?
      WHERE id_guia = ?
    `, [estado, id]);
    
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
        p.nombre AS producto
      FROM detalle_guia_remision dgr
      INNER JOIN productos p ON dgr.id_producto = p.id_producto
      WHERE dgr.id_guia = ?
      ORDER BY dgr.id_detalle
    `, [id]);
    
    guia.detalle = detalleResult.data;
    
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