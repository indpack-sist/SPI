import { executeQuery } from '../config/database.js';
import { generarOrdenVentaPDF } from '../utils/pdfGenerators/ordenVentaPDF.js';

export async function getAllOrdenesVenta(req, res) {
  try {
    const { estado, prioridad, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        ov.id_orden_venta,
        ov.numero_orden,
        ov.fecha_emision,
        ov.fecha_entrega_estimada,
        ov.fecha_entrega_real,
        ov.estado,
        ov.prioridad,
        ov.subtotal,
        ov.igv,
        ov.total,
        ov.moneda,
        ov.id_cotizacion,
        c.numero_cotizacion,
        cl.id_cliente,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        e_comercial.nombre_completo AS comercial,
        e_registrado.nombre_completo AS registrado_por,
        ov.id_comercial,
        ov.id_registrado_por,
        (SELECT COUNT(*) FROM detalle_orden_venta WHERE id_orden_venta = ov.id_orden_venta) AS total_items
      FROM ordenes_venta ov
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e_comercial ON ov.id_comercial = e_comercial.id_empleado
      LEFT JOIN empleados e_registrado ON ov.id_registrado_por = e_registrado.id_empleado
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      sql += ` AND ov.estado = ?`;
      params.push(estado);
    }
    
    if (prioridad) {
      sql += ` AND ov.prioridad = ?`;
      params.push(prioridad);
    }
    
    if (fecha_inicio) {
      sql += ` AND DATE(ov.fecha_emision) >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND DATE(ov.fecha_emision) <= ?`;
      params.push(fecha_fin);
    }
    
    sql += ` ORDER BY ov.fecha_emision DESC, ov.id_orden_venta DESC`;
    
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
    console.error('Error al obtener órdenes de venta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getOrdenVentaById(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(`
      SELECT 
        ov.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        cl.telefono AS telefono_cliente,
        e.nombre_completo AS comercial,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      WHERE ov.id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success) {
      return res.status(500).json({ 
        success: false,
        error: ordenResult.error 
      });
    }
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    const detalleResult = await executeQuery(`
      SELECT 
        dov.*,
        dov.subtotal AS valor_venta,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.requiere_receta,
        p.stock_actual AS stock_disponible,
        ti.nombre AS tipo_inventario_nombre
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      LEFT JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE dov.id_orden_venta = ?
      ORDER BY dov.id_detalle
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false,
        error: detalleResult.error 
      });
    }
    
    orden.detalle = detalleResult.data;
    
    res.json({
      success: true,
      data: orden
    });
    
  } catch (error) {
    console.error('Error al obtener orden de venta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function createOrdenVenta(req, res) {
  try {
    const {
      id_cliente,
      id_cotizacion,
      fecha_emision,
      fecha_entrega_estimada,
      prioridad,
      moneda,
      tipo_cambio,
      tipo_impuesto,
      porcentaje_impuesto,
      plazo_pago,
      forma_pago,
      orden_compra_cliente,
      direccion_entrega,
      lugar_entrega,
      ciudad_entrega,
      contacto_entrega,
      telefono_entrega,
      observaciones,
      id_comercial,
      detalle
    } = req.body;
    
    const id_registrado_por = req.user?.id_empleado || null;
    
    if (!id_cliente || !detalle || detalle.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cliente y detalle son obligatorios'
      });
    }
    
    if (!id_registrado_por) {
      return res.status(400).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
    
    const ultimaResult = await executeQuery(`
      SELECT numero_orden 
      FROM ordenes_venta 
      ORDER BY id_orden_venta DESC 
      LIMIT 1
    `);
    
    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_orden.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const numeroOrden = `OV-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;
    
    let subtotal = 0;
    for (const item of detalle) {
      const valorVenta = parseFloat(item.cantidad) * parseFloat(item.precio_unitario);
      const descuentoItem = valorVenta * (parseFloat(item.descuento_porcentaje || 0) / 100);
      subtotal += valorVenta - descuentoItem;
    }
    
    const porcentaje_imp = parseFloat(porcentaje_impuesto || 18);
    const impuesto = subtotal * (porcentaje_imp / 100);
    const total = subtotal + impuesto;
    
    const result = await executeQuery(`
      INSERT INTO ordenes_venta (
        numero_orden,
        id_cliente,
        id_cotizacion,
        fecha_emision,
        fecha_entrega_estimada,
        prioridad,
        moneda,
        tipo_cambio,
        tipo_impuesto,
        porcentaje_impuesto,
        plazo_pago,
        forma_pago,
        orden_compra_cliente,
        direccion_entrega,
        lugar_entrega,
        ciudad_entrega,
        contacto_entrega,
        telefono_entrega,
        observaciones,
        id_comercial,
        id_registrado_por,
        subtotal,
        igv,
        total,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
    `, [
      numeroOrden,
      id_cliente,
      id_cotizacion || null,
      fecha_emision,
      fecha_entrega_estimada || null,
      prioridad || 'Media',
      moneda,
      parseFloat(tipo_cambio || 1.0000),
      tipo_impuesto || 'IGV',
      porcentaje_imp,
      plazo_pago,
      forma_pago,
      orden_compra_cliente,
      direccion_entrega,
      lugar_entrega,
      ciudad_entrega,
      contacto_entrega,
      telefono_entrega,
      observaciones,
      id_comercial || null,
      id_registrado_por,
      subtotal,
      impuesto,
      total
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    const idOrden = result.data.insertId;
    
    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      
      await executeQuery(`
        INSERT INTO detalle_orden_venta (
          id_orden_venta,
          id_producto,
          cantidad,
          precio_unitario,
          descuento_porcentaje
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        idOrden,
        item.id_producto,
        parseFloat(item.cantidad),
        parseFloat(item.precio_unitario),
        parseFloat(item.descuento_porcentaje || 0)
      ]);
    }
    
    if (id_cotizacion) {
      await executeQuery(`
        UPDATE cotizaciones 
        SET estado = 'Convertida',
            id_orden_venta = ?
        WHERE id_cotizacion = ?
      `, [idOrden, id_cotizacion]);
    }
    
    res.status(201).json({
      success: true,
      data: {
        id_orden_venta: idOrden,
        numero_orden: numeroOrden
      },
      message: 'Orden de venta creada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al crear orden de venta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function actualizarEstadoOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { estado, fecha_entrega_real } = req.body;
    const id_usuario = req.user?.id_empleado || null;
    
    const estadosValidos = ['Pendiente', 'Confirmada', 'En Preparación', 'Despachada', 'Entregada', 'Cancelada'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }
    
    const ordenResult = await executeQuery(`
      SELECT * FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const ordenActual = ordenResult.data[0];
    const estadoAnterior = ordenActual.estado;
    
    if (estado === 'Entregada') {
      const detalleResult = await executeQuery(`
        SELECT * FROM detalle_orden_venta WHERE id_orden_venta = ?
      `, [id]);
      
      const pendientes = detalleResult.data.filter(d => 
        parseFloat(d.cantidad_despachada) < parseFloat(d.cantidad)
      );
      
      if (pendientes.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'No se puede marcar como entregada. Hay productos pendientes de despacho.'
        });
      }
    }
    
    // ====================================
    // CASO 1: Pendiente → Confirmada (RESERVAR STOCK)
    // ====================================
    if (estado === 'Confirmada' && estadoAnterior === 'Pendiente') {
      console.log('🔵 Iniciando reserva de stock para orden:', id);
      
      const detalleResult = await executeQuery(`
        SELECT 
          dov.id_detalle,
          dov.id_producto,
          dov.cantidad,
          dov.precio_unitario,
          dov.descuento_porcentaje,
          p.codigo AS codigo_producto,
          p.nombre AS producto,
          p.unidad_medida,
          p.stock_actual,
          p.costo_unitario_promedio,
          p.precio_venta,
          p.id_tipo_inventario
        FROM detalle_orden_venta dov
        INNER JOIN productos p ON dov.id_producto = p.id_producto
        WHERE dov.id_orden_venta = ?
      `, [id]);
      
      if (!detalleResult.success) {
        console.error('❌ Error al obtener detalle:', detalleResult.error);
        return res.status(500).json({
          success: false,
          error: 'Error al obtener detalle de la orden'
        });
      }
      
      console.log('📦 Productos encontrados:', detalleResult.data.length);
      
      // Validar stock disponible
      for (const item of detalleResult.data) {
        const stockDisponible = parseFloat(item.stock_actual);
        const cantidadRequerida = parseFloat(item.cantidad);
        
        console.log(`   - ${item.producto}: Stock=${stockDisponible}, Req=${cantidadRequerida}`);
        
        if (stockDisponible < cantidadRequerida) {
          return res.status(400).json({
            success: false,
            error: `Stock insuficiente para ${item.producto}. Disponible: ${stockDisponible}, Requerido: ${cantidadRequerida}`
          });
        }
      }
      
      // Obtener tipo de inventario (usar el del primer producto)
      const id_tipo_inventario = detalleResult.data[0].id_tipo_inventario || 4;
      
      console.log('📋 Tipo de inventario:', id_tipo_inventario);
      
      // Calcular totales
      let totalCosto = 0;
      let totalPrecio = 0;
      
      for (const item of detalleResult.data) {
        const costoUnitario = parseFloat(item.costo_unitario_promedio || 0);
        const precioUnitario = parseFloat(item.precio_unitario || 0);
        const cantidad = parseFloat(item.cantidad);
        const descuento = parseFloat(item.descuento_porcentaje || 0);
        
        // Calcular precio con descuento
        const precioConDescuento = precioUnitario * (1 - descuento / 100);
        
        totalCosto += cantidad * costoUnitario;
        totalPrecio += cantidad * precioConDescuento;
      }
      
      console.log('💰 Total Costo:', totalCosto, '| Total Precio:', totalPrecio);
      
      // ✅ CREAR SALIDA
      const salidaResult = await executeQuery(`
        INSERT INTO salidas (
          id_tipo_inventario,
          tipo_movimiento,
          id_cliente,
          total_costo,
          total_precio,
          moneda,
          id_registrado_por,
          observaciones,
          estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id_tipo_inventario,
        'Venta',
        ordenActual.id_cliente,
        totalCosto,
        totalPrecio,
        ordenActual.moneda || 'PEN',
        id_usuario,
        `[RESERVA] Orden de Venta ${ordenActual.numero_orden}`,
        'Activo'
      ]);
      
      if (!salidaResult.success) {
        console.error('❌ Error al crear salida:', salidaResult.error);
        return res.status(500).json({
          success: false,
          error: `Error al crear salida de reserva: ${salidaResult.error}`
        });
      }
      
      const id_salida = salidaResult.data.insertId;
      console.log('✅ Salida creada con ID:', id_salida);
      
      // ✅ INSERTAR DETALLE Y DESCONTAR STOCK
      let productosReservados = 0;
      
      for (const item of detalleResult.data) {
        const costoUnitario = parseFloat(item.costo_unitario_promedio || 0);
        const precioUnitario = parseFloat(item.precio_unitario || 0);
        const cantidad = parseFloat(item.cantidad);
        const descuento = parseFloat(item.descuento_porcentaje || 0);
        
        // Calcular precio con descuento
        const precioConDescuento = precioUnitario * (1 - descuento / 100);
        const subtotal = cantidad * precioConDescuento;
        
        console.log(`   📝 Insertando detalle: ${item.producto} (${cantidad} ${item.unidad_medida})`);
        
        // ✅ INSERTAR EN DETALLE_SALIDAS
        const detalleInsertResult = await executeQuery(`
          INSERT INTO detalle_salidas (
            id_salida,
            id_producto,
            cantidad,
            costo_unitario,
            precio_unitario,
            subtotal
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          id_salida,
          item.id_producto,
          cantidad,
          costoUnitario,
          precioConDescuento,
          subtotal
        ]);
        
        if (!detalleInsertResult.success) {
          console.error(`   ❌ Error insertando detalle para ${item.producto}:`, detalleInsertResult.error);
          
          // Rollback: eliminar salida creada
          await executeQuery('DELETE FROM salidas WHERE id_salida = ?', [id_salida]);
          
          return res.status(500).json({
            success: false,
            error: `Error al insertar detalle: ${detalleInsertResult.error}`
          });
        }
        
        console.log(`   ✅ Detalle insertado OK`);
        
        // ✅ DESCONTAR STOCK
        const stockUpdateResult = await executeQuery(`
          UPDATE productos 
          SET stock_actual = stock_actual - ?
          WHERE id_producto = ?
        `, [cantidad, item.id_producto]);
        
        if (!stockUpdateResult.success) {
          console.error(`   ❌ Error actualizando stock para ${item.producto}:`, stockUpdateResult.error);
        } else {
          console.log(`   ✅ Stock descontado: -${cantidad}`);
        }
        
        productosReservados++;
      }
      
      console.log('✅ Proceso completado:', productosReservados, 'productos reservados');
      
      // ✅ ACTUALIZAR ESTADO DE ORDEN
      await executeQuery(`
        UPDATE ordenes_venta 
        SET estado = ?,
            fecha_entrega_real = ?
        WHERE id_orden_venta = ?
      `, [estado, fecha_entrega_real || null, id]);
      
      return res.json({
        success: true,
        message: `Orden confirmada. Stock reservado exitosamente (Salida ID: ${id_salida})`,
        data: {
          id_salida,
          productos_reservados: productosReservados,
          total_costo: totalCosto,
          total_precio: totalPrecio
        }
      });
    }
    
    // ====================================
    // CASO 2: Confirmada → Cancelada (RESTAURAR STOCK)
    // ====================================
    if (estado === 'Cancelada' && estadoAnterior === 'Confirmada') {
      console.log('🔴 Iniciando cancelación de orden:', id);
      
      // Buscar salida de reserva asociada
      const salidaResult = await executeQuery(`
        SELECT id_salida 
        FROM salidas 
        WHERE id_cliente = ?
        AND tipo_movimiento = 'Venta'
        AND estado = 'Activo'
        AND observaciones LIKE ?
        ORDER BY fecha_movimiento DESC
        LIMIT 1
      `, [ordenActual.id_cliente, `%${ordenActual.numero_orden}%`]);
      
      if (salidaResult.success && salidaResult.data.length > 0) {
        const id_salida = salidaResult.data[0].id_salida;
        console.log('📦 Salida encontrada:', id_salida);
        
        // Obtener detalle de salida
        const detalleSalidaResult = await executeQuery(`
          SELECT id_producto, cantidad 
          FROM detalle_salidas 
          WHERE id_salida = ?
        `, [id_salida]);
        
        if (detalleSalidaResult.success) {
          console.log('📝 Restaurando stock de', detalleSalidaResult.data.length, 'productos');
          
          // ✅ RESTAURAR STOCK
          for (const item of detalleSalidaResult.data) {
            await executeQuery(`
              UPDATE productos 
              SET stock_actual = stock_actual + ?
              WHERE id_producto = ?
            `, [item.cantidad, item.id_producto]);
            
            console.log(`   ✅ Stock restaurado: +${item.cantidad} (Producto ${item.id_producto})`);
          }
        }
        
        // ✅ ANULAR SALIDA
        await executeQuery(`
          UPDATE salidas 
          SET estado = 'Anulado',
              observaciones = CONCAT(observaciones, ' - ANULADA: Orden de venta cancelada')
          WHERE id_salida = ?
        `, [id_salida]);
        
        console.log('✅ Salida anulada');
        
        // Actualizar estado de orden
        await executeQuery(`
          UPDATE ordenes_venta 
          SET estado = ?,
              fecha_entrega_real = ?
          WHERE id_orden_venta = ?
        `, [estado, fecha_entrega_real || null, id]);
        
        return res.json({
          success: true,
          message: `Orden cancelada. Stock restaurado exitosamente (Salida ID: ${id_salida} anulada)`,
          data: {
            id_salida_anulada: id_salida,
            productos_restaurados: detalleSalidaResult.data.length
          }
        });
      } else {
        console.log('⚠️ No se encontró salida de reserva para anular');
      }
    }
    
    // ====================================
    // OTROS CASOS: Solo actualizar estado
    // ====================================
    const result = await executeQuery(`
      UPDATE ordenes_venta 
      SET estado = ?,
          fecha_entrega_real = ?
      WHERE id_orden_venta = ?
    `, [estado, fecha_entrega_real || null, id]);
    
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

export async function actualizarPrioridadOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { prioridad } = req.body;
    
    const prioridadesValidas = ['Baja', 'Media', 'Alta', 'Urgente'];
    
    if (!prioridadesValidas.includes(prioridad)) {
      return res.status(400).json({
        success: false,
        error: 'Prioridad no válida'
      });
    }
    
    const result = await executeQuery(`
      UPDATE ordenes_venta 
      SET prioridad = ? 
      WHERE id_orden_venta = ?
    `, [prioridad, id]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.json({
      success: true,
      message: 'Prioridad actualizada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al actualizar prioridad:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function actualizarProgresoOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { detalle } = req.body;
    
    for (const item of detalle) {
      await executeQuery(`
        UPDATE detalle_orden_venta 
        SET cantidad_producida = ?,
            cantidad_despachada = ?
        WHERE id_detalle = ?
      `, [
        item.cantidad_producida || 0,
        item.cantidad_despachada || 0,
        item.id_detalle
      ]);
    }
    
    res.json({
      success: true,
      message: 'Progreso actualizado exitosamente'
    });
    
  } catch (error) {
    console.error('Error al actualizar progreso:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getEstadisticasOrdenesVenta(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_ordenes,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'Confirmada' THEN 1 ELSE 0 END) AS confirmadas,
        SUM(CASE WHEN estado = 'En Preparación' THEN 1 ELSE 0 END) AS en_proceso,
        SUM(CASE WHEN estado = 'Despachada' THEN 1 ELSE 0 END) AS despachadas,
        SUM(CASE WHEN estado = 'Entregada' THEN 1 ELSE 0 END) AS entregadas,
        SUM(CASE WHEN prioridad = 'Urgente' THEN 1 ELSE 0 END) AS urgentes,
        SUM(total) AS monto_total,
        COUNT(DISTINCT id_cliente) AS clientes_unicos
      FROM ordenes_venta
      WHERE estado != 'Cancelada'
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

export async function descargarPDFOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(`
      SELECT 
        ov.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        cl.telefono AS telefono_cliente,
        e_comercial.nombre_completo AS comercial,
        e_comercial.email AS email_comercial,
        e_registrado.nombre_completo AS registrado_por,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e_comercial ON ov.id_comercial = e_comercial.id_empleado
      LEFT JOIN empleados e_registrado ON ov.id_registrado_por = e_registrado.id_empleado
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      WHERE ov.id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    const detalleResult = await executeQuery(`
      SELECT 
        dov.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      WHERE dov.id_orden_venta = ?
      ORDER BY dov.id_detalle
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener detalle de la orden'
      });
    }
    
    orden.detalle = detalleResult.data;
    
    const pdfBuffer = await generarOrdenVentaPDF(orden);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="OrdenVenta-${orden.numero_orden}.pdf"`);
    res.send(pdfBuffer);
  //prueba
  } catch (error) {
    console.error('Error al generar PDF de orden de venta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}