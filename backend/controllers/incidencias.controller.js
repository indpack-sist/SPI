import { executeQuery, executeTransaction } from '../config/database.js';
import { uploadMiddleware, subirArchivoACloudinary } from '../services/cloudinary.service.js';

export { uploadMiddleware };

const getFechaPeru = () => {
  const now = new Date();
  const peruDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const year = peruDate.getFullYear();
  const month = String(peruDate.getMonth() + 1).padStart(2, '0');
  const day = String(peruDate.getDate()).padStart(2, '0');
  const hours = String(peruDate.getHours()).padStart(2, '0');
  const minutes = String(peruDate.getMinutes()).padStart(2, '0');
  const seconds = String(peruDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const getIdEmpleado = (req) => req.user?.id_empleado || req.user?.id || req.user?.userId || null;

// Estados válidos del workflow
const ESTADOS_VALIDOS = ['Abierta', 'En análisis', 'En tratamiento', 'Verificación', 'Cerrada', 'Anulada'];

// SELECT base con los datos permitidos de la Orden de Venta (SIN PRECIOS).
// Solo: correlativo, cliente, cantidad del producto y fecha de despacho.
const SELECT_INCIDENCIA = `
  SELECT
    i.*,
    t.nombre AS tipo_nombre,
    op.numero_orden AS numero_op,
    p.codigo AS codigo_producto,
    COALESCE(p.nombre, '[PRODUCTO ELIMINADO]') AS producto,
    p.unidad_medida,
    ov.numero_orden AS numero_ov,
    ov.fecha_entrega_real AS fecha_despacho,
    cl.razon_social AS cliente,
    (SELECT dov.cantidad FROM detalle_orden_venta dov
       WHERE dov.id_orden_venta = i.id_orden_venta
         AND dov.id_producto = i.id_producto LIMIT 1) AS cantidad_ov_producto,
    edet.nombre_completo AS detectado_por,
    ecierre.nombre_completo AS responsable_cierre,
    (SELECT COUNT(*) FROM incidencias_adjuntos ia WHERE ia.id_incidencia = i.id_incidencia) AS total_adjuntos
  FROM incidencias_calidad i
  LEFT JOIN tipos_incidencia t ON i.id_tipo = t.id_tipo
  LEFT JOIN ordenes_produccion op ON i.id_orden = op.id_orden
  LEFT JOIN productos p ON i.id_producto = p.id_producto
  LEFT JOIN ordenes_venta ov ON i.id_orden_venta = ov.id_orden_venta
  LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
  LEFT JOIN empleados edet ON i.id_detectado_por = edet.id_empleado
  LEFT JOIN empleados ecierre ON i.id_responsable_cierre = ecierre.id_empleado
`;

export async function getIncidencias(req, res) {
  try {
    const { estado, severidad, id_producto, id_orden, fecha_inicio, fecha_fin } = req.query;

    let sql = SELECT_INCIDENCIA + ' WHERE 1=1';
    const params = [];

    if (estado) {
      const estadosArray = estado.split(',');
      sql += ` AND i.estado IN (${estadosArray.map(() => '?').join(',')})`;
      params.push(...estadosArray);
    }
    if (severidad) {
      sql += ' AND i.severidad = ?';
      params.push(severidad);
    }
    if (id_producto) {
      sql += ' AND i.id_producto = ?';
      params.push(id_producto);
    }
    if (id_orden) {
      sql += ' AND i.id_orden = ?';
      params.push(id_orden);
    }
    if (fecha_inicio) {
      sql += ' AND DATE(i.fecha_deteccion) >= ?';
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      sql += ' AND DATE(i.fecha_deteccion) <= ?';
      params.push(fecha_fin);
    }

    sql += ' ORDER BY i.fecha_creacion DESC';

    const result = await executeQuery(sql, params);
    if (!result.success) return res.status(500).json({ success: false, error: result.error });

    res.json({ success: true, data: result.data, total: result.data.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getIncidenciaById(req, res) {
  try {
    const { id } = req.params;
    const result = await executeQuery(SELECT_INCIDENCIA + ' WHERE i.id_incidencia = ?', [id]);
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    if (result.data.length === 0) return res.status(404).json({ success: false, error: 'Incidencia no encontrada' });
    res.json({ success: true, data: result.data[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// Todas las incidencias de un producto con su trazabilidad (OP, OV, cliente). SIN PRECIOS.
export async function getIncidenciasPorProducto(req, res) {
  try {
    const { idProducto } = req.params;
    const result = await executeQuery(SELECT_INCIDENCIA + ' WHERE i.id_producto = ? ORDER BY i.fecha_deteccion DESC', [idProducto]);
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    res.json({ success: true, data: result.data, total: result.data.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getTiposIncidencia(req, res) {
  try {
    const result = await executeQuery('SELECT id_tipo, nombre FROM tipos_incidencia WHERE activo = 1 ORDER BY nombre ASC');
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function crearIncidencia(req, res) {
  try {
    const {
      id_orden,
      id_orden_venta,
      id_producto,
      id_registro_produccion,
      id_tipo,
      severidad,
      fase_deteccion,
      descripcion,
      cantidad_afectada,
      unidad_medida,
      disposicion
    } = req.body;

    if (!descripcion || !descripcion.trim()) {
      return res.status(400).json({ success: false, error: 'La descripción es requerida' });
    }

    const idEmpleado = getIdEmpleado(req);
    const fechaActual = getFechaPeru();

    // Generar código correlativo INC-YYYY-NNNN
    const ultimaResult = await executeQuery(
      'SELECT codigo FROM incidencias_calidad ORDER BY id_incidencia DESC LIMIT 1'
    );
    let secuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].codigo.match(/(\d+)$/);
      if (match) secuencia = parseInt(match[1]) + 1;
    }
    const year = new Date().getFullYear();
    const codigo = `INC-${year}-${String(secuencia).padStart(4, '0')}`;

    const insertResult = await executeQuery(
      `INSERT INTO incidencias_calidad (
        codigo, id_orden, id_orden_venta, id_producto, id_registro_produccion,
        id_tipo, severidad, fase_deteccion, descripcion, cantidad_afectada,
        unidad_medida, disposicion, estado, id_detectado_por, fecha_deteccion, fecha_creacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Abierta', ?, ?, ?)`,
      [
        codigo,
        id_orden || null,
        id_orden_venta || null,
        id_producto || null,
        id_registro_produccion || null,
        id_tipo || null,
        severidad || 'Menor',
        fase_deteccion || 'Proceso',
        descripcion.trim(),
        cantidad_afectada || null,
        unidad_medida || null,
        disposicion || 'Pendiente',
        idEmpleado,
        fechaActual,
        fechaActual
      ]
    );

    if (!insertResult.success) {
      return res.status(500).json({ success: false, error: insertResult.error });
    }

    const idIncidencia = insertResult.data.insertId;

    await executeQuery(
      `INSERT INTO incidencias_historial (id_incidencia, accion, estado_anterior, estado_nuevo, comentario, id_usuario, fecha)
       VALUES (?, 'Creación', NULL, 'Abierta', ?, ?, ?)`,
      [idIncidencia, `Incidencia ${codigo} registrada`, idEmpleado, fechaActual]
    );

    res.status(201).json({
      success: true,
      message: 'Incidencia registrada exitosamente',
      data: { id_incidencia: idIncidencia, codigo }
    });
  } catch (error) {
    console.error('Error al crear incidencia:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function actualizarIncidencia(req, res) {
  try {
    const { id } = req.params;
    const {
      id_tipo,
      severidad,
      fase_deteccion,
      descripcion,
      cantidad_afectada,
      unidad_medida,
      disposicion,
      accion_correctiva,
      accion_preventiva,
      costo_estimado
    } = req.body;

    const idEmpleado = getIdEmpleado(req);

    const existente = await executeQuery('SELECT estado FROM incidencias_calidad WHERE id_incidencia = ?', [id]);
    if (!existente.success || existente.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Incidencia no encontrada' });
    }
    if (['Cerrada', 'Anulada'].includes(existente.data[0].estado)) {
      return res.status(400).json({ success: false, error: 'No se puede editar una incidencia Cerrada o Anulada' });
    }

    const updates = [];
    const params = [];
    const campos = {
      id_tipo, severidad, fase_deteccion, descripcion, cantidad_afectada,
      unidad_medida, disposicion, accion_correctiva, accion_preventiva, costo_estimado
    };
    for (const [campo, valor] of Object.entries(campos)) {
      if (valor !== undefined) {
        updates.push(`${campo} = ?`);
        params.push(valor === '' ? null : valor);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay datos para actualizar' });
    }

    params.push(id);
    const result = await executeQuery(
      `UPDATE incidencias_calidad SET ${updates.join(', ')} WHERE id_incidencia = ?`,
      params
    );
    if (!result.success) return res.status(500).json({ success: false, error: result.error });

    await executeQuery(
      `INSERT INTO incidencias_historial (id_incidencia, accion, comentario, id_usuario, fecha)
       VALUES (?, 'Edición', 'Se actualizaron los datos de la incidencia', ?, ?)`,
      [id, idEmpleado, getFechaPeru()]
    );

    res.json({ success: true, message: 'Incidencia actualizada exitosamente' });
  } catch (error) {
    console.error('Error al actualizar incidencia:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function cambiarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado, comentario } = req.body;
    const idEmpleado = getIdEmpleado(req);
    const fechaActual = getFechaPeru();

    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ success: false, error: 'Estado no válido' });
    }

    const existente = await executeQuery('SELECT estado FROM incidencias_calidad WHERE id_incidencia = ?', [id]);
    if (!existente.success || existente.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Incidencia no encontrada' });
    }

    const estadoAnterior = existente.data[0].estado;
    if (estadoAnterior === estado) {
      return res.status(400).json({ success: false, error: 'La incidencia ya está en ese estado' });
    }
    if (['Cerrada', 'Anulada'].includes(estadoAnterior)) {
      return res.status(400).json({ success: false, error: `No se puede cambiar el estado de una incidencia ${estadoAnterior}` });
    }
    if (estado === 'Anulada' && (!comentario || !comentario.trim())) {
      return res.status(400).json({ success: false, error: 'Debe indicar el motivo de anulación' });
    }

    const queries = [];

    if (estado === 'Cerrada') {
      queries.push({
        sql: `UPDATE incidencias_calidad SET estado = ?, fecha_cierre = ?, id_responsable_cierre = ? WHERE id_incidencia = ?`,
        params: [estado, fechaActual, idEmpleado, id]
      });
    } else if (estado === 'Anulada') {
      queries.push({
        sql: `UPDATE incidencias_calidad SET estado = ?, motivo_anulacion = ? WHERE id_incidencia = ?`,
        params: [estado, comentario.trim(), id]
      });
    } else {
      queries.push({
        sql: `UPDATE incidencias_calidad SET estado = ? WHERE id_incidencia = ?`,
        params: [estado, id]
      });
    }

    queries.push({
      sql: `INSERT INTO incidencias_historial (id_incidencia, accion, estado_anterior, estado_nuevo, comentario, id_usuario, fecha)
            VALUES (?, 'Cambio de estado', ?, ?, ?, ?, ?)`,
      params: [id, estadoAnterior, estado, comentario || null, idEmpleado, fechaActual]
    });

    const result = await executeTransaction(queries);
    if (!result.success) return res.status(500).json({ success: false, error: result.error });

    res.json({ success: true, message: `Incidencia movida a estado ${estado}` });
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getHistorial(req, res) {
  try {
    const { id } = req.params;
    const result = await executeQuery(
      `SELECT h.*, COALESCE(e.nombre_completo, 'Sistema') AS usuario
       FROM incidencias_historial h
       LEFT JOIN empleados e ON h.id_usuario = e.id_empleado
       WHERE h.id_incidencia = ?
       ORDER BY h.fecha DESC, h.id_historial DESC`,
      [id]
    );
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ===================== ADJUNTOS (mismo patrón que op_adjuntos) =====================

export async function subirAdjunto(req, res) {
  try {
    const { id } = req.params;
    const usuario = req.user;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se recibió ningún archivo.' });
    }

    const incidenciaResult = await executeQuery('SELECT id_incidencia FROM incidencias_calidad WHERE id_incidencia = ?', [id]);
    if (!incidenciaResult.success || incidenciaResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Incidencia no encontrada.' });
    }

    const resultado = await subirArchivoACloudinary(req.file, 'indpack_incidencias');

    const mime = req.file.mimetype;
    let tipo_archivo = 'otro';
    if (mime.startsWith('image/')) tipo_archivo = 'imagen';
    else if (mime === 'application/pdf') tipo_archivo = 'pdf';
    else if (mime.includes('word') || mime.includes('document')) tipo_archivo = 'documento';

    const insertResult = await executeQuery(
      `INSERT INTO incidencias_adjuntos (id_incidencia, url, nombre_archivo, tipo_archivo, public_id_cloudinary, id_subido_por, fecha_subida)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        resultado.secure_url,
        req.file.originalname,
        tipo_archivo,
        resultado.public_id,
        usuario.id_empleado || null,
        getFechaPeru()
      ]
    );

    if (!insertResult.success) {
      return res.status(500).json({ success: false, error: 'Error al guardar el adjunto en la base de datos.' });
    }

    res.status(201).json({
      success: true,
      adjunto: {
        id_adjunto: insertResult.data.insertId,
        url: resultado.secure_url,
        nombre_archivo: req.file.originalname,
        tipo_archivo,
        fecha_subida: getFechaPeru(),
        subido_por: usuario.nombre_completo || null
      }
    });
  } catch (error) {
    console.error('Error al subir adjunto de incidencia:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getAdjuntos(req, res) {
  try {
    const { id } = req.params;
    const result = await executeQuery(
      `SELECT ia.id_adjunto, ia.url, ia.nombre_archivo, ia.tipo_archivo, ia.fecha_subida,
              e.nombre_completo AS subido_por
       FROM incidencias_adjuntos ia
       LEFT JOIN empleados e ON ia.id_subido_por = e.id_empleado
       WHERE ia.id_incidencia = ?
       ORDER BY ia.fecha_subida DESC`,
      [id]
    );
    if (!result.success) return res.status(500).json({ success: false, error: 'Error al obtener adjuntos.' });
    res.json({ success: true, adjuntos: result.data });
  } catch (error) {
    console.error('Error al obtener adjuntos de incidencia:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function eliminarAdjunto(req, res) {
  try {
    const { idAdjunto } = req.params;

    const adjuntoResult = await executeQuery('SELECT * FROM incidencias_adjuntos WHERE id_adjunto = ?', [idAdjunto]);
    if (!adjuntoResult.success || adjuntoResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Adjunto no encontrado.' });
    }

    const deleteResult = await executeQuery('DELETE FROM incidencias_adjuntos WHERE id_adjunto = ?', [idAdjunto]);
    if (!deleteResult.success) {
      return res.status(500).json({ success: false, error: 'Error al eliminar adjunto.' });
    }

    res.json({ success: true, message: 'Adjunto eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar adjunto de incidencia:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
