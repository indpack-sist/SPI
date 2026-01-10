import { executeQuery } from '../config/database.js';
import { validarRUC } from '../services/api-validation.service.js';

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
    
    res.json({
      success: true,
      data: result.data[0]
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

export async function createCliente(req, res) {
  try {
    const {
      ruc,
      razon_social,
      contacto,
      telefono,
      email,
      direccion_despacho,
      validar_ruc,
      estado
    } = req.body;
    if (!ruc || !razon_social) {
      return res.status(400).json({ 
        error: 'ruc y razon_social son requeridos' 
      });
    }
    if (validar_ruc) {
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

    const checkRUC = await executeQuery(
      'SELECT * FROM clientes WHERE ruc = ?',
      [ruc]
    );
    
    if (checkRUC.data.length > 0) {
      return res.status(400).json({ 
        error: 'Ya existe un cliente con ese RUC' 
      });
    }

    const result = await executeQuery(
      `INSERT INTO clientes (
        ruc, razon_social, contacto, telefono, email, direccion_despacho, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        ruc,
        razon_social,
        contacto || null,
        telefono || null,
        email || null,
        direccion_despacho || null,
        estado || 'Activo'
      ]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: {
        id_cliente: result.data.insertId,
        ruc,
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
      razon_social,
      contacto,
      telefono,
      email,
      direccion_despacho,
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
          error: 'Ya existe un cliente con ese RUC' 
        });
      }
    }

    const result = await executeQuery(
      `UPDATE clientes SET 
        ruc = ?, 
        razon_social = ?, 
        contacto = ?, 
        telefono = ?,
        email = ?, 
        direccion_despacho = ?,  
        estado = ?
      WHERE id_cliente = ?`,
      [ruc, razon_social, contacto, telefono, email, direccion_despacho, estado, id]
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