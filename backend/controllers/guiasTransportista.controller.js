// =====================================================
// backend/controllers/guiasTransportista.controller.js
// =====================================================

import { executeQuery, executeTransaction } from '../config/database.js';

// =====================================================
// LISTAR GUÍAS DE TRANSPORTISTA
// =====================================================
export async function getAllGuiasTransportista(req, res) {
  try {
    const { estado, fecha_inicio, fecha_fin, ruc_transportista } = req.query;
    
    let sql = `
      SELECT 
        gt.id_guia_transportista,
        gt.numero_guia,
        gt.fecha_emision,
        gt.estado,
        gt.razon_social_transportista,
        gt.ruc_transportista,
        gt.nombre_conductor,
        gt.licencia_conducir,
        gt.placa_vehiculo,
        gt.marca_vehiculo,
        gr.numero_guia AS numero_guia_remision,
        gr.id_guia_remision,
        ov.numero_orden,
        ov.id_orden_venta,
        cli.razon_social AS cliente,
        cli.ruc AS ruc_cliente,
        gr.direccion_llegada,
        gr.ciudad_llegada,
        gr.peso_bruto_kg
      FROM guias_transportista gt
      INNER JOIN guias_remision gr ON gt.id_guia_remision = gr.id_guia_remision
      INNER JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      INNER JOIN clientes cli ON gr.id_cliente = cli.id_cliente
      WHERE 1=1
    `;
    const params = [];
    
    if (estado) {
      sql += ' AND gt.estado = ?';
      params.push(estado);
    }
    
    if (fecha_inicio) {
      sql += ' AND gt.fecha_emision >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ' AND gt.fecha_emision <= ?';
      params.push(fecha_fin);
    }
    
    if (ruc_transportista) {
      sql += ' AND gt.ruc_transportista = ?';
      params.push(ruc_transportista);
    }
    
    sql += ' ORDER BY gt.fecha_emision DESC, gt.numero_guia DESC';
    
    const result = await executeQuery(sql, params);
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// OBTENER GUÍA DE TRANSPORTISTA POR ID
// =====================================================
export async function getGuiaTransportistaById(req, res) {
  try {
    const { id } = req.params;
    
    // Cabecera
    const cabeceraResult = await executeQuery(
      `SELECT 
        gt.*,
        gr.numero_guia AS numero_guia_remision,
        gr.id_guia_remision,
        gr.direccion_partida,
        gr.direccion_llegada,
        gr.ubigeo_partida,
        gr.ubigeo_llegada,
        gr.ciudad_llegada,
        gr.peso_bruto_kg,
        gr.numero_bultos,
        gr.tipo_traslado,
        gr.motivo_traslado,
        ov.numero_orden,
        ov.id_orden_venta,
        cli.razon_social AS cliente,
        cli.ruc AS ruc_cliente,
        cli.direccion AS direccion_cliente
      FROM guias_transportista gt
      INNER JOIN guias_remision gr ON gt.id_guia_remision = gr.id_guia_remision
      INNER JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      INNER JOIN clientes cli ON gr.id_cliente = cli.id_cliente
      WHERE gt.id_guia_transportista = ?`,
      [id]
    );
    
    if (cabeceraResult.data.length === 0) {
      return res.status(404).json({ error: 'Guía de transportista no encontrada' });
    }
    
    res.json({
      success: true,
      data: cabeceraResult.data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// CREAR GUÍA DE TRANSPORTISTA
// =====================================================
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
      fecha_inicio_traslado,
      observaciones
    } = req.body;
    
    if (!id_guia_remision) {
      return res.status(400).json({ 
        error: 'ID de guía de remisión es requerido' 
      });
    }
    
    // Verificar que la guía de remisión existe
    const guiaResult = await executeQuery(
      'SELECT id_guia_remision, numero_guia FROM guias_remision WHERE id_guia_remision = ?',
      [id_guia_remision]
    );
    
    if (guiaResult.data.length === 0) {
      return res.status(404).json({ error: 'Guía de remisión no encontrada' });
    }
    
    // Verificar que no tenga ya guía de transportista
    const existeResult = await executeQuery(
      'SELECT id_guia_transportista FROM guias_transportista WHERE id_guia_remision = ?',
      [id_guia_remision]
    );
    
    if (existeResult.data.length > 0) {
      return res.status(400).json({ 
        error: 'Esta guía de remisión ya tiene una guía de transportista asociada' 
      });
    }
    
    // Generar número de guía
    const year = new Date().getFullYear();
    const lastResult = await executeQuery(
      `SELECT numero_guia FROM guias_transportista 
       WHERE numero_guia LIKE ? 
       ORDER BY id_guia_transportista DESC LIMIT 1`,
      [`GT-${year}-%`]
    );
    
    let correlativo = 1;
    if (lastResult.data.length > 0) {
      correlativo = parseInt(lastResult.data[0].numero_guia.split('-')[2]) + 1;
    }
    
    const numero_guia = `GT-${year}-${correlativo.toString().padStart(4, '0')}`;
    
    const queries = [];
    
    // Insertar guía de transportista
    queries.push({
      sql: `INSERT INTO guias_transportista (
        numero_guia, id_guia_remision, fecha_emision,
        razon_social_transportista, ruc_transportista,
        nombre_conductor, licencia_conducir, dni_conductor, telefono_conductor,
        placa_vehiculo, marca_vehiculo, modelo_vehiculo,
        certificado_habilitacion, fecha_inicio_traslado,
        estado, observaciones, id_creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        numero_guia,
        id_guia_remision,
        fecha_emision || new Date(),
        razon_social_transportista,
        ruc_transportista,
        nombre_conductor,
        licencia_conducir,
        dni_conductor || null,
        telefono_conductor || null,
        placa_vehiculo,
        marca_vehiculo || null,
        modelo_vehiculo || null,
        certificado_habilitacion || null,
        fecha_inicio_traslado || null,
        'Activa',
        observaciones || null,
        req.user?.id_empleado || null
      ]
    });
    
    // Actualizar guía de remisión a "En Tránsito"
    queries.push({
      sql: `UPDATE guias_remision 
            SET estado = 'En Tránsito',
                fecha_inicio_traslado = ?
            WHERE id_guia_remision = ?`,
      params: [fecha_inicio_traslado || new Date(), id_guia_remision]
    });
    
    const result = await executeTransaction(queries);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      message: 'Guía de transportista creada exitosamente',
      data: {
        numero_guia,
        id_guia_remision
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// ACTUALIZAR ESTADO
// =====================================================
export async function actualizarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    const estadosValidos = ['Activa', 'Finalizada', 'Cancelada'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }
    
    const result = await executeQuery(
      'UPDATE guias_transportista SET estado = ? WHERE id_guia_transportista = ?',
      [estado, id]
    );
    
    res.json({
      success: true,
      message: `Guía de transportista actualizada a estado: ${estado}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// OBTENER TRANSPORTISTAS FRECUENTES
// =====================================================
export async function getTransportistasFrecuentes(req, res) {
  try {
    const result = await executeQuery(
      `SELECT 
        razon_social_transportista,
        ruc_transportista,
        COUNT(*) AS total_guias,
        MAX(fecha_emision) AS ultima_guia
      FROM guias_transportista
      GROUP BY razon_social_transportista, ruc_transportista
      ORDER BY total_guias DESC
      LIMIT 10`
    );
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// OBTENER CONDUCTORES FRECUENTES
// =====================================================
export async function getConductoresFrecuentes(req, res) {
  try {
    const result = await executeQuery(
      `SELECT 
        nombre_conductor,
        licencia_conducir,
        dni_conductor,
        telefono_conductor,
        COUNT(*) AS total_viajes,
        MAX(fecha_emision) AS ultimo_viaje
      FROM guias_transportista
      WHERE nombre_conductor IS NOT NULL
      GROUP BY nombre_conductor, licencia_conducir, dni_conductor, telefono_conductor
      ORDER BY total_viajes DESC
      LIMIT 10`
    );
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// OBTENER VEHÍCULOS FRECUENTES
// =====================================================
export async function getVehiculosFrecuentes(req, res) {
  try {
    const result = await executeQuery(
      `SELECT 
        placa_vehiculo,
        marca_vehiculo,
        modelo_vehiculo,
        certificado_habilitacion,
        COUNT(*) AS total_viajes,
        MAX(fecha_emision) AS ultimo_viaje
      FROM guias_transportista
      WHERE placa_vehiculo IS NOT NULL
      GROUP BY placa_vehiculo, marca_vehiculo, modelo_vehiculo, certificado_habilitacion
      ORDER BY total_viajes DESC
      LIMIT 10`
    );
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// ESTADÍSTICAS
// =====================================================
export async function getEstadisticas(req, res) {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    let whereClause = '1=1';
    const params = [];
    
    if (fecha_inicio) {
      whereClause += ' AND fecha_emision >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      whereClause += ' AND fecha_emision <= ?';
      params.push(fecha_fin);
    }
    
    const estadisticas = await executeQuery(
      `SELECT 
        COUNT(*) AS total_guias,
        SUM(CASE WHEN estado = 'Activa' THEN 1 ELSE 0 END) AS activas,
        SUM(CASE WHEN estado = 'Finalizada' THEN 1 ELSE 0 END) AS finalizadas,
        SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        COUNT(DISTINCT ruc_transportista) AS transportistas_unicos,
        COUNT(DISTINCT nombre_conductor) AS conductores_unicos,
        COUNT(DISTINCT placa_vehiculo) AS vehiculos_unicos
      FROM guias_transportista
      WHERE ${whereClause}`,
      params
    );
    
    res.json({
      success: true,
      data: estadisticas.data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}