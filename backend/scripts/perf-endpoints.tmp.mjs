import 'dotenv/config';
import { getAllOrdenesVenta } from '../controllers/ordenesVenta.controller.js';
import { getAllCotizaciones } from '../controllers/cotizaciones.controller.js';
import { getAllClientes } from '../controllers/clientes.controller.js';
import { getAllProductos } from '../controllers/productos.controller.js';
import pool from '../config/database.js';

function responseCapture() {
  let payload;
  return {
    status() { return this; },
    json(value) { payload = value; return this; },
    get payload() { return payload; }
  };
}

async function measure(name, fn, query = {}) {
  const req = { query, user: { id_empleado: 1, rol: 'Administrador' } };
  const res = responseCapture();
  const start = performance.now();
  await fn(req, res);
  const ms = Math.round(performance.now() - start);
  const data = res.payload?.data;
  const rows = Array.isArray(data) ? data.length : null;
  const bytes = Buffer.byteLength(JSON.stringify(res.payload || null));
  console.log(JSON.stringify({ name, ms, rows, jsonBytes: bytes }));
}

try {
  console.log(JSON.stringify({ name: 'starting' }));
  await pool.query('SELECT 1');
  await measure('cotizaciones_all_1', getAllCotizaciones);
  await measure('cotizaciones_all_2', getAllCotizaciones);
  await measure('clientes_activos', getAllClientes, { estado: 'Activo' });
  await measure('productos_terminados_activos', getAllProductos, { estado: 'Activo', id_tipo_inventario: '3' });
  await measure('ordenes_venta_all_1', getAllOrdenesVenta);
} finally {
  await pool.end();
}
