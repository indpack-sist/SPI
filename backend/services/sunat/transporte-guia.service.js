import { normalizarPlaca } from './util.service.js';

export function resolverTransporteGuia(g = {}, rel = {}) {
  const esTercero = !!g.id_transportista;
  const indicadores = {
    transbordo: !!g.transporte_ind_transbordo,
    m1l: !!g.transporte_ind_m1l,
    retornoVacio: !!g.transporte_ind_retorno_vacio,
  };

  let carrier = null, conductores = [], vehiculos = [], registrar = true;

  if (esTercero) {
    const t = rel.transportista;
    carrier = t ? { ruc: t.ruc, razon: t.razon_social, mtc: t.numero_mtc || null } : null;
    registrar = g.transporte_registrar !== 0;
    if (registrar) {
      if (g.transporte_dni) conductores.push({ dni: g.transporte_dni, nombre: g.transporte_conductor, licencia: g.transporte_licencia });
      if (g.transporte_dni2) conductores.push({ dni: g.transporte_dni2, nombre: g.transporte_conductor2, licencia: g.transporte_licencia2 });
      vehiculos = [{ placa: normalizarPlaca(g.transporte_placa), tuce: g.transporte_tuc || null, autorizacion: g.transporte_autorizacion || null }];
      const placa2 = normalizarPlaca(g.transporte_placa2);
      if (placa2) vehiculos.push({ placa: placa2, tuce: g.transporte_tuc2 || null, autorizacion: g.transporte_autorizacion2 || null });
      indicadores.registrarTransp = true;
    }
  } else if (g.transporte_modo === 'particular' || g.transporte_placa) {
    conductores = [{ dni: g.transporte_dni, nombre: g.transporte_conductor, licencia: g.transporte_licencia }];
    vehiculos = [{ placa: normalizarPlaca(g.transporte_placa), tuce: null, autorizacion: null }];
  } else {
    const c = rel.conductor, v = rel.vehiculo, c2 = rel.conductor2, v2 = rel.vehiculo2;
    conductores = c ? [{ dni: c.dni, nombre: c.nombre_completo, licencia: c.licencia_conducir }] : [];
    vehiculos = v ? [{ placa: normalizarPlaca(v.placa), tuce: null, autorizacion: null }] : [];
    if (c2) conductores.push({ dni: c2.dni, nombre: c2.nombre_completo, licencia: c2.licencia_conducir });
    if (v2) vehiculos.push({ placa: normalizarPlaca(v2.placa), tuce: null, autorizacion: null });
  }

  const modalidad = esTercero ? '01' : '02';
  const declararVC = !esTercero || registrar;

  return { esTercero, carrier, conductores, vehiculos, indicadores, registrar, modalidad, declararVC };
}

export function mapearTransporteDesdeOrden(orden = {}) {
  return {
    transporte_registrar: orden.transporte_registrar === 0 ? 0 : 1,
    transporte_dni: orden.transporte_dni || null,
    transporte_conductor: orden.transporte_conductor || null,
    transporte_licencia: orden.transporte_licencia || null,
    transporte_dni2: orden.transporte_dni2 || null,
    transporte_conductor2: orden.transporte_conductor2 || null,
    transporte_licencia2: orden.transporte_licencia2 || null,
    transporte_placa: normalizarPlaca(orden.transporte_placa),
    transporte_tuc: orden.transporte_tuc || null,
    transporte_autorizacion: orden.transporte_autorizacion || null,
    transporte_placa2: normalizarPlaca(orden.transporte_placa2),
    transporte_tuc2: orden.transporte_tuc2 || null,
    transporte_autorizacion2: orden.transporte_autorizacion2 || null,
    transporte_ind_transbordo: orden.transporte_ind_transbordo ? 1 : 0,
    transporte_ind_m1l: orden.transporte_ind_m1l ? 1 : 0,
    transporte_ind_retorno_vacio: orden.transporte_ind_retorno_vacio ? 1 : 0,
    transporte_fecha_entrega: orden.transporte_fecha_entrega || null,
  };
}
