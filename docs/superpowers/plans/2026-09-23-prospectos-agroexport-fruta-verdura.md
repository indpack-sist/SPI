# Prospección enfocada a comercio de frutas/verduras — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Nota de flujo:** en este proyecto el dueño commitea a mano en `main`. Los pasos de commit dejan el `git add` + mensaje sugerido; confirma con el usuario antes de commitear si ejecutas tú.

**Goal:** Que el módulo de Prospección traiga solo empresas de comercio/exportación de frutas y verduras frescas, excluyendo agroindustria de insumos (plaguicidas, fertilizantes, veterinaria) y rubros ajenos, usando nombre (barato) + CIIU real de SUNAT (autoritativo).

**Architecture:** Dos etapas. (1) Filtro por nombre endurecido en la fuente única `prospectos.service.js` (lista positiva de fruta/verdura + lista negra de insumos; se elimina el token suelto `AGRO`). (1b) La ingesta del padrón (`clasificarObjetivo`) solo acepta el sector Agroexportación. (2) Compuerta CIIU en el worker de enriquecimiento: a cada prospecto del padrón se le trae el CIIU y se confirma/excluye según la actividad real. (3) Script de reclasificación que reusa lo anterior para limpiar lo ya cargado y rehabilitar por CIIU los de nombre neutro que sí son fruta/verdura.

**Tech Stack:** Node.js (ESM), MySQL 8 (mysql2), tests como scripts Node planos con helper `check()` (sin jest/vitest).

---

## ⚠️ Restricción de recursos (Render Free)

El backend corre en **Render Free** (CPU muy limitada). Un `PROSPECTOS_WORKER_CONCURRENCIA=8` ya colgó HTTP+WS por saturar la CPU; hoy está en **1** y **NO se debe cambiar**.

Reglas para quien implemente:
- **No** modificar `PROSPECTOS_WORKER_CONCURRENCIA` ni la lógica de concurrencia del worker.
- La compuerta CIIU es I/O de red (await, no CPU) y queda serializada por el throttle existente de `padron-ruc` (~1.2 s) y por `CONCURRENCIA=1`. No paralelizar.
- Durante la implementación, **solo** correr los tests locales de funciones puras (`test:prospectos`, `test:padron`) y el smoke de imports (`node -e import(...)`). **NO** ejecutar el worker en vivo ni el script `reclasificar-prospeccion.mjs` contra la BD real: esos pasos los corre el usuario, por lotes (`--limit`) y en horario de baja carga. Los pasos marcados "(con BD / requiere BD)" quedan para el usuario.

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `backend/services/prospectos.service.js` | Fuente única de clasificación: listas, `detectarSector`, `esInsumoAgricola`, `clasificarCiiuFrutaVerdura` | Modificar |
| `backend/services/padron-import.service.js` | `clasificarObjetivo` solo acepta Agroexportación | Modificar |
| `backend/services/scraping-worker.js` | Compuerta CIIU en el enriquecimiento de prospectos de origen `padron` | Modificar |
| `backend/scripts/reclasificar-prospeccion.mjs` | Script de reclasificación/limpieza + rehabilitación por CIIU | Crear |
| `backend/scripts/test-prospectos-sector.mjs` | Tests unitarios de la clasificación (nombre + CIIU) | Crear |
| `backend/scripts/test-padron-import.mjs` | Actualizar casos: logística ya no es objetivo; agregar fruta/verdura e insumo | Modificar |
| `backend/package.json` | Scripts `test:prospectos` y `reclasificar:prospeccion` | Modificar |

Sin cambios de esquema: usa columnas existentes (`sector`, `ciiu`, `excluido`). Sin cambios de frontend obligatorios (las facetas de sector son dinámicas).

---

## Task 1: Listas de clasificación por nombre + endurecer `detectarSector`

**Files:**
- Modify: `backend/services/prospectos.service.js` (bloque `SECTORES_OBJETIVO` ~L31-47, `detectarSector` ~L129-139)
- Create: `backend/scripts/test-prospectos-sector.mjs`
- Modify: `backend/package.json`

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/scripts/test-prospectos-sector.mjs`:

```js
import { detectarSector, esInsumoAgricola } from '../services/prospectos.service.js';

let ok = 0, fail = 0;
const check = (nombre, cond, extra = '') => {
  if (cond) { ok++; console.log(`  ✓ ${nombre} ${extra}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
};

console.log('esInsumoAgricola:');
check('AGROABONOS ORGÁNICOS → insumo', esInsumoAgricola('AGROABONOS ORGÁNICOS S.A.C.') === true);
check('AGRO VETERINARIA → insumo', esInsumoAgricola('AGRO VETERINARIA CHALLCO S.A.C.') === true);
check('AGRO UNITEK CROPSCIENCE → insumo', esInsumoAgricola('AGRO UNITEK CROPSCIENCE S.A.C.') === true);
check('AGRO Y PERFORACIONES → insumo/ajeno', esInsumoAgricola('AGRO Y PERFORACIONES E.I.R.L.') === true);
check('AGRO VIVEROS SEEDS → insumo', esInsumoAgricola('AGRO VIVEROS SEEDS S.A.C.') === true);
check('AGROEXPORTADORA DEL SUR → NO insumo', esInsumoAgricola('AGROEXPORTADORA DEL SUR S.A.C.') === false);

console.log('detectarSector (Agroexportación = solo fruta/verdura):');
check('AGROEXPORTADORA → Agroexportación', detectarSector('AGROEXPORTADORA DEL SUR S.A.C.')?.sector === 'Agroexportación');
check('FRUTÍCOLA → Agroexportación', detectarSector('FRUTICOLA LOS ANDES SAC')?.sector === 'Agroexportación');
check('SOCIEDAD AGRÍCOLA → Agroexportación', detectarSector('SOCIEDAD AGRICOLA DROKASA S.A.')?.sector === 'Agroexportación');
check('EXPORTADORA DE PALTA → Agroexportación', detectarSector('EXPORTADORA DE PALTA HASS SAC')?.sector === 'Agroexportación');
check('ARÁNDANOS (con tilde) → Agroexportación', detectarSector('ARÁNDANOS DEL PERÚ SAC')?.sector === 'Agroexportación');
check('CÍTRICOS (con tilde) → Agroexportación', detectarSector('CÍTRICOS PERUANOS SAC')?.sector === 'Agroexportación');
// El token suelto AGRO ya NO basta:
check('AGRO25INVERSIONES → sin sector', detectarSector('AGRO25INVERSIONES E.I.R.L.') === null);
check('AGROABAMEN → sin sector', detectarSector('AGROABAMEN S.A.C') === null);
check('AGRO VETERINARIA → sin sector', detectarSector('AGRO VETERINARIA CHALLCO S.A.C.') === null);
check('AGROABONOS → sin sector', detectarSector('AGROABONOS ORGÁNICOS S.A.C.') === null);
check('AGRO Y PERFORACIONES → sin sector', detectarSector('AGRO Y PERFORACIONES E.I.R.L.') === null);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd backend && node scripts/test-prospectos-sector.mjs`
Expected: FAIL — `esInsumoAgricola` no existe (import inválido) o los casos "AGRO25INVERSIONES → sin sector" fallan porque el patrón actual con `AGRO` suelto los clasifica como Agroexportación.

- [ ] **Step 3: Implementar en `prospectos.service.js`**

Añadir, justo antes de `const SECTORES_OBJETIVO = [` (~L31), los helpers y listas nuevas:

```js
// Normaliza el nombre para clasificar: sin acentos y en MAYÚSCULAS. Así "CÍTRICOS"
// matchea "CITRIC" y "AGROQUÍMICOS" matchea "AGROQUIMIC" sin duplicar patrones.
const DIACRITICOS_SECTOR = /[̀-ͯ]/g;
function normalizarNombreSector(nombre) {
  return String(nombre || '').normalize('NFD').replace(DIACRITICOS_SECTOR, '').toUpperCase();
}

// Lista negra: agroindustria de INSUMOS (plaguicidas, fertilizantes, veterinaria,
// viveros/semillas) y rubros ajenos que se cuelan por el prefijo "AGRO". Si el
// nombre contiene cualquiera de estos, NO es comprador de empaque de fruta/verdura.
// Substring a propósito (sin \b): "AGROABONOS" debe matchear "ABONO".
const INSUMOS_AGRICOLAS = /AGROQUIMIC|CROPSCIENCE|INSECTICID|PLAGUICID|PESTICID|FUNGICID|HERBICID|ACARICID|NEMATICID|FERTILIZ|ABONO|FUMIGA|VETERINARI|PECUARI|SEMILLA|VIVERO|PLANTIN|AGROINSUMO|FOLIAR|RIEGO|PERFORACION|ASESOR|ABARROTE|CARNE|JARDIN|MASCOTA/;

// Señal POSITIVA de comercio/exportación de fruta y verdura. Dos grupos:
//  - prefijos (matchean por inicio: FRUT→FRUTAS, CITRIC→CITRICOS)
//  - palabras exactas cortas (\b…\b para no colar TRABAJO por "AJO", etc.)
const AGRO_FRUTA_VERDURA = /\b(FRUT|HORTALIZ|PALT|ARANDAN|BLUEBERR|ESPARRAG|ASPARAG|CITRIC|MANDARIN|NARANJA|BANAN|PAPRIKA|PIMIENT|ALCACHOFA|ARTICHOKE|GRANAD|JENGIBRE|GINGER|QUINUA|CACAO|PRODUCE|AGROEXPORT|AGRICOLA|FRESH|FRUIT)|\b(UVA|UVAS|AJO|AJOS|KION|MANGO|MANGOS|PINA|CEBOLLA)\b/;

/** ¿El nombre corresponde a agroindustria de INSUMOS o rubro ajeno (no compra empaque)? */
export function esInsumoAgricola(nombre) {
  return INSUMOS_AGRICOLAS.test(normalizarNombreSector(nombre));
}
```

Reemplazar la PRIMERA entrada del array `SECTORES_OBJETIVO` (la de Agroexportación, ~L32):

```js
  { patron: AGRO_FRUTA_VERDURA, sector: 'Agroexportación', bono: 16 },
```

Reemplazar la función `detectarSector` (~L129-139) por:

```js
export function detectarSector(nombre) {
  if (!nombre) return null;
  const n = normalizarNombreSector(nombre);
  // Empresa de servicios (ANTISECTORES) o insumo agrícola/rubro ajeno: sin encaje.
  if (ANTISECTORES.test(n) || INSUMOS_AGRICOLAS.test(n)) return null;
  for (const s of SECTORES_OBJETIVO) {
    if (s.patron.test(n)) {
      return { sector: s.sector, bono: s.bono };
    }
  }
  return null;
}
```

Actualizar también `esEmpresaServicios` (~L125-127) para que normalice (coherencia):

```js
export function esEmpresaServicios(nombre) {
  return ANTISECTORES.test(normalizarNombreSector(nombre));
}
```

- [ ] **Step 4: Agregar el script de test a `package.json`**

En `backend/package.json`, dentro de `"scripts"`, añadir:

```json
    "test:prospectos": "node scripts/test-prospectos-sector.mjs",
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd backend && npm run test:prospectos`
Expected: PASS — todas las líneas con ✓ y `N OK, 0 FAIL`.

- [ ] **Step 6: Commit**

```bash
git add backend/services/prospectos.service.js backend/scripts/test-prospectos-sector.mjs backend/package.json
git commit -m "prospeccion: endurecer sector agro a fruta/verdura + lista negra de insumos"
```

---

## Task 2: Clasificación autoritativa por CIIU (`clasificarCiiuFrutaVerdura`)

**Files:**
- Modify: `backend/services/prospectos.service.js` (junto a `sectorPorCiiu`, ~L71-83)
- Modify: `backend/scripts/test-prospectos-sector.mjs`

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `backend/scripts/test-prospectos-sector.mjs`, ANTES de la línea `console.log(\`\n${ok} OK...`:

```js
import { clasificarCiiuFrutaVerdura } from '../services/prospectos.service.js';

console.log('clasificarCiiuFrutaVerdura:');
// Cultivo de fruta/verdura y comercio de alimentos → objetivo.
check('0113 hortalizas → objetivo', clasificarCiiuFrutaVerdura([{ codigo: '0113', descripcion: 'CULTIVO DE HORTALIZAS' }])?.objetivo === true);
check('0122 frutas tropicales → objetivo', clasificarCiiuFrutaVerdura([{ codigo: '01220' }])?.objetivo === true);
check('4630 mayorista alimentos → objetivo', clasificarCiiuFrutaVerdura([{ codigo: '46309' }])?.objetivo === true);
// Insumos / otras actividades → NO objetivo (con motivo).
check('2021 plaguicidas → excluir', clasificarCiiuFrutaVerdura([{ codigo: '2021', descripcion: 'FAB. DE PLAGUICIDAS' }])?.objetivo === false);
check('4669 otros mayoristas → excluir', clasificarCiiuFrutaVerdura([{ codigo: '46690' }])?.objetivo === false);
check('75000 veterinaria → excluir', clasificarCiiuFrutaVerdura([{ codigo: '75000', descripcion: 'ACTIVIDADES VETERINARIAS' }])?.objetivo === false);
check('excluir trae motivo', typeof clasificarCiiuFrutaVerdura([{ codigo: '2021', descripcion: 'FAB. DE PLAGUICIDAS' }])?.motivo === 'string');
// Sin CIIU verificable → null (no decide).
check('sin ciiu → null', clasificarCiiuFrutaVerdura([]) === null);
check('undefined → null', clasificarCiiuFrutaVerdura(undefined) === null);
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd backend && npm run test:prospectos`
Expected: FAIL — `clasificarCiiuFrutaVerdura` no está exportada (import inválido).

- [ ] **Step 3: Implementar en `prospectos.service.js`**

Añadir, justo después de la función `sectorPorCiiu` (~L83):

```js
// CIIU (Rev.4) que SÍ son comercio/cultivo de fruta y verdura fresca (compran
// empaque). Se comparan por prefijo del código: 011/012 = cultivo de plantas
// (hortalizas y frutas), 0163 = actividades post-cosecha (empaque de fruta),
// 4630 = venta al por mayor de alimentos y bebidas. Ajustable si se quiere
// acotar más (p.ej. excluir cereales 0111).
const CIIU_FRUTA_VERDURA = ['011', '012', '0163', '4630'];

/**
 * Clasifica un prospecto por su CIIU REAL de SUNAT (autoritativo, mucho más
 * fiable que el nombre).
 * @param {Array<{codigo?:string,descripcion?:string}>|string} ciiu
 * @returns {{objetivo:true} | {objetivo:false, motivo:string} | null}
 *   - {objetivo:true}          si alguna actividad es fruta/verdura.
 *   - {objetivo:false, motivo} si tiene CIIU real pero NINGUNO es fruta/verdura.
 *   - null                     si no hay CIIU verificable (no se puede decidir).
 */
export function clasificarCiiuFrutaVerdura(ciiu) {
  if (!ciiu) return null;
  const lista = Array.isArray(ciiu) ? ciiu : [ciiu];
  const items = lista
    .map((it) => ({ codigo: String(it?.codigo ?? it ?? '').replace(/\D/g, ''), descripcion: it?.descripcion || null }))
    .filter((it) => it.codigo.length >= 3);
  if (!items.length) return null; // sin CIIU verificable

  for (const it of items) {
    if (CIIU_FRUTA_VERDURA.some((p) => it.codigo.startsWith(p))) return { objetivo: true };
  }
  const primero = items[0];
  const desc = primero.descripcion || `CIIU ${primero.codigo}`;
  return { objetivo: false, motivo: `Actividad no es comercio de fruta/verdura (${desc})` };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd backend && npm run test:prospectos`
Expected: PASS — `N OK, 0 FAIL`.

- [ ] **Step 5: Commit**

```bash
git add backend/services/prospectos.service.js backend/scripts/test-prospectos-sector.mjs
git commit -m "prospeccion: clasificacion autoritativa por CIIU (fruta/verdura)"
```

---

## Task 3: Enfocar la ingesta del padrón a solo Agroexportación

**Files:**
- Modify: `backend/services/padron-import.service.js` (`clasificarObjetivo`, ~L58-64)
- Modify: `backend/scripts/test-padron-import.mjs` (casos ~L38, L41-45)

- [ ] **Step 1: Actualizar los tests (que ahora deben fallar)**

En `backend/scripts/test-padron-import.mjs`:

Reemplazar la línea 38:

```js
check('TAB objetivo (logística ya NO es objetivo) → null', clasificarObjetivo(pt) === null);
```

Reemplazar el bloque `console.log('clasificarObjetivo:')` (L40-45) por:

```js
console.log('clasificarObjetivo (solo Agroexportación fruta/verdura):');
check('logística → NO objetivo', clasificarObjetivo(parsearLineaPadron(LOGISTICA)) === null);
check('agroexport → objetivo', clasificarObjetivo(parsearLineaPadron(AGROEXP))?.sector === 'Agroexportación');
check('servicios (marketing) → descartado', clasificarObjetivo(parsearLineaPadron(SERVICIOS)) === null);
check('persona natural (RUC 10) → descartado', clasificarObjetivo(parsearLineaPadron(PERSONA)) === null);
check('estado BAJA → descartado', clasificarObjetivo(parsearLineaPadron(BAJA)) === null);

// Insumo agrícola aunque el nombre empiece con AGRO → descartado.
const INSUMO = '20611111111\tAGROABONOS ORGANICOS S.A.C.\tACTIVO\tHABIDO\t150131\tAV\tLOS ABONOS\t-\t-\t50\t-\t-\t-\t-\t-';
check('insumo (abonos) → descartado', clasificarObjetivo(parsearLineaPadron(INSUMO)) === null);
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd backend && npm run test:padron`
Expected: FAIL — `logística → NO objetivo` falla porque `clasificarObjetivo` aún acepta logística.

- [ ] **Step 3: Implementar en `padron-import.service.js`**

Reemplazar `clasificarObjetivo` (~L58-64) por:

```js
export function clasificarObjetivo(rec) {
  if (!rec || !rec.razon_social) return null;
  if (!/^(20|15|17)/.test(rec.ruc)) return null;
  if (!/ACTIVO/i.test(rec.estado || '')) return null;
  // Enfoque del módulo: SOLO comercio/exportación de fruta y verdura.
  const det = detectarSector(rec.razon_social);
  return det && det.sector === 'Agroexportación' ? { sector: det.sector } : null;
}
```

(El import de `detectarSector` desde `./prospectos.service.js` ya existe en L8.)

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd backend && npm run test:padron`
Expected: PASS — `N OK, 0 FAIL`.

- [ ] **Step 5: Commit**

```bash
git add backend/services/padron-import.service.js backend/scripts/test-padron-import.mjs
git commit -m "padron: ingesta solo de Agroexportacion fruta/verdura"
```

---

## Task 4: Compuerta CIIU en el worker de enriquecimiento

**Files:**
- Modify: `backend/services/scraping-worker.js` (imports ~L1-13; `procesarWebScrape` ~L182-275)

**Contexto:** hoy `descubrirPadron` encola un job `web_scrape` por prospecto pero nunca consulta el CIIU. Se agrega, al inicio del enriquecimiento de los prospectos de origen `padron`, una consulta a `consultarPorRuc` que guarda el CIIU y aplica la compuerta: si la actividad no es fruta/verdura, se marca `excluido = 1` con motivo y se termina el job sin gastar el scraping de web.

- [ ] **Step 1: Agregar imports**

En `backend/services/scraping-worker.js`, en el bloque de imports de `./prospectos.service.js` (~L2-9), añadir `clasificarCiiuFrutaVerdura`:

```js
import {
  crearProspectoDesdeDatos,
  recalcularScore,
  normalizarTelefono,
  normalizarEmail,
  normalizarDocumento,
  getFechaPeru,
  clasificarCiiuFrutaVerdura,
} from './prospectos.service.js';
```

Y añadir, tras el import de `descubrirWeb` (~L12):

```js
import { consultarPorRuc } from './padron-ruc.service.js';
```

- [ ] **Step 2: Escribir el helper de compuerta CIIU**

Añadir en `scraping-worker.js`, justo antes de `async function procesarWebScrape` (~L181):

```js
// ---- Compuerta CIIU: valida un prospecto del padrón contra su ACTIVIDAD REAL ----
// Trae el CIIU de SUNAT (ruc.pe) y decide si es comercio de fruta/verdura. Si no
// lo es, marca excluido=1 con motivo (registrado en prospecto_fuentes). Si la
// fuente no responde, no excluye (queda "sin verificar"). Best-effort.
// @returns {Promise<{excluido:boolean, motivo?:string, verificado:boolean}>}
async function aplicarCompuertaCiiu(idProspecto, documento) {
  const doc = normalizarDocumento(documento);
  if (!/^\d{11}$/.test(doc)) return { excluido: false, verificado: false };

  let val = null;
  try { val = await consultarPorRuc(doc); } catch { /* fuente caída */ }
  if (!val?.valido || !val.datos) return { excluido: false, verificado: false };

  const ciiu = val.datos.ciiu || [];
  // Guarda el primer código CIIU si el prospecto no lo tenía.
  if (ciiu[0]?.codigo) {
    await executeQuery(
      'UPDATE prospectos SET ciiu = COALESCE(NULLIF(ciiu, ""), ?) WHERE id_prospecto = ?',
      [ciiu[0].codigo, idProspecto]
    );
  }

  const clasif = clasificarCiiuFrutaVerdura(ciiu);
  if (!clasif) return { excluido: false, verificado: false }; // sin CIIU utilizable

  if (clasif.objetivo === false) {
    await executeQuery('UPDATE prospectos SET excluido = 1 WHERE id_prospecto = ?', [idProspecto]);
    await executeQuery(
      'INSERT INTO prospecto_fuentes (id_prospecto, fuente, url, datos_raw, fecha_scraping) VALUES (?, "ciiu", ?, ?, ?)',
      [idProspecto, val.datos.fuentes?.[0]?.url || null, JSON.stringify({ excluido_por_ciiu: true, motivo: clasif.motivo, ciiu }), getFechaPeru()]
    );
    return { excluido: true, motivo: clasif.motivo, verificado: true };
  }
  return { excluido: false, verificado: true };
}
```

- [ ] **Step 3: Llamar la compuerta al inicio del enriquecimiento del padrón**

En `procesarWebScrape`, justo después de `if (!idProspecto) return fallar(job.id_job, 'Falta id_prospecto');` (~L184), insertar:

```js
  // Compuerta CIIU: solo para prospectos del padrón (origen 'padron') y no en
  // re-descubrir (que es una corrección manual). Si la actividad real no es
  // fruta/verdura, se excluye y NO se gasta el scraping de web.
  if (!params.redescubrir && params.accion === 'enriquecer') {
    const prg = await executeQuery('SELECT origen, documento FROM prospectos WHERE id_prospecto = ?', [idProspecto]);
    const pr0 = prg.data?.[0];
    if (pr0 && pr0.origen === 'padron' && pr0.documento) {
      const gate = await aplicarCompuertaCiiu(idProspecto, pr0.documento);
      if (gate.excluido) {
        emit('prospectos:cambio', { accion: 'excluir', id_prospecto: Number(idProspecto), ts: Date.now() });
        return completar(job.id_job, { id_prospecto: idProspecto, excluido_por_ciiu: true, motivo: gate.motivo });
      }
    }
  }
```

Nota: `descubrirPadron` encola con `{ id_prospecto, lote, accion: 'enriquecer' }` (ver `prospectos.controller.js` ~L963), por eso el gate se dispara con `params.accion === 'enriquecer'`.

- [ ] **Step 4: Verificación manual (smoke, requiere BD)**

No hay framework para mockear BD en el repo; verificación manual solo-lectura y con un RUC real:

1. Verificar que el módulo carga sin romper imports:
   Run: `cd backend && node -e "import('./services/scraping-worker.js').then(()=>console.log('worker OK')).catch(e=>{console.error(e);process.exit(1)})"`
   Expected: `worker OK`.
2. Con la BD de desarrollo, tomar el `id_prospecto` de un prospecto de origen `padron` que sea claramente insumo (p.ej. una veterinaria), encolar su enriquecimiento desde el panel y confirmar en BD:
   `SELECT excluido, ciiu FROM prospectos WHERE id_prospecto = ?;` → `excluido = 1` y `ciiu` poblado; y una fila `fuente='ciiu'` en `prospecto_fuentes` con el motivo.
3. Repetir con uno de fruta/verdura real → `excluido = 0`, `ciiu` poblado.

- [ ] **Step 5: Commit**

```bash
git add backend/services/scraping-worker.js
git commit -m "worker: compuerta CIIU en enriquecimiento del padron (excluye no fruta/verdura)"
```

---

## Task 5: Script de reclasificación y limpieza de lo ya cargado

**Files:**
- Create: `backend/scripts/reclasificar-prospeccion.mjs`
- Modify: `backend/package.json`

**Contexto:** el usuario ya corrió un barrido SQL por nombre. Este script deja el proceso repetible y reusa las funciones nuevas (paridad exacta), y agrega el pase CIIU que el SQL no puede hacer: excluir por actividad real y **rehabilitar** (`excluido = 0`) los de nombre neutro que el CIIU confirme como fruta/verdura.

- [ ] **Step 1: Crear el script**

Crear `backend/scripts/reclasificar-prospeccion.mjs`:

```js
import 'dotenv/config';
import { executeQuery } from '../config/database.js';
import { detectarSector, esInsumoAgricola, clasificarCiiuFrutaVerdura } from '../services/prospectos.service.js';
import { consultarPorRuc } from '../services/padron-ruc.service.js';

// ============================================================
// Reclasifica y limpia lo ya cargado con el criterio "solo fruta/verdura".
//   Fase 1 (nombre): excluye prospectos que ya no son objetivo por nombre;
//                    borra filas no-objetivo de padron_empresas (caché).
//   Fase 2 (--verificar-ciiu): trae el CIIU real y excluye/rehabilita.
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
  console.log('== Fase 1: reclasificación por nombre ==');
  // Prospectos NO manuales del pool agro que ya no son objetivo → excluido = 1.
  const pr = await executeQuery(
    "SELECT id_prospecto, razon_social FROM prospectos WHERE excluido = 0 AND (origen IS NULL OR origen <> 'manual')"
  );
  if (!pr.success) throw new Error(pr.error);
  let excluir = 0;
  for (const p of pr.data) {
    if (!esObjetivoPorNombre(p.razon_social)) {
      excluir++;
      if (!DRY) await executeQuery('UPDATE prospectos SET excluido = 1 WHERE id_prospecto = ?', [p.id_prospecto]);
    }
  }
  console.log(`  prospectos a excluir por nombre: ${excluir} / ${pr.data.length}`);

  // padron_empresas: borra las filas que ya no son objetivo por nombre.
  const pe = await executeQuery('SELECT ruc, razon_social FROM padron_empresas');
  if (pe.success) {
    let borrar = 0;
    for (const e of pe.data) {
      if (!esObjetivoPorNombre(e.razon_social)) {
        borrar++;
        if (!DRY) await executeQuery('DELETE FROM padron_empresas WHERE ruc = ?', [e.ruc]);
      }
    }
    console.log(`  padron_empresas a borrar por nombre: ${borrar} / ${pe.data.length}`);
  }
}

async function fase2Ciiu() {
  console.log(`== Fase 2: verificación CIIU (limit ${LIMIT}) ==`);
  // Candidatos: prospectos con RUC, sin CIIU aún, del padrón/sunat. Incluye
  // excluidos (para poder REHABILITAR los de nombre neutro que sí son fruta/verdura).
  const cand = await executeQuery(
    `SELECT id_prospecto, documento, excluido FROM prospectos
      WHERE documento IS NOT NULL AND documento <> ''
        AND (ciiu IS NULL OR ciiu = '')
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
```

- [ ] **Step 2: Agregar el script a `package.json`**

En `backend/package.json`, dentro de `"scripts"`, añadir:

```json
    "reclasificar:prospeccion": "node scripts/reclasificar-prospeccion.mjs",
```

- [ ] **Step 3: Verificar en seco (dry-run, no escribe)**

Run: `cd backend && npm run reclasificar:prospeccion -- --dry-run`
Expected: imprime conteos de "a excluir por nombre" y "a borrar por nombre" sin error, y termina en `Listo.`. (Debe conectar a la BD via `config/database.js` con las envs del `.env`.)

- [ ] **Step 4: Verificar en seco el pase CIIU (opcional, lento)**

Run: `cd backend && npm run reclasificar:prospeccion -- --dry-run --verificar-ciiu --limit=20`
Expected: además imprime `verificados por CIIU: …; excluidos: …; rehabilitados: …` para 20 RUCs, sin escribir.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/reclasificar-prospeccion.mjs backend/package.json
git commit -m "scripts: reclasificar-prospeccion (nombre + pase CIIU, con rehabilitacion)"
```

---

## Task 6: Verificación final

- [ ] **Step 1: Correr toda la batería de tests unitarios**

Run: `cd backend && npm run test:prospectos && npm run test:padron`
Expected: ambos terminan en `N OK, 0 FAIL` (exit 0).

- [ ] **Step 2: Verificar que los servicios cargan sin errores de import**

Run: `cd backend && node -e "Promise.all([import('./services/prospectos.service.js'),import('./services/padron-import.service.js'),import('./services/scraping-worker.js')]).then(()=>console.log('imports OK')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `imports OK`.

- [ ] **Step 3 (con BD, cuando el usuario lo decida): correr la reclasificación real**

Orden sugerido:
1. `npm run reclasificar:prospeccion` (fase nombre, escribe).
2. `npm run reclasificar:prospeccion -- --verificar-ciiu --limit=500` (pase CIIU por lotes; repetir hasta agotar candidatos).

Verificación en panel: el pool de Agroexportación queda solo con fruta/verdura; los insumos/veterinaria/perforaciones desaparecen; los de nombre neutro que el CIIU confirmó como fruta/verdura reaparecen.

---

## Notas de cierre

- **Recall vs. carga de ruc.pe:** el diseño acota por nombre primero (menos consultas). Si más adelante se quiere máxima cobertura, se puede relajar `clasificarObjetivo` para dejar entrar `AGRICOLA`/`AGRO` genéricos y que el CIIU decida — a costa de más consultas.
- **Sin CIIU disponible:** los prospectos quedan como están (no se pierden); el pase CIIU es re-ejecutable.
- **Reversibilidad:** las exclusiones son `excluido = 1` (no borrado); `padron_empresas` es un caché re-importable con `npm run import:padron`.
- **CIIU objetivo tunable:** `CIIU_FRUTA_VERDURA` en `prospectos.service.js` (hoy `011, 012, 0163, 4630`).
