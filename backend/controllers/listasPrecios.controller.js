import { executeQuery, executeTransaction } from '../config/database.js';

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

        const queries = [];

        // 1. Insertar cabecera
        queries.push({
            sql: `INSERT INTO listas_precios (id_cliente, nombre_lista, moneda) VALUES (?, ?, ?)`,
            params: [id_cliente, nombre_lista, moneda]
        });

        const resultTransaction = await executeTransaction(queries);
        
        if (!resultTransaction.success) {
            return res.status(500).json({ success: false, error: resultTransaction.error });
        }

        const id_lista = resultTransaction.data[0].insertId;

        // 2. Insertar detalles si existen
        if (productos && productos.length > 0) {
            const queriesDetalle = productos.map(prod => ({
                sql: `INSERT INTO listas_precios_detalle (id_lista, id_producto, precio_especial) VALUES (?, ?, ?)`,
                params: [id_lista, prod.id_producto, prod.precio_especial]
            }));
            await executeTransaction(queriesDetalle);
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

        // 1. Actualizar datos de cabecera (nombre y moneda)
        queries.push({
            sql: `UPDATE listas_precios SET nombre_lista = ?, moneda = ? WHERE id_lista = ?`,
            params: [nombre_lista, moneda, id]
        });

        // 2. Eliminar todo el detalle actual para reinsertarlo (Estrategia limpia para manejar altas, bajas y cambios)
        queries.push({
            sql: `DELETE FROM listas_precios_detalle WHERE id_lista = ?`,
            params: [id]
        });

        // 3. Insertar los productos nuevos/editados
        if (productos && productos.length > 0) {
            productos.forEach(prod => {
                queries.push({
                    sql: `INSERT INTO listas_precios_detalle (id_lista, id_producto, precio_especial) VALUES (?, ?, ?)`,
                    params: [id, prod.id_producto, prod.precio_especial]
                });
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