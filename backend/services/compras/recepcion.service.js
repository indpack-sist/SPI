// services/compras/recepcion.service.js — Ingreso de mercadería a inventario por COMPRA.
//
// Reutiliza el motor de `entradas`/`detalle_entradas` (mismo que createCompra) para subir
// stock_actual y recalcular el costo unitario promedio móvil (PEN/USD). Se invoca DENTRO de una
// transacción ya abierta (recibe el `conn`), de modo que la guía de compra y su ingreso de stock
// sean atómicos. La GRE de compra (SUNAT) es un paso posterior e independiente.
//
// Un ítem SOLO ingresa a inventario si tiene id_producto de catálogo; los productos de una compra
// siempre lo tienen (se auto-crean al conciliar el XML). El costo unitario sale del precio de la
// COMPRA (detalle_orden_compra), no de la guía (la guía solo transporta cantidades).

/**
 * @param {import('mysql2/promise').PoolConnection} conn  conexión con transacción abierta
 * @param {object} p
 * @param {number} p.idOrdenCompra
 * @param {number} p.idProveedor
 * @param {string} p.docSoporte        Nº de factura ("F001-123") o número de orden
 * @param {'PEN'|'USD'} p.moneda
 * @param {number} p.tipoCambio
 * @param {number} p.porcentajeIgv
 * @param {number} p.idRegistradoPor
 * @param {string} [p.observaciones]
 * @param {Array}  p.items  [{ id_producto, id_tipo_inventario, cantidad, precio_unitario, descuento_porcentaje }]
 * @returns {Promise<number[]>} ids de las entradas creadas (una por tipo_inventario presente)
 */
export async function ingresarStockCompra(conn, p) {
  const { idOrdenCompra, idProveedor, docSoporte, moneda, tipoCambio, porcentajeIgv, idRegistradoPor } = p;
  const tc = parseFloat(tipoCambio || 1) || 1;
  const pIgv = parseFloat(porcentajeIgv || 0) || 0;

  // Agrupar por tipo de inventario: `entradas` tiene un solo id_tipo_inventario por cabecera.
  const grupos = new Map();
  for (const it of p.items) {
    if (!it.id_producto || !(parseFloat(it.cantidad) > 0)) continue;
    const key = it.id_tipo_inventario;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(it);
  }

  const idsEntrada = [];
  for (const [idTipoInv, items] of grupos) {
    let subtotal = 0, unidades = 0;
    for (const it of items) {
      const neto = parseFloat(it.precio_unitario || 0) * (1 - parseFloat(it.descuento_porcentaje || 0) / 100);
      subtotal += parseFloat(it.cantidad) * neto;
      unidades += parseFloat(it.cantidad);
    }
    const igv = subtotal * (pIgv / 100);
    const total = subtotal + igv;

    const [resEntrada] = await conn.query(
      `INSERT INTO entradas (
         id_tipo_inventario, tipo_entrada, id_proveedor, documento_soporte,
         total_costo, subtotal, igv, total, porcentaje_igv,
         moneda, tipo_cambio, monto_pagado, estado_pago, id_registrado_por,
         observaciones, id_orden_compra,
         cantidad_items_total, cantidad_items_ingresada, estado_ingreso, fecha_ingreso_completo
       ) VALUES (?, 'Compra', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Pendiente', ?, ?, ?, ?, ?, 'Completo', NOW())`,
      [
        idTipoInv, idProveedor, docSoporte,
        subtotal, subtotal, igv, total, pIgv,
        moneda, tc, idRegistradoPor,
        p.observaciones || `Ingreso por guía de compra (orden ${idOrdenCompra})`, idOrdenCompra,
        unidades, unidades,
      ]
    );
    const idEntrada = resEntrada.insertId;
    idsEntrada.push(idEntrada);

    for (const it of items) {
      const cantidad = parseFloat(it.cantidad);
      const neto = parseFloat(it.precio_unitario || 0) * (1 - parseFloat(it.descuento_porcentaje || 0) / 100);
      let costoPEN, costoUSD;
      if (moneda === 'PEN') { costoPEN = neto; costoUSD = tc ? neto / tc : 0; }
      else { costoUSD = neto; costoPEN = neto * tc; }

      await conn.query(
        `INSERT INTO detalle_entradas (id_entrada, id_producto, cantidad, costo_unitario, costo_unitario_calculado_pen, costo_unitario_calculado_usd)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [idEntrada, it.id_producto, cantidad, neto, costoPEN, costoUSD]
      );

      // Costo promedio móvil ponderado (mismo cálculo que createCompra).
      const [[prod]] = await conn.query(
        'SELECT stock_actual, costo_unitario_promedio, costo_unitario_promedio_usd FROM productos WHERE id_producto = ? FOR UPDATE',
        [it.id_producto]
      );
      const stockAnt = parseFloat(prod.stock_actual || 0);
      const cupPEN = parseFloat(prod.costo_unitario_promedio || 0);
      const cupUSD = parseFloat(prod.costo_unitario_promedio_usd || 0);
      const nuevoStock = stockAnt + cantidad;
      const nuevoCupPEN = nuevoStock > 0 ? ((stockAnt * cupPEN) + (cantidad * costoPEN)) / nuevoStock : costoPEN;
      const nuevoCupUSD = nuevoStock > 0 ? ((stockAnt * cupUSD) + (cantidad * costoUSD)) / nuevoStock : costoUSD;

      await conn.query(
        'UPDATE productos SET stock_actual = ?, costo_unitario_promedio = ?, costo_unitario_promedio_usd = ? WHERE id_producto = ?',
        [nuevoStock, nuevoCupPEN, nuevoCupUSD, it.id_producto]
      );
    }
  }
  return idsEntrada;
}
