import { armarEdicionLineasGuia } from '../services/sunat/edicion-guia.service.js';

let pass = 0, fail = 0;
const check = (nombre, cond, detalle = '') => {
  const ok = !!cond;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✓' : '✗'} ${nombre}${detalle ? '  —  ' + detalle : ''}`);
};
const throws = (nombre, fn, fragmento) => {
  try {
    fn();
    fail++;
    console.log(`  ✗ ${nombre}  —  no lanzó error`);
  } catch (e) {
    const ok = !fragmento || String(e.message).includes(fragmento);
    ok ? pass++ : fail++;
    console.log(`  ${ok ? '✓' : '✗'} ${nombre}  —  ${e.status || '-'}: ${e.message}`);
  }
};

const lineas = [
  { id_detalle: 1, id_detalle_orden: 11, id_producto: 100, es_libre: 0, codigo: 'A1', nombre: 'PROD A', stock_actual: 500, pedido: 60, en_otras: 0 },
  { id_detalle: 2, id_detalle_orden: 12, id_producto: 200, es_libre: 0, codigo: 'B1', nombre: 'PROD B', stock_actual: 2000, pedido: 1000, en_otras: 0 },
];

console.log('\n=== GRE · edición de líneas de la guía ===\n');

{
  const r = armarEdicionLineasGuia(lineas, [
    { id_detalle: 1, cantidad: 60, peso_unitario_kg: 10 },
    { id_detalle: 2, cantidad: 1000, peso_unitario_kg: 0.4 },
  ]);
  check('ambas se actualizan', r.updates.length === 2, `len=${r.updates.length}`);
  check('sin eliminaciones', r.deletes.length === 0);
  check('peso_total línea 1', r.updates[0].peso_total_kg === 600, `=${r.updates[0].peso_total_kg}`);
  check('peso bruto = 1000', Math.abs(r.pesoBruto - 1000) < 1e-9, `=${r.pesoBruto}`);
}

{
  const r = armarEdicionLineasGuia(lineas, [
    { id_detalle: 1, cantidad: 0, peso_unitario_kg: 10 },
    { id_detalle: 2, cantidad: 500, peso_unitario_kg: 0.4 },
  ]);
  check('excluir con cantidad 0 → delete', r.deletes.includes(1) && r.updates.length === 1, `del=${r.deletes} up=${r.updates.length}`);
  check('peso bruto recalculado tras excluir', Math.abs(r.pesoBruto - 200) < 1e-9, `=${r.pesoBruto}`);
}

{
  const r = armarEdicionLineasGuia(lineas, [
    { id_detalle: 2, cantidad: 500, peso_unitario_kg: 0.4 },
  ]);
  check('línea ausente del array → delete', r.deletes.includes(1), `del=${r.deletes}`);
  check('solo queda la enviada', r.updates.length === 1 && r.updates[0].id_detalle === 2);
}

throws('todas en 0 → 422', () => armarEdicionLineasGuia(lineas, [
  { id_detalle: 1, cantidad: 0 }, { id_detalle: 2, cantidad: 0 },
]), 'al menos un producto');

throws('cantidad > pendiente en orden → 422', () => armarEdicionLineasGuia(lineas, [
  { id_detalle: 1, cantidad: 61, peso_unitario_kg: 10 },
]), 'excede lo pendiente');

{
  const topado = [{ ...lineas[0], en_otras: 55 }];
  throws('tope descuenta otras guías vigentes → 422', () => armarEdicionLineasGuia(topado, [
    { id_detalle: 1, cantidad: 10, peso_unitario_kg: 10 },
  ]), 'excede lo pendiente');
}

{
  const sinStock = [{ ...lineas[0], stock_actual: 5 }];
  throws('cantidad > stock (no libre) → 422', () => armarEdicionLineasGuia(sinStock, [
    { id_detalle: 1, cantidad: 60, peso_unitario_kg: 10 },
  ]), 'stock insuficiente');
}

{
  const libre = [{ id_detalle: 9, id_detalle_orden: 90, id_producto: null, es_libre: 1, codigo: 'libre', nombre: 'TEXTO', stock_actual: 0, pedido: 5, en_otras: 0 }];
  const r = armarEdicionLineasGuia(libre, [{ id_detalle: 9, cantidad: 5, peso_unitario_kg: 1 }]);
  check('ítem libre ignora stock', r.updates.length === 1 && r.updates[0].peso_total_kg === 5);
}

throws('id_detalle ajeno a la guía → 422', () => armarEdicionLineasGuia(lineas, [
  { id_detalle: 999, cantidad: 1, peso_unitario_kg: 1 },
]), 'no pertenece');

throws('línea sin id_detalle → 422', () => armarEdicionLineasGuia(lineas, [
  { cantidad: 1, peso_unitario_kg: 1 },
]), 'id_detalle');

console.log(`\nResultado: ${pass} ✓  ${fail} ✗\n`);
process.exit(fail ? 1 : 0);
