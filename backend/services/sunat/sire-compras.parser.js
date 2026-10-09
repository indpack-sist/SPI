export const COL = {
  fechaEmision: 4,
  fechaVcto: 5,
  tipoCP: 6,
  serie: 7,
  nroCP: 9,
  tipoDocId: 11,
  nroDocId: 12,
  razonSocial: 13,
  biGravadoDG: 14,
  igvDG: 15,
  biGravadoDGNG: 16,
  igvDGNG: 17,
  biGravadoDNG: 18,
  igvDNG: 19,
  valorAdqNG: 20,
  isc: 21,
  icbper: 22,
  otrosTrib: 23,
  totalCP: 24,
  moneda: 25,
  tipoCambio: 26,
  fechaDocMod: 27,
  tipoCPMod: 28,
  serieCPMod: 29,
  nroCPMod: 31,
  detraccion: 37
};

export const EXPORT_COLUMNS = [
  { label: 'Fecha de emisión', idx: COL.fechaEmision, type: 'text' },
  { label: 'Fecha Vcto/Pago', idx: COL.fechaVcto, type: 'text' },
  { label: 'Tipo CP/Doc.', idx: COL.tipoCP, type: 'text' },
  { label: 'Serie del CDP', idx: COL.serie, type: 'text' },
  { label: 'Nro CP o Doc. Nro Inicial (Rango)', idx: COL.nroCP, type: 'text' },
  { label: 'Tipo Doc Identidad', idx: COL.tipoDocId, type: 'text' },
  { label: 'Nro Doc Identidad', idx: COL.nroDocId, type: 'text' },
  { label: 'Apellidos Nombres/ Razón  Social', idx: COL.razonSocial, type: 'text' },
  { label: 'BI Gravado DG', idx: COL.biGravadoDG, type: 'number' },
  { label: 'IGV / IPM DG', idx: COL.igvDG, type: 'number' },
  { label: 'BI Gravado DGNG', idx: COL.biGravadoDGNG, type: 'number' },
  { label: 'IGV / IPM DGNG', idx: COL.igvDGNG, type: 'number' },
  { label: 'BI Gravado DNG', idx: COL.biGravadoDNG, type: 'number' },
  { label: 'IGV / IPM DNG', idx: COL.igvDNG, type: 'number' },
  { label: 'Valor Adq. NG', idx: COL.valorAdqNG, type: 'number' },
  { label: 'ISC', idx: COL.isc, type: 'number' },
  { label: 'ICBPER', idx: COL.icbper, type: 'number' },
  { label: 'Otros Trib/ Cargos', idx: COL.otrosTrib, type: 'number' },
  { label: 'Total CP', idx: COL.totalCP, type: 'number' },
  { label: 'Moneda', idx: COL.moneda, type: 'text' },
  { label: 'Tipo de Cambio', idx: COL.tipoCambio, type: 'number' },
  { label: 'Fecha Emisión Doc Modificado', idx: COL.fechaDocMod, type: 'text' },
  { label: 'Tipo CP Modificado', idx: COL.tipoCPMod, type: 'text' },
  { label: 'Serie CP Modificado', idx: COL.serieCPMod, type: 'text' },
  { label: 'Nro CP Modificado', idx: COL.nroCPMod, type: 'text' },
  { label: 'Detracción', idx: COL.detraccion, type: 'text' }
];

export function parseComprasPropuesta(texto) {
  if (!texto || typeof texto !== 'string') return [];
  return texto.split(/\r?\n/)
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.includes('|'))
    .map((l) => l.split('|'))
    .filter((cols) => cols.length > COL.detraccion && /^\d{2}$/.test((cols[COL.tipoCP] || '').trim()));
}

const num = (v) => {
  const n = parseFloat(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};

export function filaATabla(cols) {
  const serie = (cols[COL.serie] || '').trim();
  const numero = (cols[COL.nroCP] || '').trim();
  return {
    fechaEmision: (cols[COL.fechaEmision] || '').trim(),
    tipoCP: (cols[COL.tipoCP] || '').trim(),
    serie,
    numero,
    documento: `${serie}-${numero}`,
    rucProveedor: (cols[COL.nroDocId] || '').trim(),
    razonSocial: (cols[COL.razonSocial] || '').trim(),
    igv: num(cols[COL.igvDG]),
    total: num(cols[COL.totalCP]),
    moneda: (cols[COL.moneda] || '').trim(),
    tipoCambio: num(cols[COL.tipoCambio])
  };
}
