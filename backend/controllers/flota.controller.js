import { executeQuery } from '../config/database.js';

export async function getAllVehiculos(req, res) {
  try {
    const { estado } = req.query;
    
    let sql = 'SELECT * FROM flota';
    const params = [];
    
    if (estado) {
      sql += ' WHERE estado = ?';
      params.push(estado);
    }
    
    sql += ' ORDER BY placa ASC';
    
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

export async function getVehiculoById(req, res) {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(
      'SELECT * FROM flota WHERE id_vehiculo = ?',
      [id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    if (result.data.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createVehiculo(req, res) {
  try {
    const { placa, marca_modelo, capacidad_kg, capacidad_m3, estado } = req.body;
    
    if (!placa) {
      return res.status(400).json({ error: 'La placa es requerida' });
    }
    
    const checkPlaca = await executeQuery(
      'SELECT * FROM flota WHERE placa = ?',
      [placa]
    );
    
    if (checkPlaca.data.length > 0) {
      return res.status(400).json({ error: 'La placa ya está registrada' });
    }
    
    const result = await executeQuery(
      'INSERT INTO flota (placa, marca_modelo, capacidad_kg, capacidad_m3, estado) VALUES (?, ?, ?, ?, ?)',
      [placa, marca_modelo, capacidad_kg, capacidad_m3, estado || 'Disponible']
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      message: 'Vehículo registrado exitosamente',
      data: {
        id_vehiculo: result.data.insertId,
        placa,
        marca_modelo,
        capacidad_kg,
        capacidad_m3,
        estado: estado || 'Disponible'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateVehiculo(req, res) {
  try {
    const { id } = req.params;
    const { placa, marca_modelo, capacidad_kg, capacidad_m3, estado } = req.body;
    
    const checkResult = await executeQuery(
      'SELECT * FROM flota WHERE id_vehiculo = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    
    if (placa !== checkResult.data[0].placa) {
      const checkPlaca = await executeQuery(
        'SELECT * FROM flota WHERE placa = ? AND id_vehiculo != ?',
        [placa, id]
      );
      
      if (checkPlaca.data.length > 0) {
        return res.status(400).json({ error: 'La placa ya está registrada' });
      }
    }
    
    const result = await executeQuery(
      'UPDATE flota SET placa = ?, marca_modelo = ?, capacidad_kg = ?, capacidad_m3 = ?, estado = ? WHERE id_vehiculo = ?',
      [placa, marca_modelo, capacidad_kg, capacidad_m3, estado, id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Vehículo actualizado exitosamente',
      data: { id_vehiculo: parseInt(id), placa, marca_modelo, capacidad_kg, capacidad_m3, estado }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteVehiculo(req, res) {
  try {
    const { id } = req.params;
    
    const checkResult = await executeQuery(
      'SELECT * FROM flota WHERE id_vehiculo = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    
    const result = await executeQuery(
      'UPDATE flota SET estado = ? WHERE id_vehiculo = ?',
      ['Inactivo', id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Vehículo desactivado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getVehiculosDisponibles(req, res) {
  try {
    const result = await executeQuery(
      'SELECT * FROM flota WHERE estado = ? ORDER BY placa ASC',
      ['Disponible']
    );
    
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
export async function getVehiculosParaOrdenes(req, res) {
  try {
    const result = await executeQuery(
      `SELECT 
        id_vehiculo, 
        placa, 
        marca_modelo, 
        capacidad_kg, 
        capacidad_m3,
        estado
      FROM flota 
      WHERE estado IN ('Disponible', 'En Uso')
      ORDER BY placa ASC`,
      []
    );
    
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