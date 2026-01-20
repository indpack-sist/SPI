import { executeQuery } from '../config/database.js';

export async function getMisNotificaciones(req, res) {
  try {
    const id_usuario = req.user?.id_empleado;

    if (!id_usuario) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    const notificacionesResult = await executeQuery(`
      SELECT * FROM notificaciones 
      WHERE id_usuario_destino = ? 
      ORDER BY fecha_creacion DESC 
      LIMIT 20
    `, [id_usuario]);

    const conteoResult = await executeQuery(`
      SELECT COUNT(*) as no_leidas 
      FROM notificaciones 
      WHERE id_usuario_destino = ? AND leido = 0
    `, [id_usuario]);

    const no_leidas = conteoResult.data[0]?.no_leidas || 0;

    res.json({
      success: true,
      data: notificacionesResult.data,
      no_leidas
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function marcarLeida(req, res) {
  try {
    const { id } = req.params;
    const id_usuario = req.user?.id_empleado;

    await executeQuery(`
      UPDATE notificaciones 
      SET leido = 1 
      WHERE id_notificacion = ? AND id_usuario_destino = ?
    `, [id, id_usuario]);

    res.json({ success: true, message: 'Notificación marcada como leída' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function marcarTodasLeidas(req, res) {
  try {
    const id_usuario = req.user?.id_empleado;

    if (!id_usuario) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    await executeQuery(`
      UPDATE notificaciones 
      SET leido = 1 
      WHERE id_usuario_destino = ?
    `, [id_usuario]);

    res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}