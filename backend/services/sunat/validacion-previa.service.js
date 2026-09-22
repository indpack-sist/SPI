// services/sunat/validacion-previa.service.js
// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIÓN PREVIA (preflight) a la emisión SUNAT.
//
// Objetivo: detectar errores que SUNAT RECHAZARÍA (códigos 2000-3999) u observaría
// (4000+) ANTES de reservar el correlativo, para no quemar numeración. El motor de
// emisión ya reserva el correlativo dentro de una transacción; si estas reglas se
// corren ANTES de obtenerCorrelativo() y hay errores, la transacción se aborta y el
// número NO se consume.
//
// Devuelve dos listas separadas por severidad:
//   · errores        → SUNAT rechazaría / XML inválido → BLOQUEAN la emisión.
//   · observaciones  → SUNAT aceptaría pero con observación (4000+) → solo AVISAN.
//
// Cada hallazgo: { codigo, severidad, campo, mensaje, referencia }
//   codigo     : identificador interno estable (para el frontend / logs).
//   severidad  : 'ERROR' | 'OBS'.
//   campo      : campo/entidad afectada (para resaltar en el panel).
//   mensaje    : texto legible para el usuario (español).
//   referencia : pista del código/regla SUNAT relacionada (informativo).
//
// Las reglas codifican causas de rechazo/observación ya documentadas en el proyecto
// (unidad MIL vs MLL, whitespace en razón social, afectación IGV, ubicación de
// exportación, etc.). Es lógica PURA: no toca la BD; el llamador carga los datos.
// ─────────────────────────────────────────────────────────────────────────────
import { rucValido, ubigeoValido, dniValido, placaValida, codigoBienValido } from './util.service.js';

// Monedas admitidas por el negocio (catálogo 02: PEN / USD).
const MONEDAS_VALIDAS = ['PEN', 'USD'];

// Detecta caracteres de control sin escribirlos literalmente en el fuente.
const CONTROL_CHARS = new RegExp('[\\x00-\\x1f]');

// Colector de hallazgos. Mantiene el orden de inserción y separa por severidad al cerrar.
function nuevaColeccion() {
  const items = [];
  return {
    error(codigo, campo, mensaje, referencia = null) {
      items.push({ codigo, severidad: 'ERROR', campo, mensaje, referencia });
    },
    obs(codigo, campo, mensaje, referencia = null) {
      items.push({ codigo, severidad: 'OBS', campo, mensaje, referencia });
    },
    resultado() {
      const errores = items.filter((i) => i.severidad === 'ERROR');
      const observaciones = items.filter((i) => i.severidad === 'OBS');
      return { ok: errores.length === 0, errores, observaciones, total: items };
    }
  };
}

// ¿El texto tiene whitespace problemático? (control chars, espacios dobles, bordes).
// SUNAT observa (r106/2022) razones sociales con formato irregular. No bloquea: avisa.
function whitespaceIrregular(s) {
  const t = String(s ?? '');
  if (t !== t.trim()) return true;        // espacios al inicio/fin
  if (/\s{2,}/.test(t)) return true;      // espacios dobles internos
  if (CONTROL_CHARS.test(t)) return true; // caracteres de control
  return false;
}

// ── Emisor (empresa_config) ─────────────────────────────────────────────────
// Reglas comunes a factura, nota y guía: el emisor debe tener RUC/razón/ubigeo válidos.
function validarEmisor(col, empresa) {
  if (!empresa) {
    col.error('EMISOR_FALTA', 'empresa', 'Falta la configuración de la empresa emisora (empresa_config).');
    return;
  }
  if (!rucValido(empresa.ruc)) {
    col.error('EMISOR_RUC', 'empresa.ruc', `RUC del emisor inválido: "${empresa.ruc ?? ''}" (deben ser 11 dígitos).`, '2017');
  }
  if (!String(empresa.razon_social || '').trim()) {
    col.error('EMISOR_RAZON', 'empresa.razon_social', 'Falta la razón social del emisor.');
  }
  if (!ubigeoValido(empresa.ubigeo)) {
    col.error('EMISOR_UBIGEO', 'empresa.ubigeo', `Ubigeo del emisor inválido: "${empresa.ubigeo ?? ''}" (6 dígitos).`, '2755');
  }
}

/**
 * Valida un COMPROBANTE (Factura 01 / Nota 07 / Nota 08) antes de numerar.
 *
 * @param {object}   p
 * @param {'01'|'07'|'08'} p.tipo
 * @param {object}   p.ov        orden de venta (fila cruda)
 * @param {object}   p.cliente   cliente (fila cruda)
 * @param {object}   p.empresa   empresa_config
 * @param {object}   p.calc      salida de calcularComprobante({ ov, detalle })
 * @param {string}   [p.ordenCompra]     OC efectiva que viajará (cac:OrderReference)
 * @param {string}   [p.observaciones]   texto que viajará en cbc:Note (aplanado)
 * @returns {{ ok, errores, observaciones, total }}
 */
export function validarComprobantePrevio({ tipo, ov, cliente, empresa, calc, ordenCompra, observaciones }) {
  const col = nuevaColeccion();
  const esExport = !!calc?.esExport;

  validarEmisor(col, empresa);

  // ── Cliente (receptor) ─────────────────────────────────────────────────────
  if (!cliente) {
    col.error('CLIENTE_FALTA', 'cliente', 'El cliente del comprobante no existe.');
  } else {
    if (!esExport) {
      // Factura/nota doméstica: receptor con RUC de 11 dígitos (SUNAT rechaza si no).
      if (String(cliente.tipo_documento || '').toUpperCase() !== 'RUC' || !rucValido(cliente.ruc)) {
        col.error('CLIENTE_RUC', 'cliente.ruc',
          'El comprobante requiere un cliente con RUC de 11 dígitos.', '2022');
      }
    }
    if (!String(cliente.razon_social || '').trim()) {
      col.error('CLIENTE_RAZON', 'cliente.razon_social', 'Falta la razón social del cliente.');
    } else if (whitespaceIrregular(cliente.razon_social)) {
      col.obs('CLIENTE_RAZON_WS', 'cliente.razon_social',
        'La razón social del cliente tiene espacios irregulares (dobles, al borde o caracteres de control); SUNAT podría observarla.', 'r106');
    }
  }

  // ── Moneda ─────────────────────────────────────────────────────────────────
  const moneda = String(calc?.moneda || ov?.moneda || 'PEN').toUpperCase();
  if (!MONEDAS_VALIDAS.includes(moneda)) {
    col.error('MONEDA', 'ov.moneda', `Moneda no admitida: "${moneda}" (use PEN o USD).`, '2071');
  }

  // ── Detalle / líneas ───────────────────────────────────────────────────────
  const lineas = calc?.lineas || [];
  if (!lineas.length) {
    col.error('SIN_LINEAS', 'detalle', 'El comprobante no tiene líneas para emitir.', '2109');
  }
  for (const L of lineas) {
    const ref = `línea ${L.numero} (${L.codigo || L.descripcion || '?'})`;
    if (!L.unidad) {
      col.error('LINEA_UNIDAD', 'detalle.unidad',
        `Falta el código de unidad SUNAT en la ${ref}; complételo en el producto antes de emitir.`, '2938');
    } else if (String(L.unidad).toUpperCase() === 'MLL') {
      // Memoria unidad-medida-millar-MIL: en FACTURA el millar es 'MIL' (cat.03); 'MLL'
      // (cat.65) solo es válido en GRE ligada a DAM/DS y provoca rechazo 2936 en factura.
      col.error('LINEA_MLL', 'detalle.unidad',
        `La ${ref} usa la unidad "MLL", que SUNAT rechaza en factura. El millar en factura es "MIL".`, '2936');
    }
    if (!(Number(L.cantidad) > 0)) {
      col.error('LINEA_CANTIDAD', 'detalle.cantidad', `La cantidad debe ser mayor a 0 en la ${ref}.`, '2033');
    }
    if (Number(L.valorUnitario) < 0) {
      col.error('LINEA_PRECIO', 'detalle.precio', `El valor unitario no puede ser negativo en la ${ref}.`);
    }
    if (!String(L.descripcion || '').trim()) {
      col.obs('LINEA_DESC', 'detalle.descripcion', `La ${ref} no tiene descripción; SUNAT podría observarla.`);
    }
  }

  // ── Totales (guardas de consistencia del cálculo compartido) ────────────────
  if (lineas.length) {
    const suma = Math.round((Number(calc.subtotal) + Number(calc.igv)) * 100) / 100;
    if (Math.abs(suma - Number(calc.total)) > 0.01) {
      col.error('TOTAL_DESCUADRE', 'totales',
        `El total (${calc.total}) no cuadra con base + IGV (${suma}).`, '2378');
    }
    if (!(Number(calc.total) > 0)) {
      col.error('TOTAL_CERO', 'totales', 'El total del comprobante debe ser mayor a 0.');
    }
  }

  // ── Exportación (0200): ubicación de entrega del emisor obligatoria ──────────
  if (esExport && empresa) {
    const faltantes = ['direccion', 'departamento', 'provincia', 'distrito'].filter((c) => !String(empresa[c] || '').trim());
    if (!ubigeoValido(empresa.ubigeo)) faltantes.push('ubigeo (6 dígitos)');
    if (faltantes.length) {
      col.error('EXPORT_UBICACION', 'empresa',
        `Exportación: la ubicación de entrega en empresa_config está incompleta (${faltantes.join(', ')}).`);
    }
  }

  // ── Campos de longitud acotada por SUNAT ────────────────────────────────────
  if (ordenCompra !== undefined && String(ordenCompra || '').trim().length > 20) {
    col.error('OC_LARGA', 'orden_compra', 'La orden de compra admite como máximo 20 caracteres para SUNAT.');
  }
  if (observaciones !== undefined) {
    const obsPlano = String(observaciones || '').replace(/[\r\n]+/g, ' ').trim();
    if (obsPlano.length > 200) {
      col.error('OBS_LARGA', 'observaciones', 'Las observaciones admiten como máximo 200 caracteres para SUNAT.');
    }
  }

  return col.resultado();
}

/**
 * Valida una GUÍA DE REMISIÓN (09) antes de numerar. Espeja las reglas de formato que
 * emitirGuiaGre() ya aplica inline, pero de forma PURA y read-only para poder mostrarlas
 * en el wizard ANTES de emitir. El llamador arma `datos` desde las mismas tablas.
 *
 * @param {object} p
 * @param {object} p.empresa      empresa_config (remitente)
 * @param {object} p.guia         fila guias_remision (ya con partida/llegada sincronizados)
 * @param {object} p.destinatario { ruc, razon_social, tipo_documento }
 * @param {Array}  p.detalle      líneas normalizadas (codigo, nombre, codigo_unidad_sunat, codigo_bien, subpartida_nacional)
 * @param {boolean} p.esComex
 * @param {boolean} p.declararVC  ¿se declaran vehículo/conductor? (no tercero, o tercero con registrar)
 * @param {Array}  p.conductores  [{ dni, nombre, licencia }]
 * @param {Array}  p.vehiculos    [{ placa }]
 * @param {object} [p.carrier]    transportista (tercero): { ruc, razon, mtc }
 * @param {Array}  [p.docsComex]  documentos relacionados (DAM) si comex
 * @param {'PROD'|'BETA'} [p.mode]
 * @returns {{ ok, errores, observaciones, total }}
 */
export function validarGuiaPrevia({
  empresa, guia, destinatario, detalle, esComex, declararVC,
  conductores = [], vehiculos = [], carrier = null, docsComex = [], mode = 'BETA'
}) {
  const col = nuevaColeccion();
  const g = guia || {};

  validarEmisor(col, empresa);

  // ── Puntos de partida/llegada ───────────────────────────────────────────────
  if (!String(g.direccion_partida || '').trim() || !String(g.direccion_llegada || '').trim()) {
    col.error('GRE_DIRECCIONES', 'guia.direcciones', 'Faltan las direcciones de partida y/o llegada.');
  }
  if (!ubigeoValido(g.ubigeo_partida)) {
    col.error('GRE_UBIGEO_PARTIDA', 'guia.ubigeo_partida', `Ubigeo de partida inválido: "${g.ubigeo_partida ?? ''}" (6 dígitos).`);
  }
  if (!ubigeoValido(g.ubigeo_llegada)) {
    col.error('GRE_UBIGEO_LLEGADA', 'guia.ubigeo_llegada', `Ubigeo de llegada inválido: "${g.ubigeo_llegada ?? ''}" (6 dígitos).`);
  }

  // ── Carga / motivo ──────────────────────────────────────────────────────────
  if (!(Number(g.peso_bruto_kg) > 0)) {
    col.error('GRE_PESO', 'guia.peso_bruto_kg', 'El peso bruto (kg) debe ser mayor a 0.');
  }
  if (!String(g.motivo_traslado_cod || '').trim()) {
    col.error('GRE_MOTIVO', 'guia.motivo_traslado_cod', 'Falta el motivo de traslado (catálogo 20).');
  }

  // ── Destinatario ────────────────────────────────────────────────────────────
  if (!destinatario) {
    col.error('GRE_DEST_FALTA', 'destinatario', 'Falta el destinatario de la guía.');
  } else if (esComex) {
    if (!rucValido(destinatario.ruc) || !String(destinatario.razon_social || '').trim()) {
      col.error('GRE_DEST_COMEX', 'destinatario',
        'Comercio exterior: el destinatario (operador de puerto/depósito) requiere RUC de 11 dígitos y razón social.');
    }
  }

  // ── Detalle ─────────────────────────────────────────────────────────────────
  if (!detalle || !detalle.length) {
    col.error('GRE_SIN_DETALLE', 'detalle', 'La guía no tiene detalle.');
  }
  for (const d of (detalle || [])) {
    const ref = d.codigo || d.nombre || '?';
    if (!String(d.codigo_unidad_sunat || '').trim()) {
      col.error('GRE_UNIDAD', 'detalle.unidad', `El ítem "${ref}" no tiene código de unidad SUNAT.`);
    }
    if (!codigoBienValido(d.codigo_bien)) {
      col.error('GRE_CODBIEN', 'detalle.codigo_bien', `Código de bien inválido en "${ref}": debe tener 13 dígitos (GTIN-13).`);
    }
    if (esComex && !String(d.subpartida_nacional || '').trim()) {
      col.error('GRE_SUBPARTIDA', 'detalle.subpartida_nacional', `Comercio exterior: falta la subpartida nacional del ítem "${ref}".`);
    }
  }

  // ── Comercio exterior: al menos un documento relacionado (DAM) ───────────────
  if (esComex && (!docsComex || !docsComex.length)) {
    col.error('GRE_COMEX_DOC', 'comex.docs', 'Comercio exterior: falta al menos un documento relacionado (DAM).');
  }

  // ── Transportista (tercero) ─────────────────────────────────────────────────
  if (carrier) {
    if (!rucValido(carrier.ruc) || !String(carrier.razon || '').trim()) {
      col.error('GRE_CARRIER', 'transportista', 'El transportista requiere RUC de 11 dígitos y razón social.');
    }
  }

  // ── Vehículo / conductor (si se declaran) ───────────────────────────────────
  if (declararVC) {
    const c0 = conductores[0];
    if (!c0 || !c0.dni || !c0.nombre || !c0.licencia) {
      col.error('GRE_CONDUCTOR', 'conductor', 'Faltan datos del conductor (DNI, nombre y licencia de conducir).');
    } else {
      for (const c of conductores) {
        if (!dniValido(c.dni)) {
          col.error('GRE_DNI', 'conductor.dni', `DNI del conductor inválido: "${c.dni}" (deben ser 8 dígitos).`);
        }
        if (!c.nombre || !c.licencia) {
          col.error('GRE_CONDUCTOR2', 'conductor', 'Conductor secundario incompleto (faltan nombre y/o licencia).');
        }
      }
    }
    const placa0 = vehiculos[0]?.placa;
    if (!placa0) {
      // En PROD la placa es obligatoria; en BETA el core usa un placeholder para el mock.
      if (mode === 'PROD') col.error('GRE_PLACA_FALTA', 'vehiculo.placa', 'Falta la placa del vehículo.');
      else col.obs('GRE_PLACA_BETA', 'vehiculo.placa', 'Sin placa: en BETA se usa un placeholder para el mock, NO válido en PROD.');
    } else if (!placaValida(placa0)) {
      col.error('GRE_PLACA', 'vehiculo.placa', `Placa inválida: "${placa0}" (6 a 8 caracteres alfanuméricos).`);
    }
    if (vehiculos[1]?.placa && !placaValida(vehiculos[1].placa)) {
      col.error('GRE_PLACA2', 'vehiculo.placa', `Placa del vehículo secundario inválida: "${vehiculos[1].placa}" (6 a 8 caracteres alfanuméricos).`);
    }
  }

  return col.resultado();
}

export default { validarComprobantePrevio, validarGuiaPrevia };
