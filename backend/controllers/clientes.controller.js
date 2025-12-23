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
    
    // Verificar si existe
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