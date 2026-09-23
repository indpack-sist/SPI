import 'dotenv/config';
import { executeQuery } from '../config/database.js';
import { detectarSector, esInsumoAgricola, clasificarCiiuFrutaVerdura } from '../services/prospectos.service.js';
import { consultarPorRuc } from '../services/padron-ruc.service.js';

// ============================================================
// Depura SOLO el bucket de Agroexportación (separar fruta/verdura de la
// agroindustria de insumos). Los demás sectores NO se tocan.
//   Fase 1 (nombre): en sector='Agroexportación', excluye prospectos que ya no
//                    son fruta/verdura; borra esas filas de padron_empresas.
//   Fase 2 (--verificar-ciiu): trae el CIIU real y excluye/rehabilita (solo agro).
// Flags:
//   --verificar-ciiu   activa la Fase 2 (consultas a ruc.pe, lento)
//   --limit=N          máximo de RUCs a consultar en la Fase 2 (default 500)
//   --dry-run          no escribe; solo reporta conteos
// ============================================================

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (k, d) => { const a = args.find((x) => x.startsWith(`${k}=`)); return a ? a.split('=')[1] : d; };
const DRY = has('--dry-run');
const VERIFICAR_CIIU = has('--verificar-ciiu');
const LIMIT = Math.max(1, parseInt(val('--limit', '500'), 10) || 500);

function esObjetivoPorNombre(razon) {
  if (esInsumoAgricola(razon)) return false;
  return detectarSector(razon)?.sector === 'Agroexportación';
}

async function fase1Nombre() {
  console.log('== Fase 1: reclasificación por nombre (SOLO bucket Agroexportación) ==');
  // SOLO Agroexportación: los que ya no son fruta/verdura (ahora insumo/otro) →
  // excluido = 1. Los demás sectores NO se tocan.
  const pr = await executeQuery(
    "SELECT id_prospecto, razon_social FROM prospectos WHERE excluido = 0 AND sector = 'Agroexportación' AND (origen IS NULL OR origen <> 'manual')"
  );
  if (!pr.success) throw new Error(pr.error);
  let excluir = 0;
  for (const p of pr.data) {
    if (!esObjetivoPorNombre(p.razon_social)) {
      excluir++;
      if (!DRY) await executeQuery('UPDATE prospectos SET excluido = 1 WHERE id_prospecto = ?', [p.id_prospecto]);
    }
  }
  console.log(`  prospectos Agroexportación a excluir por nombre: ${excluir} / ${pr.data.length}`);

  // padron_empresas: SOLO Agroexportación; borra los que ya no son fruta/verdura.
  const pe = await executeQuery("SELECT ruc, razon_social FROM padron_empresas WHERE sector = 'Agroexportación'");
  if (pe.success) {
    let borrar = 0;
    for (const e of pe.data) {
      if (!esObjetivoPorNombre(e.razon_social)) {
        borrar++;
        if (!DRY) await executeQuery('DELETE FROM padron_empresas WHERE ruc = ?', [e.ruc]);
      }
    }
    console.log(`  padron_empresas Agroexportación a borrar por nombre: ${borrar} / ${pe.data.length}`);
  }
}

async function fase2Ciiu() {
  console.log(`== Fase 2: verificación CIIU (limit ${LIMIT}) ==`);
  // Candidatos: SOLO bucket Agroexportación, con RUC, sin CIIU aún, del padrón/sunat.
  // Incluye excluidos (para REHABILITAR los de nombre neutro que sí son fruta/verdura).
  const cand = await executeQuery(
    `SELECT id_prospecto, documento, excluido FROM prospectos
      WHERE documento IS NOT NULL AND documento <> ''
        AND (ciiu IS NULL OR ciiu = '')
        AND sector = 'Agroexportación'
        AND (origen IN ('padron','sunat'))
      ORDER BY excluido ASC, id_prospecto ASC
      LIMIT ${LIMIT}`
  );
  if (!cand.success) throw new Error(cand.error);
  let excluidos = 0, rehabilitados = 0, verificados = 0;
  for (const p of cand.data) {
    let v = null;
    try { v = await consultarPorRuc(p.documento); } catch { /* sigue */ }
    if (!v?.valido || !v.datos) continue;
    const ciiu = v.datos.ciiu || [];
    if (ciiu[0]?.codigo && !DRY) {
      await executeQuery('UPDATE prospectos SET ciiu = COALESCE(NULLIF(ciiu, ""), ?) WHERE id_prospecto = ?', [ciiu[0].codigo, p.id_prospecto]);
    }
    const clasif = clasificarCiiuFrutaVerdura(ciiu);
    if (!clasif) continue;
    verificados++;
    if (clasif.objetivo === false && p.excluido === 0) {
      excluidos++;
      if (!DRY) await executeQuery('UPDATE prospectos SET excluido = 1 WHERE id_prospecto = ?', [p.id_prospecto]);
    } else if (clasif.objetivo === true && p.excluido === 1) {
      rehabilitados++;
      if (!DRY) await executeQuery('UPDATE prospectos SET excluido = 0 WHERE id_prospecto = ?', [p.id_prospecto]);
    }
  }
  console.log(`  verificados por CIIU: ${verificados}; excluidos: ${excluidos}; rehabilitados: ${rehabilitados}`);
}

(async () => {
  if (DRY) console.log('*** DRY-RUN: no se escribe nada ***');
  await fase1Nombre();
  if (VERIFICAR_CIIU) await fase2Ciiu();
  console.log('Listo.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
