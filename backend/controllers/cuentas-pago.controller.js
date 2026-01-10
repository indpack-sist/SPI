import pool from '../config/database.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const getAllCuentasPago = async (req, res, next) => {
  try {
    const { tipo, moneda, estado } = req.query;
    
    let query = 'SELECT * FROM cuentas_pago WHERE 1=1';
    const params = [];
    
    if (tipo) {
      query += ' AND tipo = ?';
      params.push(tipo);
    }
    
    if (moneda) {
      query += ' AND moneda = ?';
      params.push(moneda);
    }
    
    if (estado) {
      query += ' AND estado = ?';
      params.push(estado);
    }
    
    query += ' ORDER BY fecha_creacion DESC';
    
    const [cuentas] = await pool.query(query, params);
    
    res.json({
      success: true,
      data: cuentas
    });
  } catch (error) {
    next(error);
  }
};

export const getCuentaPagoById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [cuentas] = await pool.query(
      'SELECT * FROM cuentas_pago WHERE id_cuenta = ?',
      [id]
    );
    
    if (cuentas.length === 0) {
      throw new AppError('Cuenta no encontrada', 404);
    }
    
    res.json({
      success: true,
      data: cuentas[0]
    });
  } catch (error) {
    next(error);
  }
};

export const createCuentaPago = async (req, res, next) => {
  try {
    const {
      nombre,
      tipo,
      numero_cuenta,
      banco,
      moneda,
      saldo_actual
    } = req.body;
    
    if (!nombre || !tipo || !moneda) {
      throw new AppError('Nombre, tipo y moneda son obligatorios', 400);
    }
    
    const [result] = await pool.query(`
      INSERT INTO cuentas_pago (
        nombre,
        tipo,
        numero_cuenta,
        banco,
        moneda,
        saldo_actual,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, 'Activo')
    `, [
      nombre,
      tipo,
      numero_cuenta || null,
      banco || null,
      moneda,
      parseFloat(saldo_actual || 0)
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Cuenta creada exitosamente',
      data: {
        id_cuenta: result.insertId
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateCuentaPago = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      tipo,
      numero_cuenta,
      banco,
      moneda,
      saldo_actual,
      estado
    } = req.body;
    
    const [cuenta] = await pool.query(
      'SELECT id_cuenta FROM cuentas_pago WHERE id_cuenta = ?',
      [id]
    );
    
    if (cuenta.length === 0) {
      throw new AppError('Cuenta no encontrada', 404);
    }
    
    await pool.query(`
      UPDATE cuentas_pago
      SET nombre = ?,
          tipo = ?,
          numero_cuenta = ?,
          banco = ?,
          moneda = ?,
          saldo_actual = ?,
          estado = ?
      WHERE id_cuenta = ?
    `, [
      nombre,
      tipo,
      numero_cuenta || null,
      banco || null,
      moneda,
      parseFloat(saldo_actual || 0),
      estado,
      id
    ]);
    
    res.json({
      success: true,
      message: 'Cuenta actualizada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCuentaPago = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [cuenta] = await pool.query(
      'SELECT estado FROM cuentas_pago WHERE id_cuenta = ?',
      [id]
    );
    
    if (cuenta.length === 0) {
      throw new AppError('Cuenta no encontrada', 404);
    }
    
    await pool.query(
      'UPDATE cuentas_pago SET estado = "Inactivo" WHERE id_cuenta = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Cuenta desactivada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};