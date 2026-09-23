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
check('AGRO BERRIES → Agroexportación', detectarSector('AGRO BERRIES S.A.C.')?.sector === 'Agroexportación');
// "Excluir solo insumos": los nombres neutros AGRO se QUEDAN en el bucket agro.
check('AGRO25INVERSIONES → Agroexportación (neutro, no insumo)', detectarSector('AGRO25INVERSIONES E.I.R.L.')?.sector === 'Agroexportación');
check('AGROABAMEN → Agroexportación (neutro)', detectarSector('AGROABAMEN S.A.C')?.sector === 'Agroexportación');
// Insumos y rubros ajenos claros → fuera del bucket agro.
check('AGRO VETERINARIA → sin sector (insumo)', detectarSector('AGRO VETERINARIA CHALLCO S.A.C.') === null);
check('AGROABONOS → sin sector (insumo)', detectarSector('AGROABONOS ORGÁNICOS S.A.C.') === null);
check('AGRO Y PERFORACIONES → sin sector (rubro ajeno)', detectarSector('AGRO Y PERFORACIONES E.I.R.L.') === null);

import { clasificarCiiuFrutaVerdura } from '../services/prospectos.service.js';

console.log('clasificarCiiuFrutaVerdura:');
check('0113 hortalizas → objetivo', clasificarCiiuFrutaVerdura([{ codigo: '0113', descripcion: 'CULTIVO DE HORTALIZAS' }])?.objetivo === true);
check('0122 frutas tropicales → objetivo', clasificarCiiuFrutaVerdura([{ codigo: '01220' }])?.objetivo === true);
check('4630 mayorista alimentos → objetivo', clasificarCiiuFrutaVerdura([{ codigo: '46309' }])?.objetivo === true);
check('2021 plaguicidas → excluir', clasificarCiiuFrutaVerdura([{ codigo: '2021', descripcion: 'FAB. DE PLAGUICIDAS' }])?.objetivo === false);
check('4669 otros mayoristas → excluir', clasificarCiiuFrutaVerdura([{ codigo: '46690' }])?.objetivo === false);
check('75000 veterinaria → excluir', clasificarCiiuFrutaVerdura([{ codigo: '75000', descripcion: 'ACTIVIDADES VETERINARIAS' }])?.objetivo === false);
check('excluir trae motivo', typeof clasificarCiiuFrutaVerdura([{ codigo: '2021', descripcion: 'FAB. DE PLAGUICIDAS' }])?.motivo === 'string');
check('sin ciiu → null', clasificarCiiuFrutaVerdura([]) === null);
check('undefined → null', clasificarCiiuFrutaVerdura(undefined) === null);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
