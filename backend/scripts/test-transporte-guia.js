import { resolverTransporteGuia, mapearTransporteDesdeOrden } from '../services/sunat/transporte-guia.service.js';

let pass = 0, fail = 0;
const check = (nombre, cond, detalle = '') => {
  const ok = !!cond;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✓' : '✗'} ${nombre}${detalle ? '  —  ' + detalle : ''}`);
};

console.log('\n=== GRE · transporte desde la guía (no desde la OV) ===\n');

{
  const g = {
    id_transportista: 7,
    transporte_modo: 'tercero',
    transporte_registrar: 1,
    transporte_placa: 'ABC-123', transporte_tuc: 'TUCE1', transporte_autorizacion: 'AUT1',
    transporte_placa2: 'XY-9988', transporte_tuc2: null, transporte_autorizacion2: null,
    transporte_dni: '12345678', transporte_conductor: 'JUAN PEREZ', transporte_licencia: 'Q12345678',
    transporte_dni2: '87654321', transporte_conductor2: 'LUIS GOMEZ', transporte_licencia2: 'Q87654321',
    transporte_ind_transbordo: 1, transporte_ind_m1l: 0, transporte_ind_retorno_vacio: 0,
  };
  const rel = { transportista: { ruc: '20111111111', razon_social: 'TRANSPORTES SAC', numero_mtc: 'MTC-1' } };
  const r = resolverTransporteGuia(g, rel);
  check('tercero: esTercero=true', r.esTercero === true);
  check('tercero: modalidad=01', r.modalidad === '01');
  check('tercero: carrier.ruc desde la relación', r.carrier?.ruc === '20111111111', `ruc=${r.carrier?.ruc}`);
  check('tercero: carrier.razon desde la relación', r.carrier?.razon === 'TRANSPORTES SAC');
  check('tercero: carrier.mtc desde la relación', r.carrier?.mtc === 'MTC-1');
  check('tercero: conductor[0].dni desde la GUÍA', r.conductores?.[0]?.dni === '12345678', `dni=${r.conductores?.[0]?.dni}`);
  check('tercero: 2 conductores desde la GUÍA', r.conductores?.length === 2, `len=${r.conductores?.length}`);
  check('tercero: conductor[1].licencia desde la GUÍA', r.conductores?.[1]?.licencia === 'Q87654321');
  check('tercero: vehiculo[0].placa normalizada desde la GUÍA', r.vehiculos?.[0]?.placa === 'ABC123', `placa=${r.vehiculos?.[0]?.placa}`);
  check('tercero: vehiculo[0].tuce desde la GUÍA', r.vehiculos?.[0]?.tuce === 'TUCE1');
  check('tercero: 2 vehiculos desde la GUÍA', r.vehiculos?.length === 2, `len=${r.vehiculos?.length}`);
  check('tercero: vehiculo[1].placa normalizada', r.vehiculos?.[1]?.placa === 'XY9988');
  check('tercero: registrar=true', r.registrar === true);
  check('tercero: declararVC=true', r.declararVC === true);
  check('tercero: indicadores.transbordo=true desde la GUÍA', r.indicadores?.transbordo === true);
  check('tercero: indicadores.registrarTransp=true', r.indicadores?.registrarTransp === true);
}

{
  const g = { id_transportista: 7, transporte_registrar: 0,
    transporte_dni: '12345678', transporte_conductor: 'JUAN', transporte_licencia: 'Q1', transporte_placa: 'ABC-123' };
  const r = resolverTransporteGuia(g, { transportista: { ruc: '20111111111', razon_social: 'T SAC' } });
  check('tercero registrar=0: registrar=false', r.registrar === false);
  check('tercero registrar=0: sin conductores', r.conductores?.length === 0, `len=${r.conductores?.length}`);
  check('tercero registrar=0: sin vehiculos', r.vehiculos?.length === 0, `len=${r.vehiculos?.length}`);
  check('tercero registrar=0: declararVC=false', r.declararVC === false);
  check('tercero registrar=0: carrier presente', r.carrier?.ruc === '20111111111');
}

{
  const g = { id_transportista: null, transporte_modo: 'particular',
    transporte_placa: 'P1A-456', transporte_conductor: 'PEPE', transporte_dni: '11111111', transporte_licencia: 'L1' };
  const r = resolverTransporteGuia(g, {});
  check('particular: esTercero=false', r.esTercero === false);
  check('particular: modalidad=02', r.modalidad === '02');
  check('particular: sin carrier', r.carrier === null);
  check('particular: conductor desde la GUÍA', r.conductores?.[0]?.dni === '11111111');
  check('particular: placa normalizada desde la GUÍA', r.vehiculos?.[0]?.placa === 'P1A456', `placa=${r.vehiculos?.[0]?.placa}`);
  check('particular: declararVC=true', r.declararVC === true);
}

{
  const g = { id_transportista: null, transporte_modo: 'flota', id_conductor: 3, id_vehiculo: 9, id_conductor2: 4, id_vehiculo2: 10 };
  const rel = {
    conductor: { dni: '22222222', nombre_completo: 'ANA', licencia_conducir: 'LA' },
    vehiculo: { placa: 'FL1-001' },
    conductor2: { dni: '33333333', nombre_completo: 'BETO', licencia_conducir: 'LB' },
    vehiculo2: { placa: 'FL2-002' },
  };
  const r = resolverTransporteGuia(g, rel);
  check('flota: esTercero=false', r.esTercero === false);
  check('flota: modalidad=02', r.modalidad === '02');
  check('flota: conductor desde relación (nombre_completo→nombre)', r.conductores?.[0]?.nombre === 'ANA');
  check('flota: 2 conductores', r.conductores?.length === 2);
  check('flota: vehiculo desde relación normalizado', r.vehiculos?.[0]?.placa === 'FL1001', `placa=${r.vehiculos?.[0]?.placa}`);
  check('flota: 2 vehiculos', r.vehiculos?.length === 2);
  check('flota: declararVC=true', r.declararVC === true);
}

console.log('\n=== GRE · mapear transporte de la OV hacia columnas de la guía (snapshot al crear) ===\n');

{
  const orden = {
    transporte_registrar: 1,
    transporte_dni: '12345678', transporte_conductor: 'JUAN', transporte_licencia: 'Q1',
    transporte_dni2: '87654321', transporte_conductor2: 'LUIS', transporte_licencia2: 'Q2',
    transporte_placa: 'abc-123', transporte_tuc: 'T1', transporte_autorizacion: 'A1',
    transporte_placa2: 'xy-99', transporte_tuc2: 'T2', transporte_autorizacion2: 'A2',
    transporte_ind_transbordo: 1, transporte_ind_m1l: 0, transporte_ind_retorno_vacio: 1,
    transporte_fecha_entrega: '2026-10-20',
  };
  const m = mapearTransporteDesdeOrden(orden);
  check('mapper: registrar=1', m.transporte_registrar === 1);
  check('mapper: dni copiado', m.transporte_dni === '12345678');
  check('mapper: conductor2 copiado', m.transporte_conductor2 === 'LUIS');
  check('mapper: placa normalizada', m.transporte_placa === 'ABC123', `placa=${m.transporte_placa}`);
  check('mapper: placa2 normalizada', m.transporte_placa2 === 'XY99');
  check('mapper: tuc copiado', m.transporte_tuc === 'T1');
  check('mapper: indicador transbordo=1', m.transporte_ind_transbordo === 1);
  check('mapper: indicador m1l=0', m.transporte_ind_m1l === 0);
  check('mapper: indicador retorno_vacio=1', m.transporte_ind_retorno_vacio === 1);
  check('mapper: fecha_entrega copiada', m.transporte_fecha_entrega === '2026-10-20');
}

{
  const m = mapearTransporteDesdeOrden({ transporte_registrar: 0 });
  check('mapper: registrar=0 respetado', m.transporte_registrar === 0);
  check('mapper: campos vacíos → null', m.transporte_dni === null && m.transporte_placa === null);
}

console.log(`\nResultado: ${pass} ✓  ${fail} ✗\n`);
process.exit(fail ? 1 : 0);
