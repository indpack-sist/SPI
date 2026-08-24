// scripts/test-reemplazar-gre.js — Prueba CONTROLADA end-to-end de reemplazo de GRE (Fase 12) en BETA.
// Clona el fixture guia id=2 a guías DE PRUEBA (numero_guia 'TEST-...'), ejerce los dos caminos del
// hook y LIMPIA todo al final (borra las guías de prueba + resetea el correlativo TE01).
// SUNAT va mockeado (BETA): la guía nueva del reemplazo sale ACEPTADA por el mock.
//
// Uso:  node scripts/test-reemplazar-gre.js   (requiere backend/.env con la BD real)
import 'dotenv/config';
import { pool } from '../config/database.js';
import { sunatConfig } from '../config/sunat.js';
import { reemplazarGuiaRemision } from '../services/sunat/gre-anulacion.service.js';
import { cerrarTicketGre } from '../services/sunat/gre-emision.service.js';

const TAG = 'TEST-' + Date.now();
const creadas = []; // ids a limpiar
let pass = 0, fail = 0;
const check = (n, ok, extra = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✅' : '❌'} ${n}${extra ? '  —  ' + extra : ''}`); };

// Clona el fixture id=2 a una guía nueva con estado controlado. Devuelve el id.
// numeroGuia va en formato real 'T001-XXXXXXXX' y contiguo, porque reemplazarGuiaRemision deriva
// el siguiente número de los dígitos finales del último numero_guia (lógica heredada de createGuia).
async function clonarFixture({ numeroGuia, sunat_estado, estado, numero_sunat, sunat_qr_url = null, sunat_ticket = null }) {
  const [ins] = await pool.query(
    `INSERT INTO guias_remision
       (numero_guia, id_orden_venta, id_factura, id_cliente, id_conductor, id_vehiculo, fecha_traslado,
        punto_partida, punto_llegada, tipo_traslado, motivo_traslado, modalidad_transporte,
        direccion_partida, ubigeo_partida, direccion_llegada, ubigeo_llegada, ciudad_llegada,
        peso_bruto_kg, numero_bultos, observaciones, motivo_traslado_cod, doc_relacionado_tipo, doc_relacionado_num,
        serie_sunat, numero_sunat, sunat_estado, sunat_qr_url, sunat_digest_value, sunat_ticket, estado)
     SELECT ?, id_orden_venta, id_factura, id_cliente, id_conductor, id_vehiculo, fecha_traslado,
        punto_partida, punto_llegada, tipo_traslado, motivo_traslado, modalidad_transporte,
        direccion_partida, ubigeo_partida, direccion_llegada, ubigeo_llegada, ciudad_llegada,
        peso_bruto_kg, numero_bultos, observaciones, motivo_traslado_cod, doc_relacionado_tipo, doc_relacionado_num,
        'TE01', ?, ?, ?, 'testdigest', ?, ?
     FROM guias_remision WHERE id_guia = 2`,
    [numeroGuia, numero_sunat, sunat_estado, sunat_qr_url, sunat_ticket, estado]);
  const id = ins.insertId;
  creadas.push(id);
  await pool.query(
    `INSERT INTO detalle_guia_remision (id_guia, id_detalle_orden, id_producto, cantidad, unidad_medida, descripcion, peso_unitario_kg, peso_total_kg)
     SELECT ?, id_detalle_orden, id_producto, cantidad, unidad_medida, descripcion, peso_unitario_kg, peso_total_kg
       FROM detalle_guia_remision WHERE id_guia = 2`, [id]);
  return id;
}

async function estadoDe(id) {
  const [[g]] = await pool.query(
    'SELECT sunat_estado, estado, id_guia_reemplazo, anulado_por, motivo_anulacion, fecha_anulacion FROM guias_remision WHERE id_guia = ?', [id]);
  return g;
}

async function main() {
  console.log(`\n=== FASE 12 — Prueba controlada de reemplazo GRE (BETA mock) · ${TAG} ===\n`);
  const [[corr0]] = await pool.query("SELECT ultimo_numero FROM series_correlativos WHERE serie='TE01'");
  const correlativoInicial = corr0.ultimo_numero;
  // Base de numeración contigua a partir del último numero_guia (igual que la app).
  const [[last]] = await pool.query('SELECT numero_guia FROM guias_remision ORDER BY id_guia DESC LIMIT 1');
  const mBase = last?.numero_guia?.match(/(\d+)$/);
  const base = mBase ? parseInt(mBase[1]) : 0;
  const num = (off) => `T001-${String(base + off).padStart(8, '0')}`;
  console.log(`  correlativo TE01 inicial: ${correlativoInicial} · base numero_guia: ${base}\n`);

  // ── CAMINO 1: ACEPTADO (reemplazo real e2e) ──────────────────────────────
  // A = base+1 ; reemplazar genera la nueva B = base+2 automáticamente.
  console.log('— Camino 1: guía nueva ACEPTADA → original REEMPLAZADA —');
  const idA = await clonarFixture({ numeroGuia: num(1), sunat_estado: 'ACEPTADO', estado: 'Emitida', numero_sunat: 9001, sunat_qr_url: 'https://sunat/test-A' });
  const r = await reemplazarGuiaRemision(idA, { correcciones: { observaciones: 'Corrección de prueba' }, idEmpleado: 2, esAdmin: true });
  const idB = r.body?.reemplazo?.idGuiaNueva;
  if (idB) creadas.push(idB);
  const A = await estadoDe(idA);
  const B = idB ? await estadoDe(idB) : null;
  check('guía nueva creada y emitida (mock)', !!idB && B?.sunat_estado === 'ACEPTADO', `nueva id=${idB} estado=${B?.sunat_estado}`);
  check('original → sunat_estado REEMPLAZADA', A.sunat_estado === 'REEMPLAZADA', `sunat_estado=${A.sunat_estado}`);
  check('original → estado negocio Anulada', A.estado === 'Anulada', `estado=${A.estado}`);
  check('original → id_guia_reemplazo apunta a la nueva', Number(A.id_guia_reemplazo) === Number(idB), `id_guia_reemplazo=${A.id_guia_reemplazo}`);
  check('original → fecha_anulacion sellada', !!A.fecha_anulacion, `${A.fecha_anulacion}`);
  check('resultado.estadoOriginal = REEMPLAZADA', r.body?.reemplazo?.estadoOriginal === 'REEMPLAZADA');

  // ── CAMINO 2: RECHAZADO (aborto, sin reemplazo fantasma) ──────────────────
  console.log('\n— Camino 2: guía nueva RECHAZADA → original vuelve a VIGENTE (aborto) —');
  const idC = await clonarFixture({ numeroGuia: num(3), sunat_estado: 'ACEPTADO', estado: 'Emitida', numero_sunat: 9003, sunat_qr_url: 'https://sunat/test-C' });
  const idD = await clonarFixture({ numeroGuia: num(4), sunat_estado: 'ENVIADO', estado: 'Emitida', numero_sunat: 9004, sunat_ticket: 'TESTMOCK' });
  // Simular la marca "reemplazo en curso" (como la deja reemplazarGuiaRemision en su TX).
  await pool.query(
    "UPDATE guias_remision SET id_guia_reemplazo = ?, anulado_por = 2, motivo_anulacion = 'Reemplazo en curso (prueba)' WHERE id_guia = ?",
    [idD, idC]);
  // Cerrar el ticket de la nueva como RECHAZADO → dispara el hook de aborto sobre C.
  await cerrarTicketGre(idD, `${sunatConfig.ruc}-09-TE01-9004`, 'TESTMOCK',
    { codRespuesta: '99', cdrZip: null, error: { numError: '0999', desError: 'RECHAZO SIMULADO (prueba)' }, mock: true }, Date.now());
  const C = await estadoDe(idC);
  const D = await estadoDe(idD);
  check('guía nueva → RECHAZADO', D.sunat_estado === 'RECHAZADO', `estado=${D.sunat_estado}`);
  check('original sigue VIGENTE (ACEPTADO)', C.sunat_estado === 'ACEPTADO', `sunat_estado=${C.sunat_estado}`);
  check('original conserva estado Emitida', C.estado === 'Emitida', `estado=${C.estado}`);
  check('ABORTO: id_guia_reemplazo limpiado (NULL)', C.id_guia_reemplazo === null, `id_guia_reemplazo=${C.id_guia_reemplazo}`);
  check('ABORTO: anulado_por limpiado (NULL)', C.anulado_por === null, `anulado_por=${C.anulado_por}`);
  check('ABORTO: motivo_anulacion limpiado (NULL)', C.motivo_anulacion === null, `motivo_anulacion=${C.motivo_anulacion}`);
  check('ABORTO: fecha_anulacion limpiado (NULL)', C.fecha_anulacion === null, `fecha_anulacion=${C.fecha_anulacion}`);

  // ── LIMPIEZA ─────────────────────────────────────────────────────────────
  console.log('\n— Limpieza —');
  for (const id of creadas) {
    await pool.query('DELETE FROM detalle_guia_remision WHERE id_guia = ?', [id]);
    await pool.query('DELETE FROM guias_remision WHERE id_guia = ?', [id]);
  }
  await pool.query("UPDATE series_correlativos SET ultimo_numero = ? WHERE serie = 'TE01'", [correlativoInicial]);
  const [[corr1]] = await pool.query("SELECT ultimo_numero FROM series_correlativos WHERE serie='TE01'");
  console.log(`  guías de prueba borradas: [${creadas.join(', ')}]`);
  console.log(`  correlativo TE01 restaurado: ${corr1.ultimo_numero} (era ${correlativoInicial})`);

  console.log(`\n=== RESUMEN: ${pass} PASS · ${fail} FAIL ===\n`);
  await pool.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('\n❌ ERROR en la prueba:', e.message);
  // Intento de limpieza best-effort ante fallo.
  try {
    for (const id of creadas) {
      await pool.query('DELETE FROM detalle_guia_remision WHERE id_guia = ?', [id]);
      await pool.query('DELETE FROM guias_remision WHERE id_guia = ?', [id]);
    }
    console.error(`  (limpieza best-effort de [${creadas.join(', ')}] intentada)`);
  } catch { /* noop */ }
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
