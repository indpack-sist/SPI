import { executeQuery } from '../config/database.js';
import { validarRUC, validarDNI } from '../services/api-validation.service.js';

export async function getAllClientes(req, res) {
  try {
    const { estado } = req.query;
    
    let sql = 'SELECT * FROM clientes WHERE 1=1';
    const params = [];
    
    if (estado) {
      sql += ' AND estado = ?';
      params.push(estado);
    }
    
    sql += ' ORDER BY razon_social ASC';
    
    const result = await executeQuery(sql, params);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getClienteById(req, res) {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(
      'SELECT * FROM clientes WHERE id_cliente = ?',
      [id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    if (result.data.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    const cliente = result.data[0];

    const direccionesResult = await executeQuery(
      'SELECT * FROM clientes_direcciones WHERE id_cliente = ? AND estado = "Activo" ORDER BY es_principal DESC',
      [id]
    );

    cliente.direcciones = direccionesResult.success ? direccionesResult.data : [];
    
    res.json({
      success: true,
      data: cliente
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getClienteByRuc(req, res) {
  try {
    const { ruc } = req.params;
    
    const result = await executeQuery(
      'SELECT * FROM clientes WHERE ruc = ?',
      [ruc]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    if (result.data.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function validarRUCCliente(req, res) {
  try {
    const { ruc } = req.params;

    const resultadoValidacion = await validarRUC(ruc);
    
    if (!resultadoValidacion.valido) {
      return res.status(400).json({
        success: false,
        error: resultadoValidacion.error
      });
    }
    
    const rucExiste = await executeQuery(
      'SELECT id_cliente, razon_social FROM clientes WHERE ruc = ?',
      [ruc]
    );
    
    const yaRegistrado = rucExiste.data.length > 0;
    
    res.json({
      success: true,
      valido: true,
      tipo_documento: 'RUC',
      datos: resultadoValidacion.datos,
      ya_registrado: yaRegistrado,
      cliente_existente: yaRegistrado ? rucExiste.data[0] : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function validarDNICliente(req, res) {
  try {
    const { dni } = req.params;

    const resultadoValidacion = await validarDNI(dni);
    
    if (!resultadoValidacion.valido) {
      return res.status(400).json({
        success: false,
        error: resultadoValidacion.error
      });
    }
    
    const dniExiste = await executeQuery(
      'SELECT id_cliente, razon_social FROM clientes WHERE ruc = ?',
      [dni]
    );
    
    const yaRegistrado = dniExiste.data.length > 0;
    
    res.json({
      success: true,
      valido: true,
      tipo_documento: 'DNI',
      datos: {
        ...resultadoValidacion.datos,
        razon_social: resultadoValidacion.datos.nombre_completo
      },
      ya_registrado: yaRegistrado,
      cliente_existente: yaRegistrado ? dniExiste.data[0] : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function createCliente(req, res) {
  try {
    const {
      ruc,
      tipo_documento,
      razon_social,
      contacto,
      telefono,
      email,
      direccion_despacho,
      usar_limite_credito,
      validar_documento,
      estado,
      creacion_manual 
    } = req.body;

    if (!ruc || !razon_social) {
      return res.status(400).json({ 
        error: 'Documento de identidad y razón social/nombre son requeridos' 
      });
    }

    if (!creacion_manual && validar_documento) {
      if (tipo_documento === 'DNI') {
        const resultadoValidacion = await validarDNI(ruc);
        
        if (!resultadoValidacion.valido) {
          return res.status(400).json({
            error: `DNI inválido: ${resultadoValidacion.error}`
          });
        }
        
        const nombreRENIEC = resultadoValidacion.datos.nombre_completo.toUpperCase();
        const nombreIngresado = razon_social.toUpperCase();
        
        if (nombreRENIEC !== nombreIngresado) {
          console.warn(`Advertencia: Nombre ingresado (${nombreIngresado}) no coincide con RENIEC (${nombreRENIEC})`);
        }
      } else {
        const resultadoValidacion = await validarRUC(ruc);
        
        if (!resultadoValidacion.valido) {
          return res.status(400).json({
            error: `RUC inválido: ${resultadoValidacion.error}`
          });
        }
        
        const razonSUNAT = resultadoValidacion.datos.razon_social.toUpperCase();
        const razonIngresada = razon_social.toUpperCase();
        
        if (razonSUNAT !== razonIngresada) {
          console.warn(`Advertencia: Razón social ingresada (${razonIngresada}) no coincide con SUNAT (${razonSUNAT})`);
        }
        
        if (resultadoValidacion.datos.estado !== 'ACTIVO') {
          console.warn(`Advertencia: El RUC está en estado ${resultadoValidacion.datos.estado} en SUNAT`);
        }
      }
    }

    const checkRUC = await executeQuery(
      'SELECT * FROM clientes WHERE ruc = ?',
      [ruc]
    );
    
    if (checkRUC.data.length > 0) {
      return res.status(400).json({ 
        error: `Ya existe un cliente con ese ${tipo_documento === 'DNI' ? 'DNI' : 'RUC'}` 
      });
    }

    const result = await executeQuery(
      `INSERT INTO clientes (
        ruc, 
        tipo_documento,
        razon_social, 
        contacto, 
        telefono, 
        email, 
        direccion_despacho,
        limite_credito_pen, 
        limite_credito_usd, 
        usar_limite_credito,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ruc,
        tipo_documento || 'RUC',
        razon_social,
        contacto || null,
        telefono || null,
        email || null,
        direccion_despacho || null,
        0, 
        0,
        usar_limite_credito ? 1 : 0,
        estado || 'Activo'
      ]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    const idCliente = result.data.insertId;

    if (direccion_despacho) {
      await executeQuery(
        `INSERT INTO clientes_direcciones (id_cliente, direccion, es_principal) VALUES (?, ?, 1)`,
        [idCliente, direccion_despacho]
      );
    }
    
    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: {
        id_cliente: idCliente,
        ruc,
        tipo_documento: tipo_documento || 'RUC',
        razon_social
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateCliente(req, res) {
  try {
    const { id } = req.params;
    const {
      ruc,
      tipo_documento,
      razon_social,
      contacto,
      telefono,
      email,
      direccion_despacho,
      limite_credito_pen,
      limite_credito_usd,
      usar_limite_credito,
      estado
    } = req.body;
    
    const checkResult = await executeQuery(
      'SELECT * FROM clientes WHERE id_cliente = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    if (ruc !== checkResult.data[0].ruc) {
      const checkRUC = await executeQuery(
        'SELECT * FROM clientes WHERE ruc = ? AND id_cliente != ?',
        [ruc, id]
      );
      
      if (checkRUC.data.length > 0) {
        return res.status(400).json({ 
          error: `Ya existe un cliente con ese ${tipo_documento === 'DNI' ? 'DNI' : 'RUC'}` 
        });
      }
    }

    const result = await executeQuery(
      `UPDATE clientes SET 
        ruc = ?, 
        tipo_documento = ?,
        razon_social = ?, 
        contacto = ?, 
        telefono = ?,
        email = ?, 
        direccion_despacho = ?,
        limite_credito_pen = ?,
        limite_credito_usd = ?,
        usar_limite_credito = ?,
        estado = ?
      WHERE id_cliente = ?`,
      [
        ruc,
        tipo_documento || 'RUC',
        razon_social, 
        contacto, 
        telefono, 
        email, 
        direccion_despacho,
        parseFloat(limite_credito_pen || 0),
        parseFloat(limite_credito_usd || 0),
        usar_limite_credito ? 1 : 0,
        estado, 
        id
      ]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteCliente(req, res) {
  try {
    const { id } = req.params;
    
    const checkResult = await executeQuery(
      'SELECT * FROM clientes WHERE id_cliente = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    const result = await executeQuery(
      'UPDATE clientes SET estado = ? WHERE id_cliente = ?',
      ['Inactivo', id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Cliente desactivado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getHistorialCotizacionesCliente(req, res) {
  try {
    const { id } = req.params;
    
    const clienteCheck = await executeQuery(
      'SELECT id_cliente FROM clientes WHERE id_cliente = ?',
      [id]
    );
    
    if (clienteCheck.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }
    
    const result = await executeQuery(`
      SELECT 
        c.id_cotizacion,
        c.numero_cotizacion,
        DATE_FORMAT(c.fecha_emision, '%Y-%m-%d') as fecha_emision,
        DATE_FORMAT(c.fecha_vencimiento, '%Y-%m-%d') as fecha_vencimiento,
        c.estado,
        c.prioridad,
        c.subtotal,
        c.igv,
        c.total,
        c.moneda,
        c.tipo_impuesto,
        c.porcentaje_impuesto,
        e.nombre_completo AS comercial,
        c.id_orden_venta,
        ov.numero_orden AS numero_orden_venta,
        (SELECT COUNT(*) FROM detalle_cotizacion WHERE id_cotizacion = c.id_cotizacion) AS total_items,
        c.fecha_creacion
      FROM cotizaciones c
      LEFT JOIN empleados e ON c.id_comercial = e.id_empleado
      LEFT JOIN ordenes_venta ov ON c.id_orden_venta = ov.id_orden_venta
      WHERE c.id_cliente = ?
      ORDER BY c.fecha_creacion DESC
    `, [id]);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
    
  } catch (error) {
    console.error('Error al obtener historial de cotizaciones:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getHistorialOrdenesVentaCliente(req, res) {
  try {
    const { id } = req.params;
    
    const clienteCheck = await executeQuery(
      'SELECT id_cliente FROM clientes WHERE id_cliente = ?',
      [id]
    );
    
    if (clienteCheck.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }
    
    const result = await executeQuery(`
      SELECT 
        ov.id_orden_venta,
        ov.numero_orden,
        DATE_FORMAT(ov.fecha_emision, '%Y-%m-%d') as fecha_emision,
        DATE_FORMAT(ov.fecha_entrega_estimada, '%Y-%m-%d') as fecha_entrega_estimada,
        DATE_FORMAT(ov.fecha_entrega_real, '%Y-%m-%d') as fecha_entrega_real,
        ov.estado,
        ov.prioridad,
        ov.subtotal,
        ov.igv,
        ov.total,
        ov.moneda,
        ov.tipo_impuesto,
        ov.porcentaje_impuesto,
        ov.orden_compra_cliente,
        ov.monto_pagado,
        ov.estado_pago,
        (ov.total - ov.monto_pagado) as saldo_pendiente,
        e.nombre_completo AS comercial,
        c.numero_cotizacion,
        ov.id_cotizacion,
        (SELECT COUNT(*) FROM detalle_orden_venta WHERE id_orden_venta = ov.id_orden_venta) AS total_items,
        ov.fecha_creacion
      FROM ordenes_venta ov
      LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      WHERE ov.id_cliente = ?
      ORDER BY ov.fecha_creacion DESC
    `, [id]);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
    
  } catch (error) {
    console.error('Error al obtener historial de órdenes de venta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getEstadoCreditoCliente(req, res) {
  try {
    const { id } = req.params;
    
    const clienteResult = await executeQuery(`
      SELECT 
        id_cliente,
        razon_social,
        ruc,
        tipo_documento,
        limite_credito_pen,
        limite_credito_usd,
        usar_limite_credito,
        credito_utilizado_pen,
        credito_utilizado_usd
      FROM clientes 
      WHERE id_cliente = ?
    `, [id]);
    
    if (!clienteResult.success || clienteResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }
    
    const cliente = clienteResult.data[0];
    
    // CORRECCIÓN: Filtramos por tipo_venta = 'Crédito'
    const deudaPenResult = await executeQuery(`
      SELECT COALESCE(SUM(total - monto_pagado), 0) as deuda_pen
      FROM ordenes_venta
      WHERE id_cliente = ?
      AND moneda = 'PEN'
      AND tipo_venta = 'Crédito'
      AND estado NOT IN ('Cancelada') 
      AND estado_pago != 'Pagado'
    `, [id]);
    
    const deudaUsdResult = await executeQuery(`
      SELECT COALESCE(SUM(total - monto_pagado), 0) as deuda_usd
      FROM ordenes_venta
      WHERE id_cliente = ?
      AND moneda = 'USD'
      AND tipo_venta = 'Crédito'
      AND estado NOT IN ('Cancelada')
      AND estado_pago != 'Pagado'
    `, [id]);
    
    const deudaPen = parseFloat(deudaPenResult.data[0]?.deuda_pen || 0);
    const deudaUsd = parseFloat(deudaUsdResult.data[0]?.deuda_usd || 0);
    
    const limitePen = parseFloat(cliente.limite_credito_pen || 0);
    const limiteUsd = parseFloat(cliente.limite_credito_usd || 0);
    
    const disponiblePen = limitePen - deudaPen;
    const disponibleUsd = limiteUsd - deudaUsd;
    
    res.json({
      success: true,
      data: {
        id_cliente: cliente.id_cliente,
        razon_social: cliente.razon_social,
        ruc: cliente.ruc,
        tipo_documento: cliente.tipo_documento,
        usar_limite_credito: cliente.usar_limite_credito === 1,
        credito_pen: {
          limite: limitePen,
          utilizado: deudaPen,
          disponible: disponiblePen,
          porcentaje_utilizado: limitePen > 0 ? (deudaPen / limitePen * 100).toFixed(2) : 0
        },
        credito_usd: {
          limite: limiteUsd,
          utilizado: deudaUsd,
          disponible: disponibleUsd,
          porcentaje_utilizado: limiteUsd > 0 ? (deudaUsd / limiteUsd * 100).toFixed(2) : 0
        }
      }
    });
    
  } catch (error) {
    console.error('Error al obtener estado de crédito:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function addDireccionCliente(req, res) {
  try {
    const { id } = req.params;
    const { direccion, referencia, es_principal } = req.body;

    if (!direccion) {
      return res.status(400).json({ error: 'La dirección es requerida' });
    }

    if (es_principal) {
      await executeQuery(
        'UPDATE clientes_direcciones SET es_principal = 0 WHERE id_cliente = ?',
        [id]
      );
      
      await executeQuery(
        'UPDATE clientes SET direccion_despacho = ? WHERE id_cliente = ?',
        [direccion, id]
      );
    }

    const result = await executeQuery(
      `INSERT INTO clientes_direcciones (id_cliente, direccion, referencia, es_principal) 
       VALUES (?, ?, ?, ?)`,
      [id, direccion, referencia || null, es_principal ? 1 : 0]
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'Dirección agregada exitosamente',
      id_direccion: result.data.insertId
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteDireccionCliente(req, res) {
  try {
    const { id_direccion } = req.params;

    const check = await executeQuery('SELECT * FROM clientes_direcciones WHERE id_direccion = ?', [id_direccion]);
    
    if (check.data.length > 0 && check.data[0].es_principal === 1) {
       return res.status(400).json({ error: 'No se puede eliminar la dirección principal. Asigne otra como principal primero.' });
    }

    const result = await executeQuery(
      'UPDATE clientes_direcciones SET estado = "Inactivo" WHERE id_direccion = ?',
      [id_direccion]
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, message: 'Dirección eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}