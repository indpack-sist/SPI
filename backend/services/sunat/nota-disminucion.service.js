// Reglas de negocio para NC 07, motivo 09 (Disminución en el valor).
// Este módulo no accede a BD: recibe las líneas originales y devuelve las líneas exactas
// que deben viajar tanto al preliminar como al XML firmado.
import { round2, afectacionLinea } from './ubl.service.js';

function errorValidacion(mensaje) {
  const error = new Error(mensaje);
  error.statusCode = 422;
  error.isOperational = true;
  return error;
}

const n6 = (v) => Math.round((Number(v) + Number.EPSILON) * 1e6) / 1e6;

export function prepararCatalogoDisminucion({ ov, detalle, consumos = {} }) {
  return (detalle || []).map((d) => {
    const id = Number(d.id_detalle);
    const cantidad = Number(d.cantidad || 0);
    const valorUnitario = Number(d.precio_unitario || 0);
    const valorOriginal = round2(cantidad * valorUnitario);
    const disminuido = round2(Number(consumos[id] || 0));
    return {
      id_detalle_ref: id,
      codigo: d.codigo || String(d.id_producto || '-'),
      descripcion: d.nombre || d.descripcion || d.codigo || '-',
      codigo_unidad_sunat: d.codigo_unidad_sunat || null,
      cantidad,
      valor_unitario_original: valorUnitario,
      valor_original: valorOriginal,
      valor_disminuido: disminuido,
      valor_disponible: Math.max(0, round2(valorOriginal - disminuido)),
      codigo_afectacion_igv: afectacionLinea(ov, d)
    };
  });
}

/**
 * Convierte la captura del usuario en líneas UBL de disminución.
 * - Por ítem: el valor ingresado es la disminución UNITARIA sin IGV.
 * - Global: el valor ingresado es el valor de venta TOTAL a disminuir, sin IGV. Se reparte
 *   proporcionalmente por afectación tributaria y se emite una línea de servicio por grupo.
 */
export function prepararDetalleDisminucion({ ov, detalle, consumos = {}, modo, items, montoGlobal }) {
  const catalogo = prepararCatalogoDisminucion({ ov, detalle, consumos });
  const porId = new Map(catalogo.map((it) => [it.id_detalle_ref, it]));
  const modoNormalizado = String(modo || '').toLowerCase();

  if (modoNormalizado === 'item') {
    if (!Array.isArray(items) || items.length === 0) {
      throw errorValidacion('Seleccione al menos un ítem para la disminución en el valor');
    }
    const vistos = new Set();
    return items.map((raw) => {
      const id = Number(raw?.id_detalle_ref);
      const original = porId.get(id);
      if (!original) throw errorValidacion(`El ítem ${id || ''} no pertenece a la factura afectada`);
      if (vistos.has(id)) throw errorValidacion(`El ítem ${original.codigo} está repetido`);
      vistos.add(id);

      const cantidad = Number(raw.cantidad);
      const disminucion = Number(raw.disminucion_valor);
      if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > original.cantidad) {
        throw errorValidacion(`La cantidad de ${original.codigo} debe ser mayor a 0 y no superar ${original.cantidad}`);
      }
      if (!Number.isFinite(disminucion) || disminucion <= 0) {
        throw errorValidacion(`La disminución unitaria de ${original.codigo} debe ser mayor a 0`);
      }
      if (disminucion > original.valor_unitario_original) {
        throw errorValidacion(`La disminución unitaria de ${original.codigo} no puede superar su valor original`);
      }
      const base = round2(cantidad * disminucion);
      if (base > original.valor_disponible) {
        throw errorValidacion(`La disminución de ${original.codigo} supera el saldo disponible (${original.valor_disponible.toFixed(2)})`);
      }
      if (!original.codigo_unidad_sunat) {
        throw errorValidacion(`El ítem ${original.codigo} no tiene unidad de medida SUNAT`);
      }
      return {
        id_detalle_ref: id,
        codigo: original.codigo,
        nombre: original.descripcion,
        descripcion: original.descripcion,
        cantidad: n6(cantidad),
        precio_unitario: n6(disminucion),
        codigo_unidad_sunat: original.codigo_unidad_sunat,
        codigo_afectacion_igv: original.codigo_afectacion_igv,
        descuento_porcentaje: 0,
        modo_disminucion: 'item'
      };
    });
  }

  if (modoNormalizado === 'global') {
    const monto = round2(Number(montoGlobal));
    const disponible = round2(catalogo.reduce((s, it) => s + it.valor_disponible, 0));
    if (!Number.isFinite(monto) || monto <= 0) {
      throw errorValidacion('La disminución global debe ser mayor a 0');
    }
    if (monto > disponible) {
      throw errorValidacion(`La disminución global no puede superar el saldo disponible (${disponible.toFixed(2)})`);
    }

    const grupos = new Map();
    for (const it of catalogo.filter((x) => x.valor_disponible > 0)) {
      const key = it.codigo_afectacion_igv;
      grupos.set(key, (grupos.get(key) || 0) + it.valor_disponible);
    }
    const totalDisponible = [...grupos.values()].reduce((s, v) => s + v, 0);
    let asignado = 0;
    return [...grupos.entries()].map(([afectacion, baseDisponible], index, arr) => {
      const importe = index === arr.length - 1
        ? round2(monto - asignado)
        : round2(monto * baseDisponible / totalDisponible);
      asignado = round2(asignado + importe);
      return {
        id_detalle_ref: null,
        codigo: 'NC-GLOBAL',
        nombre: 'DISMINUCIÓN GLOBAL EN EL VALOR',
        descripcion: 'DISMINUCIÓN GLOBAL EN EL VALOR',
        cantidad: 1,
        precio_unitario: importe,
        codigo_unidad_sunat: 'ZZ',
        codigo_afectacion_igv: afectacion,
        descuento_porcentaje: 0,
        modo_disminucion: 'global'
      };
    }).filter((it) => it.precio_unitario > 0);
  }

  throw errorValidacion('Seleccione si la disminución es por ítem o global');
}
