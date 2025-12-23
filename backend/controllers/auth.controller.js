import { executeQuery } from '../config/database.js';
import jwt from 'jsonwebtoken';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      });
    }

    const result = await executeQuery(
      'SELECT * FROM empleados WHERE email = ? AND estado = "Activo"',
      [email]
    );

    if (!result.success || result.data.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    const empleado = result.data[0];
    if (password !== empleado.password) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    const token = jwt.sign(
      {
        id_empleado: empleado.id_empleado,
        email: empleado.email,
        rol: empleado.rol,
        nombre_completo: empleado.nombre_completo
      },
      process.env.JWT_SECRET || 'indpack-secret-key-2025',
      { expiresIn: '24h' }
    );
    res.json({
      success: true,
      data: {
        token,
        usuario: {
          id_empleado: empleado.id_empleado,
          nombre_completo: empleado.nombre_completo,
          email: empleado.email,
          rol: empleado.rol,
          cargo: empleado.cargo,
          dni: empleado.dni
        }
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    });
  }
};

export const verificarToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }

    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'indpack-secret-key-2025'
    );

    const result = await executeQuery(
      'SELECT id_empleado, nombre_completo, email, rol, cargo, dni FROM empleados WHERE id_empleado = ? AND estado = "Activo"',
      [decoded.id_empleado]
    );

    if (!result.success || result.data.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido o usuario inactivo'
      });
    }

    res.json({
      success: true,
      data: {
        usuario: result.data[0]
      }
    });
  } catch (error) {
    console.error('Error al verificar token:', error);
    res.status(401).json({
      success: false,
      error: 'Token inválido o expirado'
    });
  }
};

export const cambiarPassword = async (req, res) => {
  try {
    const { id_empleado } = req.params;
    const { password_actual, password_nuevo } = req.body;

    const result = await executeQuery(
      'SELECT password FROM empleados WHERE id_empleado = ?',
      [id_empleado]
    );

    if (!result.success || result.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Empleado no encontrado'
      });
    }

    const empleado = result.data[0];
    if (password_actual !== empleado.password) {
      return res.status(401).json({
        success: false,
        error: 'Contraseña actual incorrecta'
      });
    }
    await executeQuery(
      'UPDATE empleados SET password = ? WHERE id_empleado = ?',
      [password_nuevo, id_empleado]
    );

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar contraseña'
    });
  }
};