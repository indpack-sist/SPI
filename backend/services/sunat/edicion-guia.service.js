const EPS = 0.0001;

export function armarEdicionLineasGuia(lineasActuales, detalleSubmit) {
  const porId = new Map();
  for (const s of Array.isArray(detalleSubmit) ? detalleSubmit : []) {
    const id = Number(s?.id_detalle);
    if (!Number.isFinite(id)) {
      const e = new Error('Cada línea editada debe incluir su id_detalle');
      e.status = 422;
      throw e;
    }
    porId.set(id, s);
  }

  const idsActuales = new Set(lineasActuales.map((l) => Number(l.id_detalle)));
  for (const id of porId.keys()) {
    if (!idsActuales.has(id)) {
      const e = new Error('Una de las líneas editadas no pertenece a esta guía');
      e.status = 422;
      throw e;
    }
  }

  const updates = [];
  const deletes = [];

  for (const linea of lineasActuales) {
    const id = Number(linea.id_detalle);
    const enviado = porId.get(id);
    const cantidad = enviado === undefined ? 0 : parseFloat(enviado.cantidad);
    const cantidadNum = Number.isFinite(cantidad) ? cantidad : 0;

    if (cantidadNum <= EPS) {
      deletes.push(id);
      continue;
    }

    const nombre = linea.nombre || linea.descripcion || 'Ítem';
    const codigo = linea.codigo || 'libre';
    const tope = Number(linea.pedido) - Number(linea.en_otras);

    if (cantidadNum > tope + EPS) {
      const e = new Error(`${nombre} (${codigo}): la cantidad (${cantidadNum}) excede lo pendiente en la orden (${Math.max(0, tope).toFixed(4)})`);
      e.status = 422;
      throw e;
    }

    if (!linea.es_libre) {
      const stock = parseFloat(linea.stock_actual);
      if (Number.isFinite(stock) && cantidadNum > stock + EPS) {
        const e = new Error(`${nombre} (${codigo}): stock insuficiente. Disponible: ${stock.toFixed(4)}, requerido: ${cantidadNum.toFixed(4)}`);
        e.status = 422;
        throw e;
      }
    }

    const pesoUnit = parseFloat(enviado.peso_unitario_kg);
    const pesoUnitNum = Number.isFinite(pesoUnit) ? pesoUnit : 0;
    const pesoTotal = cantidadNum * pesoUnitNum;

    updates.push({
      id_detalle: id,
      cantidad: cantidadNum,
      peso_unitario_kg: pesoUnitNum,
      peso_total_kg: pesoTotal,
    });
  }

  if (updates.length === 0) {
    const e = new Error('La guía debe conservar al menos un producto con cantidad mayor a 0');
    e.status = 422;
    throw e;
  }

  const pesoBruto = updates.reduce((sum, u) => sum + u.peso_total_kg, 0);

  return { updates, deletes, pesoBruto };
}
