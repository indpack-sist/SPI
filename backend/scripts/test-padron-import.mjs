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

// Muestra REAL separada por TAB (formato del padrón que trajo el usuario), con
// cabecera en español y acentos (archivo latin1).
const HEADER_TAB = 'RUC\tNOMBRE O RAZÓN SOCIAL\tESTADO DEL CONTRIBUYENTE\tCONDICIÓN DE DOMICILIO\tUBIGEO\tTIPO DE VÍA\tNOMBRE DE VÍA\tCÓDIGO DE ZONA\tTIPO DE ZONA\tNÚMERO\tINTERIOR\tLOTE\tDEPARTAMENTO\tMANZANA\tKILÓMETRO';
const LOGISTICA_TAB = '20512345678\tALFA PACK LOGISTICA SAC\tACTIVO\tHABIDO\t150122\tAV\tLOS PROCERES\t-\t-\t605\t102\t-\t-\t-\t-';

console.log('parsearLineaPadron:');
check('header (|) → null', parsearLineaPadron(HEADER) === null);
check('header (TAB) → null', parsearLineaPadron(HEADER_TAB) === null);
const p = parsearLineaPadron(LOGISTICA);
check('ruc', p?.ruc === '20512345678', `→ ${p?.ruc}`);
check('razon_social', p?.razon_social === 'ALFA PACK LOGISTICA SAC');
check('estado', p?.estado === 'ACTIVO');
check('ubigeo', p?.ubigeo === '150122', `→ ${p?.ubigeo}`);
check('direccion', /AV LOS PROCERES NRO 605 INT 102/.test(p?.direccion || ''), `→ ${p?.direccion}`);

// Mismo registro pero separado por TAB → debe parsear idéntico.
const pt = parsearLineaPadron(LOGISTICA_TAB);
check('TAB ruc', pt?.ruc === '20512345678', `→ ${pt?.ruc}`);
check('TAB razon_social', pt?.razon_social === 'ALFA PACK LOGISTICA SAC', `→ ${pt?.razon_social}`);
check('TAB ubigeo', pt?.ubigeo === '150122', `→ ${pt?.ubigeo}`);
check('TAB objetivo (logística ya NO es objetivo) → null', clasificarObjetivo(pt) === null);

console.log('clasificarObjetivo (solo Agroexportación fruta/verdura):');
check('logística → NO objetivo', clasificarObjetivo(parsearLineaPadron(LOGISTICA)) === null);
check('agroexport → objetivo', clasificarObjetivo(parsearLineaPadron(AGROEXP))?.sector === 'Agroexportación');
check('servicios (marketing) → descartado', clasificarObjetivo(parsearLineaPadron(SERVICIOS)) === null);
check('persona natural (RUC 10) → descartado', clasificarObjetivo(parsearLineaPadron(PERSONA)) === null);
check('estado BAJA → descartado', clasificarObjetivo(parsearLineaPadron(BAJA)) === null);

// Insumo agrícola aunque el nombre empiece con AGRO → descartado.
const INSUMO = '20611111111\tAGROABONOS ORGANICOS S.A.C.\tACTIVO\tHABIDO\t150131\tAV\tLOS ABONOS\t-\t-\t50\t-\t-\t-\t-\t-';
check('insumo (abonos) → descartado', clasificarObjetivo(parsearLineaPadron(INSUMO)) === null);

console.log('resolverUbigeo:');
const u = resolverUbigeo('150122');
check('departamento LIMA', u.departamento === 'LIMA', `→ ${u.departamento}`);
check('distrito resuelto', !!u.distrito, `→ ${u.distrito}`);
const u2 = resolverUbigeo('040101');
check('depto AREQUIPA', u2.departamento === 'AREQUIPA', `→ ${u2.departamento}`);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
