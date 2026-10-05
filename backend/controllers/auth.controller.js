import { executeQuery } from '../config/database.js';
import jwt from 'jsonwebtoken';
import { verificarPassword, hashPassword, esHash } from '../utils/password.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/security.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

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
      return res.status(401).json({
        success: false,
        error: 'Las credenciales ingresadas son incorrectas. Por favor, verifícalas e intenta nuevamente.'
      });
    }

    const empleado = result.data[0];

    const passwordOk = await verificarPassword(password, empleado.password);
    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        error: 'La contraseña es incorrecta. Por favor, verifícala e intenta nuevamente.'
      });
    }

    if (!esHash(empleado.password)) {
      try {
        const hash = await hashPassword(password);
        await executeQuery(
          'UPDATE empleados SET password = ? WHERE id_empleado = ?',
          [hash, empleado.id_empleado]
        );
      } catch (rehashError) {
        console.error('⚠️ No se pudo re-hashear la contraseña (acceso permitido):', rehashError);
      }
    }

    if (!empleado.rol) {
      console.error('Empleado sin rol asignado en BD');
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
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const usuarioRespuesta = {
      id_empleado: empleado.id_empleado,
      nombre_completo: empleado.nombre_completo,
      email: empleado.email,
      rol: empleado.rol,
      cargo: empleado.cargo,
      dni: empleado.dni,
      restringir_clientes: empleado.restringir_clientes
    };

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
        error: 'Token no proporcionado',
        code: 'TOKEN_MISSING'
      });
    }

    // 1) Verificación del token (errores de token => 401 genuino, cierra sesión)
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (tokenError) {
      const expirado = tokenError.name === 'TokenExpiredError';
      return res.status(401).json({
        success: false,
        error: expirado ? 'Token expirado' : 'Token inválido',
        code: expirado ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
      });
    }

    // 2) Consulta a BD. Un fallo de BD NO debe cerrar la sesión => 500 (reintentable)
    const result = await executeQuery(
      'SELECT id_empleado, nombre_completo, email, rol, cargo, dni, restringir_clientes FROM empleados WHERE id_empleado = ? AND estado = "Activo"',
      [decoded.id_empleado]
    );

    if (!result.success) {
      console.error('⚠️ Error de BD al verificar token (no se cierra sesión):', result.error);
      return res.status(500).json({
        success: false,
        error: 'Error temporal al verificar la sesión. Intente nuevamente.',
        code: 'DB_ERROR'
      });
    }

    if (result.data.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Usuario inactivo o no encontrado',
        code: 'USER_INACTIVE'
      });
    }

    const usuario = result.data[0];

    res.json({
      success: true,
      data: {
        usuario: usuario
      }
    });
  } catch (error) {
    // Aquí solo llegan errores inesperados (BD, red, etc.), NO de token.
    // No se cierra la sesión: se responde 500 para permitir reintento.
    console.error('❌ Error inesperado al verificar sesión:', error);
    res.status(500).json({
      success: false,
      error: 'Error temporal al verificar la sesión. Intente nuevamente.',
      code: 'DB_ERROR'
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
    const actualOk = await verificarPassword(password_actual, empleado.password);
    if (!actualOk) {
      return res.status(401).json({
        success: false,
        error: 'Contraseña actual incorrecta'
      });
    }

    const hashNuevo = await hashPassword(password_nuevo);
    await executeQuery(
      'UPDATE empleados SET password = ? WHERE id_empleado = ?',
      [hashNuevo, id_empleado]
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