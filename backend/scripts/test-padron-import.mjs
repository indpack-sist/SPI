import { parsearLineaPadron, clasificarObjetivo } from '../services/padron-import.service.js';
import { resolverUbigeo } from '../services/ubigeo.service.js';

let ok = 0, fail = 0;
const check = (nombre, cond, extra = '') => {
  if (cond) { ok++; console.log(`  ✓ ${nombre} ${extra}`); }
  else { fail++; console.log(`  ✗ ${nombre} ${extra}`); }
};

// Cabecera (debe ignorarse) y líneas de muestra del padrón reducido.
const HEADER = 'RUC|NOMBRE|ESTADO DEL CONTRIBUYENTE|CONDICION DE DOMICILIO|UBIGEO|TIPO DE VIA|NOMBRE DE VIA|COD ZONA|TIPO ZONA|NUMERO|INTERIOR|LOTE|DPTO|MANZANA|KM';
const LOGISTICA = '20512345678|ALFA PACK LOGISTICA SAC|ACTIVO|HABIDO|150122|AV|LOS PROCERES|-|-|605|102|-|-|-|-';
const AGROEXP   = '20487654321|AGROEXPORTADORA DEL SUR S.A.C.|ACTIVO|HABIDO|040101|CAL|LOS OLIVOS|-|-|123|-|-|-|-|-';
const SERVICIOS = '20600000001|AGENCIA DE MARKETING DIGITAL SAC|ACTIVO|HABIDO|150101|AV|AREQUIPA|-|-|100|-|-|-|-|-';
const PERSONA   = '10456789012|JUAN PEREZ DISTRIBUIDORA|ACTIVO|HABIDO|150101|-|-|-|-|-|-|-|-|-|-';
const BAJA      = '20999999999|DISTRIBUIDORA MAYORISTA BAJA SAC|BAJA DE OFICIO|NO HABIDO|150101|-|-|-|-|-|-|-|-|-|-';

console.log('parsearLineaPadron:');
check('header → null', parsearLineaPadron(HEADER) === null);
const p = parsearLineaPadron(LOGISTICA);
check('ruc', p?.ruc === '20512345678', `→ ${p?.ruc}`);
check('razon_social', p?.razon_social === 'ALFA PACK LOGISTICA SAC');
check('estado', p?.estado === 'ACTIVO');
check('ubigeo', p?.ubigeo === '150122', `→ ${p?.ubigeo}`);
check('direccion', /AV LOS PROCERES NRO 605 INT 102/.test(p?.direccion || ''), `→ ${p?.direccion}`);

console.log('clasificarObjetivo:');
check('logística → objetivo', clasificarObjetivo(parsearLineaPadron(LOGISTICA))?.sector === 'Logística / Almacenes');
check('agroexport → objetivo', clasificarObjetivo(parsearLineaPadron(AGROEXP))?.sector === 'Agroexportación');
check('servicios (marketing) → descartado', clasificarObjetivo(parsearLineaPadron(SERVICIOS)) === null);
check('persona natural (RUC 10) → descartado', clasificarObjetivo(parsearLineaPadron(PERSONA)) === null);
check('estado BAJA → descartado', clasificarObjetivo(parsearLineaPadron(BAJA)) === null);

console.log('resolverUbigeo:');
const u = resolverUbigeo('150122');
check('departamento LIMA', u.departamento === 'LIMA', `→ ${u.departamento}`);
check('distrito resuelto', !!u.distrito, `→ ${u.distrito}`);
const u2 = resolverUbigeo('040101');
check('depto AREQUIPA', u2.departamento === 'AREQUIPA', `→ ${u2.departamento}`);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
