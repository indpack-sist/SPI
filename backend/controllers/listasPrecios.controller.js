import pool, { executeQuery, executeTransaction } from '../config/database.js';

export async function getListasByCliente(req, res) {
    try {
        const { id_cliente } = req.params;
        const sql = `
            SELECT lp.*, 
            (SELECT COUNT(*) FROM listas_precios_detalle WHERE id_lista = lp.id_lista) as total_productos
            FROM listas_precios lp 
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
        const connection = await pool.getConnection();
        let id_lista;
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                'INSERT INTO listas_precios (id_cliente, nombre_lista, moneda) VALUES (?, ?, ?)',
                [id_cliente, nombre_lista, moneda]
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

        const queries = [];

        queries.push({
            sql: `UPDATE listas_precios SET nombre_lista = ?, moneda = ? WHERE id_lista = ?`,
            params: [nombre_lista, moneda, id]
        });

        queries.push({
            sql: `DELETE FROM listas_precios_detalle WHERE id_lista = ?`,
            params: [id]
        });

        if (productos && productos.length > 0) {
            queries.push({
                sql: `INSERT INTO listas_precios_detalle (id_lista, id_producto, precio_especial) VALUES ${productos.map(() => '(?, ?, ?)').join(', ')}`,
                params: productos.flatMap(prod => [id, prod.id_producto, prod.precio_especial])
            });
        }

        const result = await executeTransaction(queries);

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        res.json({ success: true, message: 'Lista de precios actualizada correctamente' });

    } catch (error) {
        console.error(error);
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
