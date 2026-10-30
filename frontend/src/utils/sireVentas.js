export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const CLASE_POR_TIPO = { '07': 'NOTA_CREDITO', '08': 'NOTA_DEBITO' };
const TIPO_POR_FILTRO = { FACTURA: '01', NOTA_CREDITO: '07', NOTA_DEBITO: '08' };

export const periodoDeRango = (desde, hasta) => {
  if (!desde || !hasta || desde.slice(0, 7) !== hasta.slice(0, 7)) return '';
  return desde.slice(0, 7).replace('-', '');
};

export function coincideFiltros(f, { tipo, desde, hasta, q }, { mesCompleto = false } = {}) {
  if (tipo && tipo !== 'all' && f.tipoCP !== TIPO_POR_FILTRO[tipo]) return false;
  if (!mesCompleto) {
    if (desde && (!f.fecha || f.fecha < desde)) return false;
    if (hasta && (!f.fecha || f.fecha > hasta)) return false;
  }
  const texto = (q || '').trim().toLowerCase();
  return !texto || [f.documento, f.cliente, f.ruc].some((v) => String(v || '').toLowerCase().includes(texto));
}

export function filaDesdeSire(f) {
  const tc = f.tipoCambio || 1;
  return {
    id_factura: f.id_factura ?? `sire-${f.clave}`,
    solo_sunat: !f.id_factura,
    sire: f,
    clase: CLASE_POR_TIPO[f.tipoCP] || 'FACTURA',
    documento: f.documento,
    fecha_emision: f.fecha ? `${f.fecha}T12:00:00-05:00` : null,
    cliente: f.cliente,
    ruc_cliente: f.ruc,
    moneda: f.moneda,
    subtotal: r2(Math.abs(f.baseImponible) / tc),
    igv: r2(Math.abs(f.igv) / tc),
    total: r2(Math.abs(f.total) / tc),
    estado_final: f.id_factura ? 'ACEPTADO' : 'SOLO_SUNAT',
    sunat_response_desc: f.id_factura ? '' : 'Existe en SUNAT y no está registrado en el sistema',
    ref_documento: f.ref,
    id_orden_venta: null,
  };
}

const nuevoGrupo = (moneda) => ({
  moneda, cantidad: 0, n_facturas: 0, n_notas_credito: 0, n_notas_debito: 0,
  facturas: 0, notas_credito: 0, notas_debito: 0, neto: 0, valor_venta: 0, igv: 0, soles: 0,
  exportacion: 0, exonerado: 0, inafecto: 0, isc: 0, ivap: 0, icbper: 0, otros: 0,
});

const CAMPOS_REDONDEO = ['facturas', 'notas_credito', 'notas_debito', 'neto', 'valor_venta', 'igv', 'soles',
  'exportacion', 'exonerado', 'inafecto', 'isc', 'ivap', 'icbper', 'otros'];

function acumular(g, f, factor) {
  const monto = factor === 1 ? f.total : r2(f.total / factor);
  g.cantidad += 1;
  if (f.tipoCP === '07') { g.n_notas_credito += 1; g.notas_credito -= monto; }
  else if (f.tipoCP === '08') { g.n_notas_debito += 1; g.notas_debito += monto; }
  else { g.n_facturas += 1; g.facturas += monto; }
  g.neto += monto;
  g.soles += f.total;
  g.valor_venta += r2(f.baseImponible / factor);
  g.igv += r2(f.igv / factor);
  for (const c of ['exportacion', 'exonerado', 'inafecto', 'isc', 'ivap', 'icbper', 'otros']) {
    g[c] += r2((f[c] || 0) / factor);
  }
}

export function resumirVentas(filas) {
  const soles = nuevoGrupo('PEN');
  const porMoneda = new Map();
  for (const f of filas) {
    acumular(soles, f, 1);
    if (!porMoneda.has(f.moneda)) porMoneda.set(f.moneda, nuevoGrupo(f.moneda));
    acumular(porMoneda.get(f.moneda), f, f.moneda === 'PEN' ? 1 : (f.tipoCambio || 1));
  }
  const cerrar = (g) => { CAMPOS_REDONDEO.forEach((c) => { g[c] = r2(g[c]); }); return g; };
  return { soles: cerrar(soles), porMoneda: [...porMoneda.values()].map(cerrar) };
}
