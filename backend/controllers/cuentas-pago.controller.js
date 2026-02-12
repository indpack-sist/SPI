import { executeQuery, executeTransaction } from '../config/database.js';

export const getAllCuentasPago = async (req, res) => {
  try {
    const { tipo, estado } = req.query;
    
    let sql = `
      SELECT 
        cp.*,
        (SELECT COUNT(*) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta) as total_movimientos,
        (SELECT COALESCE(SUM(monto), 0) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Ingreso' AND moneda = 'PEN') as total_ingresos_pen,
        (SELECT COALESCE(SUM(monto), 0) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Egreso' AND moneda = 'PEN') as total_egresos_pen,
        (SELECT COALESCE(SUM(monto), 0) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Ingreso' AND moneda = 'USD') as total_ingresos_usd,
        (SELECT COALESCE(SUM(monto), 0) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Egreso' AND moneda = 'USD') as total_egresos_usd
      FROM cuentas_pago cp
      WHERE 1=1
    `;
    const params = [];
    
    if (tipo) {
      sql += ' AND cp.tipo = ?';
      params.push(tipo);
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
    
    const cuentasConSaldos = result.data.map(cuenta => ({
      ...cuenta,
      saldo_pen: parseFloat(cuenta.total_ingresos_pen) - parseFloat(cuenta.total_egresos_pen),
      saldo_usd: parseFloat(cuenta.total_ingresos_usd) - parseFloat(cuenta.total_egresos_usd)
    }));
    
    res.json({
      success: true,
      data: cuentasConSaldos,
      total: cuentasConSaldos.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getCuentaPagoById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const cuentaResult = await executeQuery(`
      SELECT 
        cp.*,
        (SELECT COUNT(*) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta) as total_movimientos,
        (SELECT COALESCE(SUM(monto), 0) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Ingreso' AND moneda = 'PEN') as total_ingresos_pen,
        (SELECT COALESCE(SUM(monto), 0) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Egreso' AND moneda = 'PEN') as total_egresos_pen,
        (SELECT COALESCE(SUM(monto), 0) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Ingreso' AND moneda = 'USD') as total_ingresos_usd,
        (SELECT COALESCE(SUM(monto), 0) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Egreso' AND moneda = 'USD') as total_egresos_usd
      FROM cuentas_pago cp
      WHERE cp.id_cuenta = ?
    `, [id]);
    
    if (!cuentaResult.success || cuentaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }
    
    const cuenta = cuentaResult.data[0];
    cuenta.saldo_pen = parseFloat(cuenta.total_ingresos_pen) - parseFloat(cuenta.total_egresos_pen);
    cuenta.saldo_usd = parseFloat(cuenta.total_ingresos_usd) - parseFloat(cuenta.total_egresos_usd);
    
    res.json({
      success: true,
      data: cuenta
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const createCuentaPago = async (req, res) => {
  try {
    const {
      nombre,
      tipo,
      numero_cuenta,
      banco
    } = req.body;
    
    if (!nombre || !tipo) {
      return res.status(400).json({
        success: false,
        error: 'Nombre y tipo son obligatorios'
      });
    }
    
    const tiposValidos = ['Banco', 'Caja', 'Tarjeta'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de cuenta no válido. Debe ser: Banco, Caja o Tarjeta'
      });
    }
    
    const result = await executeQuery(`
      INSERT INTO cuentas_pago (
        nombre,
        tipo,
        numero_cuenta,
        banco,
        estado
      ) VALUES (?, ?, ?, ?, 'Activo')
    `, [
      nombre,
      tipo,
      numero_cuenta || null,
      banco || null
    ]);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
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
      error: error.message
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
      estado
    } = req.body;
    
    const checkResult = await executeQuery(
      'SELECT id_cuenta FROM cuentas_pago WHERE id_cuenta = ?',
      [id]
    );
    
    if (!checkResult.success || checkResult.data.length === 0) {
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
          estado = ?
      WHERE id_cuenta = ?
    `, [
      nombre,
      tipo,
      numero_cuenta || null,
      banco || null,
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
      error: error.message
    });
  }
};

export const deleteCuentaPago = async (req, res) => {
  try {
    const { id } = req.params;
    
    const checkResult = await executeQuery(
      'SELECT tipo FROM cuentas_pago WHERE id_cuenta = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
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
      error: error.message
    });
  }
};

export const registrarMovimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tipo_movimiento,
      moneda,
      monto,
      concepto,
      referencia,
      id_orden_compra,
      id_pago_orden_venta,
      id_cuota,
      id_letra_compra,
      id_pago_orden_compra,
      es_reembolso,
      id_empleado_relacionado
    } = req.body;
    
    const id_registrado_por = req.user?.id_empleado || null;
    const montoMov = parseFloat(monto);
    
    if (!tipo_movimiento || !moneda || !montoMov || montoMov <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de movimiento, moneda y monto son obligatorios'
      });
    }
    
    const tiposValidos = ['Ingreso', 'Egreso'];
    if (!tiposValidos.includes(tipo_movimiento)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de movimiento no válido'
      });
    }

    const monedasValidas = ['PEN', 'USD'];
    if (!monedasValidas.includes(moneda)) {
      return res.status(400).json({
        success: false,
        error: 'Moneda no válida'
      });
    }
    
    const cuentaResult = await executeQuery(
      'SELECT * FROM cuentas_pago WHERE id_cuenta = ? AND estado = "Activo"',
      [id]
    );
    
    if (!cuentaResult.success || cuentaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada o inactiva'
      });
    }
    
    const result = await executeQuery(`
      INSERT INTO movimientos_cuentas (
        id_cuenta, tipo_movimiento, moneda, monto, concepto, referencia, 
        id_orden_compra, id_pago_orden_venta, id_cuota, id_letra_compra,
        id_pago_orden_compra, es_reembolso, id_empleado_relacionado,
        id_registrado_por, fecha_movimiento
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      id, tipo_movimiento, moneda, montoMov, concepto || null, referencia || null,
      id_orden_compra || null, id_pago_orden_venta || null, id_cuota || null,
      id_letra_compra || null, id_pago_orden_compra || null,
      es_reembolso || 0, id_empleado_relacionado || null, id_registrado_por
    ]);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: 'Movimiento registrado exitosamente',
      data: {
        id_movimiento: result.data.insertId
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getMovimientosCuenta = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin, tipo_movimiento, moneda, mes, anio } = req.query;
    
    let sql = `
      SELECT 
        mc.*,
        e.nombre_completo as registrado_por_nombre,
        oc.numero_orden as numero_orden_compra,
        pr.razon_social as proveedor,
        pov.numero_pago as numero_pago_venta,
        ov.numero_orden as numero_orden_venta,
        cli.razon_social as cliente,
        coc.numero_cuota,
        coc.codigo_letra as codigo_letra_cuota,
        lc.numero_letra,
        lc.fecha_vencimiento as fecha_vencimiento_letra,
        emp_beneficiario.nombre_completo as empleado_beneficiario,
        CASE 
          WHEN mc.es_reembolso = 1 THEN 'Reembolso'
          WHEN mc.id_letra_compra IS NOT NULL THEN 'Pago Letra'
          WHEN mc.id_cuota IS NOT NULL THEN 'Pago Cuota'
          WHEN mc.id_orden_compra IS NOT NULL THEN 'Pago Compra'
          WHEN mc.id_pago_orden_venta IS NOT NULL THEN 'Cobro Venta'
          ELSE 'Otro'
        END as tipo_operacion
      FROM movimientos_cuentas mc
      LEFT JOIN empleados e ON mc.id_registrado_por = e.id_empleado
      LEFT JOIN ordenes_compra oc ON mc.id_orden_compra = oc.id_orden_compra
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      LEFT JOIN pagos_ordenes_venta pov ON mc.id_pago_orden_venta = pov.id_pago_orden
      LEFT JOIN ordenes_venta ov ON pov.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cli ON ov.id_cliente = cli.id_cliente
      LEFT JOIN cuotas_orden_compra coc ON mc.id_cuota = coc.id_cuota
      LEFT JOIN letras_compra lc ON mc.id_letra_compra = lc.id_letra
      LEFT JOIN empleados emp_beneficiario ON mc.id_empleado_relacionado = emp_beneficiario.id_empleado
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
    
    if (mes && anio) {
      sql += ' AND MONTH(mc.fecha_movimiento) = ? AND YEAR(mc.fecha_movimiento) = ?';
      params.push(mes, anio);
    } else if (anio) {
      sql += ' AND YEAR(mc.fecha_movimiento) = ?';
      params.push(anio);
    }
    
    if (tipo_movimiento) {
      sql += ' AND mc.tipo_movimiento = ?';
      params.push(tipo_movimiento);
    }

    if (moneda) {
      sql += ' AND mc.moneda = ?';
      params.push(moneda);
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
      data: result.data,
      total: result.data.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getResumenCuenta = async (req, res) => {
  try {
    const { id } = req.params;
    const { mes, anio } = req.query;
    
    const cuentaResult = await executeQuery(`
      SELECT * FROM cuentas_pago WHERE id_cuenta = ?
    `, [id]);
    
    if (!cuentaResult.success || cuentaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }
    
    let whereClause = 'WHERE id_cuenta = ?';
    const params = [id];
    
    if (mes && anio) {
      whereClause += ' AND MONTH(fecha_movimiento) = ? AND YEAR(fecha_movimiento) = ?';
      params.push(mes, anio);
    } else if (anio) {
      whereClause += ' AND YEAR(fecha_movimiento) = ?';
      params.push(anio);
    }
    
    const movimientosResult = await executeQuery(`
      SELECT 
        COUNT(*) as total_movimientos,
        SUM(CASE WHEN tipo_movimiento = 'Ingreso' AND moneda = 'PEN' THEN monto ELSE 0 END) as total_ingresos_pen,
        SUM(CASE WHEN tipo_movimiento = 'Egreso' AND moneda = 'PEN' THEN monto ELSE 0 END) as total_egresos_pen,
        SUM(CASE WHEN tipo_movimiento = 'Ingreso' AND moneda = 'USD' THEN monto ELSE 0 END) as total_ingresos_usd,
        SUM(CASE WHEN tipo_movimiento = 'Egreso' AND moneda = 'USD' THEN monto ELSE 0 END) as total_egresos_usd,
        MAX(fecha_movimiento) as ultimo_movimiento
      FROM movimientos_cuentas
      ${whereClause}
    `, params);
    
    const resumen = movimientosResult.data[0];
    resumen.saldo_pen = parseFloat(resumen.total_ingresos_pen || 0) - parseFloat(resumen.total_egresos_pen || 0);
    resumen.saldo_usd = parseFloat(resumen.total_ingresos_usd || 0) - parseFloat(resumen.total_egresos_usd || 0);
    
    res.json({
      success: true,
      data: {
        cuenta: cuentaResult.data[0],
        resumen_movimientos: resumen
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getEstadisticasCuentas = async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        cp.tipo AS tipo_cuenta,
        SUM(CASE WHEN mc.moneda = 'PEN' AND mc.tipo_movimiento = 'Ingreso' THEN mc.monto ELSE 0 END) -
        SUM(CASE WHEN mc.moneda = 'PEN' AND mc.tipo_movimiento = 'Egreso' THEN mc.monto ELSE 0 END) as saldo_pen,
        SUM(CASE WHEN mc.moneda = 'USD' AND mc.tipo_movimiento = 'Ingreso' THEN mc.monto ELSE 0 END) -
        SUM(CASE WHEN mc.moneda = 'USD' AND mc.tipo_movimiento = 'Egreso' THEN mc.monto ELSE 0 END) as saldo_usd,
        COUNT(DISTINCT cp.id_cuenta) as total_cuentas
      FROM cuentas_pago cp
      LEFT JOIN movimientos_cuentas mc ON cp.id_cuenta = mc.id_cuenta
      WHERE cp.estado = 'Activo'
      GROUP BY cp.tipo
    `);
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};