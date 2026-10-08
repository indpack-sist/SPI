import { rucValido, ubigeoValido, dniValido, placaValida, codigoBienValido } from './util.service.js';

const MONEDAS_VALIDAS = ['PEN', 'USD'];

const CONTROL_CHARS = new RegExp('[\\x00-\\x1f]');

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

function whitespaceIrregular(s) {
  const t = String(s ?? '');
  if (t !== t.trim()) return true;
  if (/\s{2,}/.test(t)) return true;
  if (CONTROL_CHARS.test(t)) return true;
  return false;
}

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

export function validarComprobantePrevio({ tipo, ov, cliente, empresa, calc, ordenCompra, observaciones }) {
  const col = nuevaColeccion();
  const esExport = !!calc?.esExport;

  validarEmisor(col, empresa);

  if (!cliente) {
    col.error('CLIENTE_FALTA', 'cliente', 'El cliente del comprobante no existe.');
  } else {
    if (!esExport) {
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

  const moneda = String(calc?.moneda || ov?.moneda || 'PEN').toUpperCase();
  if (!MONEDAS_VALIDAS.includes(moneda)) {
    col.error('MONEDA', 'ov.moneda', `Moneda no admitida: "${moneda}" (use PEN o USD).`, '2071');
  }

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

  if (esExport && empresa) {
    const faltantes = ['direccion', 'departamento', 'provincia', 'distrito'].filter((c) => !String(empresa[c] || '').trim());
    if (!ubigeoValido(empresa.ubigeo)) faltantes.push('ubigeo (6 dígitos)');
    if (faltantes.length) {
      col.error('EXPORT_UBICACION', 'empresa',
        `Exportación: la ubicación de entrega en empresa_config está incompleta (${faltantes.join(', ')}).`);
    }
  }

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

export function validarGuiaPrevia({
  empresa, guia, destinatario, detalle, esComex, declararVC,
  conductores = [], vehiculos = [], carrier = null, docsComex = [], mode = 'BETA'
}) {
  const col = nuevaColeccion();
  const g = guia || {};

  validarEmisor(col, empresa);

  if (!String(g.direccion_partida || '').trim() || !String(g.direccion_llegada || '').trim()) {
    col.error('GRE_DIRECCIONES', 'guia.direcciones', 'Faltan las direcciones de partida y/o llegada.');
  }
  if (!ubigeoValido(g.ubigeo_partida)) {
    col.error('GRE_UBIGEO_PARTIDA', 'guia.ubigeo_partida', `Ubigeo de partida inválido: "${g.ubigeo_partida ?? ''}" (6 dígitos).`);
  }
  if (!ubigeoValido(g.ubigeo_llegada)) {
    col.error('GRE_UBIGEO_LLEGADA', 'guia.ubigeo_llegada', `Ubigeo de llegada inválido: "${g.ubigeo_llegada ?? ''}" (6 dígitos).`);
  }

  if (!(Number(g.peso_bruto_kg) > 0)) {
    col.error('GRE_PESO', 'guia.peso_bruto_kg', 'El peso bruto (kg) debe ser mayor a 0.');
  }
  if (!String(g.motivo_traslado_cod || '').trim()) {
    col.error('GRE_MOTIVO', 'guia.motivo_traslado_cod', 'Falta el motivo de traslado (catálogo 20).');
  }

  if (!destinatario) {
    col.error('GRE_DEST_FALTA', 'destinatario', 'Falta el destinatario de la guía.');
  } else if (esComex) {
    if (!rucValido(destinatario.ruc) || !String(destinatario.razon_social || '').trim()) {
      col.error('GRE_DEST_COMEX', 'destinatario',
        'Comercio exterior: el destinatario (operador de puerto/depósito) requiere RUC de 11 dígitos y razón social.');
    }
  }

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

  if (esComex && (!docsComex || !docsComex.length)) {
    col.error('GRE_COMEX_DOC', 'comex.docs', 'Comercio exterior: falta al menos un documento relacionado (DAM).');
  }

  if (carrier) {
    if (!rucValido(carrier.ruc) || !String(carrier.razon || '').trim()) {
      col.error('GRE_CARRIER', 'transportista', 'El transportista requiere RUC de 11 dígitos y razón social.');
    }
  }

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
