export const CABECERAS_VENTAS = [
  'Ruc', 'Razon Social', 'Periodo', 'CAR SUNAT', 'Fecha de emisión', 'Fecha Vcto/Pago',
  'Tipo CP/Doc.', 'Serie del CDP', 'Nro CP o Doc. Nro Inicial (Rango)', 'Nro Final (Rango)',
  'Tipo Doc Identidad', 'Nro Doc Identidad', 'Apellidos Nombres/ Razón Social',
  'Valor Facturado Exportación', 'BI Gravada', 'Dscto BI', 'IGV / IPM', 'Dscto IGV / IPM',
  'Mto Exonerado', 'Mto Inafecto', 'ISC', 'BI Grav IVAP', 'IVAP', 'ICBPER', 'Otros Tributos',
  'Total CP', 'Moneda', 'Tipo Cambio', 'Fecha Emisión Doc Modificado', 'Tipo CP Modificado',
  'Serie CP Modificado', 'Nro CP Modificado', 'ID Proyecto Operadores Atribución', 'Tipo de Nota',
  'Est. Comp', 'Valor FOB Embarcado', 'Valor OP Gratuitas', 'Tipo Operación', 'DAM / CP', 'CLU'
];

export const normalizarCabecera = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();

const CAMPOS = {
  fechaEmision: 'Fecha de emisión',
  tipoCP: 'Tipo CP/Doc.',
  serie: 'Serie del CDP',
  numero: 'Nro CP o Doc. Nro Inicial (Rango)',
  ruc: 'Nro Doc Identidad',
  cliente: 'Apellidos Nombres/ Razón Social',
  exportacion: 'Valor Facturado Exportación',
  bi: 'BI Gravada',
  dsctoBi: 'Dscto BI',
  igv: 'IGV / IPM',
  dsctoIgv: 'Dscto IGV / IPM',
  exonerado: 'Mto Exonerado',
  inafecto: 'Mto Inafecto',
  isc: 'ISC',
  biIvap: 'BI Grav IVAP',
  ivap: 'IVAP',
  icbper: 'ICBPER',
  otros: 'Otros Tributos',
  total: 'Total CP',
  moneda: 'Moneda',
  tipoCambio: 'Tipo Cambio',
  serieMod: 'Serie CP Modificado',
  numeroMod: 'Nro CP Modificado',
  estadoComp: 'Est. Comp'
};

function lector(cabeceras) {
  const indices = new Map(cabeceras.map((c, i) => [normalizarCabecera(c), i]));
  const idx = (campo) => indices.get(normalizarCabecera(CAMPOS[campo]));
  return {
    texto: (cols, campo) => String(cols[idx(campo)] ?? '').trim(),
    numero: (cols, campo) => {
      const n = parseFloat(String(cols[idx(campo)] ?? '').trim());
      return Number.isFinite(n) ? n : 0;
    }
  };
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sinCeros = (v) => String(v ?? '').trim().replace(/^0+(?=\d)/, '');
const tipoDosDigitos = (v) => String(v ?? '').trim().padStart(2, '0');

export const claveVenta = (tipo, serie, numero) =>
  `${tipoDosDigitos(tipo)}-${String(serie ?? '').trim().toUpperCase()}-${sinCeros(numero)}`;

export function parseVentasPropuesta(texto) {
  if (!texto || typeof texto !== 'string') return { cabeceras: CABECERAS_VENTAS, filas: [] };
  const lineas = texto.split(/\r?\n/).filter((l) => l.includes('|')).map((l) => l.split('|'));
  const inicio = lineas.findIndex((cols) => normalizarCabecera(cols[0]) === 'ruc');
  const cabeceras = inicio >= 0
    ? lineas[inicio].map((c) => c.trim()).filter((c, i, arr) => c || i < arr.length - 1)
    : CABECERAS_VENTAS;
  const { texto: leer } = lector(cabeceras);
  const filas = lineas
    .slice(inicio >= 0 ? inicio + 1 : 0)
    .filter((cols) => /^\d{1,2}$/.test(leer(cols, 'tipoCP')));
  return { cabeceras, filas };
}

const fechaISO = (v) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

export function normalizarVentas({ cabeceras, filas }) {
  const { texto, numero } = lector(cabeceras);
  return filas.map((cols) => {
    const serie = texto(cols, 'serie');
    const nro = sinCeros(texto(cols, 'numero'));
    const tipoCP = tipoDosDigitos(texto(cols, 'tipoCP'));
    const serieMod = texto(cols, 'serieMod');
    const nroMod = sinCeros(texto(cols, 'numeroMod'));
    return {
      clave: claveVenta(tipoCP, serie, nro),
      tipoCP,
      serie,
      numero: nro,
      documento: `${serie}-${nro}`,
      fechaEmision: texto(cols, 'fechaEmision'),
      fecha: fechaISO(texto(cols, 'fechaEmision')),
      ruc: texto(cols, 'ruc'),
      cliente: texto(cols, 'cliente'),
      exportacion: numero(cols, 'exportacion'),
      baseImponible: r2(numero(cols, 'bi') + numero(cols, 'dsctoBi')),
      igv: r2(numero(cols, 'igv') + numero(cols, 'dsctoIgv')),
      exonerado: numero(cols, 'exonerado'),
      inafecto: numero(cols, 'inafecto'),
      isc: numero(cols, 'isc'),
      ivap: r2(numero(cols, 'biIvap') + numero(cols, 'ivap')),
      icbper: numero(cols, 'icbper'),
      otros: numero(cols, 'otros'),
      total: numero(cols, 'total'),
      moneda: (texto(cols, 'moneda') || 'PEN').toUpperCase(),
      tipoCambio: numero(cols, 'tipoCambio') || 1,
      ref: serieMod ? `${serieMod}-${nroMod}` : null,
      estadoComp: texto(cols, 'estadoComp')
    };
  });
}

export function filtrarVentasPorClaves({ cabeceras, filas }, claves) {
  if (!Array.isArray(claves)) return filas;
  const { texto } = lector(cabeceras);
  const set = new Set(claves.map(String));
  return filas.filter((cols) => set.has(claveVenta(texto(cols, 'tipoCP'), texto(cols, 'serie'), texto(cols, 'numero'))));
}

function diferenciaDoc(fila, doc) {
  if (!doc.cuenta) {
    return fila.total ? `En SUNAT figura vigente y en el sistema está ${doc.estado}` : null;
  }
  if (doc.moneda !== fila.moneda) return `Moneda en sistema ${doc.moneda}, en SUNAT ${fila.moneda}`;
  const sistema = r2(Math.abs(doc.total) * fila.tipoCambio);
  const sunat = Math.abs(fila.total);
  if (Math.abs(sistema - sunat) <= 0.02) return null;
  return `Sistema S/ ${sistema.toFixed(2)}, SUNAT S/ ${sunat.toFixed(2)}`;
}

export function conciliarVentas(ventas, docs) {
  const porClave = new Map();
  for (const d of docs) {
    if (!porClave.has(d.clave) || d.cuenta) porClave.set(d.clave, d);
  }
  const enSire = new Set(ventas.map((f) => f.clave));
  const filas = ventas.map((f) => {
    const doc = porClave.get(f.clave);
    return { ...f, id_factura: doc?.id_factura ?? null, diferencia: doc ? diferenciaDoc(f, doc) : null };
  });
  return {
    filas,
    solo_sunat: filas.filter((f) => !f.id_factura),
    diferencias: filas.filter((f) => f.diferencia),
    solo_spi: docs.filter((d) => d.cuenta && d.en_periodo && !enSire.has(d.clave))
  };
}
