// backend/controllers/ordenes-compra.controller.js
import { executeQuery } from '../config/database.js';

// ✅ OBTENER TODAS LAS ÓRDENES CON FILTROS
export async function getAllOrdenesCompra(req, res) {
  try {
    const { estado, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        oc.id_orden_compra,
        oc.numero_orden,
        oc.fecha_pedido,
        oc.fecha_confirmacion,
        oc.fecha_recepcion,
        oc.entrega_esperada,
        oc.estado,
        oc.subtotal,
        oc.igv,
        oc.total,
        oc.moneda,
        oc.condicion_pago,
        oc.forma_pago,
        p.id_proveedor,
        p.razon_social AS proveedor,
        p.ruc AS ruc_proveedor,
        e.nombre_completo AS elaborado_por,
        (SELECT COUNT(*) FROM detalle_orden_compra WHERE id_orden_compra = oc.id_orden_compra) AS total_items
      FROM ordenes_compra oc
      LEFT JOIN proveedores p ON oc.id_proveedor = p.id_proveedor
      LEFT JOIN empleados e ON oc.id_elaborado_por = e.id_empleado
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      sql += ` AND oc.estado = ?`;
      params.push(estado);
    }
    
    if (fecha_inicio) {
      sql += ` AND DATE(oc.fecha_pedido) >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND DATE(oc.fecha_pedido) <= ?`;
      params.push(fecha_fin);
    }
    
    sql += ` ORDER BY oc.fecha_creacion DESC`;
    
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
    console.error('Error al obtener órdenes de compra:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ OBTENER ORDEN POR ID CON DETALLE
export async function getOrdenCompraById(req, res) {
  try {
    const { id } = req.params;
    
    // Orden principal
    const ordenResult = await executeQuery(`
      SELECT 
        oc.*,
        p.razon_social AS proveedor,
        p.ruc AS ruc_proveedor,
        p.direccion AS direccion_proveedor,
        p.telefono AS telefono_proveedor,
        e.nombre_completo AS elaborado_por
      FROM ordenes_compra oc
      LEFT JOIN proveedores p ON oc.id_proveedor = p.id_proveedor
      LEFT JOIN empleados e ON oc.id_elaborado_por = e.id_empleado
      WHERE oc.id_orden_compra = ?
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
        error: 'Orden de compra no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    // Detalle de la orden
    const detalleResult = await executeQuery(`
      SELECT 
        doc.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        ti.nombre AS tipo_inventario_nombre,
        (
          SELECT stock_actual 
          FROM stock_productos 
          WHERE id_producto = doc.id_producto 
          LIMIT 1
        ) AS stock_actual
      FROM detalle_orden_compra doc
      INNER JOIN productos p ON doc.id_producto = p.id_producto
      LEFT JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE doc.id_orden_compra = ?
      ORDER BY doc.orden
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
    console.error('Error al obtener orden de compra:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ CREAR ORDEN DE COMPRA
export async function createOrdenCompra(req, res) {
  try {
    const {
      id_proveedor,
      fecha_pedido,
      fecha_confirmacion,
      entrega_esperada,
      condicion_pago,
      forma_pago,
      lugar_entrega,
      moneda,
      observaciones,
      id_elaborado_por,
      detalle
    } = req.body;
    
    // Validaciones
    if (!id_proveedor || !detalle || detalle.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Proveedor y detalle son obligatorios'
      });
    }
    
    // Generar número de orden
    const ultimaResult = await executeQuery(`
      SELECT numero_orden 
      FROM ordenes_compra 
      ORDER BY id_orden_compra DESC 
      LIMIT 1
    `);
    
    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_orden.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const numeroOrden = `OC-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;
    
    // Calcular totales
    let subtotal = 0;
    for (const item of detalle) {
      const valorCompra = parseFloat(item.cantidad) * parseFloat(item.valor_unitario);
      subtotal += valorCompra;
    }
    
    const igv = subtotal * 0.18;
    const total = subtotal + igv;
    
    // Insertar orden
    const result = await executeQuery(`
      INSERT INTO ordenes_compra (
        numero_orden,
        id_proveedor,
        fecha_pedido,
        fecha_confirmacion,
        entrega_esperada,
        condicion_pago,
        forma_pago,
        lugar_entrega,
        moneda,
        observaciones,
        id_elaborado_por,
        subtotal,
        igv,
        total,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
    `, [
      numeroOrden,
      id_proveedor,
      fecha_pedido,
      fecha_confirmacion || null,
      entrega_esperada || null,
      condicion_pago,
      forma_pago,
      lugar_entrega,
      moneda,
      observaciones,
      id_elaborado_por || null,
      subtotal,
      igv,
      total
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    const idOrden = result.data.insertId;
    
    // Insertar detalle
    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      const valorCompra = parseFloat(item.cantidad) * parseFloat(item.valor_unitario);
      
      await executeQuery(`
        INSERT INTO detalle_orden_compra (
          id_orden_compra,
          id_producto,
          cantidad,
          valor_unitario,
          valor_compra,
          orden
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        idOrden,
        item.id_producto,
        item.cantidad,
        item.valor_unitario,
        valorCompra,
        item.orden || (i + 1)
      ]);
    }
    
    res.status(201).json({
      success: true,
      data: {
        id_orden_compra: idOrden,
        numero_orden: numeroOrden
      },
      message: 'Orden de compra creada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al crear orden de compra:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ ACTUALIZAR ESTADO
export async function actualizarEstadoOrdenCompra(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    const estadosValidos = ['Pendiente', 'Confirmada', 'En Tránsito', 'Recibida', 'Cancelada'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }
    
    let sql = 'UPDATE ordenes_compra SET estado = ?';
    const params = [estado];
    
    // Si es confirmada, agregar fecha de confirmación
    if (estado === 'Confirmada') {
      sql += ', fecha_confirmacion = NOW()';
    }
    
    sql += ' WHERE id_orden_compra = ?';
    params.push(id);
    
    const result = await executeQuery(sql, params);
    
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

// ✅ RECIBIR ORDEN (GENERA ENTRADAS AUTOMÁTICAS Y ACTUALIZA CUP)
export async function recibirOrdenCompra(req, res) {
  try {
    const { id } = req.params;
    const { fecha_recepcion, observaciones } = req.body;
    
    // Obtener orden de compra
    const ordenResult = await executeQuery(`
      SELECT * FROM ordenes_compra WHERE id_orden_compra = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de compra no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    if (orden.estado === 'Recibida') {
      return res.status(400).json({
        success: false,
        error: 'Esta orden ya fue recibida'
      });
    }
    
    // Obtener detalle
    const detalleResult = await executeQuery(`
      SELECT doc.*, p.id_tipo_inventario
      FROM detalle_orden_compra doc
      INNER JOIN productos p ON doc.id_producto = p.id_producto
      WHERE doc.id_orden_compra = ?
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false,
        error: detalleResult.error 
      });
    }
    
    const detalle = detalleResult.data;
    
    // Generar código de entrada
    const ultimaEntradaResult = await executeQuery(`
      SELECT codigo FROM entradas 
      ORDER BY id_entrada DESC 
      LIMIT 1
    `);
    
    let numeroSecuencia = 1;
    if (ultimaEntradaResult.success && ultimaEntradaResult.data.length > 0) {
      const match = ultimaEntradaResult.data[0].codigo.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const codigoEntrada = `ENT-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(6, '0')}`;
    
    // Procesar cada producto
    for (const item of detalle) {
      // Insertar entrada
      await executeQuery(`
        INSERT INTO entradas (
          codigo,
          id_tipo_inventario,
          tipo_movimiento,
          id_producto,
          cantidad,
          costo_unitario,
          costo_total,
          fecha_movimiento,
          observaciones,
          id_orden_compra
        ) VALUES (?, ?, 'Compra', ?, ?, ?, ?, ?, ?, ?)
      `, [
        codigoEntrada,
        item.id_tipo_inventario,
        item.id_producto,
        item.cantidad,
        item.valor_unitario,
        item.valor_compra,
        fecha_recepcion || new Date().toISOString().split('T')[0],
        observaciones || `Recepción de ${orden.numero_orden}`,
        id
      ]);
      
      // Verificar stock existente
      const stockResult = await executeQuery(`
        SELECT * FROM stock_productos WHERE id_producto = ?
      `, [item.id_producto]);
      
      if (stockResult.success && stockResult.data.length > 0) {
        // Actualizar stock existente con nuevo CUP
        const stock = stockResult.data[0];
        const nuevaCantidad = parseFloat(stock.stock_actual) + parseFloat(item.cantidad);
        
        // Calcular nuevo CUP (Costo Unitario Promedio)
        const costoTotalAnterior = parseFloat(stock.stock_actual) * parseFloat(stock.costo_unitario_promedio);
        const costoTotalNuevo = parseFloat(item.valor_compra);
        const nuevoCUP = (costoTotalAnterior + costoTotalNuevo) / nuevaCantidad;
        
        await executeQuery(`
          UPDATE stock_productos 
          SET stock_actual = ?,
              costo_unitario_promedio = ?,
              fecha_ultimo_movimiento = NOW()
          WHERE id_producto = ?
        `, [nuevaCantidad, nuevoCUP, item.id_producto]);
      } else {
        // Crear nuevo registro de stock
        await executeQuery(`
          INSERT INTO stock_productos (
            id_producto,
            id_tipo_inventario,
            stock_actual,
            costo_unitario_promedio,
            fecha_ultimo_movimiento
          ) VALUES (?, ?, ?, ?, NOW())
        `, [
          item.id_producto,
          item.id_tipo_inventario,
          item.cantidad,
          item.valor_unitario
        ]);
      }
    }
    
    // Actualizar estado de la orden
    await executeQuery(`
      UPDATE ordenes_compra 
      SET estado = 'Recibida',
          fecha_recepcion = ?
      WHERE id_orden_compra = ?
    `, [fecha_recepcion || new Date().toISOString().split('T')[0], id]);
    
    res.json({
      success: true,
      message: 'Orden recibida exitosamente. Se actualizó el stock y CUP de los productos.'
    });
    
  } catch (error) {
    console.error('Error al recibir orden:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ OBTENER PRODUCTOS POR PROVEEDOR (HISTORIAL)
export async function getProductosPorProveedor(req, res) {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(`
      SELECT 
        p.id_producto,
        p.codigo,
        p.nombre,
        p.unidad_medida,
        AVG(doc.valor_unitario) AS precio_promedio,
        COUNT(DISTINCT doc.id_orden_compra) AS total_ordenes,
        SUM(doc.cantidad) AS cantidad_total
      FROM detalle_orden_compra doc
      INNER JOIN ordenes_compra oc ON doc.id_orden_compra = oc.id_orden_compra
      INNER JOIN productos p ON doc.id_producto = p.id_producto
      WHERE oc.id_proveedor = ?
      GROUP BY p.id_producto
      ORDER BY total_ordenes DESC, cantidad_total DESC
      LIMIT 20
    `, [id]);
    
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
    console.error('Error al obtener productos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ OBTENER ESTADÍSTICAS
export async function getEstadisticasOrdenesCompra(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_ordenes,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'Confirmada' THEN 1 ELSE 0 END) AS confirmadas,
        SUM(CASE WHEN estado = 'En Tránsito' THEN 1 ELSE 0 END) AS en_transito,
        SUM(CASE WHEN estado = 'Recibida' THEN 1 ELSE 0 END) AS recibidas,
        SUM(total) AS monto_total,
        COUNT(DISTINCT id_proveedor) AS proveedores_unicos
      FROM ordenes_compra
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

// ✅ DESCARGAR PDF
export async function descargarPDFOrdenCompra(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(`
      SELECT 
        oc.*,
        p.razon_social AS proveedor,
        p.ruc AS ruc_proveedor,
        p.direccion AS direccion_proveedor,
        e.nombre_completo AS elaborado_por
      FROM ordenes_compra oc
      LEFT JOIN proveedores p ON oc.id_proveedor = p.id_proveedor
      LEFT JOIN empleados e ON oc.id_elaborado_por = e.id_empleado
      WHERE oc.id_orden_compra = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    const detalleResult = await executeQuery(`
      SELECT 
        doc.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_orden_compra doc
      INNER JOIN productos p ON doc.id_producto = p.id_producto
      WHERE doc.id_orden_compra = ?
      ORDER BY doc.orden
    `, [id]);
    
    orden.detalle = detalleResult.data;
    
    // TODO: Implementar generación de PDF
    res.json({
      success: true,
      data: orden,
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