export function validarNumeroPositivo(valor, nombreCampo = 'El valor') {
  const numero = parseFloat(valor);
  
  if (isNaN(numero)) {
    return { valido: false, error: `${nombreCampo} debe ser un número válido` };
  }
  
  if (numero <= 0) {
    return { valido: false, error: `${nombreCampo} debe ser mayor a 0` };
  }
  
  return { valido: true, valor: numero };
}

export function validarNumeroNoNegativo(valor, nombreCampo = 'El valor') {
  const numero = parseFloat(valor);
  
  if (isNaN(numero)) {
    return { valido: false, error: `${nombreCampo} debe ser un número válido` };
  }
  
  if (numero < 0) {
    return { valido: false, error: `${nombreCampo} no puede ser negativo` };
  }
  
  return { valido: true, valor: numero };
}

export function validarCamposRequeridos(datos, camposRequeridos) {
  const errores = [];
  
  for (const campo of camposRequeridos) {
    if (!datos[campo] || datos[campo] === '') {
      errores.push(`El campo ${campo} es requerido`);
    }
  }
  
  if (errores.length > 0) {
    return { valido: false, errores };
  }
  
  return { valido: true };
}

export function validarRUC(ruc) {
  if (!ruc) {
    return { valido: false, error: 'El RUC es requerido' };
  }
  
  const rucLimpio = ruc.toString().trim();
  
  if (!/^\d{11}$/.test(rucLimpio)) {
    return { valido: false, error: 'El RUC debe tener 11 dígitos numéricos' };
  }
  
  const primerDigito = rucLimpio.substring(0, 2);
  const validos = ['10', '15', '16', '17', '20'];
  
  if (!validos.includes(primerDigito)) {
    return { valido: false, error: 'El RUC no tiene un formato válido' };
  }
  
  return { valido: true, ruc: rucLimpio };
}

export function validarEmail(email) {
  if (!email) {
    return { valido: true };
  }
  
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!regex.test(email)) {
    return { valido: false, error: 'El email no tiene un formato válido' };
  }
  
  return { valido: true, email };
}

export function validarPlaca(placa) {
  if (!placa) {
    return { valido: false, error: 'La placa es requerida' };
  }
  
  const placaLimpia = placa.toString().trim().toUpperCase();
  
  const regex = /^[A-Z]{3}-\d{3,4}$/;
  
  if (!regex.test(placaLimpia)) {
    return { valido: false, error: 'La placa debe tener el formato ABC-123 o ABC-1234' };
  }
  
  return { valido: true, placa: placaLimpia };
}

export function validarRangoFechas(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) {
    return { valido: true };
  }
  
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
    return { valido: false, error: 'Las fechas no son válidas' };
  }
  
  if (inicio > fin) {
    return { valido: false, error: 'La fecha de inicio debe ser anterior a la fecha fin' };
  }
  
  return { valido: true };
}

export function validarStockSuficiente(stockActual, cantidadRequerida, nombreProducto = 'el producto') {
  const stock = parseFloat(stockActual);
  const cantidad = parseFloat(cantidadRequerida);
  
  if (stock < cantidad) {
    return {
      valido: false,
      error: `Stock insuficiente para ${nombreProducto}. Disponible: ${stock}, Requerido: ${cantidad}`
    };
  }
  
  return { valido: true };
}

export async function validarCodigoUnico(codigo, tabla, campo, idActual = null) {
  return {
    sql: `SELECT COUNT(*) as count FROM ${tabla} WHERE ${campo} = ?${idActual ? ` AND id != ${idActual}` : ''}`,
    params: [codigo]
  };
}

export function sanitizarTexto(texto) {
  if (!texto) return texto;
  
  return texto
    .toString()
    .trim()
    .replace(/[<>]/g, '');
}

export function validarLongitudTexto(texto, min, max, nombreCampo = 'El campo') {
  if (!texto) {
    return { valido: false, error: `${nombreCampo} es requerido` };
  }
  
  const longitud = texto.toString().trim().length;
  
  if (longitud < min) {
    return { valido: false, error: `${nombreCampo} debe tener al menos ${min} caracteres` };
  }
  
  if (longitud > max) {
    return { valido: false, error: `${nombreCampo} no puede exceder ${max} caracteres` };
  }
  
  return { valido: true };
}

export function construirValidacionExistencia(id, tabla, nombreEntidad) {
  return {
    sql: `SELECT COUNT(*) as count FROM ${tabla} WHERE id = ?`,
    params: [id],
    errorMsg: `${nombreEntidad} no encontrado`
  };
}

export function validarEstado(estado, estadosValidos) {
  if (!estadosValidos.includes(estado)) {
    return {
      valido: false,
      error: `Estado inválido. Estados válidos: ${estadosValidos.join(', ')}`
    };
  }
  
  return { valido: true };
}

export function validarNumeroDocumento(numero, patron = /^[A-Z0-9-]+$/) {
  if (!numero) {
    return { valido: false, error: 'El número de documento es requerido' };
  }
  
  const numeroLimpio = numero.toString().trim().toUpperCase();
  
  if (!patron.test(numeroLimpio)) {
    return { valido: false, error: 'El formato del número de documento no es válido' };
  }
  
  return { valido: true, numero: numeroLimpio };
}

export function validarDatosProductoMovimiento(producto, cantidad, tipoInventario) {
  const errores = [];
  
  // Validar cantidad
  const validacionCantidad = validarNumeroPositivo(cantidad, 'La cantidad');
  if (!validacionCantidad.valido) {
    errores.push(validacionCantidad.error);
  }
  
  if (producto.id_tipo_inventario !== tipoInventario) {
    errores.push('El producto no pertenece al tipo de inventario seleccionado');
  }
  
  if (errores.length > 0) {
    return { valido: false, errores };
  }
  
  return { valido: true };
}

export default {
  validarNumeroPositivo,
  validarNumeroNoNegativo,
  validarCamposRequeridos,
  validarRUC,
  validarEmail,
  validarPlaca,
  validarRangoFechas,
  validarStockSuficiente,
  validarCodigoUnico,
  sanitizarTexto,
  validarLongitudTexto,
  construirValidacionExistencia,
  validarEstado,
  validarNumeroDocumento,
  validarDatosProductoMovimiento
};