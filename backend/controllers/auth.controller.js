import { executeQuery } from '../config/database.js';
import jwt from 'jsonwebtoken';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Intento de login para:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Por favor, ingrese su correo electrónico y su contraseña.'
      });
    }

    const result = await executeQuery(
      'SELECT * FROM empleados WHERE email = ? AND estado = "Activo"',
      [email]
    );

    if (!result.success || result.data.length === 0) {
      console.log('❌ Usuario no encontrado:', email);
      return res.status(401).json({
        success: false,
        error: 'Las credenciales ingresadas son incorrectas. Por favor, verifícalas e intenta nuevamente.'
      });
    }

    const empleado = result.data[0];
    
    console.log('👤 Empleado encontrado:', {
      id: empleado.id_empleado,
      email: empleado.email,
      rol: empleado.rol,
      nombre: empleado.nombre_completo
    });

    if (password !== empleado.password) {
      console.log('❌ Contraseña incorrecta para:', email);
      return res.status(401).json({
        success: false,
        error: 'La contraseña es incorrecta. Por favor, verifícala e intenta nuevamente.'
      });
    }

    if (!empleado.rol) {
      console.error('❌ CRÍTICO: Empleado sin rol en BD:', empleado.id_empleado);
      return res.status(401).json({
        success: false,
        error: 'Su cuenta no tiene un rol asignado. Por favor, contacte al administrador del sistema.'
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

    const usuarioRespuesta = {
      id_empleado: empleado.id_empleado,
      nombre_completo: empleado.nombre_completo,
      email: empleado.email,
      rol: empleado.rol,
      cargo: empleado.cargo,
      dni: empleado.dni
    };

    console.log('✅ Login exitoso. Enviando respuesta:', {
      token: token.substring(0, 20) + '...',
      usuario: usuarioRespuesta
    });

    console.log('🎭 ROL ENVIADO AL FRONTEND:', empleado.rol);

    res.json({
      success: true,
      data: {
        token,
        usuario: usuarioRespuesta
      }
    });
  } catch (error) {
    console.error('❌ Error en login:', error);
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

    console.log('🔍 Token decodificado:', {
      id_empleado: decoded.id_empleado,
      email: decoded.email,
      rol: decoded.rol
    });

    const result = await executeQuery(
      'SELECT id_empleado, nombre_completo, email, rol, cargo, dni FROM empleados WHERE id_empleado = ? AND estado = "Activo"',
      [decoded.id_empleado]
    );

    if (!result.success || result.data.length === 0) {
      console.log('❌ Usuario no encontrado o inactivo:', decoded.id_empleado);
      return res.status(401).json({
        success: false,
        error: 'Token inválido o usuario inactivo'
      });
    }

    const usuario = result.data[0];

    console.log('✅ Usuario verificado:', {
      id: usuario.id_empleado,
      email: usuario.email,
      rol: usuario.rol
    });

    console.log('🎭 ROL ENVIADO EN VERIFICACIÓN:', usuario.rol);

    res.json({
      success: true,
      data: {
        usuario: usuario
      }
    });
  } catch (error) {
    console.error('❌ Error al verificar token:', error);
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