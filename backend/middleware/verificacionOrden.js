import { executeQuery } from '../config/database.js';

export const verificarOrdenAprobada = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rol } = req.user;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID de orden no proporcionado'
      });
    }

    const ordenResult = await executeQuery(
      'SELECT estado_verificacion, numero_orden FROM ordenes_venta WHERE id_orden_venta = ?',
      [id]
    );

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada'
      });
    }

    const orden = ordenResult.data[0];

    if (orden.estado_verificacion === 'Pendiente' && 
        !['Administrador', 'Gerencia', 'Administrativo'].includes(rol)) {
      return res.status(403).json({
        success: false,
        error: 'Esta orden está pendiente de verificación. Solo usuarios Administrativos pueden modificarla.',
        estado_verificacion: 'Pendiente',
        numero_orden: orden.numero_orden
      });
    }

    if (orden.estado_verificacion === 'Rechazada' && 
        !['Administrador', 'Gerencia', 'Comercial', 'Ventas'].includes(rol)) {
      return res.status(403).json({
        success: false,
        error: 'Esta orden fue rechazada. Solo el comercial puede editarla y reenviarla.',
        estado_verificacion: 'Rechazada'
      });
    }

    next();

  } catch (error) {
    console.error('Error en verificarOrdenAprobada:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar estado de la orden'
    });
  }
};

export const esVerificador = (req, res, next) => {
  try {
    const { rol } = req.user;

    if (!['Administrador', 'Gerencia', 'Administrativo'].includes(rol)) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para verificar órdenes. Solo usuarios Administrativos.'
      });
    }

    next();

  } catch (error) {
    console.error('Error en esVerificador:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar permisos'
    });
  }
};

export const puedeEditarOrdenRechazada = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rol, id_empleado } = req.user;

    const ordenResult = await executeQuery(
      'SELECT estado_verificacion, id_registrado_por FROM ordenes_venta WHERE id_orden_venta = ?',
      [id]
    );

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada'
      });
    }

    const orden = ordenResult.data[0];

    if (orden.estado_verificacion === 'Rechazada') {
      if (['Administrador', 'Gerencia', 'Administrativo'].includes(rol)) {
        return next();
      }

      if (orden.id_registrado_por === id_empleado && 
          ['Comercial', 'Ventas'].includes(rol)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: 'Solo puedes editar órdenes rechazadas que tú creaste'
      });
    }

    next();

  } catch (error) {
    console.error('Error en puedeEditarOrdenRechazada:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar permisos de edición'
    });
  }
};