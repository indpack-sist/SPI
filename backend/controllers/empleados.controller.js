import { executeQuery } from '../config/database.js';
import { validarDNI } from '../services/api-validation.service.js';
import { ESTADOS_ATENCION } from '../utils/asignacionClientes.js';

const ATENCION_PLACEHOLDERS = ESTADOS_ATENCION.map(() => '?').join(', ');

export async function getAllEmpleados(req, res) {
  try {
    const { estado, rol } = req.query;
    
    let sql = 'SELECT id_empleado, dni, nombre_completo, email, cargo, rol, estado, restringir_clientes, fecha_registro FROM empleados WHERE 1=1';
    const params = [];
    
    if (estado) {
      sql += ' AND estado = ?';
      params.push(estado);
    }
    
    if (rol) {
      sql += ' AND rol = ?';
      params.push(rol);
    }
    
    sql += ' ORDER BY nombre_completo ASC';
    
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

export async function getEmpleadoById(req, res) {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(
      'SELECT id_empleado, dni, nombre_completo, email, cargo, rol, estado, restringir_clientes, fecha_registro FROM empleados WHERE id_empleado = ?',
      [id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    if (result.data.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getEmpleadosByRol(req, res) {
  try {
    const { rol } = req.params;
    
    const result = await executeQuery(
      'SELECT id_empleado, dni, nombre_completo, email, cargo, rol, estado FROM empleados WHERE rol = ? AND estado = ? ORDER BY nombre_completo ASC',
      [rol, 'Activo']
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

export async function validarDNIEmpleado(req, res) {
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
      'SELECT id_empleado, nombre_completo FROM empleados WHERE dni = ?',
      [dni]
    );
    
    const yaRegistrado = dniExiste.data.length > 0;
    
    res.json({
      success: true,
      valido: true,
      datos: resultadoValidacion.datos,
      ya_registrado: yaRegistrado,
      empleado_existente: yaRegistrado ? dniExiste.data[0] : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function validarEmailEmpleado(req, res) {
  try {
    const { email } = req.params;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de email inválido'
      });
    }
    
    const emailExiste = await executeQuery(
      'SELECT id_empleado, nombre_completo FROM empleados WHERE email = ?',
      [email]
    );
    
    const yaRegistrado = emailExiste.data.length > 0;
    
    res.json({
      success: true,
      disponible: !yaRegistrado,
      ya_registrado: yaRegistrado,
      empleado_existente: yaRegistrado ? emailExiste.data[0] : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function createEmpleado(req, res) {
  try {
    const {
      dni,
      nombre_completo,
      email,
      password,
      cargo,
      rol,
      validar_dni,
      estado
    } = req.body;

    if (!nombre_completo || !email || !password || !rol) {
      return res.status(400).json({ 
        error: 'nombre_completo, email, password y rol son requeridos' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Formato de email inválido' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    const checkEmail = await executeQuery(
      'SELECT * FROM empleados WHERE email = ?',
      [email]
    );
    
    if (checkEmail.data.length > 0) {
      return res.status(400).json({ 
        error: 'Ya existe un empleado con ese email' 
      });
    }
    
    if (dni && validar_dni) {
      const resultadoValidacion = await validarDNI(dni);
      
      if (!resultadoValidacion.valido) {
        return res.status(400).json({
          error: `DNI inválido: ${resultadoValidacion.error}`
        });
      }
      
      const nombreRENIEC = resultadoValidacion.datos.nombre_completo.toUpperCase();
      const nombreIngresado = nombre_completo.toUpperCase();
      
      if (nombreRENIEC !== nombreIngresado) {
        console.warn(`Advertencia: Nombre ingresado (${nombreIngresado}) no coincide con RENIEC (${nombreRENIEC})`);
      }
    }
    
    if (dni) {
      const checkDNI = await executeQuery(
        'SELECT * FROM empleados WHERE dni = ?',
        [dni]
      );
      
      if (checkDNI.data.length > 0) {
        return res.status(400).json({ 
          error: 'Ya existe un empleado con ese DNI' 
        });
      }
    }
    
    const result = await executeQuery(
      'INSERT INTO empleados (dni, nombre_completo, email, password, cargo, rol, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        dni || null, 
        nombre_completo, 
        email, 
        password,
        cargo || rol, 
        rol, 
        estado || 'Activo'
      ]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      message: 'Empleado creado exitosamente',
      data: {
        id_empleado: result.data.insertId,
        nombre_completo,
        email
      }
    });
  } catch (error) {
    console.error('Error al crear empleado:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function updateEmpleado(req, res) {
  try {
    const { id } = req.params;
    const { dni, nombre_completo, email, password, cargo, rol, estado } = req.body;

    const checkResult = await executeQuery(
      'SELECT * FROM empleados WHERE id_empleado = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    if (email && email !== checkResult.data[0].email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          error: 'Formato de email inválido' 
        });
      }

      const checkEmail = await executeQuery(
        'SELECT * FROM empleados WHERE email = ? AND id_empleado != ?',
        [email, id]
      );
      
      if (checkEmail.data.length > 0) {
        return res.status(400).json({ 
          error: 'Ya existe un empleado con ese email' 
        });
      }
    }
    
    if (dni && dni !== checkResult.data[0].dni) {
      const checkDNI = await executeQuery(
        'SELECT * FROM empleados WHERE dni = ? AND id_empleado != ?',
        [dni, id]
      );
      
      if (checkDNI.data.length > 0) {
        return res.status(400).json({ 
          error: 'Ya existe un empleado con ese DNI' 
        });
      }
    }

    let updateQuery = 'UPDATE empleados SET dni = ?, nombre_completo = ?, email = ?, cargo = ?, rol = ?, estado = ?';
    let updateParams = [dni || null, nombre_completo, email, cargo || rol, rol, estado];

    if (password && password.trim() !== '') {
      if (password.length < 6) {
        return res.status(400).json({ 
          error: 'La contraseña debe tener al menos 6 caracteres' 
        });
      }
      updateQuery += ', password = ?';
      updateParams.push(password);
    }

    updateQuery += ' WHERE id_empleado = ?';
    updateParams.push(id);
    
    const result = await executeQuery(updateQuery, updateParams);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Empleado actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar empleado:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function deleteEmpleado(req, res) {
  try {
    const { id } = req.params;
    
    const checkResult = await executeQuery(
      'SELECT * FROM empleados WHERE id_empleado = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    
    const result = await executeQuery(
      'UPDATE empleados SET estado = ? WHERE id_empleado = ?',
      ['Inactivo', id]
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Empleado desactivado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
const ROLES_CARTERA = ['Comercial', 'Ventas'];

export async function getClientesAsignados(req, res) {
  try {
    const { id } = req.params;

    const empleado = await executeQuery(
      'SELECT id_empleado, nombre_completo, rol, restringir_clientes FROM empleados WHERE id_empleado = ?',
      [id]
    );

    if (!empleado.success) return res.status(500).json({ error: empleado.error });
    if (empleado.data.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });

    const asignados = await executeQuery(
      `SELECT a.id_cliente, c.razon_social, c.ruc, c.tipo_documento,
         (SELECT COUNT(*) FROM ordenes_venta ov WHERE ov.id_cliente = c.id_cliente) AS total_ordenes,
         (SELECT COUNT(*) FROM ordenes_venta ov WHERE ov.id_cliente = c.id_cliente AND ov.estado IN (${ATENCION_PLACEHOLDERS})) AS atenciones,
         (SELECT GROUP_CONCAT(CONCAT(t.estado, ':', t.cnt) ORDER BY t.cnt DESC SEPARATOR '|')
            FROM (SELECT estado, COUNT(*) AS cnt FROM ordenes_venta WHERE id_cliente = c.id_cliente GROUP BY estado) t
         ) AS ordenes_desglose
       FROM empleado_clientes_asignados a
       INNER JOIN clientes c ON a.id_cliente = c.id_cliente
       WHERE a.id_empleado = ?
       ORDER BY c.razon_social ASC`,
      [...ESTADOS_ATENCION, id]
    );

    if (!asignados.success) return res.status(500).json({ error: asignados.error });

    res.json({
      success: true,
      data: {
        id_empleado: empleado.data[0].id_empleado,
        rol: empleado.data[0].rol,
        restringir_clientes: Number(empleado.data[0].restringir_clientes) === 1,
        ids: asignados.data.map(c => c.id_cliente),
        clientes: asignados.data
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateClientesAsignados(req, res) {
  try {
    if (req.user?.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Solo el administrador puede gestionar la cartera de clientes' });
    }

    const { id } = req.params;
    const { restringir_clientes, ids } = req.body;

    const empleado = await executeQuery(
      'SELECT id_empleado, rol FROM empleados WHERE id_empleado = ?',
      [id]
    );
    if (!empleado.success) return res.status(500).json({ error: empleado.error });
    if (empleado.data.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });

    if (!ROLES_CARTERA.includes(empleado.data[0].rol)) {
      return res.status(400).json({ error: 'La cartera de clientes solo aplica a roles Comercial o Ventas' });
    }

    const restringir = restringir_clientes ? 1 : 0;

    const updFlag = await executeQuery(
      'UPDATE empleados SET restringir_clientes = ? WHERE id_empleado = ?',
      [restringir, id]
    );
    if (!updFlag.success) return res.status(500).json({ error: updFlag.error });

    const delResult = await executeQuery(
      'DELETE FROM empleado_clientes_asignados WHERE id_empleado = ?',
      [id]
    );
    if (!delResult.success) return res.status(500).json({ error: delResult.error });

    const idsLimpios = Array.isArray(ids)
      ? [...new Set(ids.map(v => parseInt(v)).filter(v => !isNaN(v)))]
      : [];

    if (idsLimpios.length > 0) {
      const placeholders = idsLimpios.map(() => '(?, ?, ?)').join(', ');
      const params = [];
      idsLimpios.forEach(idCliente => {
        params.push(id, idCliente, req.user.id_empleado);
      });
      const insResult = await executeQuery(
        `INSERT INTO empleado_clientes_asignados (id_empleado, id_cliente, asignado_por) VALUES ${placeholders}`,
        params
      );
      if (!insResult.success) return res.status(500).json({ error: insResult.error });
    }

    res.json({
      success: true,
      message: 'Cartera de clientes actualizada exitosamente',
      data: { restringir_clientes: restringir === 1, total: idsLimpios.length }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getConductores(req, res) {
  try {
    const result = await executeQuery(
      `SELECT 
        id_empleado, 
        dni, 
        nombre_completo, 
        cargo,
        rol,
        estado
      FROM empleados 
      WHERE rol = 'Conductor' 
      AND estado = 'Activo'
      ORDER BY nombre_completo ASC`,
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