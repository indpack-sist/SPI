import { executeQuery } from '../config/database.js';

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
        const resultCabecera = await executeQuery(
            `INSERT INTO listas_precios (id_cliente, nombre_lista, moneda) VALUES (?, ?, ?)`,
            [id_cliente, nombre_lista, moneda]
        );

        if (resultCabecera.success && productos && productos.length > 0) {
            const id_lista = resultCabecera.data.insertId;
            for (const prod of productos) {
                await executeQuery(
                    `INSERT INTO listas_precios_detalle (id_lista, id_producto, precio_especial) VALUES (?, ?, ?)`,
                    [id_lista, prod.id_producto, prod.precio_especial]
                );
            }
        }
        res.json(resultCabecera);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}