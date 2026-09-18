import { parsearResultadosRucPe, parsearFicha } from '../services/padron-ruc.service.js';

// Muestra REAL de la página de resultados de ruc.pe (?s=20600869737).
const resultadosHtml = `
<html><body>
Resultados de la búsqueda de «20600869737»
{"@context":"http://schema.org"}
RUC.PE Directorio Empresarial Menu RUC CONSULTA MULTIPLE CONSULTA RUC
Search Results for: 20600869737 VANGUARD INTERNATIONAL GROUP PERU SAC AV. LOS CONQUISTADORES NRO 605 SAN ISIDRO LIMA LIMA
</body></html>`;

// Muestra de una ficha de empresa (estructura tabla clave/valor de ruc.pe).
const fichaHtml = `
<html><body>
<h1>VANGUARD INTERNATIONAL GROUP PERU SAC</h1>
RUC: 20600869737
Razón Social: VANGUARD INTERNATIONAL GROUP PERU SAC
Estado: ACTIVO
Condición: HABIDO
Dirección: AV. LOS CONQUISTADORES NRO 605 SAN ISIDRO
Departamento: LIMA
Provincia: LIMA
Distrito: SAN ISIDRO
Actividad Económica: CIIU 46691 - VENTA MAYORISTA DE OTROS PRODUCTOS
Representante Legal: DNI 40404040 PEREZ GOMEZ JUAN GERENTE GENERAL
</body></html>`;

let ok = 0, fail = 0;
const check = (nombre, cond, extra = '') => {
  if (cond) { ok++; console.log(`  ✓ ${nombre} ${extra}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
};

console.log('parsearResultadosRucPe:');
const r = parsearResultadosRucPe(resultadosHtml, '20600869737');
check('razon_social', r?.razon_social === 'VANGUARD INTERNATIONAL GROUP PERU SAC', `→ ${r?.razon_social}`);
check('direccion contiene AV', /AV/.test(r?.direccion || ''), `→ ${r?.direccion}`);

console.log('parsearFicha:');
const f = parsearFicha(fichaHtml, '20600869737');
check('razon_social', f?.razon_social === 'VANGUARD INTERNATIONAL GROUP PERU SAC', `→ ${f?.razon_social}`);
check('es_activo', f?.es_activo === true);
check('es_habido', f?.es_habido === true);
check('distrito', f?.distrito === 'SAN ISIDRO', `→ ${f?.distrito}`);
check('ciiu codigo 46691', f?.ciiu?.[0]?.codigo === '46691', `→ ${JSON.stringify(f?.ciiu?.[0])}`);
check('representante', (f?.representantes?.[0]?.nombre || '').includes('PEREZ'), `→ ${JSON.stringify(f?.representantes?.[0])}`);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
