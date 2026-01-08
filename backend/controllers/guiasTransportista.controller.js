import { executeQuery } from '../config/database.js';

export async function getAllGuiasTransportista(req, res) {
  try {
    const { estado, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        gt.id_guia_transportista,
        gt.numero_guia,
        gt.fecha_emision,
        gt.fecha_inicio_traslado,
        gt.estado,
        gt.razon_social_transportista,
        gt.ruc_transportista,
        gt.nombre_conductor,
        gt.licencia_conducir,
        gt.placa_vehiculo,
        gt.marca_vehiculo,
        gt.punto_llegada,
        gr.numero_guia AS numero_guia_remision,
        gr.id_guia,
        gr.ciudad_llegada,
        gr.peso_bruto_kg,
        ov.numero_orden,
        ov.id_orden_venta,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente
      FROM guias_transportista gt
      INNER JOIN guias_remision gr ON gt.id_guia_remision = gr.id_guia
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      sql += ` AND gt.estado = ?`;
      params.push(estado);
    }
    
    if (fecha_inicio) {
      sql += ` AND DATE(gt.fecha_emision) >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND DATE(gt.fecha_emision) <= ?`;
      params.push(fecha_fin);
    }
    
    sql += ` ORDER BY gt.fecha_creacion DESC`;
    
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
    console.error('Error al obtener guías de transportista:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getGuiaTransportistaById(req, res) {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(`
      SELECT 
        gt.*,
        gr.numero_guia AS numero_guia_remision,
        gr.id_guia,
        gr.direccion_partida,
        gr.ubigeo_partida,
        gr.direccion_llegada,
        gr.ubigeo_llegada,
        gr.ciudad_llegada,
        gr.peso_bruto_kg,
        gr.numero_bultos,
        gr.tipo_traslado,
        gr.motivo_traslado,
        ov.numero_orden,
        ov.id_orden_venta,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente
      FROM guias_transportista gt
      INNER JOIN guias_remision gr ON gt.id_guia_remision = gr.id_guia
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      WHERE gt.id_guia_transportista = ?
    `, [id]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    if (result.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía de transportista no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
    
  } catch (error) {
    console.error('Error al obtener guía de transportista:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function createGuiaTransportista(req, res) {
  try {
    const {
      id_guia_remision,
      fecha_emision,
      razon_social_transportista,
      ruc_transportista,
      nombre_conductor,
      licencia_conducir,
      dni_conductor,
      telefono_conductor,
      placa_vehiculo,
      marca_vehiculo,
      modelo_vehiculo,
      certificado_habilitacion,
      punto_partida,
      punto_llegada,
      fecha_inicio_traslado,
      fecha_estimada_llegada,
      observaciones
    } = req.body;
    
    const id_creado_por = req.user?.id_empleado || null;
    
    if (!id_guia_remision) {
      return res.status(400).json({
        success: false,
        error: 'La guía de remisión es obligatoria'
      });
    }
    
    if (!razon_social_transportista || !ruc_transportista) {
      return res.status(400).json({
        success: false,
        error: 'Los datos del transportista (razón social y RUC) son obligatorios'
      });
    }
    
    if (ruc_transportista.length !== 11) {
      return res.status(400).json({
        success: false,
        error: 'El RUC debe tener 11 dígitos'
      });
    }
    
    if (!nombre_conductor || !licencia_conducir) {
      return res.status(400).json({
        success: false,
        error: 'Los datos del conductor (nombre y licencia) son obligatorios'
      });
    }
    
    if (!placa_vehiculo) {
      return res.status(400).json({
        success: false,
        error: 'La placa del vehículo es obligatoria'
      });
    }
    
    if (!punto_partida || !punto_llegada) {
      return res.status(400).json({
        success: false,
        error: 'Los puntos de partida y llegada son obligatorios'
      });
    }
    
    const guiaRemisionResult = await executeQuery(`
      SELECT 
        gr.id_guia,
        gr.estado,
        gr.direccion_partida,
        gr.direccion_llegada
      FROM guias_remision gr
      WHERE gr.id_guia = ?
    `, [id_guia_remision]);
    
    if (!guiaRemisionResult.success || guiaRemisionResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía de remisión no encontrada'
      });
    }
    
    const guiaRemision = guiaRemisionResult.data[0];
    
    if (guiaRemision.estado !== 'En Tránsito') {
      return res.status(400).json({
        success: false,
        error: `Solo se pueden crear guías de transportista para guías en estado "En Tránsito". Estado actual: ${guiaRemision.estado}`
      });
    }
    
    const guiaExistenteResult = await executeQuery(`
      SELECT id_guia_transportista 
      FROM guias_transportista 
      WHERE id_guia_remision = ?
    `, [id_guia_remision]);
    
    if (guiaExistenteResult.success && guiaExistenteResult.data.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Esta guía de remisión ya tiene una guía de transportista asociada'
      });
    }
    
    const ultimaResult = await executeQuery(`
      SELECT numero_guia 
      FROM guias_transportista 
      ORDER BY id_guia_transportista DESC 
      LIMIT 1
    `);
    
    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_guia.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const numeroGuia = `GT-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;
    
    const result = await executeQuery(`
      INSERT INTO guias_transportista (
        numero_guia,
        id_guia_remision,
        fecha_emision,
        razon_social_transportista,
        ruc_transportista,
        nombre_conductor,
        licencia_conducir,
        dni_conductor,
        telefono_conductor,
        placa_vehiculo,
        marca_vehiculo,
        modelo_vehiculo,
        certificado_habilitacion,
        punto_partida,
        punto_llegada,
        fecha_inicio_traslado,
        fecha_estimada_llegada,
        observaciones,
        id_creado_por,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
    `, [
      numeroGuia,
      id_guia_remision,
      fecha_emision || new Date().toISOString().split('T')[0],
      razon_social_transportista,
      ruc_transportista,
      nombre_conductor,
      licencia_conducir,
      dni_conductor || null,
      telefono_conductor || null,
      placa_vehiculo.toUpperCase(),
      marca_vehiculo || null,
      modelo_vehiculo || null,
      certificado_habilitacion || null,
      punto_partida,
      punto_llegada,
      fecha_inicio_traslado || new Date().toISOString().split('T')[0],
      fecha_estimada_llegada || null,
      observaciones || null,
      id_creado_por
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.status(201).json({
      success: true,
      data: {
        id_guia_transportista: result.data.insertId,
        numero_guia: numeroGuia
      },
      message: 'Guía de transportista creada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al crear guía de transportista:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function actualizarEstadoGuiaTransportista(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    const estadosValidos = ['Pendiente', 'En Tránsito', 'Entregada', 'Cancelada'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }
    
    const guiaResult = await executeQuery(`
      SELECT estado FROM guias_transportista WHERE id_guia_transportista = ?
    `, [id]);
    
    if (!guiaResult.success || guiaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía de transportista no encontrada'
      });
    }
    
    const estadoActual = guiaResult.data[0].estado;
    
    if (estado === 'Cancelada' && (estadoActual === 'En Tránsito' || estadoActual === 'Entregada')) {
      return res.status(400).json({
        success: false,
        error: 'No se puede cancelar una guía que ya está en tránsito o entregada'
      });
    }
    
    const result = await executeQuery(`
      UPDATE guias_transportista
      SET estado = ?
      WHERE id_guia_transportista = ?
    `, [estado, id]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
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

export async function getTransportistasFrecuentes(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        razon_social_transportista,
        ruc_transportista,
        COUNT(*) AS total_guias,
        MAX(fecha_creacion) AS ultimo_uso
      FROM guias_transportista
      GROUP BY razon_social_transportista, ruc_transportista
      ORDER BY total_guias DESC, ultimo_uso DESC
      LIMIT 10
    `);
    
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
    console.error('Error al obtener transportistas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getConductoresFrecuentes(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        nombre_conductor,
        licencia_conducir,
        dni_conductor,
        telefono_conductor,
        COUNT(*) AS total_viajes,
        MAX(fecha_creacion) AS ultimo_uso
      FROM guias_transportista
      WHERE nombre_conductor IS NOT NULL
      GROUP BY nombre_conductor, licencia_conducir, dni_conductor, telefono_conductor
      ORDER BY total_viajes DESC, ultimo_uso DESC
      LIMIT 15
    `);
    
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
    console.error('Error al obtener conductores:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getVehiculosFrecuentes(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        placa_vehiculo,
        marca_vehiculo,
        modelo_vehiculo,
        certificado_habilitacion,
        COUNT(*) AS total_viajes,
        MAX(fecha_creacion) AS ultimo_uso
      FROM guias_transportista
      WHERE placa_vehiculo IS NOT NULL
      GROUP BY placa_vehiculo, marca_vehiculo, modelo_vehiculo, certificado_habilitacion
      ORDER BY total_viajes DESC, ultimo_uso DESC
      LIMIT 15
    `);
    
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
    console.error('Error al obtener vehículos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getEstadisticasGuiasTransportista(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_guias,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'En Tránsito' THEN 1 ELSE 0 END) AS en_transito,
        SUM(CASE WHEN estado = 'Entregada' THEN 1 ELSE 0 END) AS entregadas,
        SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        COUNT(DISTINCT razon_social_transportista) AS transportistas_unicos,
        COUNT(DISTINCT nombre_conductor) AS conductores_unicos,
        COUNT(DISTINCT placa_vehiculo) AS vehiculos_unicos
      FROM guias_transportista
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

export async function descargarPDFGuiaTransportista(req, res) {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(`
      SELECT 
        gt.*,
        gr.numero_guia AS numero_guia_remision,
        gr.direccion_partida,
        gr.ubigeo_partida,
        gr.direccion_llegada,
        gr.ubigeo_llegada,
        gr.ciudad_llegada,
        gr.peso_bruto_kg,
        gr.numero_bultos,
        gr.tipo_traslado,
        gr.motivo_traslado,
        ov.numero_orden,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente
      FROM guias_transportista gt
      INNER JOIN guias_remision gr ON gt.id_guia_remision = gr.id_guia
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      WHERE gt.id_guia_transportista = ?
    `, [id]);
    
    if (!result.success || result.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: result.data[0],
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