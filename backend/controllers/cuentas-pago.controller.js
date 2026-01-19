import { executeQuery, executeTransaction } from '../config/database.js';

export const getAllCuentasPago = async (req, res) => {
  try {
    const { tipo, moneda, estado } = req.query;
    
    let sql = `
      SELECT 
        cp.*,
        (SELECT COUNT(*) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta) as total_movimientos,
        (SELECT SUM(monto) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Ingreso') as total_ingresos,
        (SELECT SUM(monto) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Egreso') as total_egresos,
        (SELECT COUNT(*) FROM ordenes_compra WHERE id_cuenta_pago = cp.id_cuenta) as total_compras,
        (SELECT COUNT(*) FROM ordenes_compra WHERE id_cuenta_pago = cp.id_cuenta AND estado_pago != 'Pagado') as compras_pendientes,
        CASE 
            WHEN cp.tipo = 'Tarjeta' AND cp.fecha_renovacion IS NOT NULL AND cp.fecha_renovacion <= CURDATE() THEN 1 
            ELSE 0 
        END as requiere_renovacion
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

export const getCuentaPagoById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // CORRECCIÓN AQUÍ: Se agregó la subconsulta para total_ingresos
    const cuentaResult = await executeQuery(`
      SELECT 
        cp.*,
        (SELECT COUNT(*) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta) as total_movimientos,
        
        /* ⬇️ ESTA LÍNEA FALTABA ⬇️ */
        (SELECT COALESCE(SUM(monto), 0) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Ingreso') as total_ingresos,
        
        /* Se agregó COALESCE para evitar nulls */
        (SELECT COALESCE(SUM(monto), 0) FROM movimientos_cuentas WHERE id_cuenta = cp.id_cuenta AND tipo_movimiento = 'Egreso') as total_gastado,
        
        (SELECT COUNT(*) FROM ordenes_compra WHERE id_cuenta_pago = cp.id_cuenta) as total_compras
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

    const comprasResult = await executeQuery(`
      SELECT 
        oc.id_orden_compra,
        oc.numero_orden,
        oc.fecha_emision,
        oc.total,
        oc.estado_pago,
        oc.estado as estado_orden,
        pr.razon_social as proveedor
      FROM ordenes_compra oc
      LEFT JOIN proveedores pr ON oc.id_proveedor = pr.id_proveedor
      WHERE oc.id_cuenta_pago = ?
      ORDER BY oc.fecha_emision DESC
      LIMIT 50
    `, [id]);

    if (cuenta.tipo === 'Tarjeta' && cuenta.fecha_renovacion) {
        const fechaRenov = new Date(cuenta.fecha_renovacion);
        const hoy = new Date();
        cuenta.estado_credito = fechaRenov <= hoy ? 'Renovación Pendiente' : 'Al día';
        cuenta.credito_utilizado = parseFloat(cuenta.limite_credito || 0) - parseFloat(cuenta.saldo_actual || 0);
    }

    cuenta.compras_asociadas = comprasResult.data || [];
    
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
      banco,
      moneda,
      saldo_inicial,
      limite_credito,
      fecha_renovacion
    } = req.body;
    
    if (!nombre || !tipo || !moneda) {
      return res.status(400).json({
        success: false,
        error: 'Nombre, tipo y moneda son obligatorios'
      });
    }
    
    const tiposValidos = ['Banco', 'Caja', 'Tarjeta'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de cuenta no válido. Debe ser: Banco, Caja o Tarjeta'
      });
    }
    
    const monedasValidas = ['PEN', 'USD'];
    if (!monedasValidas.includes(moneda)) {
      return res.status(400).json({
        success: false,
        error: 'Moneda no válida. Debe ser: PEN o USD'
      });
    }
    
    const saldoInicial = parseFloat(saldo_inicial || 0);
    const limiteCredito = parseFloat(limite_credito || 0);
    
    if (tipo === 'Tarjeta' && saldoInicial > limiteCredito && limiteCredito > 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'El saldo inicial no puede ser mayor al límite de crédito' 
        });
    }
    
    const result = await executeQuery(`
      INSERT INTO cuentas_pago (
        nombre,
        tipo,
        numero_cuenta,
        banco,
        moneda,
        saldo_actual,
        limite_credito,
        fecha_renovacion,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Activo')
    `, [
      nombre,
      tipo,
      numero_cuenta || null,
      banco || null,
      moneda,
      saldoInicial,
      limiteCredito,
      fecha_renovacion || null
    ]);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    if (saldoInicial !== 0) {
      await executeQuery(`
        INSERT INTO movimientos_cuentas (
          id_cuenta,
          tipo_movimiento,
          monto,
          concepto,
          fecha_movimiento,
          saldo_anterior,
          saldo_nuevo
        ) VALUES (?, ?, ?, 'Saldo inicial', NOW(), 0, ?)
      `, [result.data.insertId, saldoInicial > 0 ? 'Ingreso' : 'Egreso', Math.abs(saldoInicial), saldoInicial]);
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
      moneda,
      estado,
      limite_credito,
      fecha_renovacion
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
          moneda = ?,
          estado = ?,
          limite_credito = ?,
          fecha_renovacion = ?
      WHERE id_cuenta = ?
    `, [
      nombre,
      tipo,
      numero_cuenta || null,
      banco || null,
      moneda,
      estado || 'Activo',
      limite_credito || 0,
      fecha_renovacion || null,
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
      'SELECT tipo, saldo_actual, limite_credito FROM cuentas_pago WHERE id_cuenta = ?',
      [id]
    );
    
    if (checkResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }
    
    const cuenta = checkResult.data[0];
    
    let puedeBorrar = false;
    
    if (cuenta.tipo === 'Tarjeta') {
        if (parseFloat(cuenta.saldo_actual) === parseFloat(cuenta.limite_credito)) {
            puedeBorrar = true;
        }
    } else {
        if (parseFloat(cuenta.saldo_actual) === 0) {
            puedeBorrar = true;
        }
    }

    if (!puedeBorrar) {
      return res.status(400).json({
        success: false,
        error: cuenta.tipo === 'Tarjeta' 
            ? 'No se puede desactivar una tarjeta con deuda pendiente' 
            : 'No se puede desactivar una cuenta con saldo diferente a 0'
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

export const renovarCreditoManual = async (req, res) => {
    try {
        const { id } = req.params;
        const { nueva_fecha_renovacion } = req.body;

        const cuentaCheck = await executeQuery('SELECT * FROM cuentas_pago WHERE id_cuenta = ?', [id]);
        if (cuentaCheck.data.length === 0) return res.status(404).json({error: 'Cuenta no encontrada'});
        
        const cuenta = cuentaCheck.data[0];

        if (cuenta.tipo !== 'Tarjeta') {
            return res.status(400).json({error: 'Solo se pueden renovar créditos de cuentas tipo Tarjeta'});
        }

        const limite = parseFloat(cuenta.limite_credito);
        const saldoActual = parseFloat(cuenta.saldo_actual);
        const diferencia = limite - saldoActual;

        if (diferencia <= 0) {
            return res.status(400).json({message: 'La cuenta ya tiene el cupo completo o excede el límite'});
        }

        const queries = [
            {
                sql: 'UPDATE cuentas_pago SET saldo_actual = ?, fecha_renovacion = ? WHERE id_cuenta = ?',
                params: [limite, nueva_fecha_renovacion || null, id]
            },
            {
                sql: 'INSERT INTO movimientos_cuentas (id_cuenta, tipo_movimiento, monto, concepto, fecha_movimiento, saldo_anterior, saldo_nuevo) VALUES (?, "Ingreso", ?, "Renovación de Crédito (Reinicio Ciclo)", NOW(), ?, ?)',
                params: [id, diferencia, saldoActual, limite]
            }
        ];

        const result = await executeTransaction(queries);

        if (!result.success) return res.status(500).json({error: result.error});

        res.json({
            success: true,
            message: 'Crédito renovado exitosamente. Saldo restaurado al límite.',
            data: { nuevo_saldo: limite }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({success: false, error: error.message});
    }
};

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
    const montoMov = parseFloat(monto);
    
    if (!tipo_movimiento || !montoMov || montoMov <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de movimiento y monto son obligatorios'
      });
    }
    
    const tiposValidos = ['Ingreso', 'Egreso'];
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
    
    if (!cuentaResult.success || cuentaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada o inactiva'
      });
    }
    
    const cuenta = cuentaResult.data[0];
    const saldoAnterior = parseFloat(cuenta.saldo_actual);
    
    let saldoNuevo;
    if (tipo_movimiento === 'Ingreso') {
      saldoNuevo = saldoAnterior + montoMov;
    } else {
      if (cuenta.tipo === 'Tarjeta') {
          if (saldoAnterior < montoMov) {
            return res.status(400).json({
              success: false,
              error: `Saldo insuficiente en tarjeta. Disponible: ${saldoAnterior} ${cuenta.moneda}`
            });
          }
      }
      saldoNuevo = saldoAnterior - montoMov;
    }
    
    const queries = [
        {
            sql: `INSERT INTO movimientos_cuentas (
                id_cuenta, tipo_movimiento, monto, concepto, referencia, 
                id_orden_compra, id_cuota, saldo_anterior, saldo_nuevo, 
                id_registrado_por, fecha_movimiento
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            params: [
                id, tipo_movimiento, montoMov, concepto || null, referencia || null,
                id_orden_compra || null, id_cuota || null, saldoAnterior, saldoNuevo, id_registrado_por
            ]
        },
        {
            sql: 'UPDATE cuentas_pago SET saldo_actual = ? WHERE id_cuenta = ?',
            params: [saldoNuevo, id]
        }
    ];

    const result = await executeTransaction(queries);
    
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
        saldo_nuevo: saldoNuevo
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
    const { fecha_inicio, fecha_fin, tipo_movimiento, mes, anio } = req.query;
    
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
        SUM(CASE WHEN tipo_movimiento = 'Ingreso' THEN monto ELSE 0 END) as total_ingresos,
        SUM(CASE WHEN tipo_movimiento = 'Egreso' THEN monto ELSE 0 END) as total_egresos,
        MAX(fecha_movimiento) as ultimo_movimiento
      FROM movimientos_cuentas
      ${whereClause}
    `, params);
    
    const comprasResult = await executeQuery(`
      SELECT 
        COUNT(*) as total_compras,
        SUM(total) as monto_total_compras,
        COUNT(CASE WHEN estado_pago != 'Pagado' THEN 1 END) as compras_pendientes
      FROM ordenes_compra
      WHERE id_cuenta_pago = ?
    `, [id]);
    
    res.json({
      success: true,
      data: {
        cuenta: cuentaResult.data[0],
        resumen_movimientos: movimientosResult.data[0],
        resumen_compras: comprasResult.data[0]
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
    const montoTransferencia = parseFloat(monto);
    
    if (!id_cuenta_origen || !id_cuenta_destino || !montoTransferencia || montoTransferencia <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos para transferencia'
      });
    }
    
    if (id_cuenta_origen === id_cuenta_destino) {
      return res.status(400).json({
        success: false,
        error: 'Cuentas origen y destino deben ser distintas'
      });
    }
    
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
        throw new Error('Una o ambas cuentas no encontradas');
      }
      
      if (cuentaOrigen[0].moneda !== cuentaDestino[0].moneda) {
        throw new Error('Las cuentas deben tener la misma moneda');
      }
      
      const saldoOrigenAnterior = parseFloat(cuentaOrigen[0].saldo_actual);
      
      if (cuentaOrigen[0].tipo === 'Tarjeta' && saldoOrigenAnterior < montoTransferencia) {
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
      
      await connection.query(`
        INSERT INTO movimientos_cuentas (
          id_cuenta, tipo_movimiento, monto, concepto, referencia, 
          saldo_anterior, saldo_nuevo, id_registrado_por, fecha_movimiento
        ) VALUES (?, 'Egreso', ?, ?, ?, ?, ?, ?, NOW())
      `, [
        id_cuenta_origen, montoTransferencia, 
        concepto || `Transferencia a ${cuentaDestino[0].nombre}`, referencia,
        saldoOrigenAnterior, saldoOrigenNuevo, id_registrado_por
      ]);
      
      await connection.query(`
        INSERT INTO movimientos_cuentas (
          id_cuenta, tipo_movimiento, monto, concepto, referencia, 
          saldo_anterior, saldo_nuevo, id_registrado_por, fecha_movimiento
        ) VALUES (?, 'Ingreso', ?, ?, ?, ?, ?, ?, NOW())
      `, [
        id_cuenta_destino, montoTransferencia, 
        concepto || `Transferencia desde ${cuentaOrigen[0].nombre}`, referencia,
        saldoDestinoAnterior, saldoDestinoNuevo, id_registrado_por
      ]);
      
      return { ok: true };
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
      message: 'Transferencia realizada exitosamente'
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
        tipo AS tipo_cuenta, 
        moneda, 
        COUNT(id_cuenta) as total_cuentas, 
        SUM(saldo_actual) as saldo_total
      FROM cuentas_pago 
      WHERE estado = 'Activo' 
      GROUP BY tipo, moneda
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