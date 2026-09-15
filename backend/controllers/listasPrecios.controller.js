import pool, { executeQuery, executeTransaction } from '../config/database.js';

export async function getListasByCliente(req, res) {
    try {
        const { id_cliente } = req.params;
        const sql = `
            SELECT lp.*, e.nombre_completo AS creador_nombre,
            (SELECT COUNT(*) FROM listas_precios_detalle WHERE id_lista = lp.id_lista) as total_productos
            FROM listas_precios lp
            LEFT JOIN empleados e ON e.id_empleado = lp.creado_por
            WHERE lp.id_cliente = ? AND lp.estado = 'Activo'
            ORDER BY lp.fecha_creacion DESC`;
        const result = await executeQuery(sql, [id_cliente]);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getDetalleLista(req, res) {
    try {
        const { id } = req.params;
        const sql = `
            SELECT lpd.*, p.nombre as producto, p.codigo, p.unidad_medida, p.precio_venta as precio_estandar
            FROM listas_precios_detalle lpd
            INNER JOIN productos p ON lpd.id_producto = p.id_producto
            WHERE lpd.id_lista = ?`;
        const result = await executeQuery(sql, [id]);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function createListaPrecio(req, res) {
    try {
        const { id_cliente, nombre_lista, moneda, productos } = req.body;
        const creadoPor = req.user?.id_empleado ?? null;
        const connection = await pool.getConnection();
        let id_lista;
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                'INSERT INTO listas_precios (id_cliente, nombre_lista, moneda, creado_por) VALUES (?, ?, ?, ?)',
                [id_cliente, nombre_lista, moneda, creadoPor]
            );
            id_lista = result.insertId;
            if (productos && productos.length > 0) {
                await connection.query(
                    'INSERT INTO listas_precios_detalle (id_lista, id_producto, precio_especial) VALUES ?',
                    [productos.map(prod => [id_lista, prod.id_producto, prod.precio_especial])]
                );
            }
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        res.json({ success: true, message: 'Lista creada exitosamente', id_lista });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function updateListaPrecio(req, res) {
    try {
        const { id } = req.params;
        const { nombre_lista, moneda, productos } = req.body;
        const idEmpleado = req.user?.id_empleado ?? null;

        // 1. Cargar la lista y validar que exista
        const listaRes = await executeQuery(
            'SELECT id_cliente, creado_por FROM listas_precios WHERE id_lista = ?',
            [id]
        );
        if (!listaRes.success) return res.status(500).json({ success: false, error: listaRes.error });
        if (listaRes.data.length === 0) return res.status(404).json({ success: false, error: 'Lista no encontrada' });

        const lista = listaRes.data[0];
        const dueno = lista.creado_por;

        // Solo el creador puede editar. Las listas antiguas sin dueño (NULL) las
        // reclama automáticamente el primer usuario que las edite.
        if (dueno != null && Number(dueno) !== Number(idEmpleado)) {
            return res.status(403).json({
                success: false,
                error: 'Solo el usuario que creó esta lista puede editar sus precios.'
            });
        }
        const nuevoDueno = dueno != null ? dueno : idEmpleado;

        // 2. Leer el detalle actual para comparar precios
        const detalleActualRes = await executeQuery(
            'SELECT id_producto, precio_especial FROM listas_precios_detalle WHERE id_lista = ?',
            [id]
        );
        const fmt = (n) => {
            const v = parseFloat(n);
            return Number.isNaN(v) ? null : Number(v.toFixed(4));
        };
        const preciosPrevios = new Map(
            (detalleActualRes.data || []).map(d => [Number(d.id_producto), fmt(d.precio_especial)])
        );

        const productosNuevos = productos || [];
        const preciosNuevos = new Map(
            productosNuevos.map(p => [Number(p.id_producto), fmt(p.precio_especial)])
        );

        // 3. Armar el historial: cambios de precio, altas y bajas de producto
        const fechaLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); // YYYY-MM-DD
        const historial = [];
        for (const [idProd, precioNuevo] of preciosNuevos) {
            const precioPrevio = preciosPrevios.has(idProd) ? preciosPrevios.get(idProd) : null;
            if (precioPrevio === null || precioPrevio !== precioNuevo) {
                historial.push([id, lista.id_cliente, idProd, precioPrevio, precioNuevo, idEmpleado, fechaLima]);
            }
        }
        for (const [idProd, precioPrevio] of preciosPrevios) {
            if (!preciosNuevos.has(idProd)) {
                historial.push([id, lista.id_cliente, idProd, precioPrevio, null, idEmpleado, fechaLima]);
            }
        }

        // 4. Transacción: cabecera + reemplazo de detalle + historial
        const queries = [];
        queries.push({
            sql: `UPDATE listas_precios SET nombre_lista = ?, moneda = ?, creado_por = ? WHERE id_lista = ?`,
            params: [nombre_lista, moneda, nuevoDueno, id]
        });
        queries.push({
            sql: `DELETE FROM listas_precios_detalle WHERE id_lista = ?`,
            params: [id]
        });
        if (productosNuevos.length > 0) {
            queries.push({
                sql: `INSERT INTO listas_precios_detalle (id_lista, id_producto, precio_especial) VALUES ${productosNuevos.map(() => '(?, ?, ?)').join(', ')}`,
                params: productosNuevos.flatMap(prod => [id, prod.id_producto, prod.precio_especial])
            });
        }
        if (historial.length > 0) {
            queries.push({
                sql: `INSERT INTO listas_precios_historial (id_lista, id_cliente, id_producto, precio_anterior, precio_nuevo, id_empleado, fecha) VALUES ${historial.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
                params: historial.flat()
            });
        }

        const result = await executeTransaction(queries);
        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        res.json({ success: true, message: 'Lista de precios actualizada correctamente', cambios: historial.length });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getHistorialLista(req, res) {
    try {
        const { id } = req.params;
        const sql = `
            SELECT h.id_historial, h.id_lista, h.id_cliente, h.id_producto,
                   h.precio_anterior, h.precio_nuevo, h.fecha,
                   lp.nombre_lista, lp.moneda,
                   c.razon_social AS cliente,
                   p.nombre AS producto, p.codigo,
                   e.nombre_completo AS empleado
            FROM listas_precios_historial h
            LEFT JOIN listas_precios lp ON lp.id_lista = h.id_lista
            LEFT JOIN clientes c ON c.id_cliente = h.id_cliente
            LEFT JOIN productos p ON p.id_producto = h.id_producto
            LEFT JOIN empleados e ON e.id_empleado = h.id_empleado
            WHERE h.id_lista = ?
            ORDER BY h.fecha DESC, h.id_historial DESC`;
        const result = await executeQuery(sql, [id]);
        if (!result.success) return res.status(500).json(result);
        res.json({ success: true, data: result.data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function deleteListaPrecio(req, res) {
    try {
        const { id } = req.params;
        
        // Borrado lógico o físico. Aquí físico por cascada en BD, o lógico cambiando estado.
        // Opción: Cambiar estado a Inactivo para mantener histórico
        const result = await executeQuery(
            `UPDATE listas_precios SET estado = 'Inactivo' WHERE id_lista = ?`,
            [id]
        );

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        res.json({ success: true, message: 'Lista eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getListasCompletasByCliente(req, res) {
    try {
        const { id_cliente } = req.params;
        const result = await executeQuery(`
            SELECT
                lp.id_lista,
                lp.id_cliente,
                lp.nombre_lista,
                lp.moneda,
                lp.estado,
                lp.fecha_creacion,
                lp.creado_por,
                e.nombre_completo AS creador_nombre,
                lpd.id_detalle_lista,
                lpd.id_producto,
                lpd.precio_especial,
                p.nombre AS producto,
                p.codigo,
                p.unidad_medida,
                p.precio_venta AS precio_estandar
            FROM listas_precios lp
            LEFT JOIN listas_precios_detalle lpd ON lpd.id_lista = lp.id_lista
            LEFT JOIN productos p ON p.id_producto = lpd.id_producto
            LEFT JOIN empleados e ON e.id_empleado = lp.creado_por
            WHERE lp.id_cliente = ? AND lp.estado = 'Activo'
            ORDER BY lp.fecha_creacion DESC, lp.id_lista, lpd.id_detalle_lista
        `, [id_cliente]);

        if (!result.success) {
            return res.status(500).json(result);
        }

        const listasMap = new Map();
        for (const row of result.data) {
            if (!listasMap.has(row.id_lista)) {
                listasMap.set(row.id_lista, {
                    id_lista: row.id_lista,
                    id_cliente: row.id_cliente,
                    nombre_lista: row.nombre_lista,
                    moneda: row.moneda,
                    estado: row.estado,
                    fecha_creacion: row.fecha_creacion,
                    creado_por: row.creado_por,
                    creador_nombre: row.creador_nombre,
                    total_productos: 0,
                    detalle: []
                });
            }
            if (row.id_detalle_lista) {
                const lista = listasMap.get(row.id_lista);
                lista.detalle.push({
                    id_detalle_lista: row.id_detalle_lista,
                    id_lista: row.id_lista,
                    id_producto: row.id_producto,
                    precio_especial: row.precio_especial,
                    producto: row.producto,
                    codigo: row.codigo,
                    unidad_medida: row.unidad_medida,
                    precio_estandar: row.precio_estandar
                });
                lista.total_productos += 1;
            }
        }

        res.json({ success: true, data: Array.from(listasMap.values()) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
