import { executeQuery } from '../config/database.js';

// Crear nueva solicitud de crédito
export async function crearSolicitudCredito(req, res) {
  try {
    const {
      id_cliente,
      limite_credito_pen_solicitado,
      limite_credito_usd_solicitado,
      usar_limite_credito,
      justificacion
    } = req.body;
    
    const id_solicitante = req.user.id_empleado; // Del token/sesión
    
    if (!id_cliente) {
      return res.status(400).json({ error: 'ID de cliente requerido' });
    }
    
    // Obtener límites actuales del cliente
    const clienteResult = await executeQuery(
      'SELECT limite_credito_pen, limite_credito_usd FROM clientes WHERE id_cliente = ?',
      [id_cliente]
    );
    
    if (clienteResult.data.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    const cliente = clienteResult.data[0];
    
    // Verificar si hay una solicitud pendiente para este cliente
    const solicitudPendiente = await executeQuery(
      'SELECT id_solicitud FROM solicitudes_credito WHERE id_cliente = ? AND estado = "Pendiente"',
      [id_cliente]
    );
    
    if (solicitudPendiente.data.length > 0) {
      return res.status(400).json({ 
        error: 'Ya existe una solicitud pendiente para este cliente' 
      });
    }
    
    // Crear la solicitud
    const result = await executeQuery(
      `INSERT INTO solicitudes_credito (
        id_cliente,
        id_solicitante,
        limite_credito_pen_solicitado,
        limite_credito_usd_solicitado,
        usar_limite_credito,
        limite_credito_pen_anterior,
        limite_credito_usd_anterior,
        justificacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_cliente,
        id_solicitante,
        parseFloat(limite_credito_pen_solicitado || 0),
        parseFloat(limite_credito_usd_solicitado || 0),
        usar_limite_credito ? 1 : 0,
        parseFloat(cliente.limite_credito_pen || 0),
        parseFloat(cliente.limite_credito_usd || 0),
        justificacion || null
      ]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      message: 'Solicitud de crédito creada exitosamente',
      data: {
        id_solicitud: result.data.insertId
      }
    });
  } catch (error) {
    console.error('Error al crear solicitud:', error);
    res.status(500).json({ error: error.message });
  }
}

// Obtener todas las solicitudes (con filtros opcionales)
export async function getAllSolicitudes(req, res) {
  try {
    const { estado, id_cliente } = req.query;
    
    let sql = 'SELECT * FROM v_solicitudes_credito WHERE 1=1';
    const params = [];
    
    if (estado) {
      sql += ' AND estado = ?';
      params.push(estado);
    }
    
    if (id_cliente) {
      sql += ' AND id_cliente = ?';
      params.push(id_cliente);
    }
    
    sql += ' ORDER BY fecha_solicitud DESC';
    
    const result = await executeQuery(sql, params);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: error.message });
  }
}

// Obtener solicitudes pendientes
export async function getSolicitudesPendientes(req, res) {
  try {
    const result = await executeQuery(
      'SELECT * FROM v_solicitudes_credito WHERE estado = "Pendiente" ORDER BY fecha_solicitud ASC'
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
  } catch (error) {
    console.error('Error al obtener solicitudes pendientes:', error);
    res.status(500).json({ error: error.message });
  }
}

// Obtener solicitud por ID
export async function getSolicitudById(req, res) {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(
      'SELECT * FROM v_solicitudes_credito WHERE id_solicitud = ?',
      [id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    if (result.data.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
  } catch (error) {
    console.error('Error al obtener solicitud:', error);
    res.status(500).json({ error: error.message });
  }
}

// Aprobar solicitud de crédito
export async function aprobarSolicitud(req, res) {
  try {
    const { id } = req.params;
    const { comentario_aprobador } = req.body;
    const id_aprobador = req.user.id_empleado; // Del token/sesión
    
    // Verificar que la solicitud existe y está pendiente
    const solicitudResult = await executeQuery(
      'SELECT * FROM solicitudes_credito WHERE id_solicitud = ?',
      [id]
    );
    
    if (solicitudResult.data.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    
    const solicitud = solicitudResult.data[0];
    
    if (solicitud.estado !== 'Pendiente') {
      return res.status(400).json({ 
        error: `La solicitud ya fue ${solicitud.estado.toLowerCase()}` 
      });
    }
    
    // Actualizar límites del cliente
    const updateCliente = await executeQuery(
      `UPDATE clientes SET 
        limite_credito_pen = ?,
        limite_credito_usd = ?,
        usar_limite_credito = ?
      WHERE id_cliente = ?`,
      [
        parseFloat(solicitud.limite_credito_pen_solicitado),
        parseFloat(solicitud.limite_credito_usd_solicitado),
        solicitud.usar_limite_credito,
        solicitud.id_cliente
      ]
    );
    
    if (!updateCliente.success) {
      return res.status(500).json({ error: 'Error al actualizar cliente' });
    }
    
    // Actualizar estado de la solicitud
    const updateSolicitud = await executeQuery(
      `UPDATE solicitudes_credito SET 
        estado = 'Aprobada',
        id_aprobador = ?,
        comentario_aprobador = ?,
        fecha_respuesta = NOW()
      WHERE id_solicitud = ?`,
      [id_aprobador, comentario_aprobador || null, id]
    );
    
    if (!updateSolicitud.success) {
      return res.status(500).json({ error: updateSolicitud.error });
    }
    
    res.json({
      success: true,
      message: 'Solicitud aprobada y límites actualizados'
    });
  } catch (error) {
    console.error('Error al aprobar solicitud:', error);
    res.status(500).json({ error: error.message });
  }
}

// Rechazar solicitud de crédito
export async function rechazarSolicitud(req, res) {
  try {
    const { id } = req.params;
    const { comentario_aprobador } = req.body;
    const id_aprobador = req.user.id_empleado; // Del token/sesión
    
    if (!comentario_aprobador) {
      return res.status(400).json({ 
        error: 'Debe proporcionar un comentario al rechazar' 
      });
    }
    
    // Verificar que la solicitud existe y está pendiente
    const solicitudResult = await executeQuery(
      'SELECT estado FROM solicitudes_credito WHERE id_solicitud = ?',
      [id]
    );
    
    if (solicitudResult.data.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    
    const solicitud = solicitudResult.data[0];
    
    if (solicitud.estado !== 'Pendiente') {
      return res.status(400).json({ 
        error: `La solicitud ya fue ${solicitud.estado.toLowerCase()}` 
      });
    }
    
    // Actualizar estado de la solicitud
    const result = await executeQuery(
      `UPDATE solicitudes_credito SET 
        estado = 'Rechazada',
        id_aprobador = ?,
        comentario_aprobador = ?,
        fecha_respuesta = NOW()
      WHERE id_solicitud = ?`,
      [id_aprobador, comentario_aprobador, id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Solicitud rechazada'
    });
  } catch (error) {
    console.error('Error al rechazar solicitud:', error);
    res.status(500).json({ error: error.message });
  }
}

// Obtener historial de solicitudes de un cliente
export async function getHistorialSolicitudesCliente(req, res) {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(
      'SELECT * FROM v_solicitudes_credito WHERE id_cliente = ? ORDER BY fecha_solicitud DESC',
      [id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: error.message });
  }
}