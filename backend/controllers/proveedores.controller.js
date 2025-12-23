import { executeQuery } from '../config/database.js';
import { validarRUC } from '../services/api-validation.service.js';

export async function getAllProveedores(req, res) {
  try {
    const { estado } = req.query;
    
    let sql = 'SELECT * FROM proveedores WHERE 1=1';
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

export async function getProveedorById(req, res) {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(
      'SELECT * FROM proveedores WHERE id_proveedor = ?',
      [id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    if (result.data.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getProveedorByRuc(req, res) {
  try {
    const { ruc } = req.params;
    
    const result = await executeQuery(
      'SELECT * FROM proveedores WHERE ruc = ?',
      [ruc]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    if (result.data.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function validarRUCProveedor(req, res) {
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
      'SELECT id_proveedor, razon_social FROM proveedores WHERE ruc = ?',
      [ruc]
    );
    
    const yaRegistrado = rucExiste.data.length > 0;
    
    res.json({
      success: true,
      valido: true,
      datos: resultadoValidacion.datos,
      ya_registrado: yaRegistrado,
      proveedor_existente: yaRegistrado ? rucExiste.data[0] : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function createProveedor(req, res) {
  try {
    const {
      ruc,
      razon_social,
      contacto,
      telefono,
      email,
      terminos_pago,
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
      'SELECT * FROM proveedores WHERE ruc = ?',
      [ruc]
    );
    
    if (checkRUC.data.length > 0) {
      return res.status(400).json({ 
        error: 'Ya existe un proveedor con ese RUC' 
      });
    }
    
    const result = await executeQuery(
      `INSERT INTO proveedores (
        ruc, razon_social, contacto, telefono, email, terminos_pago, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        ruc,
        razon_social,
        contacto || null,
        telefono || null,
        email || null,
        terminos_pago || null,
        estado || 'Activo'
      ]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      message: 'Proveedor creado exitosamente',
      data: {
        id_proveedor: result.data.insertId,
        ruc,
        razon_social
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
export async function updateProveedor(req, res) {
  try {
    const { id } = req.params;
    const {
      ruc,
      razon_social,
      contacto,
      telefono,
      email,
      terminos_pago,
      estado
    } = req.body;
    
    const checkResult = await executeQuery(
      'SELECT * FROM proveedores WHERE id_proveedor = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    
    if (ruc !== checkResult.data[0].ruc) {
      const checkRUC = await executeQuery(
        'SELECT * FROM proveedores WHERE ruc = ? AND id_proveedor != ?',
        [ruc, id]
      );
      
      if (checkRUC.data.length > 0) {
        return res.status(400).json({ 
          error: 'Ya existe un proveedor con ese RUC' 
        });
      }
    }
    
    const result = await executeQuery(
      `UPDATE proveedores SET 
        ruc = ?, razon_social = ?, contacto = ?, telefono = ?,
        email = ?, terminos_pago = ?, estado = ?
      WHERE id_proveedor = ?`,
      [ruc, razon_social, contacto, telefono, email, terminos_pago, estado, id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Proveedor actualizado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteProveedor(req, res) {
  try {
    const { id } = req.params;
    
    const checkResult = await executeQuery(
      'SELECT * FROM proveedores WHERE id_proveedor = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    
    const result = await executeQuery(
      'UPDATE proveedores SET estado = ? WHERE id_proveedor = ?',
      ['Inactivo', id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Proveedor desactivado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}