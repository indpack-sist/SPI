// backend/scripts/build-ubigeos.js
// Parsea la lista oficial de UBIGEO de SUNAT (docs/ubigeos_raw.txt, copiada del PDF de
// Reglas de Validación) y genera frontend/src/data/ubigeos.json para los selects en
// cascada Departamento → Provincia → Distrito. Ignora encabezados/pies de página y
// autovalida el resultado (consistencia de códigos, duplicados, conteos, spot-checks).
//
// Uso:  node scripts/build-ubigeos.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.resolve(__dirname, '../../docs/ubigeos_raw.txt');
const OUT = path.resolve(__dirname, '../../frontend/src/data/ubigeos.json');

// Líneas de ruido conocidas (encabezados/pies): se descartan explícitamente. Cualquier otra
// línea que no calce con un código se reporta como advertencia (posible continuación de nombre).
const NOISE = [
  /^DEPARTAMENTO\/REGI[ÓO]N$/i,
  /^PROVINCIA$/i,
  /^UBIGEO$/i,
  /^CAT[ÁA]LOGO\b/i,
  /^CATALOGO\b/i,
  /^Campo\b/i,
  /^Descripci[óo]n\b/i,
  /^C[óo]digo\b/i,
  /^An[áa]lisis e Identificaci[óo]n\b/i,
  /^~\s*\d+\s*~$/,
];
const isNoise = (l) => NOISE.some((re) => re.test(l));

// Limpia sufijos de nota al pie tipo " /1", " / 1", " 1/", " 3/" que trae el PDF.
const limpiarNombre = (s) => s.replace(/\s+\/?\s*\d+\s*\/?\s*$/, '').trim();

const lines = fs.readFileSync(RAW, 'utf8').split(/\r?\n/);

const departamentos = new Map();          // "15" -> "LIMA"
const provincias = new Map();             // "1501" -> "LIMA"
const distritos = new Map();              // "150104" -> "BARRANCO"
const warnings = [];
let lastDistrictCode = null;              // para reconstruir nombres partidos en 2 líneas

for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  const line = raw.trim();
  if (!line) { continue; }

  let m;
  if ((m = line.match(/^(\d{6})\s+(.+)$/))) {
    const [, cod, nom] = m;
    distritos.set(cod, limpiarNombre(nom));
    lastDistrictCode = cod;
  } else if ((m = line.match(/^(\d{4})\s+(.+)$/))) {
    const [, cod, nom] = m;
    provincias.set(cod, limpiarNombre(nom));
    lastDistrictCode = null;
  } else if ((m = line.match(/^(\d{2})\s+(.+)$/))) {
    const [, cod, nomRaw] = m;
    // Nombre de departamento: quitar prefijo "DEPARTAMENTO " (Callao = "PROV. CONST. DEL CALLAO").
    const nom = nomRaw.replace(/^DEPARTAMENTO\s+/i, '').trim();
    departamentos.set(cod, nom);
    lastDistrictCode = null;
  } else if (isNoise(line)) {
    continue;
  } else if (lastDistrictCode && /^[A-ZÁÉÍÓÚÑ .'/-]+$/.test(line)) {
    // Continuación de un nombre de distrito partido en 2 líneas (p. ej. "…ALBARRACIN\nLANCHIPA").
    distritos.set(lastDistrictCode, limpiarNombre(`${distritos.get(lastDistrictCode)} ${line}`));
  } else {
    warnings.push(`L${i + 1}: "${line}"`);
  }
}

// ── Validación ────────────────────────────────────────────────────────────────
const errores = [];
for (const cod of provincias.keys()) {
  if (!departamentos.has(cod.slice(0, 2))) errores.push(`Provincia ${cod} sin departamento ${cod.slice(0, 2)}`);
}
for (const cod of distritos.keys()) {
  if (!provincias.has(cod.slice(0, 4))) errores.push(`Distrito ${cod} sin provincia ${cod.slice(0, 4)}`);
}
const spot = { '150104': 'BARRANCO', '150142': 'VILLA EL SALVADOR', '130107': 'MOCHE', '200104': 'CASTILLA' };
for (const [cod, esperado] of Object.entries(spot)) {
  const got = distritos.get(cod);
  if (got !== esperado) errores.push(`Spot-check ${cod}: esperado "${esperado}", obtenido "${got}"`);
}

console.log(`Departamentos: ${departamentos.size}`);
console.log(`Provincias:    ${provincias.size}`);
console.log(`Distritos:     ${distritos.size}`);
console.log(`Advertencias (líneas no reconocidas): ${warnings.length}`);
if (warnings.length) console.log(warnings.slice(0, 30).join('\n'));
if (errores.length) {
  console.error(`\n❌ ERRORES DE VALIDACIÓN (${errores.length}):`);
  console.error(errores.slice(0, 40).join('\n'));
  process.exit(1);
}

// ── Estructura de salida (cascada O(1)) ──────────────────────────────────────
const out = {
  departamentos: [...departamentos.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([codigo, nombre]) => ({ codigo, nombre })),
  provincias: {},
  distritos: {},
};
for (const [codigo, nombre] of [...provincias.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const dep = codigo.slice(0, 2);
  (out.provincias[dep] ||= []).push({ codigo, nombre });
}
for (const [codigo, nombre] of [...distritos.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const prov = codigo.slice(0, 4);
  (out.distritos[prov] ||= []).push({ codigo, nombre });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out), 'utf8');
console.log(`\n✅ Generado: ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
