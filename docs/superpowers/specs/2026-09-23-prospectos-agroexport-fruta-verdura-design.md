# Diseño: enfocar Prospección en comercio de frutas/verduras (no agroindustria de insumos)

Fecha: 2026-09-23
Módulo: Prospección / Leads (`backend/services/prospectos.service.js`, `padron-import.service.js`, `padron-ruc.service.js`, `scraping-worker.js`, `controllers/prospectos.controller.js`)

## Problema

El sector "Agroexportación" del módulo se asigna **solo por el nombre** de la razón social
(`detectarSector` → patrón `/\b(AGRO|AGRIC|FRUT|...)/`). El token suelto `AGRO` es un
prefijo que usan negocios de cualquier rubro, así que el pool se llena de empresas que **no**
son comercio de fruta/verdura y no compran empaque:

- Insumos agrícolas: `AGROABONOS ORGÁNICOS`, `AGRO UNITEK CROPSCIENCE`, `AGRO VIVEROS SEEDS`.
- Veterinaria/pecuario: `AGRO VETERINARIA ...`, `AGRO-CARNES OMARIA`.
- Rubros ajenos: `AGRO Y PERFORACIONES`, `AGRO-ASESORES`, `AGRO ABARROTES`, `AGRO Y JARDIN`.
- Nombres genéricos sin rubro: `AGRO-INVERSIONES ...`, `AGRO25INVERSIONES`, `AGROABAMEN`.

La fuente masiva de empresas es el **Padrón Reducido de SUNAT** (`padron_empresas`), que **no
trae CIIU**, por lo que la clasificación depende del nombre. El **CIIU real** (actividad
económica oficial) sí es obtenible vía `consultarPorRuc()` (raspa ruc.pe + espejos), pero
hoy solo se usa en la ingesta manual de RUCs y en "Buscar RUC" — **no** en el descubrimiento
del padrón. Por eso los prospectos del padrón nunca se validan contra su actividad real.

## Objetivo

Que el módulo traiga **solo empresas de comercio/exportación de frutas y verduras frescas**
(compradoras de empaque), excluyendo agroindustria de insumos (plaguicidas, fertilizantes,
veterinaria) y rubros ajenos. Enfoque **Balance**: cobertura razonable con ruido bajo.

Decisiones tomadas:
- **Alcance:** enfocar el módulo únicamente en agroexport de fruta/verdura (dejar de lado
  los otros 14 sectores para la ingesta; la taxonomía se conserva en el código, reversible).
- **Precisión:** el token suelto `AGRO`/`AGRIC` deja de ser señal positiva.
- **Datos existentes:** reclasificar y limpiar todo lo ya cargado.
- **CIIU:** activar la compuerta CIIU como validación autoritativa.

## Diseño — dos etapas

### Etapa 1 — Filtro por nombre endurecido (barato, instantáneo)

Fuente única en `prospectos.service.js`.

- **Patrón positivo de fruta/verdura** (`AGRO_FRUTA_VERDURA`): exige un token real —
  `FRUT`, `HORTALIZ`, `PALTA`, `PALTO`, `ARÁNDAN`, `BLUEBERR`, `UVA`, `GRAPE`, `ESPÁRRAG`,
  `ASPARAG`, `CÍTRIC`, `MANDARIN`, `NARANJA`, `MANGO`, `BANANO`, `BANANA`, `CEBOLLA`, `AJO`,
  `PÁPRIKA`, `PIMIENT`, `ALCACHOFA`, `ARTICHOKE`, `PIÑA`, `GRANAD`, `JENGIBRE`, `KION`,
  `GINGER`, `QUINUA`, `CACAO`, `FRESH`, `PRODUCE`, `FRUIT`, `AGROEXPORT`, `AGRÍCOLA`.
  Se elimina `AGRO`/`AGRIC` sueltos.
- **Lista negra `INSUMOS_AGRICOLAS`** (excluye siempre, gana sobre el positivo):
  `AGROQUÍMIC`, `CROPSCIENCE`, `INSECTICID`, `PLAGUICID`, `PESTICID`, `FUNGICID`, `HERBICID`,
  `ACARICID`, `NEMATICID`, `FERTILIZANT`, `ABONO`, `FUMIGA`, `VETERINARI`, `AGROVETERIN`,
  `PECUARI`, `SEMILLA`, `VIVERO`, `PLANTIN`, `AGROINSUMO`, `FOLIAR`, `NUTRICIÓN VEGETAL`,
  `RIEGO`, `PERFORACION`, `ASESOR`, `ABARROTE`, `CARNE`, `JARDIN`, `MASCOTA`.
- Nuevo helper `esInsumoAgricola(nombre)`.
- `detectarSector`: si calza `INSUMOS_AGRICOLAS` → `null`. Si calza `AGRO_FRUTA_VERDURA` →
  sector `Agroexportación`. (El resto de sectores se conservan en el array para no romper
  el scoring, pero ya no son "objetivo" de ingesta; ver Etapa 1b.)

**Etapa 1b — Enfocar la ingesta a solo agroexport.** En `padron-import.service.js`,
`clasificarObjetivo` acepta **solo** cuando el sector detectado es `Agroexportación`.
Las próximas importaciones del padrón ya no traen otros sectores.

### Etapa 2 — Compuerta CIIU autoritativa (limpia de verdad)

Cablear `consultarPorRuc` en el enriquecimiento del padrón (worker `scraping-worker.js`,
job `web_scrape`/`enriquecer`), de forma que cada prospecto del padrón obtenga su CIIU real:

- **CIIU objetivo (fruta/verdura, se queda + sube score):**
  - División `01` cultivos: clases de hortalizas/frutas — `0113` (hortalizas, legumbres),
    `0121`–`0128` (uva, frutas tropicales, cítricos, frutas de pepita/hueso, etc.).
  - Comercio: `4630` (venta al por mayor de alimentos y bebidas, incluye fruta/verdura).
  - Post-cosecha/empaque de fruta: `0163` (se acepta — mueven producto fresco).
- **CIIU excluido (agroindustria de insumos / ajeno → `excluido = 1` con motivo):**
  - `2021` fabricación de plaguicidas y agroquímicos.
  - `4669` venta al por mayor de otros productos (abonos, químicos).
  - `4620` venta al por mayor de materias primas agropecuarias **cuando** no hay señal de
    fruta/verdura (ambiguo: incluye insumos) — se trata como no-objetivo salvo token positivo.
  - `013` propagación de plantas/viveros, `014`/`015` ganadería, `75` veterinaria,
    `0161` servicios de apoyo (fumigación), y cualquier división fuera de agro/comercio de
    alimentos.
- **Sin CIIU disponible** (ruc.pe caído / Cloudflare): se conserva el prospecto con marca
  "CIIU sin verificar"; no se pierde ni se excluye. Reintentable.
- La lógica de mapeo vive en `sectorPorCiiu` (ya existe) extendida con una función
  `esCiiuObjetivoFrutaVerdura(ciiu)` y un motivo de exclusión legible.

Implementación en el worker: tras resolver contactos, si el prospecto es de origen `padron`
y no tiene CIIU, llamar `consultarPorRuc(documento)`, guardar `ciiu`/`ciiu_detalle`, y aplicar
la compuerta (excluir con motivo o confirmar). Respeta el throttle existente de `padron-ruc`
(gap ~1.2 s) y la concurrencia del worker. Best-effort y aislado (un fallo no tumba el job).

### Etapa 3 — Reclasificar y limpiar lo ya cargado

Script de una sola vez `backend/scripts/reclasificar-prospeccion.mjs` (patrón de
`import-padron.mjs`), que **reutiliza** las funciones nuevas para garantizar paridad exacta:

- `padron_empresas`: **DELETE** de las filas que ya no son objetivo (es un caché
  re-importable del padrón).
- `prospectos`: `excluido = 1` (reversible; el panel ya oculta los excluidos) a los que ahora
  son insumo o no-agro por nombre. No se borran en duro para no perder gestión humana ya
  iniciada. Motivo registrado en historial/nota.
- Opcional (flag `--verificar-ciiu`): encolar la compuerta CIIU (Etapa 2) para los
  sobrevivientes, de modo que los que pasen el nombre pero fallen el CIIU se auto-excluyan.

## Contactos

Sin cambios de diseño. El enriquecimiento (`enriquecerDesdeWeb`) ya recolecta correos,
teléfonos y redes por RUC. Al filtrar bien las empresas, ese esfuerzo cae sobre las de
fruta/verdura correctas (los "Sin correo / Sin teléfono" que se ven son prospectos aún no
enriquecidos, no un defecto del filtro).

## Componentes tocados

| Archivo | Cambio |
|---|---|
| `backend/services/prospectos.service.js` | `AGRO_FRUTA_VERDURA`, `INSUMOS_AGRICOLAS`, `esInsumoAgricola`, ajuste de `detectarSector`, `esCiiuObjetivoFrutaVerdura`, motivos de exclusión |
| `backend/services/padron-import.service.js` | `clasificarObjetivo` acepta solo `Agroexportación` |
| `backend/services/scraping-worker.js` | cablear `consultarPorRuc` (CIIU) + compuerta en el enriquecimiento de origen `padron` |
| `backend/scripts/reclasificar-prospeccion.mjs` | script nuevo de reclasificación/limpieza |

Sin cambios de esquema (usa columnas existentes: `sector`, `ciiu`, `excluido`). Sin cambios
de frontend obligatorios (las facetas de sector son dinámicas).

## Criterios de aceptación

- Ninguna de las empresas de la lista de ejemplo (veterinaria, abonos, perforaciones,
  asesores, abarrotes, viveros/seeds, cropscience, inversiones genéricas) queda en el pool
  activo tras Etapa 1 + Etapa 3.
- Empresas con CIIU de plaguicidas/veterinaria/química quedan `excluido = 1` aunque el nombre
  diga "AGRO" (Etapa 2).
- Empresas con token claro de fruta/verdura y CIIU de cultivo/comercio de alimentos se
  conservan y priorizan.
- Las próximas importaciones del padrón solo cargan agroexport de fruta/verdura.
- Un fallo de ruc.pe no pierde prospectos (quedan "sin verificar").

## Riesgos / notas

- **Recall:** algunos exportadores reales con nombre neutro (p.ej. `AGRO YALA`,
  `SOCIEDAD AGRÍCOLA DEL NORTE`) pueden quedar fuera del nombre; la compuerta CIIU los
  recupera si su actividad es de cultivo (se aceptan por CIIU aunque el nombre no dé señal,
  siempre que hayan entrado al pool). Decisión abierta: si se quiere máxima cobertura, la
  ingesta podría dejar entrar `AGRÍCOLA`/`AGRO` genéricos y dejar que el CIIU decida — a
  costa de más consultas a ruc.pe. Diseño actual: nombre acota primero (menos consultas).
- **Carga de ruc.pe:** un lote grande (hasta 2000) genera muchas consultas throttled; corre
  en segundo plano. Ajustable por las envs de gap/concurrencia existentes.
- Divergencia de collation entre `padron_empresas` (`utf8mb4_0900_ai_ci`) y
  `prospectos`/`clientes` (`utf8mb4_unicode_ci`) ya se maneja con `COLLATE` en las consultas;
  el script debe respetarlo.
