import { executeQuery, executeTransaction } from '../config/database.js';
import pool from '../config/database.js';
import { generarPDFTransferencia } from '../utils/pdf-generator.js';

async function generarCodigoProducto(id_tipo_inventario) {
  try {
    const [tipoInv] = await pool.query(
      'SELECT nombre FROM tipos_inventario WHERE id_tipo_inventario = ?',
      [id_tipo_inventario]
    );
    
    if (tipoInv.length === 0) {
      throw new Error('Tipo de inventario no encontrado');
    }
    
    const prefijos = {
      'Insumos': 'INS',
      'Materia Prima': 'MP',
      'Productos Terminados': 'PT',
      'Productos de Reventa': 'REV'
    };
    
    const prefijo = prefijos[tipoInv[0].nombre] || 'PROD';
    
    const [ultimoCodigo] = await pool.query(
      `SELECT codigo FROM productos 
       WHERE codigo LIKE ? 
       ORDER BY codigo DESC 
       LIMIT 1`,
      [`${prefijo}-%`]
    );
    
    let nuevoNumero = 1;
    
    if (ultimoCodigo.length > 0) {
      const ultimoNum = parseInt(ultimoCodigo[0].codigo.split('-')[1]);
      nuevoNumero = ultimoNum + 1;
    }
    
    return `${prefijo}-${String(nuevoNumero).padStart(3, '0')}`;
  } catch (error) {
    throw new Error('Error al generar código: ' + error.message);
  }
}

export async function getAllTransferencias(req, res) {
  try {
    const { estado, id_tipo_inventario_origen, id_tipo_inventario_destino, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        tc.id_transferencia_cabecera,
        tc.id_tipo_inventario_origen,
        tio.nombre AS tipo_inventario_origen,
        tc.id_tipo_inventario_destino,
        tid.nombre AS tipo_inventario_destino,
        tc.id_registrado_por,
        e.nombre_completo AS registrado_por,
        tc.fecha_transferencia,
        tc.observaciones,
        tc.estado,
        COUNT(td.id_detalle) AS num_productos,
        SUM(td.subtotal) AS costo_total
      FROM transferencias_cabecera tc
      INNER JOIN tipos_inventario tio ON tc.id_tipo_inventario_origen = tio.id_tipo_inventario
      INNER JOIN tipos_inventario tid ON tc.id_tipo_inventario_destino = tid.id_tipo_inventario
      INNER JOIN empleados e ON tc.id_registrado_por = e.id_empleado
      LEFT JOIN transferencias_detalle td ON tc.id_transferencia_cabecera = td.id_transferencia_cabecera
      WHERE 1=1
    `;
    const params = [];
    
    if (estado) {
      sql += ' AND tc.estado = ?';
      params.push(estado);
    }
    if (id_tipo_inventario_origen) {
      sql += ' AND tc.id_tipo_inventario_origen = ?';
      params.push(id_tipo_inventario_origen);
    }
    if (id_tipo_inventario_destino) {
      sql += ' AND tc.id_tipo_inventario_destino = ?';
      params.push(id_tipo_inventario_destino);
    }
    if (fecha_inicio) {
      sql += ' AND DATE(tc.fecha_transferencia) >= ?';
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      sql += ' AND DATE(tc.fecha_transferencia) <= ?';
      params.push(fecha_fin);
    }
    
    sql += ' GROUP BY tc.id_transferencia_cabecera ORDER BY tc.fecha_transferencia DESC';
    
    const result = await executeQuery(sql, params);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getTransferenciaById(req, res) {
  try {
    const { id } = req.params;
    
    const cabeceraSql = `
      SELECT 
        tc.*,
        tio.nombre AS tipo_inventario_origen,
        tid.nombre AS tipo_inventario_destino,
        e.nombre_completo AS registrado_por
      FROM transferencias_cabecera tc
      INNER JOIN tipos_inventario tio ON tc.id_tipo_inventario_origen = tio.id_tipo_inventario
      INNER JOIN tipos_inventario tid ON tc.id_tipo_inventario_destino = tid.id_tipo_inventario
      INNER JOIN empleados e ON tc.id_registrado_por = e.id_empleado
      WHERE tc.id_transferencia_cabecera = ?
    `;
    
    const cabeceraResult = await executeQuery(cabeceraSql, [id]);
    
    if (!cabeceraResult.success || cabeceraResult.data.length === 0) {
      return res.status(404).json({ error: 'Transferencia no encontrada' });
    }
    
    const detallesSql = `
      SELECT 
        td.*,
        po.codigo AS codigo_origen,
        po.nombre AS producto_origen,
        po.unidad_medida AS unidad_origen,
        pd.codigo AS codigo_destino,
        pd.nombre AS producto_destino,
        pd.unidad_medida AS unidad_destino
      FROM transferencias_detalle td
      INNER JOIN productos po ON td.id_producto_origen = po.id_producto
      INNER JOIN productos pd ON td.id_producto_destino = pd.id_producto
      WHERE td.id_transferencia_cabecera = ?
    `;
    
    const detallesResult = await executeQuery(detallesSql, [id]);
    
    const data = {
      ...cabeceraResult.data[0],
      detalles: detallesResult.data || []
    };
    
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createTransferenciaMultiple(req, res) {
  try {
    const {
      id_tipo_inventario_origen,
      id_tipo_inventario_destino,
      id_registrado_por,
      observaciones,
      detalles 
    } = req.body;
    
    if (!id_tipo_inventario_origen || !id_tipo_inventario_destino || !id_registrado_por) {
      return res.status(400).json({ 
        error: 'id_tipo_inventario_origen, id_tipo_inventario_destino e id_registrado_por son requeridos' 
      });
    }
    
    if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({ 
        error: 'Debe incluir al menos un producto en detalles[]' 
      });
    }
    
    if (id_tipo_inventario_origen === id_tipo_inventario_destino) {
      return res.status(400).json({ 
        error: 'El inventario de origen y destino deben ser diferentes' 
      });
    }
    
    const productosData = [];
    
    for (let i = 0; i < detalles.length; i++) {
      const detalle = detalles[i];
      const { id_producto_origen, cantidad } = detalle;
      
      if (!id_producto_origen || !cantidad || cantidad <= 0) {
        return res.status(400).json({ 
          error: `Detalle ${i + 1}: id_producto_origen y cantidad (>0) son requeridos` 
        });
      }
      
      const [productoOrigen] = await pool.query(
        `SELECT * FROM productos 
         WHERE id_producto = ? AND id_tipo_inventario = ? AND estado = 'Activo'`,
        [id_producto_origen, id_tipo_inventario_origen]
      );
      
      if (productoOrigen.length === 0) {
        return res.status(404).json({ 
          error: `Detalle ${i + 1}: Producto no encontrado en inventario origen` 
        });
      }
      
      const prod = productoOrigen[0];
      const stockDisponible = parseFloat(prod.stock_actual);
      const cantidadTransferir = parseFloat(cantidad);
      
      if (stockDisponible < cantidadTransferir) {
        return res.status(400).json({ 
          error: `Detalle ${i + 1}: Stock insuficiente. Disponible: ${stockDisponible}, Solicitado: ${cantidadTransferir}` 
        });
      }
      
      productosData.push({
        id_producto_origen: prod.id_producto,
        nombre: prod.nombre,
        descripcion: prod.descripcion,
        unidad_medida: prod.unidad_medida,
        stock_minimo: prod.stock_minimo,
        stock_maximo: prod.stock_maximo,
        cantidad: cantidadTransferir,
        costo_unitario: parseFloat(prod.costo_unitario_promedio)
      });
    }
    
    const queryCabecera = [{
      sql: `INSERT INTO transferencias_cabecera (
        id_tipo_inventario_origen, id_tipo_inventario_destino, 
        id_registrado_por, observaciones
      ) VALUES (?, ?, ?, ?)`,
      params: [
        id_tipo_inventario_origen,
        id_tipo_inventario_destino,
        id_registrado_por,
        observaciones || null
      ]
    }];
    
    const resultCabecera = await executeTransaction(queryCabecera);
    
    if (!resultCabecera.success) {
      return res.status(500).json({ error: resultCabecera.error });
    }
    
    const idTransferencia = resultCabecera.data[0].insertId;
    
    const querysDetalle = [];
    const productosCreados = [];
    
    for (const prod of productosData) {
      const codigoDestino = await generarCodigoProducto(id_tipo_inventario_destino);
      
      querysDetalle.push({
        sql: `INSERT INTO productos (
          codigo, nombre, descripcion, id_tipo_inventario, unidad_medida,
          stock_actual, stock_minimo, stock_maximo, 
          costo_unitario_promedio, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo')`,
        params: [
          codigoDestino,
          prod.nombre,
          prod.descripcion || `Transferido desde inventario origen`,
          id_tipo_inventario_destino,
          prod.unidad_medida,
          prod.cantidad,
          prod.stock_minimo || 0,
          prod.stock_maximo || 0,
          prod.costo_unitario
        ]
      });
      
      productosCreados.push({
        ...prod,
        codigo_destino: codigoDestino
      });
    }
    
    const resultCrearProductos = await executeTransaction(querysDetalle);
    
    if (!resultCrearProductos.success) {
      await executeQuery('DELETE FROM transferencias_cabecera WHERE id_transferencia_cabecera = ?', [idTransferencia]);
      return res.status(500).json({ error: resultCrearProductos.error });
    }
    
    const querysFinales = [];
    
    for (let i = 0; i < productosCreados.length; i++) {
      const prod = productosCreados[i];
      const insertId = resultCrearProductos.data[i].insertId;
      
      querysFinales.push({
        sql: `INSERT INTO transferencias_detalle (
          id_transferencia_cabecera, id_producto_origen, id_producto_destino,
          cantidad, costo_unitario
        ) VALUES (?, ?, ?, ?, ?)`,
        params: [
          idTransferencia,
          prod.id_producto_origen,
          insertId,
          prod.cantidad,
          prod.costo_unitario
        ]
      });
      
      querysFinales.push({
        sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
        params: [prod.cantidad, prod.id_producto_origen]
      });
    }
    
    const resultFinal = await executeTransaction(querysFinales);
    
    if (!resultFinal.success) {
      for (let i = 0; i < productosCreados.length; i++) {
        const insertId = resultCrearProductos.data[i].insertId;
        await executeQuery('DELETE FROM productos WHERE id_producto = ?', [insertId]);
      }
      await executeQuery('DELETE FROM transferencias_cabecera WHERE id_transferencia_cabecera = ?', [idTransferencia]);
      return res.status(500).json({ error: resultFinal.error });
    }
    
    res.status(201).json({
      success: true,
      message: `Transferencia registrada. ${productosData.length} producto(s) creados en inventario destino.`,
      data: {
        id_transferencia_cabecera: idTransferencia,
        productos_transferidos: productosData.length,
        codigos_generados: productosCreados.map(p => p.codigo_destino)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
export async function deleteTransferencia(req, res) {
  try {
    const { id } = req.params;
    
    const cabeceraResult = await executeQuery(
      'SELECT * FROM transferencias_cabecera WHERE id_transferencia_cabecera = ? AND estado = ?',
      [id, 'Activo']
    );
    
    if (cabeceraResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Transferencia no encontrada o ya está anulada' 
      });
    }
    
    const detallesResult = await executeQuery(
      `SELECT id_producto_origen, id_producto_destino, cantidad 
       FROM transferencias_detalle 
       WHERE id_transferencia_cabecera = ?`,
      [id]
    );
    
    const detalles = detallesResult.data;
    
    if (detalles.length === 0) {
      await executeQuery(
        'UPDATE transferencias_cabecera SET estado = ? WHERE id_transferencia_cabecera = ?',
        ['Anulado', id]
      );
      return res.json({ success: true, message: 'Transferencia anulada' });
    }
    
    const queries = [];
    
    for (const detalle of detalles) {
      queries.push({
        sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
        params: [detalle.cantidad, detalle.id_producto_origen]
      });
      
      queries.push({
        sql: 'UPDATE productos SET estado = ? WHERE id_producto = ?',
        params: ['Inactivo', detalle.id_producto_destino]
      });
    }
    
    queries.push({
      sql: 'UPDATE transferencias_cabecera SET estado = ? WHERE id_transferencia_cabecera = ?',
      params: ['Anulado', id]
    });
    
    const result = await executeTransaction(queries);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: `Transferencia anulada. ${detalles.length} producto(s) revertidos.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getProductosDisponibles(req, res) {
  try {
    const { id_tipo_inventario_origen } = req.query;
    
    if (!id_tipo_inventario_origen) {
      return res.status(400).json({ 
        error: 'Se requiere id_tipo_inventario_origen' 
      });
    }
    
    const sql = `
      SELECT 
        p.id_producto,
        p.codigo,
        p.nombre,
        p.stock_actual,
        p.unidad_medida,
        p.costo_unitario_promedio
      FROM productos p
      WHERE p.id_tipo_inventario = ?
        AND p.estado = 'Activo'
        AND p.stock_actual > 0
      ORDER BY p.nombre ASC
    `;
    
    const result = await executeQuery(sql, [id_tipo_inventario_origen]);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getResumenStockInventario(req, res) {
  try {
    const sql = `
      SELECT 
        ti.id_tipo_inventario,
        ti.nombre AS tipo_inventario,
        COUNT(DISTINCT p.id_producto) AS total_productos,
        COALESCE(SUM(p.stock_actual), 0) AS stock_total,
        COALESCE(SUM(p.stock_actual * p.costo_unitario_promedio), 0) AS valor_total
      FROM tipos_inventario ti
      LEFT JOIN productos p ON ti.id_tipo_inventario = p.id_tipo_inventario 
        AND p.estado = 'Activo'
        AND p.stock_actual > 0
      WHERE ti.estado = 'Activo'
      GROUP BY ti.id_tipo_inventario, ti.nombre
      ORDER BY ti.nombre ASC
    `;
    
    const result = await executeQuery(sql);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const generarPDFTransferenciaController = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [transferencias] = await pool.query(`
      SELECT 
        tc.*,
        ti_origen.nombre AS tipo_inventario_origen,
        ti_destino.nombre AS tipo_inventario_destino,
        emp.nombre_completo AS registrado_por
      FROM transferencias_cabecera tc
      INNER JOIN tipos_inventario ti_origen ON tc.id_tipo_inventario_origen = ti_origen.id_tipo_inventario
      INNER JOIN tipos_inventario ti_destino ON tc.id_tipo_inventario_destino = ti_destino.id_tipo_inventario
      INNER JOIN empleados emp ON tc.id_registrado_por = emp.id_empleado
      WHERE tc.id_transferencia_cabecera = ?
    `, [id]);
    
    if (transferencias.length === 0) {
      return res.status(404).json({ error: 'Transferencia no encontrada' });
    }
    
    const [detalles] = await pool.query(`
      SELECT 
        td.*,
        po.codigo AS codigo_origen,
        po.nombre AS producto_nombre,
        po.unidad_medida,
        pd.codigo AS codigo_destino
      FROM transferencias_detalle td
      INNER JOIN productos po ON td.id_producto_origen = po.id_producto
      INNER JOIN productos pd ON td.id_producto_destino = pd.id_producto
      WHERE td.id_transferencia_cabecera = ?
    `, [id]);
    
    const transferencia = {
      ...transferencias[0],
      detalles
    };
    
    const pdfBuffer = await generarPDFTransferencia(transferencia);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="transferencia_${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({ error: error.message });
  }
};