import { executeQuery, executeTransaction } from '../config/database.js';
import { generarPDFSalida } from '../utils/pdf-generator.js';

export async function getAllSalidas(req, res) {
    try {
        const { estado, id_tipo_inventario, tipo_movimiento, fecha_inicio, fecha_fin } = req.query;
        let sql = `
            SELECT 
                s.id_salida,
                s.id_tipo_inventario,
                ti.nombre AS tipo_inventario,
                s.tipo_movimiento,
                s.id_cliente,
                c.razon_social AS cliente,
                s.departamento,
                
                CASE 
                    WHEN s.tipo_movimiento = 'Venta' THEN c.razon_social
                    WHEN s.tipo_movimiento = 'Consumo Interno' THEN s.departamento
                    ELSE s.tipo_movimiento 
                END AS destino_final, 
                
                s.total_precio,
                s.moneda,
                s.id_vehiculo,
                v.placa AS vehiculo,
                s.id_registrado_por,
                e.nombre_completo AS registrado_por,
                s.fecha_movimiento,
                s.observaciones,
                s.estado,
                COUNT(ds.id_detalle) AS num_productos,
                GROUP_CONCAT(p.nombre SEPARATOR ', ') AS productos_resumen
            FROM salidas s -- CAMBIO CLAVE: Usamos la tabla 'salidas'
            INNER JOIN tipos_inventario ti ON s.id_tipo_inventario = ti.id_tipo_inventario
            LEFT JOIN clientes c ON s.id_cliente = c.id_cliente
            LEFT JOIN flota v ON s.id_vehiculo = v.id_vehiculo
            INNER JOIN empleados e ON s.id_registrado_por = e.id_empleado
            LEFT JOIN detalle_salidas ds ON s.id_salida = ds.id_salida
            LEFT JOIN productos p ON ds.id_producto = p.id_producto
            WHERE 1=1
        `;
        const params = [];
        
        if (estado) {
            sql += ' AND s.estado = ?';
            params.push(estado);
        }
        if (id_tipo_inventario) {
            sql += ' AND s.id_tipo_inventario = ?';
            params.push(id_tipo_inventario);
        }
        if (tipo_movimiento) {
            sql += ' AND s.tipo_movimiento = ?';
            params.push(tipo_movimiento);
        }
        if (fecha_inicio) {
            sql += ' AND DATE(s.fecha_movimiento) >= ?';
            params.push(fecha_inicio);
        }
        if (fecha_fin) {
            sql += ' AND DATE(s.fecha_movimiento) <= ?';
            params.push(fecha_fin);
        }
        
        sql += ' GROUP BY s.id_salida '; 
        sql += ' ORDER BY s.fecha_movimiento DESC';
        
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

export async function getSalidaById(req, res) {
    try {
        const { id } = req.params;
        const cabeceraSql = `
            SELECT 
                s.*,
                ti.nombre AS tipo_inventario,
                c.razon_social AS cliente,
                v.placa AS vehiculo,
                e.nombre_completo AS registrado_por
            FROM salidas s
            INNER JOIN tipos_inventario ti ON s.id_tipo_inventario = ti.id_tipo_inventario
            LEFT JOIN clientes c ON s.id_cliente = c.id_cliente
            LEFT JOIN flota v ON s.id_vehiculo = v.id_vehiculo
            INNER JOIN empleados e ON s.id_registrado_por = e.id_empleado
            WHERE s.id_salida = ?
        `;
        
        const cabeceraResult = await executeQuery(cabeceraSql, [id]);
        
        if (!cabeceraResult.success) {
            return res.status(500).json({ error: cabeceraResult.error });
        }
        
        if (cabeceraResult.data.length === 0) {
            return res.status(404).json({ error: 'Salida no encontrado' });
        }

        const detallesSql = `
            SELECT 
                ds.*,
                p.nombre AS producto,
                p.unidad_medida
            FROM detalle_salidas ds
            INNER JOIN productos p ON ds.id_producto = p.id_producto
            WHERE ds.id_salida = ?
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

export async function createSalidaMultiple(req, res) {
    try {
        const {
            id_tipo_inventario,
            tipo_movimiento,
            id_cliente,
            departamento,
            moneda,
            id_vehiculo,
            id_registrado_por,
            observaciones,
            detalles 
        } = req.body;

        if (!id_tipo_inventario || !tipo_movimiento || !id_registrado_por) {
            return res.status(400).json({ 
                error: 'id_tipo_inventario, tipo_movimiento e id_registrado_por son requeridos' 
            });
        }
        if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
            return res.status(400).json({ 
                error: 'Se requiere al menos un producto en detalles[]' 
            });
        }

        let totalCosto = 0;
        let totalPrecio = 0;
        const productosData = []; 
        const monedaFinal = moneda || 'PEN';
        
        for (let i = 0; i < detalles.length; i++) {
            const detalle = detalles[i];
            const { id_producto, cantidad, precio_unitario } = detalle;
            const cantidadSalida = parseFloat(cantidad);

            if (!id_producto || cantidadSalida <= 0 || isNaN(cantidadSalida)) {
                return res.status(400).json({ 
                    error: `Detalle ${i + 1}: Producto y Cantidad (debe ser > 0) son requeridos.` 
                });
            }

            const productoResult = await executeQuery(
                `SELECT 
                    p.stock_actual, 
                    p.precio_venta,
                    COALESCE(
                        (SELECT SUM(op.costo_materiales) / SUM(op.cantidad_producida)
                         FROM ordenes_produccion op
                         WHERE op.id_producto_terminado = p.id_producto 
                         AND op.estado = 'Finalizada' 
                         AND op.cantidad_producida > 0 
                         AND op.costo_materiales > 0),
                        p.costo_unitario_promedio,
                        0
                    ) AS cup_real
                FROM productos p WHERE p.id_producto = ?`,
                [id_producto]
            );
            
            if (productoResult.data.length === 0) {
                return res.status(404).json({ error: `Detalle ${i + 1}: Producto no encontrado.` });
            }

            const producto = productoResult.data[0];
            const stockActual = parseFloat(producto.stock_actual);
            
            if (stockActual < cantidadSalida) {
                return res.status(400).json({ 
                    error: `Detalle ${i + 1}: Stock insuficiente. Disponible: ${stockActual}, Solicitado: ${cantidadSalida}` 
                });
            }
            
            const costoUnitario = parseFloat(producto.cup_real);
            
            let precioVentaFinal = null;
            if (tipo_movimiento === 'Venta') {
                if (precio_unitario !== undefined && precio_unitario !== null) {
                    precioVentaFinal = parseFloat(precio_unitario);
                } else {
                    precioVentaFinal = parseFloat(producto.precio_venta) || 0;
                }
            }

            totalCosto += (cantidadSalida * costoUnitario);
            if (precioVentaFinal !== null) {
                totalPrecio += (cantidadSalida * precioVentaFinal);
            }

            productosData.push({ id_producto, cantidadSalida, costoUnitario, precioVentaFinal });
        }
        
        const querysCabecera = [{
            sql: `INSERT INTO salidas (
                id_tipo_inventario, tipo_movimiento, id_cliente, departamento, 
                total_costo, total_precio, moneda, id_vehiculo, id_registrado_por, observaciones
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params: [
                id_tipo_inventario,
                tipo_movimiento,
                id_cliente || null,
                departamento || null,
                totalCosto,
                totalPrecio,
                monedaFinal,
                id_vehiculo || null,
                id_registrado_por,
                observaciones || null
            ]
        }];
        
        const resultCabecera = await executeTransaction(querysCabecera);
        
        if (!resultCabecera.success) {
            console.error('Error al crear cabecera de salida:', resultCabecera.error);
            return res.status(500).json({ error: resultCabecera.error || 'Error al crear la salida.' });
        }
        
        const id_salida_generado = resultCabecera.data[0].insertId;
        const querysDetalle = [];

        for (const data of productosData) {
            querysDetalle.push({
                sql: `INSERT INTO detalle_salidas (
                    id_salida, id_producto, cantidad, costo_unitario, precio_unitario
                ) VALUES (?, ?, ?, ?, ?)`,
                params: [
                    id_salida_generado,
                    data.id_producto,
                    data.cantidadSalida,
                    data.costoUnitario,
                    data.precioVentaFinal
                ]
            });

            querysDetalle.push({
                sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
                params: [data.cantidadSalida, data.id_producto]
            });
        }
        
        const resultDetalle = await executeTransaction(querysDetalle);
        
        if (!resultDetalle.success) {
            console.error('Error al insertar detalles de salida:', resultDetalle.error);
            await executeQuery('DELETE FROM salidas WHERE id_salida = ?', [id_salida_generado]);
            return res.status(500).json({ error: resultDetalle.error || 'Error al registrar los detalles de la salida.' });
        }
        
        res.status(201).json({
            success: true,
            message: `Salida (ID: ${id_salida_generado}) registrada con ${productosData.length} productos.`,
            data: { 
                id_salida: id_salida_generado, 
                detalles_registrados: productosData,
                total_costo: totalCosto,
                total_precio: totalPrecio
            }
        });
    } catch (error) {
        console.error('Error en createSalidaMultiple:', error);
        res.status(500).json({ error: error.message });
    }
}

export async function createSalida(req, res) {

    if (req.body.detalles && Array.isArray(req.body.detalles) && req.body.detalles.length > 0) {
         return createSalidaMultiple(req, res);
    }
    
    
    const { id_producto, cantidad, precio_unitario, ...cabecera } = req.body;

    if (!id_producto || !cantidad) {
        return res.status(400).json({ error: 'id_producto y cantidad son requeridos para la salida simple.' });
    }

    req.body = {
        ...cabecera,
        detalles: [{ id_producto, cantidad, precio_unitario }]
    };

    return createSalidaMultiple(req, res);
}

export async function updateSalida(req, res) {
    try {
        const { id } = req.params;
        const { id_tipo_inventario, tipo_movimiento, id_cliente, departamento, moneda, id_vehiculo, observaciones } = req.body;

        const salidaActual = await executeQuery(
            'SELECT * FROM salidas WHERE id_salida = ? AND estado = ?', 
            [id, 'Activo']
        );
        
        if (salidaActual.data.length === 0) {
            return res.status(404).json({ error: 'Salida no encontrada o ya está anulada' });
        }
        
        const queries = [];
        
        queries.push({
            sql: `UPDATE salidas 
                  SET id_tipo_inventario = ?, tipo_movimiento = ?, id_cliente = ?, 
                      departamento = ?, moneda = ?, id_vehiculo = ?, observaciones = ?
                  WHERE id_salida = ?`,
            params: [
                id_tipo_inventario,
                tipo_movimiento,
                id_cliente || null,
                departamento || null,
                moneda,
                id_vehiculo || null,
                observaciones || null,
                id
            ]
        });
        
        const result = await executeTransaction(queries);
        
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        
        res.json({
            success: true,
            message: 'Salida (cabecera) actualizada exitosamente'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


export async function deleteSalida(req, res) {
    try {
        const { id } = req.params;
        
        const cabeceraResult = await executeQuery(
            'SELECT * FROM salidas WHERE id_salida = ? AND estado = ?', 
            [id, 'Activo']
        );
        
        if (cabeceraResult.data.length === 0) {
            return res.status(404).json({ error: 'Salida no encontrada o ya está anulada' });
        }
        
        const cabecera = cabeceraResult.data[0];

        const detallesResult = await executeQuery(
            'SELECT id_producto, cantidad FROM detalle_salidas WHERE id_salida = ?',
            [id]
        );
        
        const detalles = detallesResult.data;
        if (detalles.length === 0) {
            const queries = [{ sql: 'UPDATE salidas SET estado = ? WHERE id_salida = ?', params: ['Anulado', id] }];
            await executeTransaction(queries);
            return res.json({ success: true, message: 'Salida anulada exitosamente (sin productos).' });
        }

        const queries = [];
        let stockAnterior = 0; 
        
        for (const detalle of detalles) {
            const { id_producto, cantidad } = detalle;

             const productoResult = await executeQuery(
                'SELECT stock_actual FROM productos WHERE id_producto = ?',
                [id_producto]
            );
            stockAnterior = parseFloat(productoResult.data[0].stock_actual);
            
            queries.push({
                sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
                params: [cantidad, id_producto]
            });
        }

        queries.push({
            sql: 'UPDATE salidas SET estado = ? WHERE id_salida = ?',
            params: ['Anulado', id]
        });
        
        const result = await executeTransaction(queries);
        
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        
        res.json({
            success: true,
            message: `Salida anulada exitosamente. ${detalles.length} productos revertidos.`,
            data: { stock_revertido: true } 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function getTiposMovimientoSalida(req, res) {
    try {
        const tipos = [
            'Venta',
            'Consumo Interno',
            'Desperdicio',
            'Merma',
            'Ajuste Negativo',
            'Donación',
            'Devolución a Proveedor'
        ];
        res.json({
            success: true,
            data: tipos
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
export const generarPDFSalidaController = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const salidasResult = await executeQuery(`
      SELECT 
        s.*,
        ti.nombre AS tipo_inventario,
        c.razon_social AS cliente,
        c.ruc AS cliente_ruc,
        emp.nombre_completo AS registrado_por,
        v.placa AS vehiculo
      FROM salidas s
      INNER JOIN tipos_inventario ti ON s.id_tipo_inventario = ti.id_tipo_inventario
      LEFT JOIN clientes c ON s.id_cliente = c.id_cliente
      INNER JOIN empleados emp ON s.id_registrado_por = emp.id_empleado
      LEFT JOIN flota v ON s.id_vehiculo = v.id_vehiculo
      WHERE s.id_salida = ?
    `, [id]);
    
    if (!salidasResult.success || salidasResult.data.length === 0) {
      return res.status(404).json({ error: 'Salida no encontrada' });
    }
    
    const detallesResult = await executeQuery(`
      SELECT 
        ds.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_salidas ds
      INNER JOIN productos p ON ds.id_producto = p.id_producto
      WHERE ds.id_salida = ?
    `, [id]);
    
    const salida = {
      ...salidasResult.data[0],
      detalles: detallesResult.success ? detallesResult.data : []
    };
    
    const pdfBuffer = await generarPDFSalida(salida);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="salida_${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al generar PDF de salida:', error);
    res.status(500).json({ error: error.message });
  }
};