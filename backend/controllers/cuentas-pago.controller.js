import { executeQuery, executeTransaction } from '../config/database.js';

// ==================== GESTIÓN DE CUENTAS ====================

export const getAllCuentasPago = async (req, res) => {
  try {
    const { tipo, moneda, estado } = req.query;
    
    let sql = `
      SELECT 
        cp.*,
        (SELECT COUNT(*) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta) as total_movimientos,
        (SELECT SUM(monto) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Ingreso') as total_ingresos,
        (SELECT SUM(monto) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Egreso') as total_egresos
      FROM cuentas_pago cp
      WHERE 1=1
    `;
    const params = [];
    
    if (tipo) {
      sql += ' AND cp.tipo = ?';
      params.push(tipo);
    }
    
    if (moneda) {
      sql += ' AND cp.moneda = ?';
      params.push(moneda);
    }
    
    if (estado) {
      sql += ' AND cp.estado = ?';
      params.push(estado);
    }
    
    sql += ' ORDER BY cp.fecha_creacion DESC';
    
    const result = await executeQuery(sql, params);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
};

export const getCuentaPagoById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(`
      SELECT 
        cp.*,
        (SELECT COUNT(*) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta) as total_movimientos
      FROM cuentas_pago cp
      WHERE cp.id_cuenta = ?
    `, [id]);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    if (result.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
};

export const createCuentaPago = async (req, res) => {
  try {
    const {
      nombre,
      tipo,
      numero_cuenta,
      banco,
      moneda,
      saldo_inicial,
      descripcion,
      titular
    } = req.body;
    
    if (!nombre || !tipo || !moneda) {
      return res.status(400).json({
        success: false,
        error: 'Nombre, tipo y moneda son obligatorios'
      });
    }
    
    const tiposValidos = ['Banco', 'Efectivo', 'Billetera Digital', 'Cuenta Personal'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de cuenta no válido'
      });
    }
    
    const monedasValidas = ['PEN', 'USD', 'EUR'];
    if (!monedasValidas.includes(moneda)) {
      return res.status(400).json({
        success: false,
        error: 'Moneda no válida'
      });
    }
    
    const saldoInicial = parseFloat(saldo_inicial || 0);
    
    const result = await executeQuery(`
      INSERT INTO cuentas_pago (
        nombre,
        tipo,
        numero_cuenta,
        banco,
        moneda,
        saldo_actual,
        saldo_inicial,
        descripcion,
        titular,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo')
    `, [
      nombre,
      tipo,
      numero_cuenta || null,
      banco || null,
      moneda,
      saldoInicial,
      saldoInicial,
      descripcion || null,
      titular || null
    ]);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    // Registrar movimiento inicial si hay saldo
    if (saldoInicial > 0) {
      await executeQuery(`
        INSERT INTO movimientos_cuentas (
          id_cuenta,
          tipo_movimiento,
          monto,
          concepto,
          fecha_movimiento,
          saldo_anterior,
          saldo_nuevo
        ) VALUES (?, 'Ingreso', ?, 'Saldo inicial', NOW(), 0, ?)
      `, [result.data.insertId, saldoInicial, saldoInicial]);
    }
    
    res.status(201).json({
      success: true,
      message: 'Cuenta creada exitosamente',
      data: {
        id_cuenta: result.data.insertId
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
};

export const updateCuentaPago = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      tipo,
      numero_cuenta,
      banco,
      moneda,
      descripcion,
      titular,
      estado
    } = req.body;
    
    const checkResult = await executeQuery(
      'SELECT id_cuenta FROM cuentas_pago WHERE id_cuenta = ?',
      [id]
    );
    
    if (!checkResult.success) {
      return res.status(500).json({
        success: false,
        error: checkResult.error
      });
    }
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }
    
    const result = await executeQuery(`
      UPDATE cuentas_pago
      SET nombre = ?,
          tipo = ?,
          numero_cuenta = ?,
          banco = ?,
          moneda = ?,
          descripcion = ?,
          titular = ?,
          estado = ?
      WHERE id_cuenta = ?
    `, [
      nombre,
      tipo,
      numero_cuenta || null,
      banco || null,
      moneda,
      descripcion || null,
      titular || null,
      estado || 'Activo',
      id
    ]);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: 'Cuenta actualizada exitosamente'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
};

export const deleteCuentaPago = async (req, res) => {
  try {
    const { id } = req.params;
    
    const checkResult = await executeQuery(
      'SELECT estado, saldo_actual FROM cuentas_pago WHERE id_cuenta = ?',
      [id]
    );
    
    if (!checkResult.success) {
      return res.status(500).json({
        success: false,
        error: checkResult.error
      });
    }
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }
    
    const cuenta = checkResult.data[0];
    
    if (parseFloat(cuenta.saldo_actual) !== 0) {
      return res.status(400).json({
        success: false,
        error: 'No se puede desactivar una cuenta con saldo diferente a 0'
      });
    }
    
    const result = await executeQuery(
      'UPDATE cuentas_pago SET estado = "Inactivo" WHERE id_cuenta = ?',
      [id]
    );
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: 'Cuenta desactivada exitosamente'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
};

// ==================== MOVIMIENTOS DE CUENTAS ====================

export const registrarMovimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tipo_movimiento,
      monto,
      concepto,
      referencia,
      id_orden_compra,
      id_cuota
    } = req.body;
    
    const id_registrado_por = req.user?.id_empleado || null;
    
    if (!tipo_movimiento || !monto || monto <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de movimiento y monto son obligatorios'
      });
    }
    
    const tiposValidos = ['Ingreso', 'Egreso', 'Transferencia'];
    if (!tiposValidos.includes(tipo_movimiento)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de movimiento no válido'
      });
    }
    
    const cuentaResult = await executeQuery(
      'SELECT * FROM cuentas_pago WHERE id_cuenta = ? AND estado = "Activo"',
      [id]
    );
    
    if (!cuentaResult.success) {
      return res.status(500).json({
        success: false,
        error: cuentaResult.error
      });
    }
    
    if (cuentaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada o inactiva'
      });
    }
    
    const cuenta = cuentaResult.data[0];
    const saldoAnterior = parseFloat(cuenta.saldo_actual);
    const montoMovimiento = parseFloat(monto);
    
    let saldoNuevo;
    if (tipo_movimiento === 'Ingreso') {
      saldoNuevo = saldoAnterior + montoMovimiento;
    } else {
      if (saldoAnterior < montoMovimiento) {
        return res.status(400).json({
          success: false,
          error: 'Saldo insuficiente en la cuenta'
        });
      }
      saldoNuevo = saldoAnterior - montoMovimiento;
    }
    
    const movimientoResult = await executeQuery(`
      INSERT INTO movimientos_cuentas (
        id_cuenta,
        tipo_movimiento,
        monto,
        concepto,
        referencia,
        id_orden_compra,
        id_cuota,
        saldo_anterior,
        saldo_nuevo,
        id_registrado_por,
        fecha_movimiento
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      id,
      tipo_movimiento,
      montoMovimiento,
      concepto || null,
      referencia || null,
      id_orden_compra || null,
      id_cuota || null,
      saldoAnterior,
      saldoNuevo,
      id_registrado_por
    ]);
    
    if (!movimientoResult.success) {
      return res.status(500).json({
        success: false,
        error: movimientoResult.error
      });
    }
    
    await executeQuery(
      'UPDATE cuentas_pago SET saldo_actual = ? WHERE id_cuenta = ?',
      [saldoNuevo, id]
    );
    
    res.status(201).json({
      success: true,
      message: 'Movimiento registrado exitosamente',
      data: {
        id_movimiento: movimientoResult.data.insertId,
        saldo_anterior: saldoAnterior,
        saldo_nuevo: saldoNuevo
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
};

export const getMovimientosCuenta = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin, tipo_movimiento } = req.query;
    
    let sql = `
      SELECT 
        mc.*,
        e.nombre_completo as registrado_por_nombre,
        oc.numero_orden,
        coc.numero_cuota
      FROM movimientos_cuentas mc
      LEFT JOIN empleados e ON mc.id_registrado_por = e.id_empleado
      LEFT JOIN ordenes_compra oc ON mc.id_orden_compra = oc.id_orden_compra
      LEFT JOIN cuotas_orden_compra coc ON mc.id_cuota = coc.id_cuota
      WHERE mc.id_cuenta = ?
    `;
    const params = [id];
    
    if (fecha_inicio) {
      sql += ' AND DATE(mc.fecha_movimiento) >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ' AND DATE(mc.fecha_movimiento) <= ?';
      params.push(fecha_fin);
    }
    
    if (tipo_movimiento) {
      sql += ' AND mc.tipo_movimiento = ?';
      params.push(tipo_movimiento);
    }
    
    sql += ' ORDER BY mc.fecha_movimiento DESC';
    
    const result = await executeQuery(sql, params);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
};

export const getResumenCuenta = async (req, res) => {
  try {
    const { id } = req.params;
    
    const cuentaResult = await executeQuery(`
      SELECT * FROM cuentas_pago WHERE id_cuenta = ?
    `, [id]);
    
    if (!cuentaResult.success) {
      return res.status(500).json({
        success: false,
        error: cuentaResult.error
      });
    }
    
    if (cuentaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }
    
    const movimientosResult = await executeQuery(`
      SELECT 
        COUNT(*) as total_movimientos,
        SUM(CASE WHEN tipo_movimiento = 'Ingreso' THEN monto ELSE 0 END) as total_ingresos,
        SUM(CASE WHEN tipo_movimiento = 'Egreso' THEN monto ELSE 0 END) as total_egresos,
        SUM(CASE WHEN tipo_movimiento = 'Ingreso' THEN 1 ELSE 0 END) as cantidad_ingresos,
        SUM(CASE WHEN tipo_movimiento = 'Egreso' THEN 1 ELSE 0 END) as cantidad_egresos
      FROM movimientos_cuentas
      WHERE id_cuenta = ?
    `, [id]);
    
    if (!movimientosResult.success) {
      return res.status(500).json({
        success: false,
        error: movimientosResult.error
      });
    }
    
    res.json({
      success: true,
      data: {
        cuenta: cuentaResult.data[0],
        resumen: movimientosResult.data[0]
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
};

// ==================== TRANSFERENCIAS ENTRE CUENTAS ====================

export const transferirEntreCuentas = async (req, res) => {
  try {
    const {
      id_cuenta_origen,
      id_cuenta_destino,
      monto,
      concepto,
      referencia
    } = req.body;
    
    const id_registrado_por = req.user?.id_empleado || null;
    
    if (!id_cuenta_origen || !id_cuenta_destino || !monto || monto <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Cuenta origen, destino y monto son obligatorios'
      });
    }
    
    if (id_cuenta_origen === id_cuenta_destino) {
      return res.status(400).json({
        success: false,
        error: 'La cuenta origen y destino no pueden ser la misma'
      });
    }
    
    const montoTransferencia = parseFloat(monto);
    
    const operations = async (connection) => {
      const [cuentaOrigen] = await connection.query(
        'SELECT * FROM cuentas_pago WHERE id_cuenta = ? AND estado = "Activo" FOR UPDATE',
        [id_cuenta_origen]
      );
      
      const [cuentaDestino] = await connection.query(
        'SELECT * FROM cuentas_pago WHERE id_cuenta = ? AND estado = "Activo" FOR UPDATE',
        [id_cuenta_destino]
      );
      
      if (cuentaOrigen.length === 0 || cuentaDestino.length === 0) {
        throw new Error('Una o ambas cuentas no encontradas o inactivas');
      }
      
      if (cuentaOrigen[0].moneda !== cuentaDestino[0].moneda) {
        throw new Error('Las cuentas deben tener la misma moneda');
      }
      
      const saldoOrigenAnterior = parseFloat(cuentaOrigen[0].saldo_actual);
      if (saldoOrigenAnterior < montoTransferencia) {
        throw new Error('Saldo insuficiente en cuenta origen');
      }
      
      const saldoDestinoAnterior = parseFloat(cuentaDestino[0].saldo_actual);
      
      const saldoOrigenNuevo = saldoOrigenAnterior - montoTransferencia;
      const saldoDestinoNuevo = saldoDestinoAnterior + montoTransferencia;
      
      await connection.query(
        'UPDATE cuentas_pago SET saldo_actual = ? WHERE id_cuenta = ?',
        [saldoOrigenNuevo, id_cuenta_origen]
      );
      
      await connection.query(
        'UPDATE cuentas_pago SET saldo_actual = ? WHERE id_cuenta = ?',
        [saldoDestinoNuevo, id_cuenta_destino]
      );
      
      const [resultEgreso] = await connection.query(`
        INSERT INTO movimientos_cuentas (
          id_cuenta,
          tipo_movimiento,
          monto,
          concepto,
          referencia,
          saldo_anterior,
          saldo_nuevo,
          id_registrado_por,
          fecha_movimiento
        ) VALUES (?, 'Egreso', ?, ?, ?, ?, ?, ?, NOW())
      `, [
        id_cuenta_origen,
        montoTransferencia,
        concepto || `Transferencia a cuenta ${cuentaDestino[0].nombre}`,
        referencia || null,
        saldoOrigenAnterior,
        saldoOrigenNuevo,
        id_registrado_por
      ]);
      
      await connection.query(`
        INSERT INTO movimientos_cuentas (
          id_cuenta,
          tipo_movimiento,
          monto,
          concepto,
          referencia,
          saldo_anterior,
          saldo_nuevo,
          id_registrado_por,
          fecha_movimiento
        ) VALUES (?, 'Ingreso', ?, ?, ?, ?, ?, ?, NOW())
      `, [
        id_cuenta_destino,
        montoTransferencia,
        concepto || `Transferencia desde cuenta ${cuentaOrigen[0].nombre}`,
        referencia || null,
        saldoDestinoAnterior,
        saldoDestinoNuevo,
        id_registrado_por
      ]);
      
      return {
        id_movimiento_egreso: resultEgreso.insertId,
        saldo_origen_anterior: saldoOrigenAnterior,
        saldo_origen_nuevo: saldoOrigenNuevo,
        saldo_destino_anterior: saldoDestinoAnterior,
        saldo_destino_nuevo: saldoDestinoNuevo
      };
    };
    
    const result = await executeTransaction(operations);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Transferencia realizada exitosamente',
      data: result.data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
};