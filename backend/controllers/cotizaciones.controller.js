import { executeQuery } from '../config/database.js';
import pool from '../config/database.js';

export async function getAllCotizaciones(req, res) {
  try {
    const { estado, prioridad, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        c.id_cotizacion,
        c.numero_cotizacion,
        DATE_FORMAT(c.fecha_emision, '%Y-%m-%d') as fecha_emision,
        DATE_FORMAT(c.fecha_vencimiento, '%Y-%m-%d') as fecha_vencimiento,
        c.estado,
        c.prioridad,
        c.subtotal,
        c.igv,
        c.total,
        c.moneda,
        c.tipo_impuesto,
        c.porcentaje_impuesto,
        c.tipo_cambio,
        c.observaciones,
        c.fecha_creacion,
        c.convertida_venta,
        c.id_orden_venta,
        cl.id_cliente,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        e.id_empleado AS id_comercial,
        e.nombre_completo AS comercial,
        (SELECT COUNT(*) FROM detalle_cotizacion WHERE id_cotizacion = c.id_cotizacion) AS total_items
      FROM cotizaciones c
      LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON c.id_comercial = e.id_empleado
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      sql += ` AND c.estado = ?`;
      params.push(estado);
    }
    
    if (prioridad) {
      sql += ` AND c.prioridad = ?`;
      params.push(prioridad);
    }
    
    if (fecha_inicio) {
      sql += ` AND DATE(c.fecha_emision) >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND DATE(c.fecha_emision) <= ?`;
      params.push(fecha_fin);
    }
    
    sql += ` ORDER BY c.fecha_creacion DESC`;
    
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getCotizacionById(req, res) {
  try {
    const { id } = req.params;
    
    const cotizacionResult = await executeQuery(`
      SELECT 
        c.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        e.nombre_completo AS comercial,
        e.email AS email_comercial
      FROM cotizaciones c
      LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON c.id_comercial = e.id_empleado
      WHERE c.id_cotizacion = ?
    `, [id]);
    
    if (!cotizacionResult.success) {
      return res.status(500).json({ 
        success: false,
        error: cotizacionResult.error 
      });
    }
    
    if (cotizacionResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }
    
    const cotizacion = cotizacionResult.data[0];
    
    const detalleResult = await executeQuery(`
      SELECT 
        dc.id_detalle,
        dc.id_cotizacion,
        dc.id_producto,
        dc.cantidad,
        dc.precio_unitario,
        dc.precio_base,
        dc.porcentaje_comision,
        dc.monto_comision,
        dc.descuento_porcentaje,
        dc.valor_venta,
        dc.subtotal,
        dc.orden,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.stock_actual AS stock_disponible,
        p.requiere_receta
      FROM detalle_cotizacion dc
      INNER JOIN productos p ON dc.id_producto = p.id_producto
      WHERE dc.id_cotizacion = ?
      ORDER BY dc.orden
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false,
        error: detalleResult.error 
      });
    }
    
    cotizacion.detalle = detalleResult.data || [];
    
    res.json({
      success: true,
      data: cotizacion
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function createCotizacion(req, res) {
  try {
    const {
      id_cliente,
      fecha_emision,
      prioridad,
      moneda,
      tipo_impuesto,
      porcentaje_impuesto,
      tipo_cambio,
      plazo_pago,         
      forma_pago,
      direccion_entrega,
      observaciones,
      id_comercial,        
      validez_dias,        
      plazo_entrega,
      lugar_entrega,
      detalle
    } = req.body;
    
    if (!id_cliente) {
      return res.status(400).json({
        success: false,
        error: 'Cliente es obligatorio'
      });
    }
    
    if (!detalle || detalle.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe agregar al menos un producto'
      });
    }
    
    if (!plazo_pago || plazo_pago.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Plazo de pago es obligatorio'
      });
    }
    
    const comercialFinal = id_comercial || req.user?.id_empleado;
    
    if (!comercialFinal) {
      return res.status(400).json({
        success: false,
        error: 'No se pudo determinar el comercial responsable'
      });
    }
    
    const fechaEmisionFinal = fecha_emision || new Date().toISOString().split('T')[0];
    const validezDiasFinal = parseInt(validez_dias) || 7;
    
    const fechaEmisionDate = new Date(fechaEmisionFinal);
    fechaEmisionDate.setDate(fechaEmisionDate.getDate() + validezDiasFinal);
    const fechaVencimientoCalculada = fechaEmisionDate.toISOString().split('T')[0];
    
    let tipoCambioFinal = parseFloat(tipo_cambio) || 1.0000;
    if (moneda === 'PEN') {
      tipoCambioFinal = 1.0000;
    }
    
    const ultimaResult = await executeQuery(`
      SELECT numero_cotizacion 
      FROM cotizaciones 
      ORDER BY id_cotizacion DESC 
      LIMIT 1
    `);
    
    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_cotizacion.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const numeroCotizacion = `COT-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;
    
    let subtotal = 0;
    let totalComision = 0;
    let sumaComisionPorcentual = 0;

    for (const item of detalle) {
      const precioBase = parseFloat(item.precio_base);
      const porcentajeComision = parseFloat(item.porcentaje_comision || 0);
      const montoComision = precioBase * (porcentajeComision / 100);
      const precioFinal = precioBase + montoComision;

      const valorVenta = (item.cantidad * precioFinal) * (1 - parseFloat(item.descuento_porcentaje || 0) / 100);
      subtotal += valorVenta;

      totalComision += montoComision * item.cantidad;
      sumaComisionPorcentual += porcentajeComision;
    }

    const porcentajeComisionPromedio = detalle.length > 0 ? sumaComisionPorcentual / detalle.length : 0;
    
    const tipoImpuestoFinal = tipo_impuesto || 'IGV';
    let porcentaje = 18.00;
    
    if (tipoImpuestoFinal === 'EXO' || tipoImpuestoFinal === 'INA') {
      porcentaje = 0.00;
    } else if (porcentaje_impuesto !== null && porcentaje_impuesto !== undefined) {
      porcentaje = parseFloat(porcentaje_impuesto);
    }
    
    const igv = subtotal * (porcentaje / 100);
    const total = subtotal + igv;
    
    const result = await executeQuery(`
      INSERT INTO cotizaciones (
        numero_cotizacion,
        id_cliente,
        id_comercial,
        fecha_emision,
        fecha_vencimiento,
        prioridad,
        moneda,
        tipo_impuesto,
        porcentaje_impuesto,
        tipo_cambio,
        plazo_pago,
        forma_pago,
        direccion_entrega,
        observaciones,
        validez_dias,
        plazo_entrega,
        lugar_entrega,
        subtotal,
        igv,
        total,
        total_comision,
        porcentaje_comision_promedio,
        estado,
        id_creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?)
    `, [
      numeroCotizacion,
      id_cliente,
      comercialFinal,                   
      fechaEmisionFinal,                 
      fechaVencimientoCalculada,         
      prioridad || 'Media',
      moneda || 'PEN',
      tipoImpuestoFinal,
      porcentaje,
      tipoCambioFinal,                   
      plazo_pago,                        
      forma_pago || null,
      direccion_entrega || null,
      observaciones || null,
      validezDiasFinal,                  
      plazo_entrega || null,
      lugar_entrega || null,
      subtotal,
      igv,
      total,
      totalComision,
      porcentajeComisionPromedio,
      comercialFinal                    
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    const idCotizacion = result.data.insertId;
    
    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      const precioBase = parseFloat(item.precio_base);
      const porcentajeComision = parseFloat(item.porcentaje_comision || 0);
      const montoComision = precioBase * (porcentajeComision / 100);
      const precioFinal = precioBase + montoComision;
      
      await executeQuery(`
        INSERT INTO detalle_cotizacion (
          id_cotizacion,
          id_producto,
          cantidad,
          precio_unitario,
          precio_base,
          porcentaje_comision,
          monto_comision,
          descuento_porcentaje,
          orden
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        idCotizacion,
        item.id_producto,
        parseFloat(item.cantidad),
        precioFinal,
        precioBase,
        porcentajeComision,
        montoComision,
        parseFloat(item.descuento_porcentaje || 0),
        i + 1
      ]);
    }
    
    res.status(201).json({
      success: true,
      data: {
        id_cotizacion: idCotizacion,
        numero_cotizacion: numeroCotizacion,
        fecha_vencimiento: fechaVencimientoCalculada,
        total_comision: totalComision,
        porcentaje_comision_promedio: porcentajeComisionPromedio
      },
      message: 'Cotización creada exitosamente'
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function updateCotizacion(req, res) {
  try {
    const { id } = req.params;
    const {
      id_cliente,
      fecha_emision,
      prioridad,
      moneda,
      tipo_impuesto,
      porcentaje_impuesto,
      tipo_cambio,
      plazo_pago,
      forma_pago,
      direccion_entrega,
      observaciones,
      id_comercial,
      validez_dias,
      plazo_entrega,
      lugar_entrega,
      detalle
    } = req.body;

    const cotizacionExistente = await executeQuery(`
      SELECT id_cotizacion, estado 
      FROM cotizaciones 
      WHERE id_cotizacion = ?
    `, [id]);

    if (!cotizacionExistente.success || cotizacionExistente.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }

    if (!id_cliente) {
      return res.status(400).json({
        success: false,
        error: 'Cliente es obligatorio'
      });
    }

    if (!detalle || detalle.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe agregar al menos un producto'
      });
    }

    if (!plazo_pago || plazo_pago.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Plazo de pago es obligatorio'
      });
    }

    const comercialFinal = id_comercial || req.user?.id_empleado;

    if (!comercialFinal) {
      return res.status(400).json({
        success: false,
        error: 'No se pudo determinar el comercial responsable'
      });
    }

    const fechaEmisionFinal = fecha_emision || new Date().toISOString().split('T')[0];
    const validezDiasFinal = parseInt(validez_dias) || 7;

    const fechaEmisionDate = new Date(fechaEmisionFinal);
    fechaEmisionDate.setDate(fechaEmisionDate.getDate() + validezDiasFinal);
    const fechaVencimientoCalculada = fechaEmisionDate.toISOString().split('T')[0];

    let tipoCambioFinal = parseFloat(tipo_cambio) || 1.0000;
    if (moneda === 'PEN') {
      tipoCambioFinal = 1.0000;
    }

    let subtotal = 0;
    let totalComision = 0;
    let sumaComisionPorcentual = 0;

    for (const item of detalle) {
      const precioBase = parseFloat(item.precio_base);
      const porcentajeComision = parseFloat(item.porcentaje_comision || 0);
      const montoComision = precioBase * (porcentajeComision / 100);
      const precioFinal = precioBase + montoComision;

      const valorVenta = (item.cantidad * precioFinal) * (1 - parseFloat(item.descuento_porcentaje || 0) / 100);
      subtotal += valorVenta;

      totalComision += montoComision * item.cantidad;
      sumaComisionPorcentual += porcentajeComision;
    }

    const porcentajeComisionPromedio = detalle.length > 0 ? sumaComisionPorcentual / detalle.length : 0;

    const tipoImpuestoFinal = tipo_impuesto || 'IGV';
    let porcentaje = 18.00;
    
    if (tipoImpuestoFinal === 'EXO' || tipoImpuestoFinal === 'INA') {
      porcentaje = 0.00;
    } else if (porcentaje_impuesto !== null && porcentaje_impuesto !== undefined) {
      porcentaje = parseFloat(porcentaje_impuesto);
    }

    const igv = subtotal * (porcentaje / 100);
    const total = subtotal + igv;

    const updateResult = await executeQuery(`
      UPDATE cotizaciones 
      SET 
        id_cliente = ?,
        id_comercial = ?,
        fecha_emision = ?,
        fecha_vencimiento = ?,
        prioridad = ?,
        moneda = ?,
        tipo_impuesto = ?,
        porcentaje_impuesto = ?,
        tipo_cambio = ?,
        plazo_pago = ?,
        forma_pago = ?,
        direccion_entrega = ?,
        observaciones = ?,
        validez_dias = ?,
        plazo_entrega = ?,
        lugar_entrega = ?,
        subtotal = ?,
        igv = ?,
        total = ?,
        total_comision = ?,
        porcentaje_comision_promedio = ?
      WHERE id_cotizacion = ?
    `, [
      id_cliente,
      comercialFinal,
      fechaEmisionFinal,
      fechaVencimientoCalculada,
      prioridad || 'Media',
      moneda || 'PEN',
      tipoImpuestoFinal,
      porcentaje,
      tipoCambioFinal,
      plazo_pago,
      forma_pago || null,
      direccion_entrega || null,
      observaciones || null,
      validezDiasFinal,
      plazo_entrega || null,
      lugar_entrega || null,
      subtotal,
      igv,
      total,
      totalComision,
      porcentajeComisionPromedio,
      id
    ]);

    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: updateResult.error
      });
    }

    await executeQuery(`
      DELETE FROM detalle_cotizacion 
      WHERE id_cotizacion = ?
    `, [id]);

    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      const precioBase = parseFloat(item.precio_base);
      const porcentajeComision = parseFloat(item.porcentaje_comision || 0);
      const montoComision = precioBase * (porcentajeComision / 100);
      const precioFinal = precioBase + montoComision;

      await executeQuery(`
        INSERT INTO detalle_cotizacion (
          id_cotizacion,
          id_producto,
          cantidad,
          precio_unitario,
          precio_base,
          porcentaje_comision,
          monto_comision,
          descuento_porcentaje,
          orden
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        item.id_producto,
        item.cantidad,
        precioFinal,
        precioBase,
        porcentajeComision,
        montoComision,
        item.descuento_porcentaje || 0,
        i + 1
      ]);
    }

    res.json({
      success: true,
      message: 'Cotización actualizada exitosamente'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function duplicarCotizacion(req, res) {
  try {
    const { id } = req.params;

    const cotizacionResult = await executeQuery(`
      SELECT * FROM cotizaciones WHERE id_cotizacion = ?
    `, [id]);

    if (!cotizacionResult.success || cotizacionResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }

    const cotizacionOriginal = cotizacionResult.data[0];

    const detalleResult = await executeQuery(`
      SELECT * FROM detalle_cotizacion WHERE id_cotizacion = ?
      ORDER BY orden
    `, [id]);

    if (!detalleResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener detalle de cotización'
      });
    }

    const fechaEmisionFinal = new Date().toISOString().split('T')[0];
    const validezDiasFinal = parseInt(cotizacionOriginal.validez_dias) || 7;

    const fechaEmisionDate = new Date(fechaEmisionFinal);
    fechaEmisionDate.setDate(fechaEmisionDate.getDate() + validezDiasFinal);
    const fechaVencimientoCalculada = fechaEmisionDate.toISOString().split('T')[0];

    const ultimaResult = await executeQuery(`
      SELECT numero_cotizacion 
      FROM cotizaciones 
      ORDER BY id_cotizacion DESC 
      LIMIT 1
    `);

    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_cotizacion.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }

    const numeroCotizacion = `COT-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;

    const insertResult = await executeQuery(`
      INSERT INTO cotizaciones (
        numero_cotizacion,
        id_cliente,
        id_comercial,
        fecha_emision,
        fecha_vencimiento,
        prioridad,
        moneda,
        tipo_impuesto,
        porcentaje_impuesto,
        tipo_cambio,
        plazo_pago,
        forma_pago,
        direccion_entrega,
        observaciones,
        validez_dias,
        plazo_entrega,
        lugar_entrega,
        subtotal,
        igv,
        total,
        total_comision,
        porcentaje_comision_promedio,
        estado,
        id_creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?)
    `, [
      numeroCotizacion,
      cotizacionOriginal.id_cliente,
      cotizacionOriginal.id_comercial,
      fechaEmisionFinal,
      fechaVencimientoCalculada,
      cotizacionOriginal.prioridad,
      cotizacionOriginal.moneda,
      cotizacionOriginal.tipo_impuesto,
      cotizacionOriginal.porcentaje_impuesto,
      cotizacionOriginal.tipo_cambio,
      cotizacionOriginal.plazo_pago,
      cotizacionOriginal.forma_pago,
      cotizacionOriginal.direccion_entrega,
      cotizacionOriginal.observaciones,
      validezDiasFinal,
      cotizacionOriginal.plazo_entrega,
      cotizacionOriginal.lugar_entrega,
      cotizacionOriginal.subtotal,
      cotizacionOriginal.igv,
      cotizacionOriginal.total,
      cotizacionOriginal.total_comision || 0,
      cotizacionOriginal.porcentaje_comision_promedio || 0,
      req.user?.id_empleado || cotizacionOriginal.id_comercial
    ]);

    if (!insertResult.success) {
      return res.status(500).json({
        success: false,
        error: insertResult.error
      });
    }

    const idNuevaCotizacion = insertResult.data.insertId;

    for (let i = 0; i < detalleResult.data.length; i++) {
      const item = detalleResult.data[i];

      await executeQuery(`
        INSERT INTO detalle_cotizacion (
          id_cotizacion,
          id_producto,
          cantidad,
          precio_unitario,
          precio_base,
          porcentaje_comision,
          monto_comision,
          descuento_porcentaje,
          orden
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        idNuevaCotizacion,
        item.id_producto,
        item.cantidad,
        item.precio_unitario,
        item.precio_base || item.precio_unitario,
        item.porcentaje_comision || 0,
        item.monto_comision || 0,
        item.descuento_porcentaje,
        i + 1
      ]);
    }

    res.status(201).json({
      success: true,
      data: {
        id_cotizacion: idNuevaCotizacion,
        numero_cotizacion: numeroCotizacion,
        fecha_vencimiento: fechaVencimientoCalculada
      },
      message: 'Cotización duplicada exitosamente'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function actualizarEstadoCotizacion(req, res) {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    const estadosValidos = ['Pendiente', 'Enviada', 'Aprobada', 'Rechazada', 'Convertida', 'Vencida'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }

    await connection.beginTransaction();

    const [cotizaciones] = await connection.query(`
      SELECT * FROM cotizaciones WHERE id_cotizacion = ?
    `, [id]);

    if (cotizaciones.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }

    const cotizacion = cotizaciones[0];
    const estadoAnterior = cotizacion.estado;

    if (estado === 'Aprobada' && estadoAnterior !== 'Aprobada' && !cotizacion.convertida_venta) {
      
      const [ultimaOrden] = await connection.query(`
        SELECT numero_orden FROM ordenes_venta 
        ORDER BY id_orden_venta DESC LIMIT 1
      `);

      let numeroSecuencia = 1;
      if (ultimaOrden.length > 0) {
        const match = ultimaOrden[0].numero_orden.match(/(\d+)$/);
        if (match) {
          numeroSecuencia = parseInt(match[1]) + 1;
        }
      }

      const numeroOrden = `OV-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;

      const [ordenResult] = await connection.query(`
        INSERT INTO ordenes_venta (
          numero_orden,
          id_cotizacion,
          id_cliente,
          id_comercial,
          fecha_emision,
          prioridad,
          moneda,
          tipo_impuesto,
          porcentaje_impuesto,
          tipo_cambio,
          subtotal,
          igv,
          total,
          plazo_pago,
          forma_pago,
          direccion_entrega,
          lugar_entrega,
          observaciones,
          id_registrado_por,
          estado
        ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En Espera')
      `, [
        numeroOrden,
        cotizacion.id_cotizacion,
        cotizacion.id_cliente,
        cotizacion.id_comercial,
        cotizacion.prioridad || 'Media',
        cotizacion.moneda || 'PEN',
        cotizacion.tipo_impuesto || 'IGV',
        cotizacion.porcentaje_impuesto || 18.00,
        cotizacion.tipo_cambio || 1.0000,
        cotizacion.subtotal,
        cotizacion.igv,
        cotizacion.total,
        cotizacion.plazo_pago,
        cotizacion.forma_pago,
        cotizacion.direccion_entrega,
        cotizacion.lugar_entrega,
        cotizacion.observaciones,
        req.user?.id_empleado || cotizacion.id_comercial
      ]);

      const idOrdenVenta = ordenResult.insertId;

      const [detalles] = await connection.query(`
        SELECT * FROM detalle_cotizacion WHERE id_cotizacion = ? ORDER BY orden
      `, [id]);

      for (const detalle of detalles) {
        await connection.query(`
          INSERT INTO detalle_orden_venta (
            id_orden_venta,
            id_producto,
            cantidad,
            precio_unitario,
            descuento_porcentaje,
            orden
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          idOrdenVenta,
          detalle.id_producto,
          detalle.cantidad,
          detalle.precio_unitario,
          detalle.descuento_porcentaje || 0,
          detalle.orden
        ]);
      }

      await connection.query(`
        UPDATE cotizaciones 
        SET estado = 'Convertida',
            convertida_venta = 1,
            id_orden_venta = ?
        WHERE id_cotizacion = ?
      `, [idOrdenVenta, id]);

      await connection.commit();

      res.json({
        success: true,
        message: `Cotización aprobada y convertida a Orden de Venta ${numeroOrden}`,
        data: {
          id_orden_venta: idOrdenVenta,
          numero_orden: numeroOrden
        }
      });

    } else {
      await connection.query(`
        UPDATE cotizaciones 
        SET estado = ? 
        WHERE id_cotizacion = ?
      `, [estado, id]);

      await connection.commit();

      res.json({
        success: true,
        message: 'Estado actualizado exitosamente'
      });
    }
    
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    connection.release();
  }
}

export async function actualizarPrioridadCotizacion(req, res) {
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
      UPDATE cotizaciones 
      SET prioridad = ? 
      WHERE id_cotizacion = ?
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getEstadisticasCotizaciones(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_cotizaciones,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'Enviada' THEN 1 ELSE 0 END) AS enviadas,
        SUM(CASE WHEN estado = 'Aprobada' THEN 1 ELSE 0 END) AS aprobadas,
        SUM(CASE WHEN estado = 'Rechazada' THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN estado = 'Convertida' THEN 1 ELSE 0 END) AS convertidas,
        SUM(total) AS monto_total,
        COUNT(DISTINCT id_cliente) AS clientes_unicos,
        COUNT(DISTINCT id_comercial) AS comerciales_activos
      FROM cotizaciones
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
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function descargarPDFCotizacion(req, res) {
  try {
    const { id } = req.params;
    
    const cotizacionResult = await executeQuery(`
      SELECT 
        c.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        cl.telefono AS telefono_cliente,
        cl.email AS email_cliente,
        e.nombre_completo AS comercial,
        e.email AS email_comercial
      FROM cotizaciones c
      LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON c.id_comercial = e.id_empleado
      WHERE c.id_cotizacion = ?
    `, [id]);
    
    if (!cotizacionResult.success || cotizacionResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }
    
    const cotizacion = cotizacionResult.data[0];
    
    const detalleResult = await executeQuery(`
      SELECT 
        dc.id_detalle,
        dc.cantidad,
        dc.precio_unitario,
        dc.descuento_porcentaje,
        dc.valor_venta,
        dc.orden,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_cotizacion dc
      INNER JOIN productos p ON dc.id_producto = p.id_producto
      WHERE dc.id_cotizacion = ?
      ORDER BY dc.orden
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener detalle de cotización'
      });
    }
    
    cotizacion.detalle = detalleResult.data;
    
    const { generarCotizacionPDF } = await import('../utils/pdfGenerators/cotizacionPDF.js');
    const pdfBuffer = await generarCotizacionPDF(cotizacion);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Cotizacion-${cotizacion.numero_cotizacion}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al generar PDF'
    });
  }
}