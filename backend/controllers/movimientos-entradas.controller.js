import pool from '../config/database.js';
import { generarPDFEntrada } from '../utils/pdf-generator.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const validarProductosInventario = async (req, res, next) => {
  try {
    const { detalles } = req.body;

    if (!detalles || detalles.length === 0) {
      return res.json({
        success: true,
        conflicts: []
      });
    }

    const conflicts = [];

    for (const detalle of detalles) {
      if (!detalle.id_producto || !detalle.id_tipo_inventario) {
        continue;
      }

      const [producto] = await pool.query(`
        SELECT 
          p.id_producto,
          p.codigo,
          p.nombre,
          p.id_tipo_inventario AS inventario_actual,
          ti_actual.nombre AS nombre_inventario_actual,
          p.stock_actual,
          ti_destino.nombre AS nombre_inventario_destino
        FROM productos p
        INNER JOIN tipos_inventario ti_actual ON p.id_tipo_inventario = ti_actual.id_tipo_inventario
        CROSS JOIN tipos_inventario ti_destino
        WHERE p.id_producto = ?
          AND p.id_tipo_inventario != ?
          AND ti_destino.id_tipo_inventario = ?
          AND p.estado = 'Activo'
      `, [detalle.id_producto, detalle.id_tipo_inventario, detalle.id_tipo_inventario]);

      if (producto.length > 0) {
        const p = producto[0];
        conflicts.push({
          id_producto: p.id_producto,
          codigo: p.codigo,
          nombre: p.nombre,
          producto_nombre: p.nombre,
          producto_codigo: p.codigo,
          inventario_actual: p.nombre_inventario_actual,
          id_inventario_actual: p.inventario_actual,
          inventario_destino: p.nombre_inventario_destino,
          id_inventario_destino: detalle.id_tipo_inventario,
          stock_actual: parseFloat(p.stock_actual)
        });
      }
    }

    res.json({
      success: true,
      conflicts
    });
  } catch (error) {
    next(error);
  }
};

export const crearProductoMultiInventario = async (req, res, next) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { 
      id_producto_original, 
      id_tipo_inventario_destino,
      codigo_nuevo,
      crear_nuevo 
    } = req.body;

    const [productoOriginal] = await connection.query(
      'SELECT * FROM productos WHERE id_producto = ?',
      [id_producto_original]
    );

    if (productoOriginal.length === 0) {
      throw new AppError('Producto original no encontrado', 404);
    }

    const producto = productoOriginal[0];

    if (crear_nuevo) {
      const [existeCodigo] = await connection.query(
        'SELECT id_producto FROM productos WHERE codigo = ? AND estado = "Activo"',
        [codigo_nuevo || `${producto.codigo}-${id_tipo_inventario_destino}`]
      );

      if (existeCodigo.length > 0) {
        throw new AppError('Ya existe un producto con ese código', 400);
      }

      const [result] = await connection.query(`
        INSERT INTO productos (
          codigo, nombre, descripcion, id_categoria, id_tipo_inventario,
          unidad_medida, costo_unitario_promedio, precio_venta, stock_actual,
          stock_minimo, stock_maximo, requiere_receta, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'Activo')
      `, [
        codigo_nuevo || `${producto.codigo}-${id_tipo_inventario_destino}`,
        producto.nombre,
        producto.descripcion,
        producto.id_categoria,
        id_tipo_inventario_destino,
        producto.unidad_medida,
        producto.costo_unitario_promedio,
        producto.precio_venta,
        producto.stock_minimo,
        producto.stock_maximo,
        producto.requiere_receta
      ]);

      await connection.commit();

      res.json({
        success: true,
        message: 'Producto creado exitosamente en el nuevo inventario',
        data: {
          id_producto: result.insertId,
          codigo: codigo_nuevo || `${producto.codigo}-${id_tipo_inventario_destino}`
        }
      });
    } else {
      await connection.commit();
      
      res.json({
        success: true,
        message: 'Operación confirmada',
        data: {
          id_producto: id_producto_original
        }
      });
    }
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

export const getAllEntradas = async (req, res, next) => {
  try {
    const { estado, id_tipo_inventario, fecha_desde, fecha_hasta } = req.query;
    
    let query = `
      SELECT 
        e.id_entrada,
        e.id_tipo_inventario,
        ti.nombre AS tipo_inventario,
        e.id_proveedor,
        prov.razon_social AS proveedor,
        e.documento_soporte,
        e.total_costo,
        e.moneda,
        e.id_registrado_por,
        emp.nombre_completo AS registrado_por,
        e.fecha_movimiento,
        e.observaciones,
        e.estado,
        COUNT(DISTINCT de.id_producto) AS num_productos,
        GROUP_CONCAT(
          DISTINCT CONCAT(p.nombre, ' (', de.cantidad, ' ', p.unidad_medida, ')')
          ORDER BY p.nombre
          SEPARATOR ', '
        ) AS productos_resumen
      FROM entradas e
      INNER JOIN tipos_inventario ti ON e.id_tipo_inventario = ti.id_tipo_inventario
      LEFT JOIN proveedores prov ON e.id_proveedor = prov.id_proveedor
      INNER JOIN empleados emp ON e.id_registrado_por = emp.id_empleado
      LEFT JOIN detalle_entradas de ON e.id_entrada = de.id_entrada
      LEFT JOIN productos p ON de.id_producto = p.id_producto
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      query += ' AND e.estado = ?';
      params.push(estado);
    }
    
    if (id_tipo_inventario) {
      query += ' AND e.id_tipo_inventario = ?';
      params.push(id_tipo_inventario);
    }
    
    if (fecha_desde) {
      query += ' AND DATE(e.fecha_movimiento) >= ?';
      params.push(fecha_desde);
    }
    
    if (fecha_hasta) {
      query += ' AND DATE(e.fecha_movimiento) <= ?';
      params.push(fecha_hasta);
    }
    
    query += ` 
      GROUP BY 
        e.id_entrada,
        e.id_tipo_inventario,
        ti.nombre,
        e.id_proveedor,
        prov.razon_social,
        e.documento_soporte,
        e.total_costo,
        e.moneda,
        e.id_registrado_por,
        emp.nombre_completo,
        e.fecha_movimiento,
        e.observaciones,
        e.estado
      ORDER BY e.fecha_movimiento DESC
    `;
    
    const [entradas] = await pool.query(query, params);
    
    res.json({
      success: true,
      data: entradas
    });
  } catch (error) {
    next(error);
  }
};

export const getEntradaById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [entradas] = await pool.query(`
      SELECT 
        e.*,
        ti.nombre AS tipo_inventario,
        prov.razon_social AS proveedor,
        emp.nombre_completo AS registrado_por
      FROM entradas e
      INNER JOIN tipos_inventario ti ON e.id_tipo_inventario = ti.id_tipo_inventario
      LEFT JOIN proveedores prov ON e.id_proveedor = prov.id_proveedor
      INNER JOIN empleados emp ON e.id_registrado_por = emp.id_empleado
      WHERE e.id_entrada = ?
    `, [id]);
    
    if (entradas.length === 0) {
      throw new AppError('Entrada no encontrada', 404);
    }
    
    const [detalles] = await pool.query(`
      SELECT 
        de.*,
        p.codigo,
        p.nombre AS producto,
        p.unidad_medida,
        p.id_tipo_inventario,
        ti.nombre AS tipo_inventario_producto
      FROM detalle_entradas de
      INNER JOIN productos p ON de.id_producto = p.id_producto
      INNER JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE de.id_entrada = ?
    `, [id]);
    
    const entrada = {
      ...entradas[0],
      detalles
    };
    
    res.json({
      success: true,
      data: entrada
    });
  } catch (error) {
    next(error);
  }
};

export const createEntrada = async (req, res, next) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const {
      id_tipo_inventario,
      tipo_entrada,
      id_proveedor,
      documento_soporte,
      id_registrado_por,
      moneda,
      porcentaje_igv,
      id_cuenta_pago,
      observaciones,
      detalles
    } = req.body;
    
    if (!detalles || detalles.length === 0) {
      throw new AppError('Debe agregar al menos un producto', 400);
    }
    
    const subtotal = detalles.reduce((sum, d) => {
      return sum + (parseFloat(d.cantidad) * parseFloat(d.costo_unitario));
    }, 0);

    const porcentaje = porcentaje_igv !== null && porcentaje_igv !== undefined 
      ? parseFloat(porcentaje_igv) 
      : 18.00;
    
    const igv = subtotal * (porcentaje / 100);
    const total = subtotal + igv;

    const tipoInventarioPrincipal = id_tipo_inventario || detalles[0].id_tipo_inventario;
    const tipoEntradaFinal = tipo_entrada || 'Compra';
    
    const [resultEntrada] = await connection.query(`
      INSERT INTO entradas ( 
        id_tipo_inventario,
        tipo_entrada,
        id_proveedor,
        documento_soporte,
        total_costo,
        subtotal,
        igv,
        total,
        porcentaje_igv,
        moneda,
        monto_pagado,
        estado_pago,
        id_cuenta_pago,
        id_registrado_por,
        observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tipoInventarioPrincipal,
      tipoEntradaFinal,
      id_proveedor || null,
      documento_soporte || null,
      subtotal,
      subtotal,
      igv,
      total,
      porcentaje,
      moneda || 'PEN',
      0,
      tipoEntradaFinal === 'Compra' ? 'Pendiente' : null,
      id_cuenta_pago || null,
      id_registrado_por,
      observaciones || null
    ]);
    
    const id_entrada = resultEntrada.insertId;
    
    for (const detalle of detalles) {
      const { id_producto, cantidad, costo_unitario } = detalle;

      const [productoCheck] = await connection.query(
        'SELECT id_producto, stock_actual, costo_unitario_promedio FROM productos WHERE id_producto = ?',
        [id_producto]
      );
      
      if (productoCheck.length === 0) {
        throw new AppError(`Producto ${id_producto} no encontrado`, 404);
      }
      
      await connection.query(`
        INSERT INTO detalle_entradas (
          id_entrada,
          id_producto,
          cantidad,
          costo_unitario
        ) VALUES (?, ?, ?, ?)
      `, [id_entrada, id_producto, cantidad, costo_unitario]);
      
      const stockActual = parseFloat(productoCheck[0].stock_actual);
      const costoActual = parseFloat(productoCheck[0].costo_unitario_promedio);
      const cantidadNueva = parseFloat(cantidad);
      const costoNuevo = parseFloat(costo_unitario);
      
      const nuevoStock = stockActual + cantidadNueva;
      const nuevoCostoPromedio = nuevoStock > 0
        ? ((stockActual * costoActual) + (cantidadNueva * costoNuevo)) / nuevoStock
        : costoNuevo;
      
      await connection.query(`
        UPDATE productos 
        SET stock_actual = ?,
            costo_unitario_promedio = ?
        WHERE id_producto = ?
      `, [nuevoStock, nuevoCostoPromedio, id_producto]);
    }
    
    await connection.commit();
    
    res.status(201).json({
      success: true,
      message: 'Entrada registrada exitosamente',
      data: {
        id_entrada,
        total_productos: detalles.length,
        subtotal,
        igv,
        total,
        estado_pago: tipoEntradaFinal === 'Compra' ? 'Pendiente' : null
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

export const updateEntrada = async (req, res, next) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const {
      id_tipo_inventario,
      tipo_entrada,
      id_proveedor,
      documento_soporte,
      moneda,
      porcentaje_igv,
      id_cuenta_pago,
      observaciones,
      id_registrado_por,
      detalles
    } = req.body;
    
    const [entrada] = await connection.query(
      'SELECT estado, tipo_entrada FROM entradas WHERE id_entrada = ?',
      [id]
    );
    
    if (entrada.length === 0) {
      throw new AppError('Entrada no encontrada', 404);
    }
    
    if (entrada[0].estado === 'Anulado') {
      throw new AppError('No se puede editar una entrada anulada', 400);
    }

    const [detallesAnteriores] = await connection.query(
      'SELECT id_producto, cantidad FROM detalle_entradas WHERE id_entrada = ?',
      [id]
    );
    
    for (const detalle of detallesAnteriores) {
      const [producto] = await connection.query(
        'SELECT stock_actual FROM productos WHERE id_producto = ?',
        [detalle.id_producto]
      );
      
      if (producto.length > 0) {
        const nuevoStock = parseFloat(producto[0].stock_actual) - parseFloat(detalle.cantidad);
        
        await connection.query(
          'UPDATE productos SET stock_actual = ? WHERE id_producto = ?',
          [nuevoStock, detalle.id_producto]
        );
      }
    }
    
    await connection.query('DELETE FROM detalle_entradas WHERE id_entrada = ?', [id]);
    
    const subtotal = detalles.reduce((sum, d) => {
      return sum + (parseFloat(d.cantidad) * parseFloat(d.costo_unitario));
    }, 0);

    const porcentaje = porcentaje_igv !== null && porcentaje_igv !== undefined 
      ? parseFloat(porcentaje_igv) 
      : 18.00;
    
    const igv = subtotal * (porcentaje / 100);
    const total = subtotal + igv;
    
    await connection.query(`
      UPDATE entradas 
      SET id_tipo_inventario = ?,
          tipo_entrada = ?,
          id_proveedor = ?,
          documento_soporte = ?,
          total_costo = ?,
          subtotal = ?,
          igv = ?,
          total = ?,
          porcentaje_igv = ?,
          moneda = ?,
          id_cuenta_pago = ?,
          observaciones = ?,
          id_registrado_por = ?
      WHERE id_entrada = ?
    `, [
      id_tipo_inventario,
      tipo_entrada || 'Compra',
      id_proveedor || null,
      documento_soporte || null,
      subtotal,
      subtotal,
      igv,
      total,
      porcentaje,
      moneda || 'PEN',
      id_cuenta_pago || null,
      observaciones || null,
      id_registrado_por,
      id
    ]);
    
    for (const detalle of detalles) {
      const { id_producto, cantidad, costo_unitario } = detalle;
      
      await connection.query(`
        INSERT INTO detalle_entradas (
          id_entrada,
          id_producto,
          cantidad,
          costo_unitario
        ) VALUES (?, ?, ?, ?)
      `, [id, id_producto, cantidad, costo_unitario]);
      
      const [producto] = await connection.query(
        'SELECT stock_actual, costo_unitario_promedio FROM productos WHERE id_producto = ?',
        [id_producto]
      );
      
      if (producto.length > 0) {
        const stockActual = parseFloat(producto[0].stock_actual);
        const costoActual = parseFloat(producto[0].costo_unitario_promedio);
        const cantidadNueva = parseFloat(cantidad);
        const costoNuevo = parseFloat(costo_unitario);
        
        const nuevoStock = stockActual + cantidadNueva;
        const nuevoCostoPromedio = nuevoStock > 0
          ? ((stockActual * costoActual) + (cantidadNueva * costoNuevo)) / nuevoStock
          : costoNuevo;
        
        await connection.query(
          'UPDATE productos SET stock_actual = ?, costo_unitario_promedio = ? WHERE id_producto = ?',
          [nuevoStock, nuevoCostoPromedio, id_producto]
        );
      }
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Entrada actualizada exitosamente'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

export const deleteEntrada = async (req, res, next) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    
    const [entrada] = await connection.query(
      'SELECT estado, estado_pago FROM entradas WHERE id_entrada = ?',
      [id]
    );
    
    if (entrada.length === 0) {
      throw new AppError('Entrada no encontrada', 404);
    }
    
    if (entrada[0].estado === 'Anulado') {
      throw new AppError('La entrada ya está anulada', 400);
    }

    if (entrada[0].estado_pago === 'Parcial' || entrada[0].estado_pago === 'Pagado') {
      throw new AppError('No se puede anular una entrada con pagos registrados. Primero anule los pagos.', 400);
    }
    
    const [detalles] = await connection.query(
      'SELECT id_producto, cantidad FROM detalle_entradas WHERE id_entrada = ?',
      [id]
    );
    
    for (const detalle of detalles) {
      const [producto] = await connection.query(
        'SELECT stock_actual FROM productos WHERE id_producto = ?',
        [detalle.id_producto]
      );
      
      if (producto.length > 0) {
        const nuevoStock = parseFloat(producto[0].stock_actual) - parseFloat(detalle.cantidad);
        
        if (nuevoStock < 0) {
          throw new AppError(
            `No se puede anular: El producto ${detalle.id_producto} quedaría con stock negativo`,
            400
          );
        }
        
        await connection.query(
          'UPDATE productos SET stock_actual = ? WHERE id_producto = ?',
          [nuevoStock, detalle.id_producto]
        );
      }
    }
    
    await connection.query(
      'UPDATE entradas SET estado = "Anulado" WHERE id_entrada = ?',
      [id]
    );
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Entrada anulada exitosamente'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

export const createProductoRapido = async (req, res, next) => {
  try {
    const {
      codigo,
      nombre,
      descripcion,
      id_categoria,
      id_tipo_inventario,
      unidad_medida,
      stock_minimo,
      stock_maximo
    } = req.body;

    const [existente] = await pool.query(
      'SELECT id_producto FROM productos WHERE codigo = ? AND estado = "Activo"',
      [codigo]
    );

    if (existente.length > 0) {
      throw new AppError('Ya existe un producto con ese código', 400);
    }

    const [result] = await pool.query(`
      INSERT INTO productos (
        codigo, nombre, descripcion, id_categoria, id_tipo_inventario,
        unidad_medida, stock_minimo, stock_maximo, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Activo')
    `, [
      codigo,
      nombre,
      descripcion || null,
      id_categoria || null,
      id_tipo_inventario,
      unidad_medida,
      stock_minimo || 0,
      stock_maximo || 0
    ]);

    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: {
        id_producto: result.insertId,
        codigo,
        nombre
      }
    });
  } catch (error) {
    next(error);
  }
};

export const generarPDFEntradaController = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [entradas] = await pool.query(`
      SELECT 
        e.*,
        ti.nombre AS tipo_inventario,
        prov.razon_social AS proveedor,
        prov.ruc AS proveedor_ruc,
        emp.nombre_completo AS registrado_por
      FROM entradas e
      INNER JOIN tipos_inventario ti ON e.id_tipo_inventario = ti.id_tipo_inventario
      LEFT JOIN proveedores prov ON e.id_proveedor = prov.id_proveedor
      INNER JOIN empleados emp ON e.id_registrado_por = emp.id_empleado
      WHERE e.id_entrada = ?
    `, [id]);
    
    if (entradas.length === 0) {
      throw new AppError('Entrada no encontrada', 404);
    }
    
    const [detalles] = await pool.query(`
      SELECT 
        de.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_entradas de
      INNER JOIN productos p ON de.id_producto = p.id_producto
      WHERE de.id_entrada = ?
    `, [id]);
    
    const entrada = {
      ...entradas[0],
      detalles
    };
    

    const pdfBuffer = await generarPDFEntrada(entrada);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="entrada_${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
export const registrarPagoEntrada = async (req, res, next) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const {
      fecha_pago,
      monto_pagado,
      metodo_pago,
      numero_operacion,
      banco,
      id_cuenta_destino,
      observaciones,
      id_registrado_por
    } = req.body;
    
    const [entrada] = await connection.query(
      'SELECT total, monto_pagado, estado_pago, tipo_entrada FROM entradas WHERE id_entrada = ?',
      [id]
    );
    
    if (entrada.length === 0) {
      throw new AppError('Entrada no encontrada', 404);
    }
    
    if (entrada[0].tipo_entrada !== 'Compra') {
      throw new AppError('Solo se pueden registrar pagos para entradas de tipo Compra', 400);
    }
    
    const total = parseFloat(entrada[0].total);
    const montoPagadoActual = parseFloat(entrada[0].monto_pagado || 0);
    const saldoPendiente = total - montoPagadoActual;
    
    if (parseFloat(monto_pagado) > saldoPendiente) {
      throw new AppError(`El monto excede el saldo pendiente (${saldoPendiente.toFixed(2)})`, 400);
    }
    
    const [ultimoPago] = await connection.query(
      'SELECT numero_pago FROM pagos_entradas WHERE id_entrada = ? ORDER BY id_pago_entrada DESC LIMIT 1',
      [id]
    );
    
    let numeroSecuencia = 1;
    if (ultimoPago.length > 0) {
      const match = ultimoPago[0].numero_pago.match(/-P(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const [entradaInfo] = await connection.query(
      'SELECT documento_soporte FROM entradas WHERE id_entrada = ?',
      [id]
    );
    
    const numeroPago = `${entradaInfo[0].documento_soporte || `ENT-${id}`}-P${String(numeroSecuencia).padStart(2, '0')}`;
    
    await connection.query(`
      INSERT INTO pagos_entradas (
        id_entrada,
        numero_pago,
        fecha_pago,
        monto_pagado,
        metodo_pago,
        numero_operacion,
        banco,
        id_cuenta_destino,
        observaciones,
        id_registrado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      numeroPago,
      fecha_pago,
      monto_pagado,
      metodo_pago,
      numero_operacion || null,
      banco || null,
      id_cuenta_destino || null,
      observaciones || null,
      id_registrado_por
    ]);
    
    const nuevoMontoPagado = montoPagadoActual + parseFloat(monto_pagado);
    const nuevoEstadoPago = nuevoMontoPagado >= total ? 'Pagado' : 
                           nuevoMontoPagado > 0 ? 'Parcial' : 'Pendiente';
    
    await connection.query(
      'UPDATE entradas SET monto_pagado = ?, estado_pago = ? WHERE id_entrada = ?',
      [nuevoMontoPagado, nuevoEstadoPago, id]
    );
    
    if (id_cuenta_destino) {
      await connection.query(
        'UPDATE cuentas_pago SET saldo_actual = saldo_actual - ? WHERE id_cuenta = ?',
        [monto_pagado, id_cuenta_destino]
      );
    }
    
    await connection.commit();
    
    res.status(201).json({
      success: true,
      message: 'Pago registrado exitosamente',
      data: {
        numero_pago: numeroPago,
        nuevo_estado_pago: nuevoEstadoPago,
        saldo_pendiente: total - nuevoMontoPagado
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

export const getPagosEntrada = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [pagos] = await pool.query(`
      SELECT 
        pe.*,
        e.nombre_completo AS registrado_por,
        c.nombre AS cuenta_destino
      FROM pagos_entradas pe
      INNER JOIN empleados e ON pe.id_registrado_por = e.id_empleado
      LEFT JOIN cuentas_pago c ON pe.id_cuenta_destino = c.id_cuenta
      WHERE pe.id_entrada = ?
      ORDER BY pe.fecha_pago DESC
    `, [id]);
    
    res.json({
      success: true,
      data: pagos
    });
  } catch (error) {
    next(error);
  }
};

export const anularPagoEntrada = async (req, res, next) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id, idPago } = req.params;
    
    const [pago] = await connection.query(
      'SELECT * FROM pagos_entradas WHERE id_pago_entrada = ? AND id_entrada = ?',
      [idPago, id]
    );
    
    if (pago.length === 0) {
      throw new AppError('Pago no encontrado', 404);
    }
    
    const montoPago = parseFloat(pago[0].monto_pagado);
    const idCuentaDestino = pago[0].id_cuenta_destino;
    
    const [entrada] = await connection.query(
      'SELECT total, monto_pagado FROM entradas WHERE id_entrada = ?',
      [id]
    );
    
    const nuevoMontoPagado = parseFloat(entrada[0].monto_pagado) - montoPago;
    const total = parseFloat(entrada[0].total);
    const nuevoEstadoPago = nuevoMontoPagado <= 0 ? 'Pendiente' : 
                           nuevoMontoPagado >= total ? 'Pagado' : 'Parcial';
    
    await connection.query(
      'DELETE FROM pagos_entradas WHERE id_pago_entrada = ?',
      [idPago]
    );
    
    await connection.query(
      'UPDATE entradas SET monto_pagado = ?, estado_pago = ? WHERE id_entrada = ?',
      [nuevoMontoPagado, nuevoEstadoPago, id]
    );
    
    if (idCuentaDestino) {
      await connection.query(
        'UPDATE cuentas_pago SET saldo_actual = saldo_actual + ? WHERE id_cuenta = ?',
        [montoPago, idCuentaDestino]
      );
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Pago anulado exitosamente',
      data: {
        nuevo_estado_pago: nuevoEstadoPago,
        saldo_pendiente: total - nuevoMontoPagado
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

export const getResumenPagosEntrada = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [entrada] = await connection.query(
      'SELECT total, monto_pagado, estado_pago FROM entradas WHERE id_entrada = ?',
      [id]
    );
    
    if (entrada.length === 0) {
      throw new AppError('Entrada no encontrada', 404);
    }
    
    const total = parseFloat(entrada[0].total);
    const montoPagado = parseFloat(entrada[0].monto_pagado || 0);
    const saldoPendiente = total - montoPagado;
    const porcentajePagado = total > 0 ? ((montoPagado / total) * 100).toFixed(2) : 0;
    
    const [totalPagos] = await connection.query(
      'SELECT COUNT(*) as total FROM pagos_entradas WHERE id_entrada = ?',
      [id]
    );
    
    res.json({
      success: true,
      data: {
        total_entrada: total,
        monto_pagado: montoPagado,
        saldo_pendiente: saldoPendiente,
        porcentaje_pagado: porcentajePagado,
        estado_pago: entrada[0].estado_pago,
        total_pagos: totalPagos[0].total
      }
    });
  } catch (error) {
    next(error);
  }
};