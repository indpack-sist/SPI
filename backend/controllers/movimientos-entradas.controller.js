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
      id_proveedor,
      documento_soporte,
      id_registrado_por,
      moneda,
      observaciones,
      detalles
    } = req.body;
    
    if (!detalles || detalles.length === 0) {
      throw new AppError('Debe agregar al menos un producto', 400);
    }
    
    
    const total_costo = detalles.reduce((sum, d) => {
      return sum + (parseFloat(d.cantidad) * parseFloat(d.costo_unitario));
    }, 0);

    const tipoInventarioPrincipal = id_tipo_inventario || detalles[0].id_tipo_inventario;
    
    const [resultEntrada] = await connection.query(`
      INSERT INTO entradas ( 
        id_tipo_inventario,
        id_proveedor,
        documento_soporte,
        total_costo,
        moneda,
        id_registrado_por,
        observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      tipoInventarioPrincipal,
      id_proveedor || null,
      documento_soporte || null,
      total_costo,
      moneda || 'PEN',
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
        total_costo
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
      id_proveedor,
      documento_soporte,
      moneda,
      observaciones,
      id_registrado_por,
      id_producto,
      cantidad,
      costo_unitario
    } = req.body;
    
    const [entrada] = await connection.query(
      'SELECT estado FROM entradas WHERE id_entrada = ?',
      [id]
    );
    
    if (entrada.length === 0) {
      throw new AppError('Entrada no encontrada', 404);
    }
    
    if (entrada[0].estado === 'Anulado') {
      throw new AppError('No se puede editar una entrada anulada', 400);
    }
    
    const [detalles] = await connection.query(
      'SELECT COUNT(*) as count FROM detalle_entradas WHERE id_entrada = ?',
      [id]
    );
    
    if (detalles[0].count > 1) {
      await connection.query(`
        UPDATE entradas 
        SET id_tipo_inventario = ?,
            id_proveedor = ?,
            documento_soporte = ?,
            moneda = ?,
            observaciones = ?,
            id_registrado_por = ?
        WHERE id_entrada = ?
      `, [
        id_tipo_inventario,
        id_proveedor || null,
        documento_soporte || null,
        moneda || 'PEN',
        observaciones || null,
        id_registrado_por,
        id
      ]);
    } else {
      const [detalleAnterior] = await connection.query(
        'SELECT id_producto, cantidad, costo_unitario FROM detalle_entradas WHERE id_entrada = ?',
        [id]
      );
      
      if (detalleAnterior.length > 0) {
        const detAnterior = detalleAnterior[0];
        
        const [prodAnterior] = await connection.query(
          'SELECT stock_actual, costo_unitario_promedio FROM productos WHERE id_producto = ?',
          [detAnterior.id_producto]
        );
        
        if (prodAnterior.length > 0) {
          const nuevoStock = parseFloat(prodAnterior[0].stock_actual) - parseFloat(detAnterior.cantidad);
          
          await connection.query(
            'UPDATE productos SET stock_actual = ? WHERE id_producto = ?',
            [nuevoStock, detAnterior.id_producto]
          );
        }
        
        await connection.query('DELETE FROM detalle_entradas WHERE id_entrada = ?', [id]);
      }
      
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
      
      const nuevo_total = parseFloat(cantidad) * parseFloat(costo_unitario);
      
      await connection.query(`
        UPDATE entradas 
        SET id_tipo_inventario = ?,
            id_proveedor = ?,
            documento_soporte = ?,
            total_costo = ?,
            moneda = ?,
            observaciones = ?,
            id_registrado_por = ?
        WHERE id_entrada = ?
      `, [
        id_tipo_inventario,
        id_proveedor || null,
        documento_soporte || null,
        nuevo_total,
        moneda || 'PEN',
        observaciones || null,
        id_registrado_por,
        id
      ]);
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
      'SELECT estado FROM entradas WHERE id_entrada = ?',
      [id]
    );
    
    if (entrada.length === 0) {
      throw new AppError('Entrada no encontrada', 404);
    }
    
    if (entrada[0].estado === 'Anulado') {
      throw new AppError('La entrada ya está anulada', 400);
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