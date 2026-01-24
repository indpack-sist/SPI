import { executeQuery } from '../config/database.js';

async function emitirNotificacion(io, idUsuario, notificacion) {
  if (io) {
    io.to(`usuario_${idUsuario}`).emit('nueva_notificacion', notificacion);
  }
}

export async function notificarNuevaOrdenPendiente(idOrden, numeroOrden, nombreCreador, io) {
  try {
    const adminResult = await executeQuery(`
      SELECT id_empleado 
      FROM empleados 
      WHERE rol IN ('Administrador', 'Gerencia', 'Administrativo') 
        AND estado = 'Activo'
    `);

    if (!adminResult.success || adminResult.data.length === 0) {
      console.warn('No hay usuarios administrativos activos para notificar');
      return;
    }

    for (const admin of adminResult.data) {
      const notif = {
        id_usuario_destino: admin.id_empleado,
        titulo: 'Nueva Orden Pendiente de Verificación',
        mensaje: `${nombreCreador} creó una nueva orden ${numeroOrden}. Requiere verificación.`,
        tipo: 'warning',
        ruta_destino: `/ventas/ordenes/verificacion`,
        leido: 0
      };

      const insertResult = await executeQuery(
        `INSERT INTO notificaciones SET ?`,
        [notif]
      );

      if (insertResult.success && io) {
        const notifCompleta = {
          id_notificacion: insertResult.data.insertId,
          ...notif,
          fecha_creacion: new Date()
        };
        await emitirNotificacion(io, admin.id_empleado, notifCompleta);
      }
    }

  } catch (error) {
    console.error('Error en notificarNuevaOrdenPendiente:', error);
  }
}

export async function notificarOrdenAprobada(idOrden, numeroOrden, idComercial, nombreVerificador, io) {
  try {
    if (!idComercial) {
      console.warn('No se proporcionó ID del comercial para notificar aprobación');
      return;
    }

    const notif = {
      id_usuario_destino: idComercial,
      titulo: 'Orden Aprobada',
      mensaje: `Tu orden ${numeroOrden} fue aprobada por ${nombreVerificador}. Ya puedes gestionarla.`,
      tipo: 'success',
      ruta_destino: `/ventas/ordenes/${idOrden}`,
      leido: 0
    };

    const insertResult = await executeQuery(
      `INSERT INTO notificaciones SET ?`,
      [notif]
    );

    if (insertResult.success && io) {
      const notifCompleta = {
        id_notificacion: insertResult.data.insertId,
        ...notif,
        fecha_creacion: new Date()
      };
      await emitirNotificacion(io, idComercial, notifCompleta);
    }

  } catch (error) {
    console.error('Error en notificarOrdenAprobada:', error);
  }
}

export async function notificarOrdenRechazada(idOrden, numeroOrden, idComercial, nombreVerificador, motivoRechazo, io) {
  try {
    if (!idComercial) {
      console.warn('No se proporcionó ID del comercial para notificar rechazo');
      return;
    }

    const notif = {
      id_usuario_destino: idComercial,
      titulo: 'Orden Rechazada',
      mensaje: `Tu orden ${numeroOrden} fue rechazada por ${nombreVerificador}. Motivo: ${motivoRechazo}`,
      tipo: 'danger',
      ruta_destino: `/ventas/ordenes/${idOrden}`,
      leido: 0
    };

    const insertResult = await executeQuery(
      `INSERT INTO notificaciones SET ?`,
      [notif]
    );

    if (insertResult.success && io) {
      const notifCompleta = {
        id_notificacion: insertResult.data.insertId,
        ...notif,
        fecha_creacion: new Date()
      };
      await emitirNotificacion(io, idComercial, notifCompleta);
    }

  } catch (error) {
    console.error('Error en notificarOrdenRechazada:', error);
  }
}

export async function notificarOrdenReenviada(idOrden, numeroOrden, nombreComercial, io) {
  try {
    const adminResult = await executeQuery(`
      SELECT id_empleado 
      FROM empleados 
      WHERE rol IN ('Administrador', 'Gerencia', 'Administrativo') 
        AND estado = 'Activo'
    `);

    if (!adminResult.success || adminResult.data.length === 0) {
      console.warn('No hay usuarios administrativos activos para notificar');
      return;
    }

    for (const admin of adminResult.data) {
      const notif = {
        id_usuario_destino: admin.id_empleado,
        titulo: 'Orden Reenviada para Verificación',
        mensaje: `${nombreComercial} reenvió la orden ${numeroOrden} para nueva verificación.`,
        tipo: 'info',
        ruta_destino: `/ventas/ordenes/verificacion`,
        leido: 0
      };

      const insertResult = await executeQuery(
        `INSERT INTO notificaciones SET ?`,
        [notif]
      );

      if (insertResult.success && io) {
        const notifCompleta = {
          id_notificacion: insertResult.data.insertId,
          ...notif,
          fecha_creacion: new Date()
        };
        await emitirNotificacion(io, admin.id_empleado, notifCompleta);
      }
    }

  } catch (error) {
    console.error('Error en notificarOrdenReenviada:', error);
  }
}