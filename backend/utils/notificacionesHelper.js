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
      WHERE rol IN ('Administrador', 'Administrativo') 
        AND estado = 'Activo'
    `);

    if (!adminResult.success || adminResult.data.length === 0) {
      console.warn('No hay usuarios administrativos activos para notificar');
      return;
    }

    for (const admin of adminResult.data) {
      const insertResult = await executeQuery(
        `INSERT INTO notificaciones (id_usuario_destino, titulo, mensaje, tipo, ruta_destino, leido) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          admin.id_empleado,
          'Nueva Orden Pendiente de Verificación',
          `${nombreCreador} creó una nueva orden ${numeroOrden}. Requiere verificación.`,
          'warning',
          '/ventas/ordenes/verificacion',
          0
        ]
      );

      if (insertResult.success && io) {
        const notifCompleta = {
          id_notificacion: insertResult.data.insertId,
          id_usuario_destino: admin.id_empleado,
          titulo: 'Nueva Orden Pendiente de Verificación',
          mensaje: `${nombreCreador} creó una nueva orden ${numeroOrden}. Requiere verificación.`,
          tipo: 'warning',
          ruta_destino: '/ventas/ordenes/verificacion',
          leido: 0,
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

    const insertResult = await executeQuery(
      `INSERT INTO notificaciones (id_usuario_destino, titulo, mensaje, tipo, ruta_destino, leido) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        idComercial,
        'Orden Aprobada',
        `Tu orden ${numeroOrden} fue aprobada por ${nombreVerificador}. Ya puedes gestionarla.`,
        'success',
        `/ventas/ordenes/${idOrden}`,
        0
      ]
    );

    if (insertResult.success && io) {
      const notifCompleta = {
        id_notificacion: insertResult.data.insertId,
        id_usuario_destino: idComercial,
        titulo: 'Orden Aprobada',
        mensaje: `Tu orden ${numeroOrden} fue aprobada por ${nombreVerificador}. Ya puedes gestionarla.`,
        tipo: 'success',
        ruta_destino: `/ventas/ordenes/${idOrden}`,
        leido: 0,
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

    const insertResult = await executeQuery(
      `INSERT INTO notificaciones (id_usuario_destino, titulo, mensaje, tipo, ruta_destino, leido) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        idComercial,
        'Orden Rechazada',
        `Tu orden ${numeroOrden} fue rechazada por ${nombreVerificador}. Motivo: ${motivoRechazo}`,
        'danger',
        `/ventas/ordenes/${idOrden}`,
        0
      ]
    );

    if (insertResult.success && io) {
      const notifCompleta = {
        id_notificacion: insertResult.data.insertId,
        id_usuario_destino: idComercial,
        titulo: 'Orden Rechazada',
        mensaje: `Tu orden ${numeroOrden} fue rechazada por ${nombreVerificador}. Motivo: ${motivoRechazo}`,
        tipo: 'danger',
        ruta_destino: `/ventas/ordenes/${idOrden}`,
        leido: 0,
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
      WHERE rol IN ('Administrador', 'Administrativo') 
        AND estado = 'Activo'
    `);

    if (!adminResult.success || adminResult.data.length === 0) {
      console.warn('No hay usuarios administrativos activos para notificar');
      return;
    }

    for (const admin of adminResult.data) {
      const insertResult = await executeQuery(
        `INSERT INTO notificaciones (id_usuario_destino, titulo, mensaje, tipo, ruta_destino, leido) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          admin.id_empleado,
          'Orden Reenviada para Verificación',
          `${nombreComercial} reenvió la orden ${numeroOrden} para nueva verificación.`,
          'info',
          '/ventas/ordenes/verificacion',
          0
        ]
      );

      if (insertResult.success && io) {
        const notifCompleta = {
          id_notificacion: insertResult.data.insertId,
          id_usuario_destino: admin.id_empleado,
          titulo: 'Orden Reenviada para Verificación',
          mensaje: `${nombreComercial} reenvió la orden ${numeroOrden} para nueva verificación.`,
          tipo: 'info',
          ruta_destino: '/ventas/ordenes/verificacion',
          leido: 0,
          fecha_creacion: new Date()
        };
        await emitirNotificacion(io, admin.id_empleado, notifCompleta);
      }
    }

  } catch (error) {
    console.error('Error en notificarOrdenReenviada:', error);
  }
}

export async function notificarPendienteMarcarSunat(idOrden, numeroOrden, estadoActual, io) {
  try {
    const adminResult = await executeQuery(`
      SELECT id_empleado 
      FROM empleados 
      WHERE rol IN ('Administrador', 'Administrativo') 
        AND estado = 'Activo'
    `);

    if (!adminResult.success || adminResult.data.length === 0) {
      return;
    }

    for (const admin of adminResult.data) {
      const insertResult = await executeQuery(
        `INSERT INTO notificaciones (id_usuario_destino, titulo, mensaje, tipo, ruta_destino, leido) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          admin.id_empleado,
          'Pendiente Registro SUNAT',
          `La Orden ${numeroOrden} está ${estadoActual}. Pendiente registrar correlativo SUNAT.`,
          'info',
          `/ventas/ordenes/${idOrden}`,
          0
        ]
      );

      if (insertResult.success && io) {
        const notifCompleta = {
          id_notificacion: insertResult.data.insertId,
          id_usuario_destino: admin.id_empleado,
          titulo: 'Pendiente Registro SUNAT',
          mensaje: `La Orden ${numeroOrden} está ${estadoActual}. Pendiente registrar correlativo SUNAT.`,
          tipo: 'info',
          ruta_destino: `/ventas/ordenes/${idOrden}`,
          leido: 0,
          fecha_creacion: new Date()
        };
        await emitirNotificacion(io, admin.id_empleado, notifCompleta);
      }
    }
  } catch (error) {
    console.error('Error en notificarPendienteMarcarSunat:', error);
  }
}

export async function notificarComercialDefinirComprobante(idOrden, numeroOrden, idComercial, io) {
  try {
    if (!idComercial) return;

    const insertResult = await executeQuery(
      `INSERT INTO notificaciones (id_usuario_destino, titulo, mensaje, tipo, ruta_destino, leido) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        idComercial,
        'Definir Tipo de Comprobante',
        `Has creado la orden ${numeroOrden}. Por favor, define si será Factura o Nota de Venta.`,
        'warning',
        `/ventas/ordenes/${idOrden}`,
        0
      ]
    );

    if (insertResult.success && io) {
      const notifCompleta = {
        id_notificacion: insertResult.data.insertId,
        id_usuario_destino: idComercial,
        titulo: 'Definir Tipo de Comprobante',
        mensaje: `Has creado la orden ${numeroOrden}. Por favor, define si será Factura o Nota de Venta.`,
        tipo: 'warning',
        ruta_destino: `/ventas/ordenes/${idOrden}`,
        leido: 0,
        fecha_creacion: new Date()
      };
      await emitirNotificacion(io, idComercial, notifCompleta);
    }
  } catch (error) {
    console.error('Error en notificarComercialDefinirComprobante:', error);
  }
}

export async function notificarNuevaOP(idOrden, numeroOP, origenInfo, rolesDestino, io) {
  try {
    // Buscar empleados activos con los roles especificados (Supervisor, Jefe de Planta, etc.)
    const destinatariosResult = await executeQuery(`
      SELECT id_empleado 
      FROM empleados 
      WHERE rol IN (?) 
        AND estado = 'Activo'
    `, [rolesDestino]);

    if (!destinatariosResult.success || destinatariosResult.data.length === 0) return;

    for (const dest of destinatariosResult.data) {
      const insertResult = await executeQuery(
        `INSERT INTO notificaciones (id_usuario_destino, titulo, mensaje, tipo, ruta_destino, leido) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          dest.id_empleado,
          'Nueva OP Generada',
          `Se ha generado la ${numeroOP}. ${origenInfo}`,
          'info',
          `/produccion/ordenes/${idOrden}`,
          0
        ]
      );

      if (insertResult.success && io) {
        const notifCompleta = {
          id_notificacion: insertResult.data.insertId,
          id_usuario_destino: dest.id_empleado,
          titulo: 'Nueva OP Generada',
          mensaje: `Se ha generado la ${numeroOP}. ${origenInfo}`,
          tipo: 'info',
          ruta_destino: `/produccion/ordenes/${idOrden}`,
          leido: 0,
          fecha_creacion: new Date()
        };
        await emitirNotificacion(io, dest.id_empleado, notifCompleta);
      }
    }
  } catch (error) {
    console.error('Error en notificarNuevaOP:', error);
  }
}